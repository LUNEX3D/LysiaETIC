"use strict";

function field(id, type, label, extra = {}) {
    return { id, type, label, ...extra };
}

/** 35 çekirdek section — Faz 1 */
const SECTION_REGISTRY = [
    {
        key: "hero",
        label: "Hero",
        category: "hero",
        settingsSchema: [
            field("heading", "text", "Başlık"),
            field("subheading", "textarea", "Alt başlık"),
            field("ctaText", "text", "Buton metni"),
            field("ctaUrl", "url", "Buton linki"),
            field("backgroundUrl", "image_picker", "Masaüstü görsel"),
            field("mobileBackgroundUrl", "image_picker", "Mobil görsel"),
            field("textAlign", "select", "Hizalama", { options: [
                { value: "left", label: "Sol" }, { value: "center", label: "Orta" }, { value: "right", label: "Sağ" },
            ], defaultValue: "center" }),
            field("minHeight", "text", "Yükseklik", { defaultValue: "500px" }),
            field("overlay", "text", "Overlay", { defaultValue: "rgba(0,0,0,0.35)" }),
        ],
        defaults: { type: "hero", content: { heading: "Mağazanıza hoş geldiniz", subheading: "", ctaText: "Alışverişe Başla", ctaUrl: "/products" }, settings: {} },
    },
    { key: "hero-slider", label: "Hero Slider", category: "hero", settingsSchema: [field("height", "text", "Yükseklik", { defaultValue: "500px" }), field("autoPlay", "checkbox", "Otomatik oynat", { defaultValue: true })], defaults: { type: "slider", content: { slides: [{ heading: "Slide 1", ctaText: "Keşfet", ctaUrl: "/products" }] }, settings: {} } },
    { key: "hero-split", label: "Hero Split", category: "hero", settingsSchema: [field("heading", "text", "Başlık"), field("backgroundUrl", "image_picker", "Görsel")], defaults: { type: "hero", content: { heading: "Split Hero", sectionVariant: "split" }, settings: {} } },
    { key: "hero-video", label: "Hero Video", category: "hero", settingsSchema: [field("videoUrl", "video_url", "Video URL"), field("heading", "text", "Başlık")], defaults: { type: "video", content: { url: "", heading: "Video Hero" }, settings: {} } },
    { key: "announcement-bar", label: "Duyuru Çubuğu", category: "marketing", settingsSchema: [field("text", "text", "Metin"), field("backgroundColor", "color", "Arka plan", { defaultValue: "#0f172a" })], defaults: { type: "html", content: { announcement: true, text: "Ücretsiz kargo!" }, settings: {} } },
    { key: "marquee", label: "Marquee", category: "marketing", settingsSchema: [field("text", "text", "Metin"), field("speed", "number", "Hız", { defaultValue: 200 })], defaults: { type: "html", content: { marquee: true, text: "Yeni koleksiyon" }, settings: {} } },
    { key: "product-grid", label: "Ürün Izgarası", category: "commerce", settingsSchema: [field("heading", "text", "Başlık"), field("columns", "number", "Sütun", { defaultValue: 4 }), field("limit", "number", "Limit", { defaultValue: 8 })], defaults: { type: "product-grid", content: { heading: "Öne Çıkan Ürünler", columns: 4, limit: 8 }, settings: {} } },
    { key: "product-slider", label: "Ürün Slider", category: "commerce", settingsSchema: [field("heading", "text", "Başlık"), field("limit", "number", "Limit", { defaultValue: 12 })], defaults: { type: "product-grid", content: { heading: "Çok Satanlar", sectionVariant: "slider", limit: 12 }, settings: {} } },
    { key: "category-grid", label: "Kategori Izgarası", category: "commerce", settingsSchema: [field("heading", "text", "Başlık"), field("columns", "number", "Sütun", { defaultValue: 3 })], defaults: { type: "category-grid", content: { heading: "Kategoriler", columns: 3 }, settings: {} } },
    { key: "category-slider", label: "Kategori Slider", category: "commerce", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "category-grid", content: { heading: "Koleksiyonlar", sectionVariant: "slider" }, settings: {} } },
    { key: "collection-grid", label: "Koleksiyon Izgarası", category: "commerce", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "category-grid", content: { heading: "Koleksiyonlar" }, settings: {} } },
    { key: "story", label: "Hikaye", category: "content", settingsSchema: [field("heading", "text", "Başlık"), field("html", "richtext", "İçerik")], defaults: { type: "text", content: { html: "<h2>Hikayemiz</h2><p>Marka hikayeniz...</p>" }, settings: {} } },
    { key: "about-us", label: "Hakkımızda", category: "content", settingsSchema: [field("heading", "text", "Başlık"), field("html", "richtext", "İçerik")], defaults: { type: "text", content: { html: "<h2>Hakkımızda</h2>" }, settings: {} } },
    { key: "image-with-text", label: "Görsel & Metin", category: "content", settingsSchema: [field("heading", "text", "Başlık"), field("url", "image_picker", "Görsel"), field("html", "richtext", "Metin")], defaults: { type: "image", content: { url: "" }, settings: {} } },
    { key: "image-banner", label: "Görsel Banner", category: "content", settingsSchema: [field("backgroundUrl", "image_picker", "Görsel"), field("heading", "text", "Başlık")], defaults: { type: "banner", content: { heading: "Banner" }, settings: {} } },
    { key: "features", label: "Özellikler", category: "content", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "html", content: { trustBadges: true, items: [{ icon: "✓", title: "Hızlı Kargo" }] }, settings: {} } },
    { key: "benefits", label: "Avantajlar", category: "content", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "html", content: { trustBadges: true, items: [] }, settings: {} } },
    { key: "statistics", label: "İstatistikler", category: "content", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "text", content: { statistics: true, items: [{ value: "10K+", label: "Müşteri" }] }, settings: {} } },
    { key: "logo-cloud", label: "Marka Logoları", category: "content", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "html", content: { brandLogos: true, logos: [] }, settings: {} } },
    { key: "testimonials", label: "Müşteri Yorumları", category: "social", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "testimonials", content: { heading: "Yorumlar", items: [] }, settings: {} } },
    { key: "reviews", label: "Değerlendirmeler", category: "social", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "testimonials", content: { heading: "Değerlendirmeler" }, settings: {} } },
    { key: "instagram-feed", label: "Instagram", category: "social", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "html", content: { instagramFeed: true, heading: "Instagram" }, settings: {} } },
    { key: "newsletter", label: "Bülten", category: "marketing", settingsSchema: [field("heading", "text", "Başlık"), field("buttonText", "text", "Buton", { defaultValue: "Abone Ol" })], defaults: { type: "newsletter", content: { heading: "Bültenimize katılın" }, settings: {} } },
    { key: "contact", label: "İletişim Formu", category: "forms", settingsSchema: [field("heading", "text", "Başlık"), field("submitText", "text", "Gönder", { defaultValue: "Gönder" })], defaults: { type: "contact", content: { heading: "Bize Ulaşın" }, settings: {} } },
    { key: "faq", label: "SSS", category: "content", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "text", content: { faq: true, items: [{ q: "Soru?", a: "Cevap." }] }, settings: {} } },
    { key: "blog-grid", label: "Blog Izgarası", category: "blog", settingsSchema: [field("heading", "text", "Başlık"), field("limit", "number", "Limit", { defaultValue: 6 })], defaults: { type: "text", content: { html: "<h2>Blog</h2>" }, settings: {} } },
    { key: "countdown", label: "Geri Sayım", category: "marketing", settingsSchema: [field("heading", "text", "Başlık"), field("endDate", "text", "Bitiş tarihi")], defaults: { type: "countdown", content: { heading: "Kampanya bitiyor" }, settings: {} } },
    { key: "campaign", label: "Kampanya", category: "marketing", settingsSchema: [field("heading", "text", "Başlık"), field("discount", "text", "İndirim", { defaultValue: "%50" })], defaults: { type: "campaign", content: { heading: "Kampanya" }, settings: {} } },
    { key: "html", label: "Özel HTML", category: "advanced", settingsSchema: [field("html", "html", "HTML")], defaults: { type: "html", content: { html: "<p>Özel içerik</p>" }, settings: {} } },
    { key: "spacer", label: "Boşluk", category: "layout", settingsSchema: [field("height", "text", "Yükseklik", { defaultValue: "60px" })], defaults: { type: "spacer", content: { height: "60px" }, settings: {} } },
    { key: "divider", label: "Ayırıcı", category: "layout", settingsSchema: [field("color", "color", "Renk", { defaultValue: "#e2e8f0" })], defaults: { type: "divider", content: { color: "#e2e8f0" }, settings: {} } },
    { key: "product-gallery", label: "Ürün Galeri", category: "product", settingsSchema: [], defaults: { type: "product-gallery", content: {}, settings: {} } },
    { key: "product-price", label: "Ürün Fiyat", category: "product", settingsSchema: [], defaults: { type: "product-price", content: {}, settings: {} } },
    { key: "add-to-cart", label: "Sepete Ekle", category: "product", settingsSchema: [field("buttonText", "text", "Buton", { defaultValue: "Sepete Ekle" })], defaults: { type: "add-to-cart", content: { buttonText: "Sepete Ekle" }, settings: {} } },
    { key: "related-products", label: "Benzer Ürünler", category: "product", settingsSchema: [field("heading", "text", "Başlık", { defaultValue: "Benzer Ürünler" })], defaults: { type: "related-products", content: { heading: "Benzer Ürünler" }, settings: {} } },
    /* Shopify Dawn — birebir section tipleri */
    { key: "dawn-image-banner", label: "Dawn Image Banner", category: "dawn", settingsSchema: [field("heading", "text", "Başlık"), field("imageUrl", "image_picker", "Görsel"), field("buttonLabel", "text", "Buton")], defaults: { type: "dawn-image-banner", content: { heading: "Image banner", buttonLabel: "Shop all", imageHeight: "large", colorScheme: "scheme-3" }, settings: {} } },
    { key: "dawn-rich-text", label: "Dawn Rich Text", category: "dawn", settingsSchema: [field("heading", "text", "Başlık"), field("text", "richtext", "Metin")], defaults: { type: "dawn-rich-text", content: { heading: "Talk about your brand" }, settings: {} } },
    { key: "dawn-featured-collection", label: "Dawn Featured Collection", category: "dawn", settingsSchema: [field("title", "text", "Başlık"), field("productsToShow", "number", "Ürün sayısı", { defaultValue: 8 })], defaults: { type: "dawn-featured-collection", content: { title: "Featured products", productsToShow: 8, columnsDesktop: 4 }, settings: {} } },
    { key: "dawn-collage", label: "Dawn Collage", category: "dawn", settingsSchema: [field("heading", "text", "Başlık")], defaults: { type: "dawn-collage", content: { heading: "Multimedia collage", desktopLayout: "left" }, settings: {} } },
    { key: "dawn-video", label: "Dawn Video", category: "dawn", settingsSchema: [field("videoUrl", "video_url", "Video URL")], defaults: { type: "dawn-video", content: { videoUrl: "https://www.youtube.com/watch?v=_9VUPq3SxOc" }, settings: {} } },
    { key: "dawn-multicolumn", label: "Dawn Multicolumn", category: "dawn", settingsSchema: [field("title", "text", "Başlık")], defaults: { type: "dawn-multicolumn", content: { columns: [] }, settings: {} } },
];

module.exports = { SECTION_REGISTRY };
