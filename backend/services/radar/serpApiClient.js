/**
 * SerpAPI HTTP — tek sıra (429 önleme) + 429’da exponential backoff
 */
const axios = require("axios");
const logger = require("../../config/logger");

const SERPAPI_BASE = "https://serpapi.com/search.json";

/** SerpAPI anahtarı — SERPAPI_KEY veya SERPAPI_API_KEY (ikisinden biri yeterli) */
function getSerpApiKey() {
    return String(process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY || "").trim();
}

/** Ardışık SerpAPI istekleri arası minimum boşluk (ms); 429 patlamasını yumuşatır. 0 = kapalı */
const SERPAPI_MIN_GAP_MS = parseInt(process.env.SERPAPI_MIN_GAP_MS || "0", 10);

let queue = Promise.resolve();
let lastSerpFinishAt = 0;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(err) {
    return err.response?.status === 429;
}

function retryAfterMs(err) {
    const h = err.response?.headers?.["retry-after"];
    if (h == null) return null;
    const n = parseInt(String(h), 10);
    return Number.isFinite(n) ? n * 1000 : null;
}

/**
 * @param {object} params - engine, q, geo, ... (api_key eklenir)
 * @param {object} [opts] - { timeout }
 */
async function getSerpJson(params, opts = {}) {
    const key = getSerpApiKey();
    if (!key) {
        throw new Error("SERPAPI_KEY veya SERPAPI_API_KEY tanımlı değil (.env içinde backend klasöründe)");
    }
    const timeout = opts.timeout ?? 25000;
    const merged = { ...params, api_key: key };

    const run = async () => {
        let attempt = 0;
        const maxAttempts = 5;
        while (attempt < maxAttempts) {
            try {
                if (SERPAPI_MIN_GAP_MS > 0) {
                    const waitGap = lastSerpFinishAt + SERPAPI_MIN_GAP_MS - Date.now();
                    if (waitGap > 0) await sleep(waitGap);
                }
                const res = await axios.get(SERPAPI_BASE, {
                    params: merged,
                    timeout,
                });
                lastSerpFinishAt = Date.now();
                return res;
            } catch (err) {
                attempt++;
                if (!isRateLimited(err)) {
                    throw err;
                }
                const ra = retryAfterMs(err);
                // 429'da daha agresif bekleme: Min 5s, Max 120s
                const backoff = ra != null ? ra : Math.min(120_000, 5000 * 2 ** (attempt - 1));
                const jitter = Math.floor(Math.random() * 800);
                logger.warn(
                    `[SerpAPI] 429 — ${backoff + jitter}ms bekleniyor (deneme ${attempt}/${maxAttempts}). Kotayı kontrol edin: https://serpapi.com/dashboard`
                );
                await sleep(backoff + jitter);
                if (attempt >= maxAttempts) {
                    throw err;
                }
            }
        }
        throw new Error("SerpAPI: max deneme");
    };

    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
}

module.exports = {
    getSerpJson,
    SERPAPI_BASE,
    getSerpApiKey,
    hasSerpKey: () => !!getSerpApiKey(),
};
