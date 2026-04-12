/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OpportunityResult Model — LysiaRadar PRO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * AI Ürün Fırsat Motoru sonuçlarını saklar.
 * Her kullanıcı için kişiselleştirilmiş fırsatlar, skorlar ve AI açıklamaları.
 *
 * Lifecycle:
 *   1. Worker veri toplar (trend, pazar, kullanıcı)
 *   2. Skorlama servisi puanlar
 *   3. AI açıklama üretir
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
    keyword: { type: String, required: true },           // Ürün / anahtar kelime
    category: { type: String, default: "" },              // Kategori adı
    categoryId: { type: String, default: "" },            // Kategori ID
    source: {
        type: String,
        enum: ["trend", "marketplace", "user_data", "search_suggest", "social", "ai_discovery"],
        default: "marketplace",
    },

    // ── Pazar Verileri ──
    marketData: {
        avgPrice: { type: Number, default: 0 },          // Ortalama fiyat
        minPrice: { type: Number, default: 0 },          // Minimum fiyat
        maxPrice: { type: Number, default: 0 },          // Maksimum fiyat
        sellerCount: { type: Number, default: 0 },       // Satıcı sayısı
        totalProducts: { type: Number, default: 0 },     // Toplam ürün sayısı
        avgRating: { type: Number, default: 0 },         // Ortalama puan
        avgReviewCount: { type: Number, default: 0 },    // Ortalama yorum sayısı
        topBrands: [{ type: String }],                    // En popüler markalar
        estimatedMonthlySales: { type: Number, default: 0 }, // Tahmini aylık satış
        estimatedMonthlyRevenue: { type: Number, default: 0 }, // Tahmini aylık ciro
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

    // ── Trend Verileri ──
    trendData: {
        trendScore: { type: Number, default: 0 },        // 0-100 trend skoru
        trendDirection: {
            type: String,
            enum: ["rising", "stable", "declining", "breakout", "unknown"],
            default: "unknown",
        },
        searchVolume: { type: Number, default: 0 },       // Arama hacmi (göreceli)
        weeklyChange: { type: Number, default: 0 },       // Haftalık değişim %
        monthlyChange: { type: Number, default: 0 },      // Aylık değişim %
        seasonality: { type: String, default: "" },        // "yaz", "kış", "her_mevsim"
        relatedKeywords: [{ type: String }],               // İlişkili anahtar kelimeler
    },

    // ── Skorlar ──
    scores: {
        trend: { type: Number, default: 0, min: 0, max: 100 },       // Trend skoru
        demand: { type: Number, default: 0, min: 0, max: 100 },      // Talep skoru
        competition: { type: Number, default: 0, min: 0, max: 100 }, // Rekabet skoru (düşük = iyi)
        profit: { type: Number, default: 0, min: 0, max: 100 },      // Kâr potansiyeli
        userFit: { type: Number, default: 0, min: 0, max: 100 },     // Kullanıcı uyumu
    },
    totalScore: { type: Number, default: 0, min: 0, max: 100 },      // Toplam fırsat skoru

    // ── Kâr Analizi ──
    profitAnalysis: {
        estimatedCost: { type: Number, default: 0 },      // Tahmini maliyet
        suggestedPrice: { type: Number, default: 0 },     // Önerilen satış fiyatı
        estimatedMargin: { type: Number, default: 0 },    // Tahmini kâr marjı %
        estimatedMonthlyProfit: { type: Number, default: 0 }, // Tahmini aylık kâr
        commissionRate: { type: Number, default: 0 },     // Komisyon oranı %
    },

    // ── AI Açıklaması ──
    aiExplanation: { type: String, default: "" },          // AI'ın ürettiği açıklama
    aiRisks: [{ type: String }],                           // Risk faktörleri
    aiBenefits: [{ type: String }],                        // Fayda faktörleri
    aiConfidence: { type: Number, default: 50, min: 0, max: 100 }, // AI güven skoru

    // ── Kullanıcı Uyumu ──
    userFitReason: { type: String, default: "" },          // Neden uygun?
    relatedUserCategories: [{ type: String }],             // Kullanıcının ilgili kategorileri
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
    dataFreshness: { type: Date, default: Date.now },      // Veri ne zaman çekildi
    expiresAt: { type: Date },                              // TTL — otomatik silinme

}, { timestamps: true });

// ── İndeksler ──
OpportunityResultSchema.index({ userId: 1, status: 1, totalScore: -1 });
OpportunityResultSchema.index({ userId: 1, keyword: 1 }, { unique: true });
OpportunityResultSchema.index({ userId: 1, category: 1, totalScore: -1 });
OpportunityResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

module.exports = mongoose.model("OpportunityResult", OpportunityResultSchema);
