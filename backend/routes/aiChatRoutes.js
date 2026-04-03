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
const ctrl = require("../controllers/aiChatController");

// ── Chat Endpoints ──────────────────────────────────────────────────────────
router.post("/message",                    authMiddleware, ctrl.sendMessage);
router.get("/history/:sessionId",          authMiddleware, ctrl.getHistory);
router.get("/conversations",               authMiddleware, ctrl.getConversations);
router.delete("/conversation/:sessionId",  authMiddleware, ctrl.deleteConversation);

// ── Proactive System ────────────────────────────────────────────────────────
router.get("/alerts",                      authMiddleware, ctrl.getAlerts);
router.get("/quick-stats",                 authMiddleware, ctrl.getQuickStats);

// ── AI Operatör Engine ──────────────────────────────────────────────────────
router.post("/operator/cycle",             authMiddleware, ctrl.runOperatorCycle);
router.post("/operator/act",               authMiddleware, ctrl.executeAction);
router.get("/operator/status",             authMiddleware, ctrl.getOperatorStatus);
router.post("/operator/mode",              authMiddleware, ctrl.setOperationMode);

// ── Otonom Döngü Geçmişi & Worker ──────────────────────────────────────────
router.get("/operator/cycles",             authMiddleware, ctrl.getCycleHistory);
router.get("/operator/cycle/:id",          authMiddleware, ctrl.getCycleDetail);
router.get("/worker/status",               authMiddleware, ctrl.getWorkerStatus);
router.post("/worker/force-cycle",         authMiddleware, ctrl.forceCycle);

module.exports = router;
