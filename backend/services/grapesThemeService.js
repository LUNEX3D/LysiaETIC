"use strict";

/** Legacy Grapes theme stubs — v3 sites do not use Grapes */
function getGrapesHomeForPublic(site = {}) {
    if (site.themeBuilderVersion === "v3") return { html: "", css: "" };
    const html = String(site.grapesEditor?.html || site.grapesHtml || "").trim();
    const css = String(site.grapesEditor?.css || site.grapesCss || "").trim();
    return { html, css };
}

function getGrapesPageDataForPublic(site = {}) {
    if (site.themeBuilderVersion === "v3") return null;
    return site.grapesEditor?.pageData || site.grapesPageData || null;
}

async function bootstrapGrapesEditor() {
    return null;
}

module.exports = {
    getGrapesHomeForPublic,
    getGrapesPageDataForPublic,
    bootstrapGrapesEditor,
};
