import { getWbAppDomain, getLiveSiteUrls } from "./wbStorefrontHost";
import { rememberWbSiteContext } from "./wbNavigation";

const LS_KEY = "ec_active_site";

export function siteDisplayHost(site) {
    const appDomain = getWbAppDomain();
    if (site?.customDomain) {
        return site.customDomain.replace(/^https?:\/\//, "");
    }
    if (site?.slug) {
        return `${site.slug}.${appDomain}`;
    }
    return "—";
}

export function splitStoreHost(site) {
    const full = siteDisplayHost(site);
    const appDomain = getWbAppDomain();
    if (site?.customDomain) {
        return { prefix: full, suffix: "" };
    }
    const suffix = `.${appDomain}`;
    if (full.endsWith(suffix)) {
        return { prefix: full.slice(0, -suffix.length), suffix };
    }
    return { prefix: full, suffix: "" };
}

export function setActiveEcSite(site) {
    if (!site?._id && !site?.id) return null;
    const id = site._id || site.id;
    const host = siteDisplayHost(site);
    const live = getLiveSiteUrls(site);
    const ctx = {
        id: String(id),
        storeId: site.storeId ? String(site.storeId) : null,
        slug: site.slug || "",
        name: site.name || site.slug || host,
        host,
    };
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(ctx));
    } catch {
        /* ignore */
    }
    rememberWbSiteContext(site._id, live.path || live.primary);
    return ctx;
}

export function getActiveEcSite() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed;
    } catch {
        /* ignore */
    }
    return null;
}

export function clearActiveEcSite() {
    try {
        localStorage.removeItem(LS_KEY);
    } catch {
        /* ignore */
    }
}
