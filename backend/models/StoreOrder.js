const mongoose = require("mongoose");

const StoreOrderSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        orderNumber: { type: String, required: true },
        status: {
            type: String,
            enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "failed"],
            default: "pending_payment",
        },
        customer: {
            name: { type: String, required: true },
            email: { type: String, default: "" },
            phone: { type: String, default: "" },
        },
        shippingAddress: {
            city: { type: String, default: "" },
            district: { type: String, default: "" },
            line: { type: String, default: "" },
            zip: { type: String, default: "" },
        },
        billingAddress: {
            city: { type: String, default: "" },
            district: { type: String, default: "" },
            line: { type: String, default: "" },
            zip: { type: String, default: "" },
        },
        salesChannel: { type: String, default: "" },
        shippingCarrier: { type: String, default: "" },
        labelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "StoreOrderLabel" }],
        isDraft: { type: Boolean, default: false, index: true },
        taxAmount: { type: Number, default: 0 },
        timeline: [
            {
                type: { type: String, default: "note" },
                actor: { type: String, default: "" },
                message: { type: String, default: "" },
                meta: { type: mongoose.Schema.Types.Mixed },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        lineItems: [
            {
                storeProductId: { type: mongoose.Schema.Types.ObjectId },
                productMappingId: { type: mongoose.Schema.Types.ObjectId },
                title: String,
                quantity: Number,
                unitPrice: Number,
                barcode: String,
            },
        ],
        subtotal: { type: Number, required: true },
        shippingCost: { type: Number, default: 0 },
        total: { type: Number, required: true },
        currency: { type: String, default: "TRY" },
        /** website = online mağaza, manual = panelden manuel sipariş */
        source: { type: String, enum: ["website", "manual"], default: "website", index: true },
        marketingSource: {
            channel: {
                type: String,
                enum: ["", "EMAIL", "SMS", "POPUP", "AUTOMATION", "AFFILIATE"],
                default: "",
                index: true,
            },
            campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", default: null },
            automationId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingAutomation", default: null },
            popupId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingPopup", default: null },
            affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingAffiliate", default: null },
            refCode: { type: String, default: "" },
            attributedAt: { type: Date, default: null },
        },
        payment: {
            provider: { type: String, default: "paytr" },
            status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
            paytrMerchantOid: { type: String, default: "", index: true },
            paidAt: { type: Date },
        },
        trackingNumber: { type: String, default: "" },
        guestToken: { type: String, default: "" },
    },
    { timestamps: true }
);

StoreOrderSchema.index({ storeId: 1, orderNumber: 1 }, { unique: true });
StoreOrderSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("StoreOrder", StoreOrderSchema);
