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
    const products = await Product.find({ userId }).select("barcode sku images costPrice commissionRate shippingCost packagingCost otherCost category mainImage").lean();
    const productMap = new Map();
    const skuMap = new Map();

    products.forEach(p => {
        const barcode = String(p.barcode || "").trim();
        const sku = String(p.sku || "").trim();
        if (barcode) productMap.set(barcode, p);
        if (sku) skuMap.set(sku, p);
    });

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
            if (exists) { 
                // ✅ MEVCUT SİPARİŞİ GÜNCELLE: Eksik görsel varsa Product modelinden zenginleştir
                let needsUpdate = false;
                const updatedItems = exists.items.map(item => {
                    const barcode = String(item.barcode || "").trim();
                    const sku = String(item.sku || "").trim();
                    const name = String(item.name || item.title || "").trim().toLowerCase();

                    const productInfo = productMap.get(barcode) || skuMap.get(sku) || skuMap.get(barcode) || productMap.get(sku) || Array.from(products).find(p => String(p.name || "").trim().toLowerCase() === name);
                    
                    if (productInfo) {
                        const stockImage = productInfo.mainImage || (productInfo.images && productInfo.images[0]);
                        // Eğer mevcut görsel placeholder ise veya boş ise veya stoktaki görsel farklı ise güncelle
                        const isInvalid = !item.imageUrl || item.imageUrl.includes("default-product.jpg") || item.imageUrl.includes("placehold.co");
                        if (stockImage && (isInvalid || item.imageUrl !== stockImage)) {
                            needsUpdate = true;
                            item.imageUrl = stockImage;
                        }
                    }
                    return item;
                });

                if (needsUpdate) {
                    exists.items = updatedItems;
                    await exists.save();
                    logger.info(`[OrderSync] ${marketplaceName}: ${orderNumber} görseli güncellendi`);
                }

                skipped++; 
                continue; 
            }

            // Siparis kalemlerini normalize et
            const rawItems = order.products || order.items || order.lines || [];
            const orderTotalPrice = parseFloat(order.totalPrice || 0);
            const totalItemCount = rawItems.length || 1;
            const items = rawItems.map(function(item, itemIdx) {
                const barcode = String(item.barcode || item.sku || item.merchantSku || item.productCode || item.productId || "").trim();
                const sku = String(item.sku || item.merchantSku || item.productCode || "").trim();
                
                // Barcode bos ise fallback olustur (Order modeli barcode required)
                const finalBarcode = barcode || ("SYNC-" + orderNumber + "-" + itemIdx);
                const itemName = String(item.productName || item.name || item.title || "").trim().toLowerCase();
                const productInfo = productMap.get(barcode) || skuMap.get(sku) || skuMap.get(barcode) || productMap.get(sku) || Array.from(products).find(p => String(p.name || "").trim().toLowerCase() === itemName) || {};
                
                // Fiyat: item.price > 0 ise onu kullan, yoksa siparis toplamini kalemlere bol
                let price = parseFloat(item.price || item.unitPrice || 0);
                if (price === 0 && orderTotalPrice > 0) {
                    price = orderTotalPrice / totalItemCount;
                }
                const quantity = parseInt(item.quantity || 1);
                const costPrice = productInfo.costPrice || 0;
                const commissionRate = productInfo.commissionRate || 0;
                
            // ✅ GÖRSEL: Pazar yerinden gelmediyse sistemdeki üründen al
                let imageUrl = item.imageUrl || item.image || "";
                
                // Stoktaki görseli her zaman pazar yeri görseline tercih et (Kalite ve doğruluk için)
                const stockImage = productInfo.mainImage || (productInfo.images && productInfo.images[0]);
                
                if (stockImage) {
                    imageUrl = stockImage;
                } else {
                    // Hatalı yerel dosya referanslarını temizle
                    if (imageUrl.includes("default-product.jpg") || imageUrl.includes("placehold.co")) {
                        imageUrl = "";
                    }

                    if (!imageUrl) {
                        imageUrl = "https://placehold.co/400x400/1e293b/4ecdc4?text=Urun";
                    }
                }

                const apiCommission = parseFloat(item.commissionAmount || 0);
                const commissionAmount = apiCommission > 0 ? apiCommission : (price * quantity * (commissionRate / 100));
                const shippingCost = productInfo.shippingCost || 0;
                const totalCost = (costPrice * quantity) + commissionAmount + shippingCost;
                const netProfit = (price * quantity) - totalCost;

                return {
                    productName: item.productName || item.name || item.title || "Bilinmeyen",
                    quantity: quantity,
                    barcode: finalBarcode,
                    imageUrl: imageUrl,
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

            // ── Pazaryeri fatura durumu kontrolü ──────────────────────────
            // Trendyol: status "Invoiced" ise pazaryerinde fatura kesilmiş
            // Hepsiburada/N11/ÇiçekSepeti: status'a göre kontrol
            const statusLower = status.toLowerCase();
            const marketplaceInvoiced = statusLower === "invoiced"
                || statusLower === "faturalandı"
                || statusLower === "faturalandi"
                || (order.invoiceNumber && order.invoiceNumber !== "")
                || false;

            // ── Teslimat ülkesi (mikro ihracat tespiti) ──────────────────
            const rawShipAddrForCountry = order.shipmentAddress || order.shippingAddress || order.address || {};
            const shippingCountry = rawShipAddrForCountry.country
                || rawShipAddrForCountry.countryCode
                || order.shippingCountry
                || "Turkiye";

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
            // Öncelik: invoiceAddress > shipmentAddress > shippingAddress > address
            const rawCustomerName = order.customerName || order.buyerName || order.recipientName || "";
            const rawShipAddr = order.shipmentAddress || order.shippingAddress || order.address || {};
            const rawInvAddr = order.invoiceAddress || {};

            // Fatura adresi varsa onu tercih et (VKN/vergi dairesi bilgisi içerir)
            // Yoksa kargo adresini kullan
            const addrSource = (rawInvAddr.city || rawInvAddr.fullAddress) ? rawInvAddr : rawShipAddr;

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
                    city: addrSource.city || rawShipAddr.city || addrSource.province || "",
                    district: addrSource.district || rawShipAddr.district || addrSource.county || addrSource.town || "",
                    street: addrSource.fullAddress || rawShipAddr.fullAddress || addrSource.address || addrSource.addressLine1 || addrSource.street || "",
                    country: addrSource.country || rawShipAddr.country || addrSource.countryCode || "Turkiye",
                    phone: rawShipAddr.phone || addrSource.phone || rawShipAddr.phoneNumber || order.customerPhone || "",
                    email: rawShipAddr.email || order.customerEmail || "",
                },
                // ── Ham fatura adresi (B2B VKN/vergi dairesi bilgileri) ──
                _rawInvoiceAddress: {
                    fullName: rawInvAddr.fullName || rawInvAddr.name || "",
                    company: rawInvAddr.company || rawInvAddr.companyName || "",
                    taxNumber: rawInvAddr.taxNumber || rawInvAddr.vkn || "",
                    taxOffice: rawInvAddr.taxOffice || "",
                    city: rawInvAddr.city || "",
                    district: rawInvAddr.district || "",
                    fullAddress: rawInvAddr.fullAddress || rawInvAddr.address || "",
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
                isCancelled: isCancelled,
                marketplaceInvoiced: marketplaceInvoiced,
                shippingCountry: shippingCountry,
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

            case "hepsiburada": {
                const { normalizeCredentials: normHbOrd } = require("../services/hepsiburadaService");
                const hbOrdCreds = normHbOrd(credentials);
                rawOrders = await fetchHepsiburadaOrders(
                    hbOrdCreds.merchantId,
                    hbOrdCreds.secretKey,
                    convertedStartDate,
                    convertedEndDate,
                    hbOrdCreds.userAgent,
                    hbOrdCreds.useSit
                );
                break;
            }

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
                    customerEmail: order.BuyerInfo?.BuyerEmail || "",
                    totalPrice: order.OrderTotal?.Amount || "0.00",
                    status: order.OrderStatus,
                    trackingNumber: order.FulfillmentInstruction?.FulfillmentSupplySourceId || "Yok",
                    cargoCompany: order.ShipServiceLevel || "Amazon",
                    // ── Müşteri adres bilgileri (fatura için) ──
                    shippingAddress: order.ShippingAddress ? {
                        fullName: order.ShippingAddress.Name || order.BuyerInfo?.BuyerName || "",
                        city: order.ShippingAddress.City || order.ShippingAddress.StateOrRegion || "",
                        district: order.ShippingAddress.District || order.ShippingAddress.County || "",
                        fullAddress: [order.ShippingAddress.AddressLine1, order.ShippingAddress.AddressLine2, order.ShippingAddress.AddressLine3].filter(Boolean).join(" "),
                        phone: order.ShippingAddress.Phone || "",
                        country: order.ShippingAddress.CountryCode || "Turkiye",
                    } : {},
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

        // ✅ FIX: totalPrice "0.00" veya boş ise ürün fiyatlarından hesapla
        // Ürün görsel haritası oluştur (barkod/sku/isim -> görsel)
        const productImageMap = new Map();
        const productNameImageMap = new Map(); // İsim bazlı eşleşme için
        
        // Stoktan ürünleri çek
        const userProducts = await Product.find({ userId }).select("barcode sku images name mainImage").lean();

        userProducts.forEach(p => {
            const img = p.mainImage || (p.images && p.images.length > 0 ? p.images[0] : null);
            if (img) {
                if (p.barcode) productImageMap.set(String(p.barcode).trim(), img);
                if (p.sku) productImageMap.set(String(p.sku).trim(), img);
                if (p.name) {
                    const normalizedName = String(p.name).trim().toLowerCase();
                    if (!productNameImageMap.has(normalizedName)) {
                        productNameImageMap.set(normalizedName, img);
                    }
                }
            }
        });

        orders = rawOrders.map(order => {
            let total = parseFloat(order.totalPrice) || 0;
            const processedProducts = (order.products || []).map(p => {
                const barcode = String(p.barcode || "").trim();
                const sku = String(p.sku || "").trim();
                const name = String(p.productName || p.name || p.title || "").trim().toLowerCase();
                
                // Öncelik: Barkod/SKU eşleşmesi -> İsim eşleşmesi
                const stockImg = productImageMap.get(barcode) || productImageMap.get(sku) || productNameImageMap.get(name);
                
                // Stoktaki görseli her zaman pazar yeri görseline tercih et
                if (stockImg) {
                    p.imageUrl = stockImg;
                } else if (!p.imageUrl || p.imageUrl.includes("default-product.jpg") || p.imageUrl.includes("placehold.co")) {
                    p.imageUrl = "https://placehold.co/400x400/1e293b/4ecdc4?text=Urun";
                }
                return p;
            });

            if (total === 0 && processedProducts.length > 0) {
                total = processedProducts.reduce((sum, p) => {
                    const price = parseFloat(p.price || p.unitPrice || p.amount || 0);
                    const qty = parseInt(p.quantity || 1);
                    return sum + (price * qty);
                }, 0);
            }

            const firstImg = processedProducts[0]?.imageUrl || order.imageUrl;

            return {
                orderNumber: order.orderNumber,
                orderDate: order.orderDate,
                customerName: order.customerName,
                totalPrice: total > 0 ? total.toFixed(2) : (order.totalPrice || "0.00"),
                status: order.status,
                trackingNumber: order.trackingNumber || "Yok",
                cargoCompany: order.cargoCompany || "Bilinmiyor",
                imageUrl: firstImg,
                products: processedProducts
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

// ═══════════════════════════════════════════════════════════════════════
// DB ORDERS — MongoDB'deki siparişleri fatura durumuyla birlikte getir
// Sipariş Yönetimi sayfasında fatura durumunu göstermek için kullanılır
// GET /api/orders/db-orders
// ═══════════════════════════════════════════════════════════════════════

exports.getDbOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
        const skip = (page - 1) * limit;

        // Filtreler
        const filter = { user: userId };

        if (req.query.marketplace) {
            filter.marketplaceName = req.query.marketplace;
        }

        if (req.query.status) {
            // SEC: Kullanıcı girdisini escape et — ReDoS koruması
            const escapedStatus = req.query.status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.status = { $regex: escapedStatus, $options: "i" };
        }

        if (req.query.invoiceFilter === "invoiced") {
            filter.invoiceId = { $exists: true };
        } else if (req.query.invoiceFilter === "uninvoiced") {
            filter.invoiceId = { $exists: false };
            filter.invoiceStatus = { $nin: ["created"] };
        } else if (req.query.invoiceFilter === "error") {
            filter.invoiceStatus = "error";
        } else if (req.query.invoiceFilter === "pending") {
            filter.invoiceStatus = "pending";
        }

        if (req.query.startDate) {
            filter.orderDate = filter.orderDate || {};
            filter.orderDate.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
            filter.orderDate = filter.orderDate || {};
            filter.orderDate.$lte = new Date(req.query.endDate + "T23:59:59.999Z");
        }

        const [orders, total, userProducts] = await Promise.all([
            Order.find(filter)
                .select("trackingNumber marketplaceName customerName totalPrice orderDate status invoiceId invoiceNumber invoiceStatus items isReturned isCancelled")
                .populate("invoiceId", "invoiceNumber uuid status faturaURL issueDate")
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter),
            Product.find({ userId }).select("barcode sku images name mainImage").lean()
        ]);

        // Ürün görsel haritası oluştur (barkod/sku/isim -> görsel)
        const productImageMap = new Map();
        const productNameImageMap = new Map();

        userProducts.forEach(p => {
            const img = p.mainImage || (p.images && p.images.length > 0 ? p.images[0] : null);
            if (img) {
                if (p.barcode) productImageMap.set(String(p.barcode).trim(), img);
                if (p.sku) productImageMap.set(String(p.sku).trim(), img);
                if (p.name) {
                    const normalizedName = String(p.name).trim().toLowerCase();
                    if (!productNameImageMap.has(normalizedName)) {
                        productNameImageMap.set(normalizedName, img);
                    }
                }
            }
        });

        // ✅ CANLI API GÖRSEL ZENGİNLEŞTİRME: getAllOrders'dan gelen veriler için de haritayı kullanabiliriz
        // Ancak bu fonksiyon req/res döner, biz burada sadece DB'dekileri döndürüyoruz.

        // Fatura istatistikleri
        // ✅ FIX: "error" ve "pending" durumundaki siparişleri "faturasız" olarak sayma
        const [totalOrders, invoicedCount, uninvoicedCount, errorCount] = await Promise.all([
            Order.countDocuments({ user: userId }),
            Order.countDocuments({ user: userId, invoiceId: { $exists: true } }),
            Order.countDocuments({ user: userId, invoiceId: { $exists: false }, invoiceStatus: { $nin: ["created", "pending", "error"] }, isCancelled: false, isReturned: false, totalPrice: { $gt: 0 } }),
            Order.countDocuments({ user: userId, invoiceStatus: "error" }),
        ]);

        // Siparişleri formatla
        const formattedOrders = orders.map(o => {
            let invoiceInfo = null;
            if (o.invoiceId && typeof o.invoiceId === "object") {
                invoiceInfo = {
                    _id: o.invoiceId._id,
                    invoiceNumber: o.invoiceId.invoiceNumber || o.invoiceNumber || "",
                    uuid: o.invoiceId.uuid || "",
                    status: o.invoiceId.status || "created",
                    faturaURL: o.invoiceId.faturaURL || "",
                    issueDate: o.invoiceId.issueDate || "",
                };
            } else if (o.invoiceId) {
                // populate edilmemişse sadece ID var
                invoiceInfo = { _id: o.invoiceId, invoiceNumber: o.invoiceNumber || "" };
            }

            // Sipariş kalemlerini görsel açısından zenginleştir
            const enrichedItems = (o.items || []).map(item => {
                const barcode = String(item.barcode || "").trim();
                const sku = String(item.sku || "").trim();
                const name = String(item.productName || item.name || item.title || "").trim().toLowerCase();
                
                // Öncelik: Barkod/SKU eşleşmesi -> İsim eşleşmesi
                const stockImg = productImageMap.get(barcode) || productImageMap.get(sku) || productNameImageMap.get(name);
                
                let itemImg = item.imageUrl;
                if (stockImg) {
                    itemImg = stockImg;
                } else if (!itemImg || itemImg.includes("default-product.jpg") || itemImg.includes("placehold.co")) {
                    itemImg = "https://placehold.co/400x400/1e293b/4ecdc4?text=Urun";
                }

                return {
                    ...item,
                    imageUrl: itemImg
                };
            });

            // İlk ürün görselini ana görsel olarak belirle
            const imageUrl = enrichedItems[0]?.imageUrl || "https://placehold.co/400x400/1e293b/4ecdc4?text=Urun";

            return {
                _id: o._id,
                orderNumber: o.trackingNumber || "",
                marketplace: o.marketplaceName || "",
                customerName: o.customerName || "",
                totalPrice: o.totalPrice || 0,
                orderDate: o.orderDate,
                status: o.status || "",
                invoiceStatus: o.invoiceStatus || (invoiceInfo ? "created" : ""),
                invoice: invoiceInfo,
                items: enrichedItems,
                productCount: enrichedItems.length,
                firstProduct: enrichedItems[0]?.productName || "",
                imageUrl: imageUrl,
                isReturned: o.isReturned || false,
                isCancelled: o.isCancelled || false,
            };
        });

        res.json({
            success: true,
            data: formattedOrders,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            invoiceStats: {
                total: totalOrders,
                invoiced: invoicedCount,
                uninvoiced: uninvoicedCount,
                error: errorCount,
            }
        });
    } catch (error) {
        logger.error("[Orders] getDbOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası: " + error.message });
    }
};

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
                    case "hepsiburada": {
                        const { normalizeCredentials: normHbAll } = require("../services/hepsiburadaService");
                        const hbAllCreds = normHbAll(credentials);
                        rawOrders = await fetchHepsiburadaOrders(
                            hbAllCreds.merchantId, hbAllCreds.secretKey,
                            startDate, endDate, hbAllCreds.userAgent, hbAllCreds.useSit
                        );
                        break;
                    }
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
