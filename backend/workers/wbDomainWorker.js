"use strict";

/**
 * wbDomainWorker.js — Website Builder domain DNS doğrulama (periyodik)
 * SSL issuance F2'de wbSslWorker ile genişletilecek.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../.env.local"), override: true });

const logger = require("../config/logger");

function startWbDomainWorker() {
    if (process.env.WB_DOMAIN_WORKER_ENABLED === "false") {
        logger.info("[WBDomainWorker] Disabled (WB_DOMAIN_WORKER_ENABLED=false)");
        return;
    }

    const intervalMs = Math.max(60_000, parseInt(process.env.WB_DOMAIN_VERIFY_INTERVAL_MS || "300000", 10));

    const run = async () => {
        try {
            const { runPeriodicVerification } = require("../services/wbDomainService");
            await runPeriodicVerification();
        } catch (err) {
            logger.warn(`[WBDomainWorker] tick failed: ${err.message}`);
        }
    };

    run();
    setInterval(run, intervalMs);
    logger.info(`[WBDomainWorker] DNS verification worker started (every ${intervalMs / 1000}s)`);
}

if (require.main === module) {
    const connectDB = require("../config/db");
    connectDB()
        .then(() => {
            startWbDomainWorker();
        })
        .catch((err) => {
            logger.error("[WBDomainWorker] Fatal:", err.message);
            process.exit(1);
        });
}

module.exports = { startWbDomainWorker };
