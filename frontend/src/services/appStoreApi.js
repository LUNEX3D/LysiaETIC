import API from "./api";

const BASE = "/apps";

export const fetchAppCatalog = async (params = {}) => {
    const res = await API.get(`${BASE}/catalog`, { params });
    return res.data;
};

export const fetchInstalledApps = async () => {
    const res = await API.get(`${BASE}/installed`);
    return res.data;
};

export const installApp = async (appKey) => {
    const res = await API.post(`${BASE}/install`, { appKey });
    return res.data;
};

export const uninstallApp = async (appKey) => {
    const res = await API.delete(`${BASE}/install/${encodeURIComponent(appKey)}`);
    return res.data;
};
