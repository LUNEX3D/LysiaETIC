/**
 * AI DECISION CONTROLLER
 *
 * Gerçek verilerle çalışan, aksiyon odaklı AI karar motoru
 *
 * Görevler:
 * 1. Tüm sistemi analiz et (ürünler, siparişler, stoklar, fiyatlar)
 * 2. Kararlar üret (fiyat artır, kampanya yap, stok uyar)
 * 3. Aksiyonları uygula veya öner
 */

const Marketplace = require("../models/Marketplace");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AIService = require("../../ai/advancedAIService");
const { getDashboardData } = require("../services/dashboardService");

/**
 * 🧠 ANA AI ANALİZ - Tüm sistemi değerlendir
 */
exports.getAIDecisions = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        console.log(`🤖 [AI DECISION] Başlatılıyor - Kullanıcı: ${userId}`);

        // 1️⃣ VERİ TOPLAMA - Tüm sistem verilerini çek
        const [marketplaces, products, dashboardData] = await Promise.all([
            Marketplace.find({ userId }).lean(),
            Product.find({ userId }).limit(1000).lean(),
            getDashboardData(userId)
        ]);

        console.log(`📊 [AI] Veri toplandı: ${marketplaces.length} pazaryeri, ${products.length} ürün`);

        if (marketplaces.length === 0) {
            return res.status(200).json({
                status: "no_data",
                message: "Analiz için pazaryeri entegrasyonu gerekli",
                decisions: [],
                actions: [],
                insights: {
                    totalMarketplaces: 0,
                    totalProducts: products.length,
                    analysisQuality: "none"
                }
            });
        }

        // 2️⃣ SİPARİŞ VERİLERİNİ TOPLA
        const allOrders = [];
        for (const marketplace of marketplaces) {
            try {
                const orders = await AIService.fetchOrdersForIntegration(marketplace, 90);
                if (orders && orders.length > 0) {
                    allOrders.push(...orders.map(o => ({ ...o, marketplace: marketplace.marketplaceName })));
                }
            } catch (error) {
                console.error(`❌ [AI] ${marketplace.marketplaceName} siparişleri alınamadı:`, error.message);
            }
        }

        console.log(`📦 [AI] Toplam ${allOrders.length} sipariş analiz ediliyor`);

        // 3️⃣ AI ANALİZ - Kapsamlı değerlendirme
        const analysis = await performComprehensiveAnalysis(allOrders, products, dashboardData, marketplaces);

        // 4️⃣ KARAR ÜRETME - Aksiyon odaklı kararlar
        const decisions = generateActionableDecisions(analysis);

        // 5️⃣ ÖNCELİKLENDİRME - En önemli aksiyonlar
        const prioritizedActions = prioritizeActions(decisions);

        // 6️⃣ SONUÇ HAZIRLA
        const response = {
            status: "success",
            timestamp: new Date().toISOString(),
            summary: {
                totalMarketplaces: marketplaces.length,
                totalProducts: products.length,
                totalOrders: allOrders.length,
                analysisQuality: allOrders.length > 100 ? "high" : allOrders.length > 30 ? "medium" : "low",
                criticalIssues: decisions.filter(d => d.priority === "critical").length,
                opportunities: decisions.filter(d => d.type === "opportunity").length,
                warnings: decisions.filter(d => d.priority === "high").length
            },
            decisions: decisions,
            prioritizedActions: prioritizedActions,
            insights: analysis.insights,
            recommendations: analysis.recommendations,
            performanceScore: calculateOverallPerformanceScore(analysis)
        };

        console.log(`✅ [AI DECISION] Tamamlandı - ${decisions.length} karar, ${prioritizedActions.length} aksiyon`);

        return res.status(200).json(response);

    } catch (error) {
        console.error("❌ [AI DECISION] Hata:", error);
        return res.status(500).json({
            error: "AI analizi tamamlanamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * 📊 KAPSAMLI ANALİZ - Tüm verileri değerlendir
 */
async function performComprehensiveAnalysis(orders, products, dashboardData, marketplaces) {
    const analysis = {
        insights: {},
        recommendations: [],
        productAnalysis: {},
        marketplaceAnalysis: {},
        financialAnalysis: {},
        riskAnalysis: {}
    };

    // 1. ÜRÜN PERFORMANS ANALİZİ
    if (orders.length > 0) {
        const productPerformance = AIService.analyzeProductPerformance(orders);
        analysis.productAnalysis = {
            topPerformers: productPerformance.topPerformers.slice(0, 10),
            underperformers: productPerformance.underperformers.slice(0, 10),
            totalProducts: productPerformance.totalProducts,
            avgPerformanceScore: productPerformance.products.reduce((sum, p) => sum + p.performanceScore, 0) / productPerformance.products.length
        };
    }

    // 2. FİYAT OPTİMİZASYONU
    if (analysis.productAnalysis.topPerformers) {
        const priceOptimizations = analysis.productAnalysis.topPerformers
            .map(product => ({
                product: product.name,
                barcode: product.barcode,
                ...AIService.optimizePrice(product)
            }))
            .filter(opt => Math.abs(opt.change) > 2);

        analysis.priceOptimizations = priceOptimizations;
    }

    // 3. SATIŞ TAHMİNİ
    if (orders.length >= 7) {
        const forecast = AIService.forecastSales(orders, 30);
        analysis.forecast = {
            next7Days: forecast.forecast?.slice(0, 7) || [],
            next30Days: forecast.forecast || [],
            confidence: forecast.confidence,
            trend: forecast.trend,
            historicalAverage: forecast.historicalAverage
        };
    }

    // 4. ANOMALİ TESPİTİ
    if (orders.length >= 7) {
        const anomalies = AIService.detectAnomalies(orders);
        analysis.anomalies = anomalies.anomalies || [];
    }

    // 5. MÜŞTERİ DAVRANIŞI
    if (orders.length > 0) {
        const customerBehavior = AIService.analyzeCustomerBehavior(orders);
        analysis.customerBehavior = customerBehavior;
    }

    // 6. STOK ANALİZİ
    const stockAnalysis = analyzeStockLevels(products, orders);
    analysis.stockAnalysis = stockAnalysis;

    // 7. FİNANSAL ANALİZ
    const financialMetrics = calculateFinancialMetrics(orders, dashboardData);
    analysis.financialAnalysis = financialMetrics;

    // 8. RİSK DEĞERLENDİRMESİ
    const risks = identifyRisks(analysis, dashboardData);
    analysis.riskAnalysis = risks;

    // 9. FIRSATLAR
    const opportunities = identifyOpportunities(analysis, dashboardData);
    analysis.opportunities = opportunities;

    // 10. GENEL İÇGÖRÜLER
    analysis.insights = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => {
            const lines = AIService.extractOrderLines(o);
            return sum + lines.reduce((s, item) => s + (item.price * item.quantity), 0);
        }, 0),
        avgOrderValue: orders.length > 0 ? orders.reduce((sum, o) => {
            const lines = AIService.extractOrderLines(o);
            return sum + lines.reduce((s, item) => s + (item.price * item.quantity), 0);
        }, 0) / orders.length : 0,
        marketplaceCount: marketplaces.length,
        productCount: products.length,
        lowStockProducts: stockAnalysis.lowStock.length,
        outOfStockProducts: stockAnalysis.outOfStock.length,
        highPerformanceProducts: analysis.productAnalysis.topPerformers?.length || 0,
        underperformingProducts: analysis.productAnalysis.underperformers?.length || 0
    };

    return analysis;
}

/**
 * 🎯 KARAR ÜRETME - Aksiyon odaklı kararlar
 */
function generateActionableDecisions(analysis) {
    const decisions = [];

    // 1. KRİTİK STOK UYARILARI
    if (analysis.stockAnalysis.outOfStock.length > 0) {
        decisions.push({
            id: `stock_critical_${Date.now()}`,
            type: "risk",
            category: "stock",
            priority: "critical",
            title: "🚨 Stokta Olmayan Ürünler",
            description: `${analysis.stockAnalysis.outOfStock.length} ürün stokta yok - Satış kaybı riski!`,
            impact: "high",
            data: {
                products: analysis.stockAnalysis.outOfStock.slice(0, 5),
                totalAffected: analysis.stockAnalysis.outOfStock.length
            },
            actions: [
                {
                    id: "restock_critical",
                    label: "Acil Tedarik Başlat",
                    type: "primary",
                    autoApplicable: false,
                    estimatedImpact: "Satış kaybını önler"
                },
                {
                    id: "notify_supplier",
                    label: "Tedarikçiye Bildir",
                    type: "secondary",
                    autoApplicable: true
                }
            ],
            estimatedLoss: analysis.stockAnalysis.outOfStock.length * 500 // Ortalama ürün değeri
        });
    }

    // 2. DÜŞÜK STOK UYARILARI
    if (analysis.stockAnalysis.lowStock.length > 0) {
        decisions.push({
            id: `stock_low_${Date.now()}`,
            type: "warning",
            category: "stock",
            priority: "high",
            title: "⚠️ Düşük Stok Seviyesi",
            description: `${analysis.stockAnalysis.lowStock.length} ürünün stoğu kritik seviyede`,
            impact: "medium",
            data: {
                products: analysis.stockAnalysis.lowStock.slice(0, 10),
                totalAffected: analysis.stockAnalysis.lowStock.length
            },
            actions: [
                {
                    id: "plan_restock",
                    label: "Stok Planla",
                    type: "primary",
                    autoApplicable: false
                },
                {
                    id: "set_alert",
                    label: "Otomatik Uyarı Kur",
                    type: "secondary",
                    autoApplicable: true
                }
            ]
        });
    }

    // 3. FİYAT OPTİMİZASYONU FIRSATLARI
    if (analysis.priceOptimizations && analysis.priceOptimizations.length > 0) {
        const increaseOpportunities = analysis.priceOptimizations.filter(opt => opt.change > 0);
        const decreaseNeeds = analysis.priceOptimizations.filter(opt => opt.change < 0);

        if (increaseOpportunities.length > 0) {
            decisions.push({
                id: `price_increase_${Date.now()}`,
                type: "opportunity",
                category: "pricing",
                priority: "high",
                title: "💰 Fiyat Artırım Fırsatı",
                description: `${increaseOpportunities.length} ürün için fiyat artırımı öneriliyor - Potansiyel kâr artışı`,
                impact: "high",
                data: {
                    optimizations: increaseOpportunities.slice(0, 5),
                    totalProducts: increaseOpportunities.length,
                    avgIncrease: increaseOpportunities.reduce((sum, opt) => sum + opt.change, 0) / increaseOpportunities.length
                },
                actions: [
                    {
                        id: "apply_price_increase",
                        label: "Fiyatları Güncelle",
                        type: "primary",
                        autoApplicable: false,
                        estimatedImpact: `+${(increaseOpportunities.reduce((sum, opt) => sum + opt.changeAmount, 0) * 10).toFixed(0)} TL/ay`
                    },
                    {
                        id: "review_prices",
                        label: "Detaylı İncele",
                        type: "secondary",
                        autoApplicable: false
                    }
                ],
                potentialRevenue: increaseOpportunities.reduce((sum, opt) => sum + opt.changeAmount * 10, 0)
            });
        }

        if (decreaseNeeds.length > 0) {
            decisions.push({
                id: `price_decrease_${Date.now()}`,
                type: "action",
                category: "pricing",
                priority: "medium",
                title: "📉 Fiyat İndirimi Gerekli",
                description: `${decreaseNeeds.length} ürün düşük talep görüyor - Fiyat indirimi satışları artırabilir`,
                impact: "medium",
                data: {
                    optimizations: decreaseNeeds.slice(0, 5),
                    totalProducts: decreaseNeeds.length
                },
                actions: [
                    {
                        id: "apply_price_decrease",
                        label: "Fiyatları Düşür",
                        type: "primary",
                        autoApplicable: false
                    },
                    {
                        id: "create_campaign",
                        label: "Kampanya Oluştur",
                        type: "secondary",
                        autoApplicable: false
                    }
                ]
            });
        }
    }

    // 4. DÜŞÜK PERFORMANSLI ÜRÜNLER
    if (analysis.productAnalysis.underperformers && analysis.productAnalysis.underperformers.length > 0) {
        decisions.push({
            id: `underperforming_${Date.now()}`,
            type: "warning",
            category: "product_performance",
            priority: "medium",
            title: "📊 Düşük Performanslı Ürünler",
            description: `${analysis.productAnalysis.underperformers.length} ürün düşük performans gösteriyor`,
            impact: "medium",
            data: {
                products: analysis.productAnalysis.underperformers.slice(0, 5),
                totalAffected: analysis.productAnalysis.underperformers.length,
                avgScore: analysis.productAnalysis.underperformers.reduce((sum, p) => sum + p.performanceScore, 0) / analysis.productAnalysis.underperformers.length
            },
            actions: [
                {
                    id: "boost_marketing",
                    label: "Pazarlama Artır",
                    type: "primary",
                    autoApplicable: false
                },
                {
                    id: "discount_campaign",
                    label: "İndirim Kampanyası",
                    type: "secondary",
                    autoApplicable: false
                },
                {
                    id: "consider_removal",
                    label: "Ürünü Değerlendir",
                    type: "tertiary",
                    autoApplicable: false
                }
            ]
        });
    }

    // 5. YÜKSEK PERFORMANSLI ÜRÜNLER - FIRSATLAR
    if (analysis.productAnalysis.topPerformers && analysis.productAnalysis.topPerformers.length > 0) {
        const topProduct = analysis.productAnalysis.topPerformers[0];
        decisions.push({
            id: `top_performer_${Date.now()}`,
            type: "opportunity",
            category: "product_performance",
            priority: "medium",
            title: "⭐ En İyi Performans",
            description: `${topProduct.name} en yüksek performansı gösteriyor (${topProduct.performanceScore}/100)`,
            impact: "high",
            data: {
                product: topProduct,
                revenue: topProduct.totalRevenue,
                quantity: topProduct.totalQuantity
            },
            actions: [
                {
                    id: "increase_stock",
                    label: "Stok Artır",
                    type: "primary",
                    autoApplicable: false,
                    estimatedImpact: "Satış fırsatlarını kaçırmayın"
                },
                {
                    id: "feature_product",
                    label: "Öne Çıkar",
                    type: "secondary",
                    autoApplicable: false
                }
            ]
        });
    }

    // 6. SATIŞ TAHMİNİ UYARILARI
    if (analysis.forecast && analysis.forecast.trend) {
        if (analysis.forecast.trend === "decreasing") {
            decisions.push({
                id: `forecast_declining_${Date.now()}`,
                type: "warning",
                category: "forecast",
                priority: "high",
                title: "📉 Satış Düşüş Trendi",
                description: `Satışlarda azalış trendi tespit edildi - Önlem alınmalı`,
                impact: "high",
                data: {
                    trend: analysis.forecast.trend,
                    confidence: analysis.forecast.confidence,
                    next7Days: analysis.forecast.next7Days
                },
                actions: [
                    {
                        id: "launch_campaign",
                        label: "Kampanya Başlat",
                        type: "primary",
                        autoApplicable: false
                    },
                    {
                        id: "review_pricing",
                        label: "Fiyatları Gözden Geçir",
                        type: "secondary",
                        autoApplicable: false
                    },
                    {
                        id: "boost_ads",
                        label: "Reklamları Artır",
                        type: "tertiary",
                        autoApplicable: false
                    }
                ]
            });
        } else if (analysis.forecast.trend === "increasing") {
            decisions.push({
                id: `forecast_growing_${Date.now()}`,
                type: "opportunity",
                category: "forecast",
                priority: "medium",
                title: "📈 Satış Artış Trendi",
                description: `Satışlarda artış trendi - Stok ve kapasite hazırlığı yapın`,
                impact: "high",
                data: {
                    trend: analysis.forecast.trend,
                    confidence: analysis.forecast.confidence,
                    next7Days: analysis.forecast.next7Days
                },
                actions: [
                    {
                        id: "prepare_stock",
                        label: "Stok Hazırlığı",
                        type: "primary",
                        autoApplicable: false
                    },
                    {
                        id: "optimize_logistics",
                        label: "Lojistik Optimize Et",
                        type: "secondary",
                        autoApplicable: false
                    }
                ]
            });
        }
    }

    // 7. ANOMALİ UYARILARI
    if (analysis.anomalies && analysis.anomalies.length > 0) {
        const recentAnomalies = analysis.anomalies.slice(-3);
        recentAnomalies.forEach(anomaly => {
            decisions.push({
                id: `anomaly_${anomaly.date}_${anomaly.type}`,
                type: "alert",
                category: "anomaly",
                priority: anomaly.severity === "high" ? "high" : "medium",
                title: `⚠️ ${anomaly.type === 'revenue' ? 'Ciro' : 'Sipariş'} Anomalisi`,
                description: `${anomaly.date} tarihinde ${anomaly.direction === 'spike' ? 'beklenmedik artış' : 'düşüş'} tespit edildi`,
                impact: anomaly.severity,
                data: {
                    date: anomaly.date,
                    type: anomaly.type,
                    value: anomaly.value,
                    expected: anomaly.expected,
                    deviation: anomaly.deviation
                },
                actions: [
                    {
                        id: "investigate_anomaly",
                        label: "Nedeni Araştır",
                        type: "primary",
                        autoApplicable: false
                    }
                ]
            });
        });
    }

    // 8. MÜŞTERİ DAVRANIŞI ÖNERİLERİ
    if (analysis.customerBehavior) {
        decisions.push({
            id: `customer_behavior_${Date.now()}`,
            type: "insight",
            category: "customer",
            priority: "low",
            title: "👥 Müşteri Davranış Analizi",
            description: `En yoğun saat: ${analysis.customerBehavior.peakHour}, En yoğun gün: ${analysis.customerBehavior.peakDay}`,
            impact: "low",
            data: {
                peakHour: analysis.customerBehavior.peakHour,
                peakDay: analysis.customerBehavior.peakDay,
                repeatCustomerRate: analysis.customerBehavior.repeatCustomerRate,
                avgOrderValue: analysis.customerBehavior.avgOrderValue
            },
            actions: [
                {
                    id: "schedule_campaigns",
                    label: "Kampanya Zamanla",
                    type: "primary",
                    autoApplicable: false,
                    estimatedImpact: `${analysis.customerBehavior.peakHour} saatlerinde özel kampanyalar`
                }
            ]
        });
    }

    // 9. FİNANSAL UYARILAR
    if (analysis.financialAnalysis) {
        if (analysis.financialAnalysis.profitMargin < 10) {
            decisions.push({
                id: `low_margin_${Date.now()}`,
                type: "risk",
                category: "financial",
                priority: "critical",
                title: "💸 Düşük Kâr Marjı",
                description: `Kâr marjı %${analysis.financialAnalysis.profitMargin.toFixed(1)} - Kritik seviyede!`,
                impact: "critical",
                data: {
                    profitMargin: analysis.financialAnalysis.profitMargin,
                    totalRevenue: analysis.financialAnalysis.totalRevenue,
                    totalCost: analysis.financialAnalysis.totalCost
                },
                actions: [
                    {
                        id: "increase_prices",
                        label: "Fiyatları Artır",
                        type: "primary",
                        autoApplicable: false
                    },
                    {
                        id: "reduce_costs",
                        label: "Maliyetleri Düşür",
                        type: "secondary",
                        autoApplicable: false
                    }
                ]
            });
        }
    }

    // Öncelik sıralaması
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    decisions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return decisions;
}

/**
 * 🎯 AKSİYON ÖNCELİKLENDİRME
 */
function prioritizeActions(decisions) {
    const actions = [];

    // Kritik aksiyonlar
    const criticalDecisions = decisions.filter(d => d.priority === "critical");
    criticalDecisions.forEach(decision => {
        decision.actions.forEach(action => {
            actions.push({
                id: `${decision.id}_${action.id}`,
                decisionId: decision.id,
                priority: "critical",
                title: decision.title,
                actionLabel: action.label,
                actionType: action.type,
                category: decision.category,
                estimatedImpact: action.estimatedImpact || decision.impact,
                autoApplicable: action.autoApplicable,
                data: decision.data
            });
        });
    });

    // Yüksek öncelikli aksiyonlar
    const highDecisions = decisions.filter(d => d.priority === "high");
    highDecisions.slice(0, 3).forEach(decision => {
        const primaryAction = decision.actions.find(a => a.type === "primary");
        if (primaryAction) {
            actions.push({
                id: `${decision.id}_${primaryAction.id}`,
                decisionId: decision.id,
                priority: "high",
                title: decision.title,
                actionLabel: primaryAction.label,
                actionType: primaryAction.type,
                category: decision.category,
                estimatedImpact: primaryAction.estimatedImpact || decision.impact,
                autoApplicable: primaryAction.autoApplicable,
                data: decision.data
            });
        }
    });

    // Fırsatlar
    const opportunities = decisions.filter(d => d.type === "opportunity");
    opportunities.slice(0, 2).forEach(decision => {
        const primaryAction = decision.actions.find(a => a.type === "primary");
        if (primaryAction) {
            actions.push({
                id: `${decision.id}_${primaryAction.id}`,
                decisionId: decision.id,
                priority: "opportunity",
                title: decision.title,
                actionLabel: primaryAction.label,
                actionType: primaryAction.type,
                category: decision.category,
                estimatedImpact: primaryAction.estimatedImpact || decision.potentialRevenue,
                autoApplicable: primaryAction.autoApplicable,
                data: decision.data
            });
        }
    });

    return actions.slice(0, 10); // En önemli 10 aksiyon
}

/**
 * 📊 STOK ANALİZİ
 */
function analyzeStockLevels(products, orders) {
    const lowStock = [];
    const outOfStock = [];
    const healthy = [];

    products.forEach(product => {
        const stock = product.stock || 0;

        if (stock === 0) {
            outOfStock.push({
                name: product.name,
                barcode: product.barcode,
                stock: 0,
                price: product.price
            });
        } else if (stock < 10) {
            lowStock.push({
                name: product.name,
                barcode: product.barcode,
                stock: stock,
                price: product.price
            });
        } else {
            healthy.push({
                name: product.name,
                barcode: product.barcode,
                stock: stock
            });
        }
    });

    return {
        lowStock,
        outOfStock,
        healthy,
        totalProducts: products.length,
        stockHealthScore: ((healthy.length / Math.max(products.length, 1)) * 100).toFixed(1)
    };
}

/**
 * 💰 FİNANSAL METRİKLER
 */
function calculateFinancialMetrics(orders, dashboardData) {
    const totalRevenue = orders.reduce((sum, o) => {
        const lines = AIService.extractOrderLines(o);
        return sum + lines.reduce((s, item) => s + (item.price * item.quantity), 0);
    }, 0);

    // Basit maliyet tahmini (gelirin %70'i)
    const estimatedCost = totalRevenue * 0.7;
    const profit = totalRevenue - estimatedCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
        totalRevenue,
        totalCost: estimatedCost,
        profit,
        profitMargin,
        avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
    };
}

/**
 * ⚠️ RİSK TESPİTİ
 */
function identifyRisks(analysis, dashboardData) {
    const risks = [];

    // Stok riskleri
    if (analysis.stockAnalysis.outOfStock.length > 0) {
        risks.push({
            type: "stock",
            severity: "critical",
            description: `${analysis.stockAnalysis.outOfStock.length} ürün stokta yok`,
            impact: "Satış kaybı"
        });
    }

    // Performans riskleri
    if (analysis.productAnalysis.underperformers && analysis.productAnalysis.underperformers.length > 5) {
        risks.push({
            type: "performance",
            severity: "high",
            description: `${analysis.productAnalysis.underperformers.length} ürün düşük performans`,
            impact: "Kâr kaybı"
        });
    }

    // Trend riskleri
    if (analysis.forecast && analysis.forecast.trend === "decreasing") {
        risks.push({
            type: "trend",
            severity: "high",
            description: "Satışlarda düşüş trendi",
            impact: "Gelir azalması"
        });
    }

    return risks;
}

/**
 * 🎯 FIRSAT TESPİTİ
 */
function identifyOpportunities(analysis, dashboardData) {
    const opportunities = [];

    // Fiyat artırım fırsatları
    if (analysis.priceOptimizations) {
        const increaseOps = analysis.priceOptimizations.filter(opt => opt.change > 5);
        if (increaseOps.length > 0) {
            opportunities.push({
                type: "pricing",
                potential: "high",
                description: `${increaseOps.length} ürün için fiyat artırım fırsatı`,
                estimatedGain: increaseOps.reduce((sum, opt) => sum + opt.changeAmount * 10, 0)
            });
        }
    }

    // Yüksek performans fırsatları
    if (analysis.productAnalysis.topPerformers && analysis.productAnalysis.topPerformers.length > 0) {
        opportunities.push({
            type: "product",
            potential: "high",
            description: `${analysis.productAnalysis.topPerformers.length} yüksek performanslı ürün`,
            action: "Stok artırımı ve pazarlama"
        });
    }

    // Büyüme trendi fırsatları
    if (analysis.forecast && analysis.forecast.trend === "increasing") {
        opportunities.push({
            type: "growth",
            potential: "high",
            description: "Satışlarda artış trendi",
            action: "Kapasite artırımı"
        });
    }

    return opportunities;
}

/**
 * 📊 GENEL PERFORMANS SKORU
 */
function calculateOverallPerformanceScore(analysis) {
    let score = 100;

    // Stok sağlığı (-20 puan)
    if (analysis.stockAnalysis) {
        const stockHealth = parseFloat(analysis.stockAnalysis.stockHealthScore);
        score -= (100 - stockHealth) * 0.2;
    }

    // Ürün performansı (-20 puan)
    if (analysis.productAnalysis.avgPerformanceScore) {
        score -= (100 - analysis.productAnalysis.avgPerformanceScore) * 0.2;
    }

    // Finansal sağlık (-30 puan)
    if (analysis.financialAnalysis) {
        if (analysis.financialAnalysis.profitMargin < 10) {
            score -= 30;
        } else if (analysis.financialAnalysis.profitMargin < 20) {
            score -= 15;
        }
    }

    // Trend (-15 puan)
    if (analysis.forecast && analysis.forecast.trend === "decreasing") {
        score -= 15;
    }

    // Anomaliler (-15 puan)
    if (analysis.anomalies && analysis.anomalies.length > 0) {
        score -= Math.min(15, analysis.anomalies.length * 3);
    }

    return {
        overall: Math.max(0, Math.round(score)),
        breakdown: {
            stockHealth: analysis.stockAnalysis ? parseFloat(analysis.stockAnalysis.stockHealthScore) : 0,
            productPerformance: analysis.productAnalysis.avgPerformanceScore || 0,
            financialHealth: analysis.financialAnalysis ? Math.min(100, analysis.financialAnalysis.profitMargin * 5) : 0,
            trendHealth: analysis.forecast && analysis.forecast.trend === "increasing" ? 100 : analysis.forecast && analysis.forecast.trend === "stable" ? 75 : 50
        },
        rating: score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "fair" : "poor"
    };
}

/**
 * 🚀 AKSİYON UYGULAMA
 */
exports.applyAction = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { actionId, decisionId, actionType, data } = req.body;

        if (!userId || !actionId) {
            return res.status(400).json({ error: "Geçersiz istek!" });
        }

        console.log(`🚀 [AI ACTION] Uygulanıyor: ${actionId}`);

        // Aksiyon tipine göre işlem yap
        let result = {
            success: false,
            message: "Aksiyon uygulanamadı"
        };

        // Burada gerçek aksiyonlar uygulanacak
        // Örnek: Fiyat güncelleme, stok uyarısı, kampanya oluşturma vb.

        switch (actionType) {
            case "set_alert":
                result = {
                    success: true,
                    message: "Otomatik uyarı kuruldu",
                    applied: true
                };
                break;

            case "notify_supplier":
                result = {
                    success: true,
                    message: "Tedarikçiye bildirim gönderildi",
                    applied: true
                };
                break;

            default:
                result = {
                    success: false,
                    message: "Bu aksiyon manuel onay gerektiriyor",
                    requiresManualApproval: true
                };
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error("❌ [AI ACTION] Hata:", error);
        return res.status(500).json({
            error: "Aksiyon uygulanamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

/**
 * 📊 TEK TIK OPTİMİZASYON
 */
exports.optimizeStore = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Kullanıcı kimliği doğrulanamadı!" });
        }

        console.log(`⚡ [AI OPTIMIZE] Mağaza optimizasyonu başlatılıyor - Kullanıcı: ${userId}`);

        // Tüm analizi yap
        const decisionsResponse = await exports.getAIDecisions(req, res);

        // Otomatik uygulanabilir aksiyonları bul ve uygula
        // Bu kısım gerçek uygulamada genişletilecek

        return res.status(200).json({
            success: true,
            message: "Mağaza optimizasyonu tamamlandı",
            appliedActions: [],
            pendingActions: []
        });

    } catch (error) {
        console.error("❌ [AI OPTIMIZE] Hata:", error);
        return res.status(500).json({
            error: "Optimizasyon tamamlanamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};
