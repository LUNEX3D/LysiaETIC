/**
 * Hayalet Fatura Temizleme Script'i
 * QNB portalında oluşturulamamış ama DB'de "created" olarak kalan faturaları siler.
 * Siparişleri tekrar faturalanabilir hale getirir.
 *
 * Kullanım: node backend/scripts/cleanupGhostInvoices.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB bağlantısı başarılı.");

    const Invoice = require("../models/Invoice");
    const Order = require("../models/Order");

    const ghosts = await Invoice.find({ status: "created", createdBy: "auto" }).lean();
    console.log("Hayalet fatura sayısı:", ghosts.length);

    if (ghosts.length === 0) {
        console.log("Temizlenecek fatura yok.");
        await mongoose.disconnect();
        return;
    }

    let cleaned = 0;
    for (const inv of ghosts) {
        await Invoice.deleteOne({ _id: inv._id });

        if (inv.orderId) {
            await Order.updateOne(
                { _id: inv.orderId },
                { "$unset": { invoiceId: 1, invoiceNumber: 1 }, invoiceStatus: "none" }
            );
        }

        cleaned++;
        console.log("  Silindi:", inv.invoiceNumber || inv.uuid, "→ Sipariş:", inv.orderNumber || "-");
    }

    console.log("\n✅ Toplam " + cleaned + " hayalet fatura temizlendi.");
    console.log("Siparişler tekrar faturalanabilir durumda.");

    await mongoose.disconnect();
}

main().catch(err => {
    console.error("Hata:", err.message);
    process.exit(1);
});
