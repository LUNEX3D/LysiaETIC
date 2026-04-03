/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ROKETFY SERVICE V4 — BİREBİR ROKETFY KLONU
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Trendyol'daki TÜM ürünleri analiz eden pazar istihbarat motoru.
 * Roketfy'ın birebir aynısı — kullanıcının kendi ürünlerini DEĞİL,
 * Trendyol pazarındaki tüm ürünleri scrape ederek analiz eder.
 *
 * 5 Ana Modül (Roketfy ile aynı):
 *   1. Ürün Araştırması    — Trendyol'da kategori/kelime ile arama, en çok satanlar,
 *                            tahmini günlük satış, aylık ciro, görüntüleme, favori
 *   2. Rakip Araştırması   — Ürün linki veya mağaza bazlı rakip analizi,
 *                            anahtar kelimeler, satış verileri, fiyatlar
 *   3. Listeleme Analisti  — Kendi ürünlerinin Trendyol listeleme kalitesi,
 *                            Roketfy skoru, SEO, başlık, açıklama, görsel analizi
 *   4. AI İçerik Yazarı    — SEO uyumlu başlık/açıklama üretimi
 *   5. Yorum Analizi       — Ürün yorumlarını NLP ile analiz (pozitif/negatif/konu)
 *
 * Veri Kaynağı: trendyolScraper.js (Trendyol public endpoint'leri)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const axios = require("axios");
const trendyol = require("./trendyolScraper");
const ProductMapping = require("../models/ProductMapping");
const Product = require("../models/Product");
const Order = require("../models/Order");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const Marketplace = require("../models/Marketplace");
const RoketfyAnalysis = require("../models/RoketfyAnalysis");
const logger = require("../config/logger");


// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────

function calculateGrade(score) {
    if (score >= 95) return "A+";
    if (score >= 85) return "A";
    if (score >= 78) return "B+";
    if (score >= 70) return "B";
    if (score >= 60) return "C+";
    if (score >= 50) return "C";
    if (score >= 35) return "D";
    return "F";
}

function analyzeSentiment(text) {
    if (!text) return { sentiment: "neutral", score: 0 };
    const lower = text.toLowerCase();
    const positiveWords = [
        "güzel", "harika", "mükemmel", "süper", "kaliteli", "hızlı", "teşekkür",
        "memnun", "beğendim", "tavsiye", "ederim", "muhteşem", "başarılı", "iyi",
        "sağlam", "dayanıklı", "şık", "rahat", "uygun", "pratik", "sevdim",
    ];
    const negativeWords = [
        "kötü", "berbat", "rezalet", "bozuk", "yırtık", "kırık", "geç",
        "gecikme", "iade", "sorun", "problem", "hata", "eksik", "yanlış",
        "küçük", "büyük", "uymuyor", "farklı", "sahte", "kalitesiz", "pişman",
    ];
    let pos = 0, neg = 0;
    positiveWords.forEach(w => { if (lower.includes(w)) pos++; });
    negativeWords.forEach(w => { if (lower.includes(w)) neg++; });
    const total = pos + neg;
    if (total === 0) return { sentiment: "neutral", score: 0 };
    const score = ((pos - neg) / total) * 100;
    if (score > 20) return { sentiment: "positive", score };
    if (score < -20) return { sentiment: "negative", score };
    return { sentiment: "neutral", score };
}

function extractKeywords(text, topN = 15) {
    if (!text) return [];
    const stopWords = new Set([
        "bir", "ve", "ile", "için", "bu", "da", "de", "den", "dan", "mi", "mu",
        "mı", "mü", "çok", "var", "yok", "olan", "olarak", "gibi", "daha",
        "en", "her", "ama", "fakat", "ancak", "hem", "ya", "veya", "ne",
        "adet", "set", "kadın", "erkek", "the", "and", "for", "with",
    ]);
    const words = text.toLowerCase().replace(/[^\wçğıöşüÇĞİÖŞÜ\s]/g, " ").split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, topN)
        .map(([keyword, count]) => ({ keyword, count }));
}

async function getTrendyolCredentials(userId) {
    const marketplace = await Marketplace.findOne({
        userId, marketplaceName: "Trendyol", isActive: true,
    }).lean();
    if (!marketplace || !marketplace.credentials) return null;
    const creds = marketplace.credentials;
    return {
        sellerId: creds.sellerId || creds.supplierId,
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret,
    };
}


// ═════════════════════════════════════════════════════════════════════════════
// 1. ÜRÜN ARAŞTIRMASI — Trendyol'daki TÜM ürünleri analiz et (Roketfy gibi)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Trendyol'da ürün araştırması — Roketfy'ın "Ürün Araştırması" sekmesi
 * Kategori veya anahtar kelime ile Trendyol'daki ürünleri arar
 * Her ürün için: fiyat, görüntüleme, favori, tahmini günlük satış, aylık ciro
 */
async function researchProducts(userId, { query, categoryName, sort, page }) {
    const startTime = Date.now();

    let result;
    if (categoryName && trendyol.TRENDYOL_CATEGORIES[categoryName.toLowerCase()]) {
        result = await trendyol.getCategoryProducts(categoryName.toLowerCase(), {
            sort: sort || "BEST_SELLER",
            page: page || 1,
            limit: 48,
        });
    } else {
        const searchTerm = query || categoryName || "";
        result = await trendyol.searchProducts(searchTerm, {
            sort: sort || "BEST_SELLER",
            page: page || 1,
            limit: 48,
        });
    }

    const products = result.products || [];

    // Fiyat istatistikleri
    const prices = products.map(p => p.price).filter(p => p > 0).sort((a, b) => a - b);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices[0] || 0;
    const maxPrice = prices[prices.length - 1] || 0;
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

    // Marka dağılımı
    const brandMap = {};
    products.forEach(p => {
        const brand = p.brand || "Bilinmiyor";
        brandMap[brand] = (brandMap[brand] || 0) + 1;
    });
    const topBrands = Object.entries(brandMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    // Rekabet seviyesi
    let competitionLevel = "low";
    if (result.totalCount > 10000) competitionLevel = "very_high";
    else if (result.totalCount > 5000) competitionLevel = "high";
    else if (result.totalCount > 1000) competitionLevel = "medium";

    const analysisResult = {
        searchQuery: query || categoryName || "",
        totalResults: result.totalCount || products.length,
        page: result.page || 1,
        sort: result.sort || "BEST_SELLER",
        marketStats: {
            avgPrice, minPrice, maxPrice, medianPrice,
            competitionLevel,
            totalSellers: result.totalCount || products.length,
        },
        topProducts: products.map(p => ({
            id: p.id,
            contentId: p.contentId,
            name: p.name,
            brand: p.brand,
            price: p.price,
            originalPrice: p.originalPrice,
            discountPercentage: p.discountPercentage,
            imageUrl: p.imageUrl,
            ratingScore: p.ratingScore,
            ratingCount: p.ratingCount,
            reviewCount: p.reviewCount,
            favoriteCount: p.favoriteCount,
            basketCount: p.basketCount || 0,
            orderCount: p.orderCount || 0,
            pageViewCount: p.pageViewCount || 0,
            estimatedDailySales: p.estimatedDailySales,
            estimatedMonthlyRevenue: p.estimatedMonthlyRevenue,
            merchantName: p.merchantName,
            url: p.url,
            hasFreeCargo: p.freeCargo || p.hasFreeCargo || false,
            socialProof: p.socialProofRaw || p.socialProof || {},
        })),
        topBrands,
    };

    // Analiz kaydet
    await RoketfyAnalysis.create({
        userId,
        analysisType: "product_research",
        target: { categoryName: query || categoryName },
        productResearch: {
            searchQuery: query || categoryName || "",
            categoryName: categoryName || "",
            totalResults: result.totalCount || products.length,
            topProducts: products.slice(0, 10).map(p => ({
                name: p.name, price: p.price, barcode: String(p.contentId),
                marketplace: "Trendyol",
            })),
        },
        status: "completed",
        processingTimeMs: Date.now() - startTime,
    });

    return analysisResult;
}

/**
 * En çok satanlar — Roketfy'ın ana sayfasındaki "En Çok Satılan Trendyol Ürünleri"
 */
async function getBestSellers(userId, { categoryKey, limit }) {
    const startTime = Date.now();
    const result = await trendyol.getBestSellers(categoryKey || "", limit || 20);

    await RoketfyAnalysis.create({
        userId,
        analysisType: "product_research",
        target: { categoryName: categoryKey || "all" },
        productResearch: {
            searchQuery: "best_sellers",
            categoryName: categoryKey || "Tüm Kategoriler",
            totalResults: result.products?.length || 0,
        },
        status: "completed",
        processingTimeMs: Date.now() - startTime,
    });

    return result;
}

/**
 * Kategori listesi
 */
function getCategories() {
    return trendyol.getCategories();
}


// ═════════════════════════════════════════════════════════════════════════════
// 2. RAKİP ARAŞTIRMASI — Ürün veya mağaza bazlı rakip analizi
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Rakip ürün analizi — Bir ürünün Trendyol'daki rakiplerini bul
 * Roketfy'ın "Rakip Araştırması > Ürün Dedektifi" özelliği
 */
async function analyzeCompetitor(userId, { productUrl, searchQuery, categoryName }) {
    const startTime = Date.now();

    // Ürün URL'sinden detay çek
    let productDetail = null;
    if (productUrl) {
        productDetail = await trendyol.getProductDetail(productUrl);
    }

    // Arama terimi belirle
    let query = searchQuery || "";
    if (!query && productDetail) {
        // Ürün adından anahtar kelimeler çıkar
        const keywords = trendyol.extractSearchKeywords(productDetail.name);
        query = keywords.slice(0, 3).join(" ");
    }
    if (!query && categoryName) {
        query = categoryName;
    }
    if (!query) {
        query = "en çok satan";
    }

    // Rakipleri bul
    const searchResult = await trendyol.searchProducts(query, {
        sort: "BEST_SELLER",
        limit: 50,
    });

    const competitors = searchResult.products || [];

    // Fiyat analizi
    const prices = competitors.map(p => p.price).filter(p => p > 0).sort((a, b) => a - b);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices[0] || 0;
    const maxPrice = prices[prices.length - 1] || 0;

    // Marka analizi
    const brandAnalysis = {};
    competitors.forEach(p => {
        const brand = p.brand || "Bilinmiyor";
        if (!brandAnalysis[brand]) {
            brandAnalysis[brand] = { brand, productCount: 0, prices: [], totalFavorites: 0, totalReviews: 0 };
        }
        brandAnalysis[brand].productCount++;
        if (p.price > 0) brandAnalysis[brand].prices.push(p.price);
        brandAnalysis[brand].totalFavorites += p.favoriteCount || 0;
        brandAnalysis[brand].totalReviews += p.reviewCount || 0;
    });

    const topCompetitorBrands = Object.values(brandAnalysis)
        .map(b => ({
            brand: b.brand,
            productCount: b.productCount,
            avgPrice: b.prices.length > 0 ? Math.round(b.prices.reduce((a, c) => a + c, 0) / b.prices.length) : 0,
            priceRange: { min: b.prices.length > 0 ? Math.min(...b.prices) : 0, max: b.prices.length > 0 ? Math.max(...b.prices) : 0 },
            totalFavorites: b.totalFavorites,
            totalReviews: b.totalReviews,
        }))
        .sort((a, b) => b.productCount - a.productCount)
        .slice(0, 15);

    // Ürün karşılaştırma
    const productComparison = competitors.slice(0, 20).map(p => ({
        name: p.name,
        brand: p.brand,
        price: p.price,
        originalPrice: p.originalPrice,
        discountPercentage: p.discountPercentage,
        ratingScore: p.ratingScore,
        reviewCount: p.reviewCount,
        favoriteCount: p.favoriteCount,
        estimatedDailySales: p.estimatedDailySales,
        estimatedMonthlyRevenue: p.estimatedMonthlyRevenue,
        merchantName: p.merchantName,
        url: p.url,
        imageUrl: p.imageUrl,
        priceDiff: productDetail ? Math.round(((p.price - productDetail.price) / productDetail.price) * 100) : 0,
    }));

    // Anahtar kelime analizi — rakiplerin başlıklarından
    const allTitles = competitors.map(p => p.name).join(" ");
    const topKeywords = extractKeywords(allTitles, 20);

    // Güçlü/zayıf yönler
    const insights = [];
    if (productDetail) {
        if (productDetail.price > avgPrice * 1.2) {
            insights.push(`Ürününüz pazar ortalamasından %${Math.round(((productDetail.price - avgPrice) / avgPrice) * 100)} daha pahalı`);
        } else if (productDetail.price < avgPrice * 0.8) {
            insights.push(`Ürününüz pazar ortalamasından %${Math.round(((avgPrice - productDetail.price) / avgPrice) * 100)} daha ucuz — kâr marjını kontrol edin`);
        } else {
            insights.push("Fiyatınız rekabetçi bir konumda");
        }

        if (productDetail.ratingScore < 4.0 && productDetail.ratingScore > 0) {
            insights.push(`Rating'iniz (${productDetail.ratingScore}) pazar ortalamasının altında — ürün kalitesini iyileştirin`);
        }
    }

    const result = {
        searchQuery: query,
        analyzedProduct: productDetail ? {
            name: productDetail.name,
            brand: productDetail.brand,
            price: productDetail.price,
            ratingScore: productDetail.ratingScore,
            reviewCount: productDetail.reviewCount,
            favoriteCount: productDetail.favoriteCount,
            url: productDetail.url,
        } : null,
        totalCompetitors: searchResult.totalCount || competitors.length,
        priceAnalysis: {
            avgPrice, minPrice, maxPrice,
            priceRange: { min: minPrice, max: maxPrice },
        },
        topCompetitorBrands,
        productComparison,
        topKeywords: topKeywords.map(k => ({ keyword: k.keyword, count: k.count, relevance: Math.min(100, Math.round((k.count / (topKeywords[0]?.count || 1)) * 100)) })),
        insights,
        dataSource: `Trendyol'dan ${competitors.length} rakip ürün analiz edildi`,
    };

    await RoketfyAnalysis.create({
        userId,
        analysisType: "competitor_analysis",
        target: { categoryName: query, marketplace: "Trendyol" },
        competitorAnalysis: result,
        status: "completed",
        processingTimeMs: Date.now() - startTime,
    });

    return result;
}


// ═════════════════════════════════════════════════════════════════════════════
// 3. LİSTELEME ANALİSTİ — Kendi ürünlerinin Trendyol listeleme kalitesi
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Listeleme analizi — Roketfy'ın "Listeleme Analisti" özelliği
 * Kullanıcının kendi ürününü Trendyol'daki en iyi ürünlerle karşılaştırır
 */
async function analyzeListingByBarcode(userId, barcode) {
    const startTime = Date.now();

    const mapping = await ProductMapping.findOne({
        userId, "masterProduct.barcode": barcode,
    }).lean();
    if (!mapping) throw new Error(`Ürün bulunamadı: ${barcode}`);

    const mp = mapping.masterProduct;
    const product = await Product.findOne({ userId, barcode }).lean();

    // Trendyol'dan aynı kategorideki ürünleri çek — GERÇEK PAZAR VERİSİ
    const categoryKeywords = (mp.category || mp.name || "").split(/[>/,]/).map(s => s.trim()).filter(Boolean);
    const searchTerm = categoryKeywords.slice(-2).join(" ") || mp.name?.split(" ").slice(0, 3).join(" ") || "";

    const marketData = await trendyol.searchProducts(searchTerm, { sort: "BEST_SELLER", limit: 30 });
    const marketProducts = marketData.products || [];

    // Pazar fiyat ortalaması
    const marketPrices = marketProducts.map(p => p.price).filter(p => p > 0);
    const avgMarketPrice = marketPrices.length > 0 ? Math.round(marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length) : mp.price;

    // ── Başlık Analizi ──
    let titleScore = 0;
    const titleIssues = [];
    const titleSuggestions = [];
    const titleLen = (mp.name || "").length;

    if (titleLen === 0) { titleScore = 0; titleIssues.push("Başlık boş"); titleSuggestions.push("Anahtar kelime içeren başlık ekleyin"); }
    else if (titleLen < 30) { titleScore = 25; titleIssues.push("Başlık çok kısa"); titleSuggestions.push("50-120 karakter arası başlık yazın"); }
    else if (titleLen < 50) { titleScore = 50; titleSuggestions.push("Daha fazla anahtar kelime ekleyin"); }
    else if (titleLen <= 120) { titleScore = 90; }
    else if (titleLen <= 200) { titleScore = 75; titleSuggestions.push("Başlığı biraz kısaltın"); }
    else { titleScore = 50; titleIssues.push("Başlık çok uzun"); }

    // Anahtar kelime kontrolü
    const topMarketKeywords = extractKeywords(marketProducts.map(p => p.name).join(" "), 10);
    const titleLower = (mp.name || "").toLowerCase();
    const matchedKeywords = topMarketKeywords.filter(k => titleLower.includes(k.keyword));
    if (matchedKeywords.length === 0 && topMarketKeywords.length > 0) {
        titleScore = Math.max(titleScore - 15, 0);
        titleSuggestions.push(`Şu anahtar kelimeleri ekleyin: ${topMarketKeywords.slice(0, 3).map(k => k.keyword).join(", ")}`);
    } else if (matchedKeywords.length >= 3) {
        titleScore = Math.min(titleScore + 10, 100);
    }

    // ── Açıklama Analizi ──
    const descText = mp.description || product?.description || "";
    let descScore = 0;
    const descIssues = [];
    const descSuggestions = [];
    const descLen = descText.length;

    if (descLen === 0) { descScore = 0; descIssues.push("Açıklama boş"); descSuggestions.push("Detaylı ürün açıklaması ekleyin"); }
    else if (descLen < 50) { descScore = 20; descIssues.push("Açıklama çok kısa"); }
    else if (descLen < 150) { descScore = 50; descSuggestions.push("Daha detaylı açıklama yazın"); }
    else if (descLen <= 1000) { descScore = 85; }
    else { descScore = 75; }

    if (descText.includes("•") || descText.includes("-") || descText.includes("\n")) descScore = Math.min(descScore + 10, 100);
    else descSuggestions.push("Madde işaretleri kullanarak okunabilirliği artırın");

    // ── Görsel Analizi ──
    const imageCount = (mp.images || []).length;
    let imageScore = 0;
    const imageIssues = [];
    if (imageCount === 0) { imageScore = 0; imageIssues.push("Görsel yok"); }
    else if (imageCount < 3) { imageScore = 30; imageIssues.push(`Sadece ${imageCount} görsel`); }
    else if (imageCount < 5) { imageScore = 60; }
    else if (imageCount <= 8) { imageScore = 95; }
    else { imageScore = 85; }

    // ── Fiyat Analizi ──
    let priceScore = 50;
    const priceIssues = [];
    let competitiveness = "fair";
    if (marketPrices.length > 0) {
        const ratio = mp.price / avgMarketPrice;
        if (ratio < 0.7) { priceScore = 60; competitiveness = "very_low"; priceIssues.push("Fiyat pazarın çok altında"); }
        else if (ratio < 0.9) { priceScore = 80; competitiveness = "low"; }
        else if (ratio <= 1.1) { priceScore = 95; competitiveness = "fair"; }
        else if (ratio <= 1.3) { priceScore = 70; competitiveness = "high"; priceIssues.push("Fiyat pazar ortalamasının üstünde"); }
        else { priceScore = 40; competitiveness = "very_high"; priceIssues.push("Fiyat pazarın çok üstünde"); }
    }

    // ── Stok Analizi ──
    const stock = mapping.stockTracking?.totalStock || mp.stock || 0;
    let stockScore = stock === 0 ? 0 : stock < 5 ? 30 : stock < 20 ? 60 : stock <= 200 ? 95 : 85;

    // ── Genel Skor (Roketfy Skoru) ──
    const overallScore = Math.round(
        titleScore * 0.25 + descScore * 0.20 + imageScore * 0.20 +
        priceScore * 0.20 + stockScore * 0.15
    );

    // ── Öneriler ──
    const recommendations = [];
    if (titleScore < 60) recommendations.push({ category: "title", priority: titleScore < 30 ? "critical" : "high", message: "Başlık optimize edilmeli", currentValue: (mp.name || "").slice(0, 80), suggestedValue: titleSuggestions[0] || "SEO uyumlu başlık yazın" });
    if (descScore < 50) recommendations.push({ category: "description", priority: descScore < 20 ? "critical" : "high", message: "Açıklama iyileştirilmeli", currentValue: descText.slice(0, 80) || "(Boş)", suggestedValue: descSuggestions[0] || "Detaylı açıklama yazın" });
    if (imageScore < 60) recommendations.push({ category: "image", priority: imageScore === 0 ? "critical" : "high", message: `Görsel sayısı artırılmalı (${imageCount})`, currentValue: `${imageCount} görsel`, suggestedValue: "En az 5 yüksek kaliteli görsel" });
    if (priceIssues.length > 0) recommendations.push({ category: "price", priority: "medium", message: priceIssues[0], currentValue: `₺${mp.price}`, suggestedValue: `₺${Math.round(avgMarketPrice * 0.95)} - ₺${Math.round(avgMarketPrice * 1.05)}` });
    if (stock === 0) recommendations.push({ category: "stock", priority: "critical", message: "Stok yok", currentValue: "0 adet", suggestedValue: "En az 20 adet stok" });

    // Pazar karşılaştırma — en iyi 5 rakip
    const marketComparison = marketProducts.slice(0, 5).map(p => ({
        name: p.name,
        brand: p.brand,
        price: p.price,
        ratingScore: p.ratingScore,
        favoriteCount: p.favoriteCount,
        estimatedDailySales: p.estimatedDailySales,
    }));

    const result = {
        overallScore,
        grade: calculateGrade(overallScore),
        titleScore: { score: titleScore, issues: titleIssues, suggestions: titleSuggestions, charCount: titleLen },
        descriptionScore: { score: descScore, issues: descIssues, suggestions: descSuggestions, charCount: descLen },
        imageScore: { score: imageScore, imageCount, issues: imageIssues },
        priceScore: { score: priceScore, currentPrice: mp.price, marketAvgPrice: avgMarketPrice, competitiveness, issues: priceIssues, comparedWith: marketPrices.length },
        stockScore: { score: stockScore, currentStock: stock },
        seoAnalysis: {
            topMarketKeywords: topMarketKeywords.slice(0, 10),
            matchedKeywords: matchedKeywords.map(k => k.keyword),
            missingKeywords: topMarketKeywords.filter(k => !titleLower.includes(k.keyword)).slice(0, 5).map(k => k.keyword),
        },
        marketComparison,
        recommendations: recommendations.sort((a, b) => {
            const prio = { critical: 0, high: 1, medium: 2, low: 3 };
            return (prio[a.priority] || 3) - (prio[b.priority] || 3);
        }),
    };

    await RoketfyAnalysis.create({
        userId,
        analysisType: "listing_analysis",
        target: { barcode, productName: mp.name, marketplace: "Trendyol" },
        listingAnalysis: result,
        status: "completed",
        processingTimeMs: Date.now() - startTime,
    });

    return result;
}

/**
 * Tüm ürünleri toplu analiz et
 */
async function analyzeAllListings(userId) {
    const mappings = await ProductMapping.find({ userId })
        .select("masterProduct.barcode masterProduct.name").lean();

    const results = [];
    for (const m of mappings.slice(0, 50)) {
        try {
            const analysis = await analyzeListingByBarcode(userId, m.masterProduct.barcode);
            results.push({
                barcode: m.masterProduct.barcode, name: m.masterProduct.name,
                score: analysis.overallScore, grade: analysis.grade,
                criticalIssues: analysis.recommendations.filter(r => r.priority === "critical").length,
            });
        } catch (err) {
            results.push({ barcode: m.masterProduct.barcode, name: m.masterProduct.name, score: 0, grade: "F", error: err.message });
        }
    }

    const valid = results.filter(r => !r.error);
    const avgScore = valid.length > 0 ? Math.round(valid.reduce((s, r) => s + r.score, 0) / valid.length) : 0;

    return {
        totalProducts: results.length, averageScore: avgScore, averageGrade: calculateGrade(avgScore),
        gradeDistribution: {
            excellent: valid.filter(r => r.score >= 85).length,
            good: valid.filter(r => r.score >= 70 && r.score < 85).length,
            average: valid.filter(r => r.score >= 50 && r.score < 70).length,
            poor: valid.filter(r => r.score < 50).length,
        },
        criticalCount: valid.filter(r => r.criticalIssues > 0).length,
        products: results.sort((a, b) => a.score - b.score),
    };
}


// ═════════════════════════════════════════════════════════════════════════════
// 4. AI İÇERİK YAZARI — SEO uyumlu başlık/açıklama üretimi
// ═════════════════════════════════════════════════════════════════════════════

async function generateTitle(userId, { barcode, keywords = [], productInfo = "" }) {
    const startTime = Date.now();

    let product = null;
    if (barcode) {
        product = await ProductMapping.findOne({ userId, "masterProduct.barcode": barcode }).lean();
    }

    const name = product?.masterProduct?.name || productInfo || "";
    const category = product?.masterProduct?.category || "";
    const brand = product?.masterProduct?.brand || "";

    // Trendyol'dan en iyi başlıkları referans al
    const searchTerm = name.split(" ").slice(0, 3).join(" ") || keywords.slice(0, 2).join(" ") || "ürün";
    const marketData = await trendyol.searchProducts(searchTerm, { sort: "BEST_SELLER", limit: 20 });
    const bestTitles = (marketData.products || []).filter(p => p.name && p.name.length > 30).slice(0, 5).map(p => p.name);

    // Pazar anahtar kelimeleri
    const marketKeywords = extractKeywords((marketData.products || []).map(p => p.name).join(" "), 15);
    const allKeywords = [...new Set([...keywords, ...marketKeywords.map(k => k.keyword)])].slice(0, 10);

    // Başlık varyasyonları
    const titles = [];

    // V1: Marka + Ürün + Özellik
    if (brand && name) {
        const t = `${brand} ${name} ${allKeywords.slice(0, 2).join(" ")}`.trim().slice(0, 120);
        titles.push({ title: t, seoScore: Math.min(95, 60 + allKeywords.filter(kw => t.toLowerCase().includes(kw.toLowerCase())).length * 8), charCount: t.length, keywordsUsed: allKeywords.filter(kw => t.toLowerCase().includes(kw.toLowerCase())) });
    }

    // V2: Özellik odaklı
    const t2 = `${allKeywords.slice(0, 3).join(" ")} ${name} ${brand || ""}`.trim().slice(0, 120);
    titles.push({ title: t2, seoScore: Math.min(95, 55 + allKeywords.filter(kw => t2.toLowerCase().includes(kw.toLowerCase())).length * 8), charCount: t2.length, keywordsUsed: allKeywords.filter(kw => t2.toLowerCase().includes(kw.toLowerCase())) });

    // V3: En iyi rakip başlığından ilham
    if (bestTitles.length > 0) {
        titles.push({ title: bestTitles[0], seoScore: 85, charCount: bestTitles[0].length, keywordsUsed: allKeywords.filter(kw => bestTitles[0].toLowerCase().includes(kw.toLowerCase())), isReference: true });
    }

    const result = {
        contentType: "title",
        inputKeywords: allKeywords,
        inputProductInfo: name,
        generatedTitles: titles.sort((a, b) => b.seoScore - a.seoScore),
        generatedDescriptions: [],
        referenceTitles: bestTitles,
        marketKeywords: marketKeywords.slice(0, 10),
    };

    await RoketfyAnalysis.create({
        userId, analysisType: "content_generation",
        target: { barcode, productName: name },
        contentGeneration: result,
        status: "completed", processingTimeMs: Date.now() - startTime,
    });

    return result;
}

async function generateDescription(userId, { barcode, keywords = [], productInfo = "" }) {
    const startTime = Date.now();

    let product = null;
    if (barcode) product = await ProductMapping.findOne({ userId, "masterProduct.barcode": barcode }).lean();

    const name = product?.masterProduct?.name || productInfo || "Ürün";
    const category = product?.masterProduct?.category || "";
    const brand = product?.masterProduct?.brand || "";
    const attrs = product?.masterProduct?.attributes || {};

    const features = [];
    if (attrs.color) features.push(`Renk: ${attrs.color}`);
    if (attrs.size) features.push(`Beden: ${attrs.size}`);
    if (brand) features.push(`Marka: ${brand}`);

    const desc1 = [
        `${brand ? brand + " " : ""}${name} — ${category || "Premium Kalite"}`,
        "", "✨ Ürün Özellikleri:",
        ...features.map(f => `• ${f}`),
        ...(keywords.length > 0 ? [`• ${keywords.slice(0, 3).join(", ")} özellikleriyle öne çıkar`] : []),
        "", "📦 Hızlı ve güvenli kargo ile kapınıza kadar teslim.",
        "✅ Orijinal ürün garantisi.",
        ...(keywords.length > 2 ? [`\n🔍 ${keywords.join(", ")} arayanlar için ideal.`] : []),
    ].join("\n");

    const desc2 = [
        `${name}${brand ? " - " + brand : ""}`, "",
        category ? `Kategori: ${category}` : "",
        features.length > 0 ? features.join(" | ") : "",
        "", keywords.length > 0 ? `Özellikler: ${keywords.join(", ")}` : "",
        "", "Hızlı kargo • Kolay iade • Güvenli alışveriş",
    ].filter(Boolean).join("\n");

    const descriptions = [
        { description: desc1, seoScore: Math.min(95, 60 + keywords.filter(kw => desc1.toLowerCase().includes(kw.toLowerCase())).length * 5), charCount: desc1.length, keywordsUsed: keywords.filter(kw => desc1.toLowerCase().includes(kw.toLowerCase())), hasBulletPoints: true },
        { description: desc2, seoScore: Math.min(90, 55 + keywords.filter(kw => desc2.toLowerCase().includes(kw.toLowerCase())).length * 5), charCount: desc2.length, keywordsUsed: keywords.filter(kw => desc2.toLowerCase().includes(kw.toLowerCase())), hasBulletPoints: false },
    ];

    const result = {
        contentType: "description", inputKeywords: keywords, inputProductInfo: name,
        generatedTitles: [], generatedDescriptions: descriptions.sort((a, b) => b.seoScore - a.seoScore),
        targetKeywords: keywords,
    };

    await RoketfyAnalysis.create({
        userId, analysisType: "content_generation",
        target: { barcode, productName: name },
        contentGeneration: result,
        status: "completed", processingTimeMs: Date.now() - startTime,
    });

    return result;
}


// ═════════════════════════════════════════════════════════════════════════════
// 5. YORUM ANALİZİ — Trendyol ürün yorumlarını NLP ile analiz et
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Yorum analizi — Bir Trendyol ürününün yorumlarını analiz et
 * Roketfy'ın "Yorum Analizi" özelliği
 * @param {string} contentId - Trendyol content ID veya ürün URL'si
 */
async function analyzeReviews(userId, { contentId, productUrl, barcode }) {
    const startTime = Date.now();

    // Ürün URL'sini belirle
    let resolvedUrl = productUrl || "";
    if (!resolvedUrl && contentId) {
        // Content ID varsa arama yaparak URL bul
        const searchResult = await trendyol.searchProducts(String(contentId), { limit: 5 });
        const found = searchResult.products.find(p => String(p.contentId) === String(contentId));
        if (found?.url) resolvedUrl = found.url;
    }
    if (!resolvedUrl && barcode) {
        // Kendi ürünümüzden Trendyol URL bul
        const mapping = await ProductMapping.findOne({ userId, "masterProduct.barcode": barcode }).lean();
        if (mapping) {
            const trendyolMapping = (mapping.marketplaceMappings || []).find(m => m.marketplaceName === "Trendyol");
            if (trendyolMapping?.marketplaceUrl) resolvedUrl = trendyolMapping.marketplaceUrl;
            else if (trendyolMapping?.marketplaceProductId) {
                // Content ID ile arama yap
                const sr = await trendyol.searchProducts(String(trendyolMapping.marketplaceProductId), { limit: 5 });
                const f = sr.products.find(p => String(p.contentId) === String(trendyolMapping.marketplaceProductId));
                if (f?.url) resolvedUrl = f.url;
            }
        }
    }

    if (!resolvedUrl) throw new Error("Ürün URL'si, Content ID veya barkod gerekli");

    // Trendyol'dan yorumları çek (URL ile)
    const reviewData = await trendyol.getProductReviews(resolvedUrl);
    const reviews = reviewData.reviews || [];

    // Ürün detayını da çek (URL ile)
    const productDetail = await trendyol.getProductDetail(resolvedUrl);

    // Duygu analizi
    let positiveCount = 0, negativeCount = 0, neutralCount = 0;
    reviews.forEach(r => {
        const sent = analyzeSentiment(r.comment);
        if (sent.sentiment === "positive") positiveCount++;
        else if (sent.sentiment === "negative") negativeCount++;
        else neutralCount++;
    });

    const total = positiveCount + negativeCount + neutralCount;
    const positivePercent = total > 0 ? Math.round((positiveCount / total) * 100) : 50;
    const negativePercent = total > 0 ? Math.round((negativeCount / total) * 100) : 10;
    const neutralPercent = Math.max(0, 100 - positivePercent - negativePercent);

    // Konu analizi
    const topicKeywords = {
        "Kargo & Teslimat": ["kargo", "teslimat", "gönderi", "paket", "hızlı geldi", "geç geldi"],
        "Ürün Kalitesi": ["kalite", "kaliteli", "kalitesiz", "malzeme", "kumaş", "dikiş", "sağlam"],
        "Fiyat & Değer": ["fiyat", "pahalı", "ucuz", "uygun", "değer", "para", "indirim"],
        "Beden & Ölçü": ["beden", "ölçü", "büyük", "küçük", "dar", "geniş", "kalıp"],
        "Renk & Görünüm": ["renk", "görünüm", "fotoğraf", "farklı", "güzel", "şık"],
    };

    const topicAnalysis = [];
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
        let mentions = 0, posMentions = 0, negMentions = 0;
        const samples = [];
        reviews.forEach(r => {
            const lower = (r.comment || "").toLowerCase();
            if (keywords.some(kw => lower.includes(kw))) {
                mentions++;
                const sent = analyzeSentiment(r.comment);
                if (sent.sentiment === "positive") posMentions++;
                else if (sent.sentiment === "negative") negMentions++;
                if (samples.length < 2) samples.push(r.comment.slice(0, 120));
            }
        });
        if (mentions > 0) {
            topicAnalysis.push({
                topic, mentionCount: mentions,
                sentiment: posMentions > negMentions * 2 ? "positive" : negMentions > posMentions * 2 ? "negative" : "mixed",
                percentage: total > 0 ? Math.round((mentions / total) * 100) : 0,
                sampleReviews: samples,
            });
        }
    });

    // Güçlü/zayıf yönler
    const strengths = [];
    const weaknesses = [];
    if (positivePercent > 70) strengths.push("Yüksek müşteri memnuniyeti");
    if (reviewData.averageRating >= 4.5) strengths.push(`Mükemmel rating (${reviewData.averageRating})`);
    if (negativePercent > 30) weaknesses.push("Negatif yorum oranı yüksek");
    topicAnalysis.forEach(t => {
        if (t.sentiment === "negative" && t.mentionCount > 3) weaknesses.push(`${t.topic} konusunda şikayetler var`);
        if (t.sentiment === "positive" && t.mentionCount > 3) strengths.push(`${t.topic} konusunda olumlu geri bildirimler`);
    });

    // Müşteri anahtar kelimeleri
    const customerKeywords = extractKeywords(reviews.map(r => r.comment).join(" "), 15)
        .map(k => ({ ...k, sentiment: analyzeSentiment(reviews.find(r => (r.comment || "").toLowerCase().includes(k.keyword))?.comment || "").sentiment }));

    const cId = contentId || (productDetail?.id ? String(productDetail.id) : "");

    const result = {
        contentId: cId,
        productName: productDetail?.name || "",
        productBrand: productDetail?.brand || "",
        productPrice: productDetail?.price || 0,
        productUrl: productDetail?.url || "",
        totalReviews: reviewData.totalCount || reviews.length,
        averageRating: reviewData.averageRating || 0,
        ratingDistribution: reviewData.ratingDistribution || {},
        sentimentBreakdown: { positive: positivePercent, neutral: neutralPercent, negative: negativePercent },
        topicAnalysis: topicAnalysis.sort((a, b) => b.mentionCount - a.mentionCount),
        customerKeywords,
        strengths, weaknesses,
        recentReviews: reviews.slice(0, 20).map(r => ({
            comment: r.comment, rate: r.rate, userName: r.userName,
            createdDate: r.createdDate, likes: r.likes,
            sentiment: analyzeSentiment(r.comment).sentiment,
        })),
        dataSource: `Trendyol'dan ${reviews.length} yorum analiz edildi`,
        aiSummary: `${productDetail?.name || "Ürün"} için ${reviews.length} yorum analiz edildi. ` +
            `Ortalama puan: ${reviewData.averageRating || 0}/5. ` +
            `Duygu dağılımı: %${positivePercent} pozitif, %${neutralPercent} nötr, %${negativePercent} negatif. ` +
            (strengths.length > 0 ? `Güçlü yönler: ${strengths.join(", ")}. ` : "") +
            (weaknesses.length > 0 ? `İyileştirme alanları: ${weaknesses.join(", ")}.` : ""),
    };

    await RoketfyAnalysis.create({
        userId, analysisType: "review_analysis",
        target: { barcode: barcode || cId, productName: productDetail?.name || "", marketplace: "Trendyol" },
        reviewAnalysis: result,
        status: "completed", processingTimeMs: Date.now() - startTime,
    });

    return result;
}


// ═════════════════════════════════════════════════════════════════════════════
// 6. ANAHTAR KELİME ARAŞTIRMASI — Trendyol pazar verilerinden
// ═════════════════════════════════════════════════════════════════════════════

async function researchKeywords(userId, { seedKeyword }) {
    const startTime = Date.now();

    const keywordAnalysis = await trendyol.analyzeKeyword(seedKeyword);

    // Anahtar kelime listesi oluştur
    const keywords = [];

    // Ana kelime
    keywords.push({
        keyword: seedKeyword,
        searchVolume: keywordAnalysis.totalProducts,
        productCount: keywordAnalysis.totalProducts,
        competition: keywordAnalysis.competitionLevel,
        relevanceScore: 95,
        avgPrice: keywordAnalysis.priceStats.avg,
        trend: "stable",
    });

    // İlgili kelimeler (Trendyol arama önerilerinden)
    const suggestions = await trendyol.getSearchSuggestions(seedKeyword);
    const relatedKeywords = suggestions.suggestions || [];
    for (const related of relatedKeywords.slice(0, 10)) {
        const relKeyword = related.keyword || related;
        if (relKeyword && relKeyword !== seedKeyword) {
            const relResult = await trendyol.searchProducts(relKeyword, { limit: 5 });
            keywords.push({
                keyword: relKeyword,
                searchVolume: relResult.totalCount || 0,
                productCount: relResult.totalCount || 0,
                competition: relResult.totalCount > 5000 ? "high" : relResult.totalCount > 1000 ? "medium" : "low",
                relevanceScore: Math.min(85, 50 + (relKeyword.includes(seedKeyword) ? 30 : 0)),
                avgPrice: 0,
                trend: "stable",
            });
        }
    }

    // Uzun kuyruk varyasyonları
    const longTailPrefixes = ["en iyi", "ucuz", "kaliteli", "orijinal"];
    const longTailSuffixes = ["fiyat", "modelleri", "çeşitleri", "indirim"];

    for (const prefix of longTailPrefixes) {
        const kw = `${prefix} ${seedKeyword}`;
        keywords.push({
            keyword: kw, searchVolume: 0, productCount: 0,
            competition: "low", relevanceScore: 70, avgPrice: 0, trend: "stable",
        });
    }
    for (const suffix of longTailSuffixes) {
        const kw = `${seedKeyword} ${suffix}`;
        keywords.push({
            keyword: kw, searchVolume: 0, productCount: 0,
            competition: "low", relevanceScore: 65, avgPrice: 0, trend: "stable",
        });
    }

    const result = {
        seedKeyword,
        totalMarketProducts: keywordAnalysis.totalProducts,
        priceStats: keywordAnalysis.priceStats,
        topBrands: keywordAnalysis.topBrands,
        keywords: keywords.sort((a, b) => b.searchVolume - a.searchVolume),
        topProducts: keywordAnalysis.topProducts,
    };

    await RoketfyAnalysis.create({
        userId, analysisType: "keyword_research",
        target: { marketplace: "Trendyol" },
        keywordResearch: result,
        status: "completed", processingTimeMs: Date.now() - startTime,
    });

    return result;
}


// ═════════════════════════════════════════════════════════════════════════════
// 7. FİYAT ÖNERİSİ — Trendyol pazar fiyatlarına göre
// ═════════════════════════════════════════════════════════════════════════════

async function suggestPrice(userId, { barcode }) {
    const startTime = Date.now();

    const product = await ProductMapping.findOne({ userId, "masterProduct.barcode": barcode }).lean();
    if (!product) throw new Error(`Ürün bulunamadı: ${barcode}`);

    const currentPrice = product.masterProduct.price;
    const name = product.masterProduct.name || "";

    // Trendyol'dan aynı ürünlerin fiyatlarını çek
    const searchTerm = name.split(" ").slice(0, 3).join(" ");
    const marketData = await trendyol.searchProducts(searchTerm, { sort: "BEST_SELLER", limit: 30 });
    const marketProducts = marketData.products || [];

    const prices = marketProducts.map(p => p.price).filter(p => p > 0).sort((a, b) => a - b);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : currentPrice;
    const minPrice = prices[0] || currentPrice * 0.7;
    const maxPrice = prices[prices.length - 1] || currentPrice * 1.3;
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : currentPrice;

    // Maliyet bilgisi
    const productDetail = await Product.findOne({ userId, barcode }).lean();
    const costPrice = productDetail?.costPrice || 0;

    // Optimal fiyat
    let suggestedPrice = medianPrice;
    let reasoning = "";

    if (currentPrice > avgPrice * 1.2) {
        suggestedPrice = Math.round(avgPrice * 1.05);
        reasoning = `Fiyatınız (₺${currentPrice}) Trendyol ortalamasının (₺${avgPrice}) %${Math.round(((currentPrice - avgPrice) / avgPrice) * 100)} üzerinde. ${prices.length} rakip analiz edildi. ₺${suggestedPrice} önerilir.`;
    } else if (currentPrice < avgPrice * 0.8) {
        suggestedPrice = Math.round(avgPrice * 0.9);
        reasoning = `Fiyatınız (₺${currentPrice}) Trendyol ortalamasının (₺${avgPrice}) %${Math.round(((avgPrice - currentPrice) / avgPrice) * 100)} altında. Kâr marjını artırmak için ₺${suggestedPrice} önerilir.`;
    } else {
        suggestedPrice = Math.round(currentPrice);
        reasoning = `Fiyatınız (₺${currentPrice}) rekabetçi. Trendyol ortalaması ₺${avgPrice} (${prices.length} rakip). Fiyatınızı koruyabilirsiniz.`;
    }

    if (costPrice > 0) {
        const margin = ((suggestedPrice - costPrice) / suggestedPrice) * 100;
        reasoning += ` Maliyet: ₺${costPrice}, kâr marjı: %${Math.round(margin)}.`;
    }

    const competitorPrices = marketProducts.slice(0, 15).map(p => ({
        sellerName: p.brand || p.merchantName || "Satıcı",
        productName: (p.name || "").slice(0, 60),
        price: p.price,
        marketplace: "Trendyol",
        ratingScore: p.ratingScore,
        favoriteCount: p.favoriteCount,
    }));

    const result = {
        currentPrice, suggestedPrice: Math.round(suggestedPrice),
        minPrice: Math.round(minPrice), maxPrice: Math.round(maxPrice),
        marketAvgPrice: Math.round(avgPrice), medianPrice: Math.round(medianPrice),
        analyzedProductCount: prices.length,
        competitorPrices,
        costPrice,
        profitMargin: costPrice > 0 ? Math.round(((suggestedPrice - costPrice) / suggestedPrice) * 100) : null,
        reasoning,
    };

    await RoketfyAnalysis.create({
        userId, analysisType: "price_suggestion",
        target: { barcode, productName: name },
        priceSuggestion: result,
        status: "completed", processingTimeMs: Date.now() - startTime,
    });

    return result;
}


// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

async function getDashboard(userId) {
    const totalProducts = await ProductMapping.countDocuments({ userId });
    const products = await ProductMapping.find({ userId }).lean();

    const recentAnalyses = await RoketfyAnalysis.find({ userId, status: "completed" })
        .sort({ createdAt: -1 }).limit(20).lean();

    const listingAnalyses = recentAnalyses.filter(a => a.analysisType === "listing_analysis");
    const avgListingScore = listingAnalyses.length > 0
        ? Math.round(listingAnalyses.reduce((s, a) => s + (a.listingAnalysis?.overallScore || 0), 0) / listingAnalyses.length) : 0;

    const outOfStock = products.filter(p => (p.stockTracking?.totalStock || 0) === 0).length;
    const lowStock = products.filter(p => p.stockTracking?.isLowStock).length;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = await Order.find({ user: userId, orderDate: { $gte: thirtyDaysAgo } }).lean();
    const monthlyRevenue = recentOrders.reduce((s, o) => s + (o.totalPrice || 0), 0);

    const categoryMap = {};
    products.forEach(p => {
        const cat = p.masterProduct?.category?.split(">")[0]?.trim() || "Diğer";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    const marketplaceMap = {};
    products.forEach(p => {
        (p.marketplaceMappings || []).forEach(mm => {
            marketplaceMap[mm.marketplaceName || "Diğer"] = (marketplaceMap[mm.marketplaceName || "Diğer"] || 0) + 1;
        });
    });

    return {
        overview: {
            totalProducts, avgListingScore, avgListingGrade: calculateGrade(avgListingScore),
            outOfStock, lowStock,
            monthlyRevenue: Math.round(monthlyRevenue), monthlyOrders: recentOrders.length,
        },
        topCategories: Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        marketplaceDistribution: Object.entries(marketplaceMap).map(([name, count]) => ({ name, count })),
        recentAnalyses: recentAnalyses.slice(0, 10).map(a => ({
            id: a._id, type: a.analysisType, target: a.target, status: a.status,
            score: a.listingAnalysis?.overallScore || null, createdAt: a.createdAt,
        })),
        trendyolCategories: trendyol.getCategories(),
    };
}

async function getAnalysisHistory(userId, { type, limit = 20, page = 0 }) {
    const filter = { userId, status: "completed" };
    if (type) filter.analysisType = type;
    const total = await RoketfyAnalysis.countDocuments(filter);
    const analyses = await RoketfyAnalysis.find(filter).sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean();
    return {
        total, page, limit,
        analyses: analyses.map(a => ({
            id: a._id, type: a.analysisType, target: a.target, status: a.status,
            score: a.listingAnalysis?.overallScore || null, grade: a.listingAnalysis?.grade || null,
            processingTimeMs: a.processingTimeMs, createdAt: a.createdAt,
        })),
    };
}


// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Ürün Araştırması (Trendyol pazar verisi)
    researchProducts,
    getBestSellers,
    getCategories,
    // Rakip Araştırması
    analyzeCompetitor,
    // Listeleme Analisti
    analyzeListingByBarcode,
    analyzeAllListings,
    // AI İçerik Yazarı
    generateTitle,
    generateDescription,
    // Yorum Analizi
    analyzeReviews,
    // Anahtar Kelime
    researchKeywords,
    // Fiyat Önerisi
    suggestPrice,
    // Dashboard
    getDashboard,
    getAnalysisHistory,
};
