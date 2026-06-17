const mongoose = require("mongoose");

/** Kampanya / otomasyon / affiliate olay günlükleri */
const MarketingEventSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        type: {
            type: String,
            enum: [
                "campaign_sent",
                "campaign_failed",
                "email_open",
                "email_click",
                "sms_sent",
                "automation_step",
                "popup_view",
                "popup_convert",
                "affiliate_click",
                "affiliate_sale",
            ],
            required: true,
            index: true,
        },
        campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", default: null },
        automationId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingAutomation", default: null },
        segmentId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingSegment", default: null },
        popupId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingPopup", default: null },
        affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingAffiliate", default: null },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreOrder", default: null },
        customerEmail: { type: String, default: "", lowercase: true },
        channel: { type: String, enum: ["EMAIL", "SMS", "POPUP", "AUTOMATION", "AFFILIATE", ""], default: "" },
        revenue: { type: Number, default: 0 },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

MarketingEventSchema.index({ storeId: 1, createdAt: -1 });
MarketingEventSchema.index({ storeId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("MarketingEvent", MarketingEventSchema);
