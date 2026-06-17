"use strict";

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DAWN_ROOT = path.join(__dirname, "..", "dawn-source");

/** Dawn template dosyası → Lysia sayfa anahtarı */
const TEMPLATE_TO_PAGE = {
    "index.json": { key: "home", label: "Anasayfa", type: "home" },
    "product.json": { key: "product", label: "Ürün", type: "product", isProductPage: true },
    "collection.json": { key: "category", label: "Koleksiyon", type: "products" },
    "cart.json": { key: "cart", label: "Sepet", type: "cart" },
    "search.json": { key: "search", label: "Arama", type: "search" },
    "blog.json": { key: "blog", label: "Blog", type: "blog" },
    "page.contact.json": { key: "contact", label: "İletişim", type: "contact" },
    "404.json": { key: "404", label: "404", type: "custom" },
    "list-collections.json": { key: "list-collections", label: "Koleksiyonlar", type: "products" },
    "page.json": { key: "page", label: "Sayfa", type: "custom" },
    "article.json": { key: "article", label: "Blog yazısı", type: "blog" },
    "password.json": { key: "password", label: "Şifre", type: "custom" },
};

const DAWN_TYPE_ALIAS = {
    "image-banner": "dawn-image-banner",
    "rich-text": "dawn-rich-text",
    "featured-collection": "dawn-featured-collection",
    "collage": "dawn-collage",
    "video": "dawn-video",
    "multicolumn": "dawn-multicolumn",
    "main-product": "dawn-main-product",
    "main-collection-banner": "dawn-collection-banner",
    "main-collection-product-grid": "dawn-collection-grid",
    "main-cart-items": "dawn-cart-items",
    "main-cart-footer": "dawn-cart-footer",
    "related-products": "dawn-related-products",
    "image-with-text": "dawn-image-with-text",
    "main-search": "dawn-search",
    "main-blog": "dawn-blog",
    "main-article": "dawn-article",
    "contact-form": "dawn-contact-form",
    "main-404": "dawn-404",
    "newsletter": "dawn-newsletter",
    "collection-list": "dawn-collection-list",
    "main-password-header": "dawn-password",
    "announcement-bar": "dawn-announcement-bar",
};

function readJson(relPath) {
    const full = path.join(DAWN_ROOT, relPath);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, "utf8"));
}

function mergeBlocks(section) {
    const content = { ...(section.settings || {}), dawnType: section.type };
    if (!section.blocks) return content;
    const blocks = (section.block_order || Object.keys(section.blocks)).map((id) => ({
        id,
        ...section.blocks[id],
    }));
    content.dawnBlocks = blocks;
    for (const block of blocks) {
        const s = block.settings || {};
        if (block.type === "heading") {
            content.heading = s.heading || content.heading;
            content.headingSize = s.heading_size;
        }
        if (block.type === "text") {
            content.text = s.text || content.text;
            content.textStyle = s.text_style;
        }
        if (block.type === "buttons") {
            content.buttonLabel = s.button_label_1 || content.buttonLabel;
            content.buttonLink = s.button_link_1 || content.buttonLink;
            content.buttonSecondary = s.button_style_secondary_1;
            content.buttonLabel2 = s.button_label_2;
            content.buttonLink2 = s.button_link_2;
        }
        if (block.type === "column") {
            content.columns = content.columns || [];
            content.columns.push({
                id: block.id,
                title: s.title,
                text: s.text,
                linkLabel: s.link_label,
                link: s.link,
                imageUrl: s.image ? s.image : undefined,
            });
        }
        if (block.type === "announcement") {
            content.announcementText = s.text;
            content.announcementLink = s.link;
        }
    }
    if (section.type === "image-banner" && !content.imageUrl) {
        content.imageUrl = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=2000&q=85";
    }
    if (section.type === "collage" && content.dawnBlocks?.length) {
        const imgs = [
            "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=85",
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=85",
            "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=85",
        ];
        content.blocks = content.dawnBlocks.map((b, i) => ({
            id: b.id,
            type: b.type,
            title: b.type === "product" ? "Featured product" : "Collection",
            imageUrl: imgs[i % imgs.length],
        }));
    }
    return content;
}

function dawnSectionToLysia(section, order) {
    const lysiaType = DAWN_TYPE_ALIAS[section.type] || `dawn-${section.type}`;
    return {
        id: randomUUID(),
        type: lysiaType,
        order,
        content: mergeBlocks(section),
        settings: {},
        translations: {},
    };
}

function templateToSections(templateJson) {
    if (!templateJson?.order) return [];
    return templateJson.order.map((id, order) => {
        const sec = templateJson.sections[id];
        if (!sec) return null;
        return dawnSectionToLysia(sec, order);
    }).filter(Boolean);
}

function loadTemplate(fileName) {
    return readJson(path.join("templates", fileName));
}

function buildAllPages() {
    const pages = {};
    let productPage = { sections: [], layoutConfig: {} };

    Object.entries(TEMPLATE_TO_PAGE).forEach(([file, meta]) => {
        const tpl = loadTemplate(file);
        if (!tpl) return;
        const sections = templateToSections(tpl);
        if (meta.isProductPage) {
            productPage = { sections, layoutConfig: {} };
            return;
        }
        pages[meta.key] = {
            key: meta.key,
            type: meta.type,
            title: meta.label,
            slug: meta.key === "home" ? "" : meta.key,
            sections,
            seo: { title: meta.label },
            status: "draft",
        };
    });

    return { pages, productPage };
}

function loadThemeSettings() {
    const schema = readJson("config/settings_schema.json") || [];
    const data = readJson("config/settings_data.json");
    const current = data?.presets?.[data?.current || "Default"] || {};
    const headerGroup = readJson("sections/header-group.json");
    const footerGroup = readJson("sections/footer-group.json");
    return { schema, current, headerGroup, footerGroup, themeInfo: schema[0] || {} };
}

function settingsToGlobalStyles(current) {
    return {
        themePack: "dawn",
        dawnVersion: "15.4.1",
        primaryColor: current.color_schemes?.["scheme-1"]?.settings?.button || "#121212",
        secondaryColor: "#334155",
        accentColor: "#008060",
        backgroundColor: current.color_schemes?.["scheme-1"]?.settings?.background || "#ffffff",
        textPrimary: current.color_schemes?.["scheme-1"]?.settings?.text || "#121212",
        fontFamily: "Assistant, sans-serif",
        headingFont: "Assistant, sans-serif",
        borderRadius: "0px",
        logoWidth: current.logo_width || 90,
        dawnSettings: current,
        dawnColorSchemes: current.color_schemes || {},
    };
}

function buildHeaderFromDawn(headerGroup, siteName) {
    const headerSec = headerGroup?.sections?.header?.settings || {};
    const announcement = headerGroup?.sections?.["announcement-bar"];
    let announcementText = "";
    if (announcement?.blocks) {
        const first = announcement.block_order?.[0];
        announcementText = announcement.blocks?.[first]?.settings?.text || "";
    }
    return {
        logoUrl: "",
        logoWidth: 90,
        sticky: true,
        transparent: false,
        brandName: siteName || "DAWN",
        menuItems: [
            { id: randomUUID(), label: "Home", url: "/", children: [] },
            { id: randomUUID(), label: "Catalog", url: "/products", children: [] },
            { id: randomUUID(), label: "Contact", url: "/contact", children: [] },
        ],
        dawnHeader: headerSec,
        announcementText,
        logoPosition: headerSec.logo_position || "middle-left",
    };
}

function buildFooterFromDawn(footerGroup, siteName) {
    const blocks = [];
    const footerSections = footerGroup?.sections || {};
    Object.values(footerSections).forEach((sec) => {
        blocks.push({
            id: randomUUID(),
            type: sec.type || "link",
            content: { text: sec.settings?.newsletter_heading || siteName },
        });
    });
    return {
        blocks: blocks.length ? blocks : [
            { id: randomUUID(), type: "Shop", content: { text: "Quick links" } },
            { id: randomUUID(), type: "Info", content: { text: "About our store" } },
        ],
        copyright: `© ${new Date().getFullYear()} ${siteName || "Store"}. Powered by Shopify Dawn.`,
        dawnFooter: footerGroup,
    };
}

function isDawnSourceAvailable() {
    return fs.existsSync(path.join(DAWN_ROOT, "templates", "index.json"));
}

function getTemplateList() {
    return Object.entries(TEMPLATE_TO_PAGE).map(([file, meta]) => ({
        file,
        ...meta,
        available: !!loadTemplate(file),
    })).filter((t) => t.available);
}

module.exports = {
    DAWN_ROOT,
    TEMPLATE_TO_PAGE,
    DAWN_TYPE_ALIAS,
    isDawnSourceAvailable,
    getTemplateList,
    buildAllPages,
    loadThemeSettings,
    settingsToGlobalStyles,
    buildHeaderFromDawn,
    buildFooterFromDawn,
    templateToSections,
    readJson,
};
