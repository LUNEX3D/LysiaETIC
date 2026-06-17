"use strict";

const fs = require("fs");
const path = require("path");
const dawnMapper = require("./dawnTemplateMapper");

const SECTIONS_DIR = path.join(dawnMapper.DAWN_ROOT, "sections");
const schemaCache = new Map();

function parseLiquidSchema(content) {
    const match = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
}

function loadSectionSchema(sectionType) {
    if (schemaCache.has(sectionType)) return schemaCache.get(sectionType);
    const candidates = [
        path.join(SECTIONS_DIR, `${sectionType}.liquid`),
        path.join(SECTIONS_DIR, `${sectionType}.json`),
    ];
    for (const file of candidates) {
        if (!fs.existsSync(file)) continue;
        const raw = fs.readFileSync(file, "utf8");
        const schema = file.endsWith(".json") ? JSON.parse(raw) : parseLiquidSchema(raw);
        if (schema) {
            schemaCache.set(sectionType, schema);
            return schema;
        }
    }
    schemaCache.set(sectionType, null);
    return null;
}

function shopifyFieldToLysia(field) {
    if (!field || field.type === "header" || field.type === "paragraph") return null;
    const typeMap = {
        text: "text",
        textarea: "textarea",
        inline_richtext: "text",
        richtext: "richtext",
        html: "html",
        image_picker: "image_picker",
        video_url: "video_url",
        url: "url",
        color: "color",
        color_scheme: "select",
        checkbox: "checkbox",
        range: "number",
        select: "select",
        radio: "select",
        number: "number",
        collection: "text",
        product: "text",
        link_list: "text",
        font_picker: "select",
    };
    const lysiaType = typeMap[field.type] || "text";
    const out = {
        id: field.id,
        type: lysiaType,
        label: String(field.label || field.id).replace(/^t:/, "").replace(/settings_schema\./, ""),
        defaultValue: field.default,
    };
    if (field.options) {
        out.options = field.options.map((o) => ({
            value: o.value,
            label: String(o.label || o.value).replace(/^t:/, ""),
        }));
    }
    if (field.min !== undefined) out.min = field.min;
    if (field.max !== undefined) out.max = field.max;
    if (field.step !== undefined) out.step = field.step;
    return out;
}

function schemaToSettingsFields(schema) {
    if (!schema) return [];
    const fields = [];
    (schema.settings || []).forEach((f) => {
        const mapped = shopifyFieldToLysia(f);
        if (mapped) fields.push(mapped);
    });
    (schema.blocks || []).forEach((block) => {
        (block.settings || []).forEach((f) => {
            const mapped = shopifyFieldToLysia(f);
            if (mapped) fields.push({ ...mapped, id: `${block.type}.${f.id}`, label: `${block.name || block.type}: ${mapped.label}` });
        });
    });
    return fields;
}

function getDawnSettingsGroups() {
    const schema = dawnMapper.readJson("config/settings_schema.json") || [];
    return schema
        .filter((g) => g.name && g.name !== "theme_info" && Array.isArray(g.settings))
        .map((g, i) => ({
            id: `group-${i}`,
            name: String(g.name).replace(/^t:settings_schema\./, "").replace(/\.name$/, ""),
            settings: g.settings
                .map(shopifyFieldToLysia)
                .filter(Boolean),
        }))
        .filter((g) => g.settings.length > 0);
}

function getSectionRegistry() {
    const registry = [];
    Object.entries(dawnMapper.DAWN_TYPE_ALIAS).forEach(([dawnType, lysiaType]) => {
        const schema = loadSectionSchema(dawnType);
        registry.push({
            key: lysiaType,
            label: schema?.name ? String(schema.name).replace(/^t:sections\./, "").replace(/\.name$/, "") : dawnType,
            category: "dawn",
            dawnType,
            settingsSchema: schemaToSettingsFields(schema),
            defaults: { type: lysiaType, content: {}, settings: {} },
        });
    });
    return registry;
}

function getManifest() {
    const { schema, current, headerGroup, footerGroup, themeInfo } = dawnMapper.loadThemeSettings();
    return {
        available: dawnMapper.isDawnSourceAvailable(),
        themeInfo: {
            name: themeInfo.theme_name || "Dawn",
            version: themeInfo.theme_version || "15.4.1",
            author: themeInfo.theme_author || "Shopify",
            source: "https://github.com/Shopify/dawn",
        },
        templates: dawnMapper.getTemplateList(),
        settingsGroups: getDawnSettingsGroups(),
        sectionRegistry: getSectionRegistry(),
        defaultSettings: current,
        headerGroup,
        footerGroup,
    };
}

module.exports = {
    getManifest,
    getDawnSettingsGroups,
    getSectionRegistry,
    loadSectionSchema,
    schemaToSettingsFields,
    shopifyFieldToLysia,
};
