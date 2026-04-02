const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const analyticsController = require("../controllers/analyticsController");

/**
 * Analytics Routes — LysiaETIC
 * ✅ Tam yeniden yazım — 13 endpoint
 * All routes require authentication
 */

// ── Temel Analiz ──
router.get("/overview", authMiddleware, analyticsController.getAnalyticsOverview);
router.get("/sales-trend", authMiddleware, analyticsController.getSalesTrend);
router.get("/marketplace-distribution", authMiddleware, analyticsController.getMarketplaceDistribution);
router.get("/top-products", authMiddleware, analyticsController.getTopProducts);
router.get("/category-distribution", authMiddleware, analyticsController.getCategoryDistribution);
router.get("/hourly-sales", authMiddleware, analyticsController.getHourlySales);

// ── Gelişmiş Analiz (YENİ) ──
router.get("/profit-overview", authMiddleware, analyticsController.getProfitOverview);
router.get("/product-performance", authMiddleware, analyticsController.getProductPerformance);
router.get("/marketplace-comparison", authMiddleware, analyticsController.getMarketplaceComparison);
router.get("/commission-analysis", authMiddleware, analyticsController.getCommissionAnalysis);
router.get("/stock-velocity", authMiddleware, analyticsController.getStockVelocity);
router.get("/actions", authMiddleware, analyticsController.getActions);
router.get("/daily-summary", authMiddleware, analyticsController.getDailySummary);

module.exports = router;
