const axios = require("axios");
const mongoose = require("mongoose");
const Marketplace = require("../models/Marketplace");

exports.getUserTrendyolProducts = async (req, res) => {
    try {
        let { userId } = req.params;

        // 🔹 `userId`'yi temizle (boşluklar ve yeni satır karakterleri)
        userId = userId.trim();

        // 🔹 `userId` geçerli bir MongoDB ObjectId mi kontrol et
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "❌ Geçersiz Kullanıcı ID!" });
        }

        console.log(`📢 Kullanıcının Ürünleri Çekiliyor - Kullanıcı ID: ${userId}`);

        // 🔹 Kullanıcının Trendyol API bilgilerini çek
        const userIntegration = await Marketplace.findOne({ userId, marketplaceName: "Trendyol" });

        if (!userIntegration) {
            return res.status(404).json({ error: "❌ Kullanıcı için Trendyol entegrasyonu bulunamadı!" });
        }

        const { supplierId, apiKey, apiSecret } = userIntegration.credentials;

        if (!supplierId || !apiKey || !apiSecret) {
            return res.status(400).json({ error: "❌ API kimlik bilgileri eksik!" });
        }

        const BASE_URL = "https://api.trendyol.com/sapigw";
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
        const userAgent = `${supplierId} - SelfIntegration`;

        const response = await axios.get(`${BASE_URL}/suppliers/${supplierId}/products`, {
            headers: {
                "Authorization": `Basic ${auth}`,
                "User-Agent": userAgent,
                "Content-Type": "application/json"
            }
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error("❌ Ürün çekme hatası:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Sunucu hatası!", details: error.response ? error.response.data : error.message });
    }
};
