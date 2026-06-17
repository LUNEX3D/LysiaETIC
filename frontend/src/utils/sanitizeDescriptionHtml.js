const BLOCKED_TAGS = new Set(["script", "style", "link", "meta", "head", "html", "body"]);

const LIGHT_BG_PATTERN =
    /^(#fff(fff)?|#ffffff|#f{3,8}\b|white|rgb\s*\(\s*2[0-4]\d|rgb\s*\(\s*255|hsl\(\s*0\s*,\s*0%\s*,\s*(9[0-9]|100)%)/i;

const LIGHT_TEXT_PATTERN =
    /^(#fff(fff)?|#ffffff|white|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))/i;

function isLightColor(value) {
    if (!value) return false;
    const v = String(value).trim().toLowerCase();
    return LIGHT_BG_PATTERN.test(v) || LIGHT_TEXT_PATTERN.test(v);
}

function cleanStyleString(style, tagName) {
    if (!style) return "";
    const keep = [];
    const parts = style.split(";");
    for (const part of parts) {
        const chunk = part.trim();
        if (!chunk) continue;
        const colon = chunk.indexOf(":");
        if (colon < 0) continue;
        const prop = chunk.slice(0, colon).trim().toLowerCase();
        const val = chunk.slice(colon + 1).trim();
        if (prop.startsWith("mso-")) continue;
        if (prop.startsWith("background")) continue;
        if (prop === "color" && isLightColor(val)) continue;
        if (
            (prop === "width" || prop === "height" || prop === "min-height" || prop === "min-width") &&
            (tagName === "div" || tagName === "span" || tagName === "p")
        ) {
            continue;
        }
        if (prop === "padding" || prop === "margin") {
            const num = parseFloat(val);
            if (!Number.isNaN(num) && num > 24) continue;
        }
        if (prop === "font-family" && /^(times|arial|calibri|sans-serif)/i.test(val)) continue;
        keep.push(`${prop}: ${val}`);
    }
    return keep.join("; ");
}

function unwrapSingleChild(wrapper) {
    if (!wrapper || wrapper.children.length !== 1) return;
    const only = wrapper.children[0];
    if (only.tagName === wrapper.tagName) {
        wrapper.replaceWith(...only.childNodes);
    }
}

function preprocessHtml(raw) {
    return String(raw)
        .replace(/\sbgcolor="[^"]*"/gi, "")
        .replace(/\sbackground="[^"]*"/gi, "");
}

function normalizeTables(root) {
    root.querySelectorAll("table, thead, tbody, tfoot, tr, td, th").forEach((el) => {
        el.removeAttribute("bgcolor");
        el.removeAttribute("background");
        const style = el.getAttribute("style");
        if (style) {
            const cleaned = cleanStyleString(style, el.tagName.toLowerCase());
            if (cleaned) el.setAttribute("style", cleaned);
            else el.removeAttribute("style");
        }
    });
}

function normalizeImages(root) {
    const doc = root.ownerDocument || document;
    [...root.querySelectorAll("img")].forEach((img) => {
        img.removeAttribute("width");
        img.removeAttribute("height");
        img.removeAttribute("border");
        img.classList.add("ec-prod-editor-img");

        let shell = img.closest(".ec-prod-img-shell, figure.ec-prod-editor-figure");
        if (!shell) {
            shell = doc.createElement("span");
            shell.className = "ec-prod-img-shell";
            img.parentNode?.insertBefore(shell, img);
            shell.appendChild(img);
        } else if (shell.tagName.toLowerCase() === "figure") {
            shell.classList.add("ec-prod-img-shell");
        }

        let parent = shell.parentElement;
        while (parent && parent !== root) {
            const tag = parent.tagName.toLowerCase();
            if (["div", "td", "th", "p", "span", "a"].includes(tag) && parent.children.length === 1) {
                const gp = parent.parentElement;
                if (gp) {
                    gp.insertBefore(shell, parent);
                    parent.remove();
                    break;
                }
            }
            parent = parent.parentElement;
        }
    });
}

function flattenWrappers(root) {
    let pass = 0;
    while (pass < 12) {
        pass += 1;
        let changed = false;
        [...root.querySelectorAll("div, section, article, table, td, th, tr")].forEach((node) => {
            if (node === root) return;
            const tag = node.tagName.toLowerCase();
            if (!["div", "section", "article", "table", "td", "th", "tr"].includes(tag)) return;
            const cls = node.getAttribute("class");
            if (cls && cls.includes("ec-prod-")) return;

            const kids = [...node.children];
            const hasMedia = node.querySelector("img, iframe, video, figure");
            const text = (node.textContent || "").replace(/\u00a0/g, " ").trim();

            if (!text && !hasMedia && kids.length === 0) {
                node.remove();
                changed = true;
                return;
            }

            if (kids.length === 1 && ["div", "section", "article", "p"].includes(kids[0].tagName.toLowerCase())) {
                node.replaceWith(...node.childNodes);
                changed = true;
            }
        });
        if (!changed) break;
    }
}

function stripResidualBackgrounds(root) {
    root.querySelectorAll("*").forEach((el) => {
        if (!el.getAttribute) return;
        const style = el.getAttribute("style");
        if (style && /background/i.test(style)) {
            const cleaned = cleanStyleString(style, el.tagName.toLowerCase());
            if (cleaned) el.setAttribute("style", cleaned);
            else el.removeAttribute("style");
        }
    });
}

function normalizeEmbeds(root) {
    root.querySelectorAll("iframe").forEach((iframe) => {
        const src = iframe.getAttribute("src") || "";
        if (!/youtube|youtu\.be|vimeo/i.test(src)) {
            iframe.remove();
            return;
        }
        const wrap = root.ownerDocument.createElement("div");
        wrap.className = "ec-prod-embed-video";
        iframe.removeAttribute("width");
        iframe.removeAttribute("height");
        iframe.setAttribute("style", "width:100%;aspect-ratio:16/9;border:0;");
        iframe.parentNode?.replaceChild(wrap, iframe);
        wrap.appendChild(iframe);
    });
}

function walkElement(el) {
    if (!el || el.nodeType !== 1) return;

    const tag = el.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
        el.remove();
        return;
    }

    el.removeAttribute("bgcolor");
    el.removeAttribute("background");

    const cls = el.getAttribute("class");
    if (cls && !String(cls).split(/\s+/).some((c) => c.startsWith("ec-prod-"))) {
        el.removeAttribute("class");
    }

    if (el.hasAttribute("style")) {
        const cleaned = cleanStyleString(el.getAttribute("style"), tag);
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
    }

    if (tag === "img") {
        el.removeAttribute("width");
        el.removeAttribute("height");
        el.removeAttribute("border");
        el.classList.add("ec-prod-editor-img");
    }

    const children = [...el.childNodes];
    children.forEach((child) => {
        if (child.nodeType === 1) walkElement(child);
    });

    if (tag === "div" || tag === "p" || tag === "span") {
        const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
        const hasMedia = el.querySelector("img, iframe, video");
        if (!text && !hasMedia && el.children.length === 0) {
            el.remove();
        }
    }
}

/**
 * Yapıştırılan / kayıtlı HTML'den beyaz kutu ve gereksiz arka planları temizler.
 */
export function sanitizeDescriptionHtml(html) {
    const raw = preprocessHtml(String(html || "").trim());
    if (!raw) return "";

    try {
        const doc = new DOMParser().parseFromString(raw, "text/html");
        walkElement(doc.body);
        normalizeTables(doc.body);
        normalizeEmbeds(doc.body);
        normalizeImages(doc.body);
        flattenWrappers(doc.body);
        stripResidualBackgrounds(doc.body);
        doc.body.querySelectorAll("div").forEach((div) => {
            if (!div.getAttribute("class") && !div.querySelector("iframe, img, video, figure")) {
                unwrapSingleChild(div);
            }
        });
        return doc.body.innerHTML.trim();
    } catch {
        return raw;
    }
}

export function sanitizeDescriptionPlain(plain) {
    return String(plain || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
        .join("");
}
