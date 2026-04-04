/**
 * Notification Routes — LysiaETIC
 *
 * Kullanıcı bildirimleri, admin broadcast, AI bildirimleri
 */
const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/notificationController");

// ── Tüm route'lar auth gerektirir ──
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════
// 📥 KULLANICI BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════
router.get("/",              ctrl.getNotifications);           // Bildirimleri getir
router.put("/:id/read",     ctrl.markAsRead);                 // Okundu işaretle (id="all" destekler)
router.delete("/:id",       ctrl.dismissNotification);        // Bildirim sil/dismiss (id="all" destekler)

// ═══════════════════════════════════════════════════════════════
// 📦 SİPARİŞ BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════
router.post("/order",        ctrl.createOrderNotification);    // Tek sipariş bildirimi
router.post("/orders/bulk",  ctrl.createBulkOrderNotifications); // Toplu sipariş bildirimi

// ═══════════════════════════════════════════════════════════════
// 🧠 AI BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════
router.post("/ai",           ctrl.createAINotification);       // AI bildirimi oluştur

// ═══════════════════════════════════════════════════════════════
// 🛡️ ADMİN BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════
router.post("/admin/send",   adminMiddleware, ctrl.sendAdminNotification);  // Admin bildirim gönder
router.get("/admin/all",     adminMiddleware, ctrl.getAdminNotifications);  // Tüm bildirimleri gör

module.exports = router;
