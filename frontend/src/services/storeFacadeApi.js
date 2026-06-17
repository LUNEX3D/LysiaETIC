import API from "./api";

const BASE = "/ec";

export async function fetchStoreFacadeCatalog() {
    const res = await API.get(`${BASE}/catalog`);
    return res.data;
}

export async function listFacadeStores() {
    const res = await API.get(`${BASE}/stores`);
    return res.data;
}

export async function createFacadeStore(body) {
    const res = await API.post(`${BASE}/stores`, body);
    return res.data;
}

export async function generateFacadeStore(body) {
    const res = await API.post(`${BASE}/stores/generate`, body);
    return res.data;
}

export async function fetchSetupProgress(siteId) {
    const res = await API.get(`${BASE}/stores/${siteId}/setup-progress`);
    return res.data;
}

export async function applyStarterKit(siteId, body) {
    const res = await API.post(`${BASE}/stores/${siteId}/apply-kit`, body);
    return res.data;
}

export async function publishFacadeStore(siteId) {
    const res = await API.post(`${BASE}/stores/${siteId}/publish`);
    return res.data;
}
