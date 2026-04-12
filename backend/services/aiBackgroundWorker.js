/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI BACKGROUND WORKER v2 — LysiaETIC AI Operatör Otonom Döngü
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Arka planda SÜREKLİ çalışan AI sistemi. İki ana görev:
 *
 *  1. ANALİZ CACHE — Her 5 dakikada tüm kullanıcıların Brain Dashboard'unu
 *     hesaplar ve AIAnalysisCache'e yazar. Frontend buradan okur → anlık yanıt.
 *
 *  2. AI OPERATÖR DÖNGÜSÜ — Her 10 dakikada tüm kullanıcılar için 6 fazlı
 *     tam AI döngüsünü çalıştırır:
 *       OBSERVE → ANALYZE → DECIDE → ACT → VERIFY → LEARN
 *
 *     Kullanıcının operationMode'una göre davranır:
 *       🟢 passive    — Sadece analiz + karar üretir, uygulamaz
 *       🟡 assisted   — Analiz + karar üretir, kritik olmayanları uygular
 *       🔴 autonomous — Tam otomatik: analiz + karar + uygulama + doğrulama + öğrenme
 *
 *     Her döngü sonucu AICycleResult koleksiyonuna kaydedilir.
 *     Frontend döngü geçmişini, aksiyonları ve öğrenmeleri buradan gösterir.
 *
 * GÜVENLİK:
 *  - Fiyat değişimi max %20 (tek seferde)
 *  - Saatte max 50 aksiyon
 *  - Aynı ürüne 5 dakika cooldown
 *  - Guardrail tetiklenirse autonomous modda bile onay ister
 *  - Her aksiyon loglanır ve hafızaya kaydedilir
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const User = require("../models/User");
const ProductMapping = require("../models/ProductMapping");
const AIAnalysisCache = require("../models/AIAnalysisCache");
const AICycleResult = require("../models/AICycleResult");
const AIMemory = require("../models/AIMemory");
const AIConversation = require("../models/AIConversation");
const AIEngine = require("./aiEngineService");
const AIBrain = require("./aiOperationsBrain");
const AIOperator = require("./aiOperatorEngine");
const { createNotificationDirect } = require("../controllers/notificationController");
const logger = require("../config/logger");

// ─── Configuration ──────────────────────────────────────────────────────────
const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000;     // 5 min — analiz cache yenileme
const CYCLE_INTERVAL_MS    = 10 * 60 * 1000;     // 10 min — AI Operatör tam döngü
const USER_DELAY_MS        = 2000;                // 2s — kullanıcılar arası bekleme
const CYCLE_USER_DELAY_MS  = 3000;                // 3s — döngüde kullanıcılar arası bekleme
const MAX_CONSECUTIVE_ERRORS = 5;                 // N ardışık hatadan sonra kullanıcıyı atla
const STALE_THRESHOLD_MS   = 4 * 60 * 1000;      // 4 min — cache bayatlık eşiği
const INITIAL_DELAY_MS     = 30 * 1000;           // 30s — sunucu başlangıcında bekleme
const CYCLE_INITIAL_DELAY_MS = 60 * 1000;         // 60s — döngü ilk çalışma gecikmesi

let analysisInterval = null;
let cycleInterval = null;
let isAnalysisRunning = false;
let isCycleRunning = false;

let workerStats = {
    // Analiz cache stats
    totalAnalysisCycles: 0,
    lastAnalysisCycleAt: null,
    lastAnalysisDurationMs: 0,
    analysisUsersProcessed: 0,
    analysisUsersSkipped: 0,
    analysisUsersFailed: 0,
    // Operatör döngü stats
    totalOperatorCycles: 0,
    lastOperatorCycleAt: null,
    lastOperatorDurationMs: 0,
    operatorUsersProcessed: 0,
    operatorActionsExecuted: 0,
    operatorDecisionsGenerated: 0,
    // Genel
    isActive: false,
    startedAt: null,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Get active users ───────────────────────────────────────────────────────
async function getActiveUsers() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Ürünü olan kullanıcılar (aktif satıcılar)
    const userIdsWithProducts = await ProductMapping.distinct("userId");

    if (userIdsWithProducts.length === 0) {
        // Fallback: son 7 günde aktif kullanıcılar
        const recentUsers = await User.find(
            { updatedAt: { $gte: sevenDaysAgo } },
            { _id: 1 }
        ).lean();
        return recentUsers.map(u => u._id);
    }

    return userIdsWithProducts;
}

// ─── Get user's operation mode ──────────────────────────────────────────────
async function getUserOperationMode(userId) {
    // 1. Önce AIMemory'den user_preference kontrol et (en güvenilir)
    const modePref = await AIMemory.findOne({
        userId,
        memoryType: "user_preference",
        key: "operation_mode",
    }).lean();

    if (modePref?.value?.mode) {
        return modePref.value.mode;
    }

    // 2. Sonra aktif konuşmadan kontrol et
    const conversation = await AIConversation.findOne({
        userId,
        status: "active",
    }).sort({ updatedAt: -1 }).select("context.operationMode").lean();

    if (conversation?.context?.operationMode) {
        return conversation.context.operationMode;
    }

    // 3. Default: assisted
    return "assisted";
}

// ═════════════════════════════════════════════════════════════════════════════
// GÖREV 1: ANALİZ CACHE — Brain Dashboard hesapla ve cache'le
// ═════════════════════════════════════════════════════════════════════════════

// ─── AI Bildirim Üretimi ─────────────────────────────────────────────────────
// Analiz sonuçlarına göre kullanıcıya AI bildirimleri oluşturur.
// Aynı tip bildirim 1 saat içinde tekrar oluşturulmaz (spam önleme).
// ─────────────────────────────────────────────────────────────────────────────
const Notification = require("../models/Notification");

async function generateAINotifications(userId, healthSnapshot, brainData) {
    const ONE_HOUR = 60 * 60 * 1000;

    // Son 1 saat içinde bu kullanıcıya gönderilen AI bildirimlerini kontrol et
    const recentNotifs = await Notification.find({
        userId,
        type: "ai",
        createdAt: { $gt: new Date(Date.now() - ONE_HOUR) }
    }).select("aiData.category title").lean();

    const recentCategories = new Set(recentNotifs.map(n => n.aiData?.category));

    const notifs = [];

    // 1. Kritik uyarılar — skor çok düşükse
    if (healthSnapshot.overallScore < 30 && !recentCategories.has("alert")) {
        notifs.push({
            userId, type: "ai", priority: "critical",
            title: "🚨 İşletme Sağlığı Kritik!",
            message: `İşletme sağlık skorunuz ${healthSnapshot.overallScore}/100 — acil müdahale gerekiyor.`,
            icon: "🚨",
            aiData: { category: "alert", actionRequired: true, confidence: 95, suggestedAction: "AI Asistan panelinden detaylı analizi inceleyin" },
            actionLink: "advanced-ai"
        });
    }

    // 2. Kritik alert sayısı yüksekse
    if (healthSnapshot.criticalAlerts >= 3 && !recentCategories.has("risk")) {
        notifs.push({
            userId, type: "ai", priority: "high",
            title: "⚠️ Çoklu Kritik Uyarı",
            message: `${healthSnapshot.criticalAlerts} kritik uyarı tespit edildi. Stok, fiyat veya sipariş sorunları olabilir.`,
            icon: "⚠️",
            aiData: { category: "risk", actionRequired: true, confidence: 90, suggestedAction: "Uyarıları inceleyip gerekli aksiyonları alın" },
            actionLink: "advanced-ai"
        });
    }

    // 3. Kayıp avcısı — önemli kayıp tespit edildiyse
    if (healthSnapshot.totalLoss > 500 && !recentCategories.has("opportunity")) {
        notifs.push({
            userId, type: "ai", priority: "high",
            title: "💰 Kayıp Tespit Edildi",
            message: `AI analizi ${Number(healthSnapshot.totalLoss).toLocaleString("tr-TR")} ₺ potansiyel kayıp tespit etti. Kurtarılabilir fırsatlar mevcut.`,
            icon: "💰",
            aiData: { category: "opportunity", actionRequired: false, confidence: 85, suggestedAction: "Kayıp Avcısı raporunu inceleyin" },
            actionLink: "advanced-ai"
        });
    }

    // 4. Bekleyen öneriler — çok fazla onay bekleyen öneri varsa
    if (healthSnapshot.pendingRecs >= 5 && !recentCategories.has("recommendation")) {
        notifs.push({
            userId, type: "ai", priority: "medium",
            title: "📋 Bekleyen AI Önerileri",
            message: `${healthSnapshot.pendingRecs} AI önerisi onayınızı bekliyor. İnceleyip uygulayabilirsiniz.`,
            icon: "📋",
            aiData: { category: "recommendation", actionRequired: false, confidence: 80, suggestedAction: "Öneriler sekmesinden inceleyin" },
            actionLink: "advanced-ai"
        });
    }

    // 5. Pozitif bildirim — skor iyiyse (günde 1 kez)
    if (healthSnapshot.overallScore >= 80 && healthSnapshot.rating === "healthy") {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayPositive = await Notification.findOne({
            userId, type: "ai", "aiData.category": "insight",
            createdAt: { $gt: todayStart }
        }).lean();

        if (!todayPositive) {
            notifs.push({
                userId, type: "ai", priority: "low",
                title: "✅ İşletmeniz Sağlıklı",
                message: `Sağlık skoru: ${healthSnapshot.overallScore}/100 — harika gidiyorsunuz! AI sistemi izlemeye devam ediyor.`,
                icon: "✅",
                aiData: { category: "insight", actionRequired: false, confidence: 95 },
                actionLink: "advanced-ai"
            });
        }
    }

    // Bildirimleri oluştur
    for (const n of notifs) {
        await createNotificationDirect(n);
    }

    if (notifs.length > 0) {
        logger.info(`[AI Worker] ${userId} için ${notifs.length} AI bildirimi oluşturuldu`);
    }
}

async function analyzeUser(userId) {
    const startTime = Date.now();

    // Cache taze mi kontrol et
    const existingCache = await AIAnalysisCache.findOne({ userId }).lean();
    if (existingCache && existingCache.lastAnalyzedAt) {
        const age = Date.now() - new Date(existingCache.lastAnalyzedAt).getTime();
        if (age < STALE_THRESHOLD_MS) {
            return { skipped: true, reason: "cache_fresh" };
        }
    }

    // Ardışık hata kontrolü
    if (existingCache && existingCache.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        const lastErrorAge = Date.now() - new Date(existingCache.updatedAt).getTime();
        if (lastErrorAge < 30 * 60 * 1000) {
            return { skipped: true, reason: "too_many_errors" };
        }
    }

    const strategyMode = existingCache?.strategyMode || "balanced";

    try {
        const brainData = await AIBrain.getFullBrainDashboard(userId, AIEngine, strategyMode);
        const durationMs = Date.now() - startTime;

        const healthSnapshot = {
            overallScore: brainData.businessHealth?.overallScore || 0,
            rating: brainData.businessHealth?.rating || "warning",
            criticalAlerts: brainData.redAlerts?.criticalCount || 0,
            pendingRecs: brainData.recSummary?.pending || 0,
            totalLoss: brainData.lossHunter?.totalImpact || 0,
        };

        await AIAnalysisCache.findOneAndUpdate(
            { userId },
            {
                $set: {
                    brainData,
                    strategyMode,
                    lastAnalyzedAt: new Date(),
                    analysisDurationMs: durationMs,
                    productCount: brainData.productCount || 0,
                    orderCount: brainData.predictions?.trendData?.totalOrders30 || 0,
                    healthSnapshot,
                    lastError: null,
                    consecutiveErrors: 0,
                }
            },
            { upsert: true, new: true }
        );

        // ── AI Bildirim Üretimi ──
        try {
            await generateAINotifications(userId, healthSnapshot, brainData);
        } catch (notifErr) {
            logger.warn(`[AI Worker] Bildirim üretimi hatası (${userId}): ${notifErr.message}`);
        }

        return { success: true, durationMs, productCount: brainData.productCount || 0 };
    } catch (err) {
        const durationMs = Date.now() - startTime;

        await AIAnalysisCache.findOneAndUpdate(
            { userId },
            {
                $set: { lastError: err.message, lastAnalyzedAt: new Date() },
                $inc: { consecutiveErrors: 1 },
            },
            { upsert: true }
        );

        return { success: false, error: err.message, durationMs };
    }
}

async function runAnalysisCycle() {
    if (isAnalysisRunning) {
        logger.warn("[AI Worker] Analiz döngüsü hâlâ çalışıyor, atlanıyor...");
        return;
    }

    isAnalysisRunning = true;
    const cycleStart = Date.now();
    let analyzed = 0, skipped = 0, failed = 0;

    try {
        const userIds = await getActiveUsers();
        if (userIds.length === 0) {
            isAnalysisRunning = false;
            return;
        }

        for (const userId of userIds) {
            try {
                const result = await analyzeUser(userId);
                if (result.skipped) skipped++;
                else if (result.success) analyzed++;
                else failed++;

                if (userIds.indexOf(userId) < userIds.length - 1) {
                    await sleep(USER_DELAY_MS);
                }
            } catch (err) {
                failed++;
                logger.error(`[AI Worker] Analiz hatası (user ${userId}): ${err.message}`);
            }
        }

        const duration = Date.now() - cycleStart;
        workerStats.totalAnalysisCycles++;
        workerStats.lastAnalysisCycleAt = new Date();
        workerStats.lastAnalysisDurationMs = duration;
        workerStats.analysisUsersProcessed = analyzed;
        workerStats.analysisUsersSkipped = skipped;
        workerStats.analysisUsersFailed = failed;

        logger.info(
            `[AI Worker] 📊 Analiz döngüsü #${workerStats.totalAnalysisCycles} — ` +
            `${analyzed} analiz, ${skipped} atlandı, ${failed} hata — ${(duration / 1000).toFixed(1)}s`
        );
    } catch (err) {
        logger.error(`[AI Worker] Analiz döngüsü genel hata: ${err.message}`);
    } finally {
        isAnalysisRunning = false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// GÖREV 2: AI OPERATÖR DÖNGÜSÜ — 6 Fazlı Tam Otonom Döngü
// ═════════════════════════════════════════════════════════════════════════════

async function runOperatorCycleForUser(userId) {
    const startTime = Date.now();
    const phaseTimings = {};

    // Kullanıcının operasyon modunu al
    const operationMode = await getUserOperationMode(userId);

    // Son döngü numarasını bul
    const lastCycle = await AICycleResult.findOne({ userId })
        .sort({ cycleNumber: -1 })
        .select("cycleNumber")
        .lean();
    const cycleNumber = (lastCycle?.cycleNumber || 0) + 1;

    // Döngü kaydını "running" olarak oluştur
    const cycleResult = await AICycleResult.create({
        userId,
        cycleNumber,
        operationMode,
        status: "running",
        nextCycleAt: new Date(Date.now() + CYCLE_INTERVAL_MS),
    });

    try {
        // ═══════════════════════════════════════════════════════════════════
        // FAZ 1: OBSERVE
        // ═══════════════════════════════════════════════════════════════════
        let phaseStart = Date.now();
        let observation;
        try {
            observation = await AIOperator.observe(userId);
            phaseTimings.observe = { durationMs: Date.now() - phaseStart, success: true };
        } catch (err) {
            phaseTimings.observe = { durationMs: Date.now() - phaseStart, success: false, error: err.message };
            throw new Error(`OBSERVE failed: ${err.message}`);
        }

        // Ürün yoksa döngüyü atla
        if (!observation.analyzedProducts || observation.analyzedProducts.length === 0) {
            cycleResult.status = "skipped";
            cycleResult.error = "Ürün bulunamadı";
            cycleResult.phases = phaseTimings;
            cycleResult.totalDurationMs = Date.now() - startTime;
            await cycleResult.save();
            return { skipped: true, reason: "no_products" };
        }

        // ═══════════════════════════════════════════════════════════════════
        // FAZ 2: ANALYZE
        // ═══════════════════════════════════════════════════════════════════
        phaseStart = Date.now();
        let analysis;
        try {
            analysis = AIOperator.analyze(observation);
            phaseTimings.analyze = { durationMs: Date.now() - phaseStart, success: true };
        } catch (err) {
            phaseTimings.analyze = { durationMs: Date.now() - phaseStart, success: false, error: err.message };
            throw new Error(`ANALYZE failed: ${err.message}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // FAZ 3: DECIDE
        // ═══════════════════════════════════════════════════════════════════
        phaseStart = Date.now();
        let decisions;
        try {
            decisions = await AIOperator.decide(userId, observation, analysis, operationMode);
            phaseTimings.decide = { durationMs: Date.now() - phaseStart, success: true };
        } catch (err) {
            phaseTimings.decide = { durationMs: Date.now() - phaseStart, success: false, error: err.message };
            throw new Error(`DECIDE failed: ${err.message}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // FAZ 4: ACT (moduna göre)
        // ═══════════════════════════════════════════════════════════════════
        phaseStart = Date.now();
        const actionResults = [];

        try {
            if (operationMode === "autonomous") {
                // Otonom mod: autoExecutable ve onay gerektirmeyen kararları uygula
                const executableDecisions = decisions.decisions.filter(
                    d => d.autoExecutable && !d._requiresApproval
                );

                for (const d of executableDecisions) {
                    try {
                        const result = await AIOperator.act(userId, d);

                        // FAZ 5: VERIFY
                        const verification = await AIOperator.verify(userId, result, d);

                        // FAZ 6: LEARN
                        await AIOperator.learn(userId, d, result, verification);

                        actionResults.push({
                            action: d.action,
                            title: d.title || "AI Aksiyon",
                            barcode: d.barcode || "",
                            success: result.success,
                            message: result.message || "",
                            verified: verification.verified,
                            learned: true,
                        });

                        logger.info(
                            `🤖 [AI Döngü] ACT: ${d.action} — ${result.success ? "✅" : "❌"} ` +
                            `${d.title?.slice(0, 40) || d.barcode || ""}`
                        );
                    } catch (actErr) {
                        actionResults.push({
                            action: d.action,
                            title: d.title || "AI Aksiyon",
                            barcode: d.barcode || "",
                            success: false,
                            message: actErr.message,
                            verified: false,
                            learned: false,
                        });
                        logger.warn(`🤖 [AI Döngü] ACT hata: ${d.action} — ${actErr.message}`);
                    }
                }
            } else if (operationMode === "assisted") {
                // Assisted mod: sadece kritik olmayan ve autoExecutable olanları uygula
                const safeDecisions = decisions.decisions.filter(
                    d => d.autoExecutable && !d._requiresApproval && d.urgency !== "critical"
                );

                for (const d of safeDecisions) {
                    try {
                        const result = await AIOperator.act(userId, d);
                        const verification = await AIOperator.verify(userId, result, d);
                        await AIOperator.learn(userId, d, result, verification);

                        actionResults.push({
                            action: d.action,
                            title: d.title || "AI Aksiyon",
                            barcode: d.barcode || "",
                            success: result.success,
                            message: result.message || "",
                            verified: verification.verified,
                            learned: true,
                        });
                    } catch (actErr) {
                        actionResults.push({
                            action: d.action,
                            title: d.title || "AI Aksiyon",
                            barcode: d.barcode || "",
                            success: false,
                            message: actErr.message,
                            verified: false,
                            learned: false,
                        });
                    }
                }
            }
            // passive mod: hiçbir aksiyon uygulanmaz

            phaseTimings.act = {
                durationMs: Date.now() - phaseStart,
                success: true,
                actionsExecuted: actionResults.length,
            };
        } catch (err) {
            phaseTimings.act = {
                durationMs: Date.now() - phaseStart,
                success: false,
                actionsExecuted: actionResults.length,
                error: err.message,
            };
        }

        // Verify ve Learn fazları ACT içinde zaten çalıştı, timing'leri kaydet
        phaseTimings.verify = { durationMs: 0, success: true };
        phaseTimings.learn = { durationMs: 0, success: true };

        // ═══════════════════════════════════════════════════════════════════
        // Proaktif uyarıları üret
        // ═══════════════════════════════════════════════════════════════════
        let alerts = [];
        try {
            const alertsData = await AIOperator.generateProactiveAlerts(userId);
            alerts = (alertsData?.alerts || []).map(a => ({
                type: a.type || "unknown",
                severity: a.severity || "info",
                title: a.title || "",
                message: a.message || "",
            }));
        } catch (err) {
            logger.warn(`[AI Döngü] Uyarı üretme hatası (user ${userId}): ${err.message}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // Döngü sonucunu kaydet
        // ═══════════════════════════════════════════════════════════════════
        const totalDurationMs = Date.now() - startTime;

        cycleResult.phases = phaseTimings;
        cycleResult.observation = {
            totalProducts: observation.metrics.totalProducts,
            activeProducts: observation.metrics.activeProducts,
            outOfStock: observation.metrics.outOfStock,
            lowStock: observation.metrics.lowStock,
            lossProducts: observation.metrics.lossProducts,
            todayRevenue: observation.metrics.todayRevenue,
            monthRevenue: observation.metrics.monthRevenue,
            totalOrdersToday: observation.metrics.totalOrdersToday,
            marketplaceCount: observation.marketplaces?.length || 0,
            memoryCount: observation.memories?.length || 0,
        };
        cycleResult.analysis = {
            aiScore: analysis.aiScore?.overall || 0,
            healthScore: analysis.businessHealth?.overallScore || 0,
            healthRating: analysis.businessHealth?.rating || "unknown",
            riskScore: analysis.risks?.riskScore || 0,
            totalLossImpact: analysis.lossHunter?.totalImpact || 0,
            lossCount: analysis.lossHunter?.losses?.length || 0,
            focusItemCount: analysis.focusItems?.length || 0,
            predictionCount: analysis.predictions?.predictions?.length || 0,
            emotionalTone: analysis.emotionalTone?.tone || "neutral",
        };
        cycleResult.decisions = {
            totalDecisions: decisions.decisions?.length || 0,
            criticalCount: decisions.criticalCount || 0,
            totalPotentialImpact: decisions.totalPotentialImpact || 0,
            guardrailsApplied: decisions.guardrailsApplied || 0,
            items: (decisions.decisions || []).slice(0, 10).map(d => ({
                type: d.type || d.action || "unknown",
                title: (d.title || "").slice(0, 80),
                action: d.action || "unknown",
                urgency: d.urgency || "medium",
                impact: d.impact || 0,
                confidence: d.confidence || 0,
                autoExecutable: d.autoExecutable || false,
                requiresApproval: d._requiresApproval || false,
            })),
        };
        cycleResult.actions = actionResults;
        cycleResult.alerts = alerts.slice(0, 10);
        cycleResult.totalDurationMs = totalDurationMs;
        cycleResult.status = "completed";
        cycleResult.nextCycleAt = new Date(Date.now() + CYCLE_INTERVAL_MS);

        await cycleResult.save();

        return {
            success: true,
            cycleNumber,
            operationMode,
            totalDurationMs,
            decisionsCount: decisions.decisions?.length || 0,
            actionsExecuted: actionResults.length,
            actionsSuccessful: actionResults.filter(a => a.success).length,
            alertsCount: alerts.length,
        };

    } catch (err) {
        // Döngü başarısız oldu
        const totalDurationMs = Date.now() - startTime;

        cycleResult.phases = phaseTimings;
        cycleResult.totalDurationMs = totalDurationMs;
        cycleResult.status = "failed";
        cycleResult.error = err.message;
        cycleResult.nextCycleAt = new Date(Date.now() + CYCLE_INTERVAL_MS);

        await cycleResult.save();

        return { success: false, error: err.message, totalDurationMs };
    }
}

async function runOperatorCycle() {
    if (isCycleRunning) {
        logger.warn("[AI Döngü] Önceki operatör döngüsü hâlâ çalışıyor, atlanıyor...");
        return;
    }

    isCycleRunning = true;
    const cycleStart = Date.now();
    let processed = 0, totalDecisions = 0, totalActions = 0;

    try {
        const userIds = await getActiveUsers();
        if (userIds.length === 0) {
            logger.info("[AI Döngü] Aktif kullanıcı yok, döngü atlanıyor");
            isCycleRunning = false;
            return;
        }

        logger.info(
            `🤖 [AI Döngü] Operatör döngüsü #${workerStats.totalOperatorCycles + 1} başlıyor — ` +
            `${userIds.length} kullanıcı`
        );

        for (const userId of userIds) {
            try {
                const result = await runOperatorCycleForUser(userId);

                if (result.skipped) {
                    logger.debug(`[AI Döngü] User ${userId} atlandı: ${result.reason}`);
                } else if (result.success) {
                    processed++;
                    totalDecisions += result.decisionsCount || 0;
                    totalActions += result.actionsExecuted || 0;

                    logger.info(
                        `🤖 [AI Döngü] ✅ User ${userId} — ` +
                        `mod: ${result.operationMode}, ` +
                        `${result.decisionsCount} karar, ` +
                        `${result.actionsExecuted} aksiyon (${result.actionsSuccessful} başarılı), ` +
                        `${result.totalDurationMs}ms`
                    );
                } else {
                    logger.warn(`🤖 [AI Döngü] ❌ User ${userId} hata: ${result.error}`);
                }

                // Kullanıcılar arası bekleme
                if (userIds.indexOf(userId) < userIds.length - 1) {
                    await sleep(CYCLE_USER_DELAY_MS);
                }
            } catch (err) {
                logger.error(`🤖 [AI Döngü] User ${userId} kritik hata: ${err.message}`);
            }
        }

        const duration = Date.now() - cycleStart;
        workerStats.totalOperatorCycles++;
        workerStats.lastOperatorCycleAt = new Date();
        workerStats.lastOperatorDurationMs = duration;
        workerStats.operatorUsersProcessed = processed;
        workerStats.operatorDecisionsGenerated = totalDecisions;
        workerStats.operatorActionsExecuted = totalActions;

        logger.info(
            `🤖 [AI Döngü] ✅ Operatör döngüsü #${workerStats.totalOperatorCycles} tamamlandı — ` +
            `${processed} kullanıcı, ${totalDecisions} karar, ${totalActions} aksiyon — ` +
            `${(duration / 1000).toFixed(1)}s`
        );
    } catch (err) {
        logger.error(`🤖 [AI Döngü] Operatör döngüsü genel hata: ${err.message}`);
    } finally {
        isCycleRunning = false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// START / STOP
// ═════════════════════════════════════════════════════════════════════════════

function startAIWorker() {
    if (analysisInterval || cycleInterval) {
        logger.warn("[AI Worker] Zaten çalışıyor, tekrar başlatma isteği yoksayıldı");
        return;
    }

    workerStats.isActive = true;
    workerStats.startedAt = new Date();

    // ── Görev 1: Analiz Cache — 30s sonra ilk çalışma, sonra her 5dk ──
    setTimeout(() => {
        logger.info("[AI Worker] 📊 Analiz cache döngüsü başlatıldı (her 5 dakika)");
        runAnalysisCycle();
    }, INITIAL_DELAY_MS);

    analysisInterval = setInterval(runAnalysisCycle, ANALYSIS_INTERVAL_MS);

    // ── Görev 2: AI Operatör Döngüsü — 60s sonra ilk çalışma, sonra her 10dk ──
    setTimeout(() => {
        logger.info("🤖 [AI Döngü] AI Operatör otonom döngüsü başlatıldı (her 10 dakika)");
        runOperatorCycle();
    }, CYCLE_INITIAL_DELAY_MS);

    cycleInterval = setInterval(runOperatorCycle, CYCLE_INTERVAL_MS);

    logger.info(
        "🚀 [AI Worker] AI Background Worker v2 başlatıldı:\n" +
        `   📊 Analiz Cache: her ${ANALYSIS_INTERVAL_MS / 60000} dakika (ilk çalışma ${INITIAL_DELAY_MS / 1000}s sonra)\n` +
        `   🤖 Operatör Döngüsü: her ${CYCLE_INTERVAL_MS / 60000} dakika (ilk çalışma ${CYCLE_INITIAL_DELAY_MS / 1000}s sonra)`
    );
}

function stopAIWorker() {
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
    }
    if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
    }
    workerStats.isActive = false;
    logger.info("🛑 [AI Worker] AI Background Worker v2 durduruldu");
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUS & UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

function getWorkerStatus() {
    return {
        ...workerStats,
        isAnalysisRunning,
        isCycleRunning,
        analysisIntervalMs: ANALYSIS_INTERVAL_MS,
        cycleIntervalMs: CYCLE_INTERVAL_MS,
        userDelayMs: USER_DELAY_MS,
    };
}

// Belirli bir kullanıcı için analizi zorla yenile
async function forceAnalyzeUser(userId, strategyMode = "balanced") {
    try {
        await AIAnalysisCache.findOneAndUpdate(
            { userId },
            { $set: { strategyMode, lastAnalyzedAt: new Date(0) } },
            { upsert: true }
        );
        const result = await analyzeUser(userId);
        return result;
    } catch (err) {
        logger.error(`[AI Worker] Force analyze failed for ${userId}: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// Belirli bir kullanıcı için operatör döngüsünü zorla çalıştır
async function forceCycleForUser(userId) {
    try {
        const result = await runOperatorCycleForUser(userId);
        return result;
    } catch (err) {
        logger.error(`[AI Worker] Force cycle failed for ${userId}: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// Cache'den analiz oku
async function getCachedAnalysis(userId) {
    const cache = await AIAnalysisCache.findOne({ userId }).lean();
    if (!cache || !cache.brainData) return null;

    const age = Date.now() - new Date(cache.lastAnalyzedAt).getTime();
    const data = { ...cache.brainData };

    // ✅ Cache'deki eski "pasife al" / "Ölü Ürün" önerilerini filtrele
    if (Array.isArray(data.recommendations)) {
        data.recommendations = data.recommendations.filter(r => {
            if (r.actionPayload?.actionType === "mark_inactive") return false;
            if (r.title && /Ölü Ürün/i.test(r.title)) return false;
            if (r.description && /[Pp]asife al/i.test(r.description)) return false;
            return true;
        });
    }

    return {
        ...data,
        _cache: {
            lastAnalyzedAt: cache.lastAnalyzedAt,
            ageMs: age,
            ageMinutes: Math.round(age / 60000),
            isStale: age > STALE_THRESHOLD_MS,
            analysisDurationMs: cache.analysisDurationMs,
            strategyMode: cache.strategyMode,
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    startAIWorker,
    stopAIWorker,
    getWorkerStatus,
    forceAnalyzeUser,
    forceCycleForUser,
    getCachedAnalysis,
    runCycle: runAnalysisCycle,  // backward compat
};
