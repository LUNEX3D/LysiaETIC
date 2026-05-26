/**
 * node scripts/debug-dashboard-orders.js <userId>
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const fs = require("fs");
const { getDashboardData, invalidateDashboardCache } = require("../services/dashboardService");

async function main() {
    const userId = process.argv[2];
    if (!userId) {
        console.error("Usage: node scripts/debug-dashboard-orders.js <userId>");
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    invalidateDashboardCache(userId);
    const dash = await getDashboardData(userId);
    const out = {
        ordersModalTotal: dash.ordersModal?.total,
        ordersModalNew: dash.ordersModal?.statusCounts?.new,
        ordersModalProcessing: dash.ordersModal?.statusCounts?.processing,
        pipelineTotal: dash.pipelineOrders?.total,
        orders24h: dash.orders24h,
    };
    fs.writeFileSync(require("path").join(__dirname, "dash-debug-out.json"), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out));
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
