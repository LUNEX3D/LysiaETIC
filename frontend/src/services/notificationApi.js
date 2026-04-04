/**
 * Notification API Service — LysiaETIC
 *
 * Bildirim sistemi frontend API çağrıları
 */
import API from "./api";

const BASE = "/notifications";

// ═══════════════════════════════════════════════════════════════
// 📥 BİLDİRİMLERİ GETİR
// ═══════════════════════════════════════════════════════════════

/**
 * Kullanıcının bildirimlerini getir
 * @param {Object} params - { lastCheck, type, limit }
 */
export const getNotifications = async (params = {}) => {
    const res = await API.get(BASE, { params });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// ✅ OKUNDU İŞARETLE
// ═══════════════════════════════════════════════════════════════

/**
 * Tek bildirimi okundu işaretle
 * @param {string} notificationId - Bildirim ID veya "all"
 */
export const markNotificationAsRead = async (notificationId) => {
    const res = await API.put(`${BASE}/${notificationId}/read`);
    return res.data;
};

/**
 * Tüm bildirimleri okundu işaretle
 */
export const markAllNotificationsRead = async () => {
    const res = await API.put(`${BASE}/all/read`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🗑️ BİLDİRİM SİL
// ═══════════════════════════════════════════════════════════════

/**
 * Bildirimi sil/dismiss
 * @param {string} notificationId - Bildirim ID veya "all"
 */
export const dismissNotification = async (notificationId) => {
    const res = await API.delete(`${BASE}/${notificationId}`);
    return res.data;
};

/**
 * Tüm bildirimleri temizle
 */
export const dismissAllNotifications = async () => {
    const res = await API.delete(`${BASE}/all`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📦 SİPARİŞ BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * Toplu sipariş bildirimi oluştur
 * @param {Array} orders - [{ orderNumber, marketplace, totalPrice, itemCount, customerName, status }]
 */
export const createBulkOrderNotifications = async (orders) => {
    const res = await API.post(`${BASE}/orders/bulk`, { orders });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🧠 AI BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * AI bildirimi oluştur
 * @param {Object} data - { title, message, priority, category, actionRequired, relatedProductId, confidence, suggestedAction }
 */
export const createAINotification = async (data) => {
    const res = await API.post(`${BASE}/ai`, data);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🛡️ ADMİN BİLDİRİMLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * Admin bildirim gönder
 * @param {Object} data - { title, message, priority, targetAudience, targetUserIds, targetPlan, expiresAt, icon }
 */
export const sendAdminNotification = async (data) => {
    const res = await API.post(`${BASE}/admin/send`, data);
    return res.data;
};

/**
 * Admin — tüm bildirimleri getir
 * @param {Object} params - { type, limit, page }
 */
export const getAdminAllNotifications = async (params = {}) => {
    const res = await API.get(`${BASE}/admin/all`, { params });
    return res.data;
};
