/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI OPERATÖR ENGINE — LysiaETIC
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * BU SİSTEM GPT DEĞİLDİR — AMA GPT GİBİ ÇALIŞIR.
 *
 * GPT nasıl çalışır?
 *   Input → Tokenization → Model (Transformer + Attention) → Next token → Output
 *
 * Biz ne yapıyoruz?
 *   Input → Intent Detection → Context Analysis → Data Query → Decision → Response
 *
 * FARK: GPT milyarlarca parametre ile eğitilmiş. Biz ise:
 *   - Gerçek iş verisini kullanıyoruz (siparişler, ürünler, fiyatlar, stok)
 *   - Rule-based + Pattern matching + Statistical analysis
 *   - Memory sistemi ile öğreniyoruz (ne işe yaradı, ne yaramadı)
 *   - Context-aware: Kullanıcının geçmiş konuşmalarını hatırlıyoruz
 *
 * 6 FAZA:
 *   1. OBSERVE  — Veri topla (siparişler, ürünler, fiyat, stok, marketplace)
 *   2. ANALYZE  — Metrik üret, pattern çıkar (satış trendi, stok riski, kâr marjı)
 *   3. DECIDE   — Karar ver (fiyat düşür, stok artır, kampanya başlat)
 *   4. ACT      — Uygula (API çağır, fiyat güncelle, stok güncelle)
 *   5. VERIFY   — Sonucu ölç (satış arttı mı? kâr iyileşti mi?)
 *   6. LEARN    — Hafızaya kaydet (ne işe yaradı, ne yaramadı)
 *
 * 3 KONTROL MODU:
 *   🟢 passive    — Sadece analiz + öneri (kullanıcıya söyler)
 *   🟡 assisted   — Öneri + onay ile uygulama (kullanıcı onaylar, AI uygular)
 *   🔴 autonomous — Tam otomatik (AI karar verir ve uygular)
 *
 * GÜVENLİK:
 *   - Fiyat değişimi max %20 (tek seferde)
 *   - Kritik aksiyonlar onay gerektirir (assisted modda)
 *   - Rollback sistemi (geri alma)
 *   - Her aksiyon loglanır
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const AIEngine = require("./aiEngineService");
const AIBrain = require("./aiOperationsBrain");
const AIMemory = require("../models/AIMemory");
const AIConversation = require("../models/AIConversation");
const AIAnalysisCache = require("../models/AIAnalysisCache");
const AICycleResult = require("../models/AICycleResult");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductMapping = require("../models/ProductMapping");
const Marketplace = require("../models/Marketplace");
const Recommendation = require("../models/Recommendation");
const logger = require("../config/logger");
const { getTurkeyTodayStart, getTurkeyTomorrowStart } = require("../utils/turkeyTime");

const OPERATOR_CYCLE_INTERVAL_MS = 10 * 60 * 1000;

function round2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
}

// ═════════════════════════════════════════════════════════════════════════════
// GUARDRAILS — Güvenlik Limitleri
// ═════════════════════════════════════════════════════════════════════════════
const GUARDRAILS = {
    maxPriceChangePercent: 20,      // Tek seferde max %20 fiyat değişimi
    maxStockOrderQuantity: 500,     // Tek seferde max 500 adet stok siparişi
    minProfitMarginPercent: 5,      // Minimum kâr marjı hedefi
    maxActionsPerHour: 50,          // Saatte max 50 aksiyon
    requireApprovalForCritical: true, // Kritik aksiyonlar onay gerektirir
    cooldownMinutes: 5,             // Aynı ürüne tekrar aksiyon arası min 5dk
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. OBSERVE — Veri Toplama Katmanı
// ═════════════════════════════════════════════════════════════════════════════

async function observe(userId) {
    const startTime = Date.now();

    // Mevcut AI Engine'in collectData'sını kullan (zaten çok güçlü)
    const engineData = await AIEngine.collectData(userId);
    const analyzed = AIEngine.analyzeProducts(engineData.products, engineData.orders90);

    // Ek veriler
    const [marketplaces, recentActions, memories] = await Promise.all([
        Marketplace.find({ userId, isActive: { $ne: false } }).lean(),
        Recommendation.find({
            userId,
            status: "executed",
            executedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).sort({ executedAt: -1 }).limit(20).lean(),
        AIMemory.find({
            userId,
            confidence: { $gte: 40 }
        }).sort({ lastUsedAt: -1 }).limit(100).lean(),
    ]);

    const observation = {
        userId,

        // Ham veri
        products: engineData.products,
        analyzedProducts: analyzed,
        orders30: engineData.orders30,
        orders90: engineData.orders90,
        orders7: engineData.orders7,
        ordersToday: engineData.ordersToday,
        ordersYesterday: engineData.ordersYesterday,
        goals: engineData.goals,
        pastRecs: engineData.pastRecs,
        marketplaces,
        hasOrderData: engineData.hasOrderData,

        // Analiz edilmiş metrikler
        metrics: {
            totalProducts: analyzed.length,
            activeProducts: analyzed.filter(p => p.stock > 0).length,
            outOfStock: analyzed.filter(p => p.stock === 0 || p.isOutOfStock).length,
            lowStock: analyzed.filter(p => p.isLowStock).length,
            lossProducts: analyzed.filter(p => p.profit < 0 && p.costPrice > 0).length,
            deadProducts: engineData.hasOrderData ? analyzed.filter(p => p.daysSinceLastSale > 30 && p.stock > 0).length : 0,
            avgMargin: analyzed.filter(p => p.costPrice > 0).length > 0
                ? analyzed.filter(p => p.costPrice > 0).reduce((s, p) => s + p.profitMargin, 0) / analyzed.filter(p => p.costPrice > 0).length
                : -1,
            todayRevenue: engineData.ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0),
            yesterdayRevenue: engineData.ordersYesterday.reduce((s, o) => s + (o.totalPrice || 0), 0),
            weekRevenue: engineData.orders7.reduce((s, o) => s + (o.totalPrice || 0), 0),
            monthRevenue: engineData.orders30.reduce((s, o) => s + (o.totalPrice || 0), 0),
            totalOrders30: engineData.orders30.length,
            totalOrdersToday: engineData.ordersToday.length,
        },

        // Hafıza
        recentActions,
        memories,

        // Meta
        observedAt: new Date(),
        durationMs: Date.now() - startTime,
    };

    return observation;
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. ANALYZE — Analiz Katmanı
// ═════════════════════════════════════════════════════════════════════════════

function analyze(observation) {
    const { analyzedProducts, metrics, hasOrderData, userId: obsUserId } = observation;

    // AI Score
    const aiScore = AIEngine.calculateAIScore(analyzedProducts, observation);

    // Business Health
    const businessHealth = AIBrain.calculateBusinessHealth(analyzedProducts, observation, aiScore);

    // Loss Hunter
    const lossHunter = AIBrain.huntLosses(analyzedProducts, observation);

    // Focus Items
    const focusItems = AIBrain.generateFocusItems(analyzedProducts, observation, businessHealth, lossHunter);

    // Opportunities
    const opportunities = AIBrain.scanOpportunities(analyzedProducts, observation, obsUserId);

    // Predictions
    const predictions = AIBrain.generatePredictions(analyzedProducts, observation);

    // Risk Assessment
    const risks = AIBrain.assessRisks(analyzedProducts, observation, businessHealth);

    // Causes
    const causes = AIBrain.analyzeCauses(analyzedProducts, observation);

    // Segmentation
    const segmentation = AIBrain.segmentProducts(analyzedProducts);

    // Context
    const context = AIBrain.getContextAwareness();

    // Emotional Tone
    const emotionalTone = AIBrain.getEmotionalTone(businessHealth, focusItems);

    // Timing
    const timing = AIEngine.analyzeTimingPatterns(observation.orders90);

    return {
        aiScore,
        businessHealth,
        lossHunter,
        focusItems,
        opportunities,
        predictions,
        risks,
        causes,
        segmentation,
        context,
        emotionalTone,
        timing,
        metrics,
        hasOrderData,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. DECIDE — Karar Katmanı
// ═════════════════════════════════════════════════════════════════════════════

async function decide(userId, observation, analysis, operationMode = "assisted") {
    const { analyzedProducts, memories } = observation;
    const { businessHealth, lossHunter, risks } = analysis;

    // Mevcut auto-decide motorunu kullan
    const autoDecisions = await AIBrain.autoDecide(userId, analyzedProducts, observation, businessHealth, lossHunter);

    // Hafızadan öğrenilmiş kuralları uygula
    const memoryAdjustedDecisions = applyMemoryToDecisions(autoDecisions.decisions, memories);

    // Güvenlik kontrolü
    const safeDecisions = applySafetyGuardrails(memoryAdjustedDecisions, operationMode);

    return {
        decisions: safeDecisions,
        totalPotentialImpact: safeDecisions.reduce((s, d) => s + (d.impact || 0), 0),
        criticalCount: safeDecisions.filter(d => d.urgency === "critical").length,
        operationMode,
        guardrailsApplied: safeDecisions.filter(d => d._guardrailApplied).length,
    };
}

/**
 * Hafızadan öğrenilmiş bilgileri kararlara uygula
 */
function applyMemoryToDecisions(decisions, memories) {
    if (!memories || memories.length === 0) return decisions;

    const memoryMap = new Map();
    for (const m of memories) {
        if (m.memoryType === "action_result" && m.action?.targetBarcode) {
            const key = `${m.action.type}_${m.action.targetBarcode}`;
            memoryMap.set(key, m);
        }
    }

    return decisions.map(d => {
        const memKey = `${d.action}_${d.barcode}`;
        const memory = memoryMap.get(memKey);

        if (memory) {
            // Geçmişte bu aksiyon başarısız olduysa güveni düşür
            if (memory.result?.verdict === "negative") {
                d.confidence = Math.max(20, (d.confidence || 70) - 20);
                d._memoryNote = `Geçmişte benzer aksiyon olumsuz sonuç verdi (${memory.result.improvement}% değişim)`;
            }
            // Başarılı olduysa güveni artır
            else if (memory.result?.verdict === "positive") {
                d.confidence = Math.min(98, (d.confidence || 70) + 10);
                d._memoryNote = `Geçmişte benzer aksiyon olumlu sonuç verdi (+${memory.result.improvement}%)`;
            }
        }

        return d;
    });
}

/**
 * Güvenlik guardrail'lerini uygula
 */
function applySafetyGuardrails(decisions, operationMode) {
    return decisions.map(d => {
        const modified = { ...d, _guardrailApplied: false };

        // Fiyat değişimi limiti
        if (d.action === "price_update" && d.params) {
            const oldPrice = d.params.oldPrice || 0;
            const newPrice = d.params.newPrice || 0;
            if (oldPrice > 0) {
                const changePct = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
                if (changePct > GUARDRAILS.maxPriceChangePercent) {
                    // Limitle
                    const direction = newPrice > oldPrice ? 1 : -1;
                    modified.params = {
                        ...d.params,
                        newPrice: Math.round(oldPrice * (1 + direction * GUARDRAILS.maxPriceChangePercent / 100)),
                    };
                    modified._guardrailApplied = true;
                    modified._guardrailNote = `Fiyat değişimi %${changePct.toFixed(0)} → %${GUARDRAILS.maxPriceChangePercent} ile sınırlandı`;
                }
            }
        }

        // Passive modda hiçbir aksiyon otomatik uygulanmaz
        if (operationMode === "passive") {
            modified.autoExecutable = false;
            modified._requiresApproval = true;
        }

        // Assisted modda kritik aksiyonlar onay gerektirir
        if (operationMode === "assisted") {
            if (d.urgency === "critical" && GUARDRAILS.requireApprovalForCritical) {
                modified._requiresApproval = true;
            }
        }

        // Autonomous modda bile bazı limitler var
        if (operationMode === "autonomous") {
            // Fiyat %20'den fazla değişemez
            if (modified._guardrailApplied) {
                modified._requiresApproval = true; // Guardrail tetiklendiyse onay iste
            }
        }

        return modified;
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. ACT — Aksiyon Uygulama Katmanı
// ═════════════════════════════════════════════════════════════════════════════

async function act(userId, decision) {
    // Cooldown kontrolü
    if (decision.barcode) {
        const recentAction = await Recommendation.findOne({
            userId,
            "actionPayload.targetId": decision.barcode,
            status: "executed",
            executedAt: { $gte: new Date(Date.now() - GUARDRAILS.cooldownMinutes * 60 * 1000) }
        });
        if (recentAction) {
            return {
                success: false,
                message: `Bu ürüne son ${GUARDRAILS.cooldownMinutes} dakika içinde aksiyon uygulandı. Cooldown bekleniyor.`,
                cooldown: true,
            };
        }
    }

    // Saatlik aksiyon limiti kontrolü
    const hourlyActions = await Recommendation.countDocuments({
        userId,
        status: "executed",
        executedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });
    if (hourlyActions >= GUARDRAILS.maxActionsPerHour) {
        return {
            success: false,
            message: `Saatlik aksiyon limiti (${GUARDRAILS.maxActionsPerHour}) aşıldı. Lütfen bekleyin.`,
            rateLimited: true,
        };
    }

    // Mevcut executeRecommendation motorunu kullan
    // Önce recommendation oluştur, sonra execute et
    try {
        const executionType = mapActionToExecutionType(decision.action);

        const rec = await Recommendation.create({
            userId,
            type: mapActionToRecType(decision.action),
            title: decision.title || "AI Operatör Aksiyonu",
            description: decision.description || "",
            category: ["price_update", "price_fix", "margin_optimize"].includes(decision.action) ? "pricing" : "stock",
            priority: decision.urgency || "medium",
            confidenceScore: decision.confidence || 70,
            impact: {
                profitChange: decision.impact || 0,
                revenueChange: 0,
                salesChange: 0,
                riskLevel: "medium",
            },
            actionPayload: {
                actionType: executionType,
                targetId: decision.barcode,
                targetName: decision.title,
                params: decision.params || {},
            },
            status: "approved", // AI Operatör tarafından otomatik onaylandı
            strategyMode: "balanced",
        });

        const result = await AIEngine.executeRecommendation(rec._id, userId);

        logger.info(`🤖 [AI Operatör] ACT: ${decision.action} — ${result.result.success ? "✅" : "❌"} ${result.result.message}`);

        return {
            success: result.result.success,
            message: result.result.message,
            recommendationId: rec._id,
            data: result.result.data,
        };
    } catch (err) {
        logger.error(`🤖 [AI Operatör] ACT ERROR: ${err.message}`);
        return { success: false, message: err.message };
    }
}

function mapActionToRecType(action) {
    const map = {
        "price_update": "price_optimization",
        "price_fix": "price_optimization",
        "restock": "stock_optimization",
        "marketing": "campaign_suggestion",
        "discount": "dynamic_pricing",
        "liquidate": "dead_product",
        "margin_optimize": "price_optimization",
        "expand": "strategy_switch",
    };
    return map[action] || "price_optimization";
}

/**
 * AI decision action → executeRecommendation actionType eşlemesi
 * autoDecide "price_update" döner ama executeRecommendation "update_price" bekler
 */
function mapActionToExecutionType(action) {
    const map = {
        "price_update": "update_price",
        "price_fix": "update_price",
        "restock": "create_stock_order",
        "marketing": "review_strategy",
        "discount": "apply_discount",
        "liquidate": "apply_discount",
        "margin_optimize": "update_price",
        "expand": "review_strategy",
    };
    return map[action] || action;
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. VERIFY — Sonuç Doğrulama Katmanı
// ═════════════════════════════════════════════════════════════════════════════

async function verify(userId, actionResult, decision) {
    if (!actionResult.success) {
        return { verified: false, reason: "Aksiyon başarısız oldu", improvement: 0 };
    }

    // Şimdilik basit doğrulama — gelecekte gerçek metrik karşılaştırması yapılacak
    // (Aksiyon sonrası satış/kâr değişimini ölçmek için 24-48 saat beklemek gerekir)
    return {
        verified: true,
        reason: "Aksiyon başarıyla uygulandı",
        improvement: 0, // Gerçek ölçüm sonraki cycle'da yapılacak
        needsFollowUp: true,
        followUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 saat sonra kontrol
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. LEARN — Öğrenme Katmanı
// ═════════════════════════════════════════════════════════════════════════════

async function learn(userId, decision, actionResult, verification) {
    try {
        const memoryKey = `${decision.action}_${decision.barcode || "general"}_${Date.now()}`;

        await AIMemory.findOneAndUpdate(
            { userId, memoryType: "action_result", key: memoryKey },
            {
                $set: {
                    value: {
                        decision: {
                            action: decision.action,
                            title: decision.title,
                            params: decision.params,
                            confidence: decision.confidence,
                        },
                        result: {
                            success: actionResult.success,
                            message: actionResult.message,
                        },
                        verification: {
                            verified: verification.verified,
                            improvement: verification.improvement,
                        },
                    },
                    action: {
                        type: decision.action,
                        targetBarcode: decision.barcode,
                        targetName: decision.title,
                        params: decision.params,
                        executedAt: new Date(),
                    },
                    result: {
                        success: actionResult.success,
                        measuredAt: new Date(),
                        improvement: verification.improvement,
                        verdict: actionResult.success ? "positive" : "negative",
                    },
                    confidence: actionResult.success ? 70 : 30,
                    lastUsedAt: new Date(),
                    tags: [decision.action, decision.urgency || "medium"],
                },
                $inc: { occurrenceCount: 1 },
            },
            { upsert: true }
        );

        logger.info(`🧠 [AI Operatör] LEARN: ${memoryKey} — ${actionResult.success ? "positive" : "negative"}`);
    } catch (err) {
        logger.error(`🧠 [AI Operatör] LEARN ERROR: ${err.message}`);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// FULL CYCLE — Tüm fazları çalıştır
// ═════════════════════════════════════════════════════════════════════════════

async function runFullCycle(userId, operationMode = "assisted") {
    const startTime = Date.now();
    const phaseTimings = {};

    try {
        let phaseStart = Date.now();
        const observation = await observe(userId);
        phaseTimings.observe = { durationMs: Date.now() - phaseStart, success: true };

        phaseStart = Date.now();
        const analysis = analyze(observation);
        phaseTimings.analyze = { durationMs: Date.now() - phaseStart, success: true };

        phaseStart = Date.now();
        const decisions = await decide(userId, observation, analysis, operationMode);
        phaseTimings.decide = { durationMs: Date.now() - phaseStart, success: true };

        // ACT — arka plan worker ile aynı kurallar (assisted: güvenli alt küme, autonomous: tam otomatik)
        const actionResults = [];
        phaseStart = Date.now();
        try {
            const toRun =
                operationMode === "autonomous"
                    ? decisions.decisions.filter(d => d.autoExecutable && !d._requiresApproval)
                    : operationMode === "assisted"
                        ? decisions.decisions.filter(
                            d => d.autoExecutable && !d._requiresApproval && d.urgency !== "critical"
                        )
                        : [];

            for (const d of toRun) {
                const result = await act(userId, d);
                const verification = await verify(userId, result, d);
                await learn(userId, d, result, verification);
                actionResults.push({
                    action: d.action,
                    title: d.title || "AI Aksiyon",
                    barcode: d.barcode || "",
                    success: result.success,
                    message: result.message || "",
                    verified: verification.verified,
                    learned: true,
                });
            }
            phaseTimings.act = {
                durationMs: Date.now() - phaseStart,
                success: true,
                actionsExecuted: actionResults.length,
            };
        } catch (actErr) {
            phaseTimings.act = {
                durationMs: Date.now() - phaseStart,
                success: false,
                actionsExecuted: actionResults.length,
                error: actErr.message,
            };
        }

        phaseTimings.verify = { durationMs: 0, success: true };
        phaseTimings.learn = { durationMs: 0, success: true };

        let alerts = [];
        try {
            const alertsData = await generateProactiveAlerts(userId, { observation, analysis });
            alerts = (alertsData?.alerts || []).map(a => ({
                type: a.type || "unknown",
                severity: a.severity || "info",
                title: a.title || "",
                message: a.message || "",
            }));
        } catch (e) {
            logger.warn(`🤖 [AI Operatör] alerts after cycle: ${e.message}`);
        }

        const durationMs = Date.now() - startTime;

        await persistManualOperatorCycle(userId, operationMode, {
            observation,
            analysis,
            decisions,
            actionResults,
            phaseTimings,
            alerts,
            durationMs,
        });

        logger.info(`🤖 [AI Operatör] Full cycle completed in ${durationMs}ms — ${decisions.decisions.length} decisions, ${actionResults.length} actions executed`);

        return {
            observation: {
                metrics: observation.metrics,
                marketplaceCount: observation.marketplaces.length,
                memoryCount: observation.memories.length,
            },
            analysis: {
                aiScore: analysis.aiScore,
                businessHealth: analysis.businessHealth,
                lossHunter: {
                    totalImpact: analysis.lossHunter.totalImpact,
                    lossCount: analysis.lossHunter.losses?.length || 0,
                },
                focusItems: analysis.focusItems,
                emotionalTone: analysis.emotionalTone,
                context: analysis.context,
                riskScore: analysis.risks.riskScore,
                predictions: {
                    count: analysis.predictions.predictions?.length || 0,
                    summary: analysis.predictions.summary,
                },
            },
            decisions,
            actionResults,
            operationMode,
            durationMs,
            timestamp: new Date(),
        };
    } catch (err) {
        logger.error(`🤖 [AI Operatör] Full cycle ERROR: ${err.message}`);
        throw err;
    }
}

/**
 * API ile tetiklenen döngü sonucunu AICycleResult'a yazar (worker ile aynı şema).
 */
async function persistManualOperatorCycle(userId, operationMode, payload) {
    const { observation, analysis, decisions, actionResults, phaseTimings, alerts, durationMs } = payload;
    try {
        const lastCycle = await AICycleResult.findOne({ userId })
            .sort({ cycleNumber: -1 })
            .select("cycleNumber")
            .lean();
        const cycleNumber = (lastCycle?.cycleNumber || 0) + 1;

        await AICycleResult.create({
            userId,
            cycleNumber,
            operationMode,
            status: "completed",
            phases: phaseTimings,
            observation: {
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
            },
            analysis: {
                aiScore: analysis.aiScore?.overall || 0,
                healthScore: analysis.businessHealth?.overallScore || 0,
                healthRating: analysis.businessHealth?.rating || "unknown",
                riskScore: analysis.risks?.riskScore || 0,
                totalLossImpact: analysis.lossHunter?.totalImpact || 0,
                lossCount: analysis.lossHunter?.losses?.length || 0,
                focusItemCount: analysis.focusItems?.length || 0,
                predictionCount: analysis.predictions?.predictions?.length || 0,
                emotionalTone: analysis.emotionalTone?.tone || "neutral",
            },
            decisions: {
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
            },
            actions: actionResults,
            alerts: (alerts || []).slice(0, 10),
            totalDurationMs: durationMs,
            nextCycleAt: new Date(Date.now() + OPERATOR_CYCLE_INTERVAL_MS),
        });
    } catch (err) {
        logger.error(`🤖 [AI Operatör] persistManualOperatorCycle: ${err.message}`);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// PROACTIVE ALERTS — Arka planda çalışan uyarı sistemi
// ═════════════════════════════════════════════════════════════════════════════

async function generateProactiveAlerts(userId, precomputed = null) {
    try {
        let observation;
        let analysis;
        if (precomputed?.observation && precomputed?.analysis) {
            observation = precomputed.observation;
            analysis = precomputed.analysis;
        } else {
            observation = await observe(userId);
            analysis = analyze(observation);
        }
        const alerts = [];

        const { metrics } = observation;
        const { businessHealth, lossHunter, risks } = analysis;

        // Kritik stok uyarısı
        if (metrics.outOfStock > 0) {
            alerts.push({
                type: "stock_critical",
                severity: "critical",
                icon: "🚨",
                title: `${metrics.outOfStock} ürün stokta yok!`,
                message: `Her gün satış kaçırıyorsunuz. Acil tedarik gerekli.`,
                action: "Stok durumunu kontrol edin",
                autoAction: "restock",
            });
        }

        // Zarar uyarısı
        if (metrics.lossProducts > 0) {
            alerts.push({
                type: "loss_critical",
                severity: "critical",
                icon: "🔴",
                title: `${metrics.lossProducts} ürün zararda satılıyor!`,
                message: `Toplam ${(lossHunter.totalLostProfit || lossHunter.totalImpact || 0).toFixed(0)}₺ kayıp. Fiyatları güncelleyin.`,
                action: "Fiyatları düzeltin",
                autoAction: "price_fix",
            });
        }

        // Satış düşüşü uyarısı
        if (metrics.todayRevenue < metrics.yesterdayRevenue * 0.5 && metrics.yesterdayRevenue > 0) {
            alerts.push({
                type: "sales_drop",
                severity: "high",
                icon: "📉",
                title: "Satışlar bugün düşük!",
                message: `Bugün: ${metrics.todayRevenue.toFixed(0)}₺ vs Dün: ${metrics.yesterdayRevenue.toFixed(0)}₺`,
                action: "Kampanya veya fiyat indirimi düşünün",
            });
        }

        // Yüksek risk uyarısı
        if (risks.overallRiskLevel === "high") {
            alerts.push({
                type: "risk_high",
                severity: "high",
                icon: "⚠️",
                title: "Yüksek risk tespit edildi!",
                message: `${risks.riskCount.high} yüksek riskli durum var. Toplam aylık etki: ${risks.totalMonthlyRiskImpact?.toFixed(0) || 0}₺`,
                action: "Risk raporunu inceleyin",
            });
        }

        // Fırsat uyarısı (pozitif)
        if (metrics.todayRevenue > (metrics.monthRevenue / 30) * 1.5 && metrics.todayRevenue > 0) {
            alerts.push({
                type: "sales_spike",
                severity: "info",
                icon: "🎉",
                title: "Satışlar bugün ortalamanın üstünde!",
                message: `Bugün: ${metrics.todayRevenue.toFixed(0)}₺ — Ortalamanın %${Math.round((metrics.todayRevenue / (metrics.monthRevenue / 30) - 1) * 100)} üstünde`,
                action: "Stok durumunu kontrol edin",
            });
        }

        return {
            alerts,
            businessHealth: {
                score: businessHealth.overallScore,
                rating: businessHealth.rating,
            },
            timestamp: new Date(),
        };
    } catch (err) {
        logger.error(`🤖 [AI Operatör] Proactive alerts ERROR: ${err.message}`);
        return { alerts: [], timestamp: new Date() };
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// QUICK STATS — Hızlı istatistik (chat için)
// ═════════════════════════════════════════════════════════════════════════════

async function getQuickStats(userId) {
    try {
        const todayStart = getTurkeyTodayStart();
        const tomorrowStart = getTurkeyTomorrowStart();

        const [
            cache,
            mapCount,
            legacyProductCount,
            totalOrders,
            pendingRecs,
            todayAgg,
        ] = await Promise.all([
            AIAnalysisCache.findOne({ userId }).lean(),
            ProductMapping.countDocuments({ userId }),
            Product.countDocuments({ userId, status: "active" }),
            Order.countDocuments({ user: userId, isCancelled: { $ne: true } }),
            Recommendation.countDocuments({ userId, status: "pending" }),
            Order.aggregate([
                {
                    $match: {
                        user: userId,
                        orderDate: { $gte: todayStart, $lt: tomorrowStart },
                        isCancelled: { $ne: true },
                    },
                },
                { $group: { _id: null, revenue: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
            ]),
        ]);

        const totalProducts = mapCount > 0 ? mapCount : legacyProductCount;
        const row = todayAgg[0];
        const todayRevenue = round2(row?.revenue || 0);
        const todayOrders = row?.count || 0;

        let healthScore = 0;
        let rating = "unknown";
        let criticalAlerts = 0;
        let totalLoss = 0;
        let lastAnalyzedAt = null;
        let fromCacheHint = false;

        if (cache?.healthSnapshot) {
            healthScore = cache.healthSnapshot.overallScore || 0;
            rating = cache.healthSnapshot.rating || "unknown";
            criticalAlerts = cache.healthSnapshot.criticalAlerts || 0;
            totalLoss = cache.healthSnapshot.totalLoss || 0;
            lastAnalyzedAt = cache.lastAnalyzedAt;
            fromCacheHint = !!cache.brainData;
        }
        if (cache?.brainData?.businessHealth) {
            const bh = cache.brainData.businessHealth;
            if (!healthScore && bh.overallScore) healthScore = bh.overallScore;
            if (rating === "unknown" && bh.rating) rating = bh.rating;
            const tl = cache.brainData.lossHunter?.totalImpact;
            if (!totalLoss && tl != null) totalLoss = tl;
        }

        return {
            healthScore,
            rating,
            criticalAlerts,
            pendingRecs,
            totalLoss,
            productCount: totalProducts,
            orderCount: totalOrders,
            totalProducts,
            totalOrders,
            todayRevenue,
            todayOrders,
            lastAnalyzedAt,
            fromCache: fromCacheHint,
        };
    } catch (err) {
        logger.error(`🤖 [AI Operatör] Quick stats ERROR: ${err.message}`);
        return {
            healthScore: 0,
            rating: "unknown",
            criticalAlerts: 0,
            pendingRecs: 0,
            totalLoss: 0,
            productCount: 0,
            orderCount: 0,
            totalProducts: 0,
            totalOrders: 0,
            todayRevenue: 0,
            todayOrders: 0,
            lastAnalyzedAt: null,
            fromCache: false,
        };
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    observe,
    analyze,
    decide,
    act,
    verify,
    learn,
    runFullCycle,
    generateProactiveAlerts,
    getQuickStats,
    GUARDRAILS,
};
