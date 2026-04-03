const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { getBrands, addBrand } = require("../controllers/brandController");

// ✅ FIX H8: authMiddleware eklendi
router.get("/", authMiddleware, getBrands);
router.post("/", authMiddleware, addBrand);

module.exports = router;
