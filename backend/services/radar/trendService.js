/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TREND SERVICE — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Çoklu kaynaklı trend verisi toplama ve birleştirme servisi.
 *
 * Kaynaklar (öncelik sırasıyla):
 *   1. Google Trends (SerpAPI / embed) → gerçek arama hacmi
 *   2. Sosyal medya (Instagram + TikTok) → kullanıcı davranışı
 *   3. Amazon pazar verisi → e-ticaret talebi
 *   4. Trendyol scraper → yerel pazar trendi (fallback)
 *
 * Her kaynak ayrı servis dosyasında:
 *   - googleTrendsService.js
 *   - socialService.js
 *   - amazonRadarService.js
 *   - trendyolScraper.js (mevcut)
 *
 * Bu dosya hepsini orkestra eder ve birleşik trend skoru üretir.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const googleTrendsService = require("./googleTrendsService");
const socialService = require("./socialService");
const amazonRadarService = require("./amazonRadarService");
const trendyolScraper = require("../trendyolScraper");
const TrendSignal = require("../../models/TrendSignal");

// ── Kaynak Ağırlıkları (toplam = 1.0) ──
const SOURCE_WEIGHTS = {
    googleTrends: 0.30,   // Arama hacmi en güçlü sinyal
    social: 0.25,          // Sosyal medya etkileşimi
    amazon: 0.20,          // E-ticaret talebi
    trendyol: 0.25,        // Yerel pazar verisi
};

/**
 * Bir keyword için TÜM kaynaklardan trend verisi topla ve birleştir
 * @param {string} keyword
 * @param {object} [opts] - { userId, skipSocial, skipAmazon, skipGoogle }
 * @returns {Promise<object>} Birleşik trend verisi
 */
async function getKeywordTrend(keyword, opts = {}) {
    try {
        if (!keyword || keyword.trim().length < 2) {
            return defaultTrend();
        }

        const userId = opts.userId || null;
        const results = {};
        let dataSourceCount = 0;

        // ── 1. Paralel veri toplama ──
        const promises = [];

        // Google Trends
        if (!opts.skipGoogle) {
            promises.push(
                googleTrendsService.getGoogleTrend(keyword)
                    .then(data => { results.google = data; })
                    .catch(err => {
                        logger.debug(`[TrendService] Google Trends hatası (${keyword}): ${err.message}`);
                        results.google = null;
                    })
            );
        }

        // Sosyal medya (kullanıcı bağlantısı varsa)
        if (!opts.skipSocial && userId) {
            promises.push(
                socialService.getSocialMediaData(keyword, userId)
                    .then(data => { results.social = data; })
                    .catch(err => {
                        logger.debug(`[TrendService] Sosyal medya hatası (${keyword}): ${err.message}`);
                        results.social = null;
                    })
            );
        }

        // Amazon
        if (!opts.skipAmazon) {
            promises.push(
                amazonRadarService.getAmazonMarketData(keyword)
                    .then(data => { results.amazon = data; })
                    .catch(err => {
                        logger.debug(`[TrendService] Amazon hatası (${keyword}): ${err.message}`);
                        results.amazon = null;
                    })
            );
        }

        // Trendyol (her zaman çalışır — yerel pazar)
        promises.push(
            fetchTrendyolTrend(keyword)
                .then(data => { results.trendyol = data; })
                .catch(err => {
                    logger.debug(`[TrendService] Trendyol hatası (${keyword}): ${err.message}`);
                    results.trendyol = null;
                })
        );

        await Promise.all(promises);

        // ── 2. Kaynak skorlarını hesapla ──
        const sourceScores = {};

        // Google Trends skoru
        if (results.google && results.google.interestOverTime > 0) {
            sourceScores.googleTrends = calculateGoogleScore(results.google);
            dataSourceCount++;
        }

        // Sosyal medya skoru
        if (results.social && results.social.hasSocialData) {
            sourceScores.social = results.social.socialScore || 0;
            dataSourceCount++;
        }

        // Amazon skoru
        if (results.amazon && results.amazon.totalProducts > 0) {
            sourceScores.amazon = calculateAmazonTrendScore(results.amazon);
            dataSourceCount++;
        }

        // Trendyol skoru
        if (results.trendyol && results.trendyol.trendScore > 0) {
            sourceScores.trendyol = results.trendyol.trendScore;
            dataSourceCount++;
        }

        // ── 3. Birleşik trend skoru hesapla ──
        let compositeTrendScore = 0;
        let totalWeight = 0;

        for (const [source, weight] of Object.entries(SOURCE_WEIGHTS)) {
            if (sourceScores[source] !== undefined) {
                compositeTrendScore += sourceScores[source] * weight;
                totalWeight += weight;
            }
        }

        // Ağırlıkları normalize et (eksik kaynaklar varsa)
        if (totalWeight > 0 && totalWeight < 1) {
            compositeTrendScore = compositeTrendScore / totalWeight;
        }

        compositeTrendScore = Math.min(100, Math.max(0, Math.round(compositeTrendScore)));

        // ── 4. Trend yönü belirle ──
        const trendDirection = determineTrendDirection(results, compositeTrendScore);

        // ── 5. İlişkili keyword'ler birleştir ──
        const relatedKeywords = mergeRelatedKeywords(results);

        // ── 6. Haftalık/aylık değişim ──
        const weeklyChange = results.google?.interestChange
            || results.trendyol?.weeklyChange
            || estimateWeeklyChange(compositeTrendScore);

        const monthlyChange = results.google?.monthlyChange
            || results.trendyol?.monthlyChange
            || estimateMonthlyChange(compositeTrendScore);

        // ── 7. Mevsimsellik ──
        const seasonality = results.trendyol?.seasonality || detectSeasonality(keyword);

        // ── 8. Sonucu kaydet (TrendSignal) ──
        try {
            await saveTrendSignal(keyword, results, compositeTrendScore, trendDirection, dataSourceCount);
        } catch (e) {
            logger.debug(`[TrendService] TrendSignal kaydetme hatası: ${e.message}`);
        }

        return {
            // Birleşik skorlar
            trendScore: compositeTrendScore,
            trendDirection,
            searchVolume: results.google?.interestOverTime || results.trendyol?.searchVolume || 0,
            weeklyChange: Math.round(weeklyChange),
            monthlyChange: Math.round(monthlyChange),
            seasonality,
            relatedKeywords: relatedKeywords.slice(0, 15),

            // Kaynak detayları
            sourceScores,
            dataSourceCount,

            // Google Trends detay
            googleTrends: results.google ? {
                interestOverTime: results.google.interestOverTime,
                isBreakout: results.google.isBreakout,
                relatedQueries: (results.google.relatedQueries || []).slice(0, 10),
                relatedTopics: (results.google.relatedTopics || []).slice(0, 5),
                timelineValues: results.google.timelineValues || [],
            } : null,

            // Sosyal medya detay
            socialMedia: results.social ? {
                instagram: results.social.instagram || null,
                tiktok: results.social.tiktok || null,
                socialScore: results.social.socialScore || 0,
            } : null,

            // Amazon detay
            amazonTrend: results.amazon ? {
                totalProducts: results.amazon.totalProducts,
                avgPrice: results.amazon.avgPrice,
                avgBSR: results.amazon.avgBSR,
                estimatedMonthlySales: results.amazon.estimatedMonthlySales,
            } : null,

            // Trendyol detay (geriye uyumluluk)
            rawProductCount: results.trendyol?.rawProductCount || 0,
            avgFavorites: results.trendyol?.avgFavorites || 0,
            avgReviews: results.trendyol?.avgReviews || 0,
        };
    } catch (err) {
        logger.warn(`[TrendService] Trend analizi hatası (${keyword}): ${err.message}`);
        return defaultTrend(keyword);
    }
}

/**
 * Birden fazla keyword için toplu trend analizi
 * @param {string[]} keywords
 * @param {object} [opts] - { userId, delayMs }
 * @returns {Promise<object>} { keyword: trendData }
 */
async function getBulkTrends(keywords, opts = {}) {
    const delayMs = opts.delayMs || 2000;
    const results = {};

    for (const kw of keywords) {
        try {
            results[kw] = await getKeywordTrend(kw, opts);
        } catch (e) {
            results[kw] = defaultTrend(kw);
        }
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// KAYNAK SKOR HESAPLAMA
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Google Trends verisinden skor hesapla (0-100)
 */
function calculateGoogleScore(googleData) {
    if (!googleData) return 0;

    let score = 0;

    // Interest over time (0-100 zaten)
    score += (googleData.interestOverTime || 0) * 0.5;

    // Haftalık değişim
    const change = googleData.interestChange || 0;
    if (change > 50) score += 25;
    else if (change > 20) score += 20;
    else if (change > 10) score += 15;
    else if (change > 0) score += 10;
    else if (change > -10) score += 5;

    // Breakout bonus
    if (googleData.isBreakout) score += 20;

    // İlişkili sorgu zenginliği
    const relatedCount = (googleData.relatedQueries || []).length;
    if (relatedCount > 10) score += 10;
    else if (relatedCount > 5) score += 5;

    return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Amazon verisinden trend skoru hesapla (0-100)
 */
function calculateAmazonTrendScore(amazonData) {
    if (!amazonData) return 0;

    let score = 0;

    // Ürün sayısı (talep göstergesi)
    const totalProducts = amazonData.totalProducts || 0;
    if (totalProducts > 10000) score += 25;
    else if (totalProducts > 5000) score += 20;
    else if (totalProducts > 1000) score += 15;
    else if (totalProducts > 100) score += 10;
    else if (totalProducts > 0) score += 5;

    // Ortalama yorum (satış göstergesi)
    const avgReviews = amazonData.avgReviewCount || 0;
    if (avgReviews > 500) score += 25;
    else if (avgReviews > 100) score += 20;
    else if (avgReviews > 50) score += 15;
    else if (avgReviews > 10) score += 10;
    else score += 5;

    // Rating (müşteri memnuniyeti)
    const avgRating = amazonData.avgRating || 0;
    if (avgRating >= 4.5) score += 20;
    else if (avgRating >= 4.0) score += 15;
    else if (avgRating >= 3.5) score += 10;
    else score += 5;

    // BSR (düşük BSR = yüksek satış)
    const avgBSR = amazonData.avgBSR || 0;
    if (avgBSR > 0 && avgBSR < 1000) score += 20;
    else if (avgBSR < 5000) score += 15;
    else if (avgBSR < 50000) score += 10;
    else score += 5;

    // Tahmini satış
    const monthlySales = amazonData.estimatedMonthlySales || 0;
    if (monthlySales > 1000) score += 10;
    else if (monthlySales > 100) score += 5;

    return Math.min(100, Math.max(0, Math.round(score)));
}

// ═════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Trendyol'dan trend verisi çek (mevcut sistem — geriye uyumluluk)
 */
async function fetchTrendyolTrend(keyword) {
    try {
        const searchData = await trendyolScraper.searchProducts(keyword.trim(), 1);

        if (!searchData || !searchData.products || searchData.products.length === 0) {
            return defaultTrendyolData();
        }

        const totalProducts = searchData.totalCount || searchData.products.length;
        const products = searchData.products;

        let trendScore = 0;

        // Ürün sayısı bazlı skor
        if (totalProducts > 10000) trendScore += 30;
        else if (totalProducts > 5000) trendScore += 25;
        else if (totalProducts > 1000) trendScore += 20;
        else if (totalProducts > 500) trendScore += 15;
        else if (totalProducts > 100) trendScore += 10;
        else trendScore += 5;

        // Favori ortalaması
        const avgFavorites = products.reduce((s, p) => s + (p.favoriteCount || p.favorites || 0), 0) / Math.max(products.length, 1);
        const avgReviews = products.reduce((s, p) => s + (p.reviewCount || p.ratingCount || 0), 0) / Math.max(products.length, 1);

        if (avgFavorites > 1000) trendScore += 25;
        else if (avgFavorites > 500) trendScore += 20;
        else if (avgFavorites > 100) trendScore += 15;
        else if (avgFavorites > 50) trendScore += 10;
        else trendScore += 5;

        if (avgReviews > 500) trendScore += 20;
        else if (avgReviews > 100) trendScore += 15;
        else if (avgReviews > 50) trendScore += 10;
        else trendScore += 5;

        // İndirim oranı
        const avgDiscount = products.reduce((s, p) => s + (p.discountPercentage || 0), 0) / Math.max(products.length, 1);
        if (avgDiscount > 30) trendScore += 15;
        else if (avgDiscount > 15) trendScore += 10;
        else trendScore += 5;

        trendScore = Math.min(100, Math.max(0, trendScore));

        // İlişkili kelimeler
        const relatedKeywords = extractRelatedKeywords(products, keyword);

        return {
            trendScore,
            searchVolume: totalProducts,
            weeklyChange: estimateWeeklyChange(trendScore),
            monthlyChange: estimateMonthlyChange(trendScore),
            seasonality: detectSeasonality(keyword),
            relatedKeywords: relatedKeywords.slice(0, 10),
            rawProductCount: totalProducts,
            avgFavorites: Math.round(avgFavorites),
            avgReviews: Math.round(avgReviews),
        };
    } catch (err) {
        logger.debug(`[TrendService] Trendyol trend hatası (${keyword}): ${err.message}`);
        return defaultTrendyolData();
    }
}

/**
 * Birleşik trend yönü belirle
 */
function determineTrendDirection(results, compositeScore) {
    // Google Trends breakout → kesin breakout
    if (results.google?.isBreakout) return "breakout";

    // TikTok viral → breakout
    if (results.social?.tiktok?.isViral) return "breakout";

    // Google Trends yönü varsa onu kullan
    if (results.google?.trendDirection && results.google.trendDirection !== "unknown") {
        return results.google.trendDirection;
    }

    // Skor bazlı
    if (compositeScore >= 80) return "breakout";
    if (compositeScore >= 60) return "rising";
    if (compositeScore >= 35) return "stable";
    if (compositeScore > 0) return "declining";
    return "unknown";
}

/**
 * Tüm kaynaklardan ilişkili keyword'leri birleştir
 */
function mergeRelatedKeywords(results) {
    const allKeywords = new Set();

    // Google Trends
    if (results.google?.relatedQueries) {
        results.google.relatedQueries.forEach(q => allKeywords.add(q.toLowerCase()));
    }

    // Trendyol
    if (results.trendyol?.relatedKeywords) {
        results.trendyol.relatedKeywords.forEach(k => allKeywords.add(k.toLowerCase()));
    }

    return [...allKeywords];
}

/**
 * TrendSignal modeline kaydet (zaman serisi)
 */
async function saveTrendSignal(keyword, results, compositeScore, trendDirection, dataSourceCount) {
    const signalData = {
        keyword,
        source: "combined",
        compositeScore,
        trendDirection,
        confidenceLevel: Math.min(95, dataSourceCount * 25),
        dataSourceCount,
        collectedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 gün TTL
    };

    if (results.google) {
        signalData.googleTrends = {
            interestOverTime: results.google.interestOverTime || 0,
            interestChange: results.google.interestChange || 0,
            relatedQueries: (results.google.relatedQueries || []).slice(0, 10),
            relatedTopics: (results.google.relatedTopics || []).slice(0, 5),
            isBreakout: results.google.isBreakout || false,
            geo: results.google.geo || "TR",
        };
    }

    if (results.social?.instagram) {
        signalData.instagram = results.social.instagram;
    }

    if (results.social?.tiktok) {
        signalData.tiktok = results.social.tiktok;
    }

    if (results.amazon) {
        signalData.amazon = {
            totalProducts: results.amazon.totalProducts || 0,
            avgPrice: results.amazon.avgPrice || 0,
            avgBSR: results.amazon.avgBSR || 0,
            avgRating: results.amazon.avgRating || 0,
            avgReviewCount: results.amazon.avgReviewCount || 0,
            topBrands: (results.amazon.topBrands || []).slice(0, 5),
            estimatedMonthlySales: results.amazon.estimatedMonthlySales || 0,
            estimatedMonthlyRevenue: results.amazon.estimatedMonthlyRevenue || 0,
            marketplace: results.amazon.marketplace || "TR",
            sampleProducts: (results.amazon.sampleProducts || []).slice(0, 3),
        };
    }

    if (results.trendyol) {
        signalData.trendyol = {
            totalProducts: results.trendyol.rawProductCount || 0,
            avgPrice: 0,
            avgRating: 0,
            avgReviewCount: results.trendyol.avgReviews || 0,
            sellerCount: 0,
            avgFavorites: results.trendyol.avgFavorites || 0,
            estimatedMonthlySales: 0,
            estimatedMonthlyRevenue: 0,
        };
    }

    await TrendSignal.findOneAndUpdate(
        { keyword, source: "combined" },
        { $set: signalData },
        { upsert: true, new: true }
    );
}

function extractRelatedKeywords(products, originalKeyword) {
    const wordFreq = {};
    const stopWords = new Set([
        "ve", "ile", "için", "bir", "bu", "da", "de", "den", "dan",
        "adet", "set", "kadın", "erkek", "çocuk", "bebek",
        originalKeyword.toLowerCase(),
    ]);

    for (const p of products.slice(0, 20)) {
        const name = (p.name || p.productName || "").toLowerCase();
        const words = name.replace(/[^\wçğıöşüÇĞİÖŞÜ\s]/g, " ").split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
        for (const w of words) {
            wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
    }

    return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([kw]) => kw);
}

function estimateWeeklyChange(trendScore) {
    if (trendScore >= 80) return Math.round(15 + Math.random() * 20);
    if (trendScore >= 60) return Math.round(5 + Math.random() * 10);
    if (trendScore >= 40) return Math.round(-5 + Math.random() * 10);
    return Math.round(-15 + Math.random() * 10);
}

function estimateMonthlyChange(trendScore) {
    if (trendScore >= 80) return Math.round(30 + Math.random() * 40);
    if (trendScore >= 60) return Math.round(10 + Math.random() * 20);
    if (trendScore >= 40) return Math.round(-10 + Math.random() * 20);
    return Math.round(-30 + Math.random() * 20);
}

function detectSeasonality(keyword) {
    const kw = keyword.toLowerCase();
    const summer = ["mayo", "bikini", "sandalet", "güneş", "plaj", "şort", "terlik", "güneş kremi"];
    const winter = ["mont", "kaban", "bot", "bere", "eldiven", "atkı", "kazak", "polar"];
    const backToSchool = ["okul", "çanta", "defter", "kalem", "sırt çantası"];

    if (summer.some(w => kw.includes(w))) return "yaz";
    if (winter.some(w => kw.includes(w))) return "kış";
    if (backToSchool.some(w => kw.includes(w))) return "okul_dönemi";
    return "her_mevsim";
}

function defaultTrend(keyword = "") {
    return {
        trendScore: 30,
        trendDirection: "unknown",
        searchVolume: 0,
        weeklyChange: 0,
        monthlyChange: 0,
        seasonality: "her_mevsim",
        relatedKeywords: [],
        sourceScores: {},
        dataSourceCount: 0,
        googleTrends: null,
        socialMedia: null,
        amazonTrend: null,
        rawProductCount: 0,
        avgFavorites: 0,
        avgReviews: 0,
    };
}

function defaultTrendyolData() {
    return {
        trendScore: 0,
        searchVolume: 0,
        weeklyChange: 0,
        monthlyChange: 0,
        seasonality: "her_mevsim",
        relatedKeywords: [],
        rawProductCount: 0,
        avgFavorites: 0,
        avgReviews: 0,
    };
}

module.exports = {
    getKeywordTrend,
    getBulkTrends,
    SOURCE_WEIGHTS,
};
