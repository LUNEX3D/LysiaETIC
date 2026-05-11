/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI CHAT ROUTES — LysiaETIC AI Operatör
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mounted at /api/ai-chat in server.js
 * All routes protected with authMiddleware.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/aiChatController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ── Chat Endpoints ──────────────────────────────────────────────────────────
router.post("/message",                    ctrl.sendMessage);
router.get("/history/:sessionId",          ctrl.getHistory);
router.get("/conversations",               ctrl.getConversations);
router.delete("/conversation/:sessionId",  ctrl.deleteConversation);

// ── Proactive System ────────────────────────────────────────────────────────
router.get("/alerts",                      ctrl.getAlerts);
router.get("/quick-stats",                 ctrl.getQuickStats);
router.get("/llm-status",                  ctrl.getLlmStatus);

// ── AI Operatör Engine ──────────────────────────────────────────────────────
router.post("/operator/cycle",             ctrl.runOperatorCycle);
router.post("/operator/act",               ctrl.executeAction);
router.get("/operator/status",             ctrl.getOperatorStatus);
router.post("/operator/mode",              ctrl.setOperationMode);

// ── Otonom Döngü Geçmişi & Worker ──────────────────────────────────────────
router.get("/operator/cycles",             ctrl.getCycleHistory);
router.get("/operator/cycle/:id",          ctrl.getCycleDetail);
router.get("/worker/status",               ctrl.getWorkerStatus);
router.post("/worker/force-cycle",         ctrl.forceCycle);

module.exports = router;
