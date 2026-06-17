const StoreUnit = require("../models/StoreUnit");

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
    return StoreUnit.findOne(q).lean();
}

async function listUnits(storeId) {
    return StoreUnit.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
}

async function getUnit(storeId, id) {
    const doc = await StoreUnit.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Birim bulunamadı" };
    return { unit: doc };
}

async function createUnit(storeId, body) {
    const data = normalizeBody(body);
    if (!data.name) return { error: "Birim adı gerekli" };
    const dup = await findDuplicateName(storeId, data.name);
    if (dup) return { error: "Bu isimde bir birim zaten var" };
    const maxSort = await StoreUnit.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const doc = await StoreUnit.create({
        storeId,
        ...data,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    return { unit: doc.toObject() };
}

async function updateUnit(storeId, id, body) {
    const doc = await StoreUnit.findOne({ _id: id, storeId });
    if (!doc) return { error: "Birim bulunamadı" };
    const data = normalizeBody({ ...doc.toObject(), ...body });
    if (!data.name) return { error: "Birim adı gerekli" };
    const dup = await findDuplicateName(storeId, data.name, doc._id);
    if (dup) return { error: "Bu isimde bir birim zaten var" };
    doc.name = data.name;
    await doc.save();
    return { unit: doc.toObject() };
}

async function deleteUnit(storeId, id) {
    const r = await StoreUnit.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Birim bulunamadı" };
    return { ok: true };
}

module.exports = {
    listUnits,
    getUnit,
    createUnit,
    updateUnit,
    deleteUnit,
    NAME_MAX,
};
