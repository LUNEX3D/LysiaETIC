/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ROKETFY ROUTES V4 — BİREBİR ROKETFY KLONU
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mounted at /api/roketfy in server.js
 * All routes protected with authMiddleware.
 *
 * Endpoints:
 *   GET  /dashboard                    — Genel bakış
 *   GET  /history                      — Analiz geçmişi
 *   GET  /categories                   — Trendyol kategori listesi
 *
 *   POST /research/products            — Ürün araştırması (Trendyol pazar)
 *   GET  /research/best-sellers        — En çok satanlar
 *   POST /research/keywords            — Anahtar kelime araştırması
 *
 *   POST /competitor/analyze           — Rakip analizi
 *
 *   POST /listing/analyze              — Listeleme analizi
 *   POST /listing/analyze-all          — Toplu listeleme analizi
 *
 *   POST /content/title                — AI başlık üretimi
 *   POST /content/description          — AI açıklama üretimi
 *
 *   POST /reviews/analyze              — Yorum analizi
 *
 *   POST /price/suggest                — Fiyat önerisi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/roketfyController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
router.use(authMiddleware, subscriptionMiddleware, requirePlanFeature("roketfy"));

// ── Dashboard & Genel ──
router.get("/dashboard",              ctrl.getDashboard);
router.get("/history",                ctrl.getHistory);
router.get("/categories",             ctrl.getCategories);

// ── Ürün Araştırması (Trendyol pazar verisi) ──
router.post("/research/products",     ctrl.researchProducts);
router.get("/research/best-sellers",  ctrl.getBestSellers);
router.post("/research/keywords",     ctrl.researchKeywords);

// ── Rakip Araştırması ──
router.get("/competitor/my-products", ctrl.getMyProducts);
router.post("/competitor/analyze",    ctrl.analyzeCompetitor);

// ── Listeleme Analisti ──
router.post("/listing/analyze",       ctrl.analyzeListing);
router.post("/listing/analyze-all",   ctrl.analyzeAllListings);

// ── AI İçerik Yazarı ──
router.post("/content/title",         ctrl.generateTitle);
router.post("/content/description",   ctrl.generateDescription);

// ── Yorum Analizi ──
router.post("/reviews/analyze",       ctrl.analyzeReviews);

// ── Fiyat Önerisi ──
router.post("/price/suggest",         ctrl.suggestPrice);

// ── Flaş Ürünler (anlık indirimli ürünler) ──
router.get("/research/flash-products", ctrl.getFlashProducts);

// ── Gelişmiş Kategori (alt kategori desteği) ──
router.get("/categories/detailed",     ctrl.getDetailedCategories);

module.exports = router;
