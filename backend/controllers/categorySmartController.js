/**
 * AKILLI KATEGORİ EŞLEŞTİRME CONTROLLER
 *
 * Endpoint'ler:
 *
 * ── Dahili Kategoriler ──
 *   GET    /api/category-smart/internal              — Tüm dahili kategorileri listele
 *   POST   /api/category-smart/internal              — Yeni dahili kategori oluştur
 *   PUT    /api/category-smart/internal/:id           — Dahili kategori güncelle
 *   DELETE /api/category-smart/internal/:id           — Dahili kategori sil
 *   POST   /api/category-smart/internal/seed          — Varsayılan kategorileri oluştur
 *
 * ── Kategori Mapping (Dahili → Pazaryeri) ──
 *   GET    /api/category-smart/mappings               — Tüm mapping'leri listele
 *   POST   /api/category-smart/mappings               — Yeni mapping kaydet
 *   POST   /api/category-smart/mappings/bulk          — Toplu mapping kaydet
 *   DELETE /api/category-smart/mappings/:id            — Mapping sil
 *
 * ── Otomatik Eşleştirme & Öğrenme ──
 *   POST   /api/category-smart/auto-match             — Tek ürün için otomatik eşleştirme
 *   POST   /api/category-smart/bulk-match             — Toplu otomatik eşleştirme
 *   POST   /api/category-smart/learn                  — Kullanıcı seçimini kaydet (öğren)
 *
 * ── Fuzzy Kategori Eşleştirme ──
 *   POST   /api/category-smart/fuzzy-match            — Fuzzy kategori eşleştirme
 *   POST   /api/category-smart/auto-map-all           — Tüm kategorileri otomatik eşleştir
 *   POST   /api/category-smart/resolve-category       — Ürün dağıtımı için kategori çözümle
 *
 * ── Platform Kategorileri ──
 *   GET    /api/category-smart/platform-categories    — Platform kategorilerini çek
 *
 * ── Attribute Mapping ──
 *   GET    /api/category-smart/attributes/:mappingId  — Attribute mapping'leri getir
 *   POST   /api/category-smart/attributes             — Attribute mapping kaydet
 *   DELETE /api/category-smart/attributes/:id         — Attribute mapping sil
 *
 * ── Hafıza & İstatistik ──
 *   GET    /api/category-smart/memory                 — Kullanıcı hafızası listele
 *   GET    /api/category-smart/stats                  — İstatistikler
 *   DELETE /api/category-smart/memory/:id             — Hafıza kaydı sil
 */

const InternalCategory        = require("../models/InternalCategory");
const InternalCategoryMapping = require("../models/InternalCategoryMapping");
const UserCategoryMemory      = require("../models/UserCategoryMemory");
const AttributeMapping        = require("../models/AttributeMapping");
const Marketplace             = require("../models/Marketplace");
const ProductMapping          = require("../models/ProductMapping");
const UnmappedCategory        = require("../models/UnmappedCategory");
const UnifiedCategoryMap      = require("../models/UnifiedCategoryMap");
const autoMatchService        = require("../services/categoryAutoMatchService");
const fuzzyService            = require("../services/categoryFuzzyMatchService");
const categoryMappingService  = require("../services/categoryMappingService");
const categoryResolverService = require("../services/categoryResolverService");
const unifiedImportService    = require("../services/unifiedCategoryImportService");
const multer                  = require("multer");
const logger                  = require("../config/logger");
const { normalize, extractMeaningfulWords } = require("../utils/textNormalize");

// Multer — memory storage (Excel upload için)
const unifiedUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.mimetype === "application/vnd.ms-excel" ||
            file.originalname.endsWith(".xlsx") ||
            file.originalname.endsWith(".xls")) {
            cb(null, true);
        } else {
            cb(new Error("Sadece Excel dosyaları (.xlsx, .xls) kabul edilir"), false);
        }
    }
}).fields([
    { name: "trendyol", maxCount: 1 },
    { name: "n11", maxCount: 1 },
    { name: "ciceksepeti", maxCount: 1 },
    { name: "hepsiburada", maxCount: 1 },
    { name: "amazon", maxCount: 1 }
]);

// userId helper
const toObjectId = (id) => {
    const mongoose = require("mongoose");
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📁 DAHİLİ KATEGORİLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-smart/internal
 * Tüm dahili kategorileri listele (hiyerarşik)
 */
exports.getInternalCategories = async (req, res) => {
    try {
        const categories = await InternalCategory.find({ isActive: true })
            .sort({ sortOrder: 1, name: 1 })
            .lean();

        // Hiyerarşik yapıya çevir
        const rootCats = categories.filter(c => !c.parentId);
        const childMap = {};
        for (const c of categories) {
            if (c.parentId) {
                const pid = c.parentId.toString();
                if (!childMap[pid]) childMap[pid] = [];
                childMap[pid].push(c);
            }
        }

        const tree = rootCats.map(root => ({
            ...root,
            children: (childMap[root._id.toString()] || []).map(child => ({
                ...child,
                children: childMap[child._id.toString()] || []
            }))
        }));

        res.json({
            success: true,
            total: categories.length,
            categories: tree,
            flat: categories
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getInternalCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/internal
 * Yeni dahili kategori oluştur
 * Body: { name, parentId?, keywords?, icon? }
 */
exports.createInternalCategory = async (req, res) => {
    try {
        const { name, parentId, keywords, icon } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Kategori adı zorunludur" });
        }

        const slug = InternalCategory.generateSlug(name.trim());

        // Slug benzersizlik kontrolü
        const existing = await InternalCategory.findOne({ slug });
        if (existing) {
            return res.status(409).json({ success: false, message: "Bu isimde bir kategori zaten mevcut" });
        }

        const category = await InternalCategory.create({
            name: name.trim(),
            slug,
            parentId: parentId || null,
            keywords: keywords || [],
            icon: icon || "📁"
        });

        categoryMappingService.invalidateCategoryCache();
        categoryResolverService.invalidateCache();
        logger.info(`[CATEGORY SMART] Dahili kategori oluşturuldu: ${name}`);
        res.status(201).json({ success: true, category });
    } catch (err) {
        logger.error("[CATEGORY SMART] createInternalCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/category-smart/internal/:id
 * Dahili kategori güncelle
 */
exports.updateInternalCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parentId, keywords, icon, isActive, sortOrder } = req.body;

        const category = await InternalCategory.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Kategori bulunamadı" });
        }

        if (name) {
            category.name = name.trim();
            category.slug = InternalCategory.generateSlug(name.trim());
        }
        if (parentId !== undefined) category.parentId = parentId || null;
        if (keywords) category.keywords = keywords;
        if (icon) category.icon = icon;
        if (isActive !== undefined) category.isActive = isActive;
        if (sortOrder !== undefined) category.sortOrder = sortOrder;

        await category.save();
        categoryMappingService.invalidateCategoryCache();
        categoryResolverService.invalidateCache();

        logger.info(`[CATEGORY SMART] Dahili kategori güncellendi: ${category.name}`);
        res.json({ success: true, category });
    } catch (err) {
        logger.error("[CATEGORY SMART] updateInternalCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/category-smart/internal/:id
 * Dahili kategori sil (soft delete)
 */
exports.deleteInternalCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await InternalCategory.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Kategori bulunamadı" });
        }

        // İlişkili mapping'leri sil
        await InternalCategoryMapping.deleteMany({ internalCategoryId: id });

        // İlişkili hafıza kayıtlarını sil
        await UserCategoryMemory.deleteMany({ internalCategoryId: id });

        // Alt kategorileri de sil
        await InternalCategory.deleteMany({ parentId: id });

        // Kategoriyi sil
        await InternalCategory.deleteOne({ _id: id });

        categoryMappingService.invalidateCategoryCache();
        categoryResolverService.invalidateCache();
        logger.info(`[CATEGORY SMART] Dahili kategori silindi: ${category.name}`);
        res.json({ success: true, message: `"${category.name}" silindi` });
    } catch (err) {
        logger.error("[CATEGORY SMART] deleteInternalCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/internal/seed
 * Varsayılan dahili kategorileri oluştur (ilk kurulum)
 */
exports.seedInternalCategories = async (req, res) => {
    try {
        const existingCount = await InternalCategory.countDocuments();
        if (existingCount > 0) {
            return res.json({
                success: true,
                message: `Zaten ${existingCount} kategori mevcut. Seed atlandı.`,
                seeded: false
            });
        }

        const SEED_DATA = [
            { name: "Telefon",         icon: "📱", keywords: ["telefon", "iphone", "samsung", "xiaomi", "cep telefonu", "akilli telefon", "smartphone", "phone"] },
            { name: "Bilgisayar",      icon: "💻", keywords: ["laptop", "bilgisayar", "notebook", "macbook", "pc", "tablet", "ipad"] },
            { name: "Elektronik",      icon: "🔌", keywords: ["elektronik", "kablo", "sarj", "kulaklik", "hoparlor", "bluetooth", "aksesuar"] },
            { name: "Ayakkabı",        icon: "👟", keywords: ["ayakkabi", "sneaker", "bot", "cizme", "topuklu", "sandalet", "terlik", "nike", "adidas", "puma"] },
            { name: "Giyim",           icon: "👕", keywords: ["elbise", "gomlek", "pantolon", "etek", "ceket", "kazak", "tisort", "bluz", "mont", "kaban"] },
            { name: "Çanta",           icon: "👜", keywords: ["canta", "sirt cantasi", "el cantasi", "cuzdan", "portfoy", "bag", "backpack"] },
            { name: "Takı",            icon: "💍", keywords: ["taki", "kupe", "kolye", "bileklik", "yuzuk", "bros", "aksesuar", "jewelry", "altin", "gumus"] },
            { name: "Saat",            icon: "⌚", keywords: ["saat", "kol saati", "watch", "akilli saat", "smartwatch"] },
            { name: "Kozmetik",        icon: "💄", keywords: ["kozmetik", "makyaj", "ruj", "fondoten", "maskara", "parfum", "cilt bakim", "serum", "krem"] },
            { name: "Ev & Yaşam",      icon: "🏠", keywords: ["ev", "dekorasyon", "mum", "tablo", "yastik", "perde", "hali", "mutfak", "banyo"] },
            { name: "Spor",            icon: "⚽", keywords: ["spor", "fitness", "yoga", "pilates", "dambil", "kosu", "bisiklet"] },
            { name: "Oyuncak",         icon: "🧸", keywords: ["oyuncak", "lego", "bebek", "puzzle", "oyun", "cocuk"] },
            { name: "Kitap",           icon: "📚", keywords: ["kitap", "roman", "dergi", "book"] },
            { name: "Gıda",            icon: "🍎", keywords: ["gida", "yiyecek", "icecek", "atistirmalik", "cikolata", "kahve", "cay"] },
            { name: "Otomotiv",        icon: "🚗", keywords: ["otomotiv", "araba", "oto", "yedek parca", "lastik", "motor"] },
            { name: "Bebek",           icon: "👶", keywords: ["bebek", "mama", "biberon", "bebek arabasi", "bebek bezi", "cocuk"] },
            { name: "Pet",             icon: "🐾", keywords: ["pet", "kedi", "kopek", "mama", "tasma", "kedi kumu", "akvaryum"] },
            { name: "Bahçe",           icon: "🌱", keywords: ["bahce", "bitki", "cicek", "saksi", "tohum", "toprak"] },
            { name: "Kırtasiye",       icon: "✏️", keywords: ["kirtasiye", "kalem", "defter", "silgi", "boya", "okul"] },
            { name: "Diğer",           icon: "📦", keywords: [] }
        ];

        const created = [];
        for (const item of SEED_DATA) {
            const slug = InternalCategory.generateSlug(item.name);
            const cat = await InternalCategory.create({
                name: item.name,
                slug,
                icon: item.icon,
                keywords: item.keywords,
                sortOrder: created.length
            });
            created.push(cat);
        }

        categoryMappingService.invalidateCategoryCache();
        categoryResolverService.invalidateCache();
        logger.info(`[CATEGORY SMART] ${created.length} varsayılan kategori oluşturuldu`);
        res.status(201).json({
            success: true,
            message: `${created.length} varsayılan kategori oluşturuldu`,
            seeded: true,
            categories: created
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] seedInternalCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 KATEGORİ MAPPING (Dahili → Pazaryeri)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-smart/mappings
 * Tüm mapping'leri listele
 */
exports.getMappings = async (req, res) => {
    try {
        const { marketplace } = req.query;

        const filter = {};
        if (marketplace) filter.marketplace = marketplace;

        const mappings = await InternalCategoryMapping.find(filter)
            .populate("internalCategoryId", "name icon slug keywords")
            .sort({ marketplace: 1 })
            .lean();

        // Dahili kategori bazlı grupla
        const grouped = {};
        for (const m of mappings) {
            const catId = m.internalCategoryId?._id?.toString();
            if (!catId) continue;
            if (!grouped[catId]) {
                grouped[catId] = {
                    internalCategory: m.internalCategoryId,
                    marketplaces: {}
                };
            }
            grouped[catId].marketplaces[m.marketplace] = {
                _id: m._id,
                marketplaceCategoryId: m.marketplaceCategoryId,
                marketplaceCategoryName: m.marketplaceCategoryName,
                marketplaceCategoryPath: m.marketplaceCategoryPath,
                confidenceScore: m.confidenceScore,
                isManualOverride: m.isManualOverride,
                matchSource: m.matchSource,
                isActive: m.isActive
            };
        }

        res.json({
            success: true,
            total: mappings.length,
            mappings: Object.values(grouped)
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getMappings hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/mappings
 * Yeni mapping kaydet veya güncelle
 * Body: { internalCategoryId, marketplace, marketplaceCategoryId?, marketplaceCategoryName, marketplaceCategoryPath? }
 */
exports.saveMappings = async (req, res) => {
    try {
        const { internalCategoryId, marketplace, marketplaceCategoryId, marketplaceCategoryName, marketplaceCategoryPath } = req.body;

        if (!internalCategoryId || !marketplace || !marketplaceCategoryName) {
            return res.status(400).json({
                success: false,
                message: "internalCategoryId, marketplace ve marketplaceCategoryName zorunludur"
            });
        }

        // Dahili kategori var mı kontrol et
        const internalCat = await InternalCategory.findById(internalCategoryId);
        if (!internalCat) {
            return res.status(404).json({ success: false, message: "Dahili kategori bulunamadı" });
        }

        // Upsert
        const mapping = await InternalCategoryMapping.findOneAndUpdate(
            { internalCategoryId, marketplace },
            {
                $set: {
                    marketplaceCategoryId: marketplaceCategoryId || null,
                    marketplaceCategoryName,
                    marketplaceCategoryPath: marketplaceCategoryPath || "",
                    confidenceScore: 1.0,
                    isManualOverride: true,
                    matchSource: "manual",
                    isActive: true
                }
            },
            { upsert: true, new: true }
        );

        logger.info(
            `[CATEGORY SMART] Mapping kaydedildi: ${internalCat.name} → ` +
            `${marketplace}: ${marketplaceCategoryName}`
        );

        res.json({ success: true, mapping });
    } catch (err) {
        logger.error("[CATEGORY SMART] saveMappings hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/category-smart/mappings/:id
 * Mapping sil
 */
exports.deleteMapping = async (req, res) => {
    try {
        const { id } = req.params;

        const mapping = await InternalCategoryMapping.findByIdAndDelete(id);
        if (!mapping) {
            return res.status(404).json({ success: false, message: "Mapping bulunamadı" });
        }

        logger.info(`[CATEGORY SMART] Mapping silindi: ${mapping.marketplace} → ${mapping.marketplaceCategoryName}`);
        res.json({ success: true, message: "Mapping silindi" });
    } catch (err) {
        logger.error("[CATEGORY SMART] deleteMapping hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 OTOMATİK EŞLEŞTİRME & ÖĞRENME
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/auto-match
 * Tek ürün için otomatik eşleştirme
 * Body: { title, description?, category?, brand? }
 */
exports.autoMatch = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { title, description, category, brand } = req.body;

        if (!title && !category) {
            return res.status(400).json({ success: false, message: "title veya category zorunludur" });
        }

        const result = await autoMatchService.autoMatch(userId, { title, description, category, brand });

        // Eşleşme varsa → marketplace mapping'lerini de getir
        let marketplaceMappings = [];
        if (result.matched && result.internalCategory?._id) {
            marketplaceMappings = await InternalCategoryMapping.find({
                internalCategoryId: result.internalCategory._id,
                isActive: true
            }).lean();
        }

        res.json({
            success: true,
            ...result,
            marketplaceMappings
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] autoMatch hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/bulk-match
 * Toplu otomatik eşleştirme
 * Body: { products: [{ title, description?, category?, brand? }, ...] }
 */
exports.bulkMatch = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { products } = req.body;

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "products dizisi zorunludur" });
        }

        if (products.length > 100) {
            return res.status(400).json({ success: false, message: "Tek seferde maksimum 100 ürün" });
        }

        const results = await autoMatchService.bulkAutoMatch(userId, products);

        const matched   = results.filter(r => r.matched).length;
        const unmatched = results.filter(r => !r.matched).length;

        res.json({
            success: true,
            total: products.length,
            matched,
            unmatched,
            results
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] bulkMatch hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/learn
 * Kullanıcı seçimini kaydet (öğren)
 * Body: { pattern, internalCategoryId }
 */
exports.learn = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { pattern, internalCategoryId } = req.body;

        if (!pattern || !internalCategoryId) {
            return res.status(400).json({ success: false, message: "pattern ve internalCategoryId zorunludur" });
        }

        const memory = await autoMatchService.learnFromUser(userId, pattern, internalCategoryId);

        // Kategori bilgisini de döndür
        const category = await InternalCategory.findById(internalCategoryId).lean();

        res.json({
            success: true,
            message: `"${pattern}" → ${category?.name || "?"} olarak öğrenildi`,
            memory,
            category
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] learn hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 HAFIZA & İSTATİSTİK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-smart/memory
 * Kullanıcının hafıza kayıtlarını listele
 */
exports.getMemory = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const memories = await UserCategoryMemory.find({ userId })
            .sort({ hitCount: -1 })
            .populate("internalCategoryId", "name icon slug")
            .lean();

        res.json({
            success: true,
            total: memories.length,
            memories: memories.map(m => ({
                _id: m._id,
                pattern: m.pattern,
                category: m.internalCategoryId?.name || "?",
                categoryId: m.internalCategoryId?._id,
                icon: m.internalCategoryId?.icon || "📁",
                hitCount: m.hitCount,
                source: m.source,
                lastUsedAt: m.lastUsedAt,
                createdAt: m.createdAt
            }))
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getMemory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/category-smart/memory/:id
 * Hafıza kaydı sil
 */
exports.deleteMemory = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { id } = req.params;

        const memory = await UserCategoryMemory.findOneAndDelete({ _id: id, userId });
        if (!memory) {
            return res.status(404).json({ success: false, message: "Hafıza kaydı bulunamadı" });
        }

        res.json({ success: true, message: `"${memory.pattern}" hafızadan silindi` });
    } catch (err) {
        logger.error("[CATEGORY SMART] deleteMemory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/stats
 * Genel istatistikler
 */
exports.getStats = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const [
            totalInternalCategories,
            totalMappings,
            totalAttributeMappings,
            totalProducts,
            memoryStats
        ] = await Promise.all([
            InternalCategory.countDocuments({ isActive: true }),
            InternalCategoryMapping.countDocuments(),
            AttributeMapping.countDocuments(),
            ProductMapping.countDocuments({ userId }),
            autoMatchService.getMemoryStats(userId)
        ]);

        // Mapping coverage — hangi pazaryerlerinde kaç mapping var
        const mappingsByMarketplace = await InternalCategoryMapping.aggregate([
            { $group: { _id: "$marketplace", count: { $sum: 1 } } }
        ]);

        const coverage = {};
        for (const m of mappingsByMarketplace) {
            coverage[m._id] = {
                mapped: m.count,
                total: totalInternalCategories,
                percentage: totalInternalCategories > 0
                    ? Math.round((m.count / totalInternalCategories) * 100)
                    : 0
            };
        }

        // Manuel vs otomatik mapping dağılımı
        const manualCount = await InternalCategoryMapping.countDocuments({ isManualOverride: true });
        const autoCount = totalMappings - manualCount;

        // Gelişmiş istatistikler — unmapped kategoriler
        const [totalUnmapped, totalResolvedUnmapped, recentResolved, urgentUnmapped] = await Promise.all([
            UnmappedCategory.countDocuments({ userId, isResolved: false }),
            UnmappedCategory.countDocuments({ userId, isResolved: true }),
            UnmappedCategory.countDocuments({
                userId, isResolved: true,
                resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }),
            UnmappedCategory.find({ userId, isResolved: false })
                .sort({ hitCount: -1 })
                .limit(5)
                .lean()
        ]);

        res.json({
            success: true,
            stats: {
                totalInternalCategories,
                totalMappings,
                totalAttributeMappings,
                totalProducts,
                manualMappings: manualCount,
                autoMappings: autoCount,
                mappingCoverage: coverage,
                // Yeni: unmapped istatistikleri
                totalUnmapped,
                totalResolvedUnmapped,
                recentResolvedCount: recentResolved,
                urgentUnmapped: urgentUnmapped.map(u => ({
                    categoryName: u.categoryName,
                    hitCount: u.hitCount,
                    targetMarketplace: u.targetMarketplace,
                    lastSeenAt: u.lastSeenAt,
                    sampleProducts: (u.sampleProducts || []).slice(0, 2)
                })),
                ...memoryStats
            }
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getStats hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 FUZZY KATEGORİ EŞLEŞTİRME
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/fuzzy-match
 * Kaynak kategori adını hedef platform kategorileriyle fuzzy eşleştir
 * Body: { sourceName, targetMarketplace, limit? }
 */
exports.fuzzyMatch = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { sourceName, targetMarketplace, limit = 5 } = req.body;

        if (!sourceName || !targetMarketplace) {
            return res.status(400).json({
                success: false,
                message: "sourceName ve targetMarketplace zorunludur"
            });
        }

        // Platform kategorilerini çek
        const categories = await fetchPlatformCategories(userId, targetMarketplace);

        if (!categories || categories.length === 0) {
            return res.json({
                success: true,
                matches: [],
                message: `${targetMarketplace} için kategori bulunamadı. Entegrasyon ayarlarını kontrol edin.`
            });
        }

        // Fuzzy eşleştirme
        const matches = fuzzyService.fuzzyMatchCategories(sourceName, categories, { limit });

        res.json({
            success: true,
            source: sourceName,
            targetMarketplace,
            totalPlatformCategories: categories.length,
            matches
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] fuzzyMatch hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/auto-map-all
 * Tüm dahili kategorileri seçilen platformlarda otomatik eşleştir
 * Body: { targetMarketplaces?: string[], minScore?: number }
 */
exports.autoMapAll = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const {
            targetMarketplaces = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"],
            minScore = 0.45
        } = req.body;

        // Tüm dahili kategorileri al
        const internalCats = await InternalCategory.find({ isActive: true }).lean();
        if (internalCats.length === 0) {
            return res.json({ success: true, message: "Dahili kategori bulunamadı", results: [] });
        }

        // Mevcut mapping'leri al (manuel override olanları atlamak için)
        const existingMappings = await InternalCategoryMapping.find({}).lean();
        const existingMap = new Map();
        for (const m of existingMappings) {
            existingMap.set(`${m.internalCategoryId}_${m.marketplace}`, m);
        }

        const results = [];
        let totalMatched = 0;
        let totalSkipped = 0;
        let totalManualSkipped = 0;

        for (const marketplace of targetMarketplaces) {
            // Platform kategorilerini çek
            const platformCats = await fetchPlatformCategories(userId, marketplace);
            if (!platformCats || platformCats.length === 0) {
                results.push({ marketplace, status: "no_categories", matched: 0 });
                continue;
            }

            let matched = 0;
            let skipped = 0;
            let manualSkipped = 0;

            for (const intCat of internalCats) {
                const key = `${intCat._id}_${marketplace}`;
                const existing = existingMap.get(key);

                // Manuel override varsa ATLA
                if (existing && existing.isManualOverride) {
                    manualSkipped++;
                    continue;
                }

                // Fuzzy eşleştirme
                const matches = fuzzyService.fuzzyMatchCategories(
                    intCat.name,
                    platformCats,
                    { limit: 1, minScore }
                );

                if (matches.length > 0) {
                    const best = matches[0];

                    // Kaydet veya güncelle
                    await InternalCategoryMapping.findOneAndUpdate(
                        { internalCategoryId: intCat._id, marketplace },
                        {
                            $set: {
                                marketplaceCategoryId: best.categoryId,
                                marketplaceCategoryName: best.categoryName,
                                marketplaceCategoryPath: best.categoryPath || "",
                                confidenceScore: best.score,
                                isManualOverride: false,
                                matchSource: "auto_fuzzy",
                                isActive: true
                            }
                        },
                        { upsert: true, new: true }
                    );
                    matched++;
                } else {
                    skipped++;
                }
            }

            totalMatched += matched;
            totalSkipped += skipped;
            totalManualSkipped += manualSkipped;

            results.push({
                marketplace,
                status: "completed",
                totalCategories: platformCats.length,
                matched,
                skipped,
                manualSkipped
            });
        }

        logger.info(
            `[AUTO MAP ALL] Tamamlandı: ${totalMatched} eşleşti, ` +
            `${totalSkipped} atlandı, ${totalManualSkipped} manuel korundu`
        );

        res.json({
            success: true,
            totalInternalCategories: internalCats.length,
            totalMatched,
            totalSkipped,
            totalManualSkipped,
            results
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] autoMapAll hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/resolve-category
 * Ürün dağıtımı için kategori çözümle
 * Body: { internalCategoryId, targetMarketplace }
 */
exports.resolveCategory = async (req, res) => {
    try {
        const { internalCategoryId, targetMarketplace } = req.body;

        if (!internalCategoryId || !targetMarketplace) {
            return res.status(400).json({
                success: false,
                message: "internalCategoryId ve targetMarketplace zorunludur"
            });
        }

        const result = await fuzzyService.resolveProductCategory(
            internalCategoryId,
            targetMarketplace
        );

        if (!result) {
            return res.json({
                success: false,
                message: `${targetMarketplace} için kategori eşleştirmesi bulunamadı`
            });
        }

        res.json({ success: true, ...result });
    } catch (err) {
        logger.error("[CATEGORY SMART] resolveCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/mappings/bulk
 * Toplu mapping kaydet (birden fazla platform için tek seferde)
 * Body: { internalCategoryId, mappings: [{ marketplace, categoryId, categoryName, categoryPath }] }
 */
exports.bulkSaveMappings = async (req, res) => {
    try {
        const { internalCategoryId, mappings } = req.body;

        if (!internalCategoryId || !mappings || !Array.isArray(mappings) || mappings.length === 0) {
            return res.status(400).json({
                success: false,
                message: "internalCategoryId ve mappings dizisi zorunludur"
            });
        }

        const internalCat = await InternalCategory.findById(internalCategoryId);
        if (!internalCat) {
            return res.status(404).json({ success: false, message: "Dahili kategori bulunamadı" });
        }

        const results = [];
        for (const m of mappings) {
            if (!m.marketplace || !m.categoryName) continue;

            try {
                const mapping = await InternalCategoryMapping.findOneAndUpdate(
                    { internalCategoryId, marketplace: m.marketplace },
                    {
                        $set: {
                            marketplaceCategoryId: m.categoryId || null,
                            marketplaceCategoryName: m.categoryName,
                            marketplaceCategoryPath: m.categoryPath || "",
                            confidenceScore: 1.0,
                            isManualOverride: true,
                            matchSource: "manual",
                            isActive: true
                        }
                    },
                    { upsert: true, new: true }
                );
                results.push({ marketplace: m.marketplace, status: "saved", mappingId: mapping._id });
            } catch (saveErr) {
                results.push({ marketplace: m.marketplace, status: "error", error: saveErr.message });
            }
        }

        logger.info(
            `[CATEGORY SMART] Toplu mapping: ${internalCat.name} → ` +
            `${results.filter(r => r.status === "saved").length} başarılı`
        );

        res.json({ success: true, results });
    } catch (err) {
        logger.error("[CATEGORY SMART] bulkSaveMappings hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 PLATFORM KATEGORİLERİ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-smart/platform-categories?marketplace=Trendyol&search=telefon
 * Belirli bir platformun kategorilerini çek (arama destekli)
 */
exports.getPlatformCategories = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { marketplace, search } = req.query;

        if (!marketplace) {
            return res.status(400).json({ success: false, message: "marketplace parametresi zorunludur" });
        }

        let categories = await fetchPlatformCategories(userId, marketplace);

        if (search && categories.length > 0) {
            const q = search.toLowerCase();
            categories = categories.filter(c =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.path || "").toLowerCase().includes(q)
            );
        }

        res.json({
            success: true,
            marketplace,
            total: categories.length,
            categories: categories.slice(0, 300)
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getPlatformCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧬 ATTRIBUTE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-smart/attributes/:mappingId
 * Belirli bir kategori mapping'inin attribute mapping'lerini getir
 */
exports.getAttributeMappings = async (req, res) => {
    try {
        const { mappingId } = req.params;

        const attrs = await AttributeMapping.find({
            categoryMappingId: mappingId,
            isActive: true
        }).sort({ isRequired: -1, internalName: 1 }).lean();

        res.json({ success: true, total: attrs.length, attributes: attrs });
    } catch (err) {
        logger.error("[CATEGORY SMART] getAttributeMappings hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/attributes
 * Attribute mapping kaydet veya güncelle
 * Body: { categoryMappingId, internalName, platformAttributeId?, platformAttributeName?, attributeType?, isRequired?, defaultValue?, options? }
 */
exports.saveAttributeMapping = async (req, res) => {
    try {
        const {
            categoryMappingId, internalName, platformAttributeId,
            platformAttributeName, attributeType, isRequired, defaultValue, options
        } = req.body;

        if (!categoryMappingId || !internalName) {
            return res.status(400).json({
                success: false,
                message: "categoryMappingId ve internalName zorunludur"
            });
        }

        const attr = await AttributeMapping.findOneAndUpdate(
            { categoryMappingId, internalName },
            {
                $set: {
                    platformAttributeId: platformAttributeId || null,
                    platformAttributeName: platformAttributeName || "",
                    attributeType: attributeType || "text",
                    isRequired: isRequired || false,
                    defaultValue: defaultValue || null,
                    options: options || [],
                    isActive: true
                }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, attribute: attr });
    } catch (err) {
        logger.error("[CATEGORY SMART] saveAttributeMapping hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/category-smart/attributes/:id
 * Attribute mapping sil
 */
exports.deleteAttributeMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const attr = await AttributeMapping.findByIdAndDelete(id);
        if (!attr) {
            return res.status(404).json({ success: false, message: "Attribute mapping bulunamadı" });
        }
        res.json({ success: true, message: "Attribute mapping silindi" });
    } catch (err) {
        logger.error("[CATEGORY SMART] deleteAttributeMapping hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Platform kategorilerini çek
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Belirli bir platformun kategorilerini çeker.
 * Trendyol ve N11 için API'den çeker, diğerleri için boş döner.
 *
 * @param {ObjectId} userId
 * @param {string} marketplaceName
 * @returns {Promise<Array<{ id, name, path, hasChildren }>>}
 */
async function fetchPlatformCategories(userId, marketplaceName) {
    const normalizeMP = (name) => {
        if (!name) return "";
        const n = name.trim().toLowerCase();
        if (n === "trendyol") return "Trendyol";
        if (n === "hepsiburada") return "Hepsiburada";
        if (n === "n11") return "N11";
        if (n === "amazon") return "Amazon";
        if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
        return name.trim();
    };

    const normalized = normalizeMP(marketplaceName);

    const marketplace = await Marketplace.findOne({
        userId,
        marketplaceName: { $regex: new RegExp(`^${normalized}$`, "i") }
    });

    if (!marketplace) {
        logger.warn(`[PLATFORM CATS] ${normalized} entegrasyonu bulunamadı — userId: ${userId}`);
        return [];
    }
    if (!marketplace.credentials || Object.keys(marketplace.credentials).length === 0) {
        logger.warn(`[PLATFORM CATS] ${normalized} credentials boş — userId: ${userId}`);
        return [];
    }
    logger.info(`[PLATFORM CATS] ${normalized} entegrasyonu bulundu — credentials keys: [${Object.keys(marketplace.credentials).join(", ")}]`);

    try {
        if (normalized === "Trendyol") {
            const { apiKey, apiSecret, sellerId, supplierId } = marketplace.credentials || {};
            const actualSellerId = sellerId || supplierId;
            if (!apiKey || !apiSecret || !actualSellerId) return [];
            const axios = require("axios");
            const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
            const response = await axios.get(
                "https://apigw.trendyol.com/integration/product/product-categories",
                {
                    headers: {
                        Authorization: `Basic ${authHeader}`,
                        "User-Agent": `${actualSellerId} - LysiaETIC`,
                        "Content-Type": "application/json"
                    },
                    timeout: 15000
                }
            );
            const flattenCats = (cats, parentPath = [], parentId = null, parentName = null, depth = 0) => {
                let result = [];
                for (const c of cats) {
                    const path = [...parentPath, c.name];
                    const childCount = (c.subCategories || []).length;
                    const hasChildren = childCount > 0;

                    result.push({
                        id: c.id,
                        name: c.name,
                        path: path.join(" > "),
                        pathSegments: path,
                        hasChildren,
                        childCount,
                        parentId,
                        parentName,
                        depth,
                        isLeaf: !hasChildren
                    });

                    if (hasChildren) {
                        result = result.concat(flattenCats(c.subCategories, path, c.id, c.name, depth + 1));
                    }
                }
                return result;
            };
            return flattenCats(response.data?.categories || []);
        }

        if (normalized === "N11") {
            const n11Service = require("../services/n11Service");
            const n11Result = await n11Service.getCategories(marketplace.credentials);
            if (!n11Result.success) return [];
            const flattenN11 = (cats, parentPath = [], parentId = null, parentName = null, depth = 0) => {
                let result = [];
                for (const c of (cats || [])) {
                    const name = c.name || c.categoryName || "";
                    const path = [...parentPath, name];
                    const childCount = (c.subCategories || []).length;
                    const hasChildren = childCount > 0;

                    result.push({
                        id: c.id || c.categoryId,
                        name,
                        path: path.join(" > "),
                        pathSegments: path,
                        hasChildren,
                        childCount,
                        parentId,
                        parentName,
                        depth,
                        isLeaf: !hasChildren
                    });

                    if (hasChildren) {
                        result = result.concat(flattenN11(c.subCategories, path, c.id || c.categoryId, name, depth + 1));
                    }
                }
                return result;
            };
            return flattenN11(n11Result.categories);
        }

        if (normalized === "ÇiçekSepeti") {
            const ciceksepetiService = require("../services/ciceksepeti/ciceksepetiService");
            const csResult = await ciceksepetiService.getCategories(marketplace.credentials);
            if (!csResult.success || !csResult.categories) return [];
            const flattenCS = (cats, parentPath = [], parentId = null, parentName = null, depth = 0) => {
                let result = [];
                for (const c of (cats || [])) {
                    const name = c.name || "";
                    const path = [...parentPath, name];
                    const childCount = (c.subCategories || []).length;
                    const hasChildren = childCount > 0;

                    result.push({
                        id: c.id || c.categoryId,
                        name,
                        path: path.join(" > "),
                        pathSegments: path,
                        hasChildren,
                        childCount,
                        parentId,
                        parentName,
                        depth,
                        isLeaf: !hasChildren
                    });

                    if (hasChildren) {
                        result = result.concat(flattenCS(c.subCategories, path, c.id || c.categoryId, name, depth + 1));
                    }
                }
                return result;
            };
            return flattenCS(csResult.categories);
        }

        if (normalized === "Hepsiburada") {
            // Hepsiburada Auth: Basic base64(username:password)
            // merchantId sadece URL'de kullanılır, auth header'da username:password
            // Geriye dönük uyumluluk: apiKey → username, serviceKey/apiSecret → password
            const { merchantId, username, password, apiKey, serviceKey, apiSecret } = marketplace.credentials || {};
            const actualUsername = username || apiKey;
            const actualPassword = password || serviceKey || apiSecret;

            if (!merchantId) {
                logger.warn(`[PLATFORM CATS] Hepsiburada merchantId eksik`);
                return [];
            }
            if (!actualUsername || !actualPassword) {
                logger.warn(`[PLATFORM CATS] Hepsiburada auth credentials eksik — username: ${!!actualUsername}, password: ${!!actualPassword}`);
                return [];
            }

            const axios = require("axios");
            const authHeader = Buffer.from(`${actualUsername}:${actualPassword}`).toString("base64");
            logger.info(`[PLATFORM CATS] Hepsiburada kategorileri çekiliyor — merchantId: ${merchantId}, user: ${String(actualUsername).substring(0, 8)}...`);
            try {
                const response = await axios.get(
                    "https://listing-external.hepsiburada.com/categories",
                    {
                        headers: {
                            Authorization: `Basic ${authHeader}`,
                            "Content-Type": "application/json",
                            "User-Agent": "LysiaETIC"
                        },
                        timeout: 30000
                    }
                );
                logger.info(`[PLATFORM CATS] Hepsiburada API yanıtı alındı — status: ${response.status}`);
                const rawCats = response.data?.categories || response.data || [];
                logger.info(`[PLATFORM CATS] Hepsiburada raw kategori sayısı: ${Array.isArray(rawCats) ? rawCats.length : typeof rawCats}`);

                const flattenHB = (cats, parentPath = [], parentId = null, parentName = null, depth = 0) => {
                    let result = [];
                    for (const c of (cats || [])) {
                        const name = c.name || c.categoryName || c.displayName || "";
                        const path = [...parentPath, name];
                        const children = c.subCategories || c.children || c.subCategoryList || [];
                        const childCount = children.length;
                        const hasChildren = childCount > 0;

                        result.push({
                            id: c.categoryId || c.id || c.categoryCode || "",
                            name,
                            path: path.join(" > "),
                            pathSegments: path,
                            hasChildren,
                            childCount,
                            parentId,
                            parentName,
                            depth,
                            isLeaf: !hasChildren
                        });

                        if (hasChildren) {
                            result = result.concat(flattenHB(children, path, c.categoryId || c.id || c.categoryCode, name, depth + 1));
                        }
                    }
                    return result;
                };
                const flat = flattenHB(Array.isArray(rawCats) ? rawCats : [rawCats]);
                logger.info(`[PLATFORM CATS] Hepsiburada düzleştirilmiş kategori sayısı: ${flat.length}`);
                return flat.length > 0 ? flat : [];
            } catch (err) {
                logger.error(`[PLATFORM CATS] Hepsiburada API hatası: ${err.response?.status} ${err.response?.statusText || err.message}`);
                if (err.response?.data) {
                    logger.error(`[PLATFORM CATS] Hepsiburada API yanıt detayı: ${JSON.stringify(err.response.data).substring(0, 500)}`);
                }
                return [];
            }
        }

        if (normalized === "Amazon") {
            // Amazon SP-API'de tüm kategorileri tek seferde çeken endpoint yok.
            // searchProductTypes ile yaygın Türkiye kategorilerini çekiyoruz.
            const { clientId, clientSecret, refreshToken, region, marketplaceId } = marketplace.credentials || {};
            if (!clientId || !clientSecret || !refreshToken) {
                logger.warn(`[PLATFORM CATS] Amazon credentials eksik — clientId: ${!!clientId}, clientSecret: ${!!clientSecret}, refreshToken: ${!!refreshToken}`);
                return [];
            }

            logger.info(`[PLATFORM CATS] Amazon kategorileri (Product Types) çekiliyor...`);
            const amazonService = require("../services/amazon/amazonSpApiService");
            const searchTerms = [
                "SHIRT", "DRESS", "SHOES", "BAG", "WATCH", "PHONE", "LAPTOP", "TABLET",
                "HEADPHONES", "CAMERA", "TOY", "BOOK", "KITCHEN", "HOME", "BEAUTY",
                "GROCERY", "BABY", "PET", "SPORTS", "AUTOMOTIVE", "GARDEN", "OFFICE",
                "ELECTRONICS", "FURNITURE", "JEWELRY", "HEALTH", "TOOLS", "LUGGAGE",
                "MUSICAL_INSTRUMENTS", "SOFTWARE", "VIDEO_GAMES"
            ];
            const seen = new Set();
            const allTypes = [];
            let successCount = 0;
            let errorCount = 0;

            for (const term of searchTerms) {
                try {
                    const result = await amazonService.searchProductTypes(marketplace.credentials, term);
                    if (result.success && result.productTypes) {
                        successCount++;
                        for (const pt of result.productTypes) {
                            const key = pt.name;
                            if (!seen.has(key)) {
                                seen.add(key);
                                allTypes.push({
                                    id: pt.name,
                                    name: pt.displayName || pt.name,
                                    path: pt.displayName || pt.name,
                                    pathSegments: [pt.displayName || pt.name],
                                    hasChildren: false,
                                    childCount: 0,
                                    parentId: null,
                                    parentName: null,
                                    depth: 0,
                                    isLeaf: true
                                });
                            }
                        }
                    } else {
                        errorCount++;
                    }
                } catch (err) {
                    errorCount++;
                    logger.debug(`[PLATFORM CATS] Amazon searchProductTypes hatası (${term}): ${err.message}`);
                }
            }

            logger.info(`[PLATFORM CATS] Amazon Product Types tamamlandı — ${successCount} başarılı, ${errorCount} hata, ${allTypes.length} benzersiz tip`);
            return allTypes;
        }

        return [];
    } catch (err) {
        logger.warn(`[PLATFORM CATS] ${normalized} kategori çekme hatası: ${err.message}`);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 EŞLEŞMEMİŞ KATEGORİ ÇÖZME (Ürün dağıtımında başarısız olanlar)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/resolve-unmapped
 * Eşleşmemiş kategoriyi çöz — hem InternalCategoryMapping'e kaydet hem UnmappedCategory'yi resolved yap
 *
 * Body: {
 *   unmappedCategoryName: string,   — Eşleşmeyen kategori adı (örn: "Dekoratif Obje ve Biblo")
 *   internalCategoryId:   string,   — Dahili kategori ID (örn: "Ev & Yaşam")
 *   marketplace:          string,   — Hedef platform (örn: "N11")
 *   platformCategoryId:   string?,  — Platform kategori ID (opsiyonel)
 *   platformCategoryName: string,   — Platform kategori adı (örn: "Dekoratif Objeler")
 *   platformCategoryPath: string?   — Platform kategori yolu (opsiyonel)
 * }
 */
exports.resolveUnmapped = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const body = req.body || {};
        const unmappedCategoryName = (body.unmappedCategoryName || "").trim();
        const internalCategoryId   = (body.internalCategoryId  || "").trim();
        const marketplace          = (body.marketplace         || "").trim();
        const catId                = (body.platformCategoryId  || "").toString().trim();
        const catName              = (body.platformCategoryName || "").trim();
        const catPath              = (body.platformCategoryPath || "").trim();

        // Validasyon
        if (!unmappedCategoryName) {
            return res.status(400).json({ success: false, message: "unmappedCategoryName zorunludur" });
        }
        if (!internalCategoryId) {
            return res.status(400).json({ success: false, message: "internalCategoryId zorunludur — dahili kategori seçin" });
        }
        if (!marketplace) {
            return res.status(400).json({ success: false, message: "marketplace zorunludur" });
        }
        if (!catName) {
            return res.status(400).json({ success: false, message: "platformCategoryName zorunludur — platform kategorisi seçin" });
        }

        // Dahili kategori var mı kontrol et
        const internalCat = await InternalCategory.findById(internalCategoryId);
        if (!internalCat) {
            return res.status(404).json({ success: false, message: "Dahili kategori bulunamadı" });
        }

        // 1. InternalCategoryMapping'e kaydet (upsert)
        const mapping = await InternalCategoryMapping.findOneAndUpdate(
            { internalCategoryId, marketplace },
            {
                $set: {
                    marketplaceCategoryId:   catId || null,
                    marketplaceCategoryName: catName,
                    marketplaceCategoryPath: catPath,
                    confidenceScore:         1.0,
                    isManualOverride:        true,
                    matchSource:             "manual_unmapped_resolve",
                    isActive:                true
                }
            },
            { upsert: true, new: true }
        );

        // 2. UnmappedCategory'yi resolved olarak işaretle
        try {
            await categoryMappingService.resolveUnmappedCategory(
                userId,
                unmappedCategoryName,
                catId || "0",
                catName,
                marketplace
            );
        } catch (resolveErr) {
            logger.warn(`[RESOLVE UNMAPPED] UnmappedCategory resolve hatası (önemsiz): ${resolveErr.message}`);
        }

        // 3. Keyword öğrenme — unmapped kategori adını dahili kategorinin keyword'lerine ekle
        const normalizedUnmapped = normalize(unmappedCategoryName);
        if (normalizedUnmapped && !(internalCat.keywords || []).includes(normalizedUnmapped)) {
            await InternalCategory.findByIdAndUpdate(internalCategoryId, {
                $addToSet: { keywords: normalizedUnmapped }
            });
            categoryMappingService.invalidateCategoryCache();
            categoryResolverService.invalidateCache();
            logger.info(`[RESOLVE UNMAPPED] Keyword eklendi: "${normalizedUnmapped}" → ${internalCat.name}`);
        }

        // 4. Çift yönlü öğrenme — sampleProducts'tan da keyword çıkar ve UserCategoryMemory'ye kaydet
        try {
            const unmappedDoc = await UnmappedCategory.findOne({
                userId, categoryName: unmappedCategoryName, targetMarketplace: marketplace
            }).lean();

            if (unmappedDoc?.sampleProducts?.length > 0) {
                const newKeywords = new Set();
                for (const title of unmappedDoc.sampleProducts) {
                    const words = extractMeaningfulWords(title);
                    for (const w of words) newKeywords.add(w);
                }
                // En anlamlı 5 kelimeyi keyword olarak ekle
                const toAdd = [...newKeywords].slice(0, 5);
                if (toAdd.length > 0) {
                    await InternalCategory.findByIdAndUpdate(internalCategoryId, {
                        $addToSet: { keywords: { $each: toAdd } }
                    });
                    categoryMappingService.invalidateCategoryCache();
                    categoryResolverService.invalidateCache();
                    logger.info(`[RESOLVE UNMAPPED] Ürün başlıklarından ${toAdd.length} keyword öğrenildi → ${internalCat.name}`);
                }
                // UserCategoryMemory'ye de kaydet
                for (const w of toAdd) {
                    try {
                        await autoMatchService.learnFromUser(userId, w, internalCategoryId, "auto_learned");
                    } catch { /* duplicate pattern — sorun değil */ }
                }
            }
        } catch (learnErr) {
            logger.debug(`[RESOLVE UNMAPPED] Çift yönlü öğrenme hatası (önemsiz): ${learnErr.message}`);
        }

        logger.info(
            `[RESOLVE UNMAPPED] ✅ "${unmappedCategoryName}" çözüldü → ` +
            `dahili: "${internalCat.name}" → ${marketplace}: "${catName}" (ID: ${catId || "yok"})`
        );

        res.json({
            success: true,
            message: `"${unmappedCategoryName}" → ${marketplace}: "${catName}" olarak eşleştirildi`,
            mapping,
            internalCategory: { name: internalCat.name, icon: internalCat.icon }
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] resolveUnmapped hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 ÇAPRAZ PLATFORM EŞLEŞTİRME
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/cross-platform-match
 * Bir platformdaki mapping'leri baz alarak diğer platformlara çapraz eşleştirme yap
 * Body: { sourcePlatform, targetPlatforms[], minScore? }
 */
exports.crossPlatformMatch = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { sourcePlatform, targetPlatforms, minScore = 0.45 } = req.body;

        if (!sourcePlatform || !targetPlatforms || !Array.isArray(targetPlatforms)) {
            return res.status(400).json({
                success: false,
                message: "sourcePlatform ve targetPlatforms (array) zorunludur"
            });
        }

        // Kaynak platformdaki tüm mapping'leri al
        const sourceMappings = await InternalCategoryMapping.find({
            marketplace: sourcePlatform,
            isActive: true
        }).populate("internalCategoryId", "name icon").lean();

        if (sourceMappings.length === 0) {
            return res.json({
                success: false,
                message: `${sourcePlatform} için mapping bulunamadı. Önce ${sourcePlatform} kategorilerini eşleştirin.`
            });
        }

        const results = [];
        let totalMatched = 0;
        let totalSkipped = 0;
        let totalManualSkipped = 0;

        for (const targetPlatform of targetPlatforms) {
            if (targetPlatform === sourcePlatform) continue;

            // Hedef platform kategorilerini çek
            const targetCats = await fetchPlatformCategories(userId, targetPlatform);
            if (!targetCats || targetCats.length === 0) {
                results.push({
                    targetPlatform,
                    status: "no_categories",
                    matched: 0,
                    skipped: 0,
                    message: `${targetPlatform} kategorileri çekilemedi`
                });
                continue;
            }

            let matched = 0;
            let skipped = 0;
            let manualSkipped = 0;
            const sampleMappings = [];

            for (const sourceMapping of sourceMappings) {
                const internalCat = sourceMapping.internalCategoryId;
                if (!internalCat) continue;

                // Bu dahili kategori için hedef platformda zaten mapping var mı?
                const existing = await InternalCategoryMapping.findOne({
                    internalCategoryId: internalCat._id,
                    marketplace: targetPlatform
                }).lean();

                // Manuel override varsa ATLA
                if (existing && existing.isManualOverride) {
                    manualSkipped++;
                    continue;
                }

                // Kaynak platformdaki kategori adını kullanarak hedef platformda fuzzy match yap
                const matches = fuzzyService.fuzzyMatchCategories(
                    sourceMapping.marketplaceCategoryName,
                    targetCats,
                    { limit: 1, minScore }
                );

                if (matches.length > 0) {
                    const best = matches[0];

                    // Kaydet
                    await InternalCategoryMapping.findOneAndUpdate(
                        { internalCategoryId: internalCat._id, marketplace: targetPlatform },
                        {
                            $set: {
                                marketplaceCategoryId: best.categoryId,
                                marketplaceCategoryName: best.categoryName,
                                marketplaceCategoryPath: best.categoryPath || "",
                                confidenceScore: best.score,
                                isManualOverride: false,
                                matchSource: "auto_cross_platform",
                                isActive: true
                            }
                        },
                        { upsert: true, new: true }
                    );

                    matched++;

                    // İlk 10 örneği sakla
                    if (sampleMappings.length < 10) {
                        sampleMappings.push({
                            internalCategory: internalCat.name,
                            icon: internalCat.icon,
                            sourceCategory: sourceMapping.marketplaceCategoryName,
                            targetCategory: best.categoryName,
                            score: best.score
                        });
                    }
                } else {
                    skipped++;
                }
            }

            totalMatched += matched;
            totalSkipped += skipped;
            totalManualSkipped += manualSkipped;

            results.push({
                targetPlatform,
                status: "completed",
                totalCategories: targetCats.length,
                matched,
                skipped,
                manualSkipped,
                sampleMappings
            });
        }

        logger.info(
            `[CROSS PLATFORM] ${sourcePlatform} → ${targetPlatforms.join(", ")}: ` +
            `${totalMatched} eşleşti, ${totalSkipped} atlandı, ${totalManualSkipped} manuel korundu`
        );

        res.json({
            success: true,
            sourcePlatform,
            totalSourceMappings: sourceMappings.length,
            totalMatched,
            totalSkipped,
            totalManualSkipped,
            results
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] crossPlatformMatch hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 TOPLU OTOMATİK UNMAPPED ÇÖZÜMLEME
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/auto-resolve-unmapped
 * Tüm eşleşmemiş kategorileri otomatik çözmeye çalış.
 *
 * Her unmapped kategori için:
 *   1. categoryAutoMatchService ile dahili kategori bul
 *   2. fuzzyMatchCategories ile platform kategorisi bul
 *   3. Skor yeterince yüksekse (>= minScore) otomatik kaydet
 *   4. Düşük skorluları "öneri" olarak döndür
 *
 * Body: { marketplace?: string, minScore?: number }
 */
exports.autoResolveUnmapped = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { marketplace = "N11", minScore = 0.6 } = req.body;

        // 1. Çözülmemiş kategorileri al
        const unmappedDocs = await UnmappedCategory.find({
            userId,
            targetMarketplace: marketplace,
            isResolved: false
        }).sort({ hitCount: -1 }).lean();

        if (unmappedDocs.length === 0) {
            return res.json({
                success: true,
                message: `${marketplace} için çözülmemiş kategori yok`,
                resolved: 0, skipped: 0, suggestions: []
            });
        }

        // 2. Platform kategorilerini çek
        const platformCats = await fetchPlatformCategories(userId, marketplace);
        if (!platformCats || platformCats.length === 0) {
            return res.json({
                success: false,
                message: `${marketplace} platform kategorileri çekilemedi. Entegrasyon ayarlarını kontrol edin.`
            });
        }

        // 3. Dahili kategorileri cache'den al
        const internalCats = await categoryMappingService.getInternalCategoriesCached();

        let resolved = 0;
        let skipped = 0;
        const suggestions = [];

        for (const unmapped of unmappedDocs) {
            const catName = unmapped.categoryName || "";
            const normalizedCat = normalize(catName);

            // Adım A: Dahili kategori bul (keyword + isim bazlı)
            let bestInternalCat = null;
            let bestInternalScore = 0;

            for (const ic of internalCats) {
                const icName = normalize(ic.name || "");
                const icKeywords = (ic.keywords || []).map(k => normalize(k));

                // Tam isim eşleşmesi
                if (normalizedCat === icName || normalizedCat.includes(icName) || icName.includes(normalizedCat)) {
                    const score = normalizedCat === icName ? 1.0 : 0.85;
                    if (score > bestInternalScore) { bestInternalScore = score; bestInternalCat = ic; }
                    continue;
                }

                // Keyword eşleşmesi
                let kwHits = 0;
                for (const kw of icKeywords) {
                    if (normalizedCat.includes(kw) || kw.includes(normalizedCat)) kwHits++;
                }
                if (icKeywords.length > 0 && kwHits > 0) {
                    const score = Math.min(kwHits / Math.max(icKeywords.length, 1), 1.0) * 0.8;
                    if (score > bestInternalScore) { bestInternalScore = score; bestInternalCat = ic; }
                }
            }

            if (!bestInternalCat || bestInternalScore < 0.3) {
                // Dahili kategori bulunamadı — öneri olarak döndür
                suggestions.push({
                    categoryName: catName,
                    hitCount: unmapped.hitCount,
                    status: "no_internal_match",
                    message: "Dahili kategori eşleşmesi bulunamadı — manuel çözüm gerekli"
                });
                skipped++;
                continue;
            }

            // Adım B: Platform kategorisi bul (fuzzy match)
            const matches = fuzzyService.fuzzyMatchCategories(catName, platformCats, { limit: 1, minScore });

            if (matches.length === 0) {
                suggestions.push({
                    categoryName: catName,
                    hitCount: unmapped.hitCount,
                    internalCategory: { name: bestInternalCat.name, icon: bestInternalCat.icon, _id: bestInternalCat._id },
                    internalScore: bestInternalScore,
                    status: "no_platform_match",
                    message: `${marketplace} kategorisi bulunamadı (minScore: ${minScore}) — manuel çözüm gerekli`
                });
                skipped++;
                continue;
            }

            const bestPlatform = matches[0];

            // Adım C: Otomatik kaydet
            await InternalCategoryMapping.findOneAndUpdate(
                { internalCategoryId: bestInternalCat._id, marketplace },
                {
                    $set: {
                        marketplaceCategoryId:   bestPlatform.categoryId,
                        marketplaceCategoryName: bestPlatform.categoryName,
                        marketplaceCategoryPath: bestPlatform.categoryPath || "",
                        confidenceScore:         bestPlatform.score,
                        isManualOverride:        false,
                        matchSource:             "auto_batch_resolve",
                        isActive:                true
                    }
                },
                { upsert: true, new: true }
            );

            // UnmappedCategory'yi resolved yap
            await categoryMappingService.resolveUnmappedCategory(
                userId, catName,
                bestPlatform.categoryId, bestPlatform.categoryName,
                marketplace
            );

            // Keyword öğren
            const normalizedKw = normalize(catName);
            if (normalizedKw && !(bestInternalCat.keywords || []).includes(normalizedKw)) {
                await InternalCategory.findByIdAndUpdate(bestInternalCat._id, {
                    $addToSet: { keywords: normalizedKw }
                });
            }

            resolved++;

            logger.info(
                `[AUTO RESOLVE] ✅ "${catName}" → dahili: "${bestInternalCat.name}" → ` +
                `${marketplace}: "${bestPlatform.categoryName}" (skor: ${bestPlatform.score})`
            );
        }

        categoryMappingService.invalidateCategoryCache();
        categoryResolverService.invalidateCache();

        logger.info(
            `[AUTO RESOLVE] Tamamlandı: ${resolved} çözüldü, ${skipped} atlandı, ` +
            `${suggestions.length} öneri (${marketplace})`
        );

        res.json({
            success: true,
            marketplace,
            total: unmappedDocs.length,
            resolved,
            skipped,
            suggestions
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] autoResolveUnmapped hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 SMART RESOLVER — Unified Category Resolution Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/smart-resolve
 * Tek ürün için 4 adımlı akıllı kategori çözümleme.
 *
 * Pipeline: Exact → Learned → Hybrid AI → Fallback
 *
 * Body: { product: { title, category, brand, description }, marketplace }
 */
exports.smartResolve = async (req, res) => {
    try {
        const userId = toObjectId(req.user?.userId || req.user?._id);
        const { product, marketplace } = req.body;

        if (!product || !marketplace) {
            return res.status(400).json({
                success: false,
                message: "product ve marketplace zorunludur"
            });
        }

        const result = await categoryResolverService.resolveCategory(
            userId, product, marketplace
        );

        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] smartResolve hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/smart-resolve-batch
 * Toplu ürün için akıllı kategori çözümleme.
 *
 * Body: { products: [{ title, category, brand }], marketplace }
 */
exports.smartResolveBatch = async (req, res) => {
    try {
        const userId = toObjectId(req.user?.userId || req.user?._id);
        const { products, marketplace } = req.body;

        if (!products || !Array.isArray(products) || !marketplace) {
            return res.status(400).json({
                success: false,
                message: "products dizisi ve marketplace zorunludur"
            });
        }

        const { results, stats } = await categoryResolverService.batchResolve(
            userId, products, marketplace
        );

        res.json({
            success: true,
            stats,
            results: results.map(r => ({
                product: { title: r.product?.title || r.product?.name, category: r.product?.category },
                resolved: r.resolved,
                confidence: r.confidence,
                source: r.source,
                step: r.step,
                isFallback: r.isFallback || false,
                autoApplied: r.autoApplied || false,
                marketplaceCategory: r.marketplaceCategory,
                internalCategory: r.internalCategory ? { name: r.internalCategory.name, icon: r.internalCategory.icon } : null,
                breakdown: r.breakdown || null,
                alternatives: r.alternatives || [],
                suggestions: r.suggestions || []
            }))
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] smartResolveBatch hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/resolver-stats
 * Resolver pipeline istatistikleri.
 */
exports.getResolverStats = async (req, res) => {
    try {
        const userId = toObjectId(req.user?.userId || req.user?._id);

        // Toplam mapping sayıları
        const totalMappings = await InternalCategoryMapping.countDocuments({ isActive: true });
        const totalCategories = await InternalCategory.countDocuments({ isActive: true });
        const totalMemories = await UserCategoryMemory.countDocuments(userId ? { userId } : {});

        // Unmapped istatistikleri
        const unmappedFilter = userId ? { userId, isResolved: false } : { isResolved: false };
        const resolvedFilter = userId ? { userId, isResolved: true } : { isResolved: true };
        const totalUnmapped = await UnmappedCategory.countDocuments(unmappedFilter);
        const totalResolved = await UnmappedCategory.countDocuments(resolvedFilter);

        // Marketplace bazlı kapsama
        const marketplaceCoverage = {};
        for (const mp of ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"]) {
            const mapped = await InternalCategoryMapping.countDocuments({ marketplace: mp, isActive: true });
            marketplaceCoverage[mp] = {
                mapped,
                total: totalCategories,
                percentage: totalCategories > 0 ? Math.round((mapped / totalCategories) * 100) : 0
            };
        }

        // Source dağılımı
        const sourceDist = await InternalCategoryMapping.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: "$matchSource", count: { $sum: 1 } } }
        ]);

        // Son 7 gün çözülen
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentResolved = await UnmappedCategory.countDocuments({
            ...(userId ? { userId } : {}),
            isResolved: true,
            resolvedAt: { $gte: weekAgo }
        });

        // Acil çözülmesi gerekenler (en yüksek hitCount)
        const urgentUnmapped = await UnmappedCategory.find(unmappedFilter)
            .sort({ hitCount: -1 })
            .limit(10)
            .lean();

        // Embedding cache durumu
        const { getCacheStats } = require("../services/categoryEmbeddingService");
        const embeddingCache = getCacheStats();

        res.json({
            success: true,
            stats: {
                pipeline: {
                    totalCategories,
                    totalMappings,
                    totalMemories,
                    totalUnmapped,
                    totalResolved,
                    recentResolved
                },
                marketplaceCoverage,
                sourceDistribution: sourceDist.reduce((acc, s) => {
                    acc[s._id || "unknown"] = s.count;
                    return acc;
                }, {}),
                urgentUnmapped: urgentUnmapped.map(u => ({
                    _id: u._id,
                    categoryName: u.categoryName,
                    marketplace: u.targetMarketplace,
                    hitCount: u.hitCount,
                    sampleProducts: (u.sampleProducts || []).slice(0, 3),
                    suggestedCategories: (u.suggestedCategories || []).slice(0, 3),
                    lastSeenAt: u.lastSeenAt
                })),
                embeddingCache,
                confidence: categoryResolverService.CONFIDENCE
            }
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getResolverStats hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PAZAR YERİ KATEGORİ LİSTELEME & EXPORT (Excel / PDF)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tüm marketplace'lerden (veya belirli birinden) kategorileri flat liste olarak çeker.
 * Her kategori: { id, name, path, parentId?, hasChildren, marketplace }
 *
 * Hiyerarşik ağacı düzleştirip alt-kategori ID'leriyle birlikte döndürür.
 *
 * @param {ObjectId} userId
 * @param {string|null} marketplaceName — null ise tüm platformlar
 * @param {boolean} leafOnly — true ise sadece yaprak (ürün yüklenebilir) kategoriler
 * @returns {Promise<Array>}
 */
async function fetchAllMarketplaceCategories(userId, marketplaceName = null, leafOnly = false) {
    const platforms = marketplaceName
        ? [marketplaceName]
        : ["Trendyol", "N11", "ÇiçekSepeti", "Hepsiburada", "Amazon"];

    let allCategories = [];

    for (const mp of platforms) {
        try {
            const cats = await fetchPlatformCategories(userId, mp);
            if (cats && cats.length > 0) {
                const tagged = cats.map((c, idx) => ({
                    ...c,
                    marketplace: mp,
                    _order: idx
                }));
                allCategories = allCategories.concat(leafOnly ? tagged.filter(c => !c.hasChildren) : tagged);
            }
        } catch (err) {
            logger.warn(`[MARKETPLACE CATS] ${mp} kategori çekme hatası: ${err.message}`);
        }
    }

    return allCategories;
}

/**
 * GET /api/category-smart/marketplace-categories
 * Pazar yeri kategorilerini listele (flat, ID + path ile)
 *
 * Query:
 *   marketplace — "Trendyol" | "N11" | "Hepsiburada" | "ÇiçekSepeti" | "all" (varsayılan: all)
 *   search      — Arama filtresi (isim veya path içinde)
 *   leafOnly    — "true" ise sadece yaprak kategoriler (varsayılan: false)
 *   page        — Sayfa numarası (varsayılan: 1)
 *   limit       — Sayfa başına kayıt (varsayılan: 100, max: 5000)
 */
exports.getMarketplaceCategories = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { marketplace = "all", search, leafOnly, page = 1, limit = 100 } = req.query;
        const isLeafOnly = leafOnly === "true";
        const mp = marketplace === "all" ? null : marketplace;

        let categories = await fetchAllMarketplaceCategories(userId, mp, isLeafOnly);

        // Arama filtresi
        if (search) {
            const q = search.toLowerCase();
            categories = categories.filter(c =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.path || "").toLowerCase().includes(q) ||
                String(c.id || "").includes(q)
            );
        }

        // Sayfalama
        const pageNum = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(5000, Math.max(1, parseInt(limit) || 100));
        const total = categories.length;
        const totalPages = Math.ceil(total / pageSize);
        const start = (pageNum - 1) * pageSize;
        const paged = categories.slice(start, start + pageSize);

        // Marketplace bazlı özet + derinlik dağılımı
        const summary = {};
        const depthDistribution = {};
        let maxDepth = 0;
        const deepestCategories = [];

        categories.forEach(c => {
            // Platform özeti
            if (!summary[c.marketplace]) {
                summary[c.marketplace] = { total: 0, leaf: 0, parent: 0, maxDepth: 0, avgDepth: 0, depths: [] };
            }
            summary[c.marketplace].total++;
            if (c.isLeaf) summary[c.marketplace].leaf++;
            else summary[c.marketplace].parent++;
            summary[c.marketplace].depths.push(c.depth);
            if (c.depth > summary[c.marketplace].maxDepth) summary[c.marketplace].maxDepth = c.depth;

            // Genel derinlik dağılımı
            if (!depthDistribution[c.depth]) depthDistribution[c.depth] = 0;
            depthDistribution[c.depth]++;

            // En derin kategoriler
            if (c.depth > maxDepth) {
                maxDepth = c.depth;
                deepestCategories.length = 0;
                deepestCategories.push({ marketplace: c.marketplace, name: c.name, path: c.path, depth: c.depth });
            } else if (c.depth === maxDepth && deepestCategories.length < 10) {
                deepestCategories.push({ marketplace: c.marketplace, name: c.name, path: c.path, depth: c.depth });
            }
        });

        // Ortalama derinlik hesapla
        Object.keys(summary).forEach(mp => {
            const depths = summary[mp].depths;
            summary[mp].avgDepth = depths.length > 0
                ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
                : 0;
            delete summary[mp].depths; // Gereksiz veriyi temizle
        });

        res.json({
            success: true,
            total,
            totalPages,
            page: pageNum,
            limit: pageSize,
            summary,
            depthDistribution,
            maxDepth,
            deepestCategories,
            categories: paged.map(c => ({
                id:           c.id,
                name:         c.name,
                path:         c.path,
                pathSegments: c.pathSegments,
                hasChildren:  c.hasChildren,
                childCount:   c.childCount,
                parentId:     c.parentId,
                parentName:   c.parentName,
                depth:        c.depth,
                isLeaf:       c.isLeaf,
                marketplace:  c.marketplace
            }))
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getMarketplaceCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/marketplace-categories/export/excel
 * Pazar yeri kategorilerini Excel (.xlsx) olarak indir
 *
 * Query: marketplace, search, leafOnly (aynı parametreler)
 */
exports.exportMarketplaceCategoriesExcel = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { marketplace = "all", search, leafOnly } = req.query;
        const isLeafOnly = leafOnly === "true";
        const mp = marketplace === "all" ? null : marketplace;

        let categories = await fetchAllMarketplaceCategories(userId, mp, isLeafOnly);

        if (search) {
            const q = search.toLowerCase();
            categories = categories.filter(c =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.path || "").toLowerCase().includes(q) ||
                String(c.id || "").includes(q)
            );
        }

        const xlsx = require("xlsx");
        const wb = xlsx.utils.book_new();

        // Marketplace'lere göre grupla
        const grouped = {};
        for (const c of categories) {
            if (!grouped[c.marketplace]) grouped[c.marketplace] = [];
            grouped[c.marketplace].push(c);
        }

        const mpNames = Object.keys(grouped);
        if (mpNames.length === 0) {
            // Boş Excel
            const ws = xlsx.utils.aoa_to_sheet([["Kategori bulunamadı"]]);
            xlsx.utils.book_append_sheet(wb, ws, "Boş");
        } else {
            for (const mpName of mpNames) {
                const cats = grouped[mpName];
                const headers = [
                    "Kategori ID", "Kategori Adı", "Kategori Yolu", "Derinlik",
                    "Üst Kategori ID", "Üst Kategori Adı", "Alt Kategori Sayısı",
                    "Tür", "Pazar Yeri"
                ];

                const rows = cats.map(c => [
                    c.id || "",
                    c.name || "",
                    c.path || "",
                    c.depth != null ? c.depth : 0,
                    c.parentId || "—",
                    c.parentName || "— (Kök)",
                    c.childCount || 0,
                    c.isLeaf ? "Yaprak (Ürün Yüklenebilir)" : `Üst Kategori (${c.childCount || 0} alt)`,
                    c.marketplace || ""
                ]);

                const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);

                // Sütun genişlikleri
                ws["!cols"] = [
                    { wch: 18 },  // ID
                    { wch: 35 },  // Ad
                    { wch: 65 },  // Yol
                    { wch: 10 },  // Derinlik
                    { wch: 18 },  // Üst ID
                    { wch: 30 },  // Üst Ad
                    { wch: 16 },  // Alt Sayı
                    { wch: 28 },  // Tür
                    { wch: 15 }   // Pazar yeri
                ];

                // Sheet adı max 31 karakter
                const sheetName = mpName.substring(0, 31);
                xlsx.utils.book_append_sheet(wb, ws, sheetName);
            }

            // Özet sayfası
            const summaryHeaders = [
                "Pazar Yeri", "Toplam Kategori", "Yaprak Kategori",
                "Üst Kategori", "Maks Derinlik", "Ort. Derinlik"
            ];
            const summaryRows = mpNames.map(mpName => {
                const cats = grouped[mpName];
                const leafCount = cats.filter(c => c.isLeaf).length;
                const parentCount = cats.length - leafCount;
                const depths = cats.map(c => c.depth || 0);
                const maxD = depths.length > 0 ? Math.max(...depths) : 0;
                const avgD = depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0;
                return [mpName, cats.length, leafCount, parentCount, maxD, avgD];
            });
            const wsSum = xlsx.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
            wsSum["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
            xlsx.utils.book_append_sheet(wb, wsSum, "Özet");
        }

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        const dateStr = new Date().toISOString().slice(0, 10);
        const mpLabel = mp || "tum_platformlar";
        const filename = `pazaryeri_kategorileri_${mpLabel}_${dateStr}.xlsx`;

        res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);

    } catch (err) {
        logger.error("[CATEGORY SMART] exportMarketplaceCategoriesExcel hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/marketplace-categories/export/pdf
 * Pazar yeri kategorilerini PDF olarak indir
 *
 * Query: marketplace, search, leafOnly (aynı parametreler)
 */
exports.exportMarketplaceCategoriesPDF = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { marketplace = "all", search, leafOnly } = req.query;
        const isLeafOnly = leafOnly === "true";
        const mp = marketplace === "all" ? null : marketplace;

        let categories = await fetchAllMarketplaceCategories(userId, mp, isLeafOnly);

        if (search) {
            const q = search.toLowerCase();
            categories = categories.filter(c =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.path || "").toLowerCase().includes(q) ||
                String(c.id || "").includes(q)
            );
        }

        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margins: { top: 40, bottom: 40, left: 30, right: 30 },
            bufferPages: true
        });

        // Response headers
        const dateStr = new Date().toISOString().slice(0, 10);
        const mpLabel = mp || "tum_platformlar";
        const filename = `pazaryeri_kategorileri_${mpLabel}_${dateStr}.pdf`;

        res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);

        // Marketplace'lere göre grupla
        const grouped = {};
        for (const c of categories) {
            if (!grouped[c.marketplace]) grouped[c.marketplace] = [];
            grouped[c.marketplace].push(c);
        }

        const mpNames = Object.keys(grouped);

        // ── Başlık Sayfası ──
        doc.fontSize(22).font("Helvetica-Bold")
            .text("LysiaETIC - Pazar Yeri Kategorileri", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica")
            .text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, { align: "center" });
        doc.text(`Platform: ${mp || "Tum Platformlar"}  |  Filtre: ${search || "Yok"}  |  Sadece Yaprak: ${isLeafOnly ? "Evet" : "Hayir"}`, { align: "center" });
        doc.moveDown(0.5);

        // Özet tablo
        doc.fontSize(13).font("Helvetica-Bold").text("Ozet", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica");
        for (const mpName of mpNames) {
            const cats = grouped[mpName];
            const leafCount = cats.filter(c => c.isLeaf).length;
            const parentCount = cats.length - leafCount;
            const depths = cats.map(c => c.depth || 0);
            const maxD = depths.length > 0 ? Math.max(...depths) : 0;
            const avgD = depths.length > 0 ? (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1) : 0;
            doc.text(`  ${mpName}: ${cats.length} kategori (${leafCount} yaprak, ${parentCount} ust, maks derinlik: ${maxD}, ort: ${avgD})`);
        }
        doc.text(`  Toplam: ${categories.length} kategori`);
        doc.moveDown(1);

        // ── Her marketplace için tablo ──
        const COL = { id: 60, name: 160, path: 250, depth: 40, parent: 110, child: 40, leaf: 55, mp: 55 };
        const TABLE_LEFT = 30;
        const TABLE_WIDTH = COL.id + COL.name + COL.path + COL.depth + COL.parent + COL.child + COL.leaf + COL.mp;
        const ROW_HEIGHT = 16;
        const PAGE_BOTTOM = doc.page.height - 50;

        for (const mpName of mpNames) {
            const cats = grouped[mpName];

            // Yeni sayfa
            if (doc.y > PAGE_BOTTOM - 100) doc.addPage();

            doc.fontSize(13).font("Helvetica-Bold")
                .text(`${mpName} Kategorileri (${cats.length})`, TABLE_LEFT, doc.y, { underline: true });
            doc.moveDown(0.5);

            // Tablo başlığı
            const drawTableHeader = () => {
                const y = doc.y;
                doc.rect(TABLE_LEFT, y, TABLE_WIDTH, ROW_HEIGHT + 2)
                    .fill("#2d3748");
                doc.fillColor("#ffffff").fontSize(7).font("Helvetica-Bold");
                let x = TABLE_LEFT + 3;
                doc.text("ID",             x, y + 3, { width: COL.id - 6 });     x += COL.id;
                doc.text("Kategori Adi",   x, y + 3, { width: COL.name - 6 });   x += COL.name;
                doc.text("Kategori Yolu",  x, y + 3, { width: COL.path - 6 });   x += COL.path;
                doc.text("Drn",            x, y + 3, { width: COL.depth - 6 });   x += COL.depth;
                doc.text("Ust Kategori",   x, y + 3, { width: COL.parent - 6 }); x += COL.parent;
                doc.text("Alt",            x, y + 3, { width: COL.child - 6 });   x += COL.child;
                doc.text("Tur",            x, y + 3, { width: COL.leaf - 6 });    x += COL.leaf;
                doc.text("Platform",       x, y + 3, { width: COL.mp - 6 });
                doc.fillColor("#000000");
                doc.y = y + ROW_HEIGHT + 4;
            };

            drawTableHeader();

            // Satırlar (max 2000 per marketplace for PDF)
            const maxRows = Math.min(cats.length, 2000);
            for (let i = 0; i < maxRows; i++) {
                const c = cats[i];

                if (doc.y > PAGE_BOTTOM - ROW_HEIGHT) {
                    doc.addPage();
                    drawTableHeader();
                }

                const y = doc.y;
                const bgColor = i % 2 === 0 ? "#f7fafc" : "#edf2f7";
                doc.rect(TABLE_LEFT, y, TABLE_WIDTH, ROW_HEIGHT)
                    .fill(bgColor);

                doc.fillColor("#1a202c").fontSize(6).font("Helvetica");
                let x = TABLE_LEFT + 3;
                doc.text(String(c.id || ""),   x, y + 3, { width: COL.id - 6, lineBreak: false });   x += COL.id;
                doc.text(String(c.name || ""), x, y + 3, { width: COL.name - 6, lineBreak: false }); x += COL.name;

                // Path çok uzun olabilir — kısalt
                const pathStr = (c.path || "").length > 55 ? (c.path || "").substring(0, 52) + "..." : (c.path || "");
                doc.text(pathStr,              x, y + 3, { width: COL.path - 6, lineBreak: false }); x += COL.path;
                doc.text(String(c.depth != null ? c.depth : 0), x, y + 3, { width: COL.depth - 6, lineBreak: false }); x += COL.depth;

                const parentStr = c.parentName ? (c.parentName.length > 20 ? c.parentName.substring(0, 18) + ".." : c.parentName) : "Kok";
                doc.text(parentStr,            x, y + 3, { width: COL.parent - 6, lineBreak: false }); x += COL.parent;
                doc.text(String(c.childCount || 0), x, y + 3, { width: COL.child - 6, lineBreak: false }); x += COL.child;
                doc.text(c.isLeaf ? "Yaprak" : "Ust", x, y + 3, { width: COL.leaf - 6, lineBreak: false }); x += COL.leaf;
                doc.text(c.marketplace || "",  x, y + 3, { width: COL.mp - 6, lineBreak: false });

                doc.fillColor("#000000");
                doc.y = y + ROW_HEIGHT;
            }

            if (cats.length > maxRows) {
                doc.moveDown(0.3);
                doc.fontSize(8).font("Helvetica-Oblique")
                    .text(`... ve ${cats.length - maxRows} kategori daha (Excel export ile tamamini gorebilirsiniz)`, TABLE_LEFT);
            }

            doc.moveDown(1);
        }

        if (mpNames.length === 0) {
            doc.fontSize(12).font("Helvetica")
                .text("Hicbir pazar yerinden kategori cekilemedi. Lutfen pazar yeri entegrasyonlarinizi kontrol edin.", { align: "center" });
        }

        // Sayfa numaraları
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font("Helvetica").fillColor("#718096")
                .text(`Sayfa ${i + 1} / ${pageCount}`, TABLE_LEFT, doc.page.height - 30, { align: "center", width: doc.page.width - 60 });
        }

        doc.end();

    } catch (err) {
        logger.error("[CATEGORY SMART] exportMarketplaceCategoriesPDF hatası:", err.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🗺️ BİRLEŞİK KATEGORİ HARİTASI — Unified Category Map
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/category-smart/unified/import
 * 3 platformun Excel'lerini upload edip birleşik haritayı oluştur
 *
 * Multipart form-data:
 *   - trendyol: Excel file
 *   - n11: Excel file
 *   - ciceksepeti: Excel file
 *   - hepsiburada: Excel file
 *   - amazon: Excel file
 *   - clearExisting: boolean (optional)
 */
exports.importUnifiedCategories = [
    unifiedUpload,
    async (req, res) => {
        try {
            const { clearExisting = "false" } = req.body;
            const files = req.files || {};

            const tBuffer = files.trendyol?.[0]?.buffer || null;
            const nBuffer = files.n11?.[0]?.buffer || null;
            const cBuffer = files.ciceksepeti?.[0]?.buffer || null;
            const hBuffer = files.hepsiburada?.[0]?.buffer || null;
            const aBuffer = files.amazon?.[0]?.buffer || null;

            if (!tBuffer && !nBuffer && !cBuffer && !hBuffer && !aBuffer) {
                return res.status(400).json({
                    success: false,
                    message: "En az bir platform Excel dosyası yüklemelisiniz"
                });
            }

            logger.info(`[UNIFIED CAT] Import başlıyor — T:${!!tBuffer} N:${!!nBuffer} C:${!!cBuffer} H:${!!hBuffer} A:${!!aBuffer} clear:${clearExisting}`);

            const result = await unifiedImportService.importFromBuffers(
                tBuffer,
                nBuffer,
                cBuffer,
                hBuffer,
                aBuffer,
                { clearExisting: clearExisting === "true" }
            );

            logger.info(`[UNIFIED CAT] Import tamamlandı — ${result.dbResult.inserted} yeni, ${result.dbResult.updated} güncellendi`);

            res.json({
                success: true,
                message: "Kategori haritası başarıyla oluşturuldu",
                result
            });
        } catch (err) {
            logger.error("[UNIFIED CAT] Import hatası:", err.message);
            res.status(500).json({ success: false, message: err.message });
        }
    }
];

/**
 * GET /api/category-smart/unified
 * Birleşik kategori haritasını listele
 *
 * Query params:
 *   - search: string
 *   - matchType: exact | 2of3 | single | manual
 *   - platformCount: 1 | 2 | 3
 *   - rootCategory: string
 *   - leafOnly: boolean
 *   - page: number
 *   - limit: number
 */
exports.getUnifiedCategories = async (req, res) => {
    try {
        const {
            search = "",
            matchType = "",
            platformCount = "",
            rootCategory = "",
            leafOnly = "",
            page = 1,
            limit = 100
        } = req.query;

        const filter = {};

        // Filtreler
        if (matchType) filter.matchType = matchType;
        if (platformCount) filter.platformCount = parseInt(platformCount);
        if (rootCategory) filter.rootCategory = rootCategory;
        if (leafOnly === "true") filter.isLeaf = true;

        // Arama
        if (search) {
            const searchRegex = new RegExp(search.trim(), "i");
            filter.$or = [
                { canonicalName: searchRegex },
                { canonicalPath: searchRegex },
                { normalizedKey: searchRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await UnifiedCategoryMap.countDocuments(filter);

        const categories = await UnifiedCategoryMap.find(filter)
            .sort({ platformCount: -1, canonicalName: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            categories,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        logger.error("[UNIFIED CAT] getUnifiedCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/unified/stats
 * Birleşik kategori haritası istatistikleri
 */
exports.getUnifiedStats = async (req, res) => {
    try {
        const stats = await unifiedImportService.getStats();
        res.json({ success: true, stats });
    } catch (err) {
        logger.error("[UNIFIED CAT] getUnifiedStats hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/unified/merge
 * İki kaydı manuel olarak birleştir
 *
 * Body: { targetId, sourceId }
 */
exports.mergeUnifiedCategories = async (req, res) => {
    try {
        const { targetId, sourceId } = req.body;

        if (!targetId || !sourceId) {
            return res.status(400).json({
                success: false,
                message: "targetId ve sourceId gerekli"
            });
        }

        const result = await unifiedImportService.manualMerge(targetId, sourceId);

        logger.info(`[UNIFIED CAT] Manuel birleştirme: ${sourceId} → ${targetId}`);

        res.json({
            success: true,
            message: "Kategoriler başarıyla birleştirildi",
            category: result
        });
    } catch (err) {
        logger.error("[UNIFIED CAT] mergeUnifiedCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/category-smart/unified/:id
 * Birleşik kategori kaydını güncelle
 *
 * Body: {
 *   canonicalName,
 *   notes,
 *   trendyol: { categoryId, categoryName, categoryPath, depth, parentId, parentName, isLeaf },
 *   n11: { ... },
 *   ciceksepeti: { ... }
 * }
 */
exports.updateUnifiedCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { canonicalName, notes, trendyol, n11, ciceksepeti, hepsiburada, amazon } = req.body;

        const category = await UnifiedCategoryMap.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Kategori bulunamadı"
            });
        }

        // Basit alanları güncelle
        if (canonicalName !== undefined) category.canonicalName = canonicalName;
        if (notes !== undefined) category.notes = notes;

        // Platform kategorilerini güncelle
        if (trendyol !== undefined) category.trendyol = trendyol;
        if (n11 !== undefined) category.n11 = n11;
        if (ciceksepeti !== undefined) category.ciceksepeti = ciceksepeti;
        if (hepsiburada !== undefined) category.hepsiburada = hepsiburada;
        if (amazon !== undefined) category.amazon = amazon;

        // platformCount ve matchType'ı yeniden hesapla
        let count = 0;
        if (category.trendyol?.categoryId) count++;
        if (category.n11?.categoryId) count++;
        if (category.ciceksepeti?.categoryId) count++;
        if (category.hepsiburada?.categoryId) count++;
        if (category.amazon?.categoryId) count++;
        category.platformCount = count;

        // matchType güncelle (manuel ekleme varsa "manual" yap)
        const hasManualAddition = (trendyol !== undefined || n11 !== undefined || ciceksepeti !== undefined || hepsiburada !== undefined || amazon !== undefined);
        if (hasManualAddition && category.matchType !== "exact") {
            category.matchType = count >= 3 ? "exact" : count === 2 ? "2of3" : count === 1 ? "single" : "manual";
        }

        await category.save();

        logger.info(`[UNIFIED CAT] Kategori güncellendi: ${id} (platformCount: ${count})`);

        res.json({
            success: true,
            message: "Kategori güncellendi",
            category
        });
    } catch (err) {
        logger.error("[UNIFIED CAT] updateUnifiedCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/category-smart/unified/:id
 * Birleşik kategori kaydını sil
 */
exports.deleteUnifiedCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await UnifiedCategoryMap.findByIdAndDelete(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Kategori bulunamadı"
            });
        }

        logger.info(`[UNIFIED CAT] Kategori silindi: ${id} (${category.canonicalName})`);

        res.json({
            success: true,
            message: "Kategori silindi"
        });
    } catch (err) {
        logger.error("[UNIFIED CAT] deleteUnifiedCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/unified/export/excel
 * Birleşik kategori haritasını Excel olarak indir
 */
exports.exportUnifiedCategoriesExcel = async (req, res) => {
    try {
        const { matchType = "", platformCount = "", rootCategory = "" } = req.query;

        const filter = {};
        if (matchType) filter.matchType = matchType;
        if (platformCount) filter.platformCount = parseInt(platformCount);
        if (rootCategory) filter.rootCategory = rootCategory;

        const categories = await UnifiedCategoryMap.find(filter)
            .sort({ platformCount: -1, canonicalName: 1 })
            .lean();

        const XLSX = require("xlsx");
        const wb = XLSX.utils.book_new();

        // Ana sayfa
        const rows = [
            ["Ortak Kategori Adı", "Ortak Yol", "Kök Kategori", "Platform Sayısı", "Eşleşme Türü", "Yaprak", "Derinlik",
             "Trendyol ID", "Trendyol Adı", "Trendyol Yolu",
             "N11 ID", "N11 Adı", "N11 Yolu",
             "ÇiçekSepeti ID", "ÇiçekSepeti Adı", "ÇiçekSepeti Yolu",
             "Hepsiburada ID", "Hepsiburada Adı", "Hepsiburada Yolu",
             "Amazon ID", "Amazon Adı", "Amazon Yolu",
             "Notlar"]
        ];

        for (const cat of categories) {
            rows.push([
                cat.canonicalName || "",
                cat.canonicalPath || "",
                cat.rootCategory || "",
                cat.platformCount || 0,
                cat.matchType || "",
                cat.isLeaf ? "Evet" : "Hayır",
                cat.depth || 0,
                cat.trendyol?.categoryId || "",
                cat.trendyol?.categoryName || "",
                cat.trendyol?.categoryPath || "",
                cat.n11?.categoryId || "",
                cat.n11?.categoryName || "",
                cat.n11?.categoryPath || "",
                cat.ciceksepeti?.categoryId || "",
                cat.ciceksepeti?.categoryName || "",
                cat.ciceksepeti?.categoryPath || "",
                cat.hepsiburada?.categoryId || "",
                cat.hepsiburada?.categoryName || "",
                cat.hepsiburada?.categoryPath || "",
                cat.amazon?.categoryId || "",
                cat.amazon?.categoryName || "",
                cat.amazon?.categoryPath || "",
                cat.notes || ""
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [
            { wch: 30 }, { wch: 50 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
            { wch: 12 }, { wch: 30 }, { wch: 50 },
            { wch: 12 }, { wch: 30 }, { wch: 50 },
            { wch: 12 }, { wch: 30 }, { wch: 50 },
            { wch: 12 }, { wch: 30 }, { wch: 50 },
            { wch: 12 }, { wch: 30 }, { wch: 50 },
            { wch: 30 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Birleşik Kategoriler");

        // İstatistik sayfası
        const stats = await unifiedImportService.getStats();
        const statsRows = [
            ["Metrik", "Değer"],
            ["Toplam Kategori", stats.total],
            ["3 Platformda Ortak", stats.exact3],
            ["2 Platformda Ortak", stats.match2],
            ["Tek Platform", stats.single],
            ["Manuel Eşleşme", stats.manual],
            ["Yaprak Kategori", stats.leafCount],
            ["", ""],
            ["Platform Dağılımı", ""],
            ["Trendyol", stats.platforms.trendyol],
            ["N11", stats.platforms.n11],
            ["ÇiçekSepeti", stats.platforms.ciceksepeti],
            ["Hepsiburada", stats.platforms.hepsiburada],
            ["Amazon", stats.platforms.amazon]
        ];
        const statsWs = XLSX.utils.aoa_to_sheet(statsRows);
        statsWs["!cols"] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, statsWs, "İstatistikler");

        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="birlesik_kategoriler_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.send(buffer);

        logger.info(`[UNIFIED CAT] Excel export: ${categories.length} kategori`);
    } catch (err) {
        logger.error("[UNIFIED CAT] exportUnifiedCategoriesExcel hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/category-smart/unified/suggest-platform
 * Bir kategori için belirli bir platformda akıllı öneri getir
 *
 * Body: {
 *   categoryName: string,
 *   targetPlatform: "Trendyol" | "N11" | "ÇiçekSepeti" | "Hepsiburada" | "Amazon",
 *   limit?: number
 * }
 */
exports.suggestPlatformCategory = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { categoryName, targetPlatform, limit = 5 } = req.body;

        if (!categoryName || !targetPlatform) {
            return res.status(400).json({
                success: false,
                message: "categoryName ve targetPlatform zorunludur"
            });
        }

        // Platform kategorilerini çek
        const platformCats = await fetchPlatformCategories(userId, targetPlatform);
        if (!platformCats || platformCats.length === 0) {
            return res.json({
                success: true,
                suggestions: [],
                message: `${targetPlatform} kategorileri çekilemedi`
            });
        }

        // Fuzzy match ile öneri getir
        const suggestions = fuzzyService.fuzzyMatchCategories(
            categoryName,
            platformCats,
            { limit, minScore: 0.3 }
        );

        res.json({
            success: true,
            categoryName,
            targetPlatform,
            suggestions
        });
    } catch (err) {
        logger.error("[UNIFIED CAT] suggestPlatformCategory hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/category-smart/unified/incomplete
 * Eksik eşleşmeleri olan kategorileri getir
 *
 * Query:
 *   missingPlatform?: "Trendyol" | "N11" | "ÇiçekSepeti" | "Hepsiburada" | "Amazon"
 *   minPlatformCount?: number (varsayılan: 1, en az kaç platformda olmalı)
 *   maxPlatformCount?: number (varsayılan: 4, en fazla kaç platformda olmalı - 5'ten az)
 *   page?: number
 *   limit?: number
 */
exports.getIncompleteCategories = async (req, res) => {
    try {
        const {
            missingPlatform = "",
            minPlatformCount = "1",
            maxPlatformCount = "4",
            page = 1,
            limit = 50
        } = req.query;

        const filter = {
            platformCount: {
                $gte: parseInt(minPlatformCount),
                $lt: 5  // 5'ten az = eksik var
            }
        };

        // maxPlatformCount filtresi
        const maxCount = parseInt(maxPlatformCount);
        if (maxCount < 5) {
            filter.platformCount.$lte = maxCount;
        }

        // Belirli bir platform eksikse
        if (missingPlatform) {
            const platformField = missingPlatform.toLowerCase();
            filter[`${platformField}.categoryId`] = { $exists: false };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await UnifiedCategoryMap.countDocuments(filter);

        const categories = await UnifiedCategoryMap.find(filter)
            .sort({ platformCount: 1, canonicalName: 1 })  // En az eşleşmesi olanlar önce
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Her kategori için eksik platformları belirle
        const enriched = categories.map(cat => {
            const missing = [];
            const existing = [];

            ["trendyol", "n11", "ciceksepeti", "hepsiburada", "amazon"].forEach(p => {
                if (cat[p]?.categoryId) {
                    existing.push(p);
                } else {
                    missing.push(p);
                }
            });

            return {
                ...cat,
                missingPlatforms: missing,
                existingPlatforms: existing,
                completionRate: Math.round((existing.length / 5) * 100)
            };
        });

        res.json({
            success: true,
            categories: enriched,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            },
            summary: {
                totalIncomplete: total,
                avgCompletionRate: enriched.length > 0
                    ? Math.round(enriched.reduce((sum, c) => sum + c.completionRate, 0) / enriched.length)
                    : 0
            }
        });
    } catch (err) {
        logger.error("[UNIFIED CAT] getIncompleteCategories hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌳 PAZAR YERİ KATEGORİ AĞACI (Tree View)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/category-smart/marketplace-categories/tree
 * Pazar yeri kategorilerini AĞAÇ YAPISI (nested tree) olarak döndürür.
 *
 * Örnek çıktı:
 *   Takı & Mücevher
 *   ├── Bileklik
 *   │   ├── Altın Bileklik
 *   │   └── Gümüş Bileklik
 *   └── Kolye
 *       ├── Altın Kolye
 *       └── Gümüş Kolye
 *
 * Query:
 *   marketplace — "Trendyol" | "N11" | "Hepsiburada" | "ÇiçekSepeti" | "Amazon" | "all" (varsayılan: all)
 *   search      — Arama filtresi (isim veya path içinde, eşleşen dalın tüm üst/alt düğümleri dahil edilir)
 */
exports.getMarketplaceCategoriesTree = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: "Yetkilendirme hatası" });

        const { marketplace = "all", search } = req.query;
        const mp = marketplace === "all" ? null : marketplace;

        // Flat listeyi çek (mevcut fonksiyon)
        const flatCategories = await fetchAllMarketplaceCategories(userId, mp, false);

        if (!flatCategories || flatCategories.length === 0) {
            return res.json({
                success: true,
                trees: [],
                summary: {},
                totalCategories: 0,
                totalRoots: 0
            });
        }

        // Platform bazlı grupla
        const platformGroups = {};
        for (const cat of flatCategories) {
            const mpName = cat.marketplace;
            if (!platformGroups[mpName]) platformGroups[mpName] = [];
            platformGroups[mpName].push(cat);
        }

        const result = {};
        const summary = {};

        for (const [mpName, cats] of Object.entries(platformGroups)) {
            // Flat → Tree dönüşümü
            const tree = buildCategoryTree(cats, search);
            result[mpName] = tree.roots;
            summary[mpName] = {
                totalCategories: cats.length,
                rootCount: tree.roots.length,
                leafCount: cats.filter(c => c.isLeaf).length,
                maxDepth: tree.maxDepth,
                matchedCount: tree.matchedCount // arama varsa eşleşen sayısı
            };
        }

        res.json({
            success: true,
            trees: result,
            summary,
            totalCategories: flatCategories.length,
            totalRoots: Object.values(result).reduce((sum, roots) => sum + roots.length, 0)
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getMarketplaceCategoriesTree hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Flat kategori listesini nested ağaç yapısına dönüştürür.
 * Arama varsa eşleşen dalları (ve üst/alt düğümlerini) filtreler.
 *
 * @param {Array} flatCats - [{id, name, path, parentId, parentName, depth, isLeaf, hasChildren, childCount, pathSegments}]
 * @param {string} search - Arama terimi (opsiyonel)
 * @returns {{ roots: Array, maxDepth: number, matchedCount: number }}
 */
function buildCategoryTree(flatCats, search = "") {
    // 1) ID → node map oluştur
    const nodeMap = new Map();
    let maxDepth = 0;

    for (const cat of flatCats) {
        const id = String(cat.id);
        nodeMap.set(id, {
            id: cat.id,
            name: cat.name || "",
            path: cat.path || "",
            pathSegments: cat.pathSegments || [],
            depth: cat.depth || 0,
            isLeaf: !!cat.isLeaf,
            hasChildren: !!cat.hasChildren,
            childCount: cat.childCount || 0,
            parentId: cat.parentId != null ? String(cat.parentId) : null,
            parentName: cat.parentName || null,
            children: [],
            _matched: false // arama eşleşmesi
        });
        if ((cat.depth || 0) > maxDepth) maxDepth = cat.depth;
    }

    // 2) Parent-child ilişkilerini kur
    const roots = [];
    for (const [id, node] of nodeMap) {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId).children.push(node);
        } else {
            roots.push(node);
        }
    }

    // 3) Children'ları isme göre sırala (Türkçe)
    const sortChildren = (nodes) => {
        nodes.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
        for (const n of nodes) {
            if (n.children.length > 0) sortChildren(n.children);
        }
    };
    sortChildren(roots);

    // 4) Arama filtresi (varsa)
    let matchedCount = 0;
    if (search && search.trim()) {
        const q = search.trim().toLowerCase();

        // Eşleşen node'ları işaretle
        const markMatched = (node) => {
            const nameMatch = (node.name || "").toLowerCase().includes(q);
            const pathMatch = (node.path || "").toLowerCase().includes(q);
            const idMatch = String(node.id || "").toLowerCase().includes(q);

            if (nameMatch || pathMatch || idMatch) {
                node._matched = true;
                matchedCount++;
            }

            for (const child of node.children) {
                markMatched(child);
            }
        };
        roots.forEach(r => markMatched(r));

        // Eşleşen node'un tüm üst zincirini de dahil et
        const hasMatchInSubtree = (node) => {
            if (node._matched) return true;
            for (const child of node.children) {
                if (hasMatchInSubtree(child)) return true;
            }
            return false;
        };

        // Ağacı filtrele — sadece eşleşen dalları tut
        const filterTree = (nodes) => {
            return nodes.filter(node => {
                node.children = filterTree(node.children);
                return node._matched || node.children.length > 0;
            });
        };

        const filteredRoots = filterTree(roots);
        return { roots: filteredRoots, maxDepth, matchedCount };
    }

    return { roots, maxDepth, matchedCount: 0 };
}
