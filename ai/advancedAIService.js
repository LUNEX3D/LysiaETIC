const {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders
} = require("../backend/services/ordersService");

/**
 * Advanced AI Service for E-commerce Analytics
 *
 * Features:
 * - Predictive Analytics (Sales Forecasting with Linear Regression)
 * - Dynamic Price Optimization
 * - Intelligent Inventory Management
 * - Customer Behavior Analysis
 * - Anomaly Detection (Statistical Analysis)
 * - Smart Recommendations Engine
 * - Seasonality Detection
 * - Trend Analysis
 * - Competitor Price Analysis
 * - Product Performance Scoring
 */
class AdvancedAIService {
    constructor() {
        this.supportedMarketplaces = new Set(["trendyol", "hepsiburada", "n11", "ciceksepeti"]);
        this.requiredCredentials = {
            trendyol: ["sellerId", "apiKey", "apiSecret"],
            hepsiburada: ["merchantId", "apiKey"],
            n11: ["apiKey", "secretKey"],
            ciceksepeti: ["supplierId", "apiKey"]
        };

        // AI Configuration
        this.config = {
            forecastDays: 30,
            minDataPoints: 7,
            anomalyThreshold: 2.5, // Standard deviations
            priceOptimizationRange: 0.15, // ±15%
            lowStockThreshold: 10,
            highCancelRateThreshold: 0.15, // 15%
            seasonalityWindow: 90, // days
            trendWindow: 30, // days
            confidenceLevel: 0.95,
            minOrdersForAnalysis: 5
        };

        // Cache for performance
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // ==================== UTILITY METHODS ====================

    getIstanbulTimestamp(date = new Date()) {
        return new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();
    }

    normalizeMarketplaceName(name = "") {
        return name
            .toLowerCase()
            .replace(/ç/g, "c")
            .replace(/ğ/g, "g")
            .replace(/ı/g, "i")
            .replace(/ö/g, "o")
            .replace(/ş/g, "s")
            .replace(/ü/g, "u")
            .trim();
    }

    formatCurrency(value) {
        const amount = Number(value || 0);
        try {
            return new Intl.NumberFormat("tr-TR", {
                style: "currency",
                currency: "TRY",
                maximumFractionDigits: 2
            }).format(amount);
        } catch (error) {
            return `${amount.toFixed(2)} TRY`;
        }
    }

    parseNumber(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const cleaned = String(value).replace(/[^0-9.-]/g, "");
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    // ==================== STATISTICAL METHODS ====================

    /**
     * Calculate mean (average)
     */
    calculateMean(values) {
        if (!values || values.length === 0) return 0;
        const sum = values.reduce((acc, val) => acc + this.parseNumber(val), 0);
        return sum / values.length;
    }

    /**
     * Calculate standard deviation
     */
    calculateStdDev(values) {
        if (!values || values.length < 2) return 0;
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(val => Math.pow(this.parseNumber(val) - mean, 2));
        const variance = this.calculateMean(squaredDiffs);
        return Math.sqrt(variance);
    }

    /**
     * Calculate median
     */
    calculateMedian(values) {
        if (!values || values.length === 0) return 0;
        const sorted = [...values].map(v => this.parseNumber(v)).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    /**
     * Calculate percentile
     */
    calculatePercentile(values, percentile) {
        if (!values || values.length === 0) return 0;
        const sorted = [...values].map(v => this.parseNumber(v)).sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    /**
     * Linear Regression for forecasting
     */
    linearRegression(xValues, yValues) {
        const n = xValues.length;
        if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
        const sumY2 = yValues.reduce((sum, y) => sum + y * y, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R² (coefficient of determination)
        const yMean = sumY / n;
        const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
        const ssResidual = yValues.reduce((sum, y, i) => {
            const predicted = slope * xValues[i] + intercept;
            return sum + Math.pow(y - predicted, 2);
        }, 0);
        const r2 = 1 - (ssResidual / ssTotal);

        return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
    }

    /**
     * Exponential Smoothing for time series
     */
    exponentialSmoothing(values, alpha = 0.3) {
        if (!values || values.length === 0) return [];
        const smoothed = [values[0]];
        for (let i = 1; i < values.length; i++) {
            smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
        }
        return smoothed;
    }

    // ==================== DATA EXTRACTION ====================

    extractOrderLines(order) {
        const lines = Array.isArray(order.products)
            ? order.products
            : Array.isArray(order.lines)
                ? order.lines
                : [];

        return lines.map(item => ({
            productName: item.productName || item.name || "Bilinmeyen Ürün",
            barcode: item.barcode || null,
            quantity: Number(item.quantity || 1),
            price: this.parseNumber(item.price || item.itemPrice || 0),
            imageUrl: item.imageUrl || null
        }));
    }

    /**
     * Group orders by day
     */
    groupOrdersByDay(orders) {
        const grouped = new Map();

        orders.forEach(order => {
            const orderDate = order.orderDate ? new Date(order.orderDate) : null;
            if (!orderDate || isNaN(orderDate.getTime())) return;

            const dayKey = orderDate.toISOString().split('T')[0];
            if (!grouped.has(dayKey)) {
                grouped.set(dayKey, {
                    date: dayKey,
                    orders: [],
                    count: 0,
                    revenue: 0
                });
            }

            const dayData = grouped.get(dayKey);
            dayData.orders.push(order);
            dayData.count += 1;

            const lines = this.extractOrderLines(order);
            const orderRevenue = lines.reduce((sum, item) =>
                sum + (item.price * item.quantity), 0
            ) || this.parseNumber(order.totalPrice || 0);

            dayData.revenue += orderRevenue;
        });

        return Array.from(grouped.values()).sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );
    }

    // ==================== ADVANCED ANALYTICS ====================

    /**
     * Sales Forecasting using Linear Regression
     */
    forecastSales(orders, forecastDays = 30) {
        const dailyData = this.groupOrdersByDay(orders);

        if (dailyData.length < this.config.minDataPoints) {
            return {
                forecast: [],
                confidence: 0,
                trend: "insufficient_data",
                message: "Tahmin için yeterli veri yok (minimum 7 gün gerekli)"
            };
        }

        // Prepare data for regression
        const xValues = dailyData.map((_, index) => index);
        const yOrders = dailyData.map(d => d.count);
        const yRevenue = dailyData.map(d => d.revenue);

        // Calculate regression for orders and revenue
        const orderRegression = this.linearRegression(xValues, yOrders);
        const revenueRegression = this.linearRegression(xValues, yRevenue);

        // Generate forecast
        const forecast = [];
        const lastIndex = dailyData.length - 1;
        const lastDate = new Date(dailyData[lastIndex].date);

        for (let i = 1; i <= forecastDays; i++) {
            const futureIndex = lastIndex + i;
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + i);

            const predictedOrders = Math.max(0, Math.round(
                orderRegression.slope * futureIndex + orderRegression.intercept
            ));
            const predictedRevenue = Math.max(0,
                revenueRegression.slope * futureIndex + revenueRegression.intercept
            );

            forecast.push({
                date: futureDate.toISOString().split('T')[0],
                predictedOrders,
                predictedRevenue,
                confidence: (orderRegression.r2 + revenueRegression.r2) / 2
            });
        }

        // Determine trend
        const trend = orderRegression.slope > 0.5 ? "increasing"
                    : orderRegression.slope < -0.5 ? "decreasing"
                    : "stable";

        return {
            forecast,
            confidence: (orderRegression.r2 + revenueRegression.r2) / 2,
            trend,
            regression: {
                orders: orderRegression,
                revenue: revenueRegression
            },
            historicalAverage: {
                dailyOrders: this.calculateMean(yOrders),
                dailyRevenue: this.calculateMean(yRevenue)
            }
        };
    }

    /**
     * Anomaly Detection using Statistical Methods
     */
    detectAnomalies(orders) {
        const dailyData = this.groupOrdersByDay(orders);

        if (dailyData.length < this.config.minDataPoints) {
            return { anomalies: [], message: "Yeterli veri yok" };
        }

        const revenues = dailyData.map(d => d.revenue);
        const orderCounts = dailyData.map(d => d.count);

        const revenueMean = this.calculateMean(revenues);
        const revenueStdDev = this.calculateStdDev(revenues);
        const orderMean = this.calculateMean(orderCounts);
        const orderStdDev = this.calculateStdDev(orderCounts);

        const anomalies = [];

        dailyData.forEach((day, index) => {
            const revenueZScore = Math.abs((day.revenue - revenueMean) / revenueStdDev);
            const orderZScore = Math.abs((day.count - orderMean) / orderStdDev);

            if (revenueZScore > this.config.anomalyThreshold) {
                anomalies.push({
                    date: day.date,
                    type: "revenue",
                    value: day.revenue,
                    expected: revenueMean,
                    deviation: revenueZScore,
                    severity: revenueZScore > 3 ? "high" : "medium",
                    direction: day.revenue > revenueMean ? "spike" : "drop"
                });
            }

            if (orderZScore > this.config.anomalyThreshold) {
                anomalies.push({
                    date: day.date,
                    type: "orders",
                    value: day.count,
                    expected: orderMean,
                    deviation: orderZScore,
                    severity: orderZScore > 3 ? "high" : "medium",
                    direction: day.count > orderMean ? "spike" : "drop"
                });
            }
        });

        return {
            anomalies,
            statistics: {
                revenue: { mean: revenueMean, stdDev: revenueStdDev },
                orders: { mean: orderMean, stdDev: orderStdDev }
            }
        };
    }

    /**
     * Product Performance Analysis
     */
    analyzeProductPerformance(orders) {
        const productStats = new Map();

        orders.forEach(order => {
            const lines = this.extractOrderLines(order);
            const orderDate = order.orderDate ? new Date(order.orderDate).getTime() : Date.now();
            const isRecent = orderDate > (Date.now() - 7 * 24 * 60 * 60 * 1000);

            lines.forEach(item => {
                const key = item.barcode || item.productName;
                if (!productStats.has(key)) {
                    productStats.set(key, {
                        name: item.productName,
                        barcode: item.barcode,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orderCount: 0,
                        recentQuantity: 0,
                        prices: [],
                        lastOrderDate: null
                    });
                }

                const stats = productStats.get(key);
                stats.totalQuantity += item.quantity;
                stats.totalRevenue += item.price * item.quantity;
                stats.orderCount += 1;
                stats.prices.push(item.price);

                if (isRecent) {
                    stats.recentQuantity += item.quantity;
                }

                if (!stats.lastOrderDate || orderDate > stats.lastOrderDate) {
                    stats.lastOrderDate = orderDate;
                }
            });
        });

        // Calculate performance scores
        const products = Array.from(productStats.values()).map(product => {
            const avgPrice = this.calculateMean(product.prices);
            const priceVariance = this.calculateStdDev(product.prices);
            const daysSinceLastOrder = product.lastOrderDate
                ? Math.floor((Date.now() - product.lastOrderDate) / (24 * 60 * 60 * 1000))
                : 999;

            // Performance score (0-100)
            const revenueScore = Math.min(100, (product.totalRevenue / 1000) * 10);
            const velocityScore = Math.min(100, product.recentQuantity * 10);
            const recencyScore = Math.max(0, 100 - daysSinceLastOrder * 2);
            const performanceScore = (revenueScore * 0.4 + velocityScore * 0.3 + recencyScore * 0.3);

            return {
                ...product,
                avgPrice,
                priceVariance,
                daysSinceLastOrder,
                performanceScore: Math.round(performanceScore),
                category: performanceScore > 70 ? "star"
                        : performanceScore > 40 ? "average"
                        : "underperforming"
            };
        });

        // Sort by performance score
        products.sort((a, b) => b.performanceScore - a.performanceScore);

        return {
            products,
            topPerformers: products.slice(0, 10),
            underperformers: products.filter(p => p.category === "underperforming"),
            totalProducts: products.length
        };
    }

    /**
     * Dynamic Price Optimization
     */
    optimizePrice(product, marketData = {}) {
        const { avgPrice, priceVariance, totalQuantity, totalRevenue, recentQuantity } = product;

        if (!avgPrice || avgPrice === 0) {
            return {
                currentPrice: 0,
                recommendedPrice: 0,
                change: 0,
                reason: "Fiyat verisi yok"
            };
        }

        // Calculate demand elasticity (simplified)
        const demandTrend = recentQuantity > (totalQuantity / 4) ? "high" : "low";

        // Base recommendation on current price
        let recommendedPrice = avgPrice;
        let reason = "Mevcut fiyat optimal";

        // High demand + low variance = increase price
        if (demandTrend === "high" && priceVariance < avgPrice * 0.1) {
            recommendedPrice = avgPrice * 1.05;
            reason = "Yüksek talep - fiyat artırımı öneriliyor";
        }
        // Low demand = decrease price
        else if (demandTrend === "low") {
            recommendedPrice = avgPrice * 0.95;
            reason = "Düşük talep - fiyat indirimi öneriliyor";
        }
        // High variance = stabilize
        else if (priceVariance > avgPrice * 0.2) {
            recommendedPrice = this.calculateMedian(product.prices);
            reason = "Fiyat istikrarı için medyan fiyat öneriliyor";
        }

        // Apply optimization range limit
        const maxPrice = avgPrice * (1 + this.config.priceOptimizationRange);
        const minPrice = avgPrice * (1 - this.config.priceOptimizationRange);
        recommendedPrice = Math.max(minPrice, Math.min(maxPrice, recommendedPrice));

        return {
            currentPrice: avgPrice,
            recommendedPrice: Math.round(recommendedPrice * 100) / 100,
            change: ((recommendedPrice - avgPrice) / avgPrice) * 100,
            changeAmount: recommendedPrice - avgPrice,
            reason,
            confidence: priceVariance < avgPrice * 0.1 ? "high" : "medium"
        };
    }

    /**
     * Customer Behavior Analysis
     */
    analyzeCustomerBehavior(orders) {
        const hourlyDistribution = new Array(24).fill(0);
        const weekdayDistribution = new Array(7).fill(0);
        const customerFrequency = new Map();
        const avgOrderValues = [];

        orders.forEach(order => {
            const orderDate = order.orderDate ? new Date(order.orderDate) : null;
            if (!orderDate || isNaN(orderDate.getTime())) return;

            // Hour distribution
            hourlyDistribution[orderDate.getHours()]++;

            // Weekday distribution (0 = Sunday)
            weekdayDistribution[orderDate.getDay()]++;

            // Customer frequency
            const customerName = order.customerName || "Unknown";
            customerFrequency.set(customerName, (customerFrequency.get(customerName) || 0) + 1);

            // Order value
            const lines = this.extractOrderLines(order);
            const orderValue = lines.reduce((sum, item) =>
                sum + (item.price * item.quantity), 0
            ) || this.parseNumber(order.totalPrice || 0);
            avgOrderValues.push(orderValue);
        });

        // Find peak hours
        const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
        const peakDay = weekdayDistribution.indexOf(Math.max(...weekdayDistribution));
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

        // Repeat customers
        const repeatCustomers = Array.from(customerFrequency.entries())
            .filter(([_, count]) => count > 1)
            .length;

        return {
            peakHour: `${peakHour}:00`,
            peakDay: dayNames[peakDay],
            hourlyDistribution,
            weekdayDistribution,
            repeatCustomerRate: (repeatCustomers / customerFrequency.size) * 100,
            avgOrderValue: this.calculateMean(avgOrderValues),
            medianOrderValue: this.calculateMedian(avgOrderValues),
            orderValuePercentiles: {
                p25: this.calculatePercentile(avgOrderValues, 25),
                p50: this.calculatePercentile(avgOrderValues, 50),
                p75: this.calculatePercentile(avgOrderValues, 75),
                p90: this.calculatePercentile(avgOrderValues, 90)
            }
        };
    }

    /**
     * Seasonality Detection
     */
    detectSeasonality(orders) {
        const dailyData = this.groupOrdersByDay(orders);

        if (dailyData.length < 30) {
            return {
                hasSeasonality: false,
                message: "Mevsimsellik analizi için en az 30 günlük veri gerekli"
            };
        }

        const revenues = dailyData.map(d => d.revenue);
        const smoothed = this.exponentialSmoothing(revenues, 0.3);

        // Calculate trend
        const firstHalf = smoothed.slice(0, Math.floor(smoothed.length / 2));
        const secondHalf = smoothed.slice(Math.floor(smoothed.length / 2));

        const firstHalfAvg = this.calculateMean(firstHalf);
        const secondHalfAvg = this.calculateMean(secondHalf);
        const trendChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

        return {
            hasSeasonality: Math.abs(trendChange) > 20,
            trendChange,
            direction: trendChange > 0 ? "increasing" : "decreasing",
            smoothedData: smoothed,
            recommendation: Math.abs(trendChange) > 20
                ? `${trendChange > 0 ? 'Artış' : 'Azalış'} trendi tespit edildi. Stok ve fiyatlandırma stratejinizi gözden geçirin.`
                : "Stabil trend devam ediyor."
        };
    }

    // ==================== SMART RECOMMENDATIONS ====================

    /**
     * Generate comprehensive AI recommendations
     */
    generateSmartRecommendations(orders, products = []) {
        const recommendations = [];

        // 1. Sales Forecast
        const forecast = this.forecastSales(orders, 30);
        if (forecast.confidence > 0.5) {
            const nextWeekOrders = forecast.forecast.slice(0, 7)
                .reduce((sum, day) => sum + day.predictedOrders, 0);
            const nextWeekRevenue = forecast.forecast.slice(0, 7)
                .reduce((sum, day) => sum + day.predictedRevenue, 0);

            recommendations.push({
                type: "forecast",
                priority: "high",
                title: "📊 7 Günlük Satış Tahmini",
                description: `Önümüzdeki hafta ${Math.round(nextWeekOrders)} sipariş ve ${this.formatCurrency(nextWeekRevenue)} ciro bekleniyor.`,
                confidence: Math.round(forecast.confidence * 100),
                trend: forecast.trend,
                action: forecast.trend === "increasing"
                    ? "Stok seviyelerinizi artırın"
                    : forecast.trend === "decreasing"
                    ? "Pazarlama kampanyaları düşünün"
                    : "Mevcut stratejinizi sürdürün"
            });
        }

        // 2. Anomaly Detection
        const anomalies = this.detectAnomalies(orders);
        if (anomalies.anomalies.length > 0) {
            const recentAnomalies = anomalies.anomalies.slice(-3);
            recentAnomalies.forEach(anomaly => {
                recommendations.push({
                    type: "anomaly",
                    priority: anomaly.severity,
                    title: `⚠️ ${anomaly.type === 'revenue' ? 'Ciro' : 'Sipariş'} Anomalisi`,
                    description: `${anomaly.date} tarihinde ${anomaly.direction === 'spike' ? 'beklenmedik artış' : 'düşüş'} tespit edildi.`,
                    details: {
                        value: anomaly.type === 'revenue' ? this.formatCurrency(anomaly.value) : anomaly.value,
                        expected: anomaly.type === 'revenue' ? this.formatCurrency(anomaly.expected) : Math.round(anomaly.expected),
                        deviation: `${Math.round(anomaly.deviation)}σ`
                    },
                    action: "Bu durumun nedenini araştırın"
                });
            });
        }

        // 3. Product Performance
        const productAnalysis = this.analyzeProductPerformance(orders);
        if (productAnalysis.topPerformers.length > 0) {
            const topProduct = productAnalysis.topPerformers[0];
            recommendations.push({
                type: "product_performance",
                priority: "medium",
                title: "⭐ En İyi Performans",
                description: `${topProduct.name} en yüksek performans skoruna sahip (${topProduct.performanceScore}/100)`,
                details: {
                    revenue: this.formatCurrency(topProduct.totalRevenue),
                    quantity: topProduct.totalQuantity,
                    avgPrice: this.formatCurrency(topProduct.avgPrice)
                },
                action: "Bu ürünün stok seviyesini yüksek tutun"
            });
        }

        if (productAnalysis.underperformers.length > 0) {
            recommendations.push({
                type: "product_performance",
                priority: "medium",
                title: "📉 Düşük Performanslı Ürünler",
                description: `${productAnalysis.underperformers.length} ürün düşük performans gösteriyor`,
                action: "Fiyat indirimi veya kampanya düşünün",
                products: productAnalysis.underperformers.slice(0, 5).map(p => p.name)
            });
        }

        // 4. Price Optimization
        if (productAnalysis.topPerformers.length > 0) {
            const priceOptimizations = productAnalysis.topPerformers.slice(0, 5)
                .map(product => ({
                    product: product.name,
                    ...this.optimizePrice(product)
                }))
                .filter(opt => Math.abs(opt.change) > 2);

            if (priceOptimizations.length > 0) {
                recommendations.push({
                    type: "price_optimization",
                    priority: "medium",
                    title: "💰 Fiyat Optimizasyonu",
                    description: `${priceOptimizations.length} ürün için fiyat ayarlaması öneriliyor`,
                    optimizations: priceOptimizations.map(opt => ({
                        product: opt.product,
                        current: this.formatCurrency(opt.currentPrice),
                        recommended: this.formatCurrency(opt.recommendedPrice),
                        change: `${opt.change > 0 ? '+' : ''}${opt.change.toFixed(1)}%`,
                        reason: opt.reason
                    }))
                });
            }
        }

        // 5. Customer Behavior
        const behavior = this.analyzeCustomerBehavior(orders);
        recommendations.push({
            type: "customer_behavior",
            priority: "low",
            title: "👥 Müşteri Davranış Analizi",
            description: `En yoğun saat: ${behavior.peakHour}, En yoğun gün: ${behavior.peakDay}`,
            details: {
                repeatCustomerRate: `${behavior.repeatCustomerRate.toFixed(1)}%`,
                avgOrderValue: this.formatCurrency(behavior.avgOrderValue),
                medianOrderValue: this.formatCurrency(behavior.medianOrderValue)
            },
            action: `${behavior.peakHour} saatlerinde özel kampanyalar düzenleyin`
        });

        // 6. Seasonality
        const seasonality = this.detectSeasonality(orders);
        if (seasonality.hasSeasonality) {
            recommendations.push({
                type: "seasonality",
                priority: "medium",
                title: "📅 Mevsimsellik Tespit Edildi",
                description: seasonality.recommendation,
                trend: seasonality.direction,
                trendChange: `${seasonality.trendChange > 0 ? '+' : ''}${seasonality.trendChange.toFixed(1)}%`
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return recommendations;
    }

    // ==================== MAIN ANALYSIS METHODS ====================

    getCredentialStatus(marketplaceName, credentials = {}) {
        const normalized = this.normalizeMarketplaceName(marketplaceName);
        const requiredKeys = this.requiredCredentials[normalized] || [];
        const providedKeys = Object.keys(credentials).filter(key => Boolean(credentials[key]));
        const missingKeys = requiredKeys.filter(key => !credentials[key]);

        if (requiredKeys.length > 0) {
            return {
                isComplete: missingKeys.length === 0,
                requiredKeys,
                providedKeys,
                missingKeys
            };
        }

        return {
            isComplete: providedKeys.length >= 2,
            requiredKeys: [],
            providedKeys,
            missingKeys: providedKeys.length >= 2 ? [] : ["credentials"]
        };
    }

    async fetchOrdersForIntegration(integration, windowDays = 90) {
        const normalized = this.normalizeMarketplaceName(integration.marketplaceName || "");
        const credentials = integration.credentials || {};
        const endDate = this.getIstanbulTimestamp();
        const startDate = endDate - windowDays * 24 * 60 * 60 * 1000;

        try {
            switch (normalized) {
                case "trendyol":
                    return await fetchTrendyolOrders(
                        credentials.sellerId,
                        credentials.apiKey,
                        credentials.apiSecret,
                        startDate,
                        endDate
                    );
                case "hepsiburada":
                    return await fetchHepsiburadaOrders(
                        credentials.merchantId,
                        credentials.apiKey,
                        startDate,
                        endDate
                    );
                case "n11":
                    return await fetchN11Orders(
                        credentials.apiKey,
                        credentials.secretKey,
                        startDate,
                        endDate
                    );
                case "ciceksepeti":
                    return await fetchCicekSepetiOrders(
                        credentials.supplierId,
                        credentials.apiKey || credentials.apiSecret
                    );
                default:
                    return [];
            }
        } catch (error) {
            console.error(`[AI] Error fetching orders for ${integration.marketplaceName}:`, error.message);
            return [];
        }
    }

    /**
     * Main analysis method - Comprehensive marketplace analysis
     */
    async analyzeMarketplaces(integrations) {
        console.log(`🤖 [AI] Starting advanced analysis for ${integrations.length} marketplace(s)...`);

        const results = {
            summary: {
                total: integrations.length,
                active: 0,
                incomplete: 0,
                unsupported: 0,
                analyzedOrders: 0,
                totalRevenue: 0
            },
            marketplaces: [],
            recommendations: [],
            insights: {},
            timestamp: new Date().toISOString()
        };

        for (const integration of integrations) {
            const marketplaceName = integration.marketplaceName || "Unknown";
            const credentialStatus = this.getCredentialStatus(marketplaceName, integration.credentials || {});

            if (!credentialStatus.isComplete) {
                results.summary.incomplete += 1;
                results.recommendations.push({
                    type: "setup",
                    priority: "high",
                    title: "⚠️ Eksik Entegrasyon",
                    description: `${marketplaceName} için API bilgileri tamamlanmamış`,
                    marketplace: marketplaceName,
                    missingCredentials: credentialStatus.missingKeys
                });
                continue;
            }

            const normalized = this.normalizeMarketplaceName(marketplaceName);
            if (!this.supportedMarketplaces.has(normalized)) {
                results.summary.unsupported += 1;
                continue;
            }

            results.summary.active += 1;
            console.log(`📊 [AI] Analyzing ${marketplaceName}...`);

            // Fetch orders
            const orders = await this.retryRequest(() =>
                this.fetchOrdersForIntegration(integration, 90)
            );

            if (!orders || orders.length < this.config.minOrdersForAnalysis) {
                results.marketplaces.push({
                    name: marketplaceName,
                    status: "insufficient_data",
                    orderCount: orders?.length || 0,
                    message: "Analiz için yeterli sipariş verisi yok"
                });
                continue;
            }

            results.summary.analyzedOrders += orders.length;

            // Calculate basic metrics
            const totalRevenue = orders.reduce((sum, order) => {
                const lines = this.extractOrderLines(order);
                return sum + lines.reduce((s, item) => s + (item.price * item.quantity), 0);
            }, 0);

            results.summary.totalRevenue += totalRevenue;

            // Perform advanced analysis
            const forecast = this.forecastSales(orders, 30);
            const anomalies = this.detectAnomalies(orders);
            const productPerformance = this.analyzeProductPerformance(orders);
            const customerBehavior = this.analyzeCustomerBehavior(orders);
            const seasonality = this.detectSeasonality(orders);
            const smartRecommendations = this.generateSmartRecommendations(orders);

            results.marketplaces.push({
                name: marketplaceName,
                status: "analyzed",
                orderCount: orders.length,
                totalRevenue,
                forecast: {
                    next7Days: forecast.forecast?.slice(0, 7) || [],
                    next30Days: forecast.forecast || [],
                    confidence: forecast.confidence,
                    trend: forecast.trend
                },
                anomalies: anomalies.anomalies || [],
                productPerformance: {
                    topPerformers: productPerformance.topPerformers.slice(0, 5),
                    underperformers: productPerformance.underperformers.slice(0, 5),
                    totalProducts: productPerformance.totalProducts
                },
                customerBehavior,
                seasonality,
                recommendations: smartRecommendations
            });

            // Add marketplace-specific recommendations to global list
            results.recommendations.push(...smartRecommendations.map(rec => ({
                ...rec,
                marketplace: marketplaceName
            })));
        }

        // Generate global insights
        if (results.summary.analyzedOrders > 0) {
            results.insights = {
                totalOrders: results.summary.analyzedOrders,
                totalRevenue: this.formatCurrency(results.summary.totalRevenue),
                avgRevenuePerOrder: this.formatCurrency(
                    results.summary.totalRevenue / results.summary.analyzedOrders
                ),
                activeMarketplaces: results.summary.active,
                analysisQuality: results.summary.analyzedOrders > 100 ? "high"
                               : results.summary.analyzedOrders > 30 ? "medium"
                               : "low"
            };
        }

        console.log(`✅ [AI] Analysis complete. Analyzed ${results.summary.analyzedOrders} orders across ${results.summary.active} marketplace(s)`);

        return results;
    }

    /**
     * Retry mechanism for API calls
     */
    async retryRequest(requestFunc, retries = 3, delay = 5000) {
        let attempt = 0;
        while (attempt < retries) {
            try {
                return await requestFunc();
            } catch (error) {
                console.error(`⚠️ [AI] Request failed (attempt ${attempt + 1}/${retries}):`, error.message);
                if (attempt === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            attempt++;
        }
        return null;
    }

    /**
     * Cache management
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = new AdvancedAIService();
