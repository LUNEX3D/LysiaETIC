/**
 * Birleşik Kategori Şablonunu Excel'e Aktar
 *
 * Kullanım:
 *   node backend/scripts/exportUnifiedTemplateToExcel.js
 *
 * Çıktı:
 *   C:\Users\emrul\Downloads\LysiaETIC_Birlesik_Kategori_Sablonu.xlsx
 */

const XLSX = require("xlsx");
const path = require("path");
const { UNIFIED_CATEGORY_TEMPLATE, flattenCategories } = require("../data/unifiedCategoryTemplate");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Kategori ağacını düzleştir ve yol bilgisi ekle
// ─────────────────────────────────────────────────────────────────────────────
const buildRows = (categories, parentPath = "", depth = 0, parentSlug = null) => {
    const rows = [];
    for (const cat of categories) {
        const currentPath = parentPath ? `${parentPath} > ${cat.name}` : cat.name;
        const isLeaf = !cat.children || cat.children.length === 0;
        const childCount = cat.children ? cat.children.length : 0;

        rows.push({
            "Slug": cat.slug,
            "Kategori Adı": cat.name,
            "Kategori Yolu": currentPath,
            "Derinlik": depth,
            "Üst Kategori Slug": parentSlug || "—",
            "Alt Kategori Sayısı": childCount,
            "Tür": isLeaf ? "Yaprak" : "Üst Kategori",
            "Keywords": (cat.keywords || []).join(", "),
            "İkon": cat.icon || ""
        });

        if (cat.children && cat.children.length > 0) {
            rows.push(...buildRows(cat.children, currentPath, depth + 1, cat.slug));
        }
    }
    return rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Platform eşleştirme haritasını satırlara dönüştür
// ─────────────────────────────────────────────────────────────────────────────
const buildMappingRows = () => {
    const rows = [];
    const mapping = UNIFIED_CATEGORY_TEMPLATE.platformRootMapping;

    for (const [slug, platforms] of Object.entries(mapping)) {
        rows.push({
            "Birleşik Kök Slug": slug,
            "Trendyol Eşleşmeleri": (platforms.trendyol || []).join(" | "),
            "N11 Eşleşmeleri": (platforms.n11 || []).join(" | "),
            "ÇiçekSepeti Eşleşmeleri": (platforms.ciceksepeti || []).join(" | ")
        });
    }
    return rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. İstatistik sayfası
// ─────────────────────────────────────────────────────────────────────────────
const buildStatsRows = (allRows) => {
    const total = allRows.length;
    const roots = allRows.filter(r => r["Derinlik"] === 0).length;
    const leaves = allRows.filter(r => r["Tür"] === "Yaprak").length;
    const parents = allRows.filter(r => r["Tür"] === "Üst Kategori").length;
    const maxDepth = Math.max(...allRows.map(r => r["Derinlik"]));

    const depthDist = {};
    for (let d = 0; d <= maxDepth; d++) {
        depthDist[d] = allRows.filter(r => r["Derinlik"] === d).length;
    }

    const stats = [
        { "Metrik": "Toplam Kategori", "Değer": total },
        { "Metrik": "Kök Kategori (Derinlik 0)", "Değer": roots },
        { "Metrik": "Yaprak Kategori", "Değer": leaves },
        { "Metrik": "Üst Kategori", "Değer": parents },
        { "Metrik": "Maksimum Derinlik", "Değer": maxDepth },
        { "Metrik": "---", "Değer": "---" },
        { "Metrik": "Derinlik 0 (Kök)", "Değer": depthDist[0] || 0 },
        { "Metrik": "Derinlik 1", "Değer": depthDist[1] || 0 },
        { "Metrik": "Derinlik 2", "Değer": depthDist[2] || 0 },
        { "Metrik": "Derinlik 3", "Değer": depthDist[3] || 0 },
        { "Metrik": "---", "Değer": "---" },
        { "Metrik": "Versiyon", "Değer": UNIFIED_CATEGORY_TEMPLATE.version },
        { "Metrik": "Oluşturulma Tarihi", "Değer": UNIFIED_CATEGORY_TEMPLATE.createdAt }
    ];

    return stats;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Excel oluştur ve kaydet
// ─────────────────────────────────────────────────────────────────────────────
const main = () => {
    console.log("📊 Birleşik Kategori Şablonu Excel'e aktarılıyor...\n");

    // Kategori satırları
    const categoryRows = buildRows(UNIFIED_CATEGORY_TEMPLATE.categories);
    console.log(`  ✅ ${categoryRows.length} kategori satırı oluşturuldu`);

    // Platform eşleştirme satırları
    const mappingRows = buildMappingRows();
    console.log(`  ✅ ${mappingRows.length} platform eşleştirme satırı oluşturuldu`);

    // İstatistik satırları
    const statsRows = buildStatsRows(categoryRows);
    console.log(`  ✅ İstatistikler hesaplandı`);

    // Workbook oluştur
    const wb = XLSX.utils.book_new();

    // ── Sayfa 1: Tüm Kategoriler ──
    const ws1 = XLSX.utils.json_to_sheet(categoryRows);

    // Sütun genişlikleri
    ws1["!cols"] = [
        { wch: 30 },  // Slug
        { wch: 35 },  // Kategori Adı
        { wch: 70 },  // Kategori Yolu
        { wch: 10 },  // Derinlik
        { wch: 25 },  // Üst Kategori Slug
        { wch: 18 },  // Alt Kategori Sayısı
        { wch: 15 },  // Tür
        { wch: 80 },  // Keywords
        { wch: 5 }    // İkon
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Tüm Kategoriler");

    // ── Sayfa 2: Sadece Yaprak Kategoriler ──
    const leafRows = categoryRows.filter(r => r["Tür"] === "Yaprak");
    const ws2 = XLSX.utils.json_to_sheet(leafRows);
    ws2["!cols"] = ws1["!cols"];
    XLSX.utils.book_append_sheet(wb, ws2, "Yaprak Kategoriler");

    // ── Sayfa 3: Sadece Kök Kategoriler ──
    const rootRows = categoryRows.filter(r => r["Derinlik"] === 0);
    const ws3 = XLSX.utils.json_to_sheet(rootRows);
    ws3["!cols"] = ws1["!cols"];
    XLSX.utils.book_append_sheet(wb, ws3, "Kök Kategoriler");

    // ── Sayfa 4: Platform Eşleştirme ──
    const ws4 = XLSX.utils.json_to_sheet(mappingRows);
    ws4["!cols"] = [
        { wch: 30 },  // Slug
        { wch: 70 },  // Trendyol
        { wch: 90 },  // N11
        { wch: 60 }   // ÇiçekSepeti
    ];
    XLSX.utils.book_append_sheet(wb, ws4, "Platform Eşleştirme");

    // ── Sayfa 5: İstatistikler ──
    const ws5 = XLSX.utils.json_to_sheet(statsRows);
    ws5["!cols"] = [
        { wch: 30 },
        { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws5, "İstatistikler");

    // Dosyayı kaydet
    const outputPath = path.join("C:\\Users\\emrul\\Downloads", "LysiaETIC_Birlesik_Kategori_Sablonu.xlsx");
    XLSX.writeFile(wb, outputPath);

    console.log(`\n🎉 Excel dosyası başarıyla oluşturuldu!`);
    console.log(`📁 Konum: ${outputPath}`);
    console.log(`\n📋 Sayfalar:`);
    console.log(`   1. Tüm Kategoriler      → ${categoryRows.length} satır`);
    console.log(`   2. Yaprak Kategoriler    → ${leafRows.length} satır`);
    console.log(`   3. Kök Kategoriler       → ${rootRows.length} satır`);
    console.log(`   4. Platform Eşleştirme   → ${mappingRows.length} satır`);
    console.log(`   5. İstatistikler         → Özet bilgiler`);
};

main();
