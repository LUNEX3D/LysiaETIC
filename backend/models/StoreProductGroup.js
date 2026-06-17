const mongoose = require("mongoose");

const productGroupItemSchema = {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProduct", required: true },
    sortOrder: { type: Number, default: 0 },
    values: { type: Map, of: String, default: {} },
};

const StoreProductGroupSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true },
        groupType: { type: String, enum: ["manual", "automatic"], default: "manual" },
        variantTypeLabels: [{ type: String, trim: true }],
        items: [productGroupItemSchema],
        autoConfig: {
            groupingFieldId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreCustomFieldDefinition" },
            typeSource: { type: String, enum: ["variant", "custom_field"], default: "variant" },
            typeCustomFieldId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreCustomFieldDefinition" },
        },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

StoreProductGroupSchema.index({ storeId: 1, name: 1 });

module.exports = mongoose.model("StoreProductGroup", StoreProductGroupSchema);
