/**
 * E-Ticaret — ana menü + ürünler alt menüsü + mağaza iç menüsü
 */
import {
    SB_V5_CHANNEL_PREFIX,
    SB_V5_CENTER_PANEL,
    SB_V5_MY_THEMES_PANEL,
    SB_V5_THEME_MANAGE_PANEL,
    SB_V5_EDITOR_PANEL,
    SB_V5_MARKETPLACE_PANEL,
    SB_V5_DEFAULT_PANEL,
    SB_V5_STORE_EDITOR_SEGMENTS,
    SB_V5_INLINE_SEGMENTS,
    normalizeSbV5PanelId,
    sbV5PanelToSegment,
    sbV5SegmentToPanel,
    isSbV5ChannelPanel,
    isSbV5FullBleedPanel,
    isSbV5StoreEditorSegment,
} from "./storeBuilderV5";

export const ECOMMERCE_MAIN_NAV = [
    { id: "ec-home", labelTr: "Giriş", labelEn: "Home" },
    {
        id: "ec-products-group",
        labelTr: "Ürünler",
        labelEn: "Products",
        children: [
            { id: "ec-products", labelTr: "Ürünler", labelEn: "Products" },
            { id: "ec-products-purchase", labelTr: "Satın Alma", labelEn: "Purchasing" },
            { id: "ec-products-transfers", labelTr: "Transferler", labelEn: "Transfers" },
            { id: "ec-products-stock-count", labelTr: "Stok Sayımı", labelEn: "Stock Count" },
            { id: "ec-products-definitions", labelTr: "Tanımlamalar", labelEn: "Definitions" },
            { id: "ec-products-price-list", labelTr: "Fiyat Listesi", labelEn: "Price List" },
            { id: "ec-products-barcode", labelTr: "Ürün Barkod Etiketi", labelEn: "Barcode Labels" },
        ],
    },
    {
        id: "ec-orders-group",
        labelTr: "Siparişler",
        labelEn: "Orders",
        children: [
            { id: "ec-orders", labelTr: "Siparişler", labelEn: "Orders" },
            { id: "ec-orders-drafts", labelTr: "Taslaklar", labelEn: "Drafts" },
            { id: "ec-orders-abandoned", labelTr: "Terk Edilmiş Sepetler", labelEn: "Abandoned Carts" },
            { id: "ec-orders-tags", labelTr: "Etiketler", labelEn: "Labels" },
            { id: "ec-orders-gift-cards", labelTr: "Hediye Kartları", labelEn: "Gift Cards" },
        ],
    },
    {
        id: "ec-customers-group",
        labelTr: "Müşteriler",
        labelEn: "Customers",
        children: [
            { id: "ec-customers", labelTr: "Müşteriler", labelEn: "Customers" },
            { id: "ec-customers-groups", labelTr: "Müşteri Grupları", labelEn: "Customer Groups" },
            { id: "ec-customers-tags", labelTr: "Etiketler", labelEn: "Tags" },
        ],
    },
    {
        id: "ec-discounts-group",
        labelTr: "İndirimler",
        labelEn: "Discounts",
        children: [
            { id: "ec-discounts-campaigns", labelTr: "Kampanyalar", labelEn: "Campaigns" },
            { id: "ec-discounts-coupons", labelTr: "Kuponlar", labelEn: "Coupons" },
        ],
    },
    {
        id: "ec-inbox-group",
        labelTr: "Gelen Kutusu",
        labelEn: "Inbox",
        children: [
            { id: "ec-inbox-messages", labelTr: "Mesajlar", labelEn: "Messages" },
            { id: "ec-inbox-settings", labelTr: "Ayarlar", labelEn: "Settings" },
        ],
    },
    { id: "ec-reports", labelTr: "Analitik", labelEn: "Analytics" },
    { id: "ec-store-settings", labelTr: "Mağaza Ayarları", labelEn: "Store settings" },
];

export const ECOMMERCE_DEFAULT_PANEL = "ec-stores";

/** Satış kanalı — Store Builder V5 (Mağaza Merkezi odaklı IA) */
export const EC_WB_CHANNEL_PREFIX = SB_V5_CHANNEL_PREFIX;
export const EC_WB_DEFAULT_PANEL = SB_V5_DEFAULT_PANEL;
export const EC_WB_CENTER_PANEL = SB_V5_CENTER_PANEL;
export const EC_WB_MY_THEMES_PANEL = SB_V5_MY_THEMES_PANEL;
export const EC_WB_THEME_MANAGE_PANEL = SB_V5_THEME_MANAGE_PANEL;

export function isEcWbChannelPanel(panelId) {
    return isSbV5ChannelPanel(panelId);
}

/** @deprecated use EC_WB_MY_THEMES_PANEL */
export const EC_WB_THEMES_PANEL = SB_V5_MY_THEMES_PANEL;
export const EC_WB_EDITOR_PANEL = SB_V5_EDITOR_PANEL;
export const EC_WB_THEMES_EDITOR_PANEL = SB_V5_EDITOR_PANEL;
export const EC_WB_THEMES_MARKETPLACE_PANEL = SB_V5_MARKETPLACE_PANEL;
export const EC_WB_MARKETPLACE_PANEL = SB_V5_MARKETPLACE_PANEL;
export const EC_WB_DESIGN_STUDIO_PANEL = `${SB_V5_CHANNEL_PREFIX}design-studio`;

export function isEcWbFullBleedPanel(panelId) {
    return isSbV5FullBleedPanel(panelId);
}

export const EC_WB_STORE_EDITOR_SEGMENTS = SB_V5_STORE_EDITOR_SEGMENTS;

export function isEcWbStoreEditorSegment(segment) {
    return isSbV5StoreEditorSegment(segment) || segment === "themes-editor";
}

export function ecWbPanelToSegment(panelId) {
    if (!panelId || !isEcWbChannelPanel(panelId)) return "my-themes";
    const normalized = normalizeSbV5PanelId(panelId);
    const seg = sbV5PanelToSegment(normalized);
    if (seg === "editor") return "editor";
    if (seg === "marketplace") return "marketplace";
    if (seg === "themes-editor") return "editor";
    if (seg === "themes-marketplace") return "marketplace";
    if (seg === "themes") return "my-themes";
    return seg;
}

export function ecWbSegmentToPanel(segment) {
    const s = segment || "my-themes";
    if (s === "themes-editor") return SB_V5_EDITOR_PANEL;
    if (s === "themes-marketplace") return SB_V5_MARKETPLACE_PANEL;
    if (s === "themes") return SB_V5_MY_THEMES_PANEL;
    return sbV5SegmentToPanel(s);
}

export const ECOMMERCE_PRODUCTS_PLACEHOLDER_META = {
    "ec-products-price-list": { title: "Fiyat Listesi", text: "Fiyat listeleri burada yönetilecek." },
};

export const ECOMMERCE_MAIN_META = {
    "ec-inbox-messages": { title: "Mesajlar", text: "Tüm kanallardan gelen müşteri mesajları." },
    "ec-inbox-settings": { title: "Gelen Kutusu Ayarları", text: "Kanal bağlantılarını yönetin." },
    "ec-reports": { title: "Raporlar", text: "Mağaza satış ve dönüşüm raporları burada olacak." },
    "ec-settings": { title: "Ayarlar", text: "Genel mağaza ayarları burada yapılandırılacak." },
};

export function isEcommerceProductsPanel(panelId) {
    if (!panelId) return false;
    if (panelId === "ec-products") return true;
    if (panelId.startsWith("ec-products-")) return true;
    if (panelId.startsWith("ec-product-")) return true;
    if (panelId.startsWith("ec-purchase")) return true;
    if (panelId.startsWith("ec-transfer")) return true;
    if (panelId.startsWith("ec-stock-count")) return true;
    if (panelId.startsWith("ec-category-")) return true;
    if (panelId.startsWith("ec-brand-")) return true;
    if (panelId.startsWith("ec-supplier-")) return true;
    if (panelId.startsWith("ec-personalization-")) return true;
    if (panelId.startsWith("ec-cart-link-")) return true;
    if (panelId.startsWith("ec-barcode-label-")) return true;
    return false;
}

export function isEcommerceCustomersPanel(panelId) {
    if (!panelId) return false;
    if (panelId === "ec-customers") return true;
    if (panelId === "ec-customers-groups" || panelId === "ec-customers-tags") return true;
    if (panelId.startsWith("ec-customer-")) return true;
    return false;
}

export function isEcommerceOrdersPanel(panelId) {
    if (!panelId) return false;
    if (panelId === "ec-orders" || panelId === "ec-orders-list") return true;
    if (panelId.startsWith("ec-orders-")) return true;
    if (panelId.startsWith("ec-order-")) return true;
    if (panelId.startsWith("ec-gift-card")) return true;
    return false;
}

export function isEcommerceInboxPanel(panelId) {
    if (!panelId) return false;
    if (panelId === "ec-inbox-messages" || panelId === "ec-inbox-settings") return true;
    if (panelId === "ec-inbox") return true;
    return false;
}

export function isEcommerceDiscountsPanel(panelId) {
    if (!panelId) return false;
    if (panelId === "ec-discounts" || panelId === "ec-discounts-campaigns" || panelId === "ec-discounts-coupons")
        return true;
    if (panelId.startsWith("ec-campaign-")) return true;
    return false;
}

export function buildEcommerceMainSubmenu(language) {
    const en = language === "en";
    return ECOMMERCE_MAIN_NAV.map((item) => ({
        id: item.id,
        label: en ? item.labelEn : item.labelTr,
        children: item.children
            ? item.children.map((c) => ({
                  id: c.id,
                  label: en ? c.labelEn : c.labelTr,
              }))
            : null,
    }));
}

export function isEcommerceMainPanel(panelId) {
    return !!panelId && panelId.startsWith("ec-");
}

export function getEcommerceMainLabel(panelId, language) {
    const en = language === "en";
    if (panelId === "ec-stores") return en ? "My stores" : "Mağazalarım";
    if (isEcWbChannelPanel(panelId)) {
        const seg = ecWbPanelToSegment(panelId);
        const labels = {
            center: { tr: "Mağaza Merkezi", en: "Store Center" },
            "my-themes": { tr: "Temalarım", en: "My Themes" },
            "theme-manage": { tr: "Tema Yönetimi", en: "Theme Management" },
            editor: { tr: "Store Editor", en: "Store Editor" },
            marketplace: { tr: "Tema Mağazası", en: "Theme Store" },
            "design-studio": { tr: "Global Design Studio", en: "Design Studio" },
            themes: { tr: "Temalarım", en: "My Themes" },
            "themes-editor": { tr: "Store Editor", en: "Store Editor" },
            "themes-marketplace": { tr: "Tema Mağazası", en: "Theme Store" },
            seo: { tr: "SEO Merkezi", en: "SEO Center" },
            publish: { tr: "Yayın Durumu", en: "Publish Status" },
            "url-redirects": { tr: "URL & Yönlendirme", en: "URL & Redirects" },
            performance: { tr: "Performans", en: "Performance" },
            "brand-email": { tr: "E-posta & Marka", en: "Email & Brand" },
            settings: { tr: "Lokalizasyon", en: "Localization" },
            blog: { tr: "Blog", en: "Blog" },
            navigation: { tr: "Menü", en: "Menu" },
            domain: { tr: "Alan Adları", en: "Domains" },
        };
        const L = labels[seg] || labels.center;
        return en ? L.en : L.tr;
    }
    for (const item of ECOMMERCE_MAIN_NAV) {
        if (item.id === panelId) return en ? item.labelEn : item.labelTr;
        if (item.children) {
            const child = item.children.find((c) => c.id === panelId);
            if (child) return en ? child.labelEn : child.labelTr;
        }
    }
    if (panelId === "ec-product-add-simple") return en ? "Add Simple Product" : "Basit Ürün Ekle";
    if (panelId === "ec-product-add-variant") return en ? "Add Variant Product" : "Varyantlı Ürün Ekle";
    if (panelId.startsWith("ec-product-edit-")) return en ? "Edit Product" : "Ürün Düzenle";
    if (panelId === "ec-purchase-add") return en ? "Add Purchase" : "Satın Alma Ekle";
    if (panelId.startsWith("ec-purchase-edit-")) return en ? "Edit Purchase" : "Satın Alma Düzenle";
    if (panelId === "ec-transfer-add") return en ? "Add Transfer" : "Transfer Ekle";
    if (panelId.startsWith("ec-transfer-edit-")) return en ? "Edit Transfer" : "Transfer Düzenle";
    if (panelId === "ec-stock-count-add") return en ? "Add Stock Count" : "Stok Sayımı Ekle";
    if (panelId.startsWith("ec-stock-count-work-")) return en ? "Stock Count" : "Stok Sayımı";
    if (panelId === "ec-category-add-normal") return en ? "Add Category" : "Kategori Ekle";
    if (panelId === "ec-category-add-dynamic") return en ? "Add Dynamic Category" : "Dinamik Kategori Ekle";
    if (panelId.startsWith("ec-category-edit-")) return en ? "Edit Category" : "Kategori Düzenle";
    if (panelId === "ec-products-definitions-brands") return en ? "Brands" : "Markalar";
    if (panelId === "ec-products-definitions-tags") return en ? "Tags" : "Etiketler";
    if (panelId === "ec-products-definitions-units") return en ? "Units" : "Birimler";
    if (panelId === "ec-products-definitions-cart-link") return en ? "Cart Link" : "Sepet Linki";
    if (panelId === "ec-cart-link-add") return en ? "Cart Link" : "Sepet Linki";
    if (panelId.startsWith("ec-cart-link-edit-")) return en ? "Cart Link" : "Sepet Linki";
    if (panelId === "ec-products-definitions-suppliers") return en ? "Suppliers" : "Tedarikçiler";
    if (panelId === "ec-supplier-add") return en ? "Add Supplier" : "Tedarikçi Oluştur";
    if (panelId.startsWith("ec-supplier-edit-")) return en ? "Edit Supplier" : "Tedarikçi Düzenle";
    if (panelId === "ec-brand-add") return en ? "Add Brand" : "Marka Ekle";
    if (panelId.startsWith("ec-brand-edit-")) return en ? "Edit Brand" : "Marka Düzenle";
    if (panelId === "ec-products-definitions-custom") return en ? "Custom Fields" : "Özel Alanlar";
    if (panelId === "ec-products-definitions-variant-types") return en ? "Variant Types" : "Varyant Türleri";
    if (panelId === "ec-products-definitions-product-groups") return en ? "Product Groups" : "Ürün Grupları";
    if (panelId === "ec-product-group-add-manual") return en ? "Add Product Group (Manual)" : "Manuel Ürün Grubu Ekle";
    if (panelId === "ec-product-group-add-automatic") return en ? "Add Product Group (Auto)" : "Otomatik Ürün Grubu Ekle";
    if (panelId.startsWith("ec-product-group-edit-")) return en ? "Edit Product Group" : "Ürün Grubunu Düzenle";
    if (panelId === "ec-products-definitions-personalizations") return en ? "Product Personalizations" : "Ürün Kişiselleştirmeleri";
    if (panelId === "ec-personalization-add") return en ? "Add Personalization" : "Ürün Kişiselleştirmesi Ekle";
    if (panelId.startsWith("ec-personalization-edit-")) return en ? "Edit Personalization" : "Kişiselleştirmeyi Düzenle";
    if (panelId === "ec-personalization-option-add") return en ? "Personalization Option" : "Kişiselleştirme Seçeneği";
    if (panelId.startsWith("ec-personalization-option-edit-")) return en ? "Personalization Option" : "Kişiselleştirme Seçeneği";
    if (panelId === "ec-products-barcode") return en ? "Barcode Labels" : "Ürün Barkod Etiketi";
    if (panelId === "ec-barcode-label-continue") return en ? "Barcode Labels" : "Ürün Barkod Etiketi";
    if (panelId === "ec-orders" || panelId === "ec-orders-list") return en ? "Orders" : "Siparişler";
    if (panelId === "ec-orders-drafts") return en ? "Draft Orders" : "Taslak Siparişler";
    if (panelId === "ec-orders-abandoned") return en ? "Abandoned Carts" : "Terk Edilmiş Sepetler";
    if (panelId === "ec-orders-tags") return en ? "Order Labels" : "Sipariş Etiketleri";
    if (panelId === "ec-orders-gift-cards") return en ? "Gift Cards" : "Hediye Kartları";
    if (panelId === "ec-gift-card-create") return en ? "Create Gift Card" : "Hediye Kartı Oluştur";
    if (panelId.startsWith("ec-gift-card-edit-")) return en ? "Edit Gift Card" : "Hediye Kartı Düzenle";
    if (panelId?.startsWith("ec-gift-card-")) return en ? "Gift Card" : "Hediye Kartı";
    if (panelId === "ec-order-create") return en ? "Create Order" : "Sipariş Oluştur";
    if (panelId?.startsWith("ec-order-")) return en ? "Order" : "Sipariş";
    if (panelId === "ec-discounts-campaigns" || panelId === "ec-discounts") return en ? "Campaigns" : "Kampanyalar";
    if (panelId === "ec-discounts-coupons") return en ? "Coupons" : "Kuponlar";
    if (panelId === "ec-inbox-messages" || panelId === "ec-inbox") return en ? "Messages" : "Mesajlar";
    if (panelId === "ec-inbox-settings") return en ? "Inbox Settings" : "Gelen Kutusu Ayarları";
    if (panelId === "ec-campaign-auto-create") return en ? "Add Automatic Discount" : "Otomatik İndirim Ekle";
    if (panelId === "ec-campaign-code-create") return en ? "Add Discount Code" : "İndirim Kodu Ekle";
    if (panelId.startsWith("ec-campaign-edit-")) return en ? "Edit Campaign" : "Kampanya Düzenle";
    if (panelId?.startsWith("ec-campaign-")) return en ? "Campaign" : "Kampanya";
    if (panelId === "ec-customers") return en ? "Customers" : "Müşteriler";
    if (panelId === "ec-customers-groups") return en ? "Customer Groups" : "Müşteri Grupları";
    if (panelId === "ec-customers-tags") return en ? "Customer Tags" : "Müşteri Etiketleri";
    if (panelId === "ec-customer-group-create") return en ? "Add Customer Group" : "Müşteri Grubu Ekle";
    if (panelId.startsWith("ec-customer-group-edit-")) return en ? "Edit Customer Group" : "Müşteri Grubunu Düzenle";
    if (panelId === "ec-customer-create") return en ? "Create Customer" : "Müşteri Oluştur";
    if (panelId.startsWith("ec-customer-edit-")) return en ? "Edit Customer" : "Müşteri Düzenle";
    if (panelId?.startsWith("ec-customer-")) return en ? "Customer" : "Müşteri";
    if (panelId === "ec-store-settings") return en ? "Store settings" : "Mağaza ayarları";
    return language === "en" ? "E-Commerce" : "E-Ticaret";
}

export const STORE_CHANNEL_PANEL = "store-channel";
export const STORE_SELLER_VERIFY_PANEL = "store-seller-verify";

export const STORE_NAV_ITEMS = [
    { id: "store-themes", labelTr: "Temalarım", labelEn: "My Themes", icon: "themes" },
    { id: "store-publish", labelTr: "Yayın Durumu", labelEn: "Publish Status", icon: "publish" },
    { id: "store-domain", labelTr: "Alan Adları", labelEn: "Domains", icon: "domain" },
    { id: "store-seo", labelTr: "SEO Merkezi", labelEn: "SEO Center", icon: "seo" },
    { id: "store-url-redirects", labelTr: "URL & Yönlendirme", labelEn: "URL & Redirects", icon: "redirects" },
    { id: "store-performance", labelTr: "Performans", labelEn: "Performance", icon: "performance" },
    { id: "store-brand-email", labelTr: "E-posta & Marka", labelEn: "Email & Brand", icon: "brandEmail" },
    { id: "store-automations", labelTr: "Otomasyonlar", labelEn: "Automations", icon: "automations" },
    { id: "store-notifications", labelTr: "Bildirimler", labelEn: "Notifications", icon: "notifications" },
    { id: "store-localization", labelTr: "Lokalizasyon", labelEn: "Localization", icon: "localization" },
    { id: "store-payments", labelTr: "Ödeme Ayarları", labelEn: "Payment Settings", icon: "payments" },
    { id: "store-customers", labelTr: "Müşteri Ayarları", labelEn: "Customer Settings", icon: "customers" },
    { id: "store-shipping", labelTr: "Kargo Ayarları", labelEn: "Shipping Settings", icon: "shipping" },
    { id: "store-plugins", labelTr: "Eklentiler", labelEn: "Add-ons", icon: "plugins" },
    { id: "store-blog", labelTr: "Blog", labelEn: "Blog", icon: "blog" },
];

export const STORE_DEFAULT_PANEL = "store-publish";

const LEGACY_ALIASES = {
    "store-hub": "store-publish",
    "store-dashboard": "store-publish",
    "store-design": "store-themes",
    "store-domain": "store-domain",
    "store-seo-domain": "store-publish",
    "store-pages": "store-publish",
    "store-legal": "store-publish",
    "store-products": "store-themes",
    "store-collections": "store-themes",
    "store-orders": "store-payments",
};

export function normalizeStorePanel(panelId) {
    if (!panelId || panelId === STORE_CHANNEL_PANEL) return STORE_DEFAULT_PANEL;
    return LEGACY_ALIASES[panelId] || panelId;
}

export function isStoreChannelView(panelId) {
    if (!panelId) return false;
    if (panelId === STORE_SELLER_VERIFY_PANEL) return false;
    if (panelId === STORE_CHANNEL_PANEL) return true;
    if (panelId.startsWith("store-")) return true;
    return false;
}

export function isEcommercePanel(panelId) {
    return isStoreChannelView(panelId);
}

export const STORE_HUB_TAB = {
    "store-themes": "design",
    "store-publish": "publish",
    "store-domain": "domain",
    "store-seo": "seo",
    "store-seo-domain": "publish",
    "store-payments": "payments",
};

export const STORE_SECTION_META = {
    "store-automations": {
        title: "Otomasyonlar",
        text: "Mağaza otomasyon kuralları burada yapılandırılacak.",
    },
    "store-notifications": {
        title: "Bildirimler",
        text: "Sipariş ve müşteri bildirim şablonları burada olacak.",
    },
    "store-localization": {
        title: "Lokalizasyon",
        text: "Dil, para birimi ve bölgesel ayarlar burada yapılandırılacak.",
    },
    "store-customers": {
        title: "Müşteri Ayarları",
        text: "Üyelik, misafir alışveriş ve müşteri alanları burada tanımlanacak.",
    },
    "store-shipping": {
        title: "Kargo Ayarları",
        text: "Kargo ücretleri, bölgeler ve teslimat seçenekleri burada olacak.",
    },
    "store-plugins": {
        title: "Eklentiler",
        text: "Mağazanıza eklenti kurulumu buradan yönetilecek.",
    },
    "store-blog": {
        title: "Blog",
        text: "Blog yazıları ve kategoriler burada yönetilecek.",
    },
};

export function getStoreRouterSection(panelId) {
    if (panelId === STORE_CHANNEL_PANEL) return STORE_DEFAULT_PANEL;
    return normalizeStorePanel(panelId);
}

export function getStoreNavLabel(panelId, language) {
    if (isEcommerceMainPanel(panelId)) {
        return getEcommerceMainLabel(panelId, language);
    }
    if (panelId === STORE_CHANNEL_PANEL) {
        return language === "en" ? "Sales Channel" : "Satış Kanalı";
    }
    const id = normalizeStorePanel(panelId);
    const item = STORE_NAV_ITEMS.find((i) => i.id === id);
    if (!item) return "Web Sitem";
    return language === "en" ? item.labelEn : item.labelTr;
}
