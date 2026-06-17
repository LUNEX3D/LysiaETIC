const StoreProduct = require("../models/StoreProduct");
const storeProductService = require("./storeProductService");

function parseTags(value) {
    return String(value || "")
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
}

function buildPatchFromAction(action) {
    const field = action.field;
    const value = action.value;
    const patch = {};

    if (field === "price") {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) patch.price = n;
        return patch;
    }
    if (field === "compareAtPrice") {
        if (value === "" || value == null) {
            patch.compareAtPrice = undefined;
        } else {
            const n = Number(value);
            if (Number.isFinite(n) && n >= 0) patch.compareAtPrice = n;
        }
        return patch;
    }
    if (field === "costPrice") {
        if (value === "" || value == null) {
            patch.costPrice = undefined;
        } else {
            const n = Number(value);
            if (Number.isFinite(n) && n >= 0) patch.costPrice = n;
        }
        return patch;
    }
    if (field === "stock") {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) patch.stock = n;
        return patch;
    }
    if (field === "brand") {
        patch.brand = String(value || "").trim();
        return patch;
    }
    if (field === "tags") {
        patch.tags = parseTags(value);
        return patch;
    }
    if (field === "categories") {
        patch.categories = parseTags(value);
        return patch;
    }
    if (field === "saleStatus") {
        if (value === "on_sale" || value === "closed") patch.saleStatus = value;
        return patch;
    }
    if (field === "continueSellingWhenOutOfStock") {
        patch.inventory = { continueSellingWhenOutOfStock: value === true || value === "true" || value === 1 || value === "1" };
        return patch;
    }
    return patch;
}

function mergePatches(actions) {
    const merged = {};
    for (const action of actions) {
        const p = buildPatchFromAction(action);
        if (p.inventory) {
            merged.inventory = { ...(merged.inventory || {}), ...p.inventory };
            delete p.inventory;
        }
        Object.assign(merged, p);
    }
    return merged;
}

async function resolveProductIds(storeId, { scope, productIds }) {
    if (scope === "all") {
        const rows = await StoreProduct.find({ storeId }).select("_id").lean();
        return rows.map((r) => String(r._id));
    }
    return (productIds || []).map(String).filter(Boolean);
}

async function bulkUpdateProducts(storeId, { scope = "selected", productIds = [], actions = [] }) {
    if (!Array.isArray(actions) || !actions.length) {
        return { error: "En az bir düzenleme işlemi ekleyin" };
    }
    const ids = await resolveProductIds(storeId, { scope, productIds });
    if (!ids.length) return { error: "Düzenlenecek ürün bulunamadı" };

    const patch = mergePatches(actions);
    const hasPatch =
        Object.keys(patch).length > 0 ||
        (patch.inventory && Object.keys(patch.inventory).length > 0);
    if (!hasPatch) {
        return { error: "Geçerli bir değer girin" };
    }

    const results = { updated: 0, failed: 0, errors: [] };
    for (const id of ids) {
        const out = await storeProductService.patchStoreProduct(storeId, id, patch);
        if (out.error) {
            results.failed += 1;
            results.errors.push({ id, error: out.error });
        } else {
            results.updated += 1;
        }
    }
    return results;
}

async function bulkDeleteProducts(storeId, { scope = "selected", productIds = [] }) {
    const ids = await resolveProductIds(storeId, { scope, productIds });
    if (!ids.length) return { error: "Silinecek ürün bulunamadı" };

    const results = { deleted: 0, failed: 0, errors: [] };
    for (const id of ids) {
        const out = await storeProductService.deleteStoreProduct(storeId, id);
        if (out.error) {
            results.failed += 1;
            results.errors.push({ id, error: out.error });
        } else {
            results.deleted += 1;
        }
    }
    return results;
}

module.exports = {
    bulkUpdateProducts,
    bulkDeleteProducts,
};
