/**
 * Security Headers & Error Sanitization Middleware — LysiaETIC
 *
 * ✅ SEC: Production'da error.message sızıntısını önler
 * ✅ SEC: Ek güvenlik header'ları ekler
 * ✅ SEC: Powered-by header'ını kaldırır
 */

const logger = require("../config/logger");

/**
 * Production'da hata detaylarını gizle.
 * Development'ta debug için error.message göster.
 */
const sanitizeErrorMessage = (error) => {
    if (process.env.NODE_ENV === "production") {
        return "Sunucu hatası oluştu.";
    }
    return error?.message || "Bilinmeyen hata";
};

/**
 * Ek güvenlik header'ları ekleyen middleware
 */
const additionalSecurityHeaders = (req, res, next) => {
    // X-Powered-By zaten helmet tarafından kaldırılıyor ama emin olalım
    res.removeHeader("X-Powered-By");

    // Cache-Control: API response'ları cache'lenmemeli
    if (req.originalUrl.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.setHeader("Pragma", "no-cache");
    }

    // Permissions-Policy: Gereksiz browser API'lerini kapat
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

    next();
};

module.exports = { sanitizeErrorMessage, additionalSecurityHeaders };
