/**
 * Hatalı kategori eşleştirmelerini otomatik onarır (N11, ÇiçekSepeti, HB cache, Amazon cache).
 *
 *   node backend/scripts/repairCategoryMappings.js           # önizleme
 *   node backend/scripts/repairCategoryMappings.js --execute # DB'ye yazar
 *   node backend/scripts/repairCategoryMappings.js --execute --platforms n11,ciceksepeti
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local"), override: true });

const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}

const mongoose = require("mongoose");
const { repairInvalidCategoryMappings } = require("../services/categoryMappingRepairService");

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const platIdx = args.indexOf("--platforms");
const platforms = platIdx !== -1 && args[platIdx + 1]
    ? args[platIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGO_URI bulunamadı");
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log(`Mod: ${execute ? "CANLI (yazılacak)" : "ÖNİZLEME"}`);
    if (platforms?.length) console.log(`Platformlar: ${platforms.join(", ")}`);

    const result = await repairInvalidCategoryMappings({
        dryRun: !execute,
        platforms,
        includeManual: true,
    });

    console.log("\n══════════ KATEGORİ ONARIM ══════════");
    console.log(`Taranan satır: ${result.scannedRows}`);
    console.log(`Onarılacak: ${result.repairCount}${execute ? `, yazılan: ${result.updated}` : ""}`);
    console.log(`Onarılamayan: ${result.unrepairedCount}, atlanan: ${result.skippedCount}`);

    if (result.samples.length) {
        console.log("\nÖrnek onarımlar:");
        for (const r of result.samples) {
            console.log(`  [${r.platform}] ${r.masterName || r.masterPath}`);
            console.log(`    ESKİ: ${r.oldPath}`);
            console.log(`    YENİ: ${r.newPath} (skor ${r.newScore})`);
        }
    }

    if (result.unrepaired.length) {
        console.log("\nOnarılamayan (ilk kayıtlar):");
        for (const u of result.unrepaired.slice(0, 15)) {
            console.log(`  [${u.platform}] ${u.masterPath}`);
            console.log(`    ${u.currentPath} — ${u.reason}`);
        }
    }

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(async (err) => {
    console.error("Hata:", err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
