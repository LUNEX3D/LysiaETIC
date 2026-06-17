/**
 * Pazaryeri sipariş ingestion cron — tarayıcı açık olmasa da DB + e-posta güncellenir
 */

const logger = require("../config/logger");
const { syncRecentOrdersForAllUsers } = require("./orderSyncService");

const CRON_INTERVAL_MS = parseInt(process.env.ORDER_SYNC_CRON_MS || String(60 * 1000), 10);
const SYNC_WINDOW_DAYS = Math.min(
    14,
    Math.max(1, parseInt(process.env.ORDER_SYNC_CRON_DAYS || "7", 10) || 7)
);

let _timer = null;
let _running = false;

const runOrderSyncCron = async () => {
    if (_running) {
        logger.warn("[OrderSync Cron] Önceki tur devam ediyor — atlandı");
        return;
    }
    _running = true;
    const started = Date.now();

    try {
        const { syncOrdersBackground } = require("../controllers/ordersController");
        const stats = await syncRecentOrdersForAllUsers(syncOrdersBackground, {
            windowDays: SYNC_WINDOW_DAYS,
        });
        const elapsed = Date.now() - started;
        if (stats.totalSynced > 0) {
            logger.info(
                `[OrderSync Cron] ${stats.totalSynced} yeni sipariş — ${stats.users} kullanıcı (${elapsed}ms)`
            );
        }
    } catch (err) {
        logger.error("[OrderSync Cron] Hata: " + err.message);
    } finally {
        _running = false;
    }
};

const startOrderSyncCron = () => {
    if (_timer) return;
    if (process.env.DISABLE_ORDER_SYNC_CRON === "true" || process.env.DISABLE_ORDER_SYNC_CRON === "1") {
        logger.warn("[OrderSync Cron] DISABLE_ORDER_SYNC_CRON ile kapalı");
        return;
    }

    logger.info(`[OrderSync Cron] Başlatıldı — her ${Math.round(CRON_INTERVAL_MS / 1000)}sn, ${SYNC_WINDOW_DAYS}g pencere`);
    runOrderSyncCron().catch(() => {});
    _timer = setInterval(() => {
        runOrderSyncCron().catch(() => {});
    }, CRON_INTERVAL_MS);
    if (_timer.unref) _timer.unref();
};

const stopOrderSyncCron = () => {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
};

module.exports = { startOrderSyncCron, stopOrderSyncCron, runOrderSyncCron };
