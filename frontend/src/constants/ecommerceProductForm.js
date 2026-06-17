export const PRODUCT_FORM_TABS_SIMPLE = [
    { id: "basic", label: "Temel Bilgi" },
    { id: "media", label: "Medya" },
    { id: "detail", label: "Ürün Detayı" },
    { id: "inventory", label: "Envanter" },
    { id: "seo", label: "SEO" },
    { id: "custom", label: "Özel Alanlar" },
    { id: "personalize", label: "Ürün Özelleştirmesi" },
];

export const PRODUCT_FORM_TABS_VARIANT = [
    { id: "basic", label: "Temel Bilgi" },
    { id: "media", label: "Medya" },
    { id: "detail", label: "Ürün Detayı" },
    { id: "variant", label: "Varyant" },
    { id: "inventory", label: "Envanter" },
    { id: "seo", label: "SEO" },
    { id: "custom", label: "Özel Alanlar" },
    { id: "personalize", label: "Ürün Özelleştirmesi" },
];

/** Basit ürün düzenlemede İkas’taki gibi Varyant sekmesi de gösterilir */
export const PRODUCT_FORM_TABS_EDIT_SIMPLE = [
    ...PRODUCT_FORM_TABS_SIMPLE,
    { id: "variant", label: "Varyant" },
];

export const SEO_LIMITS = { slug: 185, metaTitle: 255, metaDescription: 320 };

export const DEFAULT_LOCATIONS = [
    { name: "Ana Depo", stock: 0 },
    { name: "KONYA DEPO", stock: 0 },
];
