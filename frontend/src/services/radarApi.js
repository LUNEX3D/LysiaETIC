/**
 * Dashtock Radar — /api/radar (AI Fırsat Motoru)
 */
import API from "./api";

/** axios body: { success, data: { ... } } veya doğrudan { opportunities } */
export const unwrapRadar = (res) => {
    const body = res?.data ?? res ?? {};
    if (body?.data && typeof body.data === "object" && !Array.isArray(body.data)) {
        return body.data;
    }
    return body;
};

export const getOpportunities = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.minScore) params.set("minScore", String(filters.minScore));
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.expansionType) params.set("expansionType", filters.expansionType);
    const qs = params.toString();
    const res = await API.get(`/radar/opportunities${qs ? `?${qs}` : ""}`);
    return res.data;
};

export const refreshOpportunities = async () => {
    const res = await API.post("/radar/opportunities/refresh");
    return res.data;
};

export const getOpportunityDetail = async (id) => {
    const res = await API.get(`/radar/opportunities/${id}`);
    return res.data;
};

export const recordOpportunityAction = async (id, action) => {
    const res = await API.post(`/radar/opportunities/${id}/action`, { action });
    return res.data;
};

export const getRadarStats = async () => {
    const res = await API.get("/radar/stats");
    return res.data;
};

export const simulateOpportunity = async (params) => {
    const res = await API.post("/radar/simulate", params);
    return res.data;
};

export const getProductOpportunities = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.minScore) params.set("minScore", String(filters.minScore));
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const res = await API.get(`/radar/products${qs ? `?${qs}` : ""}`);
    return res.data;
};

export const getGoogleTrends = async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await API.get(`/radar/trends/google${q ? `?${q}` : ""}`);
    return res.data;
};

export const getSocialTrends = async (keyword) => {
    const res = await API.get(`/radar/trends/social/${encodeURIComponent(keyword)}`);
    return res.data;
};

export const getArbitrageOpportunities = async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await API.get(`/radar/arbitrage${q ? `?${q}` : ""}`);
    return res.data;
};

export const getTrendingKeywords = async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await API.get(`/radar/keywords/trending${q ? `?${q}` : ""}`);
    return res.data;
};

export const getDataSourceStatus = async () => {
    const res = await API.get("/radar/data-sources");
    return res.data;
};
