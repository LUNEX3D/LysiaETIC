/**
 * CS siparişlerinde statusBucket / isReturned düzelt (Türkçe İ fix sonrası)
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { classifyOrderStatus } = require("../utils/orderStatus");
const { invalidateDashboardCache } = require("../services/dashboardService");

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const rows = await Order.find({ marketplaceName: /cicek|çiçek/i }).lean();
    const userIds = new Set();
    let fixed = 0;

    for (const row of rows) {
        const bucket = classifyOrderStatus(row.status, row.marketplaceName);
        const shouldReturn = bucket === "returned";
        const needs =
            row.statusBucket !== bucket ||
            (shouldReturn && !row.isReturned) ||
            (!shouldReturn && row.isReturned && bucket !== "returned");
        if (!needs) continue;

        await Order.updateOne(
            { _id: row._id },
            {
                $set: {
                    statusBucket: bucket,
                    isReturned: shouldReturn || row.isReturned,
                },
            }
        );
        userIds.add(String(row.user));
        fixed++;
    }

    userIds.forEach((id) => invalidateDashboardCache(id));
    console.log(JSON.stringify({ scanned: rows.length, fixed, userIds: [...userIds] }));
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
