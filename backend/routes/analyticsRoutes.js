const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const analyticsController = require("../controllers/analyticsController");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const requireProfit = requirePlanFeature("profit_analytics");

/**
 * Analytics Routes — LysiaETIC
 * ✅ Tam yeniden yazım — 13 endpoint
 * All routes require authentication
 * ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar erişemez
 */

// ── Temel Analiz ──
router.get("/overview", authMiddleware, subscriptionMiddleware, analyticsController.getAnalyticsOverview);
router.get("/sales-trend", authMiddleware, subscriptionMiddleware, analyticsController.getSalesTrend);
router.get("/marketplace-distribution", authMiddleware, subscriptionMiddleware, analyticsController.getMarketplaceDistribution);
router.get("/top-products", authMiddleware, subscriptionMiddleware, analyticsController.getTopProducts);
router.get("/category-distribution", authMiddleware, subscriptionMiddleware, analyticsController.getCategoryDistribution);
router.get("/hourly-sales", authMiddleware, subscriptionMiddleware, analyticsController.getHourlySales);

// ── Gelişmiş Analiz (YENİ) ──
router.get("/profit-overview", authMiddleware, subscriptionMiddleware, requireProfit, analyticsController.getProfitOverview);
router.get("/product-performance", authMiddleware, subscriptionMiddleware, requireProfit, analyticsController.getProductPerformance);
router.get("/product-profit-loss", authMiddleware, subscriptionMiddleware, requireProfit, analyticsController.getProductProfitLoss);
router.get("/marketplace-comparison", authMiddleware, subscriptionMiddleware, requireProfit, analyticsController.getMarketplaceComparison);
router.get("/commission-analysis", authMiddleware, subscriptionMiddleware, requireProfit, analyticsController.getCommissionAnalysis);
router.get("/payout-report", authMiddleware, subscriptionMiddleware, requireProfit, analyticsController.getPayoutReport);
router.get("/stock-velocity", authMiddleware, subscriptionMiddleware, analyticsController.getStockVelocity);
router.get("/actions", authMiddleware, subscriptionMiddleware, analyticsController.getActions);
router.get("/daily-summary", authMiddleware, subscriptionMiddleware, analyticsController.getDailySummary);

module.exports = router;
