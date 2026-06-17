"use strict";

/**
 * Theme Pack v1 — 15 profesyonel e-ticaret teması (farklı layout sıraları).
 * Her pack: theme.json eşdeğeri JS objesi.
 */

function layoutSection(id, type, order, content = {}, settings = { hidden: false }) {
    return { id, type, order, content, settings, version: 1 };
}

const STRUCTURE_GROUPS = [
    { id: "header", label: "Header", virtual: true },
    { id: "hero", label: "Hero" },
    { id: "products", label: "Products" },
    { id: "collections", label: "Collections" },
    { id: "campaigns", label: "Campaigns" },
    { id: "categories", label: "Categories" },
    { id: "brands", label: "Brands" },
    { id: "blog", label: "Blog" },
    { id: "footer", label: "Footer", virtual: true },
];

const DEFAULT_TEMPLATES = [
    { templateType: "index", name: "Anasayfa", defaultLayout: [] },
    { templateType: "collection", name: "Kategori", defaultLayout: [{ id: "cat-products", blockType: "product-grid", order: 0, content: { heading: "Kategori Ürünleri", columns: 4, limit: 12 } }] },
    { templateType: "product", name: "Ürün Detay", defaultLayout: [] },
    { templateType: "cart", name: "Sepet", defaultLayout: [{ id: "cart-text", blockType: "text", order: 0, content: { html: "<h2>Sepet</h2>" } }] },
    { templateType: "checkout", name: "Checkout", defaultLayout: [] },
    { templateType: "blog", name: "Blog", defaultLayout: [{ id: "blog-list", blockType: "text", order: 0, content: { html: "<h2>Blog</h2>", blogList: true } }] },
    { templateType: "article", name: "Blog Detay", defaultLayout: [] },
    { templateType: "account", name: "Hesabım", defaultLayout: [] },
    { templateType: "search", name: "Arama", defaultLayout: [] },
    { templateType: "404", name: "404", defaultLayout: [{ id: "404", blockType: "text", order: 0, content: { html: "<h2>Sayfa bulunamadı</h2>" } }] },
    { templateType: "custom", name: "Giriş", defaultLayout: [{ id: "login", blockType: "html", order: 0, content: { loginForm: true } }] },
];

function marquee(text = "MAĞAZA") {
    return layoutSection("marquee", "html", 0, { marquee: true, text, textColor: "#fff", backgroundColor: "#000", gap: 100, fontSize: 28, speed: 200 });
}

function slider(heading, sub, cta = "ALIŞVERİŞE BAŞLA!") {
    return layoutSection("slider-main", "slider", 1, {
        slides: [{ heading, text: sub, ctaText: cta, ctaUrl: "/products", backgroundColor: "#f4f4f5", textColor: "#18181b" }],
        height: "480px",
        showDots: true,
        showArrows: true,
    });
}

function products(heading = "Öne Çıkan Ürünler", order = 2) {
    return layoutSection("products", "product-grid", order, { heading, columns: 4, limit: 8, filter: "featured", showPrice: true, showAddToCart: true });
}

function categories(order = 3) {
    return layoutSection("categories", "category-grid", order, { heading: "Kategoriler", columns: 4 });
}

function newsletter(order = 4) {
    return layoutSection("newsletter", "newsletter", order, { heading: "Bültene katılın", buttonText: "Abone Ol", backgroundColor: "#18181b", textColor: "#fff" });
}

function brands(order = 5) {
    return layoutSection("brands", "html", order, { brandLogos: true, heading: "Markalar", logos: [{ name: "Marka A" }, { name: "Marka B" }, { name: "Marka C" }] });
}

function campaign(order = 3) {
    return layoutSection("campaign", "campaign", order, { heading: "Kampanya", discount: "%15", ctaText: "Keşfet", backgroundColor: "#7c3aed", textColor: "#fff" });
}

function heroClassic(order = 1) {
    return layoutSection("hero", "hero", order, { heading: "Mağazanıza Hoş Geldiniz", subheading: "En iyi ürünler", ctaText: "Alışverişe Başla", ctaUrl: "/products", minHeight: "500px" });
}

function testimonials(order = 6) {
    return layoutSection("reviews", "testimonials", order, { heading: "Müşteri Yorumları", columns: 3 });
}

function bannerPromo(order = 2) {
    return layoutSection("banner", "banner", order, { heading: "Sezon İndirimi", text: "%30'a varan", ctaText: "İncele", backgroundColor: "#1e293b", textColor: "#fff", minHeight: "280px" });
}

const PACK_DEFINITIONS = [
    {
        slug: "modern-store",
        name: "Modern Store",
        description: "Temiz, modern ve dönüşüm odaklı genel e-ticaret vitrini.",
        category: "minimal",
        isPremium: false,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 1,
        tags: ["modern", "clean", "conversion"],
        variables: { primaryColor: "#0f172a", secondaryColor: "#3b82f6", accentColor: "#10b981", backgroundColor: "#ffffff", fontFamily: "Inter, sans-serif", borderRadius: "8px", containerWidth: "1280px", announcement: { enabled: true, text: "Ücretsiz kargo — 1500 TL üzeri", textColor: "#fff", backgroundColor: "#0f172a" } },
        defaultHomeLayout: [marquee("MODERN"), slider("Yeni Koleksiyon", "Stoktan hızlı teslimat"), products(), categories(), newsletter(), brands()],
        layoutVariant: "marquee-slider-products",
    },
    {
        slug: "fashion-pro",
        name: "Fashion Pro",
        description: "Moda ve giyim için editoryal, görsel odaklı düzen.",
        category: "fashion",
        isPremium: false,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 2,
        tags: ["fashion", "editorial"],
        variables: { primaryColor: "#111827", secondaryColor: "#dc2626", fontFamily: "'Playfair Display', serif", headingFont: "'Playfair Display', serif", borderRadius: "0px", buttonStyle: "square", announcement: { enabled: true, text: "YENİ SEZON", textColor: "#fff", backgroundColor: "#111827" } },
        defaultHomeLayout: [heroClassic(0), bannerPromo(1), products("Öne Çıkan Parçalar", 2), categories(3), brands(4), newsletter(5)],
        layoutVariant: "hero-banner-products",
    },
    {
        slug: "luxury-brand",
        name: "Luxury Brand",
        description: "Lüks perakende için zarif tipografi ve geniş boşluklar.",
        category: "luxury",
        isPremium: true,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 3,
        tags: ["luxury", "premium"],
        variables: { primaryColor: "#b8860b", secondaryColor: "#1a1a1a", backgroundColor: "#fdfcf7", fontFamily: "'Cormorant Garamond', serif", borderRadius: "0px", announcement: { enabled: true, text: "Özel koleksiyon", textColor: "#fdfcf7", backgroundColor: "#1a1a1a" } },
        defaultHomeLayout: [layoutSection("hero-lux", "hero", 0, { heading: "Zarafetin özü", ctaText: "Koleksiyon", minHeight: "560px", textAlign: "center" }), products("Seçilmiş ürünler", 1), layoutSection("divider1", "divider", 2), testimonials(3), newsletter(4)],
        layoutVariant: "luxury-minimal",
    },
    {
        slug: "electronics-plus",
        name: "Electronics Plus",
        description: "Teknoloji mağazaları için koyu tema ve ürün vitrini.",
        category: "electronics",
        isPremium: true,
        isFeatured: true,
        version: "1.1.0",
        sortOrder: 4,
        tags: ["tech", "dark"],
        variables: { primaryColor: "#06b6d4", secondaryColor: "#0ea5e9", backgroundColor: "#0f172a", surfaceColor: "#1e293b", textPrimary: "#f1f5f9", fontFamily: "Inter, sans-serif", announcement: { enabled: true, text: "Stoktan gönderim", textColor: "#f1f5f9", backgroundColor: "#020617" } },
        defaultHomeLayout: [marquee("TECH+"), slider("Ultra Hızlı Cihazlar", "Garantili ürünler"), products("Çok Satanlar", 2), campaign(3), categories(4), brands(5)],
        layoutVariant: "tech-dark",
    },
    {
        slug: "marketplace",
        name: "Marketplace",
        description: "Çok kategorili pazar yeri — yoğun ürün ve kampanya alanları.",
        category: "home-living",
        isPremium: true,
        isFeatured: false,
        version: "1.2.0",
        sortOrder: 5,
        tags: ["marketplace", "multi", "legacy"],
        variables: { primaryColor: "#2563eb", secondaryColor: "#8b5cf6", fontFamily: "Inter, sans-serif", announcement: { enabled: true, text: "Binlerce ürün tek çatı altında", textColor: "#fff", backgroundColor: "#2563eb" } },
        defaultHomeLayout: [slider("Her şey bir arada", "Kategorilere göz atın"), categories(1), products("Popüler ürünler", 2), products("Yeni eklenenler", 3), campaign(4), newsletter(5), brands(6)],
        layoutVariant: "marketplace-dense",
    },
    {
        slug: "furniture-store",
        name: "Furniture Store",
        description: "Mobilya ve ev dekorasyonu için sakin, geniş layout.",
        category: "furniture",
        isPremium: false,
        isFeatured: false,
        version: "1.0.0",
        sortOrder: 6,
        tags: ["furniture", "home"],
        variables: { primaryColor: "#78716c", secondaryColor: "#ca8a04", fontFamily: "'Merriweather', serif", borderRadius: "8px", announcement: { enabled: true, text: "Ücretsiz montaj — seçili ürünler", textColor: "#fff", backgroundColor: "#57534e" } },
        defaultHomeLayout: [heroClassic(0), categories(1), bannerPromo(2), products("Oda koleksiyonları", 3), testimonials(4), newsletter(5)],
        layoutVariant: "furniture-warm",
    },
    {
        slug: "home-decor",
        name: "Home Decor",
        description: "Ev aksesuarları ve dekor için yumuşak renkler.",
        category: "home-living",
        isPremium: false,
        isFeatured: false,
        version: "1.0.0",
        sortOrder: 7,
        tags: ["decor", "lifestyle"],
        variables: { primaryColor: "#a16207", secondaryColor: "#fef3c7", backgroundColor: "#fffbeb", fontFamily: "Inter, sans-serif", announcement: { enabled: true, text: "Evine stil kat", textColor: "#fff", backgroundColor: "#a16207" } },
        defaultHomeLayout: [marquee("DECOR"), layoutSection("hero-decor", "banner", 1, { heading: "Yeni sezon dekor", minHeight: "360px" }), categories(2), products(3), brands(4), newsletter(5)],
        layoutVariant: "decor-soft",
    },
    {
        slug: "pet-store",
        name: "Pet Store",
        description: "Pet shop için neşeli, güven veren vitrin.",
        category: "pets",
        isPremium: false,
        isFeatured: false,
        version: "1.0.0",
        sortOrder: 8,
        tags: ["pets", "friendly"],
        variables: { primaryColor: "#059669", secondaryColor: "#fbbf24", fontFamily: "'Nunito', sans-serif", announcement: { enabled: true, text: "Patili dostlar için %10 indirim", textColor: "#fff", backgroundColor: "#059669" } },
        defaultHomeLayout: [slider("Patili Dostlar İçin", "Mama, oyuncak, bakım"), categories(1), products("Popüler ürünler", 2), campaign(3), testimonials(4), newsletter(5)],
        layoutVariant: "pet-friendly",
    },
    {
        slug: "sports-store",
        name: "Sports Store",
        description: "Spor ve outdoor için enerjik, dinamik düzen.",
        category: "sports",
        isPremium: false,
        isFeatured: false,
        version: "1.0.0",
        sortOrder: 9,
        tags: ["sports", "active"],
        variables: { primaryColor: "#16a34a", secondaryColor: "#0f172a", accentColor: "#eab308", fontFamily: "'Montserrat', sans-serif", announcement: { enabled: true, text: "Performans seninle", textColor: "#fff", backgroundColor: "#16a34a" } },
        defaultHomeLayout: [marquee("SPORT"), campaign(1), slider("Yeni sezon", "Stoktan gönderim"), products(2), categories(3), newsletter(4)],
        layoutVariant: "sports-bold",
    },
    {
        slug: "book-store",
        name: "Book Store",
        description: "Kitap ve kırtasiye için sade, okunabilir grid.",
        category: "books",
        isPremium: false,
        isFeatured: false,
        version: "1.0.0",
        sortOrder: 10,
        tags: ["books", "media"],
        variables: { primaryColor: "#1e3a5f", secondaryColor: "#94a3b8", backgroundColor: "#f8fafc", fontFamily: "'Merriweather', serif", announcement: { enabled: true, text: "Yeni çıkanlar — ücretsiz kargo", textColor: "#fff", backgroundColor: "#1e3a5f" } },
        defaultHomeLayout: [heroClassic(0), products("Çok satan kitaplar", 1), categories(2), layoutSection("blog-teaser", "text", 3, { html: "<h2>Editör seçimi</h2>", blogList: true }), newsletter(4)],
        layoutVariant: "books-editorial",
    },
    {
        slug: "baby-store",
        name: "Baby Store",
        description: "Bebek ve anne ürünleri için pastel, güvenli his.",
        category: "kids",
        isPremium: false,
        isFeatured: false,
        version: "1.0.0",
        sortOrder: 11,
        tags: ["baby", "kids"],
        variables: { primaryColor: "#ec4899", secondaryColor: "#fce7f3", backgroundColor: "#fff5f7", fontFamily: "Inter, sans-serif", announcement: { enabled: true, text: "Anne ve bebek için özel fırsatlar", textColor: "#fff", backgroundColor: "#ec4899" } },
        defaultHomeLayout: [slider("Minikler İçin En İyisi", "Güvenilir markalar"), categories(1), products(2), testimonials(3), newsletter(4), brands(5)],
        layoutVariant: "baby-pastel",
    },
    {
        slug: "jewelry-store",
        name: "Jewelry Store",
        description: "Takı ve aksesuar için premium vitrin.",
        category: "jewelry",
        isPremium: true,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 12,
        tags: ["jewelry", "accessories"],
        variables: { primaryColor: "#d4af37", secondaryColor: "#1a1a1a", backgroundColor: "#fdfcf7", fontFamily: "'Cormorant Garamond', serif", announcement: { enabled: true, text: "Özel tasarım koleksiyon", textColor: "#1a1a1a", backgroundColor: "#d4af37" } },
        defaultHomeLayout: [layoutSection("hero-j", "hero", 0, { heading: "Işıltını yansıt", minHeight: "520px" }), products("Özel seçim", 1), bannerPromo(2), brands(3), newsletter(4)],
        layoutVariant: "jewelry-gold",
    },
    {
        slug: "cosmetics-store",
        name: "Cosmetics Store",
        description: "Kozmetik için yumuşak tonlar ve kampanya alanları.",
        category: "cosmetics",
        isPremium: false,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 13,
        tags: ["beauty", "cosmetics"],
        variables: { primaryColor: "#db2777", secondaryColor: "#fce7f3", backgroundColor: "#fffbfb", fontFamily: "'Cormorant Garamond', serif", borderRadius: "12px", announcement: { enabled: true, text: "Cilt bakımında %20", textColor: "#fff", backgroundColor: "#db2777" } },
        defaultHomeLayout: [marquee("BEAUTY"), bannerPromo(1), products("Çok satanlar", 2), campaign(3), categories(4), newsletter(5)],
        layoutVariant: "beauty-soft",
    },
    {
        slug: "technology-store",
        name: "Technology Store",
        description: "3D yazıcı ve teknoloji — İkas tarzı tam vitrin (referans layout).",
        category: "technology",
        isPremium: false,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 14,
        tags: ["technology", "3d", "reference"],
        thumbnailUrl: "/assets/wb-themes/electronics-pro/thumb.jpg",
        previewUrl: "/assets/wb-themes/electronics-pro/preview-desktop.jpg",
        variables: { primaryColor: "#18181b", secondaryColor: "#7c3aed", accentColor: "#16a34a", fontFamily: "Inter, sans-serif", announcement: { enabled: true, text: "2500 TL ÜZERİ ÜCRETSİZ KARGO", textColor: "#fff", backgroundColor: "#000" } },
        defaultHomeLayout: [marquee("TECH"), slider("ULTRA HIZLI 3D YAZICILAR", "Stoktan gönderim"), products(), campaign(3), categories(4), newsletter(5), brands(6), testimonials(7)],
        layoutVariant: "tech-reference",
    },
    {
        slug: "minimal-shop",
        name: "Minimal Shop",
        description: "Minimal, hızlı ve sade e-ticaret deneyimi.",
        category: "minimal",
        isPremium: false,
        isFeatured: true,
        version: "1.0.0",
        sortOrder: 15,
        tags: ["minimal", "fast"],
        variables: { primaryColor: "#0f172a", secondaryColor: "#64748b", accentColor: "#3b82f6", fontFamily: "Inter, sans-serif", borderRadius: "6px", containerWidth: "1120px", announcement: { enabled: false } },
        defaultHomeLayout: [heroClassic(0), products("Seçilmiş ürünler", 1), layoutSection("sp1", "spacer", 2, { height: "40px" }), newsletter(3)],
        layoutVariant: "minimal-sparse",
    },
];

// Legacy slug aliases (mevcut siteler)
const LEGACY_ALIASES = [
    { slug: "eticaret-magaza", cloneFrom: "technology-store" },
    { slug: "fashion-modern", cloneFrom: "fashion-pro" },
    { slug: "electronics-pro", cloneFrom: "electronics-plus" },
    { slug: "beauty-store", cloneFrom: "cosmetics-store" },
    { slug: "furniture-studio", cloneFrom: "furniture-store" },
    { slug: "sports-shop", cloneFrom: "sports-store" },
    { slug: "luxury-boutique", cloneFrom: "luxury-brand" },
    { slug: "marketplace-plus", cloneFrom: "marketplace" },
    { slug: "minimal-commerce", cloneFrom: "minimal-shop" },
    { slug: "aurora", cloneFrom: "modern-store", isLegacy: true },
    { slug: "ember", cloneFrom: "fashion-pro", isLegacy: true },
];

function enrichPack(pack) {
    const slug = pack.slug || "";
    return {
        ...pack,
        thumbnailUrl: pack.thumbnailUrl || `/api/website-builder/theme-assets/${slug}/thumbnail.jpg`,
        previewUrl: pack.previewUrl || `/api/website-builder/theme-assets/${slug}/preview.jpg`,
        screenshotMobile: pack.screenshotMobile || `/api/website-builder/theme-assets/${slug}/preview-mobile.jpg`,
        supportedFeatures: pack.supportedFeatures || { megaMenu: true, stickyHeader: true, darkMode: false, animations: true, lazyLoading: true },
        structureGroups: STRUCTURE_GROUPS,
        templates: pack.templates || DEFAULT_TEMPLATES,
        defaultHeaderConfig: pack.defaultHeaderConfig || {},
        defaultFooterConfig: pack.defaultFooterConfig || {},
    };
}

function buildCatalog() {
    const primary = PACK_DEFINITIONS.map(enrichPack);
    const legacy = LEGACY_ALIASES.map((alias) => {
        const source = primary.find((p) => p.slug === alias.cloneFrom);
        if (!source) return null;
        return enrichPack({
            ...source,
            slug: alias.slug,
            name: source.name + (alias.isLegacy ? " (Klasik)" : ""),
            isFeatured: false,
            sortOrder: 90 + LEGACY_ALIASES.indexOf(alias),
            tags: [...(source.tags || []), "legacy"],
        });
    }).filter(Boolean);
    return [...primary, ...legacy];
}

module.exports = {
    PACK_DEFINITIONS,
    STRUCTURE_GROUPS,
    DEFAULT_TEMPLATES,
    buildCatalog,
    enrichPack,
};
