const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://***REDACTED***:***REDACTED***@cluster0.2wdra.mongodb.net/ecommerce?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB bağlantısı başarılı.");

    const usersCollection = mongoose.connection.db.collection("users");

    // Önce bu email var mı kontrol et
    const existing = await usersCollection.findOne({ email: "***REDACTED***@gmail.com" });

    if (existing) {
        console.log("Bu kullanıcı zaten mevcut:", existing.name, "-", existing.email);
    } else {
        console.log("Kullanıcı bulunamadı, yeniden oluşturuluyor...");

        // bcrypt ile şifre hash'le
        const bcrypt = require("bcryptjs");
        const hashedPassword = await bcrypt.hash("***REDACTED***", 10);

        const newUser = {
            name: "emrullah",
            email: "***REDACTED***@gmail.com",
            password: hashedPassword,
            role: "admin",
            emailVerified: true,
            authProvider: "local",
            profile: {
                address: {
                    country: "TR"
                }
            },
            preferences: {
                language: "tr",
                timezone: "Europe/Istanbul",
                currency: "TRY",
                notifications: {
                    email: true,
                    sms: false,
                    push: true
                },
                orderNotifications: true,
                stockNotifications: true,
                financeNotifications: true
            },
            security: {
                twoFactorEnabled: false,
                loginHistory: []
            },
            apiKeys: [],
            subscription: {
                plan: "free",
                status: "active"
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);
        console.log("Kullanıcı başarıyla oluşturuldu! ID:", result.insertedId);
    }

    // Tüm kullanıcıları listele
    const allUsers = await usersCollection.find({}, { projection: { name: 1, email: 1, role: 1, emailVerified: 1 } }).toArray();
    console.log("\nTüm kullanıcılar:");
    allUsers.forEach(u => {
        console.log("  -", u.name, "(" + u.email + ") | rol:", u.role, "| emailVerified:", u.emailVerified);
    });

    await mongoose.disconnect();
    console.log("\nBitti.");
}

main().catch(err => {
    console.error("Hata:", err);
    process.exit(1);
});
