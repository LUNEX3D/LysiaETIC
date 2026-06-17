const StoreVariantType = require("../models/StoreVariantType");

function normalizeValues(raw) {
    return (Array.isArray(raw) ? raw : [])
        .map((v, i) => ({
            label: String(v?.label || "").trim(),
            colorHex: String(v?.colorHex || "").trim(),
            imageUrl: String(v?.imageUrl || "").trim(),
            sortOrder: Number.isFinite(Number(v?.sortOrder)) ? Number(v.sortOrder) : i,
        }))
        .filter((v) => v.label);
}

function normalizePayload(body) {
    const name = String(body?.name || "").trim().slice(0, 100);
    const displayStyle = body?.displayStyle === "color_image" ? "color_image" : "list";
    const values = normalizeValues(body?.values).map((v, i) => ({ ...v, sortOrder: i }));
    return { name, displayStyle, values };
}

async function listVariantTypes(storeId) {
    return StoreVariantType.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
}

async function getVariantType(storeId, id) {
    const doc = await StoreVariantType.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Varyant türü bulunamadı" };
    return { variantType: doc };
}

async function createVariantType(storeId, body) {
    const payload = normalizePayload(body);
    if (!payload.name) return { error: "Varyant türü adı gerekli" };
    if (!payload.values.length) return { error: "En az bir varyant değeri gerekli" };
    const maxSort = await StoreVariantType.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const doc = await StoreVariantType.create({
        storeId,
        ...payload,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    return { variantType: doc.toObject() };
}

async function updateVariantType(storeId, id, body) {
    const doc = await StoreVariantType.findOne({ _id: id, storeId });
    if (!doc) return { error: "Varyant türü bulunamadı" };
    const payload = normalizePayload({ ...doc.toObject(), ...body });
    if (!payload.name) return { error: "Varyant türü adı gerekli" };
    if (!payload.values.length) return { error: "En az bir varyant değeri gerekli" };
    doc.name = payload.name;
    doc.displayStyle = payload.displayStyle;
    doc.values = payload.values;
    await doc.save();
    return { variantType: doc.toObject() };
}

async function deleteVariantType(storeId, id) {
    const r = await StoreVariantType.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Varyant türü bulunamadı" };
    return { ok: true };
}

function exportVariantTypesCsv(rows) {
    const header = "name,display_style,values";
    const lines = (rows || []).map((row) => {
        const values = (row.values || [])
            .map((v) => v.label)
            .join("|");
        const cols = [row.name, row.displayStyle || "list", values].map(
            (v) => `"${String(v || "").replace(/"/g, '""')}"`
        );
        return cols.join(",");
    });
    return `${header}\n${lines.join("\n")}`;
}

module.exports = {
    listVariantTypes,
    getVariantType,
    createVariantType,
    updateVariantType,
    deleteVariantType,
    exportVariantTypesCsv,
};
