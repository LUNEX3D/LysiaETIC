/**
 * Mağaza PayTR bilgileri — AES-256-GCM (JWT_SECRET türevli anahtar)
 */
const crypto = require("crypto");

const ALGO = "aes-256-gcm";

function getKey() {
    const secret = process.env.STORE_ENCRYPTION_KEY || process.env.JWT_SECRET || "dashtock-store-dev-key";
    return crypto.createHash("sha256").update(String(secret)).digest();
}

function encrypt(plain) {
    if (!plain) return "";
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decrypt(payload) {
    if (!payload) return "";
    try {
        const [ivHex, tagHex, dataHex] = String(payload).split(":");
        if (!ivHex || !tagHex || !dataHex) return "";
        const key = getKey();
        const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
        decipher.setAuthTag(Buffer.from(tagHex, "hex"));
        const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
        return dec.toString("utf8");
    } catch {
        return "";
    }
}

function maskSecret(value, visible = 4) {
    const s = String(value || "");
    if (s.length <= visible) return "****";
    return "*".repeat(Math.min(12, s.length - visible)) + s.slice(-visible);
}

module.exports = { encrypt, decrypt, maskSecret };
