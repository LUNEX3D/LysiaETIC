/**
 * Uzun süren senkron işleri için bellek içi ilerleme (tek sunucu örneği).
 * Çoklu instance / restart sonrası işlem kaybolur — kabul edilebilir.
 */

const crypto = require("crypto");

/** @type {Map<string, object>} */
const jobs = new Map();
const TTL_MS = 20 * 60 * 1000;

/**
 * @param {import("mongoose").Types.ObjectId|string} userId
 * @param {"marketplace_pull"|"marketplace_pull_all"|"auto_stock_sync"} type
 * @param {object} [meta]
 */
const createJob = (userId, type, meta = {}) => {
    const id = crypto.randomBytes(12).toString("hex");
    jobs.set(id, {
        id,
        userId: String(userId),
        type,
        meta: meta && typeof meta === "object" ? meta : {},
        status: "running",
        phase: "starting",
        progressPercent: 0,
        current: 0,
        total: 0,
        message: "",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        result: null,
        error: null
    });
    return id;
};

const updateJob = (id, patch) => {
    const j = jobs.get(id);
    if (!j || j.status !== "running") return;
    Object.assign(j, patch, { updatedAt: Date.now() });
};

const completeJob = (id, result) => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "completed";
    j.progressPercent = 100;
    j.phase = "done";
    j.result = result;
    j.updatedAt = Date.now();
};

const failJob = (id, err) => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "failed";
    j.error = err?.message ? String(err.message) : String(err || "Hata");
    j.updatedAt = Date.now();
};

const getJob = (id) => jobs.get(id) || null;

const assertJobUser = (job, userId) => job && String(job.userId) === String(userId);

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of jobs) {
        if (now - v.updatedAt > TTL_MS) jobs.delete(k);
    }
}, 120000);

module.exports = {
    createJob,
    updateJob,
    completeJob,
    failJob,
    getJob,
    assertJobUser
};
