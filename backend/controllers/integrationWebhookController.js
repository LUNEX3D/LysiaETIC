/**
 * integrationWebhookController.js â€” Trendyol Webhook Abonelik YÃ¶netimi
 *
 * Trendyol'a webhook aboneliÄŸi oluÅŸturup yÃ¶neterek sipariÅŸ bildirimlerinin
 * polling yerine anlÄ±k push ile gelmesini saÄŸlar.
 * Gelen bildirimler: POST /api/webhooks/trendyol (webhookRoutes)
 */

const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
const logger = require("../config/logger");
const tyWebhook = require("../services/trendyolWebhookService");

const getTrendyolCredentials = async (req) => {
    const userId = req.user?.id || req.user?._id;
    const mp = await Marketplace.findOne({ userId, marketplaceName: /^trendyol$/i });
    if (!mp?.credentials) {
        const err = new Error("Trendyol entegrasyonu bulunamadÄ±");
        err.status = 404;
        throw err;
    }
    return decryptCredentials(mp.credentials);
};

/** GET /api/integrations/trendyol/webhooks */
const listWebhooks = async (req, res) => {
    try {
        const creds = await getTrendyolCredentials(req);
        const result = await tyWebhook.listWebhooks(creds);
        res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/integrations/trendyol/webhooks
 * Body: { url, authenticationType, apiKey, username, password, subscribedStatuses }
 * url verilmezse uygulamanÄ±n kendi webhook endpoint'i kullanÄ±lÄ±r (PUBLIC_BASE_URL).
 */
const createWebhook = async (req, res) => {
    try {
        const creds = await getTrendyolCredentials(req);
        const body = req.body || {};

        let url = String(body.url || "").trim();
        if (!url) {
            const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "").replace(/\/+$/, "");
            if (base) url = `${base}/api/webhooks/trendyol`;
        }
        if (!url) {
            return res.status(400).json({
                success: false,
                message: "Webhook URL gerekli (veya sunucuda PUBLIC_BASE_URL tanÄ±mlayÄ±n)",
            });
        }

        const result = await tyWebhook.createWebhook(creds, {
            url,
            authenticationType: body.authenticationType,
            apiKey: body.apiKey || process.env.TRENDYOL_WEBHOOK_TOKEN,
            username: body.username,
            password: body.password,
            subscribedStatuses: body.subscribedStatuses,
        });
        res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        logger.error("[TY Webhook] OluÅŸturma hatasÄ±:", error.message);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** PUT /api/integrations/trendyol/webhooks/:id */
const updateWebhook = async (req, res) => {
    try {
        const creds = await getTrendyolCredentials(req);
        const result = await tyWebhook.updateWebhook(creds, req.params.id, req.body || {});
        res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** DELETE /api/integrations/trendyol/webhooks/:id */
const deleteWebhook = async (req, res) => {
    try {
        const creds = await getTrendyolCredentials(req);
        const result = await tyWebhook.deleteWebhook(creds, req.params.id);
        res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/** PUT /api/integrations/trendyol/webhooks/:id/activate | /deactivate */
const setWebhookActive = (active) => async (req, res) => {
    try {
        const creds = await getTrendyolCredentials(req);
        const result = await tyWebhook.setWebhookActive(creds, req.params.id, active);
        res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

module.exports = {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    activateWebhook: setWebhookActive(true),
    deactivateWebhook: setWebhookActive(false),
};

