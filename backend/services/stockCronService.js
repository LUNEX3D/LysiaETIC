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
const { syncStockToAllMarketplaces } = require("./stockSyncService");

// İşlenen sipariş ID'lerini takip et (restart'a kadar)
const processedOrders = new Set();

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
            const orderKey = `trendyol_${order.orderNumber}`;
            if (processedOrders.has(orderKey)) continue;

            for (const line of (order.lines || [])) {
                const barcode = line.barcode || line.merchantSku;
                if (!barcode) continue;

                const mapping = await ProductMapping.findOne({
                    userId,
                    $or: [
                        { "masterProduct.barcode": barcode },
                        { "masterProduct.sku": barcode },
                        { "marketplaceMappings.marketplaceSku": barcode }
                    ]
                });

                if (!mapping) continue;

                const quantity = line.quantity || 1;
                const isCancelled = ["Cancelled", "UnDelivered", "Returned"].includes(order.status);
                const oldStock = mapping.stockTracking.totalStock;
                const newStock = isCancelled
                    ? oldStock + quantity
                    : Math.max(0, oldStock - quantity);

                if (oldStock === newStock) continue;

                // Stok güncelle
                mapping.stockTracking.totalStock = newStock;
                mapping.masterProduct.stock = newStock;
                mapping.updateStockStatus();

                // Tüm platformlara yansıt
                const syncResults = await syncStockToAllMarketplaces(userId, mapping, newStock, "Trendyol");
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
            }

            processedOrders.add(orderKey);
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
            const orderKey = `n11_${order.id || order.orderNumber}`;
            if (processedOrders.has(orderKey)) continue;

            for (const item of (order.items || order.orderItems || [])) {
                const barcode = item.productSellerCode || item.sellerStockCode || item.stockCode;
                if (!barcode) continue;

                const mapping = await ProductMapping.findOne({
                    userId,
                    $or: [
                        { "masterProduct.barcode": barcode },
                        { "masterProduct.sku": barcode },
                        { "marketplaceMappings.marketplaceSku": barcode }
                    ]
                });

                if (!mapping) continue;

                const quantity = item.quantity || 1;
                const isCancelled = ["Rejected", "Cancelled", "CancelledByBuyer"].includes(order.status);
                const oldStock = mapping.stockTracking.totalStock;
                const newStock = isCancelled
                    ? oldStock + quantity
                    : Math.max(0, oldStock - quantity);

                if (oldStock === newStock) continue;

                mapping.stockTracking.totalStock = newStock;
                mapping.masterProduct.stock = newStock;
                mapping.updateStockStatus();

                const syncResults = await syncStockToAllMarketplaces(userId, mapping, newStock, "N11");
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
            }

            processedOrders.add(orderKey);
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
            const orderKey = `hb_${pkg.packageNumber || pkg.id}`;
            if (processedOrders.has(orderKey)) continue;

            for (const item of (pkg.items || pkg.lines || [])) {
                const barcode = item.merchantSku || item.hepsiburadaSku || item.sku;
                if (!barcode) continue;

                const mapping = await ProductMapping.findOne({
                    userId,
                    $or: [
                        { "masterProduct.barcode": barcode },
                        { "masterProduct.sku": barcode },
                        { "marketplaceMappings.marketplaceSku": barcode }
                    ]
                });

                if (!mapping) continue;

                const quantity = item.quantity || 1;
                const isCancelled = ["Cancelled", "UnDelivered"].includes(pkg.status);
                const oldStock = mapping.stockTracking.totalStock;
                const newStock = isCancelled
                    ? oldStock + quantity
                    : Math.max(0, oldStock - quantity);

                if (oldStock === newStock) continue;

                mapping.stockTracking.totalStock = newStock;
                mapping.masterProduct.stock = newStock;
                mapping.updateStockStatus();

                const syncResults = await syncStockToAllMarketplaces(userId, mapping, newStock, "Hepsiburada");
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

                results.push({ barcode, marketplace: "Hepsiburada", oldStock, newStock });
                logger.info(`[STOCK CRON] Hepsiburada ${isCancelled ? "İPTAL +" : "SİPARİŞ -"}${quantity} | ${mapping.masterProduct.name} | ${oldStock} → ${newStock}`);
            }

            processedOrders.add(orderKey);
        }
    } catch (error) {
        if (error.response?.status !== 401) {
            logger.error(`[STOCK CRON] Hepsiburada sipariş kontrolü hatası: ${error.message}`);
        }
    }

    return results;
};

/**
 * Ana cron fonksiyonu — tüm kullanıcılar için tüm pazaryerlerini kontrol et
 */
const runStockSync = async () => {
    try {
        // Aktif kullanıcıları bul (en az 1 pazaryeri entegrasyonu olan)
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
                        // Amazon ve ÇiçekSepeti ileride eklenecek
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
            logger.info(`[STOCK CRON] ✅ Döngü tamamlandı — ${totalChanges} stok değişikliği yapıldı`);
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
