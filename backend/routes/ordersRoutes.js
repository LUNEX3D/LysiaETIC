const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { getAllOrders, syncAllOrders } = require("../controllers/ordersController");

// ✅ FIX H6: subscriptionMiddleware eklendi
// ✅ FIX H2: :userId kaldırıldı (controller'da req.user._id kullanılıyor)
router.get("/all", authMiddleware, subscriptionMiddleware, getAllOrders);

// ── Siparis Sync — Tum pazaryerlerinden siparisleri cekip DB'ye kaydet ──
// Gelismis Analiz sayfasi acildiginda cagirilir
router.get("/sync-all", authMiddleware, syncAllOrders);

module.exports = router;