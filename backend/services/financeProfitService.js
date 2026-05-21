/**
 * Finans — ürün bazlı kâr/zarar, komisyon, kargo, paketleme (ince detay)
 */
const Order = require("../models/Order");
const Marketplace = require("../models/Marketplace");
const {
    buildProductEconomicsIndex,
    resolveLineEconomics,
    normMpKey,
    defaultCommissionForMarketplace,
} = require("../utils/productEconomicsLookup");
const {
    buildOrderMatch,
    allocateOrderShippingToRows,
    round2,
    round1,
} = require("../utils/analyticsEconomics");

const PROFIT_ZONES = [
    { id: "loss", label: "Zarar", minMargin: -Infinity, maxMargin: 0, color: "#ef4444" },
    { id: "low", label: "Düşük kâr", minMargin: 0, maxMargin: 10, color: "#f59e0b" },
    { id: "good", label: "Sağlıklı", minMargin: 10, maxMargin: 25, color: "#4ecdc4" },
    { id: "excellent", label: "Yüksek kâr", minMargin: 25, maxMargin: Infinity, color: "#22c55e" },
];

function resolveProfitZone(marginPct) {
    const m = Number(marginPct) || 0;
    return PROFIT_ZONES.find((z) => m >= z.minMargin && m < z.maxMargin) || PROFIT_ZONES[0];
}

function mappingToCostRow(pm, existing = {}) {
    const mp = pm.masterProduct || {};
    const rates = (pm.marketplaceMappings || [])
        .filter((m) => m.isActive !== false && Number(m.commissionRate) > 0)
        .map((m) => Number(m.commissionRate));
    const avgMpCommission =
        rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
    return {
        mappingId: String(pm._id),
        name: mp.name || existing.name,
        category: mp.category || existing.category,
        stock: mp.stock ?? existing.stock,
        costPrice: Number(mp.costPrice) || existing.costPrice || 0,
        salePrice: Number(mp.price) || existing.salePrice || 0,
        commissionRate: avgMpCommission || existing.commissionRate || 0,
        shippingCost: Number(mp.shippingCost) || existing.shippingCost || 0,
        packagingCost: Number(mp.packagingCost) || existing.packagingCost || 0,
        marketplaces: (pm.marketplaceMappings || [])
            .filter((m) => m.isActive !== false)
            .map((m) => ({
                name: m.marketplaceName,
                commissionRate: Number(m.commissionRate) || 0,
                price: m.price,
            })),
    };
}

function registerCostKey(map, key, row) {
    const k = String(key || "").trim();
    if (!k) return;
    const prev = map.get(k);
    if (!prev) {
        map.set(k, row);
        return;
    }
    map.set(k, {
        ...prev,
        costPrice: prev.costPrice > 0 ? prev.costPrice : row.costPrice,
        commissionRate: prev.commissionRate > 0 ? prev.commissionRate : row.commissionRate,
        shippingCost: prev.shippingCost > 0 ? prev.shippingCost : row.shippingCost,
        packagingCost: prev.packagingCost > 0 ? prev.packagingCost : row.packagingCost,
        marketplaces: row.marketplaces?.length ? row.marketplaces : prev.marketplaces,
    });
}

async function loadProductCostMap(userId, barcodes) {
    const map = new Map();
    const unique = [...new Set(barcodes.map((b) => String(b || "").trim()).filter(Boolean))];
    if (!unique.length) return map;

    const [legacy, mappings] = await Promise.all([
        Product.find({
            userId,
            $or: [{ barcode: { $in: unique } }, { sku: { $in: unique } }],
        })
            .select("barcode sku name category stock costPrice salePrice commissionRate shippingCost packagingCost")
            .lean(),
        ProductMapping.find({
            userId,
            $or: [
                { "masterProduct.barcode": { $in: unique } },
                { "masterProduct.sku": { $in: unique } },
                { "marketplaceMappings.marketplaceBarcode": { $in: unique } },
                { "marketplaceMappings.marketplaceSku": { $in: unique } },
            ],
        })
            .select("masterProduct marketplaceMappings")
            .lean(),
    ]);

    for (const p of legacy) {
        const row = {
            name: p.name,
            category: p.category,
            stock: p.stock,
            costPrice: Number(p.costPrice) || 0,
            salePrice: Number(p.salePrice) || 0,
            commissionRate: Number(p.commissionRate) || 0,
            shippingCost: Number(p.shippingCost) || 0,
            packagingCost: Number(p.packagingCost) || 0,
            marketplaces: [],
        };
        if (p.barcode) registerCostKey(map, p.barcode, row);
        if (p.sku) registerCostKey(map, p.sku, row);
    }

    for (const pm of mappings) {
        const row = mappingToCostRow(pm, map.get(pm.masterProduct?.barcode) || {});
        const mp = pm.masterProduct || {};
        if (mp.barcode) registerCostKey(map, mp.barcode, row);
        if (mp.sku) registerCostKey(map, mp.sku, row);
        for (const m of pm.marketplaceMappings || []) {
            if (m.marketplaceBarcode) registerCostKey(map, m.marketplaceBarcode, row);
            if (m.marketplaceSku) registerCostKey(map, m.marketplaceSku, row);
        }
    }

    return map;
}

/** Sipariş satırlarından barkod + pazaryeri ortalama komisyon / kargo */
async function buildOrderFeeHints(userId, start, end) {
    const rows = await Order.aggregate([
        { $match: buildOrderMatch(userId, start, end, { excludeCancelled: true }) },
        { $unwind: "$items" },
        {
            $group: {
                _id: { bc: "$items.barcode", mp: "$marketplaceName" },
                sumComm: { $sum: { $ifNull: ["$items.commissionAmount", 0] } },
                sumRev: {
                    $sum: {
                        $multiply: [
                            { $ifNull: ["$items.price", 0] },
                            { $ifNull: ["$items.quantity", 1] },
                        ],
                    },
                },
                sumShip: { $sum: { $ifNull: ["$items.shippingCost", 0] } },
                n: { $sum: 1 },
            },
        },
    ]);

    const byBcMp = new Map();
    const byBc = new Map();

    for (const r of rows) {
        const bc = String(r._id.bc || "").trim();
        if (!bc) continue;
        const rev = Number(r.sumRev) || 0;
        const comm = Number(r.sumComm) || 0;
        const n = Math.max(Number(r.n) || 1, 1);
        const hint = {
            avgCommissionPct: rev > 0 ? round1((comm / rev) * 100) : 0,
            avgShippingCost: round2((Number(r.sumShip) || 0) / n),
        };
        byBcMp.set(`${bc}|||${normMpKey(r._id.mp)}`, hint);
        if (!byBc.has(bc)) byBc.set(bc, { commPcts: [], ships: [] });
        const b = byBc.get(bc);
        if (hint.avgCommissionPct > 0) b.commPcts.push(hint.avgCommissionPct);
        if (hint.avgShippingCost > 0) b.ships.push(hint.avgShippingCost);
    }

    const fallback = new Map();
    for (const [bc, b] of byBc.entries()) {
        const avg = (arr) =>
            arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
        fallback.set(bc, {
            avgCommissionPct: round1(avg(b.commPcts)),
            avgShippingCost: round2(avg(b.ships)),
        });
    }

    return { byBcMp, fallback };
}

/**
 * Sipariş snapshot 0 ise Ürün Merkezi + pazaryeri oranı + geçmiş sipariş ortalaması ile tamamla
 */
function enrichProductEconomics(rawRow, info, opts) {
    const {
        marketplaceName,
        feeByBcMp,
        feeFallback,
        orderMarketplaces = [],
    } = opts;

    const totalSold = rawRow.totalSold || 0;
    const totalRevenue = rawRow.totalRevenue || 0;
    const sources = [];
    const missingFields = [];

    let totalProductCost = rawRow.totalProductCost || 0;
    let totalCommission = rawRow.totalCommission || 0;
    let totalShipping = rawRow.totalShipping || 0;

    const orderBc = String(rawRow._id || "").trim();
    const mpKey = normMpKey(marketplaceName);
    const feeHint =
        feeByBcMp.get(`${orderBc}|||${mpKey}`) ||
        feeFallback.get(orderBc) ||
        null;

    if (totalProductCost < 0.01 && info.costPrice > 0 && totalSold > 0) {
        totalProductCost = round2(info.costPrice * totalSold);
        sources.push("urun_merkezi_maliyet");
    } else if (totalProductCost < 0.01) {
        missingFields.push("maliyet");
    }

    if (totalCommission < 0.01 && totalRevenue > 0) {
        let rate = 0;
        let commSource = "";
        const mpList = info.marketplaces || [];
        const targetMp = marketplaceName || orderMarketplaces[0];
        if (targetMp) {
            const matchMp = mpList.find((m) =>
                normMpKey(m.name).includes(normMpKey(targetMp)) ||
                normMpKey(targetMp).includes(normMpKey(m.name))
            );
            if (matchMp?.commissionRate > 0) {
                rate = matchMp.commissionRate;
                commSource = "pazaryeri_eslesme";
            }
        }
        if (rate <= 0 && info.commissionRate > 0) {
            rate = info.commissionRate;
            commSource = "urun_merkezi_ortalama";
        }
        if (rate <= 0 && feeHint?.avgCommissionPct > 0) {
            rate = feeHint.avgCommissionPct;
            commSource = "gecmis_siparis";
        }
        if (rate <= 0 && targetMp) {
            rate = defaultCommissionForMarketplace(targetMp);
            commSource = "varsayilan_pazaryeri";
        }
        if (rate > 0) {
            totalCommission = round2(totalRevenue * (rate / 100));
            sources.push(commSource);
        } else {
            missingFields.push("komisyon");
        }
    }

    if (totalShipping < 0.01 && totalSold > 0) {
        if (info.shippingCost > 0) {
            totalShipping = round2(info.shippingCost * totalSold);
            sources.push("urun_merkezi_kargo");
        } else if (feeHint?.avgShippingCost > 0) {
            totalShipping = round2(feeHint.avgShippingCost * totalSold);
            sources.push("gecmis_siparis_kargo");
        } else {
            missingFields.push("kargo");
        }
    }

    const packagingPerUnit = Number(info.packagingCost) || 0;
    const totalPackaging = round2(packagingPerUnit * totalSold);
    if (packagingPerUnit <= 0 && totalSold > 0) missingFields.push("paketleme");

    const grossProfit = round2(totalRevenue - totalProductCost);
    let netProfit = round2(
        totalRevenue - totalProductCost - totalCommission - totalShipping - totalPackaging
    );
    const profitMargin = totalRevenue > 0 ? round1((netProfit / totalRevenue) * 100) : 0;

    const hasCostData = info.costPrice > 0;
    const isEstimated = sources.length > 0 && (rawRow.totalProductCost < 0.01 || rawRow.totalCommission < 0.01);
    const dataQuality =
        missingFields.length === 0 && hasCostData && !isEstimated
            ? "complete"
            : missingFields.includes("maliyet")
                ? "missing_cost"
                : isEstimated
                    ? "estimated"
                    : "partial";

    return {
        totalProductCost,
        totalCommission,
        totalShipping,
        totalPackaging,
        grossProfit,
        netProfit,
        profitMargin,
        packagingPerUnit,
        sources,
        missingFields,
        hasCostData,
        dataQuality,
        feeHint,
    };
}

/**
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {Date} start
 * @param {Date} end
 * @param {{ marketplaceId?: string, marketplaceName?: string, sortBy?: string, limit?: number }} options
 */
async function getProductProfitAnalysis(userId, start, end, options = {}) {
    const { sortBy = "netProfit", limit = 300 } = options;
    let marketplaceName = options.marketplaceName || null;

    if (options.marketplaceId && !marketplaceName) {
        const mp = await Marketplace.findOne({ _id: options.marketplaceId, userId })
            .select("marketplaceName")
            .lean();
        marketplaceName = mp?.marketplaceName || null;
    }

    const match = buildOrderMatch(userId, start, end, { excludeCancelled: true });
    if (marketplaceName) {
        match.marketplaceName = new RegExp(
            "^" + marketplaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
            "i"
        );
    }

    const sortField =
        { revenue: "totalRevenue", profit: "netProfit", sales: "totalSold", netProfit: "netProfit" }[
            sortBy
        ] || "netProfit";

    const [orderLines, productMap] = await Promise.all([
        Order.aggregate([
            { $match: match },
            { $unwind: "$items" },
            {
                $project: {
                    _id: 0,
                    orderId: { $toString: "$_id" },
                    marketplaceName: 1,
                    barcode: "$items.barcode",
                    productName: "$items.productName",
                    sku: "$items.sku",
                    quantity: "$items.quantity",
                    price: "$items.price",
                    category: "$items.category",
                    costPrice: "$items.costPrice",
                    commissionAmount: "$items.commissionAmount",
                    commissionRate: "$items.commissionRate",
                    shippingCost: "$items.shippingCost",
                    orderShippingPool: { $ifNull: ["$costSummary.totalShipping", 0] },
                },
            },
        ]).allowDiskUse(true),
        buildProductEconomicsIndex(userId),
    ]);

    if (orderLines.length === 0) {
        return emptyAnalysis(start, end, marketplaceName);
    }

    const byBarcode = new Map();

    for (const line of orderLines) {
        const bc = String(line.barcode || "").trim() || "unknown";
        const item = {
            barcode: line.barcode,
            sku: line.sku,
            productName: line.productName,
            quantity: line.quantity,
            price: line.price,
            costPrice: line.costPrice,
            commissionAmount: line.commissionAmount,
            commissionRate: line.commissionRate,
            shippingCost: line.shippingCost,
        };
        const econ = resolveLineEconomics(item, line.marketplaceName, productMap, {
            allowDefaultCommission: false,
        });

        if (!byBarcode.has(bc)) {
            byBarcode.set(bc, {
                _id: bc,
                name: line.productName,
                category: line.category,
                totalSold: 0,
                totalRevenue: 0,
                totalProductCost: 0,
                totalCommission: 0,
                totalShipping: 0,
                totalPackaging: 0,
                netProfit: 0,
                orderIds: new Set(),
                marketplaces: new Set(),
                sources: new Set(),
                missingFields: new Set(),
                hasCostData: false,
                mappingFound: false,
                info: econ.info,
            });
        }
        const row = byBarcode.get(bc);
        row.totalSold += econ.qty;
        row.totalRevenue += econ.revenue;
        row.totalProductCost += econ.productCostTotal;
        row.totalCommission += econ.commissionAmount;
        row.totalShipping += econ.shippingCost;
        row.totalPackaging += econ.packagingTotal;
        row.netProfit += econ.netProfit;
        row.orderIds.add(line.orderId);
        if (line.marketplaceName) row.marketplaces.add(line.marketplaceName);
        econ.sources.forEach((s) => row.sources.add(s));
        econ.missingFields.forEach((m) => row.missingFields.add(m));
        if (econ.hasCostData) row.hasCostData = true;
        if (econ.mappingFound) row.mappingFound = true;
        if (!row.name && line.productName) row.name = line.productName;
        if (!row.category && line.category) row.category = line.category;
    }

    const rawRows = [...byBarcode.values()].map((r) => ({
        _id: r._id,
        name: r.name,
        category: r.category,
        totalSold: r.totalSold,
        totalRevenue: r.totalRevenue,
        totalProductCost: r.totalProductCost,
        totalCommission: r.totalCommission,
        totalShipping: r.totalShipping,
        totalPackaging: r.totalPackaging,
        netProfit: r.netProfit,
        orderCount: r.orderIds.size,
        marketplaces: [...r.marketplaces],
        sources: [...r.sources],
        missingFields: [...r.missingFields],
        hasCostData: r.hasCostData,
        mappingFound: r.mappingFound,
        info: r.info,
    }));

    const rowsForAlloc = rawRows.map((p) => ({
        barcode: p._id,
        totalShipping: p.totalShipping || 0,
        netProfit: p.netProfit || 0,
    }));
    allocateOrderShippingToRows(
        rowsForAlloc,
        orderLines.map((l) => ({
            orderId: l.orderId,
            barcode: l.barcode,
            lineRevenue: (Number(l.price) || 0) * (Number(l.quantity) || 1),
            lineShipping: Number(l.shippingCost) || 0,
            orderShippingPool: l.orderShippingPool,
        }))
    );
    const allocMap = new Map(rowsForAlloc.map((r) => [r.barcode, r]));
    rawRows.forEach((p) => {
        const a = allocMap.get(p._id);
        if (a) {
            const shipDelta = (a.totalShipping || 0) - (p.totalShipping || 0);
            p.totalShipping = a.totalShipping;
            p.netProfit = (p.netProfit || 0) - shipDelta;
        }
    });

    rawRows.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
    const limited = rawRows.slice(0, parseInt(limit, 10) || 300);

    const returnData = await Order.aggregate([
        { $match: { ...match, isReturned: true } },
        { $unwind: "$items" },
        { $group: { _id: "$items.barcode", returnCount: { $sum: "$items.quantity" } } },
    ]);
    const returnMap = new Map(returnData.map((r) => [r._id, r.returnCount]));

    const products = limited.map((p) => {
        const info = p.info || {};
        const totalSold = p.totalSold || 0;
        const totalRevenue = p.totalRevenue || 0;
        const totalProductCost = p.totalProductCost || 0;
        const totalCommission = p.totalCommission || 0;
        const totalShipping = p.totalShipping || 0;
        const totalPackaging = p.totalPackaging || 0;
        const netProfit = p.netProfit || 0;
        const grossProfit = round2(totalRevenue - totalProductCost);
        const profitMargin =
            totalRevenue > 0 ? round1((netProfit / totalRevenue) * 100) : 0;
        const packagingPerUnit = totalSold > 0 ? totalPackaging / totalSold : info.packagingCost || 0;

        const missingFields = p.missingFields || [];
        const sources = p.sources || [];
        const dataQuality =
            missingFields.length === 0 && p.hasCostData
                ? "complete"
                : missingFields.includes("maliyet")
                    ? "missing_cost"
                    : missingFields.length
                        ? "partial"
                        : p.hasCostData
                            ? "complete"
                            : "partial";

        const zone = resolveProfitZone(profitMargin);
        const returnCount = returnMap.get(p._id) || 0;

        const unitSalePrice = totalSold > 0 ? totalRevenue / totalSold : info.salePrice || 0;
        const unitProductCost = totalSold > 0 ? totalProductCost / totalSold : info.costPrice || 0;
        const unitCommission = totalSold > 0 ? totalCommission / totalSold : 0;
        const unitShipping = totalSold > 0 ? totalShipping / totalSold : info.shippingCost || 0;

        const commissionRatePct =
            totalRevenue > 0
                ? round1((totalCommission / totalRevenue) * 100)
                : info.commissionRate || 0;

        const unitNetProfit = totalSold > 0 ? netProfit / totalSold : 0;

        const mpCommissions = (info.marketplaces || []).map((m) => ({
            ...m,
            configured: Number(m.commissionRate) > 0,
        }));

        return {
            barcode: p._id,
            name: p.name || info.name || "Bilinmeyen",
            category: p.category || info.category || "Bilinmiyor",
            totalSold,
            orderCount: p.orderCount || 0,
            returnCount,
            returnRate: totalSold > 0 ? round1((returnCount / totalSold) * 100) : 0,
            marketplaces: p.marketplaces || [],
            totalRevenue: round2(totalRevenue),
            totalProductCost: round2(totalProductCost),
            totalCommission: round2(totalCommission),
            totalShipping: round2(totalShipping),
            totalPackaging: round2(totalPackaging),
            grossProfit,
            netProfit: round2(netProfit),
            profitMargin,
            profitZone: zone.id,
            profitZoneLabel: zone.label,
            profitZoneColor: zone.color,
            commissionRate: commissionRatePct,
            currentStock: info.stock ?? 0,
            unitBreakdown: {
                salePrice: round2(unitSalePrice),
                productCost: round2(unitProductCost),
                commission: round2(unitCommission),
                shipping: round2(unitShipping),
                packaging: round2(packagingPerUnit),
                netProfit: round2(unitNetProfit),
                commissionRate: commissionRatePct,
            },
            costBreakdown: {
                productCost: round2(totalProductCost),
                commission: round2(totalCommission),
                shipping: round2(totalShipping),
                packaging: round2(totalPackaging),
                totalExpenses: round2(
                    totalProductCost + totalCommission + totalShipping + totalPackaging
                ),
            },
            marketplaceCommissions: mpCommissions,
            hasCostData: p.hasCostData,
            dataQuality,
            calculationSources: sources,
            missingFields,
            mappingFound: p.mappingFound,
        };
    });

    const summary = products.reduce(
        (acc, p) => {
            acc.productCount += 1;
            acc.totalSold += p.totalSold;
            acc.totalRevenue += p.totalRevenue;
            acc.totalProductCost += p.totalProductCost;
            acc.totalCommission += p.totalCommission;
            acc.totalShipping += p.totalShipping;
            acc.totalPackaging += p.totalPackaging;
            acc.grossProfit += p.grossProfit;
            acc.netProfit += p.netProfit;
            if (p.netProfit < 0) acc.lossProductCount += 1;
            if (!p.hasCostData || p.dataQuality === "missing_cost") acc.missingCostCount += 1;
            if (p.dataQuality === "estimated" || p.dataQuality === "partial") {
                acc.estimatedCount = (acc.estimatedCount || 0) + 1;
            }
            acc.heatmap[p.profitZone] = (acc.heatmap[p.profitZone] || 0) + 1;
            return acc;
        },
        {
            productCount: 0,
            totalSold: 0,
            totalRevenue: 0,
            totalProductCost: 0,
            totalCommission: 0,
            totalShipping: 0,
            totalPackaging: 0,
            grossProfit: 0,
            netProfit: 0,
            lossProductCount: 0,
            missingCostCount: 0,
            estimatedCount: 0,
            heatmap: { loss: 0, low: 0, good: 0, excellent: 0 },
        }
    );

    summary.grossProfit = round2(summary.totalRevenue - summary.totalProductCost);
    summary.netProfit = round2(summary.netProfit);
    summary.profitMargin =
        summary.totalRevenue > 0
            ? round1((summary.netProfit / summary.totalRevenue) * 100)
            : 0;
    summary.avgCommissionRate =
        summary.totalRevenue > 0
            ? round1((summary.totalCommission / summary.totalRevenue) * 100)
            : 0;

    Object.keys(summary).forEach((k) => {
        if (
            typeof summary[k] === "number" &&
            !["profitMargin", "avgCommissionRate"].includes(k)
        ) {
            summary[k] = round2(summary[k]);
        }
    });

    const waterfall = [
        { key: "revenue", label: "Brüt ciro", value: summary.totalRevenue, type: "positive" },
        { key: "productCost", label: "Ürün maliyeti", value: -summary.totalProductCost, type: "negative" },
        { key: "commission", label: "Pazaryeri komisyonu", value: -summary.totalCommission, type: "negative" },
        { key: "shipping", label: "Kargo", value: -summary.totalShipping, type: "negative" },
        { key: "packaging", label: "Paketleme", value: -summary.totalPackaging, type: "negative" },
        { key: "netProfit", label: "Net kâr", value: summary.netProfit, type: "result" },
    ];

    const topProfit = [...products].sort((a, b) => b.netProfit - a.netProfit).slice(0, 8);
    const topLoss = [...products]
        .filter((p) => p.netProfit < 0)
        .sort((a, b) => a.netProfit - b.netProfit)
        .slice(0, 8);

    return {
        products,
        summary,
        waterfall,
        heatmapLegend: PROFIT_ZONES,
        topProfit,
        topLoss,
        period: { start, end },
        marketplaceName,
        dataSource: "orders",
        hints: buildProfitHints(summary),
        whyMissingGuide: {
            maliyet: "Ürün Merkezi → ürün kartı → Alış maliyeti (costPrice) alanı boş veya sipariş barkodu master barkodla eşleşmiyor.",
            komisyon: "Pazaryeri eşleştirmesinde komisyon % girilmemiş; geçmiş sipariş veya varsayılan pazaryeri oranı kullanıldı.",
            kargo: "Ürün kartında kargo maliyeti yok; geçmiş sipariş ortalaması veya 0 gösterilir.",
            paketleme: "Ürün kartında paketleme maliyeti tanımlı değil.",
        },
    };
}

function buildProfitHints(summary) {
    const parts = [];
    if (summary.missingCostCount > 0) {
        parts.push(
            `${summary.missingCostCount} üründe alış maliyeti tanımlı değil — Ürün Merkezi'nde maliyet girin.`
        );
    }
    if (summary.estimatedCount > 0) {
        parts.push(
            `${summary.estimatedCount} üründe maliyet, komisyon veya kargo eksik — Ürün Merkezi'nde alış maliyeti, pazaryeri komisyon % ve kargo alanlarını doldurun.`
        );
    }
    return parts.length ? parts.join(" ") : null;
}

function emptyAnalysis(start, end, marketplaceName) {
    return {
        products: [],
        summary: {
            productCount: 0,
            totalSold: 0,
            totalRevenue: 0,
            totalProductCost: 0,
            totalCommission: 0,
            totalShipping: 0,
            totalPackaging: 0,
            grossProfit: 0,
            netProfit: 0,
            profitMargin: 0,
            avgCommissionRate: 0,
            lossProductCount: 0,
            missingCostCount: 0,
            heatmap: { loss: 0, low: 0, good: 0, excellent: 0 },
        },
        waterfall: [],
        heatmapLegend: PROFIT_ZONES,
        topProfit: [],
        topLoss: [],
        period: { start, end },
        marketplaceName,
        dataSource: "orders",
        hints: "Seçilen dönemde sipariş bulunamadı. Sipariş senkronizasyonu yapın veya tarih aralığını genişletin.",
    };
}

module.exports = {
    getProductProfitAnalysis,
    PROFIT_ZONES,
};
