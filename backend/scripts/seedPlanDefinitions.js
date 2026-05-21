/**
 * Varsayılan paket tanımlarını SystemConfig'e yazar.
 * Kullanım: node backend/scripts/seedPlanDefinitions.js
 * Zorla güncelle: node backend/scripts/seedPlanDefinitions.js --force
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const SystemConfig = require("../models/SystemConfig");
const { DEFAULT_PLAN_DEFINITIONS } = require("../config/defaultPlanDefinitions");

const force = process.argv.includes("--force");

async function main() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGO_URI veya MONGODB_URI tanımlı değil");
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("MongoDB bağlandı");

    const existing = await SystemConfig.findOne({ key: "planDefinitions" }).lean();
    if (existing?.value && !force) {
        console.log("planDefinitions zaten var. Güncellemek için: --force");
        await mongoose.disconnect();
        return;
    }

    await SystemConfig.findOneAndUpdate(
        { key: "planDefinitions" },
        { value: DEFAULT_PLAN_DEFINITIONS, updatedAt: new Date() },
        { upsert: true, new: true }
    );

    console.log(force ? "Paket tanımları zorla güncellendi." : "Paket tanımları oluşturuldu.");
    console.log("Paketler:", Object.keys(DEFAULT_PLAN_DEFINITIONS).join(", "));
    Object.entries(DEFAULT_PLAN_DEFINITIONS).forEach(([k, p]) => {
        if (k === "trial") return;
        console.log(`  ${k}: ${p.name} — ₺${p.monthlyPrice}/ay, ₺${p.yearlyPrice}/yıl, ${(p.features || []).length} özellik`);
    });

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
