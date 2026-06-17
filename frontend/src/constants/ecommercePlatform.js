/**
 * E-Ticaret Platform V6 — Shopify Admin × İkas tek bilgi mimarisi
 * Tüm ec-* ve ec-wb-* panelleri tek ağaçta; çift sidebar kaldırıldı.
 */

import {
    SB_V5_CENTER_PANEL,
    SB_V5_MY_THEMES_PANEL,
    SB_V5_THEME_MANAGE_PANEL,
    SB_V5_EDITOR_PANEL,
    SB_V5_MARKETPLACE_PANEL,
    SB_V5_DESIGN_STUDIO_PANEL,
    normalizeSbV5PanelId,
    sbV5SegmentToPanel,
    isSbV5ChannelPanel,
    isSbV5FullBleedPanel,
    isSbV5StoreEditorSegment,
} from "./storeBuilderV5";

/** Mağaza görünümü — kullanıcıya "tema" olarak gösterilmez */
export const EC_DESIGN_GROUP = "ec-design-group";
export const EC_LAUNCH_GROUP = "ec-launch-group";
/** @deprecated */ export const EC_SEO_DOMAIN_GROUP = EC_LAUNCH_GROUP;
export const EC_APPS_PANEL = "ec-apps-marketplace";
export const EC_DOMAIN_WIZARD_PANEL = "ec-domain-wizard";
export const EC_APPEARANCE_MARKETPLACE_PANEL = "ec-appearance-marketplace";
/** @deprecated */ export const EC_ONLINE_STORE_GROUP = EC_DESIGN_GROUP;

export const EC_PLATFORM_NAV = [
    { id: "ec-home", labelTr: "Giriş", labelEn: "Home", icon: "home" },
    {
        id: EC_DESIGN_GROUP,
        labelTr: "Mağazanı Düzenle",
        labelEn: "Customize store",
        icon: "storefront",
        children: [
            { id: SB_V5_EDITOR_PANEL, labelTr: "Görsel editör", labelEn: "Visual editor" },
            { id: SB_V5_MY_THEMES_PANEL, labelTr: "Görünümüm", labelEn: "My appearance" },
            { id: EC_APPEARANCE_MARKETPLACE_PANEL, labelTr: "Görünüm Mağazası", labelEn: "Appearance store" },
            { id: SB_V5_DESIGN_STUDIO_PANEL, labelTr: "Marka stili", labelEn: "Brand style" },
        ],
    },
    {
        id: EC_LAUNCH_GROUP,
        labelTr: "Mağaza & Yayın",
        labelEn: "Store & Launch",
        icon: "seo",
        children: [
            { id: sbV5SegmentToPanel("publish"), labelTr: "Yayın Durumu", labelEn: "Publish Status" },
            { id: sbV5SegmentToPanel("domain"), labelTr: "Alan Adları", labelEn: "Domains" },
            { id: sbV5SegmentToPanel("seo"), labelTr: "SEO Merkezi", labelEn: "SEO Center" },
            { id: sbV5SegmentToPanel("url-redirects"), labelTr: "URL & Yönlendirme", labelEn: "URL & Redirects" },
            { id: sbV5SegmentToPanel("performance"), labelTr: "Performans", labelEn: "Performance" },
            { id: sbV5SegmentToPanel("brand-email"), labelTr: "E-posta & Marka", labelEn: "Email & Brand" },
            { id: EC_DOMAIN_WIZARD_PANEL, labelTr: "Alan adı sihirbazı", labelEn: "Domain wizard" },
            { id: sbV5SegmentToPanel("settings"), labelTr: "Lokalizasyon", labelEn: "Localization" },
        ],
    },
    {
        id: "ec-products-group",
        labelTr: "Ürünler",
        labelEn: "Products",
        icon: "products",
        children: [
            { id: "ec-products", labelTr: "Tüm ürünler", labelEn: "All products" },
            { id: "ec-products-definitions", labelTr: "Tanımlamalar", labelEn: "Definitions" },
            { id: "ec-products-purchase", labelTr: "Satın alma", labelEn: "Purchasing" },
            { id: "ec-products-transfers", labelTr: "Transferler", labelEn: "Transfers" },
            { id: "ec-products-stock-count", labelTr: "Stok sayımı", labelEn: "Stock count" },
            { id: "ec-products-barcode", labelTr: "Barkod etiketi", labelEn: "Barcode" },
        ],
    },
    {
        id: "ec-orders-group",
        labelTr: "Siparişler",
        labelEn: "Orders",
        icon: "orders",
        children: [
            { id: "ec-orders", labelTr: "Siparişler", labelEn: "Orders" },
            { id: "ec-orders-drafts", labelTr: "Taslaklar", labelEn: "Drafts" },
            { id: "ec-orders-abandoned", labelTr: "Terk edilmiş sepet", labelEn: "Abandoned carts" },
            { id: "ec-orders-gift-cards", labelTr: "Hediye kartları", labelEn: "Gift cards" },
        ],
    },
    {
        id: "ec-customers-group",
        labelTr: "Müşteriler",
        labelEn: "Customers",
        icon: "customers",
        children: [
            { id: "ec-customers", labelTr: "Müşteriler", labelEn: "Customers" },
            { id: "ec-customers-groups", labelTr: "Gruplar", labelEn: "Groups" },
        ],
    },
    {
        id: "ec-discounts-group",
        labelTr: "Pazarlama",
        labelEn: "Marketing",
        icon: "discounts",
        children: [
            { id: "ec-discounts-campaigns", labelTr: "Kampanyalar", labelEn: "Campaigns" },
            { id: "ec-discounts-coupons", labelTr: "Kuponlar", labelEn: "Coupons" },
        ],
    },
    {
        id: "ec-inbox-group",
        labelTr: "Gelen kutusu",
        labelEn: "Inbox",
        icon: "inbox",
        children: [
            { id: "ec-inbox-messages", labelTr: "Mesajlar", labelEn: "Messages" },
            { id: "ec-inbox-settings", labelTr: "Kanal ayarları", labelEn: "Channels" },
        ],
    },
    { id: "ec-reports", labelTr: "Analitik", labelEn: "Analytics", icon: "analytics" },
    { id: EC_APPS_PANEL, labelTr: "Uygulamalar", labelEn: "Apps", icon: "apps" },
    { id: "ec-store-settings", labelTr: "Mağaza ayarları", labelEn: "Store settings", icon: "settings" },
];

export function isEcOnlineStorePanel(panelId) {
    return isSbV5ChannelPanel(panelId) || panelId === EC_APPEARANCE_MARKETPLACE_PANEL;
}

export function isEcPlatformWorkspacePanel(panelId) {
    if (!panelId || panelId === "ec-stores") return false;
    return panelId.startsWith("ec-");
}

export function isEcPlatformFullBleed(panelId) {
    return isSbV5FullBleedPanel(panelId) || isSbV5StoreEditorSegment(
        panelId?.startsWith("ec-wb-") ? panelId.replace("ec-wb-", "") : ""
    );
}

export function isEcPlatformEditorPanel(panelId) {
    const id = normalizeSbV5PanelId(panelId);
    return id === SB_V5_EDITOR_PANEL || id === SB_V5_DESIGN_STUDIO_PANEL;
}

export function platformPanelActiveInGroup(groupId, activePanel) {
    if (groupId === EC_DESIGN_GROUP || groupId === EC_ONLINE_STORE_GROUP) return isEcOnlineStorePanel(activePanel);
    if (groupId === EC_LAUNCH_GROUP || groupId === EC_SEO_DOMAIN_GROUP) {
        const launchPanels = [
            sbV5SegmentToPanel("publish"),
            sbV5SegmentToPanel("domain"),
            sbV5SegmentToPanel("seo"),
            sbV5SegmentToPanel("url-redirects"),
            sbV5SegmentToPanel("performance"),
            sbV5SegmentToPanel("brand-email"),
            EC_DOMAIN_WIZARD_PANEL,
            sbV5SegmentToPanel("settings"),
        ];
        return launchPanels.includes(activePanel);
    }
    if (groupId === "ec-products-group") return activePanel?.startsWith("ec-product") || activePanel?.startsWith("ec-products") || activePanel?.startsWith("ec-purchase") || activePanel?.startsWith("ec-transfer") || activePanel?.startsWith("ec-stock-count") || activePanel?.startsWith("ec-category") || activePanel?.startsWith("ec-brand") || activePanel?.startsWith("ec-supplier");
    if (groupId === "ec-orders-group") return activePanel?.startsWith("ec-order") || activePanel?.startsWith("ec-orders") || activePanel?.startsWith("ec-gift-card");
    if (groupId === "ec-customers-group") return activePanel?.startsWith("ec-customer");
    if (groupId === "ec-discounts-group") return activePanel?.startsWith("ec-discount") || activePanel?.startsWith("ec-campaign");
    if (groupId === "ec-inbox-group") return activePanel?.startsWith("ec-inbox");
    return false;
}

export function buildPlatformNav(language) {
    const en = language === "en";
    return EC_PLATFORM_NAV.map((item) => ({
        id: item.id,
        label: en ? item.labelEn : item.labelTr,
        icon: item.icon,
        children: item.children
            ? item.children.map((c) => ({
                id: c.id,
                label: en ? c.labelEn : c.labelTr,
            }))
            : null,
    }));
}
