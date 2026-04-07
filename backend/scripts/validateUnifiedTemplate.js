/**
 * BİRLEŞİK KATEGORİ ŞABLONU DOĞRULAMA SCRİPTİ
 *
 * Bu script veritabanına bağlanmadan şablonu doğrular:
 *   - Slug benzersizliği
 *   - Boş isim/slug kontrolü
 *   - Keyword tutarlılığı
 *   - Derinlik kontrolü
 *   - Platform eşleştirme haritası kontrolü
 *   - İstatistik raporu
 *
 * Kullanım:
 *   node backend/scripts/validateUnifiedTemplate.js
 */

const { UNIFIED_CATEGORY_TEMPLATE, flattenCategories, countCategories, findBySlug } = require("../data/unifiedCategoryTemplate");

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  LysiaETIC — Birleşik Kategori Şablonu Doğrulama           ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

const errors = [];
const warnings = [];

// ─────────────────────────────────────────────────────────────────────────────
// 1. TEMEL İSTATİSTİKLER
// ─────────────────────────────────────────────────────────────────────────────

const flatList = flattenCategories();
const totalCount = countCategories();
const rootCount = UNIFIED_CATEGORY_TEMPLATE.categories.length;
const leafCount = flatList.filter(c => c.isLeaf).length;
const maxDepth = Math.max(...flatList.map(c => c.depth));

console.log("📊 Şablon İstatistikleri:");
console.log(`   Versiyon:         ${UNIFIED_CATEGORY_TEMPLATE.version}`);
console.log(`   Kök Kategori:     ${rootCount}`);
console.log(`   Toplam Kategori:  ${totalCount}`);
console.log(`   Yaprak Kategori:  ${leafCount}`);
console.log(`   Üst Kategori:     ${totalCount - leafCount}`);
console.log(`   Max Derinlik:     ${maxDepth}`);
console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// 2. SLUG BENZERSİZLİK KONTROLÜ
// ─────────────────────────────────────────────────────────────────────────────

console.log("🔍 Slug benzersizlik kontrolü...");
const slugMap = new Map();
for (const cat of flatList) {
    if (slugMap.has(cat.slug)) {
        errors.push(`DUPLICATE SLUG: "${cat.slug}" — "${cat.name}" ve "${slugMap.get(cat.slug)}"`);
    } else {
        slugMap.set(cat.slug, cat.name);
    }
}
console.log(`   ${slugMap.size} benzersiz slug kontrol edildi`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOŞ İSİM/SLUG KONTROLÜ
// ─────────────────────────────────────────────────────────────────────────────

console.log("🔍 Boş isim/slug kontrolü...");
for (const cat of flatList) {
    if (!cat.slug || cat.slug.trim() === "") {
        errors.push(`EMPTY SLUG: "${cat.name}" kategorisinin slug'ı boş`);
    }
    if (!cat.name || cat.name.trim() === "") {
        errors.push(`EMPTY NAME: slug="${cat.slug}" kategorisinin ismi boş`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. KEYWORD KONTROLÜ
// ─────────────────────────────────────────────────────────────────────────────

console.log("🔍 Keyword kontrolü...");
let noKeywordCount = 0;
for (const cat of flatList) {
    if (!cat.keywords || cat.keywords.length === 0) {
        noKeywordCount++;
        if (cat.isLeaf) {
            warnings.push(`NO KEYWORDS (yaprak): "${cat.name}" (${cat.slug}) — eşleştirme zorlaşır`);
        }
    }
}
console.log(`   ${noKeywordCount} kategori keyword'süz (${flatList.length - noKeywordCount} keyword'lü)`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. DERİNLİK KONTROLÜ
// ─────────────────────────────────────────────────────────────────────────────

console.log("🔍 Derinlik kontrolü...");
if (maxDepth > UNIFIED_CATEGORY_TEMPLATE.maxDepth) {
    errors.push(`MAX DEPTH EXCEEDED: Şablonda maxDepth=${UNIFIED_CATEGORY_TEMPLATE.maxDepth} ama gerçek max=${maxDepth}`);
}

// Derinlik dağılımı
const depthDist = {};
for (const cat of flatList) {
    depthDist[cat.depth] = (depthDist[cat.depth] || 0) + 1;
}
console.log("   Derinlik dağılımı:");
for (const [depth, count] of Object.entries(depthDist)) {
    const bar = "█".repeat(Math.min(count, 50));
    console.log(`     Seviye ${depth}: ${count.toString().padStart(4)} ${bar}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PLATFORM EŞLEŞTİRME HARİTASI KONTROLÜ
// ─────────────────────────────────────────────────────────────────────────────

console.log("🔍 Platform eşleştirme haritası kontrolü...");
const mapping = UNIFIED_CATEGORY_TEMPLATE.platformRootMapping;
const mappedSlugs = Object.keys(mapping);
const rootSlugs = UNIFIED_CATEGORY_TEMPLATE.categories.map(c => c.slug);

// Haritadaki slug'lar gerçekten kök kategori mi?
for (const slug of mappedSlugs) {
    if (!rootSlugs.includes(slug)) {
        errors.push(`MAPPING ORPHAN: "${slug}" platformRootMapping'de var ama kök kategorilerde yok`);
    }
}

// Kök kategorilerin hepsinin haritası var mı?
for (const slug of rootSlugs) {
    if (!mappedSlugs.includes(slug)) {
        warnings.push(`UNMAPPED ROOT: "${slug}" kök kategorisinin platformRootMapping'de karşılığı yok`);
    }
}

// Platform kapsam analizi
let trendyolMapped = 0, n11Mapped = 0, ciceksepetiMapped = 0;
for (const [slug, platforms] of Object.entries(mapping)) {
    if (platforms.trendyol && platforms.trendyol.length > 0) trendyolMapped++;
    if (platforms.n11 && platforms.n11.length > 0) n11Mapped++;
    if (platforms.ciceksepeti && platforms.ciceksepeti.length > 0) ciceksepetiMapped++;
}
console.log(`   Trendyol eşleşme:    ${trendyolMapped}/${mappedSlugs.length} kök kategori`);
console.log(`   N11 eşleşme:         ${n11Mapped}/${mappedSlugs.length} kök kategori`);
console.log(`   ÇiçekSepeti eşleşme: ${ciceksepetiMapped}/${mappedSlugs.length} kök kategori`);

// ─────────────────────────────────────────────────────────────────────────────
// 7. KÖK KATEGORİ DETAY
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n🌳 Kök Kategori Detayları:");
console.log("   ─────────────────────────────────────────────────────────");
for (const root of UNIFIED_CATEGORY_TEMPLATE.categories) {
    const children = root.children || [];
    let totalDescendants = 0;
    const countDesc = (cats) => {
        for (const c of cats) {
            totalDescendants++;
            if (c.children) countDesc(c.children);
        }
    };
    countDesc(children);

    const platforms = mapping[root.slug] || {};
    const pIcons = [
        (platforms.trendyol && platforms.trendyol.length > 0) ? "T" : "·",
        (platforms.n11 && platforms.n11.length > 0) ? "N" : "·",
        (platforms.ciceksepeti && platforms.ciceksepeti.length > 0) ? "Ç" : "·"
    ].join("");

    console.log(`   ${root.icon} ${root.name.padEnd(35)} Alt:${totalDescendants.toString().padStart(3)}  [${pIcons}]`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SONUÇ
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════════════");

if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} HATA BULUNDU:\n`);
    errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
}

if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} UYARI:\n`);
    warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
}

if (errors.length === 0) {
    console.log("\n✅ ŞABLON DOĞRULAMA BAŞARILI — Hata bulunamadı!");
    console.log("\n📌 Sonraki adım:");
    console.log("   node backend/scripts/importUnifiedTemplate.js --clear");
} else {
    console.log("\n❌ ŞABLON DOĞRULAMA BAŞARISIZ — Lütfen hataları düzeltin!");
    process.exit(1);
}

console.log("\n═══════════════════════════════════════════════════════════════\n");
