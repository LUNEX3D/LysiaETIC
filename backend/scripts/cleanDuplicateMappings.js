/**
 * Duplike Kategori Eşleştirme Temizleme — LysiaETIC
 *
 * Mevcut DB'deki duplike satırları temizler.
 * Excel dosyasına ihtiyaç DUYMAZ — doğrudan DB üzerinde çalışır.
 *
 * Ne yapar:
 *   1. Aynı masterId ile birden fazla satır varsa → en iyi eşleşmeyi seçer
 *   2. Diğer duplike satırları siler
 *   3. HTML entity'leri decode eder (&gt; → >, &amp; → &)
 *   4. Eski index'leri temizler, yeni unique index oluşturur
 *
 * Kullanım:
 *   node backend/scripts/cleanDuplicateMappings.js
 *
 * Güvenli: Önce analiz yapar, sonra temizler. --dry-run ile sadece analiz yapılır.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const mongoose = require("mongoose");

// ── Argümanlar ──
const isDryRun = process.argv.includes("--dry-run");

// ── HTML Entity Decode ──
const HTML_ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&#39;": "'", "&apos;": "'", "&#x27;": "'", "&#x2F;": "/",
    "&nbsp;": " ", "&#38;": "&", "&#60;": "<", "&#62;": ">"
};
const ENTITY_REGEX = new RegExp(Object.keys(HTML_ENTITIES).join("|"), "gi");
const decodeHtml = (str) => {
    if (!str || typeof str !== "string") return str || "";
    return str.replace(ENTITY_REGEX, (match) => HTML_ENTITIES[match.toLowerCase()] || match);
};

// ── Path Benzerlik Skoru ──
const pathSimilarityScore = (masterPath, candidatePath) => {
    if (!masterPath || !candidatePath) return 0;
    const normalize = (p) => decodeHtml(p).toLowerCase().replace(/\s*>\s*/g, ">").replace(/\s+/g, " ").trim();
    const mp = normalize(masterPath);
    const cp = normalize(candidatePath);
    if (mp === cp) return 100;

    const mParts = mp.split(">");
    const cParts = cp.split(">");
    let score = 0;

    const mLast = mParts[mParts.length - 1]?.trim();
    const cLast = cParts[cParts.length - 1]?.trim();
    if (mLast === cLast) score += 2;
    else if (mLast && cLast && (mLast.includes(cLast) || cLast.includes(mLast))) score += 1;
    else return 0;

    const minLen = Math.min(mParts.length, cParts.length);
    for (let i = 2; i <= minLen; i++) {
        const mSeg = mParts[mParts.length - i]?.trim();
        const cSeg = cParts[cParts.length - i]?.trim();
        if (mSeg === cSeg) score += 2;
        else if (mSeg && cSeg && (mSeg.includes(cSeg) || cSeg.includes(mSeg))) score += 0.5;
    }

    const depthDiff = Math.abs(mParts.length - cParts.length);
    if (depthDiff === 0) score += 1;
    else if (depthDiff === 1) score += 0.5;

    return score;
};

const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGO_URI bulunamadı. .env dosyasını kontrol edin.");
        process.exit(1);
    }

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  Duplike Kategori Eşleştirme Temizleme                      ║");
    console.log(`║  Mod: ${isDryRun ? "DRY-RUN (sadece analiz)" : "CANLI (temizleme yapılacak)"}                          ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı kuruldu\n");

    const db = mongoose.connection.db;
    const collection = db.collection("mastercategorymappings");

    // ── 1. Mevcut durum analizi ──
    const totalBefore = await collection.countDocuments();
    console.log(`📊 Mevcut toplam kayıt: ${totalBefore}\n`);

    // masterId bazında grupla
    const pipeline = [
        { $group: { _id: "$masterId", count: { $sum: 1 }, docs: { $push: "$$ROOT" } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } }
    ];

    const duplicateGroups = await collection.aggregate(pipeline).toArray();
    const totalDuplicateGroups = duplicateGroups.length;
    const totalDuplicateRows = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
    const rowsToDelete = totalDuplicateRows - totalDuplicateGroups; // Her gruptan 1 kalacak

    console.log(`🔍 Duplike analizi:`);
    console.log(`   Duplike masterId sayısı: ${totalDuplicateGroups}`);
    console.log(`   Bu ID'lere ait toplam satır: ${totalDuplicateRows}`);
    console.log(`   Silinecek satır: ${rowsToDelete}`);
    console.log(`   Temizlik sonrası kalacak: ${totalBefore - rowsToDelete}\n`);

    // En çok tekrarlanan 10 kategoriyi göster
    if (duplicateGroups.length > 0) {
        console.log("📋 En çok tekrarlanan kategoriler:");
        for (const g of duplicateGroups.slice(0, 10)) {
            const name = g.docs[0]?.masterName || "?";
            console.log(`   ${name} (ID: ${g._id}) → ${g.count} kez tekrarlanmış`);
        }
        console.log("");
    }

    if (isDryRun) {
        console.log("ℹ️  DRY-RUN modu — temizleme yapılmadı.");
        console.log("   Gerçek temizleme için: node backend/scripts/cleanDuplicateMappings.js");
        await mongoose.disconnect();
        process.exit(0);
    }

    if (duplicateGroups.length === 0 && totalBefore > 0) {
        console.log("✅ Duplike satır bulunamadı! Sadece HTML decode uygulanacak...\n");
    }

    // ── 2. Duplike grupları temizle ──
    let deleted = 0;
    let kept = 0;

    for (const group of duplicateGroups) {
        const docs = group.docs;
        const masterPath = decodeHtml(docs[0]?.masterPath || "");

        // Her platform için en iyi eşleşmeyi bul
        const bestDoc = { ...docs[0] }; // Temel olarak ilk dokümanı al

        const platforms = [
            { idField: "n11Id", pathField: "n11Path" },
            { idField: "ciceksepetiId", pathField: "ciceksepetiPath" },
            { idField: "hepsiburadaId", pathField: "hepsiburadaPath" },
            { idField: "amazonId", pathField: "amazonPath" },
        ];

        for (const platform of platforms) {
            let bestScore = -1;
            let bestId = null;
            let bestPath = "";

            for (const doc of docs) {
                const id = doc[platform.idField];
                const pPath = doc[platform.pathField] || "";
                if (!id && !pPath) continue;

                const score = pathSimilarityScore(masterPath, pPath);
                if (score > bestScore) {
                    bestScore = score;
                    bestId = id;
                    bestPath = pPath;
                }
            }

            bestDoc[platform.idField] = bestId;
            bestDoc[platform.pathField] = bestPath;
        }

        // Tüm duplike satırları sil
        const allIds = docs.map(d => d._id);
        await collection.deleteMany({ _id: { $in: allIds } });
        deleted += allIds.length;

        // En iyi birleştirilmiş satırı ekle (HTML decode ile)
        delete bestDoc._id; // Yeni _id oluşsun
        bestDoc.masterName = decodeHtml(bestDoc.masterName || "");
        bestDoc.masterPath = decodeHtml(bestDoc.masterPath || "");
        bestDoc.trendyolPath = decodeHtml(bestDoc.trendyolPath || "");
        bestDoc.n11Path = decodeHtml(bestDoc.n11Path || "");
        bestDoc.ciceksepetiPath = decodeHtml(bestDoc.ciceksepetiPath || "");
        bestDoc.hepsiburadaPath = decodeHtml(bestDoc.hepsiburadaPath || "");
        bestDoc.amazonPath = decodeHtml(bestDoc.amazonPath || "");
        bestDoc.updatedAt = new Date();

        await collection.insertOne(bestDoc);
        kept++;
    }

    console.log(`\n🗑️  Silinen duplike satır: ${deleted}`);
    console.log(`✅ Birleştirilen (kalan): ${kept}\n`);

    // ── 3. Kalan tüm satırlarda HTML decode uygula ──
    console.log("🔄 Tüm satırlarda HTML entity decode uygulanıyor...");
    const allDocs = await collection.find({}).toArray();
    let htmlFixed = 0;

    for (const doc of allDocs) {
        const updates = {};
        let changed = false;

        const fields = ["masterName", "masterPath", "trendyolPath", "n11Path", "ciceksepetiPath", "hepsiburadaPath", "amazonPath"];
        for (const field of fields) {
            const original = doc[field] || "";
            const decoded = decodeHtml(original);
            if (decoded !== original) {
                updates[field] = decoded;
                changed = true;
            }
        }

        if (changed) {
            await collection.updateOne({ _id: doc._id }, { $set: updates });
            htmlFixed++;
        }
    }

    console.log(`   HTML decode düzeltilen satır: ${htmlFixed}\n`);

    // ── 4. Eski index'leri temizle, yeni oluştur ──
    console.log("🔄 Index'ler güncelleniyor...");
    try {
        await collection.dropIndexes();
        console.log("   Eski index'ler silindi");
    } catch (e) {
        console.log(`   Index silme: ${e.message}`);
    }

    try {
        await collection.createIndex({ masterId: 1 }, { unique: true });
        console.log("   ✅ masterId unique index oluşturuldu");
    } catch (e) {
        console.log(`   ⚠ masterId unique index hatası: ${e.message}`);
    }

    try {
        await collection.createIndex({
            masterName: "text", masterPath: "text", trendyolPath: "text",
            n11Path: "text", ciceksepetiPath: "text", hepsiburadaPath: "text", amazonPath: "text"
        });
        console.log("   ✅ Text search index oluşturuldu");
    } catch (e) {
        console.log(`   ⚠ Text index hatası: ${e.message}`);
    }

    // ── 5. Sonuç ──
    const totalAfter = await collection.countDocuments();
    const uniqueAfter = (await collection.distinct("masterId")).length;

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  📊 ÖNCE:  ${totalBefore} satır`);
    console.log(`  📊 SONRA: ${totalAfter} satır (${totalBefore - totalAfter} satır temizlendi)`);
    console.log(`  🏷️  Benzersiz master: ${uniqueAfter}`);
    console.log(`  🔤 HTML decode: ${htmlFixed} satır düzeltildi`);
    console.log("═══════════════════════════════════════════════════\n");

    await mongoose.disconnect();
    console.log("✅ Tamamlandı. MongoDB bağlantısı kapatıldı.");
    process.exit(0);
};

run().catch(err => {
    console.error("❌ Hata:", err.message);
    process.exit(1);
});
