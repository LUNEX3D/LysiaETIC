/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OPPORTUNITY ENGINE — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tüm servisleri orkestra eden ana motor.
 *
 * AKIŞ:
 *   1. Keyword çıkar (keywordService) — Google Trends + Amazon + kullanıcı
 *   2. Her keyword için paralel:
 *      a. Trend verisi çek (trendService) — Google + Sosyal + Amazon + Trendyol
 *      b. Pazar verisi çek (marketplaceDataService) — Trendyol + Amazon çapraz
 *      c. Skorla (scoringService) — 7 boyutlu skor
 *      d. AI açıklama üret (explanationService) — zenginleştirilmiş
 *   3. Kullanıcıya göre filtrele ve sırala
 *   4. DB'ye kaydet (OpportunityResult)
 *   5. Cache'le
 *
 * OPTİMİZASYON:
 *   - Max 20 keyword analiz edilir (artırıldı)
 *   - Her keyword arası 2s bekleme (paralel veri toplama sayesinde azaltıldı)
 *   - Sonuçlar 6 saat cache'lenir
 *   - Düşük kaliteli veriler filtrelenir
 *   - Max 15 fırsat kullanıcıya sunulur (artırıldı)
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
const { hashString32, deterministicShuffle, classifyNicheCluster } = require("./keywordService");
const {
    pickDiverseOpportunities,
    getClusterLabel,
} = require("./nicheClusterService");

// ── Konfigürasyon ──
const MAX_KEYWORDS = 24;           // Tek analizde taranan keyword
const KEYWORD_DELAY_MS = 3200;     // Keyword'ler arası bekleme (SerpAPI / harici API)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat cache (yeniden tarama)
const DISPLAY_ROTATION_MS = 3 * 60 * 60 * 1000; // 3 saatte bir farklı 15'lik set
const MIN_SCORE_THRESHOLD = 25;    // Bu skorun altındaki fırsatlar filtrelenir
const MAX_OPPORTUNITIES = 15;      // Ekranda gösterilen fırsat sayısı
const OPPORTUNITY_POOL_SIZE = 36;  // DB'de tutulan aday havuzu (rotasyon için)
const EXPIRY_DAYS = 5;             // Fırsat kaç gün sonra expire olur
const DISMISS_COOLDOWN_DAYS = 14;  // Kapatılan keyword tekrar taranmasın

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getDisplayRotationSlot() {
    return Math.floor(Date.now() / DISPLAY_ROTATION_MS);
}

function rotateKeywordWindow(keywords, offset) {
    if (!keywords.length || offset <= 0) return keywords;
    const o = offset % keywords.length;
    return [...keywords.slice(o), ...keywords.slice(0, o)];
}

function computeKeywordOffset(userId, total, windowSize, salt = "") {
    if (total <= windowSize) return 0;
    const slot = getDisplayRotationSlot();
    const h = hashString32(`${userId}|${slot}|${salt}|kw-window-v1`);
    return h % (total - windowSize + 1);
}

/**
 * Havuzdan kullanıcıya her 3 saatte farklı 15 fırsat göster
 */
function rotateOpportunitiesForDisplay(opportunities, userId, limit = MAX_OPPORTUNITIES) {
    if (!opportunities?.length) return [];
    const ranked = [...opportunities].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    const diverse = pickDiverseOpportunities(ranked, Math.min(limit * 2, ranked.length));
    const slot = getDisplayRotationSlot();
    const shuffled = deterministicShuffle(diverse, `${userId}|display|${slot}|v3`);
    return shuffled.slice(0, limit);
}

function getDisplayRotationMeta() {
    const slot = getDisplayRotationSlot();
    const nextAt = (slot + 1) * DISPLAY_ROTATION_MS;
    return {
        rotationSlot: slot,
        rotationIntervalMs: DISPLAY_ROTATION_MS,
        nextRotationAt: new Date(nextAt).toISOString(),
    };
}

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

        // ── 3. Keyword'leri çıkar (Google Trends + Amazon + kullanıcı) ──
        const keywordData = await keywordService.extractKeywords(userId, {
            includeGoogleTrends: true,
            includeAmazon: true,
            shuffleSalt: opts.shuffleSalt || "",
        });
        let keywords = keywordData.allKeywords;

        const dismissedRows = await OpportunityResult.find({
            userId,
            status: "dismissed",
            userActionAt: { $gte: new Date(Date.now() - DISMISS_COOLDOWN_DAYS * 86400000) },
        })
            .select("keyword")
            .lean();
        const dismissedSet = new Set(
            dismissedRows.map((r) => String(r.keyword || "").trim().toLowerCase()).filter(Boolean)
        );
        if (dismissedSet.size > 0) {
            keywords = keywords.filter((k) => !dismissedSet.has(String(k).trim().toLowerCase()));
        }

        const kwOffset = computeKeywordOffset(
            userId,
            keywords.length,
            maxKeywords,
            opts.shuffleSalt || ""
        );
        keywords = rotateKeywordWindow(keywords, kwOffset).slice(0, maxKeywords);

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
                // 4a. Trend verisi (Google + Sosyal + Amazon + Trendyol — paralel)
                const trendData = await trendService.getKeywordTrend(keyword, {
                    userId,
                    skipSocial: false,
                    skipAmazon: false,
                    skipGoogle: false,
                });

                // 4b. Pazar verisi (Trendyol + Amazon çapraz analiz)
                const marketData = await marketplaceDataService.getMarketplaceData(keyword, {
                    includeAmazon: true,
                });

                // 4c. Boş veri kontrolü
                if (marketData.totalProducts === 0 && trendData.trendScore === 0) {
                    logger.debug(`[OpportunityEngine] Boş veri, atlanıyor: "${keyword}"`);
                    continue;
                }

                // 4d. Skorla (7 boyutlu)
                const category = detectCategory(keyword, keywordData.userCategories);
                const nicheCluster = classifyNicheCluster(category, keyword);
                const nicheLabel = getClusterLabel(nicheCluster);
                const userDataEnriched = {
                    ...userData,
                    nicheBuckets: keywordData.nicheBuckets || [],
                    productCountByCluster: keywordData.productCountByCluster || {},
                };
                const { scores, totalScore, profitAnalysis } = scoringService.calculateScores({
                    trendData,
                    marketData,
                    userData: userDataEnriched,
                    keyword,
                    category,
                    nicheCluster,
                });

                // 4e. Minimum skor filtresi
                if (totalScore < MIN_SCORE_THRESHOLD) {
                    logger.debug(`[OpportunityEngine] Düşük skor (${totalScore}), atlanıyor: "${keyword}"`);
                    continue;
                }

                // 4f. Genişleme tipi belirle
                const expansionType = determineExpansionType(keyword, category, keywordData, trendData);

                // 4g. AI açıklama üret (zenginleştirilmiş)
                const explanation = explanationService.generateExplanation({
                    keyword, category, scores, totalScore,
                    trendData, marketData, profitAnalysis, userData, expansionType,
                });

                rawOpportunities.push({
                    keyword,
                    category,
                    nicheCluster,
                    nicheLabel,
                    source: determineSource(keyword, keywordData, trendData),
                    marketData: {
                        avgPrice: marketData.avgPrice,
                        minPrice: marketData.minPrice,
                        maxPrice: marketData.maxPrice,
                        sellerCount: marketData.sellerCount,
                        totalProducts: marketData.totalProducts,
                        avgRating: marketData.avgRating,
                        avgReviewCount: marketData.avgReviewCount,
                        topBrands: marketData.topBrands,
                        estimatedMonthlySales: marketData.estimatedMonthlySales,
                        estimatedMonthlyRevenue: marketData.estimatedMonthlyRevenue,
                        sampleProducts: (marketData.sampleProducts || []).slice(0, 5),
                    },
                    trendData: {
                        trendScore: trendData.trendScore,
                        trendDirection: trendData.trendDirection,
                        searchVolume: trendData.searchVolume,
                        weeklyChange: trendData.weeklyChange,
                        monthlyChange: trendData.monthlyChange,
                        seasonality: trendData.seasonality,
                        relatedKeywords: (trendData.relatedKeywords || []).slice(0, 10),
                    },
                    // YENİ: Çoklu kaynak verileri
                    socialData: trendData.socialMedia || null,
                    googleTrendsData: trendData.googleTrends || null,
                    amazonData: marketData.amazonData || null,
                    crossMarketAnalysis: marketData.crossMarketAnalysis || null,
                    dataSourceCount: trendData.dataSourceCount || 0,
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
                logger.debug(
                    `[OpportunityEngine] ✅ "${keyword}" — skor: ${totalScore} ` +
                    `(${trendData.dataSourceCount || 0} kaynak)`
                );

                // Rate limit bekleme
                if (keywords.indexOf(keyword) < keywords.length - 1) {
                    await sleep(KEYWORD_DELAY_MS);
                }
            } catch (kwErr) {
                logger.warn(`[OpportunityEngine] Keyword hatası "${keyword}": ${kwErr.message}`);
            }
        }

        // ── 5. Sırala ve filtrele ──
        const sorted = pickDiverseOpportunities(
            rawOpportunities.sort((a, b) => b.totalScore - a.totalScore),
            OPPORTUNITY_POOL_SIZE
        );

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
            const activeKeywords = sorted.map((o) => o.keyword);
            await OpportunityResult.updateMany(
                {
                    userId,
                    status: "active",
                    keyword: { $nin: activeKeywords },
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
            dataSources: {
                googleTrends: sorted.filter(o => o.googleTrendsData).length,
                socialMedia: sorted.filter(o => o.socialData).length,
                amazon: sorted.filter(o => o.amazonData).length,
                trendyol: sorted.length, // Her zaman var
            },
        };

        logger.info(
            `[OpportunityEngine] ✅ Fırsat analizi tamamlandı — user ${String(userId).slice(-6)} — ` +
            `${stats.total} fırsat, ${stats.analyzed} analiz, ${(durationMs / 1000).toFixed(1)}s ` +
            `(Google: ${stats.dataSources.googleTrends}, Social: ${stats.dataSources.socialMedia}, Amazon: ${stats.dataSources.amazon})`
        );

        return {
            opportunities: rotateOpportunitiesForDisplay(savedOpportunities, userId),
            stats: { ...stats, poolSize: savedOpportunities.length },
            fromCache: false,
            displayRotation: getDisplayRotationMeta(),
        };
    } catch (err) {
        logger.error(`[OpportunityEngine] Genel hata (${userId}): ${err.message}`);
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
            .sort({ totalScore: -1, dataFreshness: -1 })
            .limit(OPPORTUNITY_POOL_SIZE)
            .lean();

        if (opportunities.length === 0) return null;

        const displayed = rotateOpportunitiesForDisplay(opportunities, userId);

        return {
            opportunities: displayed,
            stats: {
                total: displayed.length,
                poolSize: opportunities.length,
                analyzed: opportunities.length,
                filtered: 0,
                durationMs: 0,
                cachedAt: opportunities[0]?.dataFreshness,
            },
            displayRotation: getDisplayRotationMeta(),
        };
    } catch (err) {
        return null;
    }
}

/**
 * Kullanıcının fırsatlarını getir (API endpoint için)
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
    if (filters.source) {
        query.source = filters.source;
    }

    let sortField = { totalScore: -1, dataFreshness: -1 };
    if (filters.sortBy === "trend") sortField = { "scores.trend": -1, totalScore: -1 };
    else if (filters.sortBy === "profit") sortField = { "scores.profit": -1, totalScore: -1 };
    else if (filters.sortBy === "competition") sortField = { "scores.competition": -1, totalScore: -1 };
    else if (filters.sortBy === "social") sortField = { "scores.social": -1, totalScore: -1 };
    else if (filters.sortBy === "newest") sortField = { createdAt: -1 };
    else if (filters.sortBy === "fresh") sortField = { dataFreshness: -1, totalScore: -1 };

    const pool = await OpportunityResult.find(query)
        .sort(sortField)
        .limit(OPPORTUNITY_POOL_SIZE)
        .lean();

    return rotateOpportunitiesForDisplay(pool, userId);
}

/**
 * Fırsat aksiyonu kaydet
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

    for (const cat of userCategories) {
        const catLower = cat.toLowerCase();
        const catWords = catLower.split(/[\s>/]+/).filter(w => w.length > 2);
        if (catWords.some(w => kwLower.includes(w))) {
            return cat;
        }
    }

    const categoryMap = {
        "elektronik": ["telefon", "kulaklık", "tablet", "laptop", "powerbank", "saat", "hoparlör", "kamera"],
        "giyim": ["elbise", "tişört", "pantolon", "ceket", "mont", "kazak", "gömlek", "etek"],
        "ayakkabı": ["ayakkabı", "sneaker", "bot", "sandalet", "terlik", "babet"],
        "kozmetik": ["ruj", "fondöten", "parfüm", "krem", "serum", "şampuan", "makyaj"],
        "ev & yaşam": ["halı", "perde", "nevresim", "yastık", "mutfak", "dekorasyon"],
        "aksesuar": ["çanta", "cüzdan", "saat", "gözlük", "bileklik", "kolye", "küpe"],
        "dekoratif & 3d": [
            "biblo", "figür", "heykel", "dekoratif", "3d", "baskı", "vazo", "geyik",
            "masaüstü", "minyatür", "mandala", "obje",
        ],
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

    if (userCats.some(c => c === catLower || c.includes(catLower) || catLower.includes(c))) {
        return "same_category";
    }

    const catWords = catLower.split(/[\s>/]+/).filter(w => w.length > 2);
    const hasOverlap = userCats.some(c => {
        const words = c.split(/[\s>/]+/).filter(w => w.length > 2);
        return words.some(w => catWords.includes(w));
    });
    if (hasOverlap) return "adjacent_category";

    if (trendData && trendData.trendScore >= 70) return "trending";

    return "new_category";
}

function determineSource(keyword, keywordData, trendData) {
    // YENİ: Sosyal medya kaynağı
    if (trendData?.socialMedia?.tiktok?.isViral) return "social";
    if (trendData?.socialMedia?.socialScore >= 70) return "social";

    if (keywordData.userKeywords?.includes(keyword)) return "user_data";
    if (keywordData.googleTrendKeywords?.includes(keyword)) return "trend";
    if (keywordData.amazonKeywords?.includes(keyword)) return "marketplace";
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
    rotateOpportunitiesForDisplay,
    getDisplayRotationMeta,
    MAX_OPPORTUNITIES,
    OPPORTUNITY_POOL_SIZE,
    CACHE_TTL_MS,
    DISPLAY_ROTATION_MS,
};
