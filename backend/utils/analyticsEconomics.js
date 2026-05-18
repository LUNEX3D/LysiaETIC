/**
 * Gelişmiş analiz — sipariş/kalem ekonomisi (tutarlı kâr hesabı)
 */

/** @param {import("mongoose").Types.ObjectId} userId */
function buildOrderMatch(userId, start, end, options = {}) {
    const { excludeCancelled = true, excludeReturned = false } = options;
    const match = {
        user: userId,
        orderDate: { $gte: start, $lte: end },
    };
    if (excludeCancelled) match.isCancelled = { $ne: true };
    if (excludeReturned) match.isReturned = { $ne: true };
    return match;
}

/** Kalem bazlı gelir / maliyet / kâr alanları ($unwind "$items" sonrası) */
const itemEconomicsAddFields = {
    _lineQty: { $ifNull: ["$items.quantity", 0] },
    _linePrice: { $ifNull: ["$items.price", 0] },
    _lineRevenue: {
        $multiply: [{ $ifNull: ["$items.quantity", 0] }, { $ifNull: ["$items.price", 0] }],
    },
    _lineProductCost: {
        $multiply: [{ $ifNull: ["$items.quantity", 0] }, { $ifNull: ["$items.costPrice", 0] }],
    },
    _lineCommission: {
        $cond: [
            { $gt: [{ $ifNull: ["$items.commissionAmount", 0] }, 0] },
            { $ifNull: ["$items.commissionAmount", 0] },
            {
                $multiply: [
                    {
                        $multiply: [
                            { $ifNull: ["$items.quantity", 0] },
                            { $ifNull: ["$items.price", 0] },
                        ],
                    },
                    { $divide: [{ $ifNull: ["$items.commissionRate", 0] }, 100] },
                ],
            },
        ],
    },
    _lineShipping: { $ifNull: ["$items.shippingCost", 0] },
    _orderId: "$_id",
    _orderShippingPool: { $ifNull: ["$costSummary.totalShipping", 0] },
};

const itemNetProfitAddFields = {
    _lineNetProfit: {
        $subtract: [
            "$_lineRevenue",
            {
                $add: ["$_lineProductCost", "$_lineCommission", "$_lineShipping"],
            },
        ],
    },
};

/**
 * Sipariş seviyesi kargo — kalem kargosu 0 ise ciroya göre dağıt (JS, ikinci geçiş)
 * @param {Array} rows — barcode gruplu satırlar (mutate)
 * @param {Array} orderLines — { orderId, lineRevenue, barcode, orderShippingPool }
 */
function allocateOrderShippingToRows(rows, orderLines) {
    const byOrder = new Map();
    for (const line of orderLines) {
        if (!line.orderId || !(line.orderShippingPool > 0)) continue;
        if (!byOrder.has(line.orderId)) {
            byOrder.set(line.orderId, { pool: line.orderShippingPool, lines: [], itemShippingSum: 0 });
        }
        const bucket = byOrder.get(line.orderId);
        bucket.lines.push(line);
        bucket.itemShippingSum += line.lineShipping || 0;
    }

    const shippingByBarcode = new Map();

    for (const { pool, lines, itemShippingSum } of byOrder.values()) {
        if (itemShippingSum > 0.01) continue;
        const orderRev = lines.reduce((s, l) => s + (l.lineRevenue || 0), 0);
        if (orderRev <= 0) continue;
        for (const line of lines) {
            const share = pool * ((line.lineRevenue || 0) / orderRev);
            const bc = line.barcode || "unknown";
            shippingByBarcode.set(bc, (shippingByBarcode.get(bc) || 0) + share);
        }
    }

    for (const row of rows) {
        const extra = shippingByBarcode.get(row.barcode) || 0;
        if (extra <= 0) continue;
        row.totalShipping = (row.totalShipping || 0) + extra;
        row.netProfit = (row.netProfit || 0) - extra;
        row._shippingAllocated = extra;
    }

    return rows;
}

function mapProductRow(p, productMap) {
    const info = productMap.get(p._id) || {};
    const totalSold = p.totalSold || 0;
    const totalRevenue = p.totalRevenue || 0;
    const totalProductCost = p.totalProductCost || 0;
    const totalCommission = p.totalCommission || 0;
    const totalShipping = p.totalShipping || 0;
    let netProfit = p.netProfit || 0;

    const avgSalePrice =
        totalSold > 0 ? totalRevenue / totalSold : p.avgPrice || info.salePrice || 0;
    const unitCost = totalSold > 0 ? totalProductCost / totalSold : info.costPrice || 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
        barcode: p._id,
        name: p.name || info.name || "Bilinmeyen",
        category: p.category || info.category || "Bilinmiyor",
        totalSold,
        totalRevenue: round2(totalRevenue),
        avgSalePrice: round2(avgSalePrice),
        unitCost: round2(unitCost),
        totalProductCost: round2(totalProductCost),
        totalCommission: round2(totalCommission),
        totalShipping: round2(totalShipping),
        netProfit: round2(netProfit),
        grossProfit: round2(totalRevenue - totalProductCost),
        profitMargin: round1(profitMargin),
        commissionRate:
            totalRevenue > 0
                ? round1((totalCommission / totalRevenue) * 100)
                : info.commissionRate || 0,
        currentStock: info.stock ?? 0,
        costPrice: info.costPrice || unitCost,
        orderCount: p.orderCount || 0,
        marketplaces: p.marketplaces || [],
        returnCount: p.returnCount || 0,
        returnRate: p.returnRate || 0,
        daysOfStock: info.salesMetrics?.daysOfStock || 0,
        avgDailySales: info.salesMetrics?.avgDailySales || 0,
    };
}

function round2(n) {
    return parseFloat((Number(n) || 0).toFixed(2));
}

function round1(n) {
    return parseFloat((Number(n) || 0).toFixed(1));
}

/** $unwind sonrası ürün grubu */
function productGroupStage() {
    return {
        $group: {
            _id: "$items.barcode",
            name: { $first: "$items.productName" },
            category: { $first: "$items.category" },
            totalSold: { $sum: "$_lineQty" },
            totalRevenue: { $sum: "$_lineRevenue" },
            totalProductCost: { $sum: "$_lineProductCost" },
            totalCommission: { $sum: "$_lineCommission" },
            totalShipping: { $sum: "$_lineShipping" },
            netProfit: { $sum: "$_lineNetProfit" },
            orderCount: { $addToSet: "$_orderId" },
            avgPrice: { $avg: "$_linePrice" },
            marketplaces: { $addToSet: "$marketplaceName" },
        },
    };
}

function postProcessGroupedProducts(rawRows, productMap, returnMap) {
    const rows = rawRows.map((p) => {
        const orderCount = Array.isArray(p.orderCount) ? p.orderCount.length : p.orderCount || 0;
        const returnCount = returnMap.get(p._id) || 0;
        const totalSold = p.totalSold || 0;
        return mapProductRow(
            {
                ...p,
                orderCount,
                returnCount,
                returnRate: totalSold > 0 ? round1((returnCount / totalSold) * 100) : 0,
            },
            productMap
        );
    });
    return rows;
}

module.exports = {
    buildOrderMatch,
    itemEconomicsAddFields,
    itemNetProfitAddFields,
    productGroupStage,
    allocateOrderShippingToRows,
    mapProductRow,
    postProcessGroupedProducts,
    round2,
    round1,
};
