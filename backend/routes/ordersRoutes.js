const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { getAllOrders, syncAllOrders, getDbOrders } = require("../controllers/ordersController");

// ✅ FIX H6: subscriptionMiddleware eklendi
// ✅ FIX H2: :userId kaldırıldı (controller'da req.user._id kullanılıyor)
router.get("/all", authMiddleware, subscriptionMiddleware, getAllOrders);

// ── DB Orders — MongoDB'deki siparişleri fatura durumuyla birlikte getir ──
// Sipariş Yönetimi sayfasında fatura durumunu göstermek için kullanılır
// ✅ SEC: subscriptionMiddleware eklendi — süresi dolmuş kullanıcılar erişemez
router.get("/db-orders", authMiddleware, subscriptionMiddleware, getDbOrders);

// ── Siparis Sync — Tum pazaryerlerinden siparisleri cekip DB'ye kaydet ──
// Gelismis Analiz sayfasi acildiginda cagirilir
// ✅ SEC: subscriptionMiddleware eklendi — süresi dolmuş kullanıcılar erişemez
router.get("/sync-all", authMiddleware, subscriptionMiddleware, syncAllOrders);

module.exports = router;