/**
 * MongoDB depolama denetimi (salt okunur).
 * Kullanım: node scripts/dbStorageAudit.js
 *
 * Atlas kotası dolduğunda hangi koleksiyonların yer kapladığını görmek için çalıştırın.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env.local"),
    override: true,
});

const mongoose = require("mongoose");

function fmt(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI tanımlı değil (.env)");
        process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const names = (await db.listCollections().toArray())
        .map((c) => c.name)
        .filter((n) => !n.startsWith("system."));

    const rows = [];
    let totalData = 0;
    let totalStorage = 0;

    for (const name of names) {
        try {
            const stats = await db.command({ collStats: name });
            const data = stats.size || 0;
            const storage = stats.storageSize || 0;
            const count = stats.count ?? 0;
            totalData += data;
            totalStorage += storage;
            rows.push({ name, count, data, storage });
        } catch (e) {
            rows.push({ name, count: "?", data: 0, storage: 0, err: e.message });
        }
    }

    rows.sort((a, b) => b.storage - a.storage);

    console.log("\n=== MongoDB depolama özeti ===\n");
    console.log(
        "Koleksiyon".padEnd(36),
        "Kayıt".padStart(10),
        "Veri".padStart(12),
        "Disk".padStart(12)
    );
    console.log("-".repeat(72));

    for (const r of rows) {
        console.log(
            r.name.padEnd(36),
            String(r.count).padStart(10),
            fmt(r.data).padStart(12),
            fmt(r.storage).padStart(12)
        );
    }

    console.log("-".repeat(72));
    console.log(
        "TOPLAM".padEnd(36),
        "".padStart(10),
        fmt(totalData).padStart(12),
        fmt(totalStorage).padStart(12)
    );
    console.log("\nAtlas M0 limiti genelde 512 MB. Disk sütunu kotaya daha yakındır.\n");
    console.log("Yazma hatası alıyorsanız: Atlas → Cluster → Upgrade veya büyük koleksiyonları silin.\n");
    console.log("Geliştirmede cron gürültüsünü kapatmak için backend/.env:\n  DISABLE_BACKGROUND_JOBS=true\n");

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
