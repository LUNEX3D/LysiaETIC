/**
 * KATEGORİ OTOMATİK EŞLEŞTİRME SERVİSİ
 *
 * Ürün geldiğinde otomatik kategori atama pipeline'ı:
 *
 *   Adım 1: UserCategoryMemory — Kullanıcının geçmiş kararları
 *   Adım 2: InternalCategory keywords — Sistem anahtar kelimeleri
 *   Adım 3: Bulunamadı → "unknown" + kullanıcıya sor
 *
 * Güven Skoru:
 *   >= 0.8  → "strong"  → otomatik ata
 *   >= 0.5  → "medium"  → otomatik ata ama kullanıcıya bildir
 *   <  0.5  → "weak"    → kullanıcıya sor
 *
 * Öğrenme:
 *   Kullanıcı seçim yaptığında → UserCategoryMemory'ye kaydet
 *   Bir sonraki seferde → otomatik eşleşir
 */

const InternalCategory   = require("../models/InternalCategory");
const UserCategoryMemory = require("../models/UserCategoryMemory");
const logger             = require("../config/logger");

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Metin normalleştirme
// ─────────────────────────────────────────────────────────────────────────────
const normalize = (text) => {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANA EŞLEŞTİRME FONKSİYONU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ürün bilgisine göre dahili kategori eşleştirmesi yap.
 *
 * @param {string} userId
 * @param {Object} product - { title, description, category, brand }
 * @returns {Promise<{
 *   matched: boolean,
 *   internalCategory: Object|null,
 *   confidence: number,       // 0.0 - 1.0
 *   confidenceLevel: string,  // "strong" | "medium" | "weak" | "none"
 *   source: string,           // "user_memory" | "keyword_rule" | "none"
 *   matchedPattern: string|null
 * }>}
 */
const autoMatch = async (userId, product) => {
    const title       = normalize(product.title || product.name || "");
    const description = normalize(product.description || "");
    const category    = normalize(product.category || "");
    const brand       = normalize(product.brand || "");
    const searchText  = `${title} ${description} ${category} ${brand}`;

    if (!searchText.trim()) {
        return { matched: false, internalCategory: null, confidence: 0, confidenceLevel: "none", source: "none", matchedPattern: null };
    }

    // ── Adım 1: UserCategoryMemory — Kullanıcının geçmiş kararları ──────────
    try {
        const memories = await UserCategoryMemory.find({ userId })
            .sort({ hitCount: -1 })
            .populate("internalCategoryId")
            .lean();

        for (const mem of memories) {
            if (!mem.pattern || !mem.internalCategoryId) continue;

            const pattern = mem.pattern.toLowerCase().trim();
            if (!pattern) continue;

            // Pattern'i title, category veya description'da ara
            if (title.includes(pattern) || category.includes(pattern) || description.includes(pattern)) {
                // Güven skoru: hitCount'a göre artar
                const baseConfidence = 0.85;
                const hitBonus = Math.min(mem.hitCount * 0.01, 0.14); // max +0.14
                const confidence = Math.min(baseConfidence + hitBonus, 0.99);

                // hitCount artır + lastUsedAt güncelle
                await UserCategoryMemory.updateOne(
                    { _id: mem._id },
                    { $inc: { hitCount: 1 }, $set: { lastUsedAt: new Date() } }
                );

                logger.info(
                    `[AUTO MATCH] ✅ UserMemory eşleşti: "${pattern}" → ` +
                    `${mem.internalCategoryId.name} (güven: ${(confidence * 100).toFixed(0)}%, hit: ${mem.hitCount + 1})`
                );

                return {
                    matched: true,
                    internalCategory: mem.internalCategoryId,
                    confidence,
                    confidenceLevel: confidence >= 0.8 ? "strong" : "medium",
                    source: "user_memory",
                    matchedPattern: pattern
                };
            }
        }
    } catch (err) {
        logger.warn(`[AUTO MATCH] UserMemory arama hatası: ${err.message}`);
    }

    // ── Adım 2: InternalCategory keywords — Sistem anahtar kelimeleri ───────
    try {
        const categories = await InternalCategory.find({ isActive: true }).lean();

        let bestMatch = null;
        let bestScore = 0;
        let bestKeyword = null;

        for (const cat of categories) {
            if (!cat.keywords || cat.keywords.length === 0) continue;

            for (const keyword of cat.keywords) {
                const kw = keyword.toLowerCase().trim();
                if (!kw) continue;

                let score = 0;

                // Title'da tam kelime eşleşmesi (en yüksek skor)
                if (title.includes(kw)) {
                    score = 0.75;
                    // Başlıkta tam kelime olarak geçiyorsa bonus
                    const titleWords = title.split(/\s+/);
                    if (titleWords.includes(kw)) score = 0.80;
                }
                // Category'de eşleşme
                else if (category.includes(kw)) {
                    score = 0.70;
                }
                // Description'da eşleşme (daha düşük skor)
                else if (description.includes(kw)) {
                    score = 0.50;
                }
                // Brand eşleşmesi
                else if (brand.includes(kw)) {
                    score = 0.55;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = cat;
                    bestKeyword = kw;
                }
            }
        }

        if (bestMatch && bestScore >= 0.4) {
            const confidenceLevel = bestScore >= 0.8 ? "strong" : bestScore >= 0.5 ? "medium" : "weak";

            logger.info(
                `[AUTO MATCH] ✅ Keyword eşleşti: "${bestKeyword}" → ` +
                `${bestMatch.name} (güven: ${(bestScore * 100).toFixed(0)}%)`
            );

            return {
                matched: true,
                internalCategory: bestMatch,
                confidence: bestScore,
                confidenceLevel,
                source: "keyword_rule",
                matchedPattern: bestKeyword
            };
        }
    } catch (err) {
        logger.warn(`[AUTO MATCH] Keyword arama hatası: ${err.message}`);
    }

    // ── Adım 3: Bulunamadı ──────────────────────────────────────────────────
    logger.info(`[AUTO MATCH] ❌ Eşleşme bulunamadı: "${title.substring(0, 60)}..."`);

    return {
        matched: false,
        internalCategory: null,
        confidence: 0,
        confidenceLevel: "none",
        source: "none",
        matchedPattern: null
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. TOPLU EŞLEŞTİRME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Birden fazla ürün için toplu otomatik eşleştirme.
 *
 * @param {string} userId
 * @param {Array<Object>} products - [{ title, description, category, brand }, ...]
 * @returns {Promise<Array<Object>>} - Her ürün için eşleştirme sonucu
 */
const bulkAutoMatch = async (userId, products) => {
    const results = [];

    for (const product of products) {
        const result = await autoMatch(userId, product);
        results.push({
            product: {
                title: product.title || product.name || "",
                category: product.category || ""
            },
            ...result
        });
    }

    const matched   = results.filter(r => r.matched).length;
    const unmatched = results.filter(r => !r.matched).length;

    logger.info(
        `[AUTO MATCH] Toplu eşleştirme: ${products.length} ürün → ` +
        `${matched} eşleşti, ${unmatched} eşleşmedi`
    );

    return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. KULLANICI SEÇİMİNİ KAYDET (ÖĞRENME)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kullanıcının kategori seçimini hafızaya kaydet.
 * Bir sonraki seferde aynı pattern otomatik eşleşir.
 *
 * @param {string} userId
 * @param {string} pattern           - Eşleşme pattern'i (örn: "iphone 15 pro")
 * @param {string} internalCategoryId - Seçilen dahili kategori ID
 * @param {string} [source="user_selection"]
 * @returns {Promise<Object>}
 */
const learnFromUser = async (userId, pattern, internalCategoryId, source = "user_selection") => {
    if (!userId || !pattern || !internalCategoryId) {
        throw new Error("userId, pattern ve internalCategoryId zorunludur");
    }

    const normalizedPattern = pattern.toLowerCase().trim();
    if (!normalizedPattern) {
        throw new Error("Pattern boş olamaz");
    }

    // Upsert — aynı pattern varsa güncelle, yoksa oluştur
    const doc = await UserCategoryMemory.findOneAndUpdate(
        { userId, pattern: normalizedPattern },
        {
            $set: {
                internalCategoryId,
                source,
                lastUsedAt: new Date()
            },
            $inc: { hitCount: 1 },
            $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true, new: true }
    );

    logger.info(
        `[LEARN] Kullanıcı seçimi kaydedildi: "${normalizedPattern}" → ` +
        `kategori: ${internalCategoryId} (hit: ${doc.hitCount})`
    );

    return doc;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. KULLANICI HAFIZASI İSTATİSTİKLERİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kullanıcının öğrenme istatistiklerini getir.
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getMemoryStats = async (userId) => {
    const totalMemories = await UserCategoryMemory.countDocuments({ userId });
    const totalHits     = await UserCategoryMemory.aggregate([
        { $match: { userId: require("mongoose").Types.ObjectId.createFromHexString(userId.toString()) } },
        { $group: { _id: null, total: { $sum: "$hitCount" } } }
    ]);

    const topPatterns = await UserCategoryMemory.find({ userId })
        .sort({ hitCount: -1 })
        .limit(10)
        .populate("internalCategoryId", "name icon")
        .lean();

    const recentPatterns = await UserCategoryMemory.find({ userId })
        .sort({ lastUsedAt: -1 })
        .limit(10)
        .populate("internalCategoryId", "name icon")
        .lean();

    return {
        totalMemories,
        totalAutoMatches: totalHits[0]?.total || 0,
        topPatterns: topPatterns.map(p => ({
            pattern: p.pattern,
            category: p.internalCategoryId?.name || "?",
            icon: p.internalCategoryId?.icon || "📁",
            hitCount: p.hitCount,
            source: p.source
        })),
        recentPatterns: recentPatterns.map(p => ({
            pattern: p.pattern,
            category: p.internalCategoryId?.name || "?",
            icon: p.internalCategoryId?.icon || "📁",
            hitCount: p.hitCount,
            lastUsedAt: p.lastUsedAt
        }))
    };
};

module.exports = {
    autoMatch,
    bulkAutoMatch,
    learnFromUser,
    getMemoryStats
};
