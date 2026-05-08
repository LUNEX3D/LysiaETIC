/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AIConversation Model — LysiaETIC AI Operatör
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcı ile AI arasındaki konuşma geçmişini saklar.
 * Memory sistemi: AI geçmiş konuşmaları hatırlar, öğrenir.
 *
 * Collections:
 *  - conversations: Konuşma oturumları
 *  - Her oturum içinde messages array
 *  - AI aksiyonları ve sonuçları da kaydedilir
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "ai", "system", "action"],
        required: true,
    },
    content: { type: String, required: true },

    // AI'ın mesajla birlikte döndürdüğü metadata
    metadata: {
        intent: { type: String },           // detected intent: "price_query", "stock_check", etc.
        confidence: { type: Number },        // intent confidence 0-100
        entities: { type: mongoose.Schema.Types.Mixed }, // extracted entities: { barcode, productName, marketplace }
        actionTaken: { type: String },       // if AI took an action
        actionResult: { type: mongoose.Schema.Types.Mixed }, // action result
        dataSnapshot: { type: mongoose.Schema.Types.Mixed }, // relevant data at time of message
        emotionalTone: { type: String },     // positive, neutral, urgent, etc.
        suggestions: [{ type: String }],     // quick reply suggestions
        agentTrace: [{ type: mongoose.Schema.Types.Mixed }], // ajan adımları (id, label, detail, status)
        agentModel: { type: String },
        agentNote: { type: String },
        llmModel: { type: String },
    },

    timestamp: { type: Date, default: Date.now },
});

const AIConversationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // Oturum bilgisi
    sessionId: { type: String, required: true, index: true },
    title: { type: String, default: "Yeni Konuşma" },
    status: {
        type: String,
        enum: ["active", "closed", "archived"],
        default: "active",
    },

    // Mesajlar
    messages: [MessageSchema],

    // Konuşma özeti (AI tarafından üretilir)
    summary: { type: String, default: "" },

    // Konuşmada yapılan aksiyonlar
    actionsPerformed: [{
        actionType: { type: String },
        targetId: { type: String },
        targetName: { type: String },
        params: { type: mongoose.Schema.Types.Mixed },
        result: { type: mongoose.Schema.Types.Mixed },
        performedAt: { type: Date, default: Date.now },
    }],

    // Konuşma context'i (AI'ın hatırlaması gereken bilgiler)
    context: {
        currentTopic: { type: String },
        mentionedProducts: [{ type: String }],  // barcodes
        mentionedMarketplaces: [{ type: String }],
        userMood: { type: String, default: "neutral" },
        operationMode: {
            type: String,
            enum: ["passive", "assisted", "autonomous"],
            default: "assisted",
        },
    },

    // İstatistikler
    stats: {
        messageCount: { type: Number, default: 0 },
        userMessageCount: { type: Number, default: 0 },
        aiMessageCount: { type: Number, default: 0 },
        actionsCount: { type: Number, default: 0 },
    },

}, { timestamps: true });

// Indexes
AIConversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });
AIConversationSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

// TTL: 30 gün sonra eski konuşmaları sil
AIConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("AIConversation", AIConversationSchema);
