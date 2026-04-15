/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GOOGLE TRENDS SERVICE — LysiaRadar PRO v2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Google Trends verisi toplama servisi.
 *
 * Strateji:
 *   1. SerpAPI (Google Trends endpoint) — en güvenilir, API key gerektirir
 *   2. Trends.google.com embed widget JSON — ücretsiz fallback
 *   3. Trendyol arama hacmi proxy — son fallback (mevcut sistem)
 *
 * SerpAPI: https://serpapi.com/google-trends-api
 *   - Gerçek Google Trends verisi
 *   - Interest over time, related queries, related topics
 *   - Rate limit: plan bazlı (100-5000 req/month)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const axios = require("axios");

// ── Konfigürasyon ──
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";
const SERPAPI_BASE = "https://serpapi.com/search.json";
const TRENDS_EMBED_BASE = "https://trends.google.com/trends/api";

// ── In-memory cache (SerpAPI çağrılarını azaltmak için) ──
const trendsCache = new Map();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 saat

/**
 * Google Trends'ten keyword verisi çek
 * @param {string} keyword
 * @param {object} [opts] - { geo, timeRange }
 * @returns {Promise<object>}
 */
async function getGoogleTrend(keyword, opts = {}) {
    const geo = opts.geo || "TR";
    const timeRange = opts.timeRange || "today 3-m"; // Son 3 ay

    // Cache kontrolü
    const cacheKey = `${keyword}:${geo}:${timeRange}`;
    const cached = trendsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }

    // 1. SerpAPI ile dene (en güvenilir)
    if (SERPAPI_KEY) {
        try {
            const result = await fetchFromSerpAPI(keyword, geo, timeRange);
            if (result && result.interestOverTime > 0) {
                trendsCache.set(cacheKey, { data: result, timestamp: Date.now() });
                return result;
            }
        } catch (err) {
            logger.warn(`[GoogleTrends] SerpAPI hatası (${keyword}): ${err.message}`);
        }
    }

    // 2. Google Trends embed widget ile dene (ücretsiz)
    try {
        const result = await fetchFromTrendsEmbed(keyword, geo);
        if (result && result.interestOverTime > 0) {
            trendsCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }
    } catch (err) {
        logger.debug(`[GoogleTrends] Embed widget hatası (${keyword}): ${err.message}`);
    }

    // 3. Fallback — varsayılan veri
    logger.debug(`[GoogleTrends] Veri alınamadı, fallback kullanılıyor: ${keyword}`);
    return defaultGoogleTrend(keyword);
}

/**
 * SerpAPI üzerinden Google Trends verisi çek
 */
async function fetchFromSerpAPI(keyword, geo, timeRange) {
    // Interest Over Time
    const iotParams = {
        engine: "google_trends",
        q: keyword,
        geo,
        date: timeRange,
        data_type: "TIMESERIES",
        api_key: SERPAPI_KEY,
    };

    const iotRes = await axios.get(SERPAPI_BASE, { params: iotParams, timeout: 15000 });
    const iotData = iotRes.data;

    // Zaman serisi verisi
    const timelineData = iotData?.interest_over_time?.timeline_data || [];
    if (timelineData.length === 0) {
        return null;
    }

    // Son değer ve değişim hesapla
    const values = timelineData.map(t => {
        const val = t.values?.[0]?.extracted_value;
        return typeof val === "number" ? val : 0;
    });

    const currentValue = values[values.length - 1] || 0;
    const previousWeekValue = values.length >= 2 ? values[values.length - 2] : currentValue;
    const monthAgoValue = values.length >= 5 ? values[values.length - 5] : currentValue;

    const weeklyChange = previousWeekValue > 0
        ? ((currentValue - previousWeekValue) / previousWeekValue) * 100
        : 0;
    const monthlyChange = monthAgoValue > 0
        ? ((currentValue - monthAgoValue) / monthAgoValue) * 100
        : 0;

    // İlişkili sorgular
    let relatedQueries = [];
    let relatedTopics = [];
    let isBreakout = false;

    try {
        const rqParams = {
            engine: "google_trends",
            q: keyword,
            geo,
            date: timeRange,
            data_type: "RELATED_QUERIES",
            api_key: SERPAPI_KEY,
        };
        const rqRes = await axios.get(SERPAPI_BASE, { params: rqParams, timeout: 15000 });

        const rising = rqRes.data?.related_queries?.rising || [];
        const top = rqRes.data?.related_queries?.top || [];

        relatedQueries = [
            ...rising.map(r => r.query),
            ...top.map(r => r.query),
        ].slice(0, 15);

        // Breakout kontrolü — "Breakout" etiketli sorgu var mı?
        isBreakout = rising.some(r =>
            r.extracted_value === "Breakout" || (r.value && String(r.value).includes("Breakout"))
        );
    } catch (e) {
        logger.debug(`[GoogleTrends] Related queries hatası: ${e.message}`);
    }

    try {
        const rtParams = {
            engine: "google_trends",
            q: keyword,
            geo,
            date: timeRange,
            data_type: "RELATED_TOPICS",
            api_key: SERPAPI_KEY,
        };
        const rtRes = await axios.get(SERPAPI_BASE, { params: rtParams, timeout: 15000 });

        const risingTopics = rtRes.data?.related_topics?.rising || [];
        const topTopics = rtRes.data?.related_topics?.top || [];

        relatedTopics = [
            ...risingTopics.map(r => r.topic?.title || ""),
            ...topTopics.map(r => r.topic?.title || ""),
        ].filter(Boolean).slice(0, 10);
    } catch (e) {
        logger.debug(`[GoogleTrends] Related topics hatası: ${e.message}`);
    }

    // Trend yönü belirle
    let trendDirection = "stable";
    if (isBreakout || weeklyChange > 50) trendDirection = "breakout";
    else if (weeklyChange > 15 || monthlyChange > 30) trendDirection = "rising";
    else if (weeklyChange < -15 || monthlyChange < -30) trendDirection = "declining";

    return {
        interestOverTime: currentValue,
        interestChange: Math.round(weeklyChange),
        monthlyChange: Math.round(monthlyChange),
        relatedQueries,
        relatedTopics,
        isBreakout,
        trendDirection,
        timelineValues: values.slice(-12), // Son 12 veri noktası
        geo,
        dataSource: "serpapi",
    };
}

/**
 * Google Trends embed widget'ından veri çek (ücretsiz fallback)
 * Trends.google.com'un dahili API'sini kullanır
 */
async function fetchFromTrendsEmbed(keyword, geo) {
    try {
        // Google Trends explore endpoint
        const url = `${TRENDS_EMBED_BASE}/widgetdata/multiline`;
        const params = {
            hl: "tr",
            tz: "-180",
            req: JSON.stringify({
                time: "today 3-m",
                resolution: "WEEK",
                locale: "tr",
                comparisonItem: [{ keyword, geo, time: "today 3-m" }],
                requestOptions: { property: "", backend: "IZG", category: 0 },
            }),
            token: "", // Token gerekebilir — bu endpoint güvenilmez
        };

        const response = await axios.get(url, {
            params,
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        });

        // Google Trends yanıtı ")]}'" ile başlar, temizle
        let rawData = response.data;
        if (typeof rawData === "string") {
            rawData = rawData.replace(/^\)\]\}',?\n?/, "");
            rawData = JSON.parse(rawData);
        }

        const timelineData = rawData?.default?.timelineData || [];
        if (timelineData.length === 0) return null;

        const values = timelineData.map(t => t.value?.[0] || 0);
        const currentValue = values[values.length - 1] || 0;
        const previousWeekValue = values.length >= 2 ? values[values.length - 2] : currentValue;
        const monthAgoValue = values.length >= 5 ? values[values.length - 5] : currentValue;

        const weeklyChange = previousWeekValue > 0
            ? ((currentValue - previousWeekValue) / previousWeekValue) * 100
            : 0;
        const monthlyChange = monthAgoValue > 0
            ? ((currentValue - monthAgoValue) / monthAgoValue) * 100
            : 0;

        let trendDirection = "stable";
        if (weeklyChange > 50) trendDirection = "breakout";
        else if (weeklyChange > 15 || monthlyChange > 30) trendDirection = "rising";
        else if (weeklyChange < -15 || monthlyChange < -30) trendDirection = "declining";

        return {
            interestOverTime: currentValue,
            interestChange: Math.round(weeklyChange),
            monthlyChange: Math.round(monthlyChange),
            relatedQueries: [],
            relatedTopics: [],
            isBreakout: weeklyChange > 50,
            trendDirection,
            timelineValues: values.slice(-12),
            geo,
            dataSource: "trends_embed",
        };
    } catch (err) {
        logger.debug(`[GoogleTrends] Embed fetch hatası: ${err.message}`);
        return null;
    }
}

/**
 * Birden fazla keyword için toplu Google Trends analizi
 * @param {string[]} keywords
 * @param {object} [opts]
 * @returns {Promise<object>} { keyword: trendData }
 */
async function getBulkGoogleTrends(keywords, opts = {}) {
    const results = {};
    const delayMs = opts.delayMs || 2000;

    for (const kw of keywords.slice(0, 20)) { // Max 20 keyword
        try {
            results[kw] = await getGoogleTrend(kw, opts);
        } catch (e) {
            results[kw] = defaultGoogleTrend(kw);
        }
        // Rate limit
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return results;
}

/**
 * Google Trends'ten yükselen arama terimleri (trending searches)
 * @param {string} [geo] - Ülke kodu (TR, US, DE...)
 * @returns {Promise<string[]>}
 */
async function getTrendingSearches(geo = "TR") {
    if (!SERPAPI_KEY) return [];

    try {
        const params = {
            engine: "google_trends_trending_now",
            geo,
            api_key: SERPAPI_KEY,
        };

        const response = await axios.get(SERPAPI_BASE, { params, timeout: 15000 });

        // SerpAPI response formatı: { trending_searches: [ { query, search_volume, ... }, ... ] }
        const trendingSearches = response.data?.trending_searches || [];

        const trendingKeywords = trendingSearches
            .slice(0, 30)
            .map(s => s.query || "")
            .filter(Boolean);

        logger.info(`[GoogleTrends] ${trendingKeywords.length} trending arama bulundu (${geo})`);
        return trendingKeywords;
    } catch (err) {
        logger.warn(`[GoogleTrends] Trending searches hatası: ${err.message}`);
        return [];
    }
}

// ── Yardımcılar ──

function defaultGoogleTrend(keyword = "") {
    return {
        interestOverTime: 0,
        interestChange: 0,
        monthlyChange: 0,
        relatedQueries: [],
        relatedTopics: [],
        isBreakout: false,
        trendDirection: "unknown",
        timelineValues: [],
        geo: "TR",
        dataSource: "none",
    };
}

/**
 * Cache'i temizle (test/debug için)
 */
function clearCache() {
    trendsCache.clear();
}

module.exports = {
    getGoogleTrend,
    getBulkGoogleTrends,
    getTrendingSearches,
    clearCache,
};
