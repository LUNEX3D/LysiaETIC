/**
 * ID BAZLI KATEGORİ EŞLEŞTİRME IMPORT SCRİPTİ
 *
 * id_based_mapping.xlsx dosyasından kategori eşleştirmelerini okur,
 * mevcut UnifiedCategoryMap koleksiyonunu TEMİZLER ve yeni verileri yükler.
 *
 * Excel yapısı:
 *   lysia_category  — Kategori adı (Trendyol referans)
 *   trendyol_id     — Trendyol kategori ID
 *   n11_id          — N11 kategori ID (boş olabilir)
 *   ciceksepeti_id  — ÇiçekSepeti kategori ID (boş olabilir)
 *
 * Kullanım:
 *   node backend/scripts/importIdBasedMapping.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const dns = require("dns");
const XLSX = require("xlsx");
const path = require("path");

// DNS fix for MongoDB Atlas
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const UnifiedCategoryMap = require("../models/UnifiedCategoryMap");
const { normalizeKey } = require("../utils/textNormalize");

// ─────────────────────────────────────────────────────────────────────────────
// YAPILANDIRMA
// ─────────────────────────────────────────────────────────────────────────────

const EXCEL_PATH = path.join("C:", "Users", "emrul", "Downloads", "id_based_mapping.xlsx");
const BATCH_SIZE = 500;

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI
// ─────────────────────────────────────────────────────────────────────────────

const extractRoot = (name) => {
    // ID bazlı mapping'de path yok, root olarak ismin kendisini kullan
    return name || "";
};

const buildPlatformData = (categoryId, categoryName) => {
    if (!categoryId || categoryId === "") return null;
    const idStr = String(categoryId).trim();
    if (!idStr) return null;
    return {
        categoryId: idStr,
        categoryName: categoryName || "",
        categoryPath: "",
        depth: 0,
        parentId: null,
        parentName: null,
        isLeaf: true
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// ANA FONKSİYON
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log("=".repeat(70));
    console.log("  ID BAZLI KATEGORİ EŞLEŞTİRME IMPORT");
    console.log("  Excel: " + EXCEL_PATH);
    console.log("=".repeat(70));
    console.log();

    // ── 1. Excel'i oku ──────────────────────────────────────────────────────
    console.log("[1/5] Excel dosyasi okunuyor...");
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    console.log(`      ${rows.length} satir okundu.`);
    console.log();

    // ── 2. Verileri hazırla ─────────────────────────────────────────────────
    console.log("[2/5] Veriler hazirlaniyor...");

    let withN11 = 0, withCS = 0, withBoth = 0, onlyTY = 0;
    const records = [];

    for (const row of rows) {
        const name = (row.lysia_category || "").trim();
        if (!name) continue;

        const tyId = row.trendyol_id ? String(row.trendyol_id).trim() : "";
        const n11Id = row.n11_id ? String(row.n11_id).trim() : "";
        const csId = row.ciceksepeti_id ? String(row.ciceksepeti_id).trim() : "";

        if (!tyId) continue; // Trendyol ID zorunlu

        // Platform sayısını hesapla
        let platformCount = 1; // Trendyol her zaman var
        const hasN11 = n11Id !== "";
        const hasCS = csId !== "";
        if (hasN11) { platformCount++; withN11++; }
        if (hasCS) { platformCount++; withCS++; }
        if (hasN11 && hasCS) withBoth++;
        if (!hasN11 && !hasCS) onlyTY++;

        // matchType belirle
        let matchType = "single";
        if (platformCount >= 3) matchType = "exact";
        else if (platformCount === 2) matchType = "2of3";

        const key = normalizeKey(name);
        if (!key) continue;

        records.push({
            canonicalName: name,
            normalizedKey: key,
            canonicalPath: "",
            rootCategory: "",
            trendyol: buildPlatformData(tyId, name),
            n11: buildPlatformData(hasN11 ? n11Id : null, hasN11 ? name : null),
            ciceksepeti: buildPlatformData(hasCS ? csId : null, hasCS ? name : null),
            hepsiburada: null,
            amazon: null,
            platformCount,
            matchType,
            isLeaf: true,
            notes: "id_based_mapping import"
        });
    }

    console.log(`      ${records.length} gecerli kayit hazirlandi.`);
    console.log(`      Trendyol: ${records.length} | N11: ${withN11} | CicekSepeti: ${withCS}`);
    console.log(`      Her 3 platform: ${withBoth} | Sadece Trendyol: ${onlyTY}`);
    console.log();

    // ── 3. DB'ye bağlan ─────────────────────────────────────────────────────
    console.log("[3/5] Veritabanina baglaniyor...");
    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000
    });
    console.log(`      Baglanti basarili: ${mongoose.connection.name}`);
    console.log();

    // ── 4. Mevcut kayıtları sil ─────────────────────────────────────────────
    console.log("[4/5] Mevcut UnifiedCategoryMap kayitlari siliniyor...");
    const existingCount = await UnifiedCategoryMap.countDocuments({});
    console.log(`      Mevcut kayit sayisi: ${existingCount}`);

    const deleteResult = await UnifiedCategoryMap.deleteMany({});
    console.log(`      ${deleteResult.deletedCount} kayit SILINDI.`);
    console.log();

    // ── 5. Yeni kayıtları yükle ─────────────────────────────────────────────
    console.log("[5/5] Yeni kayitlar yukleniyor...");
    let inserted = 0, errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(records.length / BATCH_SIZE);

        const bulkOps = batch.map(record => ({
            updateOne: {
                filter: { normalizedKey: record.normalizedKey },
                update: {
                    $set: {
                        canonicalName: record.canonicalName,
                        canonicalPath: record.canonicalPath,
                        rootCategory: record.rootCategory,
                        trendyol: record.trendyol,
                        n11: record.n11,
                        ciceksepeti: record.ciceksepeti,
                        hepsiburada: record.hepsiburada,
                        amazon: record.amazon,
                        platformCount: record.platformCount,
                        matchType: record.matchType,
                        isLeaf: record.isLeaf,
                        notes: record.notes
                    },
                    $setOnInsert: {
                        normalizedKey: record.normalizedKey
                    }
                },
                upsert: true
            }
        }));

        try {
            const result = await UnifiedCategoryMap.bulkWrite(bulkOps, { ordered: false });
            const batchInserted = (result.upsertedCount || 0) + (result.modifiedCount || 0);
            inserted += batchInserted;
            process.stdout.write(`\r      Batch ${batchNum}/${totalBatches} — ${inserted} kayit yuklendi...`);
        } catch (err) {
            if (err.writeErrors) {
                errors += err.writeErrors.length;
                inserted += (err.result?.nUpserted || 0) + (err.result?.nModified || 0);
            } else {
                console.error(`\n      HATA batch ${batchNum}: ${err.message}`);
                errors += batch.length;
            }
        }
    }

    console.log(); // Yeni satır
    console.log();

    // ── Doğrulama ────────────────────────────────────────────────────────────
    const finalCount = await UnifiedCategoryMap.countDocuments({});
    const withTY = await UnifiedCategoryMap.countDocuments({ "trendyol.categoryId": { $ne: null } });
    const withN11DB = await UnifiedCategoryMap.countDocuments({ "n11.categoryId": { $ne: null } });
    const withCSDB = await UnifiedCategoryMap.countDocuments({ "ciceksepeti.categoryId": { $ne: null } });

    // Örnek kayıtları göster
    const samples = await UnifiedCategoryMap.find({
        "n11.categoryId": { $ne: null },
        "ciceksepeti.categoryId": { $ne: null }
    }).limit(5).lean();

    console.log("=".repeat(70));
    console.log("  SONUC");
    console.log("=".repeat(70));
    console.log();
    console.log(`  Onceki kayit sayisi : ${existingCount}`);
    console.log(`  Silinen             : ${deleteResult.deletedCount}`);
    console.log(`  Yuklenen            : ${inserted}`);
    console.log(`  Hatalar             : ${errors}`);
    console.log(`  Yeni toplam         : ${finalCount}`);
    console.log();
    console.log("  Platform dagilimi:");
    console.log(`    Trendyol    : ${withTY}`);
    console.log(`    N11         : ${withN11DB}`);
    console.log(`    CicekSepeti : ${withCSDB}`);
    console.log();

    if (samples.length > 0) {
        console.log("  Ornek kayitlar (3 platformlu):");
        for (const s of samples) {
            console.log(`    ${s.canonicalName}`);
            console.log(`      TY: ${s.trendyol?.categoryId || "-"} | N11: ${s.n11?.categoryId || "-"} | CS: ${s.ciceksepeti?.categoryId || "-"}`);
        }
        console.log();
    }

    console.log("  IMPORT TAMAMLANDI!");
    console.log("=".repeat(70));

    await mongoose.connection.close();
    process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇALIŞTIR
// ─────────────────────────────────────────────────────────────────────────────

main().catch(async (err) => {
    console.error("\nKRITIK HATA:", err.message);
    console.error(err.stack);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
});
