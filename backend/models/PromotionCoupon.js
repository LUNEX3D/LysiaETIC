/**
 * PromotionCoupon — SaaS abonelik indirim kuponları
 */
const mongoose = require("mongoose");

const PromotionCouponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    campaignTag: {
        type: String,
        default: "",
        trim: true,
        index: true
    },
    type: {
        type: String,
        enum: ["percent", "fixed"],
        required: true
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: null
    },
    minPurchaseAmount: {
        type: Number,
        default: 0
    },
    applicablePlans: {
        type: [String],
        default: []
    },
    applicableBillingCycles: {
        type: [String],
        enum: ["monthly", "yearly"],
        default: []
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usageCount: {
        type: Number,
        default: 0
    },
    perUserLimit: {
        type: Number,
        default: 1,
        min: 1
    },
    validFrom: {
        type: Date,
        default: null
    },
    validUntil: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

PromotionCouponSchema.index({ isActive: 1, validUntil: 1 });

module.exports = mongoose.model("PromotionCoupon", PromotionCouponSchema);
