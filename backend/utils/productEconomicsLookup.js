/**
 * Ürün Merkezi (Product + ProductMapping) → sipariş/finans ekonomisi tek kaynak
 */
const Product = require("../models/Product");
const ProductMapping = require("../models/ProductMapping");

function normMpKey(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ç/g, "c")
        .replace(/ö/g, "o")
        .replace(/ü/g, "u")
        .replace(/ğ/g, "g")
        .replace(/\s+/g, "");
}

const DEFAULT_MP_COMMISSION = {
    trendyol: 15,
    hepsiburada: 12,
    n11: 12,
    ciceksepeti: 15,
    amazon: 15,
};

function defaultCommissionForMarketplace(mpName) {
    const k = normMpKey(mpName);
    if (k.includes("trendyol")) return DEFAULT_MP_COMMISSION.trendyol;
    if (k.includes("hepsiburada") || k.includes("hepsi")) return DEFAULT_MP_COMMISSION.hepsiburada;
    if (k.includes("n11")) return DEFAULT_MP_COMMISSION.n11;
    if (k.includes("cicek")) return DEFAULT_MP_COMMISSION.ciceksepeti;
    if (k.includes("amazon")) return DEFAULT_MP_COMMISSION.amazon;
    return 12;
}

function registerKey(map, key, row) {
    const k = String(key || "").trim();
    if (!k) return;
    const prev = map.get(k);
    if (!prev) {
        map.set(k, row);
        return;
    }
    map.set(k, {
        ...prev,
        name: prev.name || row.name,
        category: prev.category || row.category,
        stock: prev.stock ?? row.stock,
        costPrice: prev.costPrice > 0 ? prev.costPrice : row.costPrice,
        salePrice: prev.salePrice > 0 ? prev.salePrice : row.salePrice,
        commissionRate: prev.commissionRate > 0 ? prev.commissionRate : row.commissionRate,
        shippingCost: prev.shippingCost > 0 ? prev.shippingCost : row.shippingCost,
        packagingCost: prev.packagingCost > 0 ? prev.packagingCost : row.packagingCost,
        marketplaces:
            (row.marketplaces || []).length >= (prev.marketplaces || []).length
                ? row.marketplaces
                : prev.marketplaces,
        mappingId: prev.mappingId || row.mappingId,
    });
}

function rowFromLegacyProduct(p) {
    return {
        mappingId: null,
        masterBarcode: String(p.barcode || "").trim(),
        masterSku: String(p.sku || "").trim(),
        name: p.name,
        category: p.category,
        stock: p.stock,
        costPrice: Number(p.costPrice) || 0,
        salePrice: Number(p.salePrice) || 0,
        commissionRate: Number(p.commissionRate) || 0,
        shippingCost: Number(p.shippingCost) || 0,
        packagingCost: Number(p.packagingCost) || 0,
        mainImage: p.mainImage || (p.images && p.images[0]),
        images: p.images,
        marketplaces: [],
    };
}

function rowFromMapping(pm, existing = {}) {
    const mp = pm.masterProduct || {};
    const mappings = (pm.marketplaceMappings || []).filter((m) => m.isActive !== false);
    const rates = mappings
        .map((m) => Number(m.commissionRate))
        .filter((r) => r > 0);
    const avgCommission =
        rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
    return {
        mappingId: String(pm._id),
        masterBarcode: String(mp.barcode || "").trim(),
        masterSku: String(mp.sku || "").trim(),
        name: mp.name || existing.name,
        category: mp.category || existing.category,
        stock: mp.stock ?? existing.stock,
        costPrice: Number(mp.costPrice) || existing.costPrice || 0,
        salePrice: Number(mp.price) || existing.salePrice || 0,
        commissionRate: avgCommission || existing.commissionRate || 0,
        shippingCost: Number(mp.shippingCost) || existing.shippingCost || 0,
        packagingCost: Number(mp.packagingCost) || existing.packagingCost || 0,
        mainImage: mp.images && mp.images[0],
        images: mp.images,
        marketplaces: mappings.map((m) => ({
            name: m.marketplaceName,
            commissionRate: Number(m.commissionRate) || 0,
        })),
    };
}

const INDEX_CACHE_MS = 90_000;
const indexCache = new Map();

function invalidateProductEconomicsIndex(userId) {
    indexCache.delete(String(userId));
}

/**
 * @returns {Promise<Map<string, object>>}
 */
async function buildProductEconomicsIndex(userId) {
    const cacheKey = String(userId);
    const hit = indexCache.get(cacheKey);
    if (hit && hit.expires > Date.now()) {
        return hit.map;
    }

    const map = new Map();
    const [legacy, mappings] = await Promise.all([
        Product.find({ userId })
            .select(
                "barcode sku stockCode name category stock costPrice salePrice commissionRate shippingCost packagingCost images mainImage"
            )
            .lean(),
        ProductMapping.find({ userId }).select("masterProduct marketplaceMappings").lean(),
    ]);

    for (const p of legacy) {
        const row = rowFromLegacyProduct(p);
        if (p.barcode) registerKey(map, p.barcode, row);
        if (p.sku) registerKey(map, p.sku, row);
        if (p.stockCode) registerKey(map, p.stockCode, row);
    }

    for (const pm of mappings) {
        const base = map.get(pm.masterProduct?.barcode) || {};
        const row = rowFromMapping(pm, base);
        const mp = pm.masterProduct || {};
        if (mp.barcode) registerKey(map, mp.barcode, row);
        if (mp.sku) registerKey(map, mp.sku, row);
        if (mp.stockCode) registerKey(map, mp.stockCode, row);
        for (const m of pm.marketplaceMappings || []) {
            if (m.marketplaceBarcode) registerKey(map, m.marketplaceBarcode, row);
            if (m.marketplaceSku) registerKey(map, m.marketplaceSku, row);
            if (m.marketplaceProductId) registerKey(map, String(m.marketplaceProductId), row);
        }
    }

    return map;
}

function resolveFromIndex(map, { barcode, sku, productName }) {
    const keys = [
        String(barcode || "").trim(),
        String(sku || "").trim(),
    ].filter(Boolean);

    for (const k of keys) {
        if (map.has(k)) return { ...map.get(k), mappingFound: true };
    }

    const nameKey = String(productName || "").trim().toLowerCase();
    if (nameKey) {
        for (const row of map.values()) {
            if (String(row.name || "").trim().toLowerCase() === nameKey) {
                return { ...row, mappingFound: true };
            }
        }
    }

    return {
        mappingFound: false,
        masterBarcode: "",
        masterSku: "",
        costPrice: 0,
        commissionRate: 0,
        shippingCost: 0,
        packagingCost: 0,
        marketplaces: [],
    };
}

function commissionRateForMarketplace(info, marketplaceName) {
    if (!marketplaceName) return 0;
    const target = normMpKey(marketplaceName);
    const list = info.marketplaces || [];
    const match = list.find((m) => {
        const k = normMpKey(m.name);
        return k && (k.includes(target) || target.includes(k));
    });
    return match && Number(match.commissionRate) > 0 ? Number(match.commissionRate) : 0;
}

/**
 * Tek sipariş kalemi için net ekonomi (Ürün Merkezi öncelikli)
 */
function resolveLineEconomics(item, marketplaceName, productMap, options = {}) {
    const { allowDefaultCommission = false } = options;
    const qty = Math.max(parseInt(item.quantity, 10) || 1, 1);
    const price = Number(item.price) || 0;
    const revenue = price * qty;

    const info = resolveFromIndex(productMap, {
        barcode: item.barcode,
        sku: item.sku,
        productName: item.productName || item.name,
    });

    const sources = [];
    const missingFields = [];

    let costPrice = Number(item.costPrice) || 0;
    if (info.costPrice > 0) {
        if (costPrice < 0.01) sources.push("urun_merkezi_maliyet");
        costPrice = info.costPrice;
    } else if (costPrice < 0.01) {
        missingFields.push("maliyet");
    }

    let commissionAmount = Number(item.commissionAmount) || 0;
    let commissionRate = Number(item.commissionRate) || 0;

    if (commissionAmount > 0.001) {
        sources.push("siparis_kaydi");
        if (revenue > 0 && commissionRate < 0.01) {
            commissionRate = (commissionAmount / revenue) * 100;
        }
    } else if (revenue > 0) {
        const mpRate = commissionRateForMarketplace(info, marketplaceName);
        if (mpRate > 0) {
            commissionRate = mpRate;
            commissionAmount = revenue * (mpRate / 100);
            sources.push("pazaryeri_eslesme");
        } else if (info.commissionRate > 0) {
            commissionRate = info.commissionRate;
            commissionAmount = revenue * (commissionRate / 100);
            sources.push("urun_merkezi_ortalama");
        } else if (allowDefaultCommission && marketplaceName) {
            commissionRate = defaultCommissionForMarketplace(marketplaceName);
            commissionAmount = revenue * (commissionRate / 100);
            sources.push("varsayilan_pazaryeri");
        } else {
            missingFields.push("komisyon");
        }
    }

    let shippingCost = Number(item.shippingCost) || 0;
    if (shippingCost < 0.01 && info.shippingCost > 0) {
        shippingCost = info.shippingCost;
        sources.push("urun_merkezi_kargo");
    } else if (shippingCost < 0.01) {
        missingFields.push("kargo");
    }

    const packagingPerUnit = Number(info.packagingCost) || 0;
    const packagingTotal = packagingPerUnit * qty;
    if (packagingPerUnit < 0.01 && qty > 0) missingFields.push("paketleme");

    const productCostTotal = costPrice * qty;
    const netProfit =
        revenue - productCostTotal - commissionAmount - shippingCost - packagingTotal;

    const hasCostData = info.costPrice > 0;
    const usedEstimate = sources.includes("varsayilan_pazaryeri");
    const dataQuality =
        missingFields.length === 0 && hasCostData && !usedEstimate
            ? "complete"
            : missingFields.includes("maliyet")
                ? "missing_cost"
                : usedEstimate || sources.some((s) => s.startsWith("urun_merkezi") || s === "pazaryeri_eslesme")
                    ? sources.length > 0 && missingFields.length > 0
                        ? "partial"
                        : usedEstimate
                            ? "estimated"
                            : missingFields.length
                                ? "partial"
                                : "complete"
                    : missingFields.length
                        ? "partial"
                        : "complete";

    return {
        info,
        qty,
        price,
        revenue,
        costPrice,
        productCostTotal,
        commissionAmount,
        commissionRate,
        shippingCost,
        packagingPerUnit,
        packagingTotal,
        netProfit,
        sources,
        missingFields,
        hasCostData,
        dataQuality,
        mappingFound: info.mappingFound,
    };
}

/**
 * Sipariş kalemi snapshot alanları (sync / backfill)
 */
function economicsToOrderItemFields(econ, item) {
    const qty = Math.max(parseInt(item.quantity, 10) || 1, 1);
    const price = Number(item.price) || 0;
    const totalCost =
        econ.costPrice * qty + econ.commissionAmount + econ.shippingCost + econ.packagingTotal;
    return {
        costPrice: econ.costPrice,
        commissionRate: econ.commissionRate,
        commissionAmount: parseFloat(econ.commissionAmount.toFixed(4)),
        shippingCost: econ.shippingCost,
        netProfit: parseFloat((price * qty - totalCost).toFixed(4)),
    };
}

module.exports = {
    normMpKey,
    defaultCommissionForMarketplace,
    buildProductEconomicsIndex,
    resolveFromIndex,
    commissionRateForMarketplace,
    resolveLineEconomics,
    economicsToOrderItemFields,
    registerKey,
    rowFromMapping,
    rowFromLegacyProduct,
    invalidateProductEconomicsIndex,
};
