"use strict";

const mongoose = require("mongoose");
const logger = require("../config/logger");
const productPageSvc = require("../services/wbProductPageService");

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    if (!id) return null;
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function ok(res, data, status = 200) { return res.status(status).json({ success: true, ...data }); }
function fail(res, message, status = 400) { return res.status(status).json({ success: false, error: message }); }

// ─── Product Page ─────────────────────────────────────────────────────────────

exports.getProductPage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await productPageSvc.getProductPage(req.params.siteId, userId);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { productPage: result.productPage });
    } catch (e) {
        logger.error("[WBProduct] getProductPage:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateProductPage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await productPageSvc.updateProductPage(req.params.siteId, userId, req.body);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { productPage: result.productPage });
    } catch (e) {
        logger.error("[WBProduct] updateProductPage:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.publishProductPage = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await productPageSvc.publishProductPage(req.params.siteId, userId);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { productPage: result.productPage });
    } catch (e) {
        logger.error("[WBProduct] publishProductPage:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.resetToDefault = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await productPageSvc.resetToDefault(req.params.siteId, userId);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { productPage: result.productPage });
    } catch (e) {
        logger.error("[WBProduct] resetToDefault:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Reviews ──────────────────────────────────────────────────────────────────

exports.getReviews = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { productId, status, page, limit, sort } = req.query;
        const result = await productPageSvc.getReviews(req.params.siteId, userId, {
            productId,
            status,
            page: parseInt(page) || 1,
            limit: Math.min(parseInt(limit) || 20, 100),
            sort: sort || "newest",
        });
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, result);
    } catch (e) {
        logger.error("[WBProduct] getReviews:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateReviewStatus = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await productPageSvc.updateReviewStatus(req.params.siteId, userId, req.params.reviewId, req.body);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { review: result.review });
    } catch (e) {
        logger.error("[WBProduct] updateReviewStatus:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await productPageSvc.deleteReview(req.params.siteId, userId, req.params.reviewId);
        if (result.error) return fail(res, result.error, result.status || 400);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WBProduct] deleteReview:", e.message);
        return fail(res, e.message, 500);
    }
};
