"use strict";

/**
 * Website Builder — güvenlik yardımcıları (open redirect, path, domain).
 */

function isSafeInternalPath(path) {
    if (!path || typeof path !== "string") return false;
    const p = path.trim();
    if (!p.startsWith("/")) return false;
    if (p.startsWith("//")) return false;
    if (/^\/\//.test(p)) return false;
    if (/[\r\n]/.test(p)) return false;
    if (/^(javascript|data|vbscript):/i.test(p)) return false;
    try {
        const u = new URL(p, "https://example.com");
        if (u.hostname !== "example.com") return false;
    } catch {
        return false;
    }
    return true;
}

function sanitizeRedirectTarget(toPath) {
    if (!toPath || typeof toPath !== "string") return null;
    const trimmed = toPath.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        try {
            const u = new URL(trimmed);
            if (!["http:", "https:"].includes(u.protocol)) return null;
            return trimmed;
        } catch {
            return null;
        }
    }
    return isSafeInternalPath(trimmed) ? trimmed : null;
}

function normalizeDomainInput(domain) {
    if (!domain || typeof domain !== "string") return null;
    let d = domain.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    if (!d || d.length > 253) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
    if (d === "localhost" || d.endsWith(".local")) return null;
    return d;
}

function stripHtmlForDisplay(html) {
    if (!html) return "";
    return String(html)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/javascript:/gi, "");
}

module.exports = {
    isSafeInternalPath,
    sanitizeRedirectTarget,
    normalizeDomainInput,
    stripHtmlForDisplay,
};
