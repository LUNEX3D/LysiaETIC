/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TrendSignal Model — LysiaRadar PRO v2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Çoklu veri kaynağından toplanan trend sinyallerini saklar.
 * Kaynaklar:
 *   - Google Trends (arama hacmi, yükseliş)
 *   - Instagram (hashtag hacmi, engagement)
 *   - TikTok (video sayısı, görüntülenme)
 *   - Amazon (BSR, fiyat, yorum)
 *   - Trendyol (favori, satış tahmini)
 *
 * Her sinyal bir keyword + kaynak + zaman damgası kombinasyonudur.
 * Zaman serisi olarak saklanır → trend yönü hesaplanabilir.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const TrendSignalSchema = new mongoose.Schema({
    // ── Kimlik ──
    keyword: { type: String, required: true, index: true },
    source: {
        type: String,
        required: true,
        enum: [
            "google_trends",
            "instagram",
            "tiktok",
            "amazon",
            "trendyol",
            "combined",
        ],
        index: true,
    },

    // ── Google Trends Verileri ──
    googleTrends: {
        interestOverTime: { type: Number, default: 0 },   // 0-100 (son hafta)
        interestChange: { type: Number, default: 0 },      // % değişim (haftalık)
        relatedQueries: [{ type: String }],                 // İlişkili aramalar
        relatedTopics: [{ type: String }],                  // İlişkili konular
        isBreakout: { type: Boolean, default: false },      // "Breakout" trend mi?
        geo: { type: String, default: "TR" },               // Ülke kodu
    },

    // ── Instagram Verileri ──
    instagram: {
        hashtagPostCount: { type: Number, default: 0 },    // Hashtag'deki toplam post
        recentPostCount: { type: Number, default: 0 },     // Son 24 saat post sayısı
        avgLikes: { type: Number, default: 0 },             // Ortalama beğeni
        avgComments: { type: Number, default: 0 },          // Ortalama yorum
        engagementRate: { type: Number, default: 0 },       // Etkileşim oranı %
        topInfluencers: [{ type: String }],                 // Üst influencer'lar
    },

    // ── TikTok Verileri ──
    tiktok: {
        videoCount: { type: Number, default: 0 },           // Toplam video sayısı
        totalViews: { type: Number, default: 0 },           // Toplam görüntülenme
        avgViews: { type: Number, default: 0 },             // Ortalama görüntülenme
        avgLikes: { type: Number, default: 0 },             // Ortalama beğeni
        avgShares: { type: Number, default: 0 },            // Ortalama paylaşım
        engagementRate: { type: Number, default: 0 },       // Etkileşim oranı %
        isViral: { type: Boolean, default: false },          // Viral mi?
    },

    // ── Amazon Verileri ──
    amazon: {
        totalProducts: { type: Number, default: 0 },        // Toplam ürün sayısı
        avgPrice: { type: Number, default: 0 },              // Ortalama fiyat ($)
        avgBSR: { type: Number, default: 0 },                // Ortalama Best Seller Rank
        avgRating: { type: Number, default: 0 },             // Ortalama puan
        avgReviewCount: { type: Number, default: 0 },        // Ortalama yorum sayısı
        topBrands: [{ type: String }],                       // En popüler markalar
        estimatedMonthlySales: { type: Number, default: 0 }, // Tahmini aylık satış
        estimatedMonthlyRevenue: { type: Number, default: 0 },
        marketplace: { type: String, default: "US" },        // US, TR, DE, UK
        sampleProducts: [{
            name: { type: String },
            price: { type: Number },
            rating: { type: Number },
            reviewCount: { type: Number },
            bsr: { type: Number },
            imageUrl: { type: String },
            asin: { type: String },
        }],
    },

    // ── Trendyol Verileri ──
    trendyol: {
        totalProducts: { type: Number, default: 0 },
        avgPrice: { type: Number, default: 0 },
        avgRating: { type: Number, default: 0 },
        avgReviewCount: { type: Number, default: 0 },
        sellerCount: { type: Number, default: 0 },
        avgFavorites: { type: Number, default: 0 },
        estimatedMonthlySales: { type: Number, default: 0 },
        estimatedMonthlyRevenue: { type: Number, default: 0 },
    },

    // ── Birleşik Skorlar ──
    compositeScore: { type: Number, default: 0, min: 0, max: 100 },
    trendDirection: {
        type: String,
        enum: ["breakout", "rising", "stable", "declining", "unknown"],
        default: "unknown",
    },
    confidenceLevel: { type: Number, default: 0, min: 0, max: 100 },
    dataSourceCount: { type: Number, default: 0 },  // Kaç kaynaktan veri geldi

    // ── Meta ──
    collectedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },

}, { timestamps: true });

// ── İndeksler ──
TrendSignalSchema.index({ keyword: 1, source: 1, collectedAt: -1 });
TrendSignalSchema.index({ compositeScore: -1 });
TrendSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
TrendSignalSchema.index({ keyword: 1, collectedAt: -1 });

module.exports = mongoose.model("TrendSignal", TrendSignalSchema);
