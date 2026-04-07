/**
 * Kategori eşleştirme testleri — resolveFromUnifiedMap v3
 *
 * v3 Değişiklikler:
 *   - Adım 1b: Trendyol Referans Parent→Child Fallback eklendi
 *     "Küpe" (parent, N11'de yok) → TY child'larından N11 karşılığı olan en uygununu seç
 *   - Leaf kategoriler (Çelik Küpe, Altın Küpe) → exact_key ile direkt bulunur
 *   - Parent kategoriler (Küpe, Bileklik) → parent_child_fallback ile çözülür
 *
 * v2.2 Düzeltmeler:
 *   - try/catch + finally ile hata yakalama ve DB bağlantı garantisi
 *   - process.exit() ile script'in asılı kalması engellendi
 *   - Başarısız test varsa exit code 1 (CI/CD uyumu)
 *   - || yerine ?? (nullish coalescing) — "0" ve "" falsy bug'u düzeltildi
 *   - Her test için süre ölçümü eklendi
 *
 * Pipeline (6 adım):
 *   1.  Exact normalizedKey eşleşmesi
 *   1b. Trendyol Referans Parent→Child Fallback (parent kategori → en uygun child)
 *   2.  Kaynak platform adıyla ters arama
 *   3.  Yaprak kategori çıkarma (path → leaf)
 *   4.  Regex kısmi eşleşme (kısa girişlerde atlanır)
 *   5.  Kelime bazlı skorlama
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { resolveFromUnifiedMap } = require("../services/categoryMappingService");

(async () => {
    let failed = 0;

    try {
        // ── DB Bağlantısı ─────────────────────────────────────────────────
        if (!process.env.MONGO_URI) {
            console.error("❌ MONGO_URI ortam değişkeni tanımlı değil. .env dosyasını kontrol edin.");
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ DB bağlandı\n");

        // ── Test Senaryoları ──────────────────────────────────────────────
        const tests = [
            // ── Biblo grubu (exact_key + reverse + word_score) ──
            { input: "Dekoratif Obje ve Biblo",                   target: "N11",         expect: "1000661" },
            { input: "Dekoratif Obje ve Biblo",                   target: "ÇiçekSepeti", expect: "15555" },
            { input: "Biblo",                                     target: "Trendyol",    expect: "1877" },
            { input: "Biblo",                                     target: "N11",         expect: "1000661" },
            { input: "Biblo",                                     target: "ÇiçekSepeti", expect: "15555" },
            { input: "Biblo, Figür, Objeler",                     target: "N11",         expect: "1000661" },
            { input: "Biblo, Figür, Objeler",                     target: "Trendyol",    expect: "1877" },

            // ── Path format + yaprak çıkarma ──
            { input: "Ev > Dekorasyon > Dekoratif Obje ve Biblo", target: "N11",         expect: "1000661" },
            { input: "Ev > Dekorasyon > Biblo",                   target: "Trendyol",    expect: "1877" },

            // ── Parent→Child Fallback (Adım 1b) ──
            // "Küpe" DB'de var (TY:400, CS:13293) ama N11'de yok
            // → Adım 1b: TY child'larından N11 karşılığı olan en uygununu seç
            // 6 child (3 platform, leaf): Altın/Bijuteri/Çelik/Elmas/Gümüş/Pırlanta
            // Input "Küpe" tek kelime → hepsi 1 eşleşme → platformCount eşit → isLeaf eşit
            // → name length eşit (10 char) → alfabetik: "Altın Küpe" (1219204)
            { input: "Küpe",                                      target: "N11",         expect: "1219204" },
            // "Bileklik" DB'de var (TY:397) ama N11'de yok → child fallback → "Altın Bileklik"
            { input: "Bileklik",                                  target: "N11",         expect: "1219202" },

            // ── Parent kategoriler — hedef platformda direkt varsa exact_key ──
            { input: "Küpe",                                      target: "Trendyol",    expect: "400" },
            { input: "Küpe",                                      target: "ÇiçekSepeti", expect: "13293" },

            // ── Leaf kategoriler — exact_key ile direkt bulunmalı ──
            // Gerçek hayatta Trendyol'dan gelen ürünler bu leaf kategorilerde olur
            { input: "Çelik Küpe",                                target: "N11",         expect: "1219222" },
            { input: "Altın Küpe",                                target: "N11",         expect: "1219204" },
            { input: "Pırlanta Küpe",                             target: "N11",         expect: "1002787" },
        ];

        let passed = 0;
        failed = 0;
        const totalStart = Date.now();

        for (const t of tests) {
            const start = Date.now();
            const result = await resolveFromUnifiedMap(t.input, t.target);
            const elapsed = Date.now() - start;

            const gotId = result?.categoryId ?? null;
            const ok = t.expect === null
                ? gotId === null
                : String(gotId) === String(t.expect);

            const icon = ok ? "✅" : "❌";
            const status = ok ? "PASS" : "FAIL";
            console.log(`${icon} [${status}] "${t.input}" → ${t.target}  (${elapsed}ms)`);
            console.log(`   Beklenen: ${t.expect ?? "null"} | Bulunan: ${gotId ?? "null"} (${result?.categoryName ?? "—"}) [${result?.source ?? "—"}]`);

            if (ok) passed++; else failed++;
        }

        const totalElapsed = Date.now() - totalStart;
        console.log(`\n═══ Sonuç: ${passed}/${tests.length} başarılı, ${failed} başarısız (toplam: ${totalElapsed}ms) ═══`);

    } catch (err) {
        console.error(`\n💥 Beklenmeyen hata: ${err.message}`);
        console.error(err.stack);
        failed = 1; // En az 1 hata var
    } finally {
        // DB bağlantısını her durumda kapat
        try {
            await mongoose.disconnect();
            console.log("\n🔌 DB bağlantısı kapatıldı.");
        } catch (_) {
            // disconnect hatası önemsiz
        }

        // Başarısız test varsa exit code 1 (CI/CD uyumu)
        process.exit(failed > 0 ? 1 : 0);
    }
})();
