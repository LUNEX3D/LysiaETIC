"use strict";

const themeEngine = require("./wbThemeEngine");

/**
 * Site + tema kurulumu customizations → birleşik CSS değişkenleri ve :root bloğu.
 */
function mergePublicThemeVariables(site = {}, install = null) {
    const base = themeEngine.mergeThemeVariables(site.themeId || "aurora", site.themeVariables || {});
    const custom = install?.customizations?.variables || {};
    return { ...base, ...custom };
}

function buildThemeCss(variables) {
    return themeEngine.generateCssVariables(variables);
}

function applyVariablesToPayload(site, install) {
    const variables = mergePublicThemeVariables(site, install);
    const cssVariables = buildThemeCss(variables);
    return { variables, cssVariables };
}

module.exports = {
    mergePublicThemeVariables,
    buildThemeCss,
    applyVariablesToPayload,
};
