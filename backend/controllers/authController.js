const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User   = require("../models/User");
const AuditLog = require("../models/AuditLog");
const logger = require("../config/logger");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/emailService");
const { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } = require("../utils/apiResponse");
const { send2FACode } = require("./twoFactorController");

// ✅ SEC #2: Refresh token ayrı secret kullanır — yoksa JWT_SECRET'tan türetilir
const getRefreshSecret = () => {
    if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
    // Fallback: JWT_SECRET + sabit suffix (production'da ayrı key tanımlanmalı)
    logger.warn("JWT_REFRESH_SECRET tanımlı değil! JWT_SECRET'tan türetiliyor. Production'da ayrı key kullanın.");
    return process.env.JWT_SECRET + "_refresh_fallback";
};

const REMEMBER_REFRESH_DAYS = 30;
const SESSION_REFRESH_DAYS = 1;

function refreshDuration(rememberMe) {
    return rememberMe ? `${REMEMBER_REFRESH_DAYS}d` : `${SESSION_REFRESH_DAYS}d`;
}

function refreshExpiresAt(rememberMe) {
    const days = rememberMe ? REMEMBER_REFRESH_DAYS : SESSION_REFRESH_DAYS;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ✅ SEC #2: Access + Refresh token çifti oluştur ve refresh token'ı DB'ye kaydet
// rememberMe=true → 30 gün refresh; false → 1 gün (tarayıcı oturumu)
const generateTokenPair = async (user, device = "unknown", rememberMe = false) => {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: rememberMe ? "7d" : "1d" }
    );

    const refreshToken = jwt.sign(
        { id: user._id, type: "refresh", remember: !!rememberMe },
        getRefreshSecret(),
        { expiresIn: refreshDuration(rememberMe) }
    );

    const now = new Date();
    const expiresAt = refreshExpiresAt(rememberMe);

    const newTokenEntry = {
        token: refreshToken,
        device,
        createdAt: now,
        expiresAt
    };

    // Atomik güncelleme: süresi dolmuş token'ları sil + yeni token ekle
    // Bu sayede concurrent save() çakışması (version conflict) olmaz
    await User.updateOne(
        { _id: user._id },
        [
            {
                $set: {
                    refreshTokens: {
                        $concatArrays: [
                            // Süresi dolmamış token'ları tut, max 4 tane (yenisi eklenince 5 olacak)
                            { $slice: [
                                { $filter: {
                                    input: { $ifNull: ["$refreshTokens", []] },
                                    cond: { $gt: ["$$this.expiresAt", now] }
                                }},
                                -4
                            ]},
                            [newTokenEntry]
                        ]
                    }
                }
            }
        ]
    );

    return { accessToken, refreshToken };
};

// ─── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
    try {
        const { name, surname, phone, email, password } = req.body;

        if (!name || !surname || !email || !password) {
            return badRequest(res, "Ad, soyad, e-posta ve şifre zorunludur.");
        }

        // Telefon numarası format kontrolü (opsiyonel ama girilmişse doğrula)
        if (phone) {
            const phoneClean = phone.replace(/[\s\-\(\)]/g, "");
            if (!/^\+?[0-9]{10,15}$/.test(phoneClean)) {
                return badRequest(res, "Geçerli bir telefon numarası girin.");
            }
        }

        // E-posta format kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return badRequest(res, "Geçerli bir e-posta adresi girin.");
        }

        // Şifre güçlülük kontrolü (✅ SEC: güçlü şifre politikası)
        if (password.length < 8) {
            return badRequest(res, "Şifre en az 8 karakter olmalıdır.");
        }
        if (!/[A-Z]/.test(password)) {
            return badRequest(res, "Şifre en az bir büyük harf içermelidir.");
        }
        if (!/[a-z]/.test(password)) {
            return badRequest(res, "Şifre en az bir küçük harf içermelidir.");
        }
        if (!/[0-9]/.test(password)) {
            return badRequest(res, "Şifre en az bir rakam içermelidir.");
        }

        // Aynı e-posta ile kayıt var mı?
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return conflict(res, "Bu e-posta adresi zaten kayıtlı.");
        }

        // Doğrulama token + 6 haneli kod
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat
        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        const verificationCodeExpires = verificationTokenExpires;

        const hashedPassword = await bcrypt.hash(password, 10);

        // 14 günlük demo süresi hesapla
        const trialStart = new Date();
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 14);

        const newUser = new User({
            name : name.trim(),
            surname: (surname || "").trim(),
            phone: (phone || "").replace(/[\s\-\(\)]/g, "").trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            emailVerified: false,
            authProvider: "local",
            verificationToken,
            verificationTokenExpires,
            verificationCode,
            verificationCodeExpires,
            subscription: {
                plan: "trial",
                status: "trial",
                startDate: trialStart,
                trialStartDate: trialStart,
                trialEndDate: trialEnd,
                trialUsed: false
            }
        });

        await newUser.save();

        // Doğrulama e-postası gönder
        const emailResult = await sendVerificationEmail(newUser, verificationToken, verificationCode);

        if (!emailResult.success) {
            logger.warn(`Doğrulama e-postası gönderilemedi: ${newUser.email} — ${emailResult.message || JSON.stringify(emailResult.error)}`);
        }

        logger.info(`Yeni kullanıcı kaydedildi: ${newUser.email} (doğrulama bekliyor)`);

        const payload = {
            emailSent: emailResult.success,
            email: newUser.email,
        };
        if (!emailResult.success) {
            payload.emailError = emailResult.message || "Doğrulama e-postası gönderilemedi.";
        }
        // Geliştirme: domain doğrulanmadıysa kodu API'de göster (production'da asla)
        if (!emailResult.success && process.env.NODE_ENV !== "production") {
            payload.verificationCodeDev = verificationCode;
        }

        const userMessage = emailResult.success
            ? "Kayıt başarılı! E-postanıza doğrulama kodu ve bağlantı gönderildi."
            : "Kayıt oluşturuldu ancak doğrulama e-postası şu an gönderilemedi. Aşağıdaki kodu kullanın veya 'Tekrar gönder' deneyin.";

        return created(res, userMessage, payload);
    } catch (error) {
        logger.error(`Kayıt hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── VERIFY EMAIL ──────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return badRequest(res, "Doğrulama token'ı gerekli.");
        }

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: new Date() }
        });

        if (!user) {
            return badRequest(res, "Geçersiz veya süresi dolmuş doğrulama bağlantısı.");
        }

        // Zaten doğrulanmış mı?
        if (user.emailVerified) {
            return ok(res, "E-posta adresiniz zaten doğrulanmış.");
        }

        // E-postayı doğrula
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        logger.info(`E-posta doğrulandı: ${user.email}`);
        return ok(res, "E-posta adresiniz başarıyla doğrulandı! Artık giriş yapabilirsiniz.");
    } catch (error) {
        logger.error(`E-posta doğrulama hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── VERIFY EMAIL BY CODE ───────────────────────────────────────────────────────
exports.verifyEmailByCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return badRequest(res, "E-posta ve doğrulama kodu zorunludur.");
        }

        const normalizedCode = String(code).trim().replace(/\s/g, "");
        if (!/^\d{6}$/.test(normalizedCode)) {
            return badRequest(res, "Geçerli 6 haneli doğrulama kodu girin.");
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            verificationCode: normalizedCode,
            verificationCodeExpires: { $gt: new Date() },
        });

        if (!user) {
            return badRequest(res, "Geçersiz veya süresi dolmuş doğrulama kodu.");
        }

        if (user.emailVerified) {
            return ok(res, "E-posta adresiniz zaten doğrulanmış.");
        }

        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        logger.info(`E-posta kod ile doğrulandı: ${user.email}`);
        return ok(res, "E-posta adresiniz başarıyla doğrulandı! Artık giriş yapabilirsiniz.");
    } catch (error) {
        logger.error(`Kod ile doğrulama hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── RESEND VERIFICATION ───────────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return badRequest(res, "E-posta adresi gerekli.");
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            // Güvenlik: Kullanıcı var mı yok mu belli etme
            return ok(res, "Eğer bu e-posta kayıtlıysa, doğrulama bağlantısı gönderildi.");
        }

        if (user.emailVerified) {
            return badRequest(res, "E-posta adresiniz zaten doğrulanmış. Giriş yapabilirsiniz.");
        }

        // Yeni token oluştur
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.verificationCode = verificationCode;
        user.verificationCodeExpires = user.verificationTokenExpires;
        await user.save();

        const emailResult = await sendVerificationEmail(user, verificationToken, verificationCode);

        const payload = { emailSent: emailResult.success };
        if (!emailResult.success) {
            payload.emailError = emailResult.message;
            if (process.env.NODE_ENV !== "production") {
                payload.verificationCodeDev = verificationCode;
            }
            logger.warn(`Doğrulama e-postası yeniden gönderilemedi: ${user.email} — ${emailResult.message}`);
        } else {
            logger.info(`Doğrulama e-postası yeniden gönderildi: ${user.email}`);
        }

        const msg = emailResult.success
            ? "Doğrulama e-postası gönderildi."
            : "E-posta gönderilemedi. Resend domain doğrulamasını kontrol edin.";

        return ok(res, msg, payload);
    } catch (error) {
        logger.error(`Yeniden doğrulama hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
/**
 * 🩺 TANI: /api/auth/diagnostic/whoami
 * Frontend'in 403/CORS/Bağlantı sorunlarını anlaması için detaylı bilgi döner.
 */
exports.whoami = async (req, res) => {
    const origin = req.headers.origin || "-";
    const referer = req.headers.referer || "-";
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?")
        .toString().split(",")[0].trim();
    const ua = req.headers["user-agent"] || "-";

    // server.js'deki allowedOrigins listesini burada da simüle edelim veya server.js'den export alabiliriz.
    // Şimdilik manuel kontrol:
    const { getCorsAllowedOrigins } = require("../config/domain");
    const allowed = getCorsAllowedOrigins();

    res.status(200).json({
        success: true,
        you: { ip, origin, referer, ua },
        cors: {
            yourOriginAllowed: origin === "-" || allowed.includes(origin),
            softMode: true
        },
        server: {
            time: new Date().toISOString(),
            env: process.env.NODE_ENV || "development"
        }
    });
};

exports.login = async (req, res) => {
    // 🩺 TANI: her login isteği için detaylı log — 403 sorunu için izlenebilirlik
    const _diagOrigin = req.headers.origin || "-";
    const _diagRef = req.headers.referer || "-";
    const _diagIp = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?")
        .toString().split(",")[0].trim();
    const _diagUa = (req.headers["user-agent"] || "").slice(0, 80);
    logger.info(`[LOGIN-IN] email="${req.body?.email || "?"}" origin="${_diagOrigin}" ip="${_diagIp}" ref="${_diagRef.slice(0, 80)}" ua="${_diagUa}"`);

    try {
        const { email, password, rememberMe } = req.body;
        const persistSession = rememberMe === true || rememberMe === "true" || rememberMe === 1;

        if (!email || !password) {
            logger.warn(`[LOGIN-OUT] 400 — eksik alan (email="${email}" passwordSet=${!!password})`);
            return badRequest(res, "E-posta ve şifre zorunludur.");
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            logger.warn(`[LOGIN-OUT] 401 — kullanıcı bulunamadı: ${email}`);
            return unauthorized(res, "Geçersiz kimlik bilgileri.");
        }

        if (user.authProvider === "google" && !user.password) {
            logger.warn(`[LOGIN-OUT] 400 — Google hesabı şifre ile giriş denemesi: ${email}`);
            return badRequest(res, "Bu hesap Google ile oluşturulmuş. Lütfen Google ile giriş yapın.");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`[LOGIN-OUT] 401 — yanlış şifre: ${email}`);
            return unauthorized(res, "Geçersiz kimlik bilgileri.");
        }

        if (!user.emailVerified && !["admin", "dev"].includes(user.role)) {
            logger.warn(`[LOGIN-OUT] 403 — e-posta doğrulanmamış: ${email} (emailVerified=${user.emailVerified})`);
            return res.status(403).json({
                success: false,
                needsVerification: true,
                message: "E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.",
            });
        }

        // Abonelik durumu kontrolü — süresi dolmuşsa atomik güncelle (version conflict önlenir)
        if (user.subscription) {
            const now = new Date();
            const sub = user.subscription;
            if (
                (sub.status === "trial" && sub.trialEndDate && new Date(sub.trialEndDate) < now) ||
                (sub.status === "active" && sub.endDate && new Date(sub.endDate) < now)
            ) {
                await User.updateOne({ _id: user._id }, { $set: { "subscription.status": "expired" } });
                user.subscription.status = "expired";
            }
        }

        // ✅ P2-3: 2FA aktifse — token döndürme, kod gönder
        if (user.security?.twoFactorEnabled) {
            const result = await send2FACode(user);
            logger.info(`2FA kodu gönderildi (login): ${user.email}`);
            return res.status(200).json({
                success: true,
                requires2FA: true,
                message: result.message || "Doğrulama kodu e-posta adresinize gönderildi.",
                email: user.email
            });
        }

        // 🛡️ SEC #2: Access + Refresh token çifti oluştur (ayrı secret, DB'de saklanır)
        const device = req.headers["user-agent"] || "unknown";
        const { accessToken, refreshToken } = await generateTokenPair(user, device, persistSession);

        // Şifre hash'i ve refreshTokens response'dan çıkarıldı
        const { password: _pw, refreshTokens: _rt, ...safeUser } = user.toObject();

        logger.info(`Kullanıcı giriş yaptı: ${user.email} (${user.role}) remember=${persistSession}`);
        // Not: token/refreshToken/user üst seviyede — frontend uyumluluğu için
        return res.status(200).json({
            success: true,
            message: "Giriş başarılı!",
            token: accessToken,
            refreshToken,
            rememberMe: persistSession,
            user: safeUser,
        });
    } catch (error) {
        logger.error(`Giriş hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── GOOGLE AUTH ────────────────────────────────────────────────────────────────
exports.googleAuth = async (req, res) => {
    try {
        const { credential, access_token } = req.body;

        let googleId, email, name, picture;

        if (access_token) {
            // useGoogleLogin ile gelen access_token — Google userinfo API'den bilgi al
            const fetch = (await import("node-fetch")).default;
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            if (!userInfoRes.ok) {
                return unauthorized(res, "Google token geçersiz.");
            }

            const payload = await userInfoRes.json();
            googleId = payload.sub;
            email    = payload.email;
            name     = payload.name;
            picture  = payload.picture;
        } else if (credential) {
            // ✅ FIX H4: GoogleLogin bileşeni ile gelen JWT credential — google-auth-library ile doğrula
            try {
                const { OAuth2Client } = require("google-auth-library");
                const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

                const ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID
                });

                const payload = ticket.getPayload();
                googleId = payload.sub;
                email    = payload.email;
                name     = payload.name;
                picture  = payload.picture;
            } catch (verifyError) {
                logger.error(`Google JWT doğrulama hatası: ${verifyError.message}`);
                return unauthorized(res, "Google token doğrulanamadı.");
            }
        } else {
            return badRequest(res, "Google credential veya access_token gerekli.");
        }

        if (!email) {
            return badRequest(res, "Google hesabından e-posta alınamadı.");
        }

        // Kullanıcı zaten var mı?
        let user = await User.findOne({ email: email.toLowerCase().trim() });

        if (user) {
            // Mevcut kullanıcı — Google ID'yi güncelle
            if (!user.googleId) {
                user.googleId = googleId;
                user.emailVerified = true; // Google ile doğrulanmış
                if (picture && !user.profile?.avatar) {
                    if (!user.profile) user.profile = {};
                    user.profile.avatar = picture;
                }
                await user.save();
            }
        } else {
            // Yeni kullanıcı oluştur — 14 günlük demo süresi ile
            const trialStart = new Date();
            const trialEnd = new Date(trialStart);
            trialEnd.setDate(trialEnd.getDate() + 14);

            user = new User({
                name: name || email.split("@")[0],
                email: email.toLowerCase().trim(),
                googleId,
                authProvider: "google",
                emailVerified: true, // Google hesabı zaten doğrulanmış
                profile: {
                    avatar: picture || undefined
                },
                subscription: {
                    plan: "trial",
                    status: "trial",
                    startDate: trialStart,
                    trialStartDate: trialStart,
                    trialEndDate: trialEnd,
                    trialUsed: false
                }
            });
            await user.save();
            logger.info(`Yeni Google kullanıcısı kaydedildi: ${user.email} (14 gün demo)`);
        }

        // 🛡️ SEC #2: Access + Refresh token çifti oluştur (ayrı secret, DB'de saklanır)
        const device = req.headers["user-agent"] || "google-oauth";
        const { accessToken, refreshToken } = await generateTokenPair(user, device, true);
        const { password: _pw, refreshTokens: _rt, ...safeUser } = user.toObject();

        logger.info(`Google ile giriş yapıldı: ${user.email} (${user.role})`);
        return res.status(200).json({
            success: true,
            message: "Google ile giriş başarılı!",
            token: accessToken,
            refreshToken,
            rememberMe: true,
            user: safeUser,
        });
    } catch (error) {
        logger.error(`Google auth hatası: ${error.message}`);
        return serverError(res, error, "Google ile giriş yapılamadı.");
    }
};

// ─── FORGOT PASSWORD — Kod gönder ──────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return badRequest(res, "E-posta adresi gerekli.");
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Güvenlik: Kullanıcı var mı yok mu belli etme
        if (!user) {
            return ok(res, "Eğer bu e-posta kayıtlıysa, şifre sıfırlama kodu gönderildi.");
        }

        // Google hesabı kontrolü
        if (user.authProvider === "google" && !user.password) {
            return badRequest(res, "Bu hesap Google ile oluşturulmuş. Şifre sıfırlama yapılamaz.");
        }

        // 6 haneli kod oluştur (✅ SEC: kriptografik güvenli random)
        const resetCode = crypto.randomInt(100000, 999999).toString();
        user.resetPasswordCode = resetCode;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika
        await user.save();

        const emailResult = await sendPasswordResetEmail(user, resetCode);

        if (!emailResult.success) {
            logger.warn(`Şifre sıfırlama e-postası gönderilemedi: ${user.email}`);
        }

        logger.info(`Şifre sıfırlama kodu gönderildi: ${user.email}`);
        return ok(res, "Eğer bu e-posta kayıtlıysa, şifre sıfırlama kodu gönderildi.", { emailSent: emailResult.success });
    } catch (error) {
        logger.error(`Şifre sıfırlama hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── VERIFY RESET CODE ─────────────────────────────────────────────────────────
exports.verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return badRequest(res, "E-posta ve kod gerekli.");
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordCode: code,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return badRequest(res, "Geçersiz veya süresi dolmuş kod.");
        }

        logger.info(`Şifre sıfırlama kodu doğrulandı: ${user.email}`);
        return ok(res, "Kod doğrulandı! Yeni şifrenizi belirleyin.");
    } catch (error) {
        logger.error(`Kod doğrulama hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── RESET PASSWORD ─────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return badRequest(res, "Tüm alanlar zorunludur.");
        }

        if (newPassword.length < 8) {
            return badRequest(res, "Şifre en az 8 karakter olmalıdır.");
        }
        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return badRequest(res, "Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir.");
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordCode: code,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return badRequest(res, "Geçersiz veya süresi dolmuş kod.");
        }

        // Yeni şifreyi hashle ve kaydet
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        try {
            await AuditLog.create({
                userId: user._id,
                action: "password_reset_self",
                category: "security",
                severity: "info",
                description: "Kullanıcı e-posta doğrulama kodu ile şifresini sıfırladı",
                metadata: { email: user.email },
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.get("user-agent") || "",
                success: true
            });
        } catch (auditErr) {
            logger.warn(`Audit (password_reset_self) yazılamadı: ${auditErr.message}`);
        }

        logger.info(`Şifre başarıyla sıfırlandı: ${user.email}`);
        return ok(res, "Şifreniz başarıyla değiştirildi! Artık yeni şifrenizle giriş yapabilirsiniz.");
    } catch (error) {
        logger.error(`Şifre sıfırlama hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── REFRESH TOKEN ──────────────────────────────────────────────────────────────
// ✅ SEC #2: Ayrı secret ile doğrulama + DB'de varlık kontrolü + token rotation
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return badRequest(res, "Refresh token gerekli.");
        }

        // 1. Refresh token'ı AYRI SECRET ile doğrula
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, getRefreshSecret());
        } catch (err) {
            return unauthorized(res, "Geçersiz veya süresi dolmuş refresh token.");
        }

        // 2. Token tipini kontrol et
        if (decoded.type !== "refresh") {
            return unauthorized(res, "Geçersiz token tipi.");
        }

        // 3. Kullanıcıyı bul
        const user = await User.findById(decoded.id);
        if (!user) {
            return notFound(res, "Kullanıcı bulunamadı.");
        }

        // 4. Refresh token DB'de var mı kontrol et (revoke edilmiş olabilir)
        const tokenExists = (user.refreshTokens || []).some(rt => rt.token === refreshToken);
        if (!tokenExists) {
            // Token DB'de yok — muhtemelen çalınmış ve revoke edilmiş
            // Güvenlik: Tüm oturumları kapat (atomik)
            logger.warn(`Revoke edilmiş refresh token kullanım girişimi: ${user.email}`);
            await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });
            return unauthorized(res, "Geçersiz refresh token! Tüm oturumlar kapatıldı.");
        }

        const rememberMe = decoded.remember === true;
        const device = req.headers["user-agent"] || "unknown";
        const newAccessToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: rememberMe ? "7d" : "1d" }
        );
        const newRefreshToken = jwt.sign(
            { id: user._id, type: "refresh", remember: rememberMe },
            getRefreshSecret(),
            { expiresIn: refreshDuration(rememberMe) }
        );

        const now = new Date();
        const newTokenEntry = {
            token: newRefreshToken,
            device,
            createdAt: now,
            expiresAt: refreshExpiresAt(rememberMe),
        };

        // Atomik: eski token'ı sil + süresi dolmuşları temizle + yeni token ekle
        await User.updateOne(
            { _id: user._id },
            {
                $pull: { refreshTokens: { $or: [{ token: refreshToken }, { expiresAt: { $lte: now } }] } }
            }
        );
        await User.updateOne(
            { _id: user._id },
            { $push: { refreshTokens: newTokenEntry } }
        );

        logger.info(`Token yenilendi (rotation): ${user.email}`);
        return res.status(200).json({
            success: true,
            message: "Token yenilendi.",
            token: newAccessToken,
            refreshToken: newRefreshToken,
            rememberMe,
        });
    } catch (error) {
        logger.error(`Token yenileme hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── LOGOUT — Refresh token'ı revoke et ─────────────────────────────────────────
// ✅ SEC #2: Çıkış yapıldığında refresh token DB'den silinir
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const user = req.user;

        if (user && refreshToken) {
            // Atomik: sadece ilgili token'ı sil (version conflict önlenir)
            await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { token: refreshToken } } });
        }

        logger.info(`Kullanıcı çıkış yaptı: ${user?.email || "unknown"}`);
        res.status(200).json({ success: true, message: "✅ Çıkış başarılı!" });
    } catch (error) {
        logger.error(`Logout hatası: ${error.message}`);
        res.status(200).json({ success: true, message: "✅ Çıkış yapıldı." });
    }
};

// ─── GET PROFILE ───────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
    try {
        // req.user authMiddleware tarafından set ediliyor (-password zaten seçili)
        // ✅ SEC: refreshTokens ve security.twoFactorSecret da gizleniyor
        const user = await User.findById(req.user._id).select("-password -refreshTokens -security.twoFactorSecret");

        if (!user) {
            return notFound(res, "Kullanıcı bulunamadı.");
        }

        // Not: Profil verisi doğrudan döndürülür — frontend uyumluluğu için
        return res.status(200).json(user);
    } catch (error) {
        logger.error(`Profil alma hatası: ${error.message}`);
        return serverError(res, error);
    }
};

// ─── ACCEPT LEGAL — Yasal belge onayı (KVKK/GDPR uyumlu) ──────────────────────
exports.acceptLegal = async (req, res) => {
    try {
        const { privacyPolicy, termsOfService, cookiePolicy } = req.body;

        if (!privacyPolicy || !termsOfService || !cookiePolicy) {
            return badRequest(res, "Tüm yasal belgelerin onaylanması zorunludur.");
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return notFound(res, "Kullanıcı bulunamadı.");
        }

        // IP adresi al (proxy arkasında da çalışır)
        const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
            || req.connection?.remoteAddress
            || req.ip
            || "unknown";

        user.legalAcceptance = {
            accepted: true,
            privacyPolicy: true,
            termsOfService: true,
            cookiePolicy: true,
            acceptedAt: new Date(),
            acceptedVersion: "1.0",
            ipAddress,
            userAgent: req.headers["user-agent"] || "unknown"
        };

        await user.save();

        logger.info(`Yasal belgeler onaylandı: ${user.email} (IP: ${ipAddress})`);
        return ok(res, "Yasal belgeler başarıyla onaylandı.", {
            legalAcceptance: user.legalAcceptance
        });
    } catch (error) {
        logger.error(`Yasal onay hatası: ${error.message}`);
        return serverError(res, error);
    }
};
