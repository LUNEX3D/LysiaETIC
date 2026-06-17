"use strict";

const { GLOBAL_SETTINGS_SCHEMA } = require("../schema/global-settings");
const { SUPPORTED_LOCALES } = require("../schema/pages");
const { randomUUID } = require("crypto");
const sectionRegistry = require("./sectionRegistryService");
const catalog = require("../catalog/opensourceThemes");
const { OS_THEME_SLUGS } = catalog;

function defaultGlobalStyles() {
    const out = {};
    GLOBAL_SETTINGS_SCHEMA.forEach((f) => { out[f.id] = f.defaultValue; });
    return out;
}

function emptyThemeDocument() {
    return {
        version: 3,
        globalStyles: defaultGlobalStyles(),
        header: {
            logoUrl: "",
            logoWidth: 140,
            sticky: true,
            transparent: false,
            menuItems: [],
        },
        footer: { blocks: [], copyright: "© Mağaza" },
        checkout: {
            logoUrl: "",
            primaryColor: "#111827",
            backgroundColor: "#f8fafc",
            buttonRadius: "8px",
            fontFamily: "Inter, sans-serif",
        },
        menus: { main: [] },
        languages: SUPPORTED_LOCALES.map((l) => ({ ...l, isDefault: l.code === "tr", isActive: l.code === "tr" })),
        pages: {},
        productPage: { sections: [] },
        activeLocale: "tr",
    };
}

function buildSectionsFromKeys(keys) {
    return (keys || []).map((key, index) => {
        const section = sectionRegistry.createSectionFromRegistry(key);
        if (!section) return null;
        section.order = index;
        return section;
    }).filter(Boolean);
}

function getThemePreset(slug) {
    return catalog.getThemePreset(slug);
}

function buildPresetDocument(themeSlug, { siteName } = {}) {
    if (themeSlug === "dawn") {
        try {
            const dawnImport = require("./dawnImportService");
            const dawnMapper = require("./dawnTemplateMapper");
            if (dawnMapper.isDawnSourceAvailable()) {
                return dawnImport.buildDawnPresetDocument(siteName);
            }
        } catch {
            /* catalog fallback */
        }
    }
    const slug = OS_THEME_SLUGS.includes(themeSlug) ? themeSlug : "bookly";
    const preset = getThemePreset(slug);
    const doc = emptyThemeDocument();
    doc.globalStyles = { ...doc.globalStyles, ...preset.globalStyles };
    doc.header = catalog.defaultHeader(slug, siteName);
    doc.footer = catalog.defaultFooter(slug, siteName);
    doc.checkout = { ...doc.checkout, ...(preset.checkout || {}) };

    const homeSections = catalog.buildRichHomeSections(slug, siteName);

    doc.pages = {
        home: {
            key: "home",
            type: "home",
            title: "Anasayfa",
            slug: "",
            sections: homeSections,
            seo: { title: siteName || catalog.getCatalogEntry(slug).name },
            status: "draft",
        },
    };

    doc.productPage = {
        sections: buildSectionsFromKeys(["product-gallery", "product-price", "add-to-cart", "related-products"]),
        layoutConfig: {},
    };

    return doc;
}

module.exports = {
    THEME_PRESETS: catalog.THEME_PRESETS,
    getThemePreset,
    buildPresetDocument,
    buildSectionsFromKeys,
};
