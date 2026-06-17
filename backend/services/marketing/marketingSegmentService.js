const MarketingSegment = require("../../models/MarketingSegment");
const { countSegmentMembers, listSegmentMembers } = require("./segmentEvaluator");

async function listSegments(storeId) {
    return MarketingSegment.find({ storeId }).sort({ updatedAt: -1 }).lean();
}

async function getSegment(storeId, id) {
    return MarketingSegment.findOne({ _id: id, storeId }).lean();
}

async function createSegment(storeId, userId, body) {
    const doc = await MarketingSegment.create({
        storeId,
        userId,
        name: body.name,
        description: body.description || "",
        isDynamic: body.isDynamic !== false,
        rules: body.rules || { logic: "and", rules: [] },
    });
    const count = await countSegmentMembers(storeId, doc.rules);
    doc.cachedCount = count;
    doc.lastCountedAt = new Date();
    await doc.save();
    return doc.toObject();
}

async function updateSegment(storeId, id, body) {
    const patch = {};
    for (const k of ["name", "description", "isDynamic", "rules"]) {
        if (body[k] !== undefined) patch[k] = body[k];
    }
    const doc = await MarketingSegment.findOneAndUpdate({ _id: id, storeId }, { $set: patch }, { new: true });
    if (!doc) return null;
    if (patch.rules) {
        doc.cachedCount = await countSegmentMembers(storeId, doc.rules);
        doc.lastCountedAt = new Date();
        await doc.save();
    }
    return doc.toObject();
}

async function deleteSegment(storeId, id) {
    await MarketingSegment.deleteOne({ _id: id, storeId });
    return { ok: true };
}

async function previewSegment(storeId, rules) {
    const count = await countSegmentMembers(storeId, rules);
    const sample = await listSegmentMembers(storeId, rules, 10);
    return { count, sample };
}

async function refreshSegmentCount(storeId, id) {
    const seg = await MarketingSegment.findOne({ _id: id, storeId });
    if (!seg) return null;
    seg.cachedCount = await countSegmentMembers(storeId, seg.rules);
    seg.lastCountedAt = new Date();
    await seg.save();
    return seg.toObject();
}

module.exports = {
    listSegments,
    getSegment,
    createSegment,
    updateSegment,
    deleteSegment,
    previewSegment,
    refreshSegmentCount,
};
