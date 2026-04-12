/**
 * Rate Limiter Middleware — LysiaETIC
 *
 * Brute-force ve DDoS saldırılarına karşı istek sınırlama.
 * ✅ v3: Kullanıcı bazlı key (token hash) — aynı IP farklı kullanıcılar çakışmaz
 * ✅ v3: Genel limit 1500, AI endpoint'leri tamamen muaf (kendi auth+cache koruması var)
 * ✅ v3: 429 response'a Retry-After header eklendi
 */

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const crypto = require("crypto");

/**
 * Kullanıcı bazlı key üretici — token varsa token hash, yoksa IP
 * Bu sayede aynı IP'den gelen farklı kullanıcılar birbirini etkilemez
 * ✅ v4: IPv6 uyumlu — ipKeyGenerator helper kullanılıyor
 */
const userKeyGenerator = (req) => {
    const auth = req.headers?.authorization;
    if (auth && auth.startsWith("Bearer ")) {
        // Token'ın ilk 32 karakterinin hash'i — hızlı ve unique
        const tokenPart = auth.slice(7, 39);
        return crypto.createHash("md5").update(tokenPart).digest("hex");
    }
    // Token yoksa IP bazlı (login/register gibi) — IPv6 uyumlu
    return ipKeyGenerator(req);
};

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
    validate: { xForwardedForHeader: false }
});

/**
 * Genel API rate limiter
 * 1 dakikada max 120 istek (kullanıcı bazlı)
 * Kısa window = hızlı reset, kullanıcı uzun süre beklemez
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 dakika (önceki: 15 dk — çok uzun bekleme süresi)
    max: 120,
    keyGenerator: userKeyGenerator,
    message: {
        success: false,
        message: "İstek limiti aşıldı. Lütfen biraz bekleyin.",
        retryAfter: 5
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    handler: (req, res, next, options) => {
        res.set("Retry-After", "5");
        res.status(429).json(options.message);
    }
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
