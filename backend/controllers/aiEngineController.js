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
const Recommendation = require("../models/Recommendation");
const AIGoal = require("../models/AIGoal");
const logger = require("../config/logger");

const uid = (req) => req.user?._id || req.user?.id;

// ═════════════════════════════════════════════════════════════════════════════
// GET /brain — Full AI Operations Brain Dashboard (all 50 engines)
// ═════════════════════════════════════════════════════════════════════════════
exports.getBrainDashboard = async (req, res) => {
    try {
        const userId = uid(req);
        const strategyMode = req.query.strategy || "balanced";
        const result = await AIBrain.getFullBrainDashboard(userId, AIEngine, strategyMode);
        res.json(result);
    } catch (err) {
        logger.error(`[AI Brain] getBrainDashboard error: ${err.message}`);
        res.status(500).json({ success: false, message: "AI Brain yüklenemedi", error: err.message });
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

        // Get pending recommendations from DB
        const pendingRecs = await Recommendation.find({ userId, status: "pending" })
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        pendingRecs.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

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
            recommendations: pendingRecs,
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
