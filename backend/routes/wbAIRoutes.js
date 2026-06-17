"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/wbAIController");

const wbAI = requirePlanFeature("website_builder_ai");

router.use(authMiddleware, subscriptionMiddleware, wbAI);

// Job yönetimi
router.post("/:siteId/ai/generate", ctrl.createJob);
router.post("/:siteId/ai/quick", ctrl.quickGenerate);
router.get("/:siteId/ai/jobs", ctrl.getJobs);
router.get("/:siteId/ai/jobs/:jobId", ctrl.getJob);
router.delete("/:siteId/ai/jobs/:jobId", ctrl.cancelJob);
router.get("/:siteId/ai/jobs/:jobId/stream", ctrl.streamJob);

// İçerik arşivi
router.get("/:siteId/ai/contents", ctrl.getContents);
router.post("/:siteId/ai/contents/:contentId/save", ctrl.saveContent);
router.delete("/:siteId/ai/contents/:contentId", ctrl.deleteContent);

// Öneriler
router.get("/:siteId/ai/suggestions", ctrl.getSuggestions);
router.patch("/:siteId/ai/suggestions/:suggestionId", ctrl.updateSuggestion);

// Kullanım
router.get("/:siteId/ai/usage", ctrl.getUsageStats);

module.exports = router;
