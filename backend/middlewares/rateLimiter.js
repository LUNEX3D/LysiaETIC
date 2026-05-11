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
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const { extractClientInfo, summarizeDevice } = require("../utils/deviceInfo");

// Modeller: server.js'de mongoose connect olduktan sonra yükleniyor.
// require() çağrıları lazy yapılmıyor çünkü middleware modüller server.js öncesi yüklenebilir.
// Lazy yükleme önemli — circular require'ı engeller ve modeller require sırasında bağlanır.
let AccessIncident, User, Notification;
function loadModels() {
    if (!AccessIncident) AccessIncident = require("../models/AccessIncident");
    if (!User) User = require("../models/User");
    if (!Notification) Notification = require("../models/Notification");
}

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

/** Bearer token'dan userId çıkar — secret'la verify edemezsek de decode et */
function tryExtractUserId(req) {
    try {
        const auth = req.headers?.authorization;
        if (!auth || !auth.startsWith("Bearer ")) return null;
        const token = auth.slice(7);
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return decoded?.id || null;
        } catch (_) {
            const decoded = jwt.decode(token);
            return decoded?.id || null;
        }
    } catch (_) {
        return null;
    }
}

/**
 * Rate-limit aşımı (429) yaşandığında çağrılır:
 *   1. AccessIncident kaydı oluştur (admin için iz)
 *   2. User.accessStatus.consecutiveRateLimitHits artır
 *   3. Eşiği aştıysa kullanıcıyı geçici (15dk) otomatik soft-block
 *   4. Admin'lere Notification yolla
 *
 * Asenkron ve hatalara dayanıklı — istek yanıtını bloklamaz.
 */
async function recordRateLimitIncident(req, options = {}) {
    try {
        loadModels();
        const { ip, userAgent, device } = extractClientInfo(req);
        const userId = tryExtractUserId(req);

        // 1. Incident kaydı
        const incident = await AccessIncident.create({
            userId: userId || null,
            type: "rate_limit_429",
            severity: "warning",
            description: `Rate-limit aşıldı (${req.method} ${req.originalUrl || req.url})`,
            ip,
            userAgent,
            device,
            endpoint: req.originalUrl || req.url || "",
            method: req.method || "",
            statusCode: 429,
            autoActionTaken: "none",
            metadata: {
                limiter: options.limiterName || "api",
                windowMs: options.windowMs || null,
                max: options.max || null,
            },
        });

        if (!userId) return; // anonim — sadece incident, otomatik blok yok

        // 2-3. Kullanıcı sayacını artır, eşik aşıldıysa otomatik blok
        const user = await User.findById(userId).select("accessStatus name email role");
        if (!user) return;
        if (!user.accessStatus) user.accessStatus = {};

        const now = new Date();
        user.accessStatus.lastRateLimitAt = now;
        user.accessStatus.totalIncidents = (user.accessStatus.totalIncidents || 0) + 1;
        // Son 10 dakika içinde aynı tip incident varsa sayacı arttır, yoksa sıfırla
        const recentWindow = 10 * 60 * 1000;
        const lastHit = user.accessStatus.lastRateLimitAt && (now - new Date(user.accessStatus.lastRateLimitAt)) < recentWindow;
        user.accessStatus.consecutiveRateLimitHits = (lastHit ? (user.accessStatus.consecutiveRateLimitHits || 0) : 0) + 1;
        user.accessStatus.lastIp = ip || user.accessStatus.lastIp;
        user.accessStatus.lastUserAgent = userAgent || user.accessStatus.lastUserAgent;
        user.accessStatus.lastSeenAt = now;

        const role = (user.role || "user").toLowerCase();
        const isAdminish = role === "admin" || role === "dev";
        const threshold = 5; // 10 dakika içinde 5 ardışık rate-limit aşımı → otomatik geçici blok
        const shouldAutoBlock =
            !isAdminish &&
            !user.accessStatus.isBlocked &&
            user.accessStatus.consecutiveRateLimitHits >= threshold;

        if (shouldAutoBlock) {
            user.accessStatus.isBlocked = true;
            user.accessStatus.blockReason = "rate_limit_abuse";
            user.accessStatus.blockedAt = now;
            user.accessStatus.blockedBy = null; // sistem
            user.accessStatus.blockExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 dk
            user.accessStatus.blockNote = `Sistem otomatik: 10 dk içinde ${user.accessStatus.consecutiveRateLimitHits} rate-limit aşımı.`;

            // Incident'i auto_block ile zenginleştir
            try {
                await AccessIncident.create({
                    userId,
                    type: "auto_block",
                    severity: "critical",
                    description: `Sistem otomatik blokladı — rate-limit aşımı (${user.accessStatus.consecutiveRateLimitHits} ardışık).`,
                    ip,
                    userAgent,
                    device,
                    endpoint: req.originalUrl || req.url || "",
                    method: req.method || "",
                    statusCode: 429,
                    autoActionTaken: "block_15m",
                    metadata: {
                        triggerIncidentId: incident._id,
                        consecutiveHits: user.accessStatus.consecutiveRateLimitHits,
                        thresholdUsed: threshold,
                    },
                });
            } catch (e) {
                logger.warn(`[RateLimit] auto_block incident yazılamadı: ${e.message}`);
            }

            // 4. Tüm admin/dev'lere bildirim yolla
            try {
                const admins = await User.find({ role: { $in: ["admin", "dev"] } }).select("_id");
                if (admins.length > 0) {
                    const notifs = admins.map(a => ({
                        userId: a._id,
                        type: "system",
                        priority: "high",
                        title: "Kullanıcı otomatik bloklandı",
                        message: `${user.name || user.email} kullanıcısı 10 dk içinde ${user.accessStatus.consecutiveRateLimitHits} rate-limit aşımı yaptı. 15 dk geçici blok uygulandı. Cihaz: ${summarizeDevice(device)} — IP: ${ip || "?"}`,
                        icon: "🚫",
                        actionLink: "/admin/access-control",
                    }));
                    await Notification.insertMany(notifs);
                }
            } catch (e) {
                logger.warn(`[RateLimit] admin notification yazılamadı: ${e.message}`);
            }
        }

        await user.save();
    } catch (err) {
        logger.warn(`[RateLimit] incident yazılamadı: ${err.message}`);
    }
}

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
    validate: { xForwardedForHeader: false },
    handler: (req, res, next, options) => {
        // Auth endpoint'inde 429 → AccessIncident ata (kullanıcı bilinmiyor olabilir, sadece IP)
        recordRateLimitIncident(req, { limiterName: "auth", windowMs: 15 * 60 * 1000, max: 20 })
            .catch(() => {});
        res.set("Retry-After", "60");
        res.status(429).json(options.message);
    }
});

/**
 * Genel API rate limiter
 * 1 dakikada max 120 istek (kullanıcı bazlı)
 * Kısa window = hızlı reset, kullanıcı uzun süre beklemez
 *
 * 429 olduğunda:
 *   • AccessIncident kaydı oluşturur
 *   • 10dk içinde 5+ ardışık aşımda kullanıcıyı otomatik 15dk soft-block eder
 *   • Tüm admin/dev'lere bildirim gönderir
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
        recordRateLimitIncident(req, { limiterName: "api", windowMs: 60 * 1000, max: 120 })
            .catch(() => {});
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
