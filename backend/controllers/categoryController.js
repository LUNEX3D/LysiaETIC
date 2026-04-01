const axios = require("axios");
const logger = require("../config/logger");

exports.getCategories = async (req, res) => {
    try {
        logger.info("🟡 Kategori API'ye istek gönderiliyor..."); // Debug için log ekledik

        // Sahte API Kullanıyoruz (Gerçek API'n varsa burayı değiştir)
        const apiUrl = "https://api.trendyol.com/sapigw/product-categories";

        const response = await axios.get(apiUrl, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.data || response.data.length === 0) {
            logger.info("⚠ Kategori listesi boş!");
            return res.status(404).json({ error: "❌ Kategoriler bulunamadı!" });
        }

        logger.info("✅ Gelen Kategoriler:", response.data); // Log ile kontrol et
        return res.status(200).json(response.data);
    } catch (error) {
        logger.error("❌ Kategori API Hatası:", error.message);
        return res.status(500).json({ error: "❌ Kategoriler yüklenemedi!" });
    }
};
