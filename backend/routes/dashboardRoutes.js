const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { getDashboardSummary } = require("../controllers/dashboardController");

const router = express.Router();

// ✅ FIX H6: subscriptionMiddleware eklendi
// Dashboard endpoint - userId'yi auth middleware'den al
router.get("/", authMiddleware, subscriptionMiddleware, getDashboardSummary);

// ✅ FIX H3: Legacy /:userId route'u kaldırıldı — IDOR riski taşıyordu

module.exports = router;
