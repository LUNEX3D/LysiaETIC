/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AIActionAudit — AI Otonom Aksiyon Denetim Defteri
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Append-only audit log. AI Operatör tarafından yapılan TÜM otomatik
 * aksiyonlar (fiyat değişimi, indirim uygulama, vs.) buraya kayıt edilir.
 *
 * Amaç:
 *  - Otonom modda hesap verilebilirlik: kim/ne zaman/hangi kararla
 *  - Rollback: önceki değer saklanır
 *  - Compliance & güvenlik denetimi
 *
 * TTL: 180 gün (uzun süreli denetim için)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const AIActionAuditSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // Aksiyon kimliği — Recommendation kaydı
    recommendationId: { type: mongoose.Schema.Types.ObjectId, ref: "Recommendation", index: true },
    executionKey: { type: String, index: true },

    // Aksiyon türü
    actionType: {
        type: String,
        enum: ["update_price", "apply_discount", "mark_inactive", "create_stock_order", "review_strategy", "investigate", "other"],
        required: true,
        index: true,
    },

    // Hangi yolla tetiklendi?
    trigger: {
        type: String,
        enum: ["autonomous_cycle", "manual_operator_cycle", "manual_approve", "api_direct"],
        required: true,
        index: true,
    },

    // Operasyon modu
    operationMode: {
        type: String,
        enum: ["passive", "assisted", "autonomous"],
    },

    // Hedef ürün
    target: {
        barcode: { type: String, index: true },
        productName: String,
        marketplace: String,
    },

    // Önceki durum (rollback için kritik)
    before: {
        price: Number,
        listPrice: Number,
        stock: Number,
        snapshot: { type: mongoose.Schema.Types.Mixed }, // ek alanlar
    },

    // Sonraki durum
    after: {
        price: Number,
        listPrice: Number,
        stock: Number,
        snapshot: { type: mongoose.Schema.Types.Mixed },
    },

    // AI kararı
    decision: {
        title: String,
        description: String,
        confidence: Number,
        impact: Number,
        params: { type: mongoose.Schema.Types.Mixed },
        guardrailApplied: { type: Boolean, default: false },
        guardrailNote: String,
    },

    // Pazaryeri sync
    marketplaceSync: {
        attempted: { type: Number, default: 0 },
        succeeded: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        errors: [{
            marketplace: String,
            error: String,
        }],
    },

    // Sonuç
    result: {
        success: { type: Boolean, default: false },
        message: String,
        durationMs: Number,
    },

    // Rollback metadata
    rollback: {
        rolledBack: { type: Boolean, default: false },
        rolledBackAt: Date,
        rolledBackBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rollbackReason: String,
        rollbackResult: { type: mongoose.Schema.Types.Mixed },
    },

}, { timestamps: true });

// Indexes
AIActionAuditSchema.index({ userId: 1, createdAt: -1 });
AIActionAuditSchema.index({ userId: 1, "target.barcode": 1, createdAt: -1 });
AIActionAuditSchema.index({ "rollback.rolledBack": 1, createdAt: -1 });

// TTL: 180 gün
AIActionAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model("AIActionAudit", AIActionAuditSchema);
