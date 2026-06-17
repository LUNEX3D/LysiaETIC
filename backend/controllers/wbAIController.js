"use strict";

const mongoose = require("mongoose");
const logger = require("../config/logger");
const aiSvc = require("../services/wbAIService");
const WBAIJob = require("../models/WBAIJob");
const { Queue } = require("bullmq");

const getRedisUrl = () => (process.env.REDIS_URL && String(process.env.REDIS_URL).trim()) || "";

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    if (!id) return null;
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function ok(res, data, status = 200) { return res.status(status).json({ success: true, ...data }); }
function fail(res, message, status = 400) { return res.status(status).json({ success: false, error: message }); }

// Plan bazlı öncelik
function getPlanPriority(user) {
    const plan = user?.subscription?.plan || "basic";
    return { enterprise: 9, pro: 6, basic: 4, trial: 2, free: 1 }[plan] || 4;
}

// ─── Job Oluştur & Kuyruğa At ──────────────────────────────────────────────

exports.createJob = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);

        const { jobType, prompt, context = {}, parameters = {}, targetField, targetEntityType, targetEntityId } = req.body;
        if (!jobType) return fail(res, "jobType zorunlu");
        if (!prompt?.trim()) return fail(res, "prompt zorunlu");

        context.planPriority = getPlanPriority(req.user);

        const result = await aiSvc.createJob(req.params.siteId, userId, {
            jobType, prompt, context, parameters, targetField, targetEntityType, targetEntityId,
        });

        if (result.error) return fail(res, result.error);

        const redisUrl = getRedisUrl();
        if (redisUrl) {
            try {
                const queue = new Queue(result.job.queue, {
                    connection: { url: redisUrl, maxRetriesPerRequest: null },
                });
                const bullJob = await queue.add(result.job.jobType, { jobId: result.job._id.toString() }, {
                    priority: 10 - (context.planPriority || 5),
                    attempts: result.job.maxRetries || 2,
                    backoff: { type: "exponential", delay: 5000 },
                });
                await WBAIJob.updateOne({ _id: result.job._id }, { $set: { bullMQJobId: String(bullJob.id) } });
                await queue.close();
            } catch (queueErr) {
                logger.warn(`[WBAI] BullMQ kuyruğa eklenemedi: ${queueErr.message}`);
            }
        }

        return ok(res, { job: result.job }, 201);
    } catch (e) {
        logger.error("[WBAI] createJob:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Hızlı Sync İşlemler (BullMQ'suz, doğrudan OpenAI) ────────────────────

exports.quickGenerate = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);

        const { type, prompt, parameters = {} } = req.body;
        const syncTypes = ["seo_meta_generator", "color_palette_generator", "alt_text_generator", "banner_generator"];
        if (!syncTypes.includes(type)) return fail(res, `Bu tip sync desteklenmiyor: ${type}. Job oluşturun.`);
        if (!prompt?.trim()) return fail(res, "prompt zorunlu");

        // Direkt job oluştur ve inline işle (sync)
        const result = await aiSvc.createJob(req.params.siteId || "quick", userId, {
            jobType: type, prompt, context: {}, parameters,
        });

        return ok(res, { jobId: result.job._id, message: "İş kuyruğa alındı. /jobs/:id ile durumu takip edin." });
    } catch (e) {
        logger.error("[WBAI] quickGenerate:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Job Sorgulama ────────────────────────────────────────────────────────────

exports.getJobs = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { status, jobType, page, limit } = req.query;
        const result = await aiSvc.getJobs(req.params.siteId, userId, {
            status, jobType, page: parseInt(page) || 1, limit: Math.min(parseInt(limit) || 20, 50),
        });
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAI] getJobs:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.getJob = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const job = await aiSvc.getJob(req.params.jobId, userId);
        if (!job) return fail(res, "Job bulunamadı", 404);
        return ok(res, { job });
    } catch (e) {
        logger.error("[WBAI] getJob:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.cancelJob = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await aiSvc.cancelJob(req.params.jobId, userId);
        if (result.error) return fail(res, result.error);
        return ok(res, { job: result.job });
    } catch (e) {
        logger.error("[WBAI] cancelJob:", e.message);
        return fail(res, e.message, 500);
    }
};

// SSE (Server-Sent Events) — real-time job status stream
exports.streamJob = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) { res.status(401).end(); return; }

        const job = await aiSvc.getJob(req.params.jobId, userId);
        if (!job) { res.status(404).end(); return; }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

        sendEvent({ status: job.status, output: job.output });

        if (["completed", "failed", "cancelled"].includes(job.status)) {
            res.end();
            return;
        }

        const pollInterval = setInterval(async () => {
            try {
                const updated = await WBAIJob.findById(job._id).lean();
                if (!updated) { clearInterval(pollInterval); res.end(); return; }
                sendEvent({ status: updated.status, output: updated.output, errorMessage: updated.errorMessage });
                if (["completed", "failed", "cancelled"].includes(updated.status)) {
                    clearInterval(pollInterval);
                    res.end();
                }
            } catch { clearInterval(pollInterval); res.end(); }
        }, 2000);

        req.on("close", () => clearInterval(pollInterval));
    } catch (e) {
        logger.error("[WBAI] streamJob:", e.message);
        res.end();
    }
};

// ─── İçerik Arşivi ────────────────────────────────────────────────────────────

exports.getContents = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { contentType, isSaved, page, limit } = req.query;
        const result = await aiSvc.getContents(req.params.siteId, userId, {
            contentType, isSaved: isSaved !== undefined ? isSaved === "true" : undefined,
            page: parseInt(page) || 1, limit: Math.min(parseInt(limit) || 20, 50),
        });
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAI] getContents:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.saveContent = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await aiSvc.saveContent(req.params.contentId, userId);
        if (result.error) return fail(res, result.error);
        return ok(res, { content: result.content });
    } catch (e) {
        logger.error("[WBAI] saveContent:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.deleteContent = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await aiSvc.deleteContent(req.params.contentId, userId);
        if (result.error) return fail(res, result.error);
        return ok(res, { deleted: true });
    } catch (e) {
        logger.error("[WBAI] deleteContent:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Öneriler ─────────────────────────────────────────────────────────────────

exports.getSuggestions = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { type, priority, status, page, limit } = req.query;
        const result = await aiSvc.getSuggestions(req.params.siteId, userId, {
            type, priority, status: status || "new",
            page: parseInt(page) || 1, limit: parseInt(limit) || 20,
        });
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAI] getSuggestions:", e.message);
        return fail(res, e.message, 500);
    }
};

exports.updateSuggestion = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const { action } = req.body;
        if (!action) return fail(res, "action zorunlu (viewed|applied|dismissed)");
        const result = await aiSvc.updateSuggestion(req.params.siteId, req.params.suggestionId, action);
        if (result.error) return fail(res, result.error);
        return ok(res, { suggestion: result.suggestion });
    } catch (e) {
        logger.error("[WBAI] updateSuggestion:", e.message);
        return fail(res, e.message, 500);
    }
};

// ─── Kullanım İstatistikleri ──────────────────────────────────────────────────

exports.getUsageStats = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return fail(res, "Yetkisiz", 401);
        const result = await aiSvc.getUsageStats(userId, req.params.siteId);
        return ok(res, result);
    } catch (e) {
        logger.error("[WBAI] getUsageStats:", e.message);
        return fail(res, e.message, 500);
    }
};
