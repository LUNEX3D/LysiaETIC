"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/wbProductBuilderController");

const wbFeature = requirePlanFeature("website_builder");
const reviewFeature = requirePlanFeature("website_builder_product_reviews");

router.use(authMiddleware, subscriptionMiddleware);

// Product Page Builder
router.get("/:siteId/product-page", wbFeature, ctrl.getProductPage);
router.put("/:siteId/product-page", wbFeature, ctrl.updateProductPage);
router.post("/:siteId/product-page/publish", wbFeature, ctrl.publishProductPage);
router.post("/:siteId/product-page/reset", wbFeature, ctrl.resetToDefault);

// Reviews (admin)
router.get("/:siteId/reviews", reviewFeature, ctrl.getReviews);
router.patch("/:siteId/reviews/:reviewId", reviewFeature, ctrl.updateReviewStatus);
router.delete("/:siteId/reviews/:reviewId", reviewFeature, ctrl.deleteReview);

module.exports = router;
