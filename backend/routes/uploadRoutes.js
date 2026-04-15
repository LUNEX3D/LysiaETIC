const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { uploadProduct } = require("../controllers/uploadController");

// ✅ FIX H8: authMiddleware eklendi
// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar yükleyemez
router.post("/:marketplace", authMiddleware, subscriptionMiddleware, uploadProduct);

module.exports = router;
