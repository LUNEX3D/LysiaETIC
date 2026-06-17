const Marketplace = require("../models/Marketplace");
const { normalizeMarketplaceName } = Marketplace;
const {
    fetchMarketplaceOrders,
    syncAllMarketplacesForUser,
    getIstanbulTimestamp: syncGetIstanbulTimestamp,
} = require("../services/orderSyncService");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductMapping = require("../models/ProductMapping");
const AuditLog = require("../models/AuditLog");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { processAutoInvoice } = require("../services/autoInvoiceService");
const { updateStockAfterOrder } = require("../services/stockSyncService");
const { parseMarketplaceOrderDateToUtcDate, marketplaceOrderDateToIsoString } = require("../utils/helpers");

const getIstanbulTimestamp = syncGetIstanbulTimestamp;

/** Sipariş listesi / toplu sync: query'de tarih yoksa varsayılan pencere (gün). Env: ORDER_DEFAULT_WINDOW_DAYS */
const ORDER_DEFAULT_WINDOW_DAYS = Math.min(
    365,
    Math.max(1, parseInt(process.env.ORDER_DEFAULT_WINDOW_DAYS || "7", 10) || 7)
);

/** Ana sayfa arka plan sync — kısa pencere (gün). Env: DASHBOARD_SYNC_WINDOW_DAYS */
const DASHBOARD_SYNC_WINDOW_DAYS = Math.min(
    14,
    Math.max(1, parseInt(process.env.DASHBOARD_SYNC_WINDOW_DAYS || "7", 10) || 7)
);

const resolveSyncWindowDays = (req) => {
    if (req.query.startDate || req.query.endDate) return ORDER_DEFAULT_WINDOW_DAYS;
    const raw = parseInt(req.query.days, 10);
    if (!Number.isNaN(raw) && raw > 0) {
        return Math.min(14, Math.max(1, raw));
    }
    return ORDER_DEFAULT_WINDOW_DAYS;
};

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
const ORDER_PRODUCT_IMAGE_CACHE_MS = parseInt(
    process.env.ORDER_PRODUCT_IMAGE_CACHE_MS || "300000",
    10
);

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

const orderInvoiceStatsCache = new Map();

async function getCachedInvoiceStatsForOrders(userId) {
    const key = String(userId);
    const now = Date.now();
    const hit = orderInvoiceStatsCache.get(key);
    if (hit && now - hit.at < ORDER_PRODUCT_IMAGE_CACHE_MS) {
        return hit.stats;
    }
    const stats = await (async () => {
        const [totalOrders, invoicedCount, marketplaceOnlyInvoicedCount, uninvoicedCount, errorCount] =
            await Promise.all([
                Order.countDocuments({ user: userId }),
                Order.countDocuments({
                    user: userId,
                    $or: [{ invoiceId: { $exists: true } }, { marketplaceInvoiced: true }],
                }),
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
        return {
            total: totalOrders,
            invoiced: invoicedCount,
            marketplaceOnlyInvoiced: marketplaceOnlyInvoicedCount,
            uninvoiced: uninvoicedCount,
            error: errorCount,
        };
    })();
    orderInvoiceStatsCache.set(key, { at: now, stats });
    return stats;
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

    const {
        buildProductEconomicsIndex,
        resolveLineEconomics,
        economicsToOrderItemFields,
        resolveFromIndex,
        rowFromLegacyProduct,
    } = require("../utils/productEconomicsLookup");
    const economicsIndex = await buildProductEconomicsIndex(userId);
    const products = await Product.find({ userId })
        .select("barcode sku stockCode images costPrice commissionRate shippingCost packagingCost otherCost category mainImage name")
        .lean();

    const { resolveHepsiburadaOrderKey, isHbInternalId } = require("../services/hepsiburadaService");
    const { collectOrderMatchClauses } = require("../utils/orderMatchKeys");
    const { findPriorEmailSentOrder, markEmailSentInherited } = require("../services/orderNotificationService");
    const { normalizeMarketplaceName } = require("../models/Marketplace");
    const mpNorm = String(marketplaceName || "").toLowerCase();
    const isHepsiburadaMp = mpNorm.includes("hepsi");
    const mpCanonical = normalizeMarketplaceName(marketplaceName);
    const { pickPreferredOrderRecord, resolveBestOrderStatus, classifyOrderStatus } = require("../utils/orderStatus");

    const applyOrderStatus = (doc, rawStatus, mpName) => {
        const merged = resolveBestOrderStatus(doc.status, rawStatus, mpName);
        doc.status = merged;
        doc.statusBucket = classifyOrderStatus(merged);
    };

    const isCiceksepetiMp = /cicek|çiçek/i.test(mpCanonical);

    for (const order of rawOrders) {
        try {
            let orderNumber;
            let tracking;
            if (isCiceksepetiMp) {
                const parentNo = String(order.orderNumber || order.orderId || order.packageNumber || "").trim();
                const itemId = String(order.orderItemId || "").trim();
                orderNumber = parentNo || itemId;
                // CS: benzersiz anahtar orderItemId — parent orderId ile karışmasın
                tracking = itemId || parentNo;
                if (parentNo && !order.packageNumber) order.packageNumber = parentNo;
            } else if (isHepsiburadaMp) {
                orderNumber = resolveHepsiburadaOrderKey(order, null) || order.orderNumber;
                const pkgNo = String(order.packageNumber || "").trim();
                tracking =
                    pkgNo && !isHbInternalId(pkgNo) ? pkgNo : String(orderNumber);
            } else {
                orderNumber = order.orderNumber || order.id;
                tracking = String(orderNumber);
            }

            if (!orderNumber || !tracking || (isHepsiburadaMp && isHbInternalId(orderNumber))) {
                skipped++;
                continue;
            }
            const apiStatus = String(order.status || "").trim();

            // Aynı sipariş (büyük/küçük harf marketplace farkı dahil)
            let exists = await Order.findOne({
                user: userId,
                trackingNumber: tracking,
                marketplaceName: mpCanonical,
            });
            if (!exists && isCiceksepetiMp) {
                const parentNo = String(order.packageNumber || order.orderNumber || "").trim();
                const itemId = String(order.orderItemId || "").trim();
                const orClauses = [];
                if (itemId) orClauses.push({ orderItemId: itemId }, { trackingNumber: itemId });
                if (parentNo) orClauses.push({ packageNumber: parentNo }, { trackingNumber: parentNo });
                if (orClauses.length) {
                    exists = await Order.findOne({
                        user: userId,
                        marketplaceName: mpCanonical,
                        $or: orClauses,
                    }).sort({ updatedAt: -1 });
                    if (exists && itemId && exists.trackingNumber !== itemId) {
                        exists.trackingNumber = itemId;
                        exists.orderItemId = itemId;
                        if (parentNo && !exists.packageNumber) exists.packageNumber = parentNo;
                        await exists.save();
                    }
                }
            }
            if (!exists && isHepsiburadaMp) {
                const orClauses = collectOrderMatchClauses(order, {
                    orderNumber,
                    tracking,
                    isHepsiburada: true,
                });
                if (orClauses.length) {
                    exists = await Order.findOne({
                        user: userId,
                        marketplaceName: mpCanonical,
                        $or: orClauses,
                    }).sort({ updatedAt: -1 });
                    if (exists) {
                        const merchantNo = String(orderNumber || "").trim();
                        const pkgNo = String(order.packageNumber || "").trim();
                        let needsKeyFix = false;
                        if (merchantNo && !isHbInternalId(merchantNo) && exists.trackingNumber !== merchantNo && isHbInternalId(exists.trackingNumber)) {
                            exists.trackingNumber = merchantNo;
                            needsKeyFix = true;
                        } else if (pkgNo && !isHbInternalId(pkgNo) && exists.trackingNumber !== pkgNo && !exists.packageNumber) {
                            exists.packageNumber = pkgNo;
                            needsKeyFix = true;
                        }
                        if (needsKeyFix) await exists.save();
                    }
                }
            }
            if (!exists) {
                const escaped = String(marketplaceName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                exists = await Order.findOne({
                    user: userId,
                    trackingNumber: tracking,
                    marketplaceName: { $regex: new RegExp(`^${escaped}$`, "i") },
                }).sort({ updatedAt: -1 });
            }

            const dupeQuery = {
                user: userId,
                marketplaceName: { $regex: new RegExp(`^${String(marketplaceName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
            };
            if (isHepsiburadaMp || isCiceksepetiMp) {
                const dupeOr = collectOrderMatchClauses(order, {
                    orderNumber,
                    tracking,
                    isHepsiburada: isHepsiburadaMp,
                    isCiceksepeti: isCiceksepetiMp,
                });
                if (dupeOr.length) dupeQuery.$or = dupeOr;
                else dupeQuery.trackingNumber = tracking;
            } else {
                dupeQuery.trackingNumber = tracking;
            }
            const dupes = await Order.find(dupeQuery).sort({ updatedAt: -1 });

            if (dupes.length > 1) {
                let keeper = dupes[0];
                for (let d = 1; d < dupes.length; d++) {
                    const preferred = pickPreferredOrderRecord(
                        {
                            status: keeper.status,
                            marketplaceName: keeper.marketplaceName,
                            orderDate: keeper.orderDate,
                            updatedAt: keeper.updatedAt,
                        },
                        {
                            status: dupes[d].status,
                            marketplaceName: dupes[d].marketplaceName,
                            orderDate: dupes[d].orderDate,
                            updatedAt: dupes[d].updatedAt,
                        }
                    );
                    keeper = preferred === dupes[d] ? dupes[d] : keeper;
                }
                exists = keeper;
                for (const doc of dupes) {
                    if (doc._id.toString() !== keeper._id.toString()) {
                        await Order.deleteOne({ _id: doc._id });
                    }
                }
            }

            if (exists) {
                let needsUpdate = false;

                if (apiStatus) {
                    const prevStatus = exists.status;
                    const prevBucket = exists.statusBucket;
                    applyOrderStatus(exists, apiStatus, mpCanonical);
                    if (exists.status !== prevStatus || exists.statusBucket !== prevBucket) {
                        exists.marketplaceName = mpCanonical;
                        needsUpdate = true;
                    }
                }
                if (isHepsiburadaMp && isHbInternalId(exists.trackingNumber) && !isHbInternalId(orderNumber)) {
                    exists.trackingNumber = String(orderNumber);
                    needsUpdate = true;
                }
                // ✅ MEVCUT SİPARİŞİ GÜNCELLE: Eksik görsel varsa Product modelinden zenginleştir
                const updatedItems = exists.items.map((item) => {
                    const barcode = String(item.barcode || "").trim();
                    const sku = String(item.sku || item.merchantSku || "").trim();
                    const name = String(item.productName || item.name || item.title || "")
                        .trim()
                        .toLowerCase();

                    let productInfo = resolveFromIndex(economicsIndex, {
                        barcode,
                        sku,
                        productName: item.productName || item.name,
                    });
                    if (!productInfo.mappingFound) {
                        productInfo =
                            Array.from(products).find(
                                (p) => String(p.name || "").trim().toLowerCase() === name
                            ) || productInfo;
                    }

                    if (productInfo) {
                        const stockImage =
                            productInfo.mainImage ||
                            (productInfo.images && productInfo.images[0]);
                        const isInvalid =
                            !item.imageUrl ||
                            item.imageUrl.includes("default-product.jpg") ||
                            item.imageUrl.includes("placehold.co");
                        if (stockImage && (isInvalid || item.imageUrl !== stockImage)) {
                            needsUpdate = true;
                            item.imageUrl = stockImage;
                        }
                    }

                    const needsEcon =
                        (Number(item.costPrice) || 0) < 0.01 ||
                        (Number(item.commissionAmount) || 0) < 0.01;
                    if (needsEcon) {
                        const econ = resolveLineEconomics(
                            item,
                            marketplaceName,
                            economicsIndex,
                            { allowDefaultCommission: false }
                        );
                        if (
                            econ.costPrice > 0 ||
                            econ.commissionAmount > 0 ||
                            econ.shippingCost > 0
                        ) {
                            needsUpdate = true;
                            Object.assign(item, economicsToOrderItemFields(econ, item));
                        }
                    }
                    return item;
                });

                if (needsUpdate) {
                    exists.items = updatedItems;
                    const totalPrice = updatedItems.reduce(
                        (s, it) => s + (Number(it.price) || 0) * (it.quantity || 1),
                        0
                    );
                    const totalCost = updatedItems.reduce(
                        (s, it) => s + (Number(it.costPrice) || 0) * (it.quantity || 1),
                        0
                    );
                    const totalCommission = updatedItems.reduce(
                        (s, it) => s + (Number(it.commissionAmount) || 0),
                        0
                    );
                    const totalShipping = updatedItems.reduce(
                        (s, it) => s + (Number(it.shippingCost) || 0),
                        0
                    );
                    const netProfit = updatedItems.reduce(
                        (s, it) => s + (Number(it.netProfit) || 0),
                        0
                    );
                    exists.costSummary = {
                        totalPrice,
                        totalCost,
                        totalCommission,
                        totalShipping,
                        netProfit,
                    };
                    await exists.save();
                    logger.info(`[OrderSync] ${marketplaceName}: ${orderNumber} kalem/görsel güncellendi`);
                }

                // ── Pazaryeri fatura durumunu mevcut siparişe yansıt ───────────
                // X kullanıcı LysiaETIC'ten önce / sonra panel üzerinden fatura yüklediyse
                // Trendyol bir sonraki sync'te invoiceLink + status="Invoiced" döndürüyor.
                // Bu bilgiyi mükerrer fatura engeli için Order'a yazıyoruz.
                try {
                    const newStatusRaw = apiStatus;
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
                    if (newStatusRaw) {
                        const prevStatus = exists.status;
                        applyOrderStatus(exists, newStatusRaw, mpCanonical);
                        if (exists.status !== prevStatus) {
                            invoiceChanged = true;
                        }
                    }
                    const cargoCo = String(order.cargoCompany || order.cargoProviderName || "").trim();
                    const cargoTn = String(
                        order.cargoTrackingNumber != null && order.cargoTrackingNumber !== ""
                            ? order.cargoTrackingNumber
                            : order.trackingNumber || ""
                    ).trim();
                    const pkgNo = String(order.packageNumber || "").trim();
                    const shipPkgId = String(order.shipmentPackageId || order.packageId || "").trim();
                    if (cargoCo && exists.cargoCompany !== cargoCo) { exists.cargoCompany = cargoCo; invoiceChanged = true; }
                    if (cargoTn && exists.cargoTrackingNumber !== cargoTn) { exists.cargoTrackingNumber = cargoTn; invoiceChanged = true; }
                    if (pkgNo && exists.packageNumber !== pkgNo) { exists.packageNumber = pkgNo; invoiceChanged = true; }
                    if (shipPkgId && exists.shipmentPackageId !== shipPkgId) { exists.shipmentPackageId = shipPkgId; invoiceChanged = true; }
                    const orderItemId = String(order.orderItemId || "").trim();
                    if (orderItemId && exists.orderItemId !== orderItemId) {
                        exists.orderItemId = orderItemId;
                        invoiceChanged = true;
                    }
                    const cargoLink = String(order.cargoTrackingLink || "").trim();
                    if (cargoLink && exists.cargoTrackingLink !== cargoLink) {
                        exists.cargoTrackingLink = cargoLink;
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
                        const wasUninvoiced = !exists.marketplaceInvoiced && newMarketplaceInvoiced;
                        exists.invoiceCheckedAt = new Date();
                        await exists.save();
                        logger.info(`[OrderSync] ${marketplaceName}: ${orderNumber} fatura bilgisi güncellendi (source=${exists.invoiceSource}, link=${exists.invoiceUrl ? "var" : "yok"})`);
                        // Operasyon Defteri'ne yansıt: faturasızdan faturalıya geçiş kullanıcı için önemli
                        if (wasUninvoiced) {
                            try {
                                await AuditLog.create({
                                    userId,
                                    action: "marketplace_invoice_detected",
                                    category: "marketplace",
                                    severity: "info",
                                    description: `${marketplaceName} sipariş ${orderNumber} için pazaryerinden fatura tespit edildi (${exists.invoiceSource === "marketplace_api" ? "PDF link mevcut" : "Faturalandı durumu"}).`,
                                    metadata: {
                                        marketplace: marketplaceName,
                                        orderNumber: String(orderNumber),
                                        orderId: exists._id,
                                        invoiceSource: exists.invoiceSource,
                                        hasInvoiceUrl: !!exists.invoiceUrl,
                                        invoiceUrl: exists.invoiceUrl || "",
                                    },
                                    success: true,
                                });
                            } catch (auditErr) {
                                logger.warn(`[OrderSync] AuditLog yazılamadı: ${auditErr.message}`);
                            }
                        }
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
                const itemName = String(item.productName || item.name || item.title || "").trim().toLowerCase();
                let productInfo = resolveFromIndex(economicsIndex, {
                    barcode,
                    sku,
                    productName: item.productName || item.name || item.title,
                });
                if (!productInfo.mappingFound) {
                    const byName = Array.from(products).find(
                        (p) => String(p.name || "").trim().toLowerCase() === itemName
                    );
                    if (byName) productInfo = { ...rowFromLegacyProduct(byName), mappingFound: true };
                }

                let finalBarcodeResolved = barcode;
                if (!finalBarcodeResolved && productInfo.masterBarcode) {
                    finalBarcodeResolved = productInfo.masterBarcode;
                }
                if (!finalBarcodeResolved && productInfo.masterSku) {
                    finalBarcodeResolved = productInfo.masterSku;
                }
                const finalBarcode =
                    finalBarcodeResolved || ("SYNC-" + orderNumber + "-" + itemIdx);

                let price = parseFloat(item.price || item.unitPrice || 0);
                if (price === 0 && allocBase > 0) {
                    price = allocBase / totalItemCount;
                }
                const quantity = parseInt(item.quantity || 1);

                let imageUrl = item.imageUrl || item.image || "";
                const stockImage =
                    productInfo.mainImage || (productInfo.images && productInfo.images[0]);
                if (stockImage) {
                    imageUrl = stockImage;
                } else {
                    if (
                        imageUrl.includes("default-product.jpg") ||
                        imageUrl.includes("placehold.co")
                    ) {
                        imageUrl = "";
                    }
                    if (!imageUrl) {
                        imageUrl =
                            "https://placehold.co/400x400/1e293b/4ecdc4?text=Urun";
                    }
                }

                const draftItem = {
                    productName:
                        item.productName || item.name || item.title || "Bilinmeyen",
                    quantity,
                    barcode: finalBarcode,
                    sku,
                    price,
                    costPrice: item.costPrice,
                    commissionRate: item.commissionRate,
                    commissionAmount: item.commissionAmount,
                    shippingCost: item.shippingCost,
                };
                const apiCommission = parseFloat(item.commissionAmount || 0);
                const econ = resolveLineEconomics(
                    { ...draftItem, commissionAmount: apiCommission > 0 ? apiCommission : 0 },
                    marketplaceName,
                    economicsIndex,
                    { allowDefaultCommission: false }
                );
                const fields = economicsToOrderItemFields(econ, draftItem);

                return {
                    productName: draftItem.productName,
                    quantity,
                    barcode: finalBarcode,
                    sku,
                    imageUrl,
                    price,
                    category: item.category || productInfo.category || "Bilinmiyor",
                    costPrice: fields.costPrice,
                    commissionRate: fields.commissionRate,
                    commissionAmount: fields.commissionAmount,
                    shippingCost: fields.shippingCost,
                    netProfit: fields.netProfit,
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
            const mpLower = String(mpCanonical || marketplaceName || "").toLowerCase();
            const isCs = mpLower.includes("cicek") || mpLower.includes("çiçek");
            const { isCiceksepetiReturnStatus } = require("../utils/ciceksepetiOrders");
            const isReturned =
                !!order.isReturned ||
                isCiceksepetiReturnStatus(status) ||
                /return|refund|iade/i.test(status);
            const isCancelled =
                !!order.isCancelled || (/cancel|iptal/i.test(status) && !(isCs && /iade/i.test(status)));

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
                marketplaceName: mpCanonical,
                totalPrice: totalPrice,
                grossOrderAmount: grossOrderAmount,
                sellerDiscountTotal: sellerDiscountTotal,
                tyDiscountTotal: tyDiscountTotal,
                orderDate: orderDate,
                status: status,
                statusBucket: classifyOrderStatus(status, mpCanonical),
                trackingNumber: String(isCiceksepetiMp || isHepsiburadaMp ? tracking : orderNumber),
                cargoCompany: String(order.cargoCompany || order.cargoProviderName || "").trim(),
                cargoTrackingNumber: String(
                    order.cargoTrackingNumber != null && order.cargoTrackingNumber !== ""
                        ? order.cargoTrackingNumber
                        : order.trackingNumber || ""
                ).trim(),
                packageNumber: String(order.packageNumber || "").trim(),
                shipmentPackageId: String(order.shipmentPackageId || order.packageId || "").trim(),
                orderItemId: String(order.orderItemId || "").trim(),
                cargoTrackingLink: String(order.cargoTrackingLink || "").trim(),
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

            try {
                const priorEmail = await findPriorEmailSentOrder(userId, {
                    marketplaceName: mpCanonical,
                    trackingNumber: newOrder.trackingNumber,
                    packageNumber: newOrder.packageNumber,
                    orderItemId: newOrder.orderItemId,
                });
                if (priorEmail?.newOrderEmailSentAt) {
                    newOrder.newOrderEmailSentAt = priorEmail.newOrderEmailSentAt;
                }
            } catch (_) { /* optional */ }

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

    try {
        const stale = await Order.find({
            user: userId,
            $or: [{ statusBucket: { $exists: false } }, { statusBucket: "" }, { statusBucket: null }],
        })
            .select("_id status marketplaceName")
            .limit(3000)
            .lean();
        if (stale.length > 0) {
            const bulk = stale.map((o) => ({
                updateOne: {
                    filter: { _id: o._id },
                    update: {
                        $set: {
                            statusBucket: classifyOrderStatus(o.status),
                        },
                    },
                },
            }));
            await Order.bulkWrite(bulk, { ordered: false });
        }
    } catch (bucketErr) {
        logger.warn(`[OrderSync] statusBucket backfill: ${bucketErr.message}`);
    }

    try {
        const { invalidateDashboardCache } = require("../services/dashboardService");
        invalidateDashboardCache(userId);
    } catch (_) { /* cache optional */ }

    // ── Anlık stok + otomatik fatura (arka plan) ───────────────────────────
    // Stok: processOrderStockLine + makeOrderStockKey ile cron ile aynı anahtar — çift düşüş yok
    if (syncedOrderIds.length > 0 && userId) {
        for (const oid of syncedOrderIds) {
            updateStockAfterOrder(oid).then((stockResults) => {
                const ok = (stockResults || []).filter((r) => r.status === "success" || r.status === "partial").length;
                if (ok > 0) {
                    logger.info(`[OrderSync] ${marketplaceName} anlık stok: sipariş ${oid} — ${ok} satır işlendi`);
                }
            }).catch((err) => {
                logger.warn(`[OrderSync] Anlık stok hatası (${oid}): ${err.message}`);
            });
        }

        processAutoInvoice(userId, marketplaceName, syncedOrderIds).then(invoiceStats => {
            if (invoiceStats.invoiced > 0) {
                logger.info("[AutoInvoice] " + marketplaceName + ": " + invoiceStats.invoiced + " otomatik fatura kesildi");
            }
        }).catch(err => {
            logger.warn("[AutoInvoice] Arka plan fatura hatası: " + err.message);
        });

        // ── Yeni sipariş: e-posta + uygulama içi bildirim (arka plan) ───────
        try {
            const { handleNewOrderNotifications } = require("../services/orderNotificationService");
            handleNewOrderNotifications(userId, syncedOrderIds).catch((err) => {
                logger.warn(`[OrderNotify] Bildirim gönderimi hatası: ${err.message}`);
            });
        } catch (notifyErr) {
            logger.warn(`[OrderNotify] Bildirim servisi yüklenemedi: ${notifyErr.message}`);
        }
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
        let convertedStartDate = startDate ? convertToGMT3Timestamp(startDate, true) : defaultStartDate;
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
        const credentials = decryptCredentials(integration.credentials);

        const isCsMp = /cicek|çiçek/i.test(String(marketplaceName || ""));
        if (isCsMp) {
            const csMinWindowMs = 14 * 24 * 60 * 60 * 1000;
            if (convertedEndDate - convertedStartDate < csMinWindowMs) {
                convertedStartDate = convertedEndDate - csMinWindowMs;
            }
        }
        const fetchResult = await fetchMarketplaceOrders(
            marketplaceName,
            credentials,
            convertedStartDate,
            convertedEndDate,
            { csExtended: isCsMp }
        );

        if (fetchResult.error === "Desteklenmeyen pazaryeri") {
            return res.status(400).json({
                error: "Unsupported marketplace!",
                supportedMarketplaces: ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon", "Ozon", "eBay"],
            });
        }

        if (fetchResult.authFailed) {
            return res.status(401).json({
                success: false,
                error: fetchResult.error || "Pazaryeri API yetkilendirme hatası",
                marketplace: marketplaceName,
            });
        }

        rawOrders = fetchResult.orders || [];
        if (rawOrders.length === 0 && fetchResult.error) {
            logger.warn(`[Orders] ${marketplaceName} boş yanıt — ${fetchResult.error}`);
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

            const cargoTn =
                order.cargoTrackingNumber != null && String(order.cargoTrackingNumber).trim() !== ""
                    ? String(order.cargoTrackingNumber)
                    : "";
            const trackDisplay =
                cargoTn ||
                (order.trackingNumber && String(order.trackingNumber).trim() !== "Yok"
                    ? String(order.trackingNumber)
                    : "");

            const isCsLive = /cicek|çiçek/i.test(marketplaceName);
            const csItemId = order.orderItemId != null ? String(order.orderItemId) : "";
            const csParentNo = String(order.packageNumber || order.orderNumber || "").trim();

            return {
                orderNumber: isCsLive && csParentNo ? csParentNo : order.orderNumber,
                orderItemId: csItemId,
                orderDate: dateIso || order.orderDate,
                orderDateRaw: order.orderDateRaw,
                customerName: order.customerName,
                totalPrice: total > 0 ? total.toFixed(2) : (order.totalPrice || "0.00"),
                grossOrderAmount: order.grossOrderAmount,
                sellerDiscountTotal: order.sellerDiscountTotal,
                tyDiscountTotal: order.tyDiscountTotal,
                status: order.status,
                trackingNumber: trackDisplay || order.orderNumber || "",
                cargoTrackingNumber: cargoTn,
                cargoCompany: order.cargoCompany || order.cargoProviderName || "",
                packageNumber: order.packageNumber || "",
                shipmentPackageId: order.shipmentPackageId || "",
                cargoTrackingLink: order.cargoTrackingLink || "",
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
            const canon = normalizeMarketplaceName(req.query.marketplace);
            filter.marketplaceName = new RegExp(
                `^${String(canon).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                "i"
            );
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

        const [orders, total, imageMaps, invoiceStats] = await Promise.all([
            Order.find(filter)
                .select("trackingNumber marketplaceName customerName totalPrice orderDate status invoiceId invoiceNumber invoiceStatus items isReturned isCancelled marketplaceInvoiced invoiceUrl invoiceSource invoiceCheckedAt commercialInvoice etgbNo etgbDate cargoCompany cargoTrackingNumber packageNumber shipmentPackageId orderItemId cargoTrackingLink")
                .populate("invoiceId", "invoiceNumber uuid status faturaURL issueDate")
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter),
            getCachedProductImageMapsForOrders(userId),
            getCachedInvoiceStatsForOrders(userId),
        ]);

        const { productImageMap, productNameImageMap } = imageMaps;

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

            const mpName = o.marketplaceName || "";
            const isCsRow = /cicek|çiçek/i.test(mpName);
            const displayOrderNo = isCsRow
                ? (o.orderItemId || o.trackingNumber || o.packageNumber || "")
                : (o.trackingNumber || "");

            return {
                _id: o._id,
                orderNumber: displayOrderNo,
                marketplace: mpName,
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
                cargoCompany: o.cargoCompany || "",
                cargoTrackingNumber: o.cargoTrackingNumber || "",
                packageNumber: o.packageNumber || "",
                shipmentPackageId: o.shipmentPackageId || "",
                orderItemId: o.orderItemId || "",
                cargoTrackingLink: o.cargoTrackingLink || "",
            };
        });

        res.json({
            success: true,
            data: formattedOrders,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            invoiceStats,
        });
    } catch (error) {
        logger.error("[Orders] getDbOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası: " + error.message });
    }
};

async function syncMarketplaceOrdersForUser(userId, rawMp, startDate, endDate) {
    const { syncMarketplaceOrdersForUser: syncOne } = require("../services/orderSyncService");
    return syncOne(userId, rawMp, startDate, endDate, syncOrdersBackground);
}

exports.syncAllOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = getIstanbulTimestamp();
        const windowDays = resolveSyncWindowDays(req);
        const defaultStartDate = now - windowDays * 24 * 60 * 60 * 1000;
        const startDate = req.query.startDate ? convertToGMT3Timestamp(req.query.startDate, true) : defaultStartDate;
        const endDate = req.query.endDate ? convertToGMT3Timestamp(req.query.endDate, false) : now;
        const parallel = req.query.parallel === "1" || req.query.parallel === "true";

        logger.info(`[OrderSync] syncAllOrders başladı - userId=${userId} windowDays=${windowDays} parallel=${parallel}`);

        const marketplaces = await Marketplace.find({ userId, isActive: { $ne: false } });
        if (marketplaces.length === 0) {
            logger.warn(`[OrderSync] userId=${userId} için aktif pazaryeri bulunamadı!`);
            return res.json({ success: true, message: "Aktif pazaryeri bulunamadi.", results: [] });
        }

        logger.info("[OrderSync] Tum pazaryerleri icin sync basliyor - " + marketplaces.length + " marketplace");

        const results = await syncAllMarketplacesForUser(
            userId,
            startDate,
            endDate,
            syncOrdersBackground,
            { parallel }
        );

        const totalSynced = results.reduce(function(sum, r) { return sum + r.synced; }, 0);
        const totalFetched = results.reduce(function(sum, r) { return sum + r.fetched; }, 0);

        logger.info("[OrderSync] Sync tamamlandi - " + totalFetched + " siparis cekildi, " + totalSynced + " yeni kaydedildi");

        try {
            const { invalidateDashboardCache } = require("../services/dashboardService");
            invalidateDashboardCache(userId);
        } catch (_) { /* optional */ }

        let ordersCard = null;
        try {
            const { getOrdersCardData } = require("../services/dashboardOrdersCardService");
            ordersCard = await getOrdersCardData(userId);
        } catch (cardErr) {
            logger.warn("[OrderSync] ordersCard özeti: " + cardErr.message);
        }

        return res.json({
            success: true,
            message: totalSynced + " yeni siparis kaydedildi (" + totalFetched + " toplam cekildi)",
            results: results,
            ordersCard,
        });

    } catch (error) {
        logger.error("[OrderSync] Sync hatasi:", error.message);
        return res.status(500).json({ success: false, message: "Siparis sync hatasi: " + error.message });
    }
};

/** Ana sayfa — son N gün siparişlerini DB'ye çek (CS varsa sıralı, diğerleri paralel) */
exports.syncRecentOrders = async (req, res) => {
    if (!req.query.days) {
        req.query.days = String(DASHBOARD_SYNC_WINDOW_DAYS);
    }
    if (req.query.parallel == null || req.query.parallel === "") {
        req.query.parallel = "1";
    }
    return exports.syncAllOrders(req, res);
};

exports.syncOrdersBackground = syncOrdersBackground;
