#!/usr/bin/env node
"use strict";
/**
 * Generates premium JSON theme packs under backend/data/themes/
 * Run: node backend/scripts/generate-premium-theme-packs.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../data/themes");

const PACKS = [
    { slug: "luxury-brand", name: "Luxury Brand", category: "luxury", tags: ["luxury", "premium", "editorial"], primary: "#1a1a1a", accent: "#c9a962", font: "Cormorant Garamond, serif", home: ["hero-fashion", "collection-showcase", "fashion-products", "testimonials-premium", "footer-luxury"] },
    { slug: "beauty-store", name: "Beauty Store", category: "beauty", tags: ["beauty", "cosmetics", "skincare"], primary: "#be185d", accent: "#fce7f3", font: "Poppins, sans-serif", home: ["announcement-simple", "hero-split", "featured-products", "trust-badges", "newsletter-premium", "footer-modern"] },
    { slug: "jewelry-store", name: "Jewelry Store", category: "jewelry", tags: ["jewelry", "luxury", "minimal"], primary: "#292524", accent: "#d6d3d1", font: "Playfair Display, serif", home: ["hero-classic", "collection-slider", "fashion-products", "brand-logos", "footer-luxury"] },
    { slug: "sports-store", name: "Sports Store", category: "sports", tags: ["sports", "active", "bold"], primary: "#ea580c", accent: "#0ea5e9", font: "Montserrat, sans-serif", home: ["announcement-campaign", "hero-electronics", "carousel-products", "statistics-block", "newsletter-premium", "footer-marketplace"] },
    { slug: "pet-store", name: "Pet Shop", category: "pet", tags: ["pet", "friendly", "colorful"], primary: "#16a34a", accent: "#fef08a", font: "Nunito, sans-serif", home: ["announcement-marquee", "hero-marketplace", "featured-products", "trust-badges", "instagram-feed", "footer-modern"] },
    { slug: "home-decor", name: "Home Decor", category: "home", tags: ["furniture", "decor", "warm"], primary: "#78716c", accent: "#d6d3d1", font: "Merriweather, serif", home: ["hero-split", "category-showcase", "tabbed-products", "testimonials-premium", "footer-minimal"] },
    { slug: "digital-products", name: "Digital Products", category: "digital", tags: ["digital", "saas", "downloads"], primary: "#6366f1", accent: "#22d3ee", font: "Inter, sans-serif", home: ["hero-video", "statistics-block", "featured-products", "faq-premium", "footer-modern"] },
    { slug: "food-store", name: "Food Store", category: "food", tags: ["food", "organic", "fresh"], primary: "#15803d", accent: "#fbbf24", font: "Open Sans, sans-serif", home: ["announcement-simple", "hero-classic", "collection-grid", "carousel-products", "newsletter-premium", "footer-marketplace"] },
    { slug: "kids-store", name: "Kids Store", category: "kids", tags: ["kids", "playful", "family"], primary: "#7c3aed", accent: "#f472b6", font: "Nunito, sans-serif", home: ["announcement-marquee", "hero-marketplace", "featured-products", "trust-badges", "footer-modern"] },
    { slug: "minimal-luxury", name: "Minimal Luxury", category: "minimal", tags: ["minimal", "luxury", "clean"], primary: "#09090b", accent: "#fafafa", font: "Inter, sans-serif", home: ["hero-fashion", "fashion-products", "brand-logos", "newsletter-premium", "footer-minimal"] },
];

const SECTION_BUILDERS = {
    "hero-classic": () => ({ blockType: "hero", content: { sectionVariant: "classic", heading: "Hoş Geldiniz", subheading: "Kalite ve stil", minHeight: "520px" } }),
    "hero-split": () => ({ blockType: "hero", content: { sectionVariant: "split", heading: "Yeni Koleksiyon", layout: "split", minHeight: "480px" } }),
    "hero-fashion": () => ({ blockType: "hero", content: { sectionVariant: "fashion", heading: "Yeni Sezon", subheading: "Sınırlı sayıda", minHeight: "85vh", textAlign: "left" } }),
    "hero-marketplace": () => ({ blockType: "hero", content: { sectionVariant: "marketplace", heading: "Her şey bir arada", badges: ["Ücretsiz Kargo", "Güvenli Ödeme"] } }),
    "hero-electronics": () => ({ blockType: "hero", content: { sectionVariant: "electronics", heading: "Teknoloji", backgroundColor: "#0f172a", textColor: "#f8fafc" } }),
    "hero-video": () => ({ blockType: "video", content: { sectionVariant: "video-hero", heading: "Tanıtım", url: "" } }),
    "announcement-simple": () => ({ blockType: "html", content: { announcement: true, text: "Ücretsiz kargo" } }),
    "announcement-marquee": () => ({ blockType: "html", content: { marquee: true, text: "YENİ SEZON", textColor: "#fff", backgroundColor: "#000" } }),
    "announcement-campaign": () => ({ blockType: "banner", content: { heading: "Kampanya", text: "%40 indirim", minHeight: "140px" } }),
    "featured-products": () => ({ blockType: "product-grid", content: { sectionVariant: "featured", heading: "Öne Çıkanlar", columns: 4, limit: 8, filter: "featured" } }),
    "fashion-products": () => ({ blockType: "product-grid", content: { sectionVariant: "fashion", heading: "Seçilmiş Parçalar", columns: 3, limit: 6 } }),
    "carousel-products": () => ({ blockType: "product-grid", content: { sectionVariant: "carousel", heading: "Trend", columns: 4, limit: 12, layout: "carousel" } }),
    "tabbed-products": () => ({ blockType: "product-grid", content: { sectionVariant: "tabbed", heading: "Keşfet", tabs: ["Yeni", "Popüler", "İndirim"] } }),
    "collection-grid": () => ({ blockType: "category-grid", content: { sectionVariant: "grid", heading: "Koleksiyonlar", columns: 4 } }),
    "collection-showcase": () => ({ blockType: "category-grid", content: { sectionVariant: "showcase", heading: "Kategoriler", columns: 3 } }),
    "collection-slider": () => ({ blockType: "category-grid", content: { sectionVariant: "slider", heading: "Koleksiyonlar", layout: "carousel" } }),
    "category-showcase": () => ({ blockType: "category-grid", content: { sectionVariant: "showcase", heading: "Kategoriler", columns: 3 } }),
    "trust-badges": () => ({ blockType: "html", content: { trustBadges: true, items: [{ icon: "🚚", title: "Hızlı Kargo" }, { icon: "🔒", title: "Güvenli Ödeme" }] } }),
    "testimonials-premium": () => ({ blockType: "testimonials", content: { heading: "Yorumlar", columns: 3 } }),
    "newsletter-premium": () => ({ blockType: "newsletter", content: { heading: "Bülten", buttonText: "Abone Ol", backgroundColor: "#18181b", textColor: "#fff" } }),
    "instagram-feed": () => ({ blockType: "html", content: { instagramFeed: true, heading: "@magaza" } }),
    "brand-logos": () => ({ blockType: "html", content: { brandLogos: true, heading: "Markalar", logos: [{ name: "A" }, { name: "B" }] } }),
    "statistics-block": () => ({ blockType: "text", content: { statistics: true, items: [{ value: "10K+", label: "Müşteri" }, { value: "4.9", label: "Puan" }] } }),
    "faq-premium": () => ({ blockType: "text", content: { faq: true, html: "<h2>SSS</h2>", items: [{ q: "Kargo?", a: "1-3 gün" }] } }),
    "footer-minimal": () => ({ blockType: "html", content: { footerBlock: true, variant: "minimal", copyright: "© Mağaza" } }),
    "footer-modern": () => ({ blockType: "html", content: { footerBlock: true, variant: "modern" } }),
    "footer-marketplace": () => ({ blockType: "html", content: { footerBlock: true, variant: "marketplace", showPayments: true } }),
    "footer-luxury": () => ({ blockType: "html", content: { footerBlock: true, variant: "luxury", copyright: "© LUXURY" } }),
};

function buildLayout(keys) {
    return keys.map((key, order) => {
        const b = SECTION_BUILDERS[key]();
        return { id: key.replace(/-/g, "_"), blockType: b.blockType, order, content: b.content, settings: { hidden: false } };
    });
}

function writePack(pack) {
    const dir = path.join(ROOT, pack.slug);
    fs.mkdirSync(path.join(dir, "templates"), { recursive: true });
    const layout = buildLayout(pack.home);
    fs.writeFileSync(path.join(dir, "theme.json"), JSON.stringify({
        slug: pack.slug,
        name: pack.name,
        description: `${pack.name} — premium e-ticaret teması (İkas / Shopify inspired)`,
        category: pack.category,
        version: "2.0.0",
        isPremium: true,
        isFeatured: false,
        sortOrder: 20,
        tags: [...pack.tags, "premium-v2", "json-pack", "responsive"],
        layoutVariant: pack.home.join("-"),
        changelog: "Premium Theme Pack v2",
    }, null, 2));
    fs.writeFileSync(path.join(dir, "theme.config.json"), JSON.stringify({
        version: "2.0.0",
        variables: {
            primaryColor: pack.primary,
            secondaryColor: pack.accent,
            accentColor: pack.accent,
            backgroundColor: "#ffffff",
            fontFamily: pack.font,
            borderRadius: pack.category === "luxury" || pack.category === "jewelry" ? "0px" : "8px",
            containerWidth: "1280px",
            sectionSpacing: pack.category === "minimal" ? "96px" : "72px",
        },
        header: { style: pack.category === "luxury" ? "minimal" : "standard" },
        footer: { variant: pack.home[pack.home.length - 1].replace("footer-", "") },
    }, null, 2));
    fs.writeFileSync(path.join(dir, "templates", "index.json"), JSON.stringify({ templateType: "index", name: "Anasayfa", defaultLayout: layout }, null, 2));
    fs.writeFileSync(path.join(dir, "templates", "collection.json"), JSON.stringify({
        templateType: "collection",
        name: "Koleksiyon",
        defaultLayout: [{ id: "coll_grid", blockType: "product-grid", order: 0, content: { sectionVariant: "marketplace", heading: "Tüm Ürünler", columns: 4, limit: 24, filter: "all" } }],
    }, null, 2));
    fs.writeFileSync(path.join(dir, "templates", "product.json"), JSON.stringify({
        templateType: "product",
        name: "Ürün Detay",
        defaultLayout: [
            { id: "pg", blockType: "html", order: 0, content: { wbBlockType: "product-gallery" } },
            { id: "pp", blockType: "html", order: 1, content: { wbBlockType: "product-price" } },
            { id: "pd", blockType: "html", order: 2, content: { wbBlockType: "product-description" } },
        ],
    }, null, 2));
}

PACKS.forEach(writePack);
console.log(`Created ${PACKS.length} premium theme packs in ${ROOT}`);
