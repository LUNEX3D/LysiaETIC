const mongoose = require("mongoose");

const purchaseLineSchema = {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct" },
    title: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
};

const adjustmentSchema = {
    label: { type: String, default: "" },
    amount: { type: Number, default: 0 },
};

const timelineEntrySchema = {
    text: { type: String, required: true },
    authorName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
};

const StorePurchaseSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        purchaseNumber: { type: String, required: true, trim: true },
        referenceNumber: { type: String, default: "", trim: true },
        supplierName: { type: String, default: "", trim: true },
        branchName: { type: String, default: "", trim: true },
        status: {
            type: String,
            enum: ["draft", "ordered", "in_transit", "received", "cancelled"],
            default: "draft",
        },
        currency: { type: String, default: "TRY" },
        lines: [purchaseLineSchema],
        subtotal: { type: Number, default: 0 },
        vatRate: { type: Number, default: 0 },
        vatAmount: { type: Number, default: 0 },
        shippingCost: { type: Number, default: 0 },
        adjustments: [adjustmentSchema],
        totalCost: { type: Number, default: 0 },
        expectedShipmentAt: { type: Date },
        trackingNumber: { type: String, default: "", trim: true },
        shippingCompany: { type: String, default: "", trim: true },
        notes: { type: String, default: "" },
        timeline: [timelineEntrySchema],
    },
    { timestamps: true }
);

StorePurchaseSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("StorePurchase", StorePurchaseSchema);
