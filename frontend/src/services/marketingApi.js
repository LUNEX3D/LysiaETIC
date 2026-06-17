import API from "./api";

const BASE = "/store/marketing";

export const fetchMarketingDashboard = async (range = "7d") => {
    const res = await API.get(`${BASE}/dashboard`, { params: { range } });
    return res.data;
};

export const fetchMarketingReports = async (range = "30d") => {
    const res = await API.get(`${BASE}/reports`, { params: { range } });
    return res.data;
};

export const fetchMarketingTemplates = async () => {
    const res = await API.get(`${BASE}/templates`);
    return res.data;
};

export const fetchCampaigns = async (params = {}) => {
    const res = await API.get(`${BASE}/campaigns`, { params });
    return res.data;
};

export const createCampaign = async (body) => {
    const res = await API.post(`${BASE}/campaigns`, body);
    return res.data;
};

export const updateCampaign = async (id, body) => {
    const res = await API.patch(`${BASE}/campaigns/${id}`, body);
    return res.data;
};

export const deleteCampaign = async (id) => {
    const res = await API.delete(`${BASE}/campaigns/${id}`);
    return res.data;
};

export const sendCampaign = async (id) => {
    const res = await API.post(`${BASE}/campaigns/${id}/send`);
    return res.data;
};

export const fetchAutomations = async () => {
    const res = await API.get(`${BASE}/automations`);
    return res.data;
};

export const fetchAutomation = async (id) => {
    const res = await API.get(`${BASE}/automations/${id}`);
    return res.data;
};

export const createAutomation = async (body) => {
    const res = await API.post(`${BASE}/automations`, body);
    return res.data;
};

export const updateAutomation = async (id, body) => {
    const res = await API.patch(`${BASE}/automations/${id}`, body);
    return res.data;
};

export const deleteAutomation = async (id) => {
    const res = await API.delete(`${BASE}/automations/${id}`);
    return res.data;
};

export const fetchSegments = async () => {
    const res = await API.get(`${BASE}/segments`);
    return res.data;
};

export const createSegment = async (body) => {
    const res = await API.post(`${BASE}/segments`, body);
    return res.data;
};

export const updateSegment = async (id, body) => {
    const res = await API.patch(`${BASE}/segments/${id}`, body);
    return res.data;
};

export const deleteSegment = async (id) => {
    const res = await API.delete(`${BASE}/segments/${id}`);
    return res.data;
};

export const previewSegment = async (rules) => {
    const res = await API.post(`${BASE}/segments/preview`, { rules });
    return res.data;
};

export const refreshSegment = async (id) => {
    const res = await API.post(`${BASE}/segments/${id}/refresh`);
    return res.data;
};

export const fetchPopups = async () => {
    const res = await API.get(`${BASE}/popups`);
    return res.data;
};

export const createPopup = async (body) => {
    const res = await API.post(`${BASE}/popups`, body);
    return res.data;
};

export const updatePopup = async (id, body) => {
    const res = await API.patch(`${BASE}/popups/${id}`, body);
    return res.data;
};

export const deletePopup = async (id) => {
    const res = await API.delete(`${BASE}/popups/${id}`);
    return res.data;
};

export const fetchAffiliates = async () => {
    const res = await API.get(`${BASE}/affiliates`);
    return res.data;
};

export const createAffiliate = async (body) => {
    const res = await API.post(`${BASE}/affiliates`, body);
    return res.data;
};

export const updateAffiliate = async (id, body) => {
    const res = await API.patch(`${BASE}/affiliates/${id}`, body);
    return res.data;
};

export const deleteAffiliate = async (id) => {
    const res = await API.delete(`${BASE}/affiliates/${id}`);
    return res.data;
};

export const fetchMarketingSettings = async () => {
    const res = await API.get(`${BASE}/settings`);
    return res.data;
};

export const updateMarketingSettings = async (body) => {
    const res = await API.put(`${BASE}/settings`, body);
    return res.data;
};
