/** Hazır marka paletleri — tek tıkla globalStyles güncelleme */
export const COLOR_PRESETS = [
    {
        id: "modern-indigo",
        name: "Modern İndigo",
        swatch: "#6366f1",
        styles: {
            primaryColor: "#6366f1",
            secondaryColor: "#8b5cf6",
            accentColor: "#f59e0b",
            backgroundColor: "#ffffff",
            textPrimary: "#0f172a",
        },
    },
    {
        id: "shopify-green",
        name: "Shopify Yeşil",
        swatch: "#008060",
        styles: {
            primaryColor: "#008060",
            secondaryColor: "#004c3f",
            accentColor: "#ffc453",
            backgroundColor: "#ffffff",
            textPrimary: "#202223",
        },
    },
    {
        id: "luxury-dark",
        name: "Lüks Koyu",
        swatch: "#18181b",
        styles: {
            primaryColor: "#18181b",
            secondaryColor: "#3f3f46",
            accentColor: "#d4af37",
            backgroundColor: "#fafafa",
            textPrimary: "#18181b",
        },
    },
    {
        id: "warm-boutique",
        name: "Sıcak Butik",
        swatch: "#c2410c",
        styles: {
            primaryColor: "#c2410c",
            secondaryColor: "#ea580c",
            accentColor: "#fef3c7",
            backgroundColor: "#fffbf7",
            textPrimary: "#431407",
        },
    },
    {
        id: "ocean-fresh",
        name: "Okyanus",
        swatch: "#0284c7",
        styles: {
            primaryColor: "#0284c7",
            secondaryColor: "#0ea5e9",
            accentColor: "#22d3ee",
            backgroundColor: "#f0f9ff",
            textPrimary: "#0c4a6e",
        },
    },
    {
        id: "minimal-mono",
        name: "Minimal Mono",
        swatch: "#52525b",
        styles: {
            primaryColor: "#18181b",
            secondaryColor: "#71717a",
            accentColor: "#a1a1aa",
            backgroundColor: "#ffffff",
            textPrimary: "#27272a",
        },
    },
];

export const FONT_PRESETS = [
    { id: "inter", name: "Inter (Modern)", fontFamily: "Inter, system-ui, sans-serif", headingFont: "Inter, system-ui, sans-serif" },
    { id: "playfair", name: "Playfair (Lüks)", fontFamily: "Inter, sans-serif", headingFont: '"Playfair Display", Georgia, serif' },
    { id: "space", name: "Space Grotesk (Tech)", fontFamily: '"Space Grotesk", Inter, sans-serif', headingFont: '"Space Grotesk", Inter, sans-serif' },
    { id: "dm", name: "DM Sans (Yumuşak)", fontFamily: '"DM Sans", Inter, sans-serif', headingFont: '"DM Sans", Inter, sans-serif' },
];

export const BUTTON_STYLE_PRESETS = [
    { id: "rounded", label: "Yuvarlak köşe", borderRadius: "8px", buttonStyle: "rounded" },
    { id: "pill", label: "Hap buton", borderRadius: "999px", buttonStyle: "pill" },
    { id: "square", label: "Keskin köşe", borderRadius: "0", buttonStyle: "square" },
];
