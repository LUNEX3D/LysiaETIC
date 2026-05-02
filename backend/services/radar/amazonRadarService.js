/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AMAZON RADAR SERVICE — LysiaRadar PRO v2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Amazon pazar verisi toplama servisi.
 *
 * Stratejiler:
 *   1. Amazon SP-API (kullanıcının kendi seller hesabı bağlıysa)
 *   2. Amazon Product Advertising API (PA-API 5.0) — ürün arama + detay
 *   3. SerpAPI Amazon endpoint — scraping alternatifi
 *
 * Toplanan veriler:
 *   - Ürün sayısı, fiyat aralığı, BSR (Best Seller Rank)
 *   - Yorum sayısı, rating, marka dağılımı
 *   - Tahmini aylık satış (BSR bazlı)
 *   - Rekabet seviyesi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const axios = require("axios");
const crypto = require("crypto");
const { getSerpJson, hasSerpKey } = require("./serpApiClient");

// Amazon PA-API 5.0
const PAAPI_ACCESS_KEY = process.env.AMAZON_PAAPI_ACCESS_KEY || "";
const PAAPI_SECRET_KEY = process.env.AMAZON_PAAPI_SECRET_KEY || "";
const PAAPI_PARTNER_TAG = process.env.AMAZON_PAAPI_PARTNER_TAG || "";
const PAAPI_HOST = "webservices.amazon.com.tr"; // Türkiye
const PAAPI_REGION = "eu-west-1";

// ── In-memory cache ──
const amazonCache = new Map();
const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 saat

// ── BSR → Tahmini Satış Tablosu (Amazon.com.tr yaklaşık) ──
const BSR_TO_SALES = [
    { maxBSR: 100,    dailySales: 50 },
    { maxBSR: 500,    dailySales: 25 },
    { maxBSR: 1000,   dailySales: 15 },
    { maxBSR: 5000,   dailySales: 8 },
    { maxBSR: 10000,  dailySales: 4 },
    { maxBSR: 50000,  dailySales: 2 },
    { maxBSR: 100000, dailySales: 1 },
    { maxBSR: 500000, dailySales: 0.3 },
];

/**
 * Amazon'da bir keyword için pazar verisi çek
 * @param {string} keyword
 * @param {object} [opts] - { marketplace, maxResults }
 * @returns {Promise<object>}
 */
async function getAmazonMarketData(keyword, opts = {}) {
    const marketplace = opts.marketplace || "TR";
    const maxResults = opts.maxResults || 50;

    // Cache kontrolü
    const cacheKey = `amazon:${keyword}:${marketplace}`;
    const cached = amazonCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }

    // 1. SerpAPI ile dene (en güvenilir scraping)
    if (hasSerpKey()) {
        try {
            const result = await fetchFromSerpAPI(keyword, marketplace, maxResults);
            if (result && result.totalProducts > 0) {
                amazonCache.set(cacheKey, { data: result, timestamp: Date.now() });
                return result;
            }
        } catch (err) {
            logger.warn(`[AmazonRadar] SerpAPI hatası (${keyword}): ${err.message}`);
        }
    }

    // 2. PA-API ile dene
    if (PAAPI_ACCESS_KEY && PAAPI_SECRET_KEY) {
        try {
            const result = await fetchFromPAAPI(keyword, marketplace, maxResults);
            if (result && result.totalProducts > 0) {
                amazonCache.set(cacheKey, { data: result, timestamp: Date.now() });
                return result;
            }
        } catch (err) {
            logger.warn(`[AmazonRadar] PA-API hatası (${keyword}): ${err.message}`);
        }
    }

    // 3. Fallback
    logger.debug(`[AmazonRadar] Veri alınamadı, fallback: ${keyword}`);
    return defaultAmazonData(marketplace);
}

/**
 * SerpAPI Amazon endpoint'inden veri çek
 */
async function fetchFromSerpAPI(keyword, marketplace, maxResults) {
    const amazonDomains = {
        TR: "amazon.com.tr",
        US: "amazon.com",
        DE: "amazon.de",
        UK: "amazon.co.uk",
        FR: "amazon.fr",
        IT: "amazon.it",
        ES: "amazon.es",
    };

    const domain = amazonDomains[marketplace] || "amazon.com.tr";

    const params = {
        engine: "amazon",
        amazon_domain: domain,
        k: keyword,
    };

    const response = await getSerpJson(params, { timeout: 25000 });
    const results = response.data?.organic_results || [];

    if (results.length === 0) return null;

    const products = results.slice(0, maxResults);

    // Fiyat analizi
    const prices = products
        .map(p => parseAmazonPrice(p.price?.raw || p.price?.value || ""))
        .filter(p => p > 0);

    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Rating analizi
    const ratings = products.map(p => p.rating || 0).filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    // Yorum analizi
    const reviews = products.map(p => parseInt(String(p.reviews || p.ratings_total || 0).replace(/[^\d]/g, "")) || 0);
    const avgReviewCount = reviews.length > 0 ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0;

    // Marka analizi
    const brandFreq = {};
    products.forEach(p => {
        const brand = p.brand || "";
        if (brand) brandFreq[brand] = (brandFreq[brand] || 0) + 1;
    });
    const topBrands = Object.entries(brandFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([b]) => b);

    // BSR analizi (SerpAPI bazen BSR döndürür)
    const bsrValues = products
        .map(p => p.best_seller_rank || p.bsr || 0)
        .filter(b => b > 0);
    const avgBSR = bsrValues.length > 0 ? bsrValues.reduce((a, b) => a + b, 0) / bsrValues.length : 0;

    // Tahmini satış
    const estimatedMonthlySales = estimateMonthlySalesFromBSR(avgBSR, products.length);
    const estimatedMonthlyRevenue = Math.round(estimatedMonthlySales * avgPrice);

    // Örnek ürünler
    const sampleProducts = products.slice(0, 5).map(p => ({
        name: (p.title || "").slice(0, 150),
        price: parseAmazonPrice(p.price?.raw || p.price?.value || ""),
        rating: p.rating || 0,
        reviewCount: parseInt(String(p.reviews || p.ratings_total || 0).replace(/[^\d]/g, "")) || 0,
        bsr: p.best_seller_rank || 0,
        imageUrl: p.thumbnail || "",
        asin: p.asin || "",
    }));

    return {
        totalProducts: response.data?.search_information?.total_results || products.length,
        avgPrice: Math.round(avgPrice * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100,
        avgBSR: Math.round(avgBSR),
        avgRating: Math.round(avgRating * 10) / 10,
        avgReviewCount: Math.round(avgReviewCount),
        topBrands,
        estimatedMonthlySales,
        estimatedMonthlyRevenue,
        marketplace,
        sampleProducts,
        dataSource: "serpapi_amazon",
    };
}

/**
 * Amazon PA-API 5.0 ile ürün arama
 */
async function fetchFromPAAPI(keyword, marketplace, maxResults) {
    try {
        const payload = {
            Keywords: keyword,
            SearchIndex: "All",
            ItemCount: Math.min(maxResults, 10), // PA-API max 10 per request
            Resources: [
                "ItemInfo.Title",
                "ItemInfo.ByLineInfo",
                "Offers.Listings.Price",
                "BrowseNodeInfo.BrowseNodes.SalesRank",
                "CustomerReviews.Count",
                "CustomerReviews.StarRating",
                "Images.Primary.Medium",
            ],
            PartnerTag: PAAPI_PARTNER_TAG,
            PartnerType: "Associates",
            Marketplace: `www.${getAmazonDomain(marketplace)}`,
        };

        const headers = signPAAPIRequest("SearchItems", payload);

        const response = await axios.post(
            `https://${PAAPI_HOST}/paapi5/searchitems`,
            payload,
            { headers, timeout: 15000 }
        );

        const items = response.data?.SearchResult?.Items || [];
        if (items.length === 0) return null;

        const prices = items
            .map(i => i.Offers?.Listings?.[0]?.Price?.Amount || 0)
            .filter(p => p > 0);

        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

        const ratings = items
            .map(i => parseFloat(i.CustomerReviews?.StarRating?.Value || "0"))
            .filter(r => r > 0);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

        const reviews = items
            .map(i => parseInt(i.CustomerReviews?.Count || "0"))
            .filter(r => r > 0);
        const avgReviewCount = reviews.length > 0 ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0;

        const sampleProducts = items.slice(0, 5).map(i => ({
            name: (i.ItemInfo?.Title?.DisplayValue || "").slice(0, 150),
            price: i.Offers?.Listings?.[0]?.Price?.Amount || 0,
            rating: parseFloat(i.CustomerReviews?.StarRating?.Value || "0"),
            reviewCount: parseInt(i.CustomerReviews?.Count || "0"),
            bsr: i.BrowseNodeInfo?.BrowseNodes?.[0]?.SalesRank || 0,
            imageUrl: i.Images?.Primary?.Medium?.URL || "",
            asin: i.ASIN || "",
        }));

        return {
            totalProducts: response.data?.SearchResult?.TotalResultCount || items.length,
            avgPrice: Math.round(avgPrice * 100) / 100,
            minPrice: prices.length > 0 ? Math.round(Math.min(...prices) * 100) / 100 : 0,
            maxPrice: prices.length > 0 ? Math.round(Math.max(...prices) * 100) / 100 : 0,
            avgBSR: 0,
            avgRating: Math.round(avgRating * 10) / 10,
            avgReviewCount: Math.round(avgReviewCount),
            topBrands: [...new Set(items.map(i => i.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || "").filter(Boolean))].slice(0, 5),
            estimatedMonthlySales: 0,
            estimatedMonthlyRevenue: 0,
            marketplace,
            sampleProducts,
            dataSource: "paapi5",
        };
    } catch (err) {
        logger.warn(`[AmazonRadar] PA-API hatası: ${err.message}`);
        return null;
    }
}

/**
 * Amazon PA-API 5.0 imzalama (AWS Signature V4)
 */
function signPAAPIRequest(operation, payload) {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = timestamp.slice(0, 8);

    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "amz-1.0",
        "X-Amz-Date": timestamp,
        "X-Amz-Target": `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
        "Host": PAAPI_HOST,
    };

    // Simplified signing — gerçek implementasyonda aws4 kütüphanesi kullanılmalı
    try {
        const aws4 = require("aws4");
        const signed = aws4.sign({
            service: "ProductAdvertisingAPI",
            region: PAAPI_REGION,
            path: `/paapi5/${operation.toLowerCase()}`,
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            host: PAAPI_HOST,
        }, {
            accessKeyId: PAAPI_ACCESS_KEY,
            secretAccessKey: PAAPI_SECRET_KEY,
        });
        return signed.headers;
    } catch (e) {
        logger.debug(`[AmazonRadar] aws4 signing hatası: ${e.message}`);
        return headers;
    }
}

/**
 * Birden fazla keyword için toplu Amazon analizi
 * @param {string[]} keywords
 * @param {object} [opts]
 * @returns {Promise<object>}
 */
async function getBulkAmazonData(keywords, opts = {}) {
    const results = {};
    const delayMs = opts.delayMs || 3000;

    for (const kw of keywords.slice(0, 15)) { // Max 15 keyword
        try {
            results[kw] = await getAmazonMarketData(kw, opts);
        } catch (e) {
            results[kw] = defaultAmazonData(opts.marketplace || "TR");
        }
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return results;
}

/**
 * Amazon Best Sellers listesini çek (SerpAPI)
 * @param {string} [category] - Amazon kategori adı
 * @param {string} [marketplace]
 * @returns {Promise<object[]>}
 */
async function getAmazonBestSellers(category = "", marketplace = "TR") {
    if (!hasSerpKey()) return [];

    try {
        const domain = getAmazonDomain(marketplace);

        // SerpAPI'de "amazon_bestsellers" engine'i yok.
        // Bunun yerine "amazon" engine'i ile best seller araması yapıyoruz.
        const params = {
            engine: "amazon",
            amazon_domain: domain,
            k: category || "best seller",
        };

        const response = await getSerpJson(params, { timeout: 25000 });

        // SerpAPI Amazon response: { organic_results: [ { position, title, asin, ... }, ... ] }
        const results = response.data?.organic_results || [];

        logger.info(`[AmazonRadar] ${results.length} best seller ürün bulundu (${marketplace})`);

        return results.slice(0, 20).map((p, idx) => ({
            name: (p.title || "").slice(0, 150),
            price: parseAmazonPrice(p.price?.raw || p.price?.value?.toString() || ""),
            rating: p.rating || 0,
            reviewCount: parseInt(String(p.reviews || p.ratings_total || 0).replace(/[^\d]/g, "")) || 0,
            bsr: p.position || (idx + 1),
            imageUrl: p.thumbnail || "",
            asin: p.asin || "",
            category: category,
        }));
    } catch (err) {
        logger.warn(`[AmazonRadar] Best sellers hatası: ${err.message}`);
        return [];
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * BSR'den tahmini aylık satış hesapla
 */
function estimateMonthlySalesFromBSR(avgBSR, productCount) {
    if (avgBSR <= 0) {
        // BSR yoksa ürün sayısından tahmin et
        if (productCount > 1000) return Math.round(productCount * 0.05);
        if (productCount > 100) return Math.round(productCount * 0.1);
        return Math.round(productCount * 0.2);
    }

    for (const tier of BSR_TO_SALES) {
        if (avgBSR <= tier.maxBSR) {
            return Math.round(tier.dailySales * 30);
        }
    }
    return 5; // Çok yüksek BSR = çok düşük satış
}

/**
 * Amazon fiyat string'ini sayıya çevir
 */
function parseAmazonPrice(priceStr) {
    if (typeof priceStr === "number") return priceStr;
    if (!priceStr) return 0;

    // "₺199,99" veya "$29.99" veya "199.99 TL" formatlarını parse et
    const cleaned = String(priceStr)
        .replace(/[₺$€£]/g, "")
        .replace(/\s/g, "")
        .replace(/TL|USD|EUR|GBP/gi, "")
        .trim();

    // Türkçe format: 1.234,56 → 1234.56
    if (cleaned.includes(",") && cleaned.includes(".")) {
        return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    }
    // Sadece virgül: 199,99 → 199.99
    if (cleaned.includes(",")) {
        return parseFloat(cleaned.replace(",", ".")) || 0;
    }
    return parseFloat(cleaned) || 0;
}

/**
 * Marketplace kodundan Amazon domain'i al
 */
function getAmazonDomain(marketplace) {
    const domains = {
        TR: "amazon.com.tr",
        US: "amazon.com",
        DE: "amazon.de",
        UK: "amazon.co.uk",
        FR: "amazon.fr",
        IT: "amazon.it",
        ES: "amazon.es",
        NL: "amazon.nl",
        SE: "amazon.se",
        PL: "amazon.pl",
    };
    return domains[marketplace] || "amazon.com.tr";
}

function defaultAmazonData(marketplace = "TR") {
    return {
        totalProducts: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        avgBSR: 0,
        avgRating: 0,
        avgReviewCount: 0,
        topBrands: [],
        estimatedMonthlySales: 0,
        estimatedMonthlyRevenue: 0,
        marketplace,
        sampleProducts: [],
        dataSource: "none",
    };
}

/**
 * Cache'i temizle
 */
function clearCache() {
    amazonCache.clear();
}

module.exports = {
    getAmazonMarketData,
    getBulkAmazonData,
    getAmazonBestSellers,
    estimateMonthlySalesFromBSR,
    clearCache,
};
