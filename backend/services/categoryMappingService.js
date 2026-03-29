/**
 * CATEGORY MAPPING SERVİSİ
 *
 * Sorumluluklar:
 *   1. suggestN11Category()      — Ürün başlığı/kategorisine göre N11 kategori önerisi üret
 *   2. saveUnmappedCategory()    — Eşleştirilemeyen kategoriyi DB'ye kaydet (duplicate yok)
 *   3. getUnmappedCategories()   — Kullanıcının çözülmemiş kategorilerini listele
 *   4. resolveUnmappedCategory() — Kullanıcı mapping yaptıktan sonra çözüldü olarak işaretle
 *   5. skipProduct()             — Ürünü atla ve structured log yaz
 */

const UnmappedCategory = require("../models/UnmappedCategory");
const CategoryMapping  = require("../models/CategoryMapping");
const logger           = require("../config/logger");

// ─────────────────────────────────────────────────────────────────────────────
// 1. ÖNERI SİSTEMİ
//    Ürün başlığı ve kategori adına göre N11 kategori önerisi üretir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kural tabanlı N11 kategori öneri sistemi.
 *
 * Kural sırası (öncelik sırasıyla):
 *   1. Kategori adı tam eşleşmesi
 *   2. Kategori adı kısmi eşleşmesi
 *   3. Ürün başlığı keyword eşleşmesi
 *   4. Marka bazlı öneri
 *
 * @param {Object} product - { title, category, brand, attributes }
 * @returns {{ suggestions: Array<{ name, categoryId, score, matchReason }> }}
 */
const suggestN11Category = (product) => {
    const title    = (product.title    || product.name || "").toLowerCase();
    const category = (product.category || "").toLowerCase();
    const brand    = (product.brand    || "").toLowerCase();

    const suggestions = [];

    // ── Kural tablosu ────────────────────────────────────────────────────────
    // Her kural: { keywords, name, categoryId, baseScore }
    // keywords: başlık VEYA kategori adında bu kelimelerden biri geçiyorsa eşleşir
    const RULES = [
        // Takı & Aksesuar
        { keywords: ["küpe", "küpesi", "earring"],          name: "Takı > Küpe",          categoryId: null, baseScore: 0.90 },
        { keywords: ["kolye", "necklace", "kolyesi"],       name: "Takı > Kolye",         categoryId: null, baseScore: 0.90 },
        { keywords: ["bileklik", "bilezik", "bracelet"],    name: "Takı > Bileklik",      categoryId: null, baseScore: 0.90 },
        { keywords: ["yüzük", "ring", "yüzüğü"],           name: "Takı > Yüzük",         categoryId: null, baseScore: 0.90 },
        { keywords: ["broş", "brooch", "iğne"],             name: "Takı > Broş",          categoryId: null, baseScore: 0.85 },
        { keywords: ["set", "takım", "kombin"],             name: "Takı > Set",           categoryId: null, baseScore: 0.85 },
        { keywords: ["aksesuar", "accessory"],              name: "Aksesuar",             categoryId: null, baseScore: 0.70 },
        { keywords: ["takı", "jewelry", "jewellery"],       name: "Takı",                 categoryId: null, baseScore: 0.75 },

        // Giyim
        { keywords: ["elbise", "dress"],                    name: "Kadın > Elbise",       categoryId: null, baseScore: 0.88 },
        { keywords: ["bluz", "blouse", "gömlek", "shirt"],  name: "Kadın > Bluz & Gömlek",categoryId: null, baseScore: 0.85 },
        { keywords: ["pantolon", "trouser", "pant"],        name: "Kadın > Pantolon",     categoryId: null, baseScore: 0.85 },
        { keywords: ["etek", "skirt"],                      name: "Kadın > Etek",         categoryId: null, baseScore: 0.85 },
        { keywords: ["ceket", "jacket", "blazer"],          name: "Kadın > Ceket",        categoryId: null, baseScore: 0.85 },
        { keywords: ["kazak", "sweater", "sweatshirt"],     name: "Kadın > Kazak",        categoryId: null, baseScore: 0.85 },
        { keywords: ["t-shirt", "tişört", "tshirt"],        name: "Kadın > T-Shirt",      categoryId: null, baseScore: 0.85 },

        // Çanta
        { keywords: ["çanta", "bag", "purse"],              name: "Çanta > El Çantası",   categoryId: null, baseScore: 0.88 },
        { keywords: ["sırt çantası", "backpack"],           name: "Çanta > Sırt Çantası", categoryId: null, baseScore: 0.90 },
        { keywords: ["cüzdan", "wallet", "portföy"],        name: "Çanta > Cüzdan",       categoryId: null, baseScore: 0.88 },

        // Ayakkabı
        { keywords: ["ayakkabı", "shoe", "sneaker"],        name: "Ayakkabı",             categoryId: null, baseScore: 0.88 },
        { keywords: ["topuklu", "heel", "stiletto"],        name: "Ayakkabı > Topuklu",   categoryId: null, baseScore: 0.90 },
        { keywords: ["bot", "boot", "çizme"],               name: "Ayakkabı > Bot",       categoryId: null, baseScore: 0.90 },

        // Ev & Yaşam
        { keywords: ["mum", "candle", "oda kokusu"],        name: "Ev > Dekorasyon",      categoryId: null, baseScore: 0.80 },
        { keywords: ["tablo", "poster", "çerçeve"],         name: "Ev > Tablo & Poster",  categoryId: null, baseScore: 0.82 },
        { keywords: ["yastık", "pillow", "kırlent"],        name: "Ev > Yastık",          categoryId: null, baseScore: 0.82 },
    ];

    for (const rule of RULES) {
        let score      = 0;
        let matchReason = "";

        // Kategori adı tam eşleşmesi (en yüksek skor)
        const categoryExact = rule.keywords.some(kw => category === kw);
        if (categoryExact) {
            score       = Math.min(rule.baseScore + 0.08, 1.0);
            matchReason = "category_exact";
        }

        // Kategori adı kısmi eşleşmesi
        if (!score) {
            const categoryPartial = rule.keywords.some(kw => category.includes(kw));
            if (categoryPartial) {
                score       = rule.baseScore;
                matchReason = "category_keyword";
            }
        }

        // Başlık keyword eşleşmesi
        if (!score) {
            const titleMatch = rule.keywords.some(kw => title.includes(kw));
            if (titleMatch) {
                score       = Math.max(rule.baseScore - 0.05, 0.5);
                matchReason = "title_keyword";
            }
        }

        if (score > 0) {
            // Aynı öneri zaten varsa daha yüksek skoru koru
            const existing = suggestions.find(s => s.name === rule.name);
            if (existing) {
                if (score > existing.score) {
                    existing.score       = score;
                    existing.matchReason = matchReason;
                }
            } else {
                suggestions.push({
                    name:        rule.name,
                    categoryId:  rule.categoryId,
                    score:       parseFloat(score.toFixed(2)),
                    matchReason
                });
            }
        }
    }

    // Skora göre sırala (en yüksek önce)
    suggestions.sort((a, b) => b.score - a.score);

    // En fazla 5 öneri döndür
    return { suggestions: suggestions.slice(0, 5) };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNMAPPED CATEGORY KAYDET
//    Eşleştirilemeyen kategoriyi DB'ye kaydet — duplicate yok
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eşleştirilemeyen kategoriyi UnmappedCategory koleksiyonuna kaydet.
 * Aynı kategori tekrar gelirse hitCount artar, lastSeenAt güncellenir.
 *
 * @param {string} userId
 * @param {string} categoryName       - Eşleştirilemeyen kategori adı
 * @param {Object} product            - Ürün verisi (öneri için)
 * @param {string} [targetMarketplace="N11"]
 * @returns {Promise<Object>}         - Kaydedilen/güncellenen döküman
 */
const saveUnmappedCategory = async (userId, categoryName, product = {}, targetMarketplace = "N11") => {
    if (!userId || !categoryName) return null;

    try {
        // Öneri üret
        const { suggestions } = suggestN11Category(product);

        // Örnek ürün başlığı
        const sampleTitle = (product.title || product.name || "").trim();

        // Upsert — aynı userId + categoryName + targetMarketplace kombinasyonu varsa güncelle
        const doc = await UnmappedCategory.findOneAndUpdate(
            { userId, categoryName, targetMarketplace },
            {
                $set: {
                    source:              product.source || "Trendyol",
                    lastSeenAt:          new Date(),
                    suggestedCategories: suggestions,
                    isResolved:          false
                },
                $inc: { hitCount: 1 },
                $setOnInsert: { detectedAt: new Date() },
                $addToSet: sampleTitle
                    ? { sampleProducts: sampleTitle }
                    : {}
            },
            { upsert: true, new: true }
        );

        logger.info(
            `[UNMAPPED] Kategori kaydedildi: "${categoryName}" ` +
            `(hitCount: ${doc.hitCount}, öneriler: ${suggestions.length})`
        );

        return doc;
    } catch (err) {
        // Duplicate key hatası — zaten kayıtlı, sorun değil
        if (err.code === 11000) {
            logger.debug(`[UNMAPPED] Zaten kayıtlı: "${categoryName}"`);
            return null;
        }
        logger.warn(`[UNMAPPED] Kaydetme hatası: ${err.message}`);
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. UNMAPPED KATEGORİLERİ LİSTELE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kullanıcının çözülmemiş (isResolved: false) kategorilerini listele.
 *
 * @param {string} userId
 * @param {string} [targetMarketplace="N11"]
 * @param {boolean} [includeResolved=false]
 * @returns {Promise<Array>}
 */
const getUnmappedCategories = async (userId, targetMarketplace = "N11", includeResolved = false) => {
    const filter = { userId, targetMarketplace };
    if (!includeResolved) filter.isResolved = false;

    const docs = await UnmappedCategory.find(filter)
        .sort({ hitCount: -1, detectedAt: -1 })
        .lean();

    return docs.map(d => ({
        id:                   d._id,
        categoryName:         d.categoryName,
        source:               d.source,
        targetMarketplace:    d.targetMarketplace,
        detectedAt:           d.detectedAt,
        lastSeenAt:           d.lastSeenAt,
        hitCount:             d.hitCount,
        isResolved:           d.isResolved,
        resolvedAt:           d.resolvedAt,
        resolvedWith:         d.resolvedWith,
        suggestedCategories:  d.suggestedCategories || [],
        sampleProducts:       (d.sampleProducts || []).slice(0, 3)
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. UNMAPPED KATEGORİYİ ÇÖZÜLDÜ OLARAK İŞARETLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kullanıcı mapping yaptıktan sonra bu kategoriyi çözüldü olarak işaretle.
 *
 * @param {string} userId
 * @param {string} categoryName
 * @param {string} n11CategoryId
 * @param {string} n11CategoryName
 * @param {string} [targetMarketplace="N11"]
 */
const resolveUnmappedCategory = async (
    userId,
    categoryName,
    n11CategoryId,
    n11CategoryName,
    targetMarketplace = "N11"
) => {
    await UnmappedCategory.findOneAndUpdate(
        { userId, categoryName, targetMarketplace },
        {
            $set: {
                isResolved:  true,
                resolvedAt:  new Date(),
                resolvedWith: {
                    categoryId:   String(n11CategoryId),
                    categoryName: n11CategoryName
                }
            }
        }
    );

    logger.info(
        `[UNMAPPED] Çözüldü: "${categoryName}" → N11 ${n11CategoryId} (${n11CategoryName})`
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. ÜRÜN ATLAMA — Structured Log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ürünü atla ve structured log yaz.
 * Aynı zamanda UnmappedCategory'ye kaydeder.
 *
 * @param {Object} product   - Ürün verisi
 * @param {string} reason    - "CATEGORY_MAPPING_MISSING" | "NO_IMAGES" | "NO_SKU" vb.
 * @param {string} userId
 * @param {Array}  [suggestions=[]]
 * @returns {{ skipped: true, reason, category, suggestions }}
 */
const skipProduct = async (product, reason, userId = null, suggestions = []) => {
    const productName = product.title || product.name || product.sku || "?";
    const category    = product.category || product.categoryName || "";

    // Structured log
    const logPayload = {
        status:      "SKIPPED",
        reason,
        product:     productName,
        category,
        sku:         product.sku || product.barcode || "",
        suggestions: suggestions.map(s => s.name)
    };

    logger.warn(`[SKIP] ${JSON.stringify(logPayload)}`);

    // Kategori mapping eksikse UnmappedCategory'ye kaydet
    if (reason === "CATEGORY_MAPPING_MISSING" && userId && category) {
        await saveUnmappedCategory(userId, category, product);
    }

    return {
        skipped:     true,
        reason,
        product:     productName,
        category,
        suggestions
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. TAM MAPPING PIPELINE
//    mapCategory() — mapping varsa döndür, yoksa öneri üret + kaydet + null döndür
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kategori mapping pipeline.
 * n11MappingService.mapCategoryToN11() ile entegre çalışır.
 *
 * @param {string} userId
 * @param {Object} product   - { title, category, brand, ... }
 * @param {Function} mapFn   - n11MappingService.mapCategoryToN11 referansı
 * @returns {Promise<{ categoryId, categoryName, source } | null>}
 */
const mapCategoryWithFallback = async (userId, product, mapFn) => {
    const categoryName = (product.category || product.categoryName || "").trim();

    // ── 1. Mapping dene ──────────────────────────────────────────────────────
    const result = await mapFn(userId, categoryName);

    if (result.categoryId) {
        return result; // ✅ Bulundu
    }

    // ── 2. Bulunamadı — öneri üret + kaydet ─────────────────────────────────
    const { suggestions } = suggestN11Category(product);

    await saveUnmappedCategory(userId, categoryName, product);

    logger.warn(
        `[CATEGORY MAPPING] ❌ Bulunamadı: "${categoryName}" | ` +
        `Öneriler: ${suggestions.map(s => `${s.name}(${s.score})`).join(", ") || "yok"}`
    );

    return null; // Çağıran skipProduct() çağırır
};

module.exports = {
    suggestN11Category,
    saveUnmappedCategory,
    getUnmappedCategories,
    resolveUnmappedCategory,
    skipProduct,
    mapCategoryWithFallback
};
