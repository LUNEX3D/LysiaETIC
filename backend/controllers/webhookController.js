const logger = require("../config/logger");
const { processOrderStockLine } = require("../services/stockSyncService");
const { resolveOrderItemBarcodeForStock } = require("../utils/productFieldCompare");

/**
 * ⚡ WEBHOOK CONTROLLER
 * Pazaryerlerinden gelen anlık bildirimleri (Sipariş, Stok, İptal vb.) işler.
 */

/**
 * Trendyol Webhook İşleyici
 */
exports.trendyolWebhook = async (req, res) => {
    try {
        const payload = req.body;
        logger.info("[WEBHOOK] Trendyol bildirimi alındı", { type: payload.eventType });

        if (payload.eventType === "OrderCreated" && payload.sellerId) {
            const lines = payload.lines || payload.orderLines || [];
            const orderNumber = payload.orderNumber || payload.id || "";
            const userId = req.webhookUserId || req.body?.userId;
            if (userId && Array.isArray(lines) && lines.length > 0) {
                for (const line of lines) {
                    const barcode = await resolveOrderItemBarcodeForStock(userId, line);
                    if (!barcode) continue;
                    await processOrderStockLine({
                        userId,
                        marketplaceName: "Trendyol",
                        orderNumber,
                        barcode,
                        quantity: Number(line.quantity) || 1,
                        isCancelled: false,
                        actionType: "webhook_order"
                    });
                }
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[WEBHOOK] Trendyol hatası", { error: error.message });
        return res.status(500).send();
    }
};

/**
 * Amazon SP-API Notification İşleyici
 */
exports.amazonWebhook = async (req, res) => {
    try {
        const notification = req.body;
        logger.info("[WEBHOOK] Amazon bildirimi alındı", { type: notification.notificationType });
        return res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[WEBHOOK] Amazon hatası", { error: error.message });
        return res.status(500).send();
    }
};

/**
 * Noon Webhook İşleyici
 */
exports.noonWebhook = async (req, res) => {
    try {
        const event = req.body;
        logger.info("[WEBHOOK] Noon bildirimi alındı", { event: event.eventName });
        return res.status(200).json({ success: true });
    } catch (error) {
        logger.error("[WEBHOOK] Noon hatası", { error: error.message });
        return res.status(500).send();
    }
};

/**
 * N11 Webhook
 */
exports.n11Webhook = async (req, res) => {
    return res.status(200).json({ success: true });
};

/**
 * Hepsiburada Webhook
 */
exports.hepsiburadaWebhook = async (req, res) => {
    return res.status(200).json({ success: true });
};

/**
 * ÇiçekSepeti Webhook
 */
exports.ciceksepetiWebhook = async (req, res) => {
    return res.status(200).json({ success: true });
};

/**
 * Webhook Health Check
 */
exports.webhookHealth = async (req, res) => {
    return res.status(200).json({ status: "active", timestamp: new Date() });
};
