/** Ülke telefon kodları */
export const PHONE_COUNTRY_OPTIONS = [
    { code: "+90", flag: "🇹🇷", name: "Türkiye" },
    { code: "+1", flag: "🇺🇸", name: "ABD" },
    { code: "+44", flag: "🇬🇧", name: "İngiltere" },
    { code: "+49", flag: "🇩🇪", name: "Almanya" },
    { code: "+33", flag: "🇫🇷", name: "Fransa" },
    { code: "+31", flag: "🇳🇱", name: "Hollanda" },
    { code: "+32", flag: "🇧🇪", name: "Belçika" },
    { code: "+39", flag: "🇮🇹", name: "İtalya" },
    { code: "+34", flag: "🇪🇸", name: "İspanya" },
    { code: "+41", flag: "🇨🇭", name: "İsviçre" },
    { code: "+43", flag: "🇦🇹", name: "Avusturya" },
    { code: "+46", flag: "🇸🇪", name: "İsveç" },
    { code: "+47", flag: "🇳🇴", name: "Norveç" },
    { code: "+45", flag: "🇩🇰", name: "Danimarka" },
    { code: "+48", flag: "🇵🇱", name: "Polonya" },
    { code: "+30", flag: "🇬🇷", name: "Yunanistan" },
    { code: "+351", flag: "🇵🇹", name: "Portekiz" },
    { code: "+353", flag: "🇮🇪", name: "İrlanda" },
    { code: "+7", flag: "🇷🇺", name: "Rusya" },
    { code: "+380", flag: "🇺🇦", name: "Ukrayna" },
    { code: "+994", flag: "🇦🇿", name: "Azerbaycan" },
    { code: "+995", flag: "🇬🇪", name: "Gürcistan" },
    { code: "+971", flag: "🇦🇪", name: "BAE" },
    { code: "+966", flag: "🇸🇦", name: "Suudi Arabistan" },
    { code: "+20", flag: "🇪🇬", name: "Mısır" },
    { code: "+212", flag: "🇲🇦", name: "Fas" },
    { code: "+91", flag: "🇮🇳", name: "Hindistan" },
    { code: "+86", flag: "🇨🇳", name: "Çin" },
    { code: "+81", flag: "🇯🇵", name: "Japonya" },
    { code: "+82", flag: "🇰🇷", name: "Güney Kore" },
    { code: "+61", flag: "🇦🇺", name: "Avustralya" },
    { code: "+55", flag: "🇧🇷", name: "Brezilya" },
    { code: "+52", flag: "🇲🇽", name: "Meksika" },
    { code: "+27", flag: "🇿🇦", name: "Güney Afrika" },
];

export function getPhoneCountryByCode(code) {
    const c = String(code || "").trim();
    return PHONE_COUNTRY_OPTIONS.find((o) => o.code === c) || PHONE_COUNTRY_OPTIONS[0];
}

export function phoneCountryListLabel(opt) {
    return `${opt.flag} ${opt.name} (${opt.code})`;
}

export function phoneCountryTriggerLabel(opt) {
    return `${opt.flag} ${opt.code}`;
}

export function normalizePhoneCountryCode(code) {
    const c = String(code || "").trim();
    if (!c) return "+90";
    return PHONE_COUNTRY_OPTIONS.some((o) => o.code === c) ? c : "+90";
}

export function filterPhoneCountries(query) {
    const q = String(query || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
    if (!q) return PHONE_COUNTRY_OPTIONS;
    const digits = q.replace(/\D/g, "");
    return PHONE_COUNTRY_OPTIONS.filter((opt) => {
        const name = opt.name.toLowerCase();
        const code = opt.code.toLowerCase();
        const codeDigits = opt.code.replace(/\D/g, "");
        if (name.includes(q)) return true;
        if (code.includes(q) || q.includes(code.replace("+", ""))) return true;
        if (digits && codeDigits.startsWith(digits)) return true;
        return false;
    });
}
