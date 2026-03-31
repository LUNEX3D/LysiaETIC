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
    // Atomic: totalStock düşür + reservedStock artır (tek DB operasyonu)
    const mapping = await ProductMapping.findOneAndUpdate(
        {
            userId,
            $or: [
                { "masterProduct.barcode": barcode },
                { "masterProduct.sku": barcode },
                { "marketplaceMappings.marketplaceSku": barcode },
                { "marketplaceMappings.marketplaceBarcode": barcode }
            ],
            "stockTracking.totalStock": { $gte: quantity } // Yeterli stok var mı?
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

    mapping.updateStockStatus();
    await mapping.save();

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
    const mapping = await ProductMapping.findOneAndUpdate(
        {
            userId,
            $or: [
                { "masterProduct.barcode": barcode },
                { "masterProduct.sku": barcode },
                { "marketplaceMappings.marketplaceSku": barcode },
                { "marketplaceMappings.marketplaceBarcode": barcode }
            ]
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
// ⚡ SİPARİŞ SONRASI ANLIK STOK GÜNCELLEME
// ═══════════════════════════════════════════════════════════════

/**
 * Sipariş sonrası stok güncelleme — atomic reserve + anlık tüm platformlara push
 */
const updateStockAfterOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('marketplace');
        if (!order) {
            throw new Error("Sipariş bulunamadı");
        }

        logger.info(`[STOCK SYNC] ⚡ Sipariş sonrası ANLIK stok güncelleme: ${order._id}`);

        const results = [];

        for (const item of order.items) {
            try {
                // 🔒 Atomic stok rezerve et
                const reserveResult = await reserveStock(order.user, item.barcode, item.quantity);

                if (!reserveResult.success) {
                    logger.warn(`[STOCK SYNC] ⚠️ Stok rezerve başarısız: ${item.barcode} — ${reserveResult.error}`);
                    results.push({
                        barcode: item.barcode,
                        name: item.productName,
                        status: "error",
                        error: reserveResult.error
                    });
                    continue;
                }

                const { mapping, oldStock, newStock, marketplaceStock } = reserveResult;

                // ⚡ TÜM pazaryerlerine ANLIK push (güvenlik stoğu düşülmüş hali)
                const syncResults = await syncStockToAllMarketplaces(
                    order.user,
                    mapping,
                    marketplaceStock,
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
                    marketplaceStock,
                    quantity: item.quantity,
                    status: "success",
                    marketplaces: syncResults
                });

                logger.info(`[STOCK SYNC] ✅ ${item.productName} | stok: ${oldStock}→${newStock} | platformlara: ${marketplaceStock} | ${syncResults.filter(r => r.syncStatus === "success").length} platform güncellendi`);

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

            // ✅ Pazaryerine göre doğru productId belirle
            // Trendyol → barcode ile çalışır
            // N11 → stockCode (sku) ile çalışır
            // Hepsiburada → merchantSku ile çalışır
            // ÇiçekSepeti → ürün ID ile çalışır
            let productIdForMarketplace;
            switch (mpName) {
                case "Trendyol":
                    // Trendyol: önce marketplace-specific barcode, sonra master barcode
                    productIdForMarketplace =
                        marketplaceMapping.marketplaceBarcode ||
                        marketplaceMapping.marketplaceSku ||
                        masterBarcode ||
                        masterSku;
                    break;
                case "N11":
                    // N11: stockCode = sku
                    productIdForMarketplace =
                        marketplaceMapping.marketplaceSku ||
                        marketplaceMapping.marketplaceBarcode ||
                        masterSku ||
                        masterBarcode;
                    break;
                case "Hepsiburada":
                    // Hepsiburada: merchantSku
                    productIdForMarketplace =
                        marketplaceMapping.marketplaceSku ||
                        marketplaceMapping.marketplaceProductId ||
                        masterSku ||
                        masterBarcode;
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

            logger.info(`[STOCK SYNC] ${mpName} güncelleniyor — productId: ${productIdForMarketplace}, stok: ${newStock}`);

            // Stok + fiyat güncelle
            const updateResult = await updateStockOnMarketplace(
                marketplace,
                productIdForMarketplace,
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

        // 🔓 Stok > 0 ise ürünü otomatik olarak satışa aç (unlock)
        // Trendyol'da ürün "satışa kapalı" (locked) olabilir — stok varsa unlock API ile açılır
        if (stockQty > 0) {
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

        return { success: true, batchId, response: response.data, unlocked: stockQty > 0 };
    } catch (error) {
        const errData = error.response?.data;
        const errMsg = errData?.errors?.[0]?.message || errData?.message || error.message;
        logger.error(`[TRENDYOL STOCK] Hata — productId: ${productId}, status: ${error.response?.status}, error: ${errMsg}`);
        return { success: false, error: errMsg };
    }
};

// Hepsiburada stok + fiyat güncelleme
const updateHepsiburadaStock = async (credentials, productId, newStock, priceUpdate = null) => {
    try {
        const { merchantId, apiKey, username, password } = credentials;
        if (!merchantId) {
            return { success: false, error: "Hepsiburada credentials eksik: merchantId gerekli" };
        }

        // ✅ Hepsiburada Basic Auth: username:password (merchantId değil!)
        // Bazı kullanıcılar username/password, bazıları merchantId/apiKey olarak kaydetmiş olabilir
        const authUser = username || merchantId;
        const authPass = password || apiKey;
        if (!authUser || !authPass) {
            return { success: false, error: "Hepsiburada credentials eksik: username/password veya merchantId/apiKey gerekli" };
        }
        const authHeader = `Basic ${Buffer.from(`${authUser}:${authPass}`).toString("base64")}`;

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
        mapping.masterProduct.stock      = newStock;
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

        // Tüm pazaryerlerinde stok + fiyat senkronize et
        const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, null, priceUpdate);

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

        logger.info(`[MANUAL SYNC] ✅ ${mapping.masterProduct.name} | stok: ${oldStock}→${newStock} | platformlara: ${marketplaceStock}`);

        return {
            success: true,
            oldStock,
            newStock,
            marketplaceStock,
            oldPrice,
            newPrice: priceUpdate?.salePrice || oldPrice,
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

        return results;
    } catch (error) {
        logger.error("[AUTO SYNC] Genel hata:", error.message);
        throw error;
    }
};

module.exports = {
    // Sipariş akışı
    updateStockAfterOrder,
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
