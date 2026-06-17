const StoreBrand = require("../models/StoreBrand");

function slugify(name) {
    return String(name || "marka")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 185);
}

function normalizeSeo(seo, name) {
    const s = seo || {};
    const slug = String(s.slug || slugify(name)).replace(/^\/+/, "").trim();
    return {
        slug,
        pageTitle: String(s.pageTitle || name || "").slice(0, 256),
        metaDescription: String(s.metaDescription || "").slice(0, 320),
        noIndex: !!s.noIndex,
        canonicalUrl: String(s.canonicalUrl || "").trim(),
    };
}

async function listBrands(storeId) {
    return StoreBrand.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
}

async function getBrand(storeId, brandId) {
    const doc = await StoreBrand.findOne({ _id: brandId, storeId }).lean();
    if (!doc) return { error: "Marka bulunamadı" };
    return { brand: doc };
}

async function createBrand(storeId, body) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Marka adı gerekli" };
    const maxSort = await StoreBrand.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const doc = await StoreBrand.create({
        storeId,
        name,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
        description: String(body.description || ""),
        imageUrl: String(body.imageUrl || ""),
        sortCriteria: String(body.sortCriteria || ""),
        seo: normalizeSeo(body.seo, name),
    });
    return { brand: doc.toObject() };
}

async function updateBrand(storeId, brandId, body) {
    const doc = await StoreBrand.findOne({ _id: brandId, storeId });
    if (!doc) return { error: "Marka bulunamadı" };
    if (body.name != null) doc.name = String(body.name).trim();
    if (body.description != null) doc.description = String(body.description);
    if (body.imageUrl != null) doc.imageUrl = String(body.imageUrl);
    if (body.sortOrder != null) doc.sortOrder = Number(body.sortOrder);
    if (body.sortCriteria != null) doc.sortCriteria = String(body.sortCriteria);
    if (body.seo != null) doc.seo = normalizeSeo(body.seo, doc.name);
    await doc.save();
    return { brand: doc.toObject() };
}

async function deleteBrand(storeId, brandId) {
    const r = await StoreBrand.deleteOne({ _id: brandId, storeId });
    if (!r.deletedCount) return { error: "Marka bulunamadı" };
    return { ok: true };
}

async function bulkDeleteBrands(storeId, ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: "Silinecek marka seçilmedi" };
    const result = await StoreBrand.deleteMany({ storeId, _id: { $in: list } });
    return { deletedCount: result.deletedCount || 0 };
}

function exportBrandsCsv(brands) {
    const header = "name,slug,page_title,meta_description,sort_criteria";
    const lines = (brands || []).map((b) => {
        const cols = [
            b.name,
            b.seo?.slug || "",
            b.seo?.pageTitle || "",
            b.seo?.metaDescription || "",
            b.sortCriteria || "",
        ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`);
        return cols.join(",");
    });
    return `${header}\n${lines.join("\n")}`;
}

module.exports = {
    listBrands,
    getBrand,
    createBrand,
    updateBrand,
    deleteBrand,
    bulkDeleteBrands,
    exportBrandsCsv,
    slugify,
};
