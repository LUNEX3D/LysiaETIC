const ClientErrorLog = require("../models/ClientErrorLog");
const AuditLog = require("../models/AuditLog");
const AIActionAudit = require("../models/AIActionAudit");
const Recommendation = require("../models/Recommendation");
const logger = require("../config/logger");

const normalizeItem = (item = {}) => ({
    source: String(item.source || "api").slice(0, 40),
    statusCode: Number(item.statusCode || 0) || 0,
    path: String(item.path || "").slice(0, 300),
    method: String(item.method || "GET").toUpperCase().slice(0, 10),
    message: String(item.message || "Bilinmeyen istemci hatası").slice(0, 500),
    stack: String(item.stack || "").slice(0, 4000),
    userAgent: String(item.userAgent || "").slice(0, 500),
    pageUrl: String(item.pageUrl || "").slice(0, 500),
    meta: typeof item.meta === "object" && item.meta !== null ? item.meta : {},
});

exports.createClientError = async (req, res) => {
    try {
        const payload = normalizeItem(req.body || {});
        const doc = await ClientErrorLog.create({
            userId: req.user._id,
            ...payload
        });

        logger.warn(`[ClientError] ${req.user.email} ${payload.method} ${payload.path} ${payload.statusCode} ${payload.message}`);
        return res.json({ success: true, id: doc._id });
    } catch (error) {
        logger.error(`Client error log kayıt hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "İstemci hata kaydı alınamadı" });
    }
};

exports.createClientErrorsBulk = async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (!items.length) {
            return res.status(400).json({ success: false, message: "items zorunludur" });
        }

        const normalized = items.slice(0, 50).map((it) => ({
            userId: req.user._id,
            ...normalizeItem(it),
        }));
        await ClientErrorLog.insertMany(normalized, { ordered: false });
        return res.json({ success: true, inserted: normalized.length });
    } catch (error) {
        logger.error(`Client error bulk kayıt hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "Toplu istemci hata kaydı alınamadı" });
    }
};

/** Oturum açmış kullanıcının sunucuya daha önce gönderdiği istemci hata kayıtları */
exports.getClientErrorsMine = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 80), 200);
        const rows = await ClientErrorLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return res.json({ success: true, errors: rows });
    } catch (error) {
        logger.error(`Kullanıcı istemci hata listesi: ${error.message}`);
        return res.status(500).json({ success: false, message: "Kayıtlar alınamadı" });
    }
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Unified Activity Feed — Kullanıcı + AI + Sistem aktivitelerini birleştirir
 * ═══════════════════════════════════════════════════════════════════════════
 * Query params:
 *   - actor: "user" | "ai" | "system" | "all" (default: all)
 *   - kind:  "error" | "audit" | "ai_action" | "ai_decision" | "all"
 *   - severity: "info" | "warning" | "error" | "critical" | "success" | "all"
 *   - category: serbest metin (audit kategorisi veya ai action tipi)
 *   - search: full-text — başlık/açıklama/path içinde arama
 *   - from, to: ISO tarihler
 *   - limit: max 500 (her kaynak için ayrı limit uygulanır)
 *
 * Tüm kayıtlar şu standart formata dönüştürülür:
 *   { id, source, actor, kind, severity, category, title, description, ts, meta, ...typeSpecific }
 */

const SOURCE_META = {
    client_error: { actor: "user", kind: "error" },
    audit: { actor: "user", kind: "audit" },
    ai_action: { actor: "ai", kind: "ai_action" },
    ai_decision: { actor: "ai", kind: "ai_decision" },
};

const mapClientError = (row) => ({
    id: `ce_${row._id}`,
    source: "client_error",
    actor: "user",
    kind: "error",
    severity: row.statusCode >= 500 ? "error" : row.statusCode >= 400 ? "warning" : "info",
    category: row.source || "api",
    title: row.statusCode ? `HTTP ${row.statusCode} • ${row.method} ${row.path}` : (row.message?.slice(0, 80) || "İstemci Hatası"),
    description: row.message || "",
    ts: row.createdAt,
    icon: "⚠️",
    statusCode: row.statusCode,
    path: row.path,
    method: row.method,
    pageUrl: row.pageUrl,
    stack: row.stack,
    meta: row.meta || {},
});

const mapAuditLog = (row) => ({
    id: `au_${row._id}`,
    source: "audit",
    actor: row.adminId ? "admin" : "user",
    kind: "audit",
    severity: row.severity || "info",
    category: row.category || "system",
    title: row.action || "Sistem İşlemi",
    description: row.description || "",
    ts: row.createdAt,
    icon: row.category === "security" ? "🔒" : row.category === "payment" ? "💳" : row.category === "subscription" ? "📋" : "📝",
    success: row.success,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    meta: row.metadata || {},
});

const mapAIAction = (row) => {
    const before = row.before || {};
    const after = row.after || {};
    const target = row.target || {};
    const decision = row.decision || {};
    const result = row.result || {};
    return {
        id: `aa_${row._id}`,
        source: "ai_action",
        actor: "ai",
        kind: "ai_action",
        severity: row.rollback?.rolledBack ? "warning" : result.success ? "success" : "error",
        category: row.actionType || "other",
        title: decision.title || `AI: ${row.actionType}`,
        description: decision.description || result.message || "",
        ts: row.createdAt,
        icon: row.actionType === "update_price" ? "💰" : row.actionType === "apply_discount" ? "🏷️" : row.actionType === "create_stock_order" ? "📦" : "🤖",
        productName: target.productName,
        barcode: target.barcode,
        marketplace: target.marketplace,
        before,
        after,
        confidence: decision.confidence,
        impact: decision.impact,
        guardrailApplied: decision.guardrailApplied,
        guardrailNote: decision.guardrailNote,
        trigger: row.trigger,
        operationMode: row.operationMode,
        success: result.success,
        durationMs: result.durationMs,
        rolledBack: row.rollback?.rolledBack || false,
        rolledBackAt: row.rollback?.rolledBackAt,
        rollbackReason: row.rollback?.rollbackReason,
        recommendationId: row.recommendationId,
        meta: {},
    };
};

const mapRecommendation = (row) => {
    const a = row.actionPayload || {};
    return {
        id: `rc_${row._id}`,
        source: "ai_decision",
        actor: "ai",
        kind: "ai_decision",
        severity: row.blocked ? "warning" : row.status === "rejected" ? "warning" : row.status === "executed" ? "success" : "info",
        category: row.type || "general",
        title: row.title || "AI Önerisi",
        description: row.description || "",
        ts: row.createdAt,
        icon: row.priority === "critical" ? "🔴" : row.priority === "high" ? "🟡" : "🤖",
        priority: row.priority,
        confidence: row.confidenceScore,
        impact: row.impact?.profitChange || 0,
        status: row.status,
        actionType: a.actionType,
        targetName: a.targetName,
        params: a.params,
        guardrailNote: row.guardrailNote,
        blocked: row.blocked,
        blockReasons: row.blockReasons,
        ruleTrace: row.ruleTrace,
        executedAt: row.executedAt,
        meta: {},
    };
};

exports.getActivityFeed = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            actor = "all",
            kind = "all",
            severity = "all",
            category = "",
            search = "",
            from,
            to,
            limit = 150,
        } = req.query;

        const lim = Math.min(Math.max(Number(limit) || 150, 10), 500);
        const dateFilter = {};
        if (from) {
            const d = new Date(from);
            if (!Number.isNaN(d.getTime())) dateFilter.$gte = d;
        }
        if (to) {
            const d = new Date(to);
            if (!Number.isNaN(d.getTime())) dateFilter.$lte = d;
        }
        const dateClause = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
        const searchClause = search ? { $text: { $search: String(search).slice(0, 200) } } : null;

        // Hangi kaynakları çekeceğimize karar ver
        const wantUser = actor === "all" || actor === "user";
        const wantAI = actor === "all" || actor === "ai";
        const wantSystem = actor === "all" || actor === "system";

        const wantErr = (kind === "all" || kind === "error") && wantUser;
        const wantAud = (kind === "all" || kind === "audit") && (wantUser || wantSystem);
        const wantAct = (kind === "all" || kind === "ai_action") && wantAI;
        const wantDec = (kind === "all" || kind === "ai_decision") && wantAI;

        // Paralel sorgular
        const tasks = [];
        if (wantErr) {
            const q = { userId, ...dateClause };
            if (search) {
                q.$or = [
                    { message: { $regex: search.slice(0, 100), $options: "i" } },
                    { path: { $regex: search.slice(0, 100), $options: "i" } },
                ];
            }
            tasks.push(ClientErrorLog.find(q).sort({ createdAt: -1 }).limit(lim).lean().then(rs => rs.map(mapClientError)));
        } else tasks.push(Promise.resolve([]));

        if (wantAud) {
            const q = { userId, ...dateClause };
            if (category) q.category = category;
            if (search) q.$or = [
                { action: { $regex: search.slice(0, 100), $options: "i" } },
                { description: { $regex: search.slice(0, 100), $options: "i" } },
            ];
            tasks.push(AuditLog.find(q).sort({ createdAt: -1 }).limit(lim).lean().then(rs => rs.map(mapAuditLog)));
        } else tasks.push(Promise.resolve([]));

        if (wantAct) {
            const q = { userId, ...dateClause };
            if (category) q.actionType = category;
            if (search) q.$or = [
                { "decision.title": { $regex: search.slice(0, 100), $options: "i" } },
                { "target.productName": { $regex: search.slice(0, 100), $options: "i" } },
                { "target.barcode": { $regex: search.slice(0, 100), $options: "i" } },
            ];
            tasks.push(AIActionAudit.find(q).sort({ createdAt: -1 }).limit(lim).lean().then(rs => rs.map(mapAIAction)));
        } else tasks.push(Promise.resolve([]));

        if (wantDec) {
            const q = { userId, ...dateClause };
            if (category) q.type = category;
            if (search) q.$or = [
                { title: { $regex: search.slice(0, 100), $options: "i" } },
                { description: { $regex: search.slice(0, 100), $options: "i" } },
            ];
            tasks.push(Recommendation.find(q).sort({ createdAt: -1 }).limit(lim).lean().then(rs => rs.map(mapRecommendation)));
        } else tasks.push(Promise.resolve([]));

        const [errors, audits, actions, decisions] = await Promise.all(tasks);

        let merged = [...errors, ...audits, ...actions, ...decisions];

        // Severity filtresi
        if (severity && severity !== "all") {
            merged = merged.filter(x => x.severity === severity);
        }

        // Tarih sırası — en yeni üstte
        merged.sort((a, b) => new Date(b.ts) - new Date(a.ts));

        // Üst limit (toplam)
        const trimmed = merged.slice(0, lim);

        // Sayım özeti
        const counts = {
            total: merged.length,
            byActor: { user: 0, ai: 0, admin: 0, system: 0 },
            byKind: { error: 0, audit: 0, ai_action: 0, ai_decision: 0 },
            bySeverity: { info: 0, warning: 0, error: 0, critical: 0, success: 0 },
        };
        for (const x of merged) {
            counts.byActor[x.actor] = (counts.byActor[x.actor] || 0) + 1;
            counts.byKind[x.kind] = (counts.byKind[x.kind] || 0) + 1;
            counts.bySeverity[x.severity] = (counts.bySeverity[x.severity] || 0) + 1;
        }

        return res.json({
            success: true,
            items: trimmed,
            counts,
            sources: { errors: errors.length, audits: audits.length, actions: actions.length, decisions: decisions.length },
        });
    } catch (error) {
        logger.error(`Aktivite feed hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "Aktivite akışı alınamadı" });
    }
};

exports.getClientErrorsAdmin = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 100), 500);
        const filter = {};
        if (req.query.statusCode) filter.statusCode = Number(req.query.statusCode);
        if (req.query.source) filter.source = String(req.query.source);
        if (req.query.userId) filter.userId = req.query.userId;
        if (req.query.from || req.query.to) {
            filter.createdAt = {};
            if (req.query.from) {
                const from = new Date(req.query.from);
                if (!Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
            }
            if (req.query.to) {
                const to = new Date(req.query.to);
                if (!Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
            }
            if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
        }

        const rows = await ClientErrorLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("userId", "email name role")
            .lean();
        return res.json({ success: true, errors: rows });
    } catch (error) {
        logger.error(`Admin client error listeleme hatası: ${error.message}`);
        return res.status(500).json({ success: false, message: "İstemci hata kayıtları alınamadı" });
    }
};
