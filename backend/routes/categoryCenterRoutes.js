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
const controller = require("../controllers/categoryCenterController");

// Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ── Master Eşleştirme Tablosu ──
router.get("/mappings/export", controller.exportMappings);
router.get("/mappings/stats", controller.getMappingStats);
router.get("/mappings", controller.getMappings);
router.put("/mappings/:id", controller.updateMapping);

// ── Pazaryeri Listesi ──
router.get("/marketplaces", controller.getMarketplaces);

// ── Akıllı Otomatik Eşleştirme ──
router.post("/auto-match/prepare", controller.autoMatchPrepare);
router.post("/auto-match/approve", controller.autoMatchApprove);
router.post("/auto-match/reset", controller.autoMatchReset);
router.post("/auto-match", controller.autoMatch);

// ── Hepsiburada Kategori Ağacı (Tree) ──
router.get("/hepsiburada/categories/export", controller.exportHepsiburadaCategoriesExcel);
router.get("/hepsiburada/categories", controller.getHepsiburadaCategoryTree);

// ── Canlı Kategori Ağacı ──
router.get("/:marketplaceName/tree", controller.getCategoryTree);

// ── Kategori Arama ──
router.get("/:marketplaceName/search", controller.searchCategories);

module.exports = router;
