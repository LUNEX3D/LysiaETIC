const StoreCustomFieldDefinition = require("../models/StoreCustomFieldDefinition");
const { CUSTOM_FIELD_TYPES } = require("../models/StoreCustomFieldDefinition");

function fieldKey(name, id) {
    const base = String(name || "alan")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return base || `alan-${String(id).slice(-6)}`;
}

function normalizeFieldType(type) {
    return CUSTOM_FIELD_TYPES.includes(type) ? type : "html";
}

async function listDefinitions(storeId) {
    return StoreCustomFieldDefinition.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
}

async function createDefinition(storeId, body) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Alan adı gerekli" };
    const type = normalizeFieldType(body.type);
    let key = fieldKey(body.key || name, "new");
    const exists = await StoreCustomFieldDefinition.findOne({ storeId, key }).lean();
    if (exists) key = `${key}-${Date.now().toString(36).slice(-4)}`;
    const maxSort = await StoreCustomFieldDefinition.findOne({ storeId })
        .sort({ sortOrder: -1 })
        .select("sortOrder")
        .lean();
    const doc = await StoreCustomFieldDefinition.create({
        storeId,
        name,
        key,
        type,
        options: Array.isArray(body.options) ? body.options.filter(Boolean) : [],
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    return { field: doc.toObject() };
}

async function updateDefinition(storeId, fieldId, body) {
    const doc = await StoreCustomFieldDefinition.findOne({ _id: fieldId, storeId });
    if (!doc) return { error: "Alan bulunamadı" };
    if (body.name != null) {
        const name = String(body.name).trim();
        if (!name) return { error: "Alan adı gerekli" };
        doc.name = name;
    }
    if (body.type != null) doc.type = normalizeFieldType(body.type);
    if (body.options != null) {
        doc.options = Array.isArray(body.options) ? body.options.filter(Boolean) : [];
    }
    await doc.save();
    return { field: doc.toObject() };
}

async function deleteDefinition(storeId, fieldId) {
    const r = await StoreCustomFieldDefinition.deleteOne({ _id: fieldId, storeId });
    if (!r.deletedCount) return { error: "Alan bulunamadı" };
    return { ok: true };
}

function normalizeProductCustomFields(raw, definitionsById) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            const fieldId = String(item.fieldId || item._id || "");
            const def = definitionsById.get(fieldId);
            if (!def && !item.name) return null;
            return {
                fieldId,
                name: def?.name || item.name || "",
                type: def?.type || item.type || "html",
                key: def?.key || item.key || "",
                value: item.value != null ? String(item.value) : "",
            };
        })
        .filter(Boolean);
}

function productCustomFieldsPayload(customFields) {
    if (!Array.isArray(customFields)) return undefined;
    return customFields.map((f) => ({
        fieldId: f.fieldId,
        value: f.value != null ? String(f.value) : "",
    }));
}

module.exports = {
    listDefinitions,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    normalizeProductCustomFields,
    productCustomFieldsPayload,
};
