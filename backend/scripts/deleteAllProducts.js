/**
 * TÜM ÜRÜNLERİ SİL
 * ProductMapping koleksiyonundaki tüm kayıtları temizler.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
const mongoose = require("mongoose");
const ProductMapping = require("../models/ProductMapping");

(async () => {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log("DB baglanti basarili:", mongoose.connection.name);

    const before = await ProductMapping.countDocuments({});
    console.log("Silinecek urun sayisi:", before);

    const result = await ProductMapping.deleteMany({});
    console.log("Silinen urun sayisi:", result.deletedCount);

    const after = await ProductMapping.countDocuments({});
    console.log("Kalan urun sayisi:", after);
    console.log(before > 0 ? "✅ Tum urunler silindi!" : "⚠️ Zaten urun yoktu.");

    await mongoose.connection.close();
    process.exit(0);
})().catch(async (err) => {
    console.error("HATA:", err.message);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
});
