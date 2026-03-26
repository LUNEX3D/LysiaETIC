const express = require("express");
const router = express.Router();
const { uploadProduct } = require("../controllers/uploadController");

router.post("/:marketplace", uploadProduct); // Pazaryeri seçerek ürün yükleme

module.exports = router;
