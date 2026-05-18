/**
 * PazarYonet — alan adı ve CORS origin merkezi yapılandırması
 * APP_URL / APP_DOMAIN .env üzerinden override edilebilir
 */
const APP_DOMAIN = (process.env.APP_DOMAIN || "pazaryonet.com").replace(/^https?:\/\//, "").replace(/\/$/, "");

const APP_URL = (process.env.APP_URL || `https://${APP_DOMAIN}`).replace(/\/$/, "");

/** @param {string} host */
function originsForHost(host) {
    const h = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!h) return [];
    const bases = [h];
    if (!h.startsWith("www.")) bases.push(`www.${h}`);
    const out = [];
    for (const b of bases) {
        out.push(`https://${b}`, `http://${b}`);
    }
    return out;
}

const LOCAL_DEV_PORTS = [3000, 3001, 5000];

function buildLocalDevOrigins() {
    const hosts = new Set(["localhost", "127.0.0.1", APP_DOMAIN]);
    if (!APP_DOMAIN.startsWith("www.")) hosts.add(`www.${APP_DOMAIN}`);
    const out = [];
    for (const h of hosts) {
        for (const port of LOCAL_DEV_PORTS) {
            out.push(`http://${h}:${port}`);
        }
    }
    return out;
}

const LOCAL_DEV_ORIGINS = buildLocalDevOrigins();

/** Eski / geçiş dönemi domain ve sunucu IP */
const LEGACY_ORIGINS = [
    "https://13.51.158.124",
    "http://13.51.158.124",
    ...originsForHost("pazaryonetim.com"),
    ...originsForHost("pazaryönetim.com"),
    "https://xn--pazarynetim-wfb.com",
    "https://www.xn--pazarynetim-wfb.com",
    "http://xn--pazarynetim-wfb.com",
    "http://www.xn--pazarynetim-wfb.com",
    ...originsForHost("lunexetic.com"),
];

function getCorsAllowedOrigins() {
    const set = new Set([
        ...LOCAL_DEV_ORIGINS,
        ...originsForHost(APP_DOMAIN),
        ...LEGACY_ORIGINS,
    ]);
    if (process.env.CORS_EXTRA_ORIGINS) {
        process.env.CORS_EXTRA_ORIGINS.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((o) => set.add(o));
    }
    return [...set];
}

module.exports = {
    APP_DOMAIN,
    APP_URL,
    getCorsAllowedOrigins,
    originsForHost,
};
