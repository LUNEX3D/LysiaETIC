const StoreCategory = require("../models/StoreCategory");

function slugify(name) {
    return String(name || "kategori")
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

function enrichRow(row, byId) {
    const pathOf = (id) => {
        const parts = [];
        let cur = byId.get(String(id));
        const guard = new Set();
        while (cur && !guard.has(String(cur._id))) {
            guard.add(String(cur._id));
            parts.unshift(cur.name);
            cur = cur.parentId ? byId.get(String(cur.parentId)) : null;
        }
        return parts.join(" > ");
    };
    return {
        ...row,
        path: pathOf(row._id),
        parentName: row.parentId ? byId.get(String(row.parentId))?.name || "" : "",
    };
}

async function listFlat(storeId) {
    const rows = await StoreCategory.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    return rows.map((r) => enrichRow(r, byId));
}

function buildTree(flat) {
    const byParent = new Map();
    for (const row of flat) {
        const key = row.parentId ? String(row.parentId) : "__root__";
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(row);
    }
    const walk = (parentKey) =>
        (byParent.get(parentKey) || []).map((node) => ({
            _id: node._id,
            name: node.name,
            path: node.path,
            parentId: node.parentId,
            parentName: node.parentName,
            sortOrder: node.sortOrder,
            categoryType: node.categoryType || "normal",
            sortCriteria: node.sortCriteria || "",
            seo: node.seo || {},
            children: walk(String(node._id)),
        }));
    return walk("__root__");
}

async function listTree(storeId) {
    const flat = await listFlat(storeId);
    return { flat, tree: buildTree(flat) };
}

async function getCategory(storeId, categoryId) {
    const doc = await StoreCategory.findOne({ _id: categoryId, storeId }).lean();
    if (!doc) return { error: "Kategori bulunamadı" };
    const flat = await listFlat(storeId);
    const enriched = flat.find((f) => String(f._id) === String(categoryId));
    return { category: enriched || doc };
}

async function createCategory(storeId, body) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Kategori adı gerekli" };
    let parentId = body.parentId || null;
    if (parentId) {
        const parent = await StoreCategory.findOne({ _id: parentId, storeId }).lean();
        if (!parent) return { error: "Üst kategori bulunamadı" };
    } else {
        parentId = null;
    }
    const maxSort = await StoreCategory.findOne({ storeId, parentId: parentId || null })
        .sort({ sortOrder: -1 })
        .select("sortOrder")
        .lean();
    const categoryType = body.categoryType === "dynamic" ? "dynamic" : "normal";
    const doc = await StoreCategory.create({
        storeId,
        name,
        parentId,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
        categoryType,
        description: String(body.description || ""),
        imageUrl: String(body.imageUrl || ""),
        sortCriteria: String(body.sortCriteria || ""),
        conditionMatch: body.conditionMatch === "all" ? "all" : "any",
        dynamicConditions: Array.isArray(body.dynamicConditions) ? body.dynamicConditions : [],
        seo: normalizeSeo(body.seo, name),
    });
    const flat = await listFlat(storeId);
    const enriched = flat.find((f) => String(f._id) === String(doc._id));
    return { category: enriched || doc.toObject() };
}

async function updateCategory(storeId, categoryId, body) {
    const doc = await StoreCategory.findOne({ _id: categoryId, storeId });
    if (!doc) return { error: "Kategori bulunamadı" };
    if (body.name != null) doc.name = String(body.name).trim();
    if (body.parentId !== undefined) {
        if (body.parentId && String(body.parentId) === String(doc._id)) {
            return { error: "Kategori kendi altına taşınamaz" };
        }
        doc.parentId = body.parentId || null;
    }
    if (body.sortOrder != null) doc.sortOrder = Number(body.sortOrder);
    if (body.categoryType != null) doc.categoryType = body.categoryType === "dynamic" ? "dynamic" : "normal";
    if (body.description != null) doc.description = String(body.description);
    if (body.imageUrl != null) doc.imageUrl = String(body.imageUrl);
    if (body.sortCriteria != null) doc.sortCriteria = String(body.sortCriteria);
    if (body.conditionMatch != null) doc.conditionMatch = body.conditionMatch === "all" ? "all" : "any";
    if (body.dynamicConditions != null) doc.dynamicConditions = body.dynamicConditions;
    if (body.seo != null) doc.seo = normalizeSeo(body.seo, doc.name);
    await doc.save();
    const flat = await listFlat(storeId);
    const enriched = flat.find((f) => String(f._id) === String(doc._id));
    return { category: enriched };
}

async function deleteCategory(storeId, categoryId) {
    const children = await StoreCategory.countDocuments({ storeId, parentId: categoryId });
    if (children > 0) return { error: "Alt kategorisi olan kayıt silinemez" };
    const r = await StoreCategory.deleteOne({ _id: categoryId, storeId });
    if (!r.deletedCount) return { error: "Kategori bulunamadı" };
    return { ok: true };
}

async function bulkDeleteCategories(storeId, ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: "Silinecek kategori seçilmedi" };
    for (const id of list) {
        const children = await StoreCategory.countDocuments({ storeId, parentId: id });
        if (children > 0) return { error: "Alt kategorisi olan kategori silinemez" };
    }
    const result = await StoreCategory.deleteMany({ storeId, _id: { $in: list } });
    return { deletedCount: result.deletedCount || 0 };
}

function exportCategoriesCsv(flat) {
    const header = "name,parent_path,type,slug,page_title,meta_description,sort_criteria";
    const lines = flat.map((c) => {
        const parentPath = c.path?.includes(" > ") ? c.path.split(" > ").slice(0, -1).join(" > ") : "";
        const cols = [
            c.name,
            parentPath,
            c.categoryType || "normal",
            c.seo?.slug || "",
            c.seo?.pageTitle || "",
            c.seo?.metaDescription || "",
            c.sortCriteria || "",
        ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`);
        return cols.join(",");
    });
    return `${header}\n${lines.join("\n")}`;
}

function normalizeProductCategories(raw, flatById) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            const categoryId = String(item.categoryId || item._id || "");
            const def = flatById.get(categoryId);
            if (!def && !item.path) return null;
            return {
                categoryId,
                name: def?.name || item.name || "",
                path: def?.path || item.path || item.name || "",
                isPrimary: !!item.isPrimary,
            };
        })
        .filter(Boolean);
}

function productCategoriesPayload(raw) {
    if (!Array.isArray(raw)) return undefined;
    return raw.map((c) => ({
        categoryId: c.categoryId,
        isPrimary: !!c.isPrimary,
    }));
}

module.exports = {
    listTree,
    listFlat,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    bulkDeleteCategories,
    exportCategoriesCsv,
    normalizeProductCategories,
    productCategoriesPayload,
    slugify,
};
