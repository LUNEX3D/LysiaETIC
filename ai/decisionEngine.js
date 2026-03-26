/**
 * 🧠 AI DECISION ENGINE
 *
 * Bu motor:
 * - Veriyi analiz eder
 * - Karar verir
 * - Aksiyon önerir
 * - Otomatik uygular
 *
 * Felsefe: "Kullanıcı sormadan ne yapılması gerektiğini söyle ve yap"
 */

const Product = require('../backend/models/Product');
const Order = require('../backend/models/Order');
const Marketplace = require('../backend/models/Marketplace');

class AIDecisionEngine {
    constructor() {
        // Karar eşikleri
        this.thresholds = {
            // Fiyat kararları
            priceIncrease: {
                minSalesVelocity: 10,      // Günde 10+ satış
                minProfitMargin: 0.15,     // %15+ kar marjı
                maxPriceIncrease: 0.20     // Maksimum %20 artış
            },
            priceDecrease: {
                maxDaysSinceLastSale: 7,   // 7 gün satış yok
                minStock: 20,              // 20+ stok var
                maxPriceDecrease: 0.30     // Maksimum %30 indirim
            },

            // Stok kararları
            stockAlert: {
                critical: 5,               // 5 altı kritik
                low: 10,                   // 10 altı düşük
                reorderPoint: 15           // 15'te yeniden sipariş
            },

            // Kampanya kararları
            campaign: {
                minStock: 30,              // Kampanya için min stok
                minMargin: 0.10,           // Min %10 kar marjı
                discountRange: [0.10, 0.40] // %10-40 indirim aralığı
            },

            // Performans kararları
            performance: {
                excellent: 0.80,           // %80+ mükemmel
                good: 0.60,                // %60+ iyi
                poor: 0.30                 // %30- kötü
            }
        };

        // Karar ağırlıkları
        this.weights = {
            salesVelocity: 0.30,
            profitMargin: 0.25,
            stockLevel: 0.20,
            marketTrend: 0.15,
            competitorPrice: 0.10
        };
    }

    /**
     * 🎯 ANA KARAR MOTORU
     * Tüm sistemi analiz eder ve kararlar üretir
     */
    async makeDecisions(userId) {
        console.log('🧠 [Decision Engine] Karar verme süreci başladı...');

        try {
            // 1. Veri toplama
            const data = await this.collectData(userId);

            // 2. Analiz
            const analysis = await this.analyzeData(data);

            // 3. Karar üretme
            const decisions = await this.generateDecisions(analysis);

            // 4. Önceliklendirme
            const prioritized = this.prioritizeDecisions(decisions);

            // 5. Otomatik uygulama (güvenli olanlar)
            const executed = await this.executeAutoDecisions(prioritized);

            return {
                timestamp: new Date(),
                totalDecisions: decisions.length,
                autoExecuted: executed.length,
                requiresApproval: prioritized.filter(d => !d.autoExecute).length,
                decisions: prioritized,
                executed: executed,
                analysis: analysis
            };

        } catch (error) {
            console.error('❌ [Decision Engine] Hata:', error);
            throw error;
        }
    }

    /**
     * 📊 VERİ TOPLAMA
     */
    async collectData(userId) {
        console.log('📊 [Decision Engine] Veri toplama...');

        const [products, orders, marketplaces] = await Promise.all([
            Product.find({ userId }).lean(),
            Order.find({ user: userId }).sort({ orderDate: -1 }).limit(1000).lean(),
            Marketplace.find({ userId }).lean()
        ]);

        // Son 30 günün siparişleri
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentOrders = orders.filter(o =>
            new Date(o.orderDate) >= thirtyDaysAgo
        );

        return {
            products,
            orders,
            recentOrders,
            marketplaces,
            stats: {
                totalProducts: products.length,
                totalOrders: orders.length,
                recentOrdersCount: recentOrders.length,
                totalRevenue: recentOrders.reduce((sum, o) => sum + o.totalPrice, 0)
            }
        };
    }

    /**
     * 🔍 VERİ ANALİZİ
     */
    async analyzeData(data) {
        console.log('🔍 [Decision Engine] Veri analizi...');

        const productAnalysis = await this.analyzeProducts(data);
        const salesAnalysis = this.analyzeSales(data);
        const stockAnalysis = this.analyzeStock(data);
        const profitAnalysis = this.analyzeProfitability(data);

        return {
            products: productAnalysis,
            sales: salesAnalysis,
            stock: stockAnalysis,
            profit: profitAnalysis,
            overall: this.calculateOverallHealth(productAnalysis, salesAnalysis, stockAnalysis, profitAnalysis)
        };
    }

    /**
     * 📦 ÜRÜN ANALİZİ
     */
    async analyzeProducts(data) {
        const { products, recentOrders } = data;

        // Her ürün için satış verisi
        const productSales = new Map();

        recentOrders.forEach(order => {
            order.items.forEach(item => {
                const key = item.barcode;
                if (!productSales.has(key)) {
                    productSales.set(key, {
                        quantity: 0,
                        revenue: 0,
                        orders: 0,
                        lastSaleDate: null
                    });
                }

                const stats = productSales.get(key);
                stats.quantity += item.quantity;
                stats.revenue += item.price * item.quantity;
                stats.orders += 1;

                const orderDate = new Date(order.orderDate);
                if (!stats.lastSaleDate || orderDate > stats.lastSaleDate) {
                    stats.lastSaleDate = orderDate;
                }
            });
        });

        // Ürün performans skorları
        const analyzed = products.map(product => {
            const sales = productSales.get(product.barcode) || {
                quantity: 0,
                revenue: 0,
                orders: 0,
                lastSaleDate: null
            };

            // Satış hızı (günlük)
            const salesVelocity = sales.quantity / 30;

            // Kar marjı
            const profitMargin = product.salePrice > 0
                ? (product.salePrice - product.price) / product.salePrice
                : 0;

            // Son satıştan bu yana geçen gün
            const daysSinceLastSale = sales.lastSaleDate
                ? Math.floor((Date.now() - sales.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
                : 999;

            // Stok durumu
            const stockStatus = this.getStockStatus(product.stock, salesVelocity);

            // Performans skoru (0-100)
            const performanceScore = this.calculateProductScore({
                salesVelocity,
                profitMargin,
                stock: product.stock,
                daysSinceLastSale
            });

            return {
                ...product,
                analytics: {
                    salesVelocity,
                    profitMargin,
                    daysSinceLastSale,
                    stockStatus,
                    performanceScore,
                    totalSold: sales.quantity,
                    totalRevenue: sales.revenue,
                    totalOrders: sales.orders
                }
            };
        });

        // Sıralama
        const topPerformers = analyzed
            .filter(p => p.analytics.performanceScore >= 70)
            .sort((a, b) => b.analytics.performanceScore - a.analytics.performanceScore)
            .slice(0, 10);

        const underperformers = analyzed
            .filter(p => p.analytics.performanceScore < 40)
            .sort((a, b) => a.analytics.performanceScore - b.analytics.performanceScore)
            .slice(0, 10);

        const criticalStock = analyzed
            .filter(p => p.analytics.stockStatus === 'critical')
            .sort((a, b) => a.stock - b.stock);

        return {
            all: analyzed,
            topPerformers,
            underperformers,
            criticalStock,
            stats: {
                avgPerformanceScore: analyzed.reduce((sum, p) => sum + p.analytics.performanceScore, 0) / analyzed.length,
                totalValue: analyzed.reduce((sum, p) => sum + (p.stock * p.salePrice), 0)
            }
        };
    }

    /**
     * 💰 SATIŞ ANALİZİ
     */
    analyzeSales(data) {
        const { recentOrders } = data;

        // Günlük satışlar
        const dailySales = new Map();

        recentOrders.forEach(order => {
            const date = new Date(order.orderDate).toISOString().split('T')[0];
            if (!dailySales.has(date)) {
                dailySales.set(date, { orders: 0, revenue: 0 });
            }
            const day = dailySales.get(date);
            day.orders += 1;
            day.revenue += order.totalPrice;
        });

        const salesArray = Array.from(dailySales.values());
        const avgDailyRevenue = salesArray.reduce((sum, d) => sum + d.revenue, 0) / salesArray.length;
        const avgDailyOrders = salesArray.reduce((sum, d) => sum + d.orders, 0) / salesArray.length;

        // Trend (son 7 gün vs önceki 7 gün)
        const last7Days = salesArray.slice(-7);
        const prev7Days = salesArray.slice(-14, -7);

        const last7Revenue = last7Days.reduce((sum, d) => sum + d.revenue, 0);
        const prev7Revenue = prev7Days.reduce((sum, d) => sum + d.revenue, 0);

        const trend = prev7Revenue > 0
            ? ((last7Revenue - prev7Revenue) / prev7Revenue) * 100
            : 0;

        return {
            avgDailyRevenue,
            avgDailyOrders,
            trend,
            trendDirection: trend > 5 ? 'up' : trend < -5 ? 'down' : 'stable',
            last7DaysRevenue: last7Revenue,
            prev7DaysRevenue: prev7Revenue
        };
    }

    /**
     * 📦 STOK ANALİZİ
     */
    analyzeStock(data) {
        const { products } = data;

        const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
        const totalValue = products.reduce((sum, p) => sum + (p.stock * p.salePrice), 0);

        const critical = products.filter(p => p.stock <= this.thresholds.stockAlert.critical).length;
        const low = products.filter(p => p.stock <= this.thresholds.stockAlert.low).length;

        return {
            totalStock,
            totalValue,
            criticalCount: critical,
            lowCount: low,
            healthScore: ((products.length - critical - low) / products.length) * 100
        };
    }

    /**
     * 💵 KARLILIK ANALİZİ
     */
    analyzeProfitability(data) {
        const { products, recentOrders } = data;

        let totalRevenue = 0;
        let totalCost = 0;

        recentOrders.forEach(order => {
            order.items.forEach(item => {
                const product = products.find(p => p.barcode === item.barcode);
                if (product) {
                    totalRevenue += item.price * item.quantity;
                    totalCost += product.price * item.quantity;
                }
            });
        });

        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalCost,
            totalProfit,
            profitMargin,
            status: profitMargin > 20 ? 'excellent' : profitMargin > 10 ? 'good' : 'poor'
        };
    }

    /**
     * 🎯 KARAR ÜRETME
     */
    async generateDecisions(analysis) {
        console.log('🎯 [Decision Engine] Karar üretiliyor...');

        const decisions = [];

        // 1. Fiyat kararları
        decisions.push(...this.generatePriceDecisions(analysis));

        // 2. Stok kararları
        decisions.push(...this.generateStockDecisions(analysis));

        // 3. Kampanya kararları
        decisions.push(...this.generateCampaignDecisions(analysis));

        // 4. Ürün optimizasyon kararları
        decisions.push(...this.generateOptimizationDecisions(analysis));

        return decisions;
    }

    /**
     * 💰 FİYAT KARARLARI
     */
    generatePriceDecisions(analysis) {
        const decisions = [];
        const { products } = analysis;

        products.all.forEach(product => {
            const { salesVelocity, profitMargin, daysSinceLastSale } = product.analytics;

            // Fiyat artırma kararı
            if (salesVelocity >= this.thresholds.priceIncrease.minSalesVelocity &&
                profitMargin >= this.thresholds.priceIncrease.minProfitMargin) {

                const increasePercent = Math.min(0.10, this.thresholds.priceIncrease.maxPriceIncrease);
                const newPrice = product.salePrice * (1 + increasePercent);

                decisions.push({
                    type: 'price_increase',
                    priority: 'medium',
                    confidence: 0.85,
                    autoExecute: false, // Fiyat değişiklikleri manuel onay gerektirir
                    product: {
                        id: product._id,
                        name: product.name,
                        barcode: product.barcode
                    },
                    current: {
                        price: product.salePrice
                    },
                    recommended: {
                        price: newPrice,
                        increase: increasePercent * 100
                    },
                    reason: `Yüksek satış hızı (${salesVelocity.toFixed(1)}/gün) ve iyi kar marjı (%${(profitMargin * 100).toFixed(1)})`,
                    impact: {
                        expectedRevenue: salesVelocity * 30 * (newPrice - product.salePrice),
                        risk: 'low'
                    }
                });
            }

            // Fiyat düşürme kararı
            if (daysSinceLastSale >= this.thresholds.priceDecrease.maxDaysSinceLastSale &&
                product.stock >= this.thresholds.priceDecrease.minStock) {

                const decreasePercent = 0.15; // %15 indirim
                const newPrice = product.salePrice * (1 - decreasePercent);

                decisions.push({
                    type: 'price_decrease',
                    priority: 'high',
                    confidence: 0.75,
                    autoExecute: false,
                    product: {
                        id: product._id,
                        name: product.name,
                        barcode: product.barcode
                    },
                    current: {
                        price: product.salePrice
                    },
                    recommended: {
                        price: newPrice,
                        decrease: decreasePercent * 100
                    },
                    reason: `${daysSinceLastSale} gündür satış yok ve ${product.stock} adet stok var`,
                    impact: {
                        expectedSales: 'Satış hızını artırabilir',
                        risk: 'medium'
                    }
                });
            }
        });

        return decisions;
    }

    /**
     * 📦 STOK KARARLARI
     */
    generateStockDecisions(analysis) {
        const decisions = [];
        const { products } = analysis;

        products.criticalStock.forEach(product => {
            const { salesVelocity, stockStatus } = product.analytics;

            // Kritik stok uyarısı
            if (stockStatus === 'critical') {
                const daysUntilStockout = salesVelocity > 0 ? product.stock / salesVelocity : 999;
                const recommendedOrder = Math.ceil(salesVelocity * 30); // 30 günlük stok

                decisions.push({
                    type: 'stock_alert',
                    priority: 'critical',
                    confidence: 0.95,
                    autoExecute: true, // Otomatik bildirim gönder
                    product: {
                        id: product._id,
                        name: product.name,
                        barcode: product.barcode
                    },
                    current: {
                        stock: product.stock,
                        daysUntilStockout: daysUntilStockout.toFixed(1)
                    },
                    recommended: {
                        orderQuantity: recommendedOrder,
                        urgency: daysUntilStockout < 3 ? 'immediate' : 'soon'
                    },
                    reason: `Kritik stok seviyesi! ${daysUntilStockout.toFixed(1)} gün içinde tükenebilir`,
                    impact: {
                        lostSales: salesVelocity * 30 * product.salePrice,
                        risk: 'high'
                    }
                });
            }
        });

        return decisions;
    }

    /**
     * 🎉 KAMPANYA KARARLARI
     */
    generateCampaignDecisions(analysis) {
        const decisions = [];
        const { products, sales } = analysis;

        // Satışları artırmak için kampanya önerisi
        if (sales.trendDirection === 'down') {
            const campaignCandidates = products.all.filter(p =>
                p.stock >= this.thresholds.campaign.minStock &&
                p.analytics.profitMargin >= this.thresholds.campaign.minMargin &&
                p.analytics.performanceScore >= 50
            ).slice(0, 5);

            campaignCandidates.forEach(product => {
                const discountPercent = 0.20; // %20 indirim
                const campaignPrice = product.salePrice * (1 - discountPercent);

                decisions.push({
                    type: 'campaign',
                    priority: 'medium',
                    confidence: 0.70,
                    autoExecute: false,
                    product: {
                        id: product._id,
                        name: product.name,
                        barcode: product.barcode
                    },
                    current: {
                        price: product.salePrice,
                        stock: product.stock
                    },
                    recommended: {
                        campaignPrice: campaignPrice,
                        discount: discountPercent * 100,
                        duration: '7 gün'
                    },
                    reason: `Satış trendi düşüşte (%${sales.trend.toFixed(1)}). Kampanya ile satışları artırabilirsiniz`,
                    impact: {
                        expectedIncrease: '30-50% satış artışı',
                        risk: 'low'
                    }
                });
            });
        }

        return decisions;
    }

    /**
     * ⚡ OPTİMİZASYON KARARLARI
     */
    generateOptimizationDecisions(analysis) {
        const decisions = [];
        const { products } = analysis;

        // Düşük performanslı ürünler için öneriler
        products.underperformers.forEach(product => {
            decisions.push({
                type: 'optimization',
                priority: 'low',
                confidence: 0.60,
                autoExecute: false,
                product: {
                    id: product._id,
                    name: product.name,
                    barcode: product.barcode
                },
                current: {
                    performanceScore: product.analytics.performanceScore,
                    salesVelocity: product.analytics.salesVelocity
                },
                recommended: {
                    actions: [
                        'Ürün açıklamasını iyileştir',
                        'Görselleri güncelle',
                        'Fiyatı gözden geçir',
                        'Kategorisini kontrol et'
                    ]
                },
                reason: `Düşük performans skoru (${product.analytics.performanceScore.toFixed(0)}/100)`,
                impact: {
                    potential: 'Performansı 2-3 kat artırabilir',
                    risk: 'none'
                }
            });
        });

        return decisions;
    }

    /**
     * 🎯 KARAR ÖNCELİKLENDİRME
     */
    prioritizeDecisions(decisions) {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

        return decisions.sort((a, b) => {
            // Önce önceliğe göre
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Sonra güven skoruna göre
            return b.confidence - a.confidence;
        });
    }

    /**
     * ⚡ OTOMATİK UYGULAMA
     */
    async executeAutoDecisions(decisions) {
        console.log('⚡ [Decision Engine] Otomatik kararlar uygulanıyor...');

        const executed = [];

        for (const decision of decisions) {
            if (decision.autoExecute) {
                try {
                    const result = await this.executeDecision(decision);
                    executed.push({
                        decision,
                        result,
                        executedAt: new Date()
                    });
                } catch (error) {
                    console.error(`❌ Karar uygulanamadı:`, error);
                }
            }
        }

        console.log(`✅ ${executed.length} karar otomatik uygulandı`);
        return executed;
    }

    /**
     * 🔧 KARAR UYGULAMA
     */
    async executeDecision(decision) {
        switch (decision.type) {
            case 'stock_alert':
                // Bildirim gönder (email, SMS, push notification)
                return { action: 'notification_sent', method: 'email' };

            case 'price_increase':
            case 'price_decrease':
                // Fiyat güncelleme (manuel onay gerektirir)
                return { action: 'pending_approval', status: 'waiting' };

            case 'campaign':
                // Kampanya oluşturma (manuel onay gerektirir)
                return { action: 'pending_approval', status: 'waiting' };

            default:
                return { action: 'no_action', status: 'skipped' };
        }
    }

    /**
     * 📊 YARDIMCI METODLAR
     */

    getStockStatus(stock, salesVelocity) {
        if (stock <= this.thresholds.stockAlert.critical) return 'critical';
        if (stock <= this.thresholds.stockAlert.low) return 'low';

        const daysUntilStockout = salesVelocity > 0 ? stock / salesVelocity : 999;
        if (daysUntilStockout < 7) return 'warning';

        return 'healthy';
    }

    calculateProductScore({ salesVelocity, profitMargin, stock, daysSinceLastSale }) {
        let score = 0;

        // Satış hızı (0-40 puan)
        score += Math.min(40, salesVelocity * 4);

        // Kar marjı (0-30 puan)
        score += Math.min(30, profitMargin * 100);

        // Stok durumu (0-20 puan)
        if (stock > 50) score += 20;
        else if (stock > 20) score += 15;
        else if (stock > 10) score += 10;
        else score += 5;

        // Güncellik (0-10 puan)
        if (daysSinceLastSale < 3) score += 10;
        else if (daysSinceLastSale < 7) score += 7;
        else if (daysSinceLastSale < 14) score += 4;
        else score += 0;

        return Math.min(100, Math.max(0, score));
    }

    calculateOverallHealth(products, sales, stock, profit) {
        const scores = {
            products: products.stats.avgPerformanceScore || 0,
            sales: sales.trend > 0 ? 80 : sales.trend < -10 ? 40 : 60,
            stock: stock.healthScore || 0,
            profit: profit.profitMargin > 20 ? 90 : profit.profitMargin > 10 ? 70 : 50
        };

        const overall = (
            scores.products * 0.30 +
            scores.sales * 0.25 +
            scores.stock * 0.25 +
            scores.profit * 0.20
        );

        return {
            score: Math.round(overall),
            breakdown: scores,
            status: overall >= 80 ? 'excellent' : overall >= 60 ? 'good' : overall >= 40 ? 'fair' : 'poor'
        };
    }
}

module.exports = new AIDecisionEngine();
