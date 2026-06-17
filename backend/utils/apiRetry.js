const logger = require("../config/logger");

// ═══════════════════════════════════════════════════════════════════════
// 🔁 GENEL API RETRY / THROTTLE YARDIMCISI
// ───────────────────────────────────────────────────────────────────────
// Pazaryeri API'lerinde 429 (Too Many Requests), 5xx ve geçici ağ hatalarına
// karşı dayanıklı istek çalıştırmak için kullanılır.
//   - 429/503 → "Retry-After" başlığına saygılı bekle, sonra tekrar dene
//   - 5xx / ağ hataları → üstel backoff ile tekrar dene
//   - (Opsiyonel) endpoint+hesap bazlı hafif throttle (seri kuyruk + min aralık)
// ═══════════════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_RETRY_STATUSES = new Set([429, 502, 503, 504]);
const DEFAULT_RETRY_CODES = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNABORTED",
    "EAI_AGAIN",
    "ENOTFOUND",
    "EPIPE",
]);

/**
 * Hata yeniden denenebilir mi? (HTTP status veya ağ hata kodu)
 */
const isRetryable = (err, retryStatuses = DEFAULT_RETRY_STATUSES, retryCodes = DEFAULT_RETRY_CODES) => {
    const status = err?.response?.status;
    if (status && retryStatuses.has(status)) return true;
    if (!err?.response && err?.code && retryCodes.has(err.code)) return true;
    return false;
};

/**
 * Retry-After / RateLimit-Reset başlığından bekleme süresini (ms) hesapla.
 * Yoksa verilen fallback (üstel backoff) kullanılır.
 */
const parseRetryAfterMs = (err, fallbackMs) => {
    const headers = err?.response?.headers || {};
    const raw =
        headers["retry-after"] ||
        headers["Retry-After"] ||
        headers["x-ratelimit-reset"] ||
        headers["X-RateLimit-Reset"];

    if (raw != null) {
        const num = Number(raw);
        if (!Number.isNaN(num) && num > 0) {
            // saniye ise ms'e çevir (+1sn tampon); zaten ms/epoch ise olduğu gibi
            return num < 1000 ? (num + 1) * 1000 : num;
        }
        const asDate = Date.parse(raw);
        if (!Number.isNaN(asDate)) {
            const diff = asDate - Date.now();
            if (diff > 0) return diff + 500;
        }
    }
    return fallbackMs;
};

// throttleKey -> { chain: Promise, lastAt: number }
const _throttle = new Map();

/**
 * Bir API isteğini dayanıklı şekilde çalıştırır.
 * @param {Function} doRequest - axios çağrısını döndüren fonksiyon (Promise)
 * @param {object} [opts]
 * @param {string} [opts.label]          - log etiketi
 * @param {number} [opts.maxRetries]     - maksimum tekrar (varsayılan 4)
 * @param {number} [opts.baseDelayMs]    - backoff başlangıcı (varsayılan 1000)
 * @param {number} [opts.maxDelayMs]     - backoff tavanı (varsayılan 15000)
 * @param {string} [opts.throttleKey]    - verilirse bu anahtarda seri kuyruk uygulanır
 * @param {number} [opts.minIntervalMs]  - aynı throttleKey istekleri arası min süre
 * @param {Set<number>} [opts.retryStatuses]
 */
const requestWithRetry = async (doRequest, opts = {}) => {
    const {
        label = "request",
        maxRetries = 4,
        baseDelayMs = 1000,
        maxDelayMs = 15000,
        throttleKey = null,
        // throttleKey verilip minIntervalMs belirtilmezse env ile kontrol edilir
        // (MARKETPLACE_THROTTLE_MS; varsayılan 0 = throttle kapalı, yalnızca retry çalışır).
        minIntervalMs = parseInt(process.env.MARKETPLACE_THROTTLE_MS || "0", 10),
        retryStatuses = DEFAULT_RETRY_STATUSES,
    } = opts;

    const exec = async () => {
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                return await doRequest();
            } catch (err) {
                if (isRetryable(err, retryStatuses) && attempt < maxRetries) {
                    attempt += 1;
                    const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
                    const waitMs = parseRetryAfterMs(err, backoff);
                    logger.warn(
                        `[apiRetry] ${label} — ${err.response?.status || err.code || "geçici hata"}, ` +
                        `deneme ${attempt}/${maxRetries}, ${waitMs}ms bekleniyor`
                    );
                    await sleep(waitMs);
                    continue;
                }
                throw err;
            }
        }
    };

    // Throttle istenmemişse doğrudan çalıştır
    if (!throttleKey || minIntervalMs <= 0) {
        return exec();
    }

    const slot = _throttle.get(throttleKey) || { chain: Promise.resolve(), lastAt: 0 };
    const run = slot.chain.then(async () => {
        const wait = slot.lastAt + minIntervalMs - Date.now();
        if (wait > 0) await sleep(wait);
        try {
            return await exec();
        } finally {
            slot.lastAt = Date.now();
        }
    });
    // Hata bir sonraki isteğin kuyruğunu kırmasın
    slot.chain = run.then(() => {}, () => {});
    _throttle.set(throttleKey, slot);
    return run;
};

module.exports = {
    requestWithRetry,
    isRetryable,
    parseRetryAfterMs,
    sleep,
};
