/**
 * Recommendation Model — LysiaETIC AI Decision Engine
 *
 * Stores all AI-generated recommendations, user decisions, and action results.
 * Supports: price optimization, stock optimization, dead product detection,
 * trend detection, loss detection, dynamic pricing, anomaly detection.
 */
const mongoose = require("mongoose");

const RecommendationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // ── Recommendation Identity ──
    type: {
        type: String,
        required: true,
        enum: [
            "price_optimization",
            "stock_optimization",
            "dead_product",
            "trend_detection",
            "loss_detection",
            "dynamic_pricing",
            "smart_restock",
            "anomaly_detection",
            "profit_alert",
            "campaign_suggestion",
            "product_launch",
            "strategy_switch"
        ],
        index: true
    },

    // ── Display ──
    title:       { type: String, required: true },
    description: { type: String, required: true },
    category:    { type: String, default: "general" }, // pricing, stock, performance, financial, strategy

    // ── Priority & Confidence ──
    priority: {
        type: String,
        enum: ["critical", "high", "medium", "low"],
        default: "medium",
        index: true
    },
    confidenceScore: { type: Number, default: 50, min: 0, max: 100 },

    // ── Impact Estimation ──
    impact: {
        profitChange:  { type: Number, default: 0 },   // Estimated profit change (TL)
        revenueChange: { type: Number, default: 0 },    // Estimated revenue change (TL)
        salesChange:   { type: Number, default: 0 },     // Estimated sales count change
        riskLevel:     { type: String, enum: ["low", "medium", "high"], default: "low" }
    },

    // ── Action Payload (what to execute if approved) ──
    actionPayload: {
        actionType: { type: String },  // update_price, create_stock_order, mark_inactive, apply_discount, etc.
        targetId:   { type: String },  // Product barcode or ID
        targetName: { type: String },  // Product name
        params:     { type: mongoose.Schema.Types.Mixed, default: {} }
        // e.g. { newPrice: 150, oldPrice: 120 } or { restockQuantity: 50 }
    },

    // ── Status & Lifecycle ──
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "executed", "expired", "failed"],
        default: "pending",
        index: true
    },

    // ── Execution Tracking ──
    executedAt:    { type: Date },
    executionResult: {
        success: { type: Boolean },
        message: { type: String },
        data:    { type: mongoose.Schema.Types.Mixed }
    },

    // ── Idempotency ──
    executionKey: { type: String, unique: true, sparse: true },

    // ── Strategy Context ──
    strategyMode: {
        type: String,
        enum: ["balanced", "aggressive_sales", "high_profit", "stock_clearance"],
        default: "balanced"
    },

    // ── Expiration ──
    expiresAt: { type: Date, index: true },

    // ── Related Data ──
    relatedProducts: [{ type: String }],  // Barcodes
    marketplace:     { type: String },

}, { timestamps: true });

// Compound indexes for efficient queries
RecommendationSchema.index({ userId: 1, status: 1, createdAt: -1 });
RecommendationSchema.index({ userId: 1, type: 1, status: 1 });
RecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model("Recommendation", RecommendationSchema);
