/**
 * CATEGORY MAPPING API SERVİSİ
 *
 * Backend endpoint'leri:
 *   GET  /api/marketplace/n11/unmapped-categories
 *   GET  /api/marketplace/n11/unmapped-categories/stats
 *   GET  /api/marketplace/n11/category-mappings
 *   POST /api/marketplace/n11/category-mapping
 *   DELETE /api/marketplace/n11/category-mapping/:id
 *   POST /api/marketplace/n11/category-suggest
 *   GET  /api/marketplace/n11/categories
 *   GET  /api/marketplace/n11/categories/:id/attributes
 */

import API from "./api";

const BASE = "/marketplace/n11";

// ─── Unmapped Kategoriler ─────────────────────────────────────────────────────

/** Eşleştirilemeyen kategorileri getir */
export const getUnmappedCategories = async (includeResolved = false) => {
    const res = await API.get(`${BASE}/unmapped-categories`, {
        params: { includeResolved }
    });
    return res.data;
};

/** Unmapped kategori istatistikleri */
export const getUnmappedStats = async () => {
    const res = await API.get(`${BASE}/unmapped-categories/stats`);
    return res.data;
};

// ─── Kategori Mapping CRUD ────────────────────────────────────────────────────

/** Kayıtlı tüm mapping'leri getir */
export const getCategoryMappings = async () => {
    const res = await API.get(`${BASE}/category-mappings`);
    return res.data;
};

/**
 * Yeni kategori mapping kaydet
 * @param {string} sourceCategory   - Kaynak kategori adı (örn: "İnci Set")
 * @param {number} categoryId       - N11 kategori ID
 * @param {string} categoryName     - N11 kategori adı (örn: "Takı > Set")
 * @param {string} marketplace      - Hedef pazaryeri (varsayılan: "N11")
 */
export const saveCategoryMapping = async (sourceCategory, categoryId, categoryName, marketplace = "N11") => {
    const res = await API.post(`${BASE}/category-mapping`, {
        sourceCategory,
        categoryId,
        categoryName,
        marketplace
    });
    return res.data;
};

/** Kategori mapping sil */
export const deleteCategoryMapping = async (id) => {
    const res = await API.delete(`${BASE}/category-mapping/${id}`);
    return res.data;
};

// ─── Öneri Sistemi ────────────────────────────────────────────────────────────

/**
 * Ürün bilgisine göre N11 kategori önerisi al
 * @param {string} title    - Ürün başlığı
 * @param {string} category - Kaynak kategori adı
 * @param {string} brand    - Marka
 */
export const suggestCategory = async (title, category, brand = "") => {
    const res = await API.post(`${BASE}/category-suggest`, { title, category, brand });
    return res.data;
};

// ─── N11 Kategori Ağacı ───────────────────────────────────────────────────────

/** N11 kategori ağacını çek */
export const getN11Categories = async () => {
    const res = await API.get(`${BASE}/categories`);
    return res.data;
};

/** N11 kategori attribute'larını çek */
export const getN11CategoryAttributes = async (categoryId) => {
    const res = await API.get(`${BASE}/categories/${categoryId}/attributes`);
    return res.data;
};
