const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ─── Unified Finance Summary (tek marketplace veya tumu — marketplaceId opsiyonel) ──
router.get("/summary", financeController.getFinanceSummary);
router.get("/product-profit-analysis", financeController.getProductProfitAnalysis);

// ─── Trendyol Financial Integrations ─────────────────────────────────────────
router.get("/trendyol/settlements", financeController.getTrendyolSettlements);
router.get("/trendyol/otherfinancials", financeController.getTrendyolOtherFinancials);
router.get("/trendyol/cargo-invoice-items", financeController.getTrendyolCargoInvoiceItems);

module.exports = router;
