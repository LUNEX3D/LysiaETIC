"use strict";

const mongoose = require("mongoose");
const WBPage = require("../models/WBPage");
const WBPageRevision = require("../models/WBPageRevision");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

async function getNextRevisionNumber(pageId) {
    const last = await WBPageRevision.findOne({ pageId: toObjectId(pageId) })
        .sort({ revisionNumber: -1 })
        .select("revisionNumber")
        .lean();
    return (last?.revisionNumber || 0) + 1;
}

async function createRevision(siteId, pageId, userId, { label, themeVariablesSnapshot } = {}) {
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) }).lean();
    if (!page) return { error: "Sayfa bulunamadı" };

    const revisionNumber = await getNextRevisionNumber(pageId);
    const revision = await WBPageRevision.create({
        siteId: toObjectId(siteId),
        pageId: toObjectId(pageId),
        revisionNumber,
        label: label || `Kayıt #${revisionNumber}`,
        sections: JSON.parse(JSON.stringify(page.sections || [])),
        seo: page.seo ? JSON.parse(JSON.stringify(page.seo)) : null,
        themeVariablesSnapshot: themeVariablesSnapshot || null,
        createdBy: toObjectId(userId),
    });

    return { revision };
}

async function listRevisions(siteId, pageId, { limit = 30 } = {}) {
    const revisions = await WBPageRevision.find({
        siteId: toObjectId(siteId),
        pageId: toObjectId(pageId),
    })
        .sort({ revisionNumber: -1 })
        .limit(Math.min(limit, 100))
        .select("revisionNumber label createdAt createdBy")
        .lean();
    return { revisions };
}

async function restoreRevision(siteId, pageId, revisionId, userId) {
    const revision = await WBPageRevision.findOne({
        _id: toObjectId(revisionId),
        siteId: toObjectId(siteId),
        pageId: toObjectId(pageId),
    }).lean();
    if (!revision) return { error: "Revision bulunamadı" };

    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };

    await createRevision(siteId, pageId, userId, { label: `Geri yükleme öncesi (#${revision.revisionNumber})` });

    page.sections = revision.sections || [];
    if (revision.seo) page.seo = revision.seo;
    page.lastEditedBy = toObjectId(userId);
    page.lastEditedAt = new Date();
    await page.save();

    return { page: page.toObject(), restoredFrom: revision.revisionNumber };
}

module.exports = {
    createRevision,
    listRevisions,
    restoreRevision,
};
