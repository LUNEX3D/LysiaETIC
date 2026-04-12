/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SCORING SERVICE — LysiaRadar PRO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Her ürün fırsatı için 5 boyutlu skor hesaplar:
 *   1. Trend Skoru      — Ürün/keyword ne kadar trend?
 *   2. Talep Skoru      — Pazar talebi ne kadar yüksek?
 *   3. Rekabet Skoru    — Rekabet ne kadar düşük? (düşük rekabet = yüksek skor)
 *   4. Kâr Skoru        — Kâr potansiyeli ne kadar yüksek?
 *   5. Kullanıcı Uyumu  — Kullanıcının mevcut işine ne kadar uygun?
 *
 * Toplam skor: Ağırlıklı ortalama → 0-100 arası
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");

// ── Skor Ağırlıkları ──
const WEIGHTS = {
    trend: 0.20,
    demand: 0.25,
    competition: 0.20,
    profit: 0.20,
    userFit: 0.15,
};

/**
 * Tüm skorları hesapla
 * @param {object} params
 * @param {object} params.trendData    — trendService çıktısı
 * @param {object} params.marketData   — marketplaceDataService çıktısı
 * @param {object} params.userData     — kullanıcının kendi satış verisi
 * @param {string} params.keyword      — anahtar kelime
 * @param {string} params.category     — kategori adı
 * @returns {object} { scores, totalScore, profitAnalysis }
 */
function calculateScores({ trendData, marketData, userData, keyword, category }) {
    const scores = {
        trend: calculateTrendScore(trendData),
        demand: calculateDemandScore(marketData, trendData),
        competition: calculateCompetitionScore(marketData),
        profit: calculateProfitScore(marketData),
        userFit: calculateUserFitScore(userData, category, keyword),
    };

    // Toplam skor — ağırlıklı ortalama
    const totalScore = Math.round(
        scores.trend * WEIGHTS.trend +
        scores.demand * WEIGHTS.demand +
        scores.competition * WEIGHTS.competition +
        scores.profit * WEIGHTS.profit +
        scores.userFit * WEIGHTS.userFit
    );

    // Kâr analizi
    const profitAnalysis = calculateProfitAnalysis(marketData);

    return { scores, totalScore, profitAnalysis };
}

// ═════════════════════════════════════════════════════════════════════════════
// SKOR HESAPLAMA FONKSİYONLARI
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 1. TREND SKORU — Ürün ne kadar trend?
 */
function calculateTrendScore(trendData) {
    if (!trendData) return 30;

    let score = 0;

    // Trend skoru direkt kullan (zaten 0-100)
    score += (trendData.trendScore || 0) * 0.5;

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

    // Mevsimsellik bonusu (şu anki mevsime uygunsa)
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

    // Toplam ürün sayısı (çok ürün = yüksek talep)
    const totalProducts = marketData.totalProducts || 0;
    if (totalProducts > 10000) score += 25;
    else if (totalProducts > 5000) score += 20;
    else if (totalProducts > 1000) score += 15;
    else if (totalProducts > 100) score += 10;
    else score += 5;

    // Ortalama yorum sayısı (çok yorum = çok satış = yüksek talep)
    const avgReviews = marketData.avgReviewCount || 0;
    if (avgReviews > 500) score += 25;
    else if (avgReviews > 100) score += 20;
    else if (avgReviews > 50) score += 15;
    else if (avgReviews > 10) score += 10;
    else score += 5;

    // Ortalama rating (yüksek rating = müşteri memnuniyeti = sürdürülebilir talep)
    const avgRating = marketData.avgRating || 0;
    if (avgRating >= 4.5) score += 20;
    else if (avgRating >= 4.0) score += 15;
    else if (avgRating >= 3.5) score += 10;
    else score += 5;

    // Tahmini aylık satış
    const monthlySales = marketData.estimatedMonthlySales || 0;
    if (monthlySales > 5000) score += 20;
    else if (monthlySales > 1000) score += 15;
    else if (monthlySales > 500) score += 10;
    else score += 5;

    // Arama hacmi bonusu (trendData'dan)
    const searchVolume = trendData?.searchVolume || 0;
    if (searchVolume > 5000) score += 10;
    else if (searchVolume > 1000) score += 5;

    return clamp(Math.round(score), 0, 100);
}

/**
 * 3. REKABET SKORU — Rekabet ne kadar düşük? (düşük rekabet = yüksek skor)
 */
function calculateCompetitionScore(marketData) {
    if (!marketData) return 50;

    let score = 100; // Başlangıç: tam skor, rekabet arttıkça düşer

    // Satıcı sayısı (çok satıcı = yüksek rekabet = düşük skor)
    const sellerCount = marketData.sellerCount || 0;
    if (sellerCount > 100) score -= 35;
    else if (sellerCount > 50) score -= 25;
    else if (sellerCount > 20) score -= 15;
    else if (sellerCount > 10) score -= 10;
    else score -= 0; // Az satıcı = düşük rekabet = iyi

    // Toplam ürün sayısı (çok ürün = doymuş pazar)
    const totalProducts = marketData.totalProducts || 0;
    if (totalProducts > 10000) score -= 25;
    else if (totalProducts > 5000) score -= 15;
    else if (totalProducts > 1000) score -= 10;
    else score -= 0;

    // Ortalama yorum sayısı (çok yorum = yerleşik oyuncular = zor giriş)
    const avgReviews = marketData.avgReviewCount || 0;
    if (avgReviews > 1000) score -= 20;
    else if (avgReviews > 500) score -= 15;
    else if (avgReviews > 100) score -= 10;
    else score -= 0;

    // Marka yoğunluğu (az marka = monopol riski)
    const brandCount = (marketData.topBrands || []).length;
    if (brandCount <= 1) score -= 10; // Tek marka dominasyonu
    else if (brandCount >= 4) score += 5; // Çeşitli pazar = fırsat

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

    // Fiyat aralığı genişliği (geniş = fiyatlama esnekliği = kâr fırsatı)
    const priceRange = maxPrice - minPrice;
    const priceSpread = avgPrice > 0 ? (priceRange / avgPrice) * 100 : 0;
    if (priceSpread > 100) score += 25;
    else if (priceSpread > 50) score += 20;
    else if (priceSpread > 25) score += 15;
    else score += 10;

    // Ortalama fiyat seviyesi (çok düşük fiyat = düşük marj)
    if (avgPrice > 500) score += 25;
    else if (avgPrice > 200) score += 20;
    else if (avgPrice > 100) score += 15;
    else if (avgPrice > 50) score += 10;
    else score += 5;

    // Tahmini marj (basit hesap: ortalama fiyatın %25-35'i kâr varsayımı)
    const estimatedMargin = avgPrice > 0 ? 30 : 0; // Varsayılan %30 marj
    if (estimatedMargin > 35) score += 25;
    else if (estimatedMargin > 25) score += 20;
    else if (estimatedMargin > 15) score += 15;
    else score += 5;

    // Aylık ciro potansiyeli
    const monthlyRevenue = marketData.estimatedMonthlyRevenue || 0;
    if (monthlyRevenue > 100000) score += 25;
    else if (monthlyRevenue > 50000) score += 20;
    else if (monthlyRevenue > 10000) score += 15;
    else score += 5;

    return clamp(Math.round(score), 0, 100);
}

/**
 * 5. KULLANICI UYUM SKORU — Kullanıcının mevcut işine ne kadar uygun?
 */
function calculateUserFitScore(userData, category, keyword) {
    if (!userData || !userData.categories || userData.categories.length === 0) {
        return 50; // Veri yoksa nötr skor
    }

    let score = 0;
    const userCategories = userData.categories.map(c => (c.name || "").toLowerCase());
    const targetCategory = (category || "").toLowerCase();
    const targetKeyword = (keyword || "").toLowerCase();

    // 1. Aynı kategori mi?
    const exactMatch = userCategories.some(c => c === targetCategory || c.includes(targetCategory) || targetCategory.includes(c));
    if (exactMatch) {
        score += 40; // Aynı kategori = yüksek uyum
    }

    // 2. Yakın kategori mi? (kelime benzerliği)
    if (!exactMatch) {
        const partialMatch = userCategories.some(c => {
            const words1 = c.split(/[\s>/]+/).filter(w => w.length > 2);
            const words2 = targetCategory.split(/[\s>/]+/).filter(w => w.length > 2);
            return words1.some(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)));
        });
        if (partialMatch) score += 25;
    }

    // 3. Kullanıcının ürün sayısı (deneyim)
    const productCount = userData.productCount || 0;
    if (productCount > 50) score += 15;
    else if (productCount > 20) score += 10;
    else if (productCount > 5) score += 5;

    // 4. Kullanıcının sipariş hacmi (aktiflik)
    const orderCount = userData.orderCount || 0;
    if (orderCount > 100) score += 15;
    else if (orderCount > 30) score += 10;
    else if (orderCount > 10) score += 5;

    // 5. Kâr marjı uyumu (kullanıcı yüksek marjlı ürünler satıyorsa, yüksek marjlı fırsatlar daha uygun)
    const avgMargin = userData.avgMargin || 0;
    if (avgMargin > 20) score += 15;
    else if (avgMargin > 10) score += 10;
    else score += 5;

    // 6. Keyword kullanıcının ürün isimlerinde geçiyor mu?
    const topProducts = userData.topProducts || [];
    const keywordInProducts = topProducts.some(p =>
        (p.name || "").toLowerCase().includes(targetKeyword)
    );
    if (keywordInProducts) score += 15;

    return clamp(Math.round(score), 0, 100);
}

/**
 * Kâr analizi hesapla
 */
function calculateProfitAnalysis(marketData) {
    if (!marketData || !marketData.avgPrice) {
        return {
            estimatedCost: 0,
            suggestedPrice: 0,
            estimatedMargin: 0,
            estimatedMonthlyProfit: 0,
            commissionRate: 18, // Trendyol ortalama komisyon
        };
    }

    const avgPrice = marketData.avgPrice;
    const commissionRate = 18; // Trendyol ortalama %18
    const estimatedCost = Math.round(avgPrice * 0.45); // Maliyet tahmini: fiyatın %45'i
    const commission = avgPrice * (commissionRate / 100);
    const shippingCost = avgPrice > 200 ? 15 : 10;
    const netProfit = avgPrice - estimatedCost - commission - shippingCost;
    const margin = avgPrice > 0 ? (netProfit / avgPrice) * 100 : 0;

    const monthlySales = marketData.estimatedMonthlySales || 0;
    // Yeni satıcı olarak pazarın %1-3'ünü alabileceğini varsay
    const estimatedUserSales = Math.max(1, Math.round(monthlySales * 0.02));
    const estimatedMonthlyProfit = Math.round(netProfit * estimatedUserSales);

    return {
        estimatedCost: Math.round(estimatedCost),
        suggestedPrice: Math.round(avgPrice * 0.95), // Piyasanın %5 altı
        estimatedMargin: Math.round(margin * 10) / 10,
        estimatedMonthlyProfit: Math.max(0, estimatedMonthlyProfit),
        commissionRate,
    };
}

// ── Yardımcı ──
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

module.exports = {
    calculateScores,
    WEIGHTS,
};
