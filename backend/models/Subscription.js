/**
 * ⚠️ DEPRECATED — FIX H13
 *
 * Bu model User.subscription embedded field ile ÇAKIŞIYOR.
 * Tek doğru kaynak (Single Source of Truth) User.subscription olmalıdır.
 * Bu dosya geriye uyumluluk için korunuyor ancak yeni kodda KULLANILMAMALIDIR.
 *
 * Taşıma planı:
 *   1. saasAdminController.js ve paytrController.js → User.subscription kullanacak şekilde güncellenmeli
 *   2. Bu model tamamen kaldırılmalı
 */
const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    plan: {
        type: String,
        enum: ["free", "trial", "basic", "pro", "enterprise"],
        default: "trial"
    },
    status: {
        type: String,
        enum: ["active", "suspended", "cancelled", "expired", "trial"],
        default: "trial"
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    trialEndDate: {
        type: Date
    },
    autoRenew: {
        type: Boolean,
        default: false
    },
    // Limits
    limits: {
        maxProducts: { type: Number, default: 100 },
        maxOrders: { type: Number, default: 1000 },
        maxMarketplaces: { type: Number, default: 2 },
        maxApiCalls: { type: Number, default: 10000 },
        maxUsers: { type: Number, default: 1 }
    },
    // Usage tracking
    usage: {
        products: { type: Number, default: 0 },
        orders: { type: Number, default: 0 },
        marketplaces: { type: Number, default: 0 },
        apiCalls: { type: Number, default: 0 },
        users: { type: Number, default: 1 },
        lastReset: { type: Date, default: Date.now }
    },
    // Payment
    price: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: "TRY"
    },
    billingCycle: {
        type: String,
        enum: ["monthly", "yearly"],
        default: "monthly"
    },
    lastPaymentDate: Date,
    nextPaymentDate: Date,
    paymentMethod: String,
    // Notes
    notes: String,
    cancelReason: String,
    cancelledAt: Date
}, { timestamps: true });

// Index for queries
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model("Subscription", SubscriptionSchema);
