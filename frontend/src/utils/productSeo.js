/** Ürün SEO slug / canonical yardımcıları */

export function slugifyForUrl(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 185);
}

export function normalizeCanonicalPath(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    s = s.replace(/^https?:\/\/[^/]+/i, "");
    if (!s.startsWith("/")) s = `/${s}`;
    return s.replace(/\/{2,}/g, "/");
}

export function buildProductPreviewUrl({ storeHost, slug, locale = "tr" }) {
    const path = slugifyForUrl(slug) || "urun";
    const host = storeHost?.trim() || "dashtock.com";
    const base = host.startsWith("http") ? host : `https://${host}`;
    return `${base.replace(/\/$/, "")}/${locale}/${path}`;
}
