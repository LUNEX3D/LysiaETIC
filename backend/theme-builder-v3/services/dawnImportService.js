"use strict";

const themePreset = require("./themePresetService");
const dawnMapper = require("./dawnTemplateMapper");
const dawnSchema = require("./dawnSchemaParser");

/**
 * GitHub Dawn temasından tam kurulum belgesi oluşturur.
 */
function buildDawnPresetDocument(siteName) {
    if (!dawnMapper.isDawnSourceAvailable()) {
        return themePreset.buildPresetDocument("dawn", { siteName });
    }

    const { current, headerGroup, footerGroup } = dawnMapper.loadThemeSettings();
    const { pages, productPage } = dawnMapper.buildAllPages();
    const doc = themePreset.buildPresetDocument("dawn", { siteName });

    doc.globalStyles = {
        ...doc.globalStyles,
        ...dawnMapper.settingsToGlobalStyles(current),
    };
    doc.header = dawnMapper.buildHeaderFromDawn(headerGroup, siteName);
    doc.footer = dawnMapper.buildFooterFromDawn(footerGroup, siteName);
    doc.pages = { ...doc.pages, ...pages };
    doc.productPage = productPage;
    doc.dawnManifest = {
        templates: dawnMapper.getTemplateList(),
        installedAt: new Date().toISOString(),
        sourcePath: "theme-builder-v3/dawn-source",
    };

    return doc;
}

function getDawnCustomizerManifest() {
    return dawnSchema.getManifest();
}

module.exports = {
    buildDawnPresetDocument,
    getDawnCustomizerManifest,
};
