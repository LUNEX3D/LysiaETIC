/**
 * Subscription Middleware — LysiaETIC
 *
 * Kullanıcının aktif aboneliği olup olmadığını kontrol eder.
 * Admin ve dev kullanıcılar muaf tutulur.
 */

const logger = require("../config/logger");

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
            return res.status(403).json({
                success: false,
                subscriptionExpired: true,
                message: "Demo süreniz dolmuştur. Devam etmek için bir paket satın alın.",
                plan: "trial",
                expired: true
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

            return res.status(403).json({
                success: false,
                subscriptionExpired: true,
                message: "Abonelik süreniz dolmuştur. Lütfen yenileyin.",
                plan: sub.plan,
                expired: true
            });
        }

        // Suspended veya cancelled
        if (sub.status === "suspended") {
            return res.status(403).json({
                success: false,
                subscriptionSuspended: true,
                message: "Hesabınız askıya alınmıştır. Destek ile iletişime geçin."
            });
        }

        // Hiç abonelik yok — expired olarak işaretle
        return res.status(403).json({
            success: false,
            subscriptionExpired: true,
            message: "Aktif bir aboneliğiniz bulunmamaktadır. Lütfen bir paket satın alın.",
            expired: true
        });
    } catch (error) {
        logger.error(`Subscription middleware hatası: ${error.message}`);
        // ✅ SEC #4: Hata durumunda erişimi ENGELLE — bypass kapatıldı
        // Eski davranış: next() ile geçişe izin veriliyordu → abonelik kontrolü atlanabiliyordu
        return res.status(500).json({
            success: false,
            message: "Abonelik kontrolü sırasında bir hata oluştu. Lütfen tekrar deneyin."
        });
    }
};

module.exports = { subscriptionMiddleware };
