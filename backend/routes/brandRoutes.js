const express = require("express");
const router = express.Router();
const { getBrands, addBrand } = require("../controllers/brandController");

router.get("/", getBrands); // ✅ Tüm Markaları Getir
router.post("/", addBrand); // ✅ Yeni Marka Ekle

module.exports = router;
