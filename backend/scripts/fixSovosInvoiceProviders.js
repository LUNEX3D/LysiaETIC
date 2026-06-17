/**
 * Sovos faturalarında yanlış provider: "qnb" kayıtlarını düzeltir.
 * Kullanım: node backend/scripts/fixSovosInvoiceProviders.js [--dry-run]
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Invoice = require("../models/Invoice");

const dryRun = process.argv.includes("--dry-run");

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGODB_URI tanımlı değil");
        process.exit(1);
    }
    await mongoose.connect(uri);

    const sovosUsers = await AutoInvoiceConfig.find({
        provider: "sovos",
        "sovosCredentials.username": { $exists: true, $ne: "" },
    }).select("userId").lean();

    let totalUpdated = 0;
    for (const cfg of sovosUsers) {
        const filter = {
            userId: cfg.userId,
            provider: { $ne: "sovos" },
        };
        const count = await Invoice.countDocuments(filter);
        if (!count) continue;

        if (dryRun) {
            console.log("[dry-run] userId=" + cfg.userId + " → " + count + " fatura provider=sovos yapılacak");
        } else {
            const res = await Invoice.updateMany(filter, { $set: { provider: "sovos" } });
            totalUpdated += res.modifiedCount || 0;
            console.log("userId=" + cfg.userId + " → " + (res.modifiedCount || 0) + " fatura güncellendi");
        }
    }

    console.log(dryRun ? "Dry-run tamamlandı." : "Toplam güncellenen: " + totalUpdated);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
