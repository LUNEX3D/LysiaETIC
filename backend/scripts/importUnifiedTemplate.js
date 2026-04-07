/**
 * BİRLEŞİK KATEGORİ ŞABLONUNU VERİTABANINA IMPORT ET
 *
 * Bu script:
 *   1. unifiedCategoryTemplate.js'deki şablonu okur
 *   2. InternalCategory tablosuna ağaç yapısını yazar
 *   3. Her kategori için keywords ve metadata kaydeder
 *   4. İstatistik raporu verir
 *
 * Kullanım:
 *   node backend/scripts/importUnifiedTemplate.js
 *   node backend/scripts/importUnifiedTemplate.js --clear   (önce mevcut verileri sil)
 *
 * Sonuç:
 *   InternalCategory tablosunda 25 kök + ~250 alt kategori oluşur
 *   Bu kategoriler daha sonra platformlara eşleştirilir (InternalCategoryMapping)
 */

const mongoose = require("mongoose");
const path = require("path");

// .env dosyasını yükle
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const InternalCategory = require("../models/InternalCategory");
const { UNIFIED_CATEGORY_TEMPLATE, flattenCategories, countCategories } = require("../data/unifiedCategoryTemplate");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const CLEAR_FLAG = process.argv.includes("--clear");

if (!MONGO_URI) {
    console.error("❌ MONGODB_URI veya MONGO_URI environment variable bulunamadı!");
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI
// ─────────────────────────────────────────────────────────────────────────────

const generateSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
};

// ─────────────────────────────────────────────────────────────────────────────
// REKÜRSİF IMPORT
// ─────────────────────────────────────────────────────────────────────────────

let insertedCount = 0;
let updatedCount = 0;
let errorCount = 0;

/**
 * Kategori ağacını rekursif olarak veritabanına yaz
 * @param {Array} categories - Kategori dizisi
 * @param {ObjectId|null} parentId - Üst kategori ID
 * @param {number} depth - Derinlik seviyesi
 * @param {number} sortBase - Sıralama başlangıcı
 */
async function importCategories(categories, parentId = null, depth = 0, sortBase = 0) {
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const slug = cat.slug || generateSlug(cat.name);
        const sortOrder = sortBase + (i * 10);

        try {
            // Upsert: slug bazlı — varsa güncelle, yoksa oluştur
            const result = await InternalCategory.findOneAndUpdate(
                { slug },
                {
                    $set: {
                        name: cat.name,
                        parentId: parentId,
                        keywords: cat.keywords || [],
                        icon: cat.icon || "📁",
                        sortOrder: sortOrder,
                        isActive: true
                    },
                    $setOnInsert: {
                        slug
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            const isNew = result.createdAt && result.updatedAt &&
                Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;

            if (isNew) {
                insertedCount++;
            } else {
                updatedCount++;
            }

            const indent = "  ".repeat(depth);
            const icon = cat.icon || "📁";
            const childInfo = cat.children && cat.children.length > 0
                ? ` (${cat.children.length} alt)`
                : " ✓";
            console.log(`${indent}${icon} ${cat.name}${childInfo}`);

            // Alt kategorileri rekursif olarak import et
            if (cat.children && cat.children.length > 0) {
                await importCategories(cat.children, result._id, depth + 1, 0);
            }
        } catch (err) {
            errorCount++;
            console.error(`  ❌ HATA: ${cat.name} — ${err.message}`);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANA FONKSİYON
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  LysiaETIC — Birleşik Kategori Şablonu Import              ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Şablon istatistikleri
    const totalCount = countCategories();
    const flatList = flattenCategories();
    const leafCount = flatList.filter(c => c.isLeaf).length;
    const rootCount = UNIFIED_CATEGORY_TEMPLATE.categories.length;

    console.log("📊 Şablon İstatistikleri:");
    console.log(`   Versiyon:       ${UNIFIED_CATEGORY_TEMPLATE.version}`);
    console.log(`   Kök Kategori:   ${rootCount}`);
    console.log(`   Toplam:         ${totalCount}`);
    console.log(`   Yaprak:         ${leafCount}`);
    console.log(`   Üst Kategori:   ${totalCount - leafCount}`);
    console.log(`   Max Derinlik:   ${UNIFIED_CATEGORY_TEMPLATE.maxDepth}`);
    console.log("");

    // MongoDB bağlantısı
    console.log("🔗 MongoDB'ye bağlanılıyor...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB bağlantısı başarılı\n");

    // Mevcut verileri temizle (opsiyonel)
    if (CLEAR_FLAG) {
        console.log("🗑️  --clear bayrağı algılandı, mevcut InternalCategory verileri siliniyor...");
        const deleted = await InternalCategory.deleteMany({});
        console.log(`   ✅ ${deleted.deletedCount} kayıt silindi\n`);
    } else {
        const existingCount = await InternalCategory.countDocuments({});
        if (existingCount > 0) {
            console.log(`⚠️  Mevcut ${existingCount} InternalCategory kaydı var.`);
            console.log("   Slug bazlı upsert yapılacak (varsa güncelle, yoksa oluştur).");
            console.log("   Temiz import için: node backend/scripts/importUnifiedTemplate.js --clear\n");
        }
    }

    // Import başlat
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📥 KATEGORİLER İMPORT EDİLİYOR...");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const startTime = Date.now();
    await importCategories(UNIFIED_CATEGORY_TEMPLATE.categories);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Sonuç raporu
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("📊 SONUÇ RAPORU");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const dbCount = await InternalCategory.countDocuments({});
    const dbRootCount = await InternalCategory.countDocuments({ parentId: null });
    const dbLeafCount = await InternalCategory.countDocuments({
        _id: { $nin: await InternalCategory.distinct("parentId", { parentId: { $ne: null } }) }
    });

    console.log(`   ✅ Yeni eklenen:    ${insertedCount}`);
    console.log(`   🔄 Güncellenen:     ${updatedCount}`);
    console.log(`   ❌ Hata:            ${errorCount}`);
    console.log(`   ⏱️  Süre:            ${elapsed}s`);
    console.log("");
    console.log(`   📦 DB'deki toplam:  ${dbCount}`);
    console.log(`   🌳 Kök kategori:    ${dbRootCount}`);
    console.log("");

    // Kök kategorileri listele
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🌳 KÖK KATEGORİLER");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const roots = await InternalCategory.find({ parentId: null }).sort({ sortOrder: 1 });
    for (const root of roots) {
        const childCount = await InternalCategory.countDocuments({ parentId: root._id });
        console.log(`   ${root.icon} ${root.name} (${childCount} alt kategori)`);
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("✅ İMPORT TAMAMLANDI!");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log("📌 Sonraki adımlar:");
    console.log("   1. Platform Excel'lerini yükleyin → UnifiedCategoryMap oluşur");
    console.log("   2. InternalCategoryMapping ile platform eşleştirmesi yapın");
    console.log("   3. Ürünleri dahili kategorilere atayın");
    console.log("");

    await mongoose.disconnect();
    console.log("🔌 MongoDB bağlantısı kapatıldı");
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Script hatası:", err.message);
    console.error(err.stack);
    process.exit(1);
});
