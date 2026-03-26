const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const analyticsController = require("../controllers/analyticsController");

/**
 * Analytics Routes
 * All routes require authentication
 */

// GET /api/analytics/overview - Get KPI data
router.get("/overview", authMiddleware, analyticsController.getAnalyticsOverview);

// GET /api/analytics/sales-trend - Get sales trend data
router.get("/sales-trend", authMiddleware, analyticsController.getSalesTrend);

// GET /api/analytics/marketplace-distribution - Get marketplace distribution
router.get("/marketplace-distribution", authMiddleware, analyticsController.getMarketplaceDistribution);

// GET /api/analytics/top-products - Get top selling products
router.get("/top-products", authMiddleware, analyticsController.getTopProducts);

// GET /api/analytics/category-distribution - Get category distribution
router.get("/category-distribution", authMiddleware, analyticsController.getCategoryDistribution);

// GET /api/analytics/hourly-sales - Get hourly sales data
router.get("/hourly-sales", authMiddleware, analyticsController.getHourlySales);

module.exports = router;
