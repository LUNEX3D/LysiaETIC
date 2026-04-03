/**
 * AI Engine Routes — LysiaETIC AI Decision Engine
 *
 * All routes protected with authMiddleware.
 * Mounted at /api/ai-engine in server.js
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/aiEngineController");

// ── Full Dashboard (combined endpoint — reduces API calls) ──
router.get("/dashboard",                     authMiddleware, ctrl.getFullDashboard);

// ── Recommendations ──
router.get("/recommendations",               authMiddleware, ctrl.getRecommendations);
router.post("/recommendations/generate",     authMiddleware, ctrl.generateRecommendations);
router.post("/recommendations/bulk-approve", authMiddleware, ctrl.bulkApproveRecommendations);
router.post("/recommendations/bulk-reject",  authMiddleware, ctrl.bulkRejectRecommendations);
router.post("/recommendations/:id/approve",  authMiddleware, ctrl.approveRecommendation);
router.post("/recommendations/:id/reject",   authMiddleware, ctrl.rejectRecommendation);
router.post("/recommendations/:id/execute",  authMiddleware, ctrl.executeRecommendation);

// ── AI Score ──
router.get("/ai-score",                      authMiddleware, ctrl.getAIScore);

// ── Daily Report & Actions ──
router.get("/daily-report",                  authMiddleware, ctrl.getDailyReport);
router.get("/daily-actions",                 authMiddleware, ctrl.getDailyActions);

// ── Strategy ──
router.get("/strategy",                      authMiddleware, ctrl.getStrategy);

// ── Simulation ──
router.post("/simulate",                     authMiddleware, ctrl.simulate);
router.post("/simulate-advanced",            authMiddleware, ctrl.simulateAdvanced);
router.post("/simulate/apply",               authMiddleware, ctrl.applySimulation);

// ── Analytics ──
router.get("/profit-heatmap",               authMiddleware, ctrl.getProfitHeatmap);
router.get("/timing",                        authMiddleware, ctrl.getTiming);
router.get("/retro",                         authMiddleware, ctrl.getRetro);
router.get("/roi",                           authMiddleware, ctrl.getROI);
router.get("/product-health",                authMiddleware, ctrl.getProductHealth);
router.get("/learning",                      authMiddleware, ctrl.getLearning);

// ── Goals ──
router.post("/goals",                        authMiddleware, ctrl.createGoal);
router.get("/goals",                         authMiddleware, ctrl.getGoals);

// ── Notifications ──
router.get("/notifications",                 authMiddleware, ctrl.getNotifications);

// ══════════════════════════════════════════════════════════════════════════
// AI OPERATIONS BRAIN — Advanced Engines (v3)
// ══════════════════════════════════════════════════════════════════════════
router.get("/brain",                         authMiddleware, ctrl.getBrainDashboard);
router.get("/brain/focus",                   authMiddleware, ctrl.getBrainFocus);
router.get("/brain/losses",                  authMiddleware, ctrl.getBrainLosses);
router.get("/brain/risks",                   authMiddleware, ctrl.getBrainRisks);
router.get("/brain/predictions",             authMiddleware, ctrl.getBrainPredictions);
router.get("/brain/segmentation",            authMiddleware, ctrl.getBrainSegmentation);
router.get("/brain/causes",                  authMiddleware, ctrl.getBrainCauses);
router.get("/brain/opportunities",           authMiddleware, ctrl.getBrainOpportunities);
router.get("/brain/self-eval",               authMiddleware, ctrl.getBrainSelfEval);
router.get("/brain/decision-history",        authMiddleware, ctrl.getBrainDecisionHistory);
router.post("/brain/explain/:id",            authMiddleware, ctrl.explainRecommendation);

// ── v5 — New AI Panels ──
router.post("/brain/auto-decide",            authMiddleware, ctrl.autoDecide);
router.get("/brain/diagnosis",               authMiddleware, ctrl.getDiagnosis);

// ── Product Cost Management (AI Brain) ──
router.get("/brain/products",                authMiddleware, ctrl.getBrainProducts);
router.post("/brain/update-cost",            authMiddleware, ctrl.updateProductCost);
router.post("/brain/bulk-update-cost",       authMiddleware, ctrl.bulkUpdateProductCost);

// ── AI Background Worker Status ──
router.get("/worker-status",                 authMiddleware, ctrl.getWorkerStatus);

module.exports = router;
