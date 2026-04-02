/**
 * AKILLI KATEGORİ EŞLEŞTİRME API SERVİSİ
 *
 * Backend: /api/category-smart/*
 */

import API from "./api";

const BASE = "/category-smart";

// ═══════════════════════════════════════════════════════════════
// 📁 DAHİLİ KATEGORİLER
// ═══════════════════════════════════════════════════════════════

/** Tüm dahili kategorileri getir (hiyerarşik + flat) */
export const getInternalCategories = async () => {
    const res = await API.get(`${BASE}/internal`);
    return res.data;
};

/** Yeni dahili kategori oluştur */
export const createInternalCategory = async (data) => {
    const res = await API.post(`${BASE}/internal`, data);
    return res.data;
};

/** Dahili kategori güncelle */
export const updateInternalCategory = async (id, data) => {
    const res = await API.put(`${BASE}/internal/${id}`, data);
    return res.data;
};

/** Dahili kategori sil */
export const deleteInternalCategory = async (id) => {
    const res = await API.delete(`${BASE}/internal/${id}`);
    return res.data;
};

/** Varsayılan kategorileri oluştur (seed) */
export const seedInternalCategories = async () => {
    const res = await API.post(`${BASE}/internal/seed`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🔗 KATEGORİ MAPPING (Dahili → Pazaryeri)
// ═══════════════════════════════════════════════════════════════

/** Tüm mapping'leri getir */
export const getCategoryMappings = async (marketplace = "") => {
    const params = {};
    if (marketplace) params.marketplace = marketplace;
    const res = await API.get(`${BASE}/mappings`, { params });
    return res.data;
};

/** Yeni mapping kaydet */
export const saveCategoryMapping = async (data) => {
    const res = await API.post(`${BASE}/mappings`, data);
    return res.data;
};

/** Mapping sil */
export const deleteCategoryMapping = async (id) => {
    const res = await API.delete(`${BASE}/mappings/${id}`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🤖 OTOMATİK EŞLEŞTİRME & ÖĞRENME
// ═══════════════════════════════════════════════════════════════

/** Tek ürün için otomatik eşleştirme */
export const autoMatchCategory = async (title, description = "", category = "", brand = "") => {
    const res = await API.post(`${BASE}/auto-match`, { title, description, category, brand });
    return res.data;
};

/** Toplu otomatik eşleştirme */
export const bulkMatchCategories = async (products) => {
    const res = await API.post(`${BASE}/bulk-match`, { products });
    return res.data;
};

/** Kullanıcı seçimini kaydet (öğren) */
export const learnCategory = async (pattern, internalCategoryId) => {
    const res = await API.post(`${BASE}/learn`, { pattern, internalCategoryId });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🧠 HAFIZA & İSTATİSTİK
// ═══════════════════════════════════════════════════════════════

/** Kullanıcı hafızasını getir */
export const getCategoryMemory = async () => {
    const res = await API.get(`${BASE}/memory`);
    return res.data;
};

/** Hafıza kaydı sil */
export const deleteCategoryMemory = async (id) => {
    const res = await API.delete(`${BASE}/memory/${id}`);
    return res.data;
};

/** İstatistikleri getir */
export const getCategoryStats = async () => {
    const res = await API.get(`${BASE}/stats`);
    return res.data;
};
