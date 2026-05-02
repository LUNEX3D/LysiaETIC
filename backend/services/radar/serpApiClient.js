/**
 * SerpAPI HTTP — tek sıra (429 önleme) + 429’da exponential backoff
 */
const axios = require("axios");
const logger = require("../../config/logger");

const SERPAPI_BASE = "https://serpapi.com/search.json";
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

let queue = Promise.resolve();

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
    if (!SERPAPI_KEY) {
        throw new Error("SERPAPI_KEY tanımlı değil");
    }
    const timeout = opts.timeout ?? 25000;
    const merged = { ...params, api_key: SERPAPI_KEY };

    const run = async () => {
        let attempt = 0;
        const maxAttempts = 5;
        while (attempt < maxAttempts) {
            try {
                const res = await axios.get(SERPAPI_BASE, {
                    params: merged,
                    timeout,
                });
                return res;
            } catch (err) {
                attempt++;
                if (!isRateLimited(err)) {
                    throw err;
                }
                const ra = retryAfterMs(err);
                const backoff = ra != null ? ra : Math.min(90_000, 2000 * 2 ** (attempt - 1));
                const jitter = Math.floor(Math.random() * 400);
                logger.warn(`[SerpAPI] 429 — ${backoff + jitter}ms bekleniyor (deneme ${attempt}/${maxAttempts})`);
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
    hasSerpKey: () => !!SERPAPI_KEY,
};
