"use strict";

/**
 * Lysia v3 — yalnızca açık kaynak e-ticaret temaları
 * Bookly · FreshCart · QuickCart · Dawn
 */
const { randomUUID } = require("crypto");
const sectionRegistry = require("../services/sectionRegistryService");

const BOOKLY_IMG = "https://raw.githubusercontent.com/themewagon/Bookly/main/images";
const FRESHCART_IMG = "https://raw.githubusercontent.com/codescandy/freshcart-tailwind-ecommerce-HTML-template/main/src/assets/images";
const QUICKCART_IMG = "https://raw.githubusercontent.com/GreatStackDev/QuickCart/main/assets";

const DAWN_IMG = {
    hero: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=2000&q=85",
    collage1: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=85",
    collageProduct: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=85",
    collage2: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=85",
    col1: "https://images.unsplash.com/photo-1555529669-e93e7cd0df24?w=800&q=85",
    col2: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=85",
    col3: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=85",
    videoCover: "https://images.unsplash.com/photo-1611162617474-5b21e939e966?w=1200&q=85",
};

const OS_THEME_SLUGS = ["bookly", "freshcart", "quickcart", "dawn"];

const OPENSOURCE_THEME_CATALOG = [
    {
        slug: "bookly",
        name: "Bookly",
        category: "books",
        isFeatured: true,
        sortOrder: 1,
        author: "ThemeWagon / TemplatesJungle",
        license: "MIT",
        sourceRepo: "https://github.com/themewagon/Bookly",
        description: "Kitapçı e-ticaret şablonu — hero slider, kategoriler, çok satanlar, yorumlar ve blog. ThemeWagon Bookly paketi.",
        previewUrl: `${BOOKLY_IMG}/banner-image-bg-1.jpg`,
        thumbnailUrl: `${BOOKLY_IMG}/banner-image-bg-1.jpg`,
    },
    {
        slug: "freshcart",
        name: "FreshCart",
        category: "food",
        isFeatured: true,
        sortOrder: 2,
        author: "Codescandy",
        license: "MIT",
        sourceRepo: "https://github.com/codescandy/freshcart-tailwind-ecommerce-HTML-template",
        description: "Süpermarket / taze gıda teması — kategori ızgarası, popüler ürünler, kampanya bannerları. FreshCart Tailwind paketi.",
        previewUrl: `${FRESHCART_IMG}/slider/slider-image-1.jpg`,
        thumbnailUrl: `${FRESHCART_IMG}/slider/slider-image-1.jpg`,
    },
    {
        slug: "quickcart",
        name: "QuickCart",
        category: "electronics",
        isFeatured: false,
        sortOrder: 3,
        author: "GreatStackDev",
        license: "MIT",
        sourceRepo: "https://github.com/GreatStackDev/QuickCart",
        description: "Minimal modern elektronik mağazası — Next.js + Tailwind referans düzeni. QuickCart açık kaynak paketi.",
        previewUrl: `${QUICKCART_IMG}/header_macbook_image.png`,
        thumbnailUrl: `${QUICKCART_IMG}/header_macbook_image.png`,
    },
    {
        slug: "dawn",
        name: "Dawn",
        category: "minimal",
        isFeatured: false,
        sortOrder: 4,
        author: "Shopify",
        license: "Shopify License",
        sourceRepo: "https://github.com/Shopify/dawn",
        description: "Shopify Dawn — birebir port. index.json: Image banner, Rich text, Featured collection, Collage, Video, Multicolumn. Assistant font, sıfır border-radius, orijinal Dawn düzeni.",
        previewUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
    },
];

const THEME_PRESETS = {
    bookly: {
        globalStyles: {
            primaryColor: "#c45a3c",
            secondaryColor: "#2c2c2c",
            accentColor: "#f4a261",
            backgroundColor: "#ffffff",
            textPrimary: "#1a1a1a",
            fontFamily: "Nunito, sans-serif",
            headingFont: "Nunito, sans-serif",
            borderRadius: "4px",
        },
        header: { sticky: true, brandName: "BOOKLY" },
        checkout: { primaryColor: "#c45a3c" },
    },
    freshcart: {
        globalStyles: {
            primaryColor: "#0aad0a",
            secondaryColor: "#1a1a1a",
            accentColor: "#ffc107",
            backgroundColor: "#ffffff",
            textPrimary: "#21313c",
            fontFamily: "Inter, sans-serif",
            headingFont: "Inter, sans-serif",
            borderRadius: "8px",
        },
        header: { sticky: true, brandName: "FreshCart" },
        checkout: { primaryColor: "#0aad0a" },
    },
    quickcart: {
        globalStyles: {
            primaryColor: "#f97316",
            secondaryColor: "#111827",
            accentColor: "#fb923c",
            backgroundColor: "#ffffff",
            textPrimary: "#111827",
            fontFamily: "Inter, sans-serif",
            headingFont: "Inter, sans-serif",
            borderRadius: "12px",
        },
        header: { sticky: true, brandName: "QuickCart" },
        checkout: { primaryColor: "#f97316" },
    },
    dawn: {
        globalStyles: {
            themePack: "dawn",
            primaryColor: "#121212",
            secondaryColor: "#334155",
            accentColor: "#008060",
            backgroundColor: "#ffffff",
            textPrimary: "#121212",
            fontFamily: "Assistant, sans-serif",
            headingFont: "Assistant, sans-serif",
            borderRadius: "0px",
        },
        header: { sticky: true, transparent: false, brandName: "DAWN", logoPosition: "middle-left" },
        checkout: { primaryColor: "#121212" },
    },
};

function sec(key, order, contentPatch = {}) {
    const base = sectionRegistry.createSectionFromRegistry(key);
    if (!base) return null;
    base.order = order;
    base.content = { ...base.content, ...contentPatch };
    return base;
}

function booklyHome(name) {
    return [
        sec("announcement-bar", 0, { announcement: true, text: "Summer sale discount off 60% off! Shop Now", backgroundColor: "#2c2c2c" }),
        sec("hero-slider", 1, {
            height: "520px",
            slides: [
                { heading: "The Fine Print Book Collection", subheading: "Best Offer Save 30%. Grab it now!", ctaText: "Shop Collection", ctaUrl: "/products", backgroundUrl: `${BOOKLY_IMG}/banner-image-bg-1.jpg` },
                { heading: "How Innovation works", subheading: "Discount available. Grab it now!", ctaText: "Shop Product", ctaUrl: "/products", backgroundUrl: `${BOOKLY_IMG}/banner-image-bg-2.jpg` },
                { heading: "Your Heart is the Sea", subheading: "Limited stocks available. Grab it now!", ctaText: "Shop Collection", ctaUrl: "/products", backgroundUrl: `${BOOKLY_IMG}/banner-image-bg.jpg` },
            ],
        }),
        sec("features", 2, {
            trustBadges: true,
            heading: "Why Bookly",
            items: [
                { icon: "🚚", title: "Free delivery", text: "2-3 business days delivery & free returns" },
                { icon: "✓", title: "Quality guarantee", text: "Curated books from trusted publishers" },
                { icon: "🏷", title: "Daily offers", text: "Summer sale discount off 60% off" },
                { icon: "🔒", title: "100% secure payment", text: "Visa, Mastercard, PayPal accepted" },
            ],
        }),
        sec("product-grid", 3, { heading: "Best selling items", columns: 4, limit: 8 }),
        sec("countdown", 4, { heading: "30% Discount on all items. Hurry Up !!!", endDate: "2026-12-31" }),
        sec("category-grid", 5, { heading: "Browse Categories", columns: 4 }),
        sec("testimonials", 6, {
            heading: "Customers reviews",
            items: [
                { name: "Emma Chamberlin", text: "The cozy atmosphere, friendly staff, and wide selection of books make every visit a delight!", rating: 5 },
                { name: "Thomas John", text: "They always have the latest titles, and their recommendations introduced me to incredible reads!", rating: 5 },
                { name: "Kevin Bryan", text: "Quick delivery and careful packaging. I'll definitely be shopping here again!", rating: 5 },
            ],
        }),
        sec("newsletter", 7, { heading: "Reading for Mental Health", buttonText: "Subscribe" }),
    ].filter(Boolean);
}

function freshcartHome(name) {
    return [
        sec("announcement-bar", 0, { announcement: true, text: "Opening Sale Discount 50% — Free Shipping orders over $100", backgroundColor: "#0aad0a" }),
        sec("hero-slider", 1, {
            height: "480px",
            slides: [
                { heading: "SuperMarket For Fresh Grocery", subheading: "Introduced a new model for online grocery shopping and convenient home delivery.", ctaText: "Shop Now", ctaUrl: "/products", backgroundUrl: `${FRESHCART_IMG}/slider/slider-image-1.jpg` },
                { heading: "Free Shipping", subheading: "Free Shipping on orders over $100", ctaText: "Shop Now", ctaUrl: "/products", backgroundUrl: `${FRESHCART_IMG}/slider/slider-2.jpg` },
            ],
        }),
        sec("category-grid", 2, { heading: "Featured Categories", columns: 4 }),
        sec("product-grid", 3, { heading: "Popular Products", columns: 4, limit: 8 }),
        sec("campaign", 4, { heading: "Frutis & Vegetables — Get Upto 30% Off", discount: "%30" }),
        sec("image-banner", 5, { heading: "Freshly Baked Buns — Get Upto 25% Off", backgroundUrl: `${FRESHCART_IMG}/slider/slide-1.jpg` }),
        sec("features", 6, {
            trustBadges: true,
            heading: "Why FreshCart",
            items: [
                { icon: "⏱", title: "10 minute grocery", text: "Get your order delivered from pickup stores near you." },
                { icon: "💰", title: "Best Prices & Offers", text: "Cheaper prices than your local supermarket." },
                { icon: "🛒", title: "Wide Assortment", text: "Choose from 5000+ products across categories." },
                { icon: "↩", title: "Easy Returns", text: "No questions asked refund policy." },
            ],
        }),
        sec("newsletter", 7, { heading: "Daily Best Sells — Get the best deal before close.", buttonText: "Shop Now" }),
    ].filter(Boolean);
}

function quickcartHome(name) {
    const hero = `${QUICKCART_IMG}/boy_with_laptop_image.png`;
    return [
        sec("hero", 0, {
            heading: "The Ultimate Tech Destination",
            subheading: "Minimal, modern & responsive layout — headphones, laptops, gaming and more.",
            ctaText: "Shop Now",
            ctaUrl: "/products",
            backgroundUrl: `${QUICKCART_IMG}/header_headphone_image.png`,
            minHeight: "520px",
        }),
        sec("marquee", 1, { marquee: true, text: "FREE SHIPPING · NEW ARRIVALS · GAMING · AUDIO · LAPTOPS · ACCESSORIES" }),
        sec("category-grid", 2, { heading: "Shop by Category", columns: 4 }),
        sec("product-grid", 3, { heading: "Featured Products", columns: 4, limit: 8 }),
        sec("image-with-text", 4, {
            heading: "Premium Audio Collection",
            url: `${QUICKCART_IMG}/bose_headphone_image.png`,
            html: "<p>Discover Sony, Bose, JBL and Apple audio gear with fast delivery.</p>",
        }),
        sec("image-banner", 5, { heading: "Gaming & Consoles", backgroundUrl: `${QUICKCART_IMG}/header_playstation_image.png` }),
        sec("testimonials", 6, {
            heading: "Customer Reviews",
            items: [
                { name: "Alex M.", text: "QuickCart layout is clean and checkout is super smooth.", rating: 5 },
                { name: "Sara K.", text: "Love the product grid and mobile experience.", rating: 5 },
            ],
        }),
        sec("newsletter", 7, { heading: "Get deals on tech — subscribe now.", buttonText: "Subscribe" }),
    ].filter(Boolean);
}

/** Shopify Dawn templates/index.json — birebir sıra ve içerik */
function dawnHome(name) {
    return [
        sec("dawn-image-banner", 0, {
            heading: "Image banner",
            text: "<p>Give customers details about the banner image(s) or content on the template.</p>",
            buttonLabel: "Shop all",
            buttonLink: "/products",
            buttonSecondary: true,
            imageUrl: DAWN_IMG.hero,
            imageHeight: "large",
            imageOverlayOpacity: 40,
            desktopContentPosition: "bottom-center",
            showTextBox: false,
            colorScheme: "scheme-3",
        }),
        sec("dawn-rich-text", 1, {
            heading: "Talk about your brand",
            text: "<p>Share information about your brand with your customers. Describe a product, make announcements, or welcome customers to your store.</p>",
            fullWidth: true,
            paddingTop: 40,
            paddingBottom: 0,
        }),
        sec("dawn-featured-collection", 2, {
            title: "Featured products",
            productsToShow: 8,
            columnsDesktop: 4,
            columnsMobile: 2,
            showSecondaryImage: true,
            imageRatio: "adapt",
            paddingTop: 28,
            paddingBottom: 36,
        }),
        sec("dawn-collage", 3, {
            heading: "Multimedia collage",
            desktopLayout: "left",
            mobileLayout: "collage",
            blocks: [
                { id: "collection-0", type: "collection", title: "Collection", imageUrl: DAWN_IMG.collage1 },
                { id: "product", type: "product", title: "Featured product", imageUrl: DAWN_IMG.collageProduct },
                { id: "collection-1", type: "collection", title: "Collection", imageUrl: DAWN_IMG.collage2 },
            ],
            paddingTop: 36,
            paddingBottom: 36,
        }),
        sec("dawn-video", 4, {
            videoUrl: "https://www.youtube.com/watch?v=_9VUPq3SxOc",
            coverUrl: DAWN_IMG.videoCover,
            fullWidth: false,
            paddingTop: 36,
            paddingBottom: 36,
        }),
        sec("dawn-multicolumn", 5, {
            title: "",
            columnsDesktop: 3,
            imageWidth: "third",
            columnAlignment: "center",
            columns: [
                {
                    id: "column1",
                    title: "Column",
                    text: "<p>Pair text with an image to focus on your chosen product, collection, or blog post. Add details on availability, style, or even provide a review.</p>",
                    imageUrl: DAWN_IMG.col1,
                },
                {
                    id: "column2",
                    title: "Column",
                    text: "<p>Pair text with an image to focus on your chosen product, collection, or blog post. Add details on availability, style, or even provide a review.</p>",
                    imageUrl: DAWN_IMG.col2,
                },
                {
                    id: "column3",
                    title: "Column",
                    text: "<p>Pair text with an image to focus on your chosen product, collection, or blog post. Add details on availability, style, or even provide a review.</p>",
                    imageUrl: DAWN_IMG.col3,
                },
            ],
            paddingTop: 36,
            paddingBottom: 36,
        }),
    ].filter(Boolean);
}

const HOME_BUILDERS = {
    bookly: booklyHome,
    freshcart: freshcartHome,
    quickcart: quickcartHome,
    dawn: dawnHome,
};

function defaultHeader(slug, siteName) {
    const brand = THEME_PRESETS[slug]?.header?.brandName || siteName || "Mağaza";
    const menus = {
        bookly: [
            { label: "Home", url: "/" },
            { label: "Shop", url: "/products" },
            { label: "Blogs", url: "/blog" },
            { label: "Contact", url: "/contact" },
        ],
        freshcart: [
            { label: "Home", url: "/" },
            { label: "Shop", url: "/products" },
            { label: "Categories", url: "/products" },
            { label: "Contact", url: "/contact" },
        ],
        quickcart: [
            { label: "Home", url: "/" },
            { label: "Shop", url: "/products" },
            { label: "About", url: "/about" },
            { label: "Contact", url: "/contact" },
        ],
        dawn: [
            { label: "Home", url: "/" },
            { label: "Catalog", url: "/products" },
            { label: "Contact", url: "/contact" },
        ],
    };
    const items = (menus[slug] || menus.dawn).map((m) => ({
        id: randomUUID(),
        label: m.label,
        url: m.url,
        children: [],
    }));
    return {
        logoUrl: "",
        logoWidth: 140,
        sticky: true,
        transparent: false,
        brandName: brand,
        menuItems: items,
        ...(THEME_PRESETS[slug]?.header || {}),
    };
}

function defaultFooter(slug, siteName) {
    const catalog = OPENSOURCE_THEME_CATALOG.find((t) => t.slug === slug);
    return {
        blocks: [
            { id: randomUUID(), type: "Hakkında", content: { text: `${catalog?.name || siteName} — açık kaynak e-ticaret teması.` } },
            { id: randomUUID(), type: "Kaynak", content: { text: catalog?.sourceRepo || "" } },
            { id: randomUUID(), type: "Bülten", content: { heading: "Kampanyalardan haberdar olun" } },
        ],
        copyright: `© ${new Date().getFullYear()} ${siteName || catalog?.name}. ${catalog?.license || "MIT"} lisanslı tema.`,
    };
}

function buildRichHomeSections(slug, siteName) {
    const builder = HOME_BUILDERS[slug] || HOME_BUILDERS.bookly;
    return builder(siteName);
}

function getThemePreset(slug) {
    return THEME_PRESETS[slug] || THEME_PRESETS.bookly;
}

function getCatalogEntry(slug) {
    return OPENSOURCE_THEME_CATALOG.find((t) => t.slug === slug) || OPENSOURCE_THEME_CATALOG[0];
}

function getThemePreviewImage(slug) {
    return getCatalogEntry(slug).previewUrl;
}

module.exports = {
    OS_THEME_SLUGS,
    OPENSOURCE_THEME_CATALOG,
    THEME_PRESETS,
    buildRichHomeSections,
    defaultHeader,
    defaultFooter,
    getThemePreset,
    getCatalogEntry,
    getThemePreviewImage,
};
