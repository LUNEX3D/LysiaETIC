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
const AICycleCounter = require("../models/AICycleCounter");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ProductMapping = require("../models/ProductMapping");
const Marketplace = require("../models/Marketplace");
const Recommendation = require("../models/Recommendation");
const AutonomyConfig = require("../models/AutonomyConfig");
const logger = require("../config/logger");
const { getTurkeyTodayStart, getTurkeyTomorrowStart } = require("../utils/turkeyTime");

const OPERATOR_CYCLE_INTERVAL_MS = 10 * 60 * 1000;

function round2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
}

// ═════════════════════════════════════════════════════════════════════════════
// GUARDRAILS — Default Güvenlik Limitleri (kullanıcı AutonomyConfig'i bunları override eder)
// ═════════════════════════════════════════════════════════════════════════════
const GUARDRAILS = {
    maxPriceChangePercent: 20,
    maxPriceIncreasePercent: 15,
    maxDiscountPercent: 30,
    minDiscountPercent: 3,
    maxStockOrderQuantity: 500,
    minProfitMarginPercent: 5,
    targetProfitMarginPercent: 15,
    maxActionsPerHour: 50,
    maxActionsPerHourGlobal: 2000,
    requireApprovalForCritical: true,
    cooldownMinutes: 5,
    autoApproveBelowImpactTRY: 100,
    autoApproveOnlyIfConfidence: 75,
    mode: "supervised",
};

/**
 * loadUserGuardrails — Kullanıcının AutonomyConfig'inden GUARDRAILS objesini oluştur.
 * Kullanıcı config'i yoksa veya alan eksikse default değerlerle fill eder.
 * Tüm decision pipeline bu objeyi kullanmalı.
 */
async function loadUserGuardrails(userId) {
    try {
        const cfg = await AutonomyConfig.getOrCreate(userId);
        return {
            // Genel
            mode: cfg.mode || GUARDRAILS.mode,
            // Marj
            targetProfitMarginPercent: cfg.targetProfitMarginPercent ?? GUARDRAILS.targetProfitMarginPercent,
            minProfitMarginPercent: cfg.minProfitMarginPercent ?? GUARDRAILS.minProfitMarginPercent,
            // Fiyat
            maxPriceChangePercent: cfg.maxPriceChangePercent ?? GUARDRAILS.maxPriceChangePercent,
            maxPriceIncreasePercent: cfg.maxPriceIncreasePercent ?? GUARDRAILS.maxPriceIncreasePercent,
            maxDiscountPercent: cfg.maxDiscountPercent ?? GUARDRAILS.maxDiscountPercent,
            minDiscountPercent: cfg.minDiscountPercent ?? GUARDRAILS.minDiscountPercent,
            // Stok
            maxStockOrderQuantity: cfg.maxStockOrderQuantity ?? GUARDRAILS.maxStockOrderQuantity,
            enableAutoRestock: !!cfg.enableAutoRestock,
            // Hız
            maxActionsPerHour: cfg.maxActionsPerHour ?? GUARDRAILS.maxActionsPerHour,
            maxActionsPerHourGlobal: GUARDRAILS.maxActionsPerHourGlobal,
            cooldownMinutes: cfg.cooldownMinutes ?? GUARDRAILS.cooldownMinutes,
            // Onay
            requireApprovalForCritical: cfg.requireApprovalForCritical ?? GUARDRAILS.requireApprovalForCritical,
            autoApproveBelowImpactTRY: cfg.autoApproveBelowImpactTRY ?? GUARDRAILS.autoApproveBelowImpactTRY,
            autoApproveOnlyIfConfidence: cfg.autoApproveOnlyIfConfidence ?? GUARDRAILS.autoApproveOnlyIfConfidence,
            // İzinler
            allowedActions: Array.isArray(cfg.allowedActions) ? cfg.allowedActions : GUARDRAILS.allowedActions,
            productWhitelist: cfg.productWhitelist || [],
            productBlacklist: cfg.productBlacklist || [],
            categoryRules: cfg.categoryRules || [],
            marketplaceBlacklist: cfg.marketplaceBlacklist || [],
            requireSyncedMarketplace: cfg.requireSyncedMarketplace !== false,
            // Çalışma saatleri
            workHours: cfg.workHours || { enabled: false },
            withinWorkHours: AutonomyConfig.isWithinWorkHours(cfg),
            // Raw config (bazı yerlerde detay lazım olabilir)
            _rawConfig: cfg,
        };
    } catch (err) {
        logger.warn(`[AIOperator] loadUserGuardrails fallback to defaults: ${err.message}`);
        return { ...GUARDRAILS, withinWorkHours: true, productWhitelist: [], productBlacklist: [], categoryRules: [], marketplaceBlacklist: [], _rawConfig: null };
    }
}

/**
 * filterProductByConfig — Bu ürün kullanıcı config'ine göre AI'ya açık mı?
 */
function filterProductByConfig(product, userGuardrails) {
    if (!product || !userGuardrails) return true;
    const barcode = product.barcode;
    if (userGuardrails.productBlacklist?.includes(barcode)) return false;
    if (userGuardrails.productWhitelist?.length > 0 && !userGuardrails.productWhitelist.includes(barcode)) return false;
    return true;
}

/**
 * categoryEffectiveLimits — Kategori için efektif eşikleri döndür (kategori > genel)
 */
function categoryEffectiveLimits(category, userGuardrails) {
    const rule = userGuardrails.categoryRules?.find(r => r.category === category);
    return {
        maxDiscountPercent: rule?.maxDiscountPercent ?? userGuardrails.maxDiscountPercent,
        minProfitMarginPercent: rule?.minProfitMarginPercent ?? userGuardrails.minProfitMarginPercent,
        targetProfitMarginPercent: rule?.targetProfitMarginPercent ?? userGuardrails.targetProfitMarginPercent,
    };
}

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

    // Kullanıcı kurallarını yükle — bundan sonraki her şey config'e göre çalışır
    const userGuardrails = await loadUserGuardrails(userId);
    // Kullanıcı mode'u operasyon modunu override eder
    const effectiveMode = userGuardrails.mode || operationMode;

    // Mevcut auto-decide motorunu kullan
    const autoDecisions = await AIBrain.autoDecide(userId, analyzedProducts, observation, businessHealth, lossHunter);

    // Hafızadan öğrenilmiş kuralları uygula
    const memoryAdjustedDecisions = applyMemoryToDecisions(autoDecisions.decisions, memories);

    // Güvenlik kontrolü (kullanıcı config'i ile)
    const safeDecisions = applySafetyGuardrails(memoryAdjustedDecisions, effectiveMode, userGuardrails, analyzedProducts);

    return {
        decisions: safeDecisions,
        totalPotentialImpact: safeDecisions.reduce((s, d) => s + (d.impact || 0), 0),
        criticalCount: safeDecisions.filter(d => d.urgency === "critical").length,
        operationMode: effectiveMode,
        guardrailsApplied: safeDecisions.filter(d => d._guardrailApplied).length,
        blockedCount: safeDecisions.filter(d => d._blocked).length,
        userGuardrails: {
            mode: userGuardrails.mode,
            targetMargin: userGuardrails.targetProfitMarginPercent,
            minMargin: userGuardrails.minProfitMarginPercent,
            maxDiscount: userGuardrails.maxDiscountPercent,
            maxPriceChange: userGuardrails.maxPriceChangePercent,
            withinWorkHours: userGuardrails.withinWorkHours,
        },
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
 *
 * Her aksiyon tipi için ayrı sınırlama:
 *  - price_update / price_fix / margin_optimize: fiyat değişim %'si maxPriceChangePercent (20%) ile sınırlanır
 *  - apply_discount / discount: discountPercent [minDiscountPercent, maxDiscountPercent] (3%-30%) arasına clamp edilir
 *  - restock: restockQty maxStockOrderQuantity (500) ile sınırlanır
 *  - liquidate (çoklu ürün): autoExecutable=false zorlanır → daima manuel onay gerektirir
 *  - expand / marketing: tek başına manuel inceleme, asla autoExecutable değil
 */
function applySafetyGuardrails(decisions, operationMode, userGuardrails = GUARDRAILS, analyzedProducts = []) {
    const g = userGuardrails;
    // Hızlı ürün lookup için map (kategori kuralları için)
    const productByBarcode = new Map();
    for (const p of (analyzedProducts || [])) {
        if (p?.barcode) productByBarcode.set(p.barcode, p);
    }

    return decisions.map(d => {
        const modified = { ...d, _guardrailApplied: false, _blockReasons: [] };
        const product = d.barcode ? productByBarcode.get(d.barcode) : null;
        const catLimits = product ? categoryEffectiveLimits(product.category, g) : null;

        // ── 0. ÜRÜN WHITELIST / BLACKLIST ───────────────────────────────────
        if (d.barcode) {
            if (g.productBlacklist?.includes(d.barcode)) {
                modified.autoExecutable = false;
                modified._requiresApproval = true;
                modified._blocked = true;
                modified._blockReasons.push("Ürün kullanıcı tarafından kara listede");
                return modified;
            }
            if (g.productWhitelist?.length > 0 && !g.productWhitelist.includes(d.barcode)) {
                modified.autoExecutable = false;
                modified._requiresApproval = true;
                modified._blocked = true;
                modified._blockReasons.push("Ürün whitelist dışında");
                return modified;
            }
        }

        // ── 1. AKSIYON TİPİ İZNİ ────────────────────────────────────────────
        const actionType = mapActionToExecutionType(d.action);
        if (g.allowedActions?.length > 0 && actionType && !g.allowedActions.includes(actionType)) {
            modified.autoExecutable = false;
            modified._requiresApproval = true;
            modified._blocked = true;
            modified._blockReasons.push(`Aksiyon tipi izinsiz: ${actionType}`);
            return modified;
        }

        // ── 2. ÇALIŞMA SAATLERİ ─────────────────────────────────────────────
        if (g.withinWorkHours === false) {
            modified.autoExecutable = false;
            modified._requiresApproval = true;
            modified._blockReasons.push("Çalışma saatleri dışında — manuel onay gerekli");
        }

        // ── 3. FİYAT AKSİYONLARI ────────────────────────────────────────────
        if (["price_update", "price_fix", "margin_optimize"].includes(d.action) && d.params) {
            const oldPrice = Number(d.params.oldPrice) || 0;
            const newPrice = Number(d.params.newPrice) || 0;
            if (oldPrice > 0 && newPrice > 0) {
                const changePct = ((newPrice - oldPrice) / oldPrice) * 100;
                const absChange = Math.abs(changePct);
                // Artış mı düşüş mü — ayrı limit
                const isIncrease = newPrice > oldPrice;
                const limit = isIncrease ? g.maxPriceIncreasePercent : g.maxPriceChangePercent;
                if (absChange > limit) {
                    const direction = isIncrease ? 1 : -1;
                    modified.params = { ...d.params, newPrice: Math.round(oldPrice * (1 + direction * limit / 100)) };
                    modified._guardrailApplied = true;
                    modified._guardrailNote = `${isIncrease ? "Artış" : "Düşüş"} %${absChange.toFixed(0)} → %${limit} ile sınırlandı`;
                }
                // Min marj koruması
                if (product && product.costPrice > 0) {
                    const minMargin = catLimits?.minProfitMarginPercent ?? g.minProfitMarginPercent;
                    const projectedMargin = ((modified.params.newPrice - product.costPrice) / modified.params.newPrice) * 100;
                    if (projectedMargin < minMargin) {
                        // Min marj koruması: fiyatı min marja yükselt
                        const minSafePrice = Math.ceil(product.costPrice / (1 - minMargin / 100));
                        if (minSafePrice > modified.params.newPrice) {
                            modified.params.newPrice = minSafePrice;
                            modified._guardrailApplied = true;
                            modified._guardrailNote = (modified._guardrailNote ? modified._guardrailNote + " · " : "") + `Min %${minMargin} kâr marjı için fiyat ${minSafePrice}₺'ye çekildi`;
                        }
                    }
                }
            } else {
                modified.autoExecutable = false;
                modified._requiresApproval = true;
                modified._guardrailApplied = true;
                modified._guardrailNote = "Geçersiz fiyat parametreleri — manuel inceleme";
            }
        }

        // ── 4. İNDİRİM AKSİYONLARI ──────────────────────────────────────────
        if (["apply_discount", "discount"].includes(d.action)) {
            const rawPct = Number(d.params?.discountPercent);
            const safePct = Number.isFinite(rawPct) ? rawPct : 10;
            const maxDisc = catLimits?.maxDiscountPercent ?? g.maxDiscountPercent;
            const clamped = Math.min(maxDisc, Math.max(0, safePct));
            if (clamped !== safePct) {
                modified._guardrailApplied = true;
                modified._guardrailNote = `İndirim %${safePct} → %${clamped} (${catLimits ? "kategori kuralı" : "genel kural"})`;
            }
            modified.params = { ...(d.params || {}), discountPercent: clamped };
            if (clamped < g.minDiscountPercent) {
                modified.autoExecutable = false;
                modified._requiresApproval = true;
            }
            if (!d.barcode) {
                modified.autoExecutable = false;
                modified._requiresApproval = true;
            }
            // Min marj sonrası kontrol
            if (product && product.costPrice > 0) {
                const newPriceAfterDisc = (product.price || 0) * (1 - clamped / 100);
                const minMargin = catLimits?.minProfitMarginPercent ?? g.minProfitMarginPercent;
                const projMargin = newPriceAfterDisc > 0 ? ((newPriceAfterDisc - product.costPrice) / newPriceAfterDisc) * 100 : -100;
                if (projMargin < minMargin) {
                    modified.autoExecutable = false;
                    modified._requiresApproval = true;
                    modified._guardrailApplied = true;
                    modified._guardrailNote = (modified._guardrailNote ? modified._guardrailNote + " · " : "") + `İndirim sonrası marj %${projMargin.toFixed(1)} < min %${minMargin} → onaya alındı`;
                }
            }
        }

        // ── 5. STOK SİPARİŞİ ────────────────────────────────────────────────
        if (d.action === "restock" && d.params) {
            const qty = Number(d.params.restockQty) || 0;
            if (qty > g.maxStockOrderQuantity) {
                modified.params = { ...d.params, restockQty: g.maxStockOrderQuantity };
                modified._guardrailApplied = true;
                modified._guardrailNote = `Stok ${qty} → ${g.maxStockOrderQuantity} ile sınırlandı`;
            }
            // Auto restock kapalıysa daima onay gerekir
            if (!g.enableAutoRestock) {
                modified.autoExecutable = false;
                modified._requiresApproval = true;
            }
        }

        // ── 6. NO-OP / DANIŞMA AKSİYONLARI ──────────────────────────────────
        if (["marketing", "expand", "review_strategy", "investigate", "liquidate"].includes(d.action)) {
            modified.autoExecutable = false;
            modified._requiresApproval = true;
        }

        // ── 7. OPERASYON MODU ───────────────────────────────────────────────
        const effectiveMode = g.mode || operationMode || "supervised";
        if (effectiveMode === "manual" || effectiveMode === "passive") {
            modified.autoExecutable = false;
            modified._requiresApproval = true;
        }
        if (effectiveMode === "supervised" || effectiveMode === "assisted") {
            if (d.urgency === "critical" && g.requireApprovalForCritical) {
                modified._requiresApproval = true;
            }
            // Etki büyükse onay zorunlu
            const impact = Math.abs(d.expectedImpact || d.impact?.profitChange || 0);
            if (impact > g.autoApproveBelowImpactTRY) {
                modified._requiresApproval = true;
            }
            // Güven düşükse onay zorunlu
            if ((d.confidence || 50) < g.autoApproveOnlyIfConfidence) {
                modified._requiresApproval = true;
            }
        }
        if (effectiveMode === "autonomous") {
            if (modified._guardrailApplied) {
                modified._requiresApproval = true;
            }
        }

        return modified;
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. ACT — Aksiyon Uygulama Katmanı
// ═════════════════════════════════════════════════════════════════════════════

async function act(userId, decision) {
    // ── Çoklu ürün veya hedefsiz aksiyonlar burada çalıştırılmamalı ──
    if (!decision.barcode && ["price_update", "price_fix", "margin_optimize", "apply_discount", "discount", "restock"].includes(decision.action)) {
        return {
            success: false,
            message: "Hedef ürün (barcode) belirtilmemiş — otomatik uygulama güvenli değil",
            invalidTarget: true,
        };
    }

    // ── Kullanıcı kurallarını yükle (rate limit + cooldown için) ──
    const userG = await loadUserGuardrails(userId);

    // ── Çalışma saatleri kontrolü ──
    if (userG.withinWorkHours === false) {
        return {
            success: false,
            message: "Çalışma saatleri dışında — aksiyon ertelendi",
            outsideWorkHours: true,
        };
    }

    // ── Saatlik aksiyon limiti (kullanıcı bazlı) ──
    const hourlyActions = await Recommendation.countDocuments({
        userId,
        status: "executed",
        executedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (hourlyActions >= userG.maxActionsPerHour) {
        return {
            success: false,
            message: `Saatlik aksiyon limiti (${userG.maxActionsPerHour}) aşıldı. Lütfen bekleyin.`,
            rateLimited: true,
        };
    }

    // ── Idempotency + cooldown: atomic upsert ile race koruması ──
    const executionType = mapActionToExecutionType(decision.action);
    const cooldownSince = new Date(Date.now() - userG.cooldownMinutes * 60 * 1000);

    if (decision.barcode) {
        const recentAny = await Recommendation.findOne({
            userId,
            "actionPayload.targetId": decision.barcode,
            "actionPayload.actionType": executionType,
            $or: [
                { status: "executed", executedAt: { $gte: cooldownSince } },
                { status: "approved", updatedAt: { $gte: cooldownSince } }, // eş zamanlı çalışan execute
            ],
        }).lean();
        if (recentAny) {
            return {
                success: false,
                message: `Bu ürüne son ${userG.cooldownMinutes} dakika içinde aynı aksiyon uygulandı/uygulanıyor. Cooldown.`,
                cooldown: true,
            };
        }
    }

    try {
        // executionKey önceden oluşur → executeRecommendation içindeki idempotency kontrolü çalışsın
        const ts = Date.now();
        const executionKey = `op_${decision.action}_${decision.barcode || "nb"}_${userId}_${ts}`;

        const rec = await Recommendation.create({
            userId,
            type: mapActionToRecType(decision.action),
            title: decision.title || "AI Operatör Aksiyonu",
            description: decision.description || "",
            category: ["price_update", "price_fix", "margin_optimize", "apply_discount", "discount"].includes(decision.action) ? "pricing" : "stock",
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
            status: "approved",
            strategyMode: "balanced",
            executionKey,
            // Guardrail görünürlüğü
            guardrailNote: decision._guardrailNote || "",
            blocked: !!decision._blocked,
            blockReasons: Array.isArray(decision._blockReasons) ? decision._blockReasons : [],
            ruleTrace: decision._ruleTrace ? {
                source: decision._ruleTrace.source || "global",
                categoryRule: decision._ruleTrace.categoryRule || undefined,
                targetMargin: decision._ruleTrace.targetMargin,
                minMargin: decision._ruleTrace.minMargin,
                maxDiscount: decision._ruleTrace.maxDiscount,
                clampApplied: !!decision._guardrailApplied,
                clampDetail: decision._guardrailNote || undefined,
            } : (decision._guardrailApplied ? {
                source: "global",
                clampApplied: true,
                clampDetail: decision._guardrailNote,
            } : undefined),
        });

        const result = await AIEngine.executeRecommendation(rec._id, userId);

        logger.info(`🤖 [AI Operatör] ACT: ${decision.action} → ${result.result.success ? "✅" : "❌"} ${result.result.message}`);

        return {
            success: result.result.success,
            message: result.result.message,
            recommendationId: rec._id,
            data: result.result.data,
            requiresManualAction: result.result.data?.requiresManualAction || false,
        };
    } catch (err) {
        // Duplicate executionKey → concurrent act() patladı, sessizce skip
        if (err.code === 11000) {
            return { success: false, message: "Eş zamanlı aksiyon tespit edildi, atlandı", duplicate: true };
        }
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

/**
 * Aksiyon öncesi/sonrası satışları karşılaştırır.
 * Aksiyon anlık olduğu için bu fonksiyon yalnızca ÖN baseline ölçer ve
 * gerçek improvement değeri 24 saat sonra `revisitPendingMemories()` tarafından doldurulur.
 */
async function verify(userId, actionResult, decision) {
    if (!actionResult.success) {
        return { verified: false, reason: "Aksiyon başarısız oldu", improvement: 0, baseline: null, needsFollowUp: false };
    }

    let baseline = null;
    if (decision.barcode) {
        try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const rows = await Order.aggregate([
                { $match: { user: userId, orderDate: { $gte: since }, isCancelled: { $ne: true } } },
                { $unwind: "$items" },
                { $match: { "items.barcode": decision.barcode } },
                { $group: {
                    _id: null,
                    qty: { $sum: { $ifNull: ["$items.quantity", 1] } },
                    revenue: { $sum: { $multiply: [
                        { $ifNull: ["$items.price", 0] },
                        { $cond: [{ $gt: [{ $ifNull: ["$items.quantity", 1] }, 0] }, "$items.quantity", 1] },
                    ] } },
                } },
            ]);
            const r = rows[0] || { qty: 0, revenue: 0 };
            baseline = {
                last7DaysQty: Number(r.qty) || 0,
                last7DaysRevenue: Number(r.revenue) || 0,
                avgDailyQty: (Number(r.qty) || 0) / 7,
                capturedAt: new Date(),
            };
        } catch (e) {
            logger.warn(`[AI Operatör] verify baseline failed: ${e.message}`);
        }
    }

    return {
        verified: true,
        reason: "Aksiyon uygulandı; gerçek etki 24 saat sonra ölçülecek",
        improvement: 0,
        baseline,
        needsFollowUp: true,
        followUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. LEARN — Öğrenme Katmanı
// ═════════════════════════════════════════════════════════════════════════════

/**
 * AIMemory deduplication: anahtar `${action}_${barcode}` (Date.now KULLANILMAZ),
 * her tekrarda occurrenceCount artar.
 */
async function learn(userId, decision, actionResult, verification) {
    try {
        const targetKey = decision.barcode || "general";
        const memoryKey = `${decision.action}_${targetKey}`;

        await AIMemory.findOneAndUpdate(
            { userId, memoryType: "action_result", key: memoryKey },
            {
                $set: {
                    value: {
                        lastDecision: {
                            action: decision.action,
                            title: decision.title,
                            params: decision.params,
                            confidence: decision.confidence,
                        },
                        lastResult: {
                            success: actionResult.success,
                            message: actionResult.message,
                        },
                        lastVerification: {
                            verified: verification.verified,
                            improvement: verification.improvement,
                            baseline: verification.baseline || null,
                            followUpAt: verification.followUpAt || null,
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
                        // gerçek improvement 24s sonra revisitPendingMemories() ile dolacak
                        improvement: verification.improvement,
                        // başarısızsa "negative"; başarılıysa henüz ölçüm yok → "pending"
                        verdict: actionResult.success ? "pending" : "negative",
                        baseline: verification.baseline || null,
                        followUpAt: verification.followUpAt || null,
                    },
                    confidence: actionResult.success ? 60 : 25,
                    lastUsedAt: new Date(),
                    tags: [decision.action, decision.urgency || "medium"],
                },
                $inc: { occurrenceCount: 1 },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        logger.info(`🧠 [AI Operatör] LEARN: ${memoryKey} — verdict=${actionResult.success ? "pending" : "negative"}`);
    } catch (err) {
        logger.error(`🧠 [AI Operatör] LEARN ERROR: ${err.message}`);
    }
}

/**
 * 24 saat önce uygulanmış ve hâlâ "pending" verdict'li hafıza kayıtlarını gez,
 * o günden bugüne gerçek satış değişimini ölç ve verdict'i "positive/negative" olarak güncelle.
 * aiBackgroundWorker tarafından her döngüde çağrılır.
 */
async function revisitPendingMemories(userId) {
    try {
        const now = Date.now();
        const pending = await AIMemory.find({
            userId,
            memoryType: "action_result",
            "result.verdict": "pending",
            "result.followUpAt": { $lte: new Date(now) },
        }).limit(50).lean();

        if (pending.length === 0) return { revisited: 0 };

        let updated = 0;
        for (const mem of pending) {
            const barcode = mem.action?.targetBarcode;
            const executedAt = mem.action?.executedAt;
            const baseline = mem.result?.baseline;
            if (!barcode || !executedAt) {
                await AIMemory.updateOne({ _id: mem._id }, {
                    $set: { "result.verdict": "neutral", confidence: 40 },
                });
                continue;
            }
            try {
                const since = new Date(executedAt);
                const rows = await Order.aggregate([
                    { $match: { user: userId, orderDate: { $gte: since }, isCancelled: { $ne: true } } },
                    { $unwind: "$items" },
                    { $match: { "items.barcode": barcode } },
                    { $group: {
                        _id: null,
                        qty: { $sum: { $ifNull: ["$items.quantity", 1] } },
                        revenue: { $sum: { $multiply: [
                            { $ifNull: ["$items.price", 0] },
                            { $cond: [{ $gt: [{ $ifNull: ["$items.quantity", 1] }, 0] }, "$items.quantity", 1] },
                        ] } },
                    } },
                ]);
                const elapsedDays = Math.max(1, (now - new Date(executedAt).getTime()) / (24 * 60 * 60 * 1000));
                const r = rows[0] || { qty: 0, revenue: 0 };
                const afterDailyQty = (Number(r.qty) || 0) / elapsedDays;
                const beforeDailyQty = baseline?.avgDailyQty || 0;
                let improvement = 0;
                if (beforeDailyQty > 0) {
                    improvement = ((afterDailyQty - beforeDailyQty) / beforeDailyQty) * 100;
                } else if (afterDailyQty > 0) {
                    improvement = 100; // hiç satış yokken satış başlamış
                }
                const verdict = improvement > 5 ? "positive" : improvement < -5 ? "negative" : "neutral";
                const newConfidence = verdict === "positive" ? Math.min(95, 60 + Math.min(20, Math.abs(improvement) / 5))
                    : verdict === "negative" ? Math.max(15, 30 - Math.min(15, Math.abs(improvement) / 10))
                    : 50;
                await AIMemory.updateOne({ _id: mem._id }, {
                    $set: {
                        "result.verdict": verdict,
                        "result.improvement": Math.round(improvement * 100) / 100,
                        "result.measuredAt": new Date(),
                        "result.afterMetrics": { dailyQty: afterDailyQty, totalQty: r.qty, revenue: r.revenue },
                        confidence: Math.round(newConfidence),
                        lastUsedAt: new Date(),
                    },
                });
                updated++;
            } catch (e) {
                logger.warn(`[AI Operatör] revisit memory ${mem._id} failed: ${e.message}`);
            }
        }
        if (updated > 0) {
            logger.info(`🧠 [AI Operatör] revisitPendingMemories: ${updated}/${pending.length} güncellendi`);
        }
        return { revisited: updated, total: pending.length };
    } catch (err) {
        logger.error(`🧠 [AI Operatör] revisitPendingMemories ERROR: ${err.message}`);
        return { revisited: 0, error: err.message };
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
        const cycleNumber = await AICycleCounter.nextNumber(userId);

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
    revisitPendingMemories,
    runFullCycle,
    generateProactiveAlerts,
    getQuickStats,
    GUARDRAILS,
    loadUserGuardrails,
    applySafetyGuardrails,
    categoryEffectiveLimits,
    filterProductByConfig,
};
