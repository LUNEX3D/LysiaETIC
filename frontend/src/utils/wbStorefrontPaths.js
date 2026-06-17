import { isWbCustomDomainHost } from "./wbStorefrontHost";

/** Vitrin base path — custom domain: "" ; subdomain/path: /site/:slug */
export function getWbStorefrontBase(siteSlug) {
    if (isWbCustomDomainHost()) return "";
    return siteSlug ? `/site/${siteSlug}` : "";
}

export function wbPath(siteSlug, subPath = "") {
    const base = getWbStorefrontBase(siteSlug);
    const p = String(subPath || "").replace(/^\//, "");
    if (!p) return base || "/";
    return base ? `${base}/${p}` : `/${p}`;
}

export const wbCartPath = (siteSlug) => wbPath(siteSlug, "cart");
export const wbCheckoutPath = (siteSlug) => wbPath(siteSlug, "checkout");
export const wbSearchPath = (siteSlug, query = "") => {
    const base = wbPath(siteSlug, "search");
    if (!query) return base;
    const q = encodeURIComponent(query);
    return `${base}?q=${q}`;
};
export const wbProductsPath = (siteSlug) => wbPath(siteSlug, "products");
