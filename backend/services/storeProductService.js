const ProductMapping = require("../models/ProductMapping");
const StoreProduct = require("../models/StoreProduct");
const Store = require("../models/Store");
const storeService = require("./storeService");
const storeCustomFieldService = require("./storeCustomFieldService");
const storeCategoryService = require("./storeCategoryService");
const wbRedirectService = require("./wbRedirectService");
const { getSiteUrlPaths } = require("./wbSeoService");

const VALID_UNITS = new Set(["ml", "cl", "l", "m3", "mg", "g", "kg", "ton"]);

function normalizeUnitPrice(raw) {
    if (!raw || typeof raw !== "object") return undefined;
    const productMeasureUnit = VALID_UNITS.has(raw.productMeasureUnit)
        ? raw.productMeasureUnit
        : "cl";
    const soldUnitUnit =
        raw.soldUnitUnit && VALID_UNITS.has(raw.soldUnitUnit) ? raw.soldUnitUnit : "";
    const out = { productMeasureUnit, soldUnitUnit };
    if (raw.productMeasureValue != null && raw.productMeasureValue !== "") {
        const n = Number(raw.productMeasureValue);
        if (Number.isFinite(n) && n >= 0) out.productMeasureValue = n;
    }
    if (raw.soldUnitValue != null && raw.soldUnitValue !== "") {
        const n = Number(raw.soldUnitValue);
        if (Number.isFinite(n) && n >= 0) out.soldUnitValue = n;
    }
    return out;
}

function normalizeCanonicalUrl(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    s = s.replace(/^https?:\/\/[^/]+/i, "");
    if (!s.startsWith("/")) s = `/${s}`;
    return s.replace(/\/{2,}/g, "/").slice(0, 500);
}

function normalizeVariantOptionGroups(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((g, gi) => {
            const name = String(g?.name || "").trim().slice(0, 100);
            if (!name) return null;
            const displayStyle = g.displayStyle === "color_image" ? "color_image" : "list";
            const values = (Array.isArray(g.values) ? g.values : [])
                .map((v, vi) => {
                    const label = String(v?.label || "").trim().slice(0, 80);
                    if (!label) return null;
                    return {
                        label,
                        colorHex: String(v?.colorHex || "").trim().slice(0, 32),
                        imageUrl: String(v?.imageUrl || "").trim().slice(0, 500),
                        sortOrder: Number.isFinite(Number(v?.sortOrder)) ? Number(v.sortOrder) : vi,
                    };
                })
                .filter(Boolean);
            if (!values.length) return null;
            return {
                name,
                displayStyle,
                showOnListingPages: !!g.showOnListingPages,
                values,
                sortOrder: gi,
            };
        })
        .filter(Boolean);
}

function productSlug(name, id) {
    const base = String(name || "urun")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return base || `urun-${String(id).slice(-6)}`;
}

async function syncProductsFromMapping(userId, storeId, { productIds = null } = {}) {
    const q = { userId };
    if (productIds?.length) q._id = { $in: productIds };
    const mappings = await ProductMapping.find(q).lean();
    let upserted = 0;
    for (const m of mappings) {
        const title = m.masterProduct?.name || "Ürün";
        let slug = productSlug(title, m._id);
        const existsSlug = await StoreProduct.findOne({ storeId, slug, productMappingId: { $ne: m._id } }).lean();
        if (existsSlug) slug = `${slug}-${String(m._id).slice(-6)}`;
        const price = Number(m.masterProduct?.price) || 0;
        const stock = Number(m.masterProduct?.stock) || 0;
        await StoreProduct.findOneAndUpdate(
            { storeId, productMappingId: m._id },
            {
                storeId,
                productMappingId: m._id,
                visible: stock > 0,
                slug,
                title,
                description: m.masterProduct?.description || "",
                images: m.masterProduct?.images?.length ? m.masterProduct.images : [],
                price,
                compareAtPrice: m.masterProduct?.listPrice,
                stock,
                vatRate: m.masterProduct?.vatRate ?? 20,
                barcode: m.masterProduct?.barcode || "",
                sku: m.masterProduct?.sku || "",
                publishedAt: new Date(),
            },
            { upsert: true, new: true }
        );
        upserted += 1;
    }
    return { upserted, total: mappings.length };
}

async function listStoreProducts(storeId, { visibleOnly = false } = {}) {
    const q = { storeId };
    if (visibleOnly) q.visible = true;
    return StoreProduct.find(q).sort({ sortOrder: 1, title: 1 }).lean();
}

async function listCatalogSource(userId) {
    return ProductMapping.find({ userId })
        .select("masterProduct.name masterProduct.price masterProduct.stock masterProduct.images")
        .lean();
}

async function uniqueSlug(storeId, baseSlug, excludeId) {
    let slug = baseSlug;
    let n = 0;
    while (true) {
        const q = { storeId, slug };
        if (excludeId) q._id = { $ne: excludeId };
        const exists = await StoreProduct.findOne(q).lean();
        if (!exists) return slug;
        n += 1;
        slug = `${baseSlug}-${n}`;
    }
}

async function enrichProductCategories(storeId, product) {
    if (!product) return product;
    const { flat } = await storeCategoryService.listTree(storeId);
    const map = new Map(flat.map((c) => [String(c._id), c]));
    let productCategories = storeCategoryService.normalizeProductCategories(
        product.productCategories || [],
        map
    );
    if (!productCategories.length && Array.isArray(product.categories) && product.categories.length) {
        productCategories = product.categories.map((path, i) => ({
            categoryId: "",
            name: String(path).split(" > ").pop() || path,
            path: String(path),
            isPrimary: i === 0,
        }));
    }
    return { ...product, productCategories };
}

async function enrichProductCustomFields(storeId, product) {
    if (!product) return product;
    const defs = await storeCustomFieldService.listDefinitions(storeId);
    const map = new Map(defs.map((d) => [String(d._id), d]));
    return {
        ...product,
        customFields: storeCustomFieldService.normalizeProductCustomFields(
            product.customFields || [],
            map
        ),
    };
}

async function getStoreProduct(storeId, productId) {
    const doc = await StoreProduct.findOne({ _id: productId, storeId }).lean();
    if (!doc) return { error: "Ürün bulunamadı" };
    const withCats = await enrichProductCategories(storeId, doc);
    return { product: await enrichProductCustomFields(storeId, withCats) };
}

async function createStoreProduct(storeId, body) {
    const title = String(body.title || "").trim();
    if (!title) return { error: "Ürün adı gerekli" };

    const baseSlug = productSlug(body.seo?.slug || body.slug || title, "new");
    const slug = await uniqueSlug(storeId, baseSlug);

    const doc = await StoreProduct.create({
        storeId,
        source: "native",
        productType: body.productType === "variant" ? "variant" : "simple",
        productKind: body.productKind === "digital" ? "digital" : "physical",
        saleStatus: body.saleStatus === "closed" ? "closed" : "on_sale",
        visible: body.saleStatus !== "closed",
        slug,
        title,
        description: body.description || "",
        images: body.images || [],
        videos: body.videos || [],
        price: Number(body.price) || 0,
        compareAtPrice: body.compareAtPrice != null ? Number(body.compareAtPrice) : undefined,
        costPrice: body.costPrice != null ? Number(body.costPrice) : undefined,
        showUnitPrice: !!body.showUnitPrice,
        unitPrice: normalizeUnitPrice(body.unitPrice) || {
            productMeasureUnit: "cl",
            soldUnitUnit: "",
        },
        stock: Number(body.stock) || 0,
        vatRate: Number(body.vatRate) || 20,
        barcode: body.barcode || "",
        sku: body.sku || "",
        brand: body.brand || "",
        tags: body.tags || [],
        supplier: body.supplier || "",
        googleCategory: body.googleCategory || "",
        googleCategoryId:
            body.googleCategoryId != null && body.googleCategoryId !== ""
                ? Number(body.googleCategoryId)
                : undefined,
        categories: body.categories || [],
        productCategories: storeCategoryService.productCategoriesPayload(body.productCategories) || [],
        variantOptionGroups: normalizeVariantOptionGroups(body.variantOptionGroups),
        variants: body.variants || [],
        inventory: body.inventory || {
            locations: [{ name: "Ana Depo", stock: Number(body.stock) || 0 }],
        },
        seo: {
            slug: body.seo?.slug || slug,
            metaTitle: body.seo?.metaTitle || "",
            metaDescription: body.seo?.metaDescription || "",
            noindex: !!body.seo?.noindex,
            canonicalUrl: normalizeCanonicalUrl(body.seo?.canonicalUrl),
        },
        customFields: storeCustomFieldService.productCustomFieldsPayload(body.customFields) || [],
        publishedAt: body.saleStatus !== "closed" ? new Date() : undefined,
    });
    const created = doc.toObject();
    const withCats = await enrichProductCategories(storeId, created);
    return { product: await enrichProductCustomFields(storeId, withCats) };
}

async function patchStoreProduct(storeId, productId, patch) {
    const doc = await StoreProduct.findOne({ _id: productId, storeId });
    if (!doc) return { error: "Ürün bulunamadı" };

    const scalar = [
        "visible",
        "price",
        "sortOrder",
        "title",
        "description",
        "compareAtPrice",
        "costPrice",
        "showUnitPrice",
        "stock",
        "vatRate",
        "barcode",
        "sku",
        "brand",
        "supplier",
        "googleCategory",
        "googleCategoryId",
        "productType",
        "productKind",
        "saleStatus",
    ];
    for (const key of scalar) {
        if (patch[key] !== undefined) doc[key] = patch[key];
    }
    if (patch.title) doc.title = String(patch.title).trim();
    if (patch.saleStatus) {
        doc.visible = patch.saleStatus !== "closed";
        if (patch.saleStatus === "on_sale" && !doc.publishedAt) doc.publishedAt = new Date();
    }
    if (patch.images) doc.images = patch.images;
    if (patch.videos) doc.videos = patch.videos;
    if (patch.tags) doc.tags = patch.tags;
    if (patch.categories) doc.categories = patch.categories;
    if (patch.productCategories !== undefined) {
        doc.productCategories = storeCategoryService.productCategoriesPayload(patch.productCategories) || [];
        doc.markModified("productCategories");
    }
    if (patch.variantOptionGroups !== undefined) {
        doc.variantOptionGroups = normalizeVariantOptionGroups(patch.variantOptionGroups);
        doc.markModified("variantOptionGroups");
    }
    if (patch.variants) doc.variants = patch.variants;
    if (patch.inventory) {
        doc.inventory = { ...(doc.inventory?.toObject?.() || doc.inventory || {}), ...patch.inventory };
        doc.markModified("inventory");
    }
    if (patch.seo) {
        const oldSlug = doc.seo?.slug || doc.slug;
        const seoPatch = { ...patch.seo };
        if (seoPatch.canonicalUrl !== undefined) {
            seoPatch.canonicalUrl = normalizeCanonicalUrl(seoPatch.canonicalUrl);
        }
        if (seoPatch.noindex !== undefined) seoPatch.noindex = !!seoPatch.noindex;
        doc.seo = { ...(doc.seo?.toObject?.() || doc.seo || {}), ...seoPatch };
        if (patch.seo.slug) {
            const s = await uniqueSlug(storeId, productSlug(patch.seo.slug, productId), productId);
            doc.slug = s;
            doc.seo.slug = s;
            if (oldSlug && s && oldSlug !== s) {
                try {
                    const store = await Store.findById(storeId).select("wbSiteId").lean();
                    if (store?.wbSiteId) {
                        const WBSite = require("../models/WBSite");
                        const site = await WBSite.findById(store.wbSiteId).select("urlSettings").lean();
                        const productPath = getSiteUrlPaths(site).productPath;
                        await wbRedirectService.createSystemRedirect(
                            store.wbSiteId,
                            `${productPath}/${oldSlug}`,
                            `${productPath}/${s}`
                        );
                    }
                } catch {
                    /* redirect optional */
                }
            }
        }
        doc.markModified("seo");
    }
    if (patch.customFields !== undefined) {
        doc.customFields =
            storeCustomFieldService.productCustomFieldsPayload(patch.customFields) || [];
        doc.markModified("customFields");
    }
    if (patch.unitPrice !== undefined) {
        doc.unitPrice = {
            ...(doc.unitPrice?.toObject?.() || doc.unitPrice || {}),
            ...normalizeUnitPrice(patch.unitPrice),
        };
        doc.markModified("unitPrice");
    }
    await doc.save();
    const saved = doc.toObject();
    const withCats = await enrichProductCategories(storeId, saved);
    return { product: await enrichProductCustomFields(storeId, withCats) };
}

async function deleteStoreProduct(storeId, productId) {
    const r = await StoreProduct.deleteOne({ _id: productId, storeId });
    if (!r.deletedCount) return { error: "Ürün bulunamadı" };
    return { ok: true };
}

async function refreshStockFromMapping(storeProductId) {
    const sp = await StoreProduct.findById(storeProductId).lean();
    if (!sp) return;
    const m = await ProductMapping.findById(sp.productMappingId).lean();
    if (!m) return;
    await StoreProduct.updateOne(
        { _id: storeProductId },
        { stock: Number(m.masterProduct?.stock) || 0, price: Number(m.masterProduct?.price) || sp.price }
    );
}

async function decrementStock(storeProductId, qty) {
    const sp = await StoreProduct.findById(storeProductId);
    if (!sp) return { ok: false };
    const m = await ProductMapping.findById(sp.productMappingId);
    if (!m) return { ok: false };
    const newStock = Math.max(0, (Number(m.masterProduct?.stock) || 0) - qty);
    m.masterProduct.stock = newStock;
    await m.save();
    sp.stock = newStock;
    if (newStock <= 0) sp.visible = false;
    await sp.save();
    return { ok: true, stock: newStock };
}

module.exports = {
    syncProductsFromMapping,
    listStoreProducts,
    listCatalogSource,
    getStoreProduct,
    createStoreProduct,
    patchStoreProduct,
    deleteStoreProduct,
    refreshStockFromMapping,
    decrementStock,
};
