/**
 * Sovos resmi SOAP örnekleri — TR saat dilimi (+03:00) dateTime formatı
 * Örnek: 2015-11-12T00:00:00.000+03:00
 */

const toSovosDateTime = (value, { endOfDay = false } = {}) => {
    if (!value) return "";
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        if (/[+-]\d{2}:\d{2}$/.test(s)) return s;
        return s.replace(/Z?$/, "") + (endOfDay ? "T23:59:59.000+03:00" : "T00:00:00.000+03:00");
    }
    const digits = s.replace(/\D/g, "");
    if (digits.length === 8) {
        const d = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
        return d + (endOfDay ? "T23:59:59.000+03:00" : "T00:00:00.000+03:00");
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const time = endOfDay ? "23:59:59.000+03:00" : "00:00:00.000+03:00";
    return `${y}-${m}-${day}T${time}`;
};

const toSovosDate = (value) => {
    const dt = toSovosDateTime(value);
    return dt ? dt.slice(0, 10) : "";
};

const parseYearMonth = (startDate, endDate) => {
    const start = toSovosDate(startDate);
    const end = toSovosDate(endDate || startDate);
    if (!start) return null;
    const [y, m] = start.split("-").map(Number);
    return { year: y, month: m, endYear: end ? Number(end.split("-")[0]) : y, endMonth: end ? Number(end.split("-")[1]) : m };
};

module.exports = {
    toSovosDateTime,
    toSovosDate,
    parseYearMonth,
};
