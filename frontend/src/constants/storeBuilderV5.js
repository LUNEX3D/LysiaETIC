/**
 * Store Builder V5 — Mağaza kanalı + v3 Theme Studio entegrasyonu
 */

export const SB_V5_CHANNEL_PREFIX = "ec-wb-";

export const SB_V5_MY_THEMES_PANEL = `${SB_V5_CHANNEL_PREFIX}my-themes`;
export const SB_V5_MARKETPLACE_PANEL = `${SB_V5_CHANNEL_PREFIX}marketplace`;
export const SB_V5_EDITOR_PANEL = `${SB_V5_CHANNEL_PREFIX}editor`;
export const SB_V5_DESIGN_STUDIO_PANEL = `${SB_V5_CHANNEL_PREFIX}design-studio`;
export const SB_V5_CENTER_PANEL = SB_V5_MY_THEMES_PANEL;
export const SB_V5_THEME_MANAGE_PANEL = SB_V5_MY_THEMES_PANEL;

export const SB_V5_LEGACY_PANELS = {
    "ec-wb-center": SB_V5_MY_THEMES_PANEL,
    "ec-wb-themes": SB_V5_MY_THEMES_PANEL,
    "ec-wb-themes-editor": SB_V5_EDITOR_PANEL,
    "ec-wb-themes-marketplace": SB_V5_MARKETPLACE_PANEL,
    "ec-wb-my-themes": SB_V5_MY_THEMES_PANEL,
    "ec-wb-theme-manage": SB_V5_MY_THEMES_PANEL,
    "ec-wb-editor": SB_V5_EDITOR_PANEL,
    "ec-wb-marketplace": SB_V5_MARKETPLACE_PANEL,
    "ec-wb-design-studio": SB_V5_DESIGN_STUDIO_PANEL,
    "ec-appearance-marketplace": SB_V5_MARKETPLACE_PANEL,
};

export const SB_V5_DEFAULT_PANEL = SB_V5_MY_THEMES_PANEL;

export const SB_V5_STORE_EDITOR_SEGMENTS = new Set(["editor", "themes-editor", "design-studio"]);

export const SB_V5_INLINE_SEGMENTS = new Set([
    "center",
    "my-themes",
    "marketplace",
    "publish",
    "seo",
    "popups",
    "forms",
    "settings",
    "blog",
    "navigation",
    "domain",
    "url-redirects",
    "performance",
    "brand-email",
    "media",
]);

export function normalizeSbV5PanelId(panelId) {
    if (!panelId) return SB_V5_DEFAULT_PANEL;
    return SB_V5_LEGACY_PANELS[panelId] || panelId;
}

export function sbV5PanelToSegment(panelId) {
    const id = normalizeSbV5PanelId(panelId);
    if (!id.startsWith(SB_V5_CHANNEL_PREFIX)) return "my-themes";
    return id.slice(SB_V5_CHANNEL_PREFIX.length) || "my-themes";
}

export function sbV5SegmentToPanel(segment) {
    const s = segment || "my-themes";
    return `${SB_V5_CHANNEL_PREFIX}${s}`;
}

export function isSbV5ChannelPanel(panelId) {
    return !!panelId && (panelId.startsWith(SB_V5_CHANNEL_PREFIX) || !!SB_V5_LEGACY_PANELS[panelId]);
}

export function isSbV5FullBleedPanel(panelId) {
    const id = normalizeSbV5PanelId(panelId);
    return id === SB_V5_EDITOR_PANEL || id === SB_V5_DESIGN_STUDIO_PANEL;
}

export function isSbV5StoreEditorSegment(segment) {
    return SB_V5_STORE_EDITOR_SEGMENTS.has(segment);
}

export const SB_V5_WORKSPACE_NAV = [
    { id: "my-themes", label: "Temalarım", icon: "themes", segment: "my-themes" },
    { id: "marketplace", label: "Tema Mağazası", icon: "store", segment: "marketplace" },
    { id: "editor", label: "Tema Editörü", icon: "edit", segment: "editor" },
    {
        id: "store-launch",
        label: "Mağaza & Yayın",
        icon: "rocket",
        children: [
            { segment: "publish", label: "Yayın Durumu" },
            { segment: "domain", label: "Alan Adları" },
            { segment: "seo", label: "SEO Merkezi" },
            { segment: "url-redirects", label: "URL & Yönlendirme" },
            { segment: "performance", label: "Performans" },
            { segment: "brand-email", label: "E-posta & Marka" },
        ],
    },
    {
        id: "store-ops",
        label: "Mağaza",
        icon: "globe",
        children: [
            { segment: "navigation", label: "Menü" },
        ],
    },
    {
        id: "content",
        label: "İçerik",
        icon: "file",
        children: [
            { segment: "blog", label: "Blog" },
            { segment: "popups", label: "Popup" },
            { segment: "forms", label: "Form" },
        ],
    },
    { id: "settings", label: "Lokalizasyon", icon: "cog", segment: "settings" },
];

export const SB_V5_SECTION_LIBRARY_CATEGORIES = [];
export const SB_V5_MARKETPLACE_FILTERS = [];
export const LUMIERE_PRESET_SLUGS = [];
