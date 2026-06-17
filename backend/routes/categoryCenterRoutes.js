/**
 * Category Center Routes — LysiaETIC
 *
 * Kategori Merkezi endpoint'leri:
 *   - Master eşleştirme tablosu (Excel import)
 *   - Canlı kategori ağaçları (API)
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const controller = require("../controllers/categoryCenterController");

router.use(authMiddleware, subscriptionMiddleware);
const requireAutoMatch = requirePlanFeature("category_auto_match");

// ── Master Eşleştirme Tablosu ──
router.get("/mappings/export", controller.exportMappings);
router.get("/mappings/audit", controller.auditMappings);
router.post("/mappings/repair", requireAutoMatch, controller.repairMappings);
router.get("/mappings/stats", controller.getMappingStats);
router.get("/mappings", controller.getMappings);
router.put("/mappings/:id", controller.updateMapping);

// ── Ürün dağıtımı: Kategori Merkezi → hedef platform kategorisi ── (parametrik route'lardan önce)
router.get("/resolve-for-distribute", controller.resolveForDistribute);

// ── Pazaryeri Listesi ──
router.get("/marketplaces", controller.getMarketplaces);

// ── Akıllı Otomatik Eşleştirme ──
router.post("/auto-match/prepare", requireAutoMatch, controller.autoMatchPrepare);
router.post("/auto-match/approve", requireAutoMatch, controller.autoMatchApprove);
router.post("/auto-match/reset", requireAutoMatch, controller.autoMatchReset);
router.post("/auto-match", requireAutoMatch, controller.autoMatch);

// ── Hepsiburada Kategori Ağacı (Tree) ──
router.get("/hepsiburada/categories/export", controller.exportHepsiburadaCategoriesExcel);
router.get("/hepsiburada/categories", controller.getHepsiburadaCategoryTree);

// ── Canlı Kategori Ağacı ──
router.get("/:marketplaceName/tree", controller.getCategoryTree);

// ── Kategori Arama ──
router.get("/:marketplaceName/search", controller.searchCategories);

module.exports = router;
