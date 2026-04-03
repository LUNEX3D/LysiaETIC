/**
 * Inventory Routes — LysiaETIC
 * ✅ FIX H9: Duplicate route kaldırıldı — productsRoutes ile aynı controller'ı kullanıyordu.
 * Geriye uyumluluk için productsRoutes'a proxy olarak çalışır.
 */
const express = require("express");
const router = express.Router();
const { getAllProducts } = require("../controllers/productController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");

// ✅ FIX H9 + H2: :userId kaldırıldı, subscriptionMiddleware eklendi
router.get("/all", authMiddleware, subscriptionMiddleware, getAllProducts);

module.exports = router;