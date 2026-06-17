/**
 * Tema JSON sectionVariant değerlerini SectionRenderer CSS sınıflarına eşler.
 * Shopify Dawn/Craft/Sense paketleri dawn-split, editorial vb. kullanır.
 */

export function normalizeHeroVariant(raw) {
    const v = String(raw || "classic").toLowerCase();
    if (v === "dawn-split" || v === "dawn_split" || v === "split-hero") return "split";
    if (v === "dawn" || v === "dawn-classic") return "classic";
    return v;
}

export function normalizeGridVariant(raw, fallback = "grid") {
    const v = String(raw || fallback).toLowerCase();
    if (v === "dawn-featured") return "featured";
    if (v === "dawn-grid") return "grid";
    return v;
}

export function isHeroSplitVariant(raw, content = {}) {
    const n = normalizeHeroVariant(raw);
    return n === "split" || content.layout === "split";
}
