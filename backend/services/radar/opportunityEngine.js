/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OPPORTUNITY ENGINE — LysiaRadar PRO (Ana Sistem)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tüm servisleri orkestra eden ana motor.
 *
 * AKIŞ:
 *   1. Keyword çıkar (keywordService)
 *   2. Her keyword için:
 *      a. Trend verisi çek (trendService)
 *      b. Pazar verisi çek (marketplaceDataService)
 *      c. Skorla (scoringService)
 *      d. AI açıklama üret (explanationService)
 *   3. Kullanıcıya göre filtrele ve sırala
 *   4. DB'ye kaydet (OpportunityResult)
 *   5. Cache'le
 *
 * OPTİMİZASYON:
 *   - Max 15 keyword analiz edilir (rate limit)
 *   - Her keyword arası 3s bekleme (Trendyol rate limit)
 *   - Sonuçlar 6 saat cache'lenir
 *   - Düşük kaliteli veriler filtrelenir
 *   - Max 10 fırsat kullanıcıya sunulur
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const OpportunityResult = require("../../models/OpportunityResult");
const keywordService = require("./keywordService");
const trendService = require("./trendService");
const marketplaceDataService = require("./marketplaceDataService");
const scoringService = require("./scoringService");
const explanationService = require("./explanationService");

// ── Konfigürasyon ──
const MAX_KEYWORDS = 15;           // Analiz edilecek max keyword
const KEYWORD_DELAY_MS = 3000;     // Keyword'ler arası bekleme (ms)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat cache
const MIN_SCORE_THRESHOLD = 25;    // Bu skorun altındaki fırsatlar filtrelenir
const MAX_OPPORTUNITIES = 10;      // Kullanıcıya sunulacak max fırsat
const EXPIRY_DAYS = 3;             // Fırsat kaç gün sonra expire olur

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Kullanıcı için fırsat analizi çalıştır
 * @param {string} userId
 * @param {object} [opts] - { forceRefresh, maxKeywords }
 * @returns {Promise<object>} { opportunities, stats, fromCache }
 */
async function analyzeOpportunities(userId, opts = {}) {
    const startTime = Date.now();
    const forceRefresh = opts.forceRefresh === true;
    const maxKeywords = opts.maxKeywords || MAX_KEYWORDS;

    try {
        // ── 1. Cache kontrolü ──
        if (!forceRefresh) {
            const cached = await getCachedOpportunities(userId);
            if (cached) {
                logger.debug(`[OpportunityEngine] Cache hit — user ${String(userId).slice(-6)}`);
                return { ...cached, fromCache: true };
            }
        }

        logger.info(`[OpportunityEngine] 🔍 Fırsat analizi başlıyor — user ${String(userId).slice(-6)}`);

        // ── 2. Kullanıcı verisi çek ──
        const userData = await marketplaceDataService.getUserSalesData(userId);

        // ── 3. Keyword'leri çıkar ──
        const keywordData = await keywordService.extractKeywords(userId);
        const keywords = keywordData.allKeywords.slice(0, maxKeywords);

        if (keywords.length === 0) {
            logger.warn(`[OpportunityEngine] Keyword bulunamadı — user ${String(userId).slice(-6)}`);
            return {
                opportunities: [],
                stats: { analyzed: 0, filtered: 0, total: 0, durationMs: Date.now() - startTime },
                fromCache: false,
            };
        }

        logger.info(`[OpportunityEngine] ${keywords.length} keyword analiz edilecek: ${keywords.slice(0, 5).join(", ")}...`);

        // ── 4. Her keyword için veri topla + skorla ──
        const rawOpportunities = [];
        let analyzedCount = 0;

        for (const keyword of keywords) {
            try {
                // 4a. Trend verisi
                const trendData = await trendService.getKeywordTrend(keyword);

                // Rate limit bekleme
                await sleep(KEYWORD_DELAY_MS);

                // 4b. Pazar verisi
                const marketData = await marketplaceDataService.getMarketplaceData(keyword);

                // 4c. Boş veri kontrolü — pazar verisi yoksa atla
                if (marketData.totalProducts === 0 && trendData.trendScore === 0) {
                    logger.debug(`[OpportunityEngine] Boş veri, atlanıyor: "${keyword}"`);
                    continue;
                }

                // 4d. Skorla
                const category = detectCategory(keyword, keywordData.userCategories);
                const { scores, totalScore, profitAnalysis } = scoringService.calculateScores({
                    trendData,
                    marketData,
                    userData,
                    keyword,
                    category,
                });

                // 4e. Minimum skor filtresi
                if (totalScore < MIN_SCORE_THRESHOLD) {
                    logger.debug(`[OpportunityEngine] Düşük skor (${totalScore}), atlanıyor: "${keyword}"`);
                    continue;
                }

                // 4f. Genişleme tipi belirle
                const expansionType = determineExpansionType(keyword, category, keywordData, trendData);

                // 4g. AI açıklama üret
                const explanation = explanationService.generateExplanation({
                    keyword, category, scores, totalScore,
                    trendData, marketData, profitAnalysis, userData, expansionType,
                });

                rawOpportunities.push({
                    keyword,
                    category,
                    source: determineSource(keyword, keywordData, trendData),
                    marketData,
                    trendData: {
                        trendScore: trendData.trendScore,
                        trendDirection: trendData.trendDirection,
                        searchVolume: trendData.searchVolume,
                        weeklyChange: trendData.weeklyChange,
                        monthlyChange: trendData.monthlyChange,
                        seasonality: trendData.seasonality,
                        relatedKeywords: (trendData.relatedKeywords || []).slice(0, 10),
                    },
                    scores,
                    totalScore,
                    profitAnalysis,
                    aiExplanation: explanation.explanation,
                    aiRisks: explanation.risks,
                    aiBenefits: explanation.benefits,
                    aiConfidence: explanation.confidence,
                    userFitReason: explanation.userFitReason,
                    relatedUserCategories: keywordData.userCategories.slice(0, 5),
                    expansionType,
                });

                analyzedCount++;
                logger.debug(`[OpportunityEngine] ✅ "${keyword}" — skor: ${totalScore}`);

                // Rate limit bekleme
                if (keywords.indexOf(keyword) < keywords.length - 1) {
                    await sleep(KEYWORD_DELAY_MS);
                }
            } catch (kwErr) {
                logger.warn(`[OpportunityEngine] Keyword hatası "${keyword}": ${kwErr.message}`);
            }
        }

        // ── 5. Sırala ve filtrele ──
        const sorted = rawOpportunities
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, MAX_OPPORTUNITIES);

        // ── 6. DB'ye kaydet ──
        const savedOpportunities = [];
        for (const opp of sorted) {
            try {
                const saved = await OpportunityResult.findOneAndUpdate(
                    { userId, keyword: opp.keyword },
                    {
                        $set: {
                            ...opp,
                            userId,
                            status: "active",
                            dataFreshness: new Date(),
                            expiresAt: new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000),
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                savedOpportunities.push(saved);
            } catch (saveErr) {
                logger.warn(`[OpportunityEngine] Kaydetme hatası "${opp.keyword}": ${saveErr.message}`);
            }
        }

        // ── 7. Eski fırsatları expire et ──
        try {
            await OpportunityResult.updateMany(
                {
                    userId,
                    status: "active",
                    keyword: { $nin: sorted.map(o => o.keyword) },
                    dataFreshness: { $lt: new Date(Date.now() - CACHE_TTL_MS) },
                },
                { $set: { status: "expired" } }
            );
        } catch (e) { /* ignore */ }

        const durationMs = Date.now() - startTime;
        const stats = {
            analyzed: analyzedCount,
            filtered: analyzedCount - sorted.length,
            total: sorted.length,
            durationMs,
            keywordsTotal: keywords.length,
        };

        logger.info(
            `[OpportunityEngine] ✅ Fırsat analizi tamamlandı — user ${String(userId).slice(-6)} — ` +
            `${stats.total} fırsat, ${stats.analyzed} analiz, ${(durationMs / 1000).toFixed(1)}s`
        );

        return {
            opportunities: savedOpportunities,
            stats,
            fromCache: false,
        };
    } catch (err) {
        logger.error(`[OpportunityEngine] Genel hata (${userId}): ${err.message}`);
        // Hata durumunda cache'den dön
        const cached = await getCachedOpportunities(userId, true);
        if (cached) return { ...cached, fromCache: true, error: err.message };
        return {
            opportunities: [],
            stats: { analyzed: 0, filtered: 0, total: 0, durationMs: Date.now() - startTime, error: err.message },
            fromCache: false,
        };
    }
}

/**
 * Cache'den fırsatları oku
 */
async function getCachedOpportunities(userId, ignoreAge = false) {
    try {
        const query = { userId, status: "active" };
        if (!ignoreAge) {
            query.dataFreshness = { $gte: new Date(Date.now() - CACHE_TTL_MS) };
        }

        const opportunities = await OpportunityResult.find(query)
            .sort({ totalScore: -1 })
            .limit(MAX_OPPORTUNITIES)
            .lean();

        if (opportunities.length === 0) return null;

        return {
            opportunities,
            stats: {
                total: opportunities.length,
                analyzed: opportunities.length,
                filtered: 0,
                durationMs: 0,
                cachedAt: opportunities[0]?.dataFreshness,
            },
        };
    } catch (err) {
        return null;
    }
}

/**
 * Kullanıcının fırsatlarını getir (API endpoint için)
 * @param {string} userId
 * @param {object} [filters] - { category, minScore, sortBy, expansionType }
 * @returns {Promise<object>}
 */
async function getOpportunities(userId, filters = {}) {
    const query = { userId, status: "active" };

    if (filters.category) {
        query.category = { $regex: filters.category, $options: "i" };
    }
    if (filters.minScore) {
        query.totalScore = { $gte: parseInt(filters.minScore) };
    }
    if (filters.expansionType) {
        query.expansionType = filters.expansionType;
    }

    let sortField = { totalScore: -1 }; // default: en yüksek skor
    if (filters.sortBy === "trend") sortField = { "scores.trend": -1 };
    else if (filters.sortBy === "profit") sortField = { "scores.profit": -1 };
    else if (filters.sortBy === "competition") sortField = { "scores.competition": -1 };
    else if (filters.sortBy === "newest") sortField = { createdAt: -1 };

    const opportunities = await OpportunityResult.find(query)
        .sort(sortField)
        .limit(MAX_OPPORTUNITIES)
        .lean();

    return opportunities;
}

/**
 * Fırsat aksiyonu kaydet (görüntüleme, simülasyon, ekleme, reddetme)
 */
async function recordAction(userId, opportunityId, action) {
    const validActions = ["viewed", "simulated", "added_to_store", "dismissed"];
    if (!validActions.includes(action)) return null;

    const update = {
        userAction: action,
        userActionAt: new Date(),
    };

    if (action === "dismissed") {
        update.status = "dismissed";
    } else if (action === "added_to_store") {
        update.status = "acted";
    }

    return OpportunityResult.findOneAndUpdate(
        { _id: opportunityId, userId },
        { $set: update },
        { new: true }
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═════════════════════════════════════════════════════════════════════════════

function detectCategory(keyword, userCategories) {
    const kwLower = keyword.toLowerCase();

    // Kullanıcının kategorilerinden eşleşme ara
    for (const cat of userCategories) {
        const catLower = cat.toLowerCase();
        const catWords = catLower.split(/[\s>/]+/).filter(w => w.length > 2);
        if (catWords.some(w => kwLower.includes(w))) {
            return cat;
        }
    }

    // Genel kategori tespiti
    const categoryMap = {
        "elektronik": ["telefon", "kulaklık", "tablet", "laptop", "powerbank", "saat", "hoparlör", "kamera"],
        "giyim": ["elbise", "tişört", "pantolon", "ceket", "mont", "kazak", "gömlek", "etek"],
        "ayakkabı": ["ayakkabı", "sneaker", "bot", "sandalet", "terlik", "babet"],
        "kozmetik": ["ruj", "fondöten", "parfüm", "krem", "serum", "şampuan", "makyaj"],
        "ev & yaşam": ["halı", "perde", "nevresim", "yastık", "mutfak", "dekorasyon"],
        "aksesuar": ["çanta", "cüzdan", "saat", "gözlük", "bileklik", "kolye", "küpe"],
        "spor": ["eşofman", "yoga", "fitness", "koşu", "bisiklet", "kamp"],
    };

    for (const [cat, words] of Object.entries(categoryMap)) {
        if (words.some(w => kwLower.includes(w))) return cat;
    }

    return "Genel";
}

function determineExpansionType(keyword, category, keywordData, trendData) {
    const userCats = (keywordData.userCategories || []).map(c => c.toLowerCase());
    const catLower = (category || "").toLowerCase();

    // Aynı kategori mi?
    if (userCats.some(c => c === catLower || c.includes(catLower) || catLower.includes(c))) {
        return "same_category";
    }

    // Yakın kategori mi?
    const catWords = catLower.split(/[\s>/]+/).filter(w => w.length > 2);
    const hasOverlap = userCats.some(c => {
        const words = c.split(/[\s>/]+/).filter(w => w.length > 2);
        return words.some(w => catWords.includes(w));
    });
    if (hasOverlap) return "adjacent_category";

    // Trend mi?
    if (trendData && trendData.trendScore >= 70) return "trending";

    return "new_category";
}

function determineSource(keyword, keywordData, trendData) {
    if (keywordData.userKeywords?.includes(keyword)) return "user_data";
    if (keywordData.trendKeywords?.includes(keyword)) return "trend";
    if (keywordData.evergreenKeywords?.includes(keyword)) return "ai_discovery";
    if (trendData?.trendScore >= 70) return "trend";
    if (keywordData.categoryKeywords?.includes(keyword)) return "marketplace";
    return "marketplace";
}

module.exports = {
    analyzeOpportunities,
    getOpportunities,
    getCachedOpportunities,
    recordAction,
    MAX_OPPORTUNITIES,
    CACHE_TTL_MS,
};
