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
const ProductMapping = require("../models/ProductMapping");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { processAutoInvoice } = require("../services/autoInvoiceService");
const { parseMarketplaceOrderDateToUtcDate, marketplaceOrderDateToIsoString } = require("../utils/helpers");

const getIstanbulTimestamp = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();
};

/** Sipariş listesi / toplu sync: query'de tarih yoksa varsayılan pencere (gün). Env: ORDER_DEFAULT_WINDOW_DAYS */
const ORDER_DEFAULT_WINDOW_DAYS = Math.min(
    365,
    Math.max(1, parseInt(process.env.ORDER_DEFAULT_WINDOW_DAYS || "7", 10) || 7)
);

/** Pazaryeri satır görseli: //cdn... → https: (tarayıcıda yüklenmezdi) */
const normalizeOrderItemImageUrl = (url) => {
    if (url == null || typeof url !== "string") return "";
    const u = url.trim();
    if (!u) return "";
    if (u.startsWith("//")) return `https:${u}`;
    return u;
};

/**
 * Stok görselleri: Product + ProductMapping.masterProduct (Ürün Yönetimi)
 */
const fillOrderProductImageMaps = (productImageMap, productNameImageMap, doc) => {
    const imgRaw = doc.mainImage || (doc.images && doc.images.length > 0 ? doc.images[0] : null);
    if (!imgRaw) return;
    const img = normalizeOrderItemImageUrl(imgRaw) || imgRaw;
    if (doc.barcode) productImageMap.set(String(doc.barcode).trim(), img);
    if (doc.sku) productImageMap.set(String(doc.sku).trim(), img);
    if (doc.stockCode) productImageMap.set(String(doc.stockCode).trim(), img);
    if (doc.name) {
        const normalizedName = String(doc.name).trim().toLowerCase();
        if (!productNameImageMap.has(normalizedName)) {
            productNameImageMap.set(normalizedName, img);
        }
    }
};

/** Sipariş sayfası aynı anda 4 pazaryerine istek atınca Product+Mapping 4 kez taranmasın */
const orderProductImageCache = new Map();
const ORDER_PRODUCT_IMAGE_CACHE_MS = 50_000;

async function getCachedProductImageMapsForOrders(userId) {
    const key = String(userId);
    const now = Date.now();
    const hit = orderProductImageCache.get(key);
    if (hit && now - hit.at < ORDER_PRODUCT_IMAGE_CACHE_MS) {
        return { productImageMap: hit.productImageMap, productNameImageMap: hit.productNameImageMap };
    }
    const [userProducts, userMappings] = await Promise.all([
        Product.find({ userId }).select("barcode sku stockCode images name mainImage").lean(),
        ProductMapping.find({ userId }).select("masterProduct").lean()
    ]);
    const productImageMap = new Map();
    const productNameImageMap = new Map();
    userProducts.forEach((p) => fillOrderProductImageMaps(productImageMap, productNameImageMap, p));
    userMappings.forEach((m) => {
        if (m.masterProduct) fillOrderProductImageMaps(productImageMap, productNameImageMap, m.masterProduct);
    });
    orderProductImageCache.set(key, { at: now, productImageMap, productNameImageMap });
    return { productImageMap, productNameImageMap };
}

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
    const [products, mappingDocs] = await Promise.all([
        Product.find({ userId }).select("barcode sku stockCode images costPrice commissionRate shippingCost packagingCost otherCost category mainImage name").lean(),
        ProductMapping.find({ userId }).select("masterProduct").lean()
    ]);
    const productMap = new Map();
    const skuMap = new Map();

    products.forEach(p => {
        const barcode = String(p.barcode || "").trim();
        const sku = String(p.sku || "").trim();
        const stockCode = String(p.stockCode || "").trim();
        if (barcode) productMap.set(barcode, p);
        if (sku) skuMap.set(sku, p);
        if (stockCode) skuMap.set(stockCode, p);
    });
    mappingDocs.forEach((m) => {
        const mp = m.masterProduct;
        if (!mp) return;
        const barcode = String(mp.barcode || "").trim();
        const sku = String(mp.sku || "").trim();
        const stockCode = String(mp.stockCode || "").trim();
        if (barcode && !productMap.has(barcode)) productMap.set(barcode, mp);
        if (sku && !skuMap.has(sku)) skuMap.set(sku, mp);
        if (stockCode && !skuMap.has(stockCode)) skuMap.set(stockCode, mp);
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
                    const sku = String(item.sku || item.merchantSku || "").trim();
                    const name = String(item.productName || item.name || item.title || "").trim().toLowerCase();

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

                // ── Pazaryeri fatura durumunu mevcut siparişe yansıt ───────────
                // X kullanıcı LysiaETIC'ten önce / sonra panel üzerinden fatura yüklediyse
                // Trendyol bir sonraki sync'te invoiceLink + status="Invoiced" döndürüyor.
                // Bu bilgiyi mükerrer fatura engeli için Order'a yazıyoruz.
                try {
                    const newStatusRaw = String(order.status || "").trim();
                    const newStatusLower = newStatusRaw.toLowerCase();
                    const newInvoiceLink = String(order.invoiceLink || "").trim();
                    const newStatusSaysInvoiced = newStatusLower === "invoiced"
                        || newStatusLower === "faturalandı"
                        || newStatusLower === "faturalandi";
                    const newMarketplaceInvoiced = newInvoiceLink.length > 0 || newStatusSaysInvoiced;
                    const newSource = newInvoiceLink.length > 0
                        ? "marketplace_api"
                        : (newStatusSaysInvoiced ? "marketplace_status" : "");

                    let invoiceChanged = false;
                    // Sadece "bilgi geliştiren" yönde güncelle — daha önce true ise false yapmıyoruz
                    if (newMarketplaceInvoiced && !exists.marketplaceInvoiced) {
                        exists.marketplaceInvoiced = true;
                        invoiceChanged = true;
                    }
                    if (newInvoiceLink && exists.invoiceUrl !== newInvoiceLink) {
                        exists.invoiceUrl = newInvoiceLink;
                        invoiceChanged = true;
                    }
                    if (newSource && exists.invoiceSource !== newSource) {
                        // marketplace_api her zaman marketplace_status'tan üstün; downgrade yapma
                        if (!(exists.invoiceSource === "marketplace_api" && newSource === "marketplace_status")) {
                            exists.invoiceSource = newSource;
                            invoiceChanged = true;
                        }
                    }
                    if (newStatusRaw && exists.status !== newStatusRaw) {
                        exists.status = newStatusRaw;
                        invoiceChanged = true;
                    }
                    if (order.commercialInvoice && !exists.commercialInvoice) {
                        exists.commercialInvoice = true;
                        invoiceChanged = true;
                    }
                    if (order.etgbNo && exists.etgbNo !== order.etgbNo) {
                        exists.etgbNo = order.etgbNo;
                        invoiceChanged = true;
                    }
                    if (order.etgbDate) {
                        const dt = Number.isFinite(Number(order.etgbDate))
                            ? new Date(Number(order.etgbDate))
                            : new Date(order.etgbDate);
                        if (!isNaN(dt.getTime()) && (!exists.etgbDate || exists.etgbDate.getTime() !== dt.getTime())) {
                            exists.etgbDate = dt;
                            invoiceChanged = true;
                        }
                    }
                    if (invoiceChanged) {
                        exists.invoiceCheckedAt = new Date();
                        await exists.save();
                        logger.info(`[OrderSync] ${marketplaceName}: ${orderNumber} fatura bilgisi güncellendi (source=${exists.invoiceSource}, link=${exists.invoiceUrl ? "var" : "yok"})`);
                    }
                } catch (invSyncErr) {
                    logger.warn(`[OrderSync] ${marketplaceName}: ${orderNumber} fatura sync hatası: ${invSyncErr.message}`);
                }

                skipped++; 
                continue; 
            }

            // Siparis kalemlerini normalize et
            const rawItems = order.products || order.items || order.lines || [];
            const invoiceAmount = parseFloat(order.invoiceAmount || 0) || 0;
            const grossOrderAmount = parseFloat(order.grossOrderAmount || 0) || 0;
            const sellerDiscountTotal = parseFloat(order.sellerDiscountTotal || 0) || 0;
            const tyDiscountTotal = parseFloat(order.tyDiscountTotal || 0) || 0;
            const orderTotalPrice = parseFloat(order.totalPrice || 0);
            const allocBase = grossOrderAmount > 0 ? grossOrderAmount : orderTotalPrice;
            const totalItemCount = rawItems.length || 1;
            let items = rawItems.map(function(item, itemIdx) {
                const barcode = String(item.barcode || item.sku || item.merchantSku || item.productCode || item.productId || "").trim();
                const sku = String(item.sku || item.merchantSku || item.productCode || "").trim();
                
                // Barcode bos ise fallback olustur (Order modeli barcode required)
                const finalBarcode = barcode || ("SYNC-" + orderNumber + "-" + itemIdx);
                const itemName = String(item.productName || item.name || item.title || "").trim().toLowerCase();
                const productInfo = productMap.get(barcode) || skuMap.get(sku) || skuMap.get(barcode) || productMap.get(sku) || Array.from(products).find(p => String(p.name || "").trim().toLowerCase() === itemName) || {};
                
                // Fiyat: item.price > 0 ise onu kullan, yoksa brüt veya sipariş tutarını kalemlere böl
                let price = parseFloat(item.price || item.unitPrice || 0);
                if (price === 0 && allocBase > 0) {
                    price = allocBase / totalItemCount;
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
                    sku: sku,
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
                const fallbackAmt = orderTotalPrice || allocBase;
                items.push({
                    productName: order.productName || "Siparis Urunu",
                    quantity: 1,
                    barcode: "SYNC-" + orderNumber + "-0",
                    sku: "",
                    price: fallbackAmt,
                    category: "Bilinmiyor",
                    costPrice: 0,
                    commissionRate: 0,
                    commissionAmount: 0,
                    shippingCost: 0,
                    netProfit: fallbackAmt
                });
            }

            // Trendyol: kalem fiyatları brüt ise, faturalanacak nete orantılı ölçekle (kâr özeti ile uyum)
            const lineSumGross = items.reduce(function(sum, it) { return sum + (it.price * it.quantity); }, 0);
            if (invoiceAmount > 0 && lineSumGross > 0.001 && Math.abs(lineSumGross - invoiceAmount) > 0.02) {
                const scale = invoiceAmount / lineSumGross;
                items = items.map(function(it) {
                    const newPrice = Math.round(it.price * scale * 10000) / 10000;
                    const qty = it.quantity;
                    const scaledComm = Math.round(it.commissionAmount * scale * 10000) / 10000;
                    const totalCost = (it.costPrice * qty) + scaledComm + it.shippingCost;
                    const netProfit = (newPrice * qty) - totalCost;
                    return Object.assign({}, it, {
                        price: newPrice,
                        commissionAmount: scaledComm,
                        netProfit: netProfit
                    });
                });
            }

            // Siparis seviyesi maliyet ozeti hesapla
            const totalPrice = (invoiceAmount > 0 ? invoiceAmount : parseFloat(order.totalPrice || 0)) || items.reduce(function(sum, it) { return sum + (it.price * it.quantity); }, 0);
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
            // Trendyol: status "Invoiced" VEYA invoiceLink dolu ise pazaryerinde fatura kesilmiş
            // Hepsiburada/N11/ÇiçekSepeti: status'a göre kontrol (API invoiceLink döndürmüyor)
            const statusLower = status.toLowerCase();
            const tyInvoiceLink = String(order.invoiceLink || "").trim();
            const hasMarketplaceInvoiceLink = tyInvoiceLink.length > 0;
            const statusSaysInvoiced = statusLower === "invoiced"
                || statusLower === "faturalandı"
                || statusLower === "faturalandi";
            const marketplaceInvoiced = hasMarketplaceInvoiceLink
                || statusSaysInvoiced
                || (order.invoiceNumber && order.invoiceNumber !== "")
                || false;
            // Hangi kaynaktan fatura tespit ettik? (Operasyon Defteri ve UI rozeti için)
            // hasMarketplaceInvoiceLink → marketplace_api (en güçlü sinyal, PDF URL var)
            // statusSaysInvoiced       → marketplace_status (status sinyali, link yok)
            const marketplaceInvoiceSource = hasMarketplaceInvoiceLink
                ? "marketplace_api"
                : (statusSaysInvoiced ? "marketplace_status" : "");
            // ETGB tarihi parse (Trendyol unix ms döndürüyor)
            const etgbDateParsed = order.etgbDate
                ? (Number.isFinite(Number(order.etgbDate))
                    ? new Date(Number(order.etgbDate))
                    : new Date(order.etgbDate))
                : null;
            const etgbDateValid = etgbDateParsed && !isNaN(etgbDateParsed.getTime()) ? etgbDateParsed : null;

            // ── Teslimat ülkesi (mikro ihracat tespiti) ──────────────────
            const rawShipAddrForCountry = order.shipmentAddress || order.shippingAddress || order.address || {};
            const shippingCountry = rawShipAddrForCountry.country
                || rawShipAddrForCountry.countryCode
                || order.shippingCountry
                || "Turkiye";

            // Siparis tarihi: tek kaynak parseMarketplaceOrderDateToUtcDate (epoch / ISO / HB / TR / N11)
            let orderDate =
                parseMarketplaceOrderDateToUtcDate(order.orderDateRaw != null ? order.orderDateRaw : order.orderDate) ||
                parseMarketplaceOrderDateToUtcDate(order.orderDate);
            if (!orderDate || isNaN(orderDate.getTime())) orderDate = new Date();

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
                grossOrderAmount: grossOrderAmount,
                sellerDiscountTotal: sellerDiscountTotal,
                tyDiscountTotal: tyDiscountTotal,
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
                invoiceUrl: tyInvoiceLink || "",
                invoiceSource: marketplaceInvoiceSource,
                invoiceCheckedAt: new Date(),
                commercialInvoice: !!order.commercialInvoice,
                etgbNo: order.etgbNo || "",
                etgbDate: etgbDateValid || undefined,
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
        const defaultStartDate = now - ORDER_DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
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
                    orderDate: marketplaceOrderDateToIsoString(order.PurchaseDate) || (order.PurchaseDate ? new Date(order.PurchaseDate).toISOString() : ""),
                    orderDateRaw: order.PurchaseDate,
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
        const { productImageMap, productNameImageMap } = await getCachedProductImageMapsForOrders(userId);

        orders = rawOrders.map(order => {
            let processedProducts = (order.products || []).map(p => {
                const barcode = String(p.barcode || "").trim();
                const sku = String(p.sku || p.merchantSku || p.stockCode || "").trim();
                const name = String(p.productName || p.name || p.title || "").trim().toLowerCase();
                
                // Öncelik: Barkod/SKU eşleşmesi -> İsim eşleşmesi
                const stockImg = productImageMap.get(barcode) || productImageMap.get(sku) || productNameImageMap.get(name);
                const lineImg = normalizeOrderItemImageUrl(p.imageUrl || p.image || "");

                if (stockImg) {
                    p.imageUrl = stockImg;
                } else if (lineImg && !lineImg.includes("default-product.jpg") && !lineImg.includes("placehold.co")) {
                    p.imageUrl = lineImg;
                } else {
                    p.imageUrl = "https://placehold.co/400x400/1e293b/4ecdc4?text=Urun";
                }
                return p;
            });

            const invoiceHint = parseFloat(order.invoiceAmount || order.totalPrice || 0) || 0;
            const lineSumPre = processedProducts.reduce((sum, p) => {
                const price = parseFloat(p.price || p.unitPrice || p.amount || 0);
                const qty = parseInt(p.quantity || 1);
                return sum + (price * qty);
            }, 0);
            if (invoiceHint > 0 && lineSumPre > 0.001 && Math.abs(lineSumPre - invoiceHint) > 0.02) {
                const sc = invoiceHint / lineSumPre;
                processedProducts = processedProducts.map(p => {
                    const pr = parseFloat(p.price || p.unitPrice || p.amount || 0);
                    return Object.assign({}, p, { price: Math.round(pr * sc * 10000) / 10000 });
                });
            }

            let total = parseFloat(order.totalPrice) || 0;
            if (total === 0 && processedProducts.length > 0) {
                total = processedProducts.reduce((sum, p) => {
                    const price = parseFloat(p.price || p.unitPrice || p.amount || 0);
                    const qty = parseInt(p.quantity || 1);
                    return sum + (price * qty);
                }, 0);
            }

            const firstImg = processedProducts[0]?.imageUrl || order.imageUrl;

            const dateIso =
                marketplaceOrderDateToIsoString(order.orderDateRaw != null ? order.orderDateRaw : order.orderDate) ||
                marketplaceOrderDateToIsoString(order.orderDate);

            return {
                orderNumber: order.orderNumber,
                orderDate: dateIso || order.orderDate,
                orderDateRaw: order.orderDateRaw,
                customerName: order.customerName,
                totalPrice: total > 0 ? total.toFixed(2) : (order.totalPrice || "0.00"),
                grossOrderAmount: order.grossOrderAmount,
                sellerDiscountTotal: order.sellerDiscountTotal,
                tyDiscountTotal: order.tyDiscountTotal,
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

        const [orders, total, userProducts, userMappings] = await Promise.all([
            Order.find(filter)
                .select("trackingNumber marketplaceName customerName totalPrice orderDate status invoiceId invoiceNumber invoiceStatus items isReturned isCancelled marketplaceInvoiced invoiceUrl invoiceSource invoiceCheckedAt commercialInvoice etgbNo etgbDate")
                .populate("invoiceId", "invoiceNumber uuid status faturaURL issueDate")
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter),
            Product.find({ userId }).select("barcode sku stockCode images name mainImage").lean(),
            ProductMapping.find({ userId }).select("masterProduct").lean()
        ]);

        // Ürün görsel haritası oluştur (barkod/sku/isim -> görsel)
        const productImageMap = new Map();
        const productNameImageMap = new Map();

        userProducts.forEach((p) => fillOrderProductImageMaps(productImageMap, productNameImageMap, p));
        userMappings.forEach((m) => {
            if (m.masterProduct) fillOrderProductImageMaps(productImageMap, productNameImageMap, m.masterProduct);
        });

        // ✅ CANLI API GÖRSEL ZENGİNLEŞTİRME: getAllOrders'dan gelen veriler için de haritayı kullanabiliriz
        // Ancak bu fonksiyon req/res döner, biz burada sadece DB'dekileri döndürüyoruz.

        // Fatura istatistikleri
        // ✅ FIX 1: "error" ve "pending" durumundaki siparişleri "faturasız" olarak sayma
        // ✅ FIX 2: Pazaryerinde zaten faturalı (Trendyol invoiceLink / status="Invoiced")
        //         siparişler de "faturalı" sayılır — X kullanıcı senaryosu için kritik
        const [totalOrders, invoicedCount, marketplaceOnlyInvoicedCount, uninvoicedCount, errorCount] = await Promise.all([
            Order.countDocuments({ user: userId }),
            Order.countDocuments({
                user: userId,
                $or: [
                    { invoiceId: { $exists: true } },
                    { marketplaceInvoiced: true },
                ],
            }),
            // Sadece pazaryeri tarafı faturalı (LysiaETIC bizden bir fatura kesmedi)
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                marketplaceInvoiced: true,
            }),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                marketplaceInvoiced: { $ne: true },
                invoiceStatus: { $nin: ["created", "pending", "error"] },
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
            }),
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
                const sku = String(item.sku || item.merchantSku || item.stockCode || "").trim();
                const name = String(item.productName || item.name || item.title || "").trim().toLowerCase();
                
                // Öncelik: Barkod/SKU eşleşmesi -> İsim eşleşmesi
                const stockImg = productImageMap.get(barcode) || productImageMap.get(sku) || productNameImageMap.get(name);
                const lineImg = normalizeOrderItemImageUrl(item.imageUrl || "");

                let itemImg;
                if (stockImg) {
                    itemImg = stockImg;
                } else if (lineImg && !lineImg.includes("default-product.jpg") && !lineImg.includes("placehold.co")) {
                    itemImg = lineImg;
                } else {
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
                grossOrderAmount: o.grossOrderAmount || 0,
                sellerDiscountTotal: o.sellerDiscountTotal || 0,
                tyDiscountTotal: o.tyDiscountTotal || 0,
                orderDate: o.orderDate
                    ? marketplaceOrderDateToIsoString(o.orderDate) || new Date(o.orderDate).toISOString()
                    : o.orderDate,
                status: o.status || "",
                invoiceStatus: o.invoiceStatus || (invoiceInfo ? "created" : ""),
                invoice: invoiceInfo,
                // Pazaryerinden gelen fatura bilgileri (X kullanıcı senaryosu için kritik)
                marketplaceInvoiced: !!o.marketplaceInvoiced,
                invoiceUrl: o.invoiceUrl || "",
                invoiceSource: o.invoiceSource || "",
                invoiceCheckedAt: o.invoiceCheckedAt || null,
                commercialInvoice: !!o.commercialInvoice,
                etgbNo: o.etgbNo || "",
                etgbDate: o.etgbDate || null,
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
        const defaultStartDate = now - ORDER_DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000; // env veya 7 gün
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
