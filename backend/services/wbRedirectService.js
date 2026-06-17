"use strict";

const mongoose = require("mongoose");
const WBRedirect = require("../models/WBRedirect");
const WBSite = require("../models/WBSite");
const { sanitizeRedirectTarget } = require("../utils/wbSecurity");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

async function getRedirects(siteId, userId, { isActive } = {}) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };
    const filter = { siteId: toObjectId(siteId) };
    if (isActive !== undefined) filter.isActive = isActive;
    const redirects = await WBRedirect.find(filter).sort({ createdAt: -1 }).lean();
    return { redirects };
}

async function createRedirect(siteId, userId, { fromPath, toPath, type = "301", matchType = "exact" }) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };
    if (!fromPath || !toPath) return { error: "Kaynak ve hedef path zorunlu" };
    const safeTo = sanitizeRedirectTarget(toPath);
    if (!safeTo) return { error: "Geçersiz hedef URL (sadece site içi path veya https)" };
    const safeFrom = String(fromPath).trim();
    if (!safeFrom.startsWith("/")) return { error: "Kaynak path / ile başlamalı" };

    const existing = await WBRedirect.findOne({ siteId: toObjectId(siteId), fromPath: safeFrom });
    if (existing) return { error: "Bu path için zaten bir yönlendirme mevcut" };

    const redirect = await WBRedirect.create({
        siteId: toObjectId(siteId),
        fromPath: safeFrom,
        toPath: safeTo,
        type, matchType, isActive: true,
        createdBy: "manual",
    });
    return { redirect };
}

async function updateRedirect(siteId, userId, redirectId, updates) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const allowed = ["toPath", "type", "matchType", "isActive"];
    const sanitized = {};
    allowed.forEach((k) => { if (updates[k] !== undefined) sanitized[k] = updates[k]; });

    const redirect = await WBRedirect.findOneAndUpdate(
        { _id: toObjectId(redirectId), siteId: toObjectId(siteId) },
        { $set: sanitized },
        { new: true }
    );
    if (!redirect) return { error: "Yönlendirme bulunamadı" };
    return { redirect };
}

async function deleteRedirect(siteId, userId, redirectId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };
    const result = await WBRedirect.deleteOne({ _id: toObjectId(redirectId), siteId: toObjectId(siteId) });
    if (result.deletedCount === 0) return { error: "Yönlendirme bulunamadı" };
    return { success: true };
}

async function bulkImport(siteId, userId, rows) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const ops = rows
        .filter((r) => r.from && r.to)
        .map((r) => ({
            updateOne: {
                filter: { siteId: toObjectId(siteId), fromPath: r.from.trim() },
                update: { $set: { siteId: toObjectId(siteId), fromPath: r.from.trim(), toPath: r.to.trim(), type: r.type || "301", matchType: "exact", isActive: true, createdBy: "manual" } },
                upsert: true,
            },
        }));

    if (!ops.length) return { error: "Geçerli satır bulunamadı" };
    const result = await WBRedirect.bulkWrite(ops);
    return { imported: result.upsertedCount + result.modifiedCount };
}

async function resolveRedirect(siteId, path) {
    if (!path) return null;
    const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;

    const exact = await WBRedirect.findOneAndUpdate(
        { siteId: toObjectId(siteId), fromPath: { $in: [path, normalizedPath] }, matchType: "exact", isActive: true },
        { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } },
        { new: true }
    ).lean();
    if (exact) return { to: exact.toPath, type: exact.type };

    const prefixList = await WBRedirect.find({
        siteId: toObjectId(siteId), matchType: "prefix", isActive: true,
    }).sort({ fromPath: -1 }).lean();
    const prefix = prefixList.find((r) => path.startsWith(r.fromPath));
    if (prefix) {
        const to = prefix.toPath + path.slice(prefix.fromPath.length);
        await WBRedirect.updateOne({ _id: prefix._id }, { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } });
        return { to, type: prefix.type };
    }

    return null;
}

async function createSystemRedirect(siteId, fromPath, toPath) {
    await WBRedirect.findOneAndUpdate(
        { siteId: toObjectId(siteId), fromPath },
        { $set: { siteId: toObjectId(siteId), fromPath, toPath, type: "301", matchType: "exact", isActive: true, createdBy: "system" } },
        { upsert: true }
    );
}

module.exports = { getRedirects, createRedirect, updateRedirect, deleteRedirect, bulkImport, resolveRedirect, createSystemRedirect };
