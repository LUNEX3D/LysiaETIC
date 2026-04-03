/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RoketfyAnalysis Model — LysiaETIC Roketfy-Style Marketplace Intelligence
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Roketfy benzeri listeleme analizi, yorum analizi, ürün araştırma,
 * rakip analizi ve SEO optimizasyon sonuçlarını saklar.
 *
 * Analiz Türleri:
 *   listing_analysis   — Ürün listeleme kalite skoru & SEO önerileri
 *   review_analysis    — Müşteri yorumları NLP duygu analizi
 *   product_research   — Kategori/anahtar kelime bazlı pazar araştırması
 *   competitor_analysis — Rakip mağaza/ürün karşılaştırma
 *   keyword_research   — Anahtar kelime hacim & rekabet analizi
 *   content_generation — AI ile üretilen başlık/açıklama
 *   price_suggestion   — Rekabetçi fiyat önerisi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const RoketfyAnalysisSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // ── Analiz Türü ──
    analysisType: {
        type: String,
        required: true,
        enum: [
            "listing_analysis",
            "review_analysis",
            "product_research",
            "competitor_analysis",
            "keyword_research",
            "content_generation",
            "price_suggestion",
        ],
        index: true,
    },

    // ── Hedef Bilgisi ──
    target: {
        barcode: { type: String, index: true },
        productName: { type: String },
        marketplace: { type: String },          // Trendyol, Hepsiburada, N11, etc.
        categoryName: { type: String },
        categoryId: { type: String },
        url: { type: String },                  // Ürün/mağaza URL'i
        competitorName: { type: String },        // Rakip mağaza adı
    },

    // ═══════════════════════════════════════════════════════════════════════
    // LİSTELEME ANALİZİ (listing_analysis)
    // ═══════════════════════════════════════════════════════════════════════
    listingAnalysis: {
        overallScore: { type: Number, default: 0, min: 0, max: 100 },
        grade: { type: String, enum: ["A+", "A", "B+", "B", "C+", "C", "D", "F"] },

        // Alt skorlar
        titleScore: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            issues: [{ type: String }],
            suggestions: [{ type: String }],
            charCount: { type: Number },
            hasKeywords: { type: Boolean },
            hasBrand: { type: Boolean },
        },
        descriptionScore: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            issues: [{ type: String }],
            suggestions: [{ type: String }],
            charCount: { type: Number },
            hasKeywords: { type: Boolean },
            hasBulletPoints: { type: Boolean },
            hasEmoji: { type: Boolean },
        },
        imageScore: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            imageCount: { type: Number },
            issues: [{ type: String }],
            suggestions: [{ type: String }],
        },
        priceScore: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            currentPrice: { type: Number },
            suggestedRange: { min: Number, max: Number },
            competitiveness: { type: String, enum: ["very_low", "low", "fair", "high", "very_high"] },
            issues: [{ type: String }],
        },
        stockScore: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            currentStock: { type: Number },
            issues: [{ type: String }],
        },
        attributeScore: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            filledCount: { type: Number },
            totalCount: { type: Number },
            missingAttributes: [{ type: String }],
        },

        // SEO Analizi
        seoAnalysis: {
            keywordDensity: { type: Number },
            topKeywords: [{ keyword: String, count: Number, relevance: Number }],
            missingKeywords: [{ type: String }],
            seoScore: { type: Number, default: 0 },
        },

        // Genel öneriler
        recommendations: [{
            category: { type: String },  // title, description, image, price, stock, seo
            priority: { type: String, enum: ["critical", "high", "medium", "low"] },
            message: { type: String },
            currentValue: { type: String },
            suggestedValue: { type: String },
        }],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // YORUM ANALİZİ (review_analysis)
    // ═══════════════════════════════════════════════════════════════════════
    reviewAnalysis: {
        totalReviews: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },

        // Duygu analizi
        sentimentBreakdown: {
            positive: { type: Number, default: 0 },    // %
            neutral: { type: Number, default: 0 },
            negative: { type: Number, default: 0 },
        },

        // Konu bazlı analiz
        topicAnalysis: [{
            topic: { type: String },           // "kargo", "kalite", "fiyat", "beden", etc.
            sentiment: { type: String, enum: ["positive", "negative", "mixed"] },
            mentionCount: { type: Number },
            percentage: { type: Number },
            sampleReviews: [{ type: String }],
        }],

        // Anahtar kelimeler (müşterilerin kullandığı)
        customerKeywords: [{
            keyword: { type: String },
            count: { type: Number },
            sentiment: { type: String },
        }],

        // Güçlü ve zayıf yönler
        strengths: [{ type: String }],
        weaknesses: [{ type: String }],

        // Zaman bazlı trend
        ratingTrend: [{
            period: { type: String },   // "2024-01", "2024-02"
            avgRating: { type: Number },
            reviewCount: { type: Number },
        }],

        // AI özet
        aiSummary: { type: String },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ÜRÜN ARAŞTIRMASI (product_research)
    // ═══════════════════════════════════════════════════════════════════════
    productResearch: {
        searchQuery: { type: String },
        categoryName: { type: String },
        totalResults: { type: Number, default: 0 },

        // Pazar istatistikleri
        marketStats: {
            avgPrice: { type: Number },
            minPrice: { type: Number },
            maxPrice: { type: Number },
            medianPrice: { type: Number },
            avgDailySales: { type: Number },
            avgMonthlySales: { type: Number },
            avgMonthlyRevenue: { type: Number },
            totalSellers: { type: Number },
            competitionLevel: { type: String, enum: ["very_low", "low", "medium", "high", "very_high"] },
        },

        // En çok satan ürünler
        topProducts: [{
            name: { type: String },
            price: { type: Number },
            estimatedDailySales: { type: Number },
            estimatedMonthlyRevenue: { type: Number },
            reviewCount: { type: Number },
            rating: { type: Number },
            sellerName: { type: String },
            marketplace: { type: String },
            barcode: { type: String },
        }],

        // Trend analizi
        trendData: {
            direction: { type: String, enum: ["rising", "stable", "declining"] },
            growthRate: { type: Number },       // %
            seasonality: { type: String },       // "yaz_urun", "kis_urun", "yil_boyu"
            bestSellingDays: [{ type: String }], // ["Pazartesi", "Cuma"]
            bestSellingMonths: [{ type: String }],
        },

        // Fırsat analizi
        opportunities: [{
            type: { type: String },     // "price_gap", "low_competition", "high_demand"
            description: { type: String },
            potentialRevenue: { type: Number },
            confidence: { type: Number },
        }],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // RAKİP ANALİZİ (competitor_analysis)
    // ═══════════════════════════════════════════════════════════════════════
    competitorAnalysis: {
        competitorName: { type: String },
        marketplace: { type: String },

        // Rakip mağaza metrikleri
        shopMetrics: {
            totalProducts: { type: Number },
            avgPrice: { type: Number },
            priceRange: { min: Number, max: Number },
            estimatedMonthlyRevenue: { type: Number },
            avgRating: { type: Number },
            totalReviews: { type: Number },
        },

        // Ürün karşılaştırma
        productComparison: [{
            competitorProduct: { type: String },
            competitorPrice: { type: Number },
            myProduct: { type: String },
            myPrice: { type: Number },
            priceDiff: { type: Number },        // %
            competitorRating: { type: Number },
            myRating: { type: Number },
        }],

        // Fiyat pozisyonu
        pricePosition: {
            myAvgPrice: { type: Number },
            competitorAvgPrice: { type: Number },
            position: { type: String, enum: ["cheaper", "similar", "expensive"] },
            diffPercentage: { type: Number },
        },

        // Rakibin güçlü/zayıf yönleri
        competitorStrengths: [{ type: String }],
        competitorWeaknesses: [{ type: String }],
        actionableInsights: [{ type: String }],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ANAHTAR KELİME ARAŞTIRMASI (keyword_research)
    // ═══════════════════════════════════════════════════════════════════════
    keywordResearch: {
        seedKeyword: { type: String },
        marketplace: { type: String },

        keywords: [{
            keyword: { type: String },
            searchVolume: { type: Number },         // Tahmini aylık arama
            competition: { type: String, enum: ["low", "medium", "high"] },
            competitionScore: { type: Number },     // 0-100
            relevanceScore: { type: Number },       // 0-100
            suggestedBid: { type: Number },         // Reklam teklif önerisi
            trend: { type: String, enum: ["rising", "stable", "declining"] },
        }],

        // Uzun kuyruk önerileri
        longTailSuggestions: [{
            keyword: { type: String },
            estimatedVolume: { type: Number },
            competition: { type: String },
        }],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // AI İÇERİK ÜRETİMİ (content_generation)
    // ═══════════════════════════════════════════════════════════════════════
    contentGeneration: {
        contentType: { type: String, enum: ["title", "description", "both"] },
        language: { type: String, default: "tr" },
        inputKeywords: [{ type: String }],
        inputProductInfo: { type: String },

        // Üretilen içerikler
        generatedTitles: [{
            title: { type: String },
            seoScore: { type: Number },
            charCount: { type: Number },
            keywordsUsed: [{ type: String }],
        }],

        generatedDescriptions: [{
            description: { type: String },
            seoScore: { type: Number },
            charCount: { type: Number },
            keywordsUsed: [{ type: String }],
            hasBulletPoints: { type: Boolean },
        }],

        // Kullanılan anahtar kelimeler
        targetKeywords: [{ type: String }],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FİYAT ÖNERİSİ (price_suggestion)
    // ═══════════════════════════════════════════════════════════════════════
    priceSuggestion: {
        currentPrice: { type: Number },
        suggestedPrice: { type: Number },
        minPrice: { type: Number },
        maxPrice: { type: Number },
        optimalPrice: { type: Number },

        // Analiz detayları
        competitorPrices: [{
            sellerName: { type: String },
            price: { type: Number },
            rating: { type: Number },
        }],

        priceElasticity: { type: Number },      // Fiyat esnekliği tahmini
        estimatedSalesAtSuggested: { type: Number },
        estimatedRevenueAtSuggested: { type: Number },
        reasoning: { type: String },
    },

    // ── Genel Meta ──
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
        index: true,
    },
    processingTimeMs: { type: Number },
    error: { type: String },

}, { timestamps: true });

// Indexes
RoketfyAnalysisSchema.index({ userId: 1, analysisType: 1, createdAt: -1 });
RoketfyAnalysisSchema.index({ userId: 1, "target.barcode": 1, analysisType: 1 });
RoketfyAnalysisSchema.index({ userId: 1, status: 1 });

// TTL: 30 gün sonra eski analizleri sil
RoketfyAnalysisSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("RoketfyAnalysis", RoketfyAnalysisSchema);
