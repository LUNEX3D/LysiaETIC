"use strict";

/**
 * Starter Kit — iş türü + marka stili → tema slug + design tokens
 * Kullanıcıya "tema" değil "mağaza görünümü" olarak sunulur.
 */
const BUSINESS_TYPES = [
    { id: "fashion", nameTr: "Moda", nameEn: "Fashion", icon: "fashion" },
    { id: "electronics", nameTr: "Elektronik", nameEn: "Electronics", icon: "electronics" },
    { id: "furniture", nameTr: "Mobilya", nameEn: "Furniture", icon: "furniture" },
    { id: "cosmetics", nameTr: "Kozmetik", nameEn: "Cosmetics", icon: "cosmetics" },
    { id: "jewelry", nameTr: "Mücevher", nameEn: "Jewelry", icon: "jewelry" },
    { id: "food", nameTr: "Gıda & İçecek", nameEn: "Food & Beverage", icon: "food" },
    { id: "general", nameTr: "Genel Mağaza", nameEn: "General Store", icon: "general" },
];

const BRAND_STYLES = [
    { id: "modern", nameTr: "Modern", nameEn: "Modern" },
    { id: "minimal", nameTr: "Minimal", nameEn: "Minimal" },
    { id: "luxury", nameTr: "Lüks", nameEn: "Luxury" },
    { id: "professional", nameTr: "Profesyonel", nameEn: "Professional" },
    { id: "colorful", nameTr: "Renkli", nameEn: "Colorful" },
    { id: "premium", nameTr: "Premium", nameEn: "Premium" },
];

const KIT_BY_BUSINESS = {
    fashion: { kitSlug: "fashion-pro", nameTr: "Moda Mağazası", nameEn: "Fashion Store Kit" },
    electronics: { kitSlug: "electronics-plus", nameTr: "Elektronik Mağazası", nameEn: "Electronics Store Kit" },
    furniture: { kitSlug: "furniture-store", nameTr: "Mobilya Mağazası", nameEn: "Furniture Store Kit" },
    cosmetics: { kitSlug: "beauty-store", nameTr: "Kozmetik Mağazası", nameEn: "Cosmetics Store Kit" },
    jewelry: { kitSlug: "minimal-luxury", nameTr: "Mücevher Mağazası", nameEn: "Jewelry Store Kit" },
    food: { kitSlug: "food-store", nameTr: "Gıda Mağazası", nameEn: "Food Store Kit" },
    general: { kitSlug: "modern-store", nameTr: "Genel Mağaza", nameEn: "General Store Kit" },
};

const STYLE_TOKENS = {
    modern: {
        primaryColor: "#6366f1",
        secondaryColor: "#8b5cf6",
        accentColor: "#06b6d4",
        backgroundColor: "#ffffff",
        surfaceColor: "#f8fafc",
        textPrimary: "#0f172a",
        fontFamily: "Inter, sans-serif",
        headingFont: "Inter, sans-serif",
        borderRadius: "10px",
        buttonStyle: "rounded",
    },
    minimal: {
        primaryColor: "#18181b",
        secondaryColor: "#52525b",
        accentColor: "#18181b",
        backgroundColor: "#ffffff",
        surfaceColor: "#fafafa",
        textPrimary: "#09090b",
        fontFamily: "Inter, sans-serif",
        headingFont: "Inter, sans-serif",
        borderRadius: "4px",
        buttonStyle: "square",
    },
    luxury: {
        primaryColor: "#1c1917",
        secondaryColor: "#a8a29e",
        accentColor: "#ca8a04",
        backgroundColor: "#fafaf9",
        surfaceColor: "#f5f5f4",
        textPrimary: "#1c1917",
        fontFamily: "Georgia, serif",
        headingFont: "Georgia, serif",
        borderRadius: "2px",
        buttonStyle: "square",
    },
    professional: {
        primaryColor: "#0d9488",
        secondaryColor: "#115e59",
        accentColor: "#14b8a6",
        backgroundColor: "#ffffff",
        surfaceColor: "#f0fdfa",
        textPrimary: "#134e4a",
        fontFamily: "Inter, sans-serif",
        headingFont: "Inter, sans-serif",
        borderRadius: "8px",
        buttonStyle: "rounded",
    },
    colorful: {
        primaryColor: "#ec4899",
        secondaryColor: "#8b5cf6",
        accentColor: "#f59e0b",
        backgroundColor: "#fffbeb",
        surfaceColor: "#ffffff",
        textPrimary: "#1e293b",
        fontFamily: "Inter, sans-serif",
        headingFont: "Inter, sans-serif",
        borderRadius: "16px",
        buttonStyle: "pill",
    },
    premium: {
        primaryColor: "#5b4dff",
        secondaryColor: "#312e81",
        accentColor: "#fbbf24",
        backgroundColor: "#ffffff",
        surfaceColor: "#f4f5f7",
        textPrimary: "#1c1f26",
        fontFamily: "Inter, sans-serif",
        headingFont: "Inter, sans-serif",
        borderRadius: "12px",
        buttonStyle: "rounded",
    },
};

function resolveKitSlug(businessType) {
    const key = String(businessType || "general").toLowerCase();
    return KIT_BY_BUSINESS[key]?.kitSlug || KIT_BY_BUSINESS.general.kitSlug;
}

function resolveStyleTokens(brandStyle) {
    const key = String(brandStyle || "modern").toLowerCase();
    return STYLE_TOKENS[key] || STYLE_TOKENS.modern;
}

function getKitMeta(businessType) {
    const key = String(businessType || "general").toLowerCase();
    return KIT_BY_BUSINESS[key] || KIT_BY_BUSINESS.general;
}

module.exports = {
    BUSINESS_TYPES,
    BRAND_STYLES,
    KIT_BY_BUSINESS,
    STYLE_TOKENS,
    resolveKitSlug,
    resolveStyleTokens,
    getKitMeta,
};
