const mongoose = require("mongoose");

const personalizationValueSchema = {
    label: { type: String, required: true, trim: true },
    priceType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    price: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
};

const personalizationOptionSchema = {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    showDescription: { type: Boolean, default: false },
    type: {
        type: String,
        enum: ["yes_no", "selection", "color", "date", "file", "text", "paragraph"],
        required: true,
    },
    selectionStyle: { type: String, enum: ["box", "list", "color_image"], default: "list" },
    minSelection: { type: Number },
    maxSelection: { type: Number },
    minChars: { type: Number },
    maxChars: { type: Number },
    dateStartDays: { type: Number },
    dateEndDays: { type: Number },
    minFiles: { type: Number },
    maxFiles: { type: Number },
    allowedExtensions: [{ type: String, trim: true }],
    values: [personalizationValueSchema],
    isPaid: { type: Boolean, default: false },
    priceType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    fixedPrice: { type: Number, default: 0 },
    pricePercent: { type: Number, default: 0 },
    required: { type: Boolean, default: false },
    dependsOnOptionId: { type: mongoose.Schema.Types.ObjectId },
    sortOrder: { type: Number, default: 0 },
};

const StoreProductPersonalizationSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        options: [personalizationOptionSchema],
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

StoreProductPersonalizationSchema.index({ storeId: 1, name: 1 });

module.exports = mongoose.model("StoreProductPersonalization", StoreProductPersonalizationSchema);
