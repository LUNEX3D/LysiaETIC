/**
 * WBProductPage.js — Ürün Sayfası Builder Konfigürasyonu
 * Her site için ürün detay sayfasının layout ve blok konfigürasyonunu depolar.
 * Tüm ürünler bu şablondan render edilir; belirli ürünler için override yapılabilir.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;

const DataBindingSchema = new Schema(
    {
        blockId: { type: String, required: true },
        blockField: { type: String, required: true },
        sourceModel: { type: String, enum: ["Product", "ProductVariant", "ProductReview", "Store"], required: true },
        sourceField: { type: String, required: true },
        transform: { type: String, enum: ["currency", "discount_percent", "rating_stars", "date_format", "none"], default: "none" },
        fallback: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const SectionSettingsSchema = new Schema(
    {
        paddingTop: { type: String, default: "0px" },
        paddingBottom: { type: String, default: "0px" },
        backgroundColor: { type: String, default: "" },
        backgroundImage: { type: String, default: "" },
        fullWidth: { type: Boolean, default: false },
        hidden: { type: Boolean, default: false },
        hiddenOnMobile: { type: Boolean, default: false },
        hiddenOnDesktop: { type: Boolean, default: false },
        customCssClass: { type: String, default: "" },
        customCss: { type: String, default: "" },
    },
    { _id: false }
);

const ProductSectionSchema = new Schema(
    {
        id: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: [
                "product-gallery",
                "product-price",
                "product-variants",
                "add-to-cart",
                "product-description",
                "product-reviews",
                "related-products",
                "product-specifications",
                "product-faq",
                "product-video",
                "hero",
                "text",
                "banner",
                "html",
                "spacer",
                "divider",
                "newsletter",
                "testimonials",
            ],
        },
        order: { type: Number, default: 0 },
        settings: { type: SectionSettingsSchema, default: () => ({}) },
        content: { type: Schema.Types.Mixed, default: () => ({}) },
        mobileOverride: { type: Schema.Types.Mixed, default: () => ({}) },
        isRequired: { type: Boolean, default: false },
        isLocked: { type: Boolean, default: false },
        version: { type: Number, default: 1 },
    },
    { _id: false }
);

const WBProductPageSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        themeInstallId: { type: Schema.Types.ObjectId, ref: "WBThemeInstall", default: null },

        layoutMode: {
            type: String,
            enum: ["template", "per-product-override"],
            default: "template",
        },

        sections: { type: [ProductSectionSchema], default: [] },
        mobileSections: { type: [ProductSectionSchema], default: [] },

        dataBindings: { type: [DataBindingSchema], default: [] },

        layoutConfig: {
            style: { type: String, enum: ["single-column", "two-column", "magazine"], default: "two-column" },
            galleryColumn: { type: Number, enum: [5, 6, 7], default: 6 },
            infoColumn: { type: Number, enum: [5, 6, 7], default: 6 },
            stickyInfo: { type: Boolean, default: true },
        },

        relatedProductsConfig: {
            algorithm: {
                type: String,
                enum: ["same_category", "same_brand", "bought_together", "manual", "ai_recommended"],
                default: "same_category",
            },
            limit: { type: Number, default: 4 },
        },

        reviewConfig: {
            enabled: { type: Boolean, default: true },
            requireLogin: { type: Boolean, default: false },
            autoApprove: { type: Boolean, default: false },
            allowImages: { type: Boolean, default: true },
        },

        status: { type: String, enum: ["active", "draft"], default: "draft" },
        publishedAt: { type: Date, default: null },
        publishedVersion: { type: Number, default: 0 },
        draftVersion: { type: Number, default: 1 },

        lastEditedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        lastEditedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

WBProductPageSchema.index({ siteId: 1 }, { unique: true });

module.exports = mongoose.model("WBProductPage", WBProductPageSchema);
