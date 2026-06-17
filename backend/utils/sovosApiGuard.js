/**
 * Sovos WS çağrı koruması — hatalı/yoğun istekleri önler.
 * Resmi dokümantasyon: getUBLList tarih aralığı en fazla 1 gün; uzun aralıklar günlük parçalanır.
 */

const LIST_CACHE_TTL_MS = Number(process.env.SOVOS_LIST_CACHE_TTL_MS) || 10 * 60 * 1000;
const LIST_COOLDOWN_MS = Number(process.env.SOVOS_LIST_COOLDOWN_MS) || 90 * 1000;
const MAX_LIST_DAYS = Number(process.env.SOVOS_MAX_LIST_DAYS) || 7;
const CHUNK_DELAY_MS = Number(process.env.SOVOS_CHUNK_DELAY_MS) || 350;

/** getRAWUserList / mükellef sorgusu — tekrarlayan VKN sorgularını sınırla */
const TAXPAYER_CACHE_TTL_MS = Number(process.env.SOVOS_TAXPAYER_CACHE_TTL_MS) || 30 * 60 * 1000;
const TAXPAYER_COOLDOWN_MS = Number(process.env.SOVOS_TAXPAYER_COOLDOWN_MS) || 15 * 1000;

/** getPartialUserList — toplu liste indirimi; hatalı/yoğun çağrıları engelle */
const PARTIAL_LIST_COOLDOWN_MS = Number(process.env.SOVOS_PARTIAL_LIST_COOLDOWN_MS) || 60 * 60 * 1000;

const listCache = new Map();
const listCooldown = new Map();
const taxpayerCache = new Map();
const taxpayerCooldown = new Map();
const partialListCooldown = new Map();

const cacheKey = (vknTckn, documentType, from, to) =>
    `${vknTckn}|${documentType}|${from}|${to}`;

const checkListCooldown = (vknTckn) => {
    const key = String(vknTckn || "unknown");
    const last = listCooldown.get(key) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < LIST_COOLDOWN_MS) {
        return {
            allowed: false,
            waitSec: Math.ceil((LIST_COOLDOWN_MS - elapsed) / 1000),
        };
    }
    return { allowed: true };
};

const markListCall = (vknTckn) => {
    listCooldown.set(String(vknTckn || "unknown"), Date.now());
};

const getCachedList = (key) => {
    const hit = listCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) {
        listCache.delete(key);
        return null;
    }
    return hit.data;
};

const setCachedList = (key, data) => {
    listCache.set(key, { data, expires: Date.now() + LIST_CACHE_TTL_MS });
};

/** Uzun aralığı son N güne kısalt (Sovos yoğun çağrı limiti) */
const clampDateRange = (fromValue, toValue, maxDays = MAX_LIST_DAYS) => {
    const parse = (value, endOfDay) => {
        if (!value) return null;
        const s = String(value).replace(/[^\d]/g, "");
        if (s.length === 8) {
            const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${endOfDay ? "23:59:59" : "00:00:00"}.000+03:00`;
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    const end = parse(toValue, true) || new Date();
    let start = parse(fromValue, false);
    if (!start) {
        start = new Date(end);
        start.setDate(start.getDate() - maxDays);
    }

    const maxStart = new Date(end);
    maxStart.setDate(maxStart.getDate() - maxDays);
    if (start < maxStart) start = maxStart;

    return { start, end, clamped: start.getTime() !== parse(fromValue, false)?.getTime() };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GB etiketi resmi formatta mı? (urn:mail:...) */
const isValidGbIdentifier = (identifier) => {
    const s = String(identifier || "").trim();
    if (!s) return false;
    return /^urn:mail:[^@\s]+@[^@\s]+$/i.test(s);
};

const taxpayerCacheKey = (accountVkn, filterVkn, role) =>
    `${String(accountVkn || "unknown")}|${String(filterVkn || "")}|${String(role || "PK").toUpperCase()}`;

const checkTaxpayerCooldown = (accountVkn, filterVkn) => {
    const key = `${String(accountVkn || "unknown")}|${String(filterVkn || "")}`;
    const last = taxpayerCooldown.get(key) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < TAXPAYER_COOLDOWN_MS) {
        return {
            allowed: false,
            waitSec: Math.ceil((TAXPAYER_COOLDOWN_MS - elapsed) / 1000),
        };
    }
    return { allowed: true };
};

const markTaxpayerCall = (accountVkn, filterVkn) => {
    const key = `${String(accountVkn || "unknown")}|${String(filterVkn || "")}`;
    taxpayerCooldown.set(key, Date.now());
};

const getCachedTaxpayer = (key) => {
    const hit = taxpayerCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) {
        taxpayerCache.delete(key);
        return null;
    }
    return hit.data;
};

const setCachedTaxpayer = (key, data) => {
    taxpayerCache.set(key, { data, expires: Date.now() + TAXPAYER_CACHE_TTL_MS });
};

const checkPartialListCooldown = (accountVkn) => {
    const key = String(accountVkn || "unknown");
    const last = partialListCooldown.get(key) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < PARTIAL_LIST_COOLDOWN_MS) {
        return {
            allowed: false,
            waitSec: Math.ceil((PARTIAL_LIST_COOLDOWN_MS - elapsed) / 1000),
        };
    }
    return { allowed: true };
};

const markPartialListCall = (accountVkn) => {
    partialListCooldown.set(String(accountVkn || "unknown"), Date.now());
};

module.exports = {
    LIST_CACHE_TTL_MS,
    LIST_COOLDOWN_MS,
    MAX_LIST_DAYS,
    CHUNK_DELAY_MS,
    TAXPAYER_CACHE_TTL_MS,
    TAXPAYER_COOLDOWN_MS,
    PARTIAL_LIST_COOLDOWN_MS,
    cacheKey,
    taxpayerCacheKey,
    checkListCooldown,
    markListCall,
    getCachedList,
    setCachedList,
    checkTaxpayerCooldown,
    markTaxpayerCall,
    getCachedTaxpayer,
    setCachedTaxpayer,
    checkPartialListCooldown,
    markPartialListCall,
    clampDateRange,
    sleep,
    isValidGbIdentifier,
};
