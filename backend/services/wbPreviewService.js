"use strict";

const crypto = require("crypto");

const TTL_MS = 2 * 60 * 60 * 1000; // 2 saat

function secret() {
    return process.env.STORE_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "lysia-wb-preview-dev";
}

function createPreviewToken(siteId) {
    const exp = Date.now() + TTL_MS;
    const payload = `${String(siteId)}.${exp}`;
    const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
    const b64 = Buffer.from(payload, "utf8").toString("base64url");
    return `${b64}.${sig}`;
}

function validatePreviewToken(token, siteId) {
    if (!token || !siteId) return false;
    const parts = String(token).split(".");
    if (parts.length !== 2) return false;
    const [b64, sig] = parts;
    let payload;
    try {
        payload = Buffer.from(b64, "base64url").toString("utf8");
    } catch {
        return false;
    }
    const [sid, expStr] = payload.split(".");
    if (sid !== String(siteId)) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
    return sig === expected;
}

function getPreviewTokenFromRequest(req) {
    return req.query?.preview_token
        || req.query?.previewToken
        || req.headers["x-wb-preview-token"]
        || "";
}

module.exports = {
    createPreviewToken,
    validatePreviewToken,
    getPreviewTokenFromRequest,
    TTL_MS,
};
