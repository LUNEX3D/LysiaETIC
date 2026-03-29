const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User   = require("../models/User");
const logger = require("../config/logger");

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

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name : name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        await newUser.save();
        logger.info(`Yeni kullanıcı kaydedildi: ${newUser.email}`);
        res.status(201).json({ message: "✅ Kullanıcı başarıyla kaydedildi!" });
    } catch (error) {
        logger.error(`Kayıt hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

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

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Başarısız giriş denemesi: ${email}`);
            return res.status(401).json({ message: "❌ Geçersiz kimlik bilgileri!" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        // ✅ FIX #2: Şifre hash'i response'dan çıkarıldı
        const { password: _pw, ...safeUser } = user.toObject();

        logger.info(`Kullanıcı giriş yaptı: ${user.email} (${user.role})`);
        res.status(200).json({ message: "✅ Giriş başarılı!", token, user: safeUser });
    } catch (error) {
        logger.error(`Giriş hatası: ${error.message}`);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

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
