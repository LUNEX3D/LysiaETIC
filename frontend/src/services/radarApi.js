/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR API SERVICE — LysiaRadar PRO Frontend
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Backend /api/radar endpoint'leri ile iletişim.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import API from "./api";

/**
 * Kullanıcıya özel fırsatları getir
 * @param {object} [filters] - { category, minScore, sortBy, expansionType }
 */
export const getOpportunities = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.minScore) params.set("minScore", String(filters.minScore));
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.expansionType) params.set("expansionType", filters.expansionType);

    const qs = params.toString();
    const url = `/radar/opportunities${qs ? `?${qs}` : ""}`;
    const res = await API.get(url);
    return res.data;
};

/**
 * Fırsatları yeniden analiz et (refresh)
 */
export const refreshOpportunities = async () => {
    const res = await API.post("/radar/opportunities/refresh");
    return res.data;
};

/**
 * Tek fırsat detayı getir
 * @param {string} id - Fırsat ID
 */
export const getOpportunityDetail = async (id) => {
    const res = await API.get(`/radar/opportunities/${id}`);
    return res.data;
};

/**
 * Fırsat aksiyonu kaydet
 * @param {string} id - Fırsat ID
 * @param {string} action - "viewed" | "simulated" | "added_to_store" | "dismissed"
 */
export const recordOpportunityAction = async (id, action) => {
    const res = await API.post(`/radar/opportunities/${id}/action`, { action });
    return res.data;
};

/**
 * Radar istatistikleri
 */
export const getRadarStats = async () => {
    const res = await API.get("/radar/stats");
    return res.data;
};

/**
 * Fırsat simülasyonu
 * @param {object} params - { opportunityId, investmentAmount, targetPrice, estimatedMonthlySales }
 */
export const simulateOpportunity = async (params) => {
    const res = await API.post("/radar/simulate", params);
    return res.data;
};

/**
 * Ürün bazlı fırsatları getir
 * @param {object} [filters] - { minScore, sortBy, limit }
 */
export const getProductOpportunities = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.minScore) params.set("minScore", String(filters.minScore));
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.limit) params.set("limit", String(filters.limit));

    const qs = params.toString();
    const url = `/radar/products${qs ? `?${qs}` : ""}`;
    const res = await API.get(url);
    return res.data;
};
