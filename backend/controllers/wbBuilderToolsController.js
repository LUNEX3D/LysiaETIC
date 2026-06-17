"use strict";

const wbPopupSvc = require("../services/wbPopupService");
const wbFormSvc = require("../services/wbFormService");
const wbRedirectSvc = require("../services/wbRedirectService");
const wbSeoService = require("../services/wbSeoService");
const wbPublishOrchestrator = require("../services/wbPublishOrchestratorService");
const wbSeoEntityService = require("../services/wbSeoEntityService");
const wbPerformanceService = require("../services/wbPerformanceService");
const wbEmailDomainService = require("../services/wbEmailDomainService");
const WBSite = require("../models/WBSite");
const logger = require("../config/logger");

function toUserId(req) {
    return req.user?._id || req.user?.id;
}

function ok(res, data) { return res.json({ success: true, ...data }); }
function fail(res, message, status = 400) { return res.status(status).json({ success: false, error: message }); }

// ─── Popups ───────────────────────────────────────────────────────────────────

exports.listPopups = async (req, res) => {
    try {
        const result = await wbPopupSvc.listPopups(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { popups: result.popups });
    } catch (e) {
        logger.error("[WB Tools] listPopups:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.createPopup = async (req, res) => {
    try {
        const result = await wbPopupSvc.createPopup(req.params.siteId, toUserId(req), req.body);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { popup: result.popup });
    } catch (e) {
        logger.error("[WB Tools] createPopup:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updatePopup = async (req, res) => {
    try {
        const result = await wbPopupSvc.updatePopup(req.params.siteId, toUserId(req), req.params.popupId, req.body);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { popup: result.popup });
    } catch (e) {
        logger.error("[WB Tools] updatePopup:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.deletePopup = async (req, res) => {
    try {
        const result = await wbPopupSvc.deletePopup(req.params.siteId, toUserId(req), req.params.popupId);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB Tools] deletePopup:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Forms ────────────────────────────────────────────────────────────────────

exports.listForms = async (req, res) => {
    try {
        const result = await wbFormSvc.listForms(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { forms: result.forms });
    } catch (e) {
        logger.error("[WB Tools] listForms:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.createForm = async (req, res) => {
    try {
        const result = await wbFormSvc.createForm(req.params.siteId, toUserId(req), req.body);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { form: result.form });
    } catch (e) {
        logger.error("[WB Tools] createForm:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateForm = async (req, res) => {
    try {
        const result = await wbFormSvc.updateForm(req.params.siteId, toUserId(req), req.params.formId, req.body);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { form: result.form });
    } catch (e) {
        logger.error("[WB Tools] updateForm:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.deleteForm = async (req, res) => {
    try {
        const result = await wbFormSvc.deleteForm(req.params.siteId, toUserId(req), req.params.formId);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB Tools] deleteForm:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.listFormSubmissions = async (req, res) => {
    try {
        const result = await wbFormSvc.listSubmissions(req.params.siteId, toUserId(req), req.query);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] listFormSubmissions:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateFormSubmission = async (req, res) => {
    try {
        const result = await wbFormSvc.updateSubmission(req.params.siteId, toUserId(req), req.params.submissionId, req.body);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { submission: result.submission });
    } catch (e) {
        logger.error("[WB Tools] updateFormSubmission:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Redirects ──────────────────────────────────────────────────────────────

exports.listRedirects = async (req, res) => {
    try {
        const result = await wbRedirectSvc.getRedirects(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { redirects: result.redirects });
    } catch (e) {
        logger.error("[WB Tools] listRedirects:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.createRedirect = async (req, res) => {
    try {
        const result = await wbRedirectSvc.createRedirect(req.params.siteId, toUserId(req), req.body);
        if (result.error) return fail(res, result.error, 400);
        return ok(res, { redirect: result.redirect });
    } catch (e) {
        logger.error("[WB Tools] createRedirect:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateRedirect = async (req, res) => {
    try {
        const result = await wbRedirectSvc.updateRedirect(req.params.siteId, toUserId(req), req.params.redirectId, req.body);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { redirect: result.redirect });
    } catch (e) {
        logger.error("[WB Tools] updateRedirect:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.deleteRedirect = async (req, res) => {
    try {
        const result = await wbRedirectSvc.deleteRedirect(req.params.siteId, toUserId(req), req.params.redirectId);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WB Tools] deleteRedirect:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── SEO Center helpers ───────────────────────────────────────────────────────

exports.getFormAnalytics = async (req, res) => {
    try {
        const result = await wbFormSvc.getFormAnalytics(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] getFormAnalytics:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.exportFormSubmissions = async (req, res) => {
    try {
        const result = await wbFormSvc.exportSubmissionsCsv(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="form-submissions.csv"');
        return res.send(result.csv);
    } catch (e) {
        logger.error("[WB Tools] exportFormSubmissions:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getPopupAnalytics = async (req, res) => {
    try {
        const result = await wbPopupSvc.getPopupAnalytics(req.params.siteId, toUserId(req), req.query.period);
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] getPopupAnalytics:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getSeoCenter = async (req, res) => {
    try {
        const userId = toUserId(req);
        const site = await WBSite.findOne({ _id: req.params.siteId, userId }).lean();
        if (!site) return fail(res, "Site bulunamadı", 404);
        const baseUrl = wbSeoService.getSiteBaseUrl(site);
        const sitemapXml = await wbSeoService.generateSitemap(site._id, baseUrl);
        const robotsTxt = wbSeoService.generateRobotsTxt(site, baseUrl);
        const redirects = await wbRedirectSvc.getRedirects(req.params.siteId, userId);
        return ok(res, {
            site: { seo: site.seo, analytics: site.analytics, slug: site.slug, customDomain: site.customDomain },
            sitemapPreview: sitemapXml,
            robotsPreview: robotsTxt,
            redirects: redirects.redirects || [],
            urls: {
                sitemap: `${baseUrl}/sitemap.xml`,
                robots: `${baseUrl}/robots.txt`,
            },
        });
    } catch (e) {
        logger.error("[WB Tools] getSeoCenter:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Publish orchestrator ─────────────────────────────────────────────────────

exports.getPublishStatus = async (req, res) => {
    try {
        const result = await wbPublishOrchestrator.getPublishStatus(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, { publishStatus: result });
    } catch (e) {
        logger.error("[WB Tools] getPublishStatus:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.deploySite = async (req, res) => {
    try {
        const result = await wbPublishOrchestrator.deploySite(req.params.siteId, toUserId(req));
        if (result.error) {
            return res.status(400).json({ success: false, error: result.error, steps: result.steps || [] });
        }
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] deploySite:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.listSeoEntities = async (req, res) => {
    try {
        const result = await wbSeoEntityService.listEntities(
            req.params.siteId,
            toUserId(req),
            req.params.entityType,
            { page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 30, filter: req.query.filter }
        );
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] listSeoEntities:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateSeoEntity = async (req, res) => {
    try {
        const result = await wbSeoEntityService.updateEntitySeo(
            req.params.siteId,
            toUserId(req),
            req.params.entityType,
            req.params.entityId,
            req.body.seo || req.body
        );
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] updateSeoEntity:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.generateSeoAi = async (req, res) => {
    try {
        const { entityType, context } = req.body;
        if (!entityType) return fail(res, "entityType zorunlu");
        const result = await wbSeoEntityService.generateAiSeo(entityType, context || {});
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] generateSeoAi:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.bulkGenerateSeo = async (req, res) => {
    try {
        const { entityType, limit } = req.body;
        if (!entityType) return fail(res, "entityType zorunlu");
        const result = await wbSeoEntityService.bulkGenerateSeo(
            req.params.siteId,
            toUserId(req),
            entityType,
            { limit: limit || 20 }
        );
        if (result.error) return fail(res, result.error, 400);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] bulkGenerateSeo:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getPerformance = async (req, res) => {
    try {
        const result = await wbPerformanceService.getPerformance(
            req.params.siteId,
            toUserId(req),
            { refresh: req.query.refresh === "true" }
        );
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] getPerformance:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getEmailDomainStatus = async (req, res) => {
    try {
        const result = await wbEmailDomainService.getEmailDomainStatus(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] getEmailDomainStatus:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.verifyEmailDomain = async (req, res) => {
    try {
        const result = await wbEmailDomainService.verifyEmailDomain(req.params.siteId, toUserId(req));
        if (result.error) return fail(res, result.error, 404);
        return ok(res, result);
    } catch (e) {
        logger.error("[WB Tools] verifyEmailDomain:", e.message);
        return fail(res, e.message, 500);
    }
};
