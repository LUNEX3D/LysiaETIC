/**
 * MASTER PRODUCT ADAPTER
 *
 * 3 Katmanlı Mimari:
 *   Katman 1 — fromTrendyol()   : Trendyol ham verisini → Master Product'a çevirir
 *   Katman 2 — autoFix()        : Master Product'u doğrular ve eksikleri tamamlar
 *   Katman 3 — toN11()          : Master Product'u → N11 payload'ına çevirir (n11MappingService ile)
 *
 * Kullanım:
 *   const master  = fromTrendyol(rawTrendyolProduct)
 *   const fixed   = autoFix(master)
 *   const payload = await toN11(fixed, userId, credentials)
 */

const logger = require("../config/logger");

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Fiyat normalize
// ─────────────────────────────────────────────────────────────────────────────
const parsePrice = (val) => {
    if (!val && val !== 0) return 0;
    const str = val.toString().trim();
    // "1.999,99" → Türkçe format
    if (str.includes(".") && str.includes(",")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (str.includes(",")) {
        return parseFloat(str.replace(",", ".")) || 0;
    }
    return parseFloat(str) || 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 1 — fromTrendyol()
// Trendyol ham ürün verisini → Master Product formatına çevirir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} raw - Trendyol API'den gelen ham ürün
 * @returns {Object} masterProduct
 */
const fromTrendyol = (raw) => {
    // Fiyat normalize: Trendyol bazen kuruş gönderir.
    // Güvenli eşik: 100.000 TL üzeri TAM SAYI ise kuruş olarak yorumla.
    // (Eski eşik 10.000 idi — 10.500 TL gibi gerçek fiyatları yanlış bölüyordu)
    const rawSale = parsePrice(raw.salePrice || raw.price || 0);
    const rawList = parsePrice(raw.listPrice || raw.salePrice || raw.price || 0);
    const isKurus = Number.isInteger(rawSale) && rawSale > 100000;
    const salePrice = isKurus ? rawSale / 100 : rawSale;
    const listPrice = isKurus ? rawList / 100 : rawList;

    // Attribute'ları hem attributes hem variantAttributes'tan topla
    const allAttrs = [
        ...(raw.attributes       || []),
        ...(raw.variantAttributes || [])
    ];
    const findAttr = (name) =>
        allAttrs.find(a =>
            (a.attributeName || "").toLowerCase() === name.toLowerCase()
        )?.attributeValue || null;

    // Görseller — { url } objesi veya string olabilir
    const images = (raw.images || raw.media || [])
        .map(img => typeof img === "string" ? img : img?.url)
        .filter(url => url && typeof url === "string" && url.startsWith("https://"));

    // Marka
    const brand = typeof raw.brand === "string"
        ? raw.brand
        : (raw.brand?.name || "");

    return {
        // Kimlik
        barcode:              raw.barcode || raw.stockCode || "",
        sku:                  raw.stockCode || raw.barcode || "",
        marketplaceProductId: raw.productCode || raw.id || "",

        // İçerik
        title:       (raw.title || raw.name || "").trim(),
        description: (raw.description || "").trim(),
        images,

        // Fiyat & Stok
        price:     salePrice,
        listPrice: listPrice,
        stock:     parseInt(raw.quantity || 0),
        vatRate:   parseInt(raw.vatRate || 10),

        // Kategori & Marka
        category:  raw.categoryName || raw.category?.name || "",
        brand,

        // Attribute'lar (normalize edilmiş key-value map)
        attributes: {
            color:    findAttr("Renk")     || raw.color    || null,
            size:     findAttr("Beden")    || null,
            gender:   findAttr("Cinsiyet") || raw.gender   || null,
            material: findAttr("Materyal") || null,
            model:    findAttr("Model")    || null
        },

        // Kaynak bilgisi
        source: "Trendyol"
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 2 — autoFix()
// Master Product'u doğrular, eksikleri tamamlar, N11 kurallarını uygular
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} master - fromTrendyol() çıktısı
 * @returns {Object} fixed masterProduct
 */
const autoFix = (master) => {
    const fixed = { ...master, attributes: { ...(master.attributes || {}) } };
    const fixes = [];

    // ── Marka ────────────────────────────────────────────────────────────────
    if (!fixed.brand || fixed.brand.trim() === "") {
        fixed.brand = "Genel";
        fixes.push("brand → 'Genel'");
    }

    // ── Model ─────────────────────────────────────────────────────────────────
    if (!fixed.attributes.model || fixed.attributes.model.trim() === "") {
        fixed.attributes.model = "Standart";
        fixes.push("model → 'Standart'");
    }

    // ── Başlık ────────────────────────────────────────────────────────────────
    if (!fixed.title || fixed.title.trim() === "") {
        fixed.title = fixed.sku || fixed.barcode || "Ürün";
        fixes.push(`title → '${fixed.title}'`);
    }

    // ── Açıklama ──────────────────────────────────────────────────────────────
    if (!fixed.description || fixed.description.trim() === "") {
        fixed.description = fixed.title;
        fixes.push("description → title");
    }

    // ── Fiyat ────────────────────────────────────────────────────────────────
    // Fiyat hiçbir zaman değiştirilmez — kaynak platformdaki orijinal fiyat
    // tüm hedef platformlara aynen gönderilir.
    // listPrice her zaman >= salePrice olmalı
    if (fixed.listPrice < fixed.price) {
        fixed.listPrice = fixed.price;
    }

    // ── Stok ──────────────────────────────────────────────────────────────────
    if (!fixed.stock || fixed.stock < 0) {
        fixed.stock = 0;
    }

    // ── SKU / Barkod ──────────────────────────────────────────────────────────
    if (!fixed.sku && fixed.barcode) {
        fixed.sku = fixed.barcode;
        fixes.push("sku → barcode");
    }
    if (!fixed.barcode && fixed.sku) {
        fixed.barcode = fixed.sku;
    }

    if (fixes.length > 0) {
        logger.info(`[AUTO-FIX] "${fixed.title}": ${fixes.join(", ")}`);
    }

    return fixed;
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 3 — toN11()
// Master Product'u → N11 API payload'ına çevirir
// n11MappingService ile kategori + attribute mapping yapar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} master       - autoFix() çıktısı
 * @param {string} userId
 * @param {Object} credentials  - { apiKey, secretKey, shipmentTemplate? }
 * @returns {Promise<Object>}   - N11 sku payload objesi
 * @throws {Error}              - Kategori mapping yoksa hata fırlatır (ürün gönderilmez)
 */
const toN11 = async (master, userId, credentials) => {
    // Lazy-require — circular dependency önlemi
    const n11MappingService      = require("./n11MappingService");
    const categoryMappingService = require("./categoryMappingService");

    // ── Kategori mapping + Attribute transform ────────────────────────────────
    // mapCategoryWithFallback: mapping varsa döndür, yoksa öneri üret + UnmappedCategory'ye kaydet
    const catResult = await categoryMappingService.mapCategoryWithFallback(
        userId,
        master,
        n11MappingService.mapCategoryToN11
    );

    // ❌ Kategori mapping yoksa ürünü GÖNDERME
    if (!catResult || !catResult.categoryId) {
        // Öneri üret (throw mesajına ekle)
        const { suggestions } = categoryMappingService.suggestN11Category(master);
        const suggestionStr   = suggestions.length > 0
            ? ` Öneriler: ${suggestions.map(s => `"${s.name}"`).join(", ")}`
            : "";

        throw new Error(
            `CATEGORY_MAPPING_MISSING: "${master.category || "?"}" kategorisi için N11 mapping bulunamadı.` +
            `${suggestionStr} ` +
            `Çözüm: /api/marketplace/n11/unmapped-categories listesinden mapping yapın.`
        );
    }

    // ── Attribute transform ───────────────────────────────────────────────────
    // catResult.categoryId'yi doğrudan transformProductForN11'e geçir
    // Böylece mapCategoryToN11 tekrar çağrılmaz, UnifiedMap/Resolver sonucu korunur
    const mapping = await n11MappingService.transformProductForN11(
        userId,
        credentials,
        master,
        {
            resolvedCategoryId:   catResult.categoryId,
            resolvedCategoryName: catResult.categoryName
        }
    );

    const resolvedCategoryId = catResult.categoryId || mapping.categoryId;

    const shipmentTemplate = (
        credentials.shipmentTemplate ||
        master.shipmentTemplate      ||
        "STANDART"
    ).toString().trim();

    const stockCode     = (master.sku || master.barcode || "").toString().trim();
    const productMainId = stockCode;

    logger.info(
        `[ADAPTER] toN11 tamamlandı — "${master.title}" | ` +
        `kategori: ${resolvedCategoryId} (${catResult.source}) | ` +
        `attribute: ${mapping.attributes.length} | marka: "${mapping.brand}"`
    );

    return {
        // Zorunlu alanlar
        title:            master.title,
        description:      master.description || master.title,
        categoryId:       resolvedCategoryId,
        currencyType:     "TL",
        productMainId,
        stockCode,
        shipmentTemplate,
        preparingDay:     parseInt(master.preparingDay) || 3,
        quantity:         parseInt(master.stock) || 0,
        salePrice:        master.price,      // autoFix zaten min 500 garantiledi
        listPrice:        master.listPrice,
        vatRate:          parseInt(master.vatRate) || 10,
        images:           master.images.map((url, i) => ({ url, order: i })),
        brand:            mapping.brand,
        attributes:       mapping.attributes, // [{ id, valueId, customValue }]

        // Opsiyonel
        ...(master.barcode ? { barcode: master.barcode.toString().trim() } : {})
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// TAM PİPELİNE — pipeline()
// Trendyol ham verisi → N11 payload (tek fonksiyon)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} rawTrendyol  - Trendyol ham ürün
 * @param {string} userId
 * @param {Object} credentials  - N11 credentials
 * @returns {Promise<Object>}   - { master, fixed, n11Payload }
 * @throws {Error}              - Kategori mapping yoksa
 */
const pipeline = async (rawTrendyol, userId, credentials) => {
    const master    = fromTrendyol(rawTrendyol);
    const fixed     = autoFix(master);
    const n11Payload = await toN11(fixed, userId, credentials);
    return { master, fixed, n11Payload };
};

module.exports = {
    fromTrendyol,
    autoFix,
    toN11,
    pipeline,
    parsePrice
};
