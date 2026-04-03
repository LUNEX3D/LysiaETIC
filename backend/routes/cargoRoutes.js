const express = require("express");
const router = express.Router();
const cargoController = require("../controllers/cargoController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// ✅ FIX H1: authMiddleware eklendi, userId artık req.user._id'den alınıyor
// URL örneği: /api/cargo?startDate=2025-01-01&endDate=2025-02-22
router.get("/", authMiddleware, cargoController.getCargoTrackingOrders);

module.exports = router;
