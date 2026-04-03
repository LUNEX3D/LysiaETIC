/**
 * KATEGORİ FUZZY EŞLEŞTİRME SERVİSİ
 *
 * Pazaryerleri arası kategori eşleştirmesi için fuzzy string matching.
 * Levenshtein distance, Jaccard similarity ve keyword matching kullanır.
 *
 * Kullanım:
 *   fuzzyMatchCategories("Cep Telefonu", targetCategories) → [{ name, score, ... }]
 */

const logger = require("../config/logger");
const { normalize } = require("../utils/textNormalize");

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Levenshtein Distance
// ─────────────────────────────────────────────────────────────────────────────
const levenshtein = (a, b) => {
    if (!a || !b) return Math.max((a || "").length, (b || "").length);
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
};

// Levenshtein similarity (0-1)
const levenshteinSimilarity = (a, b) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na && !nb) return 1;
    if (!na || !nb) return 0;
    const dist = levenshtein(na, nb);
    const maxLen = Math.max(na.length, nb.length);
    return maxLen === 0 ? 1 : 1 - (dist / maxLen);
};

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Jaccard Similarity (kelime bazlı)
// ─────────────────────────────────────────────────────────────────────────────
const jaccardSimilarity = (a, b) => {
    const setA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 1));
    const setB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 1));
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const w of setA) {
        if (setB.has(w)) intersection++;
    }
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
};

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Kelime içerme skoru
// ─────────────────────────────────────────────────────────────────────────────
const wordContainmentScore = (source, target) => {
    const sourceWords = normalize(source).split(/\s+/).filter(w => w.length > 1);
    const targetWords = normalize(target).split(/\s+/).filter(w => w.length > 1);
    if (sourceWords.length === 0) return 0;

    let matchCount = 0;
    for (const sw of sourceWords) {
        for (const tw of targetWords) {
            if (tw === sw) { matchCount += 1; break; }
            if (tw.includes(sw) || sw.includes(tw)) { matchCount += 0.7; break; }
        }
    }
    return matchCount / sourceWords.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Yaprak kategori adı çıkar
// "Elektronik > Telefon > Akıllı Telefon" → "Akıllı Telefon"
// ─────────────────────────────────────────────────────────────────────────────
const getLeafName = (pathOrName) => {
    if (!pathOrName) return "";
    const parts = pathOrName.split(/\s*[>→]\s*/);
    return (parts[parts.length - 1] || "").trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// ANA FONKSİYON: Fuzzy Match
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kaynak kategori adını hedef kategori listesiyle fuzzy eşleştir.
 *
 * @param {string} sourceName — Kaynak kategori adı (örn: "Cep Telefonu")
 * @param {Array<{ id, name, path }>} targetCategories — Hedef platform kategorileri
 * @param {Object} [options]
 * @param {number} [options.limit=5] — Maksimum sonuç sayısı
 * @param {number} [options.minScore=0.15] — Minimum skor eşiği
 * @returns {Array<{ categoryId, categoryName, categoryPath, score, matchMethod }>}
 */
const fuzzyMatchCategories = (sourceName, targetCategories, options = {}) => {
    const { limit = 5, minScore = 0.15 } = options;

    if (!sourceName || !targetCategories || targetCategories.length === 0) {
        return [];
    }

    const sourceNorm = normalize(sourceName);
    const sourceLeaf = normalize(getLeafName(sourceName));

    const scored = [];

    for (const cat of targetCategories) {
        const catName = cat.name || "";
        const catPath = cat.path || catName;
        const catNorm = normalize(catName);
        const catPathNorm = normalize(catPath);
        const catLeaf = normalize(getLeafName(catPath));

        // 1. Tam eşleşme (yaprak isim)
        if (sourceLeaf && catLeaf && sourceLeaf === catLeaf) {
            scored.push({
                categoryId: String(cat.id),
                categoryName: catName,
                categoryPath: catPath,
                score: 0.98,
                matchMethod: "exact_leaf"
            });
            continue;
        }

        // 2. Tam eşleşme (tam isim)
        if (sourceNorm === catNorm) {
            scored.push({
                categoryId: String(cat.id),
                categoryName: catName,
                categoryPath: catPath,
                score: 0.97,
                matchMethod: "exact_name"
            });
            continue;
        }

        // 3. Birleşik skor hesapla
        const levSimName = levenshteinSimilarity(sourceLeaf || sourceNorm, catLeaf || catNorm);
        const levSimPath = levenshteinSimilarity(sourceNorm, catPathNorm);
        const jaccardName = jaccardSimilarity(sourceNorm, catNorm);
        const jaccardPath = jaccardSimilarity(sourceNorm, catPathNorm);
        const containName = wordContainmentScore(sourceNorm, catNorm);
        const containPath = wordContainmentScore(sourceNorm, catPathNorm);

        // Ağırlıklı birleşik skor
        const combinedScore =
            levSimName   * 0.25 +
            levSimPath   * 0.10 +
            jaccardName  * 0.20 +
            jaccardPath  * 0.10 +
            containName  * 0.20 +
            containPath  * 0.15;

        if (combinedScore >= minScore) {
            // En iyi eşleşme yöntemini belirle
            let matchMethod = "fuzzy_combined";
            if (containName >= 0.8) matchMethod = "keyword_match";
            else if (levSimName >= 0.8) matchMethod = "name_similarity";
            else if (jaccardPath >= 0.5) matchMethod = "path_similarity";

            scored.push({
                categoryId: String(cat.id),
                categoryName: catName,
                categoryPath: catPath,
                score: Math.round(combinedScore * 100) / 100,
                matchMethod
            });
        }
    }

    // Skora göre sırala, limit uygula
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
};

// ─────────────────────────────────────────────────────────────────────────────
// TOPLU EŞLEŞTİRME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Birden fazla kaynak kategoriyi hedef listesiyle toplu eşleştir.
 *
 * @param {Array<{ id, name }>} sourceCategories
 * @param {Array<{ id, name, path }>} targetCategories
 * @param {Object} [options]
 * @returns {Array<{ sourceId, sourceName, matches: Array }>}
 */
const bulkFuzzyMatch = (sourceCategories, targetCategories, options = {}) => {
    const results = [];

    for (const src of sourceCategories) {
        const matches = fuzzyMatchCategories(src.name, targetCategories, options);
        results.push({
            sourceId: src.id || src._id,
            sourceName: src.name,
            matches
        });
    }

    const matched = results.filter(r => r.matches.length > 0).length;
    const unmatched = results.filter(r => r.matches.length === 0).length;

    logger.info(
        `[FUZZY MATCH] Toplu eşleştirme: ${sourceCategories.length} kaynak → ` +
        `${matched} eşleşti, ${unmatched} eşleşmedi`
    );

    return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORİ ÇÖZÜMLEME — Ürün dağıtımında kullanılır
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir ürünün dahili kategorisinden hedef platform kategorisini çözümle.
 * InternalCategoryMapping tablosundan bakar.
 *
 * @param {string} internalCategoryId — Dahili kategori ID
 * @param {string} targetMarketplace — Hedef pazaryeri adı
 * @returns {Promise<{ categoryId, categoryName, categoryPath, source } | null>}
 */
const resolveProductCategory = async (internalCategoryId, targetMarketplace) => {
    if (!internalCategoryId || !targetMarketplace) return null;

    const InternalCategoryMapping = require("../models/InternalCategoryMapping");

    const mapping = await InternalCategoryMapping.findOne({
        internalCategoryId,
        marketplace: targetMarketplace,
        isActive: true
    }).lean();

    if (!mapping) {
        logger.debug(
            `[CATEGORY RESOLVE] Eşleşme bulunamadı: ` +
            `dahili=${internalCategoryId} → ${targetMarketplace}`
        );
        return null;
    }

    return {
        categoryId: mapping.marketplaceCategoryId,
        categoryName: mapping.marketplaceCategoryName,
        categoryPath: mapping.marketplaceCategoryPath || "",
        source: mapping.matchSource || "manual",
        confidenceScore: mapping.confidenceScore || 1.0
    };
};

module.exports = {
    normalize,
    levenshteinSimilarity,
    jaccardSimilarity,
    wordContainmentScore,
    getLeafName,
    fuzzyMatchCategories,
    bulkFuzzyMatch,
    resolveProductCategory
};

// NOT: crossPlatformMatch controller tarafında fetchPlatformCategories ile birlikte çalışır
