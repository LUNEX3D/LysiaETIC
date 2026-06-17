"use strict";

const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const WBProductPage = require("../models/WBProductPage");
const WBProductReview = require("../models/WBProductReview");
const WBSite = require("../models/WBSite");
const logger = require("../config/logger");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

// ─── Varsayılan product page sections ────────────────────────────────────────

function getDefaultProductSections() {
    return [
        {
            id: randomUUID(), type: "product-gallery", order: 0, isRequired: true,
            content: {
                thumbnailPosition: "bottom",
                zoomEnabled: true,
                lightboxEnabled: true,
                videoEnabled: true,
                aspectRatio: "square",
                thumbnailCount: 5,
            },
            settings: { paddingTop: "0", paddingBottom: "0" },
        },
        {
            id: randomUUID(), type: "product-price", order: 1, isRequired: true,
            content: {
                showOriginalPrice: true,
                showDiscount: true,
                showTax: "excluded",
                showInstallment: false,
                priceFormat: "full",
            },
            settings: {},
        },
        {
            id: randomUUID(), type: "product-variants", order: 2,
            content: {
                displayStyle: "button",
                unavailableStyle: "strikethrough",
                autoSelectFirst: true,
                showStock: true,
                stockThreshold: 5,
            },
            settings: {},
        },
        {
            id: randomUUID(), type: "add-to-cart", order: 3, isRequired: true,
            content: {
                quantitySelector: true,
                maxQuantity: 10,
                buyNowButton: true,
                wishlistButton: true,
                shareButton: false,
                notifyButton: true,
                buttonText: "Sepete Ekle",
                buyNowText: "Hemen Satın Al",
                stickyOnMobile: true,
                cartDrawer: true,
            },
            settings: {},
        },
        {
            id: randomUUID(), type: "product-description", order: 4,
            content: {
                source: "product_description",
                expandable: true,
                collapseThreshold: 200,
            },
            settings: { paddingTop: "24px" },
        },
        {
            id: randomUUID(), type: "product-specifications", order: 5,
            content: { style: "table", groupByCategory: true, showCompare: false },
            settings: { paddingTop: "16px" },
        },
        {
            id: randomUUID(), type: "product-reviews", order: 6,
            content: {
                displayStyle: "list",
                showSummary: true,
                showDistribution: true,
                perPage: 5,
                showImages: true,
                showVerified: true,
                allowSubmit: true,
            },
            settings: { paddingTop: "32px" },
        },
        {
            id: randomUUID(), type: "related-products", order: 7,
            content: {
                algorithm: "same_category",
                limit: 4,
                columns: 4,
                heading: "Benzer Ürünler",
                showPrice: true,
                showAddToCart: true,
            },
            settings: { paddingTop: "40px", paddingBottom: "40px" },
        },
    ];
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function getProductPage(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    let productPage = await WBProductPage.findOne({ siteId: toObjectId(siteId) }).lean();

    if (!productPage) {
        productPage = await WBProductPage.create({
            siteId: toObjectId(siteId),
            sections: getDefaultProductSections(),
            status: "draft",
        });
    }

    return { productPage };
}

async function updateProductPage(siteId, userId, updates) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const allowed = ["sections", "mobileSections", "dataBindings", "layoutConfig", "relatedProductsConfig", "reviewConfig", "layoutMode"];
    const sanitized = {
        lastEditedBy: toObjectId(userId),
        lastEditedAt: new Date(),
    };
    allowed.forEach((k) => { if (updates[k] !== undefined) sanitized[k] = updates[k]; });

    const productPage = await WBProductPage.findOneAndUpdate(
        { siteId: toObjectId(siteId) },
        { $set: sanitized, $inc: { draftVersion: 1 } },
        { upsert: true, new: true }
    ).lean();

    return { productPage };
}

async function publishProductPage(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const productPage = await WBProductPage.findOneAndUpdate(
        { siteId: toObjectId(siteId) },
        { $set: { status: "active", publishedAt: new Date() }, $inc: { publishedVersion: 1 } },
        { new: true }
    ).lean();

    return { productPage };
}

async function resetToDefault(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const productPage = await WBProductPage.findOneAndUpdate(
        { siteId: toObjectId(siteId) },
        { $set: { sections: getDefaultProductSections(), lastEditedBy: toObjectId(userId), lastEditedAt: new Date() }, $inc: { draftVersion: 1 } },
        { upsert: true, new: true }
    ).lean();

    return { productPage };
}

// ─── Product Reviews ──────────────────────────────────────────────────────────

async function getReviews(siteId, userId, { productId, status, page = 1, limit = 20, sort = "newest" } = {}) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const filter = { siteId: toObjectId(siteId) };
    if (productId) filter.productId = toObjectId(productId);
    if (status) filter.status = status;

    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, highest: { rating: -1 }, lowest: { rating: 1 }, helpful: { "votes.helpful": -1 } };
    const sortQuery = sortMap[sort] || sortMap.newest;

    const [reviews, total] = await Promise.all([
        WBProductReview.find(filter).sort(sortQuery).skip((page - 1) * limit).limit(limit).lean(),
        WBProductReview.countDocuments(filter),
    ]);

    return { reviews, total, page, totalPages: Math.ceil(total / limit) };
}

async function updateReviewStatus(siteId, userId, reviewId, { status, moderationNote, sellerResponse }) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const updates = {};
    if (status) { updates.status = status; updates.moderatedBy = toObjectId(userId); updates.moderatedAt = new Date(); }
    if (moderationNote !== undefined) updates.moderationNote = moderationNote;
    if (sellerResponse?.text) {
        updates["sellerResponse.text"] = sellerResponse.text;
        updates["sellerResponse.respondedAt"] = new Date();
        updates["sellerResponse.respondedBy"] = toObjectId(userId);
    }

    const review = await WBProductReview.findOneAndUpdate(
        { _id: toObjectId(reviewId), siteId: toObjectId(siteId) },
        { $set: updates },
        { new: true }
    ).lean();

    if (!review) return { error: "Değerlendirme bulunamadı", status: 404 };
    return { review };
}

async function deleteReview(siteId, userId, reviewId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const result = await WBProductReview.deleteOne({ _id: toObjectId(reviewId), siteId: toObjectId(siteId) });
    if (result.deletedCount === 0) return { error: "Değerlendirme bulunamadı", status: 404 };
    return { success: true };
}

async function submitPublicReview(siteId, { productId, reviewerName, reviewerEmail, rating, title, body, images = [] }) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), status: "published" }).lean();
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const productPage = await WBProductPage.findOne({ siteId: toObjectId(siteId) }).lean();
    const autoApprove = productPage?.reviewConfig?.autoApprove || false;

    const review = await WBProductReview.create({
        siteId: toObjectId(siteId),
        productId: toObjectId(productId),
        reviewer: { name: reviewerName, email: reviewerEmail },
        rating: Math.min(5, Math.max(1, rating)),
        title: title || "",
        body,
        images,
        status: autoApprove ? "approved" : "pending",
        source: "web",
    });

    return { review, message: autoApprove ? "Değerlendirmeniz yayınlandı!" : "Değerlendirmeniz inceleme için gönderildi." };
}

async function getProductRatingSummary(siteId, productId) {
    const pipeline = [
        { $match: { siteId: toObjectId(siteId), productId: toObjectId(productId), status: "approved" } },
        {
            $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                total: { $sum: 1 },
                star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
                star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
                star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
                star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
                star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
            },
        },
    ];

    const result = await WBProductReview.aggregate(pipeline);
    if (!result.length) return { avgRating: 0, total: 0, distribution: {} };

    const r = result[0];
    return {
        avgRating: Math.round(r.avgRating * 10) / 10,
        total: r.total,
        distribution: { 5: r.star5, 4: r.star4, 3: r.star3, 2: r.star2, 1: r.star1 },
    };
}

module.exports = {
    getDefaultProductSections,
    getProductPage,
    updateProductPage,
    publishProductPage,
    resetToDefault,
    getReviews,
    updateReviewStatus,
    deleteReview,
    submitPublicReview,
    getProductRatingSummary,
};
