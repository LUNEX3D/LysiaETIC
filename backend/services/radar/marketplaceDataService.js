/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MARKETPLACE DATA SERVICE — LysiaRadar PRO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Pazaryerlerinden ürün ve fiyat verisi çeker.
 * Kaynaklar:
 *   1. Trendyol scraper → çok satanlar, fiyat, yorum, rating
 *   2. Kullanıcının kendi ürün verileri → satış, kâr, kategori performansı
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const trendyolScraper = require("../trendyolScraper");
const ProductMapping = require("../../models/ProductMapping");
const Order = require("../../models/Order");

/**
 * Trendyol'dan bir keyword için pazar verisi çek
 * @param {string} keyword
 * @returns {Promise<object>} marketData
 */
async function getMarketplaceData(keyword) {
    try {
        if (!keyword || keyword.trim().length < 2) {
            return defaultMarketData();
        }

        let searchData = null;
        try {
            searchData = await trendyolScraper.searchProducts(keyword.trim(), 1);
        } catch (e) {
            logger.debug(`[MarketplaceData] Trendyol arama hatası (${keyword}): ${e.message}`);
        }

        if (!searchData || !searchData.products || searchData.products.length === 0) {
            return defaultMarketData();
        }

        const products = searchData.products.slice(0, 50); // İlk 50 ürün
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

        // Tahmini satış (favori + yorum bazlı proxy)
        const avgFav = products.reduce((s, p) => s + (p.favoriteCount || p.favorites || 0), 0) / Math.max(products.length, 1);
        const estimatedMonthlySales = Math.round(avgFav * 0.15 * products.length); // Kaba tahmin
        const estimatedMonthlyRevenue = Math.round(estimatedMonthlySales * avgPrice);

        // Örnek ürünler (top 5)
        const sampleProducts = products.slice(0, 5).map(p => ({
            name: (p.name || "").slice(0, 120),
            price: p.price || 0,
            rating: p.ratingScore || 0,
            reviewCount: p.reviewCount || p.ratingCount || 0,
            seller: p.merchantName || "",
            imageUrl: p.imageUrl || "",
            url: p.url || "",
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
    } catch (err) {
        logger.warn(`[MarketplaceData] Pazar verisi hatası (${keyword}): ${err.message}`);
        return defaultMarketData();
    }
}

/**
 * Kullanıcının kendi satış verisini çek
 * @param {string} userId
 * @returns {Promise<object>} { categories, topProducts, totalRevenue, avgMargin }
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

        return {
            categories,
            topProducts,
            totalRevenue: Math.round(totalRevenue),
            totalProfit: Math.round(totalProfit),
            avgMargin: Math.round(avgMargin * 10) / 10,
            productCount: products.length,
            orderCount: orders.length,
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
        };
    }
}

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
    };
}

module.exports = {
    getMarketplaceData,
    getUserSalesData,
};
