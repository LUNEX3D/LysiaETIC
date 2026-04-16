/**
 * Category Controller — LysiaETIC
 *
 * ✅ v2: Eski auth'suz Trendyol API çağrısı kaldırıldı.
 * Artık MasterCategoryMapping tablosundan veri döndürür.
 * Gerçek canlı kategori çekimi → /api/category-center/:platform/tree
 */

const MasterCategoryMapping = require("../models/MasterCategoryMapping");
const logger = require("../config/logger");

exports.getCategories = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        const platform = (req.query.platform || "").toLowerCase();
        const limit = Math.min(200, Math.max(10, parseInt(req.query.limit) || 100));

        let filter = {};

        // Platform filtresi
        if (platform === "trendyol") {
            filter.trendyolId = { $ne: null };
        } else if (platform === "n11") {
            filter.n11Id = { $ne: null };
        } else if (platform === "ciceksepeti") {
            filter.ciceksepetiId = { $ne: null };
        } else if (platform === "hepsiburada") {
            filter.hepsiburadaId = { $ne: null };
        }

        // Arama filtresi
        if (q.length >= 2) {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            filter.$or = [
                { masterName: regex },
                { masterPath: regex }
            ];
        }

        const categories = await MasterCategoryMapping.find(filter)
            .sort({ masterPath: 1 })
            .limit(limit)
            .select("masterId masterName masterPath trendyolId trendyolPath")
            .lean();

        return res.status(200).json({
            success: true,
            categories: categories.map(c => ({
                id: c.masterId || c.trendyolId,
                name: c.masterName,
                path: c.masterPath,
                trendyolId: c.trendyolId
            })),
            total: categories.length
        });
    } catch (error) {
        logger.error("Kategori listeleme hatası:", error.message);
        return res.status(500).json({ error: "Kategoriler yüklenemedi" });
    }
};
