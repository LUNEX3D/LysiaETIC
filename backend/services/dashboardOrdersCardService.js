/**
 * Siparişler kartı — DB, basit statü sınıflandırması (canlı 45g HB çekimi yok)
 */

const Order = require("../models/Order");
const { classifyOrderStatus } = require("../utils/orderStatus");
const { dedupeOrderRows } = require("../utils/orderDedupe");

const PIPELINE_DAYS = parseInt(process.env.DASHBOARD_PIPELINE_DAYS || "45", 10);
const ACTIVE_CARD_DAYS = parseInt(
    process.env.DASHBOARD_ACTIVE_ORDER_DAYS ||
        process.env.DASHBOARD_SYNC_WINDOW_DAYS ||
        "7",
    10
);
const VALID_BUCKETS = new Set(["new", "processing", "shipping", "delivered", "cancelled", "returned"]);

const resolveBucket = (row) => {
    const stored = String(row.statusBucket || "").trim();
    if (VALID_BUCKETS.has(stored)) return stored;
    return classifyOrderStatus(row.status, row.marketplaceName);
};

const normalizeMpKey = (name = "") => String(name || "").toLowerCase().trim();

const displayMp = (name = "") => {
    const k = normalizeMpKey(name);
    if (k === "trendyol") return "Trendyol";
    if (k === "hepsiburada") return "Hepsiburada";
    if (k === "n11") return "N11";
    if (k === "çiçeksepeti" || k === "ciceksepeti") return "ÇiçekSepeti";
    return String(name || "").trim() || "—";
};

const dedupeOrders = (rows) => dedupeOrderRows(rows);

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
            const bucket = resolveBucket(row);
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

    const activeCutoffMs = Date.now() - ACTIVE_CARD_DAYS * 24 * 60 * 60 * 1000;
    const activeStatusCounts = { new: 0, processing: 0 };
    let activeOrderCount = 0;
    orders.forEach((o) => {
        if (o.statusBucket !== "new" && o.statusBucket !== "processing") return;
        const t = o.orderDate ? new Date(o.orderDate).getTime() : NaN;
        if (Number.isNaN(t) || t < activeCutoffMs) return;
        activeOrderCount++;
        if (activeStatusCounts[o.statusBucket] !== undefined) activeStatusCounts[o.statusBucket]++;
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
        activeOrderCount,
        activeStatusCounts,
        activeCardDays: ACTIVE_CARD_DAYS,
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
        .select("trackingNumber orderItemId packageNumber marketplaceName totalPrice status statusBucket orderDate")
        .lean();

    const rows = dbOrders.map((o) => ({
        orderNumber: o.trackingNumber || o.orderItemId,
        orderItemId: o.orderItemId,
        trackingNumber: o.trackingNumber,
        packageNumber: o.packageNumber,
        orderDate: o.orderDate,
        totalPrice: o.totalPrice,
        status: o.status,
        statusBucket: o.statusBucket,
        marketplaceName: o.marketplaceName,
    }));

    return buildPayload(dedupeOrders(rows));
};
