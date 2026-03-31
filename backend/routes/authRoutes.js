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
    resetPassword
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", authMiddleware, getProfile);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Google OAuth
router.post("/google", googleAuth);

// Şifre Sıfırlama
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password", resetPassword);

module.exports = router;
