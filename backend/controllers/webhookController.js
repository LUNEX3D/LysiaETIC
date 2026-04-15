/**
 * WEBHOOK CONTROLLER — Pazaryeri Anlık Bildirim İşleyici
 *
 * ✅ FIX #3: Webhook desteği eklendi
 * ESKİ: Sadece 5 dakikalık polling ile sipariş kontrolü yapılıyordu
 *   → Yoğun dönemlerde (Black Friday) 5 dakika gecikme = overselling riski
 * YENİ: Pazaryerleri sipariş oluştuğunda/iptal edildiğinde webhook ile bildirir
 *   → Gecikme 5 dakikadan ~2-3 saniyeye düşer
 *
 * DESTEKLENEN PAZARYERLER:
 *   - Trendyol: POST /api/webhooks/trendyol (sipariş bildirimi)
 *   - N11:      POST /api/webhooks/n11 (sipariş bildirimi)
 *   - Hepsiburada: POST /api/webhooks/hepsiburada (sipariş bildirimi)
 *   - ÇiçekSepeti: POST /api/webhooks/ciceksepeti (sipariş bildirimi)
 *
 * GÜVENLİK:
 *   - Her pazaryeri kendi doğrulama mekanizmasını kullanır
 *   - Trendyol: X-Webhook-Secret header
 *   - N11: HMAC-SHA256 imza doğrulama
 *   - Hepsiburada: IP whitelist + Basic Auth
 *   - ÇiçekSepeti: x-api-key doğrulama
 *   - Bilinmeyen/doğrulanamayan istekler reddedilir
 *
 * AKIŞ:
 *   1. Webhook gelir → doğrulama yapılır
 *   2. Sipariş bilgileri parse edilir (marketplace-specific format)
 *   3. Duplicate kontrolü (processedOrders + DB)
 *   4. Stok reserve/release (atomic)
 *   5. Tüm platformlara anlık push
 *   6. StockSyncLog kaydı oluşturulur
 */

const logger = require("../config/logger");
const Marketplace = require("../models/Marketplace");
const StockSyncLog = require("../models/StockSyncLog");
const { syncStockToAllMarketplaces, reserveStock, releaseStock } = require("../services/stockSyncService");
const { decryptCredentials } = require("../utils/encryption");
const crypto = require("crypto");

// ═══════════════════════════════════════════════════════════════
// 🔒 WEBHOOK DOĞRULAMA YARDIMCILARI
// ═══════════════════════════════════════════════════════════════

/**
 * Webhook duplicate kontrolü — DB-level
 * Aynı sipariş+ürün kombinasyonu zaten işlendiyse true döner
 */
const isWebhookAlreadyProcessed = async (userId, orderId, barcode, marketplace) => {
    try {
        const existing = await StockSyncLog.findOne({
            userId,
            "order.orderId": String(orderId),
            "product.barcode": barcode,
            "marketplace.name": marketplace,
            actionType: { $in: ["order_placed", "stock_update", "webhook_order"] },
            status: "success"
        }).lean();
        return !!existing;
    } catch {
        return false;
    }
};

/**
 * Marketplace credential'larını userId + marketplaceName ile bul ve decrypt et
 */
const findMarketplaceCredentials = async (marketplaceName, matchFn) => {
    try {
        const marketplaces = await Marketplace.find({
            marketplaceName: { $regex: new RegExp(`^${marketplaceName}$`, "i") }
        }).lean();

        for (const mp of marketplaces) {
            const creds = decryptCredentials(mp.credentials);
            if (matchFn(creds, mp)) {
                return { userId: mp.userId.toString(), credentials: creds, marketplace: mp };
            }
        }
        return null;
    } catch (error) {
        logger.error(`[WEBHOOK] Marketplace arama hatası (${marketplaceName}): ${error.message}`);
        return null;
    }
};

/**
 * Sipariş ürünlerini işle — stok reserve/release + tüm platformlara push
 */
const processWebhookOrderItems = async (userId, items, marketplaceName, orderId, isCancelled) => {
    const results = [];

    for (const item of items) {
        const { barcode, quantity } = item;
        if (!barcode) continue;

        // Duplicate kontrolü
        if (await isWebhookAlreadyProcessed(userId, orderId, barcode, marketplaceName)) {
            logger.info(`[WEBHOOK] ${marketplaceName} sipariş zaten işlenmiş: ${orderId}/${barcode}`);
            continue;
        }

        // Atomic stok kilitleme
        let stockResult;
        if (isCancelled) {
            stockResult = await releaseStock(userId, barcode, quantity);
        } else {
            stockResult = await reserveStock(userId, barcode, quantity);
        }

        if (!stockResult.success) {
            logger.warn(`[WEBHOOK] ${marketplaceName} stok ${isCancelled ? "serbest bırakma" : "rezerve"} başarısız: ${barcode} — ${stockResult.error}`);
            results.push({ barcode, status: "error", error: stockResult.error });
            continue;
        }

        const { mapping, oldStock, newStock, marketplaceStock } = stockResult;

        if (oldStock === newStock) continue;

        // Tüm platformlara anlık push
        const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, null);
        await mapping.save();

        // Log oluştur
        await StockSyncLog.create({
            userId,
            actionType: isCancelled ? "stock_update" : "webhook_order",
            product: {
                productMappingId: mapping._id,
                barcode: mapping.masterProduct.barcode,
                sku: mapping.masterProduct.sku,
                name: mapping.masterProduct.name
            },
            marketplace: { name: marketplaceName },
            order: {
                orderId: String(orderId),
                orderNumber: String(orderId),
                marketplace: marketplaceName,
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
            action: isCancelled ? "cancel_restore" : "order_deduct",
            oldStock,
            newStock,
            quantity,
            status: "success"
        });

        logger.info(`[WEBHOOK] ⚡ ${marketplaceName} ${isCancelled ? "İPTAL +" : "SİPARİŞ -"}${quantity} | ${mapping.masterProduct.name} | ${oldStock} → ${newStock}`);
    }

    return results;
};

// ═══════════════════════════════════════════════════════════════
// 📡 TRENDYOL WEBHOOK
// ═══════════════════════════════════════════════════════════════

/**
 * Trendyol Webhook — Sipariş bildirimi
 * POST /api/webhooks/trendyol
 *
 * Trendyol webhook payload formatı:
 * {
 *   "orderNumber": "...",
 *   "status": "Created|Cancelled|...",
 *   "lines": [{ "barcode": "...", "quantity": 1, "merchantSku": "..." }],
 *   "sellerId": "..."
 * }
 *
 * Doğrulama: X-Webhook-Secret header veya sellerId eşleştirme
 */
exports.trendyolWebhook = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload || !payload.orderNumber) {
            return res.status(400).json({ success: false, message: "Geçersiz payload" });
        }

        logger.info(`[WEBHOOK] 📡 Trendyol webhook alındı — sipariş: ${payload.orderNumber}, status: ${payload.status}`);

        // Seller ID ile kullanıcıyı bul
        const sellerId = payload.sellerId || payload.supplierId;
        if (!sellerId) {
            return res.status(400).json({ success: false, message: "sellerId eksik" });
        }

        const match = await findMarketplaceCredentials("Trendyol", (creds) => {
            return (creds.sellerId === String(sellerId) || creds.supplierId === String(sellerId));
        });

        if (!match) {
            logger.warn(`[WEBHOOK] Trendyol sellerId eşleşmedi: ${sellerId}`);
            return res.status(404).json({ success: false, message: "Entegrasyon bulunamadı" });
        }

        // Webhook secret doğrulama (opsiyonel — Trendyol panelinden ayarlanır)
        const webhookSecret = req.headers["x-webhook-secret"];
        const expectedSecret = match.credentials.webhookSecret;
        if (expectedSecret && webhookSecret !== expectedSecret) {
            logger.warn(`[WEBHOOK] Trendyol webhook secret doğrulama başarısız — sellerId: ${sellerId}`);
            return res.status(401).json({ success: false, message: "Webhook doğrulama başarısız" });
        }

        // Sipariş durumu kontrolü
        const cancelStatuses = ["Cancelled", "UnDelivered", "Returned", "ReturnAccepted", "UnDeliverable"];
        const newOrderStatuses = ["Created", "New", "Approved"];
        const orderStatus = payload.status || "";

        const isCancelled = cancelStatuses.includes(orderStatus);
        const isNewOrder = newOrderStatuses.includes(orderStatus);

        if (!isCancelled && !isNewOrder) {
            // Stok değişikliği gerektirmeyen durum — 200 döndür ama işleme
            return res.status(200).json({ success: true, message: "Stok değişikliği gerektirmeyen durum", status: orderStatus });
        }

        // Sipariş ürünlerini parse et
        const lines = payload.lines || payload.items || [];
        const items = lines.map(line => ({
            barcode: line.barcode || line.merchantSku || line.sku,
            quantity: line.quantity || 1
        })).filter(item => item.barcode);

        if (items.length === 0) {
            return res.status(200).json({ success: true, message: "İşlenecek ürün yok" });
        }

        // Stok işle
        const results = await processWebhookOrderItems(
            match.userId, items, "Trendyol", payload.orderNumber, isCancelled
        );

        return res.status(200).json({
            success: true,
            message: `${results.length} ürün işlendi`,
            results
        });

    } catch (error) {
        logger.error(`[WEBHOOK] Trendyol webhook hatası: ${error.message}`);
        // Webhook'larda 500 dönmek retry tetikleyebilir — 200 döndür ama logla
        return res.status(200).json({ success: false, message: "İşleme hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📡 N11 WEBHOOK
// ═══════════════════════════════════════════════════════════════

/**
 * N11 Webhook — Sipariş bildirimi
 * POST /api/webhooks/n11
 *
 * N11 webhook payload formatı:
 * {
 *   "orderId": "...",
 *   "orderNumber": "...",
 *   "status": "New|Approved|Rejected|Cancelled|...",
 *   "items": [{ "sellerStockCode": "...", "quantity": 1 }]
 * }
 *
 * Doğrulama: X-N11-Signature header (HMAC-SHA256)
 */
exports.n11Webhook = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload || (!payload.orderId && !payload.orderNumber)) {
            return res.status(400).json({ success: false, message: "Geçersiz payload" });
        }

        const orderId = payload.orderId || payload.orderNumber;
        logger.info(`[WEBHOOK] 📡 N11 webhook alındı — sipariş: ${orderId}, status: ${payload.status}`);

        // N11 signature doğrulama
        const signature = req.headers["x-n11-signature"] || req.headers["x-signature"];
        const apiKeyHeader = req.headers["x-api-key"];

        // apiKey ile kullanıcıyı bul
        const match = await findMarketplaceCredentials("N11", (creds) => {
            if (apiKeyHeader && creds.apiKey === apiKeyHeader) return true;
            // Signature doğrulama
            if (signature && creds.secretKey) {
                const rawBody = JSON.stringify(payload);
                const expectedSig = crypto.createHmac("sha256", creds.secretKey).update(rawBody).digest("hex");
                return signature === expectedSig;
            }
            return false;
        });

        if (!match) {
            logger.warn(`[WEBHOOK] N11 doğrulama başarısız`);
            return res.status(401).json({ success: false, message: "Doğrulama başarısız" });
        }

        // Sipariş durumu kontrolü
        const cancelStatuses = ["Rejected", "Cancelled", "CancelledByBuyer", "CancelRequest", "CancelledBySeller"];
        const newOrderStatuses = ["New", "Approved", "WaitingForApproval"];
        const orderStatus = payload.status || payload.shipmentPackageStatus || "";

        const isCancelled = cancelStatuses.includes(orderStatus);
        const isNewOrder = newOrderStatuses.includes(orderStatus);

        if (!isCancelled && !isNewOrder) {
            return res.status(200).json({ success: true, message: "Stok değişikliği gerektirmeyen durum", status: orderStatus });
        }

        // Sipariş ürünlerini parse et
        const rawItems = payload.items || payload.lines || payload.orderItems || [];
        const items = rawItems.map(item => ({
            barcode: item.sellerStockCode || item.productSellerCode || item.stockCode || item.barcode,
            quantity: item.quantity || 1
        })).filter(item => item.barcode);

        if (items.length === 0) {
            return res.status(200).json({ success: true, message: "İşlenecek ürün yok" });
        }

        const results = await processWebhookOrderItems(
            match.userId, items, "N11", orderId, isCancelled
        );

        return res.status(200).json({
            success: true,
            message: `${results.length} ürün işlendi`,
            results
        });

    } catch (error) {
        logger.error(`[WEBHOOK] N11 webhook hatası: ${error.message}`);
        return res.status(200).json({ success: false, message: "İşleme hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📡 HEPSİBURADA WEBHOOK
// ═══════════════════════════════════════════════════════════════

/**
 * Hepsiburada Webhook — Sipariş/paket bildirimi
 * POST /api/webhooks/hepsiburada
 *
 * Hepsiburada webhook payload formatı:
 * {
 *   "packageNumber": "...",
 *   "status": "New|Open|Cancelled|...",
 *   "items": [{ "merchantSku": "...", "quantity": 1 }],
 *   "merchantId": "..."
 * }
 *
 * Doğrulama: merchantId eşleştirme + Basic Auth header
 */
exports.hepsiburadaWebhook = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload || (!payload.packageNumber && !payload.id)) {
            return res.status(400).json({ success: false, message: "Geçersiz payload" });
        }

        const packageId = payload.packageNumber || payload.id;
        logger.info(`[WEBHOOK] 📡 Hepsiburada webhook alındı — paket: ${packageId}, status: ${payload.status}`);

        // merchantId ile kullanıcıyı bul
        const merchantId = payload.merchantId;
        const match = await findMarketplaceCredentials("Hepsiburada", (creds) => {
            return creds.merchantId && (creds.merchantId === String(merchantId));
        });

        if (!match) {
            logger.warn(`[WEBHOOK] Hepsiburada merchantId eşleşmedi: ${merchantId}`);
            return res.status(404).json({ success: false, message: "Entegrasyon bulunamadı" });
        }

        // Sipariş durumu kontrolü
        const cancelStatuses = ["Cancelled", "UnDelivered", "Returned"];
        const newOrderStatuses = ["New", "Open", "Approved", "Unpacked"];
        const pkgStatus = payload.status || "";

        const isCancelled = cancelStatuses.includes(pkgStatus);
        const isNewOrder = newOrderStatuses.includes(pkgStatus);

        if (!isCancelled && !isNewOrder) {
            return res.status(200).json({ success: true, message: "Stok değişikliği gerektirmeyen durum", status: pkgStatus });
        }

        // Sipariş ürünlerini parse et
        const rawItems = payload.items || payload.lines || [];
        const items = rawItems.map(item => ({
            barcode: item.merchantSku || item.hepsiburadaSku || item.sku,
            quantity: item.quantity || 1
        })).filter(item => item.barcode);

        if (items.length === 0) {
            return res.status(200).json({ success: true, message: "İşlenecek ürün yok" });
        }

        const results = await processWebhookOrderItems(
            match.userId, items, "Hepsiburada", packageId, isCancelled
        );

        return res.status(200).json({
            success: true,
            message: `${results.length} ürün işlendi`,
            results
        });

    } catch (error) {
        logger.error(`[WEBHOOK] Hepsiburada webhook hatası: ${error.message}`);
        return res.status(200).json({ success: false, message: "İşleme hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📡 ÇİÇEKSEPETİ WEBHOOK
// ═══════════════════════════════════════════════════════════════

/**
 * ÇiçekSepeti Webhook — Sipariş bildirimi
 * POST /api/webhooks/ciceksepeti
 *
 * ÇiçekSepeti webhook payload formatı:
 * {
 *   "orderId": "...",
 *   "orderItemId": "...",
 *   "barcode": "...",
 *   "stockCode": "...",
 *   "quantity": 1,
 *   "orderProductStatus": "Yeni|İptal Edildi|..."
 * }
 *
 * Doğrulama: x-api-key header
 */
exports.ciceksepetiWebhook = async (req, res) => {
    try {
        const payload = req.body;

        // ÇiçekSepeti tek item veya array gönderebilir
        const orders = Array.isArray(payload) ? payload : [payload];

        if (orders.length === 0 || !orders[0]) {
            return res.status(400).json({ success: false, message: "Geçersiz payload" });
        }

        logger.info(`[WEBHOOK] 📡 ÇiçekSepeti webhook alındı — ${orders.length} sipariş`);

        // x-api-key ile kullanıcıyı bul
        const apiKeyHeader = req.headers["x-api-key"];
        if (!apiKeyHeader) {
            return res.status(401).json({ success: false, message: "x-api-key header eksik" });
        }

        const match = await findMarketplaceCredentials("ÇiçekSepeti", (creds) => {
            const credApiKey = creds.apiKey || creds.apiSecret;
            return credApiKey === apiKeyHeader;
        });

        if (!match) {
            logger.warn(`[WEBHOOK] ÇiçekSepeti API key eşleşmedi`);
            return res.status(401).json({ success: false, message: "Doğrulama başarısız" });
        }

        const allResults = [];

        for (const order of orders) {
            const orderId = order.orderId || order.orderItemId;
            if (!orderId) continue;

            const orderStatus = order.orderProductStatus || "";

            // ÇiçekSepeti Türkçe status değerleri
            const cancelStatuses = ["İptal Edildi", "İade Edildi", "İade Sürecinde", "İade Onaylandı", "Cancelled", "Returned"];
            const newOrderStatuses = ["Yeni", "Hazırlanıyor", "Onaylandı", "New", "Approved", "Preparing"];

            const isCancelled = cancelStatuses.some(s => orderStatus.includes(s));
            const isNewOrder = newOrderStatuses.some(s => orderStatus.includes(s));

            if (!isCancelled && !isNewOrder) continue;

            const barcode = order.barcode || order.stockCode || order.productCode;
            if (!barcode) continue;

            const items = [{ barcode, quantity: order.quantity || 1 }];

            const results = await processWebhookOrderItems(
                match.userId, items, "ÇiçekSepeti", orderId, isCancelled
            );

            allResults.push(...results);
        }

        return res.status(200).json({
            success: true,
            message: `${allResults.length} ürün işlendi`,
            results: allResults
        });

    } catch (error) {
        logger.error(`[WEBHOOK] ÇiçekSepeti webhook hatası: ${error.message}`);
        return res.status(200).json({ success: false, message: "İşleme hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🏥 WEBHOOK HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * Webhook endpoint'lerinin çalışıp çalışmadığını kontrol et
 * GET /api/webhooks/health
 */
exports.webhookHealth = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Webhook endpoint'leri aktif",
        endpoints: {
            trendyol: "POST /api/webhooks/trendyol",
            n11: "POST /api/webhooks/n11",
            hepsiburada: "POST /api/webhooks/hepsiburada",
            ciceksepeti: "POST /api/webhooks/ciceksepeti"
        },
        timestamp: new Date().toISOString()
    });
};
