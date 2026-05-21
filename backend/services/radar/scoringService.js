/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SCORING SERVICE — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Her ürün fırsatı için 7 boyutlu skor hesaplar:
 *   1. Trend Skoru        — Ürün/keyword ne kadar trend? (Google + Trendyol)
 *   2. Talep Skoru        — Pazar talebi ne kadar yüksek?
 *   3. Rekabet Skoru      — Rekabet ne kadar düşük? (düşük rekabet = yüksek skor)
 *   4. Kâr Skoru          — Kâr potansiyeli ne kadar yüksek?
 *   5. Kullanıcı Uyumu    — Kullanıcının mevcut işine ne kadar uygun?
 *   6. Sosyal Medya Skoru — Instagram + TikTok etkileşimi (YENİ)
 *   7. Amazon Fırsat Skoru— Amazon pazar fırsatı (YENİ)
 *
 * Opportunity Score Formülü:
 *   score = (trend * 0.20) + (demand * 0.20) + (competition * 0.15)
 *         + (profit * 0.15) + (userFit * 0.10) + (social * 0.10) + (amazon * 0.10)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");

// ── Skor Ağırlıkları (toplam = 1.0) ──
const WEIGHTS = {
    trend: 0.20,
    demand: 0.20,
    competition: 0.15,
    profit: 0.15,
    userFit: 0.10,
    social: 0.10,
    amazon: 0.10,
};

/**
 * Tüm skorları hesapla
 * @param {object} params
 * @param {object} params.trendData       — trendService çıktısı (v2 — çoklu kaynak)
 * @param {object} params.marketData      — marketplaceDataService çıktısı (Trendyol + Amazon)
 * @param {object} params.userData        — kullanıcının kendi satış verisi
 * @param {string} params.keyword         — anahtar kelime
 * @param {string} params.category        — kategori adı
 * @returns {object} { scores, totalScore, profitAnalysis }
 */
function calculateScores({ trendData, marketData, userData, keyword, category, nicheCluster }) {
    const scores = {
        trend: calculateTrendScore(trendData),
        demand: calculateDemandScore(marketData, trendData),
        competition: calculateCompetitionScore(marketData),
        profit: calculateProfitScore(marketData),
        userFit: calculateUserFitScore(userData, category, keyword, nicheCluster),
        social: calculateSocialScore(trendData),
        amazon: calculateAmazonScore(marketData),
    };

    // Toplam skor — ağırlıklı ortalama
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(WEIGHTS)) {
        const score = scores[key];
        if (score !== undefined && score !== null) {
            totalScore += score * weight;
            totalWeight += weight;
        }
    }

    // Ağırlıkları normalize et (sosyal/amazon verisi yoksa diğerleri ağırlık kazanır)
    if (totalWeight > 0 && totalWeight < 1) {
        totalScore = totalScore / totalWeight;
    }

    totalScore = Math.round(totalScore);

    // Kâr analizi
    const profitAnalysis = calculateProfitAnalysis(marketData);

    return { scores, totalScore, profitAnalysis };
}

// ═════════════════════════════════════════════════════════════════════════════
// SKOR HESAPLAMA FONKSİYONLARI
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 1. TREND SKORU — Ürün ne kadar trend? (Google Trends + Trendyol + çoklu kaynak)
 */
function calculateTrendScore(trendData) {
    if (!trendData) return 30;

    let score = 0;

    // Birleşik trend skoru (zaten 0-100, çoklu kaynak)
    const compositeTrend = trendData.trendScore || 0;
    score += compositeTrend * 0.4;

    // Trend yönü bonusu
    const directionBonus = {
        breakout: 30,
        rising: 20,
        stable: 10,
        declining: 0,
        unknown: 5,
    };
    score += directionBonus[trendData.trendDirection] || 5;

    // Haftalık değişim bonusu
    const weeklyChange = trendData.weeklyChange || 0;
    if (weeklyChange > 20) score += 15;
    else if (weeklyChange > 10) score += 10;
    else if (weeklyChange > 0) score += 5;

    // Veri kaynağı zenginliği bonusu (çok kaynak = güvenilir sinyal)
    const sourceCount = trendData.dataSourceCount || 0;
    if (sourceCount >= 4) score += 10;
    else if (sourceCount >= 3) score += 7;
    else if (sourceCount >= 2) score += 4;

    // Google Trends breakout bonusu
    if (trendData.googleTrends?.isBreakout) score += 10;

    // Mevsimsellik bonusu
    const currentMonth = new Date().getMonth();
    const seasonality = trendData.seasonality || "her_mevsim";
    if (seasonality === "her_mevsim") score += 5;
    else if (seasonality === "yaz" && currentMonth >= 4 && currentMonth <= 8) score += 10;
    else if (seasonality === "kış" && (currentMonth >= 10 || currentMonth <= 2)) score += 10;
    else if (seasonality === "okul_dönemi" && currentMonth >= 7 && currentMonth <= 9) score += 10;

    return clamp(Math.round(score), 0, 100);
}

/**
 * 2. TALEP SKORU — Pazar talebi ne kadar yüksek?
 */
function calculateDemandScore(marketData, trendData) {
    if (!marketData) return 30;

    let score = 0;

    // Toplam ürün sayısı
    const totalProducts = marketData.totalProducts || 0;
    if (totalProducts > 10000) score += 25;
    else if (totalProducts > 5000) score += 20;
    else if (totalProducts > 1000) score += 15;
    else if (totalProducts > 100) score += 10;
    else score += 5;

    // Ortalama yorum sayısı
    const avgReviews = marketData.avgReviewCount || 0;
    if (avgReviews > 500) score += 25;
    else if (avgReviews > 100) score += 20;
    else if (avgReviews > 50) score += 15;
    else if (avgReviews > 10) score += 10;
    else score += 5;

    // Ortalama rating
    const avgRating = marketData.avgRating || 0;
    if (avgRating >= 4.5) score += 15;
    else if (avgRating >= 4.0) score += 12;
    else if (avgRating >= 3.5) score += 8;
    else score += 3;

    // Tahmini aylık satış
    const monthlySales = marketData.estimatedMonthlySales || 0;
    if (monthlySales > 5000) score += 15;
    else if (monthlySales > 1000) score += 12;
    else if (monthlySales > 500) score += 8;
    else score += 3;

    // Arama hacmi bonusu
    const searchVolume = trendData?.searchVolume || 0;
    if (searchVolume > 5000) score += 10;
    else if (searchVolume > 1000) score += 5;

    // Amazon talep bonusu (çapraz pazar talebi)
    if (marketData.amazonData?.estimatedMonthlySales > 100) score += 10;
    else if (marketData.amazonData?.totalProducts > 1000) score += 5;

    return clamp(Math.round(score), 0, 100);
}

/**
 * 3. REKABET SKORU — Rekabet ne kadar düşük? (düşük rekabet = yüksek skor)
 */
function calculateCompetitionScore(marketData) {
    if (!marketData) return 50;

    let score = 100;

    // Satıcı sayısı
    const sellerCount = marketData.sellerCount || 0;
    if (sellerCount > 100) score -= 35;
    else if (sellerCount > 50) score -= 25;
    else if (sellerCount > 20) score -= 15;
    else if (sellerCount > 10) score -= 10;

    // Toplam ürün sayısı
    const totalProducts = marketData.totalProducts || 0;
    if (totalProducts > 10000) score -= 25;
    else if (totalProducts > 5000) score -= 15;
    else if (totalProducts > 1000) score -= 10;

    // Ortalama yorum sayısı (yerleşik oyuncular)
    const avgReviews = marketData.avgReviewCount || 0;
    if (avgReviews > 1000) score -= 20;
    else if (avgReviews > 500) score -= 15;
    else if (avgReviews > 100) score -= 10;

    // Marka yoğunluğu
    const brandCount = (marketData.topBrands || []).length;
    if (brandCount <= 1) score -= 10;
    else if (brandCount >= 4) score += 5;

    // Amazon rekabet karşılaştırması (Trendyol'da az rekabet ama Amazon'da çok = fırsat)
    if (marketData.crossMarketAnalysis?.competitionComparison) {
        const comp = marketData.crossMarketAnalysis.competitionComparison;
        if (comp.lessCompetitiveOn === "trendyol") score += 10;
    }

    return clamp(Math.round(score), 0, 100);
}

/**
 * 4. KÂR SKORU — Kâr potansiyeli ne kadar yüksek?
 */
function calculateProfitScore(marketData) {
    if (!marketData) return 40;

    let score = 0;

    const avgPrice = marketData.avgPrice || 0;
    const minPrice = marketData.minPrice || 0;
    const maxPrice = marketData.maxPrice || 0;

    // Fiyat aralığı genişliği
    const priceRange = maxPrice - minPrice;
    const priceSpread = avgPrice > 0 ? (priceRange / avgPrice) * 100 : 0;
    if (priceSpread > 100) score += 20;
    else if (priceSpread > 50) score += 15;
    else if (priceSpread > 25) score += 10;
    else score += 5;

    // Ortalama fiyat seviyesi
    if (avgPrice > 500) score += 20;
    else if (avgPrice > 200) score += 15;
    else if (avgPrice > 100) score += 12;
    else if (avgPrice > 50) score += 8;
    else score += 3;

    // Tahmini marj
    const estimatedMargin = avgPrice > 0 ? 30 : 0;
    if (estimatedMargin > 35) score += 20;
    else if (estimatedMargin > 25) score += 15;
    else if (estimatedMargin > 15) score += 10;
    else score += 3;

    // Aylık ciro potansiyeli
    const monthlyRevenue = marketData.estimatedMonthlyRevenue || 0;
    if (monthlyRevenue > 100000) score += 20;
    else if (monthlyRevenue > 50000) score += 15;
    else if (monthlyRevenue > 10000) score += 10;
    else score += 3;

    // Arbitraj fırsatı bonusu
    if (marketData.crossMarketAnalysis?.arbitrageOpportunity) {
        const margin = marketData.crossMarketAnalysis.arbitrageDetails?.potentialMargin || 0;
        if (margin > 30) score += 20;
        else if (margin > 20) score += 15;
        else score += 10;
    }

    return clamp(Math.round(score), 0, 100);
}

/**
 * 5. KULLANICI UYUM SKORU
 */
function calculateUserFitScore(userData, category, keyword, nicheCluster) {
    if (!userData || !userData.categories || userData.categories.length === 0) {
        return 50;
    }

    let score = 0;
    const userCategories = userData.categories.map(c => (c.name || "").toLowerCase());
    const targetCategory = (category || "").toLowerCase();
    const targetKeyword = (keyword || "").toLowerCase();
    const cluster = nicheCluster || "other";
    const clusterCounts = userData.productCountByCluster || {};
    const clusterProductCount = Number(clusterCounts[cluster]) || 0;

    if (cluster !== "other" && clusterProductCount > 0) {
        score += 25;
        if (clusterProductCount >= 5) score += 10;
    }

    // Aynı kategori
    const exactMatch = userCategories.some(c => c === targetCategory || c.includes(targetCategory) || targetCategory.includes(c));
    if (exactMatch) score += 40;

    // Yakın kategori
    if (!exactMatch) {
        const partialMatch = userCategories.some(c => {
            const words1 = c.split(/[\s>/]+/).filter(w => w.length > 2);
            const words2 = targetCategory.split(/[\s>/]+/).filter(w => w.length > 2);
            return words1.some(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)));
        });
        if (partialMatch) score += 25;
    }

    // Ürün sayısı (deneyim)
    const productCount = userData.productCount || 0;
    if (productCount > 50) score += 15;
    else if (productCount > 20) score += 10;
    else if (productCount > 5) score += 5;

    // Sipariş hacmi
    const orderCount = userData.orderCount || 0;
    if (orderCount > 100) score += 15;
    else if (orderCount > 30) score += 10;
    else if (orderCount > 10) score += 5;

    // Kâr marjı uyumu
    const avgMargin = userData.avgMargin || 0;
    if (avgMargin > 20) score += 10;
    else if (avgMargin > 10) score += 7;
    else score += 3;

    // Keyword ürün isimlerinde geçiyor mu?
    const topProducts = userData.topProducts || [];
    const keywordInProducts = topProducts.some(p =>
        (p.name || "").toLowerCase().includes(targetKeyword)
    );
    if (keywordInProducts) score += 15;

    return clamp(Math.round(score), 0, 100);
}

/**
 * 6. SOSYAL MEDYA SKORU (YENİ) — Instagram + TikTok etkileşimi
 */
function calculateSocialScore(trendData) {
    if (!trendData || !trendData.socialMedia) return null; // null = veri yok, ağırlıktan çıkar

    const social = trendData.socialMedia;
    let score = 0;

    // Instagram
    const ig = social.instagram;
    if (ig) {
        if (ig.hashtagPostCount > 100000) score += 20;
        else if (ig.hashtagPostCount > 50000) score += 15;
        else if (ig.hashtagPostCount > 10000) score += 10;
        else if (ig.hashtagPostCount > 0) score += 5;

        if (ig.engagementRate > 5) score += 15;
        else if (ig.engagementRate > 3) score += 10;
        else if (ig.engagementRate > 1) score += 5;
    }

    // TikTok
    const tt = social.tiktok;
    if (tt) {
        if (tt.isViral) score += 25;
        else if (tt.avgViews > 50000) score += 15;
        else if (tt.avgViews > 10000) score += 10;
        else if (tt.videoCount > 0) score += 5;

        if (tt.engagementRate > 10) score += 15;
        else if (tt.engagementRate > 5) score += 10;
        else if (tt.engagementRate > 1) score += 5;
    }

    // Sosyal medya verisi var ama düşükse minimum skor
    if (score === 0 && (ig || tt)) score = 10;

    return clamp(Math.round(score), 0, 100);
}

/**
 * 7. AMAZON FIRSAT SKORU (YENİ) — Amazon pazar fırsatı
 */
function calculateAmazonScore(marketData) {
    if (!marketData || !marketData.amazonData) return null; // null = veri yok

    const amazon = marketData.amazonData;
    let score = 0;

    // Amazon'da ürün var mı?
    if (amazon.totalProducts > 1000) score += 15;
    else if (amazon.totalProducts > 100) score += 10;
    else if (amazon.totalProducts > 0) score += 5;

    // BSR (düşük = iyi)
    if (amazon.avgBSR > 0 && amazon.avgBSR < 1000) score += 25;
    else if (amazon.avgBSR < 5000) score += 20;
    else if (amazon.avgBSR < 50000) score += 15;
    else if (amazon.avgBSR > 0) score += 5;

    // Tahmini satış
    if (amazon.estimatedMonthlySales > 500) score += 20;
    else if (amazon.estimatedMonthlySales > 100) score += 15;
    else if (amazon.estimatedMonthlySales > 10) score += 10;
    else score += 3;

    // Arbitraj fırsatı
    if (marketData.crossMarketAnalysis?.arbitrageOpportunity) score += 20;

    // Rating kalitesi
    if (amazon.avgRating >= 4.0) score += 10;
    else if (amazon.avgRating >= 3.5) score += 5;

    return clamp(Math.round(score), 0, 100);
}

/**
 * Kâr analizi hesapla (Trendyol + Amazon çapraz)
 */
function calculateProfitAnalysis(marketData) {
    if (!marketData || !marketData.avgPrice) {
        return {
            estimatedCost: 0,
            suggestedPrice: 0,
            estimatedMargin: 0,
            estimatedMonthlyProfit: 0,
            commissionRate: 18,
            amazonComparison: null,
        };
    }

    const avgPrice = marketData.avgPrice;
    const commissionRate = 18;
    const estimatedCost = Math.round(avgPrice * 0.45);
    const commission = avgPrice * (commissionRate / 100);
    const shippingCost = avgPrice > 200 ? 15 : 10;
    const netProfit = avgPrice - estimatedCost - commission - shippingCost;
    const margin = avgPrice > 0 ? (netProfit / avgPrice) * 100 : 0;

    const monthlySales = marketData.estimatedMonthlySales || 0;
    const estimatedUserSales = Math.max(1, Math.round(monthlySales * 0.02));
    const estimatedMonthlyProfit = Math.round(netProfit * estimatedUserSales);

    // Amazon karşılaştırması
    let amazonComparison = null;
    if (marketData.amazonData && marketData.amazonData.avgPrice > 0) {
        const amazonPrice = marketData.amazonData.avgPrice;
        const amazonCommission = amazonPrice * 0.15; // Amazon ortalama %15
        const amazonShipping = 20; // FBA tahmini
        const amazonCost = Math.round(amazonPrice * 0.40);
        const amazonNetProfit = amazonPrice - amazonCost - amazonCommission - amazonShipping;
        const amazonMargin = amazonPrice > 0 ? (amazonNetProfit / amazonPrice) * 100 : 0;

        amazonComparison = {
            avgPrice: amazonPrice,
            estimatedCost: amazonCost,
            commissionRate: 15,
            estimatedMargin: Math.round(amazonMargin * 10) / 10,
            netProfitPerUnit: Math.round(amazonNetProfit),
            betterMarginOn: margin > amazonMargin ? "trendyol" : "amazon",
        };
    }

    return {
        estimatedCost: Math.round(estimatedCost),
        suggestedPrice: Math.round(avgPrice * 0.95),
        estimatedMargin: Math.round(margin * 10) / 10,
        estimatedMonthlyProfit: Math.max(0, estimatedMonthlyProfit),
        commissionRate,
        amazonComparison,
    };
}

// ── Yardımcı ──
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

module.exports = {
    calculateScores,
    WEIGHTS,
};
