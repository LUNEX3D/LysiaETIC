/**
 * Fix HB Credentials — Bozuk şifreli credentials'ı gerçek değerlerle değiştir
 *
 * SORUN: HB credentials farklı bir ENCRYPTION_KEY ile şifrelenmiş,
 * mevcut key ile çözülemiyor. decrypt() sessizce şifreli değeri döndürüyor.
 *
 * ÇÖZÜM: Gerçek credentials'ı düz metin olarak kaydet (diğer marketplace'ler gibi)
 */
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const outFile = path.join(__dirname, "fixHB_output.txt");
const lines = [];
const log = (msg) => { lines.push(String(msg)); console.log(msg); };
const flush = () => { fs.writeFileSync(outFile, lines.join("\n"), "utf8"); };

// Gerçek HB credentials
const CORRECT_CREDENTIALS = {
    merchantId: "462770f0-e1d3-4f0b-bed9-89cf5b69fc05",
    secretKey: "2zacNbs9KFqh",
    userAgent: "lysiaaccessory_dev",
    useSit: "false"  // Gerçek mağaza — production endpoint kullan
};

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        log("✅ DB bağlantısı kuruldu");

        const Marketplace = require("../models/Marketplace");

        // HB entegrasyonunu bul
        const hbMp = await Marketplace.findOne({ marketplaceName: { $regex: /hepsiburada/i } });
        if (!hbMp) {
            log("❌ Hepsiburada entegrasyonu bulunamadı");
            flush();
            process.exit(0);
        }

        log("\n📋 ESKİ HB Credentials:");
        log("   merchantId: " + (hbMp.credentials?.merchantId || "").substring(0, 40) + "...");
        log("   secretKey: " + (hbMp.credentials?.secretKey || "").substring(0, 40) + "...");
        log("   userAgent: " + (hbMp.credentials?.userAgent || "").substring(0, 40) + "...");
        log("   useSit: " + hbMp.credentials?.useSit);

        // Credentials'ı güncelle
        log("\n🔧 Credentials güncelleniyor...");
        hbMp.credentials = CORRECT_CREDENTIALS;
        await hbMp.save();
        log("✅ DB güncellendi!");

        log("\n📋 YENİ HB Credentials:");
        log("   merchantId: " + CORRECT_CREDENTIALS.merchantId);
        log("   secretKey: ***" + CORRECT_CREDENTIALS.secretKey.slice(-4));
        log("   userAgent: " + CORRECT_CREDENTIALS.userAgent);
        log("   useSit: " + CORRECT_CREDENTIALS.useSit);

        // API testi — credentials doğru mu?
        log("\n🧪 HB API Testi...");
        const { getHeaders } = require("../services/hepsiburadaService");
        const headers = getHeaders(
            CORRECT_CREDENTIALS.merchantId,
            CORRECT_CREDENTIALS.secretKey,
            CORRECT_CREDENTIALS.userAgent
        );

        // Test 1: Listing API
        log("\n--- Test 1: Listing API ---");
        try {
            const listUrl = `https://listing-external.hepsiburada.com/listings/merchantid/${CORRECT_CREDENTIALS.merchantId}?offset=0&limit=1`;
            const r1 = await axios.get(listUrl, { headers, timeout: 15000 });
            log("  ✅ Listing API OK! Status: " + r1.status);
        } catch (err) {
            log("  ❌ Listing API: " + (err.response?.status || "net") + " " + (err.response?.data ? JSON.stringify(err.response.data).substring(0, 200) : err.message));
        }

        // Test 2: Kategori API (MPOP)
        log("\n--- Test 2: Kategori API (MPOP) ---");
        try {
            const catUrl = "https://mpop.hepsiburada.com/product/api/categories/get-all-categories?status=ACTIVE&version=1&page=0&size=100";
            const r2 = await axios.get(catUrl, { headers, timeout: 15000 });
            let cats = Array.isArray(r2.data) ? r2.data : (r2.data?.data || r2.data?.content || r2.data?.categories || []);
            log("  ✅ MPOP Kategori API OK! " + cats.length + " kategori");
            if (cats.length > 0) {
                const k = cats.filter(c => (c.name || "").toLowerCase().includes("kolye"));
                log("  'kolye' bulunan: " + k.length);
                k.slice(0, 5).forEach(c => log("    " + c.categoryId + " | " + c.name + " | leaf=" + c.leaf));
            }
        } catch (err) {
            log("  ❌ MPOP: " + (err.response?.status || "net") + " " + (err.response?.data ? JSON.stringify(err.response.data).substring(0, 200) : err.message));
        }

        // Test 3: Kategori API (listing-external + merchantId)
        log("\n--- Test 3: Kategori API (listing-external) ---");
        try {
            const catUrl2 = `https://listing-external.hepsiburada.com/product/api/categories/get-all-categories?status=ACTIVE&version=1&page=0&size=100&merchantId=${CORRECT_CREDENTIALS.merchantId}`;
            const r3 = await axios.get(catUrl2, { headers, timeout: 15000 });
            let cats = Array.isArray(r3.data) ? r3.data : (r3.data?.data || r3.data?.content || r3.data?.categories || []);
            log("  ✅ Listing Kategori API OK! " + cats.length + " kategori");
            if (cats.length > 0) {
                const k = cats.filter(c => (c.name || "").toLowerCase().includes("kolye"));
                log("  'kolye' bulunan: " + k.length);
                k.slice(0, 5).forEach(c => log("    " + c.categoryId + " | " + c.name + " | leaf=" + c.leaf));
            }
        } catch (err) {
            log("  ❌ Listing: " + (err.response?.status || "net") + " " + (err.response?.data ? JSON.stringify(err.response.data).substring(0, 200) : err.message));
        }

        // Test 4: Tüm kategorileri çek ve kolye ara
        log("\n--- Test 4: Tüm kategoriler + kolye araması ---");
        let allCats = [];
        let pg = 0;
        let more = true;
        const workingBase = "https://mpop.hepsiburada.com/product/api/categories/get-all-categories";
        while (more && pg < 50) {
            try {
                const url = `${workingBase}?status=ACTIVE&version=1&page=${pg}&size=2000`;
                const r = await axios.get(url, { headers, timeout: 60000 });
                let cats = Array.isArray(r.data) ? r.data : (r.data?.data || r.data?.content || r.data?.categories || []);
                log("  Sayfa " + pg + ": " + cats.length + " kategori");
                if (cats.length > 0) { allCats.push(...cats); pg++; if (cats.length < 2000) more = false; }
                else more = false;
            } catch (err) {
                log("  Sayfa " + pg + " HATA: " + (err.response?.status || err.message));
                // MPOP 403 ise listing-external dene
                if (err.response?.status === 403 && pg === 0) {
                    log("  MPOP 403 — listing-external deneniyor...");
                    const altBase = "https://listing-external.hepsiburada.com/product/api/categories/get-all-categories";
                    try {
                        const url2 = `${altBase}?status=ACTIVE&version=1&page=${pg}&size=2000&merchantId=${CORRECT_CREDENTIALS.merchantId}`;
                        const r2 = await axios.get(url2, { headers, timeout: 60000 });
                        let cats2 = Array.isArray(r2.data) ? r2.data : (r2.data?.data || r2.data?.content || r2.data?.categories || []);
                        log("  listing-external OK: " + cats2.length);
                        if (cats2.length > 0) { allCats.push(...cats2); pg++; if (cats2.length < 2000) more = false; continue; }
                    } catch (err2) {
                        log("  listing-external de HATA: " + (err2.response?.status || err2.message));
                    }
                }
                more = false;
            }
        }

        log("\n📊 SONUÇ:");
        log("  Toplam kategori: " + allCats.length);

        if (allCats.length > 0) {
            const kolye = allCats.filter(c => (c.name || "").toLowerCase().includes("kolye"));
            log("  'kolye' içeren: " + kolye.length);
            kolye.forEach(c => log("    " + (c.categoryId || c.id) + " | " + c.name + " | leaf=" + c.leaf + " | parent=" + c.parentCategoryId));

            const kolyeUcu = allCats.filter(c => (c.name || "").toLowerCase().includes("kolye ucu"));
            log("  'kolye ucu' içeren: " + kolyeUcu.length);
            kolyeUcu.forEach(c => log("    " + (c.categoryId || c.id) + " | " + c.name + " | leaf=" + c.leaf));
        }

        // Cache'i temizle (eski boş cache varsa)
        log("\n🗑️ Eski HB cache temizleniyor...");
        const CategoryCache = require("../models/CategoryCache");
        const delResult = await CategoryCache.deleteMany({ marketplaceName: /hepsiburada/i });
        log("  " + delResult.deletedCount + " cache kaydı silindi");

        await mongoose.disconnect();
        log("\n✅ Tamamlandı! Backend'i yeniden başlat ve 'kolye ucu' ara.");
        flush();
    } catch (err) {
        log("❌ HATA: " + err.message);
        flush();
        process.exit(1);
    }
})();
