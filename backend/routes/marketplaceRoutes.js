const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
    getUserMarketplaces,
    addMarketplace,
    updateMarketplace,
    deleteMarketplace,
    testHepsiburadaCredentials
} = require("../controllers/marketplaceController");

// Kullanıcının tüm pazaryeri entegrasyonlarını getir
router.get("/user-marketplaces/:userId", authMiddleware, getUserMarketplaces);

// Yeni bir entegrasyon ekle (POST)
router.post("/integrate", authMiddleware, addMarketplace);

// Pazaryeri bilgilerini güncelle (PUT)
router.put("/:id", authMiddleware, updateMarketplace);

// Pazaryeri kaydını sil (DELETE)
router.delete("/:id", authMiddleware, deleteMarketplace);

// 🧪 Hepsiburada credential test endpoint
router.post("/test-hepsiburada", authMiddleware, testHepsiburadaCredentials);

module.exports = router;