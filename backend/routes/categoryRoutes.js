const express = require("express");
const router = express.Router();
const { getCategories } = require("../controllers/categoryController");

// ✅ Kategori Listeleme Rotası
router.get("/", getCategories);

module.exports = router;
