/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OpportunityResult Model — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * AI Ürün Fırsat Motoru sonuçlarını saklar.
 * Her kullanıcı için kişiselleştirilmiş fırsatlar, skorlar ve AI açıklamaları.
 *
 * YENİ v2:
 *   - Sosyal medya verileri (Instagram + TikTok)
 *   - Google Trends verileri
 *   - Amazon pazar verileri
 *   - Çapraz pazar analizi (arbitraj)
 *   - 7 boyutlu skor sistemi (social + amazon eklendi)
 *   - Veri kaynağı sayısı ve güvenilirlik
 *
 * Lifecycle:
 *   1. Worker veri toplar (Google + Sosyal + Amazon + Trendyol)
 *   2. Skorlama servisi 7 boyutlu puanlar
 *   3. AI açıklama üretir (zenginleştirilmiş)
 *   4. Bu modele kaydeder
 *   5. Frontend buradan okur
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const OpportunityResultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // ── Fırsat Kimliği ──
    keyword: { type: String, required: true },
    category: { type: String, default: "" },
    categoryId: { type: String, default: "" },
    source: {
        type: String,
        enum: ["trend", "marketplace", "user_data", "search_suggest", "social", "ai_discovery"],
        default: "marketplace",
    },

    // ── Pazar Verileri (Trendyol) ──
    marketData: {
        avgPrice: { type: Number, default: 0 },
        minPrice: { type: Number, default: 0 },
        maxPrice: { type: Number, default: 0 },
        sellerCount: { type: Number, default: 0 },
        totalProducts: { type: Number, default: 0 },
        avgRating: { type: Number, default: 0 },
        avgReviewCount: { type: Number, default: 0 },
        topBrands: [{ type: String }],
        estimatedMonthlySales: { type: Number, default: 0 },
        estimatedMonthlyRevenue: { type: Number, default: 0 },
        sampleProducts: [{
            name: { type: String },
            price: { type: Number },
            rating: { type: Number },
            reviewCount: { type: Number },
            seller: { type: String },
            imageUrl: { type: String },
            url: { type: String },
        }],
    },

    // ── Trend Verileri (Birleşik) ──
    trendData: {
        trendScore: { type: Number, default: 0 },
        trendDirection: {
            type: String,
            enum: ["rising", "stable", "declining", "breakout", "unknown"],
            default: "unknown",
        },
        searchVolume: { type: Number, default: 0 },
        weeklyChange: { type: Number, default: 0 },
        monthlyChange: { type: Number, default: 0 },
        seasonality: { type: String, default: "" },
        relatedKeywords: [{ type: String }],
    },

    // ── Google Trends Verileri (YENİ) ──
    googleTrendsData: {
        interestOverTime: { type: Number, default: 0 },
        isBreakout: { type: Boolean, default: false },
        relatedQueries: [{ type: String }],
        relatedTopics: [{ type: String }],
        timelineValues: [{ type: Number }],
    },

    // ── Sosyal Medya Verileri (YENİ) ──
    socialData: {
        instagram: {
            hashtagPostCount: { type: Number, default: 0 },
            recentPostCount: { type: Number, default: 0 },
            avgLikes: { type: Number, default: 0 },
            avgComments: { type: Number, default: 0 },
            engagementRate: { type: Number, default: 0 },
        },
        tiktok: {
            videoCount: { type: Number, default: 0 },
            totalViews: { type: Number, default: 0 },
            avgViews: { type: Number, default: 0 },
            avgLikes: { type: Number, default: 0 },
            avgShares: { type: Number, default: 0 },
            engagementRate: { type: Number, default: 0 },
            isViral: { type: Boolean, default: false },
        },
        socialScore: { type: Number, default: 0 },
    },

    // ── Amazon Pazar Verileri (YENİ) ──
    amazonData: {
        totalProducts: { type: Number, default: 0 },
        avgPrice: { type: Number, default: 0 },
        avgBSR: { type: Number, default: 0 },
        avgRating: { type: Number, default: 0 },
        avgReviewCount: { type: Number, default: 0 },
        topBrands: [{ type: String }],
        estimatedMonthlySales: { type: Number, default: 0 },
        estimatedMonthlyRevenue: { type: Number, default: 0 },
        marketplace: { type: String, default: "TR" },
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

    // ── Çapraz Pazar Analizi (YENİ) ──
    crossMarketAnalysis: {
        priceComparison: {
            trendyolAvg: { type: Number, default: 0 },
            amazonAvg: { type: Number, default: 0 },
            diffPercent: { type: Number, default: 0 },
            cheaperOn: { type: String, default: "" },
        },
        arbitrageOpportunity: { type: Boolean, default: false },
        arbitrageDetails: {
            direction: { type: String, default: "" },
            potentialMargin: { type: Number, default: 0 },
            description: { type: String, default: "" },
        },
        competitionComparison: {
            trendyolSellers: { type: Number, default: 0 },
            amazonProducts: { type: Number, default: 0 },
            lessCompetitiveOn: { type: String, default: "" },
        },
    },

    // ── Veri Kaynağı Bilgisi (YENİ) ──
    dataSourceCount: { type: Number, default: 0 },

    // ── Skorlar (7 boyutlu — GELİŞTİRİLDİ) ──
    scores: {
        trend: { type: Number, default: 0, min: 0, max: 100 },
        demand: { type: Number, default: 0, min: 0, max: 100 },
        competition: { type: Number, default: 0, min: 0, max: 100 },
        profit: { type: Number, default: 0, min: 0, max: 100 },
        userFit: { type: Number, default: 0, min: 0, max: 100 },
        social: { type: Number, default: 0, min: 0, max: 100 },   // YENİ
        amazon: { type: Number, default: 0, min: 0, max: 100 },   // YENİ
    },
    totalScore: { type: Number, default: 0, min: 0, max: 100 },

    // ── Kâr Analizi (GELİŞTİRİLDİ) ──
    profitAnalysis: {
        estimatedCost: { type: Number, default: 0 },
        suggestedPrice: { type: Number, default: 0 },
        estimatedMargin: { type: Number, default: 0 },
        estimatedMonthlyProfit: { type: Number, default: 0 },
        commissionRate: { type: Number, default: 0 },
        amazonComparison: {                                         // YENİ
            avgPrice: { type: Number, default: 0 },
            estimatedCost: { type: Number, default: 0 },
            commissionRate: { type: Number, default: 0 },
            estimatedMargin: { type: Number, default: 0 },
            netProfitPerUnit: { type: Number, default: 0 },
            betterMarginOn: { type: String, default: "" },
        },
    },

    // ── AI Açıklaması ──
    aiExplanation: { type: String, default: "" },
    aiRisks: [{ type: String }],
    aiBenefits: [{ type: String }],
    aiConfidence: { type: Number, default: 50, min: 0, max: 100 },

    // ── Kullanıcı Uyumu ──
    userFitReason: { type: String, default: "" },
    relatedUserCategories: [{ type: String }],
    expansionType: {
        type: String,
        enum: ["same_category", "adjacent_category", "new_category", "trending"],
        default: "same_category",
    },

    // ── Durum ──
    status: {
        type: String,
        enum: ["active", "dismissed", "acted", "expired"],
        default: "active",
        index: true,
    },
    userAction: {
        type: String,
        enum: [null, "viewed", "simulated", "added_to_store", "dismissed"],
        default: null,
    },
    userActionAt: { type: Date },

    // ── Meta ──
    dataFreshness: { type: Date, default: Date.now },
    expiresAt: { type: Date },

}, { timestamps: true });

// ── İndeksler ──
OpportunityResultSchema.index({ userId: 1, status: 1, totalScore: -1 });
OpportunityResultSchema.index({ userId: 1, keyword: 1 }, { unique: true });
OpportunityResultSchema.index({ userId: 1, category: 1, totalScore: -1 });
OpportunityResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OpportunityResultSchema.index({ userId: 1, source: 1, totalScore: -1 });           // YENİ
OpportunityResultSchema.index({ "crossMarketAnalysis.arbitrageOpportunity": 1 });   // YENİ

module.exports = mongoose.model("OpportunityResult", OpportunityResultSchema);
