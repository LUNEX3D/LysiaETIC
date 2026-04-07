/**
 * AKILLI KATEGORİ EŞLEŞTİRME ROUTE'LARI
 *
 * Prefix: /api/category-smart
 */

const express = require("express");
const router  = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/categorySmartController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ── Dahili Kategoriler ──────────────────────────────────────────────────────
router.get("/internal",        ctrl.getInternalCategories);
router.post("/internal",       ctrl.createInternalCategory);
router.put("/internal/:id",    ctrl.updateInternalCategory);
router.delete("/internal/:id", ctrl.deleteInternalCategory);
router.post("/internal/seed",  ctrl.seedInternalCategories);

// ── Kategori Mapping (Dahili → Pazaryeri) ───────────────────────────────────
router.get("/mappings",        ctrl.getMappings);
router.post("/mappings",       ctrl.saveMappings);
router.post("/mappings/bulk",  ctrl.bulkSaveMappings);
router.delete("/mappings/:id", ctrl.deleteMapping);

// ── Otomatik Eşleştirme & Öğrenme ──────────────────────────────────────────
router.post("/auto-match",     ctrl.autoMatch);
router.post("/bulk-match",     ctrl.bulkMatch);
router.post("/learn",          ctrl.learn);

// ── Fuzzy Kategori Eşleştirme ───────────────────────────────────────────────
router.post("/fuzzy-match",    ctrl.fuzzyMatch);
router.post("/auto-map-all",   ctrl.autoMapAll);
router.post("/resolve-category", ctrl.resolveCategory);
router.post("/cross-platform-match", ctrl.crossPlatformMatch);
router.post("/resolve-unmapped", ctrl.resolveUnmapped);
router.post("/auto-resolve-unmapped", ctrl.autoResolveUnmapped);

// ── Smart Resolver Pipeline (v2) ────────────────────────────────────────────
router.post("/smart-resolve",       ctrl.smartResolve);
router.post("/smart-resolve-batch", ctrl.smartResolveBatch);
router.get("/resolver-stats",       ctrl.getResolverStats);

// ── Platform Kategorileri ───────────────────────────────────────────────────
router.get("/platform-categories", ctrl.getPlatformCategories);

// ── Pazar Yeri Kategori Listeleme & Export ───────────────────────────────────
router.get("/marketplace-categories",              ctrl.getMarketplaceCategories);
router.get("/marketplace-categories/tree",         ctrl.getMarketplaceCategoriesTree);
router.get("/marketplace-categories/export/excel", ctrl.exportMarketplaceCategoriesExcel);
router.get("/marketplace-categories/export/pdf",   ctrl.exportMarketplaceCategoriesPDF);

// ── Attribute Mapping ───────────────────────────────────────────────────────
router.get("/attributes/:mappingId", ctrl.getAttributeMappings);
router.post("/attributes",           ctrl.saveAttributeMapping);
router.delete("/attributes/:id",     ctrl.deleteAttributeMapping);

// ── Hafıza & İstatistik ─────────────────────────────────────────────────────
router.get("/memory",          ctrl.getMemory);
router.delete("/memory/:id",   ctrl.deleteMemory);
router.get("/stats",           ctrl.getStats);

// ── Birleşik Kategori Haritası (Unified Category Map) ───────────────────────
router.post("/unified/import",       ctrl.importUnifiedCategories);
router.get("/unified",               ctrl.getUnifiedCategories);
router.get("/unified/stats",         ctrl.getUnifiedStats);
router.get("/unified/export/excel",  ctrl.exportUnifiedCategoriesExcel);
router.post("/unified/merge",        ctrl.mergeUnifiedCategories);
router.put("/unified/:id",           ctrl.updateUnifiedCategory);
router.delete("/unified/:id",        ctrl.deleteUnifiedCategory);

// ── Manuel Eşleştirme Yardımcıları ──────────────────────────────────────────
router.post("/unified/suggest-platform", ctrl.suggestPlatformCategory);
router.get("/unified/incomplete",        ctrl.getIncompleteCategories);

module.exports = router;
