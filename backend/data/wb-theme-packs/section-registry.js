"use strict";

/**
 * Global section registry — schema-driven bölüm kütüphanesi (100+).
 * Yeni bölüm: bu dosyaya entry ekleyin; React/backend değişikliği gerekmez (blockType mevcut renderer ile).
 */

const BASE_SCHEMA = {
    heading: { id: "heading", label: "Başlık", type: "text", defaultValue: "" },
    subheading: { id: "subheading", label: "Alt başlık", type: "textarea", defaultValue: "" },
    ctaText: { id: "ctaText", label: "Buton metni", type: "text", defaultValue: "Keşfet" },
    ctaUrl: { id: "ctaUrl", label: "Buton linki", type: "url", defaultValue: "/products" },
    backgroundUrl: { id: "backgroundUrl", label: "Görsel", type: "image_picker", defaultValue: "" },
    mobileBackgroundUrl: { id: "mobileBackgroundUrl", label: "Mobil görsel", type: "image_picker", defaultValue: "" },
    backgroundColor: { id: "backgroundColor", label: "Arka plan rengi", type: "color", defaultValue: "#ffffff" },
    textColor: { id: "textColor", label: "Yazı rengi", type: "color", defaultValue: "#18181b" },
    overlay: { id: "overlay", label: "Overlay göster", type: "checkbox", defaultValue: true },
    paddingTop: { id: "paddingTop", label: "Üst boşluk (px)", type: "range", min: 0, max: 200, defaultValue: 40 },
    paddingBottom: { id: "paddingBottom", label: "Alt boşluk (px)", type: "range", min: 0, max: 200, defaultValue: 40 },
};

function schema(...keys) {
    return keys.map((k) => ({ ...BASE_SCHEMA[k] }));
}

function entry(key, name, category, blockType, extra = {}) {
    return {
        key,
        name,
        category,
        blockType,
        description: extra.description || "",
        settingsSchema: extra.settingsSchema || schema("heading", "subheading"),
        defaultContent: extra.defaultContent || {},
        tags: extra.tags || [],
    };
}

const HERO_VARIANTS = [
    ["hero-slider", "Hero Slider", "slider"],
    ["video-hero", "Video Hero", "video"],
    ["image-banner", "Image Banner", "banner"],
    ["split-hero", "Split Hero", "hero"],
    ["fullscreen-hero", "Fullscreen Hero", "hero"],
    ["gradient-hero", "Gradient Hero", "hero"],
    ["product-hero", "Product Hero", "hero"],
    ["campaign-hero", "Campaign Hero", "campaign"],
].map(([key, name, type], i) => entry(key, name, "hero", type, {
    settingsSchema: schema("heading", "subheading", "ctaText", "ctaUrl", "backgroundUrl", "mobileBackgroundUrl", "backgroundColor", "textColor", "overlay", "paddingTop", "paddingBottom"),
    defaultContent: { heading: name, ctaText: "Alışverişe Başla", ctaUrl: "/products" },
    tags: [`hero-${i}`],
}));

const COMMERCE_VARIANTS = [
    ["featured-products", "Öne Çıkan Ürünler", "product-grid"],
    ["product-carousel", "Ürün Carousel", "product-grid"],
    ["product-grid-4", "Ürün Grid 4", "product-grid"],
    ["product-grid-3", "Ürün Grid 3", "product-grid"],
    ["collection-grid", "Koleksiyon Grid", "category-grid"],
    ["category-grid", "Kategori Grid", "category-grid"],
    ["campaign-products", "Kampanyalı Ürünler", "product-grid"],
    ["bestsellers", "Çok Satanlar", "product-grid"],
    ["new-arrivals", "Yeni Gelenler", "product-grid"],
    ["related-products-block", "Benzer Ürünler", "related-products"],
    ["advanced-product-grid", "Advanced Product Grid", "product-grid"],
    ["collection-showcase", "Collection Showcase", "category-grid"],
    ["lookbook", "Lookbook", "image"],
    ["single-product-feature", "Single Ürün", "product-grid"],
].map(([key, name, type]) => entry(key, name, "commerce", type, {
    settingsSchema: [
        { id: "heading", label: "Başlık", type: "text", defaultValue: name },
        { id: "columns", label: "Sütun", type: "range", min: 2, max: 6, defaultValue: 4 },
        { id: "limit", label: "Ürün sayısı", type: "range", min: 4, max: 24, defaultValue: 8 },
    ],
    defaultContent: { heading: name, columns: 4, limit: 8, filter: "featured" },
}));

const CONTENT_BLOCKS = [
    ["rich-text", "Zengin Metin", "text"],
    ["faq", "SSS / FAQ", "text"],
    ["accordion", "Accordion", "html"],
    ["tabs", "Tabs", "html"],
    ["timeline", "Timeline", "text"],
    ["statistics", "İstatistikler", "text"],
    ["pricing-table", "Fiyat Tablosu", "html"],
    ["comparison-table", "Karşılaştırma", "html"],
    ["team", "Ekip", "text"],
    ["contact-form", "İletişim Formu", "contact"],
    ["google-maps", "Google Maps", "html"],
    ["custom-html", "Özel HTML", "html"],
    ["iframe", "Iframe", "html"],
    ["divider-block", "Divider", "divider"],
    ["spacer-block", "Boşluk", "spacer"],
].map(([key, name, type]) => entry(key, name, "content", type));

const MARKETING_BLOCKS = [
    ["marquee-text", "Kayan Yazı", "html"],
    ["logo-slider", "Logo Slider", "html"],
    ["brand-slider", "Marka Slaytı", "html"],
    ["countdown", "Geri Sayım", "countdown"],
    ["popup-banner", "Popup Banner", "banner"],
    ["sticky-banner", "Sticky Banner", "banner"],
    ["floating-button", "Floating Button", "html"],
    ["newsletter", "Newsletter", "newsletter"],
    ["email-subscription", "Email Aboneliği", "newsletter"],
    ["customer-reviews", "Müşteri Yorumları", "testimonials"],
    ["testimonials", "Referanslar", "testimonials"],
    ["before-after", "Before After", "image"],
    ["multi-banner", "Multi Banner", "banner"],
    ["feature-grid", "Feature Grid", "text"],
    ["icon-features", "Icon Features", "text"],
].map(([key, name, type]) => entry(key, name, "marketing", type, {
    defaultContent: type === "html" && key === "marquee-text"
        ? { marquee: true, text: "MAĞAZA", textColor: "#fff", backgroundColor: "#000", gap: 80, fontSize: 24, speed: 180 }
        : {},
}));

const MEDIA_BLOCKS = [
    ["image-grid", "Görsel Grid", "image"],
    ["image-card", "Görsel Kart", "image"],
    ["video-gallery", "Video Gallery", "video"],
    ["video-box", "Video Kutusu", "video"],
    ["gallery", "Galeri", "image"],
    ["instagram-feed", "Instagram Feed", "html"],
    ["tiktok-feed", "TikTok Feed", "html"],
    ["blog-grid", "Blog Grid", "text"],
    ["blog-slider", "Blog Slider", "slider"],
    ["blog-post", "Blog Yazısı", "text"],
].map(([key, name, type]) => entry(key, name, "media", type));

// Ek varyantlar — isim farklı, aynı motor (100+ hedefi)
const EXTRA_LABELS = [
    "Hero V2", "Hero V3", "Banner Alt", "Banner Üst", "Slayt 2", "Slayt 3", "Slayt 4",
    "Ürün Şeridi", "Kategori Banner", "Marka Listesi", "Marka Görsel Listesi",
    "Kampanya Şeridi", "İndirim Bandı", "Sezon Duyurusu", "Ücretsiz Kargo Bandı",
    "Story Section", "Ürün Vitrin", "Koleksiyon Vitrin", "Flash Sale",
    "Bundle Ürünler", "Çapraz Satış", "Son Görüntülenen", "Favori Ürünler Blok",
    "Arama Önerileri", "Marka Hikayesi", "Video Banner", "Parallax Banner",
    "Metin + Görsel", "İki Sütun", "Üç Sütun", "Dört Sütun Grid",
    "Müşteri Logoları", "Basın", "Ödüller", "Sertifikalar",
    "Canlı Destek", "WhatsApp Buton", "SMS Kayıt", "Kupon Alanı",
    "Sipariş Takip", "Mağaza Bul", "Randevu", "B2B Form",
    "Toptan Satış", "Bayi Başvuru", "Kariyer", "Franchise",
    "Sürdürülebilirlik", "Hikayemiz", "Değerlerimiz", "Misyon",
    "Ürün Karşılaştır", "Filtre Şeridi", "Sticky CTA", "Exit Intent",
    "Hoşgeldin Popup", "Sepet Hatırlatma", "Abonelik İkinci", "Sosyal Kanıt",
    "Yıldız Özeti", "UGC Grid", "Reels Grid", "Shorts Embed",
    "Podcast", "E-kitap", "Lead Magnet", "Webinar Kayıt",
    "Etkinlik", "Mağaza Açılış", "Lansman", "Black Friday",
    "Yılbaşı", "Sevgililer", "Anneler Günü", "Okula Dönüş",
];

const BLOCK_TYPES_ROTATE = ["banner", "text", "image", "product-grid", "category-grid", "html", "newsletter", "testimonials", "slider", "campaign"];

const EXTRA_BLOCKS = EXTRA_LABELS.map((name, i) => {
    const blockType = BLOCK_TYPES_ROTATE[i % BLOCK_TYPES_ROTATE.length];
    const key = `extra-${i + 1}-${name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
    return entry(key, name, i % 3 === 0 ? "marketing" : i % 3 === 1 ? "content" : "commerce", blockType, {
        description: `Profesyonel ${name} bölümü`,
    });
});

const { PREMIUM_SECTION_REGISTRY } = require("./premium-section-registry");

const SECTION_REGISTRY = [
    ...PREMIUM_SECTION_REGISTRY,
    ...HERO_VARIANTS,
    ...COMMERCE_VARIANTS,
    ...CONTENT_BLOCKS,
    ...MARKETING_BLOCKS,
    ...MEDIA_BLOCKS,
    ...EXTRA_BLOCKS,
];

module.exports = { SECTION_REGISTRY, BASE_SCHEMA };
