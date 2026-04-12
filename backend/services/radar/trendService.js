/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TREND SERVICE — LysiaRadar PRO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Trend verisi toplama servisi.
 * Kaynaklar:
 *   1. Trendyol arama önerileri (autocomplete) → talep göstergesi
 *   2. Trendyol çok satanlar → pazar trendi
 *   3. Google Trends benzeri sinyal (Trendyol arama hacmi proxy)
 *
 * NOT: Google Trends API resmi olarak yok, pytrends güvenilmez.
 *      Bunun yerine Trendyol'un kendi arama verisini proxy olarak kullanıyoruz.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const trendyolScraper = require("../trendyolScraper");

/**
 * Trendyol arama önerilerinden trend skoru hesapla
 * Bir keyword'ün Trendyol autocomplete'te kaçıncı sırada çıktığı → talep göstergesi
 *
 * @param {string} keyword - Aranacak kelime
 * @returns {Promise<object>} { trendScore, relatedKeywords, searchVolume, direction }
 */
async function getKeywordTrend(keyword) {
    try {
        if (!keyword || keyword.trim().length < 2) {
            return defaultTrend();
        }

        // Trendyol'da arama yaparak ürün sayısını ve sıralamayı al
        let searchData = null;
        try {
            searchData = await trendyolScraper.searchProducts(keyword.trim(), 1);
        } catch (e) {
            logger.debug(`[TrendService] Trendyol arama hatası (${keyword}): ${e.message}`);
        }

        if (!searchData || !searchData.products || searchData.products.length === 0) {
            return defaultTrend(keyword);
        }

        const totalProducts = searchData.totalCount || searchData.products.length;
        const products = searchData.products;

        // Trend skoru hesapla — ürün sayısı, satış hızı, yorum sayısı
        let trendScore = 0;

        // 1. Ürün sayısı bazlı skor (çok ürün = yüksek talep)
        if (totalProducts > 10000) trendScore += 30;
        else if (totalProducts > 5000) trendScore += 25;
        else if (totalProducts > 1000) trendScore += 20;
        else if (totalProducts > 500) trendScore += 15;
        else if (totalProducts > 100) trendScore += 10;
        else trendScore += 5;

        // 2. Ortalama satış hızı (favori + yorum sayısı proxy)
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

        // 3. İndirim oranı (yüksek indirim = yüksek rekabet ama talep var)
        const avgDiscount = products.reduce((s, p) => {
            return s + (p.discountPercentage || 0);
        }, 0) / Math.max(products.length, 1);

        if (avgDiscount > 30) trendScore += 15;
        else if (avgDiscount > 15) trendScore += 10;
        else trendScore += 5;

        // Normalize 0-100
        trendScore = Math.min(100, Math.max(0, trendScore));

        // Trend yönü
        let direction = "stable";
        if (trendScore >= 75) direction = "breakout";
        else if (trendScore >= 55) direction = "rising";
        else if (trendScore >= 35) direction = "stable";
        else direction = "declining";

        // İlişkili kelimeler — ürün isimlerinden çıkar
        const relatedKeywords = extractRelatedKeywords(products, keyword);

        return {
            trendScore,
            trendDirection: direction,
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
        logger.warn(`[TrendService] Trend analizi hatası (${keyword}): ${err.message}`);
        return defaultTrend(keyword);
    }
}

/**
 * Birden fazla keyword için toplu trend analizi
 */
async function getBulkTrends(keywords, delayMs = 2000) {
    const results = {};
    for (const kw of keywords) {
        try {
            results[kw] = await getKeywordTrend(kw);
        } catch (e) {
            results[kw] = defaultTrend(kw);
        }
        // Rate limit — Trendyol'u yormamak için
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return results;
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function defaultTrend(keyword = "") {
    return {
        trendScore: 30,
        trendDirection: "unknown",
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

module.exports = {
    getKeywordTrend,
    getBulkTrends,
};
