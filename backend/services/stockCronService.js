/**
 * STOK CRON SERVİSİ — Arka Planda Otomatik Stok Senkronizasyonu
 *
 * 1. Periyodik olarak tüm pazaryerlerinden sipariş kontrolü yapar
 * 2. Yeni sipariş varsa stok düşürür
 * 3. İptal edilen sipariş varsa stok artırır
 * 4. Tüm platformlara stok değişikliğini yansıtır
 * 5. Her 5 dakikada bir çalışır
 */

const axios = require("axios");
const moment = require("moment");
const ProductMapping = require("../models/ProductMapping");
const StockSyncLog = require("../models/StockSyncLog");
const Marketplace = require("../models/Marketplace");
const PendingDeletion = require("../models/PendingDeletion");
const User = require("../models/User");
const logger = require("../config/logger");
const {
    syncStockToAllMarketplaces,
    processOrderStockLine,
    retryPendingStockPushes,
    deriveSyncLogStatus,
    saveProductMappingAfterPlatformSync
} = require("./stockSyncService");
const { checkPendingTrendyolBatches, checkPendingHepsiburadaUploads } = require("./productSyncService");
// ✅ FIX: Credential'ları decrypt ederek kullan
const { decryptCredentials } = require("../utils/encryption");

// İşlenen sipariş ID'lerini takip et (restart'a kadar — in-memory cache)
// ⚠️ Her sipariş+ürün kombinasyonu ayrı key olarak tutulur
// Böylece aynı siparişteki farklı ürünler de doğru işlenir
// ✅ FIX #7: Map kullanarak timestamp bazlı LRU temizleme
const processedOrders = new Map(); // key → timestamp

// ✅ FIX #2: Cron re-entrancy lock — aynı anda iki runStockSync çalışmasını engelle
let _cronRunning = false;
let _cronTick = 0;
const STOCK_CRON_MS = Math.max(60_000, parseInt(process.env.STOCK_ORDER_CRON_MS || "120000", 10) || 120_000);
const STOCK_PUSH_EVERY_N_CYCLES = Math.max(1, parseInt(process.env.STOCK_PUSH_EVERY_N_CYCLES || "3", 10) || 3);

/**
 * Cron sipariş satırı — merkezi processOrderStockLine + in-memory işaretleme
 */
const applyCronOrderStockLine = async ({
    userId,
    marketplaceName,
    orderNumber,
    barcode,
    quantity,
    isCancelled,
    orderItemKey,
    results
}) => {
    const lineResult = await processOrderStockLine({
        userId,
        marketplaceName,
        orderNumber,
        barcode,
        quantity,
        isCancelled,
        actionType: isCancelled ? "stock_update" : "order_placed"
    });

    processedOrders.set(orderItemKey, Date.now());

    if (lineResult.skipped || lineResult.noStockChange) return;
    if (!lineResult.success) {
        logger.warn(`[STOCK CRON] ${marketplaceName} stok hatası: ${barcode} — ${lineResult.error}`);
        return;
    }

    results.push({
        barcode,
        marketplace: marketplaceName,
        action: isCancelled ? "cancel_restore" : "order_deduct",
        oldStock: lineResult.oldStock,
        newStock: lineResult.newStock,
        quantity,
        syncStatus: lineResult.status
    });

    logger.info(
        `[STOCK CRON] ${marketplaceName} ${isCancelled ? "İPTAL +" : "SİPARİŞ -"}${quantity} | ` +
        `${lineResult.mapping?.masterProduct?.name} | ${lineResult.oldStock} → ${lineResult.newStock}`
    );
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
                    processedOrders.set(orderItemKey, Date.now());
                    continue;
                }

                const quantity = line.quantity || 1;

                await applyCronOrderStockLine({
                    userId,
                    marketplaceName: "Trendyol",
                    orderNumber: order.orderNumber,
                    barcode,
                    quantity,
                    isCancelled,
                    orderItemKey,
                    results
                });
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

        // ✅ FIX #6: N11 siparişlerinde zaman filtresi eklendi
        // ESKİ: Tüm açık siparişler çekiliyordu → performans sorunu
        // YENİ: Son 2 saatteki siparişler filtreleniyor
        const result = await n11Service.getOrders(credentials, {
            status: "New,Approved",
            page: 0,
            size: 50,
            orderDateStart: moment().subtract(2, "hours").format("DD/MM/YYYY HH:mm"),
            orderDateEnd: moment().format("DD/MM/YYYY HH:mm")
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
                    processedOrders.set(orderItemKey, Date.now());
                    continue;
                }

                const quantity = item.quantity || 1;

                await applyCronOrderStockLine({
                    userId,
                    marketplaceName: "N11",
                    orderNumber: String(order.id || order.orderNumber),
                    barcode,
                    quantity,
                    isCancelled,
                    orderItemKey,
                    results
                });
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
        const { normalizeCredentials, getHeaders, getEndpoints, resolveHepsiburadaOrderNumber } = require("./hepsiburadaService");
        const hbCreds = normalizeCredentials(credentials);
        const { merchantId, secretKey, userAgent } = hbCreds;

        if (!merchantId || !secretKey) return results;

        const headers = getHeaders(merchantId, secretKey, userAgent);
        const ep = getEndpoints(hbCreds);

        // ✅ FIX #6: Hepsiburada siparişlerinde zaman filtresi eklendi
        // ESKİ: Tüm paketler çekiliyordu → performans sorunu
        // YENİ: Son 2 saatteki paketler filtreleniyor
        // ✅ FIX #7: HB Docs uyumu — packages limit max 10, parametre adları begindate/enddate
        //    timespan tek başına max 24h, timespan+limit+offset ile >24h olabilir
        //    2 saat = timespan ile daha temiz: timespan=2 (saat cinsinden)
        const response = await axios.get(
            `${ep.OMS}/packages/merchantid/${merchantId}?timespan=2&limit=10&offset=0`,
            {
                headers,
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
                    processedOrders.set(orderItemKey, Date.now());
                    continue;
                }

                const quantity = item.quantity || 1;

                await applyCronOrderStockLine({
                    userId,
                    marketplaceName: "Hepsiburada",
                    orderNumber: String(resolveHepsiburadaOrderNumber(pkg) || pkg.packageNumber || ""),
                    barcode,
                    quantity,
                    isCancelled,
                    orderItemKey,
                    results
                });
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
 * ÇiçekSepeti siparişlerini kontrol et ve stok güncelle
 * ✅ YENİ: Bu fonksiyon eksikti — ÇiçekSepeti siparişleri hiç kontrol edilmiyordu!
 *
 * ÇiçekSepeti API: POST /api/v1/Order/GetOrders
 * Yanıt: { supplierOrderListWithBranch: [...], orderListCount }
 * Her item: { orderId, orderItemId, barcode, stockCode, productCode, quantity, orderProductStatus, ... }
 *
 * orderProductStatus değerleri:
 *   Yeni sipariş: "Yeni", "Hazırlanıyor", "Onaylandı"
 *   İptal/İade:   "İptal Edildi", "İade Edildi", "İade Sürecinde"
 *   Tamamlanmış:  "Teslim Edildi", "Kargoda", "Kargoya Verildi"
 */
const checkCicekSepetiOrders = async (userId, credentials) => {
    const results = [];

    try {
        const apiKey = credentials.apiKey || credentials.apiSecret;
        const sellerId = credentials.sellerId || credentials.supplierId;
        const integratorName = credentials.integratorName || "";
        if (!apiKey) return results;

        // ÇiçekSepeti API header'ları: x-api-key + user-agent (ASCII only)
        const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
        const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
        const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : (cleanSellerId || "CicekSepetiIntegration");

        const headers = {
            "x-api-key": apiKey,
            "user-agent": userAgent,
            "Content-Type": "application/json"
        };

        // Son 2 saatteki siparişleri kontrol et
        const endDate = moment().toISOString();
        const startDate = moment().subtract(2, "hours").toISOString();

        const response = await axios.post(
            "https://apis.ciceksepeti.com/api/v1/Order/GetOrders",
            {
                startDate,
                endDate,
                pageSize: 100,
                page: 0
            },
            { headers, timeout: 30000 }
        );

        const orders = response.data?.supplierOrderListWithBranch || [];

        for (const order of orders) {
            // ÇiçekSepeti her satır ayrı bir "order" objesi olarak döner (flat list)
            const barcode = order.barcode || order.stockCode || order.productCode;
            if (!barcode) continue;

            const orderId = order.orderId || order.orderItemId;
            if (!orderId) continue;

            // ✅ Sipariş+ürün bazlı tekrar işleme koruması (in-memory)
            const orderItemKey = `cs_${orderId}_${order.orderItemId || barcode}`;
            if (processedOrders.has(orderItemKey)) continue;

            // ✅ Sadece stok etkileyen durumları işle
            const orderStatus = order.orderProductStatus || "";

            // ÇiçekSepeti Türkçe status değerleri
            const cancelStatuses = ["İptal Edildi", "İade Edildi", "İade Sürecinde", "İade Onaylandı", "Cancelled", "Returned"];
            const newOrderStatuses = ["Yeni", "Hazırlanıyor", "Onaylandı", "New", "Approved", "Preparing"];

            const isCancelled = cancelStatuses.some(s => orderStatus.includes(s));
            const isNewOrder = newOrderStatuses.some(s => orderStatus.includes(s));

            // Ne yeni sipariş ne iptal → stok değişikliği yok, atla
            if (!isCancelled && !isNewOrder) {
                processedOrders.set(orderItemKey, Date.now());
                continue;
            }

            const quantity = order.quantity || 1;

            await applyCronOrderStockLine({
                userId,
                marketplaceName: "ÇiçekSepeti",
                orderNumber: String(orderId),
                barcode,
                quantity,
                isCancelled,
                orderItemKey,
                results
            });
        }
    } catch (error) {
        if (error.response?.status !== 401) {
            logger.error(`[STOCK CRON] ÇiçekSepeti sipariş kontrolü hatası: ${error.message}`);
        }
    }

    return results;
};

/**
 * Amazon siparişlerini kontrol et ve stok güncelle
 * ✅ YENİ: Bu fonksiyon eksikti — Amazon siparişleri hiç kontrol edilmiyordu!
 *
 * Amazon SP-API: GET /orders/v0/orders
 * Sipariş ürünleri: GET /orders/v0/orders/{orderId}/orderItems
 *
 * OrderStatus değerleri:
 *   Yeni sipariş: "Unshipped", "PartiallyShipped"
 *   İptal:        "Canceled"
 *   Tamamlanmış:  "Shipped", "InvoiceUnconfirmed", "Unfulfillable"
 */
const checkAmazonOrders = async (userId, credentials) => {
    const results = [];

    try {
        // Amazon SP-API servisi — lazy require (her kullanıcıda Amazon olmayabilir)
        let amazonService;
        try {
            amazonService = require("./amazon/amazonSpApiService");
        } catch (reqErr) {
            // Amazon servisi yüklenemezse sessizce atla
            return results;
        }

        // Son 2 saatteki siparişleri kontrol et
        const createdAfter = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

        const orderResult = await amazonService.getOrders(credentials, {
            createdAfter,
            orderStatuses: ["Unshipped", "PartiallyShipped", "Canceled"],
            maxResults: 50
        });

        if (!orderResult.success || !orderResult.orders?.length) return results;

        for (const order of orderResult.orders) {
            const orderId = order.AmazonOrderId;
            if (!orderId) continue;

            const orderStatus = order.OrderStatus || "";
            const cancelStatuses = ["Canceled"];
            const newOrderStatuses = ["Unshipped", "PartiallyShipped"];

            const isCancelled = cancelStatuses.includes(orderStatus);
            const isNewOrder = newOrderStatuses.includes(orderStatus);

            if (!isCancelled && !isNewOrder) continue;

            // Sipariş ürünlerini çek (Amazon'da order ve items ayrı endpoint)
            let items = [];
            try {
                const itemsResult = await amazonService.getOrderItems(credentials, orderId);
                if (itemsResult.success) {
                    items = itemsResult.items || [];
                }
            } catch (itemErr) {
                logger.warn(`[STOCK CRON] Amazon sipariş ürünleri alınamadı: ${orderId} — ${itemErr.message}`);
                continue;
            }

            for (const item of items) {
                const barcode = item.sku; // Amazon'da SellerSKU = bizim SKU/barcode
                if (!barcode) continue;

                // ✅ Sipariş+ürün bazlı tekrar işleme koruması (in-memory)
                const orderItemKey = `amz_${orderId}_${barcode}`;
                if (processedOrders.has(orderItemKey)) continue;

                const quantity = item.quantity || 1;

                await applyCronOrderStockLine({
                    userId,
                    marketplaceName: "Amazon",
                    orderNumber: String(orderId),
                    barcode,
                    quantity,
                    isCancelled,
                    orderItemKey,
                    results
                });
            }
        }
    } catch (error) {
        if (error.response?.status !== 401 && error.response?.status !== 403) {
            logger.error(`[STOCK CRON] Amazon sipariş kontrolü hatası: ${error.message}`);
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

        // 🛡️ FIX #4: Silinmesi bekleyen ürünlerin barkodlarını al
        // Bu ürünlere stok push yapılmamalı — aksi halde silme işlemi bozulur
        const pendingDeletions = await PendingDeletion.find({ status: "pending" }).lean();
        const pendingBarcodes = new Set(pendingDeletions.map(pd => pd.barcode));

        let synced = 0;
        let errors = 0;
        let skipped = 0;

        for (const mapping of mappings) {
            try {
                const userId = mapping.userId;
                const barcode = mapping.masterProduct?.barcode;

                // 🛡️ FIX #4: Silinmesi bekleyen ürünü atla — stok push yapma
                if (barcode && pendingBarcodes.has(barcode)) {
                    skipped++;
                    continue;
                }

                // 🛡️ Güvenlik stoğu düşülmüş stoku hesapla
                const marketplaceStock = mapping.getMarketplaceStock();

                // Pazaryeri mapping'lerinden herhangi birinin stoku farklı mı VEYA
                // stok > 0 olup syncStatus hatalı/beklemede olan var mı kontrol et
                // (Trendyol'da ürün satışa kapalı olabilir — unlock gerekebilir)
                let needsSync = false;
                // Master stok 0 → pazaryerinde satış kapanmalı (önceki push başarısız olsa bile tekrar dene)
                if (marketplaceStock <= 0) {
                    needsSync = true;
                }
                for (const mp of mapping.marketplaceMappings) {
                    if (needsSync) break;
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
                    await saveProductMappingAfterPlatformSync(mapping); // syncStockToAllMarketplaces → marketplaceMappings stok/sync alanları
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
    // ✅ FIX #2: Re-entrancy lock — önceki döngü bitmeden yeni döngü başlamaz
    // SORUN: runStockSync 5 dakikadan uzun sürerse, setInterval yeni bir çağrı başlatır
    //   → Aynı siparişler paralel işlenir → race condition riski
    // ÇÖZÜM: _cronRunning flag'i ile sadece 1 instance çalışır
    if (_cronRunning) {
        logger.warn("[STOCK CRON] ⚠️ Önceki döngü hâlâ çalışıyor — bu döngü atlanıyor");
        return;
    }
    _cronRunning = true;

    try {
        // ═══════════════════════════════════════════════════════
        // ADIM 0: KISMI BAŞARISIZ PLATFORM PUSH — YENİDEN DENE
        // ═══════════════════════════════════════════════════════
        try {
            const retryResult = await retryPendingStockPushes();
            if (retryResult.retried > 0) {
                logger.info(`[STOCK CRON] 🔁 Kısmi sync retry — denenen: ${retryResult.retried}, düzelen: ${retryResult.fixed}`);
            }
        } catch (retryErr) {
            logger.warn(`[STOCK CRON] Retry hatası: ${retryErr.message}`);
        }

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
                    // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
                    const decryptedCreds = decryptCredentials(mp.credentials);
                    switch (mpName) {
                        case "Trendyol":
                            results = await checkTrendyolOrders(userId, decryptedCreds);
                            break;
                        case "N11":
                            results = await checkN11Orders(userId, decryptedCreds);
                            break;
                        case "Hepsiburada":
                            results = await checkHepsiburadaOrders(userId, decryptedCreds);
                            break;
                        case "ÇiçekSepeti":
                            results = await checkCicekSepetiOrders(userId, decryptedCreds);
                            break;
                        case "Amazon":
                            results = await checkAmazonOrders(userId, decryptedCreds);
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
        // ADIM 2: MASTER STOK EŞİTLEME (her N döngüde — varsayılan ~6 dk)
        // ═══════════════════════════════════════════════════════
        _cronTick += 1;
        if (_cronTick % STOCK_PUSH_EVERY_N_CYCLES === 0) {
            const pushResult = await pushMasterStockToMarketplaces();
            if (pushResult.synced > 0 || pushResult.errors > 0) {
                logger.info(`[STOCK CRON] 🔄 Stok eşitleme — toplam: ${pushResult.total}, güncellenen: ${pushResult.synced}, hata: ${pushResult.errors}, atlanılan: ${pushResult.skipped}`);
            }
        }

        // ═══════════════════════════════════════════════════════
        // ADIM 3: TRENDYOL BEKLEYEN SİLME İŞLEMLERİ
        // Arşive alınmış ama henüz silinmemiş ürünleri kontrol et
        // Trendyol kuralı: Arşivde 1+ gün kalan ürünler DELETE ile silinebilir
        // ═══════════════════════════════════════════════════════
        try {
            const pendingResult = await processPendingTrendyolDeletions();
            if (pendingResult.processed > 0) {
                logger.info(`[STOCK CRON] 🗑️ Trendyol bekleyen silme — işlenen: ${pendingResult.processed}, silinen: ${pendingResult.deleted}, hata: ${pendingResult.errors}`);
            }
        } catch (pdErr) {
            logger.error(`[STOCK CRON] Trendyol bekleyen silme hatası: ${pdErr.message}`);
        }

        // ═══════════════════════════════════════════════════════
        // ADIM 4: TRENDYOL ÜRÜN YÜKLEME BATCH SONUÇLARI
        // createProducts sonrası batchRequestId ile kesin başarı / red
        // ═══════════════════════════════════════════════════════
        try {
            const tyBatch = await checkPendingTrendyolBatches();
            if (tyBatch.checked > 0 && (tyBatch.updated > 0 || tyBatch.failed > 0 || tyBatch.inProgress > 0)) {
                logger.info(
                    `[STOCK CRON] 📋 Trendyol batch — kontrol: ${tyBatch.checked}, kesinleşen: ${tyBatch.updated}, ` +
                    `başarısız: ${tyBatch.failed}, işlemde: ${tyBatch.inProgress}`
                );
            }
        } catch (tyErr) {
            logger.warn(`[STOCK CRON] Trendyol batch kontrolü: ${tyErr.message}`);
        }

        // ═══════════════════════════════════════════════════════
        // ADIM 5: HEPSİBURADA ÜRÜN YÜKLEME TRACKING SONUÇLARI
        // import/listing sonrası trackingId ile kesin başarı / red
        // ═══════════════════════════════════════════════════════
        try {
            const users = await User.find({ isActive: true }).select("_id").lean();
            let totalChecked = 0;
            let totalUpdated = 0;
            let totalFailed = 0;
            let totalInProgress = 0;
            for (const u of users) {
                const hbPending = await checkPendingHepsiburadaUploads(u._id);
                totalChecked += hbPending.checked || 0;
                totalUpdated += hbPending.updated || 0;
                totalFailed += hbPending.failed || 0;
                totalInProgress += hbPending.inProgress || 0;
            }
            if (totalChecked > 0) {
                logger.info(
                    `[STOCK CRON] 📋 Hepsiburada tracking — kontrol: ${totalChecked}, kesinleşen: ${totalUpdated}, ` +
                    `başarısız: ${totalFailed}, işlemde: ${totalInProgress}`
                );
            }
        } catch (hbErr) {
            logger.warn(`[STOCK CRON] Hepsiburada tracking kontrolü: ${hbErr.message}`);
        }

        // ✅ FIX #7: Timestamp bazlı LRU bellek temizliği
        // ESKİ: Set kullanılıyordu → hangi kayıtların eski olduğu bilinmiyordu
        //   10K'da rastgele 5K siliniyordu → eski siparişler tekrar kontrol ediliyordu
        // YENİ: Map(key→timestamp) ile 1 saatten eski kayıtlar temizlenir
        if (processedOrders.size > 10000) {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            let cleaned = 0;
            for (const [key, ts] of processedOrders) {
                if (ts < oneHourAgo) {
                    processedOrders.delete(key);
                    cleaned++;
                }
            }
            // Hâlâ çok fazlaysa en eski yarısını sil
            if (processedOrders.size > 10000) {
                const entries = [...processedOrders.entries()].sort((a, b) => a[1] - b[1]);
                const toRemove = entries.slice(0, Math.floor(entries.length / 2));
                toRemove.forEach(([key]) => processedOrders.delete(key));
                cleaned += toRemove.length;
            }
            if (cleaned > 0) {
                logger.info(`[STOCK CRON] 🧹 Bellek temizliği: ${cleaned} eski kayıt silindi, kalan: ${processedOrders.size}`);
            }
        }

    } catch (error) {
        logger.error(`[STOCK CRON] Genel hata: ${error.message}`);
    } finally {
        // ✅ FIX #2: Lock'u her durumda serbest bırak (hata olsa bile)
        _cronRunning = false;
    }
};

/**
 * Trendyol bekleyen silme işlemlerini kontrol et ve sil
 *
 * Trendyol kuralı: Ürün arşive alındıktan en az 1 gün (25 saat güvenlik payı)
 * sonra DELETE API ile tamamen silinebilir.
 *
 * Bu fonksiyon her cron döngüsünde çalışır ve 25+ saat arşivde kalan
 * ürünleri Trendyol DELETE API ile tamamen siler.
 */
const processPendingTrendyolDeletions = async () => {
    const result = { processed: 0, deleted: 0, errors: 0 };

    try {
        // 25+ saat arşivde kalan ve henüz silinmemiş ürünleri bul
        const pendingItems = await PendingDeletion.findReadyForDeletion();

        if (pendingItems.length === 0) return result;

        logger.info(`[PENDING DELETE] 🔍 ${pendingItems.length} ürün silmeye hazır`);

        for (const item of pendingItems) {
            result.processed++;

            try {
                // Marketplace credential'larını al
                const marketplace = await Marketplace.findById(item.marketplaceId);
                if (!marketplace) {
                    item.status = "failed";
                    item.lastError = "Marketplace entegrasyonu bulunamadı";
                    item.lastAttemptAt = new Date();
                    await item.save();
                    result.errors++;
                    continue;
                }

                const credentials = decryptCredentials(marketplace.credentials);
                const { apiKey, apiSecret, sellerId, supplierId } = credentials;
                const actualSellerId = sellerId || supplierId;

                if (!apiKey || !apiSecret || !actualSellerId) {
                    item.status = "failed";
                    item.lastError = "Trendyol credentials eksik";
                    item.lastAttemptAt = new Date();
                    await item.save();
                    result.errors++;
                    continue;
                }

                const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
                const headers = {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${actualSellerId} - LysiaETIC`,
                    "Content-Type": "application/json"
                };

                // Trendyol DELETE API çağrısı
                const deleteResp = await axios.delete(
                    `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products`,
                    {
                        data: { items: [{ barcode: item.barcode }] },
                        headers,
                        timeout: 15000
                    }
                );

                // Başarılı — kaydı tamamlandı olarak işaretle
                item.status = "completed";
                item.completedAt = new Date();
                item.lastAttemptAt = new Date();
                item.attempts += 1;
                await item.save();

                result.deleted++;
                logger.info(`[PENDING DELETE] ✅ Trendyol ürün tamamen silindi: ${item.barcode} (batchId: ${deleteResp.data?.batchRequestId})`);

            } catch (deleteErr) {
                const errMsg = deleteErr.response?.data?.errors?.[0]?.message || deleteErr.message;

                item.attempts += 1;
                item.lastAttemptAt = new Date();
                item.lastError = errMsg;

                // 5 denemeden sonra başarısız olarak işaretle
                if (item.attempts >= 5) {
                    item.status = "failed";
                    logger.error(`[PENDING DELETE] ❌ Trendyol ürün silinemedi (5 deneme tükendi): ${item.barcode} — ${errMsg}`);
                } else {
                    logger.warn(`[PENDING DELETE] ⚠️ Trendyol DELETE başarısız (deneme ${item.attempts}/5): ${item.barcode} — ${errMsg}`);
                }

                await item.save();
                result.errors++;
            }
        }

    } catch (error) {
        logger.error(`[PENDING DELETE] Genel hata: ${error.message}`);
    }

    return result;
};

/**
 * Cron'u başlat — 5 dakikada bir çalışır
 */
let cronInterval = null;

const startStockCron = () => {
    if (cronInterval) return;

    logger.info(`[STOCK CRON] 🔄 Otomatik stok senkronizasyonu başlatıldı (${Math.round(STOCK_CRON_MS / 60000)}dk sipariş, master push her ${STOCK_PUSH_EVERY_N_CYCLES} döngü)`);

    // İlk çalıştırma — 30 saniye sonra (sunucu başlangıcını bekle)
    setTimeout(() => {
        runStockSync();
    }, 30000);

    cronInterval = setInterval(runStockSync, STOCK_CRON_MS);
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
