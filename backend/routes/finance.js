const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// ─── Unified Finance Summary (tek marketplace veya tumu — marketplaceId opsiyonel) ──
router.get("/summary", authMiddleware, financeController.getFinanceSummary);

// ─── Trendyol Financial Integrations ─────────────────────────────────────────
router.get("/trendyol/settlements", authMiddleware, financeController.getTrendyolSettlements);
router.get("/trendyol/otherfinancials", authMiddleware, financeController.getTrendyolOtherFinancials);
router.get("/trendyol/cargo-invoice-items", authMiddleware, financeController.getTrendyolCargoInvoiceItems);

module.exports = router;
