const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

/**
 * Script to fix invalid user roles in the database
 * This will change 'users' to 'user' for any users with invalid role
 */

async function fixUserRoles() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ MongoDB bağlantısı başarılı");

        // Find all users with invalid role 'users'
        const usersWithInvalidRole = await User.find({ role: 'users' });

        console.log(`📊 Geçersiz role değerine sahip ${usersWithInvalidRole.length} kullanıcı bulundu`);

        if (usersWithInvalidRole.length === 0) {
            console.log("✅ Düzeltilmesi gereken kullanıcı yok!");
            await mongoose.connection.close();
            return;
        }

        // Fix each user
        let fixedCount = 0;
        for (const user of usersWithInvalidRole) {
            console.log(`🔧 Düzeltiliyor: ${user.email} (${user._id})`);

            // Directly update using updateOne to bypass validation
            await User.updateOne(
                { _id: user._id },
                { $set: { role: 'user' } }
            );

            fixedCount++;
        }

        console.log(`✅ ${fixedCount} kullanıcının role değeri 'user' olarak güncellendi`);

        // Verify the fix
        const remainingInvalid = await User.find({ role: 'users' });
        if (remainingInvalid.length === 0) {
            console.log("✅ Tüm geçersiz role değerleri düzeltildi!");
        } else {
            console.log(`⚠️ Hala ${remainingInvalid.length} geçersiz role değeri var`);
        }

        // Close connection
        await mongoose.connection.close();
        console.log("👋 MongoDB bağlantısı kapatıldı");

    } catch (error) {
        console.error("❌ Hata oluştu:", error);
        process.exit(1);
    }
}

// Run the script
fixUserRoles();
