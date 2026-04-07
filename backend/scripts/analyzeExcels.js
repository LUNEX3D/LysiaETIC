/**
 * 3 platformun Excel dosyalarını analiz et
 */
const XLSX = require("xlsx");
const path = require("path");

const files = [
    { name: "Trendyol", path: "C:\\Users\\emrul\\Downloads\\pazaryeri_kategorileri_Trendyol_2026-04-05.xlsx" },
    { name: "N11",      path: "C:\\Users\\emrul\\Downloads\\pazaryeri_kategorileri_N11_2026-04-05.xlsx" },
    { name: "ÇiçekSepeti", path: "C:\\Users\\emrul\\Downloads\\pazaryeri_kategorileri_ÇiçekSepeti_2026-04-05.xlsx" },
];

for (const f of files) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`  ${f.name}`);
    console.log(`${"═".repeat(70)}`);

    try {
        const wb = XLSX.readFile(f.path);
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Header
        const headers = rows[0] || [];
        console.log(`\nSheet: "${sheetName}"`);
        console.log(`Toplam satır: ${rows.length - 1} (header hariç)`);
        console.log(`Sütunlar (${headers.length}):`);
        headers.forEach((h, i) => console.log(`  [${i}] ${h}`));

        // İlk 5 veri satırı
        console.log(`\nİlk 5 satır:`);
        for (let i = 1; i <= Math.min(5, rows.length - 1); i++) {
            const row = rows[i];
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = row[idx]; });
            console.log(`  ${i}. ${JSON.stringify(obj)}`);
        }

        // Veri analizi
        const dataRows = rows.slice(1).filter(r => r[1]); // categoryName olan satırlar

        // Derinlik dağılımı
        const depthMap = {};
        let leafCount = 0;
        let parentCount = 0;
        let maxDepth = 0;
        const rootCategories = new Set();

        for (const r of dataRows) {
            const depth = Number(r[3]) || 0;
            depthMap[depth] = (depthMap[depth] || 0) + 1;
            if (depth > maxDepth) maxDepth = depth;

            const type = String(r[7] || "");
            if (type.includes("Yaprak")) leafCount++;
            else parentCount++;

            // Root kategori (path'in ilk parçası)
            const catPath = String(r[2] || "");
            const root = catPath.split(" > ")[0].trim();
            if (root) rootCategories.add(root);
        }

        console.log(`\nİstatistikler:`);
        console.log(`  Toplam kategori: ${dataRows.length}`);
        console.log(`  Yaprak (leaf): ${leafCount}`);
        console.log(`  Parent (dal): ${parentCount}`);
        console.log(`  Max derinlik: ${maxDepth}`);
        console.log(`  Kök kategori sayısı: ${rootCategories.size}`);

        console.log(`\nDerinlik dağılımı:`);
        for (const [d, count] of Object.entries(depthMap).sort((a, b) => a[0] - b[0])) {
            const bar = "█".repeat(Math.min(Math.round(count / 50), 50));
            console.log(`  Derinlik ${d}: ${count} ${bar}`);
        }

        console.log(`\nKök kategoriler (${rootCategories.size}):`);
        // Root kategorileri ve altındaki sayıları
        const rootCounts = {};
        for (const r of dataRows) {
            const catPath = String(r[2] || "");
            const root = catPath.split(" > ")[0].trim();
            if (root) rootCounts[root] = (rootCounts[root] || 0) + 1;
        }
        const sortedRoots = Object.entries(rootCounts).sort((a, b) => b[1] - a[1]);
        for (const [root, count] of sortedRoots) {
            console.log(`  ${root}: ${count} kategori`);
        }

        // Son 3 satır (en derin kategoriler)
        console.log(`\nEn derin kategoriler (örnek):`);
        const deepest = dataRows.filter(r => Number(r[3]) === maxDepth).slice(0, 5);
        for (const r of deepest) {
            console.log(`  [depth=${r[3]}] ${r[1]} | Path: ${r[2]}`);
        }

    } catch (err) {
        console.error(`  HATA: ${err.message}`);
    }
}
