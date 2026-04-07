/**
 * KATEGORİ VERİLERİNİ TEMİZLEME SCRİPTİ
 *
 * Bu script tüm kategori ile ilgili koleksiyonları siler ve
 * ProductMapping'lerdeki eski categoryStatus/categoryError alanlarını kaldırır.
 *
 * Kullanım:
 *   node backend/scripts/cleanCategoryData.js
 *
 * Silinen koleksiyonlar:
 *   1. UnifiedCategoryMap      — Birleşik kategori haritası
 *   2. InternalCategory        — Dahili kategoriler
 *   3. InternalCategoryMapping — Dahili → Pazaryeri eşleştirme
 *   4. CategoryMapping         — Kullanıcı kategori eşleştirmesi
 *   5. UnmappedCategory        — Eşleştirilemeyen kategoriler
 *   6. UserCategoryMemory      — Kullanıcı hafızası
 *   7. MarketplaceCategory     — Pazaryeri kategorileri
 *   8. AttributeMapping        — Attribute eşleştirme
 *   9. Category                — Genel kategori
 *
 * Güncellenen koleksiyonlar:
 *   - ProductMapping           — categoryStatus ve categoryError alanları kaldırılır
 */

const mongoose = require("mongoose");
const path = require("path");

// .env dosyasını yükle
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ MONGODB_URI veya MONGO_URI environment variable bulunamadı!");
    console.error("   .env dosyasında MONGODB_URI tanımlı olduğundan emin olun.");
    process.exit(1);
}

const COLLECTIONS_TO_DROP = [
    "unifiedcategorymaps",
    "internalcategories",
    "internalcategorymappings",
    "categorymappings",
    "unmappedcategories",
    "usercategorymemories",
    "marketplacecategories",
    "attributemappings",
    "categories"
];

async function main() {
    console.log("🔗 MongoDB'ye bağlanılıyor...");
    console.log(`   URI: ${MONGO_URI.replace(/\/\/.*@/, "//***@")}`);

    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB bağlantısı başarılı\n");

    const db = mongoose.connection.db;

    // ── 1. Kategori koleksiyonlarını sil ──
    console.log("═══════════════════════════════════════════");
    console.log("🗑️  KATEGORİ KOLEKSİYONLARI SİLİNİYOR...");
    console.log("═══════════════════════════════════════════\n");

    // Mevcut koleksiyonları listele
    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    let droppedCount = 0;
    for (const collName of COLLECTIONS_TO_DROP) {
        if (existingCollections.includes(collName)) {
            // Önce kayıt sayısını göster
            const count = await db.collection(collName).countDocuments();
            await db.collection(collName).drop();
            console.log(`   ✅ ${collName} silindi (${count} kayıt)`);
            droppedCount++;
        } else {
            console.log(`   ⏭️  ${collName} — koleksiyon mevcut değil, atlandı`);
        }
    }

    console.log(`\n   Toplam: ${droppedCount} koleksiyon silindi\n`);

    // ── 2. ProductMapping'lerdeki categoryStatus/categoryError alanlarını kaldır ──
    console.log("═══════════════════════════════════════════");
    console.log("🧹 ProductMapping TEMİZLENİYOR...");
    console.log("═══════════════════════════════════════════\n");

    if (existingCollections.includes("productmappings")) {
        const totalProducts = await db.collection("productmappings").countDocuments();
        console.log(`   Toplam ProductMapping: ${totalProducts}`);

        // categoryStatus ve categoryError alanlarını kaldır
        const result = await db.collection("productmappings").updateMany(
            {},
            { $unset: { categoryStatus: "", categoryError: "" } }
        );

        console.log(`   ✅ ${result.modifiedCount} üründen categoryStatus/categoryError kaldırıldı`);

        // Eski index'i de kaldır (varsa)
        try {
            await db.collection("productmappings").dropIndex("userId_1_categoryStatus_1");
            console.log("   ✅ userId_1_categoryStatus_1 index'i kaldırıldı");
        } catch {
            console.log("   ⏭️  userId_1_categoryStatus_1 index'i mevcut değil, atlandı");
        }
    } else {
        console.log("   ⏭️  productmappings koleksiyonu mevcut değil");
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("✅ TEMİZLİK TAMAMLANDI!");
    console.log("═══════════════════════════════════════════\n");

    await mongoose.disconnect();
    console.log("🔌 MongoDB bağlantısı kapatıldı");
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Script hatası:", err.message);
    process.exit(1);
});
