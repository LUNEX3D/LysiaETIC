/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR ROUTES — LysiaRadar PRO v2 API (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mounted at /api/radar in server.js
 * All routes protected with authMiddleware + subscriptionMiddleware.
 *
 * Mevcut Endpoints:
 *   GET  /opportunities              — Kullanıcıya özel fırsatları getir
 *   POST /opportunities/refresh      — Fırsatları yeniden analiz et
 *   GET  /opportunities/:id          — Tek fırsat detayı
 *   POST /opportunities/:id/action   — Fırsat aksiyonu kaydet
 *   GET  /stats                      — Radar istatistikleri
 *   POST /simulate                   — Fırsat simülasyonu
 *   GET  /products                   — Ürün bazlı fırsatlar
 *
 * YENİ Endpoints:
 *   GET  /trends/google              — Google Trends yükselen aramalar
 *   GET  /trends/social/:keyword     — Sosyal medya trend verisi
 *   GET  /arbitrage                  — Arbitraj fırsatları (Amazon ↔ Trendyol)
 *   GET  /keywords/trending          — Yükselen keyword'ler (tüm kaynaklar)
 *   GET  /data-sources               — Veri kaynağı durumu
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/radarController");

router.use(authMiddleware, subscriptionMiddleware, requirePlanFeature("ai_radar"));

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

// ── Google Trends (YENİ) ──
router.get("/trends/google",              ctrl.getGoogleTrends);

// ── Sosyal Medya Trendleri (YENİ) ──
router.get("/trends/social/:keyword",     ctrl.getSocialTrends);

// ── Arbitraj Fırsatları (YENİ) ──
router.get("/arbitrage",                  ctrl.getArbitrageOpportunities);

// ── Yükselen Keyword'ler (YENİ) ──
router.get("/keywords/trending",          ctrl.getTrendingKeywords);

// ── Veri Kaynağı Durumu (YENİ) ──
router.get("/data-sources",              ctrl.getDataSourceStatus);

module.exports = router;
