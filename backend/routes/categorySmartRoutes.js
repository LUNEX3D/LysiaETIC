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
router.post("/mappings/bulk",  authMiddleware, ctrl.bulkSaveMappings);
router.delete("/mappings/:id", authMiddleware, ctrl.deleteMapping);

// ── Otomatik Eşleştirme & Öğrenme ──────────────────────────────────────────
router.post("/auto-match",     authMiddleware, ctrl.autoMatch);
router.post("/bulk-match",     authMiddleware, ctrl.bulkMatch);
router.post("/learn",          authMiddleware, ctrl.learn);

// ── Fuzzy Kategori Eşleştirme ───────────────────────────────────────────────
router.post("/fuzzy-match",    authMiddleware, ctrl.fuzzyMatch);
router.post("/auto-map-all",   authMiddleware, ctrl.autoMapAll);
router.post("/resolve-category", authMiddleware, ctrl.resolveCategory);
router.post("/cross-platform-match", authMiddleware, ctrl.crossPlatformMatch);
router.post("/resolve-unmapped", authMiddleware, ctrl.resolveUnmapped);
router.post("/auto-resolve-unmapped", authMiddleware, ctrl.autoResolveUnmapped);

// ── Smart Resolver Pipeline (v2) ────────────────────────────────────────────
router.post("/smart-resolve",       authMiddleware, ctrl.smartResolve);
router.post("/smart-resolve-batch", authMiddleware, ctrl.smartResolveBatch);
router.get("/resolver-stats",       authMiddleware, ctrl.getResolverStats);

// ── Platform Kategorileri ───────────────────────────────────────────────────
router.get("/platform-categories", authMiddleware, ctrl.getPlatformCategories);

// ── Pazar Yeri Kategori Listeleme & Export ───────────────────────────────────
router.get("/marketplace-categories",              authMiddleware, ctrl.getMarketplaceCategories);
router.get("/marketplace-categories/export/excel", authMiddleware, ctrl.exportMarketplaceCategoriesExcel);
router.get("/marketplace-categories/export/pdf",   authMiddleware, ctrl.exportMarketplaceCategoriesPDF);

// ── Attribute Mapping ───────────────────────────────────────────────────────
router.get("/attributes/:mappingId", authMiddleware, ctrl.getAttributeMappings);
router.post("/attributes",           authMiddleware, ctrl.saveAttributeMapping);
router.delete("/attributes/:id",     authMiddleware, ctrl.deleteAttributeMapping);

// ── Hafıza & İstatistik ─────────────────────────────────────────────────────
router.get("/memory",          authMiddleware, ctrl.getMemory);
router.delete("/memory/:id",   authMiddleware, ctrl.deleteMemory);
router.get("/stats",           authMiddleware, ctrl.getStats);

// ── Birleşik Kategori Haritası (Unified Category Map) ───────────────────────
router.post("/unified/import",       authMiddleware, ctrl.importUnifiedCategories);
router.get("/unified",               authMiddleware, ctrl.getUnifiedCategories);
router.get("/unified/stats",         authMiddleware, ctrl.getUnifiedStats);
router.get("/unified/export/excel",  authMiddleware, ctrl.exportUnifiedCategoriesExcel);
router.post("/unified/merge",        authMiddleware, ctrl.mergeUnifiedCategories);
router.put("/unified/:id",           authMiddleware, ctrl.updateUnifiedCategory);
router.delete("/unified/:id",        authMiddleware, ctrl.deleteUnifiedCategory);

module.exports = router;
