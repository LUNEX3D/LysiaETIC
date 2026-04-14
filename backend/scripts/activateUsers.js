const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("❌ MONGO_URI bulunamadı! backend/.env dosyasını kontrol edin.");
    process.exit(1);
}

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB bağlantısı başarılı.");

    const usersCollection = mongoose.connection.db.collection("users");

    // emailVerified true olmayan kullanıcıları güncelle
    const result = await usersCollection.updateMany(
        { emailVerified: { $ne: true } },
        { $set: { emailVerified: true } }
    );

    console.log("Toplam eşleşen:", result.matchedCount);
    console.log("Güncellenen:", result.modifiedCount);

    // Tüm kullanıcıları listele
    const allUsers = await usersCollection.find({}, { projection: { name: 1, email: 1, emailVerified: 1 } }).toArray();
    console.log("\nTüm kullanıcılar:");
    allUsers.forEach(u => {
        console.log("  -", u.name, "(" + u.email + ") -> emailVerified:", u.emailVerified);
    });

    await mongoose.disconnect();
    console.log("\nBitti.");
}

main().catch(err => {
    console.error("Hata:", err);
    process.exit(1);
});
