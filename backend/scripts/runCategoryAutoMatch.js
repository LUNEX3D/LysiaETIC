/**
 * Kategori Merkezi — Otomatik Eşleştirme Çalıştırıcı (CLI)
 *
 * Master kategoriye göre N11 / ÇiçekSepeti / Hepsiburada / Amazon kategorilerini
 * akıllı (anlam + yazım eşdeğeri) eşleştirme ile DOLDURUR.
 *   - Sadece BOŞ hücreleri doldurur → elle yapılan eşleşmeler korunur.
 *   - Trendyol master taksonomidir, eşleştirilmez.
 *
 * Kullanım:
 *   node backend/scripts/runCategoryAutoMatch.js            (canlı yazar)
 *   node backend/scripts/runCategoryAutoMatch.js --dry      (önizleme, yazmaz)
 *   node backend/scripts/runCategoryAutoMatch.js --user <userId>
 *   node backend/scripts/runCategoryAutoMatch.js --platforms n11,amazon
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local"), override: true });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}

const mongoose = require("mongoose");
const Marketplace = require("../models/Marketplace");
const categoryCenterController = require("../controllers/categoryCenterController");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry") || args.includes("--dryRun");
// Varsayılan: KATI eşleştirme — yanlış kategori riskini azaltır. Yaklaşık mod: --aggressive
const aggressive = args.includes("--aggressive");
const userArgIdx = args.indexOf("--user");
const userArg = userArgIdx !== -1 ? args[userArgIdx + 1] : null;
const platArgIdx = args.indexOf("--platforms");
const platformsArg = platArgIdx !== -1 && args[platArgIdx + 1]
    ? args[platArgIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

const resolveUserId = async () => {
    if (userArg) return userArg;
    // En çok pazaryeri entegrasyonu olan kullanıcıyı seç
    const agg = await Marketplace.aggregate([
        { $group: { _id: "$userId", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 1 }
    ]);
    if (!agg.length) throw new Error("Hiç pazaryeri entegrasyonu bulunamadı. --user <id> ile belirtin.");
    return agg[0]._id;
};

const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGO_URI bulunamadı. backend/.env dosyasını kontrol edin.");
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı kuruldu");

    const userId = await resolveUserId();
    const mps = await Marketplace.find({ userId }).select("marketplaceName isActive").lean();
    console.log(`👤 Kullanıcı: ${userId}`);
    console.log(`🔌 Entegrasyonlar: ${mps.map((m) => m.marketplaceName).join(", ") || "(yok)"}`);
    console.log(`⚙️  Mod: ${dryRun ? "ÖNİZLEME (yazmaz)" : "CANLI (boş hücreleri doldurur)"} | Eşleştirme: ${aggressive ? "YAKLAŞIK (--aggressive)" : "KATI (önerilen)"}`);
    if (platformsArg.length) console.log(`🎯 Platformlar: ${platformsArg.join(", ")}`);
    console.log("⏳ Eşleştirme çalışıyor — kategori listeleri büyükse birkaç dakika sürebilir...\n");

    const { results, summary } = await categoryCenterController.runAutoMatchCore({
        userId,
        platforms: platformsArg,
        dryRun,
        aggressive
    });

    console.log("\n══════════ SONUÇ ══════════");
    for (const [key, r] of Object.entries(results)) {
        if (r.status === "completed" || r.status === "preview") {
            console.log(
                `  ${key.padEnd(12)} ✅ eşleşen: ${r.matched ?? r.wouldWrite ?? 0}, ` +
                `atlanan(dolu): ${r.skipped ?? 0}, eşleşmeyen: ${r.noMatch ?? 0}, belirsiz: ${r.ambiguous ?? 0} ` +
                `(kaynak yaprak: ${r.listingEligible ?? "-"})`
            );
            for (const s of (r.samples || []).slice(0, 3)) {
                console.log(`        ↳ "${s.masterPath}"  →  "${s.targetPath}"  (skor: ${s.score})`);
            }
        } else {
            console.log(`  ${key.padEnd(12)} ⏭️  ${r.status}: ${r.reason || ""}`);
        }
    }
    console.log("───────────────────────────");
    console.log(
        `  TOPLAM ${dryRun ? "(yazılacak)" : "yazılan"}: ${summary.totalWouldUpdate}, ` +
        `atlanan: ${summary.totalSkipped}, eşleşmeyen: ${summary.totalNoMatch}, belirsiz: ${summary.totalAmbiguous}`
    );
    console.log("═══════════════════════════\n");

    await mongoose.disconnect();
    console.log("✅ Bağlantı kapatıldı.");
    process.exit(0);
};

run().catch(async (err) => {
    console.error("❌ Hata:", err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
