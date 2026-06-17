/** Inspector spacing ve tema yardımcıları */

export const SPACING_PRESETS = [
    { label: "Sıkı", top: 24, bottom: 24 },
    { label: "Normal", top: 60, bottom: 60 },
    { label: "Geniş", top: 80, bottom: 80 },
    { label: "XL", top: 120, bottom: 120 },
];

export const THEME_COLOR_TOKENS = [
    { key: "primaryColor", label: "Birincil" },
    { key: "secondaryColor", label: "İkincil" },
    { key: "backgroundColor", label: "Arka plan" },
    { key: "surfaceColor", label: "Yüzey" },
    { key: "textPrimary", label: "Metin" },
    { key: "textSecondary", label: "Alt metin" },
    { key: "borderColor", label: "Kenarlık" },
];

export function parseSpacingPx(value, fallback = 60) {
    if (value == null || value === "") return fallback;
    const n = parseInt(String(value).replace(/px$/i, "").trim(), 10);
    return Number.isNaN(n) ? fallback : n;
}

export function formatSpacingPx(n) {
    return `${Math.max(0, Math.min(200, n))}px`;
}
