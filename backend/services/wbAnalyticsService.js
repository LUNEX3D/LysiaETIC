"use strict";

const mongoose = require("mongoose");
const WBPageView = require("../models/WBPageView");
const WBConversionEvent = require("../models/WBConversionEvent");
const WBSite = require("../models/WBSite");
const logger = require("../config/logger");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function dateRange(period) {
    const now = new Date();
    const ranges = {
        "7d": new Date(now - 7 * 86400000),
        "30d": new Date(now - 30 * 86400000),
        "90d": new Date(now - 90 * 86400000),
        "today": new Date(now.setHours(0, 0, 0, 0)),
        "yesterday": (() => {
            const d = new Date(); d.setDate(d.getDate() - 1);
            d.setHours(0, 0, 0, 0); return d;
        })(),
    };
    return ranges[period] || ranges["30d"];
}

// ─── Event kayıt (public, auth gereksiz) ──────────────────────────────────────

async function recordPageView(siteId, data) {
    try {
        await WBPageView.create({ siteId: toObjectId(siteId), ...data, timestamp: new Date() });
    } catch (e) {
        logger.warn(`[WBAnalytics] pageview record fail: ${e.message}`);
    }
}

async function recordConversionEvent(siteId, data) {
    try {
        await WBConversionEvent.create({ siteId: toObjectId(siteId), ...data, timestamp: new Date() });
    } catch (e) {
        logger.warn(`[WBAnalytics] conversion record fail: ${e.message}`);
    }
}

// ─── Dashboard Özeti ──────────────────────────────────────────────────────────

async function getSummary(siteId, userId, period = "30d") {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const since = dateRange(period);
    const prevSince = new Date(since - (new Date() - since));

    const [
        currentViews, prevViews,
        currentVisitors, prevVisitors,
        currentOrders, prevOrders,
        topPages, devices, topSources,
        todayViews, topProducts,
    ] = await Promise.all([
        WBPageView.countDocuments({ siteId: toObjectId(siteId), timestamp: { $gte: since } }),
        WBPageView.countDocuments({ siteId: toObjectId(siteId), timestamp: { $gte: prevSince, $lt: since } }),
        WBPageView.distinct("visitorId", { siteId: toObjectId(siteId), timestamp: { $gte: since } }).then((v) => v.length),
        WBPageView.distinct("visitorId", { siteId: toObjectId(siteId), timestamp: { $gte: prevSince, $lt: since } }).then((v) => v.length),
        WBConversionEvent.countDocuments({ siteId: toObjectId(siteId), eventType: "purchase", timestamp: { $gte: since } }),
        WBConversionEvent.countDocuments({ siteId: toObjectId(siteId), eventType: "purchase", timestamp: { $gte: prevSince, $lt: since } }),
        WBPageView.aggregate([
            { $match: { siteId: toObjectId(siteId), timestamp: { $gte: since } } },
            { $group: { _id: "$pageSlug", views: { $sum: 1 }, avgTime: { $avg: "$timeOnPageSeconds" } } },
            { $sort: { views: -1 } }, { $limit: 10 },
        ]),
        WBPageView.aggregate([
            { $match: { siteId: toObjectId(siteId), timestamp: { $gte: since } } },
            { $group: { _id: "$device", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        WBPageView.aggregate([
            { $match: { siteId: toObjectId(siteId), timestamp: { $gte: since }, utmSource: { $ne: "" } } },
            { $group: { _id: "$utmSource", sessions: { $addToSet: "$sessionId" } } },
            { $project: { source: "$_id", count: { $size: "$sessions" } } },
            { $sort: { count: -1 } }, { $limit: 10 },
        ]),
        WBPageView.countDocuments({
            siteId: toObjectId(siteId),
            timestamp: { $gte: dateRange("today") },
        }),
        WBConversionEvent.aggregate([
            { $match: { siteId: toObjectId(siteId), eventType: "product_view", timestamp: { $gte: since }, productSlug: { $ne: "" } } },
            { $group: { _id: "$productSlug", views: { $sum: 1 }, productId: { $first: "$productId" } } },
            { $sort: { views: -1 } },
            { $limit: 5 },
        ]),
    ]);

    const change = (curr, prev) => prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

    return {
        period,
        summary: {
            pageViews: { value: currentViews, change: change(currentViews, prevViews) },
            visitors: { value: currentVisitors, change: change(currentVisitors, prevVisitors) },
            orders: { value: currentOrders, change: change(currentOrders, prevOrders) },
        },
        topPages,
        topProducts: topProducts.map((p) => ({ productSlug: p._id, views: p.views, productId: p.productId })),
        todayPageViews: todayViews,
        devices: devices.reduce((acc, d) => { acc[d._id] = d.count; return acc; }, {}),
        topSources,
    };
}

async function getPageStats(siteId, userId, { period = "30d", pageId } = {}) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const since = dateRange(period);
    const filter = { siteId: toObjectId(siteId), timestamp: { $gte: since } };
    if (pageId) filter.pageId = toObjectId(pageId);

    const stats = await WBPageView.aggregate([
        { $match: filter },
        {
            $group: {
                _id: { pageSlug: "$pageSlug", pageId: "$pageId" },
                views: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$visitorId" },
                avgTime: { $avg: "$timeOnPageSeconds" },
                avgScrollDepth: { $avg: "$scrollDepthPercent" },
                bounces: { $sum: { $cond: ["$isBounce", 1, 0] } },
            },
        },
        {
            $project: {
                pageSlug: "$_id.pageSlug",
                pageId: "$_id.pageId",
                views: 1,
                uniqueVisitors: { $size: "$uniqueVisitors" },
                avgTimeSeconds: { $round: ["$avgTime", 0] },
                avgScrollDepth: { $round: ["$avgScrollDepth", 1] },
                bounceRate: { $round: [{ $multiply: [{ $divide: ["$bounces", "$views"] }, 100] }, 1] },
            },
        },
        { $sort: { views: -1 } },
        { $limit: 50 },
    ]);

    return { stats };
}

async function getConversionFunnel(siteId, userId, period = "30d") {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const since = dateRange(period);
    const events = ["page_view", "product_view", "add_to_cart", "checkout_start", "purchase"];

    const counts = await Promise.all(
        events.map((ev) =>
            ev === "page_view"
                ? WBPageView.countDocuments({ siteId: toObjectId(siteId), timestamp: { $gte: since } })
                : WBConversionEvent.countDocuments({ siteId: toObjectId(siteId), eventType: ev, timestamp: { $gte: since } })
        )
    );

    return {
        funnel: events.map((ev, i) => ({
            step: ev,
            label: { page_view: "Sayfa Görüntüleme", product_view: "Ürün Görüntüleme", add_to_cart: "Sepete Ekleme", checkout_start: "Ödeme Başladı", purchase: "Satın Alındı" }[ev],
            count: counts[i],
            conversionRate: i === 0 ? 100 : counts[0] > 0 ? Math.round((counts[i] / counts[0]) * 100 * 10) / 10 : 0,
            dropoffRate: i === 0 ? 0 : counts[i - 1] > 0 ? Math.round((1 - counts[i] / counts[i - 1]) * 100 * 10) / 10 : 100,
        })),
    };
}

module.exports = {
    recordPageView,
    recordConversionEvent,
    getSummary,
    getPageStats,
    getConversionFunnel,
};
