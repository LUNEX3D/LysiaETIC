/** Yüklenen logo / medya URL'lerini tam adrese çevir */
export function resolveUploadUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:|^blob:/i.test(url)) return url;

    // Frontend statik şablon logoları (CRA public/)
    if (url.startsWith("/brand/")) {
        if (typeof window !== "undefined") {
            const base = window.location.origin.replace(/\/$/, "");
            return base + url;
        }
        return url;
    }

    const base = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
    if (!base) {
        if (typeof window !== "undefined" && url.startsWith("/uploads/")) {
            return window.location.origin.replace(/\/$/, "") + url;
        }
        return url;
    }
    return base + (url.startsWith("/") ? url : `/${url}`);
}
