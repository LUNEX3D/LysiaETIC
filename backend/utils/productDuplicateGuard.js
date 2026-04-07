/**
 * ÜRÜN DUPLICATE KORUMA SİSTEMİ
 *
 * Tüm ürün giriş noktalarında (manuel ekleme, Excel import, marketplace sync)
 * duplike ürün oluşmasını önler.
 *
 * Kontrol Kriterleri:
 * 1. Barkod (Stok Kodu) — Unique index var, DB seviyesinde korunuyor
 * 2. Model Kodu (SKU) — Aynı kullanıcıda aynı SKU ile 2 ürün olmamalı
 * 3. Ürün Adı — Aynı isim + aynı SKU = gerçek duplike (varyantlar hariç)
 *
 * Kullanım:
 *   const guard = require('../utils/productDuplicateGuard');
 *   const check = await guard.checkDuplicates(userId, { barcode, sku, name });
 *   if (!check.isValid) {
 *     return res.status(409).json({ error: check.message, conflicts: check.conflicts });
 *   }
 */

const ProductMapping = require("../models/ProductMapping");

/**
 * Ürün duplike kontrolü yap
 * @param {ObjectId} userId - Kullanıcı ID
 * @param {Object} productData - { barcode, sku, name }
 * @param {Object} options - { excludeProductId, allowSkuDuplicates }
 * @returns {Object} { isValid, message, conflicts }
 */
async function checkDuplicates(userId, productData, options = {}) {
    const { barcode, sku, name } = productData;
    const { excludeProductId = null, allowSkuDuplicates = false } = options;

    const conflicts = {
        barcode: null,
        sku: null,
        exactMatch: null
    };

    // ═══════════════════════════════════════════════════════════════
    // 1) BARKOD (STOK KODU) KONTROLÜ
    // ═══════════════════════════════════════════════════════════════
    if (barcode) {
        const barcodeQuery = {
            userId,
            "masterProduct.barcode": barcode
        };
        if (excludeProductId) {
            barcodeQuery._id = { $ne: excludeProductId };
        }

        const existingBarcode = await ProductMapping.findOne(barcodeQuery).lean();
        if (existingBarcode) {
            conflicts.barcode = {
                id: existingBarcode._id,
                name: existingBarcode.masterProduct.name,
                sku: existingBarcode.masterProduct.sku,
                barcode: existingBarcode.masterProduct.barcode
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2) MODEL KODU (SKU) KONTROLÜ
    // ═══════════════════════════════════════════════════════════════
    if (sku && !allowSkuDuplicates) {
        const skuQuery = {
            userId,
            "masterProduct.sku": sku
        };
        if (excludeProductId) {
            skuQuery._id = { $ne: excludeProductId };
        }

        const existingSku = await ProductMapping.findOne(skuQuery).lean();
        if (existingSku) {
            conflicts.sku = {
                id: existingSku._id,
                name: existingSku.masterProduct.name,
                sku: existingSku.masterProduct.sku,
                barcode: existingSku.masterProduct.barcode
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3) TAM EŞLEŞME KONTROLÜ (Aynı isim + aynı SKU = gerçek duplike)
    // ═══════════════════════════════════════════════════════════════
    if (name && sku) {
        const exactQuery = {
            userId,
            "masterProduct.name": name,
            "masterProduct.sku": sku
        };
        if (excludeProductId) {
            exactQuery._id = { $ne: excludeProductId };
        }

        const exactMatch = await ProductMapping.findOne(exactQuery).lean();
        if (exactMatch) {
            conflicts.exactMatch = {
                id: exactMatch._id,
                name: exactMatch.masterProduct.name,
                sku: exactMatch.masterProduct.sku,
                barcode: exactMatch.masterProduct.barcode
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SONUÇ DEĞERLENDİRME
    // ═══════════════════════════════════════════════════════════════

    // Barkod duplikesi — EN KRİTİK (unique index var)
    if (conflicts.barcode) {
        return {
            isValid: false,
            type: "barcode",
            message: `Bu stok kodu (barkod) zaten kullanılıyor: "${barcode}"`,
            conflicts
        };
    }

    // SKU duplikesi — KRİTİK
    if (conflicts.sku) {
        return {
            isValid: false,
            type: "sku",
            message: `Bu model kodu (SKU) zaten kullanılıyor: "${sku}"`,
            conflicts
        };
    }

    // Tam eşleşme (aynı isim + aynı SKU) — KRİTİK
    if (conflicts.exactMatch) {
        return {
            isValid: false,
            type: "exact",
            message: `Bu ürün zaten mevcut: "${name}" (Model: ${sku})`,
            conflicts
        };
    }

    // ✅ Duplike yok
    return {
        isValid: true,
        message: "Ürün benzersiz, duplike yok",
        conflicts: null
    };
}

/**
 * Marketplace sync için akıllı eşleştirme
 * Önce SKU ile eşleştir, bulamazsan barkod ile eşleştir
 * @param {ObjectId} userId
 * @param {Object} marketplaceProduct - { barcode, sku, marketplaceProductId }
 * @returns {Object|null} Eşleşen ProductMapping veya null
 */
async function findExistingProduct(userId, marketplaceProduct) {
    const { barcode, sku, marketplaceProductId } = marketplaceProduct;

    // Öncelik sırası: SKU > Barkod > Marketplace Product ID
    const lookupKeys = [sku, barcode, marketplaceProductId].filter(Boolean);

    if (lookupKeys.length === 0) {
        return null;
    }

    // 1. Önce SKU ile ara (en güvenilir eşleştirme)
    if (sku) {
        const bySku = await ProductMapping.findOne({
            userId,
            "masterProduct.sku": sku
        });
        if (bySku) return bySku;
    }

    // 2. SKU bulunamadıysa barkod ile ara
    if (barcode) {
        const byBarcode = await ProductMapping.findOne({
            userId,
            "masterProduct.barcode": barcode
        });
        if (byBarcode) return byBarcode;
    }

    // 3. Hiçbiri bulunamadıysa null dön (yeni ürün oluşturulacak)
    return null;
}

/**
 * Toplu ürün kontrolü (Excel import için)
 * @param {ObjectId} userId
 * @param {Array} products - [{ barcode, sku, name }, ...]
 * @returns {Object} { valid: [], duplicates: [] }
 */
async function checkBulkDuplicates(userId, products) {
    const valid = [];
    const duplicates = [];

    // Tüm mevcut ürünleri tek sorguda çek (performans için)
    const allBarcodes = products.map(p => p.barcode).filter(Boolean);
    const allSkus = products.map(p => p.sku).filter(Boolean);

    const existingProducts = await ProductMapping.find({
        userId,
        $or: [
            { "masterProduct.barcode": { $in: allBarcodes } },
            { "masterProduct.sku": { $in: allSkus } }
        ]
    }).lean();

    // Hızlı lookup için Map oluştur
    const barcodeMap = new Map();
    const skuMap = new Map();
    for (const p of existingProducts) {
        if (p.masterProduct.barcode) barcodeMap.set(p.masterProduct.barcode, p);
        if (p.masterProduct.sku) skuMap.set(p.masterProduct.sku, p);
    }

    // Her ürünü kontrol et
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const { barcode, sku, name } = product;

        const existingByBarcode = barcodeMap.get(barcode);
        const existingBySku = skuMap.get(sku);

        if (existingByBarcode || existingBySku) {
            duplicates.push({
                rowIndex: i,
                product,
                conflict: existingByBarcode || existingBySku,
                reason: existingByBarcode ? "Stok kodu (barkod) mevcut" : "Model kodu (SKU) mevcut"
            });
        } else {
            valid.push({ rowIndex: i, product });
        }
    }

    return { valid, duplicates };
}

/**
 * Eski/duplike kayıtları tespit et
 * Aynı SKU ile birden fazla kayıt varsa, kategorisi boş + fiyatı 500 TL olanları "eski" olarak işaretle
 * @param {ObjectId} userId
 * @returns {Array} Silinmesi önerilen ürün ID'leri
 */
async function findLegacyDuplicates(userId) {
    const duplicateSkus = await ProductMapping.aggregate([
        { $match: { userId } },
        { $group: {
            _id: "$masterProduct.sku",
            count: { $sum: 1 },
            products: { $push: {
                id: "$_id",
                name: "$masterProduct.name",
                barcode: "$masterProduct.barcode",
                sku: "$masterProduct.sku",
                category: "$masterProduct.category",
                price: "$masterProduct.price"
            }}
        }},
        { $match: { count: { $gt: 1 } } }
    ]);

    const legacyProducts = [];

    for (const group of duplicateSkus) {
        const products = group.products;

        // Kategorisi boş + fiyatı 500 TL olanları bul (eski placeholder kayıtlar)
        const legacy = products.filter(p =>
            (!p.category || p.category === "") &&
            (p.price === 500 || p.price === 0)
        );

        // Gerçek kayıtları bul (kategorisi dolu veya fiyatı farklı)
        const real = products.filter(p =>
            (p.category && p.category !== "") ||
            (p.price !== 500 && p.price !== 0)
        );

        // Eğer hem eski hem gerçek kayıt varsa, eski olanları işaretle
        if (legacy.length > 0 && real.length > 0) {
            legacyProducts.push(...legacy.map(p => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                barcode: p.barcode,
                reason: "Eski placeholder kayıt (kategorisi boş, fiyat 500 TL)"
            })));
        }
    }

    return legacyProducts;
}

module.exports = {
    checkDuplicates,
    findExistingProduct,
    checkBulkDuplicates,
    findLegacyDuplicates
};
