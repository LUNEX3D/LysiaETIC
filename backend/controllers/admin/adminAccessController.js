/**
 * Admin Access Control Controller — LysiaETIC
 *
 * Erişim engelleri ve incident kayıtlarını yöneten admin endpoint'leri.
 * Tüm endpoint'ler authMiddleware + adminMiddleware arkasında çalışır.
 */

const AccessIncident = require("../../models/AccessIncident");
const User = require("../../models/User");
const Notification = require("../../models/Notification");
const AuditLog = require("../../models/AuditLog");
const logger = require("../../config/logger");
const { extractClientInfo, summarizeDevice } = require("../../utils/deviceInfo");

/** İnsanca okunabilir blokaj sebebi */
const REASON_LABELS = {
    rate_limit_abuse: "Aşırı istek (rate-limit)",
    suspicious_activity: "Şüpheli aktivite",
    admin_manual: "Admin tarafından manuel",
    payment_overdue: "Ödeme gecikmesi",
    tos_violation: "Kullanım koşulu ihlali",
    security_concern: "Güvenlik şüphesi",
};

const TYPE_LABELS = {
    rate_limit_429: "Rate-limit aşımı",
    auth_failed: "Login başarısız",
    auth_token_invalid: "Geçersiz token",
    blocked_attempt: "Bloklu erişim denemesi",
    suspicious_activity: "Şüpheli aktivite",
    auto_block: "Otomatik blok",
    auto_unblock: "Otomatik açma",
    admin_block: "Admin blok",
    admin_unblock: "Admin açma",
    help_request: "Yardım talebi",
    subscription_expired: "Abonelik süresi dolmuş",
    subscription_suspended: "Abonelik askıya alınmış",
    trial_ended: "Trial süresi dolmuş",
    no_subscription: "Aboneliği yok",
    admin_required: "Admin yetkisi gerekiyor",
    role_denied: "Rol yetkisi reddedildi",
};

/**
 * GET /admin/access/incidents
 * Query: type, severity, resolved, userId, ip, q (text), from, to, page, limit
 */
exports.listIncidents = async (req, res) => {
    try {
        const {
            type, severity, resolved, userId, ip, q,
            from, to,
            page = 1, limit = 50,
        } = req.query || {};

        const filter = {};
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        if (resolved !== undefined && resolved !== "") {
            filter.resolved = resolved === "true" || resolved === true;
        }
        if (userId) filter.userId = userId;
        if (ip) filter.ip = ip;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }
        if (q && String(q).trim().length > 0) {
            const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [
                { description: rx },
                { email: rx },
                { ip: rx },
                { endpoint: rx },
                { userAgent: rx },
            ];
        }

        const lim = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
        const skip = Math.max(0, (parseInt(page, 10) - 1) * lim);

        const [items, total, counts] = await Promise.all([
            AccessIncident.find(filter)
                .populate("userId", "name email role accessStatus.isBlocked accessStatus.blockReason")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(lim)
                .lean(),
            AccessIncident.countDocuments(filter),
            // KPI: toplam ve kritik/uyarı sayımları (son 7 gün)
            (async () => {
                const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const [last7, critical7, unresolved] = await Promise.all([
                    AccessIncident.countDocuments({ createdAt: { $gte: since } }),
                    AccessIncident.countDocuments({ createdAt: { $gte: since }, severity: "critical" }),
                    AccessIncident.countDocuments({ resolved: false }),
                ]);
                return { last7, critical7, unresolved };
            })(),
        ]);

        const formatted = items.map(it => ({
            ...it,
            typeLabel: TYPE_LABELS[it.type] || it.type,
            severityLabel: it.severity,
            deviceSummary: summarizeDevice(it.device || {}),
        }));

        res.json({
            success: true,
            data: formatted,
            pagination: {
                page: parseInt(page, 10) || 1,
                limit: lim,
                total,
                totalPages: Math.ceil(total / lim),
            },
            counts,
            labels: { types: TYPE_LABELS, reasons: REASON_LABELS },
        });
    } catch (err) {
        logger.error("[AdminAccess] listIncidents hata: " + err.message);
        res.status(500).json({ success: false, message: "Incident'lar getirilemedi: " + err.message });
    }
};

/**
 * GET /admin/access/blocked-users
 * Şu an erişimi engellenmiş tüm kullanıcılar
 */
exports.listBlockedUsers = async (req, res) => {
    try {
        const users = await User.find({ "accessStatus.isBlocked": true })
            .select("name email role accessStatus subscription.plan subscription.status createdAt")
            .populate("accessStatus.blockedBy", "name email")
            .sort({ "accessStatus.blockedAt": -1 })
            .lean();

        const formatted = users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            plan: u.subscription?.plan,
            subscriptionStatus: u.subscription?.status,
            createdAt: u.createdAt,
            accessStatus: {
                ...u.accessStatus,
                blockReasonLabel: REASON_LABELS[u.accessStatus?.blockReason] || u.accessStatus?.blockReason || "—",
                blockedByName: u.accessStatus?.blockedBy?.name || "Sistem",
                blockedByEmail: u.accessStatus?.blockedBy?.email || "",
                expiresIn: u.accessStatus?.blockExpiresAt
                    ? Math.max(0, new Date(u.accessStatus.blockExpiresAt).getTime() - Date.now())
                    : null,
            },
        }));

        res.json({ success: true, data: formatted, total: formatted.length });
    } catch (err) {
        logger.error("[AdminAccess] listBlockedUsers hata: " + err.message);
        res.status(500).json({ success: false, message: "Bloklu kullanıcılar getirilemedi: " + err.message });
    }
};

/**
 * POST /admin/access/users/:id/unblock
 * Body: { note?: string }
 * Admin manuel olarak erişimi açar.
 */
exports.unblockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const note = String(req.body?.note || "").trim();
        const adminId = req.user?._id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        if (!user.accessStatus) user.accessStatus = {};
        const wasBlocked = !!user.accessStatus.isBlocked;
        user.accessStatus.isBlocked = false;
        user.accessStatus.blockReason = "";
        user.accessStatus.blockedAt = undefined;
        user.accessStatus.blockedBy = undefined;
        user.accessStatus.blockExpiresAt = undefined;
        user.accessStatus.blockNote = "";
        user.accessStatus.consecutiveRateLimitHits = 0;
        await user.save();

        try {
            const clientInfo = extractClientInfo(req);
            await AccessIncident.create({
                userId,
                type: "admin_unblock",
                severity: "info",
                description: `Admin (${req.user?.email || adminId}) erişimi açtı. ${note ? "Not: " + note : ""}`.trim(),
                ip: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                device: clientInfo.device,
                endpoint: req.originalUrl || "",
                method: req.method || "",
                statusCode: 200,
                resolved: true,
                resolvedAt: new Date(),
                resolvedBy: adminId,
                resolutionNote: note,
                metadata: { wasBlocked, performedBy: adminId },
            });
            await AuditLog.create({
                userId: adminId,
                action: "admin_unblock_user",
                category: "security",
                severity: "info",
                description: `${user.name || user.email} kullanıcısının erişim engeli kaldırıldı.`,
                metadata: { targetUserId: userId, note, wasBlocked },
                success: true,
            });
            // Kullanıcıya da bildirim düş
            await Notification.create({
                userId,
                type: "system",
                priority: "high",
                title: "Erişiminiz yeniden açıldı",
                message: note ? `Yönetici notu: ${note}` : "Hesabınıza erişim yeniden sağlandı.",
                icon: "✅",
            });
        } catch (e) {
            logger.warn(`[AdminAccess] unblock ek log/notif hata: ${e.message}`);
        }

        res.json({ success: true, message: "Kullanıcı erişimi açıldı.", user: {
            _id: user._id,
            email: user.email,
            accessStatus: user.accessStatus,
        }});
    } catch (err) {
        logger.error("[AdminAccess] unblockUser hata: " + err.message);
        res.status(500).json({ success: false, message: "Erişim açma hatası: " + err.message });
    }
};

/**
 * POST /admin/access/users/:id/block
 * Body: { reason, note?, expiresInMinutes? (null=süresiz) }
 */
exports.blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason, note = "", expiresInMinutes = null } = req.body || {};
        const adminId = req.user?._id;

        const allowed = ["admin_manual", "suspicious_activity", "payment_overdue", "tos_violation", "security_concern"];
        if (!reason || !allowed.includes(reason)) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz sebep. İzin verilen: " + allowed.join(", "),
            });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        // Admin/dev rolünü blok etmesin
        const role = (user.role || "").toLowerCase();
        if (role === "admin" || role === "dev") {
            return res.status(400).json({ success: false, message: "Admin/dev kullanıcılar bloklanamaz." });
        }

        if (!user.accessStatus) user.accessStatus = {};
        const now = new Date();
        user.accessStatus.isBlocked = true;
        user.accessStatus.blockReason = reason;
        user.accessStatus.blockedAt = now;
        user.accessStatus.blockedBy = adminId;
        user.accessStatus.blockNote = String(note || "");
        user.accessStatus.blockExpiresAt = expiresInMinutes && Number(expiresInMinutes) > 0
            ? new Date(now.getTime() + Number(expiresInMinutes) * 60 * 1000)
            : undefined; // süresiz
        await user.save();

        try {
            const clientInfo = extractClientInfo(req);
            await AccessIncident.create({
                userId,
                type: "admin_block",
                severity: "critical",
                description: `Admin (${req.user?.email || adminId}) manuel bloklama. Sebep: ${REASON_LABELS[reason] || reason}. ${note ? "Not: " + note : ""}`.trim(),
                ip: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                device: clientInfo.device,
                endpoint: req.originalUrl || "",
                method: req.method || "",
                statusCode: 200,
                autoActionTaken: expiresInMinutes ? `block_${expiresInMinutes}m` : "block_indefinite",
                metadata: { reason, note, expiresInMinutes, performedBy: adminId },
            });
            await AuditLog.create({
                userId: adminId,
                action: "admin_block_user",
                category: "security",
                severity: "warning",
                description: `${user.name || user.email} kullanıcısı bloklandı: ${REASON_LABELS[reason] || reason}`,
                metadata: { targetUserId: userId, reason, note, expiresInMinutes },
                success: true,
            });
            await Notification.create({
                userId,
                type: "system",
                priority: "critical",
                title: "Hesabınıza erişim kısıtlandı",
                message: note || (REASON_LABELS[reason] || "Detay için destek ile iletişime geçin."),
                icon: "🚫",
            });
        } catch (e) {
            logger.warn(`[AdminAccess] block ek log/notif hata: ${e.message}`);
        }

        res.json({ success: true, message: "Kullanıcı bloklandı.", user: {
            _id: user._id,
            email: user.email,
            accessStatus: user.accessStatus,
        }});
    } catch (err) {
        logger.error("[AdminAccess] blockUser hata: " + err.message);
        res.status(500).json({ success: false, message: "Bloklama hatası: " + err.message });
    }
};

/**
 * GET /admin/access/users/:id/history
 * Bir kullanıcının tüm AccessIncident geçmişi (son 200)
 */
exports.getUserAccessHistory = async (req, res) => {
    try {
        const userId = req.params.id;
        const [user, incidents] = await Promise.all([
            User.findById(userId).select("name email role accessStatus security.loginHistory createdAt").lean(),
            AccessIncident.find({ userId })
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
        ]);

        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        // IP / cihaz frekans haritası
        const ipMap = new Map();
        const deviceMap = new Map();
        for (const inc of incidents) {
            if (inc.ip) ipMap.set(inc.ip, (ipMap.get(inc.ip) || 0) + 1);
            const ds = summarizeDevice(inc.device || {});
            if (ds && ds !== "Bilinmiyor") deviceMap.set(ds, (deviceMap.get(ds) || 0) + 1);
        }

        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                accessStatus: {
                    ...user.accessStatus,
                    blockReasonLabel: REASON_LABELS[user.accessStatus?.blockReason] || user.accessStatus?.blockReason || "",
                },
                loginHistory: (user.security?.loginHistory || []).slice(-50),
            },
            incidents: incidents.map(i => ({
                ...i,
                typeLabel: TYPE_LABELS[i.type] || i.type,
                deviceSummary: summarizeDevice(i.device || {}),
            })),
            stats: {
                totalIncidents: incidents.length,
                topIps: [...ipMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, count]) => ({ ip, count })),
                topDevices: [...deviceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([device, count]) => ({ device, count })),
            },
        });
    } catch (err) {
        logger.error("[AdminAccess] getUserAccessHistory hata: " + err.message);
        res.status(500).json({ success: false, message: "Geçmiş getirilemedi: " + err.message });
    }
};

/**
 * POST /admin/access/incidents/:id/resolve
 * Body: { note?: string }
 * Bir incident'i "incelendi/çözüldü" olarak işaretle.
 */
exports.resolveIncident = async (req, res) => {
    try {
        const inc = await AccessIncident.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    resolved: true,
                    resolvedAt: new Date(),
                    resolvedBy: req.user?._id,
                    resolutionNote: String(req.body?.note || ""),
                },
            },
            { new: true }
        );
        if (!inc) return res.status(404).json({ success: false, message: "Incident bulunamadı." });
        res.json({ success: true, incident: inc });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /access/my-status
 * Kullanıcı kendi erişim durumunu görür — "neden 403 alıyorum?" sorusuna self-service cevap.
 * Bloklu kullanıcı da çağırabilmesi için softAuth altında.
 */
exports.getMyStatus = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme gerekli." });

        const user = await User.findById(userId)
            .select("name email role subscription accessStatus security.loginHistory createdAt")
            .lean();

        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        const now = new Date();
        const sub = user.subscription || {};
        const acc = user.accessStatus || {};

        // Abonelik durumu özeti
        const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
        const endDate = sub.endDate ? new Date(sub.endDate) : null;
        const isTrial = sub.status === "trial" || sub.plan === "trial";
        const trialActive = isTrial && trialEnd && trialEnd > now;
        const subActive = sub.status === "active" && endDate && endDate > now;
        const subscriptionState =
            trialActive ? "trial_active" :
            subActive ? "active" :
            sub.status === "suspended" ? "suspended" :
            isTrial ? "trial_expired" :
            sub.status === "expired" ? "expired" :
            "missing";

        const daysLeft = trialActive ? Math.ceil((trialEnd - now) / 86400000)
            : subActive ? Math.ceil((endDate - now) / 86400000)
            : 0;

        // Son 30 günde aldığı incident'ler
        const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recent = await AccessIncident.find({
            userId,
            createdAt: { $gte: since },
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Otomatik teşhis (kullanıcının görmesi için sade Türkçe)
        const reasons = [];
        if (acc.isBlocked) {
            reasons.push({
                code: "ACCESS_BLOCKED",
                title: "Hesabınız geçici olarak bloklu",
                detail: REASON_LABELS[acc.blockReason] || acc.blockReason || "Detay yok",
                resolution: acc.blockExpiresAt
                    ? `Otomatik bitiş: ${new Date(acc.blockExpiresAt).toLocaleString("tr-TR")}`
                    : "Yardım talebi gönderebilirsiniz.",
                severity: "critical",
            });
        }
        if (subscriptionState === "trial_expired") {
            reasons.push({
                code: "TRIAL_ENDED",
                title: "Demo süreniz dolmuş",
                detail: trialEnd ? `Trial bitişi: ${trialEnd.toLocaleString("tr-TR")}` : "Trial bilgisi bulunamadı.",
                resolution: "Bir paket satın alarak devam edebilirsiniz.",
                severity: "warning",
            });
        }
        if (subscriptionState === "expired") {
            reasons.push({
                code: "SUBSCRIPTION_EXPIRED",
                title: "Abonelik süreniz dolmuş",
                detail: endDate ? `Bitiş: ${endDate.toLocaleString("tr-TR")}` : "Bitiş bilgisi bulunamadı.",
                resolution: "Abonelik yenileme sayfasından planınızı uzatabilirsiniz.",
                severity: "warning",
            });
        }
        if (subscriptionState === "suspended") {
            reasons.push({
                code: "SUBSCRIPTION_SUSPENDED",
                title: "Hesabınız askıya alınmış",
                detail: "Yönetici tarafından askıya alındı.",
                resolution: "Destek ile iletişime geçin.",
                severity: "error",
            });
        }
        if (subscriptionState === "missing") {
            reasons.push({
                code: "NO_SUBSCRIPTION",
                title: "Aktif aboneliğiniz yok",
                detail: "Hesabınızda aktif bir abonelik kaydı bulunmuyor.",
                resolution: "Paket seçim sayfasından bir abonelik başlatın.",
                severity: "warning",
            });
        }

        res.json({
            success: true,
            canAccess: reasons.length === 0,
            reasons,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
            subscription: {
                state: subscriptionState,
                plan: sub.plan,
                status: sub.status,
                trialEndDate: sub.trialEndDate,
                endDate: sub.endDate,
                daysLeft,
            },
            accessStatus: {
                ...acc,
                blockReasonLabel: REASON_LABELS[acc.blockReason] || "",
            },
            recentIncidents: recent.map(i => ({
                _id: i._id,
                type: i.type,
                typeLabel: TYPE_LABELS[i.type] || i.type,
                severity: i.severity,
                description: i.description,
                createdAt: i.createdAt,
                endpoint: i.endpoint,
                statusCode: i.statusCode,
            })),
        });
    } catch (err) {
        logger.error("[AdminAccess] getMyStatus hata: " + err.message);
        res.status(500).json({ success: false, message: "Durum bilgisi alınamadı: " + err.message });
    }
};

/**
 * GET /access/diagnose?email=<email> | ?userId=<id>
 * Admin tanı aracı: bir kullanıcının neden 403 aldığını çoklu sinyal ile analiz eder.
 *
 * Çıktıda:
 *   • Aktif sorunlar (subscription, block, vs.)
 *   • Son 50 incident özeti
 *   • Son 24 saatte aldığı 403 tipleri
 *   • Önerilen aksiyon (uzat / blokaj kaldır / planı yenile)
 */
exports.diagnoseUser = async (req, res) => {
    try {
        const { email, userId } = req.query;
        if (!email && !userId) {
            return res.status(400).json({ success: false, message: "email veya userId gerekli." });
        }

        const query = userId ? { _id: userId } : { email: String(email).trim().toLowerCase() };
        const user = await User.findOne(query)
            .select("name email role subscription accessStatus createdAt security.loginHistory")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: `Kullanıcı bulunamadı (${email || userId}).`,
                hint: "E-postayı doğru yazdığınızdan emin olun veya AdminUsers sayfasından arayın.",
            });
        }

        const now = new Date();
        const sub = user.subscription || {};
        const acc = user.accessStatus || {};

        // Subscription analiz
        const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
        const endDate = sub.endDate ? new Date(sub.endDate) : null;
        const isTrial = sub.status === "trial" || sub.plan === "trial";
        const trialActive = isTrial && trialEnd && trialEnd > now;
        const subActive = sub.status === "active" && endDate && endDate > now;
        const subscriptionState =
            trialActive ? "trial_active" :
            subActive ? "active" :
            sub.status === "suspended" ? "suspended" :
            isTrial ? "trial_expired" :
            sub.status === "expired" ? "expired" :
            "missing";

        // Son 50 incident + son 24 saat 403 tipleri
        const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [incidents, last24hAgg] = await Promise.all([
            AccessIncident.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            AccessIncident.aggregate([
                { $match: { userId: user._id, createdAt: { $gte: since24h }, statusCode: 403 } },
                { $group: { _id: "$type", count: { $sum: 1 } } },
            ]),
        ]);

        // Aktif sorunlar tespiti
        const issues = [];
        const actions = []; // önerilen admin aksiyonları

        if (acc.isBlocked) {
            issues.push({
                severity: "critical",
                code: "ACCESS_BLOCKED",
                title: `Erişim bloklu — ${REASON_LABELS[acc.blockReason] || acc.blockReason || "sebep belirsiz"}`,
                detail: `Engel zamanı: ${acc.blockedAt ? new Date(acc.blockedAt).toLocaleString("tr-TR") : "—"}` +
                    (acc.blockExpiresAt ? `, Bitiş: ${new Date(acc.blockExpiresAt).toLocaleString("tr-TR")}` : ", Süresiz"),
                note: acc.blockNote || "",
            });
            actions.push({
                action: "unblock",
                label: "Erişim Engelini Kaldır",
                endpoint: `/access/users/${user._id}/unblock`,
                method: "POST",
                primary: true,
            });
        }

        if (subscriptionState === "trial_expired") {
            issues.push({
                severity: "warning",
                code: "TRIAL_ENDED",
                title: "Demo süresi dolmuş",
                detail: `Trial bitişi: ${trialEnd ? trialEnd.toLocaleString("tr-TR") : "—"}`,
            });
            actions.push({
                action: "extend_trial",
                label: "Trial Uzat (+7 gün)",
                endpoint: `/saas-admin/users/${user._id}/grant-subscription`,
                method: "POST",
                hint: "AdminSubscriptionManager üzerinden plan atayabilirsiniz.",
            });
        }
        if (subscriptionState === "expired") {
            issues.push({
                severity: "warning",
                code: "SUBSCRIPTION_EXPIRED",
                title: "Abonelik süresi dolmuş",
                detail: `Plan: ${sub.plan || "—"}, Bitiş: ${endDate ? endDate.toLocaleString("tr-TR") : "—"}`,
            });
            actions.push({
                action: "renew_subscription",
                label: "Aboneliği Uzat",
                hint: "AdminSubscriptionManager → Plan Ata sayfasından uzatın.",
            });
        }
        if (subscriptionState === "suspended") {
            issues.push({
                severity: "error",
                code: "SUBSCRIPTION_SUSPENDED",
                title: "Abonelik askıya alınmış",
                detail: `Admin tarafından askıya alınma. Plan: ${sub.plan || "—"}`,
            });
        }
        if (subscriptionState === "missing") {
            issues.push({
                severity: "warning",
                code: "NO_SUBSCRIPTION",
                title: "Hiç aboneliği yok",
                detail: "Kullanıcının subscription kaydı bulunmuyor veya status atanmamış.",
            });
        }
        if (acc.consecutiveRateLimitHits > 0) {
            issues.push({
                severity: "info",
                code: "RECENT_RATE_LIMITS",
                title: `Son 10 dk içinde ${acc.consecutiveRateLimitHits} rate-limit aşımı`,
                detail: acc.lastRateLimitAt ? `Son: ${new Date(acc.lastRateLimitAt).toLocaleString("tr-TR")}` : "",
            });
        }
        if (issues.length === 0) {
            issues.push({
                severity: "info",
                code: "NO_ISSUES_FOUND",
                title: "Aktif sorun bulunamadı",
                detail: "Kullanıcının abonelik ve erişim durumu sağlıklı görünüyor. Sorun farklı bir kaynaktan olabilir (CORS, network, frontend hatası).",
            });
        }

        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
            subscription: {
                state: subscriptionState,
                plan: sub.plan,
                status: sub.status,
                trialEndDate: sub.trialEndDate,
                endDate: sub.endDate,
                daysLeft: trialActive ? Math.ceil((trialEnd - now) / 86400000)
                    : subActive ? Math.ceil((endDate - now) / 86400000) : 0,
            },
            accessStatus: {
                ...acc,
                blockReasonLabel: REASON_LABELS[acc.blockReason] || "",
            },
            issues,
            suggestedActions: actions,
            last24h403Breakdown: last24hAgg.map(g => ({
                type: g._id,
                typeLabel: TYPE_LABELS[g._id] || g._id,
                count: g.count,
            })),
            recentIncidents: incidents.map(i => ({
                _id: i._id,
                type: i.type,
                typeLabel: TYPE_LABELS[i.type] || i.type,
                severity: i.severity,
                description: i.description,
                createdAt: i.createdAt,
                ip: i.ip,
                deviceSummary: summarizeDevice(i.device || {}),
                endpoint: i.endpoint,
                statusCode: i.statusCode,
                resolved: i.resolved,
            })),
        });
    } catch (err) {
        logger.error("[AdminAccess] diagnoseUser hata: " + err.message);
        res.status(500).json({ success: false, message: "Tanı hatası: " + err.message });
    }
};

/**
 * GET /access/troubled-users
 * Son 24 saatte 403 yiyen TÜM kullanıcılar (bloklu olsun olmasın).
 * "Erişim engelli diyorum ama listede yok" sorununu çözer — abonelik bitmiş kullanıcılar da burada görünür.
 */
exports.listTroubledUsers = async (req, res) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const agg = await AccessIncident.aggregate([
            { $match: { createdAt: { $gte: since }, statusCode: 403, userId: { $ne: null } } },
            { $group: {
                _id: "$userId",
                count: { $sum: 1 },
                types: { $addToSet: "$type" },
                lastIncident: { $max: "$createdAt" },
                lastDescription: { $last: "$description" },
                lastIp: { $last: "$ip" },
            } },
            { $sort: { count: -1, lastIncident: -1 } },
            { $limit: 100 },
        ]);

        const ids = agg.map(a => a._id);
        const users = await User.find({ _id: { $in: ids } })
            .select("name email role subscription accessStatus")
            .lean();
        const userMap = new Map(users.map(u => [String(u._id), u]));

        const formatted = agg.map(a => {
            const u = userMap.get(String(a._id));
            if (!u) return null;
            const sub = u.subscription || {};
            const acc = u.accessStatus || {};
            // Tahmini ana sebep — en sık görülen tip
            const typeCounts = a.types.map(t => ({ t, label: TYPE_LABELS[t] || t }));
            return {
                userId: u._id,
                name: u.name,
                email: u.email,
                role: u.role,
                count: a.count,
                lastIncident: a.lastIncident,
                lastDescription: a.lastDescription,
                lastIp: a.lastIp,
                isBlocked: !!acc.isBlocked,
                blockReason: acc.blockReason || "",
                blockReasonLabel: REASON_LABELS[acc.blockReason] || "",
                subscriptionState: sub.status || "",
                plan: sub.plan || "",
                trialEndDate: sub.trialEndDate || null,
                endDate: sub.endDate || null,
                typeCounts,
            };
        }).filter(Boolean);

        res.json({ success: true, data: formatted, total: formatted.length, windowHours: 24 });
    } catch (err) {
        logger.error("[AdminAccess] listTroubledUsers hata: " + err.message);
        res.status(500).json({ success: false, message: "Sorunlu kullanıcılar getirilemedi: " + err.message });
    }
};

/**
 * POST /access/help
 * Kullanıcının "engelim açılsın" yardım talebi.
 * Bloklu da olsa erişebilmesi için bu endpoint authMiddleware'ın block kontrolünü atlamalı —
 * route tarafında özel bir middleware kombinasyonu kullanılır (authMiddleware DEĞİL, hafif token decode).
 */
exports.requestHelp = async (req, res) => {
    try {
        const { email, message = "" } = req.body || {};
        const userEmail = (req.user?.email || email || "").trim().toLowerCase();
        if (!userEmail) return res.status(400).json({ success: false, message: "E-posta gerekli." });

        const user = req.user || await User.findOne({ email: userEmail }).select("_id name email role");
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        const clientInfo = extractClientInfo(req);
        const inc = await AccessIncident.create({
            userId: user._id,
            email: userEmail,
            type: "help_request",
            severity: "warning",
            description: `Kullanıcı yardım talebi: ${String(message).slice(0, 500) || "Açıklama yok"}`,
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            device: clientInfo.device,
            endpoint: req.originalUrl || "",
            method: req.method || "",
            statusCode: 200,
            metadata: { message: String(message).slice(0, 2000) },
        });

        // Tüm admin/dev'lere bildirim
        try {
            const admins = await User.find({ role: { $in: ["admin", "dev"] } }).select("_id");
            if (admins.length > 0) {
                await Notification.insertMany(admins.map(a => ({
                    userId: a._id,
                    type: "system",
                    priority: "high",
                    title: "Erişim yardım talebi",
                    message: `${user.name || userEmail} hesap erişimi için yardım istedi. Cihaz: ${summarizeDevice(clientInfo.device)} — IP: ${clientInfo.ip || "?"}`,
                    icon: "🆘",
                    actionLink: "/admin/access-control",
                })));
            }
        } catch (e) {
            logger.warn(`[AdminAccess] help_request notification hata: ${e.message}`);
        }

        res.json({ success: true, message: "Yardım talebiniz admin'e iletildi. En kısa sürede dönüş yapılacak.", incidentId: inc._id });
    } catch (err) {
        logger.error("[AdminAccess] requestHelp hata: " + err.message);
        res.status(500).json({ success: false, message: "Yardım talebi gönderilemedi: " + err.message });
    }
};
