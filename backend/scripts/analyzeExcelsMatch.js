/**
 * 3 platformun Excel'leri arasındaki eşleşme oranlarını analiz et
 */
const XLSX = require("xlsx");
const { normalizeKey } = require("../utils/textNormalize");

const files = [
    { name: "Trendyol",    path: "C:\\Users\\emrul\\Downloads\\pazaryeri_kategorileri_Trendyol_2026-04-05.xlsx" },
    { name: "N11",          path: "C:\\Users\\emrul\\Downloads\\pazaryeri_kategorileri_N11_2026-04-05.xlsx" },
    { name: "ÇiçekSepeti",  path: "C:\\Users\\emrul\\Downloads\\pazaryeri_kategorileri_ÇiçekSepeti_2026-04-05.xlsx" },
];

const platformMaps = {};

for (const f of files) {
    const wb = XLSX.readFile(f.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

    const map = new Map();
    let leafCount = 0;
    for (const r of rows) {
        const name = String(r[1] || "").trim();
        if (!name) continue;
        const key = normalizeKey(name);
        if (key && !map.has(key)) {
            map.set(key, {
                name,
                id: String(r[0] || ""),
                isLeaf: String(r[7] || "").includes("Yaprak")
            });
            if (String(r[7] || "").includes("Yaprak")) leafCount++;
        }
    }
    platformMaps[f.name] = map;
    console.log(`${f.name}: ${map.size} unique key (${leafCount} leaf)`);
}

const tKeys = new Set(platformMaps["Trendyol"].keys());
const nKeys = new Set(platformMaps["N11"].keys());
const cKeys = new Set(platformMaps["ÇiçekSepeti"].keys());

// Eşleşme analizi
const all3 = [...tKeys].filter(k => nKeys.has(k) && cKeys.has(k));
const tAndN = [...tKeys].filter(k => nKeys.has(k) && !cKeys.has(k));
const tAndC = [...tKeys].filter(k => !nKeys.has(k) && cKeys.has(k));
const nAndC = [...nKeys].filter(k => !tKeys.has(k) && cKeys.has(k));
const onlyT = [...tKeys].filter(k => !nKeys.has(k) && !cKeys.has(k));
const onlyN = [...nKeys].filter(k => !tKeys.has(k) && !cKeys.has(k));
const onlyC = [...cKeys].filter(k => !tKeys.has(k) && !nKeys.has(k));

const allKeys = new Set([...tKeys, ...nKeys, ...cKeys]);

console.log(`\n${"═".repeat(60)}`);
console.log("  EŞLEŞTİRME ANALİZİ");
console.log(`${"═".repeat(60)}`);
console.log(`Toplam unique key: ${allKeys.size}`);
console.log(`\n3 platformda ortak (exact): ${all3.length} (${(all3.length/allKeys.size*100).toFixed(1)}%)`);
console.log(`Trendyol + N11 (ÇS yok):    ${tAndN.length}`);
console.log(`Trendyol + ÇS (N11 yok):    ${tAndC.length}`);
console.log(`N11 + ÇS (TY yok):          ${nAndC.length}`);
console.log(`Sadece Trendyol:             ${onlyT.length}`);
console.log(`Sadece N11:                  ${onlyN.length}`);
console.log(`Sadece ÇiçekSepeti:          ${onlyC.length}`);

// Trendyol referans — N11 ve ÇS'de karşılığı olan/olmayan
const tyTotal = tKeys.size;
const tyHasN11 = [...tKeys].filter(k => nKeys.has(k)).length;
const tyHasCS = [...tKeys].filter(k => cKeys.has(k)).length;
const tyHasBoth = all3.length;
const tyHasNeither = onlyT.length;

console.log(`\n${"═".repeat(60)}`);
console.log("  TRENDYOL REFERANS ANALİZİ");
console.log(`${"═".repeat(60)}`);
console.log(`Trendyol toplam: ${tyTotal}`);
console.log(`  → N11 karşılığı var:  ${tyHasN11} (${(tyHasN11/tyTotal*100).toFixed(1)}%)`);
console.log(`  → ÇS karşılığı var:   ${tyHasCS} (${(tyHasCS/tyTotal*100).toFixed(1)}%)`);
console.log(`  → Her ikisinde var:   ${tyHasBoth} (${(tyHasBoth/tyTotal*100).toFixed(1)}%)`);
console.log(`  → Hiçbirinde yok:    ${tyHasNeither} (${(tyHasNeither/tyTotal*100).toFixed(1)}%)`);

// Leaf bazlı analiz
const tLeafKeys = [...tKeys].filter(k => platformMaps["Trendyol"].get(k).isLeaf);
const tLeafHasN11 = tLeafKeys.filter(k => nKeys.has(k)).length;
const tLeafHasCS = tLeafKeys.filter(k => cKeys.has(k)).length;
const tLeafHasBoth = tLeafKeys.filter(k => nKeys.has(k) && cKeys.has(k)).length;
const tLeafHasNeither = tLeafKeys.filter(k => !nKeys.has(k) && !cKeys.has(k)).length;

console.log(`\nTrendyol LEAF kategoriler: ${tLeafKeys.length}`);
console.log(`  → N11 karşılığı var:  ${tLeafHasN11} (${(tLeafHasN11/tLeafKeys.length*100).toFixed(1)}%)`);
console.log(`  → ÇS karşılığı var:   ${tLeafHasCS} (${(tLeafHasCS/tLeafKeys.length*100).toFixed(1)}%)`);
console.log(`  → Her ikisinde var:   ${tLeafHasBoth} (${(tLeafHasBoth/tLeafKeys.length*100).toFixed(1)}%)`);
console.log(`  → Hiçbirinde yok:    ${tLeafHasNeither} (${(tLeafHasNeither/tLeafKeys.length*100).toFixed(1)}%)`);

// Eşleşmeyen Trendyol leaf örnekleri
console.log(`\nN11'de karşılığı OLMAYAN Trendyol leaf örnekleri (ilk 20):`);
const noN11Leafs = tLeafKeys.filter(k => !nKeys.has(k)).slice(0, 20);
for (const k of noN11Leafs) {
    const t = platformMaps["Trendyol"].get(k);
    console.log(`  "${t.name}" (TY:${t.id})`);
}

// 3 platformda ortak örnekler
console.log(`\n3 platformda ortak örnekler (ilk 10):`);
for (const k of all3.slice(0, 10)) {
    const t = platformMaps["Trendyol"].get(k);
    const n = platformMaps["N11"].get(k);
    const c = platformMaps["ÇiçekSepeti"].get(k);
    console.log(`  "${t.name}" → TY:${t.id} | N11:${n.id} | ÇS:${c.id}`);
}
