/** Client-side section registry mirror — backend ile senkron key'ler */
export const PAGE_TEMPLATES = [
    { key: "home", label: "Anasayfa" },
    { key: "category", label: "Koleksiyon" },
    { key: "product", label: "Ürün" },
    { key: "search", label: "Arama" },
    { key: "cart", label: "Sepet" },
    { key: "checkout", label: "Ödeme" },
    { key: "blog", label: "Blog" },
    { key: "contact", label: "İletişim" },
    { key: "account", label: "Hesap" },
    { key: "wishlist", label: "İstek Listesi" },
    { key: "404", label: "404" },
];

export const SUPPORTED_LOCALES = [
    { code: "tr", label: "Türkçe", direction: "ltr" },
    { code: "en", label: "English", direction: "ltr" },
    { code: "de", label: "Deutsch", direction: "ltr" },
    { code: "fr", label: "Français", direction: "ltr" },
    { code: "ar", label: "العربية", direction: "rtl" },
    { code: "ru", label: "Русский", direction: "ltr" },
];

export const DEVICE_WIDTHS = {
    desktop: 1440,
    laptop: 1280,
    tablet: 768,
    mobile: 390,
};

export const GLOBAL_PANEL = "__global__";
export const HEADER_PANEL = "__header__";
export const FOOTER_PANEL = "__footer__";
export const CHECKOUT_PANEL = "__checkout__";
export const SEO_PANEL = "__seo__";
