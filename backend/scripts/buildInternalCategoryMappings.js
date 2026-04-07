/**
 * DAHİLİ KATEGORİ → PLATFORM EŞLEŞTİRME OLUŞTURUCU
 *
 * InternalCategory tablosundaki her yaprak kategoriyi UnifiedCategoryMap'te arar,
 * bulunan platform ID'lerini InternalCategoryMapping tablosuna yazar.
 *
 * Eşleştirme Stratejisi (öncelik sırasıyla):
 *   1. Tam isim eşleşmesi (normalizedKey)
 *   2. Keyword eşleşmesi (InternalCategory.keywords → UnifiedCategoryMap.normalizedKey)
 *   3. Kelime bazlı skorlama (birden fazla kelime eşleşmesi)
 *
 * Kullanım:
 *   node backend/scripts/buildInternalCategoryMappings.js
 *   node backend/scripts/buildInternalCategoryMappings.js --clear   (önce mevcut mappingleri sil)
 *
 * Sonuç:
 *   InternalCategoryMapping tablosunda her dahili kategori için
 *   Trendyol, N11, ÇiçekSepeti platform eşleştirmeleri oluşur.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const InternalCategory        = require("../models/InternalCategory");
const InternalCategoryMapping = require("../models/InternalCategoryMapping");
const UnifiedCategoryMap      = require("../models/UnifiedCategoryMap");
const { normalizeKey }        = require("../utils/textNormalize");

const CLEAR_FLAG = process.argv.includes("--clear");
const MONGO_URI  = process.env.MONGODB_URI || process.env.MONGO_URI;

// Platform listesi
const PLATFORMS = [
    { key: "trendyol",    name: "Trendyol" },
    { key: "n11",         name: "N11" },
    { key: "ciceksepeti", name: "ÇiçekSepeti" }
];

// ─────────────────────────────────────────────────────────────────────────────
// EŞLEŞTİRME MOTORU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir InternalCategory için UnifiedCategoryMap'te en iyi eşleşmeyi bul.
 *
 * @param {Object} ic - InternalCategory dokümanı
 * @param {Array} allUCM - Tüm UnifiedCategoryMap kayıtları (cache)
 * @returns {{ ucm: Object|null, matchType: string, score: number }}
 */
function findBestMatch(ic, allUCM) {
    const icName = normalizeKey(ic.name || "");
    const icKeywords = (ic.keywords || []).map(k => normalizeKey(k)).filter(Boolean);

    if (!icName && icKeywords.length === 0) {
        return { ucm: null, matchType: "none", score: 0 };
    }

    // ── 1. Tam isim eşleşmesi ────────────────────────────────────────────────
    for (const u of allUCM) {
        if (u.normalizedKey === icName) {
            return { ucm: u, matchType: "exact_name", score: 1.0 };
        }
    }

    // ── 2. Keyword tam eşleşmesi ─────────────────────────────────────────────
    // InternalCategory'nin keyword'lerinden biri UnifiedCategoryMap'in normalizedKey'ine eşit mi?
    for (const kw of icKeywords) {
        for (const u of allUCM) {
            if (u.normalizedKey === kw) {
                return { ucm: u, matchType: "keyword_exact", score: 0.95 };
            }
        }
    }

    // ── 3. İsim içerme eşleşmesi ─────────────────────────────────────────────
    // "Akıllı Cep Telefonu" → "Cep Telefonu" içeriyor
    let bestContains = null;
    let bestContainsScore = 0;

    for (const u of allUCM) {
        const uKey = u.normalizedKey;
        if (!uKey) continue;

        // IC ismi UCM key'ini içeriyor veya tam tersi
        if (icName.includes(uKey) && uKey.length >= 3) {
            const score = 0.85 * (uKey.length / Math.max(icName.length, 1));
            if (score > bestContainsScore) {
                bestContainsScore = score;
                bestContains = u;
            }
        } else if (uKey.includes(icName) && icName.length >= 3) {
            const score = 0.80 * (icName.length / Math.max(uKey.length, 1));
            if (score > bestContainsScore) {
                bestContainsScore = score;
                bestContains = u;
            }
        }
    }

    if (bestContains && bestContainsScore >= 0.4) {
        return { ucm: bestContains, matchType: "name_contains", score: bestContainsScore };
    }

    // ── 4. Keyword içerme eşleşmesi ──────────────────────────────────────────
    let bestKwContains = null;
    let bestKwScore = 0;

    for (const kw of icKeywords) {
        if (kw.length < 3) continue;

        for (const u of allUCM) {
            const uKey = u.normalizedKey;
            if (!uKey) continue;

            if (uKey.includes(kw)) {
                const score = 0.75 * (kw.length / Math.max(uKey.length, 1));
                if (score > bestKwScore) {
                    bestKwScore = score;
                    bestKwContains = u;
                }
            } else if (kw.includes(uKey) && uKey.length >= 3) {
                const score = 0.70 * (uKey.length / Math.max(kw.length, 1));
                if (score > bestKwScore) {
                    bestKwScore = score;
                    bestKwContains = u;
                }
            }
        }
    }

    if (bestKwContains && bestKwScore >= 0.35) {
        return { ucm: bestKwContains, matchType: "keyword_contains", score: bestKwScore };
    }

    // ── 5. Kelime bazlı skorlama ─────────────────────────────────────────────
    const icWords = icName.split(/\s+/).filter(w => w.length >= 2);
    if (icWords.length === 0) {
        return { ucm: null, matchType: "none", score: 0 };
    }

    let bestWordMatch = null;
    let bestWordScore = 0;

    for (const u of allUCM) {
        const uWords = (u.normalizedKey || "").split(/\s+/).filter(w => w.length >= 2);
        if (uWords.length === 0) continue;

        let matchCount = 0;
        for (const iw of icWords) {
            if (uWords.some(uw => uw === iw || (uw.length > 3 && iw.length > 3 && (uw.includes(iw) || iw.includes(uw))))) {
                matchCount++;
            }
        }

        if (matchCount === 0) continue;

        const inputCoverage = matchCount / icWords.length;
        const candCoverage = matchCount / uWords.length;
        const score = (inputCoverage + candCoverage) / 2 * 0.7;

        if (score > bestWordScore) {
            bestWordScore = score;
            bestWordMatch = u;
        }
    }

    if (bestWordMatch && bestWordScore >= 0.25) {
        return { ucm: bestWordMatch, matchType: "word_score", score: bestWordScore };
    }

    return { ucm: null, matchType: "none", score: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANA FONKSİYON
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  LysiaETIC — InternalCategoryMapping Otomatik Oluşturucu   ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // MongoDB bağlantısı
    console.log("🔗 MongoDB'ye bağlanılıyor...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Bağlantı başarılı\n");

    // Mevcut durumu kontrol et
    const icCount  = await InternalCategory.countDocuments({});
    const ucmCount = await UnifiedCategoryMap.countDocuments({});
    const icmCount = await InternalCategoryMapping.countDocuments({});

    console.log("📊 Mevcut Durum:");
    console.log(`   InternalCategory:        ${icCount}`);
    console.log(`   UnifiedCategoryMap:       ${ucmCount}`);
    console.log(`   InternalCategoryMapping:  ${icmCount}`);
    console.log("");

    if (ucmCount === 0) {
        console.error("❌ UnifiedCategoryMap boş! Önce platform verilerini import edin.");
        console.error("   node backend/scripts/importIdBasedMapping.js");
        await mongoose.disconnect();
        process.exit(1);
    }

    // Temizle (opsiyonel)
    if (CLEAR_FLAG) {
        console.log("🗑️  --clear: Mevcut InternalCategoryMapping verileri siliniyor...");
        const deleted = await InternalCategoryMapping.deleteMany({});
        console.log(`   ✅ ${deleted.deletedCount} kayıt silindi\n`);
    }

    // Tüm verileri yükle
    console.log("📥 Veriler yükleniyor...");
    const allIC  = await InternalCategory.find({ isActive: true }).lean();
    const allUCM = await UnifiedCategoryMap.find({}).lean();
    console.log(`   ${allIC.length} dahili kategori, ${allUCM.length} unified map yüklendi\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // EŞLEŞTİRME
    // ─────────────────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🔄 EŞLEŞTİRME BAŞLIYOR...");
    console.log("═══════════════════════════════════════════════════════════════\n");

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalNoMatch = 0;
    let errorCount   = 0;

    const platformStats = {};
    for (const p of PLATFORMS) {
        platformStats[p.name] = { created: 0, updated: 0, noId: 0 };
    }

    const matchTypeStats = {};
    const unmatchedCategories = [];

    for (const ic of allIC) {
        // En iyi UCM eşleşmesini bul
        const { ucm, matchType, score } = findBestMatch(ic, allUCM);

        if (!ucm) {
            totalNoMatch++;
            unmatchedCategories.push(ic.name);
            continue;
        }

        // matchType istatistiği
        matchTypeStats[matchType] = (matchTypeStats[matchType] || 0) + 1;

        // Her platform için mapping oluştur
        for (const platform of PLATFORMS) {
            const platformData = ucm[platform.key];

            if (!platformData || !platformData.categoryId) {
                platformStats[platform.name].noId++;
                continue;
            }

            try {
                const result = await InternalCategoryMapping.findOneAndUpdate(
                    {
                        internalCategoryId: ic._id,
                        marketplace: platform.name
                    },
                    {
                        $set: {
                            marketplaceCategoryId:   platformData.categoryId,
                            marketplaceCategoryName: platformData.categoryName || ucm.canonicalName,
                            marketplaceCategoryPath: platformData.categoryPath || "",
                            confidenceScore:         parseFloat(score.toFixed(2)),
                            matchSource:             "bulk_auto",
                            isManualOverride:        false,
                            isActive:                true
                        }
                    },
                    { upsert: true, new: true }
                );

                // Yeni mi güncelleme mi?
                const isNew = result.createdAt && result.updatedAt &&
                    Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;

                if (isNew) {
                    totalCreated++;
                    platformStats[platform.name].created++;
                } else {
                    totalUpdated++;
                    platformStats[platform.name].updated++;
                }
            } catch (err) {
                errorCount++;
                if (errorCount <= 5) {
                    console.error(`  ❌ ${ic.name} → ${platform.name}: ${err.message}`);
                }
            }
        }

        totalSkipped++;

        // İlerleme göster
        if (totalSkipped % 50 === 0) {
            process.stdout.write(`\r   İşlenen: ${totalSkipped}/${allIC.length} | Oluşturulan: ${totalCreated} | Eşleşmeyen: ${totalNoMatch}`);
        }
    }

    console.log(`\r   İşlenen: ${allIC.length}/${allIC.length} | Oluşturulan: ${totalCreated} | Eşleşmeyen: ${totalNoMatch}   `);

    // ─────────────────────────────────────────────────────────────────────────
    // SONUÇ RAPORU
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("📊 SONUÇ RAPORU");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log("   Genel:");
    console.log(`     Toplam dahili kategori:    ${allIC.length}`);
    console.log(`     Eşleşen kategori:          ${totalSkipped}`);
    console.log(`     Eşleşmeyen kategori:       ${totalNoMatch}`);
    console.log(`     Eşleşme oranı:             %${((totalSkipped / allIC.length) * 100).toFixed(1)}`);
    console.log(`     Oluşturulan mapping:        ${totalCreated}`);
    console.log(`     Güncellenen mapping:        ${totalUpdated}`);
    console.log(`     Hatalar:                    ${errorCount}`);
    console.log("");

    console.log("   Platform Dağılımı:");
    for (const p of PLATFORMS) {
        const s = platformStats[p.name];
        console.log(`     ${p.name.padEnd(15)} → Yeni: ${s.created}, Güncellenen: ${s.updated}, ID yok: ${s.noId}`);
    }
    console.log("");

    console.log("   Eşleşme Tipi Dağılımı:");
    for (const [type, count] of Object.entries(matchTypeStats).sort((a, b) => b[1] - a[1])) {
        console.log(`     ${type.padEnd(20)} → ${count}`);
    }
    console.log("");

    // DB doğrulama
    const finalICM = await InternalCategoryMapping.countDocuments({});
    const tyMappings  = await InternalCategoryMapping.countDocuments({ marketplace: "Trendyol" });
    const n11Mappings = await InternalCategoryMapping.countDocuments({ marketplace: "N11" });
    const csMappings  = await InternalCategoryMapping.countDocuments({ marketplace: "ÇiçekSepeti" });

    console.log("   DB Doğrulama:");
    console.log(`     Toplam InternalCategoryMapping: ${finalICM}`);
    console.log(`     Trendyol:    ${tyMappings}`);
    console.log(`     N11:         ${n11Mappings}`);
    console.log(`     ÇiçekSepeti: ${csMappings}`);
    console.log("");

    // Eşleşmeyen kategorileri göster
    if (unmatchedCategories.length > 0) {
        console.log("   ⚠️  Eşleşmeyen Kategoriler:");
        for (const name of unmatchedCategories.slice(0, 30)) {
            console.log(`     - ${name}`);
        }
        if (unmatchedCategories.length > 30) {
            console.log(`     ... ve ${unmatchedCategories.length - 30} tane daha`);
        }
        console.log("");
    }

    // Örnek eşleştirmeler göster
    console.log("   ✅ Örnek Eşleştirmeler:");
    const sampleMappings = await InternalCategoryMapping.find({})
        .limit(10)
        .populate("internalCategoryId", "name slug icon")
        .lean();

    for (const m of sampleMappings) {
        const icon = m.internalCategoryId?.icon || "📁";
        const name = m.internalCategoryId?.name || "?";
        console.log(`     ${icon} ${name} → ${m.marketplace}: ${m.marketplaceCategoryName} (ID:${m.marketplaceCategoryId}, güven:${m.confidenceScore})`);
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("✅ EŞLEŞTİRME TAMAMLANDI!");
    console.log("═══════════════════════════════════════════════════════════════\n");

    await mongoose.disconnect();
    console.log("🔌 MongoDB bağlantısı kapatıldı");
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Script hatası:", err.message);
    console.error(err.stack);
    process.exit(1);
});
