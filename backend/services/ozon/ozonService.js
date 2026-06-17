/**
 * Ozon Seller API — sipariş (FBS), ürün listesi, stok, kargo etiketi
 * https://api-seller.ozon.ru — Client-Id + Api-Key
 */

const axios = require("axios");
const logger = require("../../config/logger");

const OZON_PROD_URL = "https://api-seller.ozon.ru";
const OZON_SANDBOX_URL = "https://cb-api.ozonru.me";

const normalizeCredentials = (raw = {}) => {
    const clientId = String(raw.clientId || raw.client_id || "").trim();
    const apiKey = String(raw.apiKey || raw.api_key || "").trim();
    const useSandbox =
        raw.useSandbox === true ||
        raw.useSandbox === "true" ||
        raw.useSandbox === 1;
    return { clientId, apiKey, useSandbox };
};

const getBaseUrl = (credentials) => {
    const c = normalizeCredentials(credentials);
    return c.useSandbox ? OZON_SANDBOX_URL : OZON_PROD_URL;
};

const getHeaders = (credentials) => {
    const c = normalizeCredentials(credentials);
    return {
        "Client-Id": c.clientId,
        "Api-Key": c.apiKey,
        "Content-Type": "application/json",
    };
};

const extractOzonError = (err) => {
    const data = err.response?.data;
    if (!data) return err.message || "Ozon API hatası";
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.errors) && data.errors.length) {
        return data.errors.map((e) => e.message || e.code || JSON.stringify(e)).join("; ");
    }
    return JSON.stringify(data).slice(0, 400);
};

const ozonPost = async (credentials, path, body = {}, timeout = 35000) => {
    const c = normalizeCredentials(credentials);
    if (!c.clientId || !c.apiKey) {
        throw new Error("Ozon Client-Id ve Api-Key zorunludur.");
    }
    try {
        const res = await axios.post(`${getBaseUrl(c)}${path}`, body, {
            headers: getHeaders(c),
            timeout,
        });
        return res.data;
    } catch (err) {
        const msg = extractOzonError(err);
        const status = err.response?.status;
        const e = new Error(msg);
        e.status = status;
        throw e;
    }
};

/** Bağlantı testi — depo listesi */
const testConnection = async (credentials) => {
    const data = await ozonPost(credentials, "/v1/warehouse/list", {});
    const list = data.result || [];
    return {
        success: true,
        message: `Ozon API bağlantısı başarılı (${list.length} depo)`,
        warehouseCount: list.length,
    };
};

const msToIso = (ms) => {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
    return new Date(n).toISOString();
};

/**
 * FBS gönderileri — POST /v3/posting/fbs/list
 */
const fetchFbsPostings = async (credentials, startDateMs, endDateMs) => {
    const since = msToIso(startDateMs);
    const to = msToIso(endDateMs);
    const all = [];
    let offset = 0;
    const limit = 50;

    for (let page = 0; page < 200; page++) {
        const data = await ozonPost(credentials, "/v3/posting/fbs/list", {
            dir: "DESC",
            filter: { since, to },
            limit,
            offset,
            with: {
                analytics_data: true,
                barcodes: true,
                financial_data: true,
            },
        });

        const postings = data.result?.postings || [];
        all.push(...postings);

        if (!data.result?.has_next || postings.length < limit) break;
        offset += limit;
    }

    logger.info(`[Ozon] FBS ${all.length} gönderi (${since} — ${to})`);
    return all;
};

const mapPostingToOrder = (posting) => {
    const products = (posting.products || []).map((p) => ({
        productName: p.name || p.offer_id || "Ürün",
        sku: p.offer_id || "",
        barcode: String(p.sku || p.offer_id || ""),
        quantity: Number(p.quantity) || 1,
        price: p.price != null ? String(p.price) : "",
        imageUrl: p.primary_image || "",
    }));

    let total = 0;
    const finProducts = posting.financial_data?.products || [];
    for (const fp of finProducts) {
        const price = Number(fp.price || fp.customer_price || fp.old_price || 0);
        const qty = Number(fp.quantity || fp.product_quantity || 1);
        total += price * qty;
    }
    if (!total && products.length) {
        total = products.reduce(
            (s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1),
            0
        );
    }

    const tracking =
        String(posting.tracking_number || "").trim() ||
        String(posting.barcodes?.upper_barcode || "").trim() ||
        "";

    const orderDate =
        posting.in_process_at ||
        posting.shipment_date ||
        posting.delivering_date ||
        posting.created_at ||
        null;

    return {
        orderNumber: posting.posting_number,
        orderDate: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
        orderDateRaw: orderDate,
        customerName:
            posting.customer?.name ||
            posting.addressee?.name ||
            posting.customer?.customer_email ||
            "Ozon Müşteri",
        customerEmail: posting.customer?.customer_email || "",
        totalPrice: (total > 0 ? total : 0).toFixed(2),
        status: posting.status || "unknown",
        trackingNumber: tracking || posting.posting_number,
        cargoTrackingNumber: tracking,
        cargoCompany: posting.delivery_method?.name || "Ozon",
        packageNumber: posting.posting_number,
        shipmentPackageId: String(posting.order_id || ""),
        products,
        shippingAddress: posting.customer?.address
            ? {
                  fullName: posting.customer?.name || "",
                  city: posting.customer.address.city || "",
                  district: posting.customer.address.district || "",
                  fullAddress:
                      posting.customer.address.address_tail ||
                      posting.customer.address.address ||
                      "",
                  phone: posting.customer.phone || "",
                  country: posting.customer.address.country || "RU",
              }
            : {},
    };
};

const fetchOzonOrders = async (credentials, startDateMs, endDateMs) => {
    const postings = await fetchFbsPostings(credentials, startDateMs, endDateMs);
    return postings.map(mapPostingToOrder);
};

/**
 * Ürün listesi — POST /v3/product/list
 */
const fetchOzonProducts = async (credentials, { limit = 100, lastId = "" } = {}) => {
    const body = {
        filter: { visibility: "ALL" },
        last_id: lastId || "",
        limit: Math.min(1000, Math.max(1, limit)),
    };
    const data = await ozonPost(credentials, "/v3/product/list", body);
    const items = data.result?.items || [];
    return {
        items: items.map((it) => ({
            productId: it.product_id,
            offerId: it.offer_id,
            sku: it.offer_id,
            barcode: String(it.offer_id || ""),
            name: it.name || it.offer_id,
            archived: !!it.archived,
        })),
        lastId: data.result?.last_id || "",
        total: data.result?.total || items.length,
    };
};

/** Tüm ürünleri sayfalı çek (ürün senkronu) */
const fetchAllOzonProducts = async (credentials, maxPages = 50) => {
    const all = [];
    let lastId = "";
    for (let i = 0; i < maxPages; i++) {
        const batch = await fetchOzonProducts(credentials, { limit: 100, lastId });
        all.push(...batch.items);
        if (!batch.lastId || batch.items.length === 0) break;
        lastId = batch.lastId;
    }
    return all;
};

/**
 * Stok güncelle — POST /v2/products/stocks
 * @param {string} offerId — satıcı SKU (offer_id)
 * @param {number} productId — Ozon product_id (opsiyonel)
 */
const updateOzonStock = async (credentials, offerId, quantity, productId = null) => {
    const stock = Math.max(0, parseInt(quantity, 10) || 0);
    const entry = {
        offer_id: String(offerId).trim(),
        stock,
    };
    if (productId != null && productId !== "") {
        entry.product_id = parseInt(productId, 10) || productId;
    }
    const data = await ozonPost(credentials, "/v2/products/stocks", {
        stocks: [entry],
    });
    const updated = data.result?.[0];
    if (updated && updated.updated === false) {
        const errs = (updated.errors || []).map((e) => e.message || e.code).join("; ");
        return { success: false, error: errs || "Ozon stok güncellenemedi" };
    }
    return { success: true, result: updated };
};

/**
 * Kargo etiketi PDF — POST /v2/posting/fbs/package-label
 */
const fetchOzonPackageLabel = async (credentials, postingNumber) => {
    const pn = String(postingNumber || "").trim();
    if (!pn) throw new Error("Ozon posting_number gerekli.");

    const data = await ozonPost(credentials, "/v2/posting/fbs/package-label", {
        posting_number: [pn],
    });

    const fileContent =
        data.result?.file_content ||
        data.result?.content ||
        data.file_content ||
        null;

    if (!fileContent || String(fileContent).length < 50) {
        throw new Error(
            "Ozon etiket dosyası alınamadı. Gönderi durumu 'awaiting_deliver' veya 'delivering' olmalı."
        );
    }

    return {
        format: "pdf",
        mimeType: "application/pdf",
        filename: data.result?.file_name || `ozon-label-${pn}.pdf`,
        contentBase64: String(fileContent).replace(/^data:application\/pdf;base64,/i, ""),
        postingNumber: pn,
    };
};

/**
 * Ürün içe aktarma (basit) — POST /v3/product/import
 * category_id ve type_id ürün mapping'den gelmeli
 */
const importOzonProduct = async (credentials, payload) => {
    const data = await ozonPost(credentials, "/v3/product/import", payload, 60000);
    return {
        success: true,
        taskId: data.result?.task_id,
        raw: data,
    };
};

/**
 * Ozon kategori ağacı — POST /v1/description-category/tree
 * Yaprak düğümler category_id + type_id çifti olarak döner (id: "catId:typeId")
 */
const flattenOzonCategoryTree = (nodes, parentPath = []) => {
    const out = [];
    if (!Array.isArray(nodes)) return out;

    for (const node of nodes) {
        const catName = String(node.category_name || node.title || "").trim();
        const typeName = String(node.type_name || "").trim();
        const catId = node.description_category_id ?? node.category_id;
        const typeId = node.type_id;
        const pathParts = typeName
            ? [...parentPath, catName, typeName].filter(Boolean)
            : [...parentPath, catName].filter(Boolean);
        const pathStr = pathParts.join(" > ");

        if (typeId != null && catId != null) {
            out.push({
                id: `${catId}:${typeId}`,
                categoryId: catId,
                typeId,
                name: typeName || catName,
                path: pathStr,
                leaf: true,
            });
        }

        const children = node.children || [];
        const childPath = catName ? [...parentPath, catName] : parentPath;
        if (children.length) {
            out.push(...flattenOzonCategoryTree(children, childPath));
        }
    }
    return out;
};

const fetchOzonCategoryTree = async (credentials) => {
    const data = await ozonPost(credentials, "/v1/description-category/tree", {
        language: "DEFAULT",
    });
    const roots = data.result || [];
    const flat = flattenOzonCategoryTree(roots);
    logger.info(`[Ozon] Kategori ağacı: ${flat.length} yaprak (category_id:type_id)`);
    return flat;
};

const buildOzonImportItem = (product, categoryId, typeId) => {
    const offerId =
        String(product.stockCode || product.sku || product.barcode || "").trim();
    const name = String(product.name || product.title || "").trim();
    const price = Number(product.price || product.salePrice || 0);
    const stock = Math.max(0, parseInt(product.stock || product.quantity || 0, 10));
    const images = (product.images || [])
        .map((img) => (typeof img === "string" ? img : img?.url))
        .filter(Boolean)
        .slice(0, 15);

    if (!offerId) throw new Error("Ozon: offer_id (SKU/stockCode) zorunlu");
    if (!name) throw new Error("Ozon: ürün adı zorunlu");
    if (!categoryId || !typeId) {
        throw new Error(
            "Ozon: category_id ve type_id gerekli. Ürün Yönetimi'nde Ozon kategori eşlemesi yapın."
        );
    }

    return {
        offer_id: offerId,
        name,
        description: String(product.description || name).slice(0, 5000),
        category_id: parseInt(categoryId, 10),
        type_id: parseInt(typeId, 10),
        price: String(price > 0 ? price : 1),
        vat: "0",
        weight: Math.max(1, parseInt(product.weight || product.desi || 100, 10)),
        dimension_unit: "mm",
        weight_unit: "g",
        depth: Math.max(1, parseInt(product.depth || 100, 10)),
        width: Math.max(1, parseInt(product.width || 100, 10)),
        height: Math.max(1, parseInt(product.height || 100, 10)),
        images,
        attributes: [],
        complex_attributes: [],
        currency_code: "RUB",
        old_price: "0",
        premium_price: "0",
        min_price: "0",
        stock: stock,
    };
};

module.exports = {
    OZON_PROD_URL,
    normalizeCredentials,
    getBaseUrl,
    getHeaders,
    testConnection,
    fetchFbsPostings,
    fetchOzonOrders,
    mapPostingToOrder,
    fetchOzonProducts,
    fetchAllOzonProducts,
    updateOzonStock,
    fetchOzonPackageLabel,
    importOzonProduct,
    buildOzonImportItem,
    fetchOzonCategoryTree,
    flattenOzonCategoryTree,
};
