const mongoose = require("mongoose");

const StoreSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        wbSiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WBSite",
            index: true,
            sparse: true,
            unique: true,
        },
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        status: { type: String, enum: ["draft", "published", "suspended"], default: "draft" },
        businessType: {
            type: String,
            enum: ["fashion", "electronics", "furniture", "cosmetics", "jewelry", "food", "general"],
            default: "general",
        },
        brandStyle: {
            type: String,
            enum: ["modern", "minimal", "luxury", "professional", "colorful", "premium"],
            default: "modern",
        },
        themeId: { type: String, default: "minimal" },
        themeOverrides: {
            primaryColor: { type: String, default: "#4ecdc4" },
            secondaryColor: { type: String, default: "#8b5cf6" },
            fontFamily: { type: String, default: "Inter, sans-serif" },
            logoUrl: { type: String, default: "" },
            faviconUrl: { type: String, default: "" },
        },
        subdomain: { type: String, default: "" },
        customDomain: { type: String, default: "", trim: true, lowercase: true },
        domainStatus: { type: String, enum: ["none", "pending", "verified", "failed"], default: "none" },
        domainVerifyToken: { type: String, default: "" },
        publishedAt: { type: Date },
        settings: {
            currency: { type: String, default: "TRY" },
            locale: { type: String, default: "tr" },
            guestCheckout: { type: Boolean, default: true },
            minOrderAmount: { type: Number, default: 0 },
            contactEmail: { type: String, default: "" },
            contactPhone: { type: String, default: "" },
            address: { type: String, default: "" },
            flatShippingCost: { type: Number, default: 49 },
            freeShippingOver: { type: Number, default: 500 },
        },
        stats: {
            totalOrders: { type: Number, default: 0 },
            totalRevenue: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

StoreSchema.index({ customDomain: 1 }, { sparse: true, unique: true });
StoreSchema.index({ userId: 1, slug: 1 });

module.exports = mongoose.model("Store", StoreSchema);
