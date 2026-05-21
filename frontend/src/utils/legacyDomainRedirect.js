import {
    buildCanonicalRedirectUrl,
    isLegacyHost,
} from "../constants/legacyDomains";

/** Eski pazaryonet domainlerinden dashtock.com'a yönlendir */
export function enforceCanonicalDomain() {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    if (!isLegacyHost(host)) return;
    const target = buildCanonicalRedirectUrl(window.location);
    if (window.location.href !== target) {
        window.location.replace(target);
    }
}
