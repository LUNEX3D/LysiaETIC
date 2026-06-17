/**
 * Eksikleri Dağıt — arka planda devam eden job takibi (sessionStorage)
 */

const STORAGE_KEY = "lysia_missing_dist_job";
const listeners = new Set();

export const getStoredMissingDistJob = () => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const setStoredMissingDistJob = (data) => {
    if (!data?.jobId) {
        sessionStorage.removeItem(STORAGE_KEY);
    } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    listeners.forEach((fn) => {
        try {
            fn(getStoredMissingDistJob());
        } catch {
            /* ignore */
        }
    });
};

export const clearStoredMissingDistJob = () => setStoredMissingDistJob(null);

export const subscribeMissingDistJob = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export const isActiveJobStatus = (status) => status === "running" || status === "paused";
