const mongoose = require("mongoose");
const { Schema } = mongoose;

const SectionSettingsSchema = new Schema(
    {
        paddingTop: { type: String, default: "60px" },
        paddingBottom: { type: String, default: "60px" },
        paddingLeft: { type: String, default: "0px" },
        paddingRight: { type: String, default: "0px" },
        marginTop: { type: String, default: "0px" },
        marginBottom: { type: String, default: "0px" },
        backgroundColor: { type: String, default: "" },
        backgroundImage: { type: String, default: "" },
        backgroundSize: { type: String, enum: ["cover", "contain", "auto"], default: "cover" },
        backgroundPosition: { type: String, default: "center" },
        backgroundOverlay: { type: String, default: "" },
        borderRadius: { type: String, default: "0px" },
        fullWidth: { type: Boolean, default: false },
        hidden: { type: Boolean, default: false },
        hiddenOnMobile: { type: Boolean, default: false },
        hiddenOnDesktop: { type: Boolean, default: false },
        customCssClass: { type: String, default: "" },
        customCss: { type: String, default: "" },
        animationType: { type: String, default: "none" },
    },
    { _id: false }
);

const MobileOverrideSchema = new Schema(
    {
        settings: { type: Schema.Types.Mixed, default: null },
        content: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const SectionSchema = new Schema(
    {
        id: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: [
                "hero",
                "product-grid",
                "category-grid",
                "banner",
                "slider",
                "text",
                "image",
                "video",
                "testimonials",
                "newsletter",
                "contact",
                "countdown",
                "campaign",
                "html",
                "spacer",
                "divider",
            ],
        },
        order: { type: Number, required: true, default: 0 },
        settings: { type: SectionSettingsSchema, default: () => ({}) },
        content: { type: Schema.Types.Mixed, default: () => ({}) },
        mobileOverride: { type: MobileOverrideSchema, default: () => ({}) },
        translations: { type: Schema.Types.Mixed, default: () => ({}) },
        isLocked: { type: Boolean, default: false },
        version: { type: Number, default: 1 },
    },
    { _id: false }
);

const PageSeoSchema = new Schema(
    {
        title: { type: String, default: "", trim: true },
        description: { type: String, default: "", trim: true },
        keywords: { type: String, default: "" },
        ogTitle: { type: String, default: "" },
        ogDescription: { type: String, default: "" },
        ogImage: { type: String, default: "" },
        canonicalUrl: { type: String, default: "" },
        noIndex: { type: Boolean, default: false },
        structuredData: { type: String, default: "" },
        changeFreq: {
            type: String,
            enum: ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"],
            default: "weekly",
        },
        priority: { type: Number, default: 0.5, min: 0, max: 1 },
    },
    { _id: false }
);

const WBPageSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },

        type: {
            type: String,
            required: true,
            enum: [
                "home",
                "about",
                "products",
                "product",
                "product-detail",
                "cart",
                "checkout",
                "blog",
                "blog-post",
                "contact",
                "faq",
                "policy",
                "custom",
                "account",
                "login",
                "register",
                "addresses",
                "orders",
                "order-detail",
                "forgot-password",
                "recover-password",
                "category",
                "brand",
                "brands",
                "favorites",
                "search",
                "not-found",
            ],
            index: true,
        },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        slug: { type: String, required: true, trim: true, lowercase: true },

        sections: { type: [SectionSchema], default: [] },

        status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
        publishedAt: { type: Date, default: null },
        publishedVersion: { type: Number, default: 0 },
        draftVersion: { type: Number, default: 1 },

        seo: { type: PageSeoSchema, default: () => ({}) },

        isSystemPage: { type: Boolean, default: false },
        isDeletable: { type: Boolean, default: true },
        isHomePage: { type: Boolean, default: false },

        sortOrder: { type: Number, default: 0 },
        showInNavigation: { type: Boolean, default: true },

        accessPassword: { type: String, default: "" },
        requiresAuth: { type: Boolean, default: false },

        translations: { type: Schema.Types.Mixed, default: () => ({}) },

        lastEditedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        lastEditedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

WBPageSchema.index({ siteId: 1, slug: 1 }, { unique: true });
WBPageSchema.index({ siteId: 1, type: 1 });
WBPageSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model("WBPage", WBPageSchema);
