const ProductMapping = require("../models/ProductMapping");
const StockSyncLog = require("../models/StockSyncLog");
const Marketplace = require("../models/Marketplace");
const Order = require("../models/Order");
const logger = require("../config/logger");
const NoonService = require("./noonService");
const AliexpressService = require("./aliexpressService");
const axios = require("axios");
const n11Service = require("./n11Service");
// ✅ FIX H5: Credential'ları decrypt ederek kullan
const { decryptCredentials } = require("../utils/encryption");
const { resolveOrderItemBarcodeForStock } = require("../utils/productFieldCompare");
// ✅ FIX #1: Amazon stok push — gerçek API entegrasyonu
let amazonSpApiService;
try {
    amazonSpApiService = require("./amazon/amazonSpApiService");
} catch (e) {
    // Amazon servisi yüklenemezse null kalır — updateAmazonStock simüle eder
    amazonSpApiService = null;
}

// Pazaryeri isimlerini normalize et
const normalizeMarketplaceName = (name) => {
    if (!name) return "";
    const n = name.trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon" || n.startsWith("amazon")) return name.trim();
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    if (n === "ozon") return "Ozon";
    return name.trim();
};

/**
 * STOK SENKRONİZASYON SERVİSİ — Merkezi Stok Yönetimi (Centralized Inventory)
 *
 * PRENSİP: "Bizim programdaki stok TEK DOĞRU KAYNAK (Single Source of Truth)"
 *
 * 🔄 Akış:
 *   1. Sipariş gelir → stok düşer → TÜM platformlara ANLIK push
 *   2. İptal/iade → stok artar → TÜM platformlara ANLIK push
 *   3. Manuel güncelleme → TÜM platformlara ANLIK push
 *   4. Cron (5dk) → fark kontrolü → düzeltme push
 *
 * 🔒 Stok Kilitleme (Overselling Koruması):
 *   - Sipariş geldiğinde stok önce "reserve" edilir
 *   - Aynı anda 2 sipariş gelirse: ilk gelen reserve eder, ikincisi yetersiz stok görür
 *   - MongoDB atomic operations ($inc) ile race condition önlenir
 *
 * 🛡️ Güvenlik Stoğu (Safety Stock / Buffer):
 *   - Gerçek stok: 10, güvenlik stoğu: 2 → platformlara 8 gönderilir
 *   - Gecikmelerde bile "eksi stok" riski azalır
 *
 * 📡 Platformlara gönderilen stok = totalStock - reservedStock - safetyStock
 */

// ═══════════════════════════════════════════════════════════════
// 🔒 STOK KİLİTLEME — Atomic Reserve & Release
// ═══════════════════════════════════════════════════════════════

/**
 * Stok rezerve et (sipariş geldiğinde) — MongoDB atomic $inc ile race condition önlenir
 * @returns {Object} { success, mapping, oldStock, newStock, marketplaceStock }
 */
const reserveStock = async (userId, barcode, quantity) => {
    const { resolveMappingForOrderBarcode } = require("../utils/productFieldCompare");
    const resolved = await resolveMappingForOrderBarcode(userId, barcode);
    if (!resolved) {
        return { success: false, error: "Ürün bulunamadı", barcode };
    }

    // Atomic: totalStock düşür (tek DB operasyonu) — yalnızca kimliği doğrulanmış kayıt
    const mapping = await ProductMapping.findOneAndUpdate(
        {
            _id: resolved._id,
            userId,
            "stockTracking.totalStock": { $gte: quantity }
        },
        {
            $inc: {
                "stockTracking.totalStock": -quantity,
                "masterProduct.stock": -quantity
            }
        },
        { new: true } // Güncellenmiş dökümanı döndür
    );

    if (!mapping) {
        // Stok yetersiz veya ürün bulunamadı
        const existing = await ProductMapping.findOne({
            userId,
            $or: [
                { "masterProduct.barcode": barcode },
                { "masterProduct.sku": barcode }
            ]
        });

        if (!existing) {
            return { success: false, error: "Ürün bulunamadı", barcode };
        }

        return {
            success: false,
            error: `Yetersiz stok: mevcut=${existing.stockTracking.totalStock}, istenen=${quantity}`,
            barcode,
            currentStock: existing.stockTracking.totalStock
        };
    }

    // ✅ FIX: save() yerine atomik update'e dahil et
    // mapping.updateStockStatus() içindeki mantığı direkt DB'ye yansıtmak daha güvenli
    // mapping.save() race condition yaratabilir (başka bir process o sırada güncellerse eskisini yazar)
    
    // Stok durumunu güncelle (out_of_stock, low_stock vb.)
    const totalStock = mapping.stockTracking.totalStock;
    const threshold = mapping.stockTracking.lowStockThreshold || 10;
    let status = "in_stock";
    if (totalStock <= 0) status = "out_of_stock";
    else if (totalStock <= threshold) status = "low_stock";

    await ProductMapping.updateOne(
        { _id: mapping._id },
        { $set: { "stockTracking.status": status } }
    );

    const marketplaceStock = mapping.getMarketplaceStock();

    logger.info(`[STOCK LOCK] 🔒 Stok rezerve — ${mapping.masterProduct.name} | adet: ${quantity} | kalan: ${mapping.stockTracking.totalStock} | platformlara: ${marketplaceStock}`);

    return {
        success: true,
        mapping,
        oldStock: mapping.stockTracking.totalStock + quantity,
        newStock: mapping.stockTracking.totalStock,
        marketplaceStock
    };
};

/**
 * Stok serbest bırak (iptal/iade durumunda) — MongoDB atomic $inc
 */
const releaseStock = async (userId, barcode, quantity) => {
    const { resolveMappingForOrderBarcode } = require("../utils/productFieldCompare");
    const resolved = await resolveMappingForOrderBarcode(userId, barcode);
    if (!resolved) {
        return { success: false, error: "Ürün bulunamadı", barcode };
    }

    const mapping = await ProductMapping.findOneAndUpdate(
        {
            _id: resolved._id,
            userId
        },
        {
            $inc: {
                "stockTracking.totalStock": quantity,
                "masterProduct.stock": quantity
            }
        },
        { new: true }
    );

    if (!mapping) {
        return { success: false, error: "Ürün bulunamadı", barcode };
    }

    mapping.updateStockStatus();
    await mapping.save();

    const marketplaceStock = mapping.getMarketplaceStock();

    logger.info(`[STOCK LOCK] 🔓 Stok serbest — ${mapping.masterProduct.name} | adet: +${quantity} | yeni: ${mapping.stockTracking.totalStock} | platformlara: ${marketplaceStock}`);

    return {
        success: true,
        mapping,
        oldStock: mapping.stockTracking.totalStock - quantity,
        newStock: mapping.stockTracking.totalStock,
        marketplaceStock
    };
};

// ═══════════════════════════════════════════════════════════════
// ⚡ SİPARİŞ SATIRI — TEK MERKEZİ AKIŞ (cron + anlık sync)
// ═══════════════════════════════════════════════════════════════

const normMpKey = (n) => String(n || "").trim().toLowerCase();

/** Pazaryeri + sipariş no + barkod — çift stok düşüşünü engelleyen anahtar */
const makeOrderStockKey = (marketplaceName, orderNumber, barcode) => {
    const mp = normalizeMarketplaceName(marketplaceName) || String(marketplaceName || "").trim();
    return `${mp}:${String(orderNumber || "").trim()}:${String(barcode || "").trim()}`;
};

const resolveStockBarcodes = async (userId, barcode) => {
    const codes = new Set([String(barcode || "").trim()].filter(Boolean));
    const { resolveMappingForOrderBarcode } = require("../utils/productFieldCompare");
    const mapping = await resolveMappingForOrderBarcode(userId, barcode);
    if (mapping?.masterProduct?.barcode) codes.add(String(mapping.masterProduct.barcode).trim());
    if (mapping?.masterProduct?.sku) codes.add(String(mapping.masterProduct.sku).trim());
    return [...codes];
};

/**
 * DB-level tekrar işleme koruması — anlık sync ve cron aynı anahtarı kullanır
 */
const isOrderAlreadyProcessed = async (userId, marketplaceName, orderNumber, barcode) => {
    const mp = normalizeMarketplaceName(marketplaceName);
    const orderKey = makeOrderStockKey(mp, orderNumber, barcode);
    const barcodes = await resolveStockBarcodes(userId, barcode);
    try {
        const existing = await StockSyncLog.findOne({
            userId,
            actionType: { $in: ["order_placed", "stock_update", "webhook_order"] },
            status: { $in: ["success", "partial"] },
            $or: [
                { "order.orderId": orderKey },
                {
                    "order.orderId": String(orderNumber),
                    "marketplace.name": mp,
                    "product.barcode": { $in: barcodes }
                },
                {
                    "order.orderNumber": String(orderNumber),
                    "marketplace.name": mp,
                    "product.barcode": { $in: barcodes }
                }
            ]
        }).lean();
        return !!existing;
    } catch {
        return false;
    }
};

const deriveSyncLogStatus = (syncResults) => {
    if (!syncResults?.length) return "error";
    const ok = syncResults.filter((r) => r.syncStatus === "success").length;
    const err = syncResults.filter((r) => r.syncStatus === "error").length;
    if (err === 0) return "success";
    if (ok > 0) return "partial";
    return "error";
};

const isMongoVersionConflict = (err) =>
    err?.name === "VersionError" ||
    (typeof err?.message === "string" && err.message.includes("No matching document found"));

const mergeMarketplaceSyncFromStale = (freshDoc, staleDoc) => {
    if (!freshDoc?.marketplaceMappings || !staleDoc?.marketplaceMappings) return;
    for (const sm of staleDoc.marketplaceMappings) {
        const k = normMpKey(sm.marketplaceName);
        const t = freshDoc.marketplaceMappings.find((m) => normMpKey(m.marketplaceName) === k);
        if (!t) continue;
        if (sm.stock !== undefined) t.stock = sm.stock;
        if (sm.lastSyncDate) t.lastSyncDate = sm.lastSyncDate;
        if (sm.syncStatus !== undefined) t.syncStatus = sm.syncStatus;
        if (sm.isSynced !== undefined) t.isSynced = sm.isSynced;
        if (sm.syncError !== undefined) t.syncError = sm.syncError;
        if (sm.price !== undefined) t.price = sm.price;
        if (sm.listPrice !== undefined) t.listPrice = sm.listPrice;
    }
};

const saveProductMappingAfterPlatformSync = async (staleMapping) => {
    try {
        await staleMapping.save();
        return;
    } catch (e) {
        if (!isMongoVersionConflict(e)) throw e;
    }
    let doc = await ProductMapping.findById(staleMapping._id);
    if (!doc) throw new Error(`ProductMapping bulunamadı: ${staleMapping._id}`);
    mergeMarketplaceSyncFromStale(doc, staleMapping);
    try {
        await doc.save();
    } catch (e2) {
        if (!isMongoVersionConflict(e2)) throw e2;
        doc = await ProductMapping.findById(staleMapping._id);
        if (!doc) throw e2;
        mergeMarketplaceSyncFromStale(doc, staleMapping);
        await doc.save();
    }
};

/**
 * Tek sipariş satırı: reserve/release → tüm platformlara push → log
 */
const processOrderStockLine = async ({
    userId,
    marketplaceName,
    orderNumber,
    barcode,
    quantity = 1,
    isCancelled = false,
    actionType,
    productName,
    skipDedup = false
}) => {
    const mp = normalizeMarketplaceName(marketplaceName);
    const orderKey = makeOrderStockKey(mp, orderNumber, barcode);
    const logActionType = actionType || (isCancelled ? "stock_update" : "order_placed");

    if (!skipDedup && (await isOrderAlreadyProcessed(userId, mp, orderNumber, barcode))) {
        return { skipped: true, orderKey };
    }

    const stockResult = isCancelled
        ? await releaseStock(userId, barcode, quantity)
        : await reserveStock(userId, barcode, quantity);

    if (!stockResult.success) {
        logger.warn(`[STOCK LINE] ${mp} ${isCancelled ? "release" : "reserve"} başarısız: ${barcode} — ${stockResult.error}`);
        try {
            await StockSyncLog.create({
                userId,
                actionType: logActionType,
                product: { barcode, sku: barcode, name: productName || barcode },
                marketplace: { name: mp },
                order: {
                    orderId: orderKey,
                    orderNumber: String(orderNumber),
                    marketplace: mp,
                    quantity
                },
                changes: {
                    field: "stock",
                    oldValue: stockResult.currentStock ?? null,
                    newValue: stockResult.currentStock ?? null
                },
                status: "error",
                error: {
                    message: stockResult.error,
                    code: stockResult.error === "Ürün bulunamadı" ? "PRODUCT_NOT_FOUND" : "INSUFFICIENT_STOCK"
                },
                notification: { priority: "critical" }
            });
        } catch (logErr) {
            logger.warn(`[STOCK LINE] Hata logu yazılamadı: ${logErr.message}`);
        }
        return { success: false, error: stockResult.error, orderKey };
    }

    const { mapping, oldStock, newStock, marketplaceStock } = stockResult;

    if (oldStock === newStock) {
        return { success: true, noStockChange: true, orderKey, mapping, oldStock, newStock };
    }

    const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, null);
    await saveProductMappingAfterPlatformSync(mapping);

    const status = deriveSyncLogStatus(syncResults);
    const lowThreshold = mapping.stockTracking?.lowStockThreshold || 10;
    const syncErrors = syncResults.filter((r) => r.syncStatus === "error");

    await StockSyncLog.create({
        userId,
        actionType: logActionType,
        product: {
            productMappingId: mapping._id,
            barcode: mapping.masterProduct?.barcode || barcode,
            sku: mapping.masterProduct?.sku,
            name: productName || mapping.masterProduct?.name
        },
        marketplace: { name: mp },
        order: {
            orderId: orderKey,
            orderNumber: String(orderNumber),
            marketplace: mp,
            quantity
        },
        changes: {
            field: "stock",
            oldValue: oldStock,
            newValue: newStock,
            difference: newStock - oldStock
        },
        status,
        affectedMarketplaces: syncResults,
        ...(syncErrors.length > 0 && {
            error: {
                message: syncErrors.map((r) => `${r.name}: ${r.error || "hata"}`).join("; "),
                code: "PARTIAL_PLATFORM_SYNC"
            }
        }),
        notification: {
            priority: newStock === 0 ? "critical" : newStock <= lowThreshold ? "high" : "medium"
        }
    });

    const successCount = syncResults.filter((r) => r.syncStatus === "success").length;
    logger.info(
        `[STOCK LINE] ${mp} ${isCancelled ? "İPTAL" : "SİPARİŞ"} | ${mapping.masterProduct?.name} | ` +
        `${oldStock}→${newStock} | platform: ${successCount}/${syncResults.length} | log: ${status}`
    );

    return {
        success: true,
        noStockChange: false,
        orderKey,
        mapping,
        oldStock,
        newStock,
        marketplaceStock,
        quantity,
        syncResults,
        status
    };
};

/**
 * Kısmi / hatalı platform push'larını yeniden dene (son 24 saat)
 */
const retryPendingStockPushes = async (limit = 30) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await StockSyncLog.find({
        status: { $in: ["partial", "error"] },
        actionType: { $in: ["order_placed", "manual_sync", "auto_sync", "webhook_order", "stock_update"] },
        "product.productMappingId": { $exists: true, $ne: null },
        timestamp: { $gte: since },
        $or: [
            { "error.code": "PARTIAL_PLATFORM_SYNC" },
            { status: "partial" }
        ]
    })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

    let retried = 0;
    let fixed = 0;

    for (const log of logs) {
        const mapping = await ProductMapping.findById(log.product.productMappingId);
        if (!mapping) continue;

        const failed = (log.affectedMarketplaces || []).filter((m) => m.syncStatus === "error");
        if (failed.length === 0 && log.status === "error" && log.error?.code !== "PARTIAL_PLATFORM_SYNC") {
            continue;
        }

        const marketplaceStock = mapping.getMarketplaceStock();
        const syncResults = await syncStockToAllMarketplaces(mapping.userId, mapping, marketplaceStock, null);
        await saveProductMappingAfterPlatformSync(mapping);

        const status = deriveSyncLogStatus(syncResults);
        await StockSyncLog.updateOne(
            { _id: log._id },
            {
                $set: {
                    status,
                    affectedMarketplaces: syncResults,
                    ...(status === "success"
                        ? { error: undefined }
                        : {
                            error: {
                                message: syncResults
                                    .filter((r) => r.syncStatus === "error")
                                    .map((r) => `${r.name}: ${r.error || "hata"}`)
                                    .join("; "),
                                code: "PARTIAL_PLATFORM_SYNC"
                            }
                        })
                }
            }
        );

        retried++;
        if (status === "success") fixed++;
    }

    if (retried > 0) {
        logger.info(`[STOCK RETRY] ${retried} log yeniden denendi, ${fixed} tam başarı`);
    }

    return { retried, fixed };
};

/**
 * Sipariş kaydı sonrası anlık stok — trackingNumber = pazaryeri sipariş no
 */
const updateStockAfterOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId).lean();
        if (!order) {
            throw new Error("Sipariş bulunamadı");
        }

        const orderNumber = order.trackingNumber || String(order._id);
        const marketplaceName = order.marketplaceName || "Diğer";

        logger.info(`[STOCK SYNC] ⚡ Anlık stok: ${marketplaceName} #${orderNumber} (${order._id})`);

        const results = [];

        for (const item of order.items || []) {
            try {
                const stockBarcode = await resolveOrderItemBarcodeForStock(order.user, item);
                if (!stockBarcode) {
                    results.push({
                        barcode: item.barcode,
                        name: item.productName,
                        status: "error",
                        error: "Stok için barkod/SKU çözülemedi"
                    });
                    continue;
                }

                const lineResult = await processOrderStockLine({
                    userId: order.user,
                    marketplaceName,
                    orderNumber,
                    barcode: stockBarcode,
                    quantity: item.quantity || 1,
                    isCancelled: false,
                    actionType: "webhook_order",
                    productName: item.productName
                });

                if (lineResult.skipped) {
                    results.push({ barcode: item.barcode, status: "skipped", reason: "already_processed" });
                    continue;
                }
                if (!lineResult.success) {
                    results.push({
                        barcode: item.barcode,
                        name: item.productName,
                        status: "error",
                        error: lineResult.error
                    });
                    continue;
                }
                if (lineResult.noStockChange) {
                    results.push({ barcode: item.barcode, status: "skipped", reason: "no_stock_change" });
                    continue;
                }

                results.push({
                    barcode: item.barcode,
                    name: item.productName,
                    oldStock: lineResult.oldStock,
                    newStock: lineResult.newStock,
                    marketplaceStock: lineResult.marketplaceStock,
                    quantity: item.quantity,
                    status: lineResult.status === "partial" ? "partial" : "success",
                    marketplaces: lineResult.syncResults
                });
            } catch (error) {
                logger.error(`[STOCK SYNC] Satır hatası (${item.barcode}): ${error.message}`);
                results.push({
                    barcode: item.barcode,
                    name: item.productName,
                    status: "error",
                    error: error.message
                });
            }
        }

        return results;
    } catch (error) {
        logger.error("[STOCK SYNC] Sipariş sonrası stok güncelleme hatası:", error.message);
        throw error;
    }
};

// ═══════════════════════════════════════════════════════════════
// 🌐 TÜM PAZARYERLERINE STOK PUSH
// ═══════════════════════════════════════════════════════════════

/**
 * Tüm pazaryerlerinde stok VE fiyat senkronize et
 * @param {String} userId
 * @param {Object} productMapping — Mongoose document
 * @param {Number} newStock — Platformlara gönderilecek stok (safetyStock zaten düşülmüş olmalı)
 * @param {String} excludeMarketplace — Siparişin geldiği platform (atlanır)
 * @param {Object} priceUpdate — { salePrice, listPrice } (opsiyonel)
 */
const syncStockToAllMarketplaces = async (userId, productMapping, newStock, excludeMarketplace = null, priceUpdate = null) => {
    const results = [];
    const masterBarcode = productMapping.masterProduct?.barcode || "";
    const masterSku     = productMapping.masterProduct?.sku || "";

    const { alignAllMarketplaceIdentitiesFromMaster } = require("../utils/productFieldCompare");
    const idAlign = alignAllMarketplaceIdentitiesFromMaster(productMapping);
    if (idAlign.fixed > 0) {
        logger.warn(
            `[STOCK SYNC] Kimlik hizalaması — ${productMapping.masterProduct?.name} | ` +
            `${idAlign.fixed} pazaryeri satırı master barkod/SKU ile eşitlendi`
        );
    }

    for (const marketplaceMapping of productMapping.marketplaceMappings) {
        const mpName = normalizeMarketplaceName(marketplaceMapping.marketplaceName);
        const excludeName = excludeMarketplace ? normalizeMarketplaceName(excludeMarketplace) : null;

        // ✅ FIX: Sipariş kaynağı platformu artık ATLANMIYOR!
        // ESKİ (YANLIŞ): Siparişin geldiği platform atlanıyordu → "zaten güncel" varsayımı
        // SORUN: Platform kendi stokunu düşürdü (5→4) ama bizim hesapladığımız stok
        //   (safetyStock düşülmüş) farklı olabilir. Ayrıca DB'deki mapping.stock
        //   güncellenmezse bir sonraki cron döngüsünde "fark var" diye tekrar push eder.
        // YENİ (DOĞRU): Tüm platformlara (kaynak dahil) tutarlı stok push edilir.
        // NOT: excludeMarketplace parametresi geriye dönük uyumluluk için korunuyor
        //   ama artık kullanılmıyor (null geçilmeli).

        try {
            // Pazaryeri entegrasyonunu al (case-insensitive)
            const marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(`^${mpName}$`, "i") }
            });

            if (!marketplace) {
                results.push({
                    name: mpName,
                    syncStatus: "error",
                    error: `${mpName} entegrasyonu bulunamadı`
                });
                continue;
            }

            // ✅ Pazaryerine göre doğru productId belirle
            // Trendyol → barcode ile çalışır
            // N11 → stockCode (sku) ile çalışır
            // Hepsiburada → merchantSku ile çalışır
            // ÇiçekSepeti → stockCode ile çalışır (PUT /api/v1/Products/price-and-stock)
            let productIdForMarketplace;
            switch (mpName) {
                case "Trendyol": {
                    const { alignMarketplaceIdentityFromMaster, resolveTrendyolListingBarcode } =
                        require("../utils/productFieldCompare");
                    const masterBc = String(masterBarcode || "").trim();
                    const mpBc = String(marketplaceMapping.marketplaceBarcode || "").trim();
                    if (masterBc && mpBc && masterBc !== mpBc) {
                        logger.warn(
                            `[STOCK SYNC] Trendyol barkod uyumsuzluğu — ürün: ${productMapping.masterProduct?.name} | ` +
                            `master=${masterBc} mapping=${mpBc}; master barkod kullanılıyor ve mapping düzeltiliyor`
                        );
                        alignMarketplaceIdentityFromMaster(marketplaceMapping, productMapping.masterProduct);
                    }
                    productIdForMarketplace = resolveTrendyolListingBarcode(
                        productMapping.masterProduct,
                        marketplaceMapping
                    ) || masterSku;
                    break;
                }
                case "N11":
                    // N11: stockCode = sku
                    productIdForMarketplace =
                        marketplaceMapping.marketplaceSku ||
                        marketplaceMapping.marketplaceBarcode ||
                        masterSku ||
                        masterBarcode;
                    break;
                case "Hepsiburada":
                    // Hepsiburada: merchantSku + (varsa) hepsiburadaSku birlikte kullanılmalı
                    productIdForMarketplace =
                        {
                            merchantSku:
                                marketplaceMapping.marketplaceSku ||
                                masterSku ||
                                masterBarcode,
                            hepsiburadaSku: (() => {
                                const { isHbCatalogSku } = require("./hepsiburadaService");
                                const pid = String(marketplaceMapping.marketplaceProductId || "").trim();
                                if (isHbCatalogSku(pid)) return pid;
                                const bc = String(marketplaceMapping.marketplaceBarcode || "").trim();
                                if (isHbCatalogSku(bc)) return bc;
                                return pid || bc || "";
                            })(),
                        };
                    break;
                default:
                    productIdForMarketplace =
                        marketplaceMapping.marketplaceSku ||
                        marketplaceMapping.marketplaceProductId ||
                        masterBarcode ||
                        masterSku;
            }

            if (!productIdForMarketplace) {
                logger.warn(`[STOCK SYNC] ${mpName} için productId bulunamadı — ürün: ${productMapping.masterProduct?.name}`);
                results.push({
                    name: mpName,
                    syncStatus: "error",
                    error: `${mpName} için ürün tanımlayıcı (barcode/sku) bulunamadı`
                });
                continue;
            }

            const productIdLog = typeof productIdForMarketplace === "object"
                ? `${productIdForMarketplace.merchantSku || "-"} / ${productIdForMarketplace.hepsiburadaSku || "-"}`
                : productIdForMarketplace;
            logger.info(`[STOCK SYNC] ${mpName} güncelleniyor — productId: ${productIdLog}, stok: ${newStock}`);

            // Hepsiburada bazı hesaplarda inventory-uploads için fiyatı zorunlu istiyor.
            // UI'dan fiyat gelmemişse mevcut mapping/master fiyatını fallback olarak gönder.
            let effectivePriceUpdate = priceUpdate;
            if (mpName === "Hepsiburada" && (!priceUpdate || priceUpdate.salePrice == null || priceUpdate.salePrice === "")) {
                const fallbackSale =
                    marketplaceMapping.price ??
                    productMapping.masterProduct?.price ??
                    productMapping.masterProduct?.listPrice;
                const fallbackList =
                    marketplaceMapping.listPrice ??
                    productMapping.masterProduct?.listPrice ??
                    fallbackSale;
                const saleNum = Number(fallbackSale);
                if (Number.isFinite(saleNum) && saleNum > 0) {
                    const listNum = Number(fallbackList);
                    effectivePriceUpdate = {
                        salePrice: saleNum,
                        listPrice: Number.isFinite(listNum) && listNum > 0 ? listNum : saleNum,
                    };
                    logger.info(`[HEPSIBURADA STOCK] Fiyat fallback aktif — salePrice=${effectivePriceUpdate.salePrice} listPrice=${effectivePriceUpdate.listPrice}`);
                } else {
                    effectivePriceUpdate = null;
                    logger.warn(`[HEPSIBURADA STOCK] Geçerli satış fiyatı yok (0 veya boş) — yalnızca stok güncellemesi denenecek; ürün/master fiyatını kontrol edin`);
                }
            }

            // Stok + fiyat güncelle
            // Stok 0 ise Trendyol unlock tetiklenmesin (fiyat güncellemesi bile olsa)
            const allowUnlock = Number(newStock) > 0;
            const updateResult = await updateStockOnMarketplace(
                marketplace,
                productIdForMarketplace,
                newStock,
                effectivePriceUpdate,
                { allowUnlock }
            );

            if (updateResult.success && updateResult.skipped) {
                results.push({
                    name: mpName,
                    syncStatus: "skipped",
                    reason: updateResult.reason || "cooldown",
                    message: updateResult.message || "Bu tur atlandı"
                });
                continue;
            }

            if (updateResult.success) {
                marketplaceMapping.stock = newStock;
                marketplaceMapping.lastSyncDate = new Date();
                // Stok push başarılı olsa bile, ürün oluşturma henüz kesinleşmemiş (pending) mapping'i
                // "synced"e çekmeyelim. Aksi halde UI ürünü platformda "Aktif" gösterir.
                const prevStatus = String(marketplaceMapping.syncStatus || "").toLowerCase();
                const wasConfirmed = marketplaceMapping.isSynced === true || prevStatus === "synced";
                if (wasConfirmed) {
                    marketplaceMapping.syncStatus = "synced";
                    marketplaceMapping.isSynced = true;
                } else if (!prevStatus) {
                    marketplaceMapping.syncStatus = "pending";
                    marketplaceMapping.isSynced = false;
                }
                if (effectivePriceUpdate?.salePrice)  marketplaceMapping.price     = effectivePriceUpdate.salePrice;
                if (effectivePriceUpdate?.listPrice)  marketplaceMapping.listPrice  = effectivePriceUpdate.listPrice;

                results.push({
                    name: mpName,
                    syncStatus: "success",
                    syncedAt: new Date()
                });
            } else {
                marketplaceMapping.syncStatus = "error";
                marketplaceMapping.syncError  = updateResult.error;

                results.push({
                    name: mpName,
                    syncStatus: "error",
                    error: updateResult.error
                });
            }

        } catch (error) {
            logger.error(`[STOCK SYNC] ${mpName} senkronizasyon hatası:`, error.message);
            results.push({
                name: mpName,
                syncStatus: "error",
                error: error.message
            });
        }
    }

    return results;
};

// Pazaryerinde stok VE fiyat güncelle
const updateStockOnMarketplace = async (marketplace, productId, newStock, priceUpdate = null, options = {}) => {
    const marketplaceName = normalizeMarketplaceName(marketplace.marketplaceName);
    // ✅ FIX H5: Credential'ları decrypt et
    const credentials = decryptCredentials(marketplace.credentials);

    try {
        const lowMp = (marketplaceName || "").toLowerCase();
        if (lowMp.startsWith("amazon")) {
            return await updateAmazonStock(
                credentials,
                productId,
                newStock,
                priceUpdate,
                marketplace.marketplaceName
            );
        }

        switch (marketplaceName) {
            case "Trendyol":
                return await updateTrendyolStock(credentials, productId, newStock, priceUpdate, options);
            case "Hepsiburada":
                return await updateHepsiburadaStock(credentials, productId, newStock, priceUpdate);
            case "N11":
                return await updateN11Stock(credentials, productId, newStock, priceUpdate);
            case "ÇiçekSepeti":
                return await updateCicekSepetiStock(credentials, productId, newStock, priceUpdate);
            case "Ozon": {
                const { updateOzonStock } = require("./ozon/ozonService");
                const offerId =
                    typeof productId === "object"
                        ? productId.offerId || productId.sku
                        : productId;
                const pid =
                    typeof productId === "object" ? productId.productId : null;
                return await updateOzonStock(credentials, offerId, newStock, pid);
            }
            case "Noon":
                return await updateNoonStock(credentials, productId, newStock, priceUpdate);
            case "AliExpress":
                return await updateAliexpressStock(credentials, productId, newStock, priceUpdate);
            default:
                logger.warn(`[STOCK UPDATE] ${marketplaceName} için stok güncelleme API'si henüz eklenmedi`);
                return {
                    success: true,
                    simulated: true,
                    warning: true,
                    message: `${marketplaceName} için stok API entegrasyonu yok — simüle edildi (platformda güncellenmedi)`
                };
        }
    } catch (error) {
        logger.error(`[STOCK UPDATE] ${marketplaceName} hatası:`, error.message);
        return { success: false, error: error.message };
    }
};

// Trendyol stok + fiyat güncelleme
// options.allowUnlock — false ise stok push sonrası unlock API çağrılmaz (stok 0 ürünler satışa açılmasın)
const updateTrendyolStock = async (credentials, productId, newStock, priceUpdate = null, options = {}) => {
    try {
        const { apiKey, apiSecret, sellerId, supplierId } = credentials;
        const actualSellerId = sellerId || supplierId;
        if (!apiKey || !apiSecret || !actualSellerId) {
            return { success: false, error: "Trendyol credentials eksik (apiKey, apiSecret, sellerId)" };
        }
        if (!productId) {
            return { success: false, error: "Trendyol stok güncelleme: barcode/sku (productId) gerekli" };
        }
        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
        const trendyolHeaders = {
            Authorization: `Basic ${authHeader}`,
            "User-Agent": `${actualSellerId} - LysiaETIC`,
            "Content-Type": "application/json"
        };

        // ✅ Trendyol price-and-inventory API'si barcode alanı ile çalışır
        const stockQty = parseInt(newStock) || 0;
        const item = {
            barcode: String(productId).trim(),
            quantity: stockQty
        };
        // Fiyat güncelleme varsa ekle
        if (priceUpdate?.salePrice) item.salePrice = parseFloat(priceUpdate.salePrice);
        if (priceUpdate?.listPrice) item.listPrice = parseFloat(priceUpdate.listPrice);

        logger.info(`[TRENDYOL STOCK] Güncelleniyor — barcode: ${item.barcode}, quantity: ${item.quantity}, salePrice: ${item.salePrice || "-"}, sellerId: ${actualSellerId}`);

        const response = await axios.post(
            `https://apigw.trendyol.com/integration/inventory/sellers/${actualSellerId}/products/price-and-inventory`,
            { items: [item] },
            { headers: trendyolHeaders, timeout: 15000 }
        );

        // ✅ Trendyol batch ID döndürür — hata varsa response.data.errors içinde olur
        const batchId = response.data?.batchRequestId;
        const errors = response.data?.errors;
        if (errors && errors.length > 0) {
            const errMsg = errors.map(e => e.message || JSON.stringify(e)).join("; ");
            logger.error(`[TRENDYOL STOCK] Batch hata — barcode: ${item.barcode}, errors: ${errMsg}`);
            return { success: false, error: errMsg, batchId };
        }

        logger.info(`[TRENDYOL STOCK] ✅ Stok güncellendi — barcode: ${item.barcode}, batchId: ${batchId}`);

        // 🔓 Stok > 0 VE açıkça izin verildiyse satışa aç (unlock)
        // Fiyat güncellemesi / yanlış snapshot ile stok 0 ürünün açılmasını engelle
        const allowUnlock = options.allowUnlock !== false && stockQty > 0;
        if (allowUnlock) {
            try {
                const unlockResponse = await axios.put(
                    `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products/unlock`,
                    { items: [{ barcode: String(productId).trim() }] },
                    { headers: trendyolHeaders, timeout: 15000 }
                );
                const unlockBatchId = unlockResponse.data?.batchRequestId;
                const unlockErrors = unlockResponse.data?.errors;
                if (unlockErrors && unlockErrors.length > 0) {
                    // Unlock hatası kritik değil — ürün zaten açık olabilir, sadece logla
                    logger.warn(`[TRENDYOL UNLOCK] Uyarı — barcode: ${item.barcode}, errors: ${unlockErrors.map(e => e.message || JSON.stringify(e)).join("; ")}`);
                } else {
                    logger.info(`[TRENDYOL UNLOCK] 🔓 Ürün satışa açıldı — barcode: ${item.barcode}, batchId: ${unlockBatchId}`);
                }
            } catch (unlockErr) {
                // Unlock hatası stok güncellemeyi başarısız yapmaz — sadece logla
                const unlockMsg = unlockErr.response?.data?.errors?.[0]?.message || unlockErr.message;
                logger.warn(`[TRENDYOL UNLOCK] Unlock başarısız (stok güncelleme başarılı) — barcode: ${item.barcode}, error: ${unlockMsg}`);
            }
        }

        return { success: true, batchId, response: response.data, unlocked: allowUnlock };
    } catch (error) {
        const errData = error.response?.data;
        const errMsg = errData?.errors?.[0]?.message || errData?.message || error.message;
        logger.error(`[TRENDYOL STOCK] Hata — productId: ${productId}, status: ${error.response?.status}, error: ${errMsg}`);
        return { success: false, error: errMsg };
    }
};

// Hepsiburada stok + fiyat güncelleme
// Endpoint: POST /listings/merchantid/{merchantId}/inventory-uploads
// Auth: Basic base64(merchantId:secretKey) + User-Agent header
const updateHepsiburadaStock = async (credentials, productId, newStock, priceUpdate = null) => {
    const parseHbStockFromRow = (row = {}) => {
        const candidates = [
            row.availableStock,
            row.stock,
            row.quantity,
            row.available_stock,
            row.sellableStock
        ];
        for (const v of candidates) {
            const n = Number(v);
            if (!Number.isNaN(n)) return n;
        }
        return null;
    };

    const checkHbReadbackStock = async (ep, merchantId, secretKey, userAgent, merchantSku, hbSku) => {
        const {
            getHeadersForGet,
            normalizeHbMerchantSku
        } = require("./hepsiburadaService");
        const headers = getHeadersForGet(merchantId, secretKey, userAgent);
        const needleMerchant = normalizeHbMerchantSku(merchantSku || "");
        const needleHb = String(hbSku || "").trim();
        const limit = 200;
        for (let page = 0; page < 5; page++) {
            const offset = page * limit;
            const url = `${ep.LISTING}/listings/merchantid/${merchantId}?offset=${offset}&limit=${limit}`;
            const resp = await axios.get(url, { headers, timeout: 15000 });
            const rowsRaw = resp?.data?.data || resp?.data?.listings || resp?.data?.items || [];
            const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
            for (const row of rows) {
                const rowMerchant = normalizeHbMerchantSku(row.merchantSku || "");
                const rowHb = String(row.hepsiburadaSku || row.hbSku || "").trim();
                const matched = (needleMerchant && rowMerchant === needleMerchant) || (needleHb && rowHb === needleHb);
                if (!matched) continue;
                return {
                    found: true,
                    stock: parseHbStockFromRow(row),
                    merchantSku: row.merchantSku || "",
                    hepsiburadaSku: row.hepsiburadaSku || row.hbSku || "",
                    raw: row
                };
            }
            if (rows.length < limit) break;
        }
        return { found: false, stock: null };
    };

    const runHbSingleUpdate = async (ep, merchantId, secretKey, userAgent, hbSku, merchantSku, stockValue, pUpdate) => {
        const {
            getHeaders
        } = require("./hepsiburadaService");
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const singleUrl = `${ep.LISTING}/listings/merchantid/${merchantId}/sku/${encodeURIComponent(hbSku)}/merchantsku/${encodeURIComponent(merchantSku)}`;
        const body = { newAvailableStock: parseInt(stockValue, 10) || 0 };
        if (pUpdate?.salePrice != null && pUpdate?.salePrice !== "") {
            body.newPrice = { currency: "TRY", amount: Number(pUpdate.salePrice) || 0 };
        }
        const fallbackResp = await axios.post(singleUrl, body, { headers, timeout: 15000 });
        return fallbackResp;
    };

    try {
        const {
            normalizeCredentials,
            getEndpoints,
            validateCredentials,
            normalizeHbMerchantSku,
            postInventoryUploadListing,
            getHeaders
        } = require("./hepsiburadaService");
        const hbCreds = normalizeCredentials(credentials);
        const { merchantId, secretKey, userAgent } = hbCreds;

        const validation = validateCredentials(hbCreds, "stok güncelleme");
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const ep = getEndpoints(hbCreds);
        const rawMerchantSku = typeof productId === "object"
            ? productId.merchantSku
            : productId;
        const { isHbCatalogSku } = require("./hepsiburadaService");
        const rawHbSku = typeof productId === "object"
            ? (isHbCatalogSku(productId.hepsiburadaSku) ? productId.hepsiburadaSku : "")
            : (isHbCatalogSku(productId) ? productId : "");

        let hbs = String(rawHbSku || "").trim();
        const ms = normalizeHbMerchantSku(rawMerchantSku) || String(rawMerchantSku || "").toUpperCase().replace(/\s+/g, "");
        if (!isHbCatalogSku(hbs) && ms) {
            try {
                const probe = await checkHbReadbackStock(ep, merchantId, secretKey, userAgent, ms, "");
                if (probe.found && isHbCatalogSku(probe.hepsiburadaSku)) {
                    hbs = String(probe.hepsiburadaSku).trim();
                }
            } catch (_) { /* listing araması opsiyonel */ }
        }
        if (!hbs && isHbCatalogSku(rawHbSku)) hbs = String(rawHbSku).trim();
        const saleNum = priceUpdate?.salePrice != null && priceUpdate?.salePrice !== ""
            ? Number(priceUpdate.salePrice)
            : NaN;
        const listNum = priceUpdate?.listPrice != null && priceUpdate?.listPrice !== ""
            ? Number(priceUpdate.listPrice)
            : NaN;
        const hasValidPrice = Number.isFinite(saleNum) && saleNum > 0;

        if (!hasValidPrice) {
            try {
                const fallbackResp = await runHbSingleUpdate(ep, merchantId, secretKey, userAgent, hbs, ms, newStock, null);
                if (fallbackResp.status >= 200 && fallbackResp.status < 300) {
                    logger.info(`[HEPSIBURADA STOCK] ✅ Stok-only (tekil endpoint) — merchantSku=${ms} hbSku=${hbs} stok=${newStock}`);
                    return { success: true, response: fallbackResp.data, fallback: "single-update-stock-only" };
                }
            } catch (fbErr) {
                const fbMsg = fbErr.response?.data?.message || fbErr.message;
                return {
                    success: false,
                    error: fbMsg || "Hepsiburada stok güncellemesi için geçerli satış fiyatı gerekli (ürün fiyatını panelde tanımlayın)"
                };
            }
            return {
                success: false,
                error: "Hepsiburada: geçerli satış fiyatı olmadan inventory-uploads yapılamaz; ürün fiyatını kontrol edin"
            };
        }

        const listing = {
            hepsiburadaSku: hbs,
            merchantSku: ms || hbs,
            availableStock: newStock,
            price: saleNum,
            listPrice: Number.isFinite(listNum) && listNum > 0 ? listNum : saleNum
        };

        const response = await postInventoryUploadListing({
            ep,
            merchantId,
            secretKey,
            userAgent,
            rows: [listing]
        });

        const respData = response?.data || {};
        const locationHeader = response?.headers?.location || response?.headers?.Location || "";
        const locationMatch = String(locationHeader).match(/inventory-uploads\/id\/([a-zA-Z0-9-]+)/i);
        const inventoryUploadId =
            respData.inventoryUploadId ||
            respData.id ||
            respData.data?.inventoryUploadId ||
            respData.data?.id ||
            respData?.result?.inventoryUploadId ||
            respData?.result?.id ||
            response?.headers?.["x-inventory-upload-id"] ||
            response?.headers?.["inventory-upload-id"] ||
            locationMatch?.[1] ||
            null;
        const responseErrorMsg =
            respData?.errors?.[0]?.message ||
            respData?.message ||
            respData?.error ||
            null;
        const responseSuccess = typeof respData.success === "boolean"
            ? respData.success
            : !responseErrorMsg;
        if (!responseSuccess) {
            const err = responseErrorMsg || "Hepsiburada inventory-uploads başarısız";
            logger.warn(`[HEPSIBURADA STOCK] Güncelleme reddedildi — merchantSku=${ms} hbSku=${hbs} error=${err}`);
            return { success: false, error: err, response: respData };
        }

        // HB inventory-uploads async çalışır; gerçek sonucu kısa poll ile doğrula
        if (inventoryUploadId) {
            const headers = getHeaders(merchantId, secretKey, userAgent);
            const statusUrl = `${ep.LISTING}/listings/merchantid/${merchantId}/inventory-uploads/id/${encodeURIComponent(String(inventoryUploadId))}`;
            for (let i = 1; i <= 3; i++) {
                try {
                    if (i > 1) await new Promise((resolve) => setTimeout(resolve, i * 1500));
                    const stResp = await axios.get(statusUrl, { headers, timeout: 15000 });
                    const stData = stResp?.data || {};
                    const rawStatus = String(
                        stData.status ||
                        stData.resultStatus ||
                        stData.uploadStatus ||
                        stData.data?.status ||
                        ""
                    ).toUpperCase();

                    if (["FAILED", "FAIL", "ERROR", "REJECTED"].includes(rawStatus) || stData.success === false) {
                        const reason = stData.message || stData.error || stData.data?.message || "HB envanter güncellemesi reddedildi";
                        logger.error(`[HEPSIBURADA STOCK] ❌ Reddedildi — uploadId=${inventoryUploadId} merchantSku=${ms} hbSku=${hbs} reason=${reason}`);
                        return { success: false, error: reason, response: stData };
                    }

                    if (["SUCCESS", "COMPLETED", "DONE", "PROCESSED"].includes(rawStatus) || stData.success === true) {
                        // Onay sonrası read-back kontrolü: HB paneldeki gerçek stok ile eşleşiyor mu?
                        try {
                            const readback = await checkHbReadbackStock(ep, merchantId, secretKey, userAgent, ms, hbs);
                            if (readback.found && Number(readback.stock) !== Number(newStock)) {
                                logger.warn(
                                    `[HEPSIBURADA STOCK] Read-back farklı — merchantSku=${ms} hbSku=${hbs} ` +
                                    `beklenen=${newStock} görünen=${readback.stock} ` +
                                    `(HB row merchantSku=${readback.merchantSku || "-"} hbSku=${readback.hepsiburadaSku || "-"}) ` +
                                    `Tekil endpoint ile tekrar denenecek.`
                                );
                                await runHbSingleUpdate(
                                    ep,
                                    merchantId,
                                    secretKey,
                                    userAgent,
                                    readback.hepsiburadaSku || hbs,
                                    readback.merchantSku || ms,
                                    newStock,
                                    priceUpdate
                                );
                                const readback2 = await checkHbReadbackStock(ep, merchantId, secretKey, userAgent, ms, hbs);
                                if (readback2.found && Number(readback2.stock) !== Number(newStock)) {
                                    return {
                                        success: false,
                                        error: `HB read-back uyumsuz: beklenen ${newStock}, görünen ${readback2.stock}`,
                                        response: { uploadId: inventoryUploadId, readback: readback2 }
                                    };
                                }
                            } else if (!readback.found) {
                                logger.warn(
                                    `[HEPSIBURADA STOCK] Read-back listing bulunamadı (upload onaylı) — merchantSku=${ms} hbSku=${hbs || "-"}; ` +
                                    "HBCV SKU mapping kontrol edin"
                                );
                                return {
                                    success: true,
                                    response: stData,
                                    inventoryUploadId,
                                    readbackSkipped: true
                                };
                            }
                        } catch (rbErr) {
                            logger.warn(`[HEPSIBURADA STOCK] Read-back kontrol hatası — merchantSku=${ms} hbSku=${hbs} error=${rbErr.message}`);
                            return {
                                success: false,
                                error: `HB doğrulama hatası: ${rbErr.message}`,
                                response: { uploadId: inventoryUploadId }
                            };
                        }

                        logger.info(`[HEPSIBURADA STOCK] ✅ Onaylandı — uploadId=${inventoryUploadId} merchantSku=${ms} hbSku=${hbs} stok=${newStock}`);
                        return { success: true, response: stData, inventoryUploadId };
                    }
                } catch (pollErr) {
                    logger.warn(`[HEPSIBURADA STOCK] Poll hatası — uploadId=${inventoryUploadId} deneme=${i}/3 error=${pollErr.message}`);
                }
            }
            logger.warn(`[HEPSIBURADA STOCK] ⏳ Beklemede — uploadId=${inventoryUploadId} merchantSku=${ms} hbSku=${hbs}`);
            return {
                success: false,
                error: "HB envanter güncellemesi beklemede/sonuçlanmadı (inventoryUploadId sorgusunda net başarı dönmedi)",
                response: respData,
                inventoryUploadId
            };
        }

        // Fallback: Tekil fiyat/stok endpoint'i (HB dokümanında beta olarak geçer, bazı hesaplarda tek güvenilir yol)
        try {
            const fallbackResp = await runHbSingleUpdate(ep, merchantId, secretKey, userAgent, hbs, ms, newStock, priceUpdate);
            if (fallbackResp.status >= 200 && fallbackResp.status < 300) {
                logger.info(`[HEPSIBURADA STOCK] ✅ Tekil endpoint fallback başarılı — merchantSku=${ms} hbSku=${hbs} stok=${newStock}`);
                return { success: true, response: fallbackResp.data, fallback: "single-update" };
            }
        } catch (fbErr) {
            const fbMsg = fbErr.response?.data?.message || fbErr.message;
            logger.warn(`[HEPSIBURADA STOCK] Tekil endpoint fallback başarısız — merchantSku=${ms} hbSku=${hbs} error=${fbMsg}`);
        }

        logger.warn(`[HEPSIBURADA STOCK] UploadId alınamadı — merchantSku=${ms} hbSku=${hbs}. İşlem durumu doğrulanamadı. raw=${JSON.stringify(respData).slice(0, 300)}`);
        return {
            success: false,
            error: "HB yanıtında inventoryUploadId yok; işlem doğrulanamadı",
            response: respData
        };
    } catch (error) {
        logger.error("[HEPSIBURADA STOCK] Hata:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// N11 stok + fiyat güncelleme — yeni REST API (sku-update task) kullanılıyor
const updateN11Stock = async (credentials, productId, newStock, priceUpdate = null) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) {
            return { success: false, error: "N11 credentials eksik: apiKey ve secretKey gerekli" };
        }
        if (!productId) {
            return { success: false, error: "N11 stok güncelleme: stockCode (productId) gerekli" };
        }

        const updateItem = {
            stockCode: productId,
            quantity: parseInt(newStock) || 0
        };
        // Fiyat güncelleme varsa ekle
        if (priceUpdate?.salePrice) updateItem.salePrice = parseFloat(priceUpdate.salePrice);
        if (priceUpdate?.listPrice) updateItem.listPrice = parseFloat(priceUpdate.listPrice);

        // n11Service artık throw etmiyor — her zaman { success, ... } döndürüyor
        const result = await n11Service.updateProductPriceAndStock(
            credentials,
            [updateItem],
            "LysiaETIC"
        );

        if (result.skipped && (result.status === "IN_QUEUE" || result.errorCode === "TASK_ERR_010")) {
            logger.info(
                `[N11 STOCK] Kuyruk/atlandı — stockCode: ${productId} (${result.message || result.errorCode})`
            );
            return {
                success: true,
                skipped: true,
                taskId: result.taskId,
                message: result.message || "N11 görevi zaten kuyrukta",
            };
        }

        if (!result.success) {
            logger.error(`[N11 STOCK] Güncelleme başarısız: ${result.error}`);
            return { success: false, error: result.error || "N11 stok güncelleme başarısız" };
        }

        if (result.status === "IN_QUEUE") {
            logger.info(`[N11 STOCK] Kuyruğa alındı — taskId: ${result.taskId}`);
            return { success: true, taskId: result.taskId, message: "Stok güncelleme kuyruğa alındı" };
        }

        if (result.status === "REJECT") {
            const reason = Array.isArray(result.reasons)
                ? result.reasons.join(", ")
                : (result.reasons || "Bilinmeyen red sebebi");
            logger.warn(`[N11 STOCK] Reddedildi: ${reason}`);
            return { success: false, error: reason };
        }

        // Diğer başarılı durumlar
        return { success: true, taskId: result.taskId, status: result.status };

    } catch (error) {
        logger.error("[N11 STOCK UPDATE] Beklenmedik hata:", error.message);
        return { success: false, error: error.message };
    }
};

// ÇiçekSepeti stok + fiyat güncelleme
// ✅ FIX: Doğru endpoint — PUT /api/v1/Products/price-and-stock
// DOĞRU: PUT /api/v1/Products/price-and-stock → stockCode bazlı toplu güncelleme
// NOT: Stok ve fiyat aynı anda gönderilemez — ayrı ayrı istek atılmalı
// 🛡️ Rate Limit: ÇiçekSepeti "farklı istekleri 5 saniyede 1 kez" kuralı uyguluyor
// ✅ FIX #5: Per-tenant rate limiter — her kullanıcının kendi rate limit'i var
// ESKİ: Global _csLastRequestTime → multi-tenant SaaS'ta farklı kullanıcıların
//   istekleri birbirini engelliyordu (Kullanıcı A'nın isteği Kullanıcı B'yi bekletti)
// YENİ: sellerId bazlı Map → her kullanıcı kendi rate limit'ini takip eder
const _csRateLimitMap = new Map(); // sellerId → lastRequestTime
const _csStockCooldownMap = new Map(); // `${sellerId}:${stockCode}` → cooldownUntilMs
const CS_RATE_LIMIT_MS = 5500; // 5.5 saniye güvenlik payı

/** Aynı satıcıya giden CS isteklerini sıraya alır — "aynı anda istek yapılmamalıdır" hatasını engeller */
const _csSerializedChains = new Map();
const runCicekSepetiSerialized = (sellerKey, fn) => {
    const prev = _csSerializedChains.get(sellerKey) || Promise.resolve();
    const run = prev.then(() => fn());
    _csSerializedChains.set(sellerKey, run.catch(() => {}));
    return run;
};

const updateCicekSepetiStock = async (credentials, stockCode, newStock, priceUpdate = null) => {
    const apiKey0 = credentials.apiKey || credentials.apiSecret;
    const sellerId0 = credentials.sellerId || credentials.supplierId;
    const queueKey = sellerId0 || apiKey0 || "cs";
    return runCicekSepetiSerialized(queueKey, async () => {
    try {
        const apiKey       = credentials.apiKey       || credentials.apiSecret;
        const sellerId     = credentials.sellerId     || credentials.supplierId;
        const integratorName = credentials.integratorName || "";
        if (!apiKey) {
            return { success: false, error: "ÇiçekSepeti credentials eksik: apiKey gerekli" };
        }

        const cooldownKey = `${sellerId || apiKey}:${String(stockCode || "").trim()}`;
        const cooldownUntil = _csStockCooldownMap.get(cooldownKey) || 0;
        const now0 = Date.now();
        if (cooldownUntil > now0) {
            const leftSec = Math.ceil((cooldownUntil - now0) / 1000);
            logger.info(`[CICEKSEPETI STOCK] ⏭ Cooldown atlandı — stockCode: ${stockCode}, kalan: ${leftSec}s`);
            return {
                success: true,
                skipped: true,
                reason: "cooldown",
                message: `ÇiçekSepeti limit cooldown aktif (${leftSec}s)`
            };
        }

        // 🛡️ Per-tenant rate limit — bu kullanıcının son isteğinden 5.5 saniye geçmemişse bekle
        const rateLimitKey = sellerId || apiKey; // sellerId yoksa apiKey ile ayır
        const lastReqTime = _csRateLimitMap.get(rateLimitKey) || 0;
        const now = Date.now();
        const elapsed = now - lastReqTime;
        if (lastReqTime > 0 && elapsed < CS_RATE_LIMIT_MS) {
            await new Promise(resolve => setTimeout(resolve, CS_RATE_LIMIT_MS - elapsed));
        }
        _csRateLimitMap.set(rateLimitKey, Date.now());

        // ÇiçekSepeti API header'ları: x-api-key + user-agent (ASCII only)
        const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
        const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
        const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : (cleanSellerId || "CicekSepetiIntegration");

        const headers = {
            "x-api-key":    apiKey,
            "user-agent":   userAgent,
            "Content-Type": "application/json"
        };

        const endpoint = "https://apis.ciceksepeti.com/api/v1/Products/price-and-stock";

        // ✅ Stok güncelleme — stockCode bazlı
        const stockPayload = {
            items: [{
                stockCode:     stockCode,
                stockQuantity: parseInt(newStock) || 0
            }]
        };

        logger.info(`[CICEKSEPETI STOCK] Güncelleniyor — stockCode: ${stockCode}, stok: ${parseInt(newStock) || 0}`);

        const stockResponse = await axios.put(endpoint, stockPayload, { headers, timeout: 15000 });

        const batchId = stockResponse.data?.batchId;
        if (batchId) {
            logger.info(`[CICEKSEPETI STOCK] ✅ Stok güncellendi — stockCode: ${stockCode}, batchId: ${batchId}`);
        }

        // ✅ Fiyat güncelleme varsa ayrı istek at (stok + fiyat aynı anda gönderilemez)
        if (priceUpdate?.salePrice) {
            // 🛡️ Per-tenant rate limit — fiyat isteği de aynı endpoint'e gidiyor
            await new Promise(resolve => setTimeout(resolve, CS_RATE_LIMIT_MS));
            _csRateLimitMap.set(rateLimitKey, Date.now());

            const pricePayload = {
                items: [{
                    stockCode:  stockCode,
                    salesPrice: parseFloat(priceUpdate.salePrice),
                    listPrice:  parseFloat(priceUpdate.listPrice || priceUpdate.salePrice)
                }]
            };

            logger.info(`[CICEKSEPETI PRICE] Güncelleniyor — stockCode: ${stockCode}, fiyat: ${priceUpdate.salePrice} TL`);

            const priceResponse = await axios.put(endpoint, pricePayload, { headers, timeout: 15000 });

            const priceBatchId = priceResponse.data?.batchId;
            if (priceBatchId) {
                logger.info(`[CICEKSEPETI PRICE] ✅ Fiyat güncellendi — stockCode: ${stockCode}, batchId: ${priceBatchId}`);
            }
        }

        return { success: true, batchId, response: stockResponse.data };
    } catch (error) {
        const errData = error.response?.data;
        const errCode = error.response?.status;
        let errMsg = error.message;
        if (errData) {
            if (errData.message)      errMsg = errData.message;
            else if (errData.Message) errMsg = errData.Message;
            else if (typeof errData === "string") errMsg = errData;
            else errMsg = JSON.stringify(errData);
        }

        const isRateLimited =
            errCode === 400 &&
            /limit aşım|limit aşımı|kalan süre|aynı anda istek|5 saniyede 1|30 dakikada 1|farklı istekleri/i.test(errMsg);

        if (isRateLimited) {
            let sec = 8;
            if (/30\s*dakika|30\s*dk|dakikada\s*1/i.test(errMsg)) {
                sec = 1800;
            } else if (/5\s*saniye|farklı istekleri/i.test(errMsg)) {
                sec = 8;
            } else if (/aynı anda istek/i.test(errMsg)) {
                sec = 25;
            } else {
                const m = errMsg.match(/Kalan\s*Süre:\s*(\d+)/i);
                const parsed = m ? parseInt(m[1], 10) : NaN;
                if (Number.isFinite(parsed) && parsed > 0 && parsed <= 120) {
                    sec = parsed;
                } else if (Number.isFinite(parsed) && parsed > 120 && parsed <= 600) {
                    sec = 60;
                }
            }
            const cooldownMs = Math.min(Math.max(5, sec) * 1000, 30 * 60 * 1000);
            const sid = credentials.sellerId || credentials.supplierId || credentials.apiKey || "cs";
            const ck = `${sid}:${String(stockCode || "").trim()}`;
            _csStockCooldownMap.set(ck, Date.now() + cooldownMs);
            logger.warn(`[CICEKSEPETI STOCK] ⏸ Cooldown — stockCode: ${stockCode}, ${Math.ceil(cooldownMs / 1000)}s`);
            return {
                success: true,
                skipped: true,
                reason: "rate_limit",
                message: errMsg
            };
        }

        logger.error(`[CICEKSEPETI STOCK] ❌ Hata — stockCode: ${stockCode} | status: ${errCode} | error: ${errMsg}`);
        return { success: false, error: errMsg };
    }
    });
};

// ═══════════════════════════════════════════════════════════════
// 🛒 AMAZON STOK + FİYAT GÜNCELLEME
// ✅ FIX #1: Amazon stok push — artık gerçek SP-API Listings API kullanılıyor
// ESKİ: Sadece simüle ediliyordu, Amazon'daki stok hiç güncellenmiyordu
// YENİ: amazonSpApiService.updateListingStock() ile gerçek PATCH isteği
// ═══════════════════════════════════════════════════════════════

const updateAmazonStock = async (credentials, sku, newStock, priceUpdate = null, marketplaceName = "Amazon") => {
    try {
        if (!amazonSpApiService) {
            logger.warn(`[AMAZON STOCK] ⚠️ Amazon SP-API servisi yüklenemedi — stok güncelleme simüle edildi (sku: ${sku})`);
            return { success: true, simulated: true, message: "Amazon SP-API servisi mevcut değil" };
        }

        const { normalizeAmazonCredentials, validateAmazonCredentials } = require("./amazon/amazonCredentialService");
        const creds = normalizeAmazonCredentials(credentials, marketplaceName);
        const validation = validateAmazonCredentials(creds);
        if (!validation.valid) {
            return { success: false, error: validation.message };
        }

        const { sellerId } = creds;
        if (!sku) {
            return { success: false, error: "Amazon stok güncelleme: SKU gerekli" };
        }

        const stockQty = parseInt(newStock) || 0;

        logger.info(`[AMAZON STOCK] Güncelleniyor — sku: ${sku}, stok: ${stockQty}, sellerId: ${sellerId}`);

        // ✅ Amazon Listings API — PATCH /listings/2021-08-01/items/{sellerId}/{sku}
        // fulfillment_availability attribute'unu günceller
        const stockResult = await amazonSpApiService.updateListingStock(creds, sku, stockQty);

        if (!stockResult.success) {
            logger.error(`[AMAZON STOCK] ❌ Stok güncelleme başarısız — sku: ${sku}, error: ${stockResult.error}`);
            return { success: false, error: stockResult.error || "Amazon stok güncelleme başarısız" };
        }

        logger.info(`[AMAZON STOCK] ✅ Stok güncellendi — sku: ${sku}, stok: ${stockQty}`);

        // ✅ Fiyat güncelleme varsa ayrı PATCH isteği at
        if (priceUpdate?.salePrice) {
            try {
                const priceResult = await amazonSpApiService.updateListingPrice(
                    creds,
                    sku,
                    parseFloat(priceUpdate.salePrice)
                );

                if (priceResult.success) {
                    logger.info(`[AMAZON PRICE] ✅ Fiyat güncellendi — sku: ${sku}, fiyat: ${priceUpdate.salePrice}`);
                } else {
                    // Fiyat hatası stok güncellemeyi başarısız yapmaz — sadece logla
                    logger.warn(`[AMAZON PRICE] ⚠️ Fiyat güncelleme başarısız — sku: ${sku}, error: ${priceResult.error}`);
                }
            } catch (priceErr) {
                logger.warn(`[AMAZON PRICE] ⚠️ Fiyat güncelleme hatası — sku: ${sku}, error: ${priceErr.message}`);
            }
        }

        return { success: true, result: stockResult.result };
    } catch (error) {
        const errMsg = error.response?.data?.errors?.[0]?.message || error.message;
        logger.error(`[AMAZON STOCK] ❌ Hata — sku: ${sku}, error: ${errMsg}`);
        return { success: false, error: errMsg };
    }
};

/**
 * Noon stok güncelleme
 */
const updateNoonStock = async (credentials, sku, newStock, priceUpdate = null) => {
    try {
        const noon = new NoonService(credentials);
        const result = await noon.updateStock(sku, newStock);
        return { success: true, result };
    } catch (error) {
        logger.error(`[NOON STOCK] ❌ Hata — sku: ${sku}, error: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * AliExpress stok güncelleme
 */
const updateAliexpressStock = async (credentials, productId, newStock, priceUpdate = null) => {
    try {
        const aliexpress = new AliexpressService(credentials);
        // AliExpress için productId ve skuId (merchant_sku_code) gerekebilir. 
        // Burada productId alanını sku olarak kullanıyoruz (mapping yapısına göre)
        const result = await aliexpress.updateStock(productId, productId, newStock);
        return { success: true, result };
    } catch (error) {
        logger.error(`[ALIEXPRESS STOCK] ❌ Hata — productId: ${productId}, error: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════
// 🖐️ MANUEL STOK + FİYAT SENKRONİZASYONU
// ═══════════════════════════════════════════════════════════════

const manualStockSync = async (userId, productMappingId, newStock, priceUpdate = null) => {
    try {
        const mapping = await ProductMapping.findOne({ _id: productMappingId, userId });
        if (!mapping) {
            throw new Error("Ürün eşleştirmesi bulunamadı");
        }

        const oldStock    = mapping.stockTracking.totalStock;
        const oldPrice    = mapping.masterProduct.price;
        const oldListPrice = mapping.masterProduct.listPrice;

        // Stoku güncelle
        mapping.stockTracking.totalStock = newStock;
        mapping.syncMasterStockFields?.();
        mapping.updateStockStatus();

        // Fiyat güncelleme varsa master product'ı da güncelle
        if (priceUpdate?.salePrice) {
            mapping.masterProduct.price = parseFloat(priceUpdate.salePrice);
        }
        if (priceUpdate?.listPrice) {
            mapping.masterProduct.listPrice = parseFloat(priceUpdate.listPrice);
        }

        // 🛡️ Güvenlik stoğu düşülmüş stoku hesapla
        const marketplaceStock = mapping.getMarketplaceStock();

        const { alignAllMarketplaceIdentitiesFromMaster } = require("../utils/productFieldCompare");
        const idFix = alignAllMarketplaceIdentitiesFromMaster(mapping);
        if (idFix.fixed > 0) {
            logger.warn(
                `[MANUAL SYNC] ${idFix.fixed} pazaryeri kimlik alanı master ile hizalandı — ` +
                `${mapping.masterProduct?.name} (${mapping.masterProduct?.barcode})`
            );
        }

        // Tüm pazaryerlerinde stok + fiyat senkronize et
        const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, null, priceUpdate);
        const logStatus = deriveSyncLogStatus(syncResults);
        const successCount = syncResults.filter((x) => x.syncStatus === "success").length;
        const errorMarketplaces = syncResults.filter((x) => x.syncStatus === "error").map((x) => `${x.name}: ${x.error || "bilinmeyen hata"}`);

        await saveProductMappingAfterPlatformSync(mapping);

        // Stok log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "manual_sync",
            product: {
                productMappingId: mapping._id,
                barcode: mapping.masterProduct.barcode,
                sku: mapping.masterProduct.sku,
                name: mapping.masterProduct.name
            },
            changes: {
                field: "stock",
                oldValue: oldStock,
                newValue: newStock,
                difference: newStock - oldStock
            },
            status: logStatus,
            ...(logStatus !== "success" && errorMarketplaces.length > 0 && {
                error: { message: errorMarketplaces.join("; "), code: "PARTIAL_PLATFORM_SYNC" }
            }),
            affectedMarketplaces: syncResults,
            notification: {
                priority: newStock === 0 ? "critical" : newStock <= mapping.stockTracking.lowStockThreshold ? "high" : "medium"
            }
        });

        // Fiyat değiştiyse ayrı log oluştur
        if (priceUpdate?.salePrice && priceUpdate.salePrice !== oldPrice) {
            await StockSyncLog.create({
                userId,
                actionType: "price_update",
                product: {
                    productMappingId: mapping._id,
                    barcode: mapping.masterProduct.barcode,
                    sku: mapping.masterProduct.sku,
                    name: mapping.masterProduct.name
                },
                changes: {
                    field: "price",
                    oldValue: oldPrice,
                    newValue: priceUpdate.salePrice,
                    difference: priceUpdate.salePrice - oldPrice
                },
                status: logStatus,
                affectedMarketplaces: syncResults,
                notification: { priority: "low" }
            });
        }

        if (logStatus !== "success") {
            logger.warn(`[MANUAL SYNC] ⚠️ Kısmi başarısız — ${mapping.masterProduct.name} | stok: ${oldStock}→${newStock} | başarılı: ${successCount}/${syncResults.length} | hatalar: ${errorMarketplaces.join(" | ")}`);
        } else {
            logger.info(`[MANUAL SYNC] ✅ ${mapping.masterProduct.name} | stok: ${oldStock}→${newStock} | platformlara: ${marketplaceStock}`);
        }

        return {
            success: logStatus === "success",
            oldStock,
            newStock,
            marketplaceStock,
            oldPrice,
            newPrice: priceUpdate?.salePrice || oldPrice,
            errorMarketplaces,
            marketplaces: syncResults
        };
    } catch (error) {
        logger.error("[MANUAL SYNC] Hata:", error.message);
        throw error;
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 OTOMATİK STOK SENKRONİZASYONU (Kullanıcı tetiklemeli)
// ═══════════════════════════════════════════════════════════════

/** @param {(p: { phase?: string, progressPercent?: number, current?: number, total?: number, message?: string }) => void} [onProgress] */
const autoStockSync = async (userId, onProgress) => {
    const report = (partial) => {
        try {
            onProgress?.(partial);
        } catch (e) {
            /* ignore */
        }
    };
    try {
        logger.info(`[AUTO SYNC] Kullanıcı ${userId} için otomatik stok senkronizasyonu başlatılıyor...`);

        const mappings = await ProductMapping.find({
            userId,
            "autoSync.enabled": true
        });

        const results = [];
        const n = mappings.length;
        if (n === 0) {
            report({ phase: "done", progressPercent: 100, current: 0, total: 0, message: "Oto sync: açık ürün yok" });
            return results;
        }

        report({ phase: "process", progressPercent: 2, current: 0, total: n, message: `${n} ürün bulundu` });

        for (let i = 0; i < mappings.length; i++) {
            const mapping = mappings[i];
            report({
                phase: "process",
                progressPercent: 5 + Math.floor((i / n) * 90),
                current: i,
                total: n,
                message: `(${i + 1}/${n}) ${mapping.masterProduct?.name || mapping.masterProduct?.barcode || "ürün"}`
            });
            try {
                // 🛡️ Güvenlik stoğu düşülmüş stoku hesapla
                const marketplaceStock = mapping.getMarketplaceStock();

                const syncResults = await syncStockToAllMarketplaces(
                    userId,
                    mapping,
                    marketplaceStock
                );

                await mapping.save();

                results.push({
                    productId: mapping._id,
                    barcode: mapping.masterProduct.barcode,
                    name: mapping.masterProduct.name,
                    totalStock: mapping.stockTracking.totalStock,
                    marketplaceStock,
                    safetyStock: mapping.stockTracking.safetyStock || 0,
                    status: "success",
                    marketplaces: syncResults
                });

                // Log oluştur
                await StockSyncLog.create({
                    userId,
                    actionType: "auto_sync",
                    product: {
                        productMappingId: mapping._id,
                        barcode: mapping.masterProduct.barcode,
                        sku: mapping.masterProduct.sku,
                        name: mapping.masterProduct.name
                    },
                    status: "success",
                    affectedMarketplaces: syncResults,
                    notification: {
                        priority: "low"
                    }
                });

            } catch (error) {
                logger.error(`[AUTO SYNC] Ürün senkronizasyon hatası (${mapping.masterProduct.barcode}):`, error.message);
                results.push({
                    productId: mapping._id,
                    barcode: mapping.masterProduct.barcode,
                    name: mapping.masterProduct.name,
                    status: "error",
                    error: error.message
                });
            }
        }

        logger.info(`[AUTO SYNC] Tamamlandı - ${results.length} ürün işlendi`);
        report({
            phase: "done",
            progressPercent: 100,
            current: n,
            total: n,
            message: `Bitti — ${results.filter(r => r.status === "success").length}/${n} başarılı`
        });

        return results;
    } catch (error) {
        logger.error("[AUTO SYNC] Genel hata:", error.message);
        throw error;
    }
};

module.exports = {
    // Sipariş akışı
    updateStockAfterOrder,
    processOrderStockLine,
    makeOrderStockKey,
    isOrderAlreadyProcessed,
    deriveSyncLogStatus,
    retryPendingStockPushes,
    saveProductMappingAfterPlatformSync,
    // Stok kilitleme (atomic)
    reserveStock,
    releaseStock,
    // Pazaryeri senkronizasyon
    syncStockToAllMarketplaces,
    updateStockOnMarketplace,
    // Manuel & otomatik
    manualStockSync,
    autoStockSync
};
