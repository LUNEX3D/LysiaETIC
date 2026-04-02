/**
 * AKILLI KATEGORİ EŞLEŞTİRME ROUTE'LARI
 *
 * Prefix: /api/category-smart
 */

const express = require("express");
const router  = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/categorySmartController");

// ── Dahili Kategoriler ──────────────────────────────────────────────────────
router.get("/internal",        authMiddleware, ctrl.getInternalCategories);
router.post("/internal",       authMiddleware, ctrl.createInternalCategory);
router.put("/internal/:id",    authMiddleware, ctrl.updateInternalCategory);
router.delete("/internal/:id", authMiddleware, ctrl.deleteInternalCategory);
router.post("/internal/seed",  authMiddleware, ctrl.seedInternalCategories);

// ── Kategori Mapping (Dahili → Pazaryeri) ───────────────────────────────────
router.get("/mappings",        authMiddleware, ctrl.getMappings);
router.post("/mappings",       authMiddleware, ctrl.saveMappings);
router.delete("/mappings/:id", authMiddleware, ctrl.deleteMapping);

// ── Otomatik Eşleştirme & Öğrenme ──────────────────────────────────────────
router.post("/auto-match",     authMiddleware, ctrl.autoMatch);
router.post("/bulk-match",     authMiddleware, ctrl.bulkMatch);
router.post("/learn",          authMiddleware, ctrl.learn);

// ── Hafıza & İstatistik ─────────────────────────────────────────────────────
router.get("/memory",          authMiddleware, ctrl.getMemory);
router.delete("/memory/:id",   authMiddleware, ctrl.deleteMemory);
router.get("/stats",           authMiddleware, ctrl.getStats);

module.exports = router;
