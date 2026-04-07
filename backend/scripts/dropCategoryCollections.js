/**
 * Kategori eşleştirme ile ilgili tüm MongoDB koleksiyonlarını siler.
 *
 * Kullanım:
 *   node backend/scripts/dropCategoryCollections.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const COLLECTIONS_TO_DROP = [
    "categorymappings",
    "internalcategorymappings",
    "internalcategories",
    "unmappedcategories",
    "attributemappings",
    "categoryerrorlogs",
    "unifiedcategorymaps",
    "usercategorymemorys",
    "usercategorymemories",
];

const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGO_URI bulunamadı. .env dosyasını kontrol edin.");
        process.exit(1);
    }

    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  Kategori Eşleştirme Koleksiyonları Temizleme       ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı kuruldu\n");

    const db = mongoose.connection.db;
    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    let dropped = 0;
    let skipped = 0;

    for (const name of COLLECTIONS_TO_DROP) {
        if (existingCollections.includes(name)) {
            const count = await db.collection(name).countDocuments();
            await db.collection(name).drop();
            console.log(`🗑️  ${name} silindi (${count} kayıt)`);
            dropped++;
        } else {
            console.log(`⏭️  ${name} — koleksiyon mevcut değil, atlandı`);
            skipped++;
        }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  Silinen: ${dropped} | Atlanan: ${skipped}`);
    console.log(`═══════════════════════════════════════\n`);

    await mongoose.disconnect();
    console.log("✅ Tamamlandı. MongoDB bağlantısı kapatıldı.");
    process.exit(0);
};

run().catch(err => {
    console.error("❌ Hata:", err.message);
    process.exit(1);
});
