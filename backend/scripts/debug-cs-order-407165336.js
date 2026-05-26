require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Marketplace = require("../models/Marketplace");
const { classifyOrderStatus } = require("../utils/orderStatus");
const { decryptCredentials } = require("../utils/encryption");
const ciceksepetiService = require("../services/ciceksepeti/ciceksepetiService");
const { fetchCiceksepetiReturnOrders } = require("../utils/ciceksepetiOrders");

const OUT = require("path").join(__dirname, "debug-cs-407165336.json");
const ORDER_NO = "407165336";

async function main() {
    const report = { orderNo: ORDER_NO };
    await mongoose.connect(process.env.MONGO_URI);

    const dbRows = await Order.find({
        $or: [
            { trackingNumber: ORDER_NO },
            { trackingNumber: { $regex: ORDER_NO } },
        ],
    }).lean();
    report.db = dbRows.map((r) => ({
        _id: r._id,
        user: String(r.user),
        trackingNumber: r.trackingNumber,
        marketplaceName: r.marketplaceName,
        status: r.status,
        statusBucket: r.statusBucket,
        isReturned: r.isReturned,
        orderDate: r.orderDate,
        classify: classifyOrderStatus(r.status, r.marketplaceName),
    }));

    const userId = dbRows[0]?.user;
    if (userId) {
        const mp = await Marketplace.findOne({
            userId,
            marketplaceName: /cicek|çiçek/i,
        }).lean();
        if (mp) {
            const creds = decryptCredentials(mp.credentials);
            report.marketplace = mp.marketplaceName;
            const end = new Date();
            const start = new Date(end.getTime() - 45 * 24 * 60 * 60 * 1000);

            try {
                const getOrders = await ciceksepetiService.getOrders(creds, {
                    startDate: start.toISOString(),
                    endDate: end.toISOString(),
                    pageSize: 100,
                    page: 0,
                    orderNo: ORDER_NO,
                });
                report.getOrdersByOrderNo = {
                    success: getOrders.success,
                    count: getOrders.orders?.length,
                    items: (getOrders.orders || []).map((o) => ({
                        orderId: o.orderId,
                        orderItemId: o.orderItemId,
                        orderProductStatus: o.orderProductStatus,
                    })),
                };
            } catch (e) {
                report.getOrdersError = e.message;
            }

            try {
                const returns = await fetchCiceksepetiReturnOrders(
                    ciceksepetiService,
                    creds,
                    start,
                    end,
                    null
                );
                report.returnApiMatches = returns.filter(
                    (r) =>
                        String(r.orderNumber).includes(ORDER_NO) ||
                        String(r.orderItemId || "").includes(ORDER_NO)
                );
                report.returnApiTotal = returns.length;
            } catch (e) {
                report.returnApiError = e.message;
            }
        }
    }

    await mongoose.disconnect();
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
}

main().catch((e) => {
    fs.writeFileSync(OUT, JSON.stringify({ error: String(e.stack || e) }), "utf8");
    process.exit(1);
});
