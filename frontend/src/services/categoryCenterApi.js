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

// ── Hepsiburada Kategori Ağacı ──

/**
 * Hepsiburada kategori ağacını çek (tree yapısında)
 * @param {string} query - Opsiyonel arama filtresi
 */
export const getHepsiburadaCategoryTree = async (query = "") => {
    const params = {};
    if (query && query.trim().length >= 2) params.q = query.trim();
    const res = await API.get(`${BASE}/hepsiburada/categories`, { params });
    return res.data;
};

/**
 * Hepsiburada kategorilerini Excel olarak dışa aktar
 * @param {string} query - Opsiyonel arama filtresi
 */
export const exportHepsiburadaCategoriesExcel = async (query = "") => {
    const params = {};
    if (query && query.trim().length >= 2) params.q = query.trim();
    const res = await API.get(`${BASE}/hepsiburada/categories/export`, {
        params,
        responseType: "blob"
    });
    const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    const disposition = res.headers["content-disposition"];
    let filename = `hb_kategoriler_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

// ── Akıllı Otomatik Eşleştirme ──

/**
 * Eşleştirme önerilerini hazırla (tek tek onay için)
 * @param {string[]} platforms - ["n11", "ciceksepeti", "hepsiburada"]
 */
export const autoMatchPrepare = async (platforms = []) => {
    const res = await API.post(`${BASE}/auto-match/prepare`, { platforms });
    return res.data;
};

/**
 * Tek bir eşleştirme önerisini onayla
 * @param {string} mappingId - MongoDB _id
 * @param {string} platform - "n11" | "ciceksepeti" | "hepsiburada"
 * @param {string|number} categoryId - Hedef kategori ID
 * @param {string} categoryPath - Hedef kategori yolu
 */
export const autoMatchApprove = async (mappingId, platform, categoryId, categoryPath) => {
    const res = await API.post(`${BASE}/auto-match/approve`, {
        mappingId, platform, categoryId, categoryPath
    });
    return res.data;
};

/**
 * Otomatik eşleştirme başlat — toplu (boş olanları doldurur)
 * @param {string[]} platforms - ["n11", "ciceksepeti", "hepsiburada"]
 */
export const autoMatch = async (platforms = []) => {
    const res = await API.post(`${BASE}/auto-match`, { platforms });
    return res.data;
};

/**
 * Eşleştirmeleri sıfırla ve yeniden eşleştir
 * @param {string[]} platforms - ["n11", "ciceksepeti", "hepsiburada"]
 */
export const autoMatchReset = async (platforms) => {
    const res = await API.post(`${BASE}/auto-match/reset`, { platforms });
    return res.data;
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

/**
 * Ürün dağıtımı için Kategori Merkezi satırından hedef platform kategori ID/yolunu çöz
 * @param {string} productId - ProductMapping _id
 * @param {string} targetPlatform - "Trendyol" | "N11" | ...
 */
export const resolveForDistribute = async (productId, targetPlatform) => {
    const res = await API.get(`${BASE}/resolve-for-distribute`, {
        params: { productId, targetPlatform }
    });
    return res.data;
};
