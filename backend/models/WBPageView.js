const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBPageViewSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        pageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },
        pageSlug: { type: String, default: "" },
        pageType: { type: String, default: "custom" },

        sessionId: { type: String, required: true, index: true },
        visitorId: { type: String, required: true, index: true },
        isNewVisitor: { type: Boolean, default: true },

        url: { type: String, default: "" },
        referrer: { type: String, default: "" },
        utmSource: { type: String, default: "" },
        utmMedium: { type: String, default: "" },
        utmCampaign: { type: String, default: "" },
        utmContent: { type: String, default: "" },
        utmTerm: { type: String, default: "" },

        device: { type: String, enum: ["desktop", "tablet", "mobile", "unknown"], default: "unknown" },
        browser: { type: String, default: "" },
        os: { type: String, default: "" },
        country: { type: String, default: "" },
        city: { type: String, default: "" },
        language: { type: String, default: "" },

        timeOnPageSeconds: { type: Number, default: 0 },
        scrollDepthPercent: { type: Number, default: 0 },
        isExitPage: { type: Boolean, default: false },
        isBounce: { type: Boolean, default: false },

        abTestId: { type: Schema.Types.ObjectId, ref: "WBABTest", default: null },
        abVariantId: { type: String, default: "" },

        timestamp: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false }
);

WBPageViewSchema.index({ siteId: 1, timestamp: -1 });
WBPageViewSchema.index({ siteId: 1, pageId: 1, timestamp: -1 });
WBPageViewSchema.index({ siteId: 1, sessionId: 1 });
WBPageViewSchema.index({ siteId: 1, visitorId: 1 });
// TTL index: 90 gün sonra otomatik silinir (raw event data)
WBPageViewSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("WBPageView", WBPageViewSchema);
