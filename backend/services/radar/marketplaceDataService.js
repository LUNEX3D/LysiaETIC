/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MARKETPLACE DATA SERVICE — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Çoklu pazaryerinden ürün ve fiyat verisi çeker.
 *
 * Kaynaklar:
 *   1. Trendyol scraper → çok satanlar, fiyat, yorum, rating (yerel)
 *   2. Amazon Radar → fiyat, BSR, yorum, rekabet (global)
 *   3. Kullanıcının kendi ürün verileri → satış, kâr, kategori performansı
 *
 * YENİ: Amazon + Trendyol verilerini birleştirerek çapraz pazar analizi yapar.
 *       Fiyat arbitrajı, rekabet karşılaştırması, talep farkı tespiti.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const trendyolScraper = require("../trendyolScraper");
const amazonRadarService = require("./amazonRadarService");
const ProductMapping = require("../../models/ProductMapping");
const Order = require("../../models/Order");

/**
 * Bir keyword için TÜM pazaryerlerinden birleşik pazar verisi çek
 * @param {string} keyword
 * @param {object} [opts] - { includeAmazon, amazonMarketplace }
 * @returns {Promise<object>} Birleşik marketData
 */
async function getMarketplaceData(keyword, opts = {}) {
    try {
        if (!keyword || keyword.trim().length < 2) {
            return defaultMarketData();
        }

        const includeAmazon = opts.includeAmazon !== false; // Varsayılan: true

        // ── Paralel veri toplama ──
        const promises = [];
        const results = {};

        // Trendyol (her zaman)
        promises.push(
            fetchTrendyolData(keyword)
                .then(data => { results.trendyol = data; })
                .catch(() => { results.trendyol = null; })
        );

        // Amazon (opsiyonel)
        if (includeAmazon) {
            promises.push(
                amazonRadarService.getAmazonMarketData(keyword, {
                    marketplace: opts.amazonMarketplace || "TR",
                })
                    .then(data => { results.amazon = data; })
                    .catch(() => { results.amazon = null; })
            );
        }

        await Promise.all(promises);

        // ── Verileri birleştir ──
        const trendyol = results.trendyol || defaultTrendyolMarketData();
        const amazon = results.amazon || null;

        // Ana veri kaynağı: Trendyol (yerel pazar)
        const merged = {
            // Trendyol verileri (ana)
            avgPrice: trendyol.avgPrice,
            minPrice: trendyol.minPrice,
            maxPrice: trendyol.maxPrice,
            sellerCount: trendyol.sellerCount,
            totalProducts: trendyol.totalProducts,
            avgRating: trendyol.avgRating,
            avgReviewCount: trendyol.avgReviewCount,
            topBrands: trendyol.topBrands,
            estimatedMonthlySales: trendyol.estimatedMonthlySales,
            estimatedMonthlyRevenue: trendyol.estimatedMonthlyRevenue,
            sampleProducts: trendyol.sampleProducts,

            // Amazon verileri (ek)
            amazonData: amazon && amazon.totalProducts > 0 ? {
                totalProducts: amazon.totalProducts,
                avgPrice: amazon.avgPrice,
                minPrice: amazon.minPrice,
                maxPrice: amazon.maxPrice,
                avgBSR: amazon.avgBSR,
                avgRating: amazon.avgRating,
                avgReviewCount: amazon.avgReviewCount,
                topBrands: amazon.topBrands,
                estimatedMonthlySales: amazon.estimatedMonthlySales,
                estimatedMonthlyRevenue: amazon.estimatedMonthlyRevenue,
                marketplace: amazon.marketplace,
                sampleProducts: (amazon.sampleProducts || []).slice(0, 3),
            } : null,

            // Çapraz pazar analizi
            crossMarketAnalysis: amazon && amazon.totalProducts > 0
                ? generateCrossMarketAnalysis(trendyol, amazon)
                : null,

            // Veri kaynakları
            dataSources: [
                trendyol.totalProducts > 0 ? "trendyol" : null,
                amazon && amazon.totalProducts > 0 ? "amazon" : null,
            ].filter(Boolean),
        };

        return merged;
    } catch (err) {
        logger.warn(`[MarketplaceData] Pazar verisi hatası (${keyword}): ${err.message}`);
        return defaultMarketData();
    }
}

/**
 * Trendyol'dan pazar verisi çek
 */
async function fetchTrendyolData(keyword) {
    let searchData = null;
    try {
        searchData = await trendyolScraper.searchProducts(keyword.trim(), 1);
    } catch (e) {
        logger.debug(`[MarketplaceData] Trendyol arama hatası (${keyword}): ${e.message}`);
    }

    if (!searchData || !searchData.products || searchData.products.length === 0) {
        return defaultTrendyolMarketData();
    }

    const products = searchData.products.slice(0, 50);
    const totalProducts = searchData.totalCount || products.length;

    // Fiyat analizi
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Satıcı analizi
    const sellers = new Set(products.map(p => p.merchantName || p.seller || "").filter(Boolean));

    // Rating analizi
    const ratings = products.map(p => p.ratingScore || p.rating || 0).filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    // Yorum analizi
    const reviews = products.map(p => p.reviewCount || p.ratingCount || 0);
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

    // Tahmini satış
    const avgFav = products.reduce((s, p) => s + (p.favoriteCount || p.favorites || 0), 0) / Math.max(products.length, 1);
    const estimatedMonthlySales = Math.round(avgFav * 0.15 * products.length);
    const estimatedMonthlyRevenue = Math.round(estimatedMonthlySales * avgPrice);

    // Örnek ürünler
    const sampleProducts = products.slice(0, 5).map(p => ({
        name: (p.name || "").slice(0, 120),
        price: p.price || 0,
        rating: p.ratingScore || 0,
        reviewCount: p.reviewCount || p.ratingCount || 0,
        seller: p.merchantName || "",
        imageUrl: p.imageUrl || "",
        url: p.url || "",
        source: "trendyol",
    }));

    return {
        avgPrice: Math.round(avgPrice * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100,
        sellerCount: sellers.size,
        totalProducts,
        avgRating: Math.round(avgRating * 10) / 10,
        avgReviewCount: Math.round(avgReviewCount),
        topBrands,
        estimatedMonthlySales,
        estimatedMonthlyRevenue,
        sampleProducts,
    };
}

/**
 * Çapraz pazar analizi — Trendyol vs Amazon karşılaştırması
 */
function generateCrossMarketAnalysis(trendyol, amazon) {
    const analysis = {
        priceComparison: null,
        competitionComparison: null,
        demandComparison: null,
        arbitrageOpportunity: false,
        arbitrageDetails: null,
    };

    // Fiyat karşılaştırması
    if (trendyol.avgPrice > 0 && amazon.avgPrice > 0) {
        const priceDiffPercent = ((trendyol.avgPrice - amazon.avgPrice) / amazon.avgPrice) * 100;
        analysis.priceComparison = {
            trendyolAvg: trendyol.avgPrice,
            amazonAvg: amazon.avgPrice,
            diffPercent: Math.round(priceDiffPercent),
            cheaperOn: priceDiffPercent > 5 ? "amazon" : priceDiffPercent < -5 ? "trendyol" : "similar",
        };

        // Arbitraj fırsatı: Amazon'da ucuz, Trendyol'da pahalı (veya tersi)
        if (Math.abs(priceDiffPercent) > 20) {
            analysis.arbitrageOpportunity = true;
            analysis.arbitrageDetails = {
                direction: priceDiffPercent > 0 ? "amazon_to_trendyol" : "trendyol_to_amazon",
                potentialMargin: Math.abs(Math.round(priceDiffPercent)),
                description: priceDiffPercent > 0
                    ? `Amazon'dan alıp Trendyol'da satarak ~%${Math.abs(Math.round(priceDiffPercent))} marj potansiyeli`
                    : `Trendyol'dan alıp Amazon'da satarak ~%${Math.abs(Math.round(priceDiffPercent))} marj potansiyeli`,
            };
        }
    }

    // Rekabet karşılaştırması
    const trendyolCompetition = trendyol.sellerCount || 0;
    const amazonCompetition = amazon.totalProducts || 0;
    analysis.competitionComparison = {
        trendyolSellers: trendyolCompetition,
        amazonProducts: amazonCompetition,
        lessCompetitiveOn: trendyolCompetition < amazonCompetition / 10 ? "trendyol" : "amazon",
    };

    // Talep karşılaştırması
    analysis.demandComparison = {
        trendyolEstSales: trendyol.estimatedMonthlySales || 0,
        amazonEstSales: amazon.estimatedMonthlySales || 0,
        higherDemandOn: (trendyol.estimatedMonthlySales || 0) > (amazon.estimatedMonthlySales || 0)
            ? "trendyol" : "amazon",
    };

    return analysis;
}

/**
 * Kullanıcının kendi satış verisini çek
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getUserSalesData(userId) {
    try {
        const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Kullanıcının ürünleri
        const products = await ProductMapping.find({ userId }).lean();

        // Son 30 gün siparişleri
        const orders = await Order.find({
            user: userId,
            orderDate: { $gte: d30 },
            status: { $nin: ["Cancelled", "Returned"] },
        }).lean();

        // Kategori bazlı analiz
        const categoryStats = {};
        for (const pm of products) {
            const cat = pm.masterProduct?.category || "Diğer";
            if (!categoryStats[cat]) {
                categoryStats[cat] = { name: cat, productCount: 0, totalRevenue: 0, totalProfit: 0, avgPrice: 0, prices: [] };
            }
            categoryStats[cat].productCount++;
            categoryStats[cat].prices.push(pm.masterProduct?.price || 0);
        }

        // Sipariş verilerini kategorilere dağıt
        for (const order of orders) {
            for (const item of (order.items || [])) {
                const pm = products.find(p =>
                    p.masterProduct?.barcode === item.barcode ||
                    p.masterProduct?.sku === item.barcode
                );
                const cat = pm?.masterProduct?.category || item.category || "Diğer";
                if (!categoryStats[cat]) {
                    categoryStats[cat] = { name: cat, productCount: 0, totalRevenue: 0, totalProfit: 0, avgPrice: 0, prices: [] };
                }
                categoryStats[cat].totalRevenue += (item.price || 0) * (item.quantity || 1);
                categoryStats[cat].totalProfit += (item.netProfit || 0) * (item.quantity || 1);
            }
        }

        // Ortalama fiyat hesapla
        for (const cat of Object.values(categoryStats)) {
            cat.avgPrice = cat.prices.length > 0
                ? Math.round(cat.prices.reduce((a, b) => a + b, 0) / cat.prices.length)
                : 0;
            delete cat.prices;
        }

        const categories = Object.values(categoryStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
        const totalRevenue = categories.reduce((s, c) => s + c.totalRevenue, 0);
        const totalProfit = categories.reduce((s, c) => s + c.totalProfit, 0);
        const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        // En çok satan ürünler
        const productSales = {};
        for (const order of orders) {
            for (const item of (order.items || [])) {
                const key = item.barcode || item.productName;
                if (!productSales[key]) {
                    productSales[key] = {
                        name: item.productName,
                        barcode: item.barcode,
                        totalSales: 0,
                        totalRevenue: 0,
                        category: item.category || "Diğer",
                    };
                }
                productSales[key].totalSales += item.quantity || 1;
                productSales[key].totalRevenue += (item.price || 0) * (item.quantity || 1);
            }
        }
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 10);

        // Pazaryeri dağılımı
        const marketplaceDistribution = {};
        for (const order of orders) {
            const mp = order.marketplace || "Bilinmeyen";
            if (!marketplaceDistribution[mp]) {
                marketplaceDistribution[mp] = { name: mp, orderCount: 0, revenue: 0 };
            }
            marketplaceDistribution[mp].orderCount++;
            marketplaceDistribution[mp].revenue += order.totalAmount || 0;
        }

        return {
            categories,
            topProducts,
            totalRevenue: Math.round(totalRevenue),
            totalProfit: Math.round(totalProfit),
            avgMargin: Math.round(avgMargin * 10) / 10,
            productCount: products.length,
            orderCount: orders.length,
            marketplaceDistribution: Object.values(marketplaceDistribution),
        };
    } catch (err) {
        logger.warn(`[MarketplaceData] Kullanıcı verisi hatası (${userId}): ${err.message}`);
        return {
            categories: [],
            topProducts: [],
            totalRevenue: 0,
            totalProfit: 0,
            avgMargin: 0,
            productCount: 0,
            orderCount: 0,
            marketplaceDistribution: [],
        };
    }
}

// ── Varsayılan veriler ──

function defaultMarketData() {
    return {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        sellerCount: 0,
        totalProducts: 0,
        avgRating: 0,
        avgReviewCount: 0,
        topBrands: [],
        estimatedMonthlySales: 0,
        estimatedMonthlyRevenue: 0,
        sampleProducts: [],
        amazonData: null,
        crossMarketAnalysis: null,
        dataSources: [],
    };
}

function defaultTrendyolMarketData() {
    return {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        sellerCount: 0,
        totalProducts: 0,
        avgRating: 0,
        avgReviewCount: 0,
        topBrands: [],
        estimatedMonthlySales: 0,
        estimatedMonthlyRevenue: 0,
        sampleProducts: [],
    };
}

module.exports = {
    getMarketplaceData,
    getUserSalesData,
};
