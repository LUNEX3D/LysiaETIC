const StoreProductGroup = require("../models/StoreProductGroup");
const StoreProduct = require("../models/StoreProduct");
const StoreCustomFieldDefinition = require("../models/StoreCustomFieldDefinition");

const MAX_VARIANT_TYPES = 3;

function normalizeLabels(raw) {
    const labels = (Array.isArray(raw) ? raw : [])
        .map((l) => String(l || "").trim())
        .filter(Boolean)
        .slice(0, MAX_VARIANT_TYPES);
    return [...new Set(labels)];
}

function normalizeItems(raw, labels) {
    const list = Array.isArray(raw) ? raw : [];
    return list
        .map((item, i) => {
            const productId = item.productId;
            if (!productId) return null;
            const valuesObj = {};
            const src = item.values instanceof Map ? Object.fromEntries(item.values) : item.values || {};
            for (const label of labels) {
                valuesObj[label] = String(src[label] || "").trim();
            }
            return {
                productId,
                sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : i,
                values: valuesObj,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, i) => ({ ...item, sortOrder: i }));
}

function serializeGroup(doc) {
    if (!doc) return doc;
    const row = doc.toObject ? doc.toObject() : { ...doc };
    row.items = (row.items || []).map((item) => ({
        productId: item.productId,
        sortOrder: item.sortOrder,
        values: item.values instanceof Map ? Object.fromEntries(item.values) : item.values || {},
    }));
    return row;
}

function getProductCustomFieldValue(product, fieldId) {
    if (!fieldId) return "";
    const id = String(fieldId);
    for (const cf of product.customFields || []) {
        if (String(cf.fieldId) === id) return String(cf.value || "").trim();
    }
    return "";
}

function getProductVariantTypeValues(product, maxTypes = MAX_VARIANT_TYPES) {
    const groups = product.variantOptionGroups || [];
    const labels = [];
    const values = {};
    for (const g of groups.slice(0, maxTypes)) {
        const name = String(g.name || "").trim();
        if (!name) continue;
        labels.push(name);
        const firstVariant = (product.variants || []).find((v) => {
            const opts = v.options instanceof Map ? Object.fromEntries(v.options) : v.options || {};
            return opts[name];
        });
        const opts = firstVariant?.options instanceof Map
            ? Object.fromEntries(firstVariant.options)
            : firstVariant?.options || {};
        values[name] = String(opts[name] || "").trim();
    }
    return { labels, values };
}

async function enrichGroups(storeId, rows) {
    const productIds = new Set();
    for (const row of rows) {
        for (const item of row.items || []) {
            if (item.productId) productIds.add(String(item.productId));
        }
    }
    const products = productIds.size
        ? await StoreProduct.find({ storeId, _id: { $in: [...productIds] } })
              .select("title slug productType")
              .lean()
        : [];
    const byId = new Map(products.map((p) => [String(p._id), p]));
    return rows.map((row) => ({
        ...row,
        productCount: row.items?.length || 0,
        items: (row.items || []).map((item) => ({
            ...item,
            productTitle: byId.get(String(item.productId))?.title || "",
        })),
    }));
}

async function listGroups(storeId) {
    const rows = await StoreProductGroup.find({ storeId }).sort({ sortOrder: 1, name: 1 }).lean();
    const serialized = rows.map((r) => ({
        ...r,
        items: (r.items || []).map((item) => ({
            ...item,
            values: item.values instanceof Map ? Object.fromEntries(item.values) : item.values || {},
        })),
    }));
    return enrichGroups(storeId, serialized);
}

async function getGroup(storeId, id) {
    const doc = await StoreProductGroup.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Ürün grubu bulunamadı" };
    const row = {
        ...doc,
        items: (doc.items || []).map((item) => ({
            ...item,
            values: item.values instanceof Map ? Object.fromEntries(item.values) : item.values || {},
        })),
    };
    const [enriched] = await enrichGroups(storeId, [row]);
    return { group: enriched };
}

async function createManualGroup(storeId, body) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Ürün grubu adı gerekli" };
    const variantTypeLabels = normalizeLabels(body.variantTypeLabels);
    if (!variantTypeLabels.length) return { error: "En az bir ürün grubu türü gerekli" };
    const items = normalizeItems(body.items, variantTypeLabels);
    if (!items.length) return { error: "En az bir ürün ekleyin" };
    const maxSort = await StoreProductGroup.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const doc = await StoreProductGroup.create({
        storeId,
        name,
        groupType: "manual",
        variantTypeLabels,
        items,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    });
    const [enriched] = await enrichGroups(storeId, [serializeGroup(doc)]);
    return { group: enriched };
}

async function updateGroup(storeId, id, body) {
    const doc = await StoreProductGroup.findOne({ _id: id, storeId });
    if (!doc) return { error: "Ürün grubu bulunamadı" };
    if (body.name != null) {
        const name = String(body.name).trim();
        if (!name) return { error: "Ürün grubu adı gerekli" };
        doc.name = name;
    }
    if (body.variantTypeLabels != null) {
        doc.variantTypeLabels = normalizeLabels(body.variantTypeLabels);
    }
    if (body.items != null) {
        const labels = doc.variantTypeLabels || [];
        doc.items = normalizeItems(body.items, labels);
        doc.markModified("items");
    }
    await doc.save();
    const [enriched] = await enrichGroups(storeId, [serializeGroup(doc)]);
    return { group: enriched };
}

async function deleteGroup(storeId, id) {
    const r = await StoreProductGroup.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Ürün grubu bulunamadı" };
    return { ok: true };
}

async function createAutomaticGroups(storeId, body) {
    const name = String(body.name || "").trim();
    if (!name) return { error: "Ürün grubu adı gerekli" };
    const groupingFieldId = body.groupingFieldId || body.autoConfig?.groupingFieldId;
    if (!groupingFieldId) return { error: "Gruplama koşulu (özel alan) seçin" };
    const typeSource = body.typeSource === "custom_field" ? "custom_field" : "variant";
    const typeCustomFieldId = body.typeCustomFieldId || body.autoConfig?.typeCustomFieldId || null;

    if (typeSource === "custom_field" && !typeCustomFieldId) {
        return { error: "Özel alana göre gruplama için tür alanı seçin" };
    }

    const groupingField = await StoreCustomFieldDefinition.findOne({ _id: groupingFieldId, storeId }).lean();
    if (!groupingField) return { error: "Gruplama özel alanı bulunamadı" };
    if (groupingField.type !== "text") {
        return { error: "Gruplama için Yazı türünde özel alan kullanılmalıdır" };
    }

    let typeField = null;
    if (typeSource === "custom_field") {
        typeField = await StoreCustomFieldDefinition.findOne({ _id: typeCustomFieldId, storeId }).lean();
        if (!typeField) return { error: "Tür özel alanı bulunamadı" };
        if (typeField.type !== "text") {
            return { error: "Tür alanı Yazı türünde olmalıdır" };
        }
    }

    const products = await StoreProduct.find({ storeId }).lean();
    const buckets = new Map();
    for (const p of products) {
        const key = getProductCustomFieldValue(p, groupingFieldId);
        if (!key) continue;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(p);
    }
    if (!buckets.size) {
        return { error: "Gruplama alanına değer girilmiş ürün bulunamadı" };
    }

    const maxSort = await StoreProductGroup.findOne({ storeId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    let sortOrder = (maxSort?.sortOrder ?? 0) + 1;
    const created = [];

    for (const [groupKey, bucketProducts] of buckets) {
        let variantTypeLabels = [];
        const items = bucketProducts.map((p, i) => {
            let values = {};
            if (typeSource === "variant") {
                const vt = getProductVariantTypeValues(p);
                if (!variantTypeLabels.length && vt.labels.length) variantTypeLabels = vt.labels;
                values = vt.values;
            } else {
                variantTypeLabels = [typeField.name];
                values = { [typeField.name]: getProductCustomFieldValue(p, typeCustomFieldId) };
            }
            return {
                productId: p._id,
                sortOrder: i,
                values,
            };
        });

        if (!variantTypeLabels.length) variantTypeLabels = ["Seçenek"];
        variantTypeLabels = normalizeLabels(variantTypeLabels);

        const doc = await StoreProductGroup.create({
            storeId,
            name: buckets.size === 1 ? name : `${name} (${groupKey})`,
            groupType: "automatic",
            variantTypeLabels,
            items: normalizeItems(items, variantTypeLabels),
            autoConfig: {
                groupingFieldId,
                typeSource,
                typeCustomFieldId: typeSource === "custom_field" ? typeCustomFieldId : null,
            },
            sortOrder: sortOrder++,
        });
        created.push(doc);
    }

    const serialized = created.map(serializeGroup);
    const enriched = await enrichGroups(storeId, serialized);
    return { groups: enriched, createdCount: enriched.length };
}

module.exports = {
    listGroups,
    getGroup,
    createManualGroup,
    updateGroup,
    deleteGroup,
    createAutomaticGroups,
    MAX_VARIANT_TYPES,
};
