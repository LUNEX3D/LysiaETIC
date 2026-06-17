/**
 * WBSite.js — Website Builder Ana Site Modeli
 * v2.0 — Multi-Store desteği ile yeniden yazıldı
 * - userId unique constraint kaldırıldı (tenant başına N site)
 * - isPrimary, siteNumber, displayName eklendi
 * - productCatalogMode eklendi (all | filtered | manual)
 * - brand bilgileri eklendi
 * - themeInstallId bağlantısı eklendi
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SeoSchema = new Schema(
    {
        title: { type: String, default: "", trim: true },
        description: { type: String, default: "", trim: true },
        keywords: { type: String, default: "" },
        ogImage: { type: String, default: "" },
        twitterCard: { type: String, enum: ["summary", "summary_large_image"], default: "summary_large_image" },
        canonicalUrl: { type: String, default: "" },
        noIndex: { type: Boolean, default: false },
        structuredData: { type: String, default: "" },
        customRobots: { type: String, default: "" },
    },
    { _id: false }
);

const LanguageEntrySchema = new Schema(
    {
        code: { type: String, required: true, trim: true, lowercase: true },
        name: { type: String, required: true, trim: true },
        nativeName: { type: String, default: "" },
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        direction: { type: String, enum: ["ltr", "rtl"], default: "ltr" },
    },
    { _id: false }
);

const CurrencyEntrySchema = new Schema(
    {
        code: { type: String, required: true, trim: true, uppercase: true },
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        exchangeRate: { type: Number, default: 1 },
        position: { type: String, enum: ["before", "after"], default: "before" },
    },
    { _id: false }
);

const ThemeVariablesSchema = new Schema(
    {
        primaryColor: { type: String, default: "#3b82f6" },
        secondaryColor: { type: String, default: "#8b5cf6" },
        accentColor: { type: String, default: "#f59e0b" },
        backgroundColor: { type: String, default: "#ffffff" },
        surfaceColor: { type: String, default: "#f8fafc" },
        textPrimary: { type: String, default: "#0f172a" },
        textSecondary: { type: String, default: "#64748b" },
        borderColor: { type: String, default: "#e2e8f0" },
        fontFamily: { type: String, default: "Inter, sans-serif" },
        headingFont: { type: String, default: "Inter, sans-serif" },
        borderRadius: { type: String, default: "8px" },
        buttonStyle: { type: String, enum: ["rounded", "pill", "square"], default: "rounded" },
        headerHeight: { type: String, default: "64px" },
        containerWidth: { type: String, default: "1280px" },
    },
    { _id: false }
);

const SocialLinksSchema = new Schema(
    {
        instagram: { type: String, default: "" },
        facebook: { type: String, default: "" },
        twitter: { type: String, default: "" },
        youtube: { type: String, default: "" },
        tiktok: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        pinterest: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
    },
    { _id: false }
);

const AnalyticsSchema = new Schema(
    {
        googleAnalyticsId: { type: String, default: "" },
        googleTagManagerId: { type: String, default: "" },
        metaPixelId: { type: String, default: "" },
        hotjarId: { type: String, default: "" },
        customHeadCode: { type: String, default: "" },
        customBodyCode: { type: String, default: "" },
    },
    { _id: false }
);

const CheckoutSettingsSchema = new Schema(
    {
        guestCheckout: { type: Boolean, default: true },
        requirePhone: { type: Boolean, default: true },
        minOrderAmount: { type: Number, default: 0 },
        flatShippingCost: { type: Number, default: 0 },
        freeShippingOver: { type: Number, default: 0 },
        paymentMethods: [{ type: String, enum: ["paytr", "iyzico", "bank_transfer", "cod"] }],
        termsUrl: { type: String, default: "" },
        privacyUrl: { type: String, default: "" },
        returnPolicyUrl: { type: String, default: "" },
    },
    { _id: false }
);

const ProductFilterSchema = new Schema(
    {
        categories: [{ type: String }],
        brands: [{ type: String }],
        tags: [{ type: String }],
        excludeIds: [{ type: Schema.Types.ObjectId }],
        minPrice: { type: Number, default: null },
        maxPrice: { type: Number, default: null },
        inStockOnly: { type: Boolean, default: false },
    },
    { _id: false }
);

const BrandSchema = new Schema(
    {
        name: { type: String, default: "" },
        logoLight: { type: String, default: "" },
        logoDark: { type: String, default: "" },
        logoMonochrome: { type: String, default: "" },
        primaryColor: { type: String, default: "" },
        slogan: { type: String, default: "" },
    },
    { _id: false }
);

const WBSiteSchema = new Schema(
    {
        // ─── Tenant / Ownership ───────────────────────────────────────────────────
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        storeId: {
            type: Schema.Types.ObjectId,
            ref: "Store",
            index: true,
            sparse: true,
            unique: true,
        },
        businessType: {
            type: String,
            enum: ["fashion", "electronics", "furniture", "cosmetics", "jewelry", "food", "general"],
            default: "general",
        },
        brandStyle: {
            type: String,
            enum: ["modern", "minimal", "luxury", "professional", "colorful", "premium"],
            default: "modern",
        },
        // NOT: unique constraint yok — tenant başına N site
        siteNumber: { type: Number, default: 1 },
        isPrimary: { type: Boolean, default: false, index: true },

        // ─── Identity ────────────────────────────────────────────────────────────
        name: { type: String, required: true, trim: true, maxlength: 100 },
        displayName: { type: String, default: "", trim: true, maxlength: 100 },
        slug: {
            type: String, required: true, unique: true,
            lowercase: true, trim: true, index: true,
            match: /^[a-z0-9-]+$/,
        },
        description: { type: String, default: "", maxlength: 500 },

        // ─── Status ──────────────────────────────────────────────────────────────
        status: { type: String, enum: ["draft", "published", "suspended", "archived"], default: "draft", index: true },
        publishedAt: { type: Date, default: null },

        // ─── Theme (v2 — WBThemeInstall ile ilişkili) ────────────────────────────
        themeId: { type: String, default: "aurora", index: true },
        themeInstallId: { type: Schema.Types.ObjectId, ref: "WBThemeInstall", default: null },
        /** tbv2 engine: "v2" | legacy "v1" */
        themeBuilderVersion: { type: String, enum: ["v1", "v2", "v3"], default: "v1", index: true },
        tbv2InstallId: { type: Schema.Types.ObjectId, ref: "TBv2ThemeInstall", default: null },
        themeVariables: { type: ThemeVariablesSchema, default: () => ({}) },

        // ─── Branding ────────────────────────────────────────────────────────────
        logoUrl: { type: String, default: "" },
        faviconUrl: { type: String, default: "" },
        brand: { type: BrandSchema, default: () => ({}) },

        // ─── Domain ──────────────────────────────────────────────────────────────
        customDomain: { type: String, default: "", trim: true, lowercase: true },
        domainStatus: {
            type: String,
            enum: ["none", "pending_verification", "verified", "ssl_pending", "active", "failed", "expired"],
            default: "none",
        },
        domainVerifyToken: { type: String, default: "" },
        sslStatus: {
            type: String,
            enum: ["none", "pending", "active", "renewing", "expired", "failed"],
            default: "none",
        },

        // ─── Localisation ────────────────────────────────────────────────────────
        defaultLanguage: { type: String, default: "tr" },
        defaultCurrency: { type: String, default: "TRY" },
        timezone: { type: String, default: "Europe/Istanbul" },
        languages: {
            type: [LanguageEntrySchema],
            default: () => [{ code: "tr", name: "Türkçe", nativeName: "Türkçe", isDefault: true, isActive: true }],
        },
        currencies: {
            type: [CurrencyEntrySchema],
            default: () => [{ code: "TRY", symbol: "₺", name: "Türk Lirası", isDefault: true, isActive: true, exchangeRate: 1, position: "before" }],
        },

        // ─── SEO & Tracking ──────────────────────────────────────────────────────
        seo: { type: SeoSchema, default: () => ({}) },
        socialLinks: { type: SocialLinksSchema, default: () => ({}) },
        analytics: { type: AnalyticsSchema, default: () => ({}) },

        // ─── Commerce ────────────────────────────────────────────────────────────
        checkoutSettings: { type: CheckoutSettingsSchema, default: () => ({}) },

        productCatalogMode: {
            type: String,
            enum: ["all", "filtered", "manual"],
            default: "all",
        },
        productFilter: { type: ProductFilterSchema, default: null },
        manualProductIds: [{ type: Schema.Types.ObjectId }],

        syncProductsFromLysia: { type: Boolean, default: true },
        autoPublishProducts: { type: Boolean, default: true },

        // ─── Contact ─────────────────────────────────────────────────────────────
        contactEmail: { type: String, default: "", trim: true, lowercase: true },
        contactPhone: { type: String, default: "" },
        address: { type: String, default: "" },

        // ─── Publish orchestration ─────────────────────────────────────────────────
        publishMeta: {
            version: { type: Number, default: 0 },
            lastDeployAt: { type: Date, default: null },
            lastDeployStatus: {
                type: String,
                enum: ["idle", "running", "success", "failed"],
                default: "idle",
            },
            lastDeployError: { type: String, default: "" },
        },

        emailSettings: {
            senderMode: { type: String, enum: ["platform", "custom"], default: "platform" },
            replyToEmail: { type: String, default: "", trim: true, lowercase: true },
            customFromEmail: { type: String, default: "", trim: true, lowercase: true },
            supportEmail: { type: String, default: "", trim: true, lowercase: true },
            emailDomainStatus: {
                type: String,
                enum: ["none", "pending", "verified", "failed"],
                default: "none",
            },
        },

        urlSettings: {
            productPath: { type: String, default: "/products" },
            categoryPath: { type: String, default: "/category" },
            blogPath: { type: String, default: "/blog" },
            pagePath: { type: String, default: "/pages" },
        },

        performanceMeta: {
            type: Schema.Types.Mixed,
            default: null,
        },

        // ─── GrapesJS görsel editör ─────────────────────────────────────────────
        editorEngine: {
            type: String,
            enum: ["sections", "grapesjs", "puck"],
            default: "grapesjs",
        },
        grapesEditor: {
            themeSlug: { type: String, default: "" },
            ossSource: { type: String, default: "" },
            html: { type: String, default: "" },
            css: { type: String, default: "" },
            project: { type: Schema.Types.Mixed, default: null },
            pageData: { type: Schema.Types.Mixed, default: null },
            updatedAt: { type: Date, default: null },
        },
        puckEditor: {
            themeSlug: { type: String, default: "" },
            data: { type: Schema.Types.Mixed, default: null },
            updatedAt: { type: Date, default: null },
        },

        // ─── Stats (denormalized) ────────────────────────────────────────────────
        stats: {
            totalPageViews: { type: Number, default: 0 },
            totalOrders: { type: Number, default: 0 },
            totalRevenue: { type: Number, default: 0 },
            totalBlogPosts: { type: Number, default: 0 },
            totalProducts: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

// Multi-store: unique sparse index sadece customDomain doluysa çakışmayı önler
WBSiteSchema.index({ customDomain: 1 }, { sparse: true, unique: true });
WBSiteSchema.index({ userId: 1, status: 1 });
WBSiteSchema.index({ userId: 1, isPrimary: 1 });

module.exports = mongoose.model("WBSite", WBSiteSchema);
