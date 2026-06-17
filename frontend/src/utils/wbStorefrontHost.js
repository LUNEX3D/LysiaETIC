/** Website Builder vitrin — host / canlı URL yardımcıları */

const LYSIA_HOST_SUFFIXES = [
    "lysia.com.tr",
    "lysiaetic.com",
    "localhost",
    "127.0.0.1",
];

export function isWbCustomDomainHost(hostname) {
    const h = (hostname || (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
    if (!h) return false;
    return !LYSIA_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

export function getWbAppDomain() {
    return process.env.REACT_APP_WB_DOMAIN || "sites.lysia.com.tr";
}

/** Admin panelinde gösterilecek canlı vitrin adresleri */
export function getLiveSiteUrls(site) {
    if (!site?.slug) return { primary: "", path: "", subdomain: "", custom: null, canOpen: false };

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const appDomain = getWbAppDomain();
    const path = `${origin}/site/${site.slug}`;
    const subdomain = `https://${site.slug}.${appDomain}`;
    const custom =
        site.customDomain && site.domainStatus === "active" && site.sslStatus === "active"
            ? `https://${site.customDomain.replace(/^https?:\/\//, "")}`
            : null;

    const canOpen = site.status === "published";
    const primary = custom || (process.env.NODE_ENV === "production" ? subdomain : path);

    return { primary, path, subdomain, custom, canOpen };
}

export const DOMAIN_STATUS_LABELS = {
    none: "Bağlı değil",
    pending_verification: "DNS bekliyor",
    verified: "TXT doğrulandı",
    ssl_pending: "SSL hazırlanıyor",
    active: "Aktif",
    failed: "Hata",
    expired: "SSL süresi doldu",
};

export const SSL_STATUS_LABELS = {
    none: "Yok",
    pending: "Bekliyor",
    active: "Aktif",
    renewing: "Yenileniyor",
    expired: "Süresi doldu",
    failed: "Hata",
};
