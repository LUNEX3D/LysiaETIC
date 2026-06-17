const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBAISuggestionSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        pageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },

        type: {
            type: String,
            required: true,
            enum: ["conversion", "seo", "performance", "ab_test", "content", "ux", "accessibility"],
            index: true,
        },

        priority: {
            type: String,
            enum: ["critical", "high", "medium", "low"],
            default: "medium",
            index: true,
        },

        status: {
            type: String,
            enum: ["new", "viewed", "applied", "dismissed", "testing", "expired"],
            default: "new",
            index: true,
        },

        title: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        impact: { type: String, default: "" },
        effort: { type: String, enum: ["low", "medium", "high"], default: "medium" },

        affectedElement: {
            type: { type: String, enum: ["page", "section", "block", "site_setting", "theme"], default: "page" },
            targetId: { type: Schema.Types.ObjectId, default: null },
            sectionId: { type: String, default: "" },
            blockType: { type: String, default: "" },
        },

        suggestedChange: { type: Schema.Types.Mixed, default: null },
        currentState: { type: Schema.Types.Mixed, default: null },

        aiAnalysis: { type: String, default: "" },
        dataSource: [{ type: String, enum: ["analytics", "ai_analysis", "best_practice", "competitor_analysis", "user_feedback"] }],

        generatedAt: { type: Date, default: Date.now },
        viewedAt: { type: Date, default: null },
        appliedAt: { type: Date, default: null },
        dismissedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },

        linkedABTestId: { type: Schema.Types.ObjectId, ref: "WBABTest", default: null },
        linkedJobId: { type: Schema.Types.ObjectId, ref: "WBAIJob", default: null },
    },
    { timestamps: true }
);

WBAISuggestionSchema.index({ siteId: 1, status: 1, priority: 1 });
WBAISuggestionSchema.index({ siteId: 1, type: 1, status: 1 });
// TTL: Süresi dolmuş öneriler 30 gün sonra silinir
WBAISuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, sparse: true });

module.exports = mongoose.model("WBAISuggestion", WBAISuggestionSchema);
