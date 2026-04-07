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
    getProductMatchPriority,
    updateProductMatchPriority,
    getPreferences,
    updatePreferences,
    getActiveSessions,
    revokeSession,
    revokeAllSessions,
    generateApiKey,
    revokeApiKey,
    getUserStats,
    verifyPassword,
    deleteAccount
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

// Genel tercihler (tüm ayarlar tek endpoint)
router.get("/preferences", authMiddleware, getPreferences);
router.put("/preferences", authMiddleware, updatePreferences);

// Ürün eşleştirme öncelik ayarları
router.get("/product-match-priority", authMiddleware, getProductMatchPriority);
router.put("/product-match-priority", authMiddleware, updateProductMatchPriority);

// Aktif oturumlar
router.get("/sessions", authMiddleware, getActiveSessions);
router.delete("/sessions/:sessionId", authMiddleware, revokeSession);
router.delete("/sessions", authMiddleware, sensitiveLimiter, revokeAllSessions);

// API Key management — hassas işlemler rate limited
router.post("/api-key", authMiddleware, sensitiveLimiter, generateApiKey);
router.delete("/api-key/:keyId", authMiddleware, revokeApiKey);

// User statistics
router.get("/stats", authMiddleware, getUserStats);

// Hesap silme
router.delete("/account", authMiddleware, sensitiveLimiter, deleteAccount);

module.exports = router;
