/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXPLANATION SERVICE — LysiaRadar PRO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * AI açıklama üretim servisi.
 * Her fırsat için:
 *   - Neden önerildi?
 *   - Kullanıcıya neden uygun?
 *   - Riskler neler?
 *   - Tahmini fayda ne?
 *
 * GPT kullanmadan, kural tabanlı doğal dil üretimi.
 * Kısa, net, sonuç odaklı — teknik değil.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");

/**
 * Fırsat için AI açıklaması üret
 * @param {object} params
 * @param {string} params.keyword
 * @param {string} params.category
 * @param {object} params.scores       — { trend, demand, competition, profit, userFit }
 * @param {number} params.totalScore
 * @param {object} params.trendData
 * @param {object} params.marketData
 * @param {object} params.profitAnalysis
 * @param {object} params.userData
 * @param {string} params.expansionType
 * @returns {object} { explanation, risks, benefits, confidence, userFitReason }
 */
function generateExplanation({
    keyword, category, scores, totalScore,
    trendData, marketData, profitAnalysis, userData, expansionType
}) {
    const parts = [];
    const risks = [];
    const benefits = [];

    // ── 1. Ana açıklama cümlesi ──
    if (totalScore >= 80) {
        parts.push(`🔥 "${keyword}" şu anda çok güçlü bir fırsat.`);
    } else if (totalScore >= 65) {
        parts.push(`✨ "${keyword}" iyi bir fırsat olarak değerlendirildi.`);
    } else if (totalScore >= 50) {
        parts.push(`📊 "${keyword}" orta seviye bir fırsat. Dikkatli analiz önerilir.`);
    } else {
        parts.push(`📋 "${keyword}" düşük skorlu bir fırsat. Risk/getiri oranını değerlendirin.`);
    }

    // ── 2. Trend açıklaması ──
    if (scores.trend >= 70) {
        parts.push(`Trend skoru yüksek (${scores.trend}/100) — bu ürüne olan ilgi hızla artıyor.`);
        benefits.push("Yükselen trend — erken giriş avantajı");
    } else if (scores.trend >= 50) {
        parts.push(`Trend stabil (${scores.trend}/100) — sürekli talep var.`);
        benefits.push("Stabil talep — güvenli yatırım");
    } else {
        parts.push(`Trend düşük (${scores.trend}/100) — talep azalıyor olabilir.`);
        risks.push("Düşen trend — zamanlama riski");
    }

    // ── 3. Talep açıklaması ──
    if (scores.demand >= 70) {
        const monthlyRev = marketData?.estimatedMonthlyRevenue || 0;
        if (monthlyRev > 0) {
            parts.push(`Pazar talebi güçlü — tahmini aylık pazar büyüklüğü ${formatMoney(monthlyRev)}.`);
        } else {
            parts.push("Pazar talebi güçlü — yüksek arama hacmi ve satış potansiyeli.");
        }
        benefits.push("Yüksek talep — müşteri bulmak kolay");
    } else if (scores.demand < 40) {
        risks.push("Düşük talep — müşteri kazanımı zor olabilir");
    }

    // ── 4. Rekabet açıklaması ──
    if (scores.competition >= 70) {
        parts.push(`Rekabet düşük (${marketData?.sellerCount || 0} satıcı) — pazara giriş kolay.`);
        benefits.push("Düşük rekabet — fiyat baskısı az");
    } else if (scores.competition >= 40) {
        parts.push(`Rekabet orta seviyede (${marketData?.sellerCount || 0} satıcı).`);
    } else {
        parts.push(`Rekabet yoğun (${marketData?.sellerCount || 0}+ satıcı) — fark yaratmanız gerekecek.`);
        risks.push("Yoğun rekabet — fiyat savaşı riski");
    }

    // ── 5. Kâr açıklaması ──
    if (profitAnalysis && profitAnalysis.estimatedMargin > 0) {
        const margin = profitAnalysis.estimatedMargin;
        const monthlyProfit = profitAnalysis.estimatedMonthlyProfit;

        if (margin > 25) {
            parts.push(`Kâr marjı yüksek (~%${margin}) — tahmini aylık kâr ${formatMoney(monthlyProfit)}.`);
            benefits.push(`Yüksek kâr marjı (%${margin})`);
        } else if (margin > 15) {
            parts.push(`Kâr marjı makul (~%${margin}).`);
            benefits.push(`Makul kâr marjı (%${margin})`);
        } else {
            parts.push(`Kâr marjı düşük (~%${margin}) — maliyet optimizasyonu gerekebilir.`);
            risks.push(`Düşük kâr marjı (%${margin})`);
        }

        if (profitAnalysis.suggestedPrice > 0) {
            parts.push(`Önerilen satış fiyatı: ${formatMoney(profitAnalysis.suggestedPrice)}.`);
        }
    }

    // ── 6. Kullanıcı uyumu açıklaması ──
    let userFitReason = "";
    if (scores.userFit >= 70) {
        userFitReason = "Mevcut kategorinizle doğrudan uyumlu — tedarik zincirinizi kullanabilirsiniz.";
        benefits.push("Mevcut altyapınızla uyumlu");
    } else if (scores.userFit >= 50) {
        userFitReason = "Mevcut işinize yakın bir kategori — geçiş maliyeti düşük.";
        benefits.push("Yakın kategori — kolay geçiş");
    } else if (scores.userFit >= 30) {
        userFitReason = "Farklı bir kategori ama genişleme fırsatı sunuyor.";
        risks.push("Yeni kategori — öğrenme süreci gerekli");
    } else {
        userFitReason = "Mevcut işinizden farklı — yeni tedarikçi ve bilgi gerektirebilir.";
        risks.push("Farklı kategori — yüksek geçiş maliyeti");
    }

    // ── 7. Genişleme tipi açıklaması ──
    if (expansionType === "same_category") {
        parts.push("Bu ürün mevcut kategorinizde — hemen başlayabilirsiniz.");
    } else if (expansionType === "adjacent_category") {
        parts.push("Yakın bir kategori — mevcut müşteri kitlenize hitap edebilir.");
    } else if (expansionType === "new_category") {
        parts.push("Yeni bir kategori — portföy çeşitlendirmesi için ideal.");
    } else if (expansionType === "trending") {
        parts.push("Trend olan bir ürün — hızlı hareket edenler kazanır.");
    }

    // ── 8. Ek riskler ──
    if (trendData?.seasonality && trendData.seasonality !== "her_mevsim") {
        risks.push(`Mevsimsel ürün (${trendData.seasonality}) — sezon dışında satış düşebilir`);
    }

    if (marketData?.avgPrice < 30) {
        risks.push("Düşük fiyatlı ürün — kargo maliyeti kâr marjını eritebilir");
    }

    if ((marketData?.topBrands || []).length <= 1) {
        risks.push("Tek marka dominasyonu — marka bağımlılığı riski");
    }

    // ── 9. Ek faydalar ──
    if (marketData?.avgRating >= 4.0) {
        benefits.push("Yüksek müşteri memnuniyeti — kaliteli ürün bulma şansı yüksek");
    }

    if (trendData?.relatedKeywords?.length > 5) {
        benefits.push("Geniş anahtar kelime havuzu — SEO avantajı");
    }

    // ── Güven skoru ──
    let confidence = 50;
    if (marketData?.totalProducts > 100) confidence += 15;
    if (trendData?.trendScore > 0) confidence += 10;
    if (userData?.productCount > 0) confidence += 10;
    if (marketData?.avgReviewCount > 10) confidence += 10;
    if (profitAnalysis?.estimatedMargin > 0) confidence += 5;
    confidence = Math.min(95, confidence);

    return {
        explanation: parts.join(" "),
        risks: risks.slice(0, 5),
        benefits: benefits.slice(0, 5),
        confidence,
        userFitReason,
    };
}

/**
 * Kısa özet üret (kart için)
 */
function generateShortSummary(totalScore, scores, keyword) {
    if (totalScore >= 80) return `${keyword} — güçlü fırsat, hemen değerlendirin`;
    if (totalScore >= 65) return `${keyword} — iyi potansiyel, analiz edin`;
    if (totalScore >= 50) return `${keyword} — orta fırsat, dikkatli olun`;
    return `${keyword} — düşük skor, risk değerlendirmesi yapın`;
}

// ── Yardımcı ──
function formatMoney(amount) {
    if (!amount || amount === 0) return "0 ₺";
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M ₺`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K ₺`;
    return `${Math.round(amount)} ₺`;
}

module.exports = {
    generateExplanation,
    generateShortSummary,
};
