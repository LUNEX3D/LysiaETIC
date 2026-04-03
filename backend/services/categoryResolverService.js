/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KATEGORİ RESOLVER SERVİSİ — Unified Category Resolution Pipeline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tüm kategori çözümleme mantığını TEK bir pipeline'da birleştirir.
 *
 * Pipeline Sırası:
 *   1. EXACT MAPPING     — InternalCategoryMapping'de birebir eşleşme
 *   2. LEARNED MAPPING   — UserCategoryMemory'den öğrenilmiş eşleşme
 *   3. HYBRID AI MATCH   — Embedding + Keyword + Historical (Hybrid Scoring)
 *   4. FALLBACK          — Parent kategori veya en yakın üst kategori
 *
 * Hybrid Scoring Formülü:
 *   score = 0.50 * embedding_similarity
 *         + 0.30 * keyword_match
 *         + 0.20 * historical_mapping
 *
 * Real-Time Auto-Fix:
 *   confidence >= 0.85 → otomatik uygula, kullanıcıya bildir
 *   confidence >= 0.60 → öner, kullanıcı onaylasın
 *   confidence <  0.60 → queue'ya at, manuel çözüm bekle
 *
 * Öğrenen Sistem:
 *   hitCount > 3 && confidence > 0.80 → auto-map (artık sorma)
 *
 * Kullanım:
 *   const result = await resolveCategory(userId, product, marketplace);
 *   // result.resolved === true → kategori bulundu
 *   // result.category → { id, name, path }
 *   // result.confidence → 0.0 - 1.0
 *   // result.source → "exact_mapping" | "learned" | "hybrid_ai" | "fallback"
 */

const InternalCategory        = require("../models/InternalCategory");
const InternalCategoryMapping = require("../models/InternalCategoryMapping");
const UserCategoryMemory      = require("../models/UserCategoryMemory");
const UnmappedCategory        = require("../models/UnmappedCategory");
const logger                  = require("../config/logger");
const { normalize, extractMeaningfulWords } = require("../utils/textNormalize");
const { semanticMatch }       = require("./categoryEmbeddingService");
const { fuzzyMatchCategories } = require("./categoryFuzzyMatchService");

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE — InternalCategory + Mappings (5dk TTL)
// ─────────────────────────────────────────────────────────────────────────────
let _catCache = null;
let _mapCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

const _loadCache = async () => {
    if (_catCache && _mapCache && (Date.now() - _cacheTime) < CACHE_TTL) {
        return { categories: _catCache, mappings: _mapCache };
    }
    _catCache = await InternalCategory.find({ isActive: true }).lean();
    _mapCache = await InternalCategoryMapping.find({ isActive: true }).lean();
    _cacheTime = Date.now();
    logger.debug(`[RESOLVER CACHE] ${_catCache.length} kategori, ${_mapCache.length} mapping cache'lendi`);
    return { categories: _catCache, mappings: _mapCache };
};

const invalidateCache = () => {
    _catCache = null;
    _mapCache = null;
    _cacheTime = 0;
    logger.debug("[RESOLVER CACHE] Cache temizlendi");
};

const getCachedCategories = async () => {
    const { categories } = await _loadCache();
    return categories;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────
const CONFIDENCE = {
    AUTO_APPLY:  0.85,  // Otomatik uygula
    SUGGEST:     0.60,  // Öner, kullanıcı onaylasın
    AUTO_LEARN:  0.80,  // hitCount > 3 ise auto-map
    MIN_LEARN_HITS: 3   // Minimum hit sayısı auto-learn için
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: EXACT MAPPING — InternalCategoryMapping'den birebir eşleşme
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ürünün dahili kategorisini bul, sonra marketplace mapping'ini getir.
 */
const _step1_exactMapping = async (product, marketplace, categories, mappings) => {
    const productCategory = normalize(product.category || "");
    if (!productCategory) return null;

    // Dahili kategoriyi bul (isim veya keyword eşleşmesi)
    let matchedInternal = null;

    for (const ic of categories) {
        const icName = normalize(ic.name || "");
        const icKeywords = (ic.keywords || []).map(k => normalize(k));

        // Tam eşleşme
        if (productCategory === icName || icKeywords.includes(productCategory)) {
            matchedInternal = ic;
            break;
        }
    }

    if (!matchedInternal) return null;

    // Marketplace mapping'ini bul
    const mapping = mappings.find(m =>
        String(m.internalCategoryId) === String(matchedInternal._id) &&
        m.marketplace === marketplace
    );

    if (!mapping) return null;

    logger.info(
        `[RESOLVER] ✅ Step 1 EXACT: "${productCategory}" → ` +
        `${matchedInternal.name} → ${marketplace}: ${mapping.marketplaceCategoryName}`
    );

    return {
        resolved: true,
        internalCategory: matchedInternal,
        marketplaceCategory: {
            id:   mapping.marketplaceCategoryId,
            name: mapping.marketplaceCategoryName,
            path: mapping.marketplaceCategoryPath || mapping.marketplaceCategoryName
        },
        confidence: mapping.confidenceScore || 1.0,
        source: "exact_mapping",
        step: 1
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: LEARNED MAPPING — UserCategoryMemory'den öğrenilmiş eşleşme
// ─────────────────────────────────────────────────────────────────────────────

const _step2_learnedMapping = async (userId, product, marketplace, mappings) => {
    if (!userId) return null;

    const title    = normalize(product.title || product.name || "");
    const category = normalize(product.category || "");
    const brand    = normalize(product.brand || "");
    const searchText = `${title} ${category} ${brand}`;

    if (!searchText.trim()) return null;

    try {
        const memories = await UserCategoryMemory.find({ userId })
            .sort({ hitCount: -1 })
            .populate("internalCategoryId")
            .lean();

        for (const mem of memories) {
            if (!mem.pattern || !mem.internalCategoryId) continue;

            const pattern = mem.pattern.toLowerCase().trim();
            if (!pattern) continue;

            // Pattern eşleşmesi
            if (title.includes(pattern) || category.includes(pattern)) {
                // Marketplace mapping'ini bul
                const mapping = mappings.find(m =>
                    String(m.internalCategoryId) === String(mem.internalCategoryId._id) &&
                    m.marketplace === marketplace
                );

                if (!mapping) continue;

                // Güven skoru: hitCount'a göre artar
                const baseConfidence = 0.85;
                const hitBonus = Math.min(mem.hitCount * 0.01, 0.14);
                const confidence = Math.min(baseConfidence + hitBonus, 0.99);

                // hitCount artır
                await UserCategoryMemory.updateOne(
                    { _id: mem._id },
                    { $inc: { hitCount: 1 }, $set: { lastUsedAt: new Date() } }
                );

                logger.info(
                    `[RESOLVER] ✅ Step 2 LEARNED: "${pattern}" → ` +
                    `${mem.internalCategoryId.name} → ${marketplace}: ${mapping.marketplaceCategoryName} ` +
                    `(hit: ${mem.hitCount + 1}, güven: ${(confidence * 100).toFixed(0)}%)`
                );

                return {
                    resolved: true,
                    internalCategory: mem.internalCategoryId,
                    marketplaceCategory: {
                        id:   mapping.marketplaceCategoryId,
                        name: mapping.marketplaceCategoryName,
                        path: mapping.marketplaceCategoryPath || mapping.marketplaceCategoryName
                    },
                    confidence,
                    source: "learned",
                    step: 2,
                    matchedPattern: pattern
                };
            }
        }
    } catch (err) {
        logger.warn(`[RESOLVER] Step 2 hatası: ${err.message}`);
    }

    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: HYBRID AI MATCH — Embedding + Keyword + Historical
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hybrid Scoring:
 *   score = 0.50 * embedding_similarity
 *         + 0.30 * keyword_match
 *         + 0.20 * historical_mapping
 */
const _step3_hybridAI = async (userId, product, marketplace, categories, mappings) => {
    const title    = normalize(product.title || product.name || "");
    const category = normalize(product.category || "");
    const searchText = `${title} ${category}`.trim();

    if (!searchText) return null;

    // Sadece mapping'i olan dahili kategorileri al
    const mappedCatIds = new Set(
        mappings
            .filter(m => m.marketplace === marketplace)
            .map(m => String(m.internalCategoryId))
    );

    const candidateCategories = categories.filter(c => mappedCatIds.has(String(c._id)));
    if (candidateCategories.length === 0) return null;

    // ── 3a. Embedding Similarity ─────────────────────────────────────────────
    let embeddingScores = {};
    try {
        const targetForEmbedding = candidateCategories.map(c => ({
            id: String(c._id),
            name: c.name,
            path: (c.keywords || []).length > 0
                ? `${c.name} ${c.keywords.join(" ")}`
                : c.name
        }));

        const embeddingResults = await semanticMatch(searchText, targetForEmbedding, {
            limit: candidateCategories.length,
            minScore: 0.1
        });

        for (const r of embeddingResults) {
            embeddingScores[r.categoryId] = r.score;
        }
    } catch (err) {
        logger.debug(`[RESOLVER] Embedding kullanılamadı: ${err.message}`);
    }

    // ── 3b. Keyword Match Score ──────────────────────────────────────────────
    const keywordScores = {};
    for (const ic of candidateCategories) {
        const icId = String(ic._id);
        const icName = normalize(ic.name || "");
        const icKeywords = (ic.keywords || []).map(k => normalize(k));

        let kwScore = 0;

        // Kategori adı tam eşleşme
        if (category && (category === icName || icKeywords.includes(category))) {
            kwScore = 1.0;
        }
        // Kategori adı kısmi eşleşme
        else if (category && icKeywords.some(kw => category.includes(kw) || kw.includes(category))) {
            kwScore = 0.85;
        }
        // Kategori adı partial
        else if (category && (category.includes(icName) || icName.includes(category))) {
            kwScore = 0.80;
        }
        // Başlık keyword eşleşmesi
        else if (title) {
            const matchedKws = icKeywords.filter(kw => title.includes(kw));
            if (matchedKws.length > 0) {
                kwScore = Math.min(0.70 + matchedKws.length * 0.05, 0.90);
            } else if (title.includes(icName)) {
                kwScore = 0.65;
            }
        }

        if (kwScore > 0) keywordScores[icId] = kwScore;
    }

    // ── 3c. Historical Score (geçmiş mapping başarısı) ───────────────────────
    const historicalScores = {};
    if (userId) {
        try {
            const memories = await UserCategoryMemory.find({ userId }).lean();
            const titleWords = title.split(/\s+/).filter(w => w.length > 2);

            for (const mem of memories) {
                if (!mem.internalCategoryId) continue;
                const catId = String(mem.internalCategoryId);
                if (!mappedCatIds.has(catId)) continue;

                const pattern = (mem.pattern || "").toLowerCase().trim();
                if (!pattern) continue;

                // Pattern title'da geçiyor mu?
                if (title.includes(pattern) || category.includes(pattern)) {
                    const hitBonus = Math.min(mem.hitCount * 0.05, 0.4);
                    historicalScores[catId] = Math.max(
                        historicalScores[catId] || 0,
                        Math.min(0.6 + hitBonus, 1.0)
                    );
                }
                // Kelime bazlı kısmi eşleşme
                else if (titleWords.some(w => pattern.includes(w) || w.includes(pattern))) {
                    historicalScores[catId] = Math.max(
                        historicalScores[catId] || 0,
                        0.3
                    );
                }
            }
        } catch (err) {
            logger.debug(`[RESOLVER] Historical score hatası: ${err.message}`);
        }
    }

    // ── 3d. HYBRID SCORE HESAPLA ─────────────────────────────────────────────
    const hybridResults = [];
    const W_EMBEDDING   = 0.50;
    const W_KEYWORD     = 0.30;
    const W_HISTORICAL  = 0.20;

    for (const ic of candidateCategories) {
        const icId = String(ic._id);

        const embScore  = embeddingScores[icId]  || 0;
        const kwScore   = keywordScores[icId]    || 0;
        const histScore = historicalScores[icId]  || 0;

        // En az bir skor olmalı
        if (embScore === 0 && kwScore === 0 && histScore === 0) continue;

        // Embedding yoksa ağırlıkları yeniden dağıt
        let finalScore;
        if (embScore > 0) {
            finalScore = W_EMBEDDING * embScore + W_KEYWORD * kwScore + W_HISTORICAL * histScore;
        } else {
            // Embedding yoksa: keyword %60, historical %40
            finalScore = 0.60 * kwScore + 0.40 * histScore;
        }

        if (finalScore > 0.1) {
            hybridResults.push({
                internalCategory: ic,
                score: Math.round(finalScore * 100) / 100,
                breakdown: {
                    embedding:  Math.round(embScore * 100) / 100,
                    keyword:    Math.round(kwScore * 100) / 100,
                    historical: Math.round(histScore * 100) / 100
                }
            });
        }
    }

    if (hybridResults.length === 0) return null;

    // En iyi sonucu al
    hybridResults.sort((a, b) => b.score - a.score);
    const best = hybridResults[0];

    // Marketplace mapping'ini bul
    const mapping = mappings.find(m =>
        String(m.internalCategoryId) === String(best.internalCategory._id) &&
        m.marketplace === marketplace
    );

    if (!mapping) return null;

    logger.info(
        `[RESOLVER] ✅ Step 3 HYBRID: "${searchText.substring(0, 50)}" → ` +
        `${best.internalCategory.name} → ${marketplace}: ${mapping.marketplaceCategoryName} ` +
        `(skor: ${best.score}, emb: ${best.breakdown.embedding}, kw: ${best.breakdown.keyword}, hist: ${best.breakdown.historical})`
    );

    return {
        resolved: true,
        internalCategory: best.internalCategory,
        marketplaceCategory: {
            id:   mapping.marketplaceCategoryId,
            name: mapping.marketplaceCategoryName,
            path: mapping.marketplaceCategoryPath || mapping.marketplaceCategoryName
        },
        confidence: best.score,
        source: "hybrid_ai",
        step: 3,
        breakdown: best.breakdown,
        alternatives: hybridResults.slice(1, 4).map(r => ({
            name: r.internalCategory.name,
            score: r.score,
            breakdown: r.breakdown
        }))
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: FALLBACK — Parent kategori veya en yakın üst kategori
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tam eşleşme bulunamazsa → en yakın parent kategoriyi kullan.
 * Ürün en azından yüklenir, yanlış kategoride olsa bile.
 *
 * Strateji:
 *   1. Fuzzy match ile en yakın dahili kategoriyi bul
 *   2. O kategorinin parent'ını bul
 *   3. Parent'ın marketplace mapping'ini kullan
 *   4. Hiçbiri yoksa → en genel kategoriyi kullan
 */
const _step4_fallback = async (product, marketplace, categories, mappings) => {
    const category = normalize(product.category || "");
    const title    = normalize(product.title || product.name || "");
    const searchText = `${category} ${title}`.trim();

    if (!searchText) return null;

    // Mapping'i olan kategoriler
    const mappedCatIds = new Set(
        mappings
            .filter(m => m.marketplace === marketplace)
            .map(m => String(m.internalCategoryId))
    );

    // ── 4a. Fuzzy match ile en yakın dahili kategoriyi bul ───────────────────
    const targetForFuzzy = categories
        .filter(c => mappedCatIds.has(String(c._id)))
        .map(c => ({
            id: String(c._id),
            name: c.name,
            path: c.name
        }));

    if (targetForFuzzy.length === 0) return null;

    const fuzzyResults = fuzzyMatchCategories(searchText, targetForFuzzy, {
        limit: 3,
        minScore: 0.15
    });

    // ── 4b. Fuzzy sonucu varsa → mapping'ini bul ────────────────────────────
    for (const fuzzy of fuzzyResults) {
        const mapping = mappings.find(m =>
            String(m.internalCategoryId) === fuzzy.categoryId &&
            m.marketplace === marketplace
        );

        if (mapping) {
            const ic = categories.find(c => String(c._id) === fuzzy.categoryId);

            logger.info(
                `[RESOLVER] ⚠️ Step 4 FALLBACK (fuzzy): "${searchText.substring(0, 50)}" → ` +
                `${ic?.name || "?"} → ${marketplace}: ${mapping.marketplaceCategoryName} ` +
                `(fuzzy skor: ${fuzzy.score})`
            );

            return {
                resolved: true,
                internalCategory: ic,
                marketplaceCategory: {
                    id:   mapping.marketplaceCategoryId,
                    name: mapping.marketplaceCategoryName,
                    path: mapping.marketplaceCategoryPath || mapping.marketplaceCategoryName
                },
                confidence: Math.round(fuzzy.score * 0.7 * 100) / 100, // Fallback → düşük güven
                source: "fallback_fuzzy",
                step: 4,
                isFallback: true
            };
        }
    }

    // ── 4c. Parent kategori fallback ─────────────────────────────────────────
    // Herhangi bir keyword kısmi eşleşmesi olan kategorinin parent'ını bul
    for (const ic of categories) {
        if (!ic.parentId || !mappedCatIds.has(String(ic._id))) continue;

        const icKeywords = (ic.keywords || []).map(k => normalize(k));
        const icName = normalize(ic.name || "");

        const hasPartialMatch = icKeywords.some(kw =>
            searchText.includes(kw) || kw.includes(category)
        ) || searchText.includes(icName);

        if (!hasPartialMatch) continue;

        // Parent'ın mapping'ini bul
        const parentMapping = mappings.find(m =>
            String(m.internalCategoryId) === String(ic.parentId) &&
            m.marketplace === marketplace
        );

        if (parentMapping) {
            const parentCat = categories.find(c => String(c._id) === String(ic.parentId));

            logger.info(
                `[RESOLVER] ⚠️ Step 4 FALLBACK (parent): "${searchText.substring(0, 50)}" → ` +
                `parent: ${parentCat?.name || "?"} → ${marketplace}: ${parentMapping.marketplaceCategoryName}`
            );

            return {
                resolved: true,
                internalCategory: parentCat || ic,
                marketplaceCategory: {
                    id:   parentMapping.marketplaceCategoryId,
                    name: parentMapping.marketplaceCategoryName,
                    path: parentMapping.marketplaceCategoryPath || parentMapping.marketplaceCategoryName
                },
                confidence: 0.35,
                source: "fallback_parent",
                step: 4,
                isFallback: true
            };
        }
    }

    return null;
};

// ═════════════════════════════════════════════════════════════════════════════
// ANA FONKSİYON: resolveCategory — Unified Pipeline
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Ürün için kategori çözümle — 4 adımlı pipeline.
 *
 * @param {string} userId
 * @param {Object} product - { title, name, category, brand, description }
 * @param {string} marketplace - "Trendyol" | "N11" | "Hepsiburada" | "Amazon" | "ÇiçekSepeti"
 * @param {Object} [options]
 * @param {boolean} [options.autoApply=true] - confidence >= 0.85 ise otomatik uygula
 * @param {boolean} [options.saveLearning=true] - Başarılı eşleşmeleri öğren
 * @returns {Promise<Object>} - Resolution result
 */
const resolveCategory = async (userId, product, marketplace, options = {}) => {
    const { autoApply = true, saveLearning = true } = options;
    const startTime = Date.now();

    // Cache yükle
    const { categories, mappings } = await _loadCache();

    // ── Step 1: Exact Mapping ────────────────────────────────────────────────
    const step1 = await _step1_exactMapping(product, marketplace, categories, mappings);
    if (step1) {
        return { ...step1, resolveTime: Date.now() - startTime };
    }

    // ── Step 2: Learned Mapping ──────────────────────────────────────────────
    const step2 = await _step2_learnedMapping(userId, product, marketplace, mappings);
    if (step2) {
        return { ...step2, resolveTime: Date.now() - startTime };
    }

    // ── Step 3: Hybrid AI Match ──────────────────────────────────────────────
    const step3 = await _step3_hybridAI(userId, product, marketplace, categories, mappings);
    if (step3) {
        // Auto-apply: confidence >= 0.85 → otomatik kullan
        if (autoApply && step3.confidence >= CONFIDENCE.AUTO_APPLY) {
            logger.info(
                `[RESOLVER] 🚀 AUTO-APPLY: güven ${(step3.confidence * 100).toFixed(0)}% >= ${CONFIDENCE.AUTO_APPLY * 100}% → otomatik uygulandı`
            );

            // Öğren: başarılı eşleşmeyi kaydet
            if (saveLearning) {
                await _learnFromResolution(userId, product, step3);
            }

            return { ...step3, autoApplied: true, resolveTime: Date.now() - startTime };
        }

        // Suggest: confidence >= 0.60 → öner
        if (step3.confidence >= CONFIDENCE.SUGGEST) {
            return { ...step3, autoApplied: false, resolveTime: Date.now() - startTime };
        }
    }

    // ── Step 4: Fallback ─────────────────────────────────────────────────────
    const step4 = await _step4_fallback(product, marketplace, categories, mappings);
    if (step4) {
        return { ...step4, resolveTime: Date.now() - startTime };
    }

    // ── Hiçbiri bulunamadı → Unmapped olarak kaydet ──────────────────────────
    logger.warn(
        `[RESOLVER] ❌ Çözülemedi: "${(product.category || product.title || "?").substring(0, 60)}" → ${marketplace}`
    );

    // Unmapped kaydet (suggestions ile birlikte)
    const suggestions = step3 ? [
        {
            name: step3.internalCategory?.name,
            categoryId: String(step3.internalCategory?._id),
            score: step3.confidence,
            matchReason: "hybrid_ai"
        },
        ...(step3.alternatives || []).map(a => ({
            name: a.name,
            score: a.score,
            matchReason: "hybrid_ai_alt"
        }))
    ] : [];

    await _saveUnmapped(userId, product, marketplace, suggestions);

    return {
        resolved: false,
        internalCategory: null,
        marketplaceCategory: null,
        confidence: step3 ? step3.confidence : 0,
        source: "unresolved",
        step: 0,
        suggestions,
        resolveTime: Date.now() - startTime
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// ÖĞRENME: Başarılı çözümlemeden keyword öğren
// ─────────────────────────────────────────────────────────────────────────────

const _learnFromResolution = async (userId, product, result) => {
    if (!userId || !result.internalCategory) return;

    try {
        const title = (product.title || product.name || "").trim();
        const category = (product.category || "").trim();

        // Kategori adını pattern olarak kaydet
        if (category) {
            await UserCategoryMemory.findOneAndUpdate(
                { userId, pattern: category.toLowerCase().trim() },
                {
                    $set: {
                        internalCategoryId: result.internalCategory._id,
                        source: "auto_learned",
                        lastUsedAt: new Date()
                    },
                    $inc: { hitCount: 1 },
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );
        }

        // Başlıktan anlamlı kelimeleri öğren
        const meaningfulWords = extractMeaningfulWords(title);
        for (const word of meaningfulWords.slice(0, 3)) {
            if (word.length < 3) continue;
            await UserCategoryMemory.findOneAndUpdate(
                { userId, pattern: word },
                {
                    $set: {
                        internalCategoryId: result.internalCategory._id,
                        source: "auto_learned",
                        lastUsedAt: new Date()
                    },
                    $inc: { hitCount: 1 },
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );
        }

        logger.debug(`[RESOLVER] 🧠 Öğrenildi: "${category || title.substring(0, 30)}" → ${result.internalCategory.name}`);
    } catch (err) {
        logger.debug(`[RESOLVER] Öğrenme hatası: ${err.message}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UNMAPPED KAYDET
// ─────────────────────────────────────────────────────────────────────────────

const _saveUnmapped = async (userId, product, marketplace, suggestions = []) => {
    if (!userId) return;

    const categoryName = (product.category || product.title || "").trim();
    if (!categoryName) return;

    try {
        const sampleTitle = (product.title || product.name || "").trim();

        await UnmappedCategory.findOneAndUpdate(
            { userId, categoryName, targetMarketplace: marketplace },
            {
                $set: {
                    source: product.source || "Trendyol",
                    lastSeenAt: new Date(),
                    suggestedCategories: suggestions.slice(0, 5),
                    isResolved: false
                },
                $inc: { hitCount: 1 },
                $setOnInsert: { detectedAt: new Date() },
                $addToSet: sampleTitle ? { sampleProducts: { $each: [sampleTitle] } } : {}
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        if (err.code !== 11000) {
            logger.warn(`[RESOLVER] Unmapped kaydetme hatası: ${err.message}`);
        }
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// TOPLU ÇÖZÜMLEME — Batch resolve
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Birden fazla ürün için toplu kategori çözümleme.
 *
 * @param {string} userId
 * @param {Array<Object>} products
 * @param {string} marketplace
 * @returns {Promise<Object>} - { results, stats }
 */
const batchResolve = async (userId, products, marketplace) => {
    const results = [];
    let resolved = 0, fallback = 0, unresolved = 0, autoApplied = 0;

    for (const product of products) {
        const result = await resolveCategory(userId, product, marketplace);
        results.push({ product, ...result });

        if (result.resolved) {
            resolved++;
            if (result.autoApplied) autoApplied++;
            if (result.isFallback) fallback++;
        } else {
            unresolved++;
        }
    }

    const stats = {
        total: products.length,
        resolved,
        fallback,
        unresolved,
        autoApplied,
        successRate: products.length > 0 ? Math.round((resolved / products.length) * 100) : 0
    };

    logger.info(
        `[RESOLVER] Batch: ${stats.total} ürün → ` +
        `${stats.resolved} çözüldü (${stats.autoApplied} auto), ` +
        `${stats.fallback} fallback, ${stats.unresolved} çözülemedi ` +
        `(başarı: %${stats.successRate})`
    );

    return { results, stats };
};

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    resolveCategory,
    batchResolve,
    invalidateCache,
    getCachedCategories,
    CONFIDENCE
};
