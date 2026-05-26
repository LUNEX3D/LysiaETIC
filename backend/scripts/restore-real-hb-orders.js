/**
 * Yanlışlıkla silinen gerçek HB siparişlerini geri yükle (4381688459, 4303450218)
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const mongoose = require("mongoose");
const Order = require("../models/Order");

const REAL_TRACKING = ["4381688459", "4303450218"];
const PHANTOM_UUID_TRACKING = [
    "6a0b1274-252d-068e-f3fb-fbc406060606",
    "6a0b1390-9b68-894d-c2cb-06ef06060606",
];
const SCAN_FILE = require("path").join(__dirname, "phantom-scan-global.json");
const OUT = require("path").join(__dirname, "restore-hb-result.json");

async function main() {
    const lines = [];
    const log = (...a) => lines.push(a.map(String).join(" "));

    await mongoose.connect(process.env.MONGO_URI);

    const scan = JSON.parse(fs.readFileSync(SCAN_FILE, "utf8"));
    const toRestore = (scan.hits || []).filter((h) =>
        REAL_TRACKING.includes(String(h.trackingNumber))
    );

    let restored = 0;
    for (const doc of toRestore) {
        const { _id, __v, createdAt, updatedAt, ...rest } = doc;
        const exists = await Order.findOne({
            user: doc.user,
            trackingNumber: doc.trackingNumber,
            marketplaceName: doc.marketplaceName,
        });
        if (exists) {
            log("skip_exists", doc.trackingNumber);
            continue;
        }
        await Order.create({ ...rest, _id: new mongoose.Types.ObjectId(_id) });
        restored++;
        log("restored", doc.trackingNumber, _id);
    }

    const phantomLeft = await Order.find({
        trackingNumber: { $in: PHANTOM_UUID_TRACKING },
    }).lean();
    log("phantom_uuid_remaining", phantomLeft.length);

    try {
        const { invalidateDashboardCache } = require("../services/dashboardService");
        invalidateDashboardCache("69cd229a7fa3ee7b5cf758fa");
        log("cache_invalidated");
    } catch (e) {
        log("cache_error", e.message);
    }

    await mongoose.disconnect();
    fs.writeFileSync(OUT, lines.join("\n"), "utf8");
}

main().catch((e) => {
    fs.writeFileSync(OUT, String(e.stack || e), "utf8");
    process.exit(1);
});
