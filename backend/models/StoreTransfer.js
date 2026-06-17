const mongoose = require("mongoose");

const transferLineSchema = {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct" },
    title: { type: String, default: "" },
    variantBarcode: { type: String, default: "" },
    fromBranchStock: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    scannedCode: { type: String, default: "" },
};

const timelineEntrySchema = {
    text: { type: String, required: true },
    authorName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
};

const StoreTransferSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        transferNumber: { type: String, required: true, trim: true },
        waybillNumber: { type: String, default: "", trim: true },
        fromBranch: { type: String, default: "", trim: true },
        toBranch: { type: String, default: "", trim: true },
        status: {
            type: String,
            enum: ["draft", "confirmed", "in_transit", "completed", "cancelled"],
            default: "draft",
        },
        lines: [transferLineSchema],
        importFilters: {
            categoryId: { type: String, default: "" },
            brand: { type: String, default: "" },
            tag: { type: String, default: "" },
        },
        timeline: [timelineEntrySchema],
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);

StoreTransferSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("StoreTransfer", StoreTransferSchema);
