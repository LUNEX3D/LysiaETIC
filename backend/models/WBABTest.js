const mongoose = require("mongoose");
const { Schema } = mongoose;

const ABVariantSchema = new Schema(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        weight: { type: Number, required: true, min: 0, max: 100 },
        isControl: { type: Boolean, default: false },
        content: { type: Schema.Types.Mixed, default: () => ({}) },
        sectionId: { type: String, default: "" },

        stats: {
            visitors: { type: Number, default: 0 },
            conversions: { type: Number, default: 0 },
            rate: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
        },
    },
    { _id: false }
);

const WBABTestSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

        name: { type: String, required: true, trim: true, maxlength: 200 },
        description: { type: String, default: "" },

        status: {
            type: String,
            enum: ["draft", "running", "paused", "completed", "archived"],
            default: "draft",
            index: true,
        },

        testType: {
            type: String,
            enum: ["page", "section", "block_content", "popup"],
            default: "section",
        },

        targetPageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },
        targetSectionId: { type: String, default: "" },
        targetPopupId: { type: Schema.Types.ObjectId, ref: "WBPopup", default: null },

        variants: { type: [ABVariantSchema], default: [] },

        trafficSplit: { type: String, enum: ["equal", "custom", "ai_optimized"], default: "equal" },

        metrics: {
            primaryMetric: {
                type: String,
                enum: ["click_rate", "add_to_cart", "conversion", "time_on_page", "scroll_depth", "form_submit"],
                default: "conversion",
            },
            secondaryMetrics: [{ type: String }],
        },

        schedule: {
            startAt: { type: Date, default: null },
            endAt: { type: Date, default: null },
            minSampleSize: { type: Number, default: 100 },
        },

        results: {
            totalVisitors: { type: Number, default: 0 },
            winnerId: { type: String, default: null },
            confidence: { type: Number, default: 0 },
            completedAt: { type: Date, default: null },
            notes: { type: String, default: "" },
        },

        aiSuggestionId: { type: Schema.Types.ObjectId, ref: "WBAISuggestion", default: null },
        createdFrom: { type: String, enum: ["manual", "ai_suggestion"], default: "manual" },
    },
    { timestamps: true }
);

WBABTestSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model("WBABTest", WBABTestSchema);
