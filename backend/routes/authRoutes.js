/**
 * Auth Routes — LysiaETIC
 * ✅ FIX #11: Rate limiting eklendi
 * ✅ FIX #13: Input validation eklendi
 * ✅ SEC #2: Logout endpoint eklendi (refresh token revoke)
 */
const express = require("express");
const {
    register,
    login,
    logout,
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

// 🛡️ SEC #2: Logout — refresh token'ı revoke et
router.post("/logout", authMiddleware, logout);

// ✅ P2-3: İki Faktörlü Kimlik Doğrulama (2FA)
const twoFactor = require("../controllers/twoFactorController");
router.post("/2fa/enable",  authMiddleware, twoFactor.enable2FA);
router.post("/2fa/disable", authMiddleware, twoFactor.disable2FA);
router.get("/2fa/status",   authMiddleware, twoFactor.get2FAStatus);
router.post("/2fa/verify",  authLimiter, twoFactor.verify2FA);
router.post("/2fa/resend",  authLimiter, twoFactor.resend2FACode);

module.exports = router;
