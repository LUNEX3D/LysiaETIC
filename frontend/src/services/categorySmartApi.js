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

/** Toplu mapping kaydet (birden fazla platform için) */
export const bulkSaveMappings = async (internalCategoryId, mappings) => {
    const res = await API.post(`${BASE}/mappings/bulk`, { internalCategoryId, mappings });
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
// 🔍 FUZZY KATEGORİ EŞLEŞTİRME
// ═══════════════════════════════════════════════════════════════

/** Fuzzy kategori eşleştirme */
export const fuzzyMatchCategory = async (sourceName, targetMarketplace, limit = 5) => {
    const res = await API.post(`${BASE}/fuzzy-match`, { sourceName, targetMarketplace, limit });
    return res.data;
};

/** Tüm kategorileri otomatik eşleştir */
export const autoMapAllCategories = async (targetMarketplaces, minScore = 0.45) => {
    const res = await API.post(`${BASE}/auto-map-all`, { targetMarketplaces, minScore });
    return res.data;
};

/** Çapraz platform eşleştirme - bir platformu baz alarak diğerlerine eşleştir */
export const crossPlatformMatch = async (sourcePlatform, targetPlatforms, minScore = 0.45) => {
    const res = await API.post(`${BASE}/cross-platform-match`, { sourcePlatform, targetPlatforms, minScore });
    return res.data;
};

/** Ürün dağıtımı için kategori çözümle */
export const resolveProductCategory = async (internalCategoryId, targetMarketplace) => {
    const res = await API.post(`${BASE}/resolve-category`, { internalCategoryId, targetMarketplace });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🌐 PLATFORM KATEGORİLERİ
// ═══════════════════════════════════════════════════════════════

/** Platform kategorilerini çek */
export const getPlatformCategories = async (marketplace, search = "") => {
    const params = { marketplace };
    if (search) params.search = search;
    const res = await API.get(`${BASE}/platform-categories`, { params });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🧬 ATTRIBUTE MAPPING
// ═══════════════════════════════════════════════════════════════

/** Attribute mapping'leri getir */
export const getAttributeMappings = async (mappingId) => {
    const res = await API.get(`${BASE}/attributes/${mappingId}`);
    return res.data;
};

/** Attribute mapping kaydet */
export const saveAttributeMapping = async (data) => {
    const res = await API.post(`${BASE}/attributes`, data);
    return res.data;
};

/** Attribute mapping sil */
export const deleteAttributeMapping = async (id) => {
    const res = await API.delete(`${BASE}/attributes/${id}`);
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

// ═══════════════════════════════════════════════════════════════
// 📋 EŞLEŞMEMİŞ KATEGORİLER (Ürün dağıtımında başarısız olanlar)
// ═══════════════════════════════════════════════════════════════

/** Eşleşmemiş kategorileri getir (ürün dağıtımında başarısız olanlar) */
export const getUnmappedCategories = async (marketplace = "N11", includeResolved = false) => {
    const params = { marketplace };
    if (includeResolved) params.includeResolved = "true";
    const res = await API.get("/marketplace/n11/unmapped-categories", { params });
    return res.data;
};

/** Eşleşmemiş kategoriyi çöz — hem InternalCategoryMapping'e kaydet hem UnmappedCategory'yi resolved yap */
export const resolveUnmappedCategory = async (data) => {
    const res = await API.post(`${BASE}/resolve-unmapped`, data);
    return res.data;
};

/** Tüm eşleşmemiş kategorileri otomatik çözmeye çalış */
export const autoResolveUnmapped = async (marketplace = "N11", minScore = 0.6) => {
    const res = await API.post(`${BASE}/auto-resolve-unmapped`, { marketplace, minScore });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📦 PAZAR YERİ KATEGORİ LİSTELEME & EXPORT
// ═══════════════════════════════════════════════════════════════

/** Pazar yeri kategorilerini listele (flat, ID + path ile) */
export const getMarketplaceCategories = async (marketplace = "all", search = "", leafOnly = false, page = 1, limit = 100) => {
    const params = { marketplace, page, limit };
    if (search) params.search = search;
    if (leafOnly) params.leafOnly = "true";
    const res = await API.get(`${BASE}/marketplace-categories`, { params });
    return res.data;
};

/** Pazar yeri kategorilerini Excel olarak indir */
export const exportMarketplaceCategoriesExcel = async (marketplace = "all", search = "", leafOnly = false) => {
    const params = { marketplace };
    if (search) params.search = search;
    if (leafOnly) params.leafOnly = "true";
    const res = await API.get(`${BASE}/marketplace-categories/export/excel`, {
        params,
        responseType: "blob"
    });
    return res;
};

/** Pazar yeri kategorilerini PDF olarak indir */
export const exportMarketplaceCategoriesPDF = async (marketplace = "all", search = "", leafOnly = false) => {
    const params = { marketplace };
    if (search) params.search = search;
    if (leafOnly) params.leafOnly = "true";
    const res = await API.get(`${BASE}/marketplace-categories/export/pdf`, {
        params,
        responseType: "blob"
    });
    return res;
};

// ═══════════════════════════════════════════════════════════════
// 🧠 SMART RESOLVER — Unified Category Resolution Pipeline (v2)
// ═══════════════════════════════════════════════════════════════

/**
 * Tek ürün için 4 adımlı akıllı kategori çözümleme.
 * Pipeline: Exact → Learned → Hybrid AI (Embedding + Keyword + Historical) → Fallback
 */
export const smartResolve = async (product, marketplace) => {
    const res = await API.post(`${BASE}/smart-resolve`, { product, marketplace });
    return res.data;
};

/**
 * Toplu ürün için akıllı kategori çözümleme.
 * @param {Array} products - [{ title, category, brand, description }]
 * @param {string} marketplace - "Trendyol" | "N11" | "Hepsiburada" | "Amazon" | "ÇiçekSepeti"
 */
export const smartResolveBatch = async (products, marketplace) => {
    const res = await API.post(`${BASE}/smart-resolve-batch`, { products, marketplace });
    return res.data;
};

/** Resolver pipeline istatistikleri */
export const getResolverStats = async () => {
    const res = await API.get(`${BASE}/resolver-stats`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🗺️ BİRLEŞİK KATEGORİ HARİTASI (Unified Category Map)
// ═══════════════════════════════════════════════════════════════

/** 3 platformun Excel'lerini upload edip birleşik haritayı oluştur */
export const importUnifiedCategories = async (formData) => {
    const res = await API.post(`${BASE}/unified/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000
    });
    return res.data;
};

/** Birleşik kategori haritasını listele */
export const getUnifiedCategories = async (params = {}) => {
    const res = await API.get(`${BASE}/unified`, { params });
    return res.data;
};

/** Birleşik kategori haritası istatistikleri */
export const getUnifiedStats = async () => {
    const res = await API.get(`${BASE}/unified/stats`);
    return res.data;
};

/** İki kaydı manuel olarak birleştir */
export const mergeUnifiedCategories = async (targetId, sourceId) => {
    const res = await API.post(`${BASE}/unified/merge`, { targetId, sourceId });
    return res.data;
};

/** Birleşik kategori kaydını sil */
export const deleteUnifiedCategory = async (id) => {
    const res = await API.delete(`${BASE}/unified/${id}`);
    return res.data;
};

/** Birleşik kategori haritasını Excel olarak indir */
export const exportUnifiedCategoriesExcel = async (params = {}) => {
    const res = await API.get(`${BASE}/unified/export/excel`, {
        params,
        responseType: "blob"
    });
    return res;
};
