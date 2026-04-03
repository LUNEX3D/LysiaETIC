/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AICycleResult Model — LysiaETIC AI Operatör Otonom Döngü Sonuçları
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Arka planda sürekli çalışan AI Operatör döngüsünün her çalışma sonucunu saklar.
 * Frontend bu koleksiyondan döngü geçmişini, aksiyonları ve öğrenmeleri gösterir.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const AICycleResultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // Döngü numarası (kullanıcı bazlı artan)
    cycleNumber: { type: Number, default: 1 },

    // Hangi modda çalıştı?
    operationMode: {
        type: String,
        enum: ["passive", "assisted", "autonomous"],
        default: "assisted",
    },

    // Döngü fazları ve süreleri
    phases: {
        observe:  { durationMs: Number, success: { type: Boolean, default: true }, error: String },
        analyze:  { durationMs: Number, success: { type: Boolean, default: true }, error: String },
        decide:   { durationMs: Number, success: { type: Boolean, default: true }, error: String },
        act:      { durationMs: Number, success: { type: Boolean, default: true }, actionsExecuted: { type: Number, default: 0 }, error: String },
        verify:   { durationMs: Number, success: { type: Boolean, default: true }, error: String },
        learn:    { durationMs: Number, success: { type: Boolean, default: true }, error: String },
    },

    // Gözlem metrikleri (özet)
    observation: {
        totalProducts: { type: Number, default: 0 },
        activeProducts: { type: Number, default: 0 },
        outOfStock: { type: Number, default: 0 },
        lowStock: { type: Number, default: 0 },
        lossProducts: { type: Number, default: 0 },
        todayRevenue: { type: Number, default: 0 },
        monthRevenue: { type: Number, default: 0 },
        totalOrdersToday: { type: Number, default: 0 },
        marketplaceCount: { type: Number, default: 0 },
        memoryCount: { type: Number, default: 0 },
    },

    // Analiz sonuçları (özet)
    analysis: {
        aiScore: { type: Number, default: 0 },
        healthScore: { type: Number, default: 0 },
        healthRating: { type: String, default: "unknown" },
        riskScore: { type: Number, default: 0 },
        totalLossImpact: { type: Number, default: 0 },
        lossCount: { type: Number, default: 0 },
        focusItemCount: { type: Number, default: 0 },
        predictionCount: { type: Number, default: 0 },
        emotionalTone: { type: String, default: "neutral" },
    },

    // Kararlar
    decisions: {
        totalDecisions: { type: Number, default: 0 },
        criticalCount: { type: Number, default: 0 },
        totalPotentialImpact: { type: Number, default: 0 },
        guardrailsApplied: { type: Number, default: 0 },
        // İlk 10 kararın özeti
        items: [{
            type: { type: String },
            title: { type: String },
            action: { type: String },
            urgency: { type: String },
            impact: { type: Number, default: 0 },
            confidence: { type: Number, default: 0 },
            autoExecutable: { type: Boolean, default: false },
            requiresApproval: { type: Boolean, default: false },
        }],
    },

    // Uygulanan aksiyonlar (autonomous modda)
    actions: [{
        action: { type: String },
        title: { type: String },
        barcode: { type: String },
        success: { type: Boolean, default: false },
        message: { type: String },
        verified: { type: Boolean, default: false },
        learned: { type: Boolean, default: false },
    }],

    // Üretilen uyarılar
    alerts: [{
        type: { type: String },
        severity: { type: String },
        title: { type: String },
        message: { type: String },
    }],

    // Toplam süre
    totalDurationMs: { type: Number, default: 0 },

    // Durum
    status: {
        type: String,
        enum: ["running", "completed", "failed", "skipped"],
        default: "completed",
    },
    error: { type: String, default: null },

    // Bir sonraki döngü ne zaman?
    nextCycleAt: { type: Date },

}, { timestamps: true });

// Indexes
AICycleResultSchema.index({ userId: 1, createdAt: -1 });
AICycleResultSchema.index({ userId: 1, cycleNumber: -1 });
AICycleResultSchema.index({ status: 1, createdAt: -1 });

// TTL: 7 gün sonra eski döngü sonuçlarını sil (çok fazla birikmemesi için)
AICycleResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("AICycleResult", AICycleResultSchema);
