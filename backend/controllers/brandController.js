const Brand = require("../models/Brand");
const logger = require("../config/logger");

// ✅ Markaları Getir
exports.getBrands = async (req, res) => {
    try {
        const brands = await Brand.find();
        res.status(200).json(brands);
    } catch (error) {
        logger.error("❌ Marka getirme hatası:", error);
        res.status(500).json({ error: "Markalar alınamadı!" });
    }
};

// ✅ Yeni Marka Ekle
exports.addBrand = async (req, res) => {
    try {
        const { name, userId } = req.body;
        if (!name || !userId) {
            return res.status(400).json({ error: "Marka adı ve kullanıcı ID gereklidir." });
        }

        const newBrand = new Brand({ name, userId });
        await newBrand.save();

        res.status(201).json({ message: "Marka başarıyla eklendi!", brand: newBrand });
    } catch (error) {
        logger.error("❌ Marka ekleme hatası:", error);
        res.status(500).json({ error: "Marka eklenemedi!" });
    }
};
