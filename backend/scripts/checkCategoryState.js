/**
 * Kategori sisteminin mevcut durumunu kontrol et
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB bağlandı\n");

    const UnifiedCategoryMap = require("../models/UnifiedCategoryMap");
    const InternalCategory = require("../models/InternalCategory");
    const InternalCategoryMapping = require("../models/InternalCategoryMapping");
    const CategoryMapping = require("../models/CategoryMapping");
    const MarketplaceCategory = require("../models/MarketplaceCategory");

    // 1. UnifiedCategoryMap durumu
    const unifiedTotal = await UnifiedCategoryMap.countDocuments({});
    const unifiedExact = await UnifiedCategoryMap.countDocuments({ matchType: "exact" });
    const unified2of3 = await UnifiedCategoryMap.countDocuments({ matchType: "2of3" });
    const unifiedSingle = await UnifiedCategoryMap.countDocuments({ matchType: "single" });
    console.log("═══ UnifiedCategoryMap ═══");
    console.log(`  Toplam: ${unifiedTotal} | exact(3+): ${unifiedExact} | 2of3: ${unified2of3} | single: ${unifiedSingle}`);

    // "Biblo" araması
    const bibloUnified = await UnifiedCategoryMap.find({
        $or: [
            { canonicalName: { $regex: /biblo/i } },
            { normalizedKey: { $regex: /biblo/i } },
            { "trendyol.categoryName": { $regex: /biblo/i } },
            { "n11.categoryName": { $regex: /biblo/i } },
            { "ciceksepeti.categoryName": { $regex: /biblo/i } }
        ]
    }).lean();
    console.log(`\n  "Biblo" araması: ${bibloUnified.length} sonuç`);
    for (const b of bibloUnified) {
        console.log(`    → "${b.canonicalName}" (key: ${b.normalizedKey})`);
        console.log(`      TY: ${b.trendyol?.categoryName || "—"} (${b.trendyol?.categoryId || "—"})`);
        console.log(`      N11: ${b.n11?.categoryName || "—"} (${b.n11?.categoryId || "—"})`);
        console.log(`      ÇS: ${b.ciceksepeti?.categoryName || "—"} (${b.ciceksepeti?.categoryId || "—"})`);
        console.log(`      matchType: ${b.matchType}, platformCount: ${b.platformCount}`);
    }

    // "Obje" araması
    const objeUnified = await UnifiedCategoryMap.find({
        $or: [
            { canonicalName: { $regex: /obje/i } },
            { normalizedKey: { $regex: /obje/i } },
            { "trendyol.categoryName": { $regex: /obje/i } },
            { "ciceksepeti.categoryName": { $regex: /obje/i } }
        ]
    }).lean();
    console.log(`\n  "Obje" araması: ${objeUnified.length} sonuç`);
    for (const b of objeUnified) {
        console.log(`    → "${b.canonicalName}" (key: ${b.normalizedKey})`);
        console.log(`      TY: ${b.trendyol?.categoryName || "—"} (${b.trendyol?.categoryId || "—"})`);
        console.log(`      N11: ${b.n11?.categoryName || "—"} (${b.n11?.categoryId || "—"})`);
        console.log(`      ÇS: ${b.ciceksepeti?.categoryName || "—"} (${b.ciceksepeti?.categoryId || "—"})`);
    }

    // "Figür" araması
    const figurUnified = await UnifiedCategoryMap.find({
        $or: [
            { canonicalName: { $regex: /fig[uü]r/i } },
            { normalizedKey: { $regex: /figur/i } },
            { "ciceksepeti.categoryName": { $regex: /fig[uü]r/i } }
        ]
    }).lean();
    console.log(`\n  "Figür" araması: ${figurUnified.length} sonuç`);
    for (const b of figurUnified) {
        console.log(`    → "${b.canonicalName}" (key: ${b.normalizedKey})`);
        console.log(`      TY: ${b.trendyol?.categoryName || "—"} (${b.trendyol?.categoryId || "—"})`);
        console.log(`      N11: ${b.n11?.categoryName || "—"} (${b.n11?.categoryId || "—"})`);
        console.log(`      ÇS: ${b.ciceksepeti?.categoryName || "—"} (${b.ciceksepeti?.categoryId || "—"})`);
    }

    // 2. InternalCategory durumu
    const internalTotal = await InternalCategory.countDocuments({});
    const internalActive = await InternalCategory.countDocuments({ isActive: true });
    console.log("\n═══ InternalCategory ═══");
    console.log(`  Toplam: ${internalTotal} | Aktif: ${internalActive}`);

    const internalBiblo = await InternalCategory.find({
        $or: [
            { name: { $regex: /biblo/i } },
            { keywords: { $regex: /biblo/i } }
        ]
    }).lean();
    console.log(`  "Biblo" araması: ${internalBiblo.length} sonuç`);
    for (const ic of internalBiblo) {
        console.log(`    → "${ic.name}" (keywords: ${(ic.keywords || []).join(", ")})`);
    }

    // 3. InternalCategoryMapping durumu
    const icmTotal = await InternalCategoryMapping.countDocuments({});
    console.log("\n═══ InternalCategoryMapping ═══");
    console.log(`  Toplam: ${icmTotal}`);

    // 4. CategoryMapping durumu
    const cmTotal = await CategoryMapping.countDocuments({});
    console.log("\n═══ CategoryMapping ═══");
    console.log(`  Toplam: ${cmTotal}`);

    // 5. MarketplaceCategory durumu
    const mcTotal = await MarketplaceCategory.countDocuments({});
    const mcByPlatform = await MarketplaceCategory.aggregate([
        { $group: { _id: "$marketplaceName", count: { $sum: 1 } } }
    ]);
    console.log("\n═══ MarketplaceCategory ═══");
    console.log(`  Toplam: ${mcTotal}`);
    for (const p of mcByPlatform) {
        console.log(`    ${p._id}: ${p.count}`);
    }

    // 6. Dekoratif Obje ve Biblo — Trendyol'daki tam isim
    const dekoratifUnified = await UnifiedCategoryMap.find({
        $or: [
            { canonicalName: { $regex: /dekoratif/i } },
            { "trendyol.categoryName": { $regex: /dekoratif/i } }
        ]
    }).lean();
    console.log(`\n═══ "Dekoratif" araması: ${dekoratifUnified.length} sonuç ═══`);
    for (const b of dekoratifUnified.slice(0, 10)) {
        console.log(`  → "${b.canonicalName}"`);
        console.log(`    TY: ${b.trendyol?.categoryName || "—"} | N11: ${b.n11?.categoryName || "—"} | ÇS: ${b.ciceksepeti?.categoryName || "—"}`);
    }

    await mongoose.disconnect();
    console.log("\n✅ Bitti");
})();
