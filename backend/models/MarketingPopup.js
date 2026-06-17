const mongoose = require("mongoose");

const MarketingPopupSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ["modal", "slide", "top_banner", "bottom_banner", "announcement"],
            default: "modal",
        },
        status: { type: String, enum: ["draft", "active", "paused"], default: "draft", index: true },
        content: {
            title: { type: String, default: "" },
            body: { type: String, default: "" },
            ctaText: { type: String, default: "" },
            ctaUrl: { type: String, default: "" },
            couponCode: { type: String, default: "" },
            imageUrl: { type: String, default: "" },
            collectEmail: { type: Boolean, default: true },
        },
        displayRules: {
            delaySeconds: { type: Number, default: 5 },
            exitIntent: { type: Boolean, default: false },
            onPageLoad: { type: Boolean, default: true },
            showOnProduct: { type: Boolean, default: false },
            showOnCart: { type: Boolean, default: false },
            pathIncludes: { type: [String], default: [] },
        },
        abVariant: { type: String, default: "A" },
        stats: { views: { type: Number, default: 0 }, conversions: { type: Number, default: 0 } },
    },
    { timestamps: true }
);

MarketingPopupSchema.index({ storeId: 1, status: 1 });

module.exports = mongoose.model("MarketingPopup", MarketingPopupSchema);
