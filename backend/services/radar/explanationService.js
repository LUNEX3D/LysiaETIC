/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXPLANATION SERVICE — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * AI açıklama üretim servisi.
 * Her fırsat için:
 *   - Neden önerildi?
 *   - Kullanıcıya neden uygun?
 *   - Riskler neler?
 *   - Tahmini fayda ne?
 *
 * YENİ: Sosyal medya sinyalleri, Google Trends verileri, Amazon çapraz
 *       pazar analizi ve arbitraj fırsatları açıklamalara dahil edildi.
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

    // ── 2. Veri kaynağı zenginliği ──
    const sourceCount = trendData?.dataSourceCount || 0;
    if (sourceCount >= 4) {
        parts.push(`📡 ${sourceCount} farklı veri kaynağından doğrulandı — yüksek güvenilirlik.`);
        benefits.push("Çoklu kaynak doğrulaması — güvenilir sinyal");
    } else if (sourceCount >= 3) {
        parts.push(`📡 ${sourceCount} veri kaynağından analiz edildi.`);
    } else if (sourceCount <= 1) {
        risks.push("Sınırlı veri kaynağı — doğrulama zayıf");
    }

    // ── 3. Google Trends açıklaması (YENİ) ──
    if (trendData?.googleTrends) {
        const gt = trendData.googleTrends;
        if (gt.isBreakout) {
            parts.push(`🚀 Google Trends'te "Breakout" — arama hacmi patlama yapıyor!`);
            benefits.push("Google Trends breakout — erken giriş avantajı");
        } else if (gt.interestOverTime >= 70) {
            parts.push(`📈 Google'da yüksek arama hacmi (${gt.interestOverTime}/100).`);
            benefits.push("Yüksek Google arama hacmi");
        } else if (gt.interestOverTime >= 40) {
            parts.push(`📊 Google'da orta düzey arama ilgisi (${gt.interestOverTime}/100).`);
        }

        if (gt.relatedQueries && gt.relatedQueries.length > 3) {
            benefits.push(`${gt.relatedQueries.length} ilişkili arama terimi — SEO fırsatı`);
        }
    }

    // ── 4. Sosyal medya açıklaması (YENİ) ──
    if (trendData?.socialMedia) {
        const sm = trendData.socialMedia;

        // TikTok
        if (sm.tiktok && sm.tiktok.isViral) {
            parts.push(`🎵 TikTok'ta viral! Ortalama ${formatNumber(sm.tiktok.avgViews)} görüntülenme.`);
            benefits.push("TikTok viral — sosyal medya destekli talep patlaması");
        } else if (sm.tiktok && sm.tiktok.videoCount > 1000) {
            parts.push(`🎵 TikTok'ta ${formatNumber(sm.tiktok.videoCount)} video mevcut.`);
            benefits.push("TikTok'ta aktif içerik — organik talep");
        }

        // Instagram
        if (sm.instagram && sm.instagram.hashtagPostCount > 50000) {
            parts.push(`📸 Instagram'da #${keyword.replace(/\s+/g, "")} ${formatNumber(sm.instagram.hashtagPostCount)} post.`);
            benefits.push("Instagram'da güçlü hashtag varlığı");
        } else if (sm.instagram && sm.instagram.engagementRate > 3) {
            benefits.push(`Yüksek Instagram etkileşim oranı (%${sm.instagram.engagementRate})`);
        }

        // Birleşik sosyal skor
        if (sm.socialScore >= 70) {
            benefits.push("Güçlü sosyal medya sinyali — talep doğrulaması");
        }
    }

    // ── 5. Trend açıklaması ──
    if (scores.trend >= 70) {
        parts.push(`Trend skoru yüksek (${scores.trend}/100) — bu ürüne olan ilgi hızla artıyor.`);
        if (!benefits.some(b => b.includes("trend"))) {
            benefits.push("Yükselen trend — erken giriş avantajı");
        }
    } else if (scores.trend >= 50) {
        parts.push(`Trend stabil (${scores.trend}/100) — sürekli talep var.`);
        benefits.push("Stabil talep — güvenli yatırım");
    } else {
        parts.push(`Trend düşük (${scores.trend}/100) — talep azalıyor olabilir.`);
        risks.push("Düşen trend — zamanlama riski");
    }

    // ── 6. Talep açıklaması ──
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

    // ── 7. Rekabet açıklaması ──
    if (scores.competition >= 70) {
        parts.push(`Rekabet düşük (${marketData?.sellerCount || 0} satıcı) — pazara giriş kolay.`);
        benefits.push("Düşük rekabet — fiyat baskısı az");
    } else if (scores.competition >= 40) {
        parts.push(`Rekabet orta seviyede (${marketData?.sellerCount || 0} satıcı).`);
    } else {
        parts.push(`Rekabet yoğun (${marketData?.sellerCount || 0}+ satıcı) — fark yaratmanız gerekecek.`);
        risks.push("Yoğun rekabet — fiyat savaşı riski");
    }

    // ── 8. Amazon çapraz pazar analizi (YENİ) ──
    if (marketData?.crossMarketAnalysis) {
        const cma = marketData.crossMarketAnalysis;

        if (cma.arbitrageOpportunity && cma.arbitrageDetails) {
            const ad = cma.arbitrageDetails;
            parts.push(`💰 Arbitraj fırsatı! ${ad.description}`);
            benefits.push(`Arbitraj fırsatı — ~%${ad.potentialMargin} marj potansiyeli`);
        }

        if (cma.priceComparison) {
            const pc = cma.priceComparison;
            if (pc.cheaperOn === "amazon") {
                parts.push(`Amazon'da %${Math.abs(pc.diffPercent)} daha ucuz — tedarik avantajı.`);
            } else if (pc.cheaperOn === "trendyol") {
                parts.push(`Trendyol'da %${Math.abs(pc.diffPercent)} daha ucuz.`);
            }
        }

        if (cma.competitionComparison?.lessCompetitiveOn === "trendyol") {
            benefits.push("Trendyol'da Amazon'a göre daha az rekabet");
        }
    }

    // ── 9. Amazon verisi açıklaması (YENİ) ──
    if (marketData?.amazonData) {
        const ad = marketData.amazonData;
        if (ad.avgBSR > 0 && ad.avgBSR < 5000) {
            parts.push(`Amazon'da güçlü satış (BSR: ${formatNumber(ad.avgBSR)}).`);
            benefits.push("Amazon'da kanıtlanmış talep");
        }
        if (ad.estimatedMonthlySales > 100) {
            benefits.push(`Amazon'da tahmini ${formatNumber(ad.estimatedMonthlySales)} aylık satış`);
        }
    }

    // ── 10. Kâr açıklaması ──
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

        // Amazon kâr karşılaştırması
        if (profitAnalysis.amazonComparison) {
            const ac = profitAnalysis.amazonComparison;
            if (ac.betterMarginOn === "trendyol") {
                benefits.push(`Trendyol'da Amazon'dan daha iyi marj (%${margin} vs %${ac.estimatedMargin})`);
            } else {
                benefits.push(`Amazon'da daha iyi marj (%${ac.estimatedMargin} vs %${margin})`);
            }
        }
    }

    // ── 11. Kullanıcı uyumu açıklaması ──
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

    // ── 12. Genişleme tipi açıklaması ──
    if (expansionType === "same_category") {
        parts.push("Bu ürün mevcut kategorinizde — hemen başlayabilirsiniz.");
    } else if (expansionType === "adjacent_category") {
        parts.push("Yakın bir kategori — mevcut müşteri kitlenize hitap edebilir.");
    } else if (expansionType === "new_category") {
        parts.push("Yeni bir kategori — portföy çeşitlendirmesi için ideal.");
    } else if (expansionType === "trending") {
        parts.push("Trend olan bir ürün — hızlı hareket edenler kazanır.");
    }

    // ── 13. Ek riskler ──
    if (trendData?.seasonality && trendData.seasonality !== "her_mevsim") {
        risks.push(`Mevsimsel ürün (${trendData.seasonality}) — sezon dışında satış düşebilir`);
    }

    if (marketData?.avgPrice < 30) {
        risks.push("Düşük fiyatlı ürün — kargo maliyeti kâr marjını eritebilir");
    }

    if ((marketData?.topBrands || []).length <= 1) {
        risks.push("Tek marka dominasyonu — marka bağımlılığı riski");
    }

    // ── 14. Ek faydalar ──
    if (marketData?.avgRating >= 4.0) {
        benefits.push("Yüksek müşteri memnuniyeti — kaliteli ürün bulma şansı yüksek");
    }

    if (trendData?.relatedKeywords?.length > 5) {
        benefits.push("Geniş anahtar kelime havuzu — SEO avantajı");
    }

    if (marketData?.dataSources?.length >= 2) {
        benefits.push("Birden fazla pazaryerinde talep — çoklu kanal satış fırsatı");
    }

    // ── Güven skoru ──
    let confidence = 40;
    if (marketData?.totalProducts > 100) confidence += 10;
    if (trendData?.trendScore > 0) confidence += 8;
    if (userData?.productCount > 0) confidence += 8;
    if (marketData?.avgReviewCount > 10) confidence += 7;
    if (profitAnalysis?.estimatedMargin > 0) confidence += 5;
    // YENİ: Çoklu kaynak bonusu
    if (sourceCount >= 4) confidence += 12;
    else if (sourceCount >= 3) confidence += 8;
    else if (sourceCount >= 2) confidence += 4;
    // YENİ: Sosyal medya doğrulaması
    if (trendData?.socialMedia?.socialScore > 50) confidence += 5;
    // YENİ: Amazon doğrulaması
    if (marketData?.amazonData?.totalProducts > 0) confidence += 5;
    confidence = Math.min(98, confidence);

    return {
        explanation: parts.join(" "),
        risks: risks.slice(0, 6),
        benefits: benefits.slice(0, 6),
        confidence,
        userFitReason,
    };
}

/**
 * Kısa özet üret (kart için)
 */
function generateShortSummary(totalScore, scores, keyword, trendData) {
    const tags = [];

    if (trendData?.googleTrends?.isBreakout) tags.push("🚀 Breakout");
    if (trendData?.socialMedia?.tiktok?.isViral) tags.push("🎵 Viral");
    if (scores.competition >= 70) tags.push("💎 Az Rekabet");
    if (scores.profit >= 70) tags.push("💰 Yüksek Kâr");

    const tagStr = tags.length > 0 ? ` [${tags.join(" ")}]` : "";

    if (totalScore >= 80) return `${keyword} — güçlü fırsat, hemen değerlendirin${tagStr}`;
    if (totalScore >= 65) return `${keyword} — iyi potansiyel, analiz edin${tagStr}`;
    if (totalScore >= 50) return `${keyword} — orta fırsat, dikkatli olun${tagStr}`;
    return `${keyword} — düşük skor, risk değerlendirmesi yapın${tagStr}`;
}

// ── Yardımcılar ──

function formatMoney(amount) {
    if (!amount || amount === 0) return "0 ₺";
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M ₺`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K ₺`;
    return `${Math.round(amount)} ₺`;
}

function formatNumber(num) {
    if (!num || num === 0) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(Math.round(num));
}

module.exports = {
    generateExplanation,
    generateShortSummary,
};
