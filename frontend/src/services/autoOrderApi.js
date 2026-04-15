/**
 * autoOrderApi.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════════
 * Otomatik Sipariş İşleme API Servisi
 * Backend: /api/auto-order
 * ═══════════════════════════════════════════════════════════════
 */
import API from "./api";

const BASE = "/auto-order";

/** Tüm pazaryerleri için config'leri getir */
export const getAutoOrderConfigs = async () => {
    const res = await API.get(`${BASE}/configs`);
    return res.data;
};

/** Tek pazaryeri config getir */
export const getAutoOrderConfig = async (marketplaceId) => {
    const res = await API.get(`${BASE}/configs/${marketplaceId}`);
    return res.data;
};

/** Config güncelle (kargo ayarları) */
export const updateAutoOrderConfig = async (marketplaceId, data) => {
    const res = await API.put(`${BASE}/configs/${marketplaceId}`, data);
    return res.data;
};

/** Tek pazaryeri için siparişleri işle (manuel tetikleme) */
export const processMarketplaceOrders = async (marketplaceId) => {
    const res = await API.post(`${BASE}/process/${marketplaceId}`);
    return res.data;
};

/** Tüm aktif pazaryerlerini işle */
export const processAllOrders = async () => {
    const res = await API.post(`${BASE}/process-all`);
    return res.data;
};

/** Pazaryerine göre kargo şirketleri listesi */
export const getCargoCompanies = async (marketplaceId) => {
    const res = await API.get(`${BASE}/cargo-companies/${marketplaceId}`);
    return res.data;
};

/** Genel durum özeti */
export const getAutoOrderStatus = async () => {
    const res = await API.get(`${BASE}/status`);
    return res.data;
};
