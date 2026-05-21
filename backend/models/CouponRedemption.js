/**
 * CouponRedemption — Kupon kullanım kayıtları
 */
const mongoose = require("mongoose");

const CouponRedemptionSchema = new mongoose.Schema({
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PromotionCoupon",
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
        index: true
    },
    code: {
        type: String,
        required: true,
        uppercase: true
    },
    plan: String,
    billingCycle: String,
    originalAmount: Number,
    discountAmount: Number,
    finalAmount: Number,
    redeemedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

CouponRedemptionSchema.index({ couponId: 1, userId: 1 });
CouponRedemptionSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("CouponRedemption", CouponRedemptionSchema);
