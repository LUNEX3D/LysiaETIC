/**
 * trendyolWebhookService.js â€” Trendyol Webhook Abonelik YÃ¶netimi
 *
 * Resmi dokÃ¼man: https://developers.trendyol.com/docs/marketplace/siparis-entegrasyonu/webhook
 *  - POST   /integration/webhook/sellers/{sellerId}/webhooks                â†’ abonelik oluÅŸtur
 *  - GET    /integration/webhook/sellers/{sellerId}/webhooks                â†’ abonelikleri listele
 *  - PUT    /integration/webhook/sellers/{sellerId}/webhooks/{id}           â†’ gÃ¼ncelle
 *  - DELETE /integration/webhook/sellers/{sellerId}/webhooks/{id}           â†’ sil
 *  - PUT    /integration/webhook/sellers/{sellerId}/webhooks/{id}/activate  â†’ aktifleÅŸtir
 *  - PUT    /integration/webhook/sellers/{sellerId}/webhooks/{id}/deactivateâ†’ pasifleÅŸtir
 */

const axios = require("axios");
const logger = require("../config/logger");
const { getTrendyolAuth } = require("./trendyolClaimsService");

const TY_WEBHOOK_BASE = "https://apigw.trendyol.com/integration/webhook";

/** SipariÅŸ statÃ¼ bildirimleri â€” abone olunabilecek statÃ¼ler */
const TY_WEBHOOK_STATUSES = [
    "CREATED", "PICKING", "INVOICED", "SHIPPED", "CANCELLED",
    "DELIVERED", "UNDELIVERED", "RETURNED", "UNSUPPLIED",
    "AWAITING", "UNPACKED", "AT_COLLECTION_POINT", "VERIFIED",
];

const headers = (auth) => ({
    Authorization: auth.authHeader,
    "Content-Type": "application/json",
    "User-Agent": `${auth.sellerId} - SelfIntegration`,
});

const extractError = (err) => {
    const data = err.response?.data;
    if (data?.errors?.length) {
        return data.errors.map((e) => e.message || e.key).join("; ");
    }
    if (typeof data?.message === "string") return data.message;
    return err.message || "Trendyol Webhook API hatasÄ±";
};

const listWebhooks = async (credentials) => {
    const auth = getTrendyolAuth(credentials);
    try {
        const resp = await axios.get(`${TY_WEBHOOK_BASE}/sellers/${auth.sellerId}/webhooks`, {
            headers: headers(auth),
            timeout: 20000,
        });
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.content || [];
        return { success: true, webhooks: list };
    } catch (err) {
        const msg = extractError(err);
        logger.error(`[TY Webhook] Liste hatasÄ±: ${msg}`);
        return { success: false, error: msg, webhooks: [] };
    }
};

/**
 * @param {object} opts - {
 *   url, username, password, apiKey,
 *   authenticationType: "BASIC_AUTHENTICATION" | "API_KEY",
 *   subscribedStatuses: string[]   // boÅŸ ise tÃ¼m statÃ¼ler
 * }
 */
const createWebhook = async (credentials, opts = {}) => {
    const auth = getTrendyolAuth(credentials);
    const url = String(opts.url || "").trim();
    if (!/^https:\/\//i.test(url)) {
        return { success: false, error: "Webhook URL https:// ile baÅŸlamalÄ±" };
    }

    const body = {
        url,
        authenticationType: opts.authenticationType ||
            (opts.apiKey ? "API_KEY" : "BASIC_AUTHENTICATION"),
        subscribedStatuses:
            Array.isArray(opts.subscribedStatuses) && opts.subscribedStatuses.length > 0
                ? opts.subscribedStatuses
                : TY_WEBHOOK_STATUSES,
    };
    if (body.authenticationType === "API_KEY") {
        body.apiKey = opts.apiKey || "";
    } else {
        body.username = opts.username || "";
        body.password = opts.password || "";
    }

    try {
        const resp = await axios.post(
            `${TY_WEBHOOK_BASE}/sellers/${auth.sellerId}/webhooks`,
            body,
            { headers: headers(auth), timeout: 20000 }
        );
        logger.info(`[TY Webhook] Abonelik oluÅŸturuldu: ${url}`);
        return { success: true, id: resp.data?.id || resp.data, webhook: resp.data };
    } catch (err) {
        const msg = extractError(err);
        logger.error(`[TY Webhook] OluÅŸturma hatasÄ±: ${msg}`);
        return { success: false, error: msg };
    }
};

const updateWebhook = async (credentials, webhookId, opts = {}) => {
    const auth = getTrendyolAuth(credentials);
    try {
        await axios.put(
            `${TY_WEBHOOK_BASE}/sellers/${auth.sellerId}/webhooks/${webhookId}`,
            opts,
            { headers: headers(auth), timeout: 20000 }
        );
        return { success: true, id: webhookId };
    } catch (err) {
        const msg = extractError(err);
        logger.error(`[TY Webhook] GÃ¼ncelleme hatasÄ± (${webhookId}): ${msg}`);
        return { success: false, error: msg };
    }
};

const deleteWebhook = async (credentials, webhookId) => {
    const auth = getTrendyolAuth(credentials);
    try {
        await axios.delete(`${TY_WEBHOOK_BASE}/sellers/${auth.sellerId}/webhooks/${webhookId}`, {
            headers: headers(auth),
            timeout: 20000,
        });
        logger.info(`[TY Webhook] Abonelik silindi: ${webhookId}`);
        return { success: true, id: webhookId };
    } catch (err) {
        const msg = extractError(err);
        logger.error(`[TY Webhook] Silme hatasÄ± (${webhookId}): ${msg}`);
        return { success: false, error: msg };
    }
};

const setWebhookActive = async (credentials, webhookId, active) => {
    const auth = getTrendyolAuth(credentials);
    const action = active ? "activate" : "deactivate";
    try {
        await axios.put(
            `${TY_WEBHOOK_BASE}/sellers/${auth.sellerId}/webhooks/${webhookId}/${action}`,
            {},
            { headers: headers(auth), timeout: 20000 }
        );
        return { success: true, id: webhookId, active };
    } catch (err) {
        const msg = extractError(err);
        logger.error(`[TY Webhook] ${action} hatasÄ± (${webhookId}): ${msg}`);
        return { success: false, error: msg };
    }
};

module.exports = {
    TY_WEBHOOK_STATUSES,
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    setWebhookActive,
};

