const mongoose = require("mongoose");

const StoreCartSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        sessionId: { type: String, required: true, index: true },
        items: [
            {
                storeProductId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct" },
                quantity: { type: Number, min: 1, default: 1 },
                unitPrice: { type: Number, required: true },
                title: { type: String, default: "" },
            },
        ],
        currency: { type: String, default: "TRY" },
        expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
    },
    { timestamps: true }
);

StoreCartSchema.index({ storeId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model("StoreCart", StoreCartSchema);
