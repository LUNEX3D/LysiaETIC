const mongoose = require("mongoose");

const variantTypeValueSchema = {
    label: { type: String, required: true, trim: true },
    colorHex: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
};

const StoreVariantTypeSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true },
        displayStyle: { type: String, enum: ["list", "color_image"], default: "list" },
        sortOrder: { type: Number, default: 0 },
        values: [variantTypeValueSchema],
    },
    { timestamps: true }
);

StoreVariantTypeSchema.index({ storeId: 1, name: 1 });

module.exports = mongoose.model("StoreVariantType", StoreVariantTypeSchema);
