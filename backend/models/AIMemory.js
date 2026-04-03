/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AIMemory Model — LysiaETIC AI Operatör
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * AI'ın ÖĞRENME hafızası. Yapılan her aksiyon ve sonucu burada saklanır.
 * Learning Loop: Action → Result → Feedback → Memory → Better Decision
 *
 * Bu model GPT'nin "training" mantığının local versiyonudur:
 *  - Hangi aksiyon ne sonuç verdi?
 *  - Kullanıcı neyi beğendi, neyi beğenmedi?
 *  - Hangi pattern'ler başarılı?
 *  - Hangi saatlerde/günlerde ne tür aksiyonlar daha etkili?
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const AIMemorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // Ne tür bir hafıza kaydı?
    memoryType: {
        type: String,
        enum: [
            "action_result",      // Yapılan aksiyon ve sonucu
            "user_preference",    // Kullanıcı tercihi (onay/red pattern)
            "pattern_learned",    // Öğrenilen pattern (satış trendi, fiyat etkisi)
            "rule_learned",       // Öğrenilen kural ("bu ürün %10'dan fazla indirime tepki vermiyor")
            "context_memory",     // Bağlam hafızası ("kullanıcı genelde sabah aktif")
            "feedback",           // Kullanıcı geri bildirimi
        ],
        required: true,
        index: true,
    },

    // Hafıza içeriği
    key: { type: String, required: true },  // Unique identifier: "price_increase_barcode123"
    value: { type: mongoose.Schema.Types.Mixed, required: true },

    // Aksiyon detayları (action_result için)
    action: {
        type: { type: String },          // "price_update", "stock_reorder", etc.
        targetBarcode: { type: String },
        targetName: { type: String },
        params: { type: mongoose.Schema.Types.Mixed },
        executedAt: { type: Date },
    },

    // Sonuç (action_result için)
    result: {
        success: { type: Boolean },
        measuredAt: { type: Date },
        beforeMetrics: { type: mongoose.Schema.Types.Mixed },  // { sales: 5, revenue: 500 }
        afterMetrics: { type: mongoose.Schema.Types.Mixed },   // { sales: 8, revenue: 800 }
        improvement: { type: Number, default: 0 },             // % improvement
        verdict: { type: String },                              // "positive", "negative", "neutral"
    },

    // Güven skoru: Bu hafıza ne kadar güvenilir?
    confidence: { type: Number, default: 50, min: 0, max: 100 },

    // Kaç kez bu pattern tekrar etti?
    occurrenceCount: { type: Number, default: 1 },

    // Son kullanım
    lastUsedAt: { type: Date, default: Date.now },

    // Etiketler
    tags: [{ type: String }],

}, { timestamps: true });

// Indexes
AIMemorySchema.index({ userId: 1, memoryType: 1, key: 1 }, { unique: true });
AIMemorySchema.index({ userId: 1, memoryType: 1, confidence: -1 });
AIMemorySchema.index({ userId: 1, "action.targetBarcode": 1 });

// TTL: 90 gün kullanılmayan hafızaları sil
AIMemorySchema.index({ lastUsedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("AIMemory", AIMemorySchema);
