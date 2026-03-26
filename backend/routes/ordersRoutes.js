const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { getAllOrders } = require("../controllers/ordersController");

// Tüm siparişleri çeken endpoint
router.get("/all/:userId", authMiddleware, getAllOrders);

module.exports = router;