const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authMiddleware } = require("../middlewares/authMiddleware");

/**
 * Admin route to fix invalid user roles in database
 * GET /api/admin/fix-user-roles
 */
router.get("/fix-user-roles", authMiddleware, async (req, res) => {
    try {
        // Only allow admin users to run this
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Bu işlem için admin yetkisi gereklidir"
            });
        }

        console.log("🔧 Kullanıcı rolleri düzeltiliyor...");

        // Find all users with invalid role 'users'
        const usersWithInvalidRole = await User.find({ role: 'users' });

        console.log(`📊 Geçersiz role değerine sahip ${usersWithInvalidRole.length} kullanıcı bulundu`);

        if (usersWithInvalidRole.length === 0) {
            return res.json({
                success: true,
                message: "Düzeltilmesi gereken kullanıcı yok!",
                fixed: 0
            });
        }

        // Fix each user
        let fixedCount = 0;
        const fixedUsers = [];

        for (const user of usersWithInvalidRole) {
            console.log(`🔧 Düzeltiliyor: ${user.email} (${user._id})`);

            // Directly update using updateOne to bypass validation
            await User.updateOne(
                { _id: user._id },
                { $set: { role: 'user' } }
            );

            fixedUsers.push({
                id: user._id,
                email: user.email,
                oldRole: 'users',
                newRole: 'user'
            });

            fixedCount++;
        }

        console.log(`✅ ${fixedCount} kullanıcının role değeri 'user' olarak güncellendi`);

        res.json({
            success: true,
            message: `${fixedCount} kullanıcının role değeri başarıyla düzeltildi`,
            fixed: fixedCount,
            users: fixedUsers
        });

    } catch (error) {
        console.error("❌ Role düzeltme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Role düzeltme sırasında hata oluştu",
            error: error.message
        });
    }
});

module.exports = router;
