"use strict";

const themeDocument = require("../services/themeDocumentService");
const themeHistory = require("../services/themeHistoryService");
const sectionRegistry = require("../services/sectionRegistryService");
const { ensureMarketplaceThemes } = require("../services/themeMarketplaceSeedService");
const { getCatalogEntry } = require("../catalog/opensourceThemes");
const WBTheme = require("../../models/WBTheme");
const WBSite = require("../../models/WBSite");
const mongoose = require("mongoose");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function toUserId(req) {
    return toObjectId(req.user?._id || req.user?.id);
}

function ok(res, data, status = 200) {
    return res.status(status).json({ success: true, ...data });
}

function fail(res, message, status = 400) {
    return res.status(status).json({ success: false, error: message });
}

exports.getDocument = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await themeDocument.loadDocument(req.params.siteId, userId);
        if (result.error) return fail(res, result.error, result.status || 404);
        themeHistory.pushState(req.params.siteId, userId, result.document);
        return ok(res, {
            document: result.document,
            site: result.site,
            revision: result.draftRevision,
            pageTemplates: themeDocument.PAGE_TEMPLATES,
            locales: themeDocument.SUPPORTED_LOCALES,
        });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.patchDocument = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { document } = req.body;
        if (!document) return fail(res, "document zorunlu");
        const result = await themeDocument.saveDocument(req.params.siteId, userId, document, { createRevision: false });
        if (result.error) return fail(res, result.error, result.status || 400);
        themeHistory.pushState(req.params.siteId, userId, document);
        return ok(res, { revision: result.revision });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.publish = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await themeDocument.publishDocument(req.params.siteId, userId);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { site: result.site, publishedAt: result.published.publishedAt });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.undo = async (req, res) => {
    const userId = toUserId(req);
    if (!userId) return fail(res, "Yetkisiz", 401);
    const result = themeHistory.undo(req.params.siteId, userId);
    if (result.error) return fail(res, result.error);
    await themeDocument.saveDocument(req.params.siteId, userId, result.document, { createRevision: false });
    return ok(res, { document: result.document });
};

exports.redo = async (req, res) => {
    const userId = toUserId(req);
    if (!userId) return fail(res, "Yetkisiz", 401);
    const result = themeHistory.redo(req.params.siteId, userId);
    if (result.error) return fail(res, result.error);
    await themeDocument.saveDocument(req.params.siteId, userId, result.document, { createRevision: false });
    return ok(res, { document: result.document });
};

exports.getSectionRegistry = async (req, res) => {
    const sections = sectionRegistry.getRegistry();
    const categories = sectionRegistry.getCategories();
    if (req.query.pack === "dawn") {
        try {
            const dawnSchema = require("../services/dawnSchemaParser");
            const dawnSections = dawnSchema.getSectionRegistry();
            const dawnCats = [{ id: "dawn", label: "Dawn", count: dawnSections.length }];
            return ok(res, {
                sections: [...dawnSections, ...sections.filter((s) => !String(s.key).startsWith("dawn-"))],
                categories: [...dawnCats, ...categories.filter((c) => c.id !== "dawn")],
            });
        } catch {
            /* ignore */
        }
    }
    return ok(res, { sections, categories });
};

exports.getDawnManifest = async (req, res) => {
    try {
        const dawnImport = require("../services/dawnImportService");
        const manifest = dawnImport.getDawnCustomizerManifest();
        if (!manifest.available) {
            return fail(res, "Dawn kaynak dosyaları bulunamadı. scripts/sync-dawn-from-github.js çalıştırın.", 503);
        }
        return ok(res, { manifest });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.getMarketplace = async (req, res) => {
    try {
        await ensureMarketplaceThemes();
        const themes = await WBTheme.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
        const { category } = req.query;
        let list = themes;
        if (category && category !== "all") {
            list = list.filter((t) => t.category === category);
        }
        return ok(res, {
            themes: list.map((t) => ({
                id: String(t._id),
                slug: t.slug,
                name: t.name,
                description: t.description,
                category: t.category,
                author: t.author,
                version: t.version,
                thumbnailUrl: t.thumbnailUrl,
                previewUrl: t.previewUrl || t.thumbnailUrl,
                isPremium: t.isPremium,
                isFeatured: t.isFeatured,
                sourceRepo: getCatalogEntry(t.slug)?.sourceRepo || "",
                license: getCatalogEntry(t.slug)?.license || "",
            })),
            categories: ["books", "food", "electronics", "minimal"],
        });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.getMyThemes = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        await ensureMarketplaceThemes();
        const sites = await WBSite.find({ userId: toObjectId(userId) })
            .select("name slug themeId themeBuilderVersion status publishedAt themeInstallId")
            .sort({ updatedAt: -1 })
            .lean();
        const { OS_THEME_SLUGS } = require("../catalog/opensourceThemes");
        const themeSlugs = [...new Set(sites.map((s) => s.themeId).filter(Boolean))];
        if (!themeSlugs.some((s) => OS_THEME_SLUGS.includes(s))) themeSlugs.push("bookly");
        const themes = await WBTheme.find({ slug: { $in: themeSlugs } }).lean();
        const themeBySlug = new Map(themes.map((t) => [t.slug, t]));
        return ok(res, {
            installs: sites.map((s) => {
                const themeSlug = s.themeId || "bookly";
                const theme = themeBySlug.get(themeSlug);
                return {
                    siteId: String(s._id),
                    siteName: s.name,
                    slug: s.slug,
                    themeId: themeSlug,
                    themeName: theme?.name || themeSlug || "Bookly",
                    thumbnailUrl: theme?.thumbnailUrl || "",
                    status: s.status,
                    publishedAt: s.publishedAt,
                    engine: s.themeBuilderVersion || "v1",
                };
            }),
        });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.installTheme = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { themeSlug } = req.body;
        if (!themeSlug) return fail(res, "themeSlug zorunlu");
        const result = await themeDocument.installThemeForSite(req.params.siteId, userId, themeSlug);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { site: result.site, document: result.document, theme: result.theme });
    } catch (e) {
        console.error("[theme-studio/install]", e);
        return fail(res, e.message, 500);
    }
};

exports.duplicateTheme = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const loaded = await themeDocument.loadDocument(req.params.siteId, userId);
        if (loaded.error) return fail(res, loaded.error, loaded.status);
        const WBThemeDraft = require("../../models/WBThemeDraft");
        await WBThemeDraft.create({
            siteId: loaded.site._id,
            userId,
            document: loaded.document,
            status: "draft",
            revision: (loaded.draftRevision || 0) + 1,
            label: "Kopya",
        });
        return ok(res, { duplicated: true });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.exportTheme = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const loaded = await themeDocument.loadDocument(req.params.siteId, userId);
        if (loaded.error) return fail(res, loaded.error, loaded.status);
        return ok(res, {
            format: "lysia-theme-v3",
            exportedAt: new Date().toISOString(),
            document: loaded.document,
        });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.importTheme = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { document } = req.body;
        if (!document) return fail(res, "document zorunlu");
        const result = await themeDocument.saveDocument(req.params.siteId, userId, document);
        if (result.error) return fail(res, result.error, result.status);
        return ok(res, { revision: result.revision });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.seedStarterTheme = async (req, res) => {
    try {
        const count = await ensureMarketplaceThemes();
        const themes = await WBTheme.find({ isActive: true }).sort({ name: 1 }).lean();
        return ok(res, { count, themes });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};
