"use strict";

const logger = require("../config/logger");
const wbPublic = require("../services/wbPublicService");
const wbSeoService = require("../services/wbSeoService");
const WBBlogPost = require("../models/WBBlogPost");
const WBBlogCategory = require("../models/WBBlogCategory");
const WBFormSubmission = require("../models/WBFormSubmission");
const mongoose = require("mongoose");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function ok(res, data) { return res.json({ success: true, ...data }); }
function fail(res, message, status = 404) { return res.status(status).json({ success: false, error: message }); }

// ─── Site / Theme / Navigation ────────────────────────────────────────────────

exports.getSiteConfig = async (req, res) => {
    try {
        const bundle = await wbPublic.getSiteBundle(req);
        if (bundle.error) return fail(res, bundle.error, bundle.status);
        return ok(res, bundle);
    } catch (e) {
        logger.error("[WB Public] getSiteConfig:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getTheme = async (req, res) => {
    try {
        const bundle = await wbPublic.getThemeBundle(req);
        if (bundle.error) return fail(res, bundle.error, bundle.status);
        return ok(res, bundle);
    } catch (e) {
        logger.error("[WB Public] getTheme:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getNavigation = async (req, res) => {
    try {
        const bundle = await wbPublic.getNavigationBundle(req);
        if (bundle.error) return fail(res, bundle.error, bundle.status);
        return ok(res, bundle);
    } catch (e) {
        logger.error("[WB Public] getNavigation:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getPage = async (req, res) => {
    try {
        const bundle = await wbPublic.getPageBundle(req);
        if (bundle.error) return fail(res, bundle.error, bundle.status);
        return ok(res, bundle);
    } catch (e) {
        logger.error("[WB Public] getPage:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getSeo = async (req, res) => {
    try {
        const bundle = await wbPublic.getSeoBundle(req);
        if (bundle.error) return fail(res, bundle.error, bundle.status);
        return ok(res, bundle);
    } catch (e) {
        logger.error("[WB Public] getSeo:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getProduct = async (req, res) => {
    try {
        const bundle = await wbPublic.getProductBundle(req);
        if (bundle.error) return fail(res, bundle.error, bundle.status);
        return ok(res, bundle);
    } catch (e) {
        logger.error("[WB Public] getProduct:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Blog (mevcut) ────────────────────────────────────────────────────────────

exports.getBlogPosts = async (req, res) => {
    try {
        const site = await wbPublic.resolveSite(req);
        if (!site) return fail(res, "Site bulunamadı");

        const { page = 1, limit = 12, categorySlug, tag } = req.query;
        const filter = { siteId: site._id, status: "published" };

        if (categorySlug) {
            const cat = await WBBlogCategory.findOne({ siteId: site._id, slug: categorySlug }).lean();
            if (cat) filter.categoryId = cat._id;
        }
        if (tag) filter.tags = tag.toLowerCase();

        const [posts, total] = await Promise.all([
            WBBlogPost.find(filter)
                .select("title slug excerpt thumbnailUrl author publishedAt tags readingTimeMinutes categoryId isFeatured")
                .sort({ publishedAt: -1 })
                .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
                .limit(parseInt(limit, 10))
                .populate("categoryId", "name slug color")
                .lean(),
            WBBlogPost.countDocuments(filter),
        ]);

        const categories = await WBBlogCategory.find({ siteId: site._id }).lean();
        const store = await wbPublic.resolveStoreForSite(site);

        return ok(res, {
            posts,
            total,
            page: parseInt(page, 10),
            totalPages: Math.ceil(total / parseInt(limit, 10)),
            categories,
            site: { slug: site.slug, name: site.name, storeSlug: store?.slug || null },
        });
    } catch (e) {
        logger.error("[WB Public] getBlogPosts:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getBlogPost = async (req, res) => {
    try {
        const site = await wbPublic.resolveSite(req);
        if (!site) return fail(res, "Site bulunamadı");

        const post = await WBBlogPost.findOne({ siteId: site._id, slug: req.params.postSlug, status: "published" })
            .populate("categoryId", "name slug")
            .lean();
        if (!post) return fail(res, "Yazı bulunamadı");

        WBBlogPost.updateOne({ _id: post._id }, { $inc: { "stats.views": 1 } }).catch(() => {});

        const baseUrl = wbSeoService.getSiteBaseUrl(site);
        const metaTags = wbSeoService.buildMetaTags(post.seo, site);
        metaTags.canonicalUrl = `${baseUrl}/blog/${post.slug}`;
        metaTags.ogImage = metaTags.ogImage || post.thumbnailUrl || "";
        const structuredData = wbSeoService.generateBlogStructuredData(post, site, baseUrl);
        const jsonLd = [
            wbSeoService.generateOrganizationStructuredData(site, baseUrl),
            structuredData,
            wbSeoService.generateBreadcrumbStructuredData([
                { name: site.name, url: "/" },
                { name: "Blog", url: "/blog" },
                { name: post.title, url: `/blog/${post.slug}` },
            ], baseUrl),
            ...wbSeoService.parseJsonLdStrings(site, post.seo),
        ];
        const seo = wbSeoService.buildSeoBundle({ metaTags, jsonLd, baseUrl });

        const [prev, next] = await Promise.all([
            WBBlogPost.findOne({ siteId: site._id, status: "published", publishedAt: { $lt: post.publishedAt } })
                .select("title slug thumbnailUrl").sort({ publishedAt: -1 }).lean(),
            WBBlogPost.findOne({ siteId: site._id, status: "published", publishedAt: { $gt: post.publishedAt } })
                .select("title slug thumbnailUrl").sort({ publishedAt: 1 }).lean(),
        ]);

        return ok(res, { post, metaTags, seo, structuredData, prev, next, site: { slug: site.slug, name: site.name, baseUrl } });
    } catch (e) {
        logger.error("[WB Public] getBlogPost:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getSitemap = async (req, res) => {
    try {
        const site = await wbPublic.resolveSite(req);
        if (!site) return res.status(404).send("Not found");

        const baseUrl = wbSeoService.getSiteBaseUrl(site);
        const xml = await wbSeoService.generateSitemap(site._id, baseUrl);
        res.setHeader("Content-Type", "application/xml");
        return res.send(xml);
    } catch (e) {
        logger.error("[WB Public] getSitemap:", e.message);
        return res.status(500).send("");
    }
};

exports.getRobots = async (req, res) => {
    try {
        const site = await wbPublic.resolveSite(req);
        if (!site) return res.status(404).send("Not found");

        const baseUrl = wbSeoService.getSiteBaseUrl(site);
        const txt = wbSeoService.generateRobotsTxt(baseUrl, site.seo?.customRobots || "");
        res.setHeader("Content-Type", "text/plain");
        return res.send(txt);
    } catch (e) {
        logger.error("[WB Public] getRobots:", e.message);
        return res.status(500).send("");
    }
};

exports.getFormCaptcha = async (req, res) => {
    try {
        const site = await wbPublic.resolveSite(req);
        if (!site) return fail(res, "Site bulunamadı", 404);
        const wbFormCaptcha = require("../services/wbFormCaptcha");
        return ok(res, wbFormCaptcha.createChallenge());
    } catch (e) {
        logger.error("[WB Public] getFormCaptcha:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.submitForm = async (req, res) => {
    try {
        const site = await wbPublic.resolveSite(req);
        if (!site) return fail(res, "Site bulunamadı");

        const { pageId, sectionId, formId, fields, _hp, captchaId, captchaAnswer } = req.body;
        if (!fields || typeof fields !== "object") return fail(res, "Form alanları gerekli", 400);

        const wbFormSvc = require("../services/wbFormService");
        const result = await wbFormSvc.submitPublicForm(site, {
            formId,
            fields,
            pageId,
            sectionId,
            honeypot: _hp,
            captchaId,
            captchaAnswer,
            ip: req.ip || req.headers["x-forwarded-for"],
        });
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { message: result.message, redirectUrl: result.redirectUrl });
    } catch (e) {
        logger.error("[WB Public] submitForm:", e.message);
        return fail(res, e.message, 500);
    }
};
