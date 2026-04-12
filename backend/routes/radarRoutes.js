/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR ROUTES — LysiaRadar PRO API
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mounted at /api/radar in server.js
 * All routes protected with authMiddleware + subscriptionMiddleware.
 *
 * Endpoints:
 *   GET  /opportunities              — Kullanıcıya özel fırsatları getir
 *   POST /opportunities/refresh      — Fırsatları yeniden analiz et
 *   GET  /opportunities/:id          — Tek fırsat detayı
 *   POST /opportunities/:id/action   — Fırsat aksiyonu kaydet
 *   GET  /stats                      — Radar istatistikleri
 *   POST /simulate                   — Fırsat simülasyonu
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/radarController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ── Fırsatlar ──
router.get("/opportunities",              ctrl.getOpportunities);
router.post("/opportunities/refresh",     ctrl.refreshOpportunities);
router.get("/opportunities/:id",          ctrl.getOpportunityDetail);
router.post("/opportunities/:id/action",  ctrl.recordAction);

// ── İstatistikler ──
router.get("/stats",                      ctrl.getStats);

// ── Simülasyon ──
router.post("/simulate",                  ctrl.simulate);

// ── Ürün Bazlı Fırsatlar ──
router.get("/products",                   ctrl.getProductOpportunities);

module.exports = router;
