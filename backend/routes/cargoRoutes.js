const express = require("express");
const router = express.Router();
const cargoController = require("../controllers/cargoController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");

// ✅ FIX H1: authMiddleware eklendi, userId artık req.user._id'den alınıyor
// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar erişemez
// URL örneği: /api/cargo?startDate=2025-01-01&endDate=2025-02-22
router.get("/", authMiddleware, subscriptionMiddleware, cargoController.getCargoTrackingOrders);

module.exports = router;
