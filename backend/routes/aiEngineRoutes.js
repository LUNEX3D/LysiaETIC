/**
 * AI Engine Routes — LysiaETIC AI Decision Engine
 *
 * All routes protected with authMiddleware.
 * Mounted at /api/ai-engine in server.js
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/aiEngineController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
router.use(authMiddleware, subscriptionMiddleware, requirePlanFeature("ai_assistant"));

// ── Full Dashboard (combined endpoint — reduces API calls) ──
router.get("/dashboard",                     ctrl.getFullDashboard);

// ── Recommendations ──
router.get("/recommendations",               ctrl.getRecommendations);
router.post("/recommendations/generate",     ctrl.generateRecommendations);
router.post("/recommendations/bulk-approve", ctrl.bulkApproveRecommendations);
router.post("/recommendations/bulk-reject",  ctrl.bulkRejectRecommendations);
router.post("/recommendations/:id/approve",  ctrl.approveRecommendation);
router.post("/recommendations/:id/reject",   ctrl.rejectRecommendation);
router.post("/recommendations/:id/execute",  ctrl.executeRecommendation);

// ── AI Score ──
router.get("/ai-score",                      ctrl.getAIScore);

// ── Daily Report & Actions ──
router.get("/daily-report",                  ctrl.getDailyReport);
router.get("/daily-actions",                 ctrl.getDailyActions);

// ── Strategy ──
router.get("/strategy",                      ctrl.getStrategy);

// ── Simulation ──
router.post("/simulate",                     ctrl.simulate);
router.post("/simulate-advanced",            ctrl.simulateAdvanced);
router.post("/simulate/apply",               ctrl.applySimulation);

// ── Analytics ──
router.get("/profit-heatmap",               ctrl.getProfitHeatmap);
router.get("/timing",                        ctrl.getTiming);
router.get("/retro",                         ctrl.getRetro);
router.get("/roi",                           ctrl.getROI);
router.get("/product-health",                ctrl.getProductHealth);
router.get("/learning",                      ctrl.getLearning);

// ── Goals ──
router.post("/goals",                        ctrl.createGoal);
router.get("/goals",                         ctrl.getGoals);

// ── Notifications ──
router.get("/notifications",                 ctrl.getNotifications);

// ══════════════════════════════════════════════════════════════════════════
// AI OPERATIONS BRAIN — Advanced Engines (v3)
// ══════════════════════════════════════════════════════════════════════════
router.get("/brain",                         ctrl.getBrainDashboard);
router.get("/brain/section/:name",           ctrl.getBrainSection);
router.get("/brain/focus",                   ctrl.getBrainFocus);
router.get("/brain/losses",                  ctrl.getBrainLosses);
router.get("/brain/risks",                   ctrl.getBrainRisks);
router.get("/brain/predictions",             ctrl.getBrainPredictions);
router.get("/brain/segmentation",            ctrl.getBrainSegmentation);
router.get("/brain/causes",                  ctrl.getBrainCauses);
router.get("/brain/opportunities",           ctrl.getBrainOpportunities);
router.get("/brain/self-eval",               ctrl.getBrainSelfEval);
router.get("/brain/decision-history",        ctrl.getBrainDecisionHistory);
router.post("/brain/explain/:id",            ctrl.explainRecommendation);

// ── v5 — New AI Panels ──
router.post("/brain/auto-decide",            ctrl.autoDecide);
router.get("/brain/diagnosis",               ctrl.getDiagnosis);

// ── Product Cost Management (AI Brain) ──
router.get("/brain/products",                ctrl.getBrainProducts);
router.post("/brain/update-cost",            ctrl.updateProductCost);
router.post("/brain/bulk-update-cost",       ctrl.bulkUpdateProductCost);

// ── AI Background Worker Status ──
router.get("/worker-status",                 ctrl.getWorkerStatus);

// ── AI Audit & Rollback ──
router.get("/audit",                         ctrl.getAuditList);
router.post("/audit/:id/rollback",           ctrl.rollbackAuditAction);

// ── AI Product Advisor (LysiaBrain) ──
router.get("/advisor/products",              ctrl.getAdvisorProducts);
router.get("/advisor/product/:barcode",      ctrl.getAdvisorProduct);
router.get("/advisor/mistakes",              ctrl.getAdvisorMistakes);
router.get("/advisor/platforms",             ctrl.getAdvisorPlatforms);

// ── Otonom Kontrol Kuralları ──
router.get("/autonomy-config",               ctrl.getAutonomyConfig);
router.put("/autonomy-config",               ctrl.updateAutonomyConfig);
router.post("/autonomy-config/preset/:name", ctrl.applyAutonomyPreset);
router.get("/autonomy-config/status",        ctrl.getAutonomyStatus);

module.exports = router;
