const StoreStockCount = require("../models/StoreStockCount");
const StoreProduct = require("../models/StoreProduct");

function normalizeLines(lines) {
    return (lines || [])
        .filter((l) => l.title || l.productId)
        .map((l) => ({
            productId: l.productId || undefined,
            title: String(l.title || "").trim(),
            variantBarcode: String(l.variantBarcode || "").trim(),
            systemStock: Math.max(0, Number(l.systemStock) || 0),
            countedQty: Math.max(0, Number(l.countedQty) || 0),
        }));
}

async function nextCountNumber(storeId) {
    const count = await StoreStockCount.countDocuments({ storeId });
    return `SS-${String(count + 1).padStart(5, "0")}`;
}

async function listStoreStockCounts(storeId) {
    const items = await StoreStockCount.find({ storeId }).sort({ createdAt: -1 }).lean();
    return items.map((c) => ({
        ...c,
        itemCount: Array.isArray(c.lines) ? c.lines.length : 0,
    }));
}

async function getStoreStockCount(storeId, id) {
    const doc = await StoreStockCount.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Stok sayımı bulunamadı" };
    return { stockCount: doc };
}

async function productsMatchingFilters(storeId, filters) {
    const products = await StoreProduct.find({ storeId }).lean();
    if (!filters?.length) return products;

    return products.filter((p) =>
        filters.every((f) => {
            if (f.type === "brand") return p.brand === f.value;
            if (f.type === "tag") return (p.tags || []).includes(f.value);
            if (f.type === "supplier") return p.supplier === f.value;
            if (f.type === "category") {
                return (p.productCategories || []).some(
                    (c) => String(c.categoryId) === String(f.value)
                );
            }
            return true;
        })
    );
}

function linesFromProducts(products) {
    return products.map((p) => ({
        productId: p._id,
        title: p.title,
        variantBarcode: "",
        systemStock: Number(p.stock ?? 0),
        countedQty: 0,
    }));
}

async function createStoreStockCount(storeId, body) {
    const locationName = String(body.locationName || "").trim();
    const title = String(body.title || "").trim();
    if (!locationName) return { error: "Stok lokasyonu gerekli" };
    if (!title) return { error: "Ad gerekli" };

    const method = body.method === "filter" ? "filter" : "manual";
    let lines = normalizeLines(body.lines);
    const filters = Array.isArray(body.filters) ? body.filters : [];

    if (method === "filter" && filters.length && !lines.length) {
        const matched = await productsMatchingFilters(storeId, filters);
        lines = linesFromProducts(matched);
    }

    const submit = body.submit === true;
    const countNumber = await nextCountNumber(storeId);

    const stockCount = await StoreStockCount.create({
        storeId,
        countNumber,
        locationName,
        title,
        method,
        status: submit ? "submitted" : "draft",
        lines,
        filters,
        recentActions: Array.isArray(body.recentActions) ? body.recentActions : [],
        notes: String(body.notes || "").trim(),
    });

    return { stockCount };
}

async function updateStoreStockCount(storeId, id, body) {
    const doc = await StoreStockCount.findOne({ _id: id, storeId });
    if (!doc) return { error: "Stok sayımı bulunamadı" };

    if (body.locationName != null) {
        const v = String(body.locationName).trim();
        if (!v) return { error: "Stok lokasyonu gerekli" };
        doc.locationName = v;
    }
    if (body.title != null) {
        const v = String(body.title).trim();
        if (!v) return { error: "Ad gerekli" };
        doc.title = v;
    }
    if (body.lines != null) doc.lines = normalizeLines(body.lines);
    if (body.filters != null) doc.filters = body.filters;
    if (body.recentActions != null) doc.recentActions = body.recentActions;
    if (body.notes != null) doc.notes = String(body.notes).trim();

    if (body.submit === true && doc.status === "draft") {
        doc.status = "submitted";
    }

    await doc.save();
    return { stockCount: doc };
}

async function deleteStoreStockCount(storeId, id) {
    const doc = await StoreStockCount.findOneAndDelete({ _id: id, storeId });
    if (!doc) return { error: "Stok sayımı bulunamadı" };
    return { deleted: true };
}

async function bulkDeleteStoreStockCounts(storeId, ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: "Silinecek kayıt seçilmedi" };
    const result = await StoreStockCount.deleteMany({ storeId, _id: { $in: list } });
    return { deletedCount: result.deletedCount || 0 };
}

module.exports = {
    listStoreStockCounts,
    getStoreStockCount,
    createStoreStockCount,
    updateStoreStockCount,
    deleteStoreStockCount,
    bulkDeleteStoreStockCounts,
    productsMatchingFilters,
    linesFromProducts,
};
