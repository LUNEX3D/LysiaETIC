const express = require("express");
const router = express.Router();
const { fetchHepsiburadaOrders } = require("../services/ordersService");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const { authMiddleware } = require("../middlewares/authMiddleware");

// 📌 **Siparişleri API'den Çekme Route'u (Kullanıcı Kimliğine Göre)**
router.post("/orders/:userId", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.body;

        // Kullanıcının Hepsiburada entegrasyonunu bul
        const integration = await Marketplace.findOne({
            userId,
            marketplaceName: "Hepsiburada"
        });

        if (!integration) {
            return res.status(404).json({
                error: "Hepsiburada entegrasyonu bulunamadı!",
                message: "Lütfen önce Hepsiburada entegrasyonunu ekleyin."
            });
        }

        const { merchantId, apiKey } = integration.credentials;

        if (!merchantId || !apiKey) {
            return res.status(400).json({
                error: "Hepsiburada credentials eksik!",
                message: "MerchantId ve ApiKey gerekli."
            });
        }

        // 📌 **Eğer tarih verilmemişse, son 90 günü al**
        const now = Date.now();
        const defaultStartDate = now - 90 * 24 * 60 * 60 * 1000;
        const convertedStartDate = startDate ? new Date(startDate).getTime() : defaultStartDate;
        const convertedEndDate = endDate ? new Date(endDate).getTime() : now;

        const orders = await fetchHepsiburadaOrders(
            merchantId,
            apiKey,
            convertedStartDate,
            convertedEndDate
        );

        if (orders.length === 0) {
            return res.status(200).json({
                total: 0,
                orders: [],
                message: "ℹ️ Hepsiburada'da bu tarihlerde sipariş yok."
            });
        }

        return res.status(200).json({
            success: true,
            marketplace: "Hepsiburada",
            total: orders.length,
            orders,
            timeframe: {
                start: new Date(convertedStartDate).toISOString(),
                end: new Date(convertedEndDate).toISOString()
            }
        });

    } catch (error) {
        logger.error("Hepsiburada orders route error", { error: error.message });
        return res.status(500).json({
            error: "Siparişler alınamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : null
        });
    }
});

module.exports = router;
