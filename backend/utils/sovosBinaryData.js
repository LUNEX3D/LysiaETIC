/**
 * Sovos SOAP xs:base64Binary alanlarını Buffer'a çevirir.
 * node-soap çoğu zaman ham binary yerine base64 metin döndürür.
 */

const looksLikeBase64Text = (text) => {
    const sample = String(text || "").replace(/\s/g, "").slice(0, 120);
    if (sample.length < 8) return false;
    return /^[A-Za-z0-9+/=]+$/.test(sample);
};

const decodeBase64Text = (text) => {
    try {
        return Buffer.from(String(text || "").replace(/\s/g, ""), "base64");
    } catch {
        return null;
    }
};

const isLikelyBinary = (buf) => {
    if (!buf || !buf.length) return false;
    const b0 = buf[0];
    const b1 = buf[1];
    if (b0 === 0x3c) return true; // XML/HTML <
    if (b0 === 0x25 && b1 === 0x50) return true; // %PDF
    if (b0 === 0x50 && b1 === 0x4b) return true; // PK zip
    if (b0 === 0xef && b1 === 0xbb) return true; // UTF-8 BOM + often HTML
    return false;
};

const normalizeSovosBinaryData = (docData) => {
    if (docData == null) return null;

    if (Buffer.isBuffer(docData)) {
        if (isLikelyBinary(docData)) return docData;
        const asText = docData.toString("utf8").trim();
        if (asText.startsWith("<") || asText.startsWith("%PDF")) {
            return Buffer.from(asText, "utf8");
        }
        if (looksLikeBase64Text(asText)) {
            const decoded = decodeBase64Text(asText);
            if (decoded && decoded.length) return decoded;
        }
        return docData;
    }

    if (typeof docData === "string") {
        const trimmed = docData.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("<") || trimmed.startsWith("%PDF")) {
            return Buffer.from(trimmed, "utf8");
        }
        if (looksLikeBase64Text(trimmed)) {
            const decoded = decodeBase64Text(trimmed);
            if (decoded && decoded.length) return decoded;
        }
        return Buffer.from(trimmed, "utf8");
    }

    return null;
};

const sniffContentType = (buf, fallback = "application/octet-stream") => {
    if (!buf || !buf.length) return fallback;
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
        return "application/pdf";
    }
    const head = buf.slice(0, Math.min(buf.length, 512)).toString("utf8").trimStart();
    if (head.startsWith("<") && (head.includes("<html") || head.includes("<HTML") || head.includes("<?xml"))) {
        return head.includes("<html") || head.includes("<HTML") ? "text/html; charset=utf-8" : "application/xml; charset=utf-8";
    }
    if (buf[0] === 0x50 && buf[1] === 0x4b) return "application/zip";
    return fallback;
};

module.exports = {
    normalizeSovosBinaryData,
    sniffContentType,
};
