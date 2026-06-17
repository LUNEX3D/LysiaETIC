const mongoose = require("mongoose");

const MarketingAffiliateSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, default: "", lowercase: true, trim: true },
        code: { type: String, required: true, trim: true, uppercase: true },
        commissionType: { type: String, enum: ["percent", "fixed"], default: "percent" },
        commissionValue: { type: Number, default: 10 },
        status: { type: String, enum: ["active", "paused"], default: "active", index: true },
        stats: {
            clicks: { type: Number, default: 0 },
            orders: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
            commissionOwed: { type: Number, default: 0 },
            commissionPaid: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

MarketingAffiliateSchema.index({ storeId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("MarketingAffiliate", MarketingAffiliateSchema);
