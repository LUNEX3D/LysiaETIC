/**
 * CATEGORY MAPPING SERVİSİ — v2
 *
 * Sorumluluklar:
 *   1. suggestCategory()           — DB'den dinamik kategori önerisi üret (hardcoded kural YOK)
 *   2. saveUnmappedCategory()      — Eşleştirilemeyen kategoriyi DB'ye kaydet (duplicate yok)
 *   3. getUnmappedCategories()     — Kullanıcının çözülmemiş kategorilerini listele
 *   4. resolveUnmappedCategory()   — Kullanıcı mapping yaptıktan sonra çözüldü olarak işaretle
 *   5. skipProduct()               — Ürünü atla ve structured log yaz
 *   6. mapCategoryWithFallback()   — Tam mapping pipeline (eski + yeni sistem)
 *   7. resolveForMarketplace()     — Platform-agnostik InternalCategoryMapping çözümleme
 *   8. getInternalCategoriesCached() — In-memory cache ile InternalCategory listesi
 *   9. invalidateCategoryCache()   — Cache temizle (CRUD sonrası)
 *
 * v2 Değişiklikler:
 *   - Hardcoded RULES tablosu kaldırıldı → InternalCategory.keywords'den dinamik öneri
 *   - InternalCategory in-memory cache (5dk TTL) → her sorgu DB'ye gitmez
 *   - resolveForMarketplace() → tüm platformlar için ortak fallback
 *   - normalize() → shared utils/textNormalize.js'den
 */

const UnmappedCategory   = require("../models/UnmappedCategory");
const CategoryMapping    = require("../models/CategoryMapping");
const InternalCategory   = require("../models/InternalCategory");
const UnifiedCategoryMap = require("../models/UnifiedCategoryMap");
const logger             = require("../config/logger");
const { normalize }      = require("../utils/textNormalize");

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE — InternalCategory (5 dakika TTL)
// Ürün dağıtımında 100 ürün gönderildiğinde her seferinde DB sorgusu yapılmaz
// ─────────────────────────────────────────────────────────────────────────────
let _internalCatCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

/**
 * InternalCategory listesini cache'den veya DB'den getir.
 * @returns {Promise<Array>}
 */
const getInternalCategoriesCached = async () => {
    if (_internalCatCache && (Date.now() - _cacheTime) < CACHE_TTL) {
        return _internalCatCache;
    }
    _internalCatCache = await InternalCategory.find({ isActive: true }).lean();
    _cacheTime = Date.now();
    logger.debug(`[CATEGORY CACHE] ${_internalCatCache.length} dahili kategori cache'lendi`);
    return _internalCatCache;
};

/**
 * Cache'i temizle — kategori CRUD işlemlerinden sonra çağrılır.
 */
const invalidateCategoryCache = () => {
    _internalCatCache = null;
    _cacheTime = 0;
    logger.debug("[CATEGORY CACHE] Cache temizlendi");
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DİNAMİK ÖNERİ SİSTEMİ
//    InternalCategory.keywords'den otomatik öneri üretir (hardcoded kural YOK)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ürün bilgisine göre dahili kategori önerisi üret.
 * InternalCategory.keywords veritabanından dinamik çalışır.
 *
 * @param {Object} product - { title, category, brand, attributes }
 * @returns {Promise<{ suggestions: Array<{ name, categoryId, icon, score, matchReason }> }>}
 */
const suggestCategory = async (product) => {
    const title    = normalize(product.title    || product.name || "");
    const category = normalize(product.category || "");
    const brand    = normalize(product.brand    || "");

    const suggestions = [];
    const internalCats = await getInternalCategoriesCached();

    for (const ic of internalCats) {
        const icName = normalize(ic.name || "");
        const icKeywords = (ic.keywords || []).map(k => normalize(k));
        if (icKeywords.length === 0 && !icName) continue;

        let bestScore = 0;
        let matchReason = "";

        // Kategori adı tam eşleşmesi (en yüksek)
        if (category && (category === icName || icKeywords.includes(category))) {
            bestScore = 0.95;
            matchReason = "category_exact";
        }

        // Kategori adı kısmi eşleşmesi
        if (!bestScore && category) {
            for (const kw of icKeywords) {
                if (category.includes(kw) || kw.includes(category)) {
                    bestScore = 0.85;
                    matchReason = "category_keyword";
                    break;
                }
            }
            if (!bestScore && (category.includes(icName) || icName.includes(category))) {
                bestScore = 0.82;
                matchReason = "category_name_partial";
            }
        }

        // Başlık keyword eşleşmesi
        if (!bestScore && title) {
            for (const kw of icKeywords) {
                if (title.includes(kw)) {
                    bestScore = 0.75;
                    matchReason = "title_keyword";
                    break;
                }
            }
            if (!bestScore && title.includes(icName)) {
                bestScore = 0.70;
                matchReason = "title_name";
            }
        }

        // Marka eşleşmesi
        if (!bestScore && brand) {
            for (const kw of icKeywords) {
                if (brand.includes(kw) || kw.includes(brand)) {
                    bestScore = 0.55;
                    matchReason = "brand_keyword";
                    break;
                }
            }
        }

        if (bestScore > 0) {
            suggestions.push({
                name:        ic.name,
                categoryId:  ic._id.toString(),
                icon:        ic.icon || "📁",
                score:       parseFloat(bestScore.toFixed(2)),
                matchReason
            });
        }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return { suggestions: suggestions.slice(0, 5) };
};

// Eski API uyumluluğu — sync wrapper (cache zaten yüklüyse hızlı)
const suggestN11Category = (product) => {
    // Eski çağrılar sync beklediği için cache'den dene, yoksa boş döndür
    if (_internalCatCache) {
        const title    = normalize(product.title    || product.name || "");
        const category = normalize(product.category || "");
        const suggestions = [];

        for (const ic of _internalCatCache) {
            const icName = normalize(ic.name || "");
            const icKeywords = (ic.keywords || []).map(k => normalize(k));
            let score = 0;
            let matchReason = "";

            if (category && (category === icName || icKeywords.includes(category))) {
                score = 0.95; matchReason = "category_exact";
            } else if (category) {
                for (const kw of icKeywords) {
                    if (category.includes(kw) || kw.includes(category)) {
                        score = 0.85; matchReason = "category_keyword"; break;
                    }
                }
            }
            if (!score && title) {
                for (const kw of icKeywords) {
                    if (title.includes(kw)) {
                        score = 0.75; matchReason = "title_keyword"; break;
                    }
                }
            }
            if (score > 0) {
                suggestions.push({ name: ic.name, categoryId: ic._id.toString(), score: parseFloat(score.toFixed(2)), matchReason });
            }
        }
        suggestions.sort((a, b) => b.score - a.score);
        return { suggestions: suggestions.slice(0, 5) };
    }
    return { suggestions: [] };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNMAPPED CATEGORY KAYDET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eşleştirilemeyen kategoriyi UnmappedCategory koleksiyonuna kaydet.
 * Aynı kategori tekrar gelirse hitCount artar, lastSeenAt güncellenir.
 */
const saveUnmappedCategory = async (userId, categoryName, product = {}, targetMarketplace = "N11") => {
    if (!userId || !categoryName) return null;

    try {
        const { suggestions } = await suggestCategory(product);
        const sampleTitle = (product.title || product.name || "").trim();

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
                $addToSet: sampleTitle ? { sampleProducts: sampleTitle } : {}
            },
            { upsert: true, new: true }
        );

        logger.info(
            `[UNMAPPED] Kategori kaydedildi: "${categoryName}" ` +
            `(hitCount: ${doc.hitCount}, öneriler: ${suggestions.length})`
        );
        return doc;
    } catch (err) {
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

const resolveUnmappedCategory = async (
    userId, categoryName, platformCategoryId, platformCategoryName, targetMarketplace = "N11"
) => {
    await UnmappedCategory.findOneAndUpdate(
        { userId, categoryName, targetMarketplace },
        {
            $set: {
                isResolved:  true,
                resolvedAt:  new Date(),
                resolvedWith: {
                    categoryId:   String(platformCategoryId),
                    categoryName: platformCategoryName
                }
            }
        }
    );

    logger.info(
        `[UNMAPPED] Çözüldü: "${categoryName}" → ${targetMarketplace} ${platformCategoryId} (${platformCategoryName})`
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. ÜRÜN ATLAMA — Structured Log
// ─────────────────────────────────────────────────────────────────────────────

const skipProduct = async (product, reason, userId = null, suggestions = []) => {
    const productName = product.title || product.name || product.sku || "?";
    const category    = product.category || product.categoryName || "";

    const logPayload = {
        status:      "SKIPPED",
        reason,
        product:     productName,
        category,
        sku:         product.sku || product.barcode || "",
        suggestions: suggestions.map(s => s.name)
    };

    logger.warn(`[SKIP] ${JSON.stringify(logPayload)}`);

    if (reason === "CATEGORY_MAPPING_MISSING" && userId && category) {
        await saveUnmappedCategory(userId, category, product);
    }

    return { skipped: true, reason, product: productName, category, suggestions };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. TAM MAPPING PIPELINE
//    mapCategoryWithFallback() — mapping varsa döndür, yoksa öneri üret + kaydet + null döndür
// ─────────────────────────────────────────────────────────────────────────────

const mapCategoryWithFallback = async (userId, product, mapFn, marketplace = "N11") => {
    const categoryName = (product.category || product.categoryName || "").trim();

    // ── 0. UnifiedCategoryMap'ten çözümle (Ortak Kategori Merkezi) ──
    try {
        const unifiedResult = await resolveFromUnifiedMap(categoryName, marketplace);
        if (unifiedResult && unifiedResult.categoryId) {
            return unifiedResult;
        }
    } catch (err) {
        logger.debug(`[CATEGORY MAPPING] UnifiedCategoryMap hatası (fallback devam): ${err.message}`);
    }

    // ── 1. Platform-spesifik mapping sistemi ile dene ──
    const result = await mapFn(userId, categoryName);

    if (result && result.categoryId) {
        return result;
    }

    // ── 2. Smart Resolver Pipeline ile dene (Exact → Learned → Hybrid AI → Fallback) ──
    try {
        const { resolveCategory } = require("./categoryResolverService");
        const resolved = await resolveCategory(userId, product, marketplace, {
            autoApply: true,
            saveLearning: true
        });

        if (resolved && resolved.resolved && resolved.marketplaceCategory) {
            logger.info(
                `[CATEGORY MAPPING] ✅ Smart Resolver çözdü: "${categoryName}" → ` +
                `${resolved.marketplaceCategory.name} (source: ${resolved.source}, güven: ${(resolved.confidence * 100).toFixed(0)}%)`
            );
            return {
                categoryId:   resolved.marketplaceCategory.id,
                categoryName: resolved.marketplaceCategory.name,
                source:       `resolver_${resolved.source}`
            };
        }
    } catch (err) {
        logger.debug(`[CATEGORY MAPPING] Smart Resolver hatası (fallback devam): ${err.message}`);
    }

    // ── 3. Bulunamadı — dinamik öneri üret + kaydet ──
    const { suggestions } = await suggestCategory(product);

    await saveUnmappedCategory(userId, categoryName, product, marketplace);

    logger.warn(
        `[CATEGORY MAPPING] ❌ Bulunamadı: "${categoryName}" | ` +
        `Öneriler: ${suggestions.map(s => `${s.name}(${s.score})`).join(", ") || "yok"} | ` +
        `Çözüm: Kategori Eşleştirme Merkezi'nden bu kategoriyi eşleştirin.`
    );

    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. PLATFORM-AGNOSTİK KATEGORİ ÇÖZÜMLEME
//    Tüm platformlar için ortak InternalCategoryMapping fallback
//    N11, Hepsiburada, ÇiçekSepeti, Amazon hepsi bu fonksiyonu kullanabilir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kategori adından InternalCategoryMapping üzerinden platform kategorisini çözümle.
 * n11MappingService'deki Step 3 mantığının genel versiyonu.
 *
 * @param {string} categoryName      — Ürün kategori adı
 * @param {string} marketplace       — Hedef platform ("N11", "Hepsiburada", vb.)
 * @returns {Promise<{ categoryId, categoryName, source } | null>}
 */
const resolveForMarketplace = async (categoryName, marketplace) => {
    if (!categoryName || !marketplace) return null;

    try {
        const InternalCategoryMapping = require("../models/InternalCategoryMapping");

        const normalizedLower = normalize(categoryName).replace(/[>]/g, " ").replace(/\s+/g, " ").trim();
        const inputWords = normalizedLower.split(/\s+/).filter(w => w.length > 1);

        const internalCats = await getInternalCategoriesCached();

        let bestMatch = null;
        let bestScore = 0;

        for (const ic of internalCats) {
            const icName = normalize(ic.name || "");
            const icKeywords = (ic.keywords || []).map(k => normalize(k));

            // Tam isim eşleşmesi
            if (normalizedLower === icName || normalizedLower.includes(icName) || icName.includes(normalizedLower)) {
                const score = normalizedLower === icName ? 1.0 : 0.85;
                if (score > bestScore) { bestScore = score; bestMatch = ic; }
                continue;
            }

            // Keyword eşleşmesi
            let kwScore = 0;
            for (const kw of icKeywords) {
                if (normalizedLower.includes(kw) || inputWords.some(w => w === kw || kw.includes(w) || w.includes(kw))) {
                    kwScore += 1;
                }
            }
            if (icKeywords.length > 0 && kwScore > 0) {
                const score = Math.min(kwScore / Math.max(icKeywords.length, 1), 1.0) * 0.8;
                if (score > bestScore) { bestScore = score; bestMatch = ic; }
            }
        }

        if (bestMatch && bestScore >= 0.3) {
            const mapping = await InternalCategoryMapping.findOne({
                internalCategoryId: bestMatch._id,
                marketplace,
                isActive: true
            }).lean();

            if (mapping && mapping.marketplaceCategoryId) {
                logger.info(
                    `[RESOLVE] ✅ InternalCategoryMapping: "${categoryName}" → ` +
                    `dahili: "${bestMatch.name}" → ${marketplace} ID: ${mapping.marketplaceCategoryId} ` +
                    `(${mapping.marketplaceCategoryName}) [skor: ${bestScore.toFixed(2)}]`
                );
                return {
                    categoryId:   mapping.marketplaceCategoryId,
                    categoryName: mapping.marketplaceCategoryName,
                    source:       "InternalCategoryMapping"
                };
            }
        }
    } catch (err) {
        logger.warn(`[RESOLVE] ${marketplace} InternalCategoryMapping hatası: ${err.message}`);
    }

    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. UNIFIED CATEGORY MAP ÇÖZÜMLEME
//    Ortak Kategori Merkezi'nden (3 platform birleşik harita) platform kategorisini çözümle.
//    Ürün yükleme/dağıtımda ilk adım olarak kullanılır.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kategori adını UnifiedCategoryMap'te arayıp hedef platformun categoryId'sini döndürür.
 *
 * @param {string} categoryName — Ürün kategori adı (örn: "Altın Bileklik")
 * @param {string} marketplace  — Hedef platform ("Trendyol" | "N11" | "ÇiçekSepeti")
 * @returns {Promise<{ categoryId, categoryName, source } | null>}
 */
const resolveFromUnifiedMap = async (categoryName, marketplace) => {
    if (!categoryName || !marketplace) return null;

    // Platform field adını belirle
    const platformField = marketplace === "Trendyol" ? "trendyol"
        : marketplace === "N11" ? "n11"
        : (marketplace === "ÇiçekSepeti" || marketplace === "Ciceksepeti") ? "ciceksepeti"
        : null;

    if (!platformField) return null;

    try {
        // Normalize et (Türkçe karakter + lowercase)
        const normalizedInput = normalize(categoryName)
            .replace(/[>]/g, " ").replace(/\s+/g, " ").trim();

        if (!normalizedInput) return null;

        // 1. Exact normalizedKey eşleşmesi
        const { normalizeKey } = require("./unifiedCategoryImportService");
        const key = normalizeKey(categoryName);

        let unified = null;
        if (key) {
            unified = await UnifiedCategoryMap.findOne({
                normalizedKey: key,
                [`${platformField}.categoryId`]: { $ne: null }
            }).lean();
        }

        // 2. Regex arama (kısmi eşleşme)
        if (!unified) {
            const searchRegex = new RegExp(normalizedInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            unified = await UnifiedCategoryMap.findOne({
                [`${platformField}.categoryId`]: { $ne: null },
                $or: [
                    { canonicalName: searchRegex },
                    { normalizedKey: searchRegex }
                ]
            }).lean();
        }

        if (unified && unified[platformField]?.categoryId) {
            logger.info(
                `[UNIFIED MAP] ✅ "${categoryName}" → ${marketplace}: ` +
                `${unified[platformField].categoryName} (ID: ${unified[platformField].categoryId})`
            );
            return {
                categoryId:   unified[platformField].categoryId,
                categoryName: unified[platformField].categoryName,
                categoryPath: unified[platformField].categoryPath || "",
                source:       "UnifiedCategoryMap"
            };
        }
    } catch (err) {
        logger.warn(`[UNIFIED MAP] ${marketplace} çözümleme hatası: ${err.message}`);
    }

    return null;
};

module.exports = {
    suggestN11Category,
    suggestCategory,
    saveUnmappedCategory,
    getUnmappedCategories,
    resolveUnmappedCategory,
    skipProduct,
    mapCategoryWithFallback,
    resolveForMarketplace,
    resolveFromUnifiedMap,
    getInternalCategoriesCached,
    invalidateCategoryCache
};
