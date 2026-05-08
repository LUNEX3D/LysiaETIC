/**
 * Credential Encryption Utility — LysiaETIC
 *
 * Marketplace API credential'larını AES-256-GCM ile şifreler/çözer.
 * .env dosyasında ENCRYPTION_KEY tanımlı olmalıdır (32 byte hex).
 *
 * Kullanım:
 *   const { encrypt, decrypt } = require("./utils/encryption");
 *   const encrypted = encrypt("my-api-secret");
 *   const decrypted = decrypt(encrypted);
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encryption key'i .env'den al.
 * Güvenlik gereği ENCRYPTION_KEY zorunludur.
 */
function getEncryptionKey() {
    if (process.env.ENCRYPTION_KEY) {
        const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
        if (key.length !== 32) {
            throw new Error("ENCRYPTION_KEY 32 byte (64 hex karakter) olmalıdır!");
        }
        return key;
    }

    throw new Error("ENCRYPTION_KEY tanımlı değil! Güvenlik için .env dosyanıza 64 hex karakterlik anahtar ekleyin.");
}

/**
 * Bir string'i AES-256-GCM ile şifreler.
 * @param {string} text — Şifrelenecek metin
 * @returns {string} — "iv:encrypted:tag" formatında hex string
 */
function encrypt(text) {
    if (!text || typeof text !== "string") return text;

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${encrypted}:${tag}`;
}

/**
 * AES-256-GCM ile şifrelenmiş metni çözer.
 * @param {string} encryptedText — "iv:encrypted:tag" formatında hex string
 * @returns {string} — Çözülmüş metin
 */
function decrypt(encryptedText) {
    if (!encryptedText || typeof encryptedText !== "string") return encryptedText;

    // Şifrelenmemiş veri kontrolü (eski veriler için geriye uyumluluk)
    if (!encryptedText.includes(":") || encryptedText.split(":").length !== 3) {
        return encryptedText;
    }

    try {
        const key = getEncryptionKey();
        const [ivHex, encrypted, tagHex] = encryptedText.split(":");

        const iv = Buffer.from(ivHex, "hex");
        const tag = Buffer.from(tagHex, "hex");
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch {
        // Şifre çözülemezse orijinal değeri döndür (eski şifrelenmemiş veri)
        return encryptedText;
    }
}

/**
 * Bir credentials objesinin tüm string değerlerini şifreler.
 * @param {Object} credentials
 * @returns {Object} — Şifrelenmiş credentials
 */
function encryptCredentials(credentials) {
    if (!credentials || typeof credentials !== "object") return credentials;

    const encrypted = {};
    for (const [key, value] of Object.entries(credentials)) {
        encrypted[key] = typeof value === "string" ? encrypt(value) : value;
    }
    return encrypted;
}

/**
 * Bir credentials objesinin tüm string değerlerini çözer.
 * @param {Object} credentials
 * @returns {Object} — Çözülmüş credentials
 */
function decryptCredentials(credentials) {
    if (!credentials || typeof credentials !== "object") return credentials;

    const decrypted = {};
    for (const [key, value] of Object.entries(credentials)) {
        decrypted[key] = typeof value === "string" ? decrypt(value) : value;
    }
    return decrypted;
}

module.exports = {
    encrypt,
    decrypt,
    encryptCredentials,
    decryptCredentials
};
