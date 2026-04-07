/**
 * Two-Factor Authentication Controller — LysiaETIC
 * ✅ P2-3: E-posta tabanlı 2FA
 *
 * Flow:
 * 1. Kullanıcı Settings'ten 2FA'yı aktifleştirir → enable2FA
 * 2. Login sırasında şifre doğru ise → 2FA kodu e-posta ile gönderilir
 * 3. Kullanıcı kodu girer → verify2FA → token çifti döner
 * 4. Kullanıcı 2FA'yı kapatabilir → disable2FA
 */

const crypto = require("crypto");
const User   = require("../models/User");
const logger = require("../config/logger");
const { send2FACodeEmail } = require("../services/emailService");
const { ok, badRequest, unauthorized, notFound, serverError } = require("../utils/apiResponse");

// ── 6 haneli rastgele kod üret ──────────────────────────────────────────────
const generate2FACode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ── 10 adet 8 karakterlik backup kodu üret ──────────────────────────────────
const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    return codes;
};

/**
 * 2FA Aktifleştir
 * POST /api/auth/2fa/enable
 * Requires: authMiddleware
 */
exports.enable2FA = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return notFound(res, "Kullanıcı bulunamadı.");

        if (user.security?.twoFactorEnabled) {
            return badRequest(res, "İki faktörlü doğrulama zaten aktif.");
        }

        // Backup kodları oluştur
        const backupCodes = generateBackupCodes();

        // 2FA'yı aktifleştir
        if (!user.security) user.security = {};
        user.security.twoFactorEnabled = true;
        user.security.twoFactorBackupCodes = backupCodes;
        await user.save();

        logger.info(`2FA aktifleştirildi: ${user.email}`);

        return ok(res, "İki faktörlü doğrulama aktifleştirildi.", {
            backupCodes,
            message: "Bu yedek kodları güvenli bir yere kaydedin. Her kod yalnızca bir kez kullanılabilir."
        });
    } catch (error) {
        logger.error(`2FA enable hatası: ${error.message}`);
        return serverError(res, error);
    }
};

/**
 * 2FA Devre Dışı Bırak
 * POST /api/auth/2fa/disable
 * Requires: authMiddleware
 */
exports.disable2FA = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return notFound(res, "Kullanıcı bulunamadı.");

        if (!user.security?.twoFactorEnabled) {
            return badRequest(res, "İki faktörlü doğrulama zaten kapalı.");
        }

        user.security.twoFactorEnabled = false;
        user.security.twoFactorSecret = undefined;
        user.security.twoFactorCode = undefined;
        user.security.twoFactorCodeExpires = undefined;
        user.security.twoFactorBackupCodes = [];
        await user.save();

        logger.info(`2FA devre dışı bırakıldı: ${user.email}`);
        return ok(res, "İki faktörlü doğrulama devre dışı bırakıldı.");
    } catch (error) {
        logger.error(`2FA disable hatası: ${error.message}`);
        return serverError(res, error);
    }
};

/**
 * 2FA Durumunu Getir
 * GET /api/auth/2fa/status
 * Requires: authMiddleware
 */
exports.get2FAStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return notFound(res, "Kullanıcı bulunamadı.");

        return ok(res, "2FA durumu.", {
            enabled: !!user.security?.twoFactorEnabled,
            backupCodesRemaining: (user.security?.twoFactorBackupCodes || []).length
        });
    } catch (error) {
        logger.error(`2FA status hatası: ${error.message}`);
        return serverError(res, error);
    }
};

/**
 * 2FA Kodu Gönder (Login sırasında çağrılır)
 * Bu fonksiyon doğrudan export edilir — authController'dan çağrılır
 */
exports.send2FACode = async (user) => {
    try {
        const code = generate2FACode();

        if (!user.security) user.security = {};
        user.security.twoFactorCode = code;
        user.security.twoFactorCodeExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 dakika
        await user.save();

        const emailResult = await send2FACodeEmail(user, code);

        return {
            success: emailResult.success,
            message: emailResult.success
                ? "Doğrulama kodu e-posta adresinize gönderildi."
                : "Doğrulama kodu gönderilemedi."
        };
    } catch (error) {
        logger.error(`2FA kod gönderim hatası: ${error.message}`);
        return { success: false, message: "Doğrulama kodu gönderilemedi." };
    }
};

/**
 * 2FA Kodu Doğrula (Login'in ikinci adımı)
 * POST /api/auth/2fa/verify
 * Body: { email, code }
 *
 * Başarılı olursa access + refresh token döner
 */
exports.verify2FA = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return badRequest(res, "E-posta ve doğrulama kodu gerekli.");
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return unauthorized(res, "Geçersiz kimlik bilgileri.");
        }

        if (!user.security?.twoFactorEnabled) {
            return badRequest(res, "Bu hesapta 2FA aktif değil.");
        }

        // Backup kodu mu kontrol et
        const backupCodes = user.security.twoFactorBackupCodes || [];
        const backupIndex = backupCodes.indexOf(code.toUpperCase());

        if (backupIndex !== -1) {
            // Backup kodu kullanıldı — sil
            user.security.twoFactorBackupCodes.splice(backupIndex, 1);
            user.security.twoFactorCode = undefined;
            user.security.twoFactorCodeExpires = undefined;
            await user.save();

            logger.info(`2FA backup kodu kullanıldı: ${user.email} (kalan: ${user.security.twoFactorBackupCodes.length})`);
        } else {
            // Normal 2FA kodu kontrol et
            if (!user.security.twoFactorCode || !user.security.twoFactorCodeExpires) {
                return unauthorized(res, "Doğrulama kodu bulunamadı. Lütfen tekrar giriş yapın.");
            }

            if (new Date() > user.security.twoFactorCodeExpires) {
                user.security.twoFactorCode = undefined;
                user.security.twoFactorCodeExpires = undefined;
                await user.save();
                return unauthorized(res, "Doğrulama kodunun süresi dolmuş. Lütfen tekrar giriş yapın.");
            }

            if (user.security.twoFactorCode !== code) {
                return unauthorized(res, "Geçersiz doğrulama kodu.");
            }

            // Kodu temizle (tek kullanımlık)
            user.security.twoFactorCode = undefined;
            user.security.twoFactorCodeExpires = undefined;
            await user.save();
        }

        // ✅ Token çifti oluştur — authController'daki generateTokenPair ile aynı mantık
        const jwt = require("jsonwebtoken");

        const getRefreshSecret = () => {
            if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
            return process.env.JWT_SECRET + "_refresh_fallback";
        };

        const accessToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const refreshToken = jwt.sign(
            { id: user._id, type: "refresh" },
            getRefreshSecret(),
            { expiresIn: "7d" }
        );

        // Süresi dolmuş token'ları temizle
        user.cleanExpiredTokens();

        // Maksimum 5 aktif oturum
        if ((user.refreshTokens || []).length >= 5) {
            user.refreshTokens.shift();
        }

        // Yeni refresh token'ı DB'ye kaydet
        const device = req.headers["user-agent"] || "unknown";
        user.refreshTokens.push({
            token: refreshToken,
            device,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        await user.save();

        const { password: _pw, refreshTokens: _rt, ...safeUser } = user.toObject();

        logger.info(`2FA doğrulama başarılı: ${user.email}`);
        return res.status(200).json({
            success: true,
            message: "İki faktörlü doğrulama başarılı!",
            token: accessToken,
            refreshToken,
            user: safeUser
        });
    } catch (error) {
        logger.error(`2FA verify hatası: ${error.message}`);
        return serverError(res, error);
    }
};

/**
 * 2FA Kodunu Tekrar Gönder
 * POST /api/auth/2fa/resend
 * Body: { email }
 */
exports.resend2FACode = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return badRequest(res, "E-posta adresi gerekli.");
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Güvenlik: Kullanıcı var mı yok mu belli etme
        if (!user || !user.security?.twoFactorEnabled) {
            return ok(res, "Eğer bu hesapta 2FA aktifse, yeni kod gönderildi.");
        }

        const result = await exports.send2FACode(user);

        return ok(res, "Eğer bu hesapta 2FA aktifse, yeni kod gönderildi.", {
            emailSent: result.success
        });
    } catch (error) {
        logger.error(`2FA resend hatası: ${error.message}`);
        return serverError(res, error);
    }
};
