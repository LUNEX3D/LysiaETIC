/**
 * Mevcut sipariş kalemlerine Ürün Merkezi maliyet/komisyon/kargo yazar
 */
const Order = require("../models/Order");
const logger = require("../config/logger");
const {
    buildProductEconomicsIndex,
    resolveLineEconomics,
    economicsToOrderItemFields,
} = require("../utils/productEconomicsLookup");

/**
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {{ start?: Date, end?: Date, limit?: number }} options
 */
async function backfillOrderEconomics(userId, options = {}) {
    const { start, end, limit = 2000 } = options;
    const query = { user: userId, isCancelled: { $ne: true } };
    if (start || end) {
        query.orderDate = {};
        if (start) query.orderDate.$gte = start;
        if (end) query.orderDate.$lte = end;
    }

    const productMap = await buildProductEconomicsIndex(userId);
    const orders = await Order.find(query)
        .select("items marketplaceName costSummary")
        .sort({ orderDate: -1 })
        .limit(Math.min(Number(limit) || 2000, 5000))
        .lean();

    let updatedOrders = 0;
    let updatedLines = 0;
    const bulkOps = [];

    for (const ord of orders) {
        const mpName = ord.marketplaceName || "";
        let changed = false;
        const newItems = (ord.items || []).map((item) => {
            const needs =
                (Number(item.costPrice) || 0) < 0.01 ||
                (Number(item.commissionAmount) || 0) < 0.01 ||
                (Number(item.shippingCost) || 0) < 0.01;
            if (!needs) return item;

            const econ = resolveLineEconomics(item, mpName, productMap, {
                allowDefaultCommission: false,
            });
            const hasNew =
                (econ.costPrice > 0 && (Number(item.costPrice) || 0) < 0.01) ||
                (econ.commissionAmount > 0 && (Number(item.commissionAmount) || 0) < 0.01) ||
                (econ.shippingCost > 0 && (Number(item.shippingCost) || 0) < 0.01);

            if (!hasNew) return item;

            changed = true;
            updatedLines += 1;
            return { ...item, ...economicsToOrderItemFields(econ, item) };
        });

        if (!changed) continue;

        const totalPrice = newItems.reduce((s, it) => s + (Number(it.price) || 0) * (it.quantity || 1), 0);
        const totalCost = newItems.reduce(
            (s, it) => s + (Number(it.costPrice) || 0) * (it.quantity || 1),
            0
        );
        const totalCommission = newItems.reduce((s, it) => s + (Number(it.commissionAmount) || 0), 0);
        const totalShipping = newItems.reduce((s, it) => s + (Number(it.shippingCost) || 0), 0);
        const netProfit = newItems.reduce((s, it) => s + (Number(it.netProfit) || 0), 0);

        bulkOps.push({
            updateOne: {
                filter: { _id: ord._id },
                update: {
                    $set: {
                        items: newItems,
                        "costSummary.totalPrice": totalPrice,
                        "costSummary.totalCost": totalCost,
                        "costSummary.totalCommission": totalCommission,
                        "costSummary.totalShipping": totalShipping,
                        "costSummary.netProfit": netProfit,
                    },
                },
            },
        });
        updatedOrders += 1;
    }

    if (bulkOps.length > 0) {
        await Order.bulkWrite(bulkOps, { ordered: false });
    }

    logger.info(
        `[OrderEconomicsBackfill] user=${userId} orders=${updatedOrders} lines=${updatedLines}`
    );
    return { updatedOrders, updatedLines, scanned: orders.length };
}

module.exports = { backfillOrderEconomics };
