const express = require("express");
const router  = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");

const {
    getUserMarketplaces,
    addMarketplace,
    updateMarketplace,
    deleteMarketplace,
    testHepsiburadaCredentials
} = require("../controllers/marketplaceController");

// ✅ FIX E1: Validation middleware'leri eklendi
const { validateAddMarketplace, validateUpdateMarketplace } = require("../middlewares/validate");

const Marketplace       = require("../models/Marketplace");
const n11Service        = require("../services/n11Service");
const logger            = require("../config/logger");

// ─────────────────────────────────────────────────────────────────────────────
// PAZARYERİ ENTEGRASYON CRUD
// ─────────────────────────────────────────────────────────────────────────────

// ✅ FIX H6: subscriptionMiddleware eklendi
// ✅ FIX: :userId kaldırıldı — token'dan alınıyor
// Kullanıcının tüm pazaryeri entegrasyonlarını getir
router.get("/user-marketplaces", authMiddleware, subscriptionMiddleware, getUserMarketplaces);

// Yeni entegrasyon ekle — ✅ FIX E1: validateAddMarketplace eklendi
router.post("/integrate", authMiddleware, subscriptionMiddleware, validateAddMarketplace, addMarketplace);

// Pazaryeri bilgilerini güncelle — ✅ FIX E1: validateUpdateMarketplace eklendi
router.put("/:id", authMiddleware, subscriptionMiddleware, validateUpdateMarketplace, updateMarketplace);

// Pazaryeri kaydını sil
router.delete("/:id", authMiddleware, subscriptionMiddleware, deleteMarketplace);

// Hepsiburada credential test
router.post("/test-hepsiburada", authMiddleware, testHepsiburadaCredentials);

// ÇiçekSepeti credential test
router.post("/test-ciceksepeti", authMiddleware, async (req, res) => {
    try {
        const ciceksepetiController = require("../controllers/ciceksepetiController");
        return ciceksepetiController.testCredentials(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Amazon SP-API credential test
router.post("/test-amazon", authMiddleware, async (req, res) => {
    try {
        const amazonController = require("../controllers/amazonController");
        return amazonController.testCredentials(req, res);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// N11 KATEGORİ AĞACI & ATTRIBUTE ENDPOİNT'LERİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * N11 kategori ağacını çek
 * GET /api/marketplace/n11/categories
 */
router.get("/n11/categories", authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace?.credentials?.apiKey) {
            return res.status(400).json({ success: false, message: "N11 entegrasyonu bulunamadı" });
        }
        const result = await n11Service.getCategories(marketplace.credentials);
        res.json(result);
    } catch (err) {
        logger.error("[N11 ROUTE] Kategori çekme hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
