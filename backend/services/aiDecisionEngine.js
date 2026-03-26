/**
 * AI KARAR MOTORU
 *
 * Bu servis gerçek verilerle çalışır ve akıllı kararlar üretir.
 * Varsayım yapmaz, genel konuşmaz.
 * Tüm sistemi bir bütün olarak analiz eder.
 */

const Product = require("../models/Product");
const Order = require("../models/Order");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");

class AIDecisionEngine {
    constructor() {
        this.decisions = [];
        this.actions = [];
        this.insights = [];
    }

    /**
     * ANA ANALİZ FONKSİYONU
     * Tüm sistemi analiz eder ve kararlar üretir
     */
    async analyzeSystem(userId) {
        // 1. VERİ TOPLAMA
        const systemData = await this.collectSystemData(userId);

        // 2. ANALİZ
        const analysis = await this.performAnalysis(systemData);

        // 3. KARAR ÜRETME
        const decisions = await this.generateDecisions(analysis);

        // 4. AKSİYON BELİRLEME
        const actions = await this.determineActions(decisions);

        return {
            systemData,
            analysis,
            decisions,
            actions,
            timestamp: new Date()
        };
    }

    /**
     * 1. VERİ TOPLAMA
     * Gerçek sistem verilerini toplar
     */
    async collectSystemData(userId) {
        const [products, orders, marketplaces] = await Promise.all([
            Product.find({ userId }).lean(),
            Order.find({ user: userId }).sort({ orderDate: -1 }).limit(1000).lean(),
            Marketplace.find({ userId }).lean()
        ]);

        // Ürün analizi
        const productAnalysis = this.analyzeProducts(products);

        // Sipariş analizi
        const orderAnalysis = this.analyzeOrders(orders, products);

        // Pazaryeri analizi
        const marketplaceAnalysis = this.analyzeMarketplaces(marketplaces);

        return {
            products,
            orders,
            marketplaces,
            productAnalysis,
            orderAnalysis,
            marketplaceAnalysis,
            stats: {
                totalProducts: products.length,
                totalOrders: orders.length,
                totalMarketplaces: marketplaces.length,
                totalRevenue: orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
            }
        };
    }

    /**
     * ÜRÜN ANALİZİ
     * Her ürünü detaylı analiz eder
     */
    analyzeProducts(products) {
        const analysis = {
            total: products.length,
            inStock: 0,
            outOfStock: 0,
            lowStock: 0,
            highValue: 0,
            lowValue: 0,
            profitMargins: [],
            categories: {},
            problems: [],
            opportunities: []
        };

        products.forEach(product => {
            const stock = product.stock || 0;
            const price = product.salePrice || product.price || 0;
            const listPrice = product.listPrice || price;
            const profitMargin = listPrice > 0 ? ((listPrice - price) / listPrice) * 100 : 0;

            // Stok durumu
            if (stock === 0) {
                analysis.outOfStock++;
                analysis.problems.push({
                    type: 'OUT_OF_STOCK',
                    severity: 'HIGH',
                    product: product.name,
                    barcode: product.barcode,
                    message: `${product.name} stokta yok - Satış kaybı riski`,
                    action: 'RESTOCK'
                });
            } else if (stock < 5) {
                analysis.lowStock++;
                analysis.problems.push({
                    type: 'LOW_STOCK',
                    severity: 'MEDIUM',
                    product: product.name,
                    barcode: product.barcode,
                    stock: stock,
                    message: `${product.name} stoğu kritik seviyede (${stock} adet)`,
                    action: 'RESTOCK'
                });
            } else {
                analysis.inStock++;
            }

            // Fiyat analizi
            if (price > 500) {
                analysis.highValue++;
            } else if (price < 50) {
                analysis.lowValue++;
            }

            // Kâr marjı
            analysis.profitMargins.push({
                product: product.name,
                barcode: product.barcode,
                margin: profitMargin,
                price: price,
                listPrice: listPrice
            });

            // Kategori analizi
            const category = product.category || 'Diğer';
            if (!analysis.categories[category]) {
                analysis.categories[category] = {
                    count: 0,
                    totalValue: 0,
                    avgPrice: 0
                };
            }
            analysis.categories[category].count++;
            analysis.categories[category].totalValue += price * stock;
        });

        // Kategori ortalamalarını hesapla
        Object.keys(analysis.categories).forEach(cat => {
            const catData = analysis.categories[cat];
            catData.avgPrice = catData.count > 0 ? catData.totalValue / catData.count : 0;
        });

        // Kâr marjı analizi
        const avgMargin = analysis.profitMargins.length > 0
            ? analysis.profitMargins.reduce((sum, p) => sum + p.margin, 0) / analysis.profitMargins.length
            : 0;

        analysis.avgProfitMargin = avgMargin;

        // Düşük kâr marjlı ürünler
        const lowMarginProducts = analysis.profitMargins.filter(p => p.margin < 10);
        if (lowMarginProducts.length > 0) {
            lowMarginProducts.forEach(p => {
                analysis.problems.push({
                    type: 'LOW_PROFIT',
                    severity: 'MEDIUM',
                    product: p.product,
                    barcode: p.barcode,
                    margin: p.margin.toFixed(2),
                    message: `${p.product} kâr marjı çok düşük (%${p.margin.toFixed(2)})`,
                    action: 'INCREASE_PRICE'
                });
            });
        }

        // Yüksek kâr marjlı ürünler (fırsat)
        const highMarginProducts = analysis.profitMargins.filter(p => p.margin > 40);
        if (highMarginProducts.length > 0) {
            highMarginProducts.forEach(p => {
                analysis.opportunities.push({
                    type: 'HIGH_PROFIT',
                    potential: 'HIGH',
                    product: p.product,
                    barcode: p.barcode,
                    margin: p.margin.toFixed(2),
                    message: `${p.product} yüksek kâr marjlı (%${p.margin.toFixed(2)}) - Stok artırılabilir`,
                    action: 'INCREASE_STOCK'
                });
            });
        }

        return analysis;
    }

    /**
     * SİPARİŞ ANALİZİ
     * Siparişleri ve satış performansını analiz eder
     */
    analyzeOrders(orders, products) {
        const analysis = {
            total: orders.length,
            totalRevenue: 0,
            avgOrderValue: 0,
            last7Days: { count: 0, revenue: 0 },
            last30Days: { count: 0, revenue: 0 },
            productPerformance: {},
            topProducts: [],
            worstProducts: [],
            trends: []
        };

        const now = Date.now();
        const day7 = 7 * 24 * 60 * 60 * 1000;
        const day30 = 30 * 24 * 60 * 60 * 1000;

        // Ürün performans haritası
        const productMap = new Map();
        products.forEach(p => {
            productMap.set(p.barcode, {
                name: p.name,
                barcode: p.barcode,
                stock: p.stock || 0,
                price: p.salePrice || p.price || 0,
                soldCount: 0,
                revenue: 0,
                lastSold: null
            });
        });

        orders.forEach(order => {
            const orderDate = new Date(order.orderDate).getTime();
            const orderValue = order.totalPrice || 0;

            analysis.totalRevenue += orderValue;

            // Zaman bazlı analiz
            if (now - orderDate < day7) {
                analysis.last7Days.count++;
                analysis.last7Days.revenue += orderValue;
            }
            if (now - orderDate < day30) {
                analysis.last30Days.count++;
                analysis.last30Days.revenue += orderValue;
            }

            // Ürün bazlı analiz
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const barcode = item.barcode;
                    if (productMap.has(barcode)) {
                        const prodData = productMap.get(barcode);
                        prodData.soldCount += item.quantity || 1;
                        prodData.revenue += (item.price || 0) * (item.quantity || 1);
                        if (!prodData.lastSold || orderDate > prodData.lastSold) {
                            prodData.lastSold = orderDate;
                        }
                    }
                });
            }
        });

        analysis.avgOrderValue = analysis.total > 0 ? analysis.totalRevenue / analysis.total : 0;

        // Ürün performansını sırala
        const productPerformanceArray = Array.from(productMap.values());

        // En çok satanlar
        analysis.topProducts = productPerformanceArray
            .filter(p => p.soldCount > 0)
            .sort((a, b) => b.soldCount - a.soldCount)
            .slice(0, 10);

        // Hiç satılmayanlar veya az satanlar
        const unsoldProducts = productPerformanceArray.filter(p => p.soldCount === 0);
        const lowSoldProducts = productPerformanceArray
            .filter(p => p.soldCount > 0 && p.soldCount < 3)
            .sort((a, b) => a.soldCount - b.soldCount);

        analysis.worstProducts = [...unsoldProducts, ...lowSoldProducts].slice(0, 10);

        // Trend analizi
        if (analysis.last7Days.count > 0 && analysis.last30Days.count > 0) {
            const weeklyAvg = analysis.last7Days.count / 7;
            const monthlyAvg = analysis.last30Days.count / 30;
            const trendChange = ((weeklyAvg - monthlyAvg) / monthlyAvg) * 100;

            analysis.trends.push({
                type: 'SALES_TREND',
                change: trendChange,
                direction: trendChange > 0 ? 'UP' : 'DOWN',
                message: trendChange > 0
                    ? `Satışlar artış trendinde (%${trendChange.toFixed(2)})`
                    : `Satışlar düşüş trendinde (%${Math.abs(trendChange).toFixed(2)})`
            });
        }

        return analysis;
    }

    /**
     * PAZARYERI ANALİZİ
     */
    analyzeMarketplaces(marketplaces) {
        const analysis = {
            total: marketplaces.length,
            active: 0,
            inactive: 0,
            byPlatform: {},
            problems: []
        };

        marketplaces.forEach(mp => {
            const platform = mp.marketplaceName || 'Unknown';

            if (!analysis.byPlatform[platform]) {
                analysis.byPlatform[platform] = {
                    count: 0,
                    active: 0,
                    inactive: 0
                };
            }

            analysis.byPlatform[platform].count++;

            if (mp.isActive) {
                analysis.active++;
                analysis.byPlatform[platform].active++;
            } else {
                analysis.inactive++;
                analysis.byPlatform[platform].inactive++;
                analysis.problems.push({
                    type: 'INACTIVE_MARKETPLACE',
                    severity: 'MEDIUM',
                    marketplace: platform,
                    message: `${platform} pazaryeri aktif değil`,
                    action: 'ACTIVATE'
                });
            }

            // Credentials kontrolü
            if (!mp.credentials || Object.keys(mp.credentials).length === 0) {
                analysis.problems.push({
                    type: 'MISSING_CREDENTIALS',
                    severity: 'HIGH',
                    marketplace: platform,
                    message: `${platform} için API bilgileri eksik`,
                    action: 'ADD_CREDENTIALS'
                });
            }
        });

        return analysis;
    }

    /**
     * 2. ANALİZ YAPMA
     * Toplanan verileri analiz eder
     */
    async performAnalysis(systemData) {

        const { productAnalysis, orderAnalysis, marketplaceAnalysis, stats } = systemData;

        const analysis = {
            health: {
                score: 0,
                level: 'UNKNOWN',
                factors: {}
            },
            problems: [],
            opportunities: [],
            risks: [],
            recommendations: []
        };

        // SAĞLIK SKORU HESAPLAMA
        let healthScore = 100;

        // Stok faktörü
        const stockFactor = productAnalysis.total > 0
            ? ((productAnalysis.inStock / productAnalysis.total) * 100)
            : 0;
        analysis.health.factors.stock = stockFactor;
        if (stockFactor < 70) healthScore -= 15;

        // Satış faktörü
        const salesFactor = orderAnalysis.last7Days.count > 0 ? 100 : 50;
        analysis.health.factors.sales = salesFactor;
        if (salesFactor < 70) healthScore -= 20;

        // Kâr faktörü
        const profitFactor = productAnalysis.avgProfitMargin > 20 ? 100 :
                            productAnalysis.avgProfitMargin > 10 ? 70 : 40;
        analysis.health.factors.profit = profitFactor;
        if (profitFactor < 70) healthScore -= 15;

        // Pazaryeri faktörü
        const marketplaceFactor = marketplaceAnalysis.total > 0
            ? ((marketplaceAnalysis.active / marketplaceAnalysis.total) * 100)
            : 0;
        analysis.health.factors.marketplace = marketplaceFactor;
        if (marketplaceFactor < 70) healthScore -= 10;

        analysis.health.score = Math.max(0, Math.min(100, healthScore));
        analysis.health.level = healthScore >= 80 ? 'EXCELLENT' :
                                healthScore >= 60 ? 'GOOD' :
                                healthScore >= 40 ? 'WARNING' : 'CRITICAL';

        // PROBLEMLER
        analysis.problems = [
            ...productAnalysis.problems,
            ...marketplaceAnalysis.problems
        ];

        // FIRSATLAR
        analysis.opportunities = productAnalysis.opportunities;

        // RİSKLER
        if (productAnalysis.outOfStock > 0) {
            analysis.risks.push({
                type: 'STOCK_RISK',
                severity: 'HIGH',
                message: `${productAnalysis.outOfStock} ürün stokta yok - Satış kaybı riski`,
                impact: 'Potansiyel gelir kaybı'
            });
        }

        if (orderAnalysis.last7Days.count === 0) {
            analysis.risks.push({
                type: 'NO_SALES',
                severity: 'CRITICAL',
                message: 'Son 7 günde hiç satış yok',
                impact: 'Acil aksiyon gerekli'
            });
        }

        return analysis;
    }

    /**
     * 3. KARAR ÜRETME
     * Analiz sonuçlarına göre akıllı kararlar üretir
     */
    async generateDecisions(analysis) {

        const decisions = [];

        // SAĞLIK DURUMUNA GÖRE KARARLAR
        if (analysis.health.level === 'CRITICAL') {
            decisions.push({
                id: 'CRITICAL_HEALTH',
                type: 'URGENT',
                priority: 'CRITICAL',
                title: '🚨 Sistem Sağlığı Kritik Seviyede',
                description: `Sağlık skoru: ${analysis.health.score}/100. Acil müdahale gerekiyor.`,
                reasoning: 'Birden fazla kritik sorun tespit edildi',
                actions: ['OPTIMIZE_SYSTEM', 'FIX_CRITICAL_ISSUES'],
                autoApply: false
            });
        }

        // PROBLEM BAZLI KARARLAR
        const criticalProblems = analysis.problems.filter(p => p.severity === 'HIGH');
        if (criticalProblems.length > 0) {
            criticalProblems.forEach(problem => {
                decisions.push({
                    id: `PROBLEM_${problem.type}_${problem.barcode || Date.now()}`,
                    type: 'PROBLEM',
                    priority: 'HIGH',
                    title: `⚠️ ${problem.message}`,
                    description: `Aksiyon: ${this.getActionDescription(problem.action)}`,
                    reasoning: `${problem.type} tespit edildi`,
                    actions: [problem.action],
                    autoApply: true,
                    data: problem
                });
            });
        }

        // FIRSAT BAZLI KARARLAR
        analysis.opportunities.forEach(opp => {
            decisions.push({
                id: `OPP_${opp.type}_${opp.barcode}`,
                type: 'OPPORTUNITY',
                priority: 'MEDIUM',
                title: `💡 ${opp.message}`,
                description: `Potansiyel: ${opp.potential}`,
                reasoning: `Yüksek kâr marjlı ürün tespit edildi`,
                actions: [opp.action],
                autoApply: false,
                data: opp
            });
        });

        // RİSK BAZLI KARARLAR
        analysis.risks.forEach(risk => {
            decisions.push({
                id: `RISK_${risk.type}_${Date.now()}`,
                type: 'RISK',
                priority: risk.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                title: `⚠️ ${risk.message}`,
                description: `Etki: ${risk.impact}`,
                reasoning: `${risk.type} riski tespit edildi`,
                actions: ['MITIGATE_RISK'],
                autoApply: false,
                data: risk
            });
        });

        return decisions;
    }

    /**
     * 4. AKSİYON BELİRLEME
     * Kararları uygulanabilir aksiyonlara dönüştürür
     */
    async determineActions(decisions) {
        const actions = [];

        decisions.forEach(decision => {
            decision.actions.forEach(actionType => {
                const action = this.createAction(actionType, decision);
                if (action) {
                    actions.push(action);
                }
            });
        });

        return actions;
    }

    /**
     * AKSİYON OLUŞTURMA
     */
    createAction(actionType, decision) {
        const actionMap = {
            'RESTOCK': {
                type: 'RESTOCK',
                title: 'Stok Ekle',
                description: `${decision.data?.product || 'Ürün'} için stok eklenmeli`,
                executable: true,
                params: {
                    barcode: decision.data?.barcode,
                    product: decision.data?.product,
                    currentStock: decision.data?.stock || 0,
                    recommendedStock: 20
                }
            },
            'INCREASE_PRICE': {
                type: 'INCREASE_PRICE',
                title: 'Fiyat Artır',
                description: `${decision.data?.product || 'Ürün'} fiyatı artırılmalı`,
                executable: true,
                params: {
                    barcode: decision.data?.barcode,
                    product: decision.data?.product,
                    currentMargin: decision.data?.margin,
                    recommendedIncrease: 10
                }
            },
            'INCREASE_STOCK': {
                type: 'INCREASE_STOCK',
                title: 'Stok Artır',
                description: `${decision.data?.product || 'Ürün'} yüksek kârlı - stok artırılmalı`,
                executable: true,
                params: {
                    barcode: decision.data?.barcode,
                    product: decision.data?.product,
                    reason: 'HIGH_PROFIT'
                }
            },
            'OPTIMIZE_SYSTEM': {
                type: 'OPTIMIZE_SYSTEM',
                title: 'Sistemi Optimize Et',
                description: 'Tüm sistem optimize edilecek',
                executable: true,
                params: {}
            },
            'FIX_CRITICAL_ISSUES': {
                type: 'FIX_CRITICAL_ISSUES',
                title: 'Kritik Sorunları Çöz',
                description: 'Kritik sorunlar düzeltilecek',
                executable: true,
                params: {}
            },
            'ACTIVATE': {
                type: 'ACTIVATE_MARKETPLACE',
                title: 'Pazaryeri Aktifleştir',
                description: `${decision.data?.marketplace || 'Pazaryeri'} aktifleştirilmeli`,
                executable: true,
                params: {
                    marketplace: decision.data?.marketplace
                }
            },
            'ADD_CREDENTIALS': {
                type: 'ADD_CREDENTIALS',
                title: 'API Bilgileri Ekle',
                description: `${decision.data?.marketplace || 'Pazaryeri'} için API bilgileri eklenmeli`,
                executable: false,
                params: {
                    marketplace: decision.data?.marketplace
                }
            },
            'MITIGATE_RISK': {
                type: 'MITIGATE_RISK',
                title: 'Riski Azalt',
                description: decision.data?.message || 'Risk azaltılmalı',
                executable: false,
                params: decision.data
            }
        };

        const actionTemplate = actionMap[actionType];
        if (!actionTemplate) return null;

        return {
            ...actionTemplate,
            id: `ACTION_${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            decisionId: decision.id,
            priority: decision.priority,
            autoApply: decision.autoApply,
            status: 'PENDING',
            createdAt: new Date()
        };
    }

    /**
     * AKSİYON AÇIKLAMASI
     */
    getActionDescription(actionType) {
        const descriptions = {
            'RESTOCK': 'Stok eklenmeli',
            'INCREASE_PRICE': 'Fiyat artırılmalı',
            'INCREASE_STOCK': 'Stok artırılmalı',
            'OPTIMIZE_SYSTEM': 'Sistem optimize edilmeli',
            'FIX_CRITICAL_ISSUES': 'Kritik sorunlar çözülmeli',
            'ACTIVATE': 'Aktifleştirilmeli',
            'ADD_CREDENTIALS': 'API bilgileri eklenmeli',
            'MITIGATE_RISK': 'Risk azaltılmalı'
        };
        return descriptions[actionType] || 'Aksiyon gerekli';
    }
}

module.exports = new AIDecisionEngine();
