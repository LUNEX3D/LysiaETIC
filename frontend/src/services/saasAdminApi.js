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
export const suspendTenant = (id, reason) => API.post(`${BASE}/tenants/${id}/suspend`, { reason });
export const activateTenant = (id) => API.post(`${BASE}/tenants/${id}/activate`);
export const banTenant = (id, reason) => API.post(`${BASE}/tenants/${id}/ban`, { reason });
export const adminResetPassword = (id, newPassword) => API.post(`${BASE}/tenants/${id}/reset-password`, { newPassword });

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

// ─── 9. Audit Log ────────────────────────────────────────────────────────────
export const getAuditLogs = (params) => API.get(`${BASE}/audit-logs`, { params });

// ─── 10. Destek / Ticket ─────────────────────────────────────────────────────
export const getTickets = () => API.get(`${BASE}/tickets`);
export const getTicketDetail = (id) => API.get(`${BASE}/tickets/${id}`);
export const replyTicket = (id, message) => API.post(`${BASE}/tickets/${id}/reply`, { message });
export const updateTicketStatus = (id, status) => API.put(`${BASE}/tickets/${id}/status`, { status });

// ─── 11. Sistem Ayarları ─────────────────────────────────────────────────────
export const getSystemConfig = () => API.get(`${BASE}/system-config`);
