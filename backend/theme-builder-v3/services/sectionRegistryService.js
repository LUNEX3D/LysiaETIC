"use strict";

const { SECTION_REGISTRY: CORE_SECTIONS } = require("./sectionRegistryCore");

const EXTRA_TEMPLATES = [
    { prefix: "hero", label: "Hero", category: "hero", baseType: "hero", count: 12 },
    { prefix: "banner", label: "Banner", category: "marketing", baseType: "banner", count: 10 },
    { prefix: "product-grid", label: "Ürün Izgarası", category: "commerce", baseType: "product-grid", count: 12 },
    { prefix: "category-grid", label: "Kategori", category: "commerce", baseType: "category-grid", count: 10 },
    { prefix: "testimonials", label: "Yorumlar", category: "social", baseType: "testimonials", count: 8 },
    { prefix: "newsletter", label: "Bülten", category: "marketing", baseType: "newsletter", count: 8 },
    { prefix: "features", label: "Özellikler", category: "content", baseType: "html", count: 10 },
    { prefix: "cta", label: "CTA", category: "marketing", baseType: "hero", count: 10 },
    { prefix: "gallery", label: "Galeri", category: "content", baseType: "image", count: 8 },
    { prefix: "text-block", label: "Metin", category: "content", baseType: "text", count: 10 },
    { prefix: "faq", label: "SSS", category: "content", baseType: "text", count: 6 },
    { prefix: "blog", label: "Blog", category: "blog", baseType: "text", count: 6 },
];

function field(id, type, label, extra = {}) {
    return { id, type, label, ...extra };
}

function buildExtraSections() {
    const out = [];
    EXTRA_TEMPLATES.forEach((tpl) => {
        for (let i = 1; i <= tpl.count; i++) {
            const key = `${tpl.prefix}-v${i}`;
            out.push({
                key,
                label: `${tpl.label} ${i}`,
                category: tpl.category,
                settingsSchema: [field("heading", "text", "Başlık")],
                defaults: {
                    type: tpl.baseType,
                    content: { heading: `${tpl.label} ${i}`, sectionVariant: `v${i}` },
                    settings: {},
                },
            });
        }
    });
    return out;
}

const SECTION_REGISTRY = [...CORE_SECTIONS, ...buildExtraSections()];

function getRegistry() {
    return SECTION_REGISTRY.map((s) => ({ ...s }));
}

function getByKey(key) {
    return SECTION_REGISTRY.find((s) => s.key === key) || null;
}

function createSectionFromRegistry(key) {
    const { randomUUID } = require("crypto");
    const def = getByKey(key);
    if (!def) return null;
    const base = def.defaults || {};
    return {
        id: randomUUID(),
        type: base.type || key,
        order: 0,
        content: JSON.parse(JSON.stringify(base.content || {})),
        settings: JSON.parse(JSON.stringify(base.settings || {})),
        translations: {},
    };
}

function getCategories() {
    const cats = new Map();
    SECTION_REGISTRY.forEach((s) => {
        if (!cats.has(s.category)) cats.set(s.category, { id: s.category, label: s.category, count: 0 });
        cats.get(s.category).count += 1;
    });
    return Array.from(cats.values());
}

module.exports = {
    SECTION_REGISTRY,
    getRegistry,
    getByKey,
    createSectionFromRegistry,
    getCategories,
};
