const jwt    = require("jsonwebtoken");
const User   = require("../models/User");
const AccessIncident = require("../models/AccessIncident");
const logger = require("../config/logger");
const { extractClientInfo, summarizeDevice } = require("../utils/deviceInfo");

/**
 * Auth middleware
 *   1. Token doğrula
 *   2. Kullanıcıyı yükle
 *   3. accessStatus.isBlocked kontrol et — blokluysa 403 + ayrıntılı sebep
 *   4. blockExpiresAt geçtiyse otomatik aç + AccessIncident "auto_unblock"
 *   5. lastIp / lastUserAgent / lastSeenAt güncelle (her başarılı doğrulamada)
 */
const authMiddleware = async (req, res, next) => {
    const clientInfo = extractClientInfo(req);
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                code: "AUTH_NO_TOKEN",
                message: "Yetkilendirme hatası: Token bulunamadı!"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            // Kayıp/silinmiş kullanıcı + valid token → suspicious
            try {
                await AccessIncident.create({
                    userId: null,
                    type: "auth_token_invalid",
                    severity: "warning",
                    description: "Geçerli token ama kullanıcı bulunamadı (silinmiş veya manipüle).",
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                    device: clientInfo.device,
                    endpoint: req.originalUrl || req.url || "",
                    method: req.method || "",
                    statusCode: 401,
                });
            } catch (_) { /* sessiz */ }
            return res.status(401).json({
                success: false,
                code: "AUTH_USER_NOT_FOUND",
                message: "Yetkilendirme hatası: Kullanıcı bulunamadı!"
            });
        }

        // ── Erişim engeli kontrolü ────────────────────────────────────────────
        const acc = user.accessStatus || {};
        if (acc.isBlocked) {
            const now = new Date();
            const expiresAt = acc.blockExpiresAt ? new Date(acc.blockExpiresAt) : null;

            // Süre dolmuşsa otomatik aç
            if (expiresAt && expiresAt.getTime() <= now.getTime()) {
                user.accessStatus.isBlocked = false;
                user.accessStatus.blockReason = "";
                user.accessStatus.blockExpiresAt = undefined;
                user.accessStatus.blockedAt = undefined;
                user.accessStatus.blockedBy = undefined;
                user.accessStatus.blockNote = "";
                user.accessStatus.consecutiveRateLimitHits = 0;
                await user.save();
                try {
                    await AccessIncident.create({
                        userId: user._id,
                        type: "auto_unblock",
                        severity: "info",
                        description: "Geçici blok süresi doldu — otomatik açıldı.",
                        ip: clientInfo.ip,
                        userAgent: clientInfo.userAgent,
                        device: clientInfo.device,
                        endpoint: req.originalUrl || req.url || "",
                        method: req.method || "",
                        statusCode: 200,
                        autoActionTaken: "auto_unblock",
                    });
                } catch (_) { /* sessiz */ }
            } else {
                // Bloklu kullanıcı erişim denedi — incident kaydı
                try {
                    await AccessIncident.create({
                        userId: user._id,
                        type: "blocked_attempt",
                        severity: "warning",
                        description: `Bloklu kullanıcı erişim denedi (${acc.blockReason || "neden bilinmiyor"}).`,
                        ip: clientInfo.ip,
                        userAgent: clientInfo.userAgent,
                        device: clientInfo.device,
                        endpoint: req.originalUrl || req.url || "",
                        method: req.method || "",
                        statusCode: 403,
                        metadata: { blockReason: acc.blockReason, blockExpiresAt: acc.blockExpiresAt },
                    });
                } catch (_) { /* sessiz */ }

                // Kullanıcıya net ve dürüst hata mesajı
                const reasonText = ({
                    rate_limit_abuse:    "Aşırı istek nedeniyle sistem hesabınızı geçici olarak korumaya aldı.",
                    suspicious_activity: "Hesabınızda şüpheli aktivite tespit edildi.",
                    admin_manual:        "Hesabınız yöneticimiz tarafından geçici olarak askıya alındı.",
                    payment_overdue:     "Ödeme gecikmesi nedeniyle hesabınıza erişim kısıtlandı.",
                    tos_violation:       "Kullanım koşulları ihlali nedeniyle hesabınız askıya alındı.",
                    security_concern:    "Güvenlik şüphesi nedeniyle hesabınıza erişim kısıtlandı.",
                })[acc.blockReason] || "Hesabınıza erişim geçici olarak engellendi.";

                return res.status(403).json({
                    success: false,
                    code: "ACCESS_BLOCKED",
                    message: reasonText,
                    blocked: {
                        reason: acc.blockReason || "",
                        blockedAt: acc.blockedAt || null,
                        expiresAt: acc.blockExpiresAt || null,
                        note: acc.blockNote || "",
                        canRequestHelp: true,
                    },
                });
            }
        }

        // ── Son görülen istemci bilgisini hafifçe güncelle (saatte 1 yazıp ağ yükünü azalt) ──
        try {
            const lastSeen = acc.lastSeenAt ? new Date(acc.lastSeenAt).getTime() : 0;
            const oneHour = 60 * 60 * 1000;
            const ipChanged = clientInfo.ip && acc.lastIp && acc.lastIp !== clientInfo.ip;
            if (Date.now() - lastSeen > oneHour || ipChanged) {
                await User.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            "accessStatus.lastIp": clientInfo.ip || acc.lastIp || "",
                            "accessStatus.lastUserAgent": clientInfo.userAgent || acc.lastUserAgent || "",
                            "accessStatus.lastSeenAt": new Date(),
                        },
                    }
                );
                // IP değiştiyse hafif bir "suspicious_activity" işareti at — admin görüp karar versin
                if (ipChanged) {
                    try {
                        await AccessIncident.create({
                            userId: user._id,
                            type: "suspicious_activity",
                            severity: "info",
                            description: `IP değişti: ${acc.lastIp} → ${clientInfo.ip} (${summarizeDevice(clientInfo.device)})`,
                            ip: clientInfo.ip,
                            userAgent: clientInfo.userAgent,
                            device: clientInfo.device,
                            endpoint: req.originalUrl || req.url || "",
                            method: req.method || "",
                            statusCode: 200,
                            metadata: { previousIp: acc.lastIp, newIp: clientInfo.ip },
                        });
                    } catch (_) { /* sessiz */ }
                }
            }
        } catch (_) { /* hafif kayıt, hata yutulur */ }

        // Set both user object and userId for compatibility
        req.user = user;
        req.userId = user._id;
        req.clientInfo = clientInfo;

        next();
    } catch (error) {
        logger.warn(`Auth middleware hatası: ${error.name} — ${error.message}`);

        // Geçersiz/süresi bitmiş token — incident kaydı (anonim)
        try {
            await AccessIncident.create({
                userId: null,
                type: "auth_token_invalid",
                severity: "info",
                description: `Token doğrulama başarısız: ${error.name}`,
                ip: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                device: clientInfo.device,
                endpoint: req.originalUrl || req.url || "",
                method: req.method || "",
                statusCode: 401,
                metadata: { errorName: error.name },
            });
        } catch (_) { /* sessiz */ }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                code: "AUTH_INVALID_TOKEN",
                message: "Yetkilendirme hatası: Geçersiz token!"
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                code: "AUTH_TOKEN_EXPIRED",
                message: "Yetkilendirme hatası: Token süresi dolmuş!"
            });
        }

        res.status(500).json({
            success: false,
            code: "AUTH_SERVER_ERROR",
            message: "Sunucu hatası: Yetkilendirme işlemi başarısız!"
        });
    }
};

const adminMiddleware = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            code: "AUTH_REQUIRED",
            message: "Yetkilendirme hatası: Kullanıcı bulunamadı!"
        });
    }

    const role = (req.user.role || "").toLowerCase();
    if (!(["admin", "dev"].includes(role))) {
        // 403 sebebini AccessIncident'a logla — admin "kullanıcı niye 403 alıyor?" sorusuna cevap bulabilsin
        try {
            const ci = extractClientInfo(req);
            await AccessIncident.create({
                userId: req.user._id,
                email: req.user.email || "",
                type: "admin_required",
                severity: "info",
                description: `Admin rolü gerektiren endpoint'e erişim denemesi (role=${role || "yok"})`,
                ip: ci.ip,
                userAgent: ci.userAgent,
                device: ci.device,
                endpoint: req.originalUrl || req.url || "",
                method: req.method || "",
                statusCode: 403,
                metadata: { userRole: role, requiredRoles: ["admin", "dev"] },
            });
        } catch (_) { /* sessiz */ }

        return res.status(403).json({
            success: false,
            code: "ADMIN_REQUIRED",
            message: "Yetki yok: Admin erişimi gerekli!"
        });
    }

    next();
};

module.exports = { authMiddleware, adminMiddleware };
