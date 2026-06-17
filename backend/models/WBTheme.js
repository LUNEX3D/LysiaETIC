const mongoose = require("mongoose");
const { Schema } = mongoose;

const ThemeVariableDefSchema = new Schema(
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
        buttonStyle: { type: String, default: "rounded" },
        headerHeight: { type: String, default: "64px" },
        containerWidth: { type: String, default: "1280px" },
    },
    { _id: false }
);

const WBThemeSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        category: {
            type: String,
            enum: [
                "fashion", "electronics", "food", "general", "minimal", "bold", "luxury", "kids",
                "beauty", "furniture", "jewelry", "home-living", "home-decor", "marketplace",
                "sports", "books", "pets", "cosmetics", "technology",
            ],
            default: "general",
            index: true,
        },

        thumbnailUrl: { type: String, default: "" },
        previewUrl: { type: String, default: "" },
        screenshotUrls: [{ type: String }],

        isPremium: { type: Boolean, default: false, index: true },
        isActive: { type: Boolean, default: true, index: true },
        isFeatured: { type: Boolean, default: false },

        version: { type: String, default: "1.0.0" },
        author: { type: String, default: "LysiaETIC Team" },

        variables: { type: ThemeVariableDefSchema, default: () => ({}) },

        defaultHomeLayout: { type: Schema.Types.Mixed, default: [] },
        defaultHeaderConfig: { type: Schema.Types.Mixed, default: {} },
        defaultFooterConfig: { type: Schema.Types.Mixed, default: {} },

        supportedFeatures: {
            megaMenu: { type: Boolean, default: false },
            stickyHeader: { type: Boolean, default: true },
            darkMode: { type: Boolean, default: false },
            animations: { type: Boolean, default: true },
            lazyLoading: { type: Boolean, default: true },
        },

        fontOptions: [{ type: String }],
        colorPalettes: [{ type: Schema.Types.Mixed }],

        tags: [{ type: String }],
        sortOrder: { type: Number, default: 0 },
        usageCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

WBThemeSchema.index({ isActive: 1, isPremium: 1, category: 1 });

module.exports = mongoose.model("WBTheme", WBThemeSchema);
