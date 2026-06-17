"use strict";

/**
 * In-process rate limiting for public WB endpoints (analytics, etc.).
 * Not shared across instances — use Redis for multi-node production.
 */

const buckets = new Map();

const PRUNE_EVERY_MS = 5 * 60 * 1000;
let lastPrune = Date.now();

function pruneStale(maxWindowMs) {
    const now = Date.now();
    if (now - lastPrune < PRUNE_EVERY_MS) return;
    lastPrune = now;
    for (const [key, bucket] of buckets) {
        if (now - bucket.start > maxWindowMs) buckets.delete(key);
    }
}

/**
 * @param {string} key
 * @param {{ windowMs: number, max: number }} opts
 * @returns {boolean} true if allowed
 */
function checkRateLimit(key, { windowMs, max }) {
    pruneStale(windowMs * 2);
    const now = Date.now();
    const k = String(key || "unknown");
    let bucket = buckets.get(k);
    if (!bucket || now - bucket.start > windowMs) {
        bucket = { start: now, count: 0 };
    }
    bucket.count += 1;
    buckets.set(k, bucket);
    return bucket.count <= max;
}

function getClientIp(req) {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.length) {
        return fwd.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
}

module.exports = {
    checkRateLimit,
    getClientIp,
};
