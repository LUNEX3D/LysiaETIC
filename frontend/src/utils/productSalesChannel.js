/**
 * Ürünün kendi mağaza vitrininde (web sitesi) yayında olup olmadığını hesaplar.
 */
export function getProductStorefrontChannel(product, store, publicUrl = "") {
    if (!store || !product) {
        return { count: 0, live: false, host: "", productUrl: "", statusLabel: "Mağaza yok" };
    }

    const storePublished = store.status === "published";
    const productLive =
        storePublished &&
        product.visible !== false &&
        product.saleStatus !== "closed" &&
        Boolean(product.slug || product.seo?.slug);

    const productSlug = product.slug || product.seo?.slug || "";
    const shopBase = String(publicUrl || "").replace(/\/$/, "");
    const origin =
        typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : "";
    const productUrl = productSlug
        ? shopBase
            ? `${shopBase}/urun/${encodeURIComponent(productSlug)}`
            : `${origin}/shop/${encodeURIComponent(store.slug)}/urun/${encodeURIComponent(productSlug)}`
        : "";

    const host = displayStoreHost(store, publicUrl);

    if (!storePublished) {
        return {
            count: 0,
            live: false,
            host,
            productUrl: "",
            statusLabel: "Mağaza yayında değil",
        };
    }

    if (!productLive) {
        return {
            count: 0,
            live: false,
            host,
            productUrl: "",
            statusLabel:
                product.saleStatus === "closed"
                    ? "Ürün satışa kapalı"
                    : "Web sitesinde yayında değil",
        };
    }

    return {
        count: 1,
        live: true,
        host,
        productUrl,
        statusLabel: host,
    };
}

function displayStoreHost(store, publicUrl) {
    if (store.customDomain && store.domainStatus === "verified") {
        return String(store.customDomain).replace(/^www\./i, "");
    }
    if (store.subdomain) {
        return `${store.subdomain}.dashtock.com`;
    }
    try {
        const base = publicUrl.startsWith("http") ? publicUrl : `https://${publicUrl}`;
        return new URL(base).hostname;
    } catch {
        return store.slug ? `${store.slug}.dashtock.com` : "";
    }
}
