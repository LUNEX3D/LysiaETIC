/**
 * STOK CRON SERVİSİ — Arka Planda Otomatik Stok Senkronizasyonu
 *
 * 1. Periyodik olarak tüm pazaryerlerinden sipariş kontrolü yapar
 * 2. Yeni sipariş varsa stok düşürür
 * 3. İptal edilen sipariş varsa stok artırır
 * 4. Tüm platformlara stok değişikliğini yansıtır
 * 5. Her 5 dakikada bir çalışır
 */

const ProductMapping = require("../models/ProductMapping");
const StockSyncLog = require("../models/StockSyncLog");
const Marketplace = require("../models/Marketplace");
const User = require("../models/User");
const logger = require("../config/logger");
const { syncStockToAllMarketplaces, reserveStock, releaseStock } = require("./stockSyncService");

// İşlenen sipariş ID'lerini takip et (restart'a kadar — in-memory cache)
// ⚠️ Her sipariş+ürün kombinasyonu ayrı key olarak tutulur
// Böylece aynı siparişteki farklı ürünler de doğru işlenir
const processedOrders = new Set();

/**
 * DB-level tekrar işleme koruması — server restart sonrası bile çalışır
 * StockSyncLog'da bu sipariş+ürün kombinasyonu zaten var mı kontrol eder
 */
const isOrderAlreadyProcessed = async (userId, orderId, barcode, marketplace) => {
    try {
        const existing = await StockSyncLog.findOne({
            userId,
            "order.orderId": String(orderId),
            "product.barcode": barcode,
            "marketplace.name": marketplace,
            actionType: { $in: ["order_placed", "stock_update"] },
            status: "success"
        }).lean();
        return !!existing;
    } catch {
        return false; // Hata durumunda güvenli tarafta kal — tekrar işleme riski al
    }
};

// Pazaryeri isimlerini normalize et
const normalizeName = (name) => {
    if (!name) return "";
    const n = name.trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return name.trim();
};

/**
 * Trendyol siparişlerini kontrol et ve stok güncelle
 */
const checkTrendyolOrders = async (userId, credentials) => {
    const axios = require("axios");
    const results = [];

    try {
        const { apiKey, apiSecret, sellerId, supplierId } = credentials;
        const actualSellerId = sellerId || supplierId;
        if (!apiKey || !apiSecret || !actualSellerId) return results;

        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

        // Son 1 saatteki siparişleri kontrol et
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        const response = await axios.get(
            `https://apigw.trendyol.com/integration/order/sellers/${actualSellerId}/orders?startDate=${oneHourAgo}&endDate=${now}&size=50&orderByField=OrderDate&orderByDirection=DESC`,
            {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${actualSellerId} - LysiaETIC`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        const orders = response.data?.content || [];

        for (const order of orders) {
            for (const line of (order.lines || [])) {
                const barcode = line.barcode || line.merchantSku;
                if (!barcode) continue;

                // ✅ Sipariş+ürün bazlı tekrar işleme koruması (in-memory)
                const orderItemKey = `trendyol_${order.orderNumber}_${barcode}`;
                if (processedOrders.has(orderItemKey)) continue;

                // ✅ Sadece stok etkileyen durumları işle
                // Created/New/Approved → stok düşür (sipariş geldi)
                // Cancelled/UnDelivered/Returned/ReturnAccepted → stok artır (iptal/iade)
                // Picking/Invoiced/Shipped/Delivered → zaten stok düşürülmüş, tekrar işleme
                const cancelStatuses = ["Cancelled", "UnDelivered", "Returned", "ReturnAccepted", "UnDeliverable"];
                const newOrderStatuses = ["Created", "New", "Approved"];
                const orderStatus = order.status || "";

                const isCancelled = cancelStatuses.includes(orderStatus);
                const isNewOrder = newOrderStatuses.includes(orderStatus);

                // Ne yeni sipariş ne iptal → stok değişikliği yok, atla
                if (!isCancelled && !isNewOrder) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                // ✅ DB-level tekrar işleme koruması (server restart sonrası bile çalışır)
                if (await isOrderAlreadyProcessed(userId, order.orderNumber, barcode, "Trendyol")) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                const quantity = line.quantity || 1;

                // 🔒 Atomic stok kilitleme — race condition önlenir
                let stockResult;
                if (isCancelled) {
                    stockResult = await releaseStock(userId, barcode, quantity);
                } else {
                    stockResult = await reserveStock(userId, barcode, quantity);
                }

                if (!stockResult.success) {
                    logger.warn(`[STOCK CRON] Trendyol stok ${isCancelled ? "serbest bırakma" : "rezerve"} başarısız: ${barcode} — ${stockResult.error}`);
                    processedOrders.add(orderItemKey);
                    continue;
                }

                const { mapping, oldStock, newStock, marketplaceStock } = stockResult;

                if (oldStock === newStock) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                // ⚡ Tüm platformlara ANLIK push (güvenlik stoğu düşülmüş)
                const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, "Trendyol");
                await mapping.save();

                // Log oluştur
                await StockSyncLog.create({
                    userId,
                    actionType: isCancelled ? "stock_update" : "order_placed",
                    product: {
                        productMappingId: mapping._id,
                        barcode: mapping.masterProduct.barcode,
                        sku: mapping.masterProduct.sku,
                        name: mapping.masterProduct.name
                    },
                    marketplace: { name: "Trendyol" },
                    order: {
                        orderId: order.orderNumber,
                        orderNumber: order.orderNumber,
                        marketplace: "Trendyol",
                        quantity
                    },
                    changes: {
                        field: "stock",
                        oldValue: oldStock,
                        newValue: newStock,
                        difference: newStock - oldStock
                    },
                    status: "success",
                    affectedMarketplaces: syncResults,
                    notification: {
                        priority: newStock === 0 ? "critical" : newStock <= 10 ? "high" : "medium"
                    }
                });

                results.push({
                    barcode,
                    marketplace: "Trendyol",
                    action: isCancelled ? "cancel_restore" : "order_deduct",
                    oldStock,
                    newStock,
                    quantity
                });

                logger.info(`[STOCK CRON] Trendyol ${isCancelled ? "İPTAL +": "SİPARİŞ -"}${quantity} | ${mapping.masterProduct.name} | ${oldStock} → ${newStock}`);
                processedOrders.add(orderItemKey);
            }
        }
    } catch (error) {
        if (error.response?.status !== 401) {
            logger.error(`[STOCK CRON] Trendyol sipariş kontrolü hatası: ${error.message}`);
        }
    }

    return results;
};

/**
 * N11 siparişlerini kontrol et ve stok güncelle
 */
const checkN11Orders = async (userId, credentials) => {
    const n11Service = require("./n11Service");
    const results = [];

    try {
        const { apiKey, secretKey } = credentials;
        if (!apiKey || !secretKey) return results;

        const result = await n11Service.getOrders(credentials, {
            status: "New,Approved",
            page: 0,
            size: 50
        });

        const orders = result.orders || [];

        for (const order of orders) {
            for (const item of (order.lines || order.items || order.orderItems || [])) {
                const barcode = item.sellerStockCode || item.productSellerCode || item.stockCode || item.barcode;
                if (!barcode) continue;

                // ✅ Sipariş+ürün bazlı tekrar işleme koruması (in-memory)
                const orderItemKey = `n11_${order.id || order.orderNumber}_${barcode}`;
                if (processedOrders.has(orderItemKey)) continue;

                // ✅ Sadece stok etkileyen durumları işle
                const orderStatus = order.shipmentPackageStatus || order.status || "";
                const cancelStatuses = ["Rejected", "Cancelled", "CancelledByBuyer", "CancelRequest", "CancelledBySeller"];
                const newOrderStatuses = ["New", "Approved", "WaitingForApproval"];

                const isCancelled = cancelStatuses.includes(orderStatus);
                const isNewOrder = newOrderStatuses.includes(orderStatus);

                // Ne yeni sipariş ne iptal → stok değişikliği yok, atla
                if (!isCancelled && !isNewOrder) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                // ✅ DB-level tekrar işleme koruması (server restart sonrası bile çalışır)
                if (await isOrderAlreadyProcessed(userId, String(order.id || order.orderNumber), barcode, "N11")) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                const quantity = item.quantity || 1;

                // 🔒 Atomic stok kilitleme — race condition önlenir
                let stockResult;
                if (isCancelled) {
                    stockResult = await releaseStock(userId, barcode, quantity);
                } else {
                    stockResult = await reserveStock(userId, barcode, quantity);
                }

                if (!stockResult.success) {
                    logger.warn(`[STOCK CRON] N11 stok ${isCancelled ? "serbest bırakma" : "rezerve"} başarısız: ${barcode} — ${stockResult.error}`);
                    processedOrders.add(orderItemKey);
                    continue;
                }

                const { mapping, oldStock, newStock, marketplaceStock } = stockResult;

                if (oldStock === newStock) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                // ⚡ Tüm platformlara ANLIK push (güvenlik stoğu düşülmüş)
                const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, "N11");
                await mapping.save();

                await StockSyncLog.create({
                    userId,
                    actionType: isCancelled ? "stock_update" : "order_placed",
                    product: {
                        productMappingId: mapping._id,
                        barcode: mapping.masterProduct.barcode,
                        sku: mapping.masterProduct.sku,
                        name: mapping.masterProduct.name
                    },
                    marketplace: { name: "N11" },
                    order: {
                        orderId: String(order.id || order.orderNumber),
                        orderNumber: String(order.orderNumber || order.id),
                        marketplace: "N11",
                        quantity
                    },
                    changes: {
                        field: "stock",
                        oldValue: oldStock,
                        newValue: newStock,
                        difference: newStock - oldStock
                    },
                    status: "success",
                    affectedMarketplaces: syncResults,
                    notification: {
                        priority: newStock === 0 ? "critical" : newStock <= 10 ? "high" : "medium"
                    }
                });

                results.push({
                    barcode,
                    marketplace: "N11",
                    action: isCancelled ? "cancel_restore" : "order_deduct",
                    oldStock,
                    newStock,
                    quantity
                });

                logger.info(`[STOCK CRON] N11 ${isCancelled ? "İPTAL +" : "SİPARİŞ -"}${quantity} | ${mapping.masterProduct.name} | ${oldStock} → ${newStock}`);
                processedOrders.add(orderItemKey);
            }
        }
    } catch (error) {
        if (error.message && !error.message.includes("bulunamadı")) {
            logger.error(`[STOCK CRON] N11 sipariş kontrolü hatası: ${error.message}`);
        }
    }

    return results;
};

/**
 * Hepsiburada siparişlerini kontrol et
 */
const checkHepsiburadaOrders = async (userId, credentials) => {
    const axios = require("axios");
    const results = [];

    try {
        const { merchantId, apiKey } = credentials;
        if (!merchantId || !apiKey) return results;

        const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;

        const response = await axios.get(
            `https://oms-external.hepsiburada.com/packages/merchantid/${merchantId}?limit=50&offset=0`,
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                    "User-Agent": "LysiaETIC"
                },
                timeout: 15000
            }
        );

        const packages = response.data?.packages || response.data || [];

        for (const pkg of (Array.isArray(packages) ? packages : [])) {
            for (const item of (pkg.items || pkg.lines || [])) {
                const barcode = item.merchantSku || item.hepsiburadaSku || item.sku;
                if (!barcode) continue;

                // ✅ Sipariş+ürün bazlı tekrar işleme koruması (Trendyol/N11 ile aynı mantık)
                const orderItemKey = `hb_${pkg.packageNumber || pkg.id}_${barcode}`;
                if (processedOrders.has(orderItemKey)) continue;

                // ✅ Sadece stok etkileyen durumları işle
                // ❌ ESKİ: Bu kontrol yoktu → Shipped/Delivered gibi zaten işlenmiş siparişler
                //    her cron döngüsünde tekrar reserveStock çağırıyordu → stok sürekli düşüyordu → 0'a iniyordu
                const cancelStatuses = ["Cancelled", "UnDelivered", "Returned"];
                const newOrderStatuses = ["New", "Open", "Approved", "Unpacked"];
                const pkgStatus = pkg.status || "";

                const isCancelled = cancelStatuses.includes(pkgStatus);
                const isNewOrder = newOrderStatuses.includes(pkgStatus);

                // Ne yeni sipariş ne iptal → stok değişikliği yok, atla
                if (!isCancelled && !isNewOrder) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                // ✅ DB-level tekrar işleme koruması (server restart sonrası bile çalışır)
                if (await isOrderAlreadyProcessed(userId, String(pkg.packageNumber || pkg.id), barcode, "Hepsiburada")) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                const quantity = item.quantity || 1;

                // 🔒 Atomic stok kilitleme
                let stockResult;
                if (isCancelled) {
                    stockResult = await releaseStock(userId, barcode, quantity);
                } else {
                    stockResult = await reserveStock(userId, barcode, quantity);
                }

                if (!stockResult.success) {
                    logger.warn(`[STOCK CRON] Hepsiburada stok ${isCancelled ? "serbest bırakma" : "rezerve"} başarısız: ${barcode} — ${stockResult.error}`);
                    processedOrders.add(orderItemKey);
                    continue;
                }

                const { mapping, oldStock, newStock, marketplaceStock } = stockResult;

                if (oldStock === newStock) {
                    processedOrders.add(orderItemKey);
                    continue;
                }

                // ⚡ Tüm platformlara ANLIK push (güvenlik stoğu düşülmüş)
                const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, "Hepsiburada");
                await mapping.save();

                await StockSyncLog.create({
                    userId,
                    actionType: isCancelled ? "stock_update" : "order_placed",
                    product: {
                        productMappingId: mapping._id,
                        barcode: mapping.masterProduct.barcode,
                        sku: mapping.masterProduct.sku,
                        name: mapping.masterProduct.name
                    },
                    marketplace: { name: "Hepsiburada" },
                    order: {
                        orderId: String(pkg.packageNumber || pkg.id),
                        orderNumber: String(pkg.packageNumber || pkg.id),
                        marketplace: "Hepsiburada",
                        quantity
                    },
                    changes: {
                        field: "stock",
                        oldValue: oldStock,
                        newValue: newStock,
                        difference: newStock - oldStock
                    },
                    status: "success",
                    affectedMarketplaces: syncResults,
                    notification: {
                        priority: newStock === 0 ? "critical" : newStock <= 10 ? "high" : "medium"
                    }
                });

                results.push({ barcode, marketplace: "Hepsiburada", action: isCancelled ? "cancel_restore" : "order_deduct", oldStock, newStock, quantity });
                logger.info(`[STOCK CRON] Hepsiburada ${isCancelled ? "İPTAL +" : "SİPARİŞ -"}${quantity} | ${mapping.masterProduct.name} | ${oldStock} → ${newStock}`);
                processedOrders.add(orderItemKey);
            }
        }
    } catch (error) {
        if (error.response?.status !== 401) {
            logger.error(`[STOCK CRON] Hepsiburada sipariş kontrolü hatası: ${error.message}`);
        }
    }

    return results;
};

/**
 * PERİYODİK STOK EŞİTLEME
 *
 * Bizim programdaki (master) stok değerini TÜM pazaryerlerine push eder.
 * Böylece Trendyol panelinden manuel değiştirilmiş veya sipariş yansımamış
 * stok farkları otomatik olarak düzeltilir.
 *
 * "Bizim programdaki stok doğrudur" prensibiyle çalışır.
 */
const pushMasterStockToMarketplaces = async () => {
    try {
        // autoSync.enabled olan tüm ürünleri bul
        const mappings = await ProductMapping.find({
            "autoSync.enabled": true,
            "marketplaceMappings.0": { $exists: true } // En az 1 pazaryeri eşleştirmesi olan
        });

        if (mappings.length === 0) return { synced: 0, errors: 0 };

        let synced = 0;
        let errors = 0;
        let skipped = 0;

        for (const mapping of mappings) {
            try {
                const userId = mapping.userId;

                // 🛡️ Güvenlik stoğu düşülmüş stoku hesapla
                const marketplaceStock = mapping.getMarketplaceStock();

                // Pazaryeri mapping'lerinden herhangi birinin stoku farklı mı VEYA
                // stok > 0 olup syncStatus hatalı/beklemede olan var mı kontrol et
                // (Trendyol'da ürün satışa kapalı olabilir — unlock gerekebilir)
                let needsSync = false;
                for (const mp of mapping.marketplaceMappings) {
                    // Stok farkı varsa senkronize et
                    if (mp.stock === null || mp.stock === undefined || mp.stock !== marketplaceStock) {
                        needsSync = true;
                        break;
                    }
                    // Stok > 0 ama ürün hatalı/beklemede ise de senkronize et (unlock tetikler)
                    if (marketplaceStock > 0 && (mp.syncStatus === "error" || mp.syncStatus === "pending")) {
                        needsSync = true;
                        break;
                    }
                }

                if (!needsSync) {
                    skipped++;
                    continue;
                }

                // Master stoku (güvenlik stoğu düşülmüş) tüm pazaryerlerine push et
                const syncResults = await syncStockToAllMarketplaces(
                    userId,
                    mapping,
                    marketplaceStock
                );

                const successCount = syncResults.filter(r => r.syncStatus === "success").length;
                const errorCount = syncResults.filter(r => r.syncStatus === "error").length;

                if (successCount > 0) {
                    await mapping.save(); // syncStockToAllMarketplaces mapping.stock'u günceller
                    synced++;
                }
                if (errorCount > 0) errors++;

                // Fark varsa log oluştur
                const diffMarketplaces = syncResults.filter(r => r.syncStatus === "success");
                if (diffMarketplaces.length > 0) {
                    logger.info(`[STOCK PUSH] ${mapping.masterProduct.name} (${mapping.masterProduct.barcode}) → gerçek: ${mapping.stockTracking.totalStock}, platformlara: ${marketplaceStock} (güvenlik: ${mapping.stockTracking.safetyStock || 0}) | ${diffMarketplaces.map(m => m.name).join(", ")} güncellendi`);

                    await StockSyncLog.create({
                        userId,
                        actionType: "auto_sync",
                        product: {
                            productMappingId: mapping._id,
                            barcode: mapping.masterProduct.barcode,
                            sku: mapping.masterProduct.sku,
                            name: mapping.masterProduct.name
                        },
                        changes: {
                            field: "stock",
                            oldValue: null,
                            newValue: marketplaceStock,
                            difference: 0
                        },
                        status: errorCount > 0 ? "partial" : "success",
                        affectedMarketplaces: syncResults,
                        notification: { priority: "low" }
                    });
                }

            } catch (err) {
                errors++;
                logger.error(`[STOCK PUSH] Ürün hatası (${mapping.masterProduct?.barcode}): ${err.message}`);
            }
        }

        return { total: mappings.length, synced, errors, skipped };
    } catch (error) {
        logger.error(`[STOCK PUSH] Genel hata: ${error.message}`);
        return { synced: 0, errors: 1 };
    }
};

/**
 * Ana cron fonksiyonu — tüm kullanıcılar için tüm pazaryerlerini kontrol et
 *
 * ADIM 1: Sipariş kontrolü — yeni/iptal siparişlere göre stok düşür/artır
 * ADIM 2: Stok eşitleme — master stoku tüm pazaryerlerine push et
 */
const runStockSync = async () => {
    try {
        // ═══════════════════════════════════════════════════════
        // ADIM 1: SİPARİŞ KONTROLÜ (mevcut mantık)
        // ═══════════════════════════════════════════════════════
        const marketplaces = await Marketplace.find({}).lean();
        const userIds = [...new Set(marketplaces.map(m => m.userId.toString()))];

        let totalChanges = 0;

        for (const userId of userIds) {
            const userMarketplaces = marketplaces.filter(m => m.userId.toString() === userId);

            for (const mp of userMarketplaces) {
                const mpName = normalizeName(mp.marketplaceName);
                let results = [];

                try {
                    switch (mpName) {
                        case "Trendyol":
                            results = await checkTrendyolOrders(userId, mp.credentials);
                            break;
                        case "N11":
                            results = await checkN11Orders(userId, mp.credentials);
                            break;
                        case "Hepsiburada":
                            results = await checkHepsiburadaOrders(userId, mp.credentials);
                            break;
                        default:
                            break;
                    }

                    totalChanges += results.length;
                } catch (err) {
                    logger.error(`[STOCK CRON] ${mpName} (user: ${userId}) hatası: ${err.message}`);
                }
            }
        }

        if (totalChanges > 0) {
            logger.info(`[STOCK CRON] ✅ Sipariş kontrolü — ${totalChanges} stok değişikliği yapıldı`);
        }

        // ═══════════════════════════════════════════════════════
        // ADIM 2: MASTER STOK EŞİTLEME (yeni)
        // Bizim programdaki stoku tüm pazaryerlerine push et
        // ═══════════════════════════════════════════════════════
        const pushResult = await pushMasterStockToMarketplaces();
        if (pushResult.synced > 0 || pushResult.errors > 0) {
            logger.info(`[STOCK CRON] 🔄 Stok eşitleme — toplam: ${pushResult.total}, güncellenen: ${pushResult.synced}, hata: ${pushResult.errors}, atlanılan: ${pushResult.skipped}`);
        }

        // Bellek temizliği — 10000'den fazla işlenmiş sipariş varsa eski olanları sil
        if (processedOrders.size > 10000) {
            const arr = [...processedOrders];
            processedOrders.clear();
            arr.slice(-5000).forEach(id => processedOrders.add(id));
        }

    } catch (error) {
        logger.error(`[STOCK CRON] Genel hata: ${error.message}`);
    }
};

/**
 * Cron'u başlat — 5 dakikada bir çalışır
 */
let cronInterval = null;

const startStockCron = () => {
    if (cronInterval) return;

    logger.info("[STOCK CRON] 🔄 Otomatik stok senkronizasyonu başlatıldı (5dk aralık)");

    // İlk çalıştırma — 30 saniye sonra (sunucu başlangıcını bekle)
    setTimeout(() => {
        runStockSync();
    }, 30000);

    // Periyodik çalıştırma — 5 dakikada bir
    cronInterval = setInterval(runStockSync, 5 * 60 * 1000);
};

const stopStockCron = () => {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
        logger.info("[STOCK CRON] ⏹ Otomatik stok senkronizasyonu durduruldu");
    }
};

module.exports = {
    startStockCron,
    stopStockCron,
    runStockSync
};
