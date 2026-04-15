/**
 * autoOrderRoutes.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════════
 * Otomatik Sipariş İşleme Route'ları
 * Mounted at /api/auto-order in server.js
 * ═══════════════════════════════════════════════════════════════
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const autoOrderController = require("../controllers/autoOrderController");

// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar erişemez
router.use(authMiddleware, subscriptionMiddleware);

// ── Config CRUD ──────────────────────────────────────────────
router.get("/configs",                autoOrderController.getConfigs);
router.get("/configs/:marketplaceId", autoOrderController.getConfig);
router.put("/configs/:marketplaceId", autoOrderController.updateConfig);

// ── Sipariş İşleme ──────────────────────────────────────────
router.post("/process/:marketplaceId", autoOrderController.processMarketplace);
router.post("/process-all",            autoOrderController.processAll);

// ── Kargo Şirketleri ────────────────────────────────────────
router.get("/cargo-companies/:marketplaceId", autoOrderController.getCargoCompanies);

// ── Durum Özeti ─────────────────────────────────────────────
router.get("/status", autoOrderController.getStatus);

module.exports = router;
