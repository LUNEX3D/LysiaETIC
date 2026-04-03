const express = require("express");
const router  = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { getAllProducts }  = require("../controllers/productController");

// ✅ FIX H6: subscriptionMiddleware eklendi
// ✅ FIX H2: :userId kaldırıldı (controller'da req.user._id kullanılıyor)
router.get("/all", authMiddleware, subscriptionMiddleware, getAllProducts);

module.exports = router;
