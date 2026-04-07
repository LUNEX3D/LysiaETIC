/**
 * KATEGORİ HATA MERKEZİ API SERVİSİ
 *
 * Backend: /api/category-errors/*
 *
 * Ürün dağıtımında kategori hatası alan ürünlerin yönetimi:
 *   - Hata listesi (platform filtreli)
 *   - Platform kategorilerini arama (açılır-kapanır ağaç)
 *   - Kategori seçimi + kaydet + tekrar gönder
 *   - İstatistikler
 */

import API from "./api";

const BASE = "/category-errors";

// ═══════════════════════════════════════════════════════════════
// 📋 HATA LİSTESİ
// ═══════════════════════════════════════════════════════════════

/**
 * Kategori hatalarını listele
 * @param {Object} params - { marketplace, resolved, page, limit }
 */
export const getCategoryErrors = async (params = {}) => {
    const res = await API.get(BASE, { params });
    return res.data;
};

/**
 * Kategori hata istatistikleri
 */
export const getCategoryErrorStats = async () => {
    const res = await API.get(`${BASE}/stats`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🔍 PLATFORM KATEGORİLERİ (Arama + Ağaç)
// ═══════════════════════════════════════════════════════════════

/**
 * Platform kategorilerini ara / ağaç yapısında getir
 * @param {string} marketplace - Platform adı (zorunlu)
 * @param {Object} options - { search, parentId, leafOnly }
 */
export const searchPlatformCategories = async (marketplace, options = {}) => {
    const params = { marketplace, ...options };
    const res = await API.get(`${BASE}/platform-categories`, { params });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// ✅ ÇÖZÜMLEME & TEKRAR GÖNDERİM
// ═══════════════════════════════════════════════════════════════

/**
 * Kategori hatasını çözümle — kategori seç + kaydet + tekrar gönder
 * @param {Object} data - { errorId, categoryId, categoryName, categoryPath, autoRetry }
 */
export const resolveCategoryError = async (data) => {
    const res = await API.post(`${BASE}/resolve`, data);
    return res.data;
};

/**
 * Çözümlenmiş ama gönderim başarısız olan ürünü tekrar gönder
 * @param {string} errorId
 */
export const retryCategoryError = async (errorId) => {
    const res = await API.post(`${BASE}/retry`, { errorId });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🗑️ SİLME & TEMİZLEME
// ═══════════════════════════════════════════════════════════════

/**
 * Tek hata kaydını sil
 * @param {string} id
 */
export const deleteCategoryError = async (id) => {
    const res = await API.delete(`${BASE}/${id}`);
    return res.data;
};

/**
 * Çözülmüş tüm hataları temizle
 */
export const clearResolvedErrors = async () => {
    const res = await API.delete(`${BASE}/clear/resolved`);
    return res.data;
};
