"use strict";

const mongoose = require("mongoose");
const WBPopup = require("../models/WBPopup");
const WBSite = require("../models/WBSite");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

async function assertSite(siteId, userId) {
    return WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
}

function couponPresetSections(code = "INDIRIM10") {
    return [
        { id: "c1", type: "heading", order: 0, content: { text: "Özel Kuponunuz", level: 2 } },
        { id: "c2", type: "text", order: 1, content: { text: `Kodu kullanın: ${code}` } },
        { id: "c3", type: "button", order: 2, content: { text: "Kopyala", url: "#", style: "primary" } },
    ];
}

async function listPopups(siteId, userId) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const popups = await WBPopup.find({ siteId: toObjectId(siteId) }).sort({ updatedAt: -1 }).lean();
    return { popups };
}

async function createPopup(siteId, userId, body = {}) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const preset = body.preset === "coupon";
    const popup = await WBPopup.create({
        siteId: toObjectId(siteId),
        name: body.name || (preset ? "Kupon Popup" : "Yeni Popup"),
        status: body.status || "draft",
        type: body.type || "popup",
        trigger: {
            type: body.trigger?.type || (preset ? "exit_intent" : "time_delay"),
            delaySeconds: body.trigger?.delaySeconds ?? 3,
            scrollDepthPercent: body.trigger?.scrollDepthPercent ?? 50,
        },
        targeting: body.targeting || { pages: "all", devices: "all", frequency: "once_per_session" },
        design: {
            sections: body.design?.sections?.length
                ? body.design.sections
                : (preset ? couponPresetSections(body.couponCode) : [
                    { id: "h1", type: "heading", order: 0, content: { text: "Hoş geldiniz", level: 2 } },
                    { id: "t1", type: "text", order: 1, content: { text: "İlk siparişinize özel fırsatlar." } },
                ]),
            width: body.design?.width || "440px",
            overlay: true,
            showCloseButton: true,
        },
        schedule: body.schedule || {},
    });
    return { popup };
}

async function updatePopup(siteId, userId, popupId, updates) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const allowed = ["name", "status", "type", "trigger", "targeting", "design", "schedule"];
    const $set = {};
    allowed.forEach((k) => { if (updates[k] !== undefined) $set[k] = updates[k]; });
    const popup = await WBPopup.findOneAndUpdate(
        { _id: toObjectId(popupId), siteId: toObjectId(siteId) },
        { $set },
        { new: true }
    ).lean();
    if (!popup) return { error: "Popup bulunamadı" };
    return { popup };
}

async function deletePopup(siteId, userId, popupId) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const r = await WBPopup.deleteOne({ _id: toObjectId(popupId), siteId: toObjectId(siteId) });
    if (!r.deletedCount) return { error: "Popup bulunamadı" };
    return { success: true };
}

async function getPopupAnalytics(siteId, userId, period = "30d") {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const WBConversionEvent = require("../models/WBConversionEvent");
    const since = new Date(Date.now() - (period === "7d" ? 7 : 30) * 86400000);
    const popups = await WBPopup.find({ siteId: toObjectId(siteId) }).select("name status stats").lean();
    const events = await WBConversionEvent.aggregate([
        {
            $match: {
                siteId: toObjectId(siteId),
                eventType: { $in: ["popup_view", "popup_click", "popup_close"] },
                timestamp: { $gte: since },
            },
        },
        { $group: { _id: { popupId: "$popupId", eventType: "$eventType" }, count: { $sum: 1 } } },
    ]);
    const byPopup = {};
    events.forEach((e) => {
        const pid = String(e._id.popupId || "unknown");
        if (!byPopup[pid]) byPopup[pid] = { views: 0, clicks: 0, closes: 0 };
        if (e._id.eventType === "popup_view") byPopup[pid].views = e.count;
        if (e._id.eventType === "popup_click") byPopup[pid].clicks = e.count;
        if (e._id.eventType === "popup_close") byPopup[pid].closes = e.count;
    });
    return {
        period,
        popups: popups.map((p) => {
            const ev = byPopup[String(p._id)] || {};
            const views = ev.views || p.stats?.views || 0;
            const clicks = ev.clicks || p.stats?.clicks || 0;
            return {
                id: p._id,
                name: p.name,
                status: p.status,
                views,
                clicks,
                closes: ev.closes || 0,
                conversionRate: views ? Math.round((clicks / views) * 1000) / 10 : 0,
            };
        }),
    };
}

async function pickAbVariant(popup, sessionKey) {
    if (!popup.abTestVariantOf) return popup;
    const WBABTest = require("../models/WBABTest");
    const test = await WBABTest.findOne({
        siteId: popup.siteId,
        targetPopupId: popup._id,
        status: "running",
        testType: "popup",
    }).lean();
    if (!test?.variants?.length) return popup;
    const hash = [...sessionKey].reduce((a, c) => a + c.charCodeAt(0), 0);
    const total = test.variants.reduce((s, v) => s + (v.weight || 0), 0) || 100;
    let roll = hash % total;
    for (const v of test.variants) {
        roll -= v.weight || 0;
        if (roll < 0 && v.content) {
            return { ...popup, design: { ...popup.design, ...v.content }, _abVariantId: v.id };
        }
    }
    return popup;
}

async function getActivePopups(siteId, sessionKey = "") {
    const now = new Date();
    const popups = await WBPopup.find({
        siteId: toObjectId(siteId),
        status: "active",
        $or: [
            { "schedule.startAt": null, "schedule.endAt": null },
            { "schedule.startAt": { $lte: now }, "schedule.endAt": null },
            { "schedule.startAt": null, "schedule.endAt": { $gte: now } },
            { "schedule.startAt": { $lte: now }, "schedule.endAt": { $gte: now } },
        ],
    }).lean();
    const out = [];
    for (const p of popups) {
        out.push(sessionKey ? await pickAbVariant(p, sessionKey) : p);
    }
    return out;
}

async function incrementPopupStat(popupId, field) {
    const allowed = ["stats.views", "stats.clicks", "stats.closes"];
    if (!allowed.includes(field)) return;
    await WBPopup.updateOne({ _id: toObjectId(popupId) }, { $inc: { [field]: 1 } });
}

module.exports = {
    listPopups,
    createPopup,
    updatePopup,
    deletePopup,
    getActivePopups,
    getPopupAnalytics,
    incrementPopupStat,
    couponPresetSections,
};
