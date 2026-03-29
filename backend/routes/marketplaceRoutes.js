const express = require("express");
const router  = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
    getUserMarketplaces,
    addMarketplace,
    updateMarketplace,
    deleteMarketplace,
    testHepsiburadaCredentials
} = require("../controllers/marketplaceController");

const {
    getUnmappedCategories,
    saveCategoryMapping,
    getCategoryMappings,
    deleteCategoryMapping,
    suggestCategory,
    getUnmappedStats
} = require("../controllers/categoryMappingController");

const Marketplace       = require("../models/Marketplace");
const n11Service        = require("../services/n11Service");
const n11MappingService = require("../services/n11MappingService");
const logger            = require("../config/logger");

// ─────────────────────────────────────────────────────────────────────────────
// PAZARYERİ ENTEGRASYON CRUD
// ─────────────────────────────────────────────────────────────────────────────

// Kullanıcının tüm pazaryeri entegrasyonlarını getir
router.get("/user-marketplaces/:userId", authMiddleware, getUserMarketplaces);

// Yeni entegrasyon ekle
router.post("/integrate", authMiddleware, addMarketplace);

// Pazaryeri bilgilerini güncelle
router.put("/:id", authMiddleware, updateMarketplace);

// Pazaryeri kaydını sil
router.delete("/:id", authMiddleware, deleteMarketplace);

// Hepsiburada credential test
router.post("/test-hepsiburada", authMiddleware, testHepsiburadaCredentials);

// ─────────────────────────────────────────────────────────────────────────────
// N11 KATEGORİ AĞACI & ATTRIBUTE ENDPOİNT'LERİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * N11 kategori ağacını çek
 * GET /api/marketplace/n11/categories
 */
router.get("/n11/categories", authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace?.credentials?.apiKey) {
            return res.status(400).json({ success: false, message: "N11 entegrasyonu bulunamadı" });
        }
        const result = await n11Service.getCategories(marketplace.credentials);
        res.json(result);
    } catch (err) {
        logger.error("[N11 ROUTE] Kategori çekme hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * N11 kategori attribute'larını çek (cache + API)
 * GET /api/marketplace/n11/categories/:categoryId/attributes
 */
router.get("/n11/categories/:categoryId/attributes", authMiddleware, async (req, res) => {
    try {
        const userId     = req.user?.id || req.user?._id;
        const categoryId = parseInt(req.params.categoryId);
        if (!categoryId) {
            return res.status(400).json({ success: false, message: "Geçersiz categoryId" });
        }
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace?.credentials?.apiKey) {
            return res.status(400).json({ success: false, message: "N11 entegrasyonu bulunamadı" });
        }
        const attrs = await n11MappingService.getCategoryAttributesCached(
            userId,
            marketplace.credentials,
            categoryId
        );
        res.json({ success: true, categoryId, attributes: attrs });
    } catch (err) {
        logger.error("[N11 ROUTE] Attribute çekme hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// N11 KATEGORİ MAPPING YÖNETİMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eşleştirilemeyen kategorileri listele
 * GET /api/marketplace/n11/unmapped-categories
 * Query: ?marketplace=N11&includeResolved=false
 */
router.get("/n11/unmapped-categories", authMiddleware, getUnmappedCategories);

/**
 * Unmapped kategori istatistikleri
 * GET /api/marketplace/n11/unmapped-categories/stats
 */
router.get("/n11/unmapped-categories/stats", authMiddleware, getUnmappedStats);

/**
 * Kategori mapping kaydet (yeni format)
 * POST /api/marketplace/n11/category-mapping
 * Body: { sourceCategory, marketplace, categoryId, categoryName }
 *
 * Geriye dönük uyumluluk için eski parametre adları da desteklenir:
 * Body: { sourceCategoryName, n11CategoryId, n11CategoryName }
 */
router.post("/n11/category-mapping", authMiddleware, saveCategoryMapping);

/**
 * Kayıtlı kategori mapping'lerini listele
 * GET /api/marketplace/n11/category-mappings
 */
router.get("/n11/category-mappings", authMiddleware, getCategoryMappings);

/**
 * Kategori mapping sil
 * DELETE /api/marketplace/n11/category-mapping/:id
 */
router.delete("/n11/category-mapping/:id", authMiddleware, deleteCategoryMapping);

/**
 * Ürün bilgisine göre N11 kategori önerisi al
 * POST /api/marketplace/n11/category-suggest
 * Body: { title, category, brand }
 */
router.post("/n11/category-suggest", authMiddleware, suggestCategory);

module.exports = router;
