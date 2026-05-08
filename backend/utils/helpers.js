/**
 * General Helpers — LysiaETIC
 * ✅ FIX #4: ESM export → CommonJS module.exports
 */

/**
 * General date formatter
 * @param {number|string} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
}

/**
 * Trendyol API usually sends timestamp as string/number
 */
function formatTrendyolDate(timestamp) {
    if (!timestamp) return "-";
    let n = Number(timestamp);
    if (!Number.isFinite(n)) {
        const d = parseMarketplaceOrderDateToUtcDate(timestamp);
        return d ? d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-";
    }
    if (n > 0 && n < 1e12) n *= 1000;
    const date = new Date(n);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

/**
 * Pazaryeri sipariş zamanını tek tip UTC Date'e çevirir (UI'da Europe/Istanbul ile gösterilir).
 * - Epoch 10 haneli ise saniye kabul edilir.
 * - "YYYY-MM-DD HH:mm:ss" (HB) ve "DD.MM.YYYY HH:mm:ss" (TR) İstanbul duvar saati (+03:00) varsayılır.
 * @param {number|string|Date|null|undefined} raw
 * @returns {Date|null}
 */
function parseMarketplaceOrderDateToUtcDate(raw) {
    if (raw == null || raw === "") return null;
    if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === "number") {
        let ms = raw;
        if (ms > 0 && ms < 1e12) ms *= 1000;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === "string") {
        const t = raw.trim();
        if (!t || t === "Bilinmiyor") return null;
        if (/^\d{10,13}$/.test(t)) {
            let n = Number(t);
            if (n < 1e12) n *= 1000;
            const d = new Date(n);
            return isNaN(d.getTime()) ? null : d;
        }
        let d = new Date(t);
        if (!isNaN(d.getTime())) return d;
        // DD.MM.YYYY HH:mm:ss — İstanbul
        let m = t.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
            const [, day, mon, year, hh, mm, ss] = m;
            d = new Date(`${year}-${mon}-${day}T${hh}:${mm}:${ss || "00"}+03:00`);
            if (!isNaN(d.getTime())) return d;
        }
        // YYYY-MM-DD HH:mm:ss — Hepsiburada (İstanbul)
        m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
            const [, y, mo, day, hh, mm, ss] = m;
            d = new Date(`${y}-${mo}-${day}T${hh}:${mm}:${ss || "00"}+03:00`);
            if (!isNaN(d.getTime())) return d;
        }
        // DD-MM-YYYY HH:mm — N11
        m = t.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
        if (m) {
            const [, day, mon, year, hh, mm] = m;
            d = new Date(`${year}-${mon}-${day}T${hh}:${mm}:00+03:00`);
            if (!isNaN(d.getTime())) return d;
        }
    }
    return null;
}

/**
 * Trendyol sipariş paketi `orderDate` (milisaniye).
 * Resmi dokümantasyonda GMT+3 ile ilişkilendirilir; pratikte değer sıklıkla TR duvar saatinin
 * UTC epoch sanılıp kodlanmasıyla gelir — `new Date(ms)` sonrası İstanbul formatında ~+3 saat kayma.
 * Bunu düzeltmek için varsayılan olarak 3 saat çıkarılır (sabit TR = UTC+3).
 *
 * - Kapatmak: ortam değişkeni `TRENDYOL_ORDER_DATE_ADJUST_MS=0`
 * - Özel çıkarma: ms cinsinden (örn. `3600000` = 1 saat)
 */
function trendyolOrderDateMsToUtcMs(raw) {
    if (raw == null || raw === "") return null;

    let ms = null;
    if (typeof raw === "number" && Number.isFinite(raw)) {
        ms = raw;
    } else if (typeof raw === "string") {
        const t = raw.trim();
        if (/^\d{10,13}$/.test(t)) ms = Number(t);
        else return null;
    } else {
        return null;
    }

    if (ms > 0 && ms < 1e12) ms *= 1000;

    const envVal = process.env.TRENDYOL_ORDER_DATE_ADJUST_MS;
    let subtractMs = 3 * 60 * 60 * 1000;
    if (envVal !== undefined && envVal !== null && String(envVal).trim() !== "") {
        const n = Number(envVal);
        if (Number.isFinite(n)) subtractMs = n;
    }
    return ms - subtractMs;
}

/**
 * API / frontend için ISO 8601 (UTC) string
 * @param {number|string|Date|null|undefined} raw
 * @returns {string|null}
 */
function marketplaceOrderDateToIsoString(raw) {
    const d = parseMarketplaceOrderDateToUtcDate(raw);
    return d ? d.toISOString() : null;
}

/**
 * Currency formatter (TRY)
 * @param {number|string} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    if (amount == null || amount === "") return "-";
    return Number(amount).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Returns color based on transaction type
 */
function getTransactionColor(type) {
    switch (type) {
        case "Satış":
        case "Sale":
            return "success";
        case "İade":
        case "Return":
            return "error";
        case "İndirim":
        case "Discount":
            return "warning";
        case "Kupon":
        case "Coupon":
            return "primary";
        default:
            return "default";
    }
}

/**
 * For special filtering purposes (example)
 */
function filterFinancialData(data = [], searchText = "") {
    if (!searchText) return data;
    return data.filter(item =>
        (item.orderNumber && item.orderNumber.toString().includes(searchText)) ||
        (item.description && item.description.toLowerCase().includes(searchText.toLowerCase()))
    );
}

module.exports = {
    formatDate,
    formatTrendyolDate,
    formatCurrency,
    getTransactionColor,
    filterFinancialData,
    parseMarketplaceOrderDateToUtcDate,
    marketplaceOrderDateToIsoString,
    trendyolOrderDateMsToUtcMs
};