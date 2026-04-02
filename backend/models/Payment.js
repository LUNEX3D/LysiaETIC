/**
 * Payment Model — LysiaETIC
 *
 * Ödeme kayıtları.
 *
 * ✅ FIX: failReason, errorCode, processedAt alanları eklendi
 * ✅ FIX: transactionId unique index eklendi (race condition koruması)
 * ✅ FIX: expectedPlan, expectedAmount alanları eklendi (fiyat-plan doğrulama)
 */
const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: "TRY"
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded", "processing"],
        default: "pending"
    },
    paymentMethod: {
        type: String,
        enum: ["credit_card", "bank_transfer", "paypal", "stripe", "iyzico", "paytr"],
        default: "credit_card"
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    invoiceNumber: String,
    invoiceUrl: String,
    description: String,

    // ── Ödeme oluşturulurken kaydedilen beklenen değerler (doğrulama için) ──
    expectedPlan: {
        type: String,
        enum: ["basic", "pro", "enterprise"]
    },
    expectedAmount: {
        type: Number  // Kuruş cinsinden (örn: 29900)
    },
    expectedBillingCycle: {
        type: String,
        enum: ["monthly", "yearly"]
    },

    metadata: {
        type: Object,
        default: {}
    },
    paidAt: Date,
    processedAt: Date,       // Callback'in işlendiği zaman
    refundedAt: Date,
    refundReason: String,

    // ── Başarısız ödeme detayları ──
    failReason: String,      // İnsan okunabilir hata mesajı
    errorCode: String,       // PayTR hata kodu
    failedAt: Date
}, { timestamps: true });

PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Payment", PaymentSchema);
