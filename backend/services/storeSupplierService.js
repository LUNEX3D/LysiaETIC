const StoreSupplier = require("../models/StoreSupplier");

const NAME_MAX = 100;

function normalizeBody(body) {
    return {
        name: String(body.name || "").trim().slice(0, NAME_MAX),
        email: String(body.email || "").trim(),
        phoneCountryCode: String(body.phoneCountryCode || "+90").trim() || "+90",
        phone: String(body.phone || "").trim(),
        company: String(body.company || "").trim(),
        contactName: String(body.contactName || "").trim(),
        taxNumber: String(body.taxNumber || "").trim(),
        taxOffice: String(body.taxOffice || "").trim(),
        address: String(body.address || "").trim(),
    };
}

function formatPhone(row) {
    if (!row?.phone) return "";
    const code = row.phoneCountryCode || "";
    return code ? `${code} ${row.phone}`.trim() : row.phone;
}

async function listSuppliers(storeId) {
    const rows = await StoreSupplier.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
    return rows.map((row) => ({ ...row, phoneDisplay: formatPhone(row) }));
}

async function getSupplier(storeId, id) {
    const doc = await StoreSupplier.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Tedarikçi bulunamadı" };
    return { supplier: { ...doc, phoneDisplay: formatPhone(doc) } };
}

async function createSupplier(storeId, body) {
    const data = normalizeBody(body);
    if (!data.name) return { error: "Tedarikçi adı gerekli" };
    const maxSort = await StoreSupplier.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const doc = await StoreSupplier.create({
        storeId,
        ...data,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    const row = doc.toObject();
    return { supplier: { ...row, phoneDisplay: formatPhone(row) } };
}

async function updateSupplier(storeId, id, body) {
    const doc = await StoreSupplier.findOne({ _id: id, storeId });
    if (!doc) return { error: "Tedarikçi bulunamadı" };
    const data = normalizeBody({ ...doc.toObject(), ...body });
    if (!data.name) return { error: "Tedarikçi adı gerekli" };
    Object.assign(doc, data);
    await doc.save();
    const row = doc.toObject();
    return { supplier: { ...row, phoneDisplay: formatPhone(row) } };
}

async function deleteSupplier(storeId, id) {
    const r = await StoreSupplier.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Tedarikçi bulunamadı" };
    return { ok: true };
}

module.exports = {
    listSuppliers,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    NAME_MAX,
};
