/**
 * Teknik blok adlarını kullanıcı dostu etiketlere çevirir.
 */
const BLOCK_LABELS = {
    hero: { tr: "Ana vitrin", en: "Hero banner" },
    slider: { tr: "Slayt gösterisi", en: "Slideshow" },
    banner: { tr: "Kampanya bandı", en: "Promo banner" },
    campaign: { tr: "Kampanya vitrini", en: "Campaign showcase" },
    product_grid: { tr: "Öne çıkan ürünler", en: "Featured products" },
    "product-grid": { tr: "Öne çıkan ürünler", en: "Featured products" },
    product_list: { tr: "Ürün listesi", en: "Product list" },
    products: { tr: "Ürün listesi", en: "Product list" },
    category_grid: { tr: "Kategoriler", en: "Categories" },
    "category-grid": { tr: "Kategoriler", en: "Categories" },
    collections: { tr: "Koleksiyonlar", en: "Collections" },
    featured_products: { tr: "Öne çıkan ürünler", en: "Featured products" },
    testimonials: { tr: "Müşteri yorumları", en: "Testimonials" },
    newsletter: { tr: "Bülten kaydı", en: "Newsletter signup" },
    rich_text: { tr: "Metin alanı", en: "Text block" },
    text: { tr: "Metin alanı", en: "Text block" },
    html: { tr: "Özel içerik", en: "Custom content" },
    section: { tr: "İçerik bloğu", en: "Content block" },
    image: { tr: "Görsel", en: "Image" },
    image_with_text: { tr: "Görsel + metin", en: "Image with text" },
    video: { tr: "Video", en: "Video" },
    faq: { tr: "Sık sorulan sorular", en: "FAQ" },
    trust_bar: { tr: "Güven şeridi", en: "Trust bar" },
    footer: { tr: "Alt bilgi", en: "Footer" },
    header: { tr: "Üst bilgi", en: "Header" },
    marquee: { tr: "Duyuru bandı", en: "Announcement bar" },
    announcement: { tr: "Duyuru bandı", en: "Announcement bar" },
    contact: { tr: "İletişim formu", en: "Contact form" },
    countdown: { tr: "Geri sayım", en: "Countdown" },
    spacer: { tr: "Boşluk", en: "Spacer" },
    divider: { tr: "Ayırıcı çizgi", en: "Divider" },
};

export function blockUserLabel(type, language = "tr") {
    const raw = String(type || "section").toLowerCase();
    const key = raw.replace(/-/g, "_");
    const entry = BLOCK_LABELS[raw] || BLOCK_LABELS[key];
    if (!entry) return language === "en" ? "Content block" : "İçerik bloğu";
    return language === "en" ? entry.en : entry.tr;
}

export function isMarqueeLikeSection(section) {
    const c = section?.content || {};
    return Boolean(
        c.marquee
        || c.announcement
        || (section?.type === "html" && c.text && !c.html && !c.brandLogos && !c.footerBlock)
    );
}

export function resolveSectionDisplayLabel(section, language = "tr") {
    if (!section) return language === "en" ? "Block" : "Blok";
    if (section.catalogLabel) return section.catalogLabel;

    const c = section.content || {};

    if (c.footerBlock || c.variant === "footer-minimal") {
        return language === "en" ? "Footer" : "Alt bilgi";
    }
    if (isMarqueeLikeSection(section)) {
        const t = c.text || c.heading;
        if (t && String(t).length <= 28) {
            return language === "en" ? `Announcement · ${t}` : `Duyuru bandı · ${t}`;
        }
        return language === "en" ? "Announcement bar" : "Duyuru bandı";
    }
    if (c.brandLogos) {
        return c.heading || (language === "en" ? "Brand logos" : "Marka logoları");
    }
    if (c.loginForm) return language === "en" ? "Login form" : "Giriş formu";
    if (c.instagramFeed) return language === "en" ? "Instagram feed" : "Instagram akışı";
    if (c.blogList) return language === "en" ? "Blog list" : "Blog listesi";
    if (c.orderTracking) return language === "en" ? "Order tracking" : "Sipariş takibi";
    if (c.faq) return language === "en" ? "FAQ" : "Sık sorulan sorular";
    if (c.featuresGrid) return language === "en" ? "Features" : "Özellikler";

    if (section.type === "hero" || section.type === "slider") {
        const h = c.heading || c.slides?.[0]?.heading;
        if (h) return language === "en" ? `Hero · ${h}` : `Ana vitrin · ${h}`;
    }

    if (section.type === "product-grid" || section.type === "products") {
        return c.heading
            ? `${language === "en" ? "Products" : "Ürünler"} · ${c.heading}`
            : blockUserLabel("product-grid", language);
    }

    return blockUserLabel(section.type, language);
}

export function resolveSectionEditorHint(section, language = "tr") {
    if (isMarqueeLikeSection(section)) {
        return language === "en"
            ? "Scrolling announcement text shown at the top of your store."
            : "Mağaza üstünde kayan duyuru metni.";
    }
    if (section?.type === "hero" || section?.type === "slider") {
        return language === "en"
            ? "Main banner with headline, subtitle and button."
            : "Başlık, alt metin ve buton içeren ana vitrin.";
    }
    if (section?.type === "product-grid") {
        return language === "en"
            ? "Product cards pulled from your catalog."
            : "Katalogunuzdan ürün kartları.";
    }
    return language === "en"
        ? "Edit content and design for this block."
        : "Bu bloğun içeriğini ve görünümünü düzenleyin.";
}

export function blockUserHint(type, language = "tr") {
    const label = blockUserLabel(type, language);
    return language === "en"
        ? `Drag to reorder · ${label}`
        : `Sürükleyerek sıralayın · ${label}`;
}

export { BLOCK_LABELS };
