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

// Yapılandırma durumu (secret yok — ödeme sayfası kontrolü)
router.get("/health", paytr.getPaytrHealth);

// PayTR callback (PayTR sunucusundan gelir, auth yok)
router.post("/callback", paytr.paytrCallback);

// ─── Authenticated Routes ─────────────────────────────────────────────────────

// Abonelik durumu
router.get("/subscription", authMiddleware, paytr.getSubscriptionStatus);

// PayTR ödeme sonrası — callback beklemeden abonelik senkronu (admin onayı yok)
router.post("/sync-subscription", authMiddleware, paytr.syncSubscriptionAfterPayment);

// PayTR Durum Sorgu ile ödeme doğrulama (başarı/başarısız — yönlendirme sayfası)
router.post("/verify-payment", authMiddleware, paytr.verifyPayment);

// Ödeme modalı kapatıldı — bekleyen ödemeyi iptal (PayTR'de ödenmediyse)
router.post("/cancel-payment", authMiddleware, paytr.cancelPendingPayment);

// Ödeme başlat (iframe token veya kart formu)
router.post("/create-payment", authMiddleware, paytr.createPayment);

// Bekleyen ödemede taksit değişince token/form yenile
router.post("/update-payment-installment", authMiddleware, paytr.updatePaymentInstallment);

// PayTR Direkt API: BIN → card_type; token yenileme
router.post("/bin-lookup", authMiddleware, paytr.lookupBin);
router.post("/refresh-direct-payment", authMiddleware, paytr.refreshDirectPayment);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// Tüm abonelikleri listele
router.get("/admin/subscriptions", authMiddleware, adminMiddleware, paytr.adminListSubscriptions);

// Kullanıcıya abonelik/demo ver
router.post("/admin/grant", authMiddleware, adminMiddleware, paytr.adminGrantSubscription);

// Tüm kullanıcılara toplu demo ver
router.post("/admin/grant-demo-all", authMiddleware, adminMiddleware, paytr.adminGrantDemoToAll);

module.exports = router;
