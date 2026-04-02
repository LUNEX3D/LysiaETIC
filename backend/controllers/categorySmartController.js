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
 *   DELETE /api/category-smart/mappings/:id            — Mapping sil
 *
 * ── Otomatik Eşleştirme & Öğrenme ──
 *   POST   /api/category-smart/auto-match             — Tek ürün için otomatik eşleştirme
 *   POST   /api/category-smart/bulk-match             — Toplu otomatik eşleştirme
 *   POST   /api/category-smart/learn                  — Kullanıcı seçimini kaydet (öğren)
 *
 * ── Hafıza & İstatistik ──
 *   GET    /api/category-smart/memory                 — Kullanıcı hafızası listele
 *   GET    /api/category-smart/stats                  — İstatistikler
 *   DELETE /api/category-smart/memory/:id             — Hafıza kaydı sil
 */

const InternalCategory        = require("../models/InternalCategory");
const InternalCategoryMapping = require("../models/InternalCategoryMapping");
const UserCategoryMemory      = require("../models/UserCategoryMemory");
const autoMatchService        = require("../services/categoryAutoMatchService");
const logger                  = require("../config/logger");

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
            memoryStats
        ] = await Promise.all([
            InternalCategory.countDocuments({ isActive: true }),
            InternalCategoryMapping.countDocuments(),
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

        res.json({
            success: true,
            stats: {
                totalInternalCategories,
                totalMappings,
                mappingCoverage: coverage,
                ...memoryStats
            }
        });
    } catch (err) {
        logger.error("[CATEGORY SMART] getStats hatası:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
