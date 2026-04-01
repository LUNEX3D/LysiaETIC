const axios = require("axios");
const logger = require("../config/logger");
const mongoose = require("mongoose");
const Marketplace = require("../models/Marketplace");

exports.getUserTrendyolProducts = async (req, res) => {
    try {
        // ✅ FIX #2: IDOR — URL'deki userId yerine token'dan gelen kullanıcı ID'si
        const userId = req.user._id;

        logger.info(`Kullanıcının Trendyol ürünleri çekiliyor - Kullanıcı ID: ${userId}`);

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
        logger.error("❌ Ürün çekme hatası:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Sunucu hatası!", details: error.response ? error.response.data : error.message });
    }
};
