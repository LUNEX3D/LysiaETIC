const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User   = require("../models/User");
const logger = require("../config/logger");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/emailService");

// ─── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "❌ Tüm alanlar zorunludur!" });
        }

        // E-posta format kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "❌ Geçerli bir e-posta adresi girin!" });
        }

        // Şifre uzunluk kontrolü
        if (password.length < 6) {
            return res.status(400).json({ message: "❌ Şifre en az 6 karakter olmalıdır!" });
        }

        // Aynı e-posta ile kayıt var mı?
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ message: "❌ Bu e-posta adresi zaten kayıtlı!" });
        }

        // Doğrulama token'ı oluştur
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

        const hashedPassword = await bcrypt.hash(password, 10);

        // 14 günlük demo süresi hesapla
        const trialStart = new Date();
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 14);

        const newUser = new User({
            name : name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            emailVerified: false,
            authProvider: "local",
            verificationToken,
            verificationTokenExpires,
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
        const emailResult = await sendVerificationEmail(newUser, verificationToken);

        if (!emailResult.success) {
            logger.warn(`Doğrulama e-postası gönderilemedi: ${newUser.email} — ${JSON.stringify(emailResult.error)}`);
        }

        logger.info(`Yeni kullanıcı kaydedildi: ${newUser.email} (doğrulama bekliyor)`);
        res.status(201).json({
            message: "✅ Kayıt başarılı! E-posta adresinize bir doğrulama bağlantısı gönderdik. Lütfen gelen kutunuzu kontrol edin.",
            emailSent: emailResult.success
        });
    } catch (error) {
        logger.error(`Kayıt hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ─── VERIFY EMAIL ──────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: "❌ Doğrulama token'ı gerekli!" });
        }

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                message: "❌ Geçersiz veya süresi dolmuş doğrulama bağlantısı. Lütfen yeniden kayıt olun veya yeni bir doğrulama e-postası isteyin."
            });
        }

        // Zaten doğrulanmış mı?
        if (user.emailVerified) {
            return res.status(200).json({ message: "✅ E-posta adresiniz zaten doğrulanmış!" });
        }

        // E-postayı doğrula
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        logger.info(`E-posta doğrulandı: ${user.email}`);
        res.status(200).json({ message: "✅ E-posta adresiniz başarıyla doğrulandı! Artık giriş yapabilirsiniz." });
    } catch (error) {
        logger.error(`E-posta doğrulama hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ─── RESEND VERIFICATION ───────────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "❌ E-posta adresi gerekli!" });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            // Güvenlik: Kullanıcı var mı yok mu belli etme
            return res.status(200).json({ message: "✅ Eğer bu e-posta kayıtlıysa, doğrulama bağlantısı gönderildi." });
        }

        if (user.emailVerified) {
            return res.status(400).json({ message: "✅ E-posta adresiniz zaten doğrulanmış. Giriş yapabilirsiniz." });
        }

        // Yeni token oluştur
        const verificationToken = crypto.randomBytes(32).toString("hex");
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        const emailResult = await sendVerificationEmail(user, verificationToken);

        logger.info(`Doğrulama e-postası yeniden gönderildi: ${user.email}`);
        res.status(200).json({
            message: "✅ Eğer bu e-posta kayıtlıysa, doğrulama bağlantısı gönderildi.",
            emailSent: emailResult.success
        });
    } catch (error) {
        logger.error(`Yeniden doğrulama hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "❌ E-posta ve şifre zorunludur!" });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: "❌ Geçersiz kimlik bilgileri!" });
        }

        // Google ile kayıt olmuş kullanıcı şifre ile giriş yapamaz
        if (user.authProvider === "google" && !user.password) {
            return res.status(400).json({
                message: "❌ Bu hesap Google ile oluşturulmuş. Lütfen Google ile giriş yapın."
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Başarısız giriş denemesi: ${email}`);
            return res.status(401).json({ message: "❌ Geçersiz kimlik bilgileri!" });
        }

        // E-posta doğrulama kontrolü (admin ve dev kullanıcılar muaf)
        if (!user.emailVerified && !["admin", "dev"].includes(user.role)) {
            return res.status(403).json({
                message: "❌ E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.",
                needsVerification: true,
                email: user.email
            });
        }

        // Abonelik durumu kontrolü — süresi dolmuşsa güncelle
        if (user.subscription) {
            const now = new Date();
            const sub = user.subscription;
            if (sub.status === "trial" && sub.trialEndDate && new Date(sub.trialEndDate) < now) {
                user.subscription.status = "expired";
                await user.save();
            } else if (sub.status === "active" && sub.endDate && new Date(sub.endDate) < now) {
                user.subscription.status = "expired";
                await user.save();
            }
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        // Şifre hash'i response'dan çıkarıldı
        const { password: _pw, ...safeUser } = user.toObject();

        logger.info(`Kullanıcı giriş yaptı: ${user.email} (${user.role})`);
        res.status(200).json({ message: "✅ Giriş başarılı!", token, user: safeUser });
    } catch (error) {
        logger.error(`Giriş hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
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
                return res.status(401).json({ message: "❌ Google token geçersiz!" });
            }

            const payload = await userInfoRes.json();
            googleId = payload.sub;
            email    = payload.email;
            name     = payload.name;
            picture  = payload.picture;
        } else if (credential) {
            // GoogleLogin bileşeni ile gelen JWT credential
            const payload = JSON.parse(
                Buffer.from(credential.split(".")[1], "base64").toString()
            );
            googleId = payload.sub;
            email    = payload.email;
            name     = payload.name;
            picture  = payload.picture;
        } else {
            return res.status(400).json({ message: "❌ Google credential veya access_token gerekli!" });
        }

        if (!email) {
            return res.status(400).json({ message: "❌ Google hesabından e-posta alınamadı!" });
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

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        const { password: _pw, ...safeUser } = user.toObject();

        logger.info(`Google ile giriş yapıldı: ${user.email} (${user.role})`);
        res.status(200).json({ message: "✅ Google ile giriş başarılı!", token, user: safeUser });
    } catch (error) {
        logger.error(`Google auth hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Google ile giriş yapılamadı!" });
    }
};

// ─── FORGOT PASSWORD — Kod gönder ──────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "❌ E-posta adresi gerekli!" });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Güvenlik: Kullanıcı var mı yok mu belli etme
        if (!user) {
            return res.status(200).json({
                message: "✅ Eğer bu e-posta kayıtlıysa, şifre sıfırlama kodu gönderildi."
            });
        }

        // Google hesabı kontrolü
        if (user.authProvider === "google" && !user.password) {
            return res.status(400).json({
                message: "❌ Bu hesap Google ile oluşturulmuş. Şifre sıfırlama yapılamaz. Lütfen Google ile giriş yapın."
            });
        }

        // 6 haneli kod oluştur
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordCode = resetCode;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika
        await user.save();

        const emailResult = await sendPasswordResetEmail(user, resetCode);

        if (!emailResult.success) {
            logger.warn(`Şifre sıfırlama e-postası gönderilemedi: ${user.email}`);
        }

        logger.info(`Şifre sıfırlama kodu gönderildi: ${user.email}`);
        res.status(200).json({
            message: "✅ Eğer bu e-posta kayıtlıysa, şifre sıfırlama kodu gönderildi.",
            emailSent: emailResult.success
        });
    } catch (error) {
        logger.error(`Şifre sıfırlama hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ─── VERIFY RESET CODE ─────────────────────────────────────────────────────────
exports.verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: "❌ E-posta ve kod gerekli!" });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordCode: code,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: "❌ Geçersiz veya süresi dolmuş kod!" });
        }

        logger.info(`Şifre sıfırlama kodu doğrulandı: ${user.email}`);
        res.status(200).json({ message: "✅ Kod doğrulandı! Yeni şifrenizi belirleyin." });
    } catch (error) {
        logger.error(`Kod doğrulama hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ─── RESET PASSWORD ─────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: "❌ Tüm alanlar zorunludur!" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "❌ Şifre en az 6 karakter olmalıdır!" });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordCode: code,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: "❌ Geçersiz veya süresi dolmuş kod!" });
        }

        // Yeni şifreyi hashle ve kaydet
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        logger.info(`Şifre başarıyla sıfırlandı: ${user.email}`);
        res.status(200).json({ message: "✅ Şifreniz başarıyla değiştirildi! Artık yeni şifrenizle giriş yapabilirsiniz." });
    } catch (error) {
        logger.error(`Şifre sıfırlama hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ─── GET PROFILE ───────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
    try {
        // req.user authMiddleware tarafından set ediliyor (-password zaten seçili)
        const user = await User.findById(req.user._id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "❌ Kullanıcı bulunamadı!" });
        }

        res.status(200).json(user);
    } catch (error) {
        logger.error(`Profil alma hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};
