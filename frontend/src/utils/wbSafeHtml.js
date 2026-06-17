/**
 * Vitrin HTML — temel XSS sertleştirme (script, event handler, javascript: URL).
 */
export function stripWbHtml(html) {
    if (!html) return "";
    return String(html)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
        .replace(/<embed\b[^>]*>/gi, "")
        .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/vbscript:/gi, "")
        .replace(/data:text\/html/gi, "");
}

/** Vitrin dangerouslySetInnerHTML — editor modunda ham HTML (güvenilir admin). */
export function wbHtmlForMode(html, mode) {
    const raw = html || "";
    return mode === "storefront" ? stripWbHtml(raw) : raw;
}
