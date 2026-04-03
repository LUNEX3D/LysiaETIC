/**
 * Variant Routes — LysiaETIC
 * ✅ FIX H10: Boş dosya dolduruldu — placeholder route'lar eklendi
 *
 * Ürün varyant yönetimi (renk, beden, boyut vb.)
 * TODO: Varyant CRUD controller'ları implement edilecek
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const logger = require("../config/logger");

// Placeholder — varyant listesi
router.get("/:productId", authMiddleware, async (req, res) => {
    logger.info(`Varyant listesi istendi: productId=${req.params.productId}`);
    res.status(200).json({
        success: true,
        message: "Varyant modülü henüz geliştirme aşamasında.",
        variants: []
    });
});

module.exports = router;
