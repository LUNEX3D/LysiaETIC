const mongoose = require("mongoose");

const dynamicConditionSchema = {
    field: { type: String, default: "name" },
    operator: { type: String, default: "contains" },
    value: { type: String, default: "" },
};

const StoreCategorySchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true },
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreCategory", default: null },
        sortOrder: { type: Number, default: 0 },
        categoryType: { type: String, enum: ["normal", "dynamic"], default: "normal" },
        description: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        sortCriteria: { type: String, default: "" },
        conditionMatch: { type: String, enum: ["all", "any"], default: "any" },
        dynamicConditions: [dynamicConditionSchema],
        seo: {
            slug: { type: String, default: "" },
            pageTitle: { type: String, default: "" },
            metaDescription: { type: String, default: "" },
            noIndex: { type: Boolean, default: false },
            canonicalUrl: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

StoreCategorySchema.index({ storeId: 1, parentId: 1, name: 1 });
StoreCategorySchema.index({ storeId: 1, "seo.slug": 1 });

module.exports = mongoose.model("StoreCategory", StoreCategorySchema);
