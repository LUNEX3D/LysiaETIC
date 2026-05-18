/**
 * Ürün alan karşılaştırması — master (Lysia) vs pazaryeri snapshot
 *
 * Eşleştirme: SKU / barkod / ad önceliği (productSyncService)
 * Denetim: pull veya manuel kontrol sonrası ad, barkod, stok kodu, model no. vb. farkları
 */

const ProductMapping = require("../models/ProductMapping");

const escapeRegex = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeKey = (v) => {
    if (v == null) return "";
    return String(v).trim().normalize("NFC");
};

const normalizeNameKey = (v) => normalizeKey(v).toLowerCase().replace(/\s+/g, " ");

const normalizePrice = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** @type {Array<{ key: string, label: string, severity: string, identity: boolean }>} */
const FIELD_DEFS = [
    { key: "barcode", label: "Barkod", severity: "critical", identity: true },
    { key: "sku", label: "Stok kodu (SKU)", severity: "critical", identity: true },
    { key: "name", label: "Ürün adı", severity: "medium", identity: false },
    { key: "modelNumber", label: "Model numarası", severity: "medium", identity: false },
    { key: "brand", label: "Marka", severity: "low", identity: false },
    { key: "category", label: "Kategori", severity: "low", identity: false },
    { key: "price", label: "Satış fiyatı", severity: "high", identity: false }
];

const getMasterFieldValue = (masterProduct, fieldKey) => {
    if (!masterProduct) return "";
    switch (fieldKey) {
        case "barcode":
            return masterProduct.barcode;
        case "sku":
            return masterProduct.sku;
        case "name":
            return masterProduct.name;
        case "modelNumber": {
            const a = masterProduct.attributes;
            if (a && typeof a === "object") {
                return a.model || a.modelNumber || a["Model"] || "";
            }
            return "";
        }
        case "brand":
            return masterProduct.brand;
        case "category":
            return masterProduct.category;
        case "price":
            return masterProduct.price;
        default:
            return "";
    }
};

/**
 * Pazaryerinden çekilen normalize ürün satırından snapshot
 * @param {Object} product — syncProductsFromMarketplace satırı
 */
const extractPlatformSnapshot = (product) => {
    const attrs = product?.attributes && typeof product.attributes === "object" ? product.attributes : {};
    return {
        name: product?.name ?? "",
        barcode: product?.barcode ?? "",
        sku: product?.sku ?? "",
        modelNumber: attrs.model || attrs.modelNumber || product?.modelNumber || product?.model || "",
        brand: product?.brand ?? "",
        category: product?.category ?? "",
        price: product?.price ?? null,
        stock: product?.stock ?? null,
        marketplaceProductId: product?.marketplaceProductId ?? ""
    };
};

/**
 * Kayıtlı marketplace mapping + snapshot'tan platform değerleri
 */
const extractPlatformSnapshotFromMp = (mp) => {
    const snap = mp?.platformSnapshot && typeof mp.platformSnapshot === "object" ? mp.platformSnapshot : {};
    return {
        name: snap.name ?? "",
        barcode: snap.marketplaceBarcode ?? snap.barcode ?? mp?.marketplaceBarcode ?? "",
        sku: snap.sku ?? mp?.marketplaceSku ?? "",
        modelNumber: snap.modelNumber ?? "",
        brand: snap.brand ?? "",
        category: snap.category ?? snap.categoryName ?? mp?.categoryName ?? "",
        price: snap.price ?? mp?.price ?? null,
        stock: snap.stock ?? mp?.stock ?? null,
        marketplaceProductId: snap.marketplaceProductId ?? mp?.marketplaceProductId ?? ""
    };
};

const valuesEqual = (fieldKey, masterVal, platformVal) => {
    const m = masterVal == null || masterVal === "" ? "" : masterVal;
    const p = platformVal == null || platformVal === "" ? "" : platformVal;

    if (fieldKey === "name") {
        return normalizeNameKey(m) === normalizeNameKey(p);
    }
    if (fieldKey === "price") {
        const mn = normalizePrice(m);
        const pn = normalizePrice(p);
        if (mn == null && pn == null) return true;
        if (mn == null || pn == null) return false;
        return mn === pn;
    }
    return normalizeKey(m) === normalizeKey(p);
};

/**
 * Master ile platform snapshot karşılaştır
 * @returns {{ hasDrift: boolean, drifts: Array, platformSnapshot: Object }}
 */
const compareMasterWithPlatform = (masterProduct, platformSnapshot, options = {}) => {
    const { includePrice = true, includeStockInfo = false } = options;
    const drifts = [];

    for (const def of FIELD_DEFS) {
        if (def.key === "price" && !includePrice) continue;

        const masterValue = getMasterFieldValue(masterProduct, def.key);
        const platformValue = platformSnapshot?.[def.key] ?? "";

        // Platformda alan boşsa fark sayma (henüz çekilmemiş / API vermedi)
        if (platformValue === "" || platformValue == null) continue;
        if (masterValue === "" || masterValue == null) {
            if (def.identity) {
                drifts.push({
                    field: def.key,
                    label: def.label,
                    masterValue: masterValue ?? "",
                    platformValue: String(platformValue),
                    severity: def.severity,
                    hint: "Master kayıtta boş — platformda dolu"
                });
            }
            continue;
        }

        if (!valuesEqual(def.key, masterValue, platformValue)) {
            drifts.push({
                field: def.key,
                label: def.label,
                masterValue: String(masterValue),
                platformValue: String(platformValue),
                severity: def.severity
            });
        }
    }

    if (includeStockInfo && platformSnapshot?.stock != null) {
        const masterStock = masterProduct?._totalStock;
        if (masterStock != null && Number(platformSnapshot.stock) !== Number(masterStock)) {
            drifts.push({
                field: "stock",
                label: "Stok (bilgi)",
                masterValue: String(masterStock),
                platformValue: String(platformSnapshot.stock),
                severity: "info",
                hint: "Master stok tek kaynaktır; bu satır yalnızca bilgilendirme"
            });
        }
    }

    const hasCritical = drifts.some((d) => d.severity === "critical");

    return {
        hasDrift: drifts.length > 0,
        hasCritical,
        drifts,
        platformSnapshot: { ...platformSnapshot, checkedAt: new Date() }
    };
};

/**
 * ProductMapping belgesinde bir pazaryeri satırına drift sonucunu yazar
 */
const applyFieldDriftToMarketplaceMapping = (mpEntry, masterProduct, platformProduct, stockTracking) => {
    const snapshot = extractPlatformSnapshot(platformProduct);
    const masterForCompare = {
        ...masterProduct,
        _totalStock: stockTracking?.totalStock ?? masterProduct?.stock
    };
    const result = compareMasterWithPlatform(masterForCompare, snapshot, {
        includePrice: true,
        includeStockInfo: true
    });

    mpEntry.platformSnapshot = {
        ...snapshot,
        pulledAt: new Date()
    };
    mpEntry.fieldDrift = {
        hasDrift: result.hasDrift,
        hasCritical: result.hasCritical,
        drifts: result.drifts,
        lastCheckedAt: new Date()
    };

    if (result.hasCritical) {
        const labels = result.drifts.filter((d) => d.severity === "critical").map((d) => d.label);
        mpEntry.syncError = `Kritik alan farkı: ${labels.join(", ")}`;
        if (mpEntry.syncStatus === "synced") {
            mpEntry.syncStatus = "error";
        }
    }

    return result;
};

/**
 * Master alanına platform değerini uygula (kullanıcı onayı)
 */
const applyPlatformValueToMaster = (masterProduct, fieldKey, platformValue) => {
    if (!masterProduct || !fieldKey) return false;
    const v = platformValue == null ? "" : platformValue;

    switch (fieldKey) {
        case "barcode":
            masterProduct.barcode = normalizeKey(v);
            return true;
        case "sku":
            masterProduct.sku = normalizeKey(v);
            return true;
        case "name":
            masterProduct.name = normalizeKey(v);
            return true;
        case "modelNumber": {
            if (!masterProduct.attributes || typeof masterProduct.attributes !== "object") {
                masterProduct.attributes = {};
            }
            masterProduct.attributes.model = normalizeKey(v);
            return true;
        }
        case "brand":
            masterProduct.brand = normalizeKey(v);
            return true;
        case "category":
            masterProduct.category = normalizeKey(v);
            return true;
        case "price": {
            const p = normalizePrice(v);
            if (p == null) return false;
            masterProduct.price = p;
            return true;
        }
        default:
            return false;
    }
};

/** Snapshot → pull satırı formatı */
const snapshotToPullProduct = (snap) => ({
    name: snap?.name ?? "",
    barcode: snap?.barcode ?? "",
    sku: snap?.sku ?? "",
    attributes: { model: snap?.modelNumber ?? "" },
    brand: snap?.brand ?? "",
    category: snap?.category ?? "",
    price: snap?.price ?? null,
    stock: snap?.stock ?? null,
    marketplaceProductId: snap?.marketplaceProductId ?? ""
});

/** Master değerlerinden snapshot (dağıtım sonrası hizalama) */
const masterToPullProduct = (masterProduct, stockTracking, marketplaceProductId = "") => ({
    name: masterProduct?.name ?? "",
    barcode: masterProduct?.barcode ?? "",
    sku: masterProduct?.sku ?? "",
    attributes: masterProduct?.attributes || {},
    brand: masterProduct?.brand ?? "",
    category: masterProduct?.category ?? "",
    price: masterProduct?.price ?? null,
    stock: stockTracking?.totalStock ?? masterProduct?.stock ?? null,
    marketplaceProductId
});

/**
 * Tüm pazaryeri satırlarında kayıtlı snapshot ile drift yenile
 */
const refreshAllFieldDriftsForMapping = (mapping) => {
    const results = [];
    for (const mp of mapping.marketplaceMappings || []) {
        const snap = extractPlatformSnapshotFromMp(mp);
        if (!snap.barcode && !snap.sku && !snap.name) continue;
        const r = applyFieldDriftToMarketplaceMapping(
            mp,
            mapping.masterProduct,
            snapshotToPullProduct(snap),
            mapping.stockTracking
        );
        results.push({ marketplaceName: mp.marketplaceName, ...r });
    }
    return results;
};

/**
 * Dağıtım / pull sonrası platform snapshot = master (fark kapanır)
 */
const alignPlatformSnapshotFromMaster = (mpEntry, mapping) => {
    const pull = masterToPullProduct(
        mapping.masterProduct,
        mapping.stockTracking,
        mpEntry.marketplaceProductId || ""
    );
    return applyFieldDriftToMarketplaceMapping(mpEntry, mapping.masterProduct, pull, mapping.stockTracking);
};

/**
 * Sipariş satırından stok düşümü için gerçek barkod/SKU çöz (SYNC- sentetiklerini atla)
 */
const resolveOrderItemBarcodeForStock = async (userId, item) => {
    const rawBc = String(item?.barcode || "").trim();
    const rawSku = String(item?.sku || "").trim();
    if (rawBc && !rawBc.startsWith("SYNC-")) return rawBc;
    if (rawSku && !rawSku.startsWith("SYNC-")) return rawSku;

    const name = String(item?.productName || "").trim();
    if (name && userId) {
        const m = await ProductMapping.findOne({
            userId,
            "masterProduct.name": { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") }
        })
            .select("masterProduct.barcode masterProduct.sku")
            .lean();
        if (m?.masterProduct?.barcode) return String(m.masterProduct.barcode).trim();
        if (m?.masterProduct?.sku) return String(m.masterProduct.sku).trim();
    }

    return rawBc || rawSku || null;
};

module.exports = {
    FIELD_DEFS,
    normalizeKey,
    extractPlatformSnapshot,
    extractPlatformSnapshotFromMp,
    snapshotToPullProduct,
    masterToPullProduct,
    compareMasterWithPlatform,
    applyFieldDriftToMarketplaceMapping,
    refreshAllFieldDriftsForMapping,
    alignPlatformSnapshotFromMaster,
    applyPlatformValueToMaster,
    getMasterFieldValue,
    resolveOrderItemBarcodeForStock
};
