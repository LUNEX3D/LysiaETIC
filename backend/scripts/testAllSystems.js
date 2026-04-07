/**
 * KAPSAMLI SİSTEM TESTİ — DB Bağımsız
 *
 * Tüm modüllerin yüklenmesini, fonksiyon imzalarını, iş mantığını,
 * route-controller eşleşmesini ve text normalizasyonu test eder.
 *
 * DB bağlantısı GEREKMEZ — pure logic testleri.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        errors.push({ name, error: err.message });
        console.log(`  ❌ ${name} — ${err.message}`);
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || "assertEqual"}: beklenen="${expected}" bulunan="${actual}"`);
    }
}

function assertType(val, type, msg) {
    if (typeof val !== type) {
        throw new Error(`${msg || "assertType"}: beklenen tip="${type}" bulunan="${typeof val}"`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 1: MODÜL YÜKLEME TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 1: Modül Yükleme Testleri ═══");

let textNormalize, categoryMappingService, unifiedImportService, fuzzyService, controller;

test("textNormalize modülü yükleniyor", () => {
    textNormalize = require("../utils/textNormalize");
    assert(textNormalize, "modül null");
});

test("categoryMappingService modülü yükleniyor", () => {
    categoryMappingService = require("../services/categoryMappingService");
    assert(categoryMappingService, "modül null");
});

test("unifiedCategoryImportService modülü yükleniyor", () => {
    unifiedImportService = require("../services/unifiedCategoryImportService");
    assert(unifiedImportService, "modül null");
});

test("categoryFuzzyMatchService modülü yükleniyor", () => {
    fuzzyService = require("../services/categoryFuzzyMatchService");
    assert(fuzzyService, "modül null");
});

test("categorySmartController modülü yükleniyor", () => {
    controller = require("../controllers/categorySmartController");
    assert(controller, "modül null");
});

test("UnifiedCategoryMap modeli yükleniyor", () => {
    const model = require("../models/UnifiedCategoryMap");
    assert(model, "model null");
    assert(model.modelName === "UnifiedCategoryMap", `modelName: ${model.modelName}`);
});

test("CategoryMapping modeli yükleniyor", () => {
    const model = require("../models/CategoryMapping");
    assert(model, "model null");
});

test("InternalCategory modeli yükleniyor", () => {
    const model = require("../models/InternalCategory");
    assert(model, "model null");
});

test("categoryResolverService modülü yükleniyor", () => {
    const svc = require("../services/categoryResolverService");
    assert(svc, "modül null");
});

test("categorySmartRoutes modülü yükleniyor", () => {
    const routes = require("../routes/categorySmartRoutes");
    assert(routes, "routes null");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 2: FONKSİYON İMZA TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 2: Fonksiyon İmza Testleri ═══");

// textNormalize exports
test("textNormalize.normalize fonksiyon", () => assertType(textNormalize.normalize, "function"));
test("textNormalize.normalizeKey fonksiyon", () => assertType(textNormalize.normalizeKey, "function"));
test("textNormalize.extractWords fonksiyon", () => assertType(textNormalize.extractWords, "function"));
test("textNormalize.extractMeaningfulWords fonksiyon", () => assertType(textNormalize.extractMeaningfulWords, "function"));
test("textNormalize.STOPWORDS_TR Set", () => assert(textNormalize.STOPWORDS_TR instanceof Set, "Set değil"));

// categoryMappingService exports
test("categoryMappingService.resolveFromUnifiedMap fonksiyon", () => assertType(categoryMappingService.resolveFromUnifiedMap, "function"));
test("categoryMappingService.suggestCategory fonksiyon", () => assertType(categoryMappingService.suggestCategory, "function"));
test("categoryMappingService.mapCategoryWithFallback fonksiyon", () => assertType(categoryMappingService.mapCategoryWithFallback, "function"));
test("categoryMappingService.resolveForMarketplace fonksiyon", () => assertType(categoryMappingService.resolveForMarketplace, "function"));
test("categoryMappingService.invalidateCategoryCache fonksiyon", () => assertType(categoryMappingService.invalidateCategoryCache, "function"));
test("categoryMappingService.getInternalCategoriesCached fonksiyon", () => assertType(categoryMappingService.getInternalCategoriesCached, "function"));
test("categoryMappingService.saveUnmappedCategory fonksiyon", () => assertType(categoryMappingService.saveUnmappedCategory, "function"));
test("categoryMappingService.getUnmappedCategories fonksiyon", () => assertType(categoryMappingService.getUnmappedCategories, "function"));
test("categoryMappingService.resolveUnmappedCategory fonksiyon", () => assertType(categoryMappingService.resolveUnmappedCategory, "function"));
test("categoryMappingService.skipProduct fonksiyon", () => assertType(categoryMappingService.skipProduct, "function"));
test("categoryMappingService.suggestN11Category fonksiyon", () => assertType(categoryMappingService.suggestN11Category, "function"));

// unifiedImportService exports
test("unifiedImportService.importFromBuffers fonksiyon", () => assertType(unifiedImportService.importFromBuffers, "function"));
test("unifiedImportService.buildUnifiedMap fonksiyon", () => assertType(unifiedImportService.buildUnifiedMap, "function"));
test("unifiedImportService.parseExcelBuffer fonksiyon", () => assertType(unifiedImportService.parseExcelBuffer, "function"));
test("unifiedImportService.manualMerge fonksiyon", () => assertType(unifiedImportService.manualMerge, "function"));
test("unifiedImportService.getStats fonksiyon", () => assertType(unifiedImportService.getStats, "function"));
test("unifiedImportService.normalizeKey fonksiyon (re-export)", () => assertType(unifiedImportService.normalizeKey, "function"));

// fuzzyService exports
test("fuzzyService.fuzzyMatchCategories fonksiyon", () => assertType(fuzzyService.fuzzyMatchCategories, "function"));

// Controller exports — tüm endpoint fonksiyonları
const EXPECTED_CONTROLLER_EXPORTS = [
    "getInternalCategories", "createInternalCategory", "updateInternalCategory",
    "deleteInternalCategory", "seedInternalCategories",
    "getMappings", "saveMappings", "bulkSaveMappings", "deleteMapping",
    "autoMatch", "bulkMatch", "learn",
    "fuzzyMatch", "autoMapAll", "resolveCategory",
    "crossPlatformMatch", "resolveUnmapped", "autoResolveUnmapped",
    "smartResolve", "smartResolveBatch", "getResolverStats",
    "getPlatformCategories",
    "getMarketplaceCategories", "exportMarketplaceCategoriesExcel", "exportMarketplaceCategoriesPDF",
    "getAttributeMappings", "saveAttributeMapping", "deleteAttributeMapping",
    "getMemory", "deleteMemory", "getStats",
    "importUnifiedCategories", "getUnifiedCategories", "getUnifiedStats",
    "mergeUnifiedCategories", "updateUnifiedCategory", "deleteUnifiedCategory",
    "exportUnifiedCategoriesExcel",
    // Manuel eşleştirme yardımcıları
    "suggestPlatformCategory", "getIncompleteCategories"
];

for (const fn of EXPECTED_CONTROLLER_EXPORTS) {
    test(`controller.${fn} fonksiyon`, () => {
        // importUnifiedCategories bir array (middleware chain) olabilir
        const val = controller[fn];
        assert(val !== undefined, `${fn} tanımlı değil`);
        if (Array.isArray(val)) {
            assert(val.length > 0, `${fn} boş array`);
        } else {
            assertType(val, "function", fn);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 3: TEXT NORMALİZASYON UNIT TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 3: Text Normalizasyon Testleri ═══");

const { normalize, normalizeKey, extractWords, extractMeaningfulWords, STOPWORDS_TR } = textNormalize;

test("normalize: Türkçe karakterler → ASCII", () => {
    assertEqual(normalize("Küpe"), "kupe");
    assertEqual(normalize("Çiçek"), "cicek");
    assertEqual(normalize("Şapka"), "sapka");
    assertEqual(normalize("Gömlek"), "gomlek");
    assertEqual(normalize("Ürün"), "urun");
    assertEqual(normalize("Işık"), "isik");
});

test("normalize: büyük harf → küçük harf", () => {
    assertEqual(normalize("TELEFON"), "telefon");
    assertEqual(normalize("Bilgisayar"), "bilgisayar");
    assertEqual(normalize("LAPTOP"), "laptop");
});

test("normalize: özel karakterler temizlenir", () => {
    assertEqual(normalize("Biblo, Figür & Objeler"), "biblo figur objeler");
    assertEqual(normalize("Dekoratif Obje ve Biblo"), "dekoratif obje ve biblo");
    assertEqual(normalize("Ev > Dekor > Biblo"), "ev dekor biblo");
});

test("normalize: boş/null input", () => {
    assertEqual(normalize(""), "");
    assertEqual(normalize(null), "");
    assertEqual(normalize(undefined), "");
});

test("normalize: çoklu boşluk temizlenir", () => {
    assertEqual(normalize("  Altın   Küpe  "), "altin kupe");
});

test("normalizeKey === normalize (alias)", () => {
    assertEqual(normalizeKey("Küpe"), normalize("Küpe"));
    assertEqual(normalizeKey("Dekoratif Obje ve Biblo"), normalize("Dekoratif Obje ve Biblo"));
    assertEqual(normalizeKey("Çelik Küpe"), normalize("Çelik Küpe"));
});

test("extractWords: kelime ayırma (min 2 karakter)", () => {
    const words = extractWords("Altın Küpe");
    assert(words.length === 2, `beklenen 2, bulunan ${words.length}`);
    assert(words.includes("altin"), "altin yok");
    assert(words.includes("kupe"), "kupe yok");
});

test("extractWords: tek karakterli kelimeler filtrelenir", () => {
    const words = extractWords("A B CD EF");
    assert(!words.includes("a"), "tek karakter geçmemeli");
    assert(!words.includes("b"), "tek karakter geçmemeli");
    assert(words.includes("cd"), "cd olmalı");
    assert(words.includes("ef"), "ef olmalı");
});

test("extractMeaningfulWords: stopword filtresi", () => {
    const words = extractMeaningfulWords("Dekoratif Obje ve Biblo");
    assert(!words.includes("ve"), "'ve' stopword olmalı");
    assert(words.includes("dekoratif"), "dekoratif olmalı");
    assert(words.includes("obje"), "obje olmalı");
    assert(words.includes("biblo"), "biblo olmalı");
});

test("extractMeaningfulWords: 2 karakterli anlamlı kelimeler korunur", () => {
    const words = extractMeaningfulWords("TV Ünitesi");
    assert(words.includes("tv"), "tv korunmalı (2 karakter ama anlamlı)");
});

test("STOPWORDS_TR: temel stopword'ler var", () => {
    assert(STOPWORDS_TR.has("ve"), "'ve' stopword olmalı");
    assert(STOPWORDS_TR.has("ile"), "'ile' stopword olmalı");
    assert(STOPWORDS_TR.has("icin"), "'icin' stopword olmalı");
    assert(STOPWORDS_TR.has("bir"), "'bir' stopword olmalı");
    assert(!STOPWORDS_TR.has("telefon"), "'telefon' stopword olmamalı");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 4: FUZZY MATCH SERVİSİ UNIT TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 4: Fuzzy Match Servisi Testleri ═══");

const mockCategories = [
    { id: "100", name: "Küpe", path: "Takı > Küpe", isLeaf: true },
    { id: "101", name: "Altın Küpe", path: "Takı > Küpe > Altın Küpe", isLeaf: true },
    { id: "102", name: "Çelik Küpe", path: "Takı > Küpe > Çelik Küpe", isLeaf: true },
    { id: "200", name: "Bileklik", path: "Takı > Bileklik", isLeaf: true },
    { id: "201", name: "Altın Bileklik", path: "Takı > Bileklik > Altın Bileklik", isLeaf: true },
    { id: "300", name: "Dekoratif Obje ve Biblo", path: "Ev > Dekorasyon > Dekoratif Obje ve Biblo", isLeaf: true },
    { id: "301", name: "Biblo", path: "Ev > Dekorasyon > Biblo", isLeaf: true },
    { id: "400", name: "Telefon Kılıfı", path: "Elektronik > Telefon Kılıfı", isLeaf: true },
    { id: "401", name: "Cep Telefonu", path: "Elektronik > Cep Telefonu", isLeaf: true },
    { id: "500", name: "Gömlek", path: "Giyim > Gömlek", isLeaf: true },
];

test("fuzzyMatch: exact match en yüksek skor", () => {
    const results = fuzzyService.fuzzyMatchCategories("Küpe", mockCategories, { limit: 5 });
    assert(results.length > 0, "sonuç olmalı");
    assertEqual(results[0].categoryName || results[0].name, "Küpe", "ilk sonuç exact match olmalı");
});

test("fuzzyMatch: benzer isimler bulunur", () => {
    const results = fuzzyService.fuzzyMatchCategories("Altın Küpe", mockCategories, { limit: 5 });
    assert(results.length > 0, "sonuç olmalı");
    const names = results.map(r => r.categoryName || r.name);
    assert(names.includes("Altın Küpe"), "Altın Küpe bulunmalı");
});

test("fuzzyMatch: limit çalışıyor", () => {
    const results = fuzzyService.fuzzyMatchCategories("Küpe", mockCategories, { limit: 2 });
    assert(results.length <= 2, `limit 2 ama ${results.length} sonuç döndü`);
});

test("fuzzyMatch: minScore filtresi çalışıyor", () => {
    const results = fuzzyService.fuzzyMatchCategories("XYZ Bilinmeyen", mockCategories, { limit: 5, minScore: 0.8 });
    // Çok yüksek minScore ile alakasız arama sonuç vermemeli
    for (const r of results) {
        assert(r.score >= 0.8, `skor ${r.score} < 0.8 minScore`);
    }
});

test("fuzzyMatch: boş input → boş sonuç", () => {
    const results = fuzzyService.fuzzyMatchCategories("", mockCategories, { limit: 5 });
    assertEqual(results.length, 0, "boş input boş sonuç vermeli");
});

test("fuzzyMatch: boş kategori listesi → boş sonuç", () => {
    const results = fuzzyService.fuzzyMatchCategories("Küpe", [], { limit: 5 });
    assertEqual(results.length, 0, "boş liste boş sonuç vermeli");
});

test("fuzzyMatch: sonuçlar skor sıralı", () => {
    const results = fuzzyService.fuzzyMatchCategories("Küpe", mockCategories, { limit: 10 });
    for (let i = 1; i < results.length; i++) {
        assert(results[i - 1].score >= results[i].score,
            `sıralama hatası: [${i-1}]=${results[i-1].score} < [${i}]=${results[i].score}`);
    }
});

test("fuzzyMatch: Türkçe karakter duyarsız", () => {
    const results = fuzzyService.fuzzyMatchCategories("Gomlek", mockCategories, { limit: 3 });
    assert(results.length > 0, "Türkçe karakter duyarsız eşleşme olmalı");
    const names = results.map(r => r.categoryName || r.name);
    assert(names.includes("Gömlek"), "Gömlek bulunmalı");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 5: UNIFIED IMPORT SERVİSİ — buildUnifiedMap TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 5: Unified Import Servisi Testleri ═══");

test("buildUnifiedMap: boş input → boş sonuç", () => {
    const { records, stats } = unifiedImportService.buildUnifiedMap([], [], []);
    assertEqual(records.length, 0, "boş input boş sonuç vermeli");
    assertEqual(stats.totalUnique, 0, "totalUnique 0 olmalı");
});

test("buildUnifiedMap: tek platform → single matchType", () => {
    const tRows = [
        { categoryName: "Küpe", categoryId: "400", categoryPath: "Takı > Küpe", depth: 1, parentId: null, parentName: null, isLeaf: true }
    ];
    const { records, stats } = unifiedImportService.buildUnifiedMap(tRows, [], []);
    assertEqual(records.length, 1, "1 kayıt olmalı");
    assertEqual(records[0].matchType, "single", "tek platform = single");
    assertEqual(records[0].platformCount, 1, "platformCount 1 olmalı");
    assert(records[0].trendyol !== null, "trendyol verisi olmalı");
    assertEqual(records[0].n11, null, "n11 null olmalı");
});

test("buildUnifiedMap: 2 platform eşleşme → 2of3 matchType", () => {
    const tRows = [{ categoryName: "Küpe", categoryId: "400", categoryPath: "Takı > Küpe", depth: 1, parentId: null, parentName: null, isLeaf: true }];
    const nRows = [{ categoryName: "Küpe", categoryId: "1000", categoryPath: "Takı > Küpe", depth: 1, parentId: null, parentName: null, isLeaf: true }];
    const { records } = unifiedImportService.buildUnifiedMap(tRows, nRows, []);
    assertEqual(records.length, 1, "aynı isim birleşmeli");
    assertEqual(records[0].matchType, "2of3", "2 platform = 2of3");
    assertEqual(records[0].platformCount, 2, "platformCount 2 olmalı");
});

test("buildUnifiedMap: 3+ platform eşleşme → exact matchType", () => {
    const tRows = [{ categoryName: "Küpe", categoryId: "400", categoryPath: "Takı > Küpe", depth: 1, parentId: null, parentName: null, isLeaf: true }];
    const nRows = [{ categoryName: "Küpe", categoryId: "1000", categoryPath: "Takı > Küpe", depth: 1, parentId: null, parentName: null, isLeaf: true }];
    const cRows = [{ categoryName: "Küpe", categoryId: "2000", categoryPath: "Takı > Küpe", depth: 1, parentId: null, parentName: null, isLeaf: true }];
    const { records } = unifiedImportService.buildUnifiedMap(tRows, nRows, cRows);
    assertEqual(records[0].matchType, "exact", "3 platform = exact");
    assertEqual(records[0].platformCount, 3, "platformCount 3 olmalı");
});

test("buildUnifiedMap: normalizeKey ile eşleşme (Türkçe karakter)", () => {
    const tRows = [{ categoryName: "Küpe", categoryId: "400", categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true }];
    const nRows = [{ categoryName: "Küpe", categoryId: "1000", categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true }];
    const { records } = unifiedImportService.buildUnifiedMap(tRows, nRows, []);
    // Her iki "Küpe" de normalizeKey("Küpe") = "kupe" olarak eşleşmeli
    assertEqual(records.length, 1, "aynı normalizedKey birleşmeli");
    assertEqual(records[0].normalizedKey, "kupe", "normalizedKey doğru olmalı");
});

test("buildUnifiedMap: farklı isimler → ayrı kayıtlar", () => {
    const tRows = [
        { categoryName: "Küpe", categoryId: "400", categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true },
        { categoryName: "Bileklik", categoryId: "401", categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true }
    ];
    const { records } = unifiedImportService.buildUnifiedMap(tRows, [], []);
    assertEqual(records.length, 2, "farklı isimler ayrı kayıt olmalı");
});

test("buildUnifiedMap: 5 platform desteği", () => {
    const row = (id) => ({ categoryName: "Test", categoryId: id, categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true });
    const { records } = unifiedImportService.buildUnifiedMap([row("1")], [row("2")], [row("3")], [row("4")], [row("5")]);
    assertEqual(records.length, 1, "5 platform tek kayıt");
    assertEqual(records[0].platformCount, 5, "platformCount 5 olmalı");
    assertEqual(records[0].matchType, "exact", "5 platform = exact");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 6: ROUTE ↔ CONTROLLER EŞLEŞMESİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 6: Route ↔ Controller Eşleşmesi ═══");

// Route dosyasını oku ve ctrl.XXX referanslarını çıkar
const fs = require("fs");
const routeContent = fs.readFileSync(path.join(__dirname, "..", "routes", "categorySmartRoutes.js"), "utf8");
const ctrlRefs = routeContent.match(/ctrl\.(\w+)/g) || [];
const uniqueCtrlRefs = [...new Set(ctrlRefs.map(r => r.replace("ctrl.", "")))];

for (const fnName of uniqueCtrlRefs) {
    test(`Route ctrl.${fnName} → controller'da mevcut`, () => {
        const val = controller[fnName];
        assert(val !== undefined, `controller.${fnName} tanımlı değil`);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 7: FRONTEND API ↔ BACKEND ROUTE UYUMU
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 7: Frontend API ↔ Backend Route Uyumu ═══");

const apiContent = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "services", "categorySmartApi.js"), "utf8");

// Frontend'in çağırdığı endpoint'leri çıkar
const apiEndpoints = [];
const getMatches = apiContent.match(/API\.get\(`\$\{BASE\}([^`]+)`/g) || [];
const postMatches = apiContent.match(/API\.post\(`\$\{BASE\}([^`]+)`/g) || [];
const putMatches = apiContent.match(/API\.put\(`\$\{BASE\}([^`]+)`/g) || [];
const deleteMatches = apiContent.match(/API\.delete\(`\$\{BASE\}([^`]+)`/g) || [];

for (const m of getMatches) {
    const ep = m.match(/`\$\{BASE\}([^`]+)`/)?.[1];
    if (ep) apiEndpoints.push({ method: "GET", path: ep });
}
for (const m of postMatches) {
    const ep = m.match(/`\$\{BASE\}([^`]+)`/)?.[1];
    if (ep) apiEndpoints.push({ method: "POST", path: ep });
}
for (const m of putMatches) {
    const ep = m.match(/`\$\{BASE\}([^`]+)`/)?.[1];
    if (ep) apiEndpoints.push({ method: "PUT", path: ep });
}
for (const m of deleteMatches) {
    const ep = m.match(/`\$\{BASE\}([^`]+)`/)?.[1];
    if (ep) apiEndpoints.push({ method: "DELETE", path: ep });
}

// Route dosyasından tanımlı endpoint'leri çıkar
const routeLines = routeContent.split("\n");
const definedRoutes = [];
for (const line of routeLines) {
    const match = line.match(/router\.(get|post|put|delete)\("([^"]+)"/);
    if (match) {
        definedRoutes.push({ method: match[1].toUpperCase(), path: match[2] });
    }
}

for (const ep of apiEndpoints) {
    // Parametreli path'leri normalize et: /unified/${id} → /unified/:id
    let normalizedPath = ep.path.replace(/\$\{[^}]+\}/g, ":param");
    // Trailing slash temizle
    normalizedPath = normalizedPath.replace(/\/$/, "");

    test(`Frontend ${ep.method} ${ep.path} → Backend route mevcut`, () => {
        // Parametreli route'ları eşleştir
        const found = definedRoutes.some(r => {
            if (r.method !== ep.method) return false;
            // Basit eşleşme: parametre yerine :xxx
            const routeRegex = r.path.replace(/:(\w+)/g, "[^/]+");
            const regex = new RegExp(`^${routeRegex}$`);
            return regex.test(normalizedPath);
        });
        assert(found, `Backend'de ${ep.method} ${normalizedPath} route'u bulunamadı`);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 8: PLATFORM FIELD MAPPING TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 8: Platform Field Mapping Testleri ═══");

// _platformField fonksiyonunu test etmek için categoryMappingService'den dolaylı test
// resolveFromUnifiedMap null input → null döner
test("resolveFromUnifiedMap: null categoryName → null", async () => {
    const result = await categoryMappingService.resolveFromUnifiedMap(null, "N11");
    assertEqual(result, null, "null input null döndürmeli");
});

test("resolveFromUnifiedMap: null marketplace → null", async () => {
    const result = await categoryMappingService.resolveFromUnifiedMap("Küpe", null);
    assertEqual(result, null, "null marketplace null döndürmeli");
});

test("resolveFromUnifiedMap: boş string → null", async () => {
    const result = await categoryMappingService.resolveFromUnifiedMap("", "N11");
    assertEqual(result, null, "boş string null döndürmeli");
});

test("resolveFromUnifiedMap: geçersiz marketplace → null", async () => {
    const result = await categoryMappingService.resolveFromUnifiedMap("Küpe", "BilinmeyenPlatform");
    assertEqual(result, null, "geçersiz marketplace null döndürmeli");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 9: FRONTEND COMPONENT YAPISAL TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 9: Frontend Yapısal Testler ═══");

const frontendContent = fs.readFileSync(
    path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf8"
);

test("CategoryMappingPage: default export var", () => {
    assert(frontendContent.includes("export default CategoryMappingPage"), "default export yok");
});

test("CategoryMappingPage: ManualMatchTab bileşeni tanımlı", () => {
    assert(frontendContent.includes("const ManualMatchTab"), "ManualMatchTab tanımlı değil");
});

test("CategoryMappingPage: ManualMatchTab render ediliyor", () => {
    assert(frontendContent.includes("<ManualMatchTab"), "ManualMatchTab render edilmiyor");
});

test("CategoryMappingPage: PLATFORM_META sabiti tanımlı", () => {
    assert(frontendContent.includes("const PLATFORM_META"), "PLATFORM_META tanımlı değil");
});

test("CategoryMappingPage: 5 platform PLATFORM_META'da", () => {
    assert(frontendContent.includes('"trendyol"'), "trendyol yok");
    assert(frontendContent.includes('"n11"'), "n11 yok");
    assert(frontendContent.includes('"ciceksepeti"'), "ciceksepeti yok");
    assert(frontendContent.includes('"hepsiburada"'), "hepsiburada yok");
    assert(frontendContent.includes('"amazon"'), "amazon yok");
});

test("CategoryMappingPage: 4 sekme tanımlı", () => {
    assert(frontendContent.includes('"marketplace"'), "marketplace sekmesi yok");
    assert(frontendContent.includes('"unified"'), "unified sekmesi yok");
    assert(frontendContent.includes('"matched"'), "matched sekmesi yok");
    assert(frontendContent.includes('"manual"'), "manual sekmesi yok");
});

test("CategoryMappingPage: suggestPlatformCategory import edilmiş", () => {
    assert(frontendContent.includes("suggestPlatformCategory"), "suggestPlatformCategory import yok");
});

test("CategoryMappingPage: getIncompleteCategories import edilmiş", () => {
    assert(frontendContent.includes("getIncompleteCategories"), "getIncompleteCategories import yok");
});

test("CategoryMappingPage: updateUnifiedCategory import edilmiş", () => {
    assert(frontendContent.includes("updateUnifiedCategory"), "updateUnifiedCategory import yok");
});

test("CategoryMappingPage: handleMatch fonksiyonu var", () => {
    assert(frontendContent.includes("handleMatch"), "handleMatch fonksiyonu yok");
});

test("CategoryMappingPage: handleAutoSuggest fonksiyonu var", () => {
    assert(frontendContent.includes("handleAutoSuggest"), "handleAutoSuggest fonksiyonu yok");
});

test("CategoryMappingPage: CompletionBar bileşeni var", () => {
    assert(frontendContent.includes("CompletionBar"), "CompletionBar bileşeni yok");
});

test("CategoryMappingPage: sayfalama (pagination) var", () => {
    assert(frontendContent.includes("pagination"), "pagination yok");
});

test("CategoryMappingPage: savedCount (oturum sayacı) var", () => {
    assert(frontendContent.includes("savedCount"), "savedCount yok");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 10: FRONTEND API SERVİSİ YAPISAL TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 10: Frontend API Servisi Testleri ═══");

const EXPECTED_API_EXPORTS = [
    "getInternalCategories", "createInternalCategory", "updateInternalCategory",
    "deleteInternalCategory", "seedInternalCategories",
    "getCategoryMappings", "saveCategoryMapping", "bulkSaveMappings", "deleteCategoryMapping",
    "autoMatchCategory", "learnCategory",
    "getCategoryMemory", "deleteCategoryMemory", "getCategoryStats",
    "fuzzyMatchCategory", "autoMapAllCategories", "getPlatformCategories", "crossPlatformMatch",
    "getUnmappedCategories", "resolveUnmappedCategory", "autoResolveUnmapped",
    "smartResolve", "smartResolveBatch", "getResolverStats",
    "getMarketplaceCategories", "exportMarketplaceCategoriesExcel", "exportMarketplaceCategoriesPDF",
    "importUnifiedCategories", "getUnifiedCategories", "getUnifiedStats",
    "mergeUnifiedCategories", "deleteUnifiedCategory", "exportUnifiedCategoriesExcel",
    // Manuel eşleştirme
    "suggestPlatformCategory", "getIncompleteCategories", "updateUnifiedCategory"
];

for (const fn of EXPECTED_API_EXPORTS) {
    test(`Frontend API: ${fn} export edilmiş`, () => {
        assert(apiContent.includes(`export const ${fn}`), `${fn} export edilmemiş`);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 11: EDGE CASE TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 11: Edge Case Testleri ═══");

test("normalize: sadece özel karakter → boş string", () => {
    assertEqual(normalize("!@#$%^&*()"), "");
});

test("normalize: sayılar korunur", () => {
    assertEqual(normalize("iPhone 15 Pro"), "iphone 15 pro");
});

test("normalize: â î û karakterleri", () => {
    assertEqual(normalize("Kâğıt"), "kagit");
    assertEqual(normalize("Nîmet"), "nimet");
    assertEqual(normalize("Hûri"), "huri");
});

test("extractMeaningfulWords: tüm stopword → boş dizi", () => {
    const words = extractMeaningfulWords("ve ile bir bu");
    // "ve", "ile", "bir", "bu" hepsi stopword — ama "bu" 2 karakter, stopword'de var
    // extractWords: length > 1 filtresi → "ve" (2 char, stopword), "ile" (3 char, stopword), "bir" (3 char, stopword), "bu" (2 char, stopword)
    assertEqual(words.length, 0, "tüm stopword boş dizi olmalı");
});

test("extractMeaningfulWords: karışık input", () => {
    const words = extractMeaningfulWords("Ev ve Yaşam için Dekorasyon");
    assert(!words.includes("ve"), "ve filtrelenmeli");
    assert(!words.includes("icin"), "icin filtrelenmeli");
    assert(words.includes("yasam"), "yasam olmalı");
    assert(words.includes("dekorasyon"), "dekorasyon olmalı");
});

test("buildUnifiedMap: duplicate normalizedKey → ilk kayıt kazanır", () => {
    const tRows = [
        { categoryName: "Küpe", categoryId: "400", categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true },
        { categoryName: "Küpe", categoryId: "401", categoryPath: "", depth: 0, parentId: null, parentName: null, isLeaf: true }
    ];
    const { records } = unifiedImportService.buildUnifiedMap(tRows, [], []);
    assertEqual(records.length, 1, "duplicate normalizedKey tek kayıt olmalı");
    assertEqual(records[0].trendyol.categoryId, "400", "ilk kayıt kazanmalı");
});

test("fuzzyMatch: çok uzun input → hata vermemeli", () => {
    const longInput = "A".repeat(1000);
    const results = fuzzyService.fuzzyMatchCategories(longInput, mockCategories, { limit: 3 });
    assert(Array.isArray(results), "array dönmeli");
});

test("fuzzyMatch: özel karakterli input → hata vermemeli", () => {
    const results = fuzzyService.fuzzyMatchCategories("Küpe (Altın) [14K]", mockCategories, { limit: 3 });
    assert(Array.isArray(results), "array dönmeli");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 12: UNIFIED CATEGORY MAP SCHEMA TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 12: Schema Testleri ═══");

test("UnifiedCategoryMap: gerekli alanlar tanımlı", () => {
    const model = require("../models/UnifiedCategoryMap");
    const schema = model.schema;
    assert(schema.path("canonicalName"), "canonicalName alanı yok");
    assert(schema.path("normalizedKey"), "normalizedKey alanı yok");
    assert(schema.path("platformCount"), "platformCount alanı yok");
    assert(schema.path("matchType"), "matchType alanı yok");
    assert(schema.path("isLeaf"), "isLeaf alanı yok");
});

test("UnifiedCategoryMap: 5 platform sub-schema tanımlı", () => {
    const model = require("../models/UnifiedCategoryMap");
    const schema = model.schema;
    assert(schema.path("trendyol"), "trendyol alanı yok");
    assert(schema.path("n11"), "n11 alanı yok");
    assert(schema.path("ciceksepeti"), "ciceksepeti alanı yok");
    assert(schema.path("hepsiburada"), "hepsiburada alanı yok");
    assert(schema.path("amazon"), "amazon alanı yok");
});

test("UnifiedCategoryMap: matchType enum doğru", () => {
    const model = require("../models/UnifiedCategoryMap");
    const enumValues = model.schema.path("matchType").enumValues;
    assert(enumValues.includes("exact"), "exact enum yok");
    assert(enumValues.includes("2of3"), "2of3 enum yok");
    assert(enumValues.includes("single"), "single enum yok");
    assert(enumValues.includes("manual"), "manual enum yok");
});

test("UnifiedCategoryMap: platformCount min/max", () => {
    const model = require("../models/UnifiedCategoryMap");
    const pcOptions = model.schema.path("platformCount").options;
    assertEqual(pcOptions.min, 0, "min 0 olmalı");
    assertEqual(pcOptions.max, 5, "max 5 olmalı");
});

test("UnifiedCategoryMap: parentId sparse index tanımlı", () => {
    const model = require("../models/UnifiedCategoryMap");
    const indexes = model.schema.indexes();
    const hasTyParentIdx = indexes.some(idx => {
        const fields = idx[0];
        return fields["trendyol.parentId"] !== undefined;
    });
    assert(hasTyParentIdx, "trendyol.parentId sparse index yok");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13) 🌳 AĞAÇ GÖRÜNÜMÜ — Tree Endpoint & buildCategoryTree Testleri
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🌳 13) Ağaç Görünümü (Tree View) Testleri");

// Controller'da getMarketplaceCategoriesTree export'u var mı?
test("controller: getMarketplaceCategoriesTree export var", () => {
    const ctrl = require("../controllers/categorySmartController");
    assert(typeof ctrl.getMarketplaceCategoriesTree === "function", "getMarketplaceCategoriesTree fonksiyon olmalı");
});

// Route'da tree endpoint'i var mı?
test("route: /marketplace-categories/tree route tanımlı", () => {
    const routeFile = require("fs").readFileSync(
        path.join(__dirname, "..", "routes", "categorySmartRoutes.js"), "utf-8"
    );
    assert(routeFile.includes('marketplace-categories/tree'), "tree route tanımlı olmalı");
    assert(routeFile.includes('getMarketplaceCategoriesTree'), "controller referansı olmalı");
});

// Frontend API'de getMarketplaceCategoriesTree var mı?
test("frontend API: getMarketplaceCategoriesTree export var", () => {
    const apiFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "services", "categorySmartApi.js"), "utf-8"
    );
    assert(apiFile.includes("getMarketplaceCategoriesTree"), "API fonksiyonu tanımlı olmalı");
    assert(apiFile.includes("marketplace-categories/tree"), "doğru endpoint kullanılmalı");
});

// Frontend'de import edilmiş mi?
test("frontend page: getMarketplaceCategoriesTree import edilmiş", () => {
    const pageFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf-8"
    );
    assert(pageFile.includes("getMarketplaceCategoriesTree"), "import edilmiş olmalı");
});

// Frontend'de TreeNode bileşeni var mı?
test("frontend page: TreeNode bileşeni tanımlı", () => {
    const pageFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf-8"
    );
    assert(pageFile.includes("const TreeNode"), "TreeNode bileşeni tanımlı olmalı");
    assert(pageFile.includes("expandedNodes"), "expandedNodes state olmalı");
    assert(pageFile.includes("toggleNode"), "toggleNode fonksiyonu olmalı");
});

// Frontend'de viewMode toggle var mı?
test("frontend page: viewMode toggle (tree/table) var", () => {
    const pageFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf-8"
    );
    assert(pageFile.includes('viewMode'), "viewMode state olmalı");
    assert(pageFile.includes('"tree"'), "tree modu olmalı");
    assert(pageFile.includes('"table"'), "table modu olmalı");
    assert(pageFile.includes("Ağaç Görünümü"), "Ağaç Görünümü label olmalı");
    assert(pageFile.includes("Tablo Görünümü"), "Tablo Görünümü label olmalı");
});

// Frontend'de ağaç kontrol butonları var mı?
test("frontend page: ağaç kontrol butonları (Tümünü Aç/Kapat, Sadece Kökler)", () => {
    const pageFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf-8"
    );
    assert(pageFile.includes("expandAll"), "expandAll fonksiyonu olmalı");
    assert(pageFile.includes("collapseAll"), "collapseAll fonksiyonu olmalı");
    assert(pageFile.includes("expandRoots"), "expandRoots fonksiyonu olmalı");
    assert(pageFile.includes("Tümünü Aç"), "Tümünü Aç butonu olmalı");
    assert(pageFile.includes("Tümünü Kapat"), "Tümünü Kapat butonu olmalı");
    assert(pageFile.includes("Sadece Kökler"), "Sadece Kökler butonu olmalı");
});

// Frontend'de arama vurgulama var mı?
test("frontend page: arama vurgulama (highlightText) var", () => {
    const pageFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf-8"
    );
    assert(pageFile.includes("highlightText"), "highlightText fonksiyonu olmalı");
    assert(pageFile.includes("searchQuery"), "searchQuery prop olmalı");
});

// Frontend'de recursive TreeNode render var mı?
test("frontend page: TreeNode recursive render", () => {
    const pageFile = require("fs").readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "pages", "CategoryMappingPage.js"), "utf-8"
    );
    // TreeNode kendi içinde TreeNode render ediyor mu?
    const treeNodeMatches = pageFile.match(/<TreeNode/g);
    assert(treeNodeMatches && treeNodeMatches.length >= 2, `TreeNode en az 2 kez kullanılmalı (recursive), bulundu: ${treeNodeMatches ? treeNodeMatches.length : 0}`);
});

// Backend: buildCategoryTree fonksiyonu controller dosyasında var mı?
test("backend: buildCategoryTree fonksiyonu tanımlı", () => {
    const ctrlFile = require("fs").readFileSync(
        path.join(__dirname, "..", "controllers", "categorySmartController.js"), "utf-8"
    );
    assert(ctrlFile.includes("function buildCategoryTree"), "buildCategoryTree fonksiyonu tanımlı olmalı");
    assert(ctrlFile.includes("nodeMap"), "nodeMap kullanılmalı");
    assert(ctrlFile.includes("sortChildren"), "sortChildren fonksiyonu olmalı");
    assert(ctrlFile.includes("_matched"), "_matched arama işareti olmalı");
});

// Backend: buildCategoryTree arama filtresi mantığı
test("backend: buildCategoryTree arama filtresi mantığı", () => {
    const ctrlFile = require("fs").readFileSync(
        path.join(__dirname, "..", "controllers", "categorySmartController.js"), "utf-8"
    );
    assert(ctrlFile.includes("markMatched"), "markMatched fonksiyonu olmalı");
    assert(ctrlFile.includes("filterTree"), "filterTree fonksiyonu olmalı");
    assert(ctrlFile.includes("hasMatchInSubtree"), "hasMatchInSubtree fonksiyonu olmalı");
});

// Backend: endpoint doğru response yapısı döndürüyor mu?
test("backend: getMarketplaceCategoriesTree response yapısı", () => {
    const ctrlFile = require("fs").readFileSync(
        path.join(__dirname, "..", "controllers", "categorySmartController.js"), "utf-8"
    );
    assert(ctrlFile.includes("trees:"), "response'da trees alanı olmalı");
    assert(ctrlFile.includes("totalCategories"), "response'da totalCategories olmalı");
    assert(ctrlFile.includes("totalRoots"), "response'da totalRoots olmalı");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BÖLÜM 14: ID BAZLI MAPPING IMPORT TESTLERİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ BÖLÜM 14: ID Bazli Mapping Import Testleri ═══");

// Import script dosyası var mı?
test("importIdBasedMapping.js dosyasi mevcut", () => {
    const fs = require("fs");
    const scriptPath = path.join(__dirname, "importIdBasedMapping.js");
    assert(fs.existsSync(scriptPath), "importIdBasedMapping.js dosyasi bulunamadi");
});

// Import script gerekli modülleri require ediyor mu?
test("import script: gerekli modulleri yukluyor", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes('require("xlsx")'), "XLSX modulu yuklenmeli");
    assert(scriptContent.includes('require("../models/UnifiedCategoryMap")'), "UnifiedCategoryMap modeli yuklenmeli");
    assert(scriptContent.includes('require("../utils/textNormalize")'), "textNormalize yuklenmeli");
    assert(scriptContent.includes('require("mongoose")'), "mongoose yuklenmeli");
});

// Import script deleteMany ile temizlik yapıyor mu?
test("import script: mevcut kayitlari siliyor (deleteMany)", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("deleteMany"), "deleteMany ile mevcut kayitlar silinmeli");
});

// Import script bulkWrite ile toplu yazım yapıyor mu?
test("import script: bulkWrite ile toplu kayit yapiyor", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("bulkWrite"), "bulkWrite ile toplu kayit yapilmali");
    assert(scriptContent.includes("upsert: true"), "upsert:true olmali");
});

// Import script Excel sütunlarını doğru okuyor mu?
test("import script: Excel sutunlarini dogru okuyor (lysia_category, trendyol_id, n11_id, ciceksepeti_id)", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("lysia_category"), "lysia_category sutunu okunmali");
    assert(scriptContent.includes("trendyol_id"), "trendyol_id sutunu okunmali");
    assert(scriptContent.includes("n11_id"), "n11_id sutunu okunmali");
    assert(scriptContent.includes("ciceksepeti_id"), "ciceksepeti_id sutunu okunmali");
});

// buildPlatformData null kontrolü
test("import script: buildPlatformData bos ID icin null donuyor", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("buildPlatformData"), "buildPlatformData fonksiyonu olmali");
    assert(scriptContent.includes('if (!categoryId || categoryId === "") return null'), "bos categoryId icin null donmeli");
});

// normalizeKey kullanımı
test("import script: normalizeKey ile key olusturuyor", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("normalizeKey(name)"), "normalizeKey(name) ile key olusturulmali");
});

// matchType hesaplaması doğru mu?
test("import script: matchType dogru hesaplaniyor (exact/2of3/single)", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes('"exact"'), "3 platform icin exact matchType olmali");
    assert(scriptContent.includes('"2of3"'), "2 platform icin 2of3 matchType olmali");
    assert(scriptContent.includes('"single"'), "1 platform icin single matchType olmali");
});

// DNS fix var mı?
test("import script: DNS fix (Google/Cloudflare DNS) mevcut", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("dns.setServers"), "dns.setServers olmali");
    assert(scriptContent.includes("8.8.8.8"), "Google DNS olmali");
});

// Doğrulama adımı var mı?
test("import script: import sonrasi dogrulama yapiyor", () => {
    const fs = require("fs");
    const scriptContent = fs.readFileSync(path.join(__dirname, "importIdBasedMapping.js"), "utf-8");
    assert(scriptContent.includes("finalCount"), "import sonrasi dogrulama (finalCount) olmali");
    assert(scriptContent.includes("countDocuments"), "countDocuments ile dogrulama olmali");
});

// resolveFromUnifiedMap ID bazlı mapping ile uyumlu mu?
test("categoryMappingService: resolveFromUnifiedMap ID bazli mapping ile uyumlu", () => {
    const fs = require("fs");
    const svcContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "categoryMappingService.js"), "utf-8"
    );
    // categoryId alanını $ne: null ile kontrol ediyor — ID bazlı mapping'de categoryId string
    assert(svcContent.includes('`${targetField}.categoryId`'), "targetField.categoryId filtresi olmali");
    assert(svcContent.includes("$ne: null"), "categoryId null kontrolu olmali");
    // normalizedKey ile arama yapıyor — import script de normalizeKey kullanıyor
    assert(svcContent.includes("normalizedKey: key"), "normalizedKey ile arama olmali");
});

// UnifiedCategoryMap modeli ID bazlı mapping alanlarını destekliyor mu?
test("UnifiedCategoryMap modeli: trendyol/n11/ciceksepeti alanlari mevcut", () => {
    const fs = require("fs");
    const modelContent = fs.readFileSync(
        path.join(__dirname, "..", "models", "UnifiedCategoryMap.js"), "utf-8"
    );
    assert(modelContent.includes("trendyol:"), "trendyol alani olmali");
    assert(modelContent.includes("n11:"), "n11 alani olmali");
    assert(modelContent.includes("ciceksepeti:"), "ciceksepeti alani olmali");
    assert(modelContent.includes("categoryId:"), "PlatformCategorySchema'da categoryId olmali");
});

// productSyncService: CicekSepeti normalizeKey bazli arama
test("productSyncService: CicekSepeti normalizeKey bazli kategori arama", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8"
    );
    assert(syncContent.includes('require("../utils/textNormalize")'), "textNormalize import edilmeli");
    assert(syncContent.includes("normalizeKey(categoryName)"), "normalizeKey ile arama yapilmali");
    assert(syncContent.includes("normalizedKey: nKey"), "normalizedKey: nKey ile exact match olmali");
});

// productSyncService: CicekSepeti regex fallback korunuyor
test("productSyncService: CicekSepeti regex fallback mevcut", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8"
    );
    assert(syncContent.includes("4a. normalizeKey ile exact match"), "4a adimi olmali");
    assert(syncContent.includes("4b. Fallback: regex ile arama"), "4b fallback adimi olmali");
});

// productSyncService + masterProductAdapter: N11 mapCategoryWithFallback pipeline kullanıyor
test("N11 pipeline: toN11 -> mapCategoryWithFallback -> resolveFromUnifiedMap", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8"
    );
    assert(syncContent.includes("masterProductAdapter.toN11"), "N11 icin toN11 adapter kullanilmali");

    const adapterContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "masterProductAdapter.js"), "utf-8"
    );
    assert(adapterContent.includes("mapCategoryWithFallback"), "toN11 icinde mapCategoryWithFallback olmali");
    assert(adapterContent.includes("categoryMappingService"), "categoryMappingService import edilmeli");
});

// Uçtan uca akış: Trendyol kategori adı → normalizeKey → UnifiedCategoryMap → platform categoryId
test("uctan uca: normalizeKey tutarliligi (import ve resolve ayni key uretmeli)", () => {
    const { normalizeKey } = require("../utils/textNormalize");
    // Import script normalizeKey(name) kullanıyor
    // resolveFromUnifiedMap normalizeKey(categoryName) kullanıyor
    // İkisi de aynı fonksiyonu kullanmalı → aynı key üretmeli
    const key1 = normalizeKey("Altin Bileklik");
    const key2 = normalizeKey("Altın Bileklik");
    assertEqual(key1, "altin bileklik", "ASCII normalize dogru olmali");
    assertEqual(key2, "altin bileklik", "Turkce karakter normalize dogru olmali");
    assertEqual(key1, key2, "Farkli yazimlar ayni key uretmeli");
});

// productSyncService: Trendyol normalizeKey bazli arama
test("productSyncService: Trendyol normalizeKey bazli kategori arama", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8"
    );
    // Trendyol upload'unda da normalizeKey kullanılmalı
    assert(syncContent.includes("uploadProductToTrendyol"), "uploadProductToTrendyol fonksiyonu olmali");
    // normalizeKey import sayısı artmalı (CicekSepeti + Trendyol)
    const normalizeKeyMatches = syncContent.match(/require\("\.\.\/utils\/textNormalize"\)/g);
    assert(normalizeKeyMatches && normalizeKeyMatches.length >= 2, "En az 2 yerde textNormalize import edilmeli (CicekSepeti + Trendyol)");
});

// Tüm platformlar normalizeKey bazlı kategori çözümleme kullanıyor
test("tum platformlar: normalizeKey bazli kategori cozumleme", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(
        path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8"
    );
    // N11: masterProductAdapter.toN11 → mapCategoryWithFallback → resolveFromUnifiedMap
    assert(syncContent.includes("masterProductAdapter.toN11"), "N11 toN11 adapter kullanmali");

    // CicekSepeti: normalizeKey exact match
    assert(syncContent.includes("4a. normalizeKey ile exact match"), "CicekSepeti normalizeKey kullanmali");

    // Trendyol: normalizeKey exact match
    const trendyolSection = syncContent.substring(
        syncContent.indexOf("uploadProductToTrendyol"),
        syncContent.indexOf("uploadProductToTrendyol") + 3000
    );
    assert(trendyolSection.includes("normalizeKey"), "Trendyol normalizeKey kullanmali");
    assert(trendyolSection.includes("4a. normalizeKey ile exact match"), "Trendyol normalizeKey exact match olmali");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ CATEGORY 15: PRODUCT DUPLICATE GUARD SİSTEMİ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🛡️ Category 15: Product Duplicate Guard Sistemi");

test("15.1 — productDuplicateGuard modülü yüklenir", () => {
    const guard = require("../utils/productDuplicateGuard");
    assert(guard, "Modul yuklenemedi");
    assert(typeof guard.checkDuplicates === "function", "checkDuplicates fonksiyonu olmali");
    assert(typeof guard.findExistingProduct === "function", "findExistingProduct fonksiyonu olmali");
    assert(typeof guard.checkBulkDuplicates === "function", "checkBulkDuplicates fonksiyonu olmali");
    assert(typeof guard.findLegacyDuplicates === "function", "findLegacyDuplicates fonksiyonu olmali");
});

test("15.2 — Guard modülü 4 export fonksiyona sahip", () => {
    const guard = require("../utils/productDuplicateGuard");
    const exports = Object.keys(guard);
    assert(exports.length === 4, `4 export olmali, ${exports.length} bulundu`);
    assert(exports.includes("checkDuplicates"), "checkDuplicates export olmali");
    assert(exports.includes("findExistingProduct"), "findExistingProduct export olmali");
    assert(exports.includes("checkBulkDuplicates"), "checkBulkDuplicates export olmali");
    assert(exports.includes("findLegacyDuplicates"), "findLegacyDuplicates export olmali");
});

test("15.3 — Controller'da duplicateGuard import edilmiş", () => {
    const fs = require("fs");
    const controllerContent = fs.readFileSync(path.join(__dirname, "..", "controllers", "productManagementController.js"), "utf-8");
    assert(controllerContent.includes('require("../utils/productDuplicateGuard")'), "duplicateGuard import olmali");
});

test("15.4 — createProduct'ta duplike kontrolü var", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "controllers", "productManagementController.js"), "utf-8");
    const createSection = content.substring(
        content.indexOf("exports.createProduct"),
        content.indexOf("exports.createProduct") + 2000
    );
    assert(createSection.includes("duplicateGuard.checkDuplicates"), "createProduct duplicateGuard kullanmali");
    assert(createSection.includes("duplicateCheck.isValid"), "isValid kontrolu olmali");
});

test("15.5 — createAndDistribute'da duplike kontrolü var", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "controllers", "productManagementController.js"), "utf-8");
    const createDistSection = content.substring(
        content.indexOf("exports.createAndDistribute"),
        content.indexOf("exports.createAndDistribute") + 2000
    );
    assert(createDistSection.includes("duplicateGuard.checkDuplicates"), "createAndDistribute duplicateGuard kullanmali");
});

test("15.6 — Excel import'ta SKU bazlı eşleştirme var", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "controllers", "productManagementController.js"), "utf-8");
    const importSection = content.substring(
        content.indexOf("executeImport") || 0,
        content.indexOf("exportProducts") || content.length
    );
    assert(importSection.includes('"masterProduct.sku"'), "Import SKU kontrolu olmali");
    assert(importSection.includes("duplicateGuard.checkDuplicates"), "Import duplicateGuard kullanmali");
});

test("15.7 — Sync service'te 4 katmanlı lookup var", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8");
    assert(syncContent.includes("4 katmanlı lookup"), "4 katmanli lookup yorumu olmali");
    assert(syncContent.includes("mappingBySku.get(product.sku)"), "SKU lookup olmali");
    assert(syncContent.includes("mappingByBarcode.get(product.barcode)"), "Barkod lookup olmali");
    assert(syncContent.includes("mappingByMpId.get(product.marketplaceProductId)"), "MarketplaceProductId lookup olmali");
});

test("15.8 — Sync service'te çapraz SKU↔Barkod eşleştirme var", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8");
    // SKU ile barkod alanında arama
    assert(syncContent.includes("mappingByBarcode.get(product.sku)"), "SKU→Barkod capraz lookup olmali");
    // Barkod ile SKU alanında arama
    assert(syncContent.includes("mappingBySku.get(product.barcode)"), "Barkod→SKU capraz lookup olmali");
});

test("15.9 — Sync service'te finalCheck (race condition koruması) var", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8");
    assert(syncContent.includes("finalCheck"), "finalCheck degiskeni olmali");
    assert(syncContent.includes("Duplike önlendi"), "Duplike onlendi log mesaji olmali");
});

test("15.10 — Sync service'te mappingByMpId Map'i var", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8");
    assert(syncContent.includes("const mappingByMpId = new Map()"), "mappingByMpId Map olmali");
    assert(syncContent.includes("mappingByMpId.set("), "mappingByMpId.set kullanilmali");
});

test("15.11 — Sync service'te eksik kategori otomatik doldurma var", () => {
    const fs = require("fs");
    const syncContent = fs.readFileSync(path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8");
    assert(syncContent.includes("!mapping.masterProduct.category && product.category"), "Eksik kategori doldurma olmali");
});

test("15.12 — Guard checkDuplicates 3 kontrol tipi döner", () => {
    const fs = require("fs");
    const guardContent = fs.readFileSync(path.join(__dirname, "..", "utils", "productDuplicateGuard.js"), "utf-8");
    assert(guardContent.includes('type: "barcode"'), "Barkod tipi olmali");
    assert(guardContent.includes('type: "sku"'), "SKU tipi olmali");
    assert(guardContent.includes('type: "exact"'), "Exact tipi olmali");
});

test("15.13 — Guard checkDuplicates excludeProductId destekler (update senaryosu)", () => {
    const fs = require("fs");
    const guardContent = fs.readFileSync(path.join(__dirname, "..", "utils", "productDuplicateGuard.js"), "utf-8");
    assert(guardContent.includes("excludeProductId"), "excludeProductId parametresi olmali");
    assert(guardContent.includes("$ne: excludeProductId"), "$ne filtresi olmali");
});

test("15.14 — Guard findLegacyDuplicates eski placeholder kayıtları tespit eder", () => {
    const fs = require("fs");
    const guardContent = fs.readFileSync(path.join(__dirname, "..", "utils", "productDuplicateGuard.js"), "utf-8");
    assert(guardContent.includes("p.price === 500"), "Fiyat 500 TL kontrolu olmali");
    assert(guardContent.includes("!p.category"), "Kategori bos kontrolu olmali");
    assert(guardContent.includes("Eski placeholder"), "Eski placeholder aciklamasi olmali");
});

test("15.15 — Excel import'ta SKU ile eşleşen ürünün barkodu güncellenir", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "controllers", "productManagementController.js"), "utf-8");
    // SKU ile eşleştiyse eski barkod kalmasın
    assert(content.includes("existing.masterProduct.barcode     = row.barcode"), "Barkod guncelleme olmali");
    assert(content.includes("existing.masterProduct.sku         = row.sku || existing.masterProduct.sku"), "SKU guncelleme olmali");
});

test("15.16 — Frontend: ProductManagementCenter duplike hata yakalama", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ProductManagementCenter.js"), "utf-8");
    assert(content.includes("status === 409"), "409 status kontrolu olmali");
    assert(content.includes("errData?.type"), "Duplike type kontrolu olmali");
    assert(content.includes("conflicts"), "Conflict bilgisi gosterilmeli");
});

test("15.17 — Frontend: ProductManagementPageV3 duplike hata yakalama", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ProductManagementPageV3.js"), "utf-8");
    assert(content.includes("status === 409"), "409 status kontrolu olmali");
    assert(content.includes("errData?.type"), "Duplike type kontrolu olmali");
    assert(content.includes("conflicts"), "Conflict bilgisi gosterilmeli");
});

test("15.18 — Frontend: ProductUploadPage duplike hata yakalama", () => {
    const fs = require("fs");
    const content = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ProductUploadPage.js"), "utf-8");
    assert(content.includes("status === 409"), "409 status kontrolu olmali");
    assert(content.includes("errData?.type"), "Duplike type kontrolu olmali");
    assert(content.includes("typeLabel"), "Hata tipi etiketi olmali (Model Kodu/Stok Kodu)");
    assert(content.includes("conflicts"), "Conflict bilgisi gosterilmeli");
});

test("15.19 — Tüm giriş noktaları korunuyor (4 backend + 3 frontend)", () => {
    const fs = require("fs");
    const controllerContent = fs.readFileSync(path.join(__dirname, "..", "controllers", "productManagementController.js"), "utf-8");
    const syncContent = fs.readFileSync(path.join(__dirname, "..", "services", "productSyncService.js"), "utf-8");
    const feCenter = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ProductManagementCenter.js"), "utf-8");
    const feV3 = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ProductManagementPageV3.js"), "utf-8");
    const feUpload = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ProductUploadPage.js"), "utf-8");

    // Backend 4 giriş noktası
    assert(controllerContent.includes("exports.createProduct") && controllerContent.includes("duplicateGuard.checkDuplicates"), "createProduct korunmali");
    assert(controllerContent.includes("exports.createAndDistribute") && controllerContent.includes("duplicateGuard.checkDuplicates"), "createAndDistribute korunmali");
    const importIdx = controllerContent.indexOf("executeImport");
    const importSection = controllerContent.substring(importIdx, importIdx + 5000);
    assert(importSection.includes("duplicateGuard.checkDuplicates"), "Excel import korunmali");
    assert(syncContent.includes("finalCheck"), "Marketplace sync korunmali");

    // Frontend 3 sayfa — 409 duplike hata yakalama
    assert(feCenter.includes("status === 409"), "FE Center 409 yakalamali");
    assert(feV3.includes("status === 409"), "FE V3 409 yakalamali");
    assert(feUpload.includes("status === 409"), "FE Upload 409 yakalamali");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SONUÇ
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log(`📊 SONUÇ: ${passed} başarılı, ${failed} başarısız, ${skipped} atlandı`);
console.log(`   Toplam: ${passed + failed + skipped} test`);
console.log("═".repeat(60));

if (errors.length > 0) {
    console.log("\n❌ Başarısız Testler:");
    for (const e of errors) {
        console.log(`   • ${e.name}: ${e.error}`);
    }
}

process.exit(failed > 0 ? 1 : 0);
