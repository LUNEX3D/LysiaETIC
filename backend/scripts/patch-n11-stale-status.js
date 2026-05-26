/**
 * N11 siparişlerinde yanlış "Created" + statusBucket düzeltmesi
 * node scripts/patch-n11-stale-status.js [orderNumber]
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { classifyOrderStatus } = require("../utils/orderStatus");
const { invalidateDashboardCache } = require("../services/dashboardService");

const OUT = require("path").join(__dirname, "patch-n11-result.json");
const onlyOrder = process.argv[2];

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    const filter = onlyOrder
        ? { trackingNumber: onlyOrder }
        : {
              marketplaceName: /n11/i,
              status: /^created$/i,
          };

    const rows = await Order.find(filter).lean();
    const updates = [];

    for (const row of rows) {
        const newStatus = onlyOrder ? "Delivered" : "Delivered";
        const bucket = classifyOrderStatus(newStatus, row.marketplaceName);
        await Order.updateOne(
            { _id: row._id },
            { $set: { status: newStatus, statusBucket: bucket } }
        );
        updates.push({
            trackingNumber: row.trackingNumber,
            oldStatus: row.status,
            newStatus,
            statusBucket: bucket,
        });
        if (row.user) invalidateDashboardCache(String(row.user));
    }

    fs.writeFileSync(OUT, JSON.stringify({ count: updates.length, updates }, null, 2), "utf8");
    await mongoose.disconnect();
}

main().catch((e) => {
    fs.writeFileSync(OUT, JSON.stringify({ error: String(e.stack || e) }), "utf8");
    process.exit(1);
});
