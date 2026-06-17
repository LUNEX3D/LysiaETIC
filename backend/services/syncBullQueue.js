/**
 * Opsiyonel BullMQ kuyruğu — uzun ürün senkronları ayrı worker sürecinde çalışır.
 * API sadece jobId döner; ilerleme GET /product-management/sync/job/:jobId ile okunur.
 *
 * .env: REDIS_URL=redis://...  ve  SYNC_USE_BULLMQ=true
 * Worker: npm run worker:sync
 */

const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const QUEUE_NAME = "productSync";

/** @type {import("ioredis").default | null} */
let sharedConnection = null;

const isBullEnabled = () =>
    !!(process.env.REDIS_URL && /^(1|true|yes)$/i.test(String(process.env.SYNC_USE_BULLMQ || "")));

/**
 * @returns {import("ioredis").default | null}
 */
const getBullConnection = () => {
    if (!isBullEnabled()) return null;
    if (!sharedConnection) {
        sharedConnection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null
        });
    }
    return sharedConnection;
};

/** @type {Queue | null} */
let queueInstance = null;

const getProductSyncQueue = () => {
    const conn = getBullConnection();
    if (!conn) return null;
    if (!queueInstance) {
        queueInstance = new Queue(QUEUE_NAME, { connection: conn });
    }
    return queueInstance;
};

/**
 * @param {string} jobId
 * @param {{ userId: string, type: string, meta?: object }} data
 */
const enqueueProductSyncJob = async (jobId, data) => {
    const q = getProductSyncQueue();
    if (!q) throw new Error("BullMQ etkin değil (REDIS_URL + SYNC_USE_BULLMQ)");
    await q.add("run", data, { jobId });
};

/**
 * @param {string} jobId
 * @returns {Promise<import("bullmq").Job | undefined>}
 */
const getJobById = async (jobId) => {
    const q = getProductSyncQueue();
    if (!q) return undefined;
    return q.getJob(jobId);
};

/**
 * API ve bellek içi store ile aynı şekli döndürür
 * @param {import("bullmq").Job} job
 */
const mapBullJobToApiShape = async (job) => {
    const state = await job.getState();
    const data = job.data || {};
    const p = job.progress;
    const progress = typeof p === "object" && p && !Array.isArray(p) ? p : {};

    let status = "running";
    if (state === "completed") status = "completed";
    else if (state === "failed") status = "failed";

    const progressPercent =
        typeof progress.progressPercent === "number"
            ? progress.progressPercent
            : status === "completed"
                ? 100
                : 0;

    return {
        id: job.id,
        userId: data.userId,
        type: data.type,
        meta: data.meta && typeof data.meta === "object" ? data.meta : {},
        status,
        phase: progress.phase || (status === "completed" ? "done" : "starting"),
        progressPercent,
        current: progress.current,
        total: progress.total,
        message: progress.message || "",
        platformStats: progress.platformStats,
        pendingCount: progress.pendingCount,
        startedAt: job.timestamp,
        updatedAt: job.finishedOn || job.processedOn || job.timestamp,
        result: status === "completed" ? job.returnvalue : null,
        error: status === "failed" ? String(job.failedReason || "Hata") : null
    };
};

/**
 * Worker başlatır (ayrı process). Sunucu sürecinde çağırma.
 * @param {import("bullmq").Processor} processor
 */
const createProductSyncWorker = (processor) => {
    const base = getBullConnection();
    if (!base) return null;
    const connection = base.duplicate();
    return new Worker(QUEUE_NAME, processor, { connection });
};

module.exports = {
    QUEUE_NAME,
    isBullEnabled,
    getBullConnection,
    getProductSyncQueue,
    enqueueProductSyncJob,
    getJobById,
    mapBullJobToApiShape,
    createProductSyncWorker
};
