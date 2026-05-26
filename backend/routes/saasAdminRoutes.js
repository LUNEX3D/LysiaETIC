/**
 * SaaS Admin Routes
 *
 * Yazılım sahibi admin paneli için tüm route'lar.
 * Sadece admin ve dev rollerine açık.
 */

const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");
const saas = require("../controllers/admin/saasAdminController");

// ─── 0. Public Endpoint — Auth gerektirmez ────────────────────────────────────
router.get("/public/plans", saas.getPublicPlans);

// Tüm diğer route'lar auth + admin gerektirir
router.use(authMiddleware, adminMiddleware);

// ─── 1. Dashboard Metrikleri ──────────────────────────────────────────────────
router.get("/dashboard", saas.getDashboardMetrics);

// ─── 2. Firma (Tenant) Yönetimi ──────────────────────────────────────────────
router.get("/tenants", saas.getTenants);
router.get("/tenants/:id", saas.getTenantDetail);
router.put("/tenants/:id/profile", saas.updateTenantProfile);
router.put("/tenants/:id/role", saas.updateUserRole);
router.post("/tenants/:id/suspend", saas.suspendTenant);
router.post("/tenants/:id/activate", saas.activateTenant);
router.post("/tenants/:id/extend-subscription", saas.extendSubscription);
router.post("/tenants/:id/ban", saas.banTenant);
router.post("/tenants/:id/reset-password", saas.adminResetPassword);
router.delete("/tenants/:id", saas.deleteTenant);

// ─── 3. Abonelik Yönetimi ────────────────────────────────────────────────────
router.get("/subscriptions", saas.getSubscriptions);
router.post("/subscriptions", saas.createSubscription);
router.put("/subscriptions/:id", saas.updateSubscription);

// ─── 4. Ödeme & Faturalandırma ───────────────────────────────────────────────
router.get("/payments", saas.getPayments);
router.post("/payments", saas.createPayment);
router.put("/payments/:id/status", saas.updatePaymentStatus);
router.post("/payments/:id/refund", saas.refundPayment);

// ─── 5. Entegrasyon Kontrolü ─────────────────────────────────────────────────
router.get("/integrations", saas.getAllIntegrations);

// ─── 6. Kullanım Limitleri ───────────────────────────────────────────────────
router.get("/usage", saas.getUsageStats);

// ─── 6b. Birim ekonomisi (kullanıcı maliyeti) ─────────────────────────────────
router.get("/unit-economics", saas.getUnitEconomics);
router.put("/unit-economics/rates", saas.updateUnitEconomicsRates);

// ─── 7. Global Raporlama ─────────────────────────────────────────────────────
router.get("/reports", saas.getGlobalReports);

// ─── 8. Bildirim & Duyuru ────────────────────────────────────────────────────
router.get("/announcements", saas.getAnnouncements);
router.post("/announcements", saas.createAnnouncement);
router.put("/announcements/:id", saas.updateAnnouncement);
router.delete("/announcements/:id", saas.deleteAnnouncement);

// ─── 9. Audit Log ────────────────────────────────────────────────────────────
router.get("/audit-logs", saas.getAuditLogs);

// ─── 10. Destek / Ticket ─────────────────────────────────────────────────────
router.get("/tickets", saas.getTickets);
router.get("/tickets/:id", saas.getTicketDetail);
router.post("/tickets/:id/reply", saas.replyTicket);
router.put("/tickets/:id/status", saas.updateTicketStatus);

// ─── 11. Sistem Ayarları ─────────────────────────────────────────────────────
router.get("/system-config", saas.getSystemConfig);

// ─── 12. Paket Tanımları Güncelleme ───────────────────────────────────────────
router.put("/plan-definitions", saas.updatePlanDefinitions);
router.post("/plan-definitions/reset-defaults", saas.resetPlanDefinitionsToDefaults);

module.exports = router;
