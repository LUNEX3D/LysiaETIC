/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI ENGINE CONTROLLER — LysiaETIC AI Decision Engine (v2)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * API Endpoints:
 *  GET  /dashboard                   — Full combined dashboard (single call)
 *  GET  /recommendations             — List recommendations (with filters)
 *  POST /recommendations/generate    — Force-generate new recommendations
 *  POST /recommendations/:id/approve — Approve a recommendation
 *  POST /recommendations/:id/reject  — Reject a recommendation
 *  POST /recommendations/:id/execute — Execute an approved recommendation
 *  GET  /ai-score                    — AI health score
 *  GET  /daily-report                — Daily journal
 *  GET  /daily-actions               — Top prioritized actions
 *  GET  /strategy                    — Strategy detection
 *  POST /simulate                    — Single simulation
 *  POST /simulate-advanced           — Multi-variable simulation
 *  GET  /profit-heatmap              — Profitability heatmap
 *  GET  /timing                      — Best hours/days
 *  GET  /retro                       — Past mistakes analysis
 *  GET  /roi                         — ROI tracker
 *  GET  /product-health              — Product health scores
 *  GET  /learning                    — User preference data
 *  POST /goals                       — Create goal
 *  GET  /goals                       — List goals
 *  GET  /notifications               — Real-time alerts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const AIEngine = require("../services/aiEngineService");
const AIBrain = require("../services/aiOperationsBrain");
const AIAdvisor = require("../services/aiProductAdvisor");
const Recommendation = require("../models/Recommendation");
const AIGoal = require("../models/AIGoal");
const AIAnalysisCache = require("../models/AIAnalysisCache");
const logger = require("../config/logger");

let aiWorker = null;
try { aiWorker = require("../services/aiBackgroundWorker"); } catch (e) { /* worker not available */ }

const uid = (req) => req.user?._id || req.user?.id;

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain — Full AI Operations Brain Dashboard (CACHED — reads from background worker)
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainDashboard = async (req, res) => {
    try {
        const userId = uid(req);
        const strategyMode = req.query.strategy || "balanced";
        const forceRefresh = req.query.refresh === "true";

        // 1. Try reading from cache first (background worker keeps this fresh)
        if (!forceRefresh && aiWorker) {
            const cached = await aiWorker.getCachedAnalysis(userId);
            if (cached && !cached._cache?.isStale) {
                // If strategy changed, trigger background re-analysis
                if (cached._cache?.strategyMode !== strategyMode) {
                    aiWorker.forceAnalyzeUser(userId, strategyMode).catch(e =>
                        logger.warn(`[AI Brain] Strategy change re-analysis failed: ${e.message}`)
                    );
                }
                return res.json(cached);
            }
        }

        // 2. Cache miss or stale — compute fresh (also updates cache)
        const result = await AIBrain.getFullBrainDashboard(userId, AIEngine, strategyMode);

        // 3. Update cache in background
        if (aiWorker) {
            AIAnalysisCache.findOneAndUpdate(
                { userId },
                {
                    $set: {
                        brainData: result,
                        strategyMode,
                        lastAnalyzedAt: new Date(),
                        productCount: result.productCount || 0,
                        healthSnapshot: {
                            overallScore: result.businessHealth?.overallScore || 0,
                            rating: result.businessHealth?.rating || "warning",
                            criticalAlerts: result.redAlerts?.criticalCount || 0,
                            pendingRecs: result.recSummary?.pending || 0,
                            totalLoss: result.lossHunter?.totalImpact || 0,
                        },
                        lastError: null,
                        consecutiveErrors: 0,
                    }
                },
                { upsert: true }
            ).catch(e => logger.warn(`[AI Brain] Cache update failed: ${e.message}`));
        }

        res.json(result);
    } catch (err) {
        logger.error(`[AI Brain] getBrainDashboard error: ${err.message}`);
        res.status(500).json({ success: false, message: "AI Brain yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/section/:name — Read a specific section from cache (FAST)
// ═════════════════════════════════════════════════════════════════════════════
// Instead of each tab calling collectData+analyzeProducts (8 DB queries each),
// this reads from the pre-computed cache that background worker maintains.
// Falls back to computing fresh if cache is missing.
// ═════════════════════════════════════════════════════════════════════════════
const SECTION_MAP = {
    losses:       (d) => ({ success: true, ...(d.lossHunter || {}) }),
    risks:        (d) => ({ success: true, ...(d.riskAssessment || {}) }),
    predictions:  (d) => ({ success: true, ...(d.predictions || {}) }),
    segmentation: (d) => ({ success: true, segmentation: d.segmentation || {} }),
    causes:       (d) => ({ success: true, causes: d.causeAnalysis || [] }),
    opportunities:(d) => ({ success: true, opportunities: d.opportunityRadar || [] }),
    self_eval:    (d) => ({ success: true, selfEvaluation: d.selfEvaluation || {} }),
    decisions:    (d) => ({ success: true, decisionHistory: d.decisionHistory || {} }),
    heatmap:      (d) => ({ success: true, heatmap: d.heatmap || {} }),
    timing:       (d) => ({ success: true, timing: d.timing || {} }),
    retro:        (d) => ({ success: true, retro: d.retro || {} }),
    roi:          (d) => ({ success: true, roi: d.roi || {} }),
    health:       (d) => ({ success: true, products: (d.productHealth?.worstProducts || []).concat(d.productHealth?.bestProducts || []), segments: d.productHealth?.segments || {}, avgHealthScore: d.productHealth?.avgHealthScore || 0 }),
    learning:     (d) => ({ success: true, learning: d.learning || {} }),
};

exports.getBrainSection = async (req, res) => {
    try {
        const userId = uid(req);
        const section = req.params.name;

        if (!SECTION_MAP[section]) {
            return res.status(400).json({ success: false, message: `Bilinmeyen bölüm: ${section}` });
        }

        // 1. Try cache first (instant response)
        if (aiWorker) {
            const cached = await aiWorker.getCachedAnalysis(userId);
            if (cached && !cached._cache?.isStale) {
                const result = SECTION_MAP[section](cached);
                result._fromCache = true;
                result._cacheAge = cached._cache?.ageMinutes || 0;
                return res.json(result);
            }
        }

        // 2. Cache miss — fall back to individual endpoint logic
        // This is slower but ensures data is always available
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);

        let result;
        switch (section) {
            case "losses":
                result = { success: true, ...AIBrain.huntLosses(analyzed, data) };
                break;
            case "risks": {
                const aiScore = AIEngine.calculateAIScore(analyzed, data);
                const bh = AIBrain.calculateBusinessHealth(analyzed, data, aiScore);
                result = { success: true, ...AIBrain.assessRisks(analyzed, data, bh) };
                break;
            }
            case "predictions":
                result = { success: true, ...AIBrain.generatePredictions(analyzed, data) };
                break;
            case "segmentation":
                result = { success: true, segmentation: AIBrain.segmentProducts(analyzed) };
                break;
            case "causes":
                result = { success: true, causes: AIBrain.analyzeCauses(analyzed, data) };
                break;
            case "opportunities":
                result = { success: true, opportunities: AIBrain.scanOpportunities(analyzed, data) };
                break;
            case "self_eval":
                result = { success: true, selfEvaluation: await AIBrain.selfEvaluate(userId) };
                break;
            case "decisions":
                result = { success: true, decisionHistory: await AIBrain.getDecisionHistory(userId) };
                break;
            case "heatmap":
                result = { success: true, heatmap: AIEngine.buildProfitHeatmap(analyzed) };
                break;
            case "timing":
                result = { success: true, timing: AIEngine.analyzeTimingPatterns(data.orders90) };
                break;
            case "retro":
                result = { success: true, retro: AIEngine.retroAnalysis(analyzed, data) };
                break;
            case "roi":
                result = { success: true, roi: AIEngine.calculateROI(data.pastRecs) };
                break;
            case "health": {
                const sorted = [...analyzed].sort((a, b) => a.healthScore - b.healthScore);
                result = {
                    success: true,
                    products: sorted.map(p => ({
                        name: p.name, barcode: p.barcode, category: p.category,
                        healthScore: p.healthScore, profitMargin: p.profitMargin,
                        stock: p.stock, daysOfStock: p.daysOfStock,
                        totalSold: p.totalSold, avgDailySales: p.avgDailySales,
                        daysSinceLastSale: p.daysSinceLastSale, returnRate: p.returnRate,
                    })),
                    segments: {
                        critical: sorted.filter(p => p.healthScore < 30).length,
                        warning: sorted.filter(p => p.healthScore >= 30 && p.healthScore < 50).length,
                        healthy: sorted.filter(p => p.healthScore >= 50 && p.healthScore < 75).length,
                        excellent: sorted.filter(p => p.healthScore >= 75).length,
                    },
                    avgHealthScore: Math.round(analyzed.reduce((s, p) => s + p.healthScore, 0) / (analyzed.length || 1)),
                };
                break;
            }
            case "learning":
                result = { success: true, learning: AIEngine.analyzeUserPreferences(data.pastRecs) };
                break;
            default:
                result = { success: false, message: "Bilinmeyen bölüm" };
        }

        result._fromCache = false;
        res.json(result);
    } catch (err) {
        logger.error(`[AI Brain] getBrainSection(${req.params.name}) error: ${err.message}`);
        res.status(500).json({ success: false, message: `${req.params.name} yüklenemedi`, error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/focus — Focus Engine (top 3-5 priorities)
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainFocus = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const aiScore = AIEngine.calculateAIScore(analyzed, data);
        const bh = AIBrain.calculateBusinessHealth(analyzed, data, aiScore);
        const lh = AIBrain.huntLosses(analyzed, data);
        const focus = AIBrain.generateFocusItems(analyzed, data, bh, lh);
        const tone = AIBrain.getEmotionalTone(bh, focus);
        res.json({ success: true, focusItems: focus, emotionalTone: tone, businessHealth: bh });
    } catch (err) {
        logger.error(`[AI Brain] getBrainFocus error: ${err.message}`);
        res.status(500).json({ success: false, message: "Focus yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/losses — Loss Hunter
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainLosses = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const losses = AIBrain.huntLosses(analyzed, data);
        res.json({ success: true, ...losses });
    } catch (err) {
        logger.error(`[AI Brain] getBrainLosses error: ${err.message}`);
        res.status(500).json({ success: false, message: "Loss Hunter yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/risks — Risk Engine
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainRisks = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const aiScore = AIEngine.calculateAIScore(analyzed, data);
        const bh = AIBrain.calculateBusinessHealth(analyzed, data, aiScore);
        const risks = AIBrain.assessRisks(analyzed, data, bh);
        res.json({ success: true, ...risks });
    } catch (err) {
        logger.error(`[AI Brain] getBrainRisks error: ${err.message}`);
        res.status(500).json({ success: false, message: "Risk analizi yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/predictions — Predictive Engine
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainPredictions = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const predictions = AIBrain.generatePredictions(analyzed, data);
        res.json({ success: true, ...predictions });
    } catch (err) {
        logger.error(`[AI Brain] getBrainPredictions error: ${err.message}`);
        res.status(500).json({ success: false, message: "Tahminler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/segmentation — Segmentation Engine
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainSegmentation = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const segmentation = AIBrain.segmentProducts(analyzed);
        res.json({ success: true, segmentation });
    } catch (err) {
        logger.error(`[AI Brain] getBrainSegmentation error: ${err.message}`);
        res.status(500).json({ success: false, message: "Segmentasyon yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/causes — Cause Engine + Chain Reasoning
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainCauses = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const causes = AIBrain.analyzeCauses(analyzed, data);
        res.json({ success: true, causes });
    } catch (err) {
        logger.error(`[AI Brain] getBrainCauses error: ${err.message}`);
        res.status(500).json({ success: false, message: "Neden analizi yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/opportunities — Opportunity Radar
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainOpportunities = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const opportunities = AIBrain.scanOpportunities(analyzed, data);
        res.json({ success: true, opportunities });
    } catch (err) {
        logger.error(`[AI Brain] getBrainOpportunities error: ${err.message}`);
        res.status(500).json({ success: false, message: "Fırsatlar yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/self-eval — Self Evaluation AI
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainSelfEval = async (req, res) => {
    try {
        const userId = uid(req);
        const selfEval = await AIBrain.selfEvaluate(userId);
        res.json({ success: true, selfEvaluation: selfEval });
    } catch (err) {
        logger.error(`[AI Brain] getBrainSelfEval error: ${err.message}`);
        res.status(500).json({ success: false, message: "AI değerlendirmesi yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/decision-history — Decision History
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainDecisionHistory = async (req, res) => {
    try {
        const userId = uid(req);
        const history = await AIBrain.getDecisionHistory(userId);
        res.json({ success: true, decisionHistory: history });
    } catch (err) {
        logger.error(`[AI Brain] getBrainDecisionHistory error: ${err.message}`);
        res.status(500).json({ success: false, message: "Karar geçmişi yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /brain/explain/:id — Explainable AI
// ═════════════════════════════════════════════════════════════════════════════
exports.explainRecommendation = async (req, res) => {
    try {
        const userId = uid(req);
        const rec = await Recommendation.findOne({ _id: req.params.id, userId }).lean();
        if (!rec) return res.status(404).json({ success: false, message: "Öneri bulunamadı" });
        const explanation = AIBrain.explainDecision(rec);
        res.json({ success: true, recommendation: rec, explanation });
    } catch (err) {
        logger.error(`[AI Brain] explainRecommendation error: ${err.message}`);
        res.status(500).json({ success: false, message: "Açıklama oluşturulamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /brain/auto-decide — "BENİM YERİME KARAR VER" Engine
// ═════════════════════════════════════════════════════════════════════════════
exports.autoDecide = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const aiScore = AIEngine.calculateAIScore(analyzed, data);
        const bh = AIBrain.calculateBusinessHealth(analyzed, data, aiScore);
        const lh = AIBrain.huntLosses(analyzed, data);
        const result = await AIBrain.autoDecide(userId, analyzed, data, bh, lh);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[AI Brain] autoDecide error: ${err.message}`);
        res.status(500).json({ success: false, message: "Otomatik karar motoru başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/diagnosis — "BENİ ANLA" Full Diagnosis
// ═════════════════════════════════════════════════════════════════════════════
exports.getDiagnosis = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const aiScore = AIEngine.calculateAIScore(analyzed, data);
        const bh = AIBrain.calculateBusinessHealth(analyzed, data, aiScore);
        const lh = AIBrain.huntLosses(analyzed, data);
        const predictions = AIBrain.generatePredictions(analyzed, data);
        const diagnosis = AIBrain.generateDiagnosis(analyzed, data, bh, lh, predictions);
        res.json({ success: true, diagnosis });
    } catch (err) {
        logger.error(`[AI Brain] getDiagnosis error: ${err.message}`);
        res.status(500).json({ success: false, message: "Teşhis motoru başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /brain/update-cost — Update product cost data (for AI accuracy)
// ═════════════════════════════════════════════════════════════════════════════
exports.updateProductCost = async (req, res) => {
    try {
        const userId = uid(req);
        const { barcode, costPrice, commissionRate, shippingCost, packagingCost, otherCost, costType } = req.body;
        if (!barcode) return res.status(400).json({ success: false, message: "Barkod zorunlu" });

        const ProductMapping = require("../models/ProductMapping");
        const Product = require("../models/Product");

        // Try ProductMapping first
        const pm = await ProductMapping.findOne({ userId, "masterProduct.barcode": barcode });
        if (pm) {
            if (costPrice !== undefined) pm.masterProduct.costPrice = Number(costPrice);
            if (commissionRate !== undefined) {
                pm.marketplaceMappings.forEach(m => { m.commissionRate = Number(commissionRate); });
            }
            if (shippingCost !== undefined) pm.masterProduct.shippingCost = Number(shippingCost);
            if (packagingCost !== undefined) pm.masterProduct.packagingCost = Number(packagingCost);
            pm.updatedAt = new Date();
            pm.addSyncLog("cost_update", "AI Brain", null, { costPrice, commissionRate, shippingCost, packagingCost, costType }, "success", "Maliyet bilgisi güncellendi");
            await pm.save();

            // Also update legacy Product if exists
            const legacyProduct = await Product.findOne({ userId, barcode });
            if (legacyProduct) {
                if (costPrice !== undefined) legacyProduct.costPrice = Number(costPrice);
                if (commissionRate !== undefined) legacyProduct.commissionRate = Number(commissionRate);
                if (shippingCost !== undefined) legacyProduct.shippingCost = Number(shippingCost);
                if (packagingCost !== undefined) legacyProduct.packagingCost = Number(packagingCost);
                if (otherCost !== undefined) legacyProduct.otherCost = Number(otherCost);
                await legacyProduct.save();
            }

            logger.info(`🤖 [AI Brain] Maliyet güncellendi: ${pm.masterProduct.name} — costPrice=${costPrice}`);
            return res.json({ success: true, message: `${pm.masterProduct.name} maliyet bilgisi güncellendi`, product: { name: pm.masterProduct.name, barcode, costPrice: pm.masterProduct.costPrice } });
        }

        // Fallback to legacy Product
        const product = await Product.findOne({ userId, barcode });
        if (!product) return res.status(404).json({ success: false, message: "Ürün bulunamadı" });

        if (costPrice !== undefined) product.costPrice = Number(costPrice);
        if (commissionRate !== undefined) product.commissionRate = Number(commissionRate);
        if (shippingCost !== undefined) product.shippingCost = Number(shippingCost);
        if (packagingCost !== undefined) product.packagingCost = Number(packagingCost);
        if (otherCost !== undefined) product.otherCost = Number(otherCost);
        await product.save();

        logger.info(`🤖 [AI Brain] Maliyet güncellendi (legacy): ${product.name} — costPrice=${costPrice}`);
        res.json({ success: true, message: `${product.name} maliyet bilgisi güncellendi`, product: { name: product.name, barcode, costPrice: product.costPrice } });
    } catch (err) {
        logger.error(`[AI Brain] updateProductCost error: ${err.message}`);
        res.status(500).json({ success: false, message: "Maliyet güncellenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /brain/bulk-update-cost — Bulk update product costs
// ═════════════════════════════════════════════════════════════════════════════
exports.bulkUpdateProductCost = async (req, res) => {
    try {
        const userId = uid(req);
        const { products } = req.body; // [{ barcode, costPrice, commissionRate, shippingCost, packagingCost }]
        if (!Array.isArray(products) || products.length === 0) return res.status(400).json({ success: false, message: "Ürün listesi zorunlu" });

        const ProductMapping = require("../models/ProductMapping");
        const Product = require("../models/Product");
        let updated = 0;
        let failed = 0;

        for (const p of products.slice(0, 100)) {
            try {
                const pm = await ProductMapping.findOne({ userId, "masterProduct.barcode": p.barcode });
                if (pm) {
                    if (p.costPrice !== undefined) pm.masterProduct.costPrice = Number(p.costPrice);
                    if (p.shippingCost !== undefined) pm.masterProduct.shippingCost = Number(p.shippingCost);
                    if (p.packagingCost !== undefined) pm.masterProduct.packagingCost = Number(p.packagingCost);
                    if (p.commissionRate !== undefined) {
                        pm.marketplaceMappings.forEach(m => { m.commissionRate = Number(p.commissionRate); });
                    }
                    pm.updatedAt = new Date();
                    await pm.save();
                    updated++;
                } else {
                    const product = await Product.findOne({ userId, barcode: p.barcode });
                    if (product) {
                        if (p.costPrice !== undefined) product.costPrice = Number(p.costPrice);
                        if (p.commissionRate !== undefined) product.commissionRate = Number(p.commissionRate);
                        if (p.shippingCost !== undefined) product.shippingCost = Number(p.shippingCost);
                        if (p.packagingCost !== undefined) product.packagingCost = Number(p.packagingCost);
                        await product.save();
                        updated++;
                    } else { failed++; }
                }
            } catch { failed++; }
        }

        logger.info(`🤖 [AI Brain] Toplu maliyet güncelleme: ${updated} başarılı, ${failed} başarısız`);
        res.json({ success: true, message: `${updated} ürün güncellendi`, updated, failed });
    } catch (err) {
        logger.error(`[AI Brain] bulkUpdateProductCost error: ${err.message}`);
        res.status(500).json({ success: false, message: "Toplu güncelleme başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain/products — Product list for simulation & cost entry
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainProducts = async (req, res) => {
    try {
        const userId = uid(req);
        const { search, limit = 50, noCostOnly } = req.query;
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);

        let filtered = analyzed;
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
        }
        if (noCostOnly === "true") {
            filtered = filtered.filter(p => p.costPrice === 0);
        }

        const products = filtered.slice(0, parseInt(limit)).map(p => ({
            name: p.name,
            barcode: p.barcode,
            category: p.category,
            price: p.price,
            costPrice: p.costPrice,
            commissionRate: p.commissionRate,
            shippingCost: p.shippingCost,
            stock: p.stock,
            profit: p.profit,
            profitMargin: p.profitMargin,
            totalSold: p.totalSold,
            avgDailySales: p.avgDailySales,
            healthScore: p.healthScore,
            daysOfStock: p.daysOfStock,
            hasCostData: p.costPrice > 0,
        }));

        const stats = {
            total: analyzed.length,
            withCost: analyzed.filter(p => p.costPrice > 0).length,
            withoutCost: analyzed.filter(p => p.costPrice === 0).length,
        };

        res.json({ success: true, products, stats, total: filtered.length });
    } catch (err) {
        logger.error(`[AI Brain] getBrainProducts error: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürünler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /dashboard — Combined endpoint (reduces API calls)
// ═════════════════════════════════════════════════════════════════════════════
exports.getFullDashboard = async (req, res) => {
    try {
        const userId = uid(req);
        const strategyMode = req.query.strategy || "balanced";

        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const score = AIEngine.calculateAIScore(analyzed, data);
        const report = AIEngine.generateDailyReport(analyzed, data, score);
        const strategy = AIEngine.detectOptimalStrategy(analyzed, data);
        const roi = AIEngine.calculateROI(data.pastRecs);
        const timing = AIEngine.analyzeTimingPatterns(data.orders90);
        const heatmap = AIEngine.buildProfitHeatmap(analyzed);
        const retro = AIEngine.retroAnalysis(analyzed, data);
        const learning = AIEngine.analyzeUserPreferences(data.pastRecs);
        const goals = AIEngine.updateGoalProgress(data.goals, data);

        // Generate & save recommendations in background
        const recs = AIEngine.generateRecommendations(analyzed, data, strategyMode);
        AIEngine.saveRecommendations(userId, recs, strategyMode).catch(e => logger.error(`[AI] bg save error: ${e.message}`));

        // Get ALL recommendations from DB (pending, approved, executed, rejected)
        const allRecs = await Recommendation.find({ userId, status: { $in: ["pending", "approved", "executed", "rejected"] } })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        allRecs.sort((a, b) => {
            const statusOrder = { pending: 0, approved: 1, executed: 2, rejected: 3 };
            const sd = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
            if (sd !== 0) return sd;
            return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        });

        const [pendingCount, executedCount, approvedCount, rejectedCount] = await Promise.all([
            Recommendation.countDocuments({ userId, status: "pending" }),
            Recommendation.countDocuments({ userId, status: "executed" }),
            Recommendation.countDocuments({ userId, status: "approved" }),
            Recommendation.countDocuments({ userId, status: "rejected" }),
        ]);

        // Product health segments
        const segments = {
            critical: analyzed.filter(p => p.healthScore < 30).length,
            warning: analyzed.filter(p => p.healthScore >= 30 && p.healthScore < 50).length,
            healthy: analyzed.filter(p => p.healthScore >= 50 && p.healthScore < 75).length,
            excellent: analyzed.filter(p => p.healthScore >= 75).length,
        };

        // Top/bottom products for health
        const sortedByHealth = [...analyzed].sort((a, b) => a.healthScore - b.healthScore);
        const worstProducts = sortedByHealth.slice(0, 10).map(p => ({
            name: p.name, barcode: p.barcode, category: p.category,
            healthScore: p.healthScore, profitMargin: p.profitMargin,
            stock: p.stock, totalSold: p.totalSold, daysOfStock: p.daysOfStock,
            daysSinceLastSale: p.daysSinceLastSale,
        }));
        const bestProducts = sortedByHealth.slice(-10).reverse().map(p => ({
            name: p.name, barcode: p.barcode, category: p.category,
            healthScore: p.healthScore, profitMargin: p.profitMargin,
            stock: p.stock, totalSold: p.totalSold, daysOfStock: p.daysOfStock,
        }));

        // Notifications
        const notifications = [];
        const outOfStock = analyzed.filter(p => p.stock === 0 || p.isOutOfStock);
        if (outOfStock.length > 0) {
            notifications.push({ type: "stock_alert", severity: "critical", icon: "🚨", title: "Stok Tükendi", message: `${outOfStock.length} ürün stokta yok`, count: outOfStock.length });
        }
        const lowStock = analyzed.filter(p => p.isLowStock || (p.stock > 0 && p.daysOfStock < 5 && p.avgDailySales > 0));
        if (lowStock.length > 0) {
            notifications.push({ type: "stock_warning", severity: "high", icon: "⚠️", title: "Düşük Stok", message: `${lowStock.length} ürünün stoğu kritik`, count: lowStock.length });
        }
        const lossProducts = analyzed.filter(p => p.profit < 0 && p.totalSold > 0);
        if (lossProducts.length > 0) {
            const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);
            notifications.push({ type: "profit_alert", severity: "critical", icon: "🔴", title: "Zarar Tespiti", message: `${lossProducts.length} ürün zararda — ${totalLoss.toFixed(0)}₺ kayıp`, count: lossProducts.length });
        }
        if (pendingCount > 5) {
            notifications.push({ type: "pending_actions", severity: "info", icon: "📋", title: "Bekleyen Öneriler", message: `${pendingCount} öneri onayınızı bekliyor`, count: pendingCount });
        }

        res.json({
            success: true,
            score,
            report,
            strategy,
            roi,
            timing,
            heatmap,
            retro,
            learning,
            goals,
            recommendations: allRecs,
            recSummary: { pending: pendingCount, executed: executedCount, approved: approvedCount, rejected: rejectedCount },
            productHealth: {
                segments,
                avgHealthScore: Math.round(analyzed.reduce((s, p) => s + p.healthScore, 0) / (analyzed.length || 1)),
                worstProducts,
                bestProducts,
            },
            notifications,
            productCount: analyzed.length,
        });
    } catch (err) {
        logger.error(`[AI] getFullDashboard error: ${err.message}`);
        res.status(500).json({ success: false, message: "Dashboard yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /recommendations
// ═════════════════════════════════════════════════════════════════════════════
exports.getRecommendations = async (req, res) => {
    try {
        const userId = uid(req);
        const { status, type, priority, limit = 50, page = 1 } = req.query;

        const filter = { userId };
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (priority) filter.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [recs, total] = await Promise.all([
            Recommendation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
            Recommendation.countDocuments(filter),
        ]);

        const [pendingCount, approvedCount, rejectedCount, executedCount] = await Promise.all([
            Recommendation.countDocuments({ userId, status: "pending" }),
            Recommendation.countDocuments({ userId, status: "approved" }),
            Recommendation.countDocuments({ userId, status: "rejected" }),
            Recommendation.countDocuments({ userId, status: "executed" }),
        ]);

        res.json({
            success: true,
            recommendations: recs,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
            summary: { pending: pendingCount, approved: approvedCount, rejected: rejectedCount, executed: executedCount },
        });
    } catch (err) {
        logger.error(`[AI] getRecommendations error: ${err.message}`);
        res.status(500).json({ success: false, message: "Öneriler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /recommendations/:id/approve
// ═════════════════════════════════════════════════════════════════════════════
exports.approveRecommendation = async (req, res) => {
    try {
        const userId = uid(req);
        const rec = await Recommendation.findOne({ _id: req.params.id, userId });
        if (!rec) return res.status(404).json({ success: false, message: "Öneri bulunamadı" });
        if (rec.status !== "pending") return res.status(400).json({ success: false, message: `Öneri zaten ${rec.status} durumunda` });

        rec.status = "approved";
        await rec.save();

        logger.info(`🤖 [AI] Öneri onaylandı: ${rec._id} — ${rec.title}`);
        res.json({ success: true, message: "Öneri onaylandı", recommendation: rec });
    } catch (err) {
        logger.error(`[AI] approveRecommendation error: ${err.message}`);
        res.status(500).json({ success: false, message: "Onaylama başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /recommendations/:id/reject
// ═════════════════════════════════════════════════════════════════════════════
exports.rejectRecommendation = async (req, res) => {
    try {
        const userId = uid(req);
        const rec = await Recommendation.findOne({ _id: req.params.id, userId });
        if (!rec) return res.status(404).json({ success: false, message: "Öneri bulunamadı" });
        if (rec.status !== "pending") return res.status(400).json({ success: false, message: `Öneri zaten ${rec.status} durumunda` });

        rec.status = "rejected";
        await rec.save();

        logger.info(`🤖 [AI] Öneri reddedildi: ${rec._id} — ${rec.title}`);
        res.json({ success: true, message: "Öneri reddedildi", recommendation: rec });
    } catch (err) {
        logger.error(`[AI] rejectRecommendation error: ${err.message}`);
        res.status(500).json({ success: false, message: "Reddetme başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /recommendations/:id/execute
// ═════════════════════════════════════════════════════════════════════════════
exports.executeRecommendation = async (req, res) => {
    try {
        const userId = uid(req);
        const { recommendation, result } = await AIEngine.executeRecommendation(req.params.id, userId);
        res.json({ success: result.success, message: result.message, recommendation, result });
    } catch (err) {
        logger.error(`[AI] executeRecommendation error: ${err.message}`);
        res.status(400).json({ success: false, message: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /recommendations/generate
// ═════════════════════════════════════════════════════════════════════════════
exports.generateRecommendations = async (req, res) => {
    try {
        const userId = uid(req);
        const strategyMode = req.body.strategyMode || "balanced";

        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const recs = AIEngine.generateRecommendations(analyzed, data, strategyMode);
        const savedCount = await AIEngine.saveRecommendations(userId, recs, strategyMode);

        res.json({ success: true, message: `${savedCount} yeni öneri oluşturuldu`, generated: recs.length, saved: savedCount });
    } catch (err) {
        logger.error(`[AI] generateRecommendations error: ${err.message}`);
        res.status(500).json({ success: false, message: "Öneri oluşturulamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /ai-score
// ═════════════════════════════════════════════════════════════════════════════
exports.getAIScore = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const score = AIEngine.calculateAIScore(analyzed, data);
        res.json({ success: true, score });
    } catch (err) {
        logger.error(`[AI] getAIScore error: ${err.message}`);
        res.status(500).json({ success: false, message: "Skor hesaplanamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /daily-report
// ═════════════════════════════════════════════════════════════════════════════
exports.getDailyReport = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const score = AIEngine.calculateAIScore(analyzed, data);
        const report = AIEngine.generateDailyReport(analyzed, data, score);
        res.json({ success: true, report });
    } catch (err) {
        logger.error(`[AI] getDailyReport error: ${err.message}`);
        res.status(500).json({ success: false, message: "Rapor oluşturulamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /daily-actions
// ═════════════════════════════════════════════════════════════════════════════
exports.getDailyActions = async (req, res) => {
    try {
        const userId = uid(req);
        const recs = await Recommendation.find({ userId, status: "pending" })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        recs.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

        res.json({
            success: true,
            actions: recs.slice(0, 5),
            totalPending: await Recommendation.countDocuments({ userId, status: "pending" }),
        });
    } catch (err) {
        logger.error(`[AI] getDailyActions error: ${err.message}`);
        res.status(500).json({ success: false, message: "Aksiyonlar yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /strategy
// ═════════════════════════════════════════════════════════════════════════════
exports.getStrategy = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const strategy = AIEngine.detectOptimalStrategy(analyzed, data);
        res.json({ success: true, strategy });
    } catch (err) {
        logger.error(`[AI] getStrategy error: ${err.message}`);
        res.status(500).json({ success: false, message: "Strateji analizi başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /simulate
// ═════════════════════════════════════════════════════════════════════════════
exports.simulate = async (req, res) => {
    try {
        const userId = uid(req);
        const { barcode, priceChangePct, stockChange, campaignDiscountPct } = req.body;
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const result = AIEngine.simulate(analyzed, { barcode, priceChangePct, stockChange, campaignDiscountPct });
        if (result.error) return res.status(400).json({ success: false, message: result.error });
        res.json({ success: true, simulation: result });
    } catch (err) {
        logger.error(`[AI] simulate error: ${err.message}`);
        res.status(500).json({ success: false, message: "Simülasyon başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /simulate-advanced
// ═════════════════════════════════════════════════════════════════════════════
exports.simulateAdvanced = async (req, res) => {
    try {
        const userId = uid(req);
        const { scenarios } = req.body;
        if (!Array.isArray(scenarios) || scenarios.length === 0) {
            return res.status(400).json({ success: false, message: "En az bir senaryo gerekli" });
        }

        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);

        const results = scenarios.map((s, i) => ({
            scenarioIndex: i + 1, params: s,
            result: AIEngine.simulate(analyzed, s),
        }));

        const comparison = results.map(r => ({
            scenario: r.scenarioIndex,
            totalProfitChange: r.result.summary?.totalProfitChange || 0,
            totalRevenueChange: r.result.summary?.totalRevenueChange || 0,
            risk: r.result.summary?.overallRisk || "unknown",
        }));

        const bestScenario = comparison.reduce((best, c) =>
            c.totalProfitChange > (best?.totalProfitChange || -Infinity) ? c : best, null);

        res.json({ success: true, scenarios: results, comparison, bestScenario });
    } catch (err) {
        logger.error(`[AI] simulateAdvanced error: ${err.message}`);
        res.status(500).json({ success: false, message: "Gelişmiş simülasyon başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /profit-heatmap
// ═════════════════════════════════════════════════════════════════════════════
exports.getProfitHeatmap = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const heatmap = AIEngine.buildProfitHeatmap(analyzed);
        res.json({ success: true, heatmap });
    } catch (err) {
        logger.error(`[AI] getProfitHeatmap error: ${err.message}`);
        res.status(500).json({ success: false, message: "Heatmap oluşturulamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /timing
// ═════════════════════════════════════════════════════════════════════════════
exports.getTiming = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const timing = AIEngine.analyzeTimingPatterns(data.orders90);
        res.json({ success: true, timing });
    } catch (err) {
        logger.error(`[AI] getTiming error: ${err.message}`);
        res.status(500).json({ success: false, message: "Zamanlama analizi başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /retro
// ═════════════════════════════════════════════════════════════════════════════
exports.getRetro = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);
        const retro = AIEngine.retroAnalysis(analyzed, data);
        res.json({ success: true, retro });
    } catch (err) {
        logger.error(`[AI] getRetro error: ${err.message}`);
        res.status(500).json({ success: false, message: "Retro analiz başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /roi
// ═════════════════════════════════════════════════════════════════════════════
exports.getROI = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const roi = AIEngine.calculateROI(data.pastRecs);
        res.json({ success: true, roi });
    } catch (err) {
        logger.error(`[AI] getROI error: ${err.message}`);
        res.status(500).json({ success: false, message: "ROI hesaplanamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /product-health
// ═════════════════════════════════════════════════════════════════════════════
exports.getProductHealth = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);

        const sorted = [...analyzed].sort((a, b) => a.healthScore - b.healthScore);
        const segments = {
            critical: sorted.filter(p => p.healthScore < 30),
            warning: sorted.filter(p => p.healthScore >= 30 && p.healthScore < 50),
            healthy: sorted.filter(p => p.healthScore >= 50 && p.healthScore < 75),
            excellent: sorted.filter(p => p.healthScore >= 75),
        };

        res.json({
            success: true,
            products: sorted.map(p => ({
                name: p.name, barcode: p.barcode, category: p.category,
                healthScore: p.healthScore, profitMargin: p.profitMargin,
                stock: p.stock, daysOfStock: p.daysOfStock,
                totalSold: p.totalSold, avgDailySales: p.avgDailySales,
                daysSinceLastSale: p.daysSinceLastSale, returnRate: p.returnRate,
            })),
            segments: {
                critical: segments.critical.length,
                warning: segments.warning.length,
                healthy: segments.healthy.length,
                excellent: segments.excellent.length,
            },
            avgHealthScore: Math.round(analyzed.reduce((s, p) => s + p.healthScore, 0) / (analyzed.length || 1)),
        });
    } catch (err) {
        logger.error(`[AI] getProductHealth error: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürün sağlığı hesaplanamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /learning
// ═════════════════════════════════════════════════════════════════════════════
exports.getLearning = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const learning = AIEngine.analyzeUserPreferences(data.pastRecs);
        res.json({ success: true, learning });
    } catch (err) {
        logger.error(`[AI] getLearning error: ${err.message}`);
        res.status(500).json({ success: false, message: "Öğrenme verisi yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /goals
// ═════════════════════════════════════════════════════════════════════════════
exports.createGoal = async (req, res) => {
    try {
        const userId = uid(req);
        const { title, goalType, targetValue, period, endDate, description, unit } = req.body;

        if (!title || !goalType || !targetValue || !endDate) {
            return res.status(400).json({ success: false, message: "title, goalType, targetValue ve endDate zorunlu" });
        }

        const daysLeft = Math.max(1, Math.ceil((new Date(endDate) - Date.now()) / (24 * 60 * 60 * 1000)));
        const dailyTarget = targetValue / daysLeft;

        const goal = await AIGoal.create({
            userId, title,
            description: description || "",
            goalType, targetValue,
            unit: unit || (goalType === "sales" ? "adet" : "TL"),
            period: period || "monthly",
            endDate: new Date(endDate),
            dailyTarget: Math.round(dailyTarget * 100) / 100,
        });

        res.status(201).json({ success: true, message: "Hedef oluşturuldu", goal });
    } catch (err) {
        logger.error(`[AI] createGoal error: ${err.message}`);
        res.status(500).json({ success: false, message: "Hedef oluşturulamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /goals
// ═════════════════════════════════════════════════════════════════════════════
exports.getGoals = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const updatedGoals = AIEngine.updateGoalProgress(data.goals, data);

        for (const g of updatedGoals) {
            await AIGoal.findByIdAndUpdate(g._id, {
                currentValue: g.currentValue,
                progressPercent: g.progressPercent,
                dailyTarget: g.dailyTarget,
                status: g.status,
            });
        }

        res.json({ success: true, goals: updatedGoals });
    } catch (err) {
        logger.error(`[AI] getGoals error: ${err.message}`);
        res.status(500).json({ success: false, message: "Hedefler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /recommendations/bulk-approve — Bulk approve recommendations
// ═════════════════════════════════════════════════════════════════════════════
exports.bulkApproveRecommendations = async (req, res) => {
    try {
        const userId = uid(req);
        const { ids } = req.body; // array of recommendation IDs
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Öneri ID listesi zorunlu" });
        }

        const result = await Recommendation.updateMany(
            { _id: { $in: ids }, userId, status: "pending" },
            { $set: { status: "approved" } }
        );

        logger.info(`🤖 [AI] Toplu onay: ${result.modifiedCount} öneri onaylandı (userId: ${userId})`);
        res.json({ success: true, message: `${result.modifiedCount} öneri onaylandı`, approved: result.modifiedCount });
    } catch (err) {
        logger.error(`[AI] bulkApproveRecommendations error: ${err.message}`);
        res.status(500).json({ success: false, message: "Toplu onay başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /recommendations/bulk-reject — Bulk reject recommendations
// ═════════════════════════════════════════════════════════════════════════════
exports.bulkRejectRecommendations = async (req, res) => {
    try {
        const userId = uid(req);
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Öneri ID listesi zorunlu" });
        }

        const result = await Recommendation.updateMany(
            { _id: { $in: ids }, userId, status: "pending" },
            { $set: { status: "rejected" } }
        );

        logger.info(`🤖 [AI] Toplu red: ${result.modifiedCount} öneri reddedildi (userId: ${userId})`);
        res.json({ success: true, message: `${result.modifiedCount} öneri reddedildi`, rejected: result.modifiedCount });
    } catch (err) {
        logger.error(`[AI] bulkRejectRecommendations error: ${err.message}`);
        res.status(500).json({ success: false, message: "Toplu red başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /simulate/apply — Actually apply simulation prices (Bug #1 fix)
// ═════════════════════════════════════════════════════════════════════════════
exports.applySimulation = async (req, res) => {
    try {
        const userId = uid(req);
        const { products } = req.body; // [{ barcode, newPrice, oldPrice }]
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "Ürün listesi zorunlu" });
        }

        const ProductMapping = require("../models/ProductMapping");
        const Product = require("../models/Product");
        let applied = 0;
        let failed = 0;
        const results = [];

        for (const p of products.slice(0, 50)) {
            if (!p.barcode || !p.newPrice || p.newPrice === p.oldPrice) {
                continue;
            }
            try {
                const pm = await ProductMapping.findOne({ userId, "masterProduct.barcode": p.barcode });
                if (pm) {
                    const oldPrice = pm.masterProduct.price;
                    pm.masterProduct.price = Number(p.newPrice);
                    pm.updatedAt = new Date();
                    pm.addSyncLog("price_update", "AI Simulation", oldPrice, Number(p.newPrice), "success",
                        `Simülasyon uygulandı: ${oldPrice}₺ → ${p.newPrice}₺`);
                    await pm.save();
                    applied++;
                    results.push({ barcode: p.barcode, name: pm.masterProduct.name, oldPrice, newPrice: Number(p.newPrice), success: true });
                } else {
                    const product = await Product.findOne({ userId, barcode: p.barcode });
                    if (product) {
                        const oldPrice = product.salePrice || product.price;
                        product.salePrice = Number(p.newPrice);
                        product.price = Number(p.newPrice);
                        await product.save();
                        applied++;
                        results.push({ barcode: p.barcode, name: product.name, oldPrice, newPrice: Number(p.newPrice), success: true });
                    } else {
                        failed++;
                        results.push({ barcode: p.barcode, success: false, error: "Ürün bulunamadı" });
                    }
                }
            } catch (err) {
                failed++;
                results.push({ barcode: p.barcode, success: false, error: err.message });
            }
        }

        logger.info(`🤖 [AI] Simülasyon uygulandı: ${applied} başarılı, ${failed} başarısız (userId: ${userId})`);

        // Force re-analyze after price changes
        if (aiWorker && applied > 0) {
            aiWorker.forceAnalyzeUser(userId).catch(e =>
                logger.warn(`[AI] Post-simulation re-analysis failed: ${e.message}`)
            );
        }

        res.json({
            success: true,
            message: `${applied} ürünün fiyatı güncellendi${failed > 0 ? `, ${failed} başarısız` : ""}`,
            applied,
            failed,
            results,
        });
    } catch (err) {
        logger.error(`[AI] applySimulation error: ${err.message}`);
        res.status(500).json({ success: false, message: "Simülasyon uygulama başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /worker-status — AI Background Worker status
// ═════════════════════════════════════════════════════════════════════════════
exports.getWorkerStatus = async (req, res) => {
    try {
        if (!aiWorker) {
            return res.json({ success: true, status: { isActive: false, message: "Worker not loaded" } });
        }
        const status = aiWorker.getWorkerStatus();
        res.json({ success: true, status });
    } catch (err) {
        logger.error(`[AI] getWorkerStatus error: ${err.message}`);
        res.status(500).json({ success: false, message: "Worker durumu alınamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /notifications
// ═════════════════════════════════════════════════════════════════════════════
exports.getNotifications = async (req, res) => {
    try {
        const userId = uid(req);
        const data = await AIEngine.collectData(userId);
        const analyzed = AIEngine.analyzeProducts(data.products, data.orders90);

        const notifications = [];

        const outOfStock = analyzed.filter(p => p.stock === 0 || p.isOutOfStock);
        if (outOfStock.length > 0) {
            notifications.push({ type: "stock_alert", severity: "critical", icon: "🚨", title: "Stok Tükendi", message: `${outOfStock.length} ürün stokta yok`, count: outOfStock.length, timestamp: new Date() });
        }

        const lowStock = analyzed.filter(p => p.isLowStock || (p.stock > 0 && p.daysOfStock < 5 && p.avgDailySales > 0));
        if (lowStock.length > 0) {
            notifications.push({ type: "stock_warning", severity: "high", icon: "⚠️", title: "Düşük Stok", message: `${lowStock.length} ürünün stoğu kritik`, count: lowStock.length, timestamp: new Date() });
        }

        const lossProducts = analyzed.filter(p => p.profit < 0 && p.totalSold > 0);
        if (lossProducts.length > 0) {
            const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);
            notifications.push({ type: "profit_alert", severity: "critical", icon: "🔴", title: "Zarar Tespiti", message: `${lossProducts.length} ürün zararda — ${totalLoss.toFixed(0)}₺ kayıp`, count: lossProducts.length, timestamp: new Date() });
        }

        const { ordersToday, orders30 } = data;
        const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const avgDailyRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0) / 30;
        if (todayRevenue > avgDailyRevenue * 1.5 && todayRevenue > 0) {
            notifications.push({ type: "sales_spike", severity: "info", icon: "🎉", title: "Satış Artışı", message: `Bugün satışlar ortalamanın %${Math.round(((todayRevenue - avgDailyRevenue) / avgDailyRevenue) * 100)} üstünde!`, timestamp: new Date() });
        }

        const pendingCount = await Recommendation.countDocuments({ userId, status: "pending" });
        if (pendingCount > 0) {
            notifications.push({ type: "pending_actions", severity: "info", icon: "📋", title: "Bekleyen Öneriler", message: `${pendingCount} öneri onayınızı bekliyor`, count: pendingCount, timestamp: new Date() });
        }

        notifications.sort((a, b) => {
            const sev = { critical: 0, high: 1, medium: 2, info: 3, low: 4 };
            return (sev[a.severity] || 4) - (sev[b.severity] || 4);
        });

        res.json({ success: true, notifications });
    } catch (err) {
        logger.error(`[AI] getNotifications error: ${err.message}`);
        res.status(500).json({ success: false, message: "Bildirimler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// AI PRODUCT ADVISOR — LysiaBrain Endpoints
// ═════════════════════════════════════════════════════════════════════════════

// GET /advisor/products — Tüm ürünlerin danışman analizi
exports.getAdvisorProducts = async (req, res) => {
    try {
        const userId = uid(req);
        const { status, limit = 50, search } = req.query;

        const AIOperator = require("../services/aiOperatorEngine");
        const observation = await AIOperator.observe(userId);
        const { products: advisorResults, summary } = AIAdvisor.analyzeAllProducts(observation.analyzedProducts, observation);

        let filtered = advisorResults;
        if (status && status !== "all") {
            filtered = filtered.filter(p => p.status === status);
        }
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
        }

        res.json({
            success: true,
            products: filtered.slice(0, parseInt(limit)),
            summary,
            total: filtered.length,
        });
    } catch (err) {
        logger.error(`[AI Advisor] getAdvisorProducts error: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürün danışmanı yüklenemedi", error: err.message });
    }
};

// GET /advisor/product/:barcode — Tek ürün detaylı analiz
exports.getAdvisorProduct = async (req, res) => {
    try {
        const userId = uid(req);
        const { barcode } = req.params;

        const AIOperator = require("../services/aiOperatorEngine");
        const observation = await AIOperator.observe(userId);
        const product = observation.analyzedProducts.find(p => p.barcode === barcode);

        if (!product) {
            return res.status(404).json({ success: false, message: "Ürün bulunamadı" });
        }

        const diagnosis = AIAdvisor.analyzeProduct(product, observation.analyzedProducts, observation);

        res.json({ success: true, diagnosis });
    } catch (err) {
        logger.error(`[AI Advisor] getAdvisorProduct error: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürün analizi yüklenemedi", error: err.message });
    }
};

// GET /advisor/mistakes — Kullanıcı hata tespiti
exports.getAdvisorMistakes = async (req, res) => {
    try {
        const userId = uid(req);

        const AIOperator = require("../services/aiOperatorEngine");
        const observation = await AIOperator.observe(userId);
        const mistakes = AIAdvisor.detectMistakes(observation.analyzedProducts, observation);

        res.json({ success: true, mistakes });
    } catch (err) {
        logger.error(`[AI Advisor] getAdvisorMistakes error: ${err.message}`);
        res.status(500).json({ success: false, message: "Hata tespiti yüklenemedi", error: err.message });
    }
};

// GET /advisor/platforms — Platform karşılaştırma
exports.getAdvisorPlatforms = async (req, res) => {
    try {
        const userId = uid(req);

        const AIOperator = require("../services/aiOperatorEngine");
        const observation = await AIOperator.observe(userId);
        const platformAnalysis = AIAdvisor.analyzePlatforms(observation.analyzedProducts, observation);

        res.json({ success: true, ...platformAnalysis });
    } catch (err) {
        logger.error(`[AI Advisor] getAdvisorPlatforms error: ${err.message}`);
        res.status(500).json({ success: false, message: "Platform analizi yüklenemedi", error: err.message });
    }
};
