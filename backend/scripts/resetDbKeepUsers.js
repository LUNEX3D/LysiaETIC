/**
 * MongoDB sıfırlama — kullanıcı / hesap verileri kalır, geri kalan silinir.
 *
 * Kullanım:
 *   node scripts/resetDbKeepUsers.js --dry-run     # Sadece rapor
 *   node scripts/resetDbKeepUsers.js --confirm     # Sil (geri alınamaz)
 *   node scripts/resetDbKeepUsers.js --confirm --strict   # Yalnızca `users` koleksiyonu kalır
 *
 * Önce backend'i durdurun (node server.js). Atlas kotası doluysa önce upgrade veya Atlas'tan yer açın.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env.local"),
    override: true,
});

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const mongoose = require("mongoose");

/** Giriş + profil + abonelik (User içinde gömülü) */
const KEEP_STRICT = new Set(["users"]);

/**
 * Hesap + pazaryeri API + mağaza ayarları (önerilen varsayılan)
 */
const KEEP_ACCOUNT = new Set([
    ...KEEP_STRICT,
    "usermarketplaces",
    "marketplaceintegrations",
    "autoinvoiceconfigs",
    "autoorderconfigs",
    "autonomyconfigs",
    "userappinstallations",
    "stores",
    "storesellerverifications",
    "storepaymentsettings",
    // ⚠️ Kategori Merkezi — küratörlü/elle yapılmış eşleştirmeler. Yeniden
    // oluşturulması çok emek ister, asla otomatik silinmemeli.
    "mastercategorymappings",
]);

function fmt(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const confirm = args.includes("--confirm");
    const strict = args.includes("--strict");

    if (!dryRun && !confirm) {
        console.log(`
MongoDB sıfırlama — kullanıcı verileri korunur

  node scripts/resetDbKeepUsers.js --dry-run
  node scripts/resetDbKeepUsers.js --confirm
  node scripts/resetDbKeepUsers.js --confirm --strict   (sadece users kalır)

Önce: backend'i durdurun (Ctrl+C).
Atlas kotası doluysa silme işlemi de başarısız olur — önce depolama artırın veya Atlas'tan veri silin.
`);
        process.exit(0);
    }

    const keep = strict ? KEEP_STRICT : KEEP_ACCOUNT;
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI tanımlı değil");
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    const dbName = mongoose.connection.name;

    console.log(`\nVeritabanı: ${dbName}`);
    console.log(`Mod: ${strict ? "strict (yalnızca users)" : "account (hesap + mağaza/pazaryeri ayarları)"}`);
    console.log(`İşlem: ${dryRun ? "DRY-RUN (silinmez)" : "SİLME"}\n`);

    const collections = (await db.listCollections().toArray())
        .map((c) => c.name)
        .filter((n) => !n.startsWith("system."));

    let totalDeleted = 0;
    const errors = [];

    for (const name of collections.sort()) {
        if (keep.has(name)) {
            const count = await db.collection(name).countDocuments();
            console.log(`  KEEP  ${name.padEnd(32)} ${count} kayıt`);
            continue;
        }

        let count = 0;
        let storage = 0;
        try {
            const stats = await db.command({ collStats: name });
            count = stats.count ?? 0;
            storage = stats.storageSize ?? 0;
        } catch {
            count = await db.collection(name).countDocuments();
        }

        if (dryRun) {
            console.log(`  DROP? ${name.padEnd(32)} ${count} kayıt  (~${fmt(storage)})`);
            totalDeleted += count;
            continue;
        }

        try {
            const res = await db.collection(name).deleteMany({});
            console.log(`  DEL   ${name.padEnd(32)} ${res.deletedCount} silindi`);
            totalDeleted += res.deletedCount;
        } catch (e) {
            console.error(`  ERR   ${name}: ${e.message}`);
            errors.push({ name, error: e.message });
        }
    }

    console.log("\n---");
    if (dryRun) {
        console.log(`Silinecek yaklaşık kayıt: ${totalDeleted}`);
        console.log("Onaylamak için: node scripts/resetDbKeepUsers.js --confirm\n");
    } else if (errors.length) {
        console.log(`Silinen kayıt: ${totalDeleted}`);
        console.log(`${errors.length} koleksiyonda hata (muhtemelen Atlas kotası).`);
        console.log("Atlas depolamayı artırın veya Browse Collections üzerinden manuel silin.\n");
        process.exit(1);
    } else {
        console.log(`Tamamlandı. Silinen kayıt: ${totalDeleted}`);
        console.log("Korunan:", [...keep].join(", "));
        console.log("\nBackend'i yeniden başlatın. DISABLE_BACKGROUND_JOBS=true kaldırabilirsiniz.\n");
    }

    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error("HATA:", e.message);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
