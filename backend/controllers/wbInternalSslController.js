"use strict";

const wbSslProvisionerService = require("../services/wbSslProvisionerService");
const logger = require("../config/logger");

/**
 * Caddy on-demand TLS ask endpoint.
 * 200 = sertifika verilebilir, 403 = reddet
 */
exports.authorizeDomain = async (req, res) => {
    try {
        const domain = (req.query.domain || "").trim();
        if (!domain) {
            return res.status(403).send("Forbidden");
        }

        const allowed = await wbSslProvisionerService.isAuthorizedForTls(domain);
        if (allowed) {
            return res.status(200).send("OK");
        }
        return res.status(403).send("Forbidden");
    } catch (err) {
        logger.error("[WB SSL] authorizeDomain:", err.message);
        return res.status(403).send("Forbidden");
    }
};
