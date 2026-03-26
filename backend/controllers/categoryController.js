const axios = require("axios");

exports.getCategories = async (req, res) => {
    try {
        console.log("🟡 Kategori API'ye istek gönderiliyor..."); // Debug için log ekledik

        // Sahte API Kullanıyoruz (Gerçek API'n varsa burayı değiştir)
        const apiUrl = "https://api.trendyol.com/sapigw/product-categories";

        const response = await axios.get(apiUrl, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.data || response.data.length === 0) {
            console.log("⚠ Kategori listesi boş!");
            return res.status(404).json({ error: "❌ Kategoriler bulunamadı!" });
        }

        console.log("✅ Gelen Kategoriler:", response.data); // Log ile kontrol et
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("❌ Kategori API Hatası:", error.message);
        return res.status(500).json({ error: "❌ Kategoriler yüklenemedi!" });
    }
};
