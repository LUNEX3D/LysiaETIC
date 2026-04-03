/**
 * AIAnalysisCache Model — LysiaETIC AI Background Worker
 *
 * Stores pre-computed AI analysis results per user.
 * The background worker updates this every 5 minutes per user.
 * Frontend reads from cache instead of computing on every request.
 *
 * TTL: 15 minutes (auto-expire if worker stops)
 */
const mongoose = require("mongoose");

const AIAnalysisCacheSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },

    // Full brain dashboard result (JSON blob)
    brainData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // Strategy mode used for this analysis
    strategyMode: {
        type: String,
        enum: ["balanced", "aggressive_sales", "high_profit", "stock_clearance"],
        default: "balanced",
    },

    // Worker metadata
    lastAnalyzedAt: { type: Date, default: Date.now, index: true },
    analysisVersion: { type: Number, default: 1 },
    analysisDurationMs: { type: Number, default: 0 },
    productCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },

    // Health snapshot (for quick queries without loading full brainData)
    healthSnapshot: {
        overallScore: { type: Number, default: 0 },
        rating: { type: String, default: "warning" },
        criticalAlerts: { type: Number, default: 0 },
        pendingRecs: { type: Number, default: 0 },
        totalLoss: { type: Number, default: 0 },
    },

    // Error tracking
    lastError: { type: String, default: null },
    consecutiveErrors: { type: Number, default: 0 },

}, { timestamps: true });

// TTL: auto-delete if not updated for 30 minutes
AIAnalysisCacheSchema.index({ lastAnalyzedAt: 1 }, { expireAfterSeconds: 1800 });

module.exports = mongoose.model("AIAnalysisCache", AIAnalysisCacheSchema);
