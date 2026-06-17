const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBConversionEventSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        sessionId: { type: String, required: true, index: true },
        visitorId: { type: String, required: true },

        eventType: {
            type: String,
            required: true,
            enum: [
                "page_view",
                "product_view",
                "add_to_cart",
                "remove_from_cart",
                "checkout_start",
                "checkout_complete",
                "purchase",
                "signup",
                "login",
                "form_submit",
                "popup_view",
                "popup_click",
                "popup_close",
                "search",
                "wishlist_add",
                "share",
            ],
            index: true,
        },

        value: { type: Number, default: 0 },
        currency: { type: String, default: "TRY" },

        productId: { type: Schema.Types.ObjectId, default: null },
        productSlug: { type: String, default: "" },
        orderId: { type: Schema.Types.ObjectId, default: null },
        formId: { type: String, default: "" },
        popupId: { type: Schema.Types.ObjectId, ref: "WBPopup", default: null },
        searchQuery: { type: String, default: "" },

        sourcePageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },
        sourcePageSlug: { type: String, default: "" },
        sourceSectionId: { type: String, default: "" },
        sourceBlockType: { type: String, default: "" },

        abTestId: { type: Schema.Types.ObjectId, ref: "WBABTest", default: null },
        abVariantId: { type: String, default: "" },

        device: { type: String, enum: ["desktop", "tablet", "mobile", "unknown"], default: "unknown" },
        country: { type: String, default: "" },

        metadata: { type: Schema.Types.Mixed, default: () => ({}) },

        timestamp: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false }
);

WBConversionEventSchema.index({ siteId: 1, eventType: 1, timestamp: -1 });
WBConversionEventSchema.index({ siteId: 1, sessionId: 1, eventType: 1 });
// TTL: 180 gün
WBConversionEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model("WBConversionEvent", WBConversionEventSchema);
