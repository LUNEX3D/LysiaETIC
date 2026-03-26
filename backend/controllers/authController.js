const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "❌ Tüm alanlar zorunludur!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });

        await newUser.save();
        res.status(201).json({ message: "✅ Kullanıcı başarıyla kaydedildi!" });
    } catch (error) {
        console.error("❌ Kayıt hatası:", error);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "❌ Geçersiz kimlik bilgileri!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "❌ Geçersiz kimlik bilgileri!" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.status(200).json({ message: "✅ Giriş başarılı!", token, user });
    } catch (error) {
        console.error("❌ Giriş hatası:", error);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "❌ Kullanıcı bulunamadı!" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("❌ Profil alma hatası:", error);
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};
