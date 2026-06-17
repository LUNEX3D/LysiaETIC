"use strict";

const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const logger = require("../config/logger");
const wbService = require("../services/websiteBuilderService");
const wbDomainService = require("../services/wbDomainService");
const wbSeoService = require("../services/wbSeoService");
const themeEngine = require("../services/wbThemeEngine");

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    if (!id) return null;
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

function ok(res, data, status = 200) {
    return res.status(status).json({ success: true, ...data });
}

function fail(res, message, status = 400) {
    logger.warn(`[WB] ${status}: ${message}`);
    return res.status(status).json({ success: false, error: message });
}

// ─── SITE ─────────────────────────────────────────────────────────────────────

exports.getSites = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const sites = await wbService.getSitesByUser(userId);
        return ok(res, { sites });
    } catch (e) {
        logger.error("[WB] getSites:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getSite = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const site = await wbService.getSiteById(req.params.siteId, userId);
        if (!site) return fail(res, "Site bulunamadı", 404);
        return ok(res, { site });
    } catch (e) {
        logger.error("[WB] getSite:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.createSite = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { name, themeId, defaultLanguage, defaultCurrency } = req.body;
        if (!name?.trim()) return fail(res, "Site adı zorunlu");
        const plan = req.subscriptionPlan || "trial";
        const result = await wbService.createSite(userId, { name, themeId, defaultLanguage, defaultCurrency, plan });
        if (result.error) return fail(res, result.error);
        return ok(res, { site: result.site }, 201);
    } catch (e) {
        logger.error("[WB] createSite:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateSite = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.updateSite(req.params.siteId, userId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { site: result.site });
    } catch (e) {
        logger.error("[WB] updateSite:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.publishSite = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.publishSite(req.params.siteId, userId);
        if (result.error) return fail(res, result.error);
        return ok(res, { site: result.site });
    } catch (e) {
        logger.error("[WB] publishSite:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.unpublishSite = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.unpublishSite(req.params.siteId, userId);
        if (result.error) return fail(res, result.error);
        return ok(res, { site: result.site });
    } catch (e) {
        logger.error("[WB] unpublishSite:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.createPreviewToken = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.createPreviewToken(req.params.siteId, userId);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB] createPreviewToken:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.deleteSite = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.deleteSite(req.params.siteId, userId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB] deleteSite:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── THEMES ───────────────────────────────────────────────────────────────────

exports.getThemes = async (req, res) => {
    try {
        const { category, isPremium } = req.query;
        let themes = themeEngine.getAllThemes();
        if (category) themes = themes.filter((t) => t.category === category);
        if (isPremium !== undefined) themes = themes.filter((t) => t.isPremium === (isPremium === "true"));
        return ok(res, { themes });
    } catch (e) {
        logger.error("[WB] getThemes:", e.message);
        return fail(res, e.message, 500);
    }
};

/** @deprecated Use POST /sites/:siteId/theme/install — kept for backward compatibility */
exports.applyTheme = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { themeId, resetLayout = false } = req.body;
        if (!themeId) return fail(res, "themeId zorunlu");

        const themeVersionSvc = require("../services/wbThemeVersionService");
        const result = await themeVersionSvc.installTheme(
            req.params.siteId,
            userId,
            themeId,
            null,
            { materializePages: !!resetLayout, resetExistingPages: !!resetLayout }
        );
        if (result.error) return fail(res, result.error, 404);

        res.set("X-WB-Deprecated", "applyTheme; use POST /sites/:siteId/theme/install");
        const siteResult = await wbService.getSiteById(req.params.siteId, userId);
        return ok(res, {
            site: siteResult.site,
            theme: result.theme,
            install: result.install,
            materialize: result.materialize,
            legacy: true,
        });
    } catch (e) {
        logger.error("[WB] applyTheme:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── PAGES ────────────────────────────────────────────────────────────────────

exports.getPages = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const pages = await wbService.getPages(req.params.siteId, userId);
        return ok(res, { pages });
    } catch (e) {
        const status = e.status || 500;
        logger.error("[WB] getPages:", e.message);
        return fail(res, e.message, status);
    }
};

exports.getPage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const page = await wbService.getPageById(req.params.siteId, userId, req.params.pageId);
        if (!page) return fail(res, "Sayfa bulunamadı", 404);
        return ok(res, { page });
    } catch (e) {
        logger.error("[WB] getPage:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.createPage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { title, type, slug, sections } = req.body;
        if (!title?.trim()) return fail(res, "Sayfa başlığı zorunlu");
        const result = await wbService.createPage(req.params.siteId, userId, { title, type, slug, sections });
        if (result.error) return fail(res, result.error);
        return ok(res, { page: result.page }, 201);
    } catch (e) {
        logger.error("[WB] createPage:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.updatePage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.updatePage(req.params.siteId, userId, req.params.pageId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { page: result.page });
    } catch (e) {
        logger.error("[WB] updatePage:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.publishPage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.publishPage(req.params.siteId, userId, req.params.pageId);
        if (result.error) return fail(res, result.error);
        return ok(res, { page: result.page });
    } catch (e) {
        logger.error("[WB] publishPage:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.deletePage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.deletePage(req.params.siteId, userId, req.params.pageId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB] deletePage:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

exports.addSection = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.addSection(req.params.siteId, userId, req.params.pageId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { section: result.section }, 201);
    } catch (e) {
        logger.error("[WB] addSection:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.updateSection = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.updateSection(req.params.siteId, userId, req.params.pageId, req.params.sectionId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { section: result.section });
    } catch (e) {
        logger.error("[WB] updateSection:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.reorderSections = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { orderedIds } = req.body;
        if (!Array.isArray(orderedIds)) return fail(res, "orderedIds dizisi gerekli");
        const result = await wbService.reorderSections(req.params.siteId, userId, req.params.pageId, orderedIds);
        if (result.error) return fail(res, result.error);
        return ok(res, { sections: result.sections });
    } catch (e) {
        logger.error("[WB] reorderSections:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.deleteSection = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.deleteSection(req.params.siteId, userId, req.params.pageId, req.params.sectionId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB] deleteSection:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

exports.getNavigation = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const navs = await wbService.getNavigation(req.params.siteId, userId);
        return ok(res, { navigations: navs });
    } catch (e) {
        logger.error("[WB] getNavigation:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.updateNavigation = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { position } = req.params;
        const { items, headerConfig, footerConfig } = req.body;
        const result = await wbService.updateNavigation(req.params.siteId, userId, position, { items, headerConfig, footerConfig });
        if (result.error) return fail(res, result.error);
        return ok(res, { navigation: result.navigation });
    } catch (e) {
        logger.error("[WB] updateNavigation:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

// ─── BLOG ─────────────────────────────────────────────────────────────────────

exports.getBlogPosts = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { page, limit, status, categoryId, tag } = req.query;
        const result = await wbService.getBlogPosts(req.params.siteId, userId, {
            page: parseInt(page) || 1,
            limit: Math.min(parseInt(limit) || 20, 100),
            status, categoryId, tag,
        });
        return ok(res, result);
    } catch (e) {
        logger.error("[WB] getBlogPosts:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.getBlogPost = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const post = await wbService.getBlogPostById(req.params.siteId, userId, req.params.postId);
        if (!post) return fail(res, "Yazı bulunamadı", 404);
        return ok(res, { post });
    } catch (e) {
        logger.error("[WB] getBlogPost:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.createBlogPost = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        if (!req.body.title?.trim()) return fail(res, "Yazı başlığı zorunlu");
        const result = await wbService.createBlogPost(req.params.siteId, userId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { post: result.post }, 201);
    } catch (e) {
        logger.error("[WB] createBlogPost:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.updateBlogPost = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.updateBlogPost(req.params.siteId, userId, req.params.postId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { post: result.post });
    } catch (e) {
        logger.error("[WB] updateBlogPost:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.deleteBlogPost = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.deleteBlogPost(req.params.siteId, userId, req.params.postId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB] deleteBlogPost:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.getBlogCategories = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const categories = await wbService.getBlogCategories(req.params.siteId, userId);
        return ok(res, { categories });
    } catch (e) {
        logger.error("[WB] getBlogCategories:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.createBlogCategory = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        if (!req.body.name?.trim()) return fail(res, "Kategori adı zorunlu");
        const result = await wbService.createBlogCategory(req.params.siteId, userId, req.body);
        if (result.error) return fail(res, result.error);
        return ok(res, { category: result.category }, 201);
    } catch (e) {
        logger.error("[WB] createBlogCategory:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.deleteBlogCategory = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.deleteBlogCategory(req.params.siteId, userId, req.params.categoryId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB] deleteBlogCategory:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

// ─── MEDIA ────────────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, "../uploads/wb-media");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const siteDir = path.join(UPLOAD_DIR, req.params.siteId || "tmp");
        if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir, { recursive: true });
        cb(null, siteDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "video/mp4", "application/pdf"];

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
        else cb(new Error(`Desteklenmeyen dosya tipi: ${file.mimetype}`));
    },
});

exports.mediaUploadMiddleware = upload.single("file");

exports.getMedia = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { page, limit, type, folder } = req.query;
        const result = await wbService.getMedia(req.params.siteId, userId, {
            page: parseInt(page) || 1,
            limit: Math.min(parseInt(limit) || 40, 200),
            type, folder,
        });
        return ok(res, result);
    } catch (e) {
        logger.error("[WB] getMedia:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.uploadMedia = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        if (!req.file) return fail(res, "Dosya yüklenmedi");

        const file = req.file;
        const isImage = file.mimetype.startsWith("image/") && !file.mimetype.includes("svg");
        let dimensions = { width: 0, height: 0 };
        let thumbnailUrl = "";
        const relativePath = `/uploads/wb-media/${req.params.siteId}/${file.filename}`;

        const fileType = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : file.mimetype === "application/pdf" ? "document" : "other";
        let variants = [];
        let optimizedUrl = null;

        if (isImage) {
            try {
                const imgOpt = require("../services/wbImageOptimizeService");
                const opt = await imgOpt.optimizeUploadedImage(file.path, req.params.siteId, file.filename);
                if (opt.thumbnailUrl) thumbnailUrl = opt.thumbnailUrl;
                if (opt.dimensions) dimensions = opt.dimensions;
                variants = opt.variants || [];
                const primaryWebp = variants.find((v) => v.format === "webp" && v.role === "primary");
                if (primaryWebp) optimizedUrl = primaryWebp.url;
            } catch {
                /* silently fail */
            }
        }

        const result = await wbService.saveMedia(req.params.siteId, userId, {
            url: optimizedUrl || relativePath,
            thumbnailUrl,
            type: fileType,
            mimeType: file.mimetype,
            originalName: file.originalname,
            fileName: file.filename,
            size: file.size,
            dimensions,
            folder: req.body.folder || "root",
            storageProvider: "local",
            tags: variants.length ? [`variants:${variants.length}`] : [],
        });

        return ok(res, { media: result.media, variants, optimizedUrl }, 201);
    } catch (e) {
        logger.error("[WB] uploadMedia:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

exports.deleteMedia = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbService.deleteMedia(req.params.siteId, userId, req.params.mediaId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB] deleteMedia:", e.message);
        return fail(res, e.message, e.status || 500);
    }
};

// ─── DOMAIN ───────────────────────────────────────────────────────────────────

exports.getDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const domain = await wbDomainService.getDomainBySite(req.params.siteId);
        return ok(res, { domain });
    } catch (e) {
        logger.error("[WB] getDomain:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.listDomains = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const domains = await wbDomainService.listDomainsBySite(req.params.siteId);
        return ok(res, { domains });
    } catch (e) {
        logger.error("[WB] listDomains:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.addDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { domain, domainType } = req.body;
        if (!domain?.trim()) return fail(res, "Domain adı zorunlu");
        const result = await wbDomainService.createDomainRecord(req.params.siteId, userId, domain, { domainType });
        if (result.error) return fail(res, result.error);
        return ok(res, { domain: result.domain }, 201);
    } catch (e) {
        logger.error("[WB] addDomain:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.verifyDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const domainId = req.body?.domainId || req.query?.domainId;
        const result = await wbDomainService.verifyDomain(req.params.siteId, domainId);
        if (result.error) return fail(res, result.error);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB] verifyDomain:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.setPrimaryDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbDomainService.setPrimaryDomain(req.params.siteId, req.params.domainId);
        if (result.error) return fail(res, result.error);
        return ok(res, { domain: result.domain });
    } catch (e) {
        logger.error("[WB] setPrimaryDomain:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.removeDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        await wbDomainService.removeDomain(req.params.siteId);
        return ok(res, { removed: true });
    } catch (e) {
        logger.error("[WB] removeDomain:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.removeDomainById = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await wbDomainService.removeDomain(req.params.siteId, req.params.domainId);
        if (result.error) return fail(res, result.error);
        return ok(res, { removed: true });
    } catch (e) {
        logger.error("[WB] removeDomainById:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── PAGE REVISIONS ───────────────────────────────────────────────────────────

const pageRevisionSvc = require("../services/wbPageRevisionService");

exports.getPageRevisions = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await pageRevisionSvc.listRevisions(req.params.siteId, req.params.pageId);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB] getPageRevisions:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.restorePageRevision = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await pageRevisionSvc.restoreRevision(
            req.params.siteId,
            req.params.pageId,
            req.params.revisionId,
            userId
        );
        if (result.error) return fail(res, result.error);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB] restorePageRevision:", e.message);
        return fail(res, e.message, 500);
    }
};
