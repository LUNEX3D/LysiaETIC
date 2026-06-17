/**
 * Master Kategori Eşleştirme Excel Import — LysiaETIC
 *
 * ✅ v2 — Akıllı Import
 *
 * Düzeltmeler:
 *   1. DUPLIKE ÖNLEME: Aynı masterId için birden fazla satır varsa
 *      en iyi eşleşmeyi seçer (path benzerliği ile).
 *   2. HTML DECODE: &gt; &amp; gibi entity'ler temizlenir.
 *   3. UPSERT: Mevcut kayıtları günceller, yenilerini ekler.
 *   4. PATH BENZERLİĞİ: N11/ÇiçekSepeti eşleşmelerinde sadece isim değil,
 *      üst kategori yolu da karşılaştırılır.
 *
 * Kullanım:
 *   node backend/scripts/importMasterCategoryMappings.js
 *   node backend/scripts/importMasterCategoryMappings.js --file "C:\path\to\file.xlsx"
 *   node backend/scripts/importMasterCategoryMappings.js --drop   (önce koleksiyonu temizle)
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local"), override: true });
// Bazı ağlarda MongoDB SRV (DNS) çözümlemesi başarısız olabiliyor — güvenilir DNS sunucuları ata
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");

const MasterCategoryMapping = require("../models/MasterCategoryMapping");

// ── Argümanları parse et ──
const args = process.argv.slice(2);
const fileArgIdx = args.indexOf("--file");
const shouldDrop = args.includes("--drop");

const DEFAULT_FILE = path.join("C:\\Users\\emrul\\Downloads", "master_kategori_eslestirme.xlsx");
const filePath = fileArgIdx !== -1 && args[fileArgIdx + 1] ? args[fileArgIdx + 1] : DEFAULT_FILE;

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: HTML Entity Decode
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Path Benzerlik Skoru
// ═══════════════════════════════════════════════════════════════
/**
 * İki kategori yolunun benzerlik skorunu hesapla.
 * Yüksek skor = daha iyi eşleşme.
 *
 * Örnek:
 *   masterPath: "Moda > Aksesuar"
 *   candidate1: "Giyim > Aksesuar"           → skor: 1 (sadece son kelime eşleşiyor)
 *   candidate2: "Moda > Aksesuar"             → skor: 3 (tam eşleşme)
 *   candidate3: "Motosiklet > Aksesuar"       → skor: 1 (sadece son kelime)
 *
 * Strateji:
 *   - Son segment eşleşmesi: +1
 *   - Her eşleşen üst segment: +1
 *   - Segment sayısı benzerliği: +0.5
 *   - Tam path eşleşmesi: +2 bonus
 */
const pathSimilarityScore = (masterPath, candidatePath) => {
    if (!masterPath || !candidatePath) return 0;

    const normalize = (p) => decodeHtml(p).toLowerCase()
        .replace(/\s*>\s*/g, ">")
        .replace(/\s+/g, " ")
        .trim();

    const mp = normalize(masterPath);
    const cp = normalize(candidatePath);

    if (mp === cp) return 100; // Tam eşleşme

    const mParts = mp.split(">");
    const cParts = cp.split(">");

    let score = 0;

    // Son segment eşleşmesi (en önemli)
    const mLast = mParts[mParts.length - 1]?.trim();
    const cLast = cParts[cParts.length - 1]?.trim();
    if (mLast === cLast) score += 2;
    else if (mLast && cLast && (mLast.includes(cLast) || cLast.includes(mLast))) score += 1;
    else return 0; // Son segment bile eşleşmiyorsa bu eşleşme kötü

    // Üst segmentleri karşılaştır (sondan başa)
    const minLen = Math.min(mParts.length, cParts.length);
    for (let i = 2; i <= minLen; i++) {
        const mSeg = mParts[mParts.length - i]?.trim();
        const cSeg = cParts[cParts.length - i]?.trim();
        if (mSeg === cSeg) score += 2;
        else if (mSeg && cSeg && (mSeg.includes(cSeg) || cSeg.includes(mSeg))) score += 0.5;
    }

    // Segment sayısı benzerliği (aynı derinlik = daha iyi)
    const depthDiff = Math.abs(mParts.length - cParts.length);
    if (depthDiff === 0) score += 1;
    else if (depthDiff === 1) score += 0.5;

    return score;
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Duplike Satırları Birleştir
// ═══════════════════════════════════════════════════════════════
/**
 * Aynı masterId için birden fazla satır varsa:
 * - Her platform için en iyi eşleşmeyi seç (path benzerliği ile)
 * - Tek bir satıra birleştir
 *
 * @param {Array} rows - Excel'den okunan ham satırlar
 * @returns {Array} Birleştirilmiş satırlar (her masterId için 1 satır)
 */
const mergeduplicateRows = (rows) => {
    // masterId bazında grupla
    const groups = new Map();

    for (const row of rows) {
        const masterId = row.master_id;
        if (!masterId) continue;

        if (!groups.has(masterId)) {
            groups.set(masterId, []);
        }
        groups.get(masterId).push(row);
    }

    const merged = [];
    let totalDuplicates = 0;

    for (const [masterId, groupRows] of groups) {
        if (groupRows.length === 1) {
            // Tek satır — olduğu gibi ekle
            merged.push(groupRows[0]);
            continue;
        }

        totalDuplicates += groupRows.length - 1;

        // Birden fazla satır — en iyi eşleşmeleri seç
        const masterPath = decodeHtml(groupRows[0].master_path || "");
        const base = {
            master_id: masterId,
            master_name: groupRows[0].master_name,
            master_path: groupRows[0].master_path,
            trendyol_id: groupRows[0].trendyol_id,
            trendyol_path: groupRows[0].trendyol_path,
        };

        // Her platform için en iyi eşleşmeyi bul
        const platforms = [
            { idField: "n11_id", pathField: "n11_path" },
            { idField: "ciceksepeti_id", pathField: "ciceksepeti_path" },
            { idField: "hepsiburada_id", pathField: "hepsiburada_path" },
            { idField: "amazon_id", pathField: "amazon_path" },
        ];

        for (const platform of platforms) {
            let bestScore = -1;
            let bestId = null;
            let bestPath = "";

            for (const row of groupRows) {
                const id = row[platform.idField];
                const pPath = row[platform.pathField] || "";

                if (!id && !pPath) continue;

                const score = pathSimilarityScore(masterPath, pPath);
                if (score > bestScore) {
                    bestScore = score;
                    bestId = id;
                    bestPath = pPath;
                }
            }

            base[platform.idField] = bestId;
            base[platform.pathField] = bestPath;
        }

        merged.push(base);
    }

    return { merged, totalDuplicates };
};

// ═══════════════════════════════════════════════════════════════
// 🚀 ANA IMPORT FONKSİYONU
// ═══════════════════════════════════════════════════════════════
const run = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGO_URI bulunamadı. .env dosyasını kontrol edin.");
        process.exit(1);
    }

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  Master Kategori Eşleştirme — Excel → MongoDB Import v2     ║");
    console.log("║  ✅ Duplike birleştirme + HTML decode + Path benzerliği      ║");
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
    const rawRows = XLSX.utils.sheet_to_json(ws);
    console.log(`📊 ${rawRows.length} ham satır okundu (Sheet: "${wb.SheetNames[0]}")\n`);

    if (rawRows.length === 0) {
        console.error("❌ Excel dosyası boş!");
        process.exit(1);
    }

    // ── 2. Duplike satırları birleştir ──
    console.log("🔄 Duplike satırlar birleştiriliyor (path benzerliği ile)...");
    const { merged, totalDuplicates } = mergeduplicateRows(rawRows);
    console.log(`   Ham satır:     ${rawRows.length}`);
    console.log(`   Birleştirildi: ${merged.length} benzersiz master kategori`);
    console.log(`   Elenen duplike: ${totalDuplicates}\n`);

    // ── 3. MongoDB'ye bağlan ──
    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı kuruldu\n");

    // ── 4. Opsiyonel: Koleksiyonu temizle ──
    if (shouldDrop) {
        // ⚠️ Manuel (elle düzenlenmiş) satırlar ASLA silinmez — yalnızca Excel kaynaklı kayıtlar temizlenir
        const manualCount = await MasterCategoryMapping.countDocuments({ manual: true });
        const delRes = await MasterCategoryMapping.deleteMany({ manual: { $ne: true } });
        console.log(`🗑️  ${delRes.deletedCount} Excel kaynaklı kayıt silindi (--drop)`);
        console.log(`🛡️  ${manualCount} manuel kayıt korundu\n`);

        // Eski unique index'i de temizle (schema değişti)
        try {
            await mongoose.connection.db.collection("mastercategorymappings").dropIndexes();
            console.log("🗑️  Eski index'ler temizlendi\n");
        } catch (e) {
            // Index yoksa hata vermez
        }
    }

    // ── 5. Satırları dönüştür ve upsert et ──
    let upserted = 0;
    let updated = 0;
    let manualPreserved = 0;
    let errors = 0;

    const PLATFORM_PAIRS = [
        ["trendyolId", "trendyolPath"],
        ["n11Id", "n11Path"],
        ["ciceksepetiId", "ciceksepetiPath"],
        ["hepsiburadaId", "hepsiburadaPath"],
        ["amazonId", "amazonPath"],
    ];

    for (let i = 0; i < merged.length; i++) {
        const row = merged[i];
        try {
            const incoming = {
                masterName: decodeHtml(row.master_name || ""),
                masterPath: decodeHtml(row.master_path || ""),
                trendyolId: row.trendyol_id || null,
                trendyolPath: decodeHtml(row.trendyol_path || ""),
                n11Id: row.n11_id || null,
                n11Path: decodeHtml(row.n11_path || ""),
                ciceksepetiId: row.ciceksepeti_id || null,
                ciceksepetiPath: decodeHtml(row.ciceksepeti_path || ""),
                hepsiburadaId: row.hepsiburada_id || null,
                hepsiburadaPath: decodeHtml(row.hepsiburada_path || ""),
                amazonId: row.amazon_id || null,
                amazonPath: decodeHtml(row.amazon_path || "")
            };

            const existing = await MasterCategoryMapping
                .findOne({ masterId: row.master_id })
                .lean();

            if (existing && existing.manual) {
                // 🛡️ Manuel satır — dolu platform eşleşmelerini KORU, yalnızca boş alanları Excel'den doldur
                const preserved = {
                    masterName: incoming.masterName,
                    masterPath: incoming.masterPath,
                };
                for (const [idK, pathK] of PLATFORM_PAIRS) {
                    const hasExisting =
                        existing[idK] != null && String(existing[idK]).trim() !== "";
                    if (hasExisting) {
                        preserved[idK] = existing[idK];
                        preserved[pathK] = existing[pathK];
                    } else {
                        preserved[idK] = incoming[idK];
                        preserved[pathK] = incoming[pathK];
                    }
                }
                // manual / source alanlarına DOKUNMA
                await MasterCategoryMapping.updateOne(
                    { masterId: row.master_id },
                    { $set: preserved }
                );
                manualPreserved++;
                updated++;
            } else {
                const result = await MasterCategoryMapping.findOneAndUpdate(
                    { masterId: row.master_id },
                    {
                        $set: { ...incoming, source: "excel" },
                        $setOnInsert: { masterId: row.master_id, manual: false }
                    },
                    { upsert: true, new: true, rawResult: true }
                );

                if (result.lastErrorObject?.updatedExisting) {
                    updated++;
                } else {
                    upserted++;
                }
            }
        } catch (err) {
            errors++;
            if (errors <= 5) {
                console.error(`  ⚠ Satır ${i + 1} hatası (masterId: ${row.master_id}): ${err.message}`);
            }
        }

        // İlerleme göster (her 100 satırda bir)
        if ((i + 1) % 100 === 0 || i === merged.length - 1) {
            const pct = (((i + 1) / merged.length) * 100).toFixed(1);
            process.stdout.write(`\r  📥 İlerleme: ${i + 1}/${merged.length} (${pct}%)`);
        }
    }

    console.log("\n");

    // ── 6. Sonuç ──
    const totalInDb = await MasterCategoryMapping.countDocuments();
    const uniqueMasters = await MasterCategoryMapping.distinct("masterId");
    const withN11 = await MasterCategoryMapping.countDocuments({ n11Id: { $ne: null } });
    const withCS = await MasterCategoryMapping.countDocuments({ ciceksepetiId: { $ne: null } });
    const withHB = await MasterCategoryMapping.countDocuments({ hepsiburadaId: { $ne: null } });

    console.log("═══════════════════════════════════════════════════");
    console.log(`  ✅ Yeni eklenen:  ${upserted}`);
    console.log(`  🔄 Güncellenen:   ${updated}`);
    console.log(`  🛡️  Korunan manuel: ${manualPreserved}`);
    console.log(`  ❌ Hata:          ${errors}`);
    console.log(`  🗑️  Elenen duplike: ${totalDuplicates}`);
    console.log("═══════════════════════════════════════════════════");
    console.log(`  📊 DB'deki toplam kayıt:      ${totalInDb}`);
    console.log(`  🏷️  Benzersiz master kategori:  ${uniqueMasters.length}`);
    console.log(`  🟣 N11 eşleşmesi olan:         ${withN11}`);
    console.log(`  🌸 ÇiçekSepeti eşleşmesi olan: ${withCS}`);
    console.log(`  🟧 Hepsiburada eşleşmesi olan: ${withHB}`);
    console.log("═══════════════════════════════════════════════════\n");

    await mongoose.disconnect();
    console.log("✅ Tamamlandı. MongoDB bağlantısı kapatıldı.");
    process.exit(0);
};

run().catch(err => {
    console.error("❌ Hata:", err.message);
    process.exit(1);
});
