/**
 * AIGoal Model — LysiaETIC AI Decision Engine
 *
 * User-defined business goals that the AI tracks and breaks into daily actions.
 * Supports: revenue targets, profit targets, sales targets.
 */
const mongoose = require("mongoose");

const AIGoalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // ── Goal Definition ──
    title:       { type: String, required: true },
    description: { type: String, default: "" },

    goalType: {
        type: String,
        enum: ["revenue", "profit", "sales", "custom"],
        required: true
    },

    // ── Target Values ──
    targetValue:  { type: Number, required: true },  // e.g. 100000 TL
    currentValue: { type: Number, default: 0 },
    unit:         { type: String, default: "TL" },    // TL, adet, %

    // ── Time Frame ──
    period: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "monthly"
    },
    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date, required: true },

    // ── Progress ──
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    dailyTarget:     { type: Number, default: 0 },  // Auto-calculated

    // ── Status ──
    status: {
        type: String,
        enum: ["active", "completed", "failed", "paused"],
        default: "active",
        index: true
    },

    // ── AI Breakdown ──
    dailySteps: [{
        date:        { type: Date },
        targetValue: { type: Number },
        actualValue: { type: Number, default: 0 },
        completed:   { type: Boolean, default: false },
        notes:       { type: String }
    }],

    // ── Metadata ──
    marketplace: { type: String },  // Optional: specific marketplace goal

}, { timestamps: true });

AIGoalSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("AIGoal", AIGoalSchema);
