/**
 * Rate Limiter Middleware — LysiaETIC
 *
 * Brute-force ve DDoS saldırılarına karşı istek sınırlama.
 */

const rateLimit = require("express-rate-limit");

/**
 * Auth endpoint'leri için sıkı rate limiter
 * 15 dakikada max 20 deneme (login, register, forgot-password)
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 20,
    message: {
        success: false,
        message: "Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin."
    },
    standardHeaders: true,
    legacyHeaders: false,
    // IP bazlı sınırlama (varsayılan keyGenerator)
    validate: { xForwardedForHeader: false }
});

/**
 * Genel API rate limiter
 * 15 dakikada max 300 istek
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: {
        success: false,
        message: "İstek limiti aşıldı. Lütfen biraz bekleyin."
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Hassas işlemler için sıkı rate limiter
 * 1 saatte max 5 deneme (şifre değiştirme, API key oluşturma)
 */
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 saat
    max: 5,
    message: {
        success: false,
        message: "Bu işlem için çok fazla deneme yaptınız. Lütfen 1 saat sonra tekrar deneyin."
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    authLimiter,
    apiLimiter,
    sensitiveLimiter
};
