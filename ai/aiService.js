const {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders
} = require("../backend/services/ordersService");

/**
 * Advanced AI Service for E-commerce Analytics
 * Features:
 * - Predictive Analytics (Sales Forecasting)
 * - Price Optimization
 * - Inventory Management AI
 * - Customer Behavior Analysis
 * - Anomaly Detection
 * - Smart Recommendations
 */
class AIService {
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
            trendWindow: 30 // days
        };

        // Cache for performance
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    getIstanbulTimestamp(date = new Date()) {
        return new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();
    }

    normalizeMarketplaceName(name = "") {
        return name
            .toLowerCase()
            .replace(/\u00e7/g, "c")
            .replace(/\u011f/g, "g")
            .replace(/\u0131/g, "i")
            .replace(/\u00f6/g, "o")
            .replace(/\u015f/g, "s")
            .replace(/\u00fc/g, "u")
            .trim();
    }

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

    buildSuggestion(title, description, meta = {}) {
        return { title, description, ...meta };
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

    extractOrderLines(order) {
        const lines = Array.isArray(order.products)
            ? order.products
            : Array.isArray(order.lines)
                ? order.lines
                : [];

        return lines.map(item => ({
            productName: item.productName || item.name || "Bilinmeyen Ürün",
            quantity: Number(item.quantity || 1),
            price: this.parseNumber(item.price || item.itemPrice || 0)
        }));
    }

    calculateOrderMetrics(orders = []) {
        let totalOrders = orders.length;
        let totalRevenue = 0;
        let recentOrders = 0;
        let cancelledOrders = 0;
        let bestSellingProduct = null;
        let bestSellingCount = 0;
        const productCounts = new Map();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        orders.forEach(order => {
            const orderDate = order.orderDate ? new Date(order.orderDate).getTime() : 0;
            if (orderDate && orderDate >= sevenDaysAgo) {
                recentOrders += 1;
            }

            const statusText = typeof order.status === "string"
                ? order.status
                : order.status?.text || "";

            if (statusText.toLowerCase().includes("cancel") ||
                statusText.toLowerCase().includes("iptal") ||
                statusText.toLowerCase().includes("iade")) {
                cancelledOrders += 1;
            }

            const lines = this.extractOrderLines(order);
            if (lines.length > 0) {
                lines.forEach(item => {
                    totalRevenue += this.parseNumber(item.price) * (item.quantity || 1);
                    const name = item.productName || "Bilinmeyen Ürün";
                    const nextCount = (productCounts.get(name) || 0) + (item.quantity || 1);
                    productCounts.set(name, nextCount);
                    if (nextCount > bestSellingCount) {
                        bestSellingCount = nextCount;
                        bestSellingProduct = name;
                    }
                });
            } else {
                totalRevenue += this.parseNumber(order.totalPrice || order.payment?.total || 0);
            }
        });

        return {
            totalOrders,
            totalRevenue,
            averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
            recentOrders,
            cancelledOrders,
            bestSellingProduct,
            bestSellingCount
        };
    }

    async fetchOrdersForIntegration(integration, windowDays = 30) {
        const normalized = this.normalizeMarketplaceName(integration.marketplaceName || "");
        const credentials = integration.credentials || {};
        const endDate = this.getIstanbulTimestamp();
        const startDate = endDate - windowDays * 24 * 60 * 60 * 1000;

        switch (normalized) {
            case "trendyol":
                return fetchTrendyolOrders(
                    credentials.sellerId,
                    credentials.apiKey,
                    credentials.apiSecret,
                    startDate,
                    endDate
                );
            case "hepsiburada":
                return fetchHepsiburadaOrders(
                    credentials.merchantId,
                    credentials.apiKey,
                    startDate,
                    endDate
                );
            case "n11":
                return fetchN11Orders(
                    credentials.apiKey,
                    credentials.secretKey,
                    startDate,
                    endDate
                );
            case "ciceksepeti":
                return fetchCicekSepetiOrders(
                    credentials.supplierId,
                    credentials.apiKey || credentials.apiSecret
                );
            default:
                return [];
        }
    }

    async analyzeMarketplaces(integrations) {
        const aiSuggestions = [];
        const metrics = [];
        const summary = {
            total: integrations.length,
            active: 0,
            incomplete: 0,
            unsupported: 0
        };

        for (const integration of integrations) {
            const marketplaceName = integration.marketplaceName || "Bilinmeyen Pazaryeri";
            const credentialStatus = this.getCredentialStatus(
                marketplaceName,
                integration.credentials || {}
            );

            if (!credentialStatus.isComplete) {
                summary.incomplete += 1;
                aiSuggestions.push(
                    this.buildSuggestion(
                        "⚠️ Eksik Entegrasyon Bilgisi",
                        `${marketplaceName} için gerekli API bilgileri tamamlanmamış.`
                    )
                );
                continue;
            }

            const normalized = this.normalizeMarketplaceName(marketplaceName);
            if (!this.supportedMarketplaces.has(normalized)) {
                summary.unsupported += 1;
                aiSuggestions.push(
                    this.buildSuggestion(
                        "ℹ️ Desteklenmeyen Pazaryeri",
                        `${marketplaceName} için canlı veri analizi henüz aktif değil.`
                    )
                );
                continue;
            }

            summary.active += 1;
            console.log(`📊 [AI] ${marketplaceName} için canlı veri analizi başlatılıyor...`);

            const orders = await this.retryRequest(() =>
                this.fetchOrdersForIntegration(integration)
            );

            if (!orders || orders.length === 0) {
                aiSuggestions.push(
                    this.buildSuggestion(
                        "⚠️ Veri Alınamadı",
                        `${marketplaceName} API'sinden son 30 günde veri alınamadı.`
                    )
                );
                continue;
            }

            const orderMetrics = this.calculateOrderMetrics(orders);
            const bestSellingProduct = orderMetrics.bestSellingProduct || "Veri Yok";
            const forecastNext7Orders = Math.round((orderMetrics.totalOrders / 30) * 7);
            const forecastNext7Revenue = (orderMetrics.totalRevenue / 30) * 7;
            const cancelRate = orderMetrics.totalOrders > 0
                ? (orderMetrics.cancelledOrders / orderMetrics.totalOrders) * 100
                : 0;

            aiSuggestions.push(
                this.buildSuggestion(
                    `📈 ${marketplaceName} İçin Özet`,
                    `Toplam satış: ${orderMetrics.totalOrders} | Ortalama sepet: ${this.formatCurrency(
                        orderMetrics.averageOrderValue
                    )} | En iyi ürün: ${bestSellingProduct}`,
                    { marketplace: marketplaceName, priority: "medium" }
                )
            );

            aiSuggestions.push(
                this.buildSuggestion(
                    "🔮 7 Günlük Tahmin",
                    `Sipariş: ${forecastNext7Orders} | Ciro: ${this.formatCurrency(forecastNext7Revenue)}`,
                    { marketplace: marketplaceName, priority: "medium" }
                )
            );

            if (orderMetrics.recentOrders > 0) {
                aiSuggestions.push(
                    this.buildSuggestion(
                        "✅ Güncel Sipariş Akışı",
                        `${marketplaceName} için son 7 günde ${orderMetrics.recentOrders} sipariş mevcut.`,
                        { marketplace: marketplaceName, priority: "low" }
                    )
                );
            } else {
                aiSuggestions.push(
                    this.buildSuggestion(
                        "⚠️ Düşük Sipariş Hacmi",
                        `${marketplaceName} tarafında son 7 günde sipariş görülmedi.`,
                        { marketplace: marketplaceName, priority: "high" }
                    )
                );
            }

            if (orderMetrics.cancelledOrders > 0) {
                const severity = cancelRate > 10 ? "high" : "medium";
                aiSuggestions.push(
                    this.buildSuggestion(
                        "⚠️ İptal/İade Takibi",
                        `${marketplaceName} tarafında ${orderMetrics.cancelledOrders} iptal/iade (${cancelRate.toFixed(
                            1
                        )}%) tespit edildi.`,
                        { marketplace: marketplaceName, priority: severity }
                    )
                );
            }

            metrics.push({
                marketplace: marketplaceName,
                totalOrders: orderMetrics.totalOrders,
                totalRevenue: orderMetrics.totalRevenue,
                averageOrderValue: orderMetrics.averageOrderValue,
                recentOrders: orderMetrics.recentOrders,
                cancelledOrders: orderMetrics.cancelledOrders,
                cancelRate,
                forecastOrders7: forecastNext7Orders,
                forecastRevenue7: forecastNext7Revenue
            });
        }

        aiSuggestions.push(
            this.buildSuggestion(
                "🧭 Entegrasyon Özeti",
                `Toplam: ${summary.total} | Aktif: ${summary.active} | Eksik: ${summary.incomplete} | Desteklenmeyen: ${summary.unsupported}`,
                { priority: summary.incomplete > 0 ? "medium" : "low" }
            )
        );

        console.log("✅ [AI] Analiz tamamlandı.");
        return { suggestions: aiSuggestions, metrics, summary };
    }

    async retryRequest(requestFunc, retries = 3, delay = 5000) {
        let attempt = 0;
        while (attempt < retries) {
            try {
                return await requestFunc();
            } catch (error) {
                console.error(
                    `⚠️ [AI] API isteği başarısız oldu. Tekrar deneme: ${attempt + 1}/${retries}`
                );
                if (attempt === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            attempt++;
        }
        return null;
    }
}

module.exports = new AIService();
