const express = require("express");
const router = express.Router();
const { getAllProducts } = require("../controllers/productController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Kullanıcının tüm mağaza ürünlerini çeken API
router.get("/all/:userId", authMiddleware, getAllProducts);

module.exports = router;