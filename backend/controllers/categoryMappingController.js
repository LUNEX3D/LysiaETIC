/**
 * CATEGORY MAPPING CONTROLLER
 *
 * Endpoint'ler:
 *   GET  /api/marketplace/n11/unmapped-categories     — Eşleştirilemeyen kategoriler
 *   POST /api/marketplace/n11/category-mapping        — Yeni mapping kaydet
 *   GET  /api/marketplace/n11/category-mappings       — Kayıtlı mapping'leri listele
 *   DELETE /api/marketplace/n11/category-mapping/:id  — Mapping sil
 *   POST /api/marketplace/n11/category-suggest        — Kategori önerisi al
 */

const categoryMappingService = require("../services/categoryMappingService");
const n11MappingService      = require("../services/n11MappingService");
const CategoryMapping        = require("../models/CategoryMapping");
const UnmappedCategory       = require("../models/UnmappedCategory");
const Marketplace            = require("../models/Marketplace");
const logger                 = require("../config/logger");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/marketplace/n11/unmapped-categories
// Eşleştirilemeyen kategorileri listele (çözülmemiş olanlar)
// ─────────────────────────────────────────────────────────────────────────────
const getUnmappedCategories = async (req, res) => {
    try {
        const userId           = req.user?.id || req.user?._id;
        const marketplace      = req.query.marketplace || "N11";
        const includeResolved  = req.query.includeResolved === "true";

        const categories = await categoryMappingService.getUnmappedCategories(
            userId,
            marketplace,
            includeResolved
        );

        res.json({
            success: true,
            total:   categories.length,
            data:    categories
        });
    } catch (err) {
        logger.error("[CATEGORY MAPPING] getUnmappedCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/marketplace/n11/category-mapping
// Yeni kategori mapping kaydet + UnmappedCategory'yi çözüldü işaretle
// Body: { sourceCategory, marketplace, categoryId, categoryName }
// ─────────────────────────────────────────────────────────────────────────────
const saveCategoryMapping = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const {
            sourceCategory,
            sourceCategoryName, // eski endpoint uyumluluğu
            marketplace = "N11",
            categoryId,
            categoryName,
            n11CategoryId,      // eski endpoint uyumluluğu
            n11CategoryName     // eski endpoint uyumluluğu
        } = req.body;

        // Hem yeni hem eski parametre adlarını destekle
        const srcCategory  = sourceCategory  || sourceCategoryName;
        const tgtId        = categoryId      || n11CategoryId;
        const tgtName      = categoryName    || n11CategoryName;

        if (!srcCategory || !tgtId) {
            return res.status(400).json({
                success: false,
                message: "sourceCategory ve categoryId zorunludur"
            });
        }

        // ── 1. CategoryMapping'e kaydet ──────────────────────────────────────
        await n11MappingService.saveCategoryMapping(
            userId,
            srcCategory,
            parseInt(tgtId),
            tgtName || String(tgtId)
        );

        // ── 2. UnmappedCategory'yi çözüldü olarak işaretle ──────────────────
        await categoryMappingService.resolveUnmappedCategory(
            userId,
            srcCategory,
            parseInt(tgtId),
            tgtName || String(tgtId),
            marketplace
        );

        logger.info(
            `[CATEGORY MAPPING] Kaydedildi: "${srcCategory}" → ` +
            `${marketplace} ${tgtId} (${tgtName})`
        );

        res.json({
            success: true,
            message: `"${srcCategory}" kategorisi ${marketplace} ${tgtName || tgtId} ile eşleştirildi`
        });
    } catch (err) {
        logger.error("[CATEGORY MAPPING] saveCategoryMapping hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/marketplace/n11/category-mappings
// Kayıtlı tüm N11 kategori mapping'lerini listele
// ─────────────────────────────────────────────────────────────────────────────
const getCategoryMappings = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const mappings = await CategoryMapping.find({ userId }).lean();

        const result = mappings
            .filter(m => m.marketplaceCategories?.some(mc => mc.marketplaceName === "N11"))
            .map(m => {
                const n11Cat = m.marketplaceCategories.find(mc => mc.marketplaceName === "N11");
                return {
                    id:              m._id,
                    sourceName:      m.masterCategory?.name,
                    sourcePath:      m.masterCategory?.path || [],
                    n11CategoryId:   n11Cat?.categoryId,
                    n11CategoryName: n11Cat?.categoryName,
                    isActive:        n11Cat?.isActive,
                    lastUpdated:     n11Cat?.lastUpdated
                };
            });

        res.json({ success: true, total: result.length, mappings: result });
    } catch (err) {
        logger.error("[CATEGORY MAPPING] getCategoryMappings hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/marketplace/n11/category-mapping/:id
// Kategori mapping'i sil
// ─────────────────────────────────────────────────────────────────────────────
const deleteCategoryMapping = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { id } = req.params;

        const doc = await CategoryMapping.findOne({ _id: id, userId });
        if (!doc) {
            return res.status(404).json({ success: false, message: "Mapping bulunamadı" });
        }

        await CategoryMapping.deleteOne({ _id: id, userId });

        logger.info(`[CATEGORY MAPPING] Silindi: ${id} (${doc.masterCategory?.name})`);
        res.json({ success: true, message: "Mapping silindi" });
    } catch (err) {
        logger.error("[CATEGORY MAPPING] deleteCategoryMapping hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/marketplace/n11/category-suggest
// Ürün bilgisine göre N11 kategori önerisi al
// Body: { title, category, brand }
// ─────────────────────────────────────────────────────────────────────────────
const suggestCategory = async (req, res) => {
    try {
        const { title, category, brand } = req.body;

        if (!title && !category) {
            return res.status(400).json({
                success: false,
                message: "title veya category zorunludur"
            });
        }

        const result = categoryMappingService.suggestN11Category({ title, category, brand });

        res.json({
            success: true,
            input:   { title, category, brand },
            ...result
        });
    } catch (err) {
        logger.error("[CATEGORY MAPPING] suggestCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/marketplace/n11/unmapped-categories/stats
// Özet istatistikler
// ─────────────────────────────────────────────────────────────────────────────
const getUnmappedStats = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;

        const [totalUnmapped, totalResolved, topCategories] = await Promise.all([
            UnmappedCategory.countDocuments({ userId, isResolved: false }),
            UnmappedCategory.countDocuments({ userId, isResolved: true }),
            UnmappedCategory.find({ userId, isResolved: false })
                .sort({ hitCount: -1 })
                .limit(5)
                .select("categoryName hitCount suggestedCategories")
                .lean()
        ]);

        res.json({
            success: true,
            stats: {
                totalUnmapped,
                totalResolved,
                topUnmappedCategories: topCategories.map(c => ({
                    categoryName:       c.categoryName,
                    hitCount:           c.hitCount,
                    topSuggestion:      c.suggestedCategories?.[0]?.name || null,
                    suggestionScore:    c.suggestedCategories?.[0]?.score || null
                }))
            }
        });
    } catch (err) {
        logger.error("[CATEGORY MAPPING] getUnmappedStats hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getUnmappedCategories,
    saveCategoryMapping,
    getCategoryMappings,
    deleteCategoryMapping,
    suggestCategory,
    getUnmappedStats
};
