/**
 * claimsRoutes.js â€” Ä°ade/Talep YÃ¶netimi Route'larÄ±
 * TÃ¼m route'lar /api/claims altÄ±nda Ã§alÄ±ÅŸÄ±r.
 */

const express = require("express");
const multer = require("multer");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const claimsController = require("../controllers/claimsController");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware, subscriptionMiddleware);

// Ä°ade/talep listesi (pazaryeri bazlÄ±)
router.get("/", claimsController.listClaims);

// Red/erteleme sebepleri
router.get("/reasons", claimsController.listReasons);

// Onay
router.post("/approve", claimsController.approveClaim);

// Red (Trendyol iÃ§in opsiyonel kanÄ±t dosyasÄ± â€” form-data "file")
router.post("/reject", upload.single("file"), claimsController.rejectClaim);

// Erteleme (yalnÄ±zca N11)
router.post("/pend", claimsController.pendClaim);

module.exports = router;

