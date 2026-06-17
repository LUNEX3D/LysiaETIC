import { useEffect } from "react";

const MANAGED_ATTR = "data-wb-seo";

function upsertMeta(attr, key, content) {
    if (content === undefined || content === null || content === "") return;
    let el = document.querySelector(`meta[${attr}="${key}"][${MANAGED_ATTR}]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        el.setAttribute(MANAGED_ATTR, "1");
        document.head.appendChild(el);
    }
    el.setAttribute("content", String(content));
}

function upsertLink(rel, href) {
    if (!href) return;
    let el = document.querySelector(`link[rel="${rel}"][${MANAGED_ATTR}]`);
    if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        el.setAttribute(MANAGED_ATTR, "1");
        document.head.appendChild(el);
    }
    el.setAttribute("href", href);
}

function removeManaged() {
    document.querySelectorAll(`[${MANAGED_ATTR}]`).forEach((n) => n.remove());
    document.querySelectorAll("script[data-wb-jsonld]").forEach((n) => n.remove());
}

/**
 * Production SEO — title, meta, OG, Twitter, canonical, robots, JSON-LD.
 */
export default function WbStorefrontHead({ seo }) {
    useEffect(() => {
        removeManaged();
        if (!seo?.metaTags) return undefined;

        const m = seo.metaTags;
        if (m.title) document.title = m.title;
        upsertMeta("name", "description", m.description);
        upsertMeta("name", "keywords", m.keywords);
        if (m.noIndex) {
            upsertMeta("name", "robots", "noindex, nofollow");
        } else {
            upsertMeta("name", "robots", "index, follow");
        }

        upsertMeta("property", "og:title", m.ogTitle || m.title);
        upsertMeta("property", "og:description", m.ogDescription || m.description);
        upsertMeta("property", "og:image", m.ogImage);
        upsertMeta("property", "og:type", m.ogType || "website");
        if (seo.baseUrl) upsertMeta("property", "og:url", m.canonicalUrl || seo.baseUrl);

        upsertMeta("name", "twitter:card", m.twitterCard || "summary_large_image");
        upsertMeta("name", "twitter:title", m.twitterTitle || m.title);
        upsertMeta("name", "twitter:description", m.twitterDescription || m.description);
        upsertMeta("name", "twitter:image", m.twitterImage || m.ogImage);

        if (m.canonicalUrl) upsertLink("canonical", m.canonicalUrl);

        (seo.jsonLd || []).forEach((raw, i) => {
            try {
                const script = document.createElement("script");
                script.type = "application/ld+json";
                script.setAttribute("data-wb-jsonld", String(i));
                script.textContent = typeof raw === "string" ? raw : JSON.stringify(raw);
                document.head.appendChild(script);
            } catch {
                /* invalid json-ld */
            }
        });

        return () => removeManaged();
    }, [seo]);

    return null;
}
