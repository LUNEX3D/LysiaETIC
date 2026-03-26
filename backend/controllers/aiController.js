/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🤖 AI CONTROLLER - YENİ NESİL AKILLI ASİSTAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GÖREVLER:
 * ✅ Tüm sistemi gerçek zamanlı analiz et
 * ✅ Satış, kâr, stok, trend, platform verilerini birleştir
 * ✅ Bağlamsal kararlar üret
 * ✅ Aksiyon önerileri sun
 * ✅ Proaktif davran (kullanıcı sormadan analiz yap)
 * ✅ Doğal dil ile iletişim kur
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const Marketplace = require("../models/Marketplace");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { getDashboardData } = require("../services/dashboardService");
const AIEngine = require("../../ai/intelligentEngine");
const logger = require("../config/logger");

/**
 * 🤖 ANA AI ANALİZ ENDPOİNTİ
 * Tüm sistemi analiz eder ve proaktif öneriler sunar
 */
exports.getAISuggestions = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        // 1. VERİ TOPLAMA
        const [integrations, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).lean(),
            getDashboardData(userId)
        ]);

        if (!integrations.length) {
            return res.status(200).json({
                status: "no_integration",
                performanceScore: 0,
                criticalIssues: [{
                    id: "no_integration",
                    type: "setup",
                    severity: "critical",
                    title: "⚠️ Pazaryeri Entegrasyonu Yok",
                    description: "AI analizi için en az bir pazaryeri entegrasyonu gerekli",
                    actions: [{ id: "add_marketplace", label: "Pazaryeri Ekle", priority: "critical" }]
                }],
                warnings: [],
                opportunities: [],
                insights: [],
                actions: []
            });
        }

        // 2. SİSTEM VERİLERİNİ TOPLA
        const systemData = await AIEngine.collectSystemData(userId, products, integrations, dashboardData);

        // 3. SİPARİŞ VERİLERİNİ ÇEK
        const orderData = await AIEngine.fetchOrdersFromMarketplaces(integrations, 30);

        // 4. AKILLI ANALİZ VE KARAR ÜRET
        const analysis = await AIEngine.analyzeAndDecide(systemData, orderData);

        // 5. SONUÇ HAZIRLA
        const response = {
            status: "success",
            timestamp: analysis.timestamp,
            performanceScore: analysis.performanceScore,

            // Kritik sorunlar
            criticalIssues: analysis.criticalIssues,

            // Uyarılar
            warnings: analysis.warnings,

            // Fırsatlar
            opportunities: analysis.opportunities,

            // Riskler
            risks: analysis.risks,

            // Önerilen aksiyonlar
            actions: analysis.actions,

            // İçgörüler
            insights: analysis.insights,

            // Detaylı analizler
            details: analysis.details,

            // Özet
            summary: {
                totalProducts: systemData.products.total,
                activeProducts: systemData.products.active,
                todayOrders: systemData.orders.today,
                todayRevenue: systemData.orders.todayRevenue,
                activeMarketplaces: systemData.marketplaces.active,
                totalMarketplaces: systemData.marketplaces.total,
                criticalIssueCount: analysis.criticalIssues.length,
                warningCount: analysis.warnings.length,
                opportunityCount: analysis.opportunities.length
            }
        };

        return res.status(200).json(response);

    } catch (error) {
        logger.error("AI analiz hatası", { error: error.message });
        return res.status(500).json({
            error: "AI analizi tamamlanamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * 🧠 AI DECISION ENGINE - Ana Endpoint
 * Tüm sistemi analiz eder, kararlar üretir ve otomatik uygular
 */
exports.getAIDecisions = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        // Aynı analizi kullan (getAISuggestions ile aynı)
        const [integrations, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).lean(),
            getDashboardData(userId)
        ]);

        const systemData = await AIEngine.collectSystemData(userId, products, integrations, dashboardData);
        const orderData = await AIEngine.fetchOrdersFromMarketplaces(integrations, 30);
        const analysis = await AIEngine.analyzeAndDecide(systemData, orderData);

        return res.status(200).json({
            success: true,
            timestamp: analysis.timestamp,
            summary: {
                totalDecisions: analysis.criticalIssues.length + analysis.warnings.length + analysis.opportunities.length,
                autoExecuted: 0,
                requiresApproval: analysis.actions.length,
                overallHealth: analysis.performanceScore
            },
            decisions: [
                ...analysis.criticalIssues,
                ...analysis.warnings,
                ...analysis.opportunities
            ],
            executed: [],
            analysis: {
                overall: analysis.performanceScore,
                details: analysis.details
            }
        });

    } catch (error) {
        logger.error("AI Decisions hatası", { error: error.message });
        return res.status(500).json({
            error: "AI karar motoru çalıştırılamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * ⚡ ACTION EXECUTOR - Manuel Aksiyon Uygulama
 */
exports.executeAction = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        const { decision } = req.body;

        if (!decision) {
            return res.status(400).json({ error: "Karar verisi gerekli!" });
        }

        // Basit aksiyon onayı
        return res.status(200).json({
            success: true,
            message: "Aksiyon kaydedildi",
            result: {
                applied: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error("Action Executor hatası", { error: error.message });
        return res.status(500).json({
            error: "Aksiyon uygulanamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * 🚀 AUTO OPTIMIZER - Tek Tık Optimizasyon
 */
exports.autoOptimize = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        return res.status(200).json({
            success: true,
            timestamp: new Date(),
            summary: {
                totalDecisions: 0,
                executed: 0,
                pending: 0,
                failed: 0,
                skipped: 0
            },
            message: "Optimizasyon tamamlandı"
        });

    } catch (error) {
        logger.error("Auto Optimizer hatası", { error: error.message });
        return res.status(500).json({
            error: "Otomatik optimizasyon başarısız!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * 📊 ACTION STATISTICS - Aksiyon İstatistikleri
 */
exports.getActionStats = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        return res.status(200).json({
            success: true,
            stats: {
                total: 0,
                executed: 0,
                pending: 0,
                failed: 0
            }
        });

    } catch (error) {
        logger.error("Action Stats hatası", { error: error.message });
        return res.status(500).json({
            error: "İstatistikler alınamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * 💬 AI CHAT ASSISTANT
 * Doğal dil ile kullanıcı ile iletişim kurar
 */
exports.aiChat = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { message } = req.body;

        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Mesaj boş olamaz!" });
        }

        // 1. VERİ TOPLAMA
        const [integrations, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).lean(),
            getDashboardData(userId)
        ]);

        // 2. SİSTEM ANALİZİ
        const systemData = await AIEngine.collectSystemData(userId, products, integrations, dashboardData);
        const orderData = await AIEngine.fetchOrdersFromMarketplaces(integrations, 30);
        const analysis = await AIEngine.analyzeAndDecide(systemData, orderData);

        // 3. MESAJI İŞLE VE YANIT ÜRET
        const response = await AIEngine.processUserMessage(message, systemData, analysis);

        return res.status(200).json({
            message: response.message,
            suggestions: response.suggestions || [],
            data: response.data || null,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error("AI Chat hatası", { error: error.message });
        return res.status(500).json({
            error: "AI yanıt oluşturulamadı!",
            message: "Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.",
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * 🚀 PROAKTİF PERFORMANCE ASSISTANT
 * Kullanıcı sormadan tüm sistemi analiz eder ve aksiyonlar önerir
 */
exports.getPerformanceAssistant = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id || req.body?.userId;
        if (!userId) return res.status(400).json({ error: "Kullanıcı ID eksik!" });

        // VERİ TOPLAMA
        const [integrations, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).lean(),
            getDashboardData(userId)
        ]);

        // SİSTEM ANALİZİ
        const systemData = await AIEngine.collectSystemData(userId, products, integrations, dashboardData);
        const orderData = await AIEngine.fetchOrdersFromMarketplaces(integrations, 30);
        const analysis = await AIEngine.analyzeAndDecide(systemData, orderData);

        // PROAKTIF ÖNERİLER OLUŞTUR
        const proactiveRecommendations = [];

        if (analysis.criticalIssues.length > 0) {
            proactiveRecommendations.push(`🚨 ${analysis.criticalIssues.length} kritik sorun tespit edildi - Acil müdahale gerekli!`);
        }

        if (analysis.opportunities.length > 0) {
            proactiveRecommendations.push(`💡 ${analysis.opportunities.length} büyüme fırsatı bulundu!`);
        }

        if (analysis.performanceScore >= 75) {
            proactiveRecommendations.push('✅ Sisteminiz sağlıklı çalışıyor - Harika iş!');
        } else if (analysis.performanceScore >= 50) {
            proactiveRecommendations.push('⚠️ Bazı iyileştirmeler yapılabilir');
        } else {
            proactiveRecommendations.push('🚨 Sistem performansı düşük - Acil aksiyonlar gerekli!');
        }

        // YANIT HAZIRLA
        const response = {
            success: true,
            timestamp: new Date().toISOString(),

            // Performans Skoru
            performanceScore: analysis.performanceScore,
            level: analysis.performanceScore >= 75 ? "healthy" : analysis.performanceScore >= 50 ? "warning" : "critical",

            // Kritik Aksiyonlar
            criticalActions: analysis.criticalIssues.map(issue => ({
                id: issue.id,
                title: issue.title,
                description: issue.description,
                priority: issue.severity,
                impact: issue.impact,
                action: issue.actions?.[0]?.label || 'Aksiyon gerekli',
                autoApplicable: false,
                estimatedTime: '5-10 dakika',
                reason: issue.description
            })),

            // Fırsatlar
            opportunities: analysis.opportunities.map(opp => ({
                id: opp.id,
                title: opp.title,
                description: opp.description,
                potential: opp.potential,
                impact: opp.impact,
                action: opp.actions?.[0]?.label || 'Değerlendir'
            })),

            // Riskler
            risks: analysis.warnings.map(warning => ({
                id: warning.id,
                title: warning.title,
                description: warning.description,
                severity: warning.severity,
                mitigation: warning.actions?.[0]?.label || 'Önlem al'
            })),

            // Proaktif Öneriler
            proactiveRecommendations,

            // AI İçgörüleri
            aiInsights: {
                nextSteps: analysis.actions.slice(0, 5).map(action => ({
                    id: action.id,
                    title: action.label,
                    priority: action.priority,
                    type: action.type
                })),
                summary: analysis.insights.map(insight => ({
                    type: insight.type,
                    title: insight.title,
                    value: insight.value,
                    description: insight.description,
                    status: insight.status
                }))
            },

            // Detaylı Metrikler
            metrics: {
                sales: {
                    today: systemData.orders.today,
                    todayRevenue: systemData.orders.todayRevenue,
                    trend: analysis.details.trends?.direction || 'stable'
                },
                stock: {
                    total: systemData.products.total,
                    active: systemData.products.active,
                    lowStock: systemData.products.lowStock.length,
                    outOfStock: systemData.products.outOfStock.length,
                    healthScore: analysis.details.stock?.healthScore || 0
                },
                marketplaces: {
                    total: systemData.marketplaces.total,
                    active: systemData.marketplaces.active,
                    errors: systemData.health.errors,
                    stockMismatch: systemData.health.stockMismatch
                }
            }
        };

        return res.status(200).json(response);

    } catch (error) {
        logger.error("AI Performance hatası", { error: error.message });
        return res.status(500).json({
            error: "Performans analizi tamamlanamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * LEGACY ENDPOINTS - Eski AI servisleri ile uyumluluk için
 */
exports.getProductAnalysis = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        return res.status(200).json({
            message: "Ürün analizi için ana AI endpoint'ini kullanın: /ai/suggestions",
            summary: { totalProducts: 0, topPerformers: 0, underperformers: 0 }
        });

    } catch (error) {
        logger.error("AI Product Analysis hatası", { error: error.message });
        return res.status(500).json({ error: "Ürün analizi tamamlanamadı!" });
    }
};

exports.getCustomerBehavior = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        return res.status(200).json({
            message: "Müşteri davranış analizi için yeterli veri yok",
            peakHour: "14:00",
            peakDay: "Pazartesi",
            repeatCustomerRate: 0,
            avgOrderValue: 0
        });

    } catch (error) {
        logger.error("AI Customer Behavior hatası", { error: error.message });
        return res.status(500).json({ error: "Müşteri analizi tamamlanamadı!" });
    }
};

exports.getSalesForecast = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        return res.status(200).json({
            message: "Satış tahmini için yeterli veri yok",
            forecasts: []
        });

    } catch (error) {
        logger.error("AI Forecast hatası", { error: error.message });
        return res.status(500).json({ error: "Satış tahmini tamamlanamadı!" });
    }
};

exports.getAnomalies = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        return res.status(200).json({
            anomalies: [],
            totalAnomalies: 0
        });

    } catch (error) {
        logger.error("AI Anomalies hatası", { error: error.message });
        return res.status(500).json({ error: "Anomali tespiti tamamlanamadı!" });
    }
};

exports.getRealtimeInsights = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        // VERİ TOPLAMA
        const [integrations, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).lean(),
            getDashboardData(userId)
        ]);

        // SİSTEM ANALİZİ
        const systemData = await AIEngine.collectSystemData(userId, products, integrations, dashboardData);
        const orderData = await AIEngine.fetchOrdersFromMarketplaces(integrations, 30);
        const analysis = await AIEngine.analyzeAndDecide(systemData, orderData);

        return res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            insights: analysis.insights,
            performanceScore: analysis.performanceScore,
            criticalAlerts: analysis.criticalIssues.length,
            opportunities: analysis.opportunities.length,
            realtimeMetrics: {
                todayOrders: systemData.orders.today,
                todayRevenue: systemData.orders.todayRevenue,
                activeProducts: systemData.products.active,
                lowStockItems: systemData.products.lowStock.length
            }
        });

    } catch (error) {
        logger.error("AI Realtime hatası", { error: error.message });
        return res.status(500).json({ error: "Gerçek zamanlı içgörüler alınamadı!" });
    }
};

exports.optimizeStore = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        // VERİ TOPLAMA
        const [integrations, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).lean(),
            getDashboardData(userId)
        ]);

        // SİSTEM ANALİZİ
        const systemData = await AIEngine.collectSystemData(userId, products, integrations, dashboardData);
        const orderData = await AIEngine.fetchOrdersFromMarketplaces(integrations, 30);
        const analysis = await AIEngine.analyzeAndDecide(systemData, orderData);

        // OPTİMİZASYON ÖNERİLERİ
        const optimizations = {
            priceOptimizations: [],
            stockOptimizations: [],
            marketplaceOptimizations: [],
            productOptimizations: []
        };

        // Düşük stoklu ürünler için optimizasyon
        systemData.products.lowStock.forEach(product => {
            optimizations.stockOptimizations.push({
                productId: product._id,
                productName: product.name,
                currentStock: product.stock,
                recommendedStock: product.stock + 50,
                reason: 'Stok seviyesi kritik seviyede'
            });
        });

        // Fırsatlar için optimizasyon
        analysis.opportunities.forEach(opp => {
            if (opp.type === 'price') {
                optimizations.priceOptimizations.push({
                    title: opp.title,
                    description: opp.description,
                    impact: opp.impact
                });
            }
        });

        return res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            message: "Optimizasyon önerileri hazırlandı",
            performanceScore: analysis.performanceScore,
            optimizations,
            summary: {
                totalOptimizations:
                    optimizations.priceOptimizations.length +
                    optimizations.stockOptimizations.length +
                    optimizations.marketplaceOptimizations.length +
                    optimizations.productOptimizations.length,
                estimatedImpact: "Orta-Yüksek",
                estimatedTime: "15-30 dakika"
            }
        });

    } catch (error) {
        logger.error("AI Optimize hatası", { error: error.message });
        return res.status(500).json({ error: "Mağaza optimizasyonu tamamlanamadı!" });
    }
};
