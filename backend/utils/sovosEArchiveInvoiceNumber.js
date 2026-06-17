/**
 * Sovos e-Arşiv fatura numarası normalizasyonu.
 * getStatus bazen FA2026000000006 yerine FA02026000000006 döndürür (fazladan 0).
 */

const clean = (s) => String(s || "").trim();

/** GİB/Sovos: 2–3 harf + 4 yıl (20xx) + sıra */
const isPlausibleSovosInvoiceNumber = (value) =>
    /^[A-Z0-9]{2,3}20[0-9]{2}[0-9]{6,11}$/i.test(clean(value));

const isCorruptedSovosInvoiceNumber = (value) => {
    const s = clean(value).toUpperCase();
    return /^[A-Z]{2}0(20[0-9]{2})/.test(s) || /^0(20[0-9]{2})/.test(s);
};

/**
 * @param {string} raw — Sovos'tan gelen ham değer
 * @param {{ seriesHint?: string }} opts — fatura serisi (FA, FAA, …)
 */
const normalizeSovosEArchiveInvoiceNumber = (raw, opts = {}) => {
    let s = clean(raw).toUpperCase().replace(/\s/g, "");
    if (!s) return "";

    const seriesHint = clean(opts.seriesHint || "FA")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 3) || "FA";

    // FA02026000000006 → FA2026000000006
    if (/^[A-Z]{2,3}0(20[0-9]{2})/.test(s)) {
        s = s.replace(/^([A-Z]{2,3})0(20[0-9]{2})/, "$1$2");
    }

    // Yalnızca rakam: 02026000000006 / 2026000000006 → seri + rakam
    if (/^[0-9]{12,16}$/.test(s)) {
        const digits = s.replace(/^0+(?=20)/, "");
        if (/^20[0-9]{2}/.test(digits)) {
            s = seriesHint + digits;
        }
    }

    return s;
};

/** Birden fazla aday arasından en olası (bozuk olmayan, GİB uyumlu) seç */
const pickBestSovosInvoiceNumber = (candidates, opts = {}) => {
    const normalized = candidates
        .map((c) => normalizeSovosEArchiveInvoiceNumber(c, opts))
        .filter(Boolean);
    const unique = [...new Set(normalized)];

    const valid = unique.filter(isPlausibleSovosInvoiceNumber);
    if (valid.length) {
        return valid.find((v) => !isCorruptedSovosInvoiceNumber(v)) || valid[0];
    }
    return unique[0] || "";
};

module.exports = {
    normalizeSovosEArchiveInvoiceNumber,
    pickBestSovosInvoiceNumber,
    isPlausibleSovosInvoiceNumber,
    isCorruptedSovosInvoiceNumber,
};
