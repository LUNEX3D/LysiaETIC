/**
 * Kullanıcı trial süresini uzatma scripti
 * Kullanım: node scripts/extendTrial.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
const TARGET_EMAIL = "lysiaaccessory@gmail.com";

(async () => {
    try {
        console.log("MongoDB'ye bağlanılıyor...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Bağlantı başarılı");

        const User = mongoose.connection.collection("users");

        // Önce mevcut durumu göster
        const user = await User.findOne({ email: TARGET_EMAIL });
        if (!user) {
            console.error("❌ Kullanıcı bulunamadı:", TARGET_EMAIL);
            process.exit(1);
        }

        console.log("\n📋 Mevcut abonelik durumu:");
        console.log(JSON.stringify(user.subscription, null, 2));
        console.log("Role:", user.role);

        // 1 yıl sonrasına uzat
        const now = new Date();
        const oneYearLater = new Date(now);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

        const result = await User.updateOne(
            { email: TARGET_EMAIL },
            {
                $set: {
                    "subscription.status": "active",
                    "subscription.plan": "enterprise",
                    "subscription.startDate": now,
                    "subscription.endDate": oneYearLater,
                    "subscription.trialEndDate": oneYearLater,
                }
            }
        );

        console.log("\n✅ Güncelleme sonucu:", result.modifiedCount, "kayıt güncellendi");

        // Doğrula
        const updated = await User.findOne({ email: TARGET_EMAIL });
        console.log("\n📋 Yeni abonelik durumu:");
        console.log(JSON.stringify(updated.subscription, null, 2));

        await mongoose.disconnect();
        console.log("\n✅ Tamamlandı — kullanıcı artık enterprise planında, 1 yıl geçerli.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Hata:", err.message);
        process.exit(1);
    }
})();
