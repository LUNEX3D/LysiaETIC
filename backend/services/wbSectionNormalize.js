"use strict";

const { v4: uuidv4 } = require("uuid");

const VALID_SECTION_TYPES = new Set([
    "hero", "product-grid", "category-grid", "banner", "slider", "text", "image", "video",
    "testimonials", "newsletter", "contact", "countdown", "campaign", "html", "spacer", "divider",
]);

const VALID_BACKGROUND_SIZE = new Set(["cover", "contain", "auto"]);

const PX_SETTINGS = new Set([
    "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
    "marginTop", "marginBottom", "borderRadius",
]);

function coercePx(value, fallback = "0px") {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
    const s = String(value).trim();
    if (/^\d+$/.test(s)) return `${s}px`;
    return s;
}

function sanitizeSectionSettings(settings = {}) {
    const s = { ...(settings || {}) };
    if (s.backgroundSize && !VALID_BACKGROUND_SIZE.has(s.backgroundSize)) {
        s.backgroundSize = "cover";
    }
    PX_SETTINGS.forEach((key) => {
        if (s[key] !== undefined) s[key] = coercePx(s[key], key.includes("padding") ? "60px" : "0px");
    });
    return s;
}

function normalizeSectionForDb(section, index = 0) {
    if (!section || typeof section !== "object") {
        return {
            id: uuidv4(),
            type: "html",
            order: index,
            content: {},
            settings: {},
            version: 1,
        };
    }

    const {
        registryKey,
        blocks,
        catalogLabel,
        blockType,
        ...rest
    } = section;

    const copy = {
        ...rest,
        id: rest.id ? String(rest.id) : uuidv4(),
        order: index,
        settings: sanitizeSectionSettings(section.settings),
        content: { ...(section.content || {}) },
        version: Number.isFinite(section.version) ? section.version : 1,
    };

    if (VALID_SECTION_TYPES.has(copy.type)) return copy;

    const { wbBlockType, ...restContent } = copy.content;
    return {
        ...copy,
        type: "html",
        content: {
            ...restContent,
            wbBlockType: wbBlockType || blockType || copy.type,
        },
    };
}

function normalizeSectionsForDb(sections) {
    return (sections || []).map(normalizeSectionForDb);
}

module.exports = {
    VALID_SECTION_TYPES,
    normalizeSectionForDb,
    normalizeSectionsForDb,
    sanitizeSectionSettings,
};
