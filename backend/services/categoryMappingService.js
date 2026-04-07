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
 *
 * v2.1 Değişiklikler:
 *   - normalizeKey + extractMeaningfulWords modül seviyesinde import (lazy require kaldırıldı)
 *   - resolveFromUnifiedMap Adım 4: gereksiz > replace kaldırıldı (normalize zaten yapar)
 *   - resolveFromUnifiedMap Adım 5: $in + regex → $or + $regex (doğru OR semantiği + index)
 *   - resolveFromUnifiedMap Adım 5: aday çekme sınırı eklendi (max 50, performans)
 */

const UnmappedCategory   = require("../models/UnmappedCategory");
const CategoryMapping    = require("../models/CategoryMapping");
const InternalCategory   = require("../models/InternalCategory");
const UnifiedCategoryMap = require("../models/UnifiedCategoryMap");
const logger             = require("../config/logger");
const { normalize, normalizeKey, extractMeaningfulWords } = require("../utils/textNormalize");

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

    // ── 1. UnifiedCategoryMap'ten çözümle (Ortak Kategori Merkezi) ──
    try {
        const unifiedResult = await resolveFromUnifiedMap(categoryName, marketplace);
        if (unifiedResult && unifiedResult.categoryId) {
            return unifiedResult;
        }
    } catch (err) {
        logger.debug(`[CATEGORY MAPPING] UnifiedCategoryMap hatası (fallback devam): ${err.message}`);
    }

    // ── 2. Platform-spesifik mapping sistemi ile dene (CategoryMapping + MarketplaceCategory + InternalCategoryMapping) ──
    const result = await mapFn(userId, categoryName);

    if (result && result.categoryId) {
        return result;
    }

    // ── 3. InternalCategoryMapping ile dene ──
    try {
        const resolved = await resolveForMarketplace(categoryName, marketplace);
        if (resolved && resolved.categoryId) {
            logger.info(
                `[CATEGORY MAPPING] ✅ InternalCategoryMapping çözdü: "${categoryName}" → ` +
                `${resolved.categoryName} (ID: ${resolved.categoryId})`
            );
            return resolved;
        }
    } catch (err) {
        logger.debug(`[CATEGORY MAPPING] InternalCategoryMapping hatası: ${err.message}`);
    }

    // ── 4. Bulunamadı — kaydet ve null döndür ──
    await saveUnmappedCategory(userId, categoryName, product, marketplace);

    logger.warn(
        `[CATEGORY MAPPING] ❌ Bulunamadı: "${categoryName}" → ${marketplace} | ` +
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

        const normalizedLower = normalizeKey(categoryName);
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
// 8. UNIFIED CATEGORY MAP ÇÖZÜMLEME — v2 (Akıllı Eşleştirme)
//    Ortak Kategori Merkezi'nden (3 platform birleşik harita) platform kategorisini çözümle.
//    Ürün yükleme/dağıtımda ilk adım olarak kullanılır.
//
//    Pipeline (6 adım — ilk bulunan döner):
//      1.  Exact normalizedKey eşleşmesi
//      1b. Trendyol Referans Parent→Child Fallback
//          Exact key bulundu ama hedef platformda yok + parent kategori
//          → Trendyol child'larından hedef platformda karşılığı olan en uygununu seç
//          Seçim: platformCount DESC → isLeaf DESC → name length ASC
//      2.  Kaynak platform adıyla ters arama (trendyol.categoryName → n11.categoryId)
//      3.  Yaprak kategori çıkarma ("Ev > Dekor > Biblo" → "Biblo" ile ara)
//      4.  Regex kısmi eşleşme (canonicalName / normalizedKey) — kısa girişlerde atlanır
//      5.  Kelime bazlı skorlama (anlamlı kelimeler ile en iyi eşleşme)
// ─────────────────────────────────────────────────────────────────────────────

/** Platform adından DB field adına çevir */
const _platformField = (marketplace) =>
    marketplace === "Trendyol" ? "trendyol"
    : marketplace === "N11" ? "n11"
    : (marketplace === "ÇiçekSepeti" || marketplace === "Ciceksepeti") ? "ciceksepeti"
    : marketplace === "Hepsiburada" ? "hepsiburada"
    : marketplace === "Amazon" ? "amazon"
    : null;

/** Tüm platform field adları (ters arama için) */
const ALL_PLATFORM_FIELDS = ["trendyol", "n11", "ciceksepeti", "hepsiburada", "amazon"];

/**
 * Kategori adını UnifiedCategoryMap'te arayıp hedef platformun categoryId'sini döndürür.
 *
 * @param {string} categoryName — Ürün kategori adı (örn: "Dekoratif Obje ve Biblo", "Biblo")
 * @param {string} marketplace  — Hedef platform ("Trendyol" | "N11" | "ÇiçekSepeti")
 * @returns {Promise<{ categoryId, categoryName, categoryPath, source } | null>}
 */
const resolveFromUnifiedMap = async (categoryName, marketplace) => {
    if (!categoryName || !marketplace) return null;

    const targetField = _platformField(marketplace);
    if (!targetField) return null;

    // Hedef platformda categoryId olmalı
    const targetFilter = { [`${targetField}.categoryId`]: { $ne: null } };

    try {
        const key = normalizeKey(categoryName);

        if (!key) return null;

        let unified = null;
        let matchStep = "";

        // ── Adım 1: Exact normalizedKey eşleşmesi ───────────────────────────
        unified = await UnifiedCategoryMap.findOne({
            normalizedKey: key,
            ...targetFilter
        }).lean();
        if (unified) matchStep = "exact_key";

        // ── Adım 1b: Trendyol Referans — Parent→Child Fallback ───────────
        // Exact key bulundu ama hedef platformda karşılığı yok?
        // Trendyol referans platform olduğu için: parent kategorinin
        // Trendyol'daki child'larına bak → hedef platformda karşılığı olan
        // en uygun child'ı seç.
        //
        // Örnek: "Küpe" (TY:400) → N11'de yok → TY child'ları arasından
        //   Altın Küpe (3 platform), Çelik Küpe (3 platform), vs. → birini seç
        //
        // Seçim kriterleri (öncelik sırasıyla):
        //   1. platformCount (çok platformda olan daha güvenilir)
        //   2. isLeaf (yaprak kategori tercih edilir)
        //   3. canonicalName uzunluğu (kısa = daha genel = daha iyi fallback)
        if (!unified) {
            // targetFilter olmadan exact key ara — kayıt var mı ama hedef platformda mı yok?
            const exactNoFilter = await UnifiedCategoryMap.findOne({
                normalizedKey: key
            }).lean();

            if (exactNoFilter && !exactNoFilter[targetField]?.categoryId) {
                // Input kelimelerini hazırla — child seçiminde kullanılacak
                const inputWordsForChild = extractMeaningfulWords(categoryName);

                // Child'lar arasından en uygununu seçen yardımcı fonksiyon
                // Sıralama: inputWordMatch DESC → platformCount DESC → isLeaf DESC → name length ASC → alfabetik
                const pickBestChild = (children) => {
                    children.sort((a, b) => {
                        // 0. Input kelime eşleşmesi — input'taki kelimeleri içeren child öncelikli
                        //    "Biblo, Figür, Objeler" → child "Biblo" (1 eşleşme) vs "Figür" (1 eşleşme)
                        //    Bu sayede tamamen alakasız child'lar sona düşer
                        if (inputWordsForChild.length > 0) {
                            const aWords = extractMeaningfulWords(a.canonicalName);
                            const bWords = extractMeaningfulWords(b.canonicalName);
                            const aMatch = inputWordsForChild.filter(iw => aWords.some(aw => aw === iw || aw.includes(iw) || iw.includes(aw))).length;
                            const bMatch = inputWordsForChild.filter(iw => bWords.some(bw => bw === iw || bw.includes(iw) || iw.includes(bw))).length;
                            if (bMatch !== aMatch) return bMatch - aMatch;
                        }
                        // 1. platformCount — çok platformda olan daha güvenilir
                        if (b.platformCount !== a.platformCount) return b.platformCount - a.platformCount;
                        // 2. isLeaf — yaprak tercih
                        if (b.isLeaf !== a.isLeaf) return b.isLeaf ? 1 : -1;
                        // 3. Kısa isim — daha genel kategori
                        const lenDiff = (a.canonicalName?.length || 0) - (b.canonicalName?.length || 0);
                        if (lenDiff !== 0) return lenDiff;
                        // 4. Alfabetik — deterministik sıralama (aynı uzunlukta isimler için)
                        return (a.canonicalName || "").localeCompare(b.canonicalName || "", "tr");
                    });
                    return children[0];
                };

                // Trendyol referans: child'ları Trendyol parentId üzerinden bul
                const tyData = exactNoFilter.trendyol;
                if (tyData?.categoryId && !tyData.isLeaf) {
                    const children = await UnifiedCategoryMap.find({
                        "trendyol.parentId": tyData.categoryId,
                        ...targetFilter
                    }).lean();

                    if (children.length > 0) {
                        unified = pickBestChild(children);
                        matchStep = `parent_child_fallback(${children.length} children)`;

                        logger.info(
                            `[UNIFIED MAP] 🔀 Parent→Child: "${categoryName}" (TY:${tyData.categoryId}) ` +
                            `→ "${unified.canonicalName}" (${children.length} child arasından seçildi)`
                        );
                    }
                }

                // ÇiçekSepeti referans fallback (Trendyol yoksa)
                if (!unified) {
                    const csData = exactNoFilter.ciceksepeti;
                    if (csData?.categoryId && !csData.isLeaf) {
                        const children = await UnifiedCategoryMap.find({
                            "ciceksepeti.parentId": csData.categoryId,
                            ...targetFilter
                        }).lean();

                        if (children.length > 0) {
                            unified = pickBestChild(children);
                            matchStep = `parent_child_fallback_cs(${children.length} children)`;
                        }
                    }
                }
            }
        }

        // ── Adım 2: Kaynak platform adıyla ters arama ───────────────────────
        // Ürün Trendyol'dan geldi, kategori adı "Dekoratif Obje ve Biblo"
        // → trendyol.categoryName'de ara → N11 karşılığını bul
        if (!unified) {
            const escapedName = categoryName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const exactNameRegex = new RegExp(`^${escapedName}$`, "i");

            for (const srcField of ALL_PLATFORM_FIELDS) {
                if (srcField === targetField) continue; // Hedef platformda aramaya gerek yok
                unified = await UnifiedCategoryMap.findOne({
                    [`${srcField}.categoryName`]: exactNameRegex,
                    ...targetFilter
                }).lean();
                if (unified) { matchStep = `reverse_${srcField}`; break; }
            }
        }

        // ── Adım 3: Yaprak kategori çıkarma ─────────────────────────────────
        // "Ev Dekorasyon > Dekoratif Obje ve Biblo" → "Dekoratif Obje ve Biblo"
        // "Aksesuar > Takı > Bileklik" → "Bileklik"
        if (!unified && categoryName.includes(">")) {
            const leafName = categoryName.split(">").pop().trim();
            if (leafName && leafName !== categoryName.trim()) {
                const leafKey = normalizeKey(leafName);

                // 3a. Yaprak adıyla exact key
                if (leafKey) {
                    unified = await UnifiedCategoryMap.findOne({
                        normalizedKey: leafKey,
                        ...targetFilter
                    }).lean();
                    if (unified) matchStep = "leaf_exact_key";
                }

                // 3b. Yaprak adıyla kaynak platform ters arama
                if (!unified) {
                    const leafRegex = new RegExp(`^${leafName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
                    for (const srcField of ALL_PLATFORM_FIELDS) {
                        unified = await UnifiedCategoryMap.findOne({
                            [`${srcField}.categoryName`]: leafRegex,
                            ...targetFilter
                        }).lean();
                        if (unified) { matchStep = `leaf_reverse_${srcField}`; break; }
                    }
                }
            }
        }

        // ── Adım 4: Regex kısmi eşleşme ─────────────────────────────────────
        // Güvenlik: Kısa girişlerde (tek kelime) kısmi eşleşme çok agresif
        // sonuç verir ("kupe" → "pirlanta kupe" gibi yanlış eşleşme).
        // Kısa girişlerde bu adım atlanır — Adım 5 (kelime skorlama) daha güvenli.
        if (!unified) {
            const keyWords = key.split(/\s+/).filter(w => w.length > 1);
            const isShortInput = keyWords.length <= 1;

            if (!isShortInput) {
                const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const searchRegex = new RegExp(escaped, "i");

                unified = await UnifiedCategoryMap.findOne({
                    ...targetFilter,
                    $or: [
                        { canonicalName: searchRegex },
                        { normalizedKey: searchRegex }
                    ]
                }).lean();
                if (unified) matchStep = "regex_partial";
            }
        }

        // ── Adım 5: Kelime bazlı skorlama ───────────────────────────────────
        // "Biblo" kelimesini içeren tüm UnifiedCategoryMap kayıtlarını bul,
        // en çok kelime eşleşen ve en yüksek platformCount'lu olanı seç
        if (!unified) {
            const inputWords = extractMeaningfulWords(categoryName);
            if (inputWords.length > 0) {
                // Her anlamlı kelime için $or koşulu oluştur
                // Not: Eski $in + regex dizisi OR gibi çalışıyordu ama
                // MongoDB $or + $regex daha açık, index-dostu ve kontrollü.
                const orConditions = inputWords.map(w => ({
                    normalizedKey: {
                        $regex: w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        $options: "i"
                    }
                }));

                // En az 1 kelime eşleşen kayıtları bul (max 50 aday — performans)
                const candidates = await UnifiedCategoryMap.find({
                    ...targetFilter,
                    $or: orConditions
                }).limit(50).lean();

                if (candidates.length > 0) {
                    // Her aday için skor hesapla
                    let bestCandidate = null;
                    let bestScore = 0;

                    for (const cand of candidates) {
                        const candWords = extractMeaningfulWords(cand.canonicalName);
                        if (candWords.length === 0) continue;

                        // Eşleşen kelime sayısı (input → aday yönü)
                        // Güvenlik: Kısa kelimeler (≤2 karakter) substring eşleşmesi yapamaz
                        // ("el" ↔ "objeler" gibi yanlış eşleşmeleri engeller)
                        let inputMatchCount = 0;
                        for (const iw of inputWords) {
                            if (candWords.some(cw => {
                                if (cw === iw) return true;
                                if (cw.length <= 2 || iw.length <= 2) return false;
                                return cw.includes(iw) || iw.includes(cw);
                            })) {
                                inputMatchCount++;
                            }
                        }

                        if (inputMatchCount === 0) continue;

                        // Eşleşen kelime sayısı (aday → input yönü)
                        let candMatchCount = 0;
                        for (const cw of candWords) {
                            if (inputWords.some(iw => {
                                if (iw === cw) return true;
                                if (iw.length <= 2 || cw.length <= 2) return false;
                                return iw.includes(cw) || cw.includes(iw);
                            })) {
                                candMatchCount++;
                            }
                        }

                        // Çift yönlü skor: hem input'un ne kadarı eşleşti, hem adayın
                        // Bu sayede "2.El Figür & Biblo" gibi ekstra kelimeli adaylar
                        // cezalandırılır (candCoverage düşük olur)
                        const inputCoverage = inputMatchCount / inputWords.length;
                        const candCoverage  = candMatchCount / candWords.length;
                        const wordScore = (inputCoverage + candCoverage) / 2;

                        // Orijinal kelime sayısı (stopword/kısa kelime filtrelenmeden önce)
                        // "2.El Figür & Biblo" → normalize → "2 el figur biblo" → 4 kelime
                        // Ama candWords sadece 2 ("figur","biblo") — filtrelenen kelimeler
                        // adayın gerçek karmaşıklığını gizliyor. Ham kelime sayısı ile cezala.
                        const candRawWords = normalizeKey(cand.canonicalName).split(/\s+/).filter(w => w.length > 1);
                        const rawCoverage = candRawWords.length > 0
                            ? candMatchCount / candRawWords.length
                            : candCoverage;
                        const adjustedWordScore = (inputCoverage + rawCoverage) / 2;

                        // platformCount bonusu: Çok platformda olan kategori daha güvenilir
                        // 3 platform = 0.15, 1 platform = 0.05
                        const platformBonus = (cand.platformCount || 1) * 0.05;
                        const leafBonus = cand.isLeaf ? 0.1 : 0;
                        const score = adjustedWordScore + platformBonus + leafBonus;

                        if (score > bestScore) {
                            bestScore = score;
                            bestCandidate = cand;
                        }
                    }

                    // Minimum skor eşiği: 0.3
                    if (bestCandidate && bestScore >= 0.3) {
                        unified = bestCandidate;
                        matchStep = `word_score(${bestScore.toFixed(2)})`;
                    }
                }
            }
        }

        // ── Sonuç ────────────────────────────────────────────────────────────
        if (unified && unified[targetField]?.categoryId) {

            // ── isLeaf Kontrolü ───────────────────────────────────────────
            // N11 (ve diğer platformlar) sadece LEAF (yaprak) kategorileri kabul eder.
            // UnifiedCategoryMap'te bulunan kategori parent ise → o kategorinin
            // leaf child'ını otomatik bul. Böylece kullanıcının eşleştirmesi
            // baz alınır ama platformun kabul edeceği yaprak kategoriye inilir.
            //
            // Örnek: "Dekoratif Obje" (parent, isLeaf:false) → N11 reddeder
            //        → child'lardan "Biblo" (leaf, isLeaf:true) otomatik seçilir
            const targetCat = unified[targetField];
            if (targetCat.isLeaf === false) {
                logger.info(
                    `[UNIFIED MAP] ⚠️ "${categoryName}" → ${marketplace}: ` +
                    `"${targetCat.categoryName}" (ID: ${targetCat.categoryId}) parent kategori (isLeaf:false). ` +
                    `Leaf child aranıyor...`
                );

                try {
                    // Bu parent'ın altındaki leaf child'ları bul
                    const leafChildren = await UnifiedCategoryMap.find({
                        [`${targetField}.parentId`]: targetCat.categoryId,
                        [`${targetField}.categoryId`]: { $ne: null },
                        [`${targetField}.isLeaf`]: true
                    }).lean();

                    if (leafChildren.length > 0) {
                        // En uygun leaf child'ı seç:
                        // 1. Input kelime eşleşmesi (kategori adındaki kelimeler)
                        // 2. platformCount (çok platformda olan daha güvenilir)
                        // 3. canonicalName uzunluğu (kısa = daha genel)
                        const inputWordsForLeaf = extractMeaningfulWords(categoryName);

                        leafChildren.sort((a, b) => {
                            // Input kelime eşleşmesi
                            if (inputWordsForLeaf.length > 0) {
                                const aWords = extractMeaningfulWords(a.canonicalName);
                                const bWords = extractMeaningfulWords(b.canonicalName);
                                const aMatch = inputWordsForLeaf.filter(iw => aWords.some(aw => aw === iw || aw.includes(iw) || iw.includes(aw))).length;
                                const bMatch = inputWordsForLeaf.filter(iw => bWords.some(bw => bw === iw || bw.includes(iw) || iw.includes(bw))).length;
                                if (bMatch !== aMatch) return bMatch - aMatch;
                            }
                            // platformCount
                            if ((b.platformCount || 0) !== (a.platformCount || 0)) return (b.platformCount || 0) - (a.platformCount || 0);
                            // Kısa isim tercih
                            return (a.canonicalName?.length || 0) - (b.canonicalName?.length || 0);
                        });

                        const bestLeaf = leafChildren[0];
                        const leafCat = bestLeaf[targetField];

                        logger.info(
                            `[UNIFIED MAP] ✅ Leaf child bulundu: "${categoryName}" → ` +
                            `"${leafCat.categoryName}" (ID: ${leafCat.categoryId}) ` +
                            `[${leafChildren.length} child arasından seçildi, adım: ${matchStep}→leaf_auto]`
                        );

                        return {
                            categoryId:   leafCat.categoryId,
                            categoryName: leafCat.categoryName,
                            categoryPath: leafCat.categoryPath || "",
                            source:       `UnifiedCategoryMap_${matchStep}→leaf_auto`
                        };
                    }

                    // Leaf child bulunamadı — 2. seviye: child'ların child'larını dene (grandchildren)
                    // Parent → Child (parent) → Grandchild (leaf) yapısı
                    const nonLeafChildren = await UnifiedCategoryMap.find({
                        [`${targetField}.parentId`]: targetCat.categoryId,
                        [`${targetField}.categoryId`]: { $ne: null },
                        [`${targetField}.isLeaf`]: { $ne: true }
                    }).lean();

                    if (nonLeafChildren.length > 0) {
                        const childIds = nonLeafChildren.map(c => c[targetField].categoryId).filter(Boolean);
                        const grandchildren = await UnifiedCategoryMap.find({
                            [`${targetField}.parentId`]: { $in: childIds },
                            [`${targetField}.categoryId`]: { $ne: null },
                            [`${targetField}.isLeaf`]: true
                        }).lean();

                        if (grandchildren.length > 0) {
                            grandchildren.sort((a, b) => {
                                if (inputWordsForLeaf.length > 0) {
                                    const aWords = extractMeaningfulWords(a.canonicalName);
                                    const bWords = extractMeaningfulWords(b.canonicalName);
                                    const aMatch = inputWordsForLeaf.filter(iw => aWords.some(aw => aw === iw || aw.includes(iw) || iw.includes(aw))).length;
                                    const bMatch = inputWordsForLeaf.filter(iw => bWords.some(bw => bw === iw || bw.includes(iw) || iw.includes(bw))).length;
                                    if (bMatch !== aMatch) return bMatch - aMatch;
                                }
                                if ((b.platformCount || 0) !== (a.platformCount || 0)) return (b.platformCount || 0) - (a.platformCount || 0);
                                return (a.canonicalName?.length || 0) - (b.canonicalName?.length || 0);
                            });

                            const bestGrandchild = grandchildren[0];
                            const gcCat = bestGrandchild[targetField];

                            logger.info(
                                `[UNIFIED MAP] ✅ Grandchild leaf bulundu: "${categoryName}" → ` +
                                `"${gcCat.categoryName}" (ID: ${gcCat.categoryId}) ` +
                                `[${grandchildren.length} grandchild arasından, adım: ${matchStep}→grandchild_leaf_auto]`
                            );

                            return {
                                categoryId:   gcCat.categoryId,
                                categoryName: gcCat.categoryName,
                                categoryPath: gcCat.categoryPath || "",
                                source:       `UnifiedCategoryMap_${matchStep}→grandchild_leaf_auto`
                            };
                        }
                    }

                    // Hiç leaf bulunamadı — parent kategoriyi yine de döndür (eski davranış)
                    // Platform reddederse log'da görünür, kullanıcı manuel düzeltir
                    logger.warn(
                        `[UNIFIED MAP] ⚠️ "${categoryName}" → ${marketplace}: ` +
                        `"${targetCat.categoryName}" (ID: ${targetCat.categoryId}) parent kategori ama ` +
                        `leaf child bulunamadı. Parent ID gönderiliyor — platform reddedebilir.`
                    );
                } catch (leafErr) {
                    logger.warn(
                        `[UNIFIED MAP] Leaf child arama hatası: ${leafErr.message} — ` +
                        `parent kategori ID gönderiliyor`
                    );
                }
            }

            logger.info(
                `[UNIFIED MAP] ✅ "${categoryName}" → ${marketplace}: ` +
                `${unified[targetField].categoryName} (ID: ${unified[targetField].categoryId}) ` +
                `[adım: ${matchStep}]`
            );
            return {
                categoryId:   unified[targetField].categoryId,
                categoryName: unified[targetField].categoryName,
                categoryPath: unified[targetField].categoryPath || "",
                source:       `UnifiedCategoryMap_${matchStep}`
            };
        }

        // Bulunamadı — debug log
        logger.debug(
            `[UNIFIED MAP] ❌ "${categoryName}" → ${marketplace}: eşleşme bulunamadı ` +
            `(normalizedKey: "${key}", inputWords: [${extractMeaningfulWords(categoryName).join(", ")}])`
        );
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
