"use strict";

const WBTheme = require("../models/WBTheme");
const WBThemeInstall = require("../models/WBThemeInstall");
const WBThemeVersion = require("../models/WBThemeVersion");
const WBSite = require("../models/WBSite");
const themeDocument = require("../theme-builder-v3/services/themeDocumentService");
const mongoose = require("mongoose");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

async function installTheme(siteId, userId, themeSlug = "lysia-starter") {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) });
    if (!site) return { error: "Site bulunamadı" };

    let theme = await WBTheme.findOne({ slug: themeSlug });
    if (!theme) {
        theme = await WBTheme.create({
            slug: themeSlug,
            name: themeSlug,
            category: "general",
            author: "LysiaETIC",
            isActive: true,
        });
    }

    let version = await WBThemeVersion.findOne({ themeId: theme._id }).sort({ createdAt: -1 });
    if (!version) {
        version = await WBThemeVersion.create({
            themeId: theme._id,
            version: "1.0.0",
            changelog: "Starter",
        });
    }

    let install = site.themeInstallId ? await WBThemeInstall.findById(site.themeInstallId) : null;
    if (!install) {
        install = await WBThemeInstall.create({
            siteId: site._id,
            userId: toObjectId(userId),
            themeId: theme._id,
            themeVersionId: version._id,
            customizations: {},
        });
        site.themeInstallId = install._id;
    }

    site.themeId = theme.slug;
    site.themeBuilderVersion = "v3";
    site.editorEngine = "v3";
    await site.save();

    await themeDocument.bootstrapV3(siteId, userId);

    return { install, site: site.toObject() };
}

module.exports = {
    installTheme,
};
