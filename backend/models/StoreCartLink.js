const mongoose = require("mongoose");

const CartLinkProductSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct", required: true },
        quantity: { type: Number, default: 1, min: 1 },
        variantBarcode: { type: String, default: "" },
    },
    { _id: false }
);

const StoreCartLinkSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        salesChannelId: { type: String, required: true, trim: true },
        salesChannelLabel: { type: String, default: "", trim: true },
        basePath: { type: String, required: true, trim: true },
        products: { type: [CartLinkProductSchema], default: [] },
        trackUtm: { type: Boolean, default: false },
        couponMode: { type: String, enum: ["none", "with_code"], default: "none" },
        couponCode: { type: String, default: "", trim: true },
        generatedUrl: { type: String, default: "" },
    },
    { timestamps: true }
);

StoreCartLinkSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("StoreCartLink", StoreCartLinkSchema);
