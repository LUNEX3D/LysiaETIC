"use strict";

const mongoose = require("mongoose");
const logger = require("../config/logger");
const analyticsSvc = require("../services/wbAnalyticsService");
const { checkRateLimit, getClientIp } = require("../utils/wbRateLimit");

const PAGEVIEW_LIMIT = { windowMs: 60 * 1000, max: 120 };
const EVENT_LIMIT = { windowMs: 60 * 1000, max: 90 };

const ALLOWED_EVENT_TYPES = new Set([
    "page_view", "product_view", "add_to_cart", "remove_from_cart",
    "checkout_start", "checkout_complete", "purchase", "signup", "login",
    "form_submit", "popup_view", "popup_click", "popup_close",
    "search", "wishlist_add", "share",
]);

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    if (!id) return null;
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function ok(res, data, status = 200) { return res.status(status).json({ success: true, ...data }); }
function fail(res, message, status = 400) { return res.status(status).json({ success: false, error: message }); }

// ─── Admin (kimlik doğrulamalı) ───────────────────────────────────────────────

exports.getSummary = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await analyticsSvc.getSummary(req.params.siteId, userId, req.query.period || "30d");
        if (result.error) return fail(res, result.error);
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAnalytics] getSummary:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getPageStats = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await analyticsSvc.getPageStats(req.params.siteId, userId, {
            period: req.query.period || "30d",
            pageId: req.query.pageId,
        });
        if (result.error) return fail(res, result.error);
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAnalytics] getPageStats:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getConversionFunnel = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await analyticsSvc.getConversionFunnel(req.params.siteId, userId, req.query.period || "30d");
        if (result.error) return fail(res, result.error);
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAnalytics] getConversionFunnel:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Public (auth gerektirmez, rate-limited) ──────────────────────────────────

exports.recordPageView = async (req, res) => {
    try {
        const slug = req.params.slug;
        if (!slug) return res.status(200).json({ ok: true });

        const ip = getClientIp(req);
        if (!checkRateLimit(`wb:pv:${ip}:${slug}`, PAGEVIEW_LIMIT)) {
            return res.status(429).json({ ok: false, error: "rate_limited" });
        }

        const siteId = (await require("../models/WBSite").findOne({ slug }).select("_id").lean())?._id;

        if (!siteId) return res.status(200).json({ ok: true });

        await analyticsSvc.recordPageView(siteId, {
            pageSlug: req.body.pageSlug || "",
            sessionId: req.body.sessionId || "",
            visitorId: req.body.visitorId || "",
            isNewVisitor: req.body.isNewVisitor !== false,
            referrer: req.body.referrer || req.headers.referer || "",
            utmSource: req.body.utm_source || "",
            utmMedium: req.body.utm_medium || "",
            utmCampaign: req.body.utm_campaign || "",
            device: req.body.device || "unknown",
            browser: req.body.browser || "",
            country: req.body.country || "",
        });

        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(200).json({ ok: true });
    }
};

exports.recordConversionEvent = async (req, res) => {
    try {
        const slug = req.params.slug;
        const eventType = req.body?.eventType;
        if (!slug || !eventType) return res.status(200).json({ ok: true });

        if (!ALLOWED_EVENT_TYPES.has(eventType)) {
            return res.status(400).json({ ok: false, error: "invalid_event" });
        }

        const ip = getClientIp(req);
        if (!checkRateLimit(`wb:ev:${ip}:${slug}`, EVENT_LIMIT)) {
            return res.status(429).json({ ok: false, error: "rate_limited" });
        }

        const siteId = (await require("../models/WBSite").findOne({ slug }).select("_id").lean())?._id;

        if (!siteId) return res.status(200).json({ ok: true });

        await analyticsSvc.recordConversionEvent(siteId, {
            eventType,
            sessionId: req.body.sessionId || "",
            visitorId: req.body.visitorId || "",
            value: req.body.value || 0,
            currency: req.body.currency || "TRY",
            productId: req.body.productId,
            sourcePageSlug: req.body.pageSlug || "",
            sourceSectionId: req.body.sectionId || "",
            sourceBlockType: req.body.blockType || "",
            device: req.body.device || "unknown",
            popupId: req.body.popupId,
            formId: req.body.formId,
            abVariantId: req.body.abVariantId,
            metadata: req.body.metadata || {},
        });

        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(200).json({ ok: true });
    }
};
