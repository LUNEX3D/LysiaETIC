const StoreProductPersonalization = require("../models/StoreProductPersonalization");
const { getEffectivePlan, hasFeature } = require("./planFeatureService");

const NAME_MAX = 100;
const PAID_FEATURE = "product_personalization_pricing";

function allowPaidPricing(user) {
    if (!user) return false;
    if (["admin", "dev"].includes(user.role)) return true;
    return hasFeature(getEffectivePlan(user), PAID_FEATURE);
}

function normalizeValues(raw, allowPaid) {
    return (Array.isArray(raw) ? raw : [])
        .map((v, i) => ({
            label: String(v.label || "").trim(),
            priceType: allowPaid && v.priceType === "percent" ? "percent" : "fixed",
            price: allowPaid ? Number(v.price) || 0 : 0,
            sortOrder: Number.isFinite(Number(v.sortOrder)) ? Number(v.sortOrder) : i,
        }))
        .filter((v) => v.label)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v, i) => ({ ...v, sortOrder: i }));
}

function normalizeOption(raw, allowPaid) {
    const type = raw.type || "yes_no";
    const option = {
        title: String(raw.title || "").trim(),
        description: String(raw.description || "").trim(),
        showDescription: !!raw.showDescription,
        type,
        selectionStyle: ["box", "list", "color_image"].includes(raw.selectionStyle)
            ? raw.selectionStyle
            : "list",
        minSelection: raw.minSelection != null && raw.minSelection !== "" ? Number(raw.minSelection) : undefined,
        maxSelection: raw.maxSelection != null && raw.maxSelection !== "" ? Number(raw.maxSelection) : undefined,
        minChars: raw.minChars != null && raw.minChars !== "" ? Number(raw.minChars) : undefined,
        maxChars: raw.maxChars != null && raw.maxChars !== "" ? Number(raw.maxChars) : undefined,
        dateStartDays:
            raw.dateStartDays != null && raw.dateStartDays !== "" ? Number(raw.dateStartDays) : undefined,
        dateEndDays: raw.dateEndDays != null && raw.dateEndDays !== "" ? Number(raw.dateEndDays) : undefined,
        minFiles: raw.minFiles != null && raw.minFiles !== "" ? Number(raw.minFiles) : undefined,
        maxFiles: raw.maxFiles != null && raw.maxFiles !== "" ? Number(raw.maxFiles) : undefined,
        allowedExtensions: (Array.isArray(raw.allowedExtensions) ? raw.allowedExtensions : [])
            .map((e) => String(e || "").trim().replace(/^\./, ""))
            .filter(Boolean),
        values: type === "selection" ? normalizeValues(raw.values, allowPaid) : [],
        isPaid: allowPaid && !!raw.isPaid,
        priceType: allowPaid && raw.priceType === "percent" ? "percent" : "fixed",
        fixedPrice: allowPaid && raw.isPaid ? Number(raw.fixedPrice) || 0 : 0,
        pricePercent: allowPaid && raw.isPaid && raw.priceType === "percent" ? Number(raw.pricePercent) || 0 : 0,
        required: !!raw.required,
        dependsOnOptionId: raw.dependsOnOptionId || undefined,
        sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 0,
    };
    if (raw._id) option._id = raw._id;
    return option;
}

function normalizeOptions(raw, allowPaid) {
    return (Array.isArray(raw) ? raw : [])
        .map((o, i) => normalizeOption({ ...o, sortOrder: o.sortOrder ?? i }, allowPaid))
        .filter((o) => o.title)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o, i) => ({ ...o, sortOrder: i }));
}

function serializeRow(doc) {
    const row = doc.toObject ? doc.toObject() : { ...doc };
    row.optionCount = row.options?.length || 0;
    return row;
}

async function listPersonalizations(storeId) {
    const rows = await StoreProductPersonalization.find({ storeId })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    return rows.map((r) => ({ ...r, optionCount: r.options?.length || 0 }));
}

async function getPersonalization(storeId, id) {
    const doc = await StoreProductPersonalization.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Kişiselleştirme bulunamadı" };
    return { personalization: { ...doc, optionCount: doc.options?.length || 0 } };
}

async function createPersonalization(storeId, body, user) {
    const allowPaid = allowPaidPricing(user);
    const name = String(body.name || "").trim().slice(0, NAME_MAX);
    if (!name) return { error: "Kişiselleştirme adı gerekli" };
    const options = normalizeOptions(body.options, allowPaid);
    const maxSort = await StoreProductPersonalization.findOne({ storeId })
        .sort({ sortOrder: -1 })
        .select("sortOrder")
        .lean();
    const doc = await StoreProductPersonalization.create({
        storeId,
        name,
        options,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    return { personalization: serializeRow(doc), allowPaidPricing: allowPaid };
}

async function updatePersonalization(storeId, id, body, user) {
    const allowPaid = allowPaidPricing(user);
    const doc = await StoreProductPersonalization.findOne({ _id: id, storeId });
    if (!doc) return { error: "Kişiselleştirme bulunamadı" };
    if (body.name != null) {
        const name = String(body.name).trim().slice(0, NAME_MAX);
        if (!name) return { error: "Kişiselleştirme adı gerekli" };
        doc.name = name;
    }
    if (body.options != null) {
        doc.options = normalizeOptions(body.options, allowPaid);
        doc.markModified("options");
    }
    await doc.save();
    return { personalization: serializeRow(doc), allowPaidPricing: allowPaid };
}

async function deletePersonalization(storeId, id) {
    const r = await StoreProductPersonalization.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Kişiselleştirme bulunamadı" };
    return { ok: true };
}

module.exports = {
    listPersonalizations,
    getPersonalization,
    createPersonalization,
    updatePersonalization,
    deletePersonalization,
    allowPaidPricing,
    PAID_FEATURE,
    NAME_MAX,
};
