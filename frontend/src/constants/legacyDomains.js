/** Eski domainler — yalnızca dashtock.com'a 301 yönlendirme için */
export const CANONICAL_HOST = "dashtock.com";
export const CANONICAL_SITE_URL = "https://dashtock.com";

export const LEGACY_HOSTS = new Set([
    "pazaryonet.com",
    "www.pazaryonet.com",
    "pazaryonetim.com",
    "www.pazaryonetim.com",
    "pazaryönetim.com",
    "www.pazaryönetim.com",
    "xn--pazarynetim-wfb.com",
    "www.xn--pazarynetim-wfb.com",
]);

export function isLegacyHost(hostname) {
    if (!hostname) return false;
    return LEGACY_HOSTS.has(String(hostname).toLowerCase());
}

export function buildCanonicalRedirectUrl(locationLike = window.location) {
    const path = locationLike.pathname || "/";
    const search = locationLike.search || "";
    const hash = locationLike.hash || "";
    return `${CANONICAL_SITE_URL}${path}${search}${hash}`;
}
