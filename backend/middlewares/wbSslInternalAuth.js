"use strict";

const logger = require("../config/logger");

/**
 * Caddy on-demand TLS ask + internal SSL API — yalnızca localhost veya paylaşılan secret.
 */
function wbSslInternalAuth(req, res, next) {
    const secret = process.env.WB_SSL_INTERNAL_SECRET;
    const headerSecret = req.headers["x-wb-ssl-internal-secret"];

    if (secret && headerSecret === secret) {
        return next();
    }

    const allowRemote = process.env.WB_SSL_ALLOW_REMOTE_ASK === "true";
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
        .toString()
        .split(",")[0]
        .trim()
        .replace(/^::ffff:/, "");

    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
    if (local || allowRemote) {
        if (!secret && !allowRemote && !local) {
            logger.warn("[WB SSL] WB_SSL_INTERNAL_SECRET tanımlı değil; yalnızca localhost kabul ediliyor");
        }
        return next();
    }

    logger.warn(`[WB SSL] Internal SSL erişimi reddedildi: ${ip}`);
    return res.status(403).send("Forbidden");
}

module.exports = { wbSslInternalAuth };
