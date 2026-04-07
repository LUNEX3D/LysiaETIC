/**
 * ÜRÜN MERKEZİ DUPLICATE KONTROL SCRİPTİ
 *
 * ProductMapping koleksiyonunda tekrar eden ürünleri tespit eder:
 *   - Model Kodu (SKU) bazlı tekrarlar
 *   - Ürün Adı bazlı tekrarlar
 *   - Stok Kodu (Barkod) bazlı tekrarlar
 *   - Marketplace'te tekrar eden ürünler
 *   - Eksik/hatalı veriler
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const ProductMapping = require("../models/ProductMapping");

async function main() {
    console.log("=".repeat(70));
    console.log("  URUN MERKEZI DUPLICATE & HATA KONTROL");
    console.log("  (Model Kodu / Urun Adi / Stok Kodu)");
    console.log("=".repeat(70));
    console.log();

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log("DB baglanti basarili:", mongoose.connection.name);
    console.log();

    const total = await ProductMapping.countDocuments({});
    console.log("Toplam urun sayisi:", total);
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // 1) MODEL KODU (SKU) BAZLI TEKRARLAR
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  1) MODEL KODU (SKU) BAZLI TEKRARLAR");
    console.log("=".repeat(70));

    const dupSkus = await ProductMapping.aggregate([
        { $group: {
            _id: { userId: "$userId", sku: "$masterProduct.sku" },
            count: { $sum: 1 },
            urunler: { $push: {
                id: "$_id",
                ad: "$masterProduct.name",
                stokKodu: "$masterProduct.barcode",
                fiyat: "$masterProduct.price",
                stok: "$masterProduct.stock",
                kategori: "$masterProduct.category"
            }}
        }},
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } }
    ]);

    if (dupSkus.length === 0) {
        console.log("  ✅ Tekrar eden model kodu YOK");
    } else {
        console.log("  ❌ " + dupSkus.length + " tekrar eden model kodu bulundu:");
        console.log();
        let totalDupSku = 0;
        dupSkus.forEach((d, idx) => {
            totalDupSku += d.count - 1; // fazlalık sayısı
            console.log("  " + (idx + 1) + ") Model Kodu: " + d._id.sku + " (" + d.count + " kez)");
            d.urunler.forEach((u, i) => {
                console.log("     " + (i + 1) + ". " + (u.ad || "").substring(0, 65));
                console.log("        Stok Kodu: " + u.stokKodu + " | Fiyat: " + (u.fiyat || 0) + " TL | Stok: " + (u.stok || 0) + " | Kategori: " + (u.kategori || "-"));
            });
            console.log();
        });
        console.log("  TOPLAM: " + dupSkus.length + " model kodunda " + totalDupSku + " fazlalik urun");
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // 2) URUN ADI BAZLI TEKRARLAR
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  2) URUN ADI BAZLI TEKRARLAR");
    console.log("=".repeat(70));

    const dupNames = await ProductMapping.aggregate([
        { $group: {
            _id: { userId: "$userId", name: "$masterProduct.name" },
            count: { $sum: 1 },
            urunler: { $push: {
                id: "$_id",
                modelKodu: "$masterProduct.sku",
                stokKodu: "$masterProduct.barcode",
                fiyat: "$masterProduct.price",
                stok: "$masterProduct.stock",
                kategori: "$masterProduct.category"
            }}
        }},
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } }
    ]);

    if (dupNames.length === 0) {
        console.log("  ✅ Tekrar eden urun adi YOK");
    } else {
        // Varyant olanları ve gerçek tekrarları ayır
        const gercekTekrar = [];
        const varyantlar = [];

        dupNames.forEach(d => {
            // Aynı isim + aynı model kodu = gerçek tekrar
            // Aynı isim + farklı model kodu = varyant (renk/beden)
            const modelKodlari = new Set(d.urunler.map(u => u.modelKodu));
            if (modelKodlari.size < d.count) {
                // En az 2 ürün aynı model koduna sahip = gerçek tekrar var
                gercekTekrar.push(d);
            } else {
                varyantlar.push(d);
            }
        });

        console.log();
        console.log("  --- GERCEK TEKRARLAR (ayni isim + ayni model kodu) ---");
        if (gercekTekrar.length === 0) {
            console.log("  ✅ Gercek tekrar YOK (tum tekrar eden isimler varyant)");
        } else {
            console.log("  ❌ " + gercekTekrar.length + " gercek tekrar bulundu:");
            console.log();
            gercekTekrar.forEach((d, idx) => {
                console.log("  " + (idx + 1) + ") \"" + (d._id.name || "").substring(0, 65) + "\" (" + d.count + " kez)");
                d.urunler.forEach((u, i) => {
                    console.log("     " + (i + 1) + ". Model: " + u.modelKodu + " | Stok Kodu: " + u.stokKodu + " | Fiyat: " + (u.fiyat || 0) + " TL | Stok: " + (u.stok || 0));
                });
                console.log();
            });
        }

        console.log();
        console.log("  --- VARYANTLAR (ayni isim + farkli model kodu = renk/beden farki) ---");
        console.log("  Toplam: " + varyantlar.length + " urun adinda varyant mevcut");
        if (varyantlar.length > 0) {
            console.log("  (Ilk 15 gosteriliyor)");
            console.log();
            varyantlar.slice(0, 15).forEach((d, idx) => {
                console.log("  " + (idx + 1) + ") \"" + (d._id.name || "").substring(0, 65) + "\" (" + d.count + " varyant)");
                d.urunler.forEach((u, i) => {
                    console.log("     " + (i + 1) + ". Model: " + u.modelKodu + " | Stok Kodu: " + u.stokKodu + " | Stok: " + (u.stok || 0));
                });
                console.log();
            });
        }
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // 3) STOK KODU (BARKOD) BAZLI TEKRARLAR
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  3) STOK KODU (BARKOD) BAZLI TEKRARLAR");
    console.log("=".repeat(70));

    const dupBarcodes = await ProductMapping.aggregate([
        { $group: {
            _id: { userId: "$userId", barcode: "$masterProduct.barcode" },
            count: { $sum: 1 },
            urunler: { $push: {
                id: "$_id",
                ad: "$masterProduct.name",
                modelKodu: "$masterProduct.sku",
                fiyat: "$masterProduct.price",
                stok: "$masterProduct.stock"
            }}
        }},
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } }
    ]);

    if (dupBarcodes.length === 0) {
        console.log("  ✅ Tekrar eden stok kodu YOK");
    } else {
        console.log("  ❌ " + dupBarcodes.length + " tekrar eden stok kodu bulundu:");
        console.log();
        dupBarcodes.forEach((d, idx) => {
            console.log("  " + (idx + 1) + ") Stok Kodu: " + d._id.barcode + " (" + d.count + " kez)");
            d.urunler.forEach((u, i) => {
                console.log("     " + (i + 1) + ". " + (u.ad || "").substring(0, 55) + " | Model: " + u.modelKodu);
            });
            console.log();
        });
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // 4) MARKETPLACE'TE TEKRAR EDEN URUNLER (ayni Trendyol/N11/CS ID)
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  4) MARKETPLACE'TE TEKRAR EDEN URUNLER");
    console.log("=".repeat(70));

    const dupMpId = await ProductMapping.aggregate([
        { $unwind: "$marketplaceMappings" },
        { $match: {
            "marketplaceMappings.marketplaceProductId": { $ne: null, $ne: "" }
        }},
        { $group: {
            _id: {
                mp: "$marketplaceMappings.marketplaceName",
                mpId: "$marketplaceMappings.marketplaceProductId"
            },
            count: { $sum: 1 },
            urunler: { $push: {
                ad: "$masterProduct.name",
                modelKodu: "$masterProduct.sku",
                stokKodu: "$masterProduct.barcode",
                syncStatus: "$marketplaceMappings.syncStatus"
            }}
        }},
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } }
    ]);

    if (dupMpId.length === 0) {
        console.log("  ✅ Marketplace'te tekrar eden urun YOK");
    } else {
        console.log("  ❌ " + dupMpId.length + " tekrar eden marketplace urunu bulundu:");
        console.log();
        dupMpId.forEach((d, idx) => {
            console.log("  " + (idx + 1) + ") " + d._id.mp + " ID: " + d._id.mpId + " (" + d.count + " kez)");
            d.urunler.forEach((u, i) => {
                console.log("     " + (i + 1) + ". " + (u.ad || "").substring(0, 50) + " | Model: " + u.modelKodu + " | Durum: " + u.syncStatus);
            });
            console.log();
        });
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // 5) EKSIK / HATALI VERILER
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  5) EKSIK / HATALI VERILER");
    console.log("=".repeat(70));

    const noCategory = await ProductMapping.countDocuments({
        $or: [
            { "masterProduct.category": { $exists: false } },
            { "masterProduct.category": "" },
            { "masterProduct.category": null }
        ]
    });
    const noPrice = await ProductMapping.countDocuments({
        $or: [
            { "masterProduct.price": { $exists: false } },
            { "masterProduct.price": 0 },
            { "masterProduct.price": null }
        ]
    });
    const noImages = await ProductMapping.countDocuments({
        $or: [
            { "masterProduct.images": { $exists: false } },
            { "masterProduct.images": { $size: 0 } }
        ]
    });
    const zeroStock = await ProductMapping.countDocuments({ "masterProduct.stock": 0 });
    const noSku = await ProductMapping.countDocuments({
        $or: [
            { "masterProduct.sku": { $exists: false } },
            { "masterProduct.sku": "" },
            { "masterProduct.sku": null }
        ]
    });
    const noBarcode = await ProductMapping.countDocuments({
        $or: [
            { "masterProduct.barcode": { $exists: false } },
            { "masterProduct.barcode": "" },
            { "masterProduct.barcode": null }
        ]
    });

    console.log("  Model Kodu bos  : " + noSku + (noSku > 0 ? " ❌" : " ✅"));
    console.log("  Stok Kodu bos   : " + noBarcode + (noBarcode > 0 ? " ❌" : " ✅"));
    console.log("  Kategori bos    : " + noCategory + (noCategory > 0 ? " ⚠️" : " ✅"));
    console.log("  Fiyat 0/bos     : " + noPrice + (noPrice > 0 ? " ⚠️" : " ✅"));
    console.log("  Gorsel yok      : " + noImages + (noImages > 0 ? " ⚠️" : " ✅"));
    console.log("  Stok 0          : " + zeroStock + " / " + total + " (" + Math.round(zeroStock / total * 100) + "%)");

    // Kategorisi boş olan ürünlerden örnekler
    if (noCategory > 0) {
        console.log();
        console.log("  Kategorisi bos urunlerden ornekler:");
        const noCatSamples = await ProductMapping.find({
            $or: [
                { "masterProduct.category": { $exists: false } },
                { "masterProduct.category": "" },
                { "masterProduct.category": null }
            ]
        }).limit(10).lean();
        noCatSamples.forEach((s, i) => {
            console.log("    " + (i + 1) + ". " + (s.masterProduct.name || "").substring(0, 55) + " | Model: " + s.masterProduct.sku);
        });
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // 6) PLATFORM DAGILIMI
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  6) PLATFORM DAGILIMI");
    console.log("=".repeat(70));

    const platformDist = await ProductMapping.aggregate([
        { $unwind: "$marketplaceMappings" },
        { $group: {
            _id: "$marketplaceMappings.marketplaceName",
            toplam: { $sum: 1 },
            synced: { $sum: { $cond: [{ $eq: ["$marketplaceMappings.syncStatus", "synced"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$marketplaceMappings.syncStatus", "pending"] }, 1, 0] } },
            error: { $sum: { $cond: [{ $eq: ["$marketplaceMappings.syncStatus", "error"] }, 1, 0] } }
        }},
        { $sort: { toplam: -1 } }
    ]);

    platformDist.forEach(p => {
        console.log("  " + (p._id || "?").padEnd(15) + " Toplam: " + String(p.toplam).padStart(4) + " | Basarili: " + String(p.synced).padStart(4) + " | Bekleyen: " + String(p.pending).padStart(3) + " | Hata: " + String(p.error).padStart(3));
    });
    console.log();

    // ═══════════════════════════════════════════════════════════════════════
    // GENEL OZET
    // ═══════════════════════════════════════════════════════════════════════
    console.log("=".repeat(70));
    console.log("  GENEL OZET");
    console.log("=".repeat(70));
    console.log("  Toplam urun              : " + total);
    console.log("  Tekrar model kodu (SKU)  : " + dupSkus.length + " grup" + (dupSkus.length > 0 ? " ❌" : " ✅"));
    console.log("  Tekrar urun adi          : " + dupNames.length + " grup" + (dupNames.length > 0 ? " ⚠️" : " ✅"));
    console.log("  Tekrar stok kodu         : " + dupBarcodes.length + " grup" + (dupBarcodes.length > 0 ? " ❌" : " ✅"));
    console.log("  Tekrar marketplace ID    : " + dupMpId.length + " grup" + (dupMpId.length > 0 ? " ❌" : " ✅"));
    console.log("  Kategorisi bos           : " + noCategory + " / " + total + (noCategory > 0 ? " ⚠️" : " ✅"));
    console.log("  Gorseli yok              : " + noImages + " / " + total + (noImages > 0 ? " ⚠️" : " ✅"));
    console.log("  Fiyati 0                 : " + noPrice + " / " + total + (noPrice > 0 ? " ⚠️" : " ✅"));
    console.log("=".repeat(70));

    await mongoose.connection.close();
    process.exit(0);
}

main().catch(async (err) => {
    console.error("HATA:", err.message);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
});
