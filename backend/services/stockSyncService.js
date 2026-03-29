const ProductMapping = require("../models/ProductMapping");
const StockSyncLog = require("../models/StockSyncLog");
const Marketplace = require("../models/Marketplace");
const Order = require("../models/Order");
const logger = require("../config/logger");
const axios = require("axios");
const n11Service = require("./n11Service");

// Pazaryeri isimlerini normalize et
const normalizeMarketplaceName = (name) => {
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
 * STOK SENKRONİZASYON SERVİSİ
 *
 * Tüm pazaryerlerinde stok senkronizasyonunu yönetir
 * Sipariş verildiğinde otomatik olarak tüm pazaryerlerdeki stokları günceller
 */

// Sipariş sonrası stok güncelleme
const updateStockAfterOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('marketplace');
        if (!order) {
            throw new Error("Sipariş bulunamadı");
        }

        logger.info(`[STOCK SYNC] Sipariş sonrası stok güncelleme: ${order._id}`);

        const results = [];

        // Siparişteki her ürün için
        for (const item of order.items) {
            try {
                // Ürün eşleştirmesini bul
                const mapping = await ProductMapping.findOne({
                    userId: order.user,
                    "masterProduct.barcode": item.barcode
                });

                if (!mapping) {
                    logger.warn(`[STOCK SYNC] Ürün eşleştirmesi bulunamadı: ${item.barcode}`);
                    continue;
                }

                // Stok miktarını azalt
                const oldStock = mapping.stockTracking.totalStock;
                const newStock = Math.max(0, oldStock - item.quantity);

                mapping.stockTracking.totalStock = newStock;
                mapping.stockTracking.reservedStock = Math.max(0, mapping.stockTracking.reservedStock - item.quantity);
                mapping.updateStockStatus();

                // Tüm pazaryerlerinde stoku güncelle
                const syncResults = await syncStockToAllMarketplaces(
                    order.user,
                    mapping,
                    newStock,
                    order.marketplaceName
                );

                // Log oluştur
                await StockSyncLog.create({
                    userId: order.user,
                    actionType: "order_placed",
                    product: {
                        productMappingId: mapping._id,
                        barcode: item.barcode,
                        sku: mapping.masterProduct.sku,
                        name: item.productName
                    },
                    marketplace: {
                        name: order.marketplaceName,
                        productId: null
                    },
                    order: {
                        orderId: order._id.toString(),
                        orderNumber: order.orderNumber || order._id.toString(),
                        marketplace: order.marketplaceName,
                        quantity: item.quantity
                    },
                    changes: {
                        field: "stock",
                        oldValue: oldStock,
                        newValue: newStock,
                        difference: -item.quantity
                    },
                    status: "success",
                    affectedMarketplaces: syncResults,
                    notification: {
                        priority: newStock === 0 ? "critical" : newStock <= mapping.stockTracking.lowStockThreshold ? "high" : "medium"
                    }
                });

                await mapping.save();

                results.push({
                    barcode: item.barcode,
                    name: item.productName,
                    oldStock,
                    newStock,
                    quantity: item.quantity,
                    status: "success",
                    marketplaces: syncResults
                });

            } catch (error) {
                logger.error(`[STOCK SYNC] Ürün stok güncelleme hatası (${item.barcode}):`, error.message);
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

// Tüm pazaryerlerinde stok VE fiyat senkronize et
const syncStockToAllMarketplaces = async (userId, productMapping, newStock, excludeMarketplace = null, priceUpdate = null) => {
    const results = [];

    for (const marketplaceMapping of productMapping.marketplaceMappings) {
        const mpName = normalizeMarketplaceName(marketplaceMapping.marketplaceName);
        const excludeName = excludeMarketplace ? normalizeMarketplaceName(excludeMarketplace) : null;

        // Siparişin geldiği pazaryerini atla (zaten güncel)
        if (excludeName && mpName === excludeName) {
            results.push({
                name: mpName,
                syncStatus: "skipped",
                syncedAt: new Date(),
                error: "Sipariş kaynağı - güncelleme gerekmiyor"
            });
            continue;
        }

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

            // Stok + fiyat güncelle
            const updateResult = await updateStockOnMarketplace(
                marketplace,
                marketplaceMapping.marketplaceSku || marketplaceMapping.marketplaceProductId,
                newStock,
                priceUpdate
            );

            if (updateResult.success) {
                marketplaceMapping.stock = newStock;
                marketplaceMapping.lastSyncDate = new Date();
                marketplaceMapping.syncStatus = "synced";
                if (priceUpdate?.salePrice)  marketplaceMapping.price     = priceUpdate.salePrice;
                if (priceUpdate?.listPrice)  marketplaceMapping.listPrice  = priceUpdate.listPrice;

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
const updateStockOnMarketplace = async (marketplace, productId, newStock, priceUpdate = null) => {
    const marketplaceName = normalizeMarketplaceName(marketplace.marketplaceName);
    const credentials = marketplace.credentials;

    try {
        switch (marketplaceName) {
            case "Trendyol":
                return await updateTrendyolStock(credentials, productId, newStock, priceUpdate);
            case "Hepsiburada":
                return await updateHepsiburadaStock(credentials, productId, newStock, priceUpdate);
            case "N11":
                return await updateN11Stock(credentials, productId, newStock, priceUpdate);
            case "ÇiçekSepeti":
                return await updateCicekSepetiStock(credentials, productId, newStock, priceUpdate);
            default:
                logger.warn(`[STOCK UPDATE] ${marketplaceName} için stok güncelleme API'si henüz eklenmedi`);
                return { success: true, simulated: true, message: `${marketplaceName} stok güncelleme simüle edildi` };
        }
    } catch (error) {
        logger.error(`[STOCK UPDATE] ${marketplaceName} hatası:`, error.message);
        return { success: false, error: error.message };
    }
};

// Trendyol stok + fiyat güncelleme
const updateTrendyolStock = async (credentials, productId, newStock, priceUpdate = null) => {
    try {
        const { apiKey, apiSecret, sellerId, supplierId } = credentials;
        const actualSellerId = sellerId || supplierId;
        if (!apiKey || !apiSecret || !actualSellerId) {
            return { success: false, error: "Trendyol credentials eksik (apiKey, apiSecret, sellerId)" };
        }
        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

        const item = {
            barcode: productId,
            quantity: newStock
        };
        // Fiyat güncelleme varsa ekle
        if (priceUpdate?.salePrice) item.salePrice = priceUpdate.salePrice;
        if (priceUpdate?.listPrice) item.listPrice = priceUpdate.listPrice;

        const response = await axios.post(
            `https://apigw.trendyol.com/integration/inventory/sellers/${actualSellerId}/products/price-and-inventory`,
            { items: [item] },
            {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${actualSellerId} - LysiaETIC`,
                    "Content-Type": "application/json"
                },
                timeout: 10000
            }
        );

        return { success: true, response: response.data };
    } catch (error) {
        logger.error("[TRENDYOL STOCK] Hata:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// Hepsiburada stok + fiyat güncelleme
const updateHepsiburadaStock = async (credentials, productId, newStock, priceUpdate = null) => {
    try {
        const { merchantId, apiKey } = credentials;
        if (!merchantId || !apiKey) {
            return { success: false, error: "Hepsiburada credentials eksik" };
        }
        const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;

        const listing = {
            hepsiburadaSku: productId,
            merchantSku: productId,
            availableStock: newStock
        };
        // Fiyat güncelleme varsa ekle
        if (priceUpdate?.salePrice) listing.price     = priceUpdate.salePrice;
        if (priceUpdate?.listPrice) listing.listPrice = priceUpdate.listPrice;

        const response = await axios.post(
            `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}/inventory-uploads`,
            { listings: [listing] },
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                    "User-Agent": "LysiaETIC"
                },
                timeout: 10000
            }
        );

        return { success: true, response: response.data };
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
const updateCicekSepetiStock = async (credentials, productId, newStock, priceUpdate = null) => {
    try {
        // ÇiçekSepeti hem apiSecret hem apiKey adını kullanabilir
        const apiSecret  = credentials.apiSecret  || credentials.apiKey;
        const supplierId = credentials.supplierId || credentials.merchantId;
        if (!apiSecret || !supplierId) {
            return { success: false, error: "ÇiçekSepeti credentials eksik: apiSecret ve supplierId gerekli" };
        }

        const headers = {
            "x-api-key":    apiSecret,
            "supplierId":   supplierId,
            "Content-Type": "application/json"
        };

        // Stok güncelleme
        const stockResponse = await axios.put(
            `https://apis.ciceksepeti.com/api/v1/Products/${productId}/Stock`,
            { stockQuantity: parseInt(newStock) || 0 },
            { headers, timeout: 10000 }
        );

        // Fiyat güncelleme varsa ayrı endpoint'e istek at
        if (priceUpdate?.salePrice) {
            await axios.put(
                `https://apis.ciceksepeti.com/api/v1/Products/${productId}/Price`,
                {
                    salesPrice: parseFloat(priceUpdate.salePrice),
                    listPrice:  parseFloat(priceUpdate.listPrice || priceUpdate.salePrice)
                },
                { headers, timeout: 10000 }
            );
        }

        return { success: true, response: stockResponse.data };
    } catch (error) {
        logger.error("[CICEKSEPETI STOCK] Hata:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// Manuel stok + fiyat senkronizasyonu
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
        mapping.masterProduct.stock      = newStock;
        mapping.updateStockStatus();

        // Fiyat güncelleme varsa master product'ı da güncelle
        if (priceUpdate?.salePrice) {
            mapping.masterProduct.price = parseFloat(priceUpdate.salePrice);
        }
        if (priceUpdate?.listPrice) {
            mapping.masterProduct.listPrice = parseFloat(priceUpdate.listPrice);
        }

        // Tüm pazaryerlerinde stok + fiyat senkronize et
        const syncResults = await syncStockToAllMarketplaces(userId, mapping, newStock, null, priceUpdate);

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
            status: "success",
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
                status: "success",
                affectedMarketplaces: syncResults,
                notification: { priority: "low" }
            });
        }

        await mapping.save();

        return {
            success: true,
            oldStock,
            newStock,
            oldPrice,
            newPrice: priceUpdate?.salePrice || oldPrice,
            marketplaces: syncResults
        };
    } catch (error) {
        logger.error("[MANUAL SYNC] Hata:", error.message);
        throw error;
    }
};

// Otomatik stok senkronizasyonu (periyodik)
const autoStockSync = async (userId) => {
    try {
        logger.info(`[AUTO SYNC] Kullanıcı ${userId} için otomatik stok senkronizasyonu başlatılıyor...`);

        const mappings = await ProductMapping.find({
            userId,
            "autoSync.enabled": true
        });

        const results = [];

        for (const mapping of mappings) {
            try {
                const syncResults = await syncStockToAllMarketplaces(
                    userId,
                    mapping,
                    mapping.stockTracking.totalStock
                );

                results.push({
                    productId: mapping._id,
                    barcode: mapping.masterProduct.barcode,
                    name: mapping.masterProduct.name,
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

        return results;
    } catch (error) {
        logger.error("[AUTO SYNC] Genel hata:", error.message);
        throw error;
    }
};

module.exports = {
    updateStockAfterOrder,
    syncStockToAllMarketplaces,
    updateStockOnMarketplace,
    manualStockSync,
    autoStockSync
};
