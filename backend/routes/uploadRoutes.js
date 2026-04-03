const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { uploadProduct } = require("../controllers/uploadController");

// ✅ FIX H8: authMiddleware eklendi
router.post("/:marketplace", authMiddleware, uploadProduct);

module.exports = router;
