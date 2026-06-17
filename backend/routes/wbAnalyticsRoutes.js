"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/wbAnalyticsController");

const analyticsFeature = requirePlanFeature("website_builder_analytics");

// Admin routes
router.get("/:siteId/analytics/summary", authMiddleware, subscriptionMiddleware, analyticsFeature, ctrl.getSummary);
router.get("/:siteId/analytics/pages", authMiddleware, subscriptionMiddleware, analyticsFeature, ctrl.getPageStats);
router.get("/:siteId/analytics/funnel", authMiddleware, subscriptionMiddleware, analyticsFeature, ctrl.getConversionFunnel);

// Public tracking (no auth, rate-limited in controller)
// /api/wb/track/:slug/* — vitrin client
router.post("/:slug/pageview", ctrl.recordPageView);
router.post("/:slug/event", ctrl.recordConversionEvent);
// Legacy paths (website-builder/sites mount)
router.post("/track/:slug/pageview", ctrl.recordPageView);
router.post("/track/:slug/event", ctrl.recordConversionEvent);

module.exports = router;
