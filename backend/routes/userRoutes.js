const express = require("express");
const { authMiddleware } = require("../middlewares/authMiddleware");
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
router.put("/profile", authMiddleware, updateUserProfile);

// Security routes
router.put("/change-password", authMiddleware, changePassword);
router.post("/verify-password", authMiddleware, verifyPassword);

// Notification settings
router.put("/notifications", authMiddleware, updateNotificationSettings);

// API Key management
router.post("/api-key", authMiddleware, generateApiKey);
router.delete("/api-key/:keyId", authMiddleware, revokeApiKey);

// User statistics
router.get("/stats", authMiddleware, getUserStats);

module.exports = router;
