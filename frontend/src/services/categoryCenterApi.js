/**
 * Category Center API Service — LysiaETIC
 *
 * Kategori Merkezi frontend API çağrıları:
 *   - Master eşleştirme tablosu
 *   - Canlı kategori ağaçları
 */

import API from "./api";

const BASE = "/category-center";

// ── Master Eşleştirme Tablosu ──

/**
 * Eşleştirme tablosunu getir (sayfalı + arama)
 * @param {number} page
 * @param {number} limit
 * @param {string} query - Arama terimi
 */
export const getMappings = async (page = 1, limit = 50, query = "") => {
    const params = { page, limit };
    if (query && query.trim().length >= 2) params.q = query.trim();
    const res = await API.get(`${BASE}/mappings`, { params });
    return res.data;
};

/**
 * Eşleştirme istatistikleri
 */
export const getMappingStats = async () => {
    const res = await API.get(`${BASE}/mappings/stats`);
    return res.data;
};

/**
 * Tek bir eşleştirmeyi güncelle
 * @param {string} id - MongoDB _id
 * @param {object} updates - { hepsiburadaId, hepsiburadaPath, amazonId, amazonPath, ... }
 */
export const updateMapping = async (id, updates) => {
    const res = await API.put(`${BASE}/mappings/${id}`, updates);
    return res.data;
};

/**
 * Eşleştirme tablosunu Excel olarak dışa aktar
 * @param {string} query - Opsiyonel arama filtresi
 */
export const exportMappingsExcel = async (query = "") => {
    const params = {};
    if (query && query.trim().length >= 2) params.q = query.trim();
    const res = await API.get(`${BASE}/mappings/export`, {
        params,
        responseType: "blob"
    });
    // Dosyayı indir
    const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Dosya adını response header'dan al
    const disposition = res.headers["content-disposition"];
    let filename = `kategori_eslestirme_${new Date().toISOString().slice(0, 10)}.xlsx`;
    if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=([^;\n]*)/);
        if (match && match[1]) filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
    }

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

// ── Pazaryeri & Canlı Ağaç ──

/**
 * Kullanıcının entegre pazaryerlerini listele
 */
export const getMarketplaces = async () => {
    const res = await API.get(`${BASE}/marketplaces`);
    return res.data;
};

/**
 * Belirli pazaryerinin kategori ağacını çek (canlı API)
 * @param {string} marketplaceName
 */
export const getCategoryTree = async (marketplaceName) => {
    const res = await API.get(`${BASE}/${encodeURIComponent(marketplaceName)}/tree`);
    return res.data;
};

/**
 * Kategori ağacında arama yap
 * @param {string} marketplaceName
 * @param {string} query
 */
export const searchCategories = async (marketplaceName, query) => {
    const res = await API.get(`${BASE}/${encodeURIComponent(marketplaceName)}/search`, {
        params: { q: query }
    });
    return res.data;
};
