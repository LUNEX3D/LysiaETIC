const { APP_URL } = require("../config/domain");

const LEGACY_HOSTS = new Set([
    "pazaryonet.com",
    "www.pazaryonet.com",
    "pazaryonetim.com",
    "www.pazaryonetim.com",
    "pazaryönetim.com",
    "www.pazaryönetim.com",
    "xn--pazarynetim-wfb.com",
    "www.xn--pazarynetim-wfb.com",
]);

const CANONICAL_BASE = APP_URL.replace(/\/$/, "");

/**
 * Eski domain üzerinden gelen istekleri dashtock.com'a yönlendir
 */
function canonicalHostRedirect(req, res, next) {
    const host = (req.headers.host || "").split(":")[0].toLowerCase();
    if (!LEGACY_HOSTS.has(host)) return next();
    const path = req.originalUrl || req.url || "/";
    return res.redirect(301, `${CANONICAL_BASE}${path}`);
}

module.exports = { canonicalHostRedirect, LEGACY_HOSTS };
