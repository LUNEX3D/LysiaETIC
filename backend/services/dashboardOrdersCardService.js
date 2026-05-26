/**
 * Siparişler kartı — DB, basit statü sınıflandırması (canlı 45g HB çekimi yok)
 */

const Order = require("../models/Order");
const { classifyOrderStatus, pickPreferredOrderRecord } = require("../utils/orderStatus");
const { isHbInternalId } = require("./hepsiburadaService");

const PIPELINE_DAYS = parseInt(process.env.DASHBOARD_PIPELINE_DAYS || "45", 10);

const normalizeMpKey = (name = "") => String(name || "").toLowerCase().trim();

const displayMp = (name = "") => {
    const k = normalizeMpKey(name);
    if (k === "trendyol") return "Trendyol";
    if (k === "hepsiburada") return "Hepsiburada";
    if (k === "n11") return "N11";
    if (k === "çiçeksepeti" || k === "ciceksepeti") return "ÇiçekSepeti";
    return String(name || "").trim() || "—";
};

const dedupeOrders = (rows) => {
    const map = new Map();
    rows.forEach((order) => {
        const mp = normalizeMpKey(order.marketplaceName);
        const orderNo = String(order.orderNumber || "").trim();
        if (!mp || !orderNo || isHbInternalId(orderNo)) return;
        const key = `${mp}::${orderNo}`;
        const candidate = {
            orderNumber: orderNo,
            orderDate: order.orderDate,
            totalPrice: Number(order.totalPrice || 0),
            status: order.status,
            marketplaceName: order.marketplaceName,
        };
        map.set(key, pickPreferredOrderRecord(map.get(key), candidate));
    });
    return Array.from(map.values());
};

const buildPayload = (unique) => {
    const statusCounts = {
        new: 0,
        processing: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0,
        returned: 0,
    };

    const orders = unique
        .map((row) => {
            const bucket = classifyOrderStatus(row.status);
            if (statusCounts[bucket] !== undefined) statusCounts[bucket]++;
            return {
                orderNumber: row.orderNumber,
                marketplace: displayMp(row.marketplaceName),
                status: row.status,
                statusBucket: bucket,
                totalPrice: row.totalPrice,
                orderDate: row.orderDate,
            };
        });

    orders.sort((a, b) => {
        const ta = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        const tb = b.orderDate ? new Date(b.orderDate).getTime() : 0;
        return tb - ta;
    });

    const byStatus = { all: orders };
    ["new", "processing", "shipping", "delivered", "cancelled", "returned"].forEach((k) => {
        byStatus[k] = orders.filter((o) => o.statusBucket === k);
    });

    return {
        total: orders.length,
        statusCounts,
        orders,
        byStatus,
        pipelineDays: PIPELINE_DAYS,
        source: "database",
    };
};

exports.getOrdersCardData = async (userId) => {
    const now = new Date();
    const pipelineStart = new Date(now.getTime() - PIPELINE_DAYS * 24 * 60 * 60 * 1000);

    const dbOrders = await Order.find({
        user: userId,
        orderDate: { $gte: pipelineStart, $lte: now },
    })
        .select("trackingNumber marketplaceName totalPrice status orderDate")
        .lean();

    const rows = dbOrders.map((o) => ({
        orderNumber: o.trackingNumber,
        orderDate: o.orderDate,
        totalPrice: o.totalPrice,
        status: o.status,
        marketplaceName: o.marketplaceName,
    }));

    return buildPayload(dedupeOrders(rows));
};
