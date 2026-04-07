/**
 * XSS Sanitization Middleware — LysiaETIC
 *
 * Tüm gelen request body'lerindeki string değerlerden
 * HTML tag'lerini ve potansiyel XSS payload'larını temizler.
 *
 * sanitize-html kütüphanesi kullanılır (allowedTags: [] = hiçbir HTML'e izin verme).
 *
 * ✅ SEC #1: XSS koruması
 */

const sanitizeHtml = require("sanitize-html");
const logger = require("../config/logger");

// sanitize-html ayarları — hiçbir HTML tag'ine izin verme
const SANITIZE_OPTIONS = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "recursiveEscape"
};

/**
 * Bir değeri recursive olarak sanitize eder.
 * - String → HTML tag'leri temizlenir
 * - Object → her key recursive olarak sanitize edilir
 * - Array → her eleman recursive olarak sanitize edilir
 * - Diğer tipler (number, boolean, null) → olduğu gibi döner
 */
function sanitizeValue(value) {
    if (typeof value === "string") {
        return sanitizeHtml(value, SANITIZE_OPTIONS);
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item));
    }

    if (value !== null && typeof value === "object") {
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeValue(val);
        }
        return sanitized;
    }

    return value;
}

/**
 * Express middleware — req.body'deki tüm string değerleri sanitize eder.
 * GET istekleri ve PayTR callback'i atlanır.
 */
const sanitizeBody = (req, res, next) => {
    // GET isteklerinde body olmaz, atla
    if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") {
        return next();
    }

    // PayTR callback'i atla — PayTR kendi formatında veri gönderir
    if (req.originalUrl === "/api/paytr/callback") {
        return next();
    }

    // Body varsa sanitize et
    if (req.body && typeof req.body === "object") {
        try {
            req.body = sanitizeValue(req.body);
        } catch (err) {
            logger.error(`XSS sanitization hatası: ${err.message}`);
            // Hata durumunda orijinal body ile devam et
        }
    }

    next();
};

module.exports = { sanitizeBody, sanitizeValue };
