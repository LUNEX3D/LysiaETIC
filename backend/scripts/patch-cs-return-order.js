/**
 * ÇiçekSepeti iade siparişini DB'de düzelt: node scripts/patch-cs-return-order.js 407165336
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { classifyOrderStatus } = require("../utils/orderStatus");
const { invalidateDashboardCache } = require("../services/dashboardService");

const ORDER_NO = process.argv[2] || "407165336";
const RETURN_STATUS = "İade Tedarikçide";

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const row = await Order.findOne({
        trackingNumber: ORDER_NO,
        marketplaceName: /cicek|çiçek/i,
    });
    if (!row) {
        console.log("Bulunamadı:", ORDER_NO);
        await mongoose.disconnect();
        return;
    }
    row.status = RETURN_STATUS;
    row.statusBucket = classifyOrderStatus(RETURN_STATUS, row.marketplaceName);
    row.isReturned = true;
    await row.save();
    invalidateDashboardCache(String(row.user));
    console.log("Güncellendi:", ORDER_NO, row.status, row.statusBucket);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
