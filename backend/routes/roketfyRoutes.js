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
const ctrl = require("../controllers/roketfyController");

// ── Dashboard & Genel ──
router.get("/dashboard",              authMiddleware, ctrl.getDashboard);
router.get("/history",                authMiddleware, ctrl.getHistory);
router.get("/categories",             authMiddleware, ctrl.getCategories);

// ── Ürün Araştırması (Trendyol pazar verisi) ──
router.post("/research/products",     authMiddleware, ctrl.researchProducts);
router.get("/research/best-sellers",  authMiddleware, ctrl.getBestSellers);
router.post("/research/keywords",     authMiddleware, ctrl.researchKeywords);

// ── Rakip Araştırması ──
router.post("/competitor/analyze",    authMiddleware, ctrl.analyzeCompetitor);

// ── Listeleme Analisti ──
router.post("/listing/analyze",       authMiddleware, ctrl.analyzeListing);
router.post("/listing/analyze-all",   authMiddleware, ctrl.analyzeAllListings);

// ── AI İçerik Yazarı ──
router.post("/content/title",         authMiddleware, ctrl.generateTitle);
router.post("/content/description",   authMiddleware, ctrl.generateDescription);

// ── Yorum Analizi ──
router.post("/reviews/analyze",       authMiddleware, ctrl.analyzeReviews);

// ── Fiyat Önerisi ──
router.post("/price/suggest",         authMiddleware, ctrl.suggestPrice);

module.exports = router;
