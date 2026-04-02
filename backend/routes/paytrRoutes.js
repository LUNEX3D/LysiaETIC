/**
 * PayTR Routes — LysiaETIC
 *
 * Ödeme ve abonelik yönetimi route'ları.
 */

const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");
const paytr = require("../controllers/paytrController");

// ─── Public Routes ────────────────────────────────────────────────────────────

// Paket bilgileri (herkes görebilir)
router.get("/plans", paytr.getPlans);

// PayTR callback (PayTR sunucusundan gelir, auth yok)
router.post("/callback", paytr.paytrCallback);

// ─── Authenticated Routes ─────────────────────────────────────────────────────

// Abonelik durumu
router.get("/subscription", authMiddleware, paytr.getSubscriptionStatus);

// Ödeme başlat (iframe token al)
router.post("/create-payment", authMiddleware, paytr.createPayment);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// Tüm abonelikleri listele
router.get("/admin/subscriptions", authMiddleware, adminMiddleware, paytr.adminListSubscriptions);

// Kullanıcıya abonelik/demo ver
router.post("/admin/grant", authMiddleware, adminMiddleware, paytr.adminGrantSubscription);

// Tüm kullanıcılara toplu demo ver
router.post("/admin/grant-demo-all", authMiddleware, adminMiddleware, paytr.adminGrantDemoToAll);

module.exports = router;
