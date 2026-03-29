const express = require("express");
const router  = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { getAllProducts }  = require("../controllers/productController");

// ✅ FIX #3: Auth middleware eklendi — yetkisiz erişim engellendi
router.get("/all/:userId", authMiddleware, getAllProducts);

module.exports = router;
