const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { getDashboardSummary } = require("../controllers/dashboardController");

const router = express.Router();

// Dashboard endpoint - userId'yi auth middleware'den al
router.get("/", authMiddleware, getDashboardSummary);

// Legacy endpoint - backward compatibility
router.get("/:userId", authMiddleware, getDashboardSummary);

module.exports = router;
