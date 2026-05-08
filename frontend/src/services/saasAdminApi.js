/**
 * SaaS Admin API Service
 * Tüm SaaS admin panel endpoint'leri için merkezi API servisi
 */
import API from "./api";

const BASE = "/saas-admin";

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────
export const getDashboardMetrics = () => API.get(`${BASE}/dashboard`);

// ─── 2. Firma (Tenant) Yönetimi ──────────────────────────────────────────────
export const getTenants = () => API.get(`${BASE}/tenants`);
export const getTenantDetail = (id) => API.get(`${BASE}/tenants/${id}`);
export const updateTenantProfile = (id, data) => API.put(`${BASE}/tenants/${id}/profile`, data);
export const updateUserRole = (id, role) => API.put(`${BASE}/tenants/${id}/role`, { role });
export const suspendTenant = (id, reason) => API.post(`${BASE}/tenants/${id}/suspend`, { reason });
export const activateTenant = (id) => API.post(`${BASE}/tenants/${id}/activate`);
export const extendSubscription = (id, data) => API.post(`${BASE}/tenants/${id}/extend-subscription`, data);
export const banTenant = (id, reason) => API.post(`${BASE}/tenants/${id}/ban`, { reason });
export const adminResetPassword = (id, newPassword) => API.post(`${BASE}/tenants/${id}/reset-password`, { newPassword });
export const deleteTenant = (id) => API.delete(`${BASE}/tenants/${id}`);

// ─── 3. Abonelik Yönetimi ────────────────────────────────────────────────────
export const getSubscriptions = () => API.get(`${BASE}/subscriptions`);
export const createSubscription = (data) => API.post(`${BASE}/subscriptions`, data);
export const updateSubscription = (id, data) => API.put(`${BASE}/subscriptions/${id}`, data);

// ─── 4. Ödeme & Faturalandırma ───────────────────────────────────────────────
export const getPayments = () => API.get(`${BASE}/payments`);
export const createPayment = (data) => API.post(`${BASE}/payments`, data);
export const updatePaymentStatus = (id, status, refundReason) => API.put(`${BASE}/payments/${id}/status`, { status, refundReason });

// ─── 5. Entegrasyon Kontrolü ─────────────────────────────────────────────────
export const getAllIntegrations = () => API.get(`${BASE}/integrations`);

// ─── 6. Kullanım Limitleri ───────────────────────────────────────────────────
export const getUsageStats = () => API.get(`${BASE}/usage`);

// ─── 7. Global Raporlama ─────────────────────────────────────────────────────
export const getGlobalReports = () => API.get(`${BASE}/reports`);

// ─── 8. Bildirim & Duyuru ────────────────────────────────────────────────────
export const getAnnouncements = () => API.get(`${BASE}/announcements`);
export const createAnnouncement = (data) => API.post(`${BASE}/announcements`, data);
export const updateAnnouncement = (id, data) => API.put(`${BASE}/announcements/${id}`, data);
export const deleteAnnouncement = (id) => API.delete(`${BASE}/announcements/${id}`);

// ─── 8b. Anlık Bildirim Gönderme (Notification sistemi) ──────────────────────
export const sendAdminNotification = (data) => API.post("/notifications/admin/send", data);
export const getAdminAllNotifications = (params) => API.get("/notifications/admin/all", { params });

// ─── 9. Audit Log ────────────────────────────────────────────────────────────
export const getAuditLogs = (params) => API.get(`${BASE}/audit-logs`, { params });

// ─── 10. Destek / Ticket ─────────────────────────────────────────────────────
export const getTickets = () => API.get(`${BASE}/tickets`);
export const getTicketDetail = (id) => API.get(`${BASE}/tickets/${id}`);
export const replyTicket = (id, message) => API.post(`${BASE}/tickets/${id}/reply`, { message });
export const updateTicketStatus = (id, status) => API.put(`${BASE}/tickets/${id}/status`, { status });

// ─── 11. Sistem Ayarları ─────────────────────────────────────────────────────
export const getSystemConfig = () => API.get(`${BASE}/system-config`);

// ─── 12. Paket Tanımları Güncelleme ───────────────────────────────────────────
export const updatePlanDefinitions = (planDefinitions) => API.put(`${BASE}/plan-definitions`, { planDefinitions });

// ─── 13. Public Paket Bilgileri (Auth gerektirmez) ────────────────────────────
export const getPublicPlans = () => API.get(`${BASE}/public/plans`);

// ─── 14. İstemci Hata Kayıtları (Admin) ───────────────────────────────────────
export const getClientErrorsAdmin = (params) => API.get("/client-errors/admin", { params });
