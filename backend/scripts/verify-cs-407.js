require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { classifyOrderStatus } = require("../utils/orderStatus");

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const row = await Order.findOne({ trackingNumber: "407165336" }).lean();
    const out = {
        status: row?.status,
        statusBucket: row?.statusBucket,
        isReturned: row?.isReturned,
        classify: classifyOrderStatus(row?.status, row?.marketplaceName),
    };
    if (row && out.classify !== row.statusBucket) {
        await Order.updateOne(
            { _id: row._id },
            { $set: { statusBucket: out.classify, isReturned: out.classify === "returned" } }
        );
        out.patched = true;
    }
    if (row?.user) {
        const { invalidateDashboardCache } = require("../services/dashboardService");
        invalidateDashboardCache(String(row.user));
        out.cacheInvalidated = true;
    }
    fs.writeFileSync(require("path").join(__dirname, "verify-cs-407.json"), JSON.stringify(out, null, 2));
    await mongoose.disconnect();
}

main();
