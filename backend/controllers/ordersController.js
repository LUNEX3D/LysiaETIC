const {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders
} = require("../services/ordersService");

const amazonService = require("../services/amazon/amazonSpApiService");
const Marketplace = require("../models/Marketplace");
const Order = require("../models/Order");
const Product = require("../models/Product");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { processAutoInvoice } = require("../services/autoInvoiceService");

const getIstanbulTimestamp = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();
};

// ═══════════════════════════════════════════════════════════════════════
// ORDER SYNC — Pazaryeri siparislerini MongoDB'ye kaydet
// Gelismis Analiz (analyticsController) bu verilerle calisir
// Idempotent: ayni siparis tekrar kaydedilmez (orderNumber + marketplace)
// ═══════════════════════════════════════════════════════════════════════

// 🔒 Concurrency lock — aynı user+marketplace için paralel sync engelle
// Frontend hızlı sayfa geçişlerinde aynı marketplace için birden fazla
// getAllOrders çağrısı gelebilir → syncOrdersBackground paralel çalışır → duplicate risk
const activeSyncs = new Set();

async function syncOrdersBackground(userId, marketplaceName, rawOrders) {
    if (!rawOrders || rawOrders.length === 0) {
        return { synced: 0, skipped: 0 };
    }

    // 🔒 Aynı user+marketplace için zaten sync çalışıyorsa atla
    const lockKey = `${userId}_${marketplaceName}`;
    if (activeSyncs.has(lockKey)) {
        logger.info(`[OrderSync] ${marketplaceName}: zaten sync çalışıyor, atlanıyor`);
        return { synced: 0, skipped: 0 };
    }
    activeSyncs.add(lockKey);

    try {
    logger.info(`[OrderSync] ${marketplaceName}: ${rawOrders.length} sipariş sync ediliyor`);

    let synced = 0;
    let skipped = 0;
    const syncedOrderIds = [];

    // Urun maliyet bilgilerini onceden cek (kar hesabi icin)
    const products = await Product.find({ userId }).select("barcode costPrice commissionRate shippingCost packagingCost otherCost category").lean();
    const productMap = new Map(products.map(p => [p.barcode, p]));

    for (const order of rawOrders) {
        try {
            const orderNumber = order.orderNumber || order.id;
            if (!orderNumber) { skipped++; continue; }

            // Ayni siparis zaten var mi kontrol et
            const exists = await Order.findOne({
                user: userId,
                marketplaceName: marketplaceName,
                trackingNumber: String(orderNumber)
            });
            if (exists) { skipped++; continue; }

            // Siparis kalemlerini normalize et
            const rawItems = order.products || order.items || order.lines || [];
            const orderTotalPrice = parseFloat(order.totalPrice || 0);
            const totalItemCount = rawItems.length || 1;
            const items = rawItems.map(function(item, itemIdx) {
                const barcode = item.barcode || item.sku || item.merchantSku || item.productCode || item.productId || "";
                // Barcode bos ise fallback olustur (Order modeli barcode required)
                const finalBarcode = barcode || ("SYNC-" + orderNumber + "-" + itemIdx);
                const productInfo = productMap.get(barcode) || {};
                // Fiyat: item.price > 0 ise onu kullan, yoksa siparis toplamini kalemlere bol
                let price = parseFloat(item.price || item.unitPrice || 0);
                if (price === 0 && orderTotalPrice > 0) {
                    price = orderTotalPrice / totalItemCount;
                }
                const quantity = parseInt(item.quantity || 1);
                const costPrice = productInfo.costPrice || 0;
                const commissionRate = productInfo.commissionRate || 0;
                const apiCommission = parseFloat(item.commissionAmount || 0);
                const commissionAmount = apiCommission > 0 ? apiCommission : (price * quantity * (commissionRate / 100));
                const shippingCost = productInfo.shippingCost || 0;
                const totalCost = (costPrice * quantity) + commissionAmount + shippingCost;
                const netProfit = (price * quantity) - totalCost;

                return {
                    productName: item.productName || item.name || item.title || "Bilinmeyen",
                    quantity: quantity,
                    barcode: finalBarcode,
                    imageUrl: item.imageUrl || item.image || "https://via.placeholder.com/150",
                    price: price,
                    category: item.category || productInfo.category || "Bilinmiyor",
                    costPrice: costPrice,
                    commissionRate: commissionRate,
                    commissionAmount: commissionAmount,
                    shippingCost: shippingCost,
                    netProfit: netProfit
                };
            });

            // Eger items bos ise siparis seviyesinde tek kalem olustur
            if (items.length === 0) {
                const totalPrice = parseFloat(order.totalPrice || 0);
                items.push({
                    productName: order.productName || "Siparis Urunu",
                    quantity: 1,
                    barcode: "SYNC-" + orderNumber + "-0",
                    price: totalPrice,
                    category: "Bilinmiyor",
                    costPrice: 0,
                    commissionRate: 0,
                    commissionAmount: 0,
                    shippingCost: 0,
                    netProfit: totalPrice
                });
            }

            // Siparis seviyesi maliyet ozeti hesapla
            const totalPrice = parseFloat(order.totalPrice || 0) || items.reduce(function(sum, it) { return sum + (it.price * it.quantity); }, 0);
            const totalCost = items.reduce(function(sum, it) { return sum + (it.costPrice * it.quantity); }, 0);
            const totalCommission = items.reduce(function(sum, it) { return sum + it.commissionAmount; }, 0);
            const totalShipping = items.reduce(function(sum, it) { return sum + it.shippingCost; }, 0);
            const grossProfit = totalPrice - totalCost;
            const netProfit = grossProfit - totalCommission - totalShipping;
            const profitMargin = totalPrice > 0 ? (netProfit / totalPrice) * 100 : 0;

            // Siparis durumu kontrol
            const status = String(order.status || "Created");
            const isReturned = /cancel|return|refund|iade|iptal/i.test(status);
            const isCancelled = /cancel|iptal/i.test(status);

            // Siparis tarihini parse et
            // orderDateRaw: epoch ms (Trendyol) veya ISO string
            // orderDate: "17.03.2026 05:08:14" (TR locale) veya "14-03-2026 15:19" (N11)
            let orderDate;
            try {
                // Oncelik: raw epoch/ISO deger
                if (order.orderDateRaw) {
                    orderDate = new Date(order.orderDateRaw);
                } else if (order.orderDate) {
                    // ISO veya standart format dene
                    orderDate = new Date(order.orderDate);
                    // Gecersizse TR formatini parse et: "DD.MM.YYYY HH:mm:ss" veya "DD-MM-YYYY HH:mm"
                    if (isNaN(orderDate.getTime())) {
                        const parts = order.orderDate.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})\s*(\d{2}):(\d{2})(?::(\d{2}))?/);
                        if (parts) {
                            orderDate = new Date(
                                parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]),
                                parseInt(parts[4]), parseInt(parts[5]), parseInt(parts[6] || 0)
                            );
                        }
                    }
                }
                if (!orderDate || isNaN(orderDate.getTime())) orderDate = new Date();
            } catch (e) {
                orderDate = new Date();
            }

            // ── Müşteri bilgilerini çıkar (fatura için) ──────────────────
            const rawCustomerName = order.customerName || order.buyerName || order.recipientName || "";
            const rawAddress = order.shippingAddress || order.shipmentAddress || order.address || {};

            const newOrder = new Order({
                user: userId,
                marketplace: undefined, // marketplace ObjectId opsiyonel
                marketplaceName: marketplaceName,
                totalPrice: totalPrice,
                orderDate: orderDate,
                status: status,
                trackingNumber: String(orderNumber),
                customerName: rawCustomerName,
                customerAddress: {
                    city: rawAddress.city || rawAddress.province || "",
                    district: rawAddress.district || rawAddress.county || rawAddress.town || "",
                    street: rawAddress.fullAddress || rawAddress.address || rawAddress.addressLine1 || rawAddress.street || "",
                    country: rawAddress.country || rawAddress.countryCode || "Turkiye",
                    phone: rawAddress.phone || rawAddress.phoneNumber || order.customerPhone || "",
                    email: rawAddress.email || order.customerEmail || "",
                },
                items: items,
                costSummary: {
                    totalCost: totalCost,
                    totalCommission: totalCommission,
                    totalShipping: totalShipping,
                    totalPackaging: 0,
                    totalOtherCost: 0,
                    grossProfit: grossProfit,
                    netProfit: netProfit,
                    profitMargin: parseFloat(profitMargin.toFixed(2))
                },
                isReturned: isReturned,
                isCancelled: isCancelled
            });

            await newOrder.save();
            syncedOrderIds.push(newOrder._id);
            synced++;
        } catch (err) {
            if (err.code === 11000) { skipped++; continue; } // duplicate
            // İlk 3 hatayı detaylı logla
            if (skipped < 3) {
                logger.error(`[OrderSync] ${marketplaceName} sipariş kayıt hatası: ${err.message}`);
                if (err.errors) {
                    Object.keys(err.errors).forEach(key => {
                        logger.error(`  -> ${key}: ${err.errors[key].message}`);
                    });
                }
            }
            skipped++;
        }
    }

    logger.info("[OrderSync] " + marketplaceName + ": " + synced + " yeni siparis kaydedildi, " + skipped + " atlandi");

    // ── Otomatik Fatura Tetikleme ─────────────────────────────────────────
    // NOT: Stok güncelleme stockCronService tarafından yapılır (her 5dk).
    // Burada updateStockAfterOrder çağrılmaz — çünkü cron da aynı siparişi
    // işleyince çift stok düşürme (double deduction) oluşuyordu.
    // Yeni kaydedilen siparişler varsa, arka planda otomatik fatura kes
    if (syncedOrderIds.length > 0 && userId) {
        processAutoInvoice(userId, marketplaceName, syncedOrderIds).then(invoiceStats => {
            if (invoiceStats.invoiced > 0) {
                logger.info("[AutoInvoice] " + marketplaceName + ": " + invoiceStats.invoiced + " otomatik fatura kesildi");
            }
        }).catch(err => {
            logger.warn("[AutoInvoice] Arka plan fatura hatası: " + err.message);
        });
    }

    return { synced, skipped, syncedOrderIds };

    } finally {
        // 🔓 Lock'u serbest bırak — hata olsa bile
        activeSyncs.delete(lockKey);
    }
}

const convertToGMT3Timestamp = (dateStr, isStart = true) => {
    if (!dateStr) return NaN;
    const timePart = isStart ? "T00:00:00+03:00" : "T23:59:59+03:00";
    return new Date(`${dateStr}${timePart}`).getTime();
};

exports.getAllOrders = async (req, res) => {
    try {
        // ✅ FIX #2: IDOR — URL'deki userId yerine token'dan gelen kullanıcı ID'si
        const userId = req.user._id;
        let { startDate, endDate, marketplaceId } = req.query;

        const now = getIstanbulTimestamp();
        const defaultStartDate = now - 90 * 24 * 60 * 60 * 1000;
        const convertedStartDate = startDate ? convertToGMT3Timestamp(startDate, true) : defaultStartDate;
        const convertedEndDate = endDate ? convertToGMT3Timestamp(endDate, false) : now;

        const integration = await Marketplace.findOne({ _id: marketplaceId, userId });
        if (!integration) {
            logger.warn(`Integration not found for user ${userId}: ${marketplaceId}`);
            return res.status(404).json({
                error: "Integration not found!",
                details: "Please check your integration settings."
            });
        }

        let rawOrders = [];
        let orders = [];
        const marketplaceName = integration.marketplaceName;
        // ✅ FIX H5: Credential'ları decrypt et
        const credentials = decryptCredentials(integration.credentials);

        switch (marketplaceName.toLowerCase()) {
            case "trendyol":
                rawOrders = await fetchTrendyolOrders(
                    credentials.sellerId,
                    credentials.apiKey,
                    credentials.apiSecret,
                    convertedStartDate,
                    convertedEndDate
                );
                break;

            case "hepsiburada":
                rawOrders = await fetchHepsiburadaOrders(
                    credentials.merchantId,
                    credentials.apiKey,
                    convertedStartDate,
                    convertedEndDate
                );
                break;

            case "n11":
                rawOrders = await fetchN11Orders(
                    credentials.apiKey,
                    credentials.secretKey,
                    convertedStartDate,
                    convertedEndDate
                );
                break;

            case "çiçeksepeti":
            case "ciceksepeti":
                rawOrders = await fetchCicekSepetiOrders(
                    credentials.apiKey,
                    credentials.sellerId,
                    credentials.integratorName
                );
                break;

            case "amazon":
            case "amazon türkiye":
            case "amazon europe":
            case "amazon usa":
                const amazonResult = await amazonService.getAllOrders(credentials, {
                    createdAfter: new Date(convertedStartDate).toISOString(),
                    createdBefore: new Date(convertedEndDate).toISOString()
                });
                rawOrders = (amazonResult.orders || []).map(order => ({
                    orderNumber: order.AmazonOrderId,
                    orderDate: new Date(order.PurchaseDate).toLocaleString("tr-TR"),
                    customerName: order.BuyerInfo?.BuyerName || "Amazon Müşteri",
                    totalPrice: order.OrderTotal?.Amount || "0.00",
                    status: order.OrderStatus,
                    trackingNumber: order.FulfillmentInstruction?.FulfillmentSupplySourceId || "Yok",
                    cargoCompany: order.ShipServiceLevel || "Amazon",
                    products: []
                }));
                break;

            default:
                logger.warn(`Unsupported marketplace: ${marketplaceName}`);
                return res.status(400).json({
                    error: "Unsupported marketplace!",
                    supportedMarketplaces: ["trendyol", "hepsiburada", "n11", "çiçeksepeti", "amazon"]
                });
        }

        orders = rawOrders.map(order => {
            // ✅ FIX: totalPrice "0.00" veya boş ise ürün fiyatlarından hesapla
            let total = parseFloat(order.totalPrice) || 0;
            if (total === 0 && Array.isArray(order.products) && order.products.length > 0) {
                total = order.products.reduce((sum, p) => {
                    const price = parseFloat(p.price || p.unitPrice || p.amount || 0);
                    const qty = parseInt(p.quantity || 1);
                    return sum + (price * qty);
                }, 0);
            }
            return {
                orderNumber: order.orderNumber,
                orderDate: order.orderDate,
                customerName: order.customerName,
                totalPrice: total > 0 ? total.toFixed(2) : (order.totalPrice || "0.00"),
                status: order.status,
                trackingNumber: order.trackingNumber || "Yok",
                cargoCompany: order.cargoCompany || "Bilinmiyor",
                products: order.products
            };
        });

        // ── Arka planda siparisleri MongoDB'ye kaydet (Gelismis Analiz icin) ──
        // Response'u bekletmeden async olarak calistir
        syncOrdersBackground(userId, marketplaceName, rawOrders).catch(err => {
            logger.warn("[OrderSync] Arka plan sync hatasi: " + err.message);
        });

        return res.status(200).json({
            success: true,
            marketplace: marketplaceName,
            total: orders.length,
            orders: orders,
            timeframe: {
                start: new Date(convertedStartDate).toISOString(),
                end: new Date(convertedEndDate).toISOString()
            }
        });

    } catch (error) {
        logger.error("Order fetch error", { error: error.message });
        return res.status(500).json({
            error: "Failed to fetch orders!",
            details: process.env.NODE_ENV === "development" ? error.message : null
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// SYNC ALL ORDERS — Tum pazaryerlerinden siparisleri cekip DB'ye kaydet
// Gelismis Analiz sayfasi acildiginda bu endpoint cagirilir
// GET /api/orders/sync-all
// ═══════════════════════════════════════════════════════════════════════

exports.syncAllOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = getIstanbulTimestamp();
        const defaultStartDate = now - 90 * 24 * 60 * 60 * 1000; // 90 gun
        const startDate = req.query.startDate ? convertToGMT3Timestamp(req.query.startDate, true) : defaultStartDate;
        const endDate = req.query.endDate ? convertToGMT3Timestamp(req.query.endDate, false) : now;

        logger.info(`[OrderSync] syncAllOrders başladı - userId=${userId}`);

        // NOT: isActive alani bazi eski kayitlarda undefined olabilir
        // $ne: false kullanarak hem true hem undefined olanlari dahil ediyoruz
        const marketplaces = await Marketplace.find({ userId, isActive: { $ne: false } });
        if (marketplaces.length === 0) {
            logger.warn(`[OrderSync] userId=${userId} için aktif pazaryeri bulunamadı!`);
            return res.json({ success: true, message: "Aktif pazaryeri bulunamadi.", results: [] });
        }

        logger.info("[OrderSync] Tum pazaryerleri icin sync basliyor - " + marketplaces.length + " marketplace");

        const results = [];

        for (const rawMp of marketplaces) {
            const mp = rawMp.toObject();
            const credentials = decryptCredentials(mp.credentials);
            const marketplaceName = mp.marketplaceName;
            let rawOrders = [];

            try {
                switch (marketplaceName.toLowerCase()) {
                    case "trendyol":
                        rawOrders = await fetchTrendyolOrders(
                            credentials.sellerId, credentials.apiKey, credentials.apiSecret,
                            startDate, endDate
                        );
                        break;
                    case "hepsiburada":
                        rawOrders = await fetchHepsiburadaOrders(
                            credentials.merchantId, credentials.apiKey || credentials.serviceKey,
                            startDate, endDate
                        );
                        break;
                    case "n11":
                        rawOrders = await fetchN11Orders(
                            credentials.apiKey, credentials.secretKey,
                            startDate, endDate
                        );
                        break;
                    case "çiçeksepeti":
                    case "ciceksepeti":
                        rawOrders = await fetchCicekSepetiOrders(
                            credentials.apiKey, credentials.sellerId, credentials.integratorName
                        );
                        break;
                    case "amazon":
                    case "amazon türkiye":
                    case "amazon europe":
                    case "amazon usa":
                        try {
                            const amazonResult = await amazonService.getAllOrders(credentials, {
                                createdAfter: new Date(startDate).toISOString(),
                                createdBefore: new Date(endDate).toISOString()
                            });
                            rawOrders = (amazonResult.orders || []).map(function(order) {
                                return {
                                    orderNumber: order.AmazonOrderId,
                                    orderDate: order.PurchaseDate,
                                    totalPrice: order.OrderTotal?.Amount || "0.00",
                                    status: order.OrderStatus,
                                    products: []
                                };
                            });
                        } catch (amzErr) {
                            logger.warn("[OrderSync] Amazon siparis cekme hatasi: " + amzErr.message);
                        }
                        break;
                    default:
                        logger.warn("[OrderSync] Desteklenmeyen marketplace: " + marketplaceName);
                        continue;
                }

                const syncResult = await syncOrdersBackground(userId, marketplaceName, rawOrders);
                results.push({
                    marketplace: marketplaceName,
                    fetched: rawOrders.length,
                    synced: syncResult.synced,
                    skipped: syncResult.skipped
                });

            } catch (mpErr) {
                logger.error("[OrderSync] " + marketplaceName + " hatasi: " + mpErr.message);
                results.push({
                    marketplace: marketplaceName,
                    fetched: 0,
                    synced: 0,
                    skipped: 0,
                    error: mpErr.message
                });
            }
        }

        const totalSynced = results.reduce(function(sum, r) { return sum + r.synced; }, 0);
        const totalFetched = results.reduce(function(sum, r) { return sum + r.fetched; }, 0);

        logger.info("[OrderSync] Sync tamamlandi - " + totalFetched + " siparis cekildi, " + totalSynced + " yeni kaydedildi");

        return res.json({
            success: true,
            message: totalSynced + " yeni siparis kaydedildi (" + totalFetched + " toplam cekildi)",
            results: results
        });

    } catch (error) {
        logger.error("[OrderSync] Sync hatasi:", error.message);
        return res.status(500).json({ success: false, message: "Siparis sync hatasi: " + error.message });
    }
};
