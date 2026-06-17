/**
 * Satış kanalı iç navigasyon — İkas mağaza ayarları ↔ platform panelleri
 */
import {
    EC_WB_MY_THEMES_PANEL,
    EC_WB_EDITOR_PANEL,
    ecWbSegmentToPanel,
    isEcWbChannelPanel,
    STORE_NAV_ITEMS,
} from "./ecommerceMenu";
import {
    isEcPlatformEditorPanel,
    isEcPlatformFullBleed,
} from "./ecommercePlatform";

export const EC_CHANNEL_PREFIX = "ec-channel-";

/** store-* nav kimliği → panel */
export const STORE_NAV_TO_PANEL = {
    "store-themes": EC_WB_MY_THEMES_PANEL,
    "store-publish": ecWbSegmentToPanel("publish"),
    "store-domain": ecWbSegmentToPanel("domain"),
    "store-seo": ecWbSegmentToPanel("seo"),
    "store-url-redirects": ecWbSegmentToPanel("url-redirects"),
    "store-performance": ecWbSegmentToPanel("performance"),
    "store-brand-email": ecWbSegmentToPanel("brand-email"),
    "store-seo-domain": ecWbSegmentToPanel("publish"),
    "store-automations": `${EC_CHANNEL_PREFIX}automations`,
    "store-notifications": `${EC_CHANNEL_PREFIX}notifications`,
    "store-localization": ecWbSegmentToPanel("settings"),
    "store-payments": `${EC_CHANNEL_PREFIX}payments`,
    "store-customers": `${EC_CHANNEL_PREFIX}customers`,
    "store-shipping": `${EC_CHANNEL_PREFIX}shipping`,
    "store-plugins": `${EC_CHANNEL_PREFIX}plugins`,
    "store-blog": ecWbSegmentToPanel("blog"),
};

/** panel → store-* nav (aktif sekme) */
const PANEL_TO_STORE_NAV_ENTRIES = Object.entries(STORE_NAV_TO_PANEL).flatMap(([navId, panelId]) => {
    const rows = [[panelId, navId]];
    if (panelId === EC_WB_MY_THEMES_PANEL) {
        rows.push([ecWbSegmentToPanel("center"), navId]);
        rows.push([ecWbSegmentToPanel("theme-manage"), navId]);
        rows.push([EC_WB_EDITOR_PANEL, navId]);
    }
    if (panelId.startsWith(EC_CHANNEL_PREFIX)) {
        rows.push([panelId, navId]);
    }
    return rows;
});

export const PANEL_TO_STORE_NAV = Object.fromEntries(PANEL_TO_STORE_NAV_ENTRIES);

export function getStoreChannelPanelForNav(navId) {
    return STORE_NAV_TO_PANEL[navId] || EC_WB_MY_THEMES_PANEL;
}

export function getStoreNavIdForPanel(panelId) {
    if (!panelId) return "store-themes";
    return PANEL_TO_STORE_NAV[panelId] || "store-themes";
}

export function isEcChannelSectionPanel(panelId) {
    return !!panelId && panelId.startsWith(EC_CHANNEL_PREFIX);
}

/** Platform kabuğu içinde ikinci sidebar + tam sayfa içerik */
export function isEcSalesChannelWorkspacePanel(panelId) {
    if (!panelId) return false;
    if (isEcChannelSectionPanel(panelId)) return true;
    if (!isEcWbChannelPanel(panelId)) return false;
    if (isEcPlatformEditorPanel(panelId)) return false;
    if (isEcPlatformFullBleed(panelId)) return false;
    return true;
}

export { STORE_NAV_ITEMS };
