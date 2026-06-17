const mongoose = require("mongoose");

const stockCountLineSchema = {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct" },
    title: { type: String, default: "" },
    variantBarcode: { type: String, default: "" },
    systemStock: { type: Number, default: 0 },
    countedQty: { type: Number, default: 0 },
};

const stockCountFilterSchema = {
    type: { type: String, enum: ["brand", "tag", "supplier", "category"], required: true },
    value: { type: String, required: true },
};

const stockCountActionSchema = {
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
};

const StoreStockCountSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        countNumber: { type: String, required: true, trim: true },
        locationName: { type: String, default: "", trim: true },
        title: { type: String, default: "", trim: true },
        method: { type: String, enum: ["manual", "filter"], default: "manual" },
        status: {
            type: String,
            enum: ["draft", "submitted", "completed", "cancelled"],
            default: "draft",
        },
        lines: [stockCountLineSchema],
        filters: [stockCountFilterSchema],
        recentActions: [stockCountActionSchema],
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);

StoreStockCountSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model("StoreStockCount", StoreStockCountSchema);
