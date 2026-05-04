/**
 * İstanbul takvim günü — sunucu UTC'de olsa bile "bugün" siparişleri doğru demetler.
 * Türkiye'de DST yok; +03:00 sabit.
 */

/** @returns {{ y: string, m: string, d: string }} */
function getTurkeyYmd(d = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(d);
    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    return { y, m, d: day };
}

/** Bugün 00:00 İstanbul */
function getTurkeyTodayStart(ref = new Date()) {
    const { y, m, d: day } = getTurkeyYmd(ref);
    return new Date(`${y}-${m}-${day}T00:00:00+03:00`);
}

/** Yarın 00:00 İstanbul (bugünün üst sınırı, exclusive) */
function getTurkeyTomorrowStart(ref = new Date()) {
    const start = getTurkeyTodayStart(ref);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Dün 00:00 İstanbul */
function getTurkeyYesterdayStart(ref = new Date()) {
    const start = getTurkeyTodayStart(ref);
    return new Date(start.getTime() - 24 * 60 * 60 * 1000);
}

module.exports = {
    getTurkeyYmd,
    getTurkeyTodayStart,
    getTurkeyTomorrowStart,
    getTurkeyYesterdayStart,
};
