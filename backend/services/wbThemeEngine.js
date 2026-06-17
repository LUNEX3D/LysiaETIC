"use strict";

/** Minimal v3 theme catalog — legacy wb-themes/data kaldırıldı */
const THEME_CATALOG = [
    {
        slug: "lysia-starter",
        name: "Lysia Starter",
        variables: {
            primaryColor: "#6366f1",
            secondaryColor: "#8b5cf6",
            accentColor: "#f59e0b",
            backgroundColor: "#ffffff",
            surfaceColor: "#f8fafc",
            textPrimary: "#0f172a",
            textSecondary: "#64748b",
            borderColor: "#e2e8f0",
            fontFamily: "Inter, sans-serif",
            headingFont: "Inter, sans-serif",
            borderRadius: "8px",
            headerHeight: "64px",
            containerWidth: "1280px",
        },
        defaultHomeLayout: [],
    },
];

const SYSTEM_FONTS = [
    "Inter, sans-serif",
    "Roboto, sans-serif",
    "Open Sans, sans-serif",
    "Lato, sans-serif",
    "Montserrat, sans-serif",
    "Poppins, sans-serif",
    "Nunito, sans-serif",
    "Playfair Display, serif",
    "Merriweather, serif",
    "Cormorant Garamond, serif",
    "Exo 2, sans-serif",
    "Baloo 2, cursive",
];

function getAllThemes() {
    return THEME_CATALOG;
}

function getThemeBySlug(slug) {
    return THEME_CATALOG.find((t) => t.slug === slug) || THEME_CATALOG[0];
}

function generateCssVariables(themeVariables) {
    const vars = {
        "--color-primary": themeVariables.primaryColor || "#3b82f6",
        "--color-secondary": themeVariables.secondaryColor || "#8b5cf6",
        "--color-accent": themeVariables.accentColor || "#f59e0b",
        "--color-bg": themeVariables.backgroundColor || "#ffffff",
        "--color-surface": themeVariables.surfaceColor || "#f8fafc",
        "--color-text-primary": themeVariables.textPrimary || "#0f172a",
        "--color-text-secondary": themeVariables.textSecondary || "#64748b",
        "--color-border": themeVariables.borderColor || "#e2e8f0",
        "--font-body": themeVariables.fontFamily || "Inter, sans-serif",
        "--font-heading": themeVariables.headingFont || "Inter, sans-serif",
        "--border-radius": themeVariables.borderRadius || "8px",
        "--header-height": themeVariables.headerHeight || "64px",
        "--container-width": themeVariables.containerWidth || "1280px",
    };

    const cssLines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
    return `:root {\n${cssLines.join("\n")}\n}`;
}

function mergeThemeVariables(themeSlug, userOverrides = {}) {
    const theme = getThemeBySlug(themeSlug);
    const base = theme ? { ...theme.variables } : {};
    return { ...base, ...userOverrides };
}

function getDefaultLayout(themeSlug) {
    const theme = getThemeBySlug(themeSlug);
    if (!theme) return [];
    return JSON.parse(JSON.stringify(theme.defaultHomeLayout || []));
}

function applyButtonStyle(buttonStyle) {
    const styles = {
        rounded: "border-radius: var(--border-radius)",
        pill: "border-radius: 9999px",
        square: "border-radius: 0",
    };
    return styles[buttonStyle] || styles.rounded;
}

function getGoogleFontsUrl(themeVariables) {
    const fonts = new Set();
    const body = themeVariables.fontFamily || "";
    const heading = themeVariables.headingFont || "";

    const extractFontName = (fontStr) => {
        const name = fontStr.split(",")[0].trim().replace(/'/g, "");
        if (SYSTEM_FONTS.includes(fontStr) && !fontStr.includes("serif") && !fontStr.includes("mono")) {
            return name;
        }
        return name;
    };

    const bodyFont = extractFontName(body);
    const headingFont = extractFontName(heading);

    if (bodyFont && bodyFont !== "Inter") fonts.add(bodyFont);
    if (headingFont && headingFont !== "Inter") fonts.add(headingFont);

    if (fonts.size === 0) return "";

    const families = [...fonts].map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&");
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function validateThemeVariables(vars) {
    const errors = [];
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const colorFields = ["primaryColor", "secondaryColor", "accentColor", "backgroundColor", "textPrimary"];

    colorFields.forEach((field) => {
        if (vars[field] && !hexPattern.test(vars[field])) {
            errors.push(`${field}: geçersiz renk formatı (hex gerekli)`);
        }
    });

    return errors;
}

module.exports = {
    getAllThemes,
    getThemeBySlug,
    generateCssVariables,
    mergeThemeVariables,
    getDefaultLayout,
    applyButtonStyle,
    getGoogleFontsUrl,
    validateThemeVariables,
};
