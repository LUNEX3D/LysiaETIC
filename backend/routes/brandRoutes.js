const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { getBrands, addBrand } = require("../controllers/brandController");

// ✅ FIX H8: authMiddleware eklendi
// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar erişemez
router.get("/", authMiddleware, subscriptionMiddleware, getBrands);
router.post("/", authMiddleware, subscriptionMiddleware, addBrand);

module.exports = router;
