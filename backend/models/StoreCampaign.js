const mongoose = require("mongoose");

const ProductRuleSchema = new mongoose.Schema(
    {
        field: { type: String, enum: ["products", "brands", "categories", "tags"], default: "products" },
        mode: { type: String, enum: ["include", "exclude"], default: "include" },
        values: { type: [String], default: [] },
    },
    { _id: false }
);

const StoreCampaignSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        kind: { type: String, enum: ["automatic", "code"], default: "automatic", index: true },
        code: { type: String, default: "", trim: true, maxlength: 64 },
        discountType: {
            type: String,
            enum: ["percentage", "fixed", "free_shipping", "buy_x_get_y"],
            default: "percentage",
        },
        discountValue: { type: Number, default: 0, min: 0 },
        scope: { type: String, enum: ["all_products", "specific_products"], default: "all_products" },
        includeDiscountedProducts: { type: Boolean, default: false },
        productRules: { type: [ProductRuleSchema], default: [] },
        requirements: {
            limitPurchaseAmount: { type: Boolean, default: false },
            minPurchaseAmount: { type: Number, default: 0 },
            maxPurchaseAmount: { type: Number, default: null },
            limitQuantity: { type: Boolean, default: false },
            minQuantity: { type: Number, default: 0 },
            maxQuantity: { type: Number, default: null },
        },
        extraDiscounts: {
            freeShippingOnCode: { type: Boolean, default: false },
            addRewardProduct: { type: Boolean, default: false },
            rewardProductIds: { type: [String], default: [] },
        },
        priceBasis: { type: String, enum: ["sale", "discounted"], default: "sale" },
        buyRuleTarget: {
            type: String,
            enum: ["products", "categories", "brands", "tags"],
            default: "products",
        },
        buyXGetY: {
            buyCondition: { type: String, enum: ["quantity", "amount"], default: "quantity" },
            buyQuantity: { type: Number, default: 0 },
            buyAmount: { type: Number, default: 0 },
            buyMaxQuantity: { type: Number, default: null },
            buyProductIds: { type: [String], default: [] },
            getQuantity: { type: Number, default: 0 },
            getProductIds: { type: [String], default: [] },
            getDiscountPercent: { type: Number, default: 0 },
            getFree: { type: Boolean, default: false },
            autoAddToCart: { type: Boolean, default: false },
        },
        usageLimits: {
            totalEnabled: { type: Boolean, default: false },
            totalLimit: { type: Number, default: null },
            perUserEnabled: { type: Boolean, default: false },
            perUserLimit: { type: Number, default: null },
        },
        customers: {
            scope: { type: String, enum: ["all", "groups", "specific"], default: "all" },
            groupNames: { type: [String], default: [] },
            customerIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
            accountOnly: { type: Boolean, default: false },
        },
        settings: {
            combineWithOthers: { type: Boolean, default: false },
            channelsEnabled: { type: Boolean, default: false },
            salesChannelIds: { type: [String], default: [] },
            currenciesEnabled: { type: Boolean, default: false },
            currencies: { type: [String], default: [] },
            perOrderLimitEnabled: { type: Boolean, default: false },
            perOrderLimit: { type: Number, default: 1 },
        },
        dates: {
            startEnabled: { type: Boolean, default: false },
            startDate: { type: Date, default: null },
            endEnabled: { type: Boolean, default: false },
            endDate: { type: Date, default: null },
        },
        usageCount: { type: Number, default: 0, min: 0 },
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

StoreCampaignSchema.index({ storeId: 1, kind: 1, createdAt: -1 });
StoreCampaignSchema.index(
    { storeId: 1, kind: 1, code: 1 },
    {
        unique: true,
        partialFilterExpression: { kind: "code", code: { $type: "string", $ne: "" } },
    }
);

module.exports = mongoose.model("StoreCampaign", StoreCampaignSchema);
