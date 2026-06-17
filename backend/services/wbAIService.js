"use strict";

const mongoose = require("mongoose");
const WBAIJob = require("../models/WBAIJob");
const WBAIContent = require("../models/WBAIContent");
const WBAISuggestion = require("../models/WBAISuggestion");
const logger = require("../config/logger");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

// ─── Queue mapping ─────────────────────────────────────────────────────────────
const QUEUE_MAP = {
    landing_page_generator: "wb-ai-heavy",
    blog_writer: "wb-ai-standard",
    product_description: "wb-ai-standard",
    seo_meta_generator: "wb-ai-fast",
    seo_content_assistant: "wb-ai-standard",
    category_description: "wb-ai-standard",
    banner_generator: "wb-ai-fast",
    color_palette_generator: "wb-ai-fast",
    conversion_suggestions: "wb-ai-analysis",
    ab_test_suggestions: "wb-ai-analysis",
    alt_text_generator: "wb-ai-fast",
    translation_auto: "wb-ai-standard",
    product_faq_generator: "wb-ai-standard",
    product_specs_writer: "wb-ai-standard",
    email_template_writer: "wb-ai-standard",
};

// ─── Job oluştur ve kuyruğa ekle ──────────────────────────────────────────────

async function createJob(siteId, userId, { jobType, prompt, context = {}, parameters = {}, targetField = "", targetEntityType = "", targetEntityId = null }) {
    const queue = QUEUE_MAP[jobType] || "wb-ai-standard";

    const priority = context.planPriority || 5;

    const job = await WBAIJob.create({
        siteId: toObjectId(siteId),
        userId: toObjectId(userId),
        jobType,
        status: "queued",
        priority,
        queue,
        input: {
            prompt,
            context,
            parameters: {
                tone: parameters.tone || "professional",
                language: parameters.language || "tr",
                wordCount: parameters.wordCount || 200,
                targetAudience: parameters.targetAudience || "",
                keywords: parameters.keywords || [],
                seoOptimized: parameters.seoOptimized !== false,
            },
            targetField,
            targetEntityType,
            targetEntityId: targetEntityId ? toObjectId(targetEntityId) : null,
        },
    });

    logger.info(`[WB AI] Job created: ${job._id} type=${jobType} site=${siteId}`);
    return { job };
}

// ─── Job durum sorgulama ──────────────────────────────────────────────────────

async function getJob(jobId, userId) {
    return WBAIJob.findOne({ _id: toObjectId(jobId), userId: toObjectId(userId) }).lean();
}

async function getJobs(siteId, userId, { status, jobType, page = 1, limit = 20 } = {}) {
    const filter = { siteId: toObjectId(siteId), userId: toObjectId(userId) };
    if (status) filter.status = status;
    if (jobType) filter.jobType = jobType;

    const [jobs, total] = await Promise.all([
        WBAIJob.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        WBAIJob.countDocuments(filter),
    ]);

    return { jobs, total, page, totalPages: Math.ceil(total / limit) };
}

async function cancelJob(jobId, userId) {
    const job = await WBAIJob.findOneAndUpdate(
        { _id: toObjectId(jobId), userId: toObjectId(userId), status: { $in: ["queued", "processing"] } },
        { $set: { status: "cancelled" } },
        { new: true }
    );
    if (!job) return { error: "Job bulunamadı veya iptal edilemez" };
    return { job };
}

// ─── İçerik arşivi ────────────────────────────────────────────────────────────

async function getContents(siteId, userId, { contentType, isSaved, page = 1, limit = 20 } = {}) {
    const filter = { siteId: toObjectId(siteId), userId: toObjectId(userId) };
    if (contentType) filter.contentType = contentType;
    if (isSaved !== undefined) filter.isSaved = isSaved;

    const [items, total] = await Promise.all([
        WBAIContent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        WBAIContent.countDocuments(filter),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
}

async function saveContent(contentId, userId) {
    const content = await WBAIContent.findOneAndUpdate(
        { _id: toObjectId(contentId), userId: toObjectId(userId) },
        { $set: { isSaved: true } },
        { new: true }
    );
    if (!content) return { error: "İçerik bulunamadı" };
    return { content };
}

async function deleteContent(contentId, userId) {
    const result = await WBAIContent.deleteOne({ _id: toObjectId(contentId), userId: toObjectId(userId) });
    if (result.deletedCount === 0) return { error: "İçerik bulunamadı" };
    return { success: true };
}

// ─── Öneriler ─────────────────────────────────────────────────────────────────

async function getSuggestions(siteId, userId, { type, priority, status = "new", page = 1, limit = 20 } = {}) {
    const filter = { siteId: toObjectId(siteId) };
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;

    const [suggestions, total] = await Promise.all([
        WBAISuggestion.find(filter).sort({ priority: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        WBAISuggestion.countDocuments(filter),
    ]);

    return { suggestions, total };
}

async function updateSuggestion(siteId, suggestionId, action) {
    const statusMap = {
        viewed: { status: "viewed", viewedAt: new Date() },
        applied: { status: "applied", appliedAt: new Date() },
        dismissed: { status: "dismissed", dismissedAt: new Date() },
    };

    const updates = statusMap[action];
    if (!updates) return { error: "Geçersiz aksiyon" };

    const suggestion = await WBAISuggestion.findOneAndUpdate(
        { _id: toObjectId(suggestionId), siteId: toObjectId(siteId) },
        { $set: updates },
        { new: true }
    );
    if (!suggestion) return { error: "Öneri bulunamadı" };
    return { suggestion };
}

// ─── Kullanım istatistikleri ──────────────────────────────────────────────────

async function getUsageStats(userId, siteId) {
    const filter = { userId: toObjectId(userId) };
    if (siteId) filter.siteId = toObjectId(siteId);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalJobs, completedJobs, totalTokens, recentJobs] = await Promise.all([
        WBAIJob.countDocuments(filter),
        WBAIJob.countDocuments({ ...filter, status: "completed" }),
        WBAIJob.aggregate([
            { $match: { ...filter, status: "completed" } },
            { $group: { _id: null, total: { $sum: "$output.tokensUsed" } } },
        ]),
        WBAIJob.find({ ...filter, createdAt: { $gte: thirtyDaysAgo } })
            .sort({ createdAt: -1 }).limit(10).select("jobType status createdAt output.tokensUsed").lean(),
    ]);

    return {
        totalJobs,
        completedJobs,
        totalTokensUsed: totalTokens[0]?.total || 0,
        recentJobs,
    };
}

module.exports = {
    createJob,
    getJob,
    getJobs,
    cancelJob,
    getContents,
    saveContent,
    deleteContent,
    getSuggestions,
    updateSuggestion,
    getUsageStats,
};
