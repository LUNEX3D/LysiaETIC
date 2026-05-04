/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR CONTROLLER — LysiaRadar PRO v2 API Endpoints (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mevcut Endpoints:
 *   GET  /opportunities              — Kullanıcıya özel fırsatları getir
 *   POST /opportunities/refresh      — Fırsatları yeniden analiz et
 *   POST /opportunities/:id/action   — Fırsat aksiyonu kaydet
 *   GET  /opportunities/:id          — Tek fırsat detayı
 *   GET  /stats                      — Radar istatistikleri
 *   POST /simulate                   — Fırsat simülasyonu
 *   GET  /products                   — Ürün bazlı fırsatlar
 *
 * YENİ Endpoints:
 *   GET  /trends/google              — Google Trends yükselen aramalar
 *   GET  /trends/social/:keyword     — Sosyal medya trend verisi
 *   GET  /arbitrage                  — Arbitraj fırsatları
 *   GET  /keywords/trending          — Yükselen keyword'ler (tüm kaynaklar)
 *   GET  /data-sources               — Veri kaynağı durumu
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const opportunityEngine = require("../services/radar/opportunityEngine");
const OpportunityResult = require("../models/OpportunityResult");
const TrendSignal = require("../models/TrendSignal");
const googleTrendsService = require("../services/radar/googleTrendsService");
const socialService = require("../services/radar/socialService");
const { getRadarWorkerStatus } = require("../services/radar/radarWorker");
const { hasSerpKey } = require("../services/radar/serpApiClient");
const logger = require("../config/logger");

const uid = (req) => req.user?._id || req.user?.id;

// ═════════════════════════════════════════════════════════════════════════════
// GET /opportunities — Kullanıcıya özel fırsatları getir
// ═════════════════════════════════════════════════════════════════════════════
exports.getOpportunities = async (req, res) => {
    try {
        const userId = uid(req);
        const { category, minScore, sortBy, expansionType, source } = req.query;

        let opportunities = await opportunityEngine.getOpportunities(userId, {
            category, minScore, sortBy, expansionType, source,
        });

        const ttlMs = opportunityEngine.CACHE_TTL_MS || 6 * 60 * 60 * 1000;
        let meta = {
            cacheTtlMs: ttlMs,
            newestFreshness: null,
            oldestFreshness: null,
            isStale: false,
            serpConfigured: hasSerpKey(),
        };
        if (opportunities.length > 0) {
            const times = opportunities
                .map((o) => new Date(o.dataFreshness || o.updatedAt || 0).getTime())
                .filter((t) => t > 0);
            if (times.length) {
                const newest = Math.max(...times);
                const oldest = Math.min(...times);
                meta.newestFreshness = new Date(newest).toISOString();
                meta.oldestFreshness = new Date(oldest).toISOString();
                meta.isStale = Date.now() - newest > ttlMs;
            }
        }

        // Cache boşsa ve hiç fırsat yoksa, ilk kez analiz başlat
        if (opportunities.length === 0) {
            const freshCheck = await OpportunityResult.countDocuments({ userId });
            if (freshCheck === 0) {
                opportunityEngine.analyzeOpportunities(userId).catch(err => {
                    logger.warn(`[Radar] Arka plan analiz hatası: ${err.message}`);
                });

                return res.json({
                    success: true,
                    data: {
                        opportunities: [],
                        stats: { total: 0, analyzing: true },
                        meta,
                        message: "İlk analiz başlatıldı, birkaç dakika içinde fırsatlar hazır olacak.",
                    },
                });
            }
        }

        res.json({
            success: true,
            data: {
                opportunities,
                meta,
                stats: {
                    total: opportunities.length,
                    analyzing: false,
                    withSocialData: opportunities.filter(o => o.socialData?.socialScore > 0).length,
                    withAmazonData: opportunities.filter(o => o.amazonData?.totalProducts > 0).length,
                    withGoogleTrends: opportunities.filter(o => o.googleTrendsData?.interestOverTime > 0).length,
                    arbitrageCount: opportunities.filter(o => o.crossMarketAnalysis?.arbitrageOpportunity).length,
                },
            },
        });
    } catch (err) {
        logger.error(`[Radar] getOpportunities hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Fırsatlar yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /opportunities/refresh — Fırsatları yeniden analiz et
// ═════════════════════════════════════════════════════════════════════════════
exports.refreshOpportunities = async (req, res) => {
    try {
        const userId = uid(req);

        const resultPromise = opportunityEngine.analyzeOpportunities(userId, { forceRefresh: true });

        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve({ timeout: true }), 30000);
        });

        const result = await Promise.race([resultPromise, timeoutPromise]);

        if (result.timeout) {
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
        res.status(500).json({ success: false, message: "Fırsat analizi başlatılamadı", error: err.message });
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

        await opportunityEngine.recordAction(userId, id, "viewed");

        res.json({ success: true, data: opportunity });
    } catch (err) {
        logger.error(`[Radar] getOpportunityDetail hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Fırsat detayı yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /stats — Radar istatistikleri (GELİŞTİRİLDİ)
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
            arbitrageCount,
            socialCount,
            googleTrendsCount,
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
            OpportunityResult.countDocuments({
                userId, status: "active",
                "crossMarketAnalysis.arbitrageOpportunity": true,
            }),
            OpportunityResult.countDocuments({
                userId, status: "active",
                "socialData.socialScore": { $gt: 0 },
            }),
            OpportunityResult.countDocuments({
                userId, status: "active",
                "googleTrendsData.interestOverTime": { $gt: 0 },
            }),
        ]);

        const lastAnalysis = await OpportunityResult.findOne({ userId, status: "active" })
            .sort({ dataFreshness: -1 })
            .select("dataFreshness")
            .lean();

        // Worker durumu
        const workerStatus = getRadarWorkerStatus();

        res.json({
            success: true,
            data: {
                totalActive,
                totalDismissed,
                totalActed,
                avgScore: Math.round(avgScore),
                topCategories: topCategory,
                lastAnalysis: lastAnalysis?.dataFreshness || null,
                // YENİ: Veri kaynağı istatistikleri
                dataSources: {
                    arbitrageOpportunities: arbitrageCount,
                    withSocialData: socialCount,
                    withGoogleTrends: googleTrendsCount,
                },
                worker: {
                    isActive: workerStatus.isActive,
                    totalCycles: workerStatus.totalCycles,
                    lastCycleAt: workerStatus.lastCycleAt,
                },
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
        const { opportunityId, investmentAmount, targetPrice, estimatedMonthlySales, marketplace } = req.body;
        const userId = uid(req);

        const opportunity = await OpportunityResult.findOne({ _id: opportunityId, userId }).lean();
        if (!opportunity) {
            return res.status(404).json({ success: false, message: "Fırsat bulunamadı" });
        }

        // Trendyol simülasyonu
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

        // YENİ: Amazon simülasyonu (çapraz pazar)
        let amazonSimulation = null;
        if (opportunity.amazonData?.avgPrice > 0) {
            const amzPrice = opportunity.amazonData.avgPrice;
            const amzCost = Math.round(amzPrice * 0.40);
            const amzCommission = amzPrice * 0.15;
            const amzShipping = 20;
            const amzNetProfit = amzPrice - amzCost - amzCommission - amzShipping;
            const amzMonthlySales = Math.max(1, Math.round((opportunity.amazonData.estimatedMonthlySales || 10) * 0.02));

            amazonSimulation = {
                price: amzPrice,
                cost: amzCost,
                commission: Math.round(amzCommission),
                shipping: amzShipping,
                netProfitPerUnit: Math.round(amzNetProfit),
                monthlySales: amzMonthlySales,
                monthlyProfit: Math.round(amzNetProfit * amzMonthlySales),
                profitMargin: amzPrice > 0 ? Math.round((amzNetProfit / amzPrice) * 1000) / 10 : 0,
                marketplace: opportunity.amazonData.marketplace || "TR",
            };
        }

        await opportunityEngine.recordAction(userId, opportunityId, "simulated");

        res.json({
            success: true,
            data: {
                keyword: opportunity.keyword,
                category: opportunity.category,
                simulation: {
                    marketplace: "Trendyol",
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
                amazonSimulation,
            },
        });
    } catch (err) {
        logger.error(`[Radar] simulate hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Simülasyon yapılamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /products — Ürün bazlı fırsatlar
// ═════════════════════════════════════════════════════════════════════════════
exports.getProductOpportunities = async (req, res) => {
    try {
        const userId = uid(req);
        const { minScore, sortBy, limit } = req.query;

        const query = { userId, status: "active" };
        if (minScore) query.totalScore = { $gte: parseInt(minScore) };

        const opportunities = await OpportunityResult.find(query)
            .sort({ totalScore: -1 })
            .limit(parseInt(limit) || 50)
            .lean();

        const products = [];
        for (const opp of opportunities) {
            // Trendyol ürünleri
            if (opp.marketData?.sampleProducts?.length > 0) {
                for (const product of opp.marketData.sampleProducts) {
                    const price = product.price || 0;
                    const cost = Math.round(price * 0.45);
                    const commission = price * 0.18;
                    const shipping = price > 200 ? 15 : 10;
                    const netProfit = price - cost - commission - shipping;
                    const profitMargin = price > 0 ? ((netProfit / price) * 100) : 0;

                    products.push({
                        name: product.name,
                        price: product.price,
                        rating: product.rating,
                        reviewCount: product.reviewCount,
                        seller: product.seller,
                        imageUrl: product.imageUrl,
                        url: product.url,
                        marketplace: "Trendyol",
                        keyword: opp.keyword,
                        category: opp.category,
                        opportunityScore: opp.totalScore,
                        trendScore: opp.scores?.trend || 0,
                        demandScore: opp.scores?.demand || 0,
                        competitionScore: opp.scores?.competition || 0,
                        profitScore: opp.scores?.profit || 0,
                        socialScore: opp.scores?.social || 0,
                        amazonScore: opp.scores?.amazon || 0,
                        estimatedCost: cost,
                        estimatedProfit: Math.round(netProfit),
                        profitMargin: Math.round(profitMargin * 10) / 10,
                        opportunityId: opp._id,
                        expansionType: opp.expansionType,
                        trendDirection: opp.trendData?.trendDirection,
                        isArbitrage: opp.crossMarketAnalysis?.arbitrageOpportunity || false,
                    });
                }
            }

            // YENİ: Amazon ürünleri
            if (opp.amazonData?.sampleProducts?.length > 0) {
                for (const product of opp.amazonData.sampleProducts) {
                    products.push({
                        name: product.name,
                        price: product.price,
                        rating: product.rating,
                        reviewCount: product.reviewCount,
                        seller: "",
                        imageUrl: product.imageUrl,
                        url: product.asin ? `https://www.amazon.com.tr/dp/${product.asin}` : "",
                        marketplace: "Amazon",
                        keyword: opp.keyword,
                        category: opp.category,
                        opportunityScore: opp.totalScore,
                        bsr: product.bsr,
                        asin: product.asin,
                        opportunityId: opp._id,
                        expansionType: opp.expansionType,
                        trendDirection: opp.trendData?.trendDirection,
                        isArbitrage: opp.crossMarketAnalysis?.arbitrageOpportunity || false,
                    });
                }
            }
        }

        // Sıralama
        let sortedProducts = products;
        if (sortBy === "profit") sortedProducts = products.sort((a, b) => (b.estimatedProfit || 0) - (a.estimatedProfit || 0));
        else if (sortBy === "score") sortedProducts = products.sort((a, b) => b.opportunityScore - a.opportunityScore);
        else if (sortBy === "price") sortedProducts = products.sort((a, b) => a.price - b.price);
        else if (sortBy === "rating") sortedProducts = products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        else sortedProducts = products.sort((a, b) => b.opportunityScore - a.opportunityScore);

        res.json({
            success: true,
            data: {
                products: sortedProducts.slice(0, parseInt(limit) || 50),
                stats: {
                    total: sortedProducts.length,
                    trendyolProducts: products.filter(p => p.marketplace === "Trendyol").length,
                    amazonProducts: products.filter(p => p.marketplace === "Amazon").length,
                    arbitrageProducts: products.filter(p => p.isArbitrage).length,
                },
            },
        });
    } catch (err) {
        logger.error(`[Radar] getProductOpportunities hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürün fırsatları yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /trends/google — Google Trends yükselen aramalar (YENİ)
// ═════════════════════════════════════════════════════════════════════════════
exports.getGoogleTrends = async (req, res) => {
    try {
        const { geo, keyword } = req.query;

        // Tek keyword sorgusu
        if (keyword) {
            const trendData = await googleTrendsService.getGoogleTrend(keyword, { geo: geo || "TR" });
            return res.json({ success: true, data: trendData });
        }

        // Yükselen aramalar
        const trending = await googleTrendsService.getTrendingSearches(geo || "TR");

        // DB'den son trend sinyallerini de getir
        const recentSignals = await TrendSignal.find({
            source: "google_trends",
            collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
            .sort({ compositeScore: -1 })
            .limit(20)
            .lean();

        res.json({
            success: true,
            data: {
                trendingSearches: trending,
                recentSignals,
            },
        });
    } catch (err) {
        logger.error(`[Radar] getGoogleTrends hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Google Trends verisi alınamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /trends/social/:keyword — Sosyal medya trend verisi (YENİ)
// ═════════════════════════════════════════════════════════════════════════════
exports.getSocialTrends = async (req, res) => {
    try {
        const userId = uid(req);
        const { keyword } = req.params;

        if (!keyword) {
            return res.status(400).json({ success: false, message: "keyword parametresi gerekli" });
        }

        const socialData = await socialService.getSocialMediaData(keyword, userId);

        res.json({ success: true, data: socialData });
    } catch (err) {
        logger.error(`[Radar] getSocialTrends hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Sosyal medya verisi alınamadı", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /arbitrage — Arbitraj fırsatları (YENİ)
// ═════════════════════════════════════════════════════════════════════════════
exports.getArbitrageOpportunities = async (req, res) => {
    try {
        const userId = uid(req);

        const arbitrageOpps = await OpportunityResult.find({
            userId,
            status: "active",
            "crossMarketAnalysis.arbitrageOpportunity": true,
        })
            .sort({ totalScore: -1 })
            .limit(20)
            .lean();

        res.json({
            success: true,
            data: {
                opportunities: arbitrageOpps,
                total: arbitrageOpps.length,
            },
        });
    } catch (err) {
        logger.error(`[Radar] getArbitrageOpportunities hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Arbitraj fırsatları yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /keywords/trending — Yükselen keyword'ler (YENİ)
// ═════════════════════════════════════════════════════════════════════════════
exports.getTrendingKeywords = async (req, res) => {
    try {
        const { limit } = req.query;
        const maxLimit = parseInt(limit) || 30;

        // Son 24 saatteki en yüksek skorlu trend sinyalleri
        const signals = await TrendSignal.find({
            collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
            .sort({ compositeScore: -1 })
            .limit(maxLimit)
            .lean();

        // Breakout olanları ayrı listele
        const breakouts = signals.filter(s =>
            s.trendDirection === "breakout" || s.googleTrends?.isBreakout
        );

        res.json({
            success: true,
            data: {
                trending: signals,
                breakouts,
                total: signals.length,
            },
        });
    } catch (err) {
        logger.error(`[Radar] getTrendingKeywords hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Trend keyword'ler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /data-sources — Veri kaynağı durumu (YENİ)
// ═════════════════════════════════════════════════════════════════════════════
exports.getDataSourceStatus = async (req, res) => {
    try {
        const workerStatus = getRadarWorkerStatus();

        const hasSerpAPI = hasSerpKey();
        const hasAmazonPAAPI = !!(process.env.AMAZON_PAAPI_ACCESS_KEY && process.env.AMAZON_PAAPI_SECRET_KEY);

        res.json({
            success: true,
            data: {
                sources: {
                    trendyol: { active: true, type: "scraping", description: "Trendyol HTML scraping" },
                    googleTrends: { active: hasSerpAPI, type: "api", description: hasSerpAPI ? "SerpAPI Google Trends" : "Embed fallback" },
                    amazon: { active: hasAmazonPAAPI || hasSerpAPI, type: "api", description: hasAmazonPAAPI ? "Amazon PA-API 5.0" : (hasSerpAPI ? "SerpAPI Amazon" : "Devre dışı") },
                    instagram: { active: true, type: "oauth", description: "Instagram Graph API (kullanıcı bağlantısı gerekli)" },
                    tiktok: { active: true, type: "oauth", description: "TikTok Research API (kullanıcı bağlantısı gerekli)" },
                },
                worker: {
                    isActive: workerStatus.isActive,
                    isRunning: workerStatus.isRunning,
                    totalCycles: workerStatus.totalCycles,
                    lastCycleAt: workerStatus.lastCycleAt,
                    lastDurationMs: workerStatus.lastDurationMs,
                },
            },
        });
    } catch (err) {
        logger.error(`[Radar] getDataSourceStatus hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Veri kaynağı durumu alınamadı", error: err.message });
    }
};
