/**
 * KATEGORİ HATA MERKEZİ CONTROLLER
 *
 * Ürün dağıtımında kategori hatası alan ürünleri yönetir:
 *   1. Hata listesini getir (platform filtreli)
 *   2. Platform kategorilerini ağaç yapısında ara/listele
 *   3. Kullanıcının seçtiği kategoriyi kaydet + ürünü tekrar gönder
 *   4. Toplu çözümleme
 *   5. İstatistikler
 */

const mongoose = require("mongoose");
const CategoryErrorLog       = require("../models/CategoryErrorLog");
const ProductMapping         = require("../models/ProductMapping");
const UnifiedCategoryMap     = require("../models/UnifiedCategoryMap");
const InternalCategoryMapping = require("../models/InternalCategoryMapping");
const Marketplace            = require("../models/Marketplace");
const logger                 = require("../config/logger");
const { distributeProductToMarketplaces } = require("../services/productSyncService");

const toObjectId = (id) => {
    if (!id) return null;
    try { return new mongoose.Types.ObjectId(String(id)); }
    catch { return null; }
};

// Platform field adı dönüşümü
const platformField = (marketplace) =>
    marketplace === "Trendyol" ? "trendyol"
    : marketplace === "N11" ? "n11"
    : (marketplace === "ÇiçekSepeti" || marketplace === "Ciceksepeti") ? "ciceksepeti"
    : marketplace === "Hepsiburada" ? "hepsiburada"
    : marketplace === "Amazon" ? "amazon"
    : null;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. KATEGORİ HATALARINI LİSTELE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-errors
 * Query: marketplace, resolved (true/false), page, limit
 */
exports.getCategoryErrors = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplace, resolved, page = 1, limit = 50 } = req.query;

        const filter = { userId };
        if (marketplace) filter.marketplace = marketplace;
        if (resolved === "true") filter.isResolved = true;
        else if (resolved === "false" || !resolved) filter.isResolved = false;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * pageSize;

        const [errors, total] = await Promise.all([
            CategoryErrorLog.find(filter)
                .sort({ lastSeenAt: -1, hitCount: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            CategoryErrorLog.countDocuments(filter)
        ]);

        // Platform bazlı özet
        const summary = await CategoryErrorLog.aggregate([
            { $match: { userId, isResolved: false } },
            { $group: { _id: "$marketplace", count: { $sum: 1 } } }
        ]);

        const platformSummary = {};
        for (const s of summary) {
            platformSummary[s._id] = s.count;
        }

        const totalUnresolved = await CategoryErrorLog.countDocuments({ userId, isResolved: false });

        res.json({
            success: true,
            errors,
            total,
            totalUnresolved,
            platformSummary,
            page: pageNum,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (err) {
        logger.error("[CATEGORY ERROR] Liste hatası:", err.message);
        res.status(500).json({ error: "Kategori hataları yüklenemedi", details: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PLATFORM KATEGORİLERİNİ ARA (Açılır-Kapanır Ağaç + Arama)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-errors/platform-categories
 * Query: marketplace (zorunlu), search, parentId, leafOnly
 *
 * UnifiedCategoryMap'ten ilgili platformun kategorilerini döndürür.
 * parentId verilirse o parent'ın child'larını, verilmezse root'ları döndürür.
 * search verilirse tüm kategorilerde arar.
 */
exports.searchPlatformCategories = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplace, search, parentId, leafOnly } = req.query;

        if (!marketplace) {
            return res.status(400).json({ error: "marketplace parametresi zorunludur" });
        }

        const field = platformField(marketplace);
        if (!field) {
            return res.status(400).json({ error: `Desteklenmeyen platform: ${marketplace}` });
        }

        const baseFilter = { [`${field}.categoryId`]: { $ne: null } };

        let categories = [];

        if (search && search.trim()) {
            // Arama modu — tüm kategorilerde ara
            const q = search.trim();
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const searchRegex = new RegExp(escaped, "i");

            const results = await UnifiedCategoryMap.find({
                ...baseFilter,
                $or: [
                    { [`${field}.categoryName`]: searchRegex },
                    { [`${field}.categoryPath`]: searchRegex },
                    { canonicalName: searchRegex }
                ]
            })
            .sort({ [`${field}.categoryName`]: 1 })
            .limit(200)
            .lean();

            categories = results.map(r => {
                const cat = r[field];
                return {
                    id:          cat.categoryId,
                    name:        cat.categoryName,
                    path:        cat.categoryPath || cat.categoryName,
                    depth:       cat.depth || 0,
                    parentId:    cat.parentId || null,
                    isLeaf:      cat.isLeaf !== false,
                    hasChildren: cat.isLeaf === false,
                    canonicalName: r.canonicalName,
                    platformCount: r.platformCount || 1
                };
            });
        } else if (parentId) {
            // Child modu — belirli parent'ın child'larını getir
            const children = await UnifiedCategoryMap.find({
                ...baseFilter,
                [`${field}.parentId`]: parentId
            })
            .sort({ [`${field}.categoryName`]: 1 })
            .lean();

            categories = children.map(r => {
                const cat = r[field];
                return {
                    id:          cat.categoryId,
                    name:        cat.categoryName,
                    path:        cat.categoryPath || cat.categoryName,
                    depth:       cat.depth || 0,
                    parentId:    cat.parentId || null,
                    isLeaf:      cat.isLeaf !== false,
                    hasChildren: cat.isLeaf === false,
                    canonicalName: r.canonicalName,
                    platformCount: r.platformCount || 1
                };
            });
        } else {
            // Root modu — en üst seviye kategorileri getir (depth=0 veya parentId yok)
            const roots = await UnifiedCategoryMap.find({
                ...baseFilter,
                $or: [
                    { [`${field}.depth`]: 0 },
                    { [`${field}.parentId`]: null },
                    { [`${field}.parentId`]: { $exists: false } }
                ]
            })
            .sort({ [`${field}.categoryName`]: 1 })
            .limit(500)
            .lean();

            categories = roots.map(r => {
                const cat = r[field];
                return {
                    id:          cat.categoryId,
                    name:        cat.categoryName,
                    path:        cat.categoryPath || cat.categoryName,
                    depth:       cat.depth || 0,
                    parentId:    cat.parentId || null,
                    isLeaf:      cat.isLeaf !== false,
                    hasChildren: cat.isLeaf === false,
                    canonicalName: r.canonicalName,
                    platformCount: r.platformCount || 1
                };
            });
        }

        // leafOnly filtresi
        if (leafOnly === "true") {
            categories = categories.filter(c => c.isLeaf);
        }

        res.json({
            success: true,
            marketplace,
            total: categories.length,
            categories
        });
    } catch (err) {
        logger.error("[CATEGORY ERROR] Platform kategori arama hatası:", err.message);
        res.status(500).json({ error: "Kategoriler yüklenemedi", details: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. KATEGORİ HATASINI ÇÖZÜMLE — Kaydet + Tekrar Gönder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-errors/resolve
 * Body: {
 *   errorId,
 *   categoryId,
 *   categoryName,
 *   categoryPath,
 *   autoRetry: true/false  — çözümledikten sonra otomatik tekrar gönder
 * }
 */
exports.resolveCategoryError = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { errorId, categoryId, categoryName, categoryPath, autoRetry = true } = req.body;

        if (!errorId || !categoryId || !categoryName) {
            return res.status(400).json({ error: "errorId, categoryId ve categoryName zorunludur" });
        }

        // Hata kaydını bul
        const errorLog = await CategoryErrorLog.findOne({ _id: errorId, userId });
        if (!errorLog) {
            return res.status(404).json({ error: "Kategori hatası bulunamadı" });
        }

        // Ürün mapping'ini bul
        const productMapping = await ProductMapping.findOne({
            _id: errorLog.productMappingId,
            userId
        });
        if (!productMapping) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        // 1. ProductMapping'deki marketplace mapping'ine categoryId yaz
        const mpMapping = productMapping.marketplaceMappings.find(
            m => m.marketplaceName === errorLog.marketplace
        );
        if (mpMapping) {
            mpMapping.categoryId   = String(categoryId);
            mpMapping.categoryName = categoryName;
            mpMapping.categoryPath = categoryPath ? categoryPath.split(" > ") : [categoryName];
            mpMapping.syncStatus   = "pending";
            mpMapping.syncError    = null;
        } else {
            productMapping.marketplaceMappings.push({
                marketplaceName: errorLog.marketplace,
                categoryId:     String(categoryId),
                categoryName:   categoryName,
                categoryPath:   categoryPath ? categoryPath.split(" > ") : [categoryName],
                marketplaceSku:     productMapping.masterProduct.sku,
                marketplaceBarcode: productMapping.masterProduct.barcode,
                price:              productMapping.masterProduct.price,
                listPrice:          productMapping.masterProduct.listPrice,
                stock:              productMapping.masterProduct.stock,
                syncStatus:         "pending"
            });
        }
        await productMapping.save();

        // 2. Hata kaydını çözüldü olarak işaretle
        errorLog.isResolved          = true;
        errorLog.resolvedAt          = new Date();
        errorLog.resolvedCategoryId   = String(categoryId);
        errorLog.resolvedCategoryName = categoryName;
        errorLog.resolvedCategoryPath = categoryPath || categoryName;

        let retryResult = null;

        // 3. Otomatik tekrar gönder
        if (autoRetry) {
            errorLog.retryStatus = "retrying";
            await errorLog.save();

            try {
                const distResults = await distributeProductToMarketplaces(
                    userId,
                    productMapping._id,
                    [errorLog.marketplace]
                );

                const result = distResults[0] || {};
                if (result.status === "success" || result.status === "pending") {
                    errorLog.retryStatus  = "success";
                    errorLog.retryMessage = result.message || "Başarıyla gönderildi";
                    errorLog.retryAt      = new Date();
                    retryResult = { success: true, message: result.message, status: result.status };
                } else {
                    errorLog.retryStatus  = "failed";
                    errorLog.retryMessage = result.message || "Gönderim başarısız";
                    errorLog.retryAt      = new Date();
                    retryResult = { success: false, message: result.message };
                }
            } catch (retryErr) {
                errorLog.retryStatus  = "failed";
                errorLog.retryMessage = retryErr.message;
                errorLog.retryAt      = new Date();
                retryResult = { success: false, message: retryErr.message };
            }
        }

        await errorLog.save();

        logger.info(
            `[CATEGORY ERROR] ✅ Çözüldü: "${errorLog.productName}" → ${errorLog.marketplace}: ` +
            `${categoryName} (ID: ${categoryId})` +
            (retryResult ? ` | Tekrar gönderim: ${retryResult.success ? "başarılı" : "başarısız"}` : "")
        );

        res.json({
            success: true,
            message: `Kategori eşleştirmesi kaydedildi${retryResult?.success ? " ve ürün tekrar gönderildi" : ""}`,
            errorLog,
            retryResult
        });
    } catch (err) {
        logger.error("[CATEGORY ERROR] Çözümleme hatası:", err.message);
        res.status(500).json({ error: "Çözümleme başarısız", details: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TEKRAR GÖNDER (Çözümlenmiş ama gönderim başarısız olanlar için)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-errors/retry
 * Body: { errorId }
 */
exports.retrySend = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { errorId } = req.body;
        if (!errorId) return res.status(400).json({ error: "errorId zorunludur" });

        const errorLog = await CategoryErrorLog.findOne({ _id: errorId, userId });
        if (!errorLog) return res.status(404).json({ error: "Hata kaydı bulunamadı" });

        if (!errorLog.resolvedCategoryId) {
            return res.status(400).json({ error: "Önce kategori seçimi yapılmalıdır" });
        }

        errorLog.retryStatus = "retrying";
        await errorLog.save();

        try {
            const distResults = await distributeProductToMarketplaces(
                userId,
                errorLog.productMappingId,
                [errorLog.marketplace]
            );

            const result = distResults[0] || {};
            if (result.status === "success" || result.status === "pending") {
                errorLog.retryStatus  = "success";
                errorLog.retryMessage = result.message || "Başarıyla gönderildi";
                errorLog.retryAt      = new Date();
                await errorLog.save();

                res.json({ success: true, message: result.message || "Ürün başarıyla gönderildi", result });
            } else {
                errorLog.retryStatus  = "failed";
                errorLog.retryMessage = result.message || "Gönderim başarısız";
                errorLog.retryAt      = new Date();
                await errorLog.save();

                res.json({ success: false, message: result.message || "Gönderim başarısız", result });
            }
        } catch (retryErr) {
            errorLog.retryStatus  = "failed";
            errorLog.retryMessage = retryErr.message;
            errorLog.retryAt      = new Date();
            await errorLog.save();

            res.status(500).json({ error: "Tekrar gönderim başarısız", details: retryErr.message });
        }
    } catch (err) {
        logger.error("[CATEGORY ERROR] Retry hatası:", err.message);
        res.status(500).json({ error: "Tekrar gönderim hatası", details: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. HATA KAYDINI SİL / TEMİZLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DELETE /api/category-errors/:id
 */
exports.deleteCategoryError = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { id } = req.params;
        const result = await CategoryErrorLog.deleteOne({ _id: id, userId });

        res.json({
            success: true,
            deleted: result.deletedCount > 0,
            message: result.deletedCount > 0 ? "Hata kaydı silindi" : "Kayıt bulunamadı"
        });
    } catch (err) {
        logger.error("[CATEGORY ERROR] Silme hatası:", err.message);
        res.status(500).json({ error: "Silme başarısız", details: err.message });
    }
};

/**
 * DELETE /api/category-errors/clear/resolved
 * Çözülmüş tüm hataları temizle
 */
exports.clearResolved = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const result = await CategoryErrorLog.deleteMany({ userId, isResolved: true });

        res.json({
            success: true,
            deleted: result.deletedCount,
            message: `${result.deletedCount} çözülmüş hata kaydı temizlendi`
        });
    } catch (err) {
        logger.error("[CATEGORY ERROR] Temizleme hatası:", err.message);
        res.status(500).json({ error: "Temizleme başarısız", details: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. İSTATİSTİKLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-errors/stats
 */
exports.getCategoryErrorStats = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const [totalErrors, unresolvedErrors, resolvedErrors, platformStats, recentErrors] = await Promise.all([
            CategoryErrorLog.countDocuments({ userId }),
            CategoryErrorLog.countDocuments({ userId, isResolved: false }),
            CategoryErrorLog.countDocuments({ userId, isResolved: true }),
            CategoryErrorLog.aggregate([
                { $match: { userId, isResolved: false } },
                { $group: {
                    _id: "$marketplace",
                    count: { $sum: 1 },
                    totalHits: { $sum: "$hitCount" }
                }}
            ]),
            CategoryErrorLog.find({ userId, isResolved: false })
                .sort({ lastSeenAt: -1 })
                .limit(5)
                .select("productName marketplace errorType lastSeenAt hitCount")
                .lean()
        ]);

        const retryStats = await CategoryErrorLog.aggregate([
            { $match: { userId, retryStatus: { $ne: null } } },
            { $group: {
                _id: "$retryStatus",
                count: { $sum: 1 }
            }}
        ]);

        const retryMap = {};
        for (const r of retryStats) retryMap[r._id] = r.count;

        res.json({
            success: true,
            stats: {
                total:      totalErrors,
                unresolved: unresolvedErrors,
                resolved:   resolvedErrors,
                platforms:  platformStats.reduce((acc, p) => {
                    acc[p._id] = { count: p.count, totalHits: p.totalHits };
                    return acc;
                }, {}),
                retry: {
                    success:  retryMap.success || 0,
                    failed:   retryMap.failed || 0,
                    retrying: retryMap.retrying || 0
                },
                recentErrors
            }
        });
    } catch (err) {
        logger.error("[CATEGORY ERROR] İstatistik hatası:", err.message);
        res.status(500).json({ error: "İstatistikler yüklenemedi", details: err.message });
    }
};
