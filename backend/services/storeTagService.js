const StoreTag = require("../models/StoreTag");

const NAME_MAX = 100;

function normalizeBody(body) {
    return {
        name: String(body.name || "").trim().slice(0, NAME_MAX),
    };
}

async function findDuplicateName(storeId, name, excludeId = null) {
    const q = {
        storeId,
        name: { $regex: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    };
    if (excludeId) q._id = { $ne: excludeId };
    return StoreTag.findOne(q).lean();
}

async function listTags(storeId) {
    return StoreTag.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
}

async function getTag(storeId, id) {
    const doc = await StoreTag.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Etiket bulunamadı" };
    return { tag: doc };
}

async function createTag(storeId, body) {
    const data = normalizeBody(body);
    if (!data.name) return { error: "Etiket adı gerekli" };
    const dup = await findDuplicateName(storeId, data.name);
    if (dup) return { error: "Bu isimde bir etiket zaten var" };
    const maxSort = await StoreTag.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const doc = await StoreTag.create({
        storeId,
        ...data,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    return { tag: doc.toObject() };
}

async function updateTag(storeId, id, body) {
    const doc = await StoreTag.findOne({ _id: id, storeId });
    if (!doc) return { error: "Etiket bulunamadı" };
    const data = normalizeBody({ ...doc.toObject(), ...body });
    if (!data.name) return { error: "Etiket adı gerekli" };
    const dup = await findDuplicateName(storeId, data.name, doc._id);
    if (dup) return { error: "Bu isimde bir etiket zaten var" };
    doc.name = data.name;
    await doc.save();
    return { tag: doc.toObject() };
}

async function deleteTag(storeId, id) {
    const r = await StoreTag.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Etiket bulunamadı" };
    return { ok: true };
}

module.exports = {
    listTags,
    getTag,
    createTag,
    updateTag,
    deleteTag,
    NAME_MAX,
};
