/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const path = require("path");

const SYMBOLS = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    TRY: "₺",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    RUB: "₽",
    KRW: "₩",
    ILS: "₪",
    NGN: "₦",
    PKR: "₨",
    VND: "₫",
    PHP: "₱",
    THB: "฿",
    BRL: "R$",
    MXN: "$",
    CAD: "$",
    AUD: "$",
    NZD: "$",
    HKD: "HK$",
    SGD: "S$",
    AED: "د.إ",
    SAR: "﷼",
    CHF: "CHF",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RON: "lei",
    BGN: "лв",
    UAH: "₴",
    EGP: "E£",
    ZAR: "R",
    ARS: "$",
    CLP: "$",
    COP: "$",
    PEN: "S/",
    IDR: "Rp",
    MYR: "RM",
    TWD: "NT$",
    QAR: "﷼",
    KWD: "د.ك",
    BHD: ".د.ب",
    OMR: "﷼",
    JOD: "د.ا",
    LBP: "ل.ل",
    MAD: "د.م.",
    DZD: "د.ج",
    TND: "د.ت",
    KES: "KSh",
    GHS: "₵",
    XOF: "CFA",
    XAF: "FCFA",
    XCD: "$",
    XPF: "₣",
    ALL: "L",
    AMD: "֏",
    AZN: "₼",
    GEL: "₾",
    KZT: "₸",
    UZS: "so'm",
    BYN: "Br",
    MDL: "L",
    RSD: "дин.",
    BAM: "KM",
    MKD: "ден",
    HRK: "kn",
    ISK: "kr",
    LKR: "Rs",
    NPR: "Rs",
    BDT: "৳",
    MMK: "K",
    KHR: "៛",
    LAK: "₭",
    MNT: "₮",
    IRR: "﷼",
    IQD: "ع.د",
    SYP: "£",
    YER: "﷼",
    SDG: "ج.س.",
    ETB: "Br",
    TZS: "Sh",
    UGX: "USh",
    RWF: "FRw",
    MUR: "₨",
    SCR: "₨",
    BOB: "Bs.",
    PYG: "₲",
    UYU: "$U",
    VES: "Bs.S",
    DOP: "RD$",
    GTQ: "Q",
    HNL: "L",
    NIO: "C$",
    PAB: "B/.",
    CRC: "₡",
    JMD: "J$",
    TTD: "TT$",
    BBD: "$",
    BSD: "$",
    BZD: "BZ$",
    HTG: "G",
    AWG: "ƒ",
    ANG: "ƒ",
    SRD: "$",
    GYD: "$",
    FJD: "$",
    WST: "T",
    TOP: "T$",
    VUV: "VT",
    PGK: "K",
    SBD: "$",
    MOP: "MOP$",
    BND: "$",
    KPW: "₩",
    MVR: "Rf",
    AFN: "؋",
    BTN: "Nu.",
    CVE: "$",
    GMD: "D",
    GNF: "FG",
    LRD: "$",
    LSL: "L",
    MWK: "MK",
    MZN: "MT",
    NAD: "$",
    SLL: "Le",
    SOS: "Sh",
    SSP: "£",
    SZL: "E",
    ZMW: "ZK",
    ZWG: "ZiG",
    STN: "Db",
    MRU: "UM",
    DJF: "Fdj",
    ERN: "Nfk",
    KMF: "CF",
    AOA: "Kz",
    CDF: "FC",
    BIF: "FBu",
    XAF: "FCFA",
    XSU: "Sucre",
    XDR: "SDR",
    XAU: "XAU",
    XAG: "XAG",
    XPT: "XPT",
    XPD: "XPD",
};

const COUNTRY_TR = {
    TÜRKİYE: "Türkiye",
    TURKEY: "Türkiye",
    "UNITED STATES OF AMERICA (THE)": "Amerika Birleşik Devletleri",
    GERMANY: "Almanya",
    FRANCE: "Fransa",
    "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND (THE)": "Birleşik Krallık",
    ITALY: "İtalya",
    SPAIN: "İspanya",
    "NETHERLANDS (THE)": "Hollanda",
    BELGIUM: "Belçika",
    SWITZERLAND: "İsviçre",
    AUSTRIA: "Avusturya",
    GREECE: "Yunanistan",
    PORTUGAL: "Portekiz",
    POLAND: "Polonya",
    "RUSSIAN FEDERATION (THE)": "Rusya",
    UKRAINE: "Ukrayna",
    JAPAN: "Japonya",
    CHINA: "Çin",
    INDIA: "Hindistan",
    BRAZIL: "Brezilya",
    MEXICO: "Meksika",
    CANADA: "Kanada",
    AUSTRALIA: "Avustralya",
    "SAUDI ARABIA": "Suudi Arabistan",
    "UNITED ARAB EMIRATES (THE)": "Birleşik Arap Emirlikleri",
    AZERBAIJAN: "Azerbaycan",
    GEORGIA: "Gürcistan",
    "KOREA (THE REPUBLIC OF)": "Güney Kore",
    SWEDEN: "İsveç",
    NORWAY: "Norveç",
    DENMARK: "Danimarka",
    FINLAND: "Finlandiya",
    IRELAND: "İrlanda",
    CZECHIA: "Çekya",
    HUNGARY: "Macaristan",
    ROMANIA: "Romanya",
    BULGARIA: "Bulgaristan",
    EGYPT: "Mısır",
    "SOUTH AFRICA": "Güney Afrika",
    ARGENTINA: "Arjantin",
    CHILE: "Şili",
    COLOMBIA: "Kolombiya",
    PERU: "Peru",
    INDONESIA: "Endonezya",
    MALAYSIA: "Malezya",
    SINGAPORE: "Singapur",
    THAILAND: "Tayland",
    "VIET NAM": "Vietnam",
    "PHILIPPINES (THE)": "Filipinler",
    ISRAEL: "İsrail",
    IRAQ: "Irak",
    "IRAN (ISLAMIC REPUBLIC OF)": "İran",
    "SYRIAN ARAB REPUBLIC": "Suriye",
    LEBANON: "Lübnan",
    JORDAN: "Ürdün",
    KUWAIT: "Kuveyt",
    QATAR: "Katar",
    BAHRAIN: "Bahreyn",
    OMAN: "Umman",
    MOROCCO: "Fas",
    TUNISIA: "Tunus",
    ALGERIA: "Cezayir",
    NIGERIA: "Nijerya",
    KENYA: "Kenya",
    PAKISTAN: "Pakistan",
    BANGLADESH: "Bangladeş",
    "SRI LANKA": "Sri Lanka",
    NEPAL: "Nepal",
    "HONG KONG": "Hong Kong",
    "TAIWAN (PROVINCE OF CHINA)": "Tayvan",
    "NEW ZEALAND": "Yeni Zelanda",
    AFGHANISTAN: "Afganistan",
    ALBANIA: "Arnavutluk",
    ARMENIA: "Ermenistan",
    BELARUS: "Belarus",
    "BOSNIA AND HERZEGOVINA": "Bosna Hersek",
    CROATIA: "Hırvatistan",
    CYPRUS: "Kıbrıs",
    ESTONIA: "Estonya",
    LATVIA: "Letonya",
    LITHUANIA: "Litvanya",
    LUXEMBOURG: "Lüksemburg",
    MALTA: "Malta",
    MOLDOVA: "Moldova",
    MONTENEGRO: "Karadağ",
    "NORTH MACEDONIA": "Kuzey Makedonya",
    SERBIA: "Sırbistan",
    SLOVAKIA: "Slovakya",
    SLOVENIA: "Slovenya",
    ICELAND: "İzlanda",
    LIECHTENSTEIN: "Liechtenstein",
    MONACO: "Monako",
    ANDORRA: "Andorra",
    "SAN MARINO": "San Marino",
    "VATICAN CITY STATE": "Vatikan",
    ABKHAZIA: "Abhazya",
};

function parseCsvLine(line) {
    const parts = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQ = !inQ;
            continue;
        }
        if (ch === "," && !inQ) {
            parts.push(cur);
            cur = "";
            continue;
        }
        cur += ch;
    }
    parts.push(cur);
    return parts;
}

function cleanEntity(entity) {
    return String(entity || "")
        .replace(/\s*\(THE\)\s*/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function titleCase(s) {
    return s
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildList(csv) {
    const lines = csv.trim().split(/\r?\n/).slice(1);
    const byCode = new Map();
    for (const line of lines) {
        const [entity, currency, code, , withdrawal] = parseCsvLine(line);
        if (!code || code.length !== 3) continue;
        if (withdrawal && withdrawal.trim()) continue;
        if (code.startsWith("ZZ")) continue;
        if (byCode.has(code)) continue;
        const ent = cleanEntity(entity);
        const nameOverrides = { TRY: "Turkish Lira", TMT: "Turkmenistan Manat" };
        byCode.set(code, {
            code,
            symbol: SYMBOLS[code] || "",
            name: nameOverrides[code] || String(currency || "").trim(),
            countryEn: titleCase(ent),
            countryTr: COUNTRY_TR[entity] || COUNTRY_TR[ent.toUpperCase()] || null,
        });
    }
    const priority = ["TRY", "USD", "EUR", "GBP"];
    return [...byCode.values()].sort((a, b) => {
        const ai = priority.indexOf(a.code);
        const bi = priority.indexOf(b.code);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.code.localeCompare(b.code);
    });
}

function writeFile(list) {
    const header = `/** ISO 4217 aktif para birimleri — scripts/generateWorldCurrencies.js ile üretilir */\n`;
    const body = `export const WORLD_CURRENCIES = ${JSON.stringify(list, null, 4)};

export function getCurrencyByCode(code) {
    const c = String(code || "").trim().toUpperCase();
    return WORLD_CURRENCIES.find((x) => x.code === c) || null;
}

export function formatCurrencyLine(cur) {
    if (!cur) return "";
    const sym = cur.symbol ? \`\${cur.symbol} / \` : "/ ";
    return \`\${sym}\${cur.code} / \${cur.name}\`;
}

export function currencyCountryLabel(cur) {
    return cur?.countryTr || cur?.countryEn || "";
}

export function filterCurrencies(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return WORLD_CURRENCIES;
    return WORLD_CURRENCIES.filter((c) => {
        const country = (c.countryTr || c.countryEn || "").toLowerCase();
        return (
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            country.includes(q) ||
            (c.symbol && String(c.symbol).toLowerCase().includes(q))
        );
    });
}
`;
    const outPath = path.join(__dirname, "../src/constants/worldCurrencies.js");
    fs.writeFileSync(outPath, header + body, "utf8");
    console.log("Wrote", list.length, "currencies to", outPath);
}

const url = "https://raw.githubusercontent.com/datasets/currency-codes/main/data/codes-all.csv";
https
    .get(url, (res) => {
        let data = "";
        res.on("data", (c) => {
            data += c;
        });
        res.on("end", () => {
            writeFile(buildList(data));
        });
    })
    .on("error", (e) => {
        console.error(e);
        process.exit(1);
    });
