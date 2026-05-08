const LEGACY_KEY = "clientErrorLog";
const MAX_ITEMS = 150;

const safeParse = (raw) => {
    try {
        const parsed = JSON.parse(raw || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/** Aktif kullanıcıya göre depolama anahtarı — paylaşılan tarayıcıda başka kullanıcının kayıtları görünmez */
export const getClientErrorStorageKey = () => {
    if (typeof window === "undefined") return LEGACY_KEY;
    const uid = localStorage.getItem("userId");
    return uid ? `${LEGACY_KEY}:${uid}` : LEGACY_KEY;
};

function migrateLegacyToUser() {
    if (typeof window === "undefined") return;
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    const userKey = `${LEGACY_KEY}:${uid}`;
    if (localStorage.getItem(userKey)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    localStorage.setItem(userKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
}

export const getClientErrors = () => {
    if (typeof window === "undefined") return [];
    migrateLegacyToUser();
    return safeParse(localStorage.getItem(getClientErrorStorageKey()));
};

export const clearClientErrors = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(getClientErrorStorageKey());
    window.dispatchEvent(new CustomEvent("client-errors:changed"));
};

/**
 * @param {object} errorPayload — API / istemci hatası
 * @param {string} [errorPayload.source] — örn. api, product_upload, marketplace
 */
export const pushClientError = (errorPayload) => {
    if (typeof window === "undefined") return;
    migrateLegacyToUser();
    const current = getClientErrors();
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toISOString(),
        kind: "error",
        ...errorPayload,
    };
    const next = [entry, ...current.filter((x) => x.id !== entry.id)].slice(0, MAX_ITEMS);
    localStorage.setItem(getClientErrorStorageKey(), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("client-errors:changed"));
};

/**
 * Son işlemler — başarı / bilgi kayıtları
 * @param {object} opts
 * @param {string} opts.source
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {'success'|'info'|'warning'} [opts.level]
 * @param {object} [opts.meta]
 */
export const pushUserActivity = (opts = {}) => {
    if (typeof window === "undefined") return;
    migrateLegacyToUser();
    const current = getClientErrors();
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toISOString(),
        kind: "activity",
        source: String(opts.source || "ui").slice(0, 40),
        title: String(opts.title || "").slice(0, 200),
        message: String(opts.message || "").slice(0, 500),
        level: ["success", "info", "warning"].includes(opts.level) ? opts.level : "info",
        meta: typeof opts.meta === "object" && opts.meta !== null ? opts.meta : {},
    };
    const next = [entry, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(getClientErrorStorageKey(), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("client-errors:changed"));
};

export const removeClientErrorsByIds = (ids = []) => {
    if (typeof window === "undefined" || !Array.isArray(ids) || ids.length === 0) return;
    migrateLegacyToUser();
    const set = new Set(ids);
    const next = getClientErrors().filter((x) => !set.has(x.id));
    localStorage.setItem(getClientErrorStorageKey(), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("client-errors:changed"));
};
