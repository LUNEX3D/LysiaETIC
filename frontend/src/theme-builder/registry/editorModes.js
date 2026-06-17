/** Theme Studio editör modları — Shopify / İkas / Wix tarzı */
export const STUDIO_MODES = {
    SECTIONS: "sections",
    BRAND: "brand",
    SETTINGS: "settings",
};

export const STUDIO_MODE_META = [
    { id: STUDIO_MODES.SECTIONS, label: "Sayfa düzeni", short: "Düzen", hint: "Bölümleri sürükleyin, ekleyin ve düzenleyin" },
    { id: STUDIO_MODES.BRAND, label: "Marka & stil", short: "Marka", hint: "Renkler, fontlar ve mağaza kimliği" },
    { id: STUDIO_MODES.SETTINGS, label: "Mağaza ayarları", short: "Ayarlar", hint: "Header, footer, ödeme ve SEO" },
];

export function parseStudioMode(value) {
    const v = String(value || "").toLowerCase();
    if (v === STUDIO_MODES.BRAND || v === "design" || v === "design-studio") return STUDIO_MODES.BRAND;
    if (v === STUDIO_MODES.SETTINGS || v === "settings") return STUDIO_MODES.SETTINGS;
    return STUDIO_MODES.SECTIONS;
}
