/**
 * Ürün detayında pazaryeri kategori şeması + üründe kayıtlı değerleri birleştirir.
 * Senkron / dağıtım sırasında kullanılan resmi kategori özellik API'leri ile uyumlu özet.
 */

const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { resolveProductBrandName } = require("../utils/resolveProductBrandName");
const { fetchTrendyolCategoryAttributes } = require("./productSyncService");
const n11Service = require("./n11Service");
const ciceksepetiService = require("./ciceksepeti/ciceksepetiService");
const {
    normalizeCredentials,
    validateCredentials,
    fetchHepsiburadaCategoryAttributes,
    unwrapHbCategoryAttributesRoot
} = require("./hepsiburadaService");
const axios = require("axios");

const normMp = (name) => {
    if (!name) return "";
    const n = String(name).trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon" || n === "amazon türkiye") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return String(name).trim();
};

const normAttrName = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/\*/g, "")
        .replace(/\s+/g, " ")
        .trim();

/** Kategori adı eşlemesi (TY / N11 / ÇS ağaçlarında) */
const normCatCompare = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/\s+/g, " ")
        .trim();

const fetchTrendyolCategoryTreeAxios = async (credentials) => {
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;
    if (!apiKey || !apiSecret || !actualSellerId) return [];
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const resp = await axios.get("https://apigw.trendyol.com/integration/product/product-categories", {
        headers: {
            Authorization: `Basic ${authHeader}`,
            "User-Agent": `${actualSellerId} - LysiaETIC`,
            "Content-Type": "application/json"
        },
        timeout: 28000
    });
    return resp.data?.categories || [];
};

const collectTrendyolLeafCategories = (nodes, acc = []) => {
    if (!Array.isArray(nodes)) return acc;
    for (const n of nodes) {
        const subs = n.subCategories || n.subcategories || n.children || n.subCats || [];
        const id = n.id ?? n.categoryId ?? n.pimCategoryId;
        const name = String(n.name ?? n.categoryName ?? "").trim();
        if (subs.length > 0) collectTrendyolLeafCategories(subs, acc);
        else if (id != null && name) acc.push({ id: String(id), name });
    }
    return acc;
};

const resolveTrendyolCategoryIdFromName = async (credentials, wantName) => {
    const w = normCatCompare(wantName);
    if (!w) return "";
    const tree = await fetchTrendyolCategoryTreeAxios(credentials);
    const leaves = collectTrendyolLeafCategories(tree);
    const hits = leaves.filter((x) => normCatCompare(x.name) === w);
    if (hits.length >= 1) return hits[0].id;
    return "";
};

const collectN11Leaves = (categories, acc = []) => {
    if (!Array.isArray(categories)) return acc;
    for (const c of categories) {
        const subs = c.subCategories || c.children || [];
        const id = c.id;
        const name = String(c.name || "").trim();
        if (subs.length > 0) collectN11Leaves(subs, acc);
        else if (id != null && name) acc.push({ id: String(id), name });
    }
    return acc;
};

const resolveN11CategoryIdFromName = async (credentials, wantName) => {
    const w = normCatCompare(wantName);
    if (!w) return "";
    const cleanAscii = (str) => String(str || "").replace(/[^\x20-\x7E]/g, "");
    const resp = await axios.get("https://api.n11.com/cdn/categories", {
        headers: {
            appkey: cleanAscii(credentials.apiKey),
            appsecret: cleanAscii(credentials.secretKey),
            "Content-Type": "application/json",
            "User-Agent": "LysiaETIC"
        },
        timeout: 28000
    });
    const cats = resp.data?.categories || resp.data || [];
    const leaves = collectN11Leaves(Array.isArray(cats) ? cats : []);
    const hits = leaves.filter((x) => normCatCompare(x.name) === w);
    if (hits.length >= 1) return hits[0].id;
    return "";
};

const collectCicekLeaves = (nodes, acc = []) => {
    if (!Array.isArray(nodes)) return acc;
    for (const n of nodes) {
        const subs = n.subCategories || n.subcategories || n.children || [];
        const id = n.id ?? n.categoryId;
        const name = String(n.name || n.categoryName || "").trim();
        if (subs.length > 0) collectCicekLeaves(subs, acc);
        else if (id != null && name) acc.push({ id: String(id), name });
    }
    return acc;
};

const resolveCicekCategoryIdFromName = async (credentials, wantName) => {
    const w = normCatCompare(wantName);
    if (!w) return "";
    const apiKey = credentials.apiKey || credentials.apiSecret;
    const sellerId = credentials.sellerId || credentials.supplierId;
    const integratorName = credentials.integratorName || "";
    const cleanSellerId = String(sellerId || "").replace(/[^\x00-\x7F]/g, "");
    const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, "") : "";
    const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : cleanSellerId || "CicekSepetiIntegration";
    const baseUrl = credentials.isTestMode
        ? "https://sandbox-apis.ciceksepeti.com/api/v1"
        : "https://apis.ciceksepeti.com/api/v1";
    const resp = await axios.get(`${baseUrl}/Categories`, {
        headers: {
            "x-api-key": apiKey,
            "user-agent": userAgent,
            "Content-Type": "application/json"
        },
        timeout: 28000
    });
    const raw = resp.data?.categories || [];
    const leaves = collectCicekLeaves(raw);
    const hits = leaves.filter((x) => normCatCompare(x.name) === w);
    if (hits.length >= 1) return hits[0].id;
    return "";
};

const getTySnapshotRows = (productPlain) => {
    const a = productPlain.masterProduct?.attributes;
    if (!a || typeof a !== "object") return [];
    const rows = a.trendyolAttributeRows;
    return Array.isArray(rows) ? rows : [];
};

const matchTySnapshot = (rows, attrId, attrName) => {
    if (attrId != null && Number(attrId) > 0) {
        const hit = rows.find((r) => Number(r.attributeId) === Number(attrId));
        if (hit && hit.attributeValue != null && String(hit.attributeValue).trim() !== "") {
            return String(hit.attributeValue).trim();
        }
    }
    const want = normAttrName(attrName);
    if (!want) return "";
    for (const r of rows) {
        if (normAttrName(r.attributeName) === want) {
            return String(r.attributeValue || "").trim();
        }
    }
    return "";
};

const isLikelyMarkaName = (name) => {
    const n = normAttrName(name);
    if (!n) return false;
    if (n.includes("web color") || n.includes("web renk")) return false;
    return n === "marka" || n === "brand" || n.includes("marka");
};

const resolveMasterBrandText = (productPlain) => {
    const master = productPlain.masterProduct || {};
    return (
        resolveProductBrandName({
            ...master,
            marketplaceMappings: productPlain.marketplaceMappings
        }) ||
        String(master.brand || "").trim()
    );
};

const mergeHbCatalogSources = (productPlain, mpMapping) => {
    const master = productPlain.masterProduct || {};
    const out = {};
    const hb = master.hepsiburadaCatalogAttributes || master.hbCatalogAttributes;
    if (hb && typeof hb === "object" && !Array.isArray(hb)) Object.assign(out, hb);
    const ca = mpMapping?.customAttributes;
    if (ca instanceof Map) {
        for (const [k, v] of ca.entries()) {
            if (v != null && typeof v === "object" && !Array.isArray(v)) continue;
            out[String(k)] = v;
        }
    } else if (ca && typeof ca === "object" && !Array.isArray(ca)) {
        for (const [k, v] of Object.entries(ca)) {
            if (v != null && typeof v === "object" && !Array.isArray(v)) continue;
            out[String(k)] = v;
        }
    }
    return out;
};

const resolveHbFieldValue = (productPlain, mpMapping, fieldName) => {
    const merged = mergeHbCatalogSources(productPlain, mpMapping);
    const fn = String(fieldName || "").trim();
    if (!fn) return "";
    const lower = fn.toLowerCase();
    for (const [k, v] of Object.entries(merged)) {
        if (String(k).toLowerCase() === lower && v != null && String(v).trim() !== "") {
            return String(v).trim();
        }
    }
    if (lower === "marka" || fn === "Marka") {
        return resolveMasterBrandText(productPlain);
    }
    const a = productPlain.masterProduct?.attributes || {};
    if (lower.includes("renk") && a.color) return String(a.color);
    if ((lower.includes("beden") || lower.includes("ebat")) && (a.size || a.boyutEbat)) {
        return String(a.size || a.boyutEbat);
    }
    return "";
};

const flattenHbAttributeLists = (root) => {
    if (!root || typeof root !== "object") return [];
    return [
        ...(Array.isArray(root.variantAttributes) ? root.variantAttributes : []),
        ...(Array.isArray(root.attributes) ? root.attributes : []),
        ...(Array.isArray(root.baseAttributes) ? root.baseAttributes : [])
    ];
};

const buildTrendyolOverviewRows = (productPlain, categoryData) => {
    const rows = Array.isArray(categoryData?.categoryAttributes) ? categoryData.categoryAttributes : [];
    const snap = getTySnapshotRows(productPlain);
    const master = productPlain.masterProduct || {};
    const attrs = master.attributes || {};

    return rows.map((row) => {
        const attr = row.attribute || {};
        const attrId = attr.id;
        const name = String(attr.name || "").trim();
        const required = Boolean(row.required);
        const allowCustom = Boolean(row.allowCustom);
        const variant = Boolean(row.variant);
        const values = Array.isArray(row.attributeValues) ? row.attributeValues : [];
        let current = matchTySnapshot(snap, attrId, name);
        if (!current && isLikelyMarkaName(name)) {
            current = resolveMasterBrandText(productPlain);
        }
        if (!current && normAttrName(name).includes("renk")) current = String(attrs.color || attrs.webColor || "").trim();
        if (!current && (normAttrName(name).includes("beden") || normAttrName(name).includes("ebat"))) {
            current = String(attrs.size || attrs.boyutEbat || "").trim();
        }
        if (!current && normAttrName(name).includes("materyal")) current = String(attrs.material || "").trim();

        return {
            attributeId: attrId,
            name,
            required,
            allowCustom,
            variant,
            currentValue: current || "",
            valueSample: values.slice(0, 15).map((v) => ({
                id: v.id,
                name: v.name != null ? String(v.name) : ""
            })),
            valueTotal: values.length
        };
    });
};

const buildN11OverviewRows = (productPlain, categoryAttributes) => {
    const snap = getTySnapshotRows(productPlain);
    const master = productPlain.masterProduct || {};
    const attrs = master.attributes || {};

    return categoryAttributes.map((row) => {
        const attrId = row.attributeId ?? row.id;
        const name = String(row.attributeName || row.name || "").trim();
        const required = Boolean(row.isMandatory);
        const allowCustom = Boolean(row.isCustomValue);
        const variant = Boolean(row.isVariant);
        const values = Array.isArray(row.attributeValues) ? row.attributeValues : [];

        let current = "";
        if (Number(attrId) === 1) {
            current = resolveMasterBrandText(productPlain);
        } else {
            current = matchTySnapshot(snap, attrId, name);
        }
        if (!current && normAttrName(name).includes("renk")) current = String(attrs.color || "").trim();
        if (!current && normAttrName(name).includes("beden")) current = String(attrs.size || "").trim();

        return {
            attributeId,
            name,
            required,
            allowCustom,
            variant,
            currentValue: current || "",
            valueSample: values.slice(0, 15).map((v) => ({
                id: v.id ?? v.valueId,
                name: v.value != null ? String(v.value) : String(v.name || "")
            })),
            valueTotal: values.length
        };
    });
};

const buildHbOverviewRows = (productPlain, mpMapping, root) => {
    const lists = flattenHbAttributeLists(root);
    return lists.map((attr) => {
        const fieldName = String(attr.name || "").trim();
        const attrId = attr.id ?? attr.attributeId ?? attr.attributeID;
        const typeStr = String(attr.type || attr.dataType || "").trim();
        const mandatory =
            attr.mandatory === true || attr.mandatory === "true" || attr.mandatory === 1 || attr.required === true;
        const current = resolveHbFieldValue(productPlain, mpMapping, fieldName);
        return {
            attributeId: attrId,
            name: fieldName || String(attrId || ""),
            required: mandatory,
            allowCustom: Boolean(attr.allowCustom || attr.customValue),
            variant: Boolean(attr.variant || attr.isVariant),
            type: typeStr,
            currentValue: current || "",
            valueSample: [],
            valueTotal: 0
        };
    });
};

const parseCicekSepetiAttrList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.attributes)) return data.attributes;
    if (Array.isArray(data.categoryAttributes)) return data.categoryAttributes;
    if (Array.isArray(data.items)) return data.items;
    return [];
};

const buildCicekOverviewRows = (productPlain, list) => {
    const master = productPlain.masterProduct || {};
    const attrs = master.attributes || {};
    const snap = getTySnapshotRows(productPlain);

    return list.map((row) => {
        const attrId = row.id ?? row.attributeId;
        const name = String(row.name || row.attributeName || row.title || "").trim();
        const required = Boolean(row.isRequired ?? row.required ?? row.mandatory);
        let current = matchTySnapshot(snap, attrId, name);
        if (!current && normAttrName(name).includes("marka")) current = resolveMasterBrandText(productPlain);
        if (!current && normAttrName(name).includes("renk")) current = String(attrs.color || "").trim();
        return {
            attributeId,
            name,
            required,
            allowCustom: true,
            variant: false,
            currentValue: current || "",
            valueSample: [],
            valueTotal: 0
        };
    });
};

/**
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {object} productPlain - ProductMapping lean/toObject
 * @returns {Promise<object[]>}
 */
const buildProductCategoryFieldOverview = async (userId, productPlain) => {
    const mappings = Array.isArray(productPlain.marketplaceMappings) ? productPlain.marketplaceMappings : [];
    const credCache = new Map();

    const getMarketplaceCred = async (canonicalName) => {
        if (credCache.has(canonicalName)) return credCache.get(canonicalName);
        const doc = await Marketplace.findOne({
            userId,
            marketplaceName: new RegExp(`^${canonicalName}$`, "i")
        }).lean();
        if (!doc?.credentials) {
            credCache.set(canonicalName, null);
            return null;
        }
        const decrypted = decryptCredentials(doc.credentials);
        credCache.set(canonicalName, decrypted);
        return decrypted;
    };

    const blocks = [];

    for (const mpMap of mappings) {
        const mpLabel = mpMap.marketplaceName || "";
        const canonical = normMp(mpLabel);
        let categoryId = mpMap.categoryId != null ? String(mpMap.categoryId).trim() : "";
        const categoryName = String(mpMap.categoryName || "").trim();
        const masterCat = String(productPlain.masterProduct?.category || "").trim();
        const nameForLookup = categoryName || masterCat;
        /** @type {"mapping"|"name_tree"|null} */
        let categoryIdSource = categoryId ? "mapping" : null;

        if (!categoryId && nameForLookup) {
            try {
                if (canonical === "Trendyol") {
                    const cred = await getMarketplaceCred("Trendyol");
                    if (cred?.apiKey && cred?.apiSecret) {
                        const guess = await resolveTrendyolCategoryIdFromName(cred, nameForLookup);
                        if (guess) {
                            categoryId = guess;
                            categoryIdSource = "name_tree";
                        }
                    }
                } else if (canonical === "N11") {
                    const cred = await getMarketplaceCred("N11");
                    if (cred?.apiKey && cred?.secretKey) {
                        const guess = await resolveN11CategoryIdFromName(cred, nameForLookup);
                        if (guess) {
                            categoryId = guess;
                            categoryIdSource = "name_tree";
                        }
                    }
                } else if (canonical === "ÇiçekSepeti") {
                    const cred = await getMarketplaceCred("ÇiçekSepeti");
                    if (cred?.apiKey) {
                        const guess = await resolveCicekCategoryIdFromName(cred, nameForLookup);
                        if (guess) {
                            categoryId = guess;
                            categoryIdSource = "name_tree";
                        }
                    }
                }
            } catch (resErr) {
                logger.warn(`[CATEGORY OVERVIEW] Ad→ID çözümü (${canonical}): ${resErr.message}`);
            }
        }

        if (!categoryId) {
            const hint =
                nameForLookup !== ""
                    ? "Sayısal kategori ID yok; kategori adı ağaçta eşleştirilemedi. " +
                      "Not: Paneldeki «Otomatik senkron» çoğunlukla stok/fiyat gönderir — kategori ID için " +
                      "pazaryerinden tam ürün çekimini veya Kategori Merkezi’nden leaf ID atamasını kullanın."
                    : "Kategori adı ve ID yok — önce leaf kategori atayın veya pazaryerinden ürün çekin.";
            blocks.push({
                marketplace: canonical || mpLabel,
                categoryId: null,
                categoryName: categoryName || masterCat,
                syncStatus: mpMap.syncStatus,
                error: hint,
                attributes: []
            });
            continue;
        }

        try {
            if (canonical === "Trendyol") {
                const cred = await getMarketplaceCred("Trendyol");
                if (!cred?.apiKey || !cred?.apiSecret) {
                    throw new Error("Trendyol entegrasyon bilgisi yok");
                }
                const sellerId = cred.sellerId || cred.supplierId;
                if (!sellerId) throw new Error("Trendyol sellerId eksik");
                const data = await fetchTrendyolCategoryAttributes(cred, categoryId, sellerId);
                const attributes = buildTrendyolOverviewRows(productPlain, data);
                attributes.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name, "tr"));
                blocks.push({
                    marketplace: "Trendyol",
                    categoryId,
                    categoryName: categoryName || masterCat,
                    categoryIdSource,
                    syncStatus: mpMap.syncStatus,
                    attributes
                });
            } else if (canonical === "N11") {
                const cred = await getMarketplaceCred("N11");
                if (!cred?.apiKey || !cred?.secretKey) {
                    throw new Error("N11 entegrasyon bilgisi yok");
                }
                const res = await n11Service.getCategoryAttributes(cred, Number(categoryId) || categoryId);
                if (!res?.success) {
                    throw new Error(res?.error || "N11 kategori özellikleri alınamadı");
                }
                const rawAttrs = Array.isArray(res.attributes) ? res.attributes : [];
                const attributes = buildN11OverviewRows(productPlain, rawAttrs);
                attributes.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name, "tr"));
                blocks.push({
                    marketplace: "N11",
                    categoryId,
                    categoryName: res.name || categoryName || masterCat,
                    categoryIdSource,
                    syncStatus: mpMap.syncStatus,
                    attributes
                });
            } else if (canonical === "Hepsiburada") {
                const cred = await getMarketplaceCred("Hepsiburada");
                if (!cred) throw new Error("Hepsiburada entegrasyonu yok");
                const hbCreds = normalizeCredentials(cred);
                const v = validateCredentials(hbCreds, "kategori özeti");
                if (!v.valid) throw new Error(v.error || "HB kimlik bilgisi geçersiz");
                const { merchantId, secretKey, userAgent } = hbCreds;
                const useSit = Boolean(hbCreds.useSit);
                const raw = await fetchHepsiburadaCategoryAttributes(
                    merchantId,
                    secretKey,
                    categoryId,
                    userAgent,
                    useSit
                );
                const root = unwrapHbCategoryAttributesRoot(raw);
                let attributes = buildHbOverviewRows(productPlain, mpMap, root);
                attributes.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name, "tr"));
                blocks.push({
                    marketplace: "Hepsiburada",
                    categoryId,
                    categoryName: categoryName || masterCat,
                    categoryIdSource,
                    syncStatus: mpMap.syncStatus,
                    attributes
                });
            } else if (canonical === "ÇiçekSepeti") {
                const cred = await getMarketplaceCred("ÇiçekSepeti");
                if (!cred?.apiKey) throw new Error("ÇiçekSepeti entegrasyon bilgisi yok");
                const cs = await ciceksepetiService.getCategoryAttributes(cred, categoryId);
                if (!cs?.success) throw new Error(cs?.error || "ÇiçekSepeti kategori özellikleri alınamadı");
                const list = parseCicekSepetiAttrList(cs.data);
                const attributes = buildCicekOverviewRows(productPlain, list);
                attributes.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name, "tr"));
                blocks.push({
                    marketplace: "ÇiçekSepeti",
                    categoryId,
                    categoryName: categoryName || masterCat,
                    categoryIdSource,
                    syncStatus: mpMap.syncStatus,
                    attributes
                });
            } else {
                blocks.push({
                    marketplace: canonical || mpLabel,
                    categoryId,
                    categoryName: categoryName || masterCat,
                    categoryIdSource,
                    syncStatus: mpMap.syncStatus,
                    skipped: true,
                    message: "Bu platform için kategori özellik özeti henüz tanımlı değil.",
                    attributes: []
                });
            }
        } catch (err) {
            logger.warn(
                `[CATEGORY OVERVIEW] ${canonical || mpLabel} categoryId=${categoryId}: ${err.message}`
            );
            blocks.push({
                marketplace: canonical || mpLabel,
                categoryId,
                categoryName,
                syncStatus: mpMap.syncStatus,
                error: err.message || "Kategori özellikleri yüklenemedi",
                attributes: []
            });
        }
    }

    return blocks;
};

module.exports = { buildProductCategoryFieldOverview, normMp };
