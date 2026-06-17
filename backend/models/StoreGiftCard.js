const mongoose = require("mongoose");

const StoreGiftCardSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        code: { type: String, required: true, trim: true, maxlength: 20 },
        initialAmount: { type: Number, required: true, min: 0 },
        usedAmount: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: "TRY" },
        active: { type: Boolean, default: true, index: true },
        minOrderAmount: { type: Number, default: null },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        customer: {
            name: { type: String, default: "" },
            email: { type: String, default: "" },
            phone: { type: String, default: "" },
        },
        salesChannelIds: { type: [String], default: [] },
        timeline: [
            {
                type: { type: String, default: "note" },
                actor: { type: String, default: "" },
                message: { type: String, default: "" },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

StoreGiftCardSchema.index({ storeId: 1, code: 1 }, { unique: true });
StoreGiftCardSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("StoreGiftCard", StoreGiftCardSchema);
