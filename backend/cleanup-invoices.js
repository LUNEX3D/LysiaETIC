/**
 * ═══════════════════════════════════════════════════════════════════════
 * FATURA TEMİZLEME — Tüm test faturalarını sil, siparişleri sıfırla
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bu script:
 *   1. Tüm Invoice kayıtlarını siler
 *   2. Order'lardaki invoiceId, invoiceNumber, invoiceStatus alanlarını sıfırlar
 *   3. AutoInvoiceConfig istatistiklerini sıfırlar
 *
 * KULLANIM:
 *   node cleanup-invoices.js              # Onay ister
 *   node cleanup-invoices.js --confirm    # Direkt siler
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const Order = require("./models/Order");
    const Invoice = require("./models/Invoice");
    const AutoInvoiceConfig = require("./models/AutoInvoiceConfig");

    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║     FATURA TEMİZLEME — Tüm Faturaları Sil                  ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝\n");

    // Mevcut durum
    const totalInvoices = await Invoice.countDocuments({});
    const totalOrders = await Order.countDocuments({});
    const ordersWithInvoice = await Order.countDocuments({ invoiceId: { $exists: true, $ne: null } });
    const ordersCreated = await Order.countDocuments({ invoiceStatus: "created" });
    const ordersError = await Order.countDocuments({ invoiceStatus: "error" });
    const ordersPending = await Order.countDocuments({ invoiceStatus: "pending" });

    console.log("📊 MEVCUT DURUM:");
    console.log(`   Toplam fatura: ${totalInvoices}`);
    console.log(`   Toplam sipariş: ${totalOrders}`);
    console.log(`   invoiceId dolu: ${ordersWithInvoice}`);
    console.log(`   invoiceStatus=created: ${ordersCreated}`);
    console.log(`   invoiceStatus=error: ${ordersError}`);
    console.log(`   invoiceStatus=pending: ${ordersPending}`);

    // Onay kontrolü
    const args = process.argv.slice(2);
    if (!args.includes("--confirm")) {
        console.log("\n⚠️  Bu işlem TÜM faturaları silecek!");
        console.log("   Onaylamak için: node cleanup-invoices.js --confirm\n");
        await mongoose.disconnect();
        return;
    }

    console.log("\n🗑️  SİLME İŞLEMİ BAŞLIYOR...\n");

    // 1. Tüm faturaları sil
    const deleteResult = await Invoice.deleteMany({});
    console.log(`   ✅ ${deleteResult.deletedCount} fatura silindi`);

    // 2. Order'lardaki fatura alanlarını sıfırla
    const updateResult = await Order.updateMany(
        {},
        {
            $unset: { invoiceId: "", invoiceNumber: "" },
            $set: { invoiceStatus: "" }
        }
    );
    console.log(`   ✅ ${updateResult.modifiedCount} sipariş sıfırlandı`);

    // 3. AutoInvoiceConfig istatistiklerini sıfırla
    const configResult = await AutoInvoiceConfig.updateMany(
        {},
        {
            $set: {
                "stats.totalInvoicesCreated": 0,
                "stats.consecutiveErrors": 0,
                "stats.lastError": "",
                "stats.lastErrorDate": null,
                "stats.lastInvoiceDate": null,
            }
        }
    );
    console.log(`   ✅ ${configResult.modifiedCount} config sıfırlandı`);

    // Doğrulama
    const remainingInvoices = await Invoice.countDocuments({});
    const remainingWithInvoice = await Order.countDocuments({ invoiceId: { $exists: true, $ne: null } });
    const remainingCreated = await Order.countDocuments({ invoiceStatus: "created" });

    console.log("\n📊 TEMİZLİK SONRASI:");
    console.log(`   Kalan fatura: ${remainingInvoices}`);
    console.log(`   invoiceId dolu sipariş: ${remainingWithInvoice}`);
    console.log(`   invoiceStatus=created: ${remainingCreated}`);

    console.log("\n✅ Temizlik tamamlandı!\n");
    await mongoose.disconnect();
}

main().catch(e => { console.error("HATA:", e.message); process.exit(1); });
