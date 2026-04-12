/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR CONTROLLER — LysiaRadar PRO API Endpoints
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Endpoints:
 *   GET  /opportunities          — Kullanıcıya özel fırsatları getir
 *   POST /opportunities/refresh  — Fırsatları yeniden analiz et
 *   POST /opportunities/:id/action — Fırsat aksiyonu kaydet
 *   GET  /opportunities/:id      — Tek fırsat detayı
 *   GET  /stats                  — Radar istatistikleri
 *   POST /simulate               — Fırsat simülasyonu
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const opportunityEngine = require("../services/radar/opportunityEngine");
const OpportunityResult = require("../models/OpportunityResult");
const logger = require("../config/logger");

const uid = (req) => req.user?._id || req.user?.id;

// ═════════════════════════════════════════════════════════════════════════════
// GET /opportunities — Kullanıcıya özel fırsatları getir
// ═════════════════════════════════════════════════════════════════════════════
exports.getOpportunities = async (req, res) => {
    try {
        const userId = uid(req);
        const { category, minScore, sortBy, expansionType } = req.query;

        // Önce cache'den dene
        let opportunities = await opportunityEngine.getOpportunities(userId, {
            category, minScore, sortBy, expansionType,
        });

        // Cache boşsa ve hiç fırsat yoksa, ilk kez analiz başlat
        if (opportunities.length === 0) {
            const freshCheck = await OpportunityResult.countDocuments({ userId });
            if (freshCheck === 0) {
                // İlk kullanım — arka planda analiz başlat, boş dön
                // (Frontend polling yapacak)
                opportunityEngine.analyzeOpportunities(userId).catch(err => {
                    logger.warn(`[Radar] Arka plan analiz hatası: ${err.message}`);
                });

                return res.json({
                    success: true,
                    data: {
                        opportunities: [],
                        stats: { total: 0, analyzing: true },
                        message: "İlk analiz başlatıldı, birkaç dakika içinde fırsatlar hazır olacak.",
                    },
                });
            }
        }

        res.json({
            success: true,
            data: {
                opportunities,
                stats: {
                    total: opportunities.length,
                    analyzing: false,
                },
            },
        });
    } catch (err) {
        logger.error(`[Radar] getOpportunities hatası: ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Fırsatlar yüklenemedi",
            error: err.message,
        });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /opportunities/refresh — Fırsatları yeniden analiz et
// ═════════════════════════════════════════════════════════════════════════════
exports.refreshOpportunities = async (req, res) => {
    try {
        const userId = uid(req);

        // Arka planda analiz başlat
        const resultPromise = opportunityEngine.analyzeOpportunities(userId, { forceRefresh: true });

        // 30 saniye timeout ile bekle, aşarsa arka planda devam etsin
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve({ timeout: true }), 30000);
        });

        const result = await Promise.race([resultPromise, timeoutPromise]);

        if (result.timeout) {
            // Analiz devam ediyor
            return res.json({
                success: true,
                data: {
                    opportunities: [],
                    stats: { total: 0, analyzing: true },
                    message: "Analiz devam ediyor, birkaç dakika içinde tamamlanacak.",
                },
            });
        }

        res.json({
            success: true,
            data: {
                opportunities: result.opportunities || [],
                stats: result.stats || {},
                fromCache: false,
            },
        });
    } catch (err) {
        logger.error(`[Radar] refreshOpportunities hatası: ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Fırsat analizi başlatılamadı",
            error: err.message,
        });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /opportunities/:id/action — Fırsat aksiyonu kaydet
// ═════════════════════════════════════════════════════════════════════════════
exports.recordAction = async (req, res) => {
    try {
        const userId = uid(req);
        const { id } = req.params;
        const { action } = req.body;

        if (!action) {
            return res.status(400).json({ success: false, message: "action parametresi gerekli" });
        }

        const result = await opportunityEngine.recordAction(userId, id, action);

        if (!result) {
            return res.status(404).json({ success: false, message: "Fırsat bulunamadı" });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        logger.error(`[Radar] recordAction hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Aksiyon kaydedilemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /opportunities/:id — Tek fırsat detayı
// ═════════════════════════════════════════════════════════════════════════════
exports.getOpportunityDetail = async (req, res) => {
    try {
        const userId = uid(req);
        const { id } = req.params;

        const opportunity = await OpportunityResult.findOne({ _id: id, userId }).lean();

        if (!opportunity) {
            return res.status(404).json({ success: false, message: "Fırsat bulunamadı" });
        }

        // Görüntüleme aksiyonu kaydet
        await opportunityEngine.recordAction(userId, id, "viewed");

        res.json({ success: true, data: opportunity });
    } catch (err) {
        logger.error(`[Radar] getOpportunityDetail hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Fırsat detayı yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /stats — Radar istatistikleri
// ═════════════════════════════════════════════════════════════════════════════
exports.getStats = async (req, res) => {
    try {
        const userId = uid(req);

        const mongoose = require("mongoose");
        const userOid = new mongoose.Types.ObjectId(userId);

        const [
            totalActive,
            totalDismissed,
            totalActed,
            avgScore,
            topCategory,
        ] = await Promise.all([
            OpportunityResult.countDocuments({ userId, status: "active" }),
            OpportunityResult.countDocuments({ userId, status: "dismissed" }),
            OpportunityResult.countDocuments({ userId, status: "acted" }),
            OpportunityResult.aggregate([
                { $match: { userId: userOid, status: "active" } },
                { $group: { _id: null, avg: { $avg: "$totalScore" } } },
            ]).then(r => r[0]?.avg || 0),
            OpportunityResult.aggregate([
                { $match: { userId: userOid, status: "active" } },
                { $group: { _id: "$category", count: { $sum: 1 }, avgScore: { $avg: "$totalScore" } } },
                { $sort: { avgScore: -1 } },
                { $limit: 5 },
            ]),
        ]);

        const lastAnalysis = await OpportunityResult.findOne({ userId, status: "active" })
            .sort({ dataFreshness: -1 })
            .select("dataFreshness")
            .lean();

        res.json({
            success: true,
            data: {
                totalActive,
                totalDismissed,
                totalActed,
                avgScore: Math.round(avgScore),
                topCategories: topCategory,
                lastAnalysis: lastAnalysis?.dataFreshness || null,
            },
        });
    } catch (err) {
        logger.error(`[Radar] getStats hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "İstatistikler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /simulate — Fırsat simülasyonu
// ═════════════════════════════════════════════════════════════════════════════
exports.simulate = async (req, res) => {
    try {
        const { opportunityId, investmentAmount, targetPrice, estimatedMonthlySales } = req.body;
        const userId = uid(req);

        const opportunity = await OpportunityResult.findOne({ _id: opportunityId, userId }).lean();
        if (!opportunity) {
            return res.status(404).json({ success: false, message: "Fırsat bulunamadı" });
        }

        // Simülasyon hesapla
        const price = targetPrice || opportunity.profitAnalysis?.suggestedPrice || opportunity.marketData?.avgPrice || 100;
        const monthlySales = estimatedMonthlySales || Math.max(1, Math.round((opportunity.marketData?.estimatedMonthlySales || 10) * 0.02));
        const cost = opportunity.profitAnalysis?.estimatedCost || Math.round(price * 0.45);
        const commission = price * ((opportunity.profitAnalysis?.commissionRate || 18) / 100);
        const shipping = price > 200 ? 15 : 10;
        const netProfitPerUnit = price - cost - commission - shipping;
        const monthlyRevenue = price * monthlySales;
        const monthlyProfit = netProfitPerUnit * monthlySales;
        const investment = investmentAmount || cost * monthlySales;
        const roi = investment > 0 ? ((monthlyProfit / investment) * 100) : 0;
        const breakEvenUnits = netProfitPerUnit > 0 ? Math.ceil(investment / netProfitPerUnit) : 0;
        const breakEvenMonths = monthlySales > 0 && netProfitPerUnit > 0
            ? Math.ceil(breakEvenUnits / monthlySales)
            : 0;

        // Aksiyon kaydet
        await opportunityEngine.recordAction(userId, opportunityId, "simulated");

        res.json({
            success: true,
            data: {
                keyword: opportunity.keyword,
                category: opportunity.category,
                simulation: {
                    price,
                    cost,
                    commission: Math.round(commission),
                    shipping,
                    netProfitPerUnit: Math.round(netProfitPerUnit),
                    monthlySales,
                    monthlyRevenue: Math.round(monthlyRevenue),
                    monthlyProfit: Math.round(monthlyProfit),
                    yearlyProfit: Math.round(monthlyProfit * 12),
                    investment: Math.round(investment),
                    roi: Math.round(roi * 10) / 10,
                    breakEvenUnits,
                    breakEvenMonths,
                    profitMargin: price > 0 ? Math.round((netProfitPerUnit / price) * 1000) / 10 : 0,
                },
            },
        });
    } catch (err) {
        logger.error(`[Radar] simulate hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Simülasyon yapılamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /products — Ürün bazlı fırsatlar (sample products from opportunities)
// ═════════════════════════════════════════════════════════════════════════════
exports.getProductOpportunities = async (req, res) => {
    try {
        const userId = uid(req);
        const { minScore, sortBy, limit } = req.query;

        // Aktif fırsatları çek
        const query = { userId, status: "active" };
        if (minScore) {
            query.totalScore = { $gte: parseInt(minScore) };
        }

        const opportunities = await OpportunityResult.find(query)
            .sort({ totalScore: -1 })
            .limit(parseInt(limit) || 50)
            .lean();

        // Her fırsattan sample products'ları çıkar ve düzleştir
        const products = [];
        for (const opp of opportunities) {
            if (!opp.marketData?.sampleProducts || opp.marketData.sampleProducts.length === 0) continue;

            for (const product of opp.marketData.sampleProducts) {
                // Ürün için kâr analizi hesapla
                const price = product.price || 0;
                const cost = Math.round(price * 0.45);
                const commission = price * 0.18;
                const shipping = price > 200 ? 15 : 10;
                const netProfit = price - cost - commission - shipping;
                const profitMargin = price > 0 ? ((netProfit / price) * 100) : 0;

                products.push({
                    // Ürün bilgileri
                    name: product.name,
                    price: product.price,
                    rating: product.rating,
                    reviewCount: product.reviewCount,
                    seller: product.seller,
                    imageUrl: product.imageUrl,
                    url: product.url,

                    // Fırsat bilgileri
                    keyword: opp.keyword,
                    category: opp.category,
                    opportunityScore: opp.totalScore,
                    trendScore: opp.scores?.trend || 0,
                    demandScore: opp.scores?.demand || 0,
                    competitionScore: opp.scores?.competition || 0,
                    profitScore: opp.scores?.profit || 0,

                    // Kâr analizi
                    estimatedCost: cost,
                    estimatedProfit: Math.round(netProfit),
                    profitMargin: Math.round(profitMargin * 10) / 10,

                    // Meta
                    opportunityId: opp._id,
                    expansionType: opp.expansionType,
                    trendDirection: opp.trendData?.trendDirection,
                });
            }
        }

        // Sıralama
        let sortedProducts = products;
        if (sortBy === "profit") {
            sortedProducts = products.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
        } else if (sortBy === "score") {
            sortedProducts = products.sort((a, b) => b.opportunityScore - a.opportunityScore);
        } else if (sortBy === "price") {
            sortedProducts = products.sort((a, b) => a.price - b.price);
        } else if (sortBy === "rating") {
            sortedProducts = products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else {
            // Default: opportunity score
            sortedProducts = products.sort((a, b) => b.opportunityScore - a.opportunityScore);
        }

        res.json({
            success: true,
            data: {
                products: sortedProducts.slice(0, parseInt(limit) || 50),
                stats: {
                    total: sortedProducts.length,
                    avgScore: products.length > 0
                        ? Math.round(products.reduce((s, p) => s + p.opportunityScore, 0) / products.length)
                        : 0,
                    avgProfit: products.length > 0
                        ? Math.round(products.reduce((s, p) => s + p.estimatedProfit, 0) / products.length)
                        : 0,
                },
            },
        });
    } catch (err) {
        logger.error(`[Radar] getProductOpportunities hatası: ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Ürün fırsatları yüklenemedi",
            error: err.message,
        });
    }
};
