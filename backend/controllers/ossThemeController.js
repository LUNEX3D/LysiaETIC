"use strict";

/**
 * Legacy OSS / Grapes / Puck editor endpoints — v3 Theme Studio ile uyumluluk katmanı.
 * Eski editör kaldırıldı; uçlar boş yanıt veya v3 bootstrap döner.
 */
const mongoose = require("mongoose");
const WBSite = require("../models/WBSite");
const WBTheme = require("../models/WBTheme");
const themeDocument = require("../theme-builder-v3/services/themeDocumentService");

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function ok(res, data = {}, status = 200) {
    return res.status(status).json({ success: true, ...data });
}

function fail(res, message, status = 400) {
    return res.status(status).json({ success: false, error: message });
}

exports.listOssThemes = async (req, res) => {
    try {
        const themes = await WBTheme.find({ isActive: true }).sort({ name: 1 }).lean();
        return ok(res, {
            themes: themes.map((t) => ({
                slug: t.slug,
                name: t.name,
                description: t.description,
                category: t.category,
                thumbnailUrl: t.thumbnailUrl,
            })),
        });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.getOssTheme = async (req, res) => {
    try {
        const theme = await WBTheme.findOne({ slug: req.params.slug }).lean();
        if (!theme) return fail(res, "Tema bulunamadı", 404);
        return ok(res, { theme });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.installOssTheme = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const site = await WBSite.findOne({ _id: req.params.siteId, userId });
        if (!site) return fail(res, "Site bulunamadı", 404);
        site.themeId = req.params.slug || "lysia-starter";
        site.themeBuilderVersion = "v3";
        site.editorEngine = "v3";
        await site.save();
        const boot = await themeDocument.bootstrapV3(req.params.siteId, userId);
        return ok(res, { site: boot.site, document: boot.document, engine: "v3" });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.bootstrapGrapesEditor = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const boot = await themeDocument.bootstrapV3(req.params.siteId, userId);
        return ok(res, {
            engine: "v3",
            redirect: `/website-builder/${req.params.siteId}/themes/editor`,
            document: boot.document,
        });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

exports.getVisualEditor = async (req, res) => {
    return ok(res, { engine: "v3", grapes: null, puck: null });
};

exports.setEditorEngine = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const site = await WBSite.findOne({ _id: req.params.siteId, userId });
        if (!site) return fail(res, "Site bulunamadı", 404);
        site.editorEngine = "v3";
        site.themeBuilderVersion = "v3";
        await site.save();
        return ok(res, { site: site.toObject(), engine: "v3" });
    } catch (e) {
        return fail(res, e.message, 500);
    }
};

const emptyEditor = () => ({ html: "", css: "", components: null, style: null, data: null });

exports.getPuckEditor = async (req, res) => ok(res, { editor: emptyEditor(), engine: "v3" });
exports.savePuckEditor = async (req, res) => ok(res, { saved: true, engine: "v3" });
exports.bootstrapPuckEditor = async (req, res) => exports.bootstrapGrapesEditor(req, res);
exports.getGrapesEditor = async (req, res) => ok(res, { editor: emptyEditor(), engine: "v3" });
exports.saveGrapesEditor = async (req, res) => ok(res, { saved: true, engine: "v3" });
