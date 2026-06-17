const mongoose = require("mongoose");

const variantOptionValueSchema = {
    label: { type: String, required: true, trim: true },
    colorHex: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
};

const variantOptionGroupSchema = {
    name: { type: String, required: true, trim: true },
    displayStyle: { type: String, enum: ["list", "color_image"], default: "list" },
    showOnListingPages: { type: Boolean, default: false },
    values: [variantOptionValueSchema],
};

const variantSchema = {
    title: { type: String, default: "" },
    sku: { type: String, default: "" },
    barcode: { type: String, default: "" },
    price: { type: Number, default: 0 },
    compareAtPrice: { type: Number },
    stock: { type: Number, default: 0 },
    options: { type: Map, of: String },
};

const StoreProductSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        productMappingId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductMapping", required: false },
        source: { type: String, enum: ["native", "mapping"], default: "native" },
        productType: { type: String, enum: ["simple", "variant"], default: "simple" },
        productKind: { type: String, enum: ["physical", "digital"], default: "physical" },
        saleStatus: { type: String, enum: ["on_sale", "closed"], default: "on_sale" },
        visible: { type: Boolean, default: true },
        slug: { type: String, required: true, trim: true },
        sortOrder: { type: Number, default: 0 },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        images: [{ type: String }],
        videos: [{ type: String }],
        price: { type: Number, required: true, default: 0 },
        compareAtPrice: { type: Number },
        costPrice: { type: Number },
        showUnitPrice: { type: Boolean, default: false },
        unitPrice: {
            productMeasureValue: { type: Number },
            productMeasureUnit: { type: String, default: "cl" },
            soldUnitValue: { type: Number },
            soldUnitUnit: { type: String, default: "" },
        },
        stock: { type: Number, default: 0 },
        vatRate: { type: Number, default: 20 },
        barcode: { type: String, default: "" },
        sku: { type: String, default: "" },
        brand: { type: String, default: "" },
        tags: [{ type: String }],
        supplier: { type: String, default: "" },
        googleCategory: { type: String, default: "" },
        googleCategoryId: { type: Number },
        categories: [{ type: String }],
        productCategories: [
            {
                categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreCategory" },
                isPrimary: { type: Boolean, default: false },
            },
        ],
        variantOptionGroups: [variantOptionGroupSchema],
        variants: [variantSchema],
        inventory: {
            desi: { type: Number },
            hsCode: { type: String, default: "" },
            continueSellingWhenOutOfStock: { type: Boolean, default: false },
            locations: [
                {
                    name: { type: String, default: "Ana Depo" },
                    stock: { type: Number, default: 0 },
                },
            ],
        },
        seo: {
            slug: { type: String, default: "" },
            metaTitle: { type: String, default: "" },
            metaDescription: { type: String, default: "" },
            noindex: { type: Boolean, default: false },
            canonicalUrl: { type: String, default: "" },
        },
        customFields: [
            {
                fieldId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreCustomFieldDefinition" },
                value: { type: String, default: "" },
            },
        ],
        publishedAt: { type: Date },
    },
    { timestamps: true }
);

StoreProductSchema.index({ storeId: 1, slug: 1 }, { unique: true });
StoreProductSchema.index({ storeId: 1, visible: 1, sortOrder: 1 });

module.exports = mongoose.model("StoreProduct", StoreProductSchema);
