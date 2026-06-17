"use strict";

/**
 * wbSslWorker.js — Website Builder SSL provisioning (F2)
 * DNS doğrulama wbDomainWorker'da kalır; bu worker yalnızca ssl_provisioning → active.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../.env.local"), override: true });

const logger = require("../config/logger");

function startWbSslWorker() {
    if (process.env.WB_SSL_WORKER_ENABLED === "false") {
        logger.info("[WBSslWorker] Disabled (WB_SSL_WORKER_ENABLED=false)");
        return;
    }

    const intervalMs = Math.max(60_000, parseInt(process.env.WB_SSL_PROVISION_INTERVAL_MS || "120000", 10));

    const run = async () => {
        try {
            const { runPeriodicSslProvisioning } = require("../services/wbSslProvisionerService");
            const result = await runPeriodicSslProvisioning();
            if (result.processed > 0) {
                logger.info(`[WBSslWorker] processed ${result.processed} ssl_provisioning domain(s)`);
            }
        } catch (err) {
            logger.warn(`[WBSslWorker] tick failed: ${err.message}`);
        }
    };

    run();
    setInterval(run, intervalMs);
    logger.info(`[WBSslWorker] SSL provisioning worker started (every ${intervalMs / 1000}s)`);
}

if (require.main === module) {
    const connectDB = require("../config/db");
    connectDB()
        .then(() => {
            startWbSslWorker();
        })
        .catch((err) => {
            logger.error("[WBSslWorker] Fatal:", err.message);
            process.exit(1);
        });
}

module.exports = { startWbSslWorker };
