const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");

// Controllers
const adminUserController = require("../controllers/admin/adminUserController");
const adminDataController = require("../controllers/admin/adminDataController");
const adminSystemController = require("../controllers/admin/adminSystemController");

// ─── Kullanıcı Yönetimi ─────────────────────────────────────────────────────
router.get("/users", authMiddleware, adminMiddleware, adminUserController.getAllUsers);
router.get("/users/:id", authMiddleware, adminMiddleware, adminUserController.getUserById);
router.put("/users/:id", authMiddleware, adminMiddleware, adminUserController.updateUser);
router.put("/users/:id/role", authMiddleware, adminMiddleware, adminUserController.updateUserRole);
router.delete("/users/:id", authMiddleware, adminMiddleware, adminUserController.deleteUser);

// ─── Ürün & Sipariş Yönetimi ────────────────────────────────────────────────
router.get("/products", authMiddleware, adminMiddleware, adminDataController.getAllProductsAdmin);
router.delete("/delete-product/:id", authMiddleware, adminMiddleware, adminDataController.deleteProductAdmin);
router.get("/orders", authMiddleware, adminMiddleware, adminDataController.getAllOrdersAdmin);

// ─── Sistem & Sunucu Yönetimi ───────────────────────────────────────────────
router.get("/system/status", authMiddleware, adminMiddleware, adminSystemController.getSystemStatus);
router.get("/system/servers", authMiddleware, adminMiddleware, adminSystemController.getServers);
router.get("/system/logs", authMiddleware, adminMiddleware, adminSystemController.getSystemLogs);
router.get("/system/settings", authMiddleware, adminMiddleware, adminSystemController.getSystemSettings);
router.post("/system/impersonate/:userId", authMiddleware, adminMiddleware, adminSystemController.impersonateUser);

// ─── Rol Düzeltme (Legacy) ──────────────────────────────────────────────────
router.get("/fix-user-roles", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Bu işlem için admin yetkisi gereklidir" });
        }

        const usersWithInvalidRole = await User.find({ role: "users" });
        if (usersWithInvalidRole.length === 0) {
            return res.json({ success: true, message: "Düzeltilmesi gereken kullanıcı yok!", fixed: 0 });
        }

        let fixedCount = 0;
        const fixedUsers = [];

        for (const user of usersWithInvalidRole) {
            await User.updateOne({ _id: user._id }, { $set: { role: "user" } });
            fixedUsers.push({ id: user._id, email: user.email, oldRole: "users", newRole: "user" });
            fixedCount++;
        }

        res.json({ success: true, message: `${fixedCount} kullanıcının rolü düzeltildi`, fixed: fixedCount, users: fixedUsers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Role düzeltme hatası", error: error.message });
    }
});

module.exports = router;
