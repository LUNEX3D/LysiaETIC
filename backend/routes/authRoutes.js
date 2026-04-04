/**
 * Auth Routes — LysiaETIC
 * ✅ FIX #11: Rate limiting eklendi
 * ✅ FIX #13: Input validation eklendi
 */
const express = require("express");
const {
    register,
    login,
    getProfile,
    verifyEmail,
    resendVerification,
    googleAuth,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    refreshToken
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { authLimiter } = require("../middlewares/rateLimiter");
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } = require("../middlewares/validate");

const router = express.Router();

// Auth endpoint'lerine rate limiter uygulandı
router.post("/register", authLimiter, validateRegister, register);
router.post("/login", authLimiter, validateLogin, login);
router.get("/profile", authMiddleware, getProfile);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", authLimiter, resendVerification);

// Google OAuth
router.post("/google", authLimiter, googleAuth);

// Şifre Sıfırlama
router.post("/forgot-password", authLimiter, validateForgotPassword, forgotPassword);
router.post("/verify-reset-code", authLimiter, verifyResetCode);
router.post("/reset-password", authLimiter, validateResetPassword, resetPassword);

// 🛡️ FIX #12: Refresh Token — access token süresi dolduğunda yenile
router.post("/refresh-token", refreshToken);

module.exports = router;
