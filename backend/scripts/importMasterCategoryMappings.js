/**
 * Master Kategori Eşleştirme Excel Import — LysiaETIC
 *
 * master_kategori_eslestirme.xlsx dosyasını MongoDB'ye aktarır.
 *
 * Kullanım:
 *   node backend/scripts/importMasterCategoryMappings.js
 *
 * Opsiyonel:
 *   node backend/scripts/importMasterCategoryMappings.js --file "C:\path\to\file.xlsx"
 *   node backend/scripts/importMasterCategoryMappings.js --drop   (önce koleksiyonu temizle)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");

// Model'i doğrudan require et
const MasterCategoryMapping = require("../models/MasterCategoryMapping");

// ── Argümanları parse et ──
const args = process.argv.slice(2);
const fileArgIdx = args.indexOf("--file");
const shouldDrop = args.includes("--drop");

const DEFAULT_FILE = path.join("C:\\Users\\emrul\\Downloads", "master_kategori_eslestirme.xlsx");
const filePath = fileArgIdx !== -1 && args[fileArgIdx + 1] ? args[fileArgIdx + 1] : DEFAULT_FILE;

const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGO_URI bulunamadı. .env dosyasını kontrol edin.");
        process.exit(1);
    }

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  Master Kategori Eşleştirme — Excel → MongoDB Import        ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    console.log(`📁 Dosya: ${filePath}`);

    // ── 1. Excel'i oku ──
    let wb;
    try {
        wb = XLSX.readFile(filePath);
    } catch (err) {
        console.error(`❌ Excel dosyası okunamadı: ${err.message}`);
        process.exit(1);
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    console.log(`📊 ${rows.length} satır okundu (Sheet: "${wb.SheetNames[0]}")\n`);

    if (rows.length === 0) {
        console.error("❌ Excel dosyası boş!");
        process.exit(1);
    }

    // ── 2. MongoDB'ye bağlan ──
    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı kuruldu\n");

    // ── 3. Opsiyonel: Koleksiyonu temizle ──
    if (shouldDrop) {
        const existing = await MasterCategoryMapping.countDocuments();
        if (existing > 0) {
            await MasterCategoryMapping.deleteMany({});
            console.log(`🗑️  Mevcut ${existing} kayıt silindi (--drop)\n`);
        }
    }

    // ── 4. Satırları dönüştür ve ekle ──
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const batchSize = 500;
    const docs = [];

    for (const row of rows) {
        docs.push({
            masterId: row.master_id || null,
            masterName: row.master_name || "",
            masterPath: row.master_path || "",
            trendyolId: row.trendyol_id || null,
            trendyolPath: row.trendyol_path || "",
            n11Id: row.n11_id || null,
            n11Path: row.n11_path || "",
            ciceksepetiId: row.ciceksepeti_id || null,
            ciceksepetiPath: row.ciceksepeti_path || "",
            hepsiburadaId: row.hepsiburada_id || null,
            hepsiburadaPath: row.hepsiburada_path || "",
            amazonId: row.amazon_id || null,
            amazonPath: row.amazon_path || ""
        });
    }

    // Batch insert
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        try {
            const result = await MasterCategoryMapping.insertMany(batch, { ordered: false });
            inserted += result.length;
        } catch (err) {
            // Duplicate key hatalarını say, diğerlerini logla
            if (err.code === 11000 || err.writeErrors) {
                const dupes = err.writeErrors ? err.writeErrors.length : 1;
                skipped += dupes;
                inserted += (batch.length - dupes);
            } else {
                errors += batch.length;
                console.error(`  ⚠ Batch hatası (satır ${i + 1}-${i + batch.length}): ${err.message}`);
            }
        }

        // İlerleme göster
        const progress = Math.min(i + batchSize, docs.length);
        const pct = ((progress / docs.length) * 100).toFixed(1);
        process.stdout.write(`\r  📥 İlerleme: ${progress}/${docs.length} (${pct}%)`);
    }

    console.log("\n");

    // ── 5. Sonuç ──
    const totalInDb = await MasterCategoryMapping.countDocuments();
    const uniqueMasters = await MasterCategoryMapping.distinct("masterId");
    const withN11 = await MasterCategoryMapping.countDocuments({ n11Id: { $ne: null } });
    const withCS = await MasterCategoryMapping.countDocuments({ ciceksepetiId: { $ne: null } });

    console.log("═══════════════════════════════════════════════════");
    console.log(`  ✅ Eklenen:  ${inserted}`);
    console.log(`  ⏭️  Atlanan:  ${skipped} (duplicate)`);
    console.log(`  ❌ Hata:     ${errors}`);
    console.log("═══════════════════════════════════════════════════");
    console.log(`  📊 DB'deki toplam kayıt:     ${totalInDb}`);
    console.log(`  🏷️  Benzersiz master kategori: ${uniqueMasters.length}`);
    console.log(`  🟣 N11 eşleşmesi olan:        ${withN11}`);
    console.log(`  🌸 ÇiçekSepeti eşleşmesi olan: ${withCS}`);
    console.log("═══════════════════════════════════════════════════\n");

    await mongoose.disconnect();
    console.log("✅ Tamamlandı. MongoDB bağlantısı kapatıldı.");
    process.exit(0);
};

run().catch(err => {
    console.error("❌ Hata:", err.message);
    process.exit(1);
});
