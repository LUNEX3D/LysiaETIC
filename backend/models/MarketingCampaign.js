const mongoose = require("mongoose");

const MarketingCampaignSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ["EMAIL", "SMS"], required: true, index: true },
        subject: { type: String, default: "" },
        content: { type: String, default: "" },
        htmlContent: { type: String, default: "" },
        templateKey: {
            type: String,
            enum: ["discount", "new_product", "abandoned_cart", "special_day", "announcement", "coupon", "custom"],
            default: "custom",
        },
        segmentId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingSegment", default: null },
        status: {
            type: String,
            enum: ["draft", "scheduled", "sending", "sent", "paused", "cancelled"],
            default: "draft",
            index: true,
        },
        scheduledAt: { type: Date, default: null },
        sentAt: { type: Date, default: null },
        stats: {
            sent: { type: Number, default: 0 },
            delivered: { type: Number, default: 0 },
            opened: { type: Number, default: 0 },
            clicked: { type: Number, default: 0 },
            converted: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

MarketingCampaignSchema.index({ storeId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("MarketingCampaign", MarketingCampaignSchema);
