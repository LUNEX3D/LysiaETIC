/**
 * Debug: HB kategorilerinde "kolye" araması
 * Cache'deki ve API'den gelen verileri kontrol eder
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const CategoryCache = require("../models/CategoryCache");

const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı kuruldu\n");

    // 1. Cache'deki HB kategorilerini kontrol et
    const caches = await CategoryCache.find({ marketplaceName: /hepsiburada/i }).lean();
    console.log(`📦 HB cache kayıtları: ${caches.length}`);

    for (const cache of caches) {
        const cats = cache.categories || [];
        console.log(`\n── Cache: userId=${cache.userId}, marketplaceName="${cache.marketplaceName}"`);
        console.log(`   Toplam kategori: ${cats.length}`);
        console.log(`   Cache tarihi: ${cache.cachedAt}`);

        // "kolye" içeren kategorileri bul
        const kolyeMatches = cats.filter(c => {
            const name = (c.name || c.categoryName || c.displayName || "").toLowerCase();
            return name.includes("kolye");
        });
        console.log(`\n   🔍 "kolye" içeren kategoriler: ${kolyeMatches.length}`);
        for (const m of kolyeMatches.slice(0, 20)) {
            console.log(`      ID: ${m.categoryId || m.id} | name: "${m.name || m.categoryName}" | leaf: ${m.leaf} | available: ${m.available} | parent: ${m.parentCategoryId || "YOK"}`);
        }

        // "Kolye Ucu" spesifik arama
        const kolyeUcu = cats.filter(c => {
            const name = (c.name || c.categoryName || c.displayName || "").toLowerCase();
            return name.includes("kolye ucu");
        });
        console.log(`\n   🎯 "kolye ucu" içeren kategoriler: ${kolyeUcu.length}`);
        for (const m of kolyeUcu) {
            console.log(`      ID: ${m.categoryId || m.id} | name: "${m.name || m.categoryName}" | leaf: ${m.leaf} | available: ${m.available} | parent: ${m.parentCategoryId || "YOK"}`);
        }

        // Leaf istatistikleri
        const leafCount = cats.filter(c => c.leaf === true || c.leaf === "true").length;
        const availableCount = cats.filter(c => c.available === true || c.available === "true").length;
        const leafAvailableCount = cats.filter(c => (c.leaf === true || c.leaf === "true") && (c.available === true || c.available === "true")).length;
        console.log(`\n   📊 İstatistikler:`);
        console.log(`      Leaf: ${leafCount}`);
        console.log(`      Available: ${availableCount}`);
        console.log(`      Leaf+Available: ${leafAvailableCount}`);

        // İlk 3 kategoriyi göster (veri yapısını anlamak için)
        console.log(`\n   📋 İlk 3 kategori (veri yapısı):`);
        for (const c of cats.slice(0, 3)) {
            console.log(`      ${JSON.stringify(c).substring(0, 300)}`);
        }

        // Derinlik analizi — parentCategoryId olan/olmayan
        const withParent = cats.filter(c => c.parentCategoryId).length;
        const withoutParent = cats.filter(c => !c.parentCategoryId).length;
        console.log(`\n   🌳 Parent analizi:`);
        console.log(`      parentCategoryId olan: ${withParent}`);
        console.log(`      parentCategoryId olmayan (root): ${withoutParent}`);
    }

    if (caches.length === 0) {
        console.log("\n⚠️  HB cache'i boş! Henüz HB kategorileri çekilmemiş.");
        console.log("   Kategori Merkezi'nde HB tab'ına tıklayarak veya arama yaparak cache oluşturulur.");
    }

    await mongoose.disconnect();
    console.log("\n✅ Tamamlandı.");
};

run().catch(err => {
    console.error("❌ Hata:", err.message);
    process.exit(1);
});
