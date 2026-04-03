/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI CHAT CONTROLLER — LysiaETIC AI Operatör
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Endpoints:
 *   POST /api/ai-chat/message              — Mesaj gönder, AI cevap alsın
 *   GET  /api/ai-chat/history/:sid         — Konuşma geçmişi
 *   GET  /api/ai-chat/conversations        — Son konuşmalar listesi
 *   DELETE /api/ai-chat/conversation/:sid  — Konuşma sil
 *   GET  /api/ai-chat/alerts               — Proaktif uyarılar
 *   GET  /api/ai-chat/quick-stats          — Hızlı istatistikler
 *   POST /api/ai-chat/operator/cycle       — Tam AI Operatör döngüsü çalıştır (manuel)
 *   POST /api/ai-chat/operator/act         — Tek aksiyon uygula
 *   GET  /api/ai-chat/operator/status      — Operatör durumu
 *   POST /api/ai-chat/operator/mode        — Kontrol modunu değiştir
 *   GET  /api/ai-chat/operator/cycles      — Otonom döngü geçmişi
 *   GET  /api/ai-chat/operator/cycle/:id   — Tek döngü detayı
 *   GET  /api/ai-chat/worker/status        — Background worker durumu
 *   POST /api/ai-chat/worker/force-cycle   — Kullanıcı için döngüyü zorla çalıştır
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const AIChatService = require("../services/aiChatService");
const AIOperator = require("../services/aiOperatorEngine");
const AIConversation = require("../models/AIConversation");
const AIMemory = require("../models/AIMemory");
const AICycleResult = require("../models/AICycleResult");
const AIWorker = require("../services/aiBackgroundWorker");
const logger = require("../config/logger");
const crypto = require("crypto");

const uid = (req) => req.user?._id || req.user?.id;

// ═════════════════════════════════════════════════════════════════════════════
// POST /message — Ana chat endpoint
// ═════════════════════════════════════════════════════════════════════════════
exports.sendMessage = async (req, res) => {
    try {
        const userId = uid(req);
        const { message, sessionId } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Mesaj boş olamaz" });
        }

        // Session ID yoksa oluştur
        const sid = sessionId || `session_${crypto.randomBytes(8).toString("hex")}`;

        const result = await AIChatService.processMessage(userId, sid, message.trim());

        res.json({
            success: result.success,
            ...result,
        });
    } catch (err) {
        logger.error(`[AI Chat] sendMessage error: ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Mesaj işlenemedi",
            error: err.message,
            response: {
                content: "Bir hata oluştu. Lütfen tekrar deneyin. 🔄",
                suggestions: ["Tekrar dene", "Yardım"],
            },
        });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /history/:sessionId — Konuşma geçmişi
// ═════════════════════════════════════════════════════════════════════════════
exports.getHistory = async (req, res) => {
    try {
        const userId = uid(req);
        const { sessionId } = req.params;

        const history = await AIChatService.getConversationHistory(userId, sessionId);
        res.json({ success: true, ...history });
    } catch (err) {
        logger.error(`[AI Chat] getHistory error: ${err.message}`);
        res.status(500).json({ success: false, message: "Geçmiş yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /conversations — Son konuşmalar listesi
// ═════════════════════════════════════════════════════════════════════════════
exports.getConversations = async (req, res) => {
    try {
        const userId = uid(req);
        const limit = parseInt(req.query.limit) || 10;

        const conversations = await AIChatService.getRecentConversations(userId, limit);
        res.json({ success: true, conversations });
    } catch (err) {
        logger.error(`[AI Chat] getConversations error: ${err.message}`);
        res.status(500).json({ success: false, message: "Konuşmalar yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /conversation/:sessionId — Konuşma sil
// ═════════════════════════════════════════════════════════════════════════════
exports.deleteConversation = async (req, res) => {
    try {
        const userId = uid(req);
        const { sessionId } = req.params;

        const result = await AIChatService.clearConversation(userId, sessionId);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[AI Chat] deleteConversation error: ${err.message}`);
        res.status(500).json({ success: false, message: "Konuşma silinemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /alerts — Proaktif uyarılar
// ═════════════════════════════════════════════════════════════════════════════
exports.getAlerts = async (req, res) => {
    try {
        const userId = uid(req);
        const alerts = await AIOperator.generateProactiveAlerts(userId);
        res.json({ success: true, ...alerts });
    } catch (err) {
        logger.error(`[AI Chat] getAlerts error: ${err.message}`);
        res.status(500).json({ success: false, message: "Uyarılar yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /quick-stats — Hızlı istatistikler
// ═════════════════════════════════════════════════════════════════════════════
exports.getQuickStats = async (req, res) => {
    try {
        const userId = uid(req);
        const stats = await AIOperator.getQuickStats(userId);
        res.json({ success: true, stats });
    } catch (err) {
        logger.error(`[AI Chat] getQuickStats error: ${err.message}`);
        res.status(500).json({ success: false, message: "İstatistikler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /operator/cycle — Tam AI Operatör döngüsü
// ═════════════════════════════════════════════════════════════════════════════
exports.runOperatorCycle = async (req, res) => {
    try {
        const userId = uid(req);
        const operationMode = req.body.mode || "assisted";

        if (!["passive", "assisted", "autonomous"].includes(operationMode)) {
            return res.status(400).json({ success: false, message: "Geçersiz mod. passive, assisted veya autonomous olmalı." });
        }

        const result = await AIOperator.runFullCycle(userId, operationMode);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[AI Operator] runCycle error: ${err.message}`);
        res.status(500).json({ success: false, message: "Operatör döngüsü başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /operator/act — Tek aksiyon uygula
// ═════════════════════════════════════════════════════════════════════════════
exports.executeAction = async (req, res) => {
    try {
        const userId = uid(req);
        const { decision } = req.body;

        if (!decision || !decision.action) {
            return res.status(400).json({ success: false, message: "Aksiyon bilgisi eksik" });
        }

        // Aksiyon uygula
        const actionResult = await AIOperator.act(userId, decision);

        // Doğrula
        const verification = await AIOperator.verify(userId, actionResult, decision);

        // Öğren
        await AIOperator.learn(userId, decision, actionResult, verification);

        res.json({
            success: actionResult.success,
            message: actionResult.message,
            actionResult,
            verification,
        });
    } catch (err) {
        logger.error(`[AI Operator] executeAction error: ${err.message}`);
        res.status(500).json({ success: false, message: "Aksiyon uygulanamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /operator/status — Operatör durumu
// ═════════════════════════════════════════════════════════════════════════════
exports.getOperatorStatus = async (req, res) => {
    try {
        const userId = uid(req);

        // Kullanıcının mevcut modu
        const conversation = await AIConversation.findOne({ userId, status: "active" })
            .sort({ updatedAt: -1 })
            .select("context.operationMode")
            .lean();

        const operationMode = conversation?.context?.operationMode || "assisted";

        // Hafıza istatistikleri
        const [totalMemories, actionMemories, learnedPatterns, userPreferences, marketInsights] = await Promise.all([
            AIMemory.countDocuments({ userId }),
            AIMemory.countDocuments({ userId, memoryType: "action_result" }),
            AIMemory.countDocuments({ userId, memoryType: { $in: ["pattern_learned", "rule_learned"] } }),
            AIMemory.countDocuments({ userId, memoryType: "user_preference" }),
            AIMemory.countDocuments({ userId, memoryType: "context_memory" }),
        ]);

        // Son aksiyonlar
        const recentActions = await AIMemory.find({ userId, memoryType: "action_result" })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Quick stats
        const stats = await AIOperator.getQuickStats(userId);

        res.json({
            success: true,
            operationMode,
            guardrails: AIOperator.GUARDRAILS,
            memory: {
                totalMemories,
                actionMemories,
                learnedPatterns,
                userPreferences,
                marketInsights,
                recentActions: recentActions.map(m => ({
                    action: m.action?.type || m.value?.decision?.action || "unknown",
                    target: m.action?.targetName || m.value?.decision?.title || "unknown",
                    success: m.result?.success ?? m.value?.result?.success ?? false,
                    verdict: m.result?.verdict || (m.value?.result?.success ? "positive" : "negative"),
                    date: m.createdAt,
                })),
            },
            businessHealth: {
                score: stats.healthScore,
                rating: stats.rating,
            },
            stats,
        });
    } catch (err) {
        logger.error(`[AI Operator] getStatus error: ${err.message}`);
        res.status(500).json({ success: false, message: "Operatör durumu yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /operator/mode — Kontrol modunu değiştir
// ═════════════════════════════════════════════════════════════════════════════
exports.setOperationMode = async (req, res) => {
    try {
        const userId = uid(req);
        const { mode } = req.body;

        if (!["passive", "assisted", "autonomous"].includes(mode)) {
            return res.status(400).json({ success: false, message: "Geçersiz mod. passive, assisted veya autonomous olmalı." });
        }

        // Tüm aktif konuşmalarda modu güncelle
        await AIConversation.updateMany(
            { userId, status: "active" },
            { $set: { "context.operationMode": mode } }
        );

        // Hafızaya kaydet
        await AIMemory.findOneAndUpdate(
            { userId, memoryType: "user_preference", key: "operation_mode" },
            {
                $set: {
                    value: { mode, changedAt: new Date() },
                    lastUsedAt: new Date(),
                    confidence: 100,
                },
                $inc: { occurrenceCount: 1 },
            },
            { upsert: true }
        );

        const modeLabels = {
            passive: "🟢 Pasif — Sadece analiz ve öneri",
            assisted: "🟡 Asistan — Öneri + onay ile uygulama",
            autonomous: "🔴 Otonom — Tam otomatik yönetim",
        };

        logger.info(`🤖 [AI Operatör] Mode changed to ${mode} for user ${userId}`);

        res.json({
            success: true,
            mode,
            label: modeLabels[mode],
            message: `Operasyon modu değiştirildi: ${modeLabels[mode]}`,
        });
    } catch (err) {
        logger.error(`[AI Operator] setMode error: ${err.message}`);
        res.status(500).json({ success: false, message: "Mod değiştirilemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /operator/cycles — Döngü geçmişi
// ═════════════════════════════════════════════════════════════════════════════
exports.getCycleHistory = async (req, res) => {
    try {
        const userId = uid(req);
        const limit = parseInt(req.query.limit) || 20;
        const skip = parseInt(req.query.skip) || 0;

        const [cycles, totalCount] = await Promise.all([
            AICycleResult.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AICycleResult.countDocuments({ userId }),
        ]);

        res.json({
            success: true,
            cycles,
            totalCount,
            limit,
            skip,
            hasMore: skip + cycles.length < totalCount,
        });
    } catch (err) {
        logger.error(`[AI Operator] getCycleHistory error: ${err.message}`);
        res.status(500).json({ success: false, message: "Döngü geçmişi yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /operator/cycle/:id — Tek döngü detayı
// ═════════════════════════════════════════════════════════════════════════════
exports.getCycleDetail = async (req, res) => {
    try {
        const userId = uid(req);
        const { id } = req.params;

        const cycle = await AICycleResult.findOne({ _id: id, userId }).lean();

        if (!cycle) {
            return res.status(404).json({ success: false, message: "Döngü bulunamadı" });
        }

        res.json({ success: true, cycle });
    } catch (err) {
        logger.error(`[AI Operator] getCycleDetail error: ${err.message}`);
        res.status(500).json({ success: false, message: "Döngü detayı yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /worker/status — Background worker durumu
// ═════════════════════════════════════════════════════════════════════════════
exports.getWorkerStatus = async (req, res) => {
    try {
        const status = AIWorker.getWorkerStatus();
        res.json({ success: true, ...status });
    } catch (err) {
        logger.error(`[AI Worker] getWorkerStatus error: ${err.message}`);
        res.status(500).json({ success: false, message: "Worker durumu yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /worker/force-cycle — Kullanıcı için döngüyü zorla çalıştır
// ═════════════════════════════════════════════════════════════════════════════
exports.forceCycle = async (req, res) => {
    try {
        const userId = uid(req);
        const result = await AIWorker.forceCycleForUser(userId);

        if (result.success) {
            res.json({
                success: true,
                message: "Döngü başarıyla çalıştırıldı",
                ...result,
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || "Döngü çalıştırılamadı",
            });
        }
    } catch (err) {
        logger.error(`[AI Worker] forceCycle error: ${err.message}`);
        res.status(500).json({ success: false, message: "Döngü zorla çalıştırılamadı", error: err.message });
    }
};
