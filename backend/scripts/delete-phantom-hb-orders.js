/**
 * Sahte HB paket numaralarını sil: node scripts/delete-phantom-hb-orders.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { invalidateDashboardCache } = require("../services/dashboardService");

/** HB paket no — trackingNumber olarak kaydedilmiş sahte kayıtlar */
const PHANTOM_PACKAGE_NUMBERS = ["5477505756", "5477503376"];
/** HB iç UUID — gerçek sipariş no değil; aynı siparişin hayalet kopyası */
const PHANTOM_UUID_TRACKING = [
    "6a0b1274-252d-068e-f3fb-fbc406060606",
    "6a0b1390-9b68-894d-c2cb-06ef06060606",
];

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    const filter = {
        $or: [
            { trackingNumber: { $in: PHANTOM_PACKAGE_NUMBERS } },
            { trackingNumber: { $in: PHANTOM_UUID_TRACKING } },
        ],
    };

    const found = await Order.find(filter)
        .select("_id user trackingNumber marketplaceName status")
        .lean();
    console.log("Bulunan:", found.length, found);

    const userIds = [...new Set(found.map((o) => String(o.user)))];
    const result = await Order.deleteMany(filter);
    console.log("Silinen:", result.deletedCount);

    userIds.forEach((id) => invalidateDashboardCache(id));
    const remaining = await Order.countDocuments(filter);
    console.log("Kalan:", remaining);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
