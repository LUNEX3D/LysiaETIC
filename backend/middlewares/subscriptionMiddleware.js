/**
 * Subscription Middleware — LysiaETIC
 *
 * Kullanıcının aktif aboneliği olup olmadığını kontrol eder.
 * Admin ve dev kullanıcılar muaf tutulur.
 *
 * ✅ v2: Her 403'e açıklayıcı `code` eklendi (SUBSCRIPTION_EXPIRED, TRIAL_ENDED, ...)
 * ✅ v2: 403 durumları AccessIncident'a otomatik loglanır — admin "neden 403?" sorusuna cevap bulabilsin
 */

const logger = require("../config/logger");
const { extractClientInfo } = require("../utils/deviceInfo");

// Lazy require — circular dependency olmasın diye
let AccessIncident;
function getAccessIncident() {
    if (!AccessIncident) AccessIncident = require("../models/AccessIncident");
    return AccessIncident;
}

/** 403 olaylarını AccessIncident'a yaz (asenkron, hatalara dayanıklı) */
function logSubscriptionIncident(req, type, severity, description, metadata = {}) {
    try {
        const Model = getAccessIncident();
        const ci = extractClientInfo(req);
        // fire-and-forget — response'u bekletme
        Model.create({
            userId: req.user?._id || null,
            email: req.user?.email || "",
            type,
            severity,
            description,
            ip: ci.ip,
            userAgent: ci.userAgent,
            device: ci.device,
            endpoint: req.originalUrl || req.url || "",
            method: req.method || "",
            statusCode: 403,
            metadata,
        }).catch(err => logger.warn(`[Subscription] incident yazılamadı: ${err.message}`));
    } catch (e) {
        logger.warn(`[Subscription] incident hata: ${e.message}`);
    }
}

const subscriptionMiddleware = async (req, res, next) => {
    try {
        // Admin ve dev kullanıcılar muaf
        if (req.user && ["admin", "dev"].includes(req.user.role)) {
            return next();
        }

        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                code: "AUTH_REQUIRED",
                message: "Yetkilendirme gerekli"
            });
        }

        const sub = user.subscription || {};
        const now = new Date();

        // Trial kontrolü
        if (sub.status === "trial" || sub.plan === "trial") {
            const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
            if (trialEnd && trialEnd > now) {
                // Trial aktif
                req.subscriptionPlan = "trial";
                req.subscriptionDaysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                return next();
            }
            // Trial süresi dolmuş
            logSubscriptionIncident(req, "trial_ended", "warning",
                `Trial süresi dolmuş — bitiş: ${trialEnd ? trialEnd.toISOString() : "kayıt yok"}`,
                { trialEndDate: sub.trialEndDate, plan: sub.plan });
            return res.status(403).json({
                success: false,
                code: "TRIAL_ENDED",
                subscriptionExpired: true,
                message: "Demo süreniz dolmuştur. Devam etmek için bir paket satın alın.",
                plan: "trial",
                expired: true,
                trialEndDate: sub.trialEndDate || null,
            });
        }

        // Aktif abonelik kontrolü
        if (sub.status === "active") {
            const endDate = sub.endDate ? new Date(sub.endDate) : null;
            if (endDate && endDate > now) {
                // Abonelik aktif
                req.subscriptionPlan = sub.plan;
                req.subscriptionDaysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                return next();
            }
            // Abonelik süresi dolmuş — durumu güncelle
            user.subscription.status = "expired";
            await user.save();
            logSubscriptionIncident(req, "subscription_expired", "warning",
                `Aktif abonelik süresi dolmuş — endDate: ${endDate ? endDate.toISOString() : "yok"} (status active'den expired'a alındı)`,
                { plan: sub.plan, endDate: sub.endDate, previousStatus: "active" });

            return res.status(403).json({
                success: false,
                code: "SUBSCRIPTION_EXPIRED",
                subscriptionExpired: true,
                message: "Abonelik süreniz dolmuştur. Lütfen yenileyin.",
                plan: sub.plan,
                expired: true,
                endDate: sub.endDate || null,
            });
        }

        // Suspended veya cancelled
        if (sub.status === "suspended") {
            logSubscriptionIncident(req, "subscription_suspended", "error",
                "Abonelik suspended durumda — admin tarafından askıya alınmış olabilir",
                { plan: sub.plan, status: sub.status });
            return res.status(403).json({
                success: false,
                code: "SUBSCRIPTION_SUSPENDED",
                subscriptionSuspended: true,
                message: "Hesabınız askıya alınmıştır. Destek ile iletişime geçin."
            });
        }

        // Hiç abonelik yok veya expired
        logSubscriptionIncident(req, sub.status === "expired" ? "subscription_expired" : "no_subscription",
            "warning",
            sub.status === "expired"
                ? `Abonelik expired durumda — yenileme gerekiyor`
                : "Kullanıcının hiç aktif aboneliği yok (status: " + (sub.status || "yok") + ")",
            { plan: sub.plan, status: sub.status });
        return res.status(403).json({
            success: false,
            code: sub.status === "expired" ? "SUBSCRIPTION_EXPIRED" : "NO_SUBSCRIPTION",
            subscriptionExpired: true,
            message: sub.status === "expired"
                ? "Abonelik süreniz dolmuştur. Lütfen yenileyin."
                : "Aktif bir aboneliğiniz bulunmamaktadır. Lütfen bir paket satın alın.",
            plan: sub.plan || "",
            status: sub.status || "",
            expired: true
        });
    } catch (error) {
        logger.error(`Subscription middleware hatası: ${error.message}`);
        // ✅ SEC #4: Hata durumunda erişimi ENGELLE — bypass kapatıldı
        return res.status(500).json({
            success: false,
            code: "SUBSCRIPTION_CHECK_ERROR",
            message: "Abonelik kontrolü sırasında bir hata oluştu. Lütfen tekrar deneyin."
        });
    }
};

module.exports = { subscriptionMiddleware };
