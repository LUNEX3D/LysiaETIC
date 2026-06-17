/**
 * GrapesJS export — vitrinde güvenli render için normalize eder.
 * - XSS middleware sonrası escape edilmiş HTML'i çözer
 * - <body>/<html>/<head> sarmalayıcılarını ayıklar (div içine gömülemez)
 */

function decodeHtmlEntities(text) {
    if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.innerHTML = text;
        return el.value;
    }
    return String(text)
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

export function normalizeGrapesHtml(html) {
    let s = String(html || "").trim();
    if (!s) return "";

    if (/&lt;\/?[a-z]/i.test(s) && !/<[a-z][\s/>]/i.test(s)) {
        s = decodeHtmlEntities(s).trim();
    }

    const bodyMatch = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) return bodyMatch[1].trim();

    return s
        .replace(/<!DOCTYPE[^>]*>/gi, "")
        .replace(/<\/?html[^>]*>/gi, "")
        .replace(/<head[\s\S]*?<\/head>/gi, "")
        .trim();
}

const GRAPES_NAV_SCRIPT = `<script>
(function(){
  document.addEventListener("click",function(e){
    var a=e.target.closest("a[href]");
    if(!a)return;
    var href=(a.getAttribute("href")||"").trim();
    if(!href||href.indexOf("http")===0||href.indexOf("mailto:")===0||href.indexOf("tel:")===0)return;
    if(href.charAt(0)==="#")return;
    e.preventDefault();
    try{window.parent.postMessage({type:"wb-grapes-navigate",href:href},"*");}catch(err){}
  },true);
})();
</script>`;

export function buildGrapesSrcDoc(html, css, baseHref = "") {
    const bodyHtml = normalizeGrapesHtml(html)
        || "<div style='padding:48px;text-align:center;color:#64748b;font-family:Inter,sans-serif'>Mağaza içeriği henüz yok</div>";
    const safeCss = String(css || "");
    const safeBase = baseHref ? String(baseHref).replace(/"/g, "&quot;") : "";
    const baseTag = safeBase ? `<base href="${safeBase}"/>` : "";

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${baseTag}
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;background:#fff}
${safeCss}
</style>
</head>
<body>${bodyHtml}${GRAPES_NAV_SCRIPT}</body>
</html>`;
}
