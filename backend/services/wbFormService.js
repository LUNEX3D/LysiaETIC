"use strict";

const mongoose = require("mongoose");
const WBForm = require("../models/WBForm");
const WBFormSubmission = require("../models/WBFormSubmission");
const WBSite = require("../models/WBSite");
const wbFormCaptcha = require("./wbFormCaptcha");
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;
const ipHits = new Map();

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

async function assertSite(siteId, userId) {
    return WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).lean();
}

async function listForms(siteId, userId) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const forms = await WBForm.find({ siteId: toObjectId(siteId) }).sort({ updatedAt: -1 }).lean();
    return { forms };
}

async function createForm(siteId, userId, body = {}) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const slug = String(body.slug || body.name || "form").toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 60);
    const fields = (body.fields || [
        { id: "name", type: "text", label: "Ad Soyad", required: true, order: 0 },
        { id: "email", type: "email", label: "E-posta", required: true, order: 1 },
        { id: "message", type: "textarea", label: "Mesaj", required: false, order: 2 },
    ]).map((f, i) => ({ ...f, order: f.order ?? i }));
    const form = await WBForm.create({
        siteId: toObjectId(siteId),
        name: body.name || "İletişim Formu",
        slug,
        status: body.status || "active",
        fields,
        settings: body.settings || {},
    });
    return { form };
}

async function updateForm(siteId, userId, formId, updates) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const allowed = ["name", "slug", "status", "fields", "settings"];
    const $set = {};
    allowed.forEach((k) => { if (updates[k] !== undefined) $set[k] = updates[k]; });
    const form = await WBForm.findOneAndUpdate(
        { _id: toObjectId(formId), siteId: toObjectId(siteId) },
        { $set },
        { new: true }
    ).lean();
    if (!form) return { error: "Form bulunamadı" };
    return { form };
}

async function deleteForm(siteId, userId, formId) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    await WBFormSubmission.deleteMany({ siteId: toObjectId(siteId), formId: String(formId) });
    const r = await WBForm.deleteOne({ _id: toObjectId(formId), siteId: toObjectId(siteId) });
    if (!r.deletedCount) return { error: "Form bulunamadı" };
    return { success: true };
}

async function listSubmissions(siteId, userId, { formId, status, page = 1, limit = 30 } = {}) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const filter = { siteId: toObjectId(siteId) };
    if (formId) filter.formId = String(formId);
    if (status) filter.status = status;
    const [submissions, total] = await Promise.all([
        WBFormSubmission.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        WBFormSubmission.countDocuments(filter),
    ]);
    return { submissions, total, page, limit };
}

async function updateSubmission(siteId, userId, submissionId, updates) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const allowed = ["status", "isRead", "notes"];
    const $set = {};
    allowed.forEach((k) => { if (updates[k] !== undefined) $set[k] = updates[k]; });
    const submission = await WBFormSubmission.findOneAndUpdate(
        { _id: toObjectId(submissionId), siteId: toObjectId(siteId) },
        { $set },
        { new: true }
    ).lean();
    if (!submission) return { error: "Kayıt bulunamadı" };
    return { submission };
}

function checkRateLimit(ip) {
    const key = ip || "unknown";
    const now = Date.now();
    let bucket = ipHits.get(key);
    if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
        bucket = { start: now, count: 0 };
    }
    bucket.count += 1;
    ipHits.set(key, bucket);
    return bucket.count <= RATE_MAX;
}

async function exportSubmissionsCsv(siteId, userId) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const rows = await WBFormSubmission.find({ siteId: toObjectId(siteId) })
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();
    const header = ["id", "formId", "createdAt", "status", "fields"];
    const lines = [header.join(",")];
    for (const r of rows) {
        const fields = JSON.stringify(r.fields || {}).replace(/"/g, '""');
        lines.push([
            r._id,
            r.formId || "",
            r.createdAt?.toISOString() || "",
            r.status,
            `"${fields}"`,
        ].join(","));
    }
    return { csv: lines.join("\n"), count: rows.length };
}

async function getFormAnalytics(siteId, userId) {
    const site = await assertSite(siteId, userId);
    if (!site) return { error: "Site bulunamadı" };
    const since = new Date(Date.now() - 30 * 86400000);
    const [total, byStatus, byForm] = await Promise.all([
        WBFormSubmission.countDocuments({ siteId: toObjectId(siteId), createdAt: { $gte: since } }),
        WBFormSubmission.aggregate([
            { $match: { siteId: toObjectId(siteId), createdAt: { $gte: since } } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        WBFormSubmission.aggregate([
            { $match: { siteId: toObjectId(siteId), createdAt: { $gte: since } } },
            { $group: { _id: "$formId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
        ]),
    ]);
    return {
        period: "30d",
        total,
        byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
        byForm: byForm.map((f) => ({ formId: f._id, count: f.count })),
    };
}

async function submitPublicForm(site, { formId, fields, pageId, sectionId, honeypot, captchaId, captchaAnswer, ip }) {
    if (honeypot) return { error: "Spam algılandı", status: 400 };
    if (!checkRateLimit(ip)) return { error: "Çok fazla istek. Lütfen sonra deneyin.", status: 429 };
    if (!wbFormCaptcha.verifyChallenge(captchaId, captchaAnswer)) {
        return { error: "Doğrulama kodu hatalı", status: 400 };
    }
    let form = null;
    if (formId && mongoose.Types.ObjectId.isValid(formId)) {
        form = await WBForm.findOne({ _id: toObjectId(formId), siteId: site._id, status: "active" }).lean();
    }
    if (!form && formId) {
        form = await WBForm.findOne({ siteId: site._id, slug: String(formId).toLowerCase(), status: "active" }).lean();
    }
    if (form) {
        for (const field of form.fields || []) {
            if (field.required && !fields?.[field.id]) {
                return { error: `${field.label} zorunlu`, status: 400 };
            }
        }
    }
    await WBFormSubmission.create({
        siteId: site._id,
        pageId: pageId ? toObjectId(pageId) : null,
        sectionId: sectionId || "",
        formId: form?._id ? String(form._id) : (formId || ""),
        fields,
        status: "new",
    });
    if (form) {
        await WBForm.updateOne({ _id: form._id }, { $inc: { "stats.submissions": 1 } });
        const notifyEmail = form.settings?.notifyEmail;
        if (notifyEmail) {
            try {
                const emailSvc = require("./emailService");
                if (typeof emailSvc.sendRawEmail === "function") {
                    await emailSvc.sendRawEmail({
                        to: notifyEmail,
                        subject: `[${site.name}] Yeni form: ${form.name}`,
                        html: `<pre>${JSON.stringify(fields, null, 2)}</pre>`,
                    });
                }
            } catch {
                /* email optional */
            }
        }
    }
    return {
        message: form?.settings?.successMessage || "Mesajınız iletildi",
        redirectUrl: form?.settings?.redirectUrl || "",
    };
}

module.exports = {
    listForms,
    createForm,
    updateForm,
    deleteForm,
    listSubmissions,
    updateSubmission,
    submitPublicForm,
    exportSubmissionsCsv,
    getFormAnalytics,
};
