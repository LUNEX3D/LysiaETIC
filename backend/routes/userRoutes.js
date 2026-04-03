/**
 * User Routes — LysiaETIC
 * ✅ FIX #11: Hassas işlemlere rate limiter eklendi
 * ✅ FIX #13: Input validation eklendi
 */
const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { sensitiveLimiter } = require("../middlewares/rateLimiter");
const { validateChangePassword, validateUpdateProfile } = require("../middlewares/validate");
const {
    getUserProfile,
    updateUserProfile,
    changePassword,
    updateNotificationSettings,
    generateApiKey,
    revokeApiKey,
    getUserStats,
    verifyPassword
} = require("../controllers/userController");

const router = express.Router();

// Profile routes
router.get("/profile", authMiddleware, getUserProfile);
router.put("/profile", authMiddleware, validateUpdateProfile, updateUserProfile);

// Security routes — hassas işlemler rate limited
router.put("/change-password", authMiddleware, sensitiveLimiter, validateChangePassword, changePassword);
router.post("/verify-password", authMiddleware, sensitiveLimiter, verifyPassword);

// Notification settings
router.put("/notifications", authMiddleware, updateNotificationSettings);

// API Key management — hassas işlemler rate limited
router.post("/api-key", authMiddleware, sensitiveLimiter, generateApiKey);
router.delete("/api-key/:keyId", authMiddleware, revokeApiKey);

// User statistics
router.get("/stats", authMiddleware, getUserStats);

// ✅ FIX E8: Hesap silme endpoint'i
const { deleteAccount } = require("../controllers/userController");
router.delete("/account", authMiddleware, sensitiveLimiter, deleteAccount);

module.exports = router;
