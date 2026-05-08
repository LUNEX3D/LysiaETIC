const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const logger = require("../config/logger");

const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    keyGenerator: (req) => ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Webhook istek limiti aşıldı." },
});

function getProviderEnv(prefix, key) {
    return process.env[`${prefix}_${key}`];
}

function safeCompare(a, b) {
    const aa = Buffer.from(String(a || ""), "utf8");
    const bb = Buffer.from(String(b || ""), "utf8");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
}

function verifyWebhookToken(providerPrefix) {
    return (req, res, next) => {
        const expected = getProviderEnv(providerPrefix, "WEBHOOK_TOKEN");
        if (!expected) {
            logger.error(`[WEBHOOK] ${providerPrefix} WEBHOOK_TOKEN tanımlı değil`);
            return res.status(503).json({ success: false, message: "Webhook güvenlik yapılandırması eksik" });
        }

        const headerToken =
            req.headers["x-webhook-token"] ||
            req.headers["x-api-key"] ||
            (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

        if (!safeCompare(headerToken, expected)) {
            logger.warn(`[WEBHOOK] ${providerPrefix} token doğrulama başarısız`, { ip: req.ip });
            return res.status(401).json({ success: false, message: "Webhook token doğrulanamadı" });
        }
        return next();
    };
}

function verifyWebhookSignature(providerPrefix) {
    return (req, res, next) => {
        const secret = getProviderEnv(providerPrefix, "WEBHOOK_SECRET");
        if (!secret) {
            logger.error(`[WEBHOOK] ${providerPrefix} WEBHOOK_SECRET tanımlı değil`);
            return res.status(503).json({ success: false, message: "Webhook imza yapılandırması eksik" });
        }

        const signature = req.headers["x-webhook-signature"] || req.headers["x-signature"];
        if (!signature) {
            return res.status(401).json({ success: false, message: "Webhook signature eksik" });
        }

        const payload = JSON.stringify(req.body || {});
        const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
        if (!safeCompare(signature, expected)) {
            logger.warn(`[WEBHOOK] ${providerPrefix} imza doğrulama başarısız`, { ip: req.ip });
            return res.status(401).json({ success: false, message: "Webhook signature geçersiz" });
        }
        return next();
    };
}

module.exports = {
    webhookRateLimiter,
    verifyWebhookToken,
    verifyWebhookSignature,
};

