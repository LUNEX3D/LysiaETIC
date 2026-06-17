"use strict";

/**
 * Premium section library — İkas / Shopify / Dawn inspired variants.
 * Each entry maps to an existing blockType + sectionVariant in defaultContent.
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

function premium(key, name, category, blockType, extra = {}) {
    const variant = extra.sectionVariant || key;
    return {
        key,
        name,
        category,
        blockType,
        description: extra.description || `${name} — premium vitrin bölümü`,
        settingsSchema: extra.settingsSchema || schema("heading", "subheading", "ctaText", "ctaUrl", "backgroundUrl", "backgroundColor", "textColor", "paddingTop", "paddingBottom"),
        defaultContent: {
            sectionVariant: variant,
            registryKey: key,
            ...(extra.defaultContent || {}),
        },
        tags: ["premium", "v2", ...(extra.tags || [])],
    };
}

const PREMIUM_HERO = [
    premium("hero-classic", "Hero Classic", "hero", "hero", { sectionVariant: "classic", defaultContent: { heading: "Mağazanıza Hoş Geldiniz", subheading: "En iyi ürünler tek adreste", minHeight: "520px", textAlign: "center" } }),
    premium("hero-split", "Hero Split", "hero", "hero", { sectionVariant: "split", defaultContent: { heading: "Yeni Koleksiyon", subheading: "Editoryal tasarım", layout: "split", imagePosition: "right", minHeight: "480px" } }),
    premium("hero-video", "Hero Video", "hero", "video", { sectionVariant: "video-hero", settingsSchema: schema("heading", "subheading", "ctaText", "ctaUrl"), defaultContent: { heading: "Hikayemizi İzleyin", url: "", type: "youtube", aspectRatio: "21/9", muted: true } }),
    premium("hero-fashion", "Hero Fashion", "hero", "hero", { sectionVariant: "fashion", defaultContent: { heading: "Yeni Sezon", subheading: "Sınırlı koleksiyon", minHeight: "90vh", textAlign: "left", backgroundColor: "#fafafa", textColor: "#0a0a0a" } }),
    premium("hero-marketplace", "Hero Marketplace", "hero", "hero", { sectionVariant: "marketplace", defaultContent: { heading: "Binlerce Ürün, Tek Mağaza", subheading: "Güvenli alışveriş", minHeight: "440px", badges: ["Ücretsiz Kargo", "Hızlı Teslimat", "Kolay İade"] } }),
    premium("hero-electronics", "Hero Electronics", "hero", "hero", { sectionVariant: "electronics", defaultContent: { heading: "Teknoloji Fırsatları", subheading: "Resmi distribütör garantisi", minHeight: "460px", backgroundColor: "#0f172a", textColor: "#f8fafc" } }),
];

const PREMIUM_ANNOUNCEMENT = [
    premium("announcement-simple", "Announcement Simple", "marketing", "html", { sectionVariant: "announcement-simple", settingsSchema: [{ id: "text", label: "Metin", type: "text", defaultValue: "Ücretsiz kargo — 1500 TL üzeri" }], defaultContent: { announcement: true, text: "Ücretsiz kargo — 1500 TL üzeri", textColor: "#fff", backgroundColor: "#0f172a" } }),
    premium("announcement-marquee", "Announcement Marquee", "marketing", "html", { sectionVariant: "announcement-marquee", defaultContent: { marquee: true, text: "YENİ SEZON — %30'A VARAN İNDİRİM", textColor: "#fff", backgroundColor: "#18181b", gap: 120, fontSize: 22, speed: 160 } }),
    premium("announcement-campaign", "Announcement Campaign", "marketing", "banner", { sectionVariant: "announcement-campaign", defaultContent: { heading: "Flash Sale", text: "48 saat — kaçırmayın", minHeight: "120px", backgroundColor: "#dc2626", textColor: "#fff" } }),
];

const PREMIUM_PRODUCTS = [
    premium("featured-products", "Featured Products", "commerce", "product-grid", { sectionVariant: "featured", defaultContent: { heading: "Öne Çıkan Ürünler", columns: 4, limit: 8, filter: "featured", showPrice: true, showAddToCart: true } }),
    premium("tabbed-products", "Tabbed Products", "commerce", "product-grid", { sectionVariant: "tabbed", settingsSchema: [{ id: "heading", label: "Başlık", type: "text", defaultValue: "Kategoriler" }, { id: "tabs", label: "Sekmeler", type: "text", defaultValue: "Yeni,Çok Satan,İndirim" }], defaultContent: { heading: "Keşfet", columns: 4, limit: 8, tabs: ["Yeni", "Çok Satan", "İndirim"], filter: "featured" } }),
    premium("carousel-products", "Carousel Products", "commerce", "product-grid", { sectionVariant: "carousel", defaultContent: { heading: "Trend Ürünler", columns: 4, limit: 12, layout: "carousel", showPrice: true } }),
    premium("marketplace-products", "Marketplace Products", "commerce", "product-grid", { sectionVariant: "marketplace", defaultContent: { heading: "Popüler Ürünler", columns: 5, limit: 10, dense: true, showBadge: true, showPrice: true } }),
    premium("fashion-products", "Fashion Products", "commerce", "product-grid", { sectionVariant: "fashion", defaultContent: { heading: "Editoryal Seçim", columns: 3, limit: 6, cardStyle: "editorial", showPrice: true } }),
];

const PREMIUM_COLLECTIONS = [
    premium("collection-grid", "Collection Grid", "commerce", "category-grid", { sectionVariant: "grid", defaultContent: { heading: "Koleksiyonlar", columns: 4 } }),
    premium("collection-slider", "Collection Slider", "commerce", "category-grid", { sectionVariant: "slider", defaultContent: { heading: "Koleksiyonlar", columns: 4, layout: "carousel" } }),
    premium("category-showcase", "Category Showcase", "commerce", "category-grid", { sectionVariant: "showcase", defaultContent: { heading: "Kategoriler", columns: 3, style: "showcase" } }),
    premium("featured-categories", "Featured Categories", "commerce", "category-grid", { sectionVariant: "featured", defaultContent: { heading: "Öne Çıkan Kategoriler", columns: 4, featured: true } }),
];

const PREMIUM_MARKETING = [
    premium("trust-badges", "Trust Badges", "marketing", "html", { sectionVariant: "trust-badges", defaultContent: { trustBadges: true, items: [{ icon: "🚚", title: "Hızlı Kargo" }, { icon: "🔒", title: "Güvenli Ödeme" }, { icon: "↩️", title: "Kolay İade" }] } }),
    premium("testimonials-premium", "Testimonials", "marketing", "testimonials", { sectionVariant: "cards", defaultContent: { heading: "Müşterilerimiz Ne Diyor?", columns: 3 } }),
    premium("faq-premium", "FAQ", "marketing", "text", { sectionVariant: "accordion", defaultContent: { html: "<h2>Sık Sorulan Sorular</h2>", faq: true, items: [{ q: "Kargo süresi?", a: "1-3 iş günü" }, { q: "İade?", a: "14 gün içinde ücretsiz" }] } }),
    premium("newsletter-premium", "Newsletter", "marketing", "newsletter", {
        sectionVariant: "split",
        settingsSchema: schema("heading", "subheading", "ctaText", "backgroundColor", "textColor", "paddingTop", "paddingBottom"),
        defaultContent: {
            heading: "Bültene Katılın",
            subtext: "Kampanyalardan ilk siz haberdar olun",
            buttonText: "Abone Ol",
            backgroundColor: "#18181b",
            textColor: "#fff",
        },
    }),
    premium("instagram-feed", "Instagram Feed", "marketing", "html", { sectionVariant: "instagram", defaultContent: { instagramFeed: true, heading: "@magazamiz", handle: "magazamiz" } }),
    premium("brand-logos", "Brand Logos", "marketing", "html", { sectionVariant: "brand-logos", defaultContent: { brandLogos: true, heading: "Markalarımız", logos: [{ name: "Marka A" }, { name: "Marka B" }, { name: "Marka C" }, { name: "Marka D" }] } }),
    premium("countdown-campaign", "Countdown Campaign", "marketing", "countdown", { sectionVariant: "campaign", defaultContent: { heading: "Fırsat Bitiyor", subtext: "Kaçırmayın", ctaText: "Hemen Al", ctaUrl: "/products" } }),
    premium("statistics-block", "Statistics", "marketing", "text", { sectionVariant: "statistics", defaultContent: { statistics: true, items: [{ value: "10K+", label: "Müşteri" }, { value: "500+", label: "Ürün" }, { value: "4.9", label: "Puan" }, { value: "24/7", label: "Destek" }] } }),
];

const PREMIUM_FOOTER = [
    premium("footer-minimal", "Footer Minimal", "footer", "html", { sectionVariant: "footer-minimal", settingsSchema: [{ id: "copyright", label: "Telif", type: "text", defaultValue: "© 2026 Mağaza" }], defaultContent: { footerBlock: true, variant: "minimal", copyright: "© 2026 Mağaza" } }),
    premium("footer-modern", "Footer Modern", "footer", "html", { sectionVariant: "footer-modern", defaultContent: { footerBlock: true, variant: "modern", columns: 3 } }),
    premium("footer-marketplace", "Footer Marketplace", "footer", "html", { sectionVariant: "footer-marketplace", defaultContent: { footerBlock: true, variant: "marketplace", showPayments: true } }),
    premium("footer-luxury", "Footer Luxury", "footer", "html", { sectionVariant: "footer-luxury", defaultContent: { footerBlock: true, variant: "luxury", centered: true } }),
];

const PREMIUM_SECTION_REGISTRY = [
    ...PREMIUM_HERO,
    ...PREMIUM_ANNOUNCEMENT,
    ...PREMIUM_PRODUCTS,
    ...PREMIUM_COLLECTIONS,
    ...PREMIUM_MARKETING,
    ...PREMIUM_FOOTER,
];

module.exports = { PREMIUM_SECTION_REGISTRY };
