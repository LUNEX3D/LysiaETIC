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
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending"
    },
    paymentMethod: {
        type: String,
        enum: ["credit_card", "bank_transfer", "paypal", "stripe", "iyzico"],
        default: "credit_card"
    },
    transactionId: String,
    invoiceNumber: String,
    invoiceUrl: String,
    description: String,
    metadata: {
        type: Object,
        default: {}
    },
    paidAt: Date,
    refundedAt: Date,
    refundReason: String
}, { timestamps: true });

PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Payment", PaymentSchema);
