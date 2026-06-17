/**
 * Uzun senkron işleri: REDIS_URL + SYNC_USE_BULLMQ=true ise BullMQ; değilse bellek + setImmediate (mevcut davranış).
 */

const logger = require("../config/logger");
const Marketplace = require("../models/Marketplace");
const {
    createJob,
    updateJob,
    completeJob,
    failJob,
    getJob,
    assertJobUser,
    requestPauseJob,
    resumeJob,
    requestCancelJob,
} = require("./syncProgressStore");
const {
    syncProductsFromMarketplace,
    normalizeMarketplaceName
} = require("../services/productSyncService");
const { autoStockSync } = require("../services/stockSyncService");
const { runMissingDistributionJob } = require("../services/missingDistributionService");

const getBull = () => {
    if (!process.env.REDIS_URL || !/^(1|true|yes)$/i.test(String(process.env.SYNC_USE_BULLMQ || ""))) {
        return null;
    }
    try {
        return require("../services/syncBullQueue");
    } catch (e) {
        logger.warn(`[SyncJob] BullMQ yüklenemedi: ${e.message}`);
        return null;
    }
};

/**
 * @param {string} type
 * @param {import("mongoose").Types.ObjectId|string} userId
 * @param {object} meta
 * @param {(jobId: string) => void} runLocal
 */
const enqueueOrRunLocal = async (type, userId, meta, runLocal) => {
    const bull = getBull();
    if (bull) {
        const crypto = require("crypto");
        const jobId = crypto.randomBytes(12).toString("hex");
        await bull.enqueueProductSyncJob(jobId, {
            userId: String(userId),
            type,
            meta: meta && typeof meta === "object" ? meta : {}
        });
        return jobId;
    }
    const jobId = createJob(userId, type, meta || {});
    setImmediate(() => runLocal(jobId));
    return jobId;
};

exports.isBullSyncEnabled = () => !!getBull();

exports.scheduleMarketplacePull = (userId, marketplaceId, marketplaceName) =>
    enqueueOrRunLocal("marketplace_pull", userId, { marketplaceId, marketplaceName }, (jobId) => {
        syncProductsFromMarketplace(userId, marketplaceId, marketplaceName, (evt) => updateJob(jobId, evt))
            .then((stats) => completeJob(jobId, { stats }))
            .catch((err) => failJob(jobId, err));
    });

exports.scheduleAutoStockSync = (userId) =>
    enqueueOrRunLocal("auto_stock_sync", userId, {}, (jobId) => {
        autoStockSync(userId, (evt) => updateJob(jobId, evt))
            .then((results) => completeJob(jobId, { results }))
            .catch((err) => failJob(jobId, err));
    });

exports.scheduleSyncAllMarketplaces = (userId) =>
    enqueueOrRunLocal("marketplace_pull_all", userId, {}, (jobId) => {
        (async () => {
            try {
                const marketplaces = await Marketplace.find({ userId }).lean();
                const n = marketplaces.length;
                const results = [];
                for (let idx = 0; idx < n; idx++) {
                    const mp = marketplaces[idx];
                    const mpName = normalizeMarketplaceName(mp.marketplaceName);
                    const base = (idx / n) * 100;
                    const span = n > 0 ? 100 / n : 100;
                    try {
                        const stats = await syncProductsFromMarketplace(
                            userId,
                            mp._id.toString(),
                            mp.marketplaceName,
                            (evt) => {
                                const local = (evt.progressPercent || 0) / 100;
                                updateJob(jobId, {
                                    progressPercent: Math.min(99.9, base + local * span),
                                    phase: evt.phase,
                                    current: evt.current,
                                    total: evt.total,
                                    message: `[${idx + 1}/${n}] ${mpName}: ${evt.message || ""}`.trim()
                                });
                            }
                        );
                        results.push({ marketplace: mpName, success: true, stats });
                    } catch (err) {
                        results.push({ marketplace: mpName, success: false, error: err.message });
                    }
                }
                const totalNew = results.reduce((s, r) => s + (r.stats?.new || 0), 0);
                const totalUpdated = results.reduce((s, r) => s + (r.stats?.updated || 0), 0);
                const totalErrors = results.filter((r) => !r.success).length;
                completeJob(jobId, {
                    results,
                    summary: {
                        totalNew,
                        totalUpdated,
                        totalErrors,
                        marketplaceCount: n
                    }
                });
            } catch (e) {
                failJob(jobId, e);
            }
        })();
    });

/**
 * @param {string} jobId
 */
exports.getJobForStatus = async (jobId) => {
    const bull = getBull();
    if (bull) {
        try {
            const bj = await bull.getJobById(jobId);
            if (bj) return await bull.mapBullJobToApiShape(bj);
        } catch (e) {
            logger.warn(`[SyncJob] Bull iş durumu okunamadı (${jobId}): ${e.message}`);
        }
    }
    return getJob(jobId);
};

exports.scheduleMissingDistribution = (userId, options = {}) =>
    enqueueOrRunLocal("missing_distribution", userId, { options }, (jobId) => {
        runMissingDistributionJob(userId, (evt) => updateJob(jobId, evt), { ...(options || {}), jobId })
            .then((result) => {
                if (result?.cancelled) {
                    const { cancelJob } = require("./syncProgressStore");
                    cancelJob(jobId, result);
                } else {
                    completeJob(jobId, result);
                }
            })
            .catch((err) => failJob(jobId, err));
    });

exports.assertJobForUser = assertJobUser;

exports.pauseSyncJob = async (jobId, userId) => {
    const job = await exports.getJobForStatus(jobId);
    if (!job || !assertJobUser(job, userId)) return { ok: false, error: "İş bulunamadı" };
    if (job.status !== "running") return { ok: false, error: "Yalnızca çalışan iş duraklatılabilir" };
    const ok = requestPauseJob(jobId);
    return ok ? { ok: true } : { ok: false, error: "Duraklatılamadı" };
};

exports.resumeSyncJob = async (jobId, userId) => {
    const job = await exports.getJobForStatus(jobId);
    if (!job || !assertJobUser(job, userId)) return { ok: false, error: "İş bulunamadı" };
    if (job.status !== "paused") return { ok: false, error: "İş duraklatılmamış" };
    const ok = resumeJob(jobId);
    return ok ? { ok: true } : { ok: false, error: "Devam ettirilemedi" };
};

exports.cancelSyncJob = async (jobId, userId) => {
    const job = await exports.getJobForStatus(jobId);
    if (!job || !assertJobUser(job, userId)) return { ok: false, error: "İş bulunamadı" };
    if (!["running", "paused"].includes(job.status)) return { ok: false, error: "İş iptal edilemez" };
    const ok = requestCancelJob(jobId);
    return ok ? { ok: true } : { ok: false, error: "İptal isteği gönderilemedi" };
};
