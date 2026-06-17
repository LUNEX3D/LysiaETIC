/**
 * MongoDB yer açma — güvenli, tekrar oluşturulabilir verileri siler.
 *
 * Atlas M0 kotası dolduğunda yazmalar bloklanır. Bu script log/cache gibi
 * verileri silerek kotayı altına indirmeye yardımcı olur.
 *
 * Kullanım:
 *   node scripts/dbStorageCleanup.js              # Ne silineceğini göster (dry-run)
 *   node scripts/dbStorageCleanup.js --execute  # Sil
 *
 * Önce backend'i durdurun. Sonra: node scripts/dbStorageAudit.js ile kontrol edin.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env.local"),
    override: true,
});

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const mongoose = require("mongoose");

const DAYS = (n) => n * 24 * 60 * 60 * 1000;

/** @type {{ label: string, collection: string, filter: object }[]} */
const CLEANUP_TARGETS = [
    {
        label: "Stok senkron logları (30+ gün)",
        collection: "stocksynclogs",
        filter: { createdAt: { $lt: new Date(Date.now() - DAYS(30)) } },
    },
    {
        label: "Stok senkron logları (7+ gün, hata/başarılı tümü)",
        collection: "stocksynclogs",
        filter: { createdAt: { $lt: new Date(Date.now() - DAYS(7)) } },
        optional: true,
    },
    {
        label: "İstemci hata logları (14+ gün)",
        collection: "clienterrorlogs",
        filter: { createdAt: { $lt: new Date(Date.now() - DAYS(14)) } },
    },
    {
        label: "Bildirimler (30+ gün)",
        collection: "notifications",
        filter: { createdAt: { $lt: new Date(Date.now() - DAYS(30)) } },
    },
    {
        label: "Süresi dolmuş kategori önbelleği",
        collection: "categorycaches",
        filter: { expiresAt: { $lt: new Date() } },
    },
    {
        label: "Tüm kategori önbelleği (yeniden çekilir)",
        collection: "categorycaches",
        filter: {},
        optional: true,
    },
    {
        label: "AI analiz önbelleği (tümü)",
        collection: "aianalysiscaches",
        filter: {},
        optional: true,
    },
    {
        label: "Roketfy analizleri (30+ gün)",
        collection: "roketfyanalyses",
        filter: { createdAt: { $lt: new Date(Date.now() - DAYS(30)) } },
        optional: true,
    },
    {
        label: "Erişim olayları (60+ gün)",
        collection: "accessincidents",
        filter: { createdAt: { $lt: new Date(Date.now() - DAYS(60)) } },
        optional: true,
    },
];

async function collStats(db, name) {
    try {
        const s = await db.command({ collStats: name });
        return { exists: true, count: s.count || 0, storage: s.storageSize || 0 };
    } catch {
        return { exists: false, count: 0, storage: 0 };
    }
}

function fmt(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
    const execute = process.argv.includes("--execute");
    const aggressive = process.argv.includes("--aggressive");

    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI tanımlı değil (.env)");
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 });
    const db = mongoose.connection.db;

    const targets = CLEANUP_TARGETS.filter((t) => !t.optional || aggressive);

    console.log(`\n=== MongoDB temizlik ${execute ? "(SİLİNİYOR)" : "(dry-run)"} ===\n`);
    if (!execute) {
        console.log("Gerçek silme için: node scripts/dbStorageCleanup.js --execute");
        console.log("Daha fazla silmek için: ... --execute --aggressive\n");
    }

    let totalDeleted = 0;

    for (const t of targets) {
        const before = await collStats(db, t.collection);
        if (!before.exists) {
            console.log(`⏭  ${t.label} — koleksiyon yok (${t.collection})`);
            continue;
        }

        const matchCount = await db.collection(t.collection).countDocuments(t.filter);
        if (matchCount === 0) {
            console.log(`✓  ${t.label} — silinecek kayıt yok (${fmt(before.storage)} disk)`);
            continue;
        }

        if (execute) {
            const res = await db.collection(t.collection).deleteMany(t.filter);
            const after = await collStats(db, t.collection);
            totalDeleted += res.deletedCount || 0;
            console.log(
                `🗑  ${t.label}: ${res.deletedCount} kayıt silindi | disk ${fmt(before.storage)} → ${fmt(after.storage)}`
            );
        } else {
            console.log(`📋 ${t.label}: ${matchCount} kayıt silinecek (${t.collection}, ~${fmt(before.storage)} disk)`);
        }
    }

    if (execute) {
        console.log(`\nToplam silinen kayıt: ${totalDeleted}`);
        console.log("\nAtlas'ta birkaç dakika bekleyin, ardından:");
        console.log("  node scripts/dbStorageAudit.js");
        console.log("\n512 MB altına inince yazmalar tekrar açılır.\n");
    } else {
        console.log("\nAtlas hâlâ doluysa: cloud.mongodb.com → Cluster → Upgrade");
        console.log("veya resetDbKeepUsers.js --dry-run (kullanıcı dışı tüm veri)\n");
    }

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
