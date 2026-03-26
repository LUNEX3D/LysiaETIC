/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🤖 INTELLIGENT AI ENGINE - PROAKTIF KARAR MOTORU
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

const {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders,
    fetchAmazonOrders,
    fetchEbayOrders,
    fetchGittiGidiyorOrders,
    fetchMorhipoOrders,
    fetchPttAVMOrders,
    fetchTeknosaOrders,
    fetchEPttAVMOrders
} = require("../backend/services/ordersService");

class IntelligentEngine {
    constructor() {
        this.supportedMarketplaces = new Set([
            "trendyol",
            "hepsiburada",
            "n11",
            "ciceksepeti",
            "amazon",
            "amazon türkiye",
            "amazon europe",
            "amazon usa",
            "ebay",
            "gittigidiyor",
            "morhipo",
            "pttavm",
            "teknosa",
            "epttavm"
        ]);

        // AI Konfigürasyonu
        this.config = {
            minDataPoints: 7,
            lowStockThreshold: 10,
            criticalStockThreshold: 5,
            highProfitMargin: 30,
            lowProfitMargin: 10,
            trendWindow: 30,
            anomalyThreshold: 2.5,
            priceOptimizationRange: 0.15
        };

        // Cache
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 dakika
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 1. VERİ TOPLAMA VE ANALİZ
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Tüm sistem verilerini topla
     */
    async collectSystemData(userId, products, integrations, dashboardData) {
        console.log("🔍 [AI Engine] Sistem verileri toplanıyor...");

        const systemData = {
            userId,
            timestamp: new Date().toISOString(),

            // Ürün verileri
            products: {
                total: products.length,
                active: products.filter(p => p.stock > 0).length,
                lowStock: products.filter(p => p.stock > 0 && p.stock <= this.config.lowStockThreshold),
                criticalStock: products.filter(p => p.stock > 0 && p.stock <= this.config.criticalStockThreshold),
                outOfStock: products.filter(p => p.stock === 0),
                avgPrice: products.length > 0 ? products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length : 0,
                totalValue: products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0),
                all: products
            },

            // Pazaryeri verileri
            marketplaces: {
                total: integrations.length,
                active: 0,
                integrations: integrations,
                status: {}
            },

            // Dashboard verileri
            dashboard: dashboardData || {},

            // Sipariş verileri (dashboard'dan)
            orders: {
                today: dashboardData?.summary?.todayOrders || 0,
                todayRevenue: dashboardData?.summary?.todayRevenue || 0,
                pending: 0,
                trends: dashboardData?.trends || {}
            },

            // Sistem sağlığı
            health: {
                errors: dashboardData?.summary?.errorCount || 0,
                stockMismatch: dashboardData?.summary?.stockMismatchCount || 0,
                pendingSync: dashboardData?.summary?.pendingSync || 0
            }
        };

        // Pazaryeri durumlarını analiz et
        if (dashboardData?.marketplaceStatus) {
            Object.entries(dashboardData.marketplaceStatus).forEach(([name, status]) => {
                systemData.marketplaces.status[name] = status;
                if (status.health === 'healthy') {
                    systemData.marketplaces.active++;
                }
            });
        }

        console.log("✅ [AI Engine] Sistem verileri toplandı:", {
            products: systemData.products.total,
            marketplaces: systemData.marketplaces.total,
            todayOrders: systemData.orders.today
        });

        return systemData;
    }

    /**
     * Sipariş verilerini pazaryerlerinden çek
     */
    async fetchOrdersFromMarketplaces(integrations, days = 30) {
        console.log(`📦 [AI Engine] ${integrations.length} pazaryerinden sipariş verileri çekiliyor...`);

        const allOrders = [];
        const marketplaceOrders = {};

        for (const integration of integrations) {
            try {
                const normalized = this.normalizeMarketplaceName(integration.marketplaceName);
                const orders = await this.fetchOrdersForIntegration(integration, days);

                if (orders && orders.length > 0) {
                    marketplaceOrders[normalized] = orders;
                    allOrders.push(...orders.map(o => ({
                        ...o,
                        marketplace: integration.marketplaceName,
                        marketplaceNormalized: normalized
                    })));
                }
            } catch (error) {
                console.error(`❌ [AI Engine] ${integration.marketplaceName} siparişleri alınamadı:`, error.message);
            }
        }

        console.log(`✅ [AI Engine] Toplam ${allOrders.length} sipariş toplandı`);

        return { allOrders, marketplaceOrders };
    }

    async fetchOrdersForIntegration(integration, windowDays = 30) {
        const normalized = this.normalizeMarketplaceName(integration.marketplaceName || "");
        const credentials = integration.credentials || {};
        const endDate = Date.now();
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
                        credentials.apiKey || credentials.serviceKey,
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
                case "çiçeksepeti":
                    return await fetchCicekSepetiOrders(
                        credentials.supplierId,
                        credentials.apiKey || credentials.apiPassword
                    );

                case "amazon":
                case "amazon türkiye":
                case "amazon turkiye":
                case "amazon europe":
                case "amazon usa":
                    return await fetchAmazonOrders(
                        credentials.sellerId,
                        credentials.mwsAuthToken,
                        credentials.accessKey,
                        credentials.secretKey,
                        credentials.marketplaceId,
                        startDate,
                        endDate
                    );

                case "ebay":
                    return await fetchEbayOrders(
                        credentials.appId,
                        credentials.devId,
                        credentials.certId,
                        credentials.userToken,
                        credentials.siteId,
                        startDate,
                        endDate
                    );

                case "gittigidiyor":
                    return await fetchGittiGidiyorOrders(
                        credentials.apiKey,
                        credentials.secretKey,
                        credentials.role,
                        credentials.nick,
                        startDate,
                        endDate
                    );

                case "morhipo":
                    return await fetchMorhipoOrders(
                        credentials.supplierId,
                        credentials.apiKey,
                        credentials.apiSecret,
                        startDate,
                        endDate
                    );

                case "pttavm":
                    return await fetchPttAVMOrders(
                        credentials.merchantCode,
                        credentials.apiKey,
                        credentials.apiSecret,
                        startDate,
                        endDate
                    );

                case "teknosa":
                    return await fetchTeknosaOrders(
                        credentials.supplierId,
                        credentials.apiKey,
                        credentials.apiPassword,
                        startDate,
                        endDate
                    );

                case "epttavm":
                    return await fetchEPttAVMOrders(
                        credentials.merchantId,
                        credentials.apiKey,
                        credentials.apiSecret,
                        startDate,
                        endDate
                    );

                default:
                    console.warn(`⚠️ [AI Engine] Desteklenmeyen platform: ${integration.marketplaceName}`);
                    return [];
            }
        } catch (error) {
            console.error(`❌ [AI Engine] ${integration.marketplaceName} siparişleri alınamadı:`, error.message);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🧠 2. AKILLI ANALİZ VE KARAR MOTORU
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Tüm sistemi analiz et ve kararlar üret
     */
    async analyzeAndDecide(systemData, orderData) {
        console.log("🧠 [AI Engine] Akıllı analiz başlatılıyor...");

        const analysis = {
            timestamp: new Date().toISOString(),

            // Kritik sorunlar
            criticalIssues: [],

            // Uyarılar
            warnings: [],

            // Fırsatlar
            opportunities: [],

            // Riskler
            risks: [],

            // Aksiyonlar
            actions: [],

            // İçgörüler
            insights: [],

            // Performans skoru
            performanceScore: 0,

            // Detaylı analizler
            details: {}
        };

        // 1. STOK ANALİZİ
        this.analyzeStock(systemData, analysis);

        // 2. SATIŞ ANALİZİ
        this.analyzeSales(systemData, orderData, analysis);

        // 3. ÜRÜN PERFORMANS ANALİZİ
        if (orderData && orderData.allOrders.length > 0) {
            this.analyzeProductPerformance(orderData.allOrders, systemData.products.all, analysis);
        }

        // 4. FİYAT OPTİMİZASYONU
        this.analyzePricing(systemData, orderData, analysis);

        // 5. PAZARYERI ANALİZİ
        this.analyzeMarketplaces(systemData, analysis);

        // 6. TREND ANALİZİ
        this.analyzeTrends(systemData, orderData, analysis);

        // 7. PERFORMANS SKORU HESAPLA
        analysis.performanceScore = this.calculatePerformanceScore(systemData, analysis);

        // 8. ÖNCELİKLENDİRME
        this.prioritizeActions(analysis);

        console.log("✅ [AI Engine] Analiz tamamlandı:", {
            criticalIssues: analysis.criticalIssues.length,
            warnings: analysis.warnings.length,
            opportunities: analysis.opportunities.length,
            performanceScore: analysis.performanceScore
        });

        return analysis;
    }

    /**
     * Stok analizi
     */
    analyzeStock(systemData, analysis) {
        const { products } = systemData;

        // Kritik stok durumu
        if (products.outOfStock.length > 0) {
            analysis.criticalIssues.push({
                id: 'stock_out',
                type: 'stock',
                severity: 'critical',
                title: '🚨 Stokta Olmayan Ürünler',
                description: `${products.outOfStock.length} ürün stokta yok - Satış kaybı riski!`,
                impact: 'Potansiyel satış kaybı',
                data: {
                    count: products.outOfStock.length,
                    products: products.outOfStock.slice(0, 5).map(p => ({
                        name: p.name,
                        barcode: p.barcode,
                        price: p.price
                    }))
                },
                actions: [
                    { id: 'restock', label: 'Acil Tedarik Başlat', priority: 'critical' },
                    { id: 'notify', label: 'Tedarikçiye Bildir', priority: 'high' }
                ]
            });
        }

        // Düşük stok uyarısı
        if (products.lowStock.length > 0) {
            analysis.warnings.push({
                id: 'stock_low',
                type: 'stock',
                severity: 'high',
                title: '⚠️ Düşük Stok Seviyesi',
                description: `${products.lowStock.length} ürünün stoğu kritik seviyede`,
                impact: 'Yakın zamanda stok tükenebilir',
                data: {
                    count: products.lowStock.length,
                    products: products.lowStock.slice(0, 10).map(p => ({
                        name: p.name,
                        barcode: p.barcode,
                        stock: p.stock,
                        price: p.price
                    }))
                },
                actions: [
                    { id: 'plan_restock', label: 'Stok Planla', priority: 'medium' },
                    { id: 'set_alert', label: 'Otomatik Uyarı Kur', priority: 'low' }
                ]
            });
        }

        // Stok sağlığı insight
        const stockHealth = ((products.active / Math.max(products.total, 1)) * 100).toFixed(1);
        analysis.insights.push({
            type: 'stock',
            title: 'Stok Sağlığı',
            value: `${stockHealth}%`,
            description: `${products.active}/${products.total} ürün stokta mevcut`,
            status: stockHealth > 80 ? 'good' : stockHealth > 50 ? 'warning' : 'critical'
        });

        analysis.details.stock = {
            total: products.total,
            active: products.active,
            lowStock: products.lowStock.length,
            outOfStock: products.outOfStock.length,
            healthScore: parseFloat(stockHealth),
            totalValue: products.totalValue
        };
    }

    /**
     * Satış analizi
     */
    analyzeSales(systemData, orderData, analysis) {
        const { orders } = systemData;

        // Bugünkü satış performansı
        if (orders.today === 0 && new Date().getHours() > 12) {
            analysis.criticalIssues.push({
                id: 'no_sales_today',
                type: 'sales',
                severity: 'critical',
                title: '🚨 Bugün Satış Yok',
                description: 'Bugün hiç sipariş alınmadı - Acil kontrol gerekli!',
                impact: 'Gelir kaybı',
                actions: [
                    { id: 'check_visibility', label: 'Ürün Görünürlüğünü Kontrol Et', priority: 'critical' },
                    { id: 'check_prices', label: 'Fiyatları Kontrol Et', priority: 'high' },
                    { id: 'check_stock', label: 'Stok Durumunu Kontrol Et', priority: 'high' }
                ]
            });
        } else if (orders.today > 0) {
            const avgOrderValue = orders.todayRevenue / orders.today;
            analysis.insights.push({
                type: 'sales',
                title: 'Bugünkü Satışlar',
                value: `${orders.today} sipariş`,
                description: `${this.formatCurrency(orders.todayRevenue)} ciro, ortalama ${this.formatCurrency(avgOrderValue)} sepet`,
                status: orders.today > 10 ? 'good' : orders.today > 5 ? 'warning' : 'critical'
            });
        }

        // Trend analizi
        if (orders.trends && orders.trends.orderCounts) {
            const recentOrders = orders.trends.orderCounts.slice(-7);
            const avgRecent = recentOrders.reduce((a, b) => a + b, 0) / recentOrders.length;
            const trend = recentOrders[recentOrders.length - 1] > avgRecent ? 'increasing' : 'decreasing';

            if (trend === 'decreasing') {
                analysis.warnings.push({
                    id: 'sales_declining',
                    type: 'sales',
                    severity: 'high',
                    title: '📉 Satış Düşüş Trendi',
                    description: 'Son günlerde satışlarda azalma görülüyor',
                    impact: 'Gelir azalması riski',
                    actions: [
                        { id: 'launch_campaign', label: 'Kampanya Başlat', priority: 'high' },
                        { id: 'review_pricing', label: 'Fiyatları Gözden Geçir', priority: 'medium' }
                    ]
                });
            } else {
                analysis.opportunities.push({
                    id: 'sales_growing',
                    type: 'sales',
                    potential: 'high',
                    title: '📈 Satış Artış Trendi',
                    description: 'Satışlarınız artış trendinde!',
                    impact: 'Büyüme fırsatı',
                    actions: [
                        { id: 'increase_stock', label: 'Stok Artır', priority: 'medium' },
                        { id: 'expand_products', label: 'Ürün Çeşitliliğini Artır', priority: 'low' }
                    ]
                });
            }
        }

        analysis.details.sales = {
            today: orders.today,
            todayRevenue: orders.todayRevenue,
            avgOrderValue: orders.today > 0 ? orders.todayRevenue / orders.today : 0
        };
    }

    /**
     * Ürün performans analizi
     */
    analyzeProductPerformance(orders, products, analysis) {
        const productStats = new Map();

        // Sipariş verilerinden ürün performansını hesapla
        orders.forEach(order => {
            const lines = this.extractOrderLines(order);
            lines.forEach(item => {
                const key = item.barcode || item.productName;
                if (!productStats.has(key)) {
                    productStats.set(key, {
                        name: item.productName,
                        barcode: item.barcode,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orderCount: 0
                    });
                }
                const stats = productStats.get(key);
                stats.totalQuantity += item.quantity;
                stats.totalRevenue += item.price * item.quantity;
                stats.orderCount += 1;
            });
        });

        // Performans skorları hesapla
        const productPerformance = Array.from(productStats.values()).map(p => ({
            ...p,
            avgPrice: p.totalRevenue / p.totalQuantity,
            performanceScore: this.calculateProductScore(p)
        })).sort((a, b) => b.performanceScore - a.performanceScore);

        const topPerformers = productPerformance.slice(0, 5);
        const underperformers = productPerformance.filter(p => p.performanceScore < 30);

        // En iyi ürün
        if (topPerformers.length > 0) {
            const top = topPerformers[0];
            analysis.opportunities.push({
                id: 'top_product',
                type: 'product',
                potential: 'high',
                title: '⭐ En İyi Performans',
                description: `${top.name} en çok satan ürününüz (${top.totalQuantity} adet, ${this.formatCurrency(top.totalRevenue)})`,
                impact: 'Stok artırımı ile daha fazla satış',
                data: {
                    product: top,
                    topPerformers: topPerformers
                },
                actions: [
                    { id: 'increase_stock', label: 'Stok Artır', priority: 'high' },
                    { id: 'feature_product', label: 'Öne Çıkar', priority: 'medium' }
                ]
            });
        }

        // Düşük performanslı ürünler
        if (underperformers.length > 0) {
            analysis.warnings.push({
                id: 'underperforming_products',
                type: 'product',
                severity: 'medium',
                title: '📊 Düşük Performanslı Ürünler',
                description: `${underperformers.length} ürün düşük performans gösteriyor`,
                impact: 'Stok maliyeti ve alan kaybı',
                data: {
                    count: underperformers.length,
                    products: underperformers.slice(0, 5)
                },
                actions: [
                    { id: 'discount_campaign', label: 'İndirim Kampanyası', priority: 'medium' },
                    { id: 'review_products', label: 'Ürünleri Gözden Geçir', priority: 'low' }
                ]
            });
        }

        analysis.details.productPerformance = {
            total: productPerformance.length,
            topPerformers: topPerformers,
            underperformers: underperformers.slice(0, 10)
        };
    }

    /**
     * Fiyat optimizasyonu analizi
     */
    analyzePricing(systemData, orderData, analysis) {
        const { products } = systemData;

        if (!orderData || orderData.allOrders.length === 0) return;

        // Basit fiyat analizi
        const avgMarketPrice = products.avgPrice;
        const highPricedProducts = products.all.filter(p => p.price > avgMarketPrice * 1.5);
        const lowPricedProducts = products.all.filter(p => p.price < avgMarketPrice * 0.5);

        if (highPricedProducts.length > products.total * 0.3) {
            analysis.warnings.push({
                id: 'high_pricing',
                type: 'pricing',
                severity: 'medium',
                title: '💰 Yüksek Fiyatlandırma',
                description: `Ürünlerinizin %${((highPricedProducts.length / products.total) * 100).toFixed(0)}'i pazar ortalamasının üzerinde fiyatlandırılmış`,
                impact: 'Satış kaybı riski',
                actions: [
                    { id: 'review_pricing', label: 'Fiyatları Gözden Geçir', priority: 'medium' },
                    { id: 'competitor_analysis', label: 'Rakip Analizi Yap', priority: 'low' }
                ]
            });
        }

        analysis.details.pricing = {
            avgPrice: avgMarketPrice,
            highPriced: highPricedProducts.length,
            lowPriced: lowPricedProducts.length
        };
    }

    /**
     * Pazaryeri analizi
     */
    analyzeMarketplaces(systemData, analysis) {
        const { marketplaces, health } = systemData;

        // API hataları
        if (health.errors > 0) {
            analysis.criticalIssues.push({
                id: 'marketplace_errors',
                type: 'marketplace',
                severity: 'critical',
                title: '🔌 Pazaryeri Bağlantı Sorunları',
                description: `${health.errors} pazaryerinde API hatası var`,
                impact: 'Sipariş ve stok senkronizasyonu durabilir',
                actions: [
                    { id: 'check_credentials', label: 'API Bilgilerini Kontrol Et', priority: 'critical' },
                    { id: 'reconnect', label: 'Yeniden Bağlan', priority: 'high' }
                ]
            });
        }

        // Stok uyumsuzluğu
        if (health.stockMismatch > 5) {
            analysis.warnings.push({
                id: 'stock_mismatch',
                type: 'marketplace',
                severity: 'high',
                title: '🔄 Stok Uyumsuzluğu',
                description: `${health.stockMismatch} ürünün stoğu pazaryerleriyle uyumsuz`,
                impact: 'Yanlış satış veya müşteri memnuniyetsizliği',
                actions: [
                    { id: 'sync_stock', label: 'Stokları Senkronize Et', priority: 'high' },
                    { id: 'auto_sync', label: 'Otomatik Senkronizasyon Kur', priority: 'medium' }
                ]
            });
        }

        // Pazaryeri sağlığı
        const healthRate = (marketplaces.active / Math.max(marketplaces.total, 1)) * 100;
        analysis.insights.push({
            type: 'marketplace',
            title: 'Pazaryeri Sağlığı',
            value: `${marketplaces.active}/${marketplaces.total}`,
            description: `%${healthRate.toFixed(0)} pazaryeri aktif`,
            status: healthRate === 100 ? 'good' : healthRate > 50 ? 'warning' : 'critical'
        });

        // Yeni pazaryeri fırsatı
        if (marketplaces.total < 3) {
            analysis.opportunities.push({
                id: 'expand_marketplaces',
                type: 'marketplace',
                potential: 'high',
                title: '🏪 Yeni Pazaryeri Fırsatı',
                description: 'Daha fazla pazaryerine açılarak erişiminizi artırabilirsiniz',
                impact: '+30% müşteri erişimi potansiyeli',
                actions: [
                    { id: 'add_marketplace', label: 'Yeni Pazaryeri Ekle', priority: 'medium' }
                ]
            });
        }

        analysis.details.marketplaces = {
            total: marketplaces.total,
            active: marketplaces.active,
            errors: health.errors,
            stockMismatch: health.stockMismatch
        };
    }

    /**
     * Trend analizi
     */
    analyzeTrends(systemData, orderData, analysis) {
        const { orders } = systemData;

        if (!orders.trends || !orders.trends.orderCounts) return;

        const orderCounts = orders.trends.orderCounts;
        if (orderCounts.length < 7) return;

        // Son 7 günün ortalaması
        const last7Days = orderCounts.slice(-7);
        const avg7Days = last7Days.reduce((a, b) => a + b, 0) / 7;

        // Önceki 7 günün ortalaması
        const prev7Days = orderCounts.slice(-14, -7);
        const avgPrev7Days = prev7Days.length > 0 ? prev7Days.reduce((a, b) => a + b, 0) / prev7Days.length : avg7Days;

        // Trend hesapla
        const trendChange = ((avg7Days - avgPrev7Days) / Math.max(avgPrev7Days, 1)) * 100;

        analysis.insights.push({
            type: 'trend',
            title: 'Haftalık Trend',
            value: `${trendChange > 0 ? '+' : ''}${trendChange.toFixed(1)}%`,
            description: trendChange > 0 ? 'Satışlar artış trendinde' : 'Satışlar azalış trendinde',
            status: trendChange > 10 ? 'good' : trendChange > -10 ? 'warning' : 'critical'
        });

        analysis.details.trends = {
            last7DaysAvg: avg7Days,
            prev7DaysAvg: avgPrev7Days,
            changePercent: trendChange,
            direction: trendChange > 0 ? 'increasing' : trendChange < 0 ? 'decreasing' : 'stable'
        };
    }

    /**
     * Performans skoru hesapla (0-100)
     */
    calculatePerformanceScore(systemData, analysis) {
        let score = 100;

        // Kritik sorunlar (-30 puan)
        score -= analysis.criticalIssues.length * 15;

        // Uyarılar (-10 puan)
        score -= analysis.warnings.length * 5;

        // Stok sağlığı
        const stockHealth = (systemData.products.active / Math.max(systemData.products.total, 1)) * 100;
        score -= (100 - stockHealth) * 0.2;

        // Pazaryeri sağlığı
        const mpHealth = (systemData.marketplaces.active / Math.max(systemData.marketplaces.total, 1)) * 100;
        score -= (100 - mpHealth) * 0.15;

        // Satış performansı
        if (systemData.orders.today === 0 && new Date().getHours() > 12) {
            score -= 20;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Ürün performans skoru hesapla
     */
    calculateProductScore(product) {
        const revenueScore = Math.min(100, (product.totalRevenue / 1000) * 10);
        const quantityScore = Math.min(100, product.totalQuantity * 5);
        const orderScore = Math.min(100, product.orderCount * 10);

        return Math.round((revenueScore * 0.5 + quantityScore * 0.3 + orderScore * 0.2));
    }

    /**
     * Aksiyonları önceliklendir
     */
    prioritizeActions(analysis) {
        const allActions = [];

        // Kritik sorunlardan aksiyonlar
        analysis.criticalIssues.forEach(issue => {
            issue.actions?.forEach(action => {
                allActions.push({
                    ...action,
                    source: issue.id,
                    sourceTitle: issue.title,
                    type: issue.type,
                    severity: 'critical'
                });
            });
        });

        // Uyarılardan aksiyonlar
        analysis.warnings.forEach(warning => {
            warning.actions?.forEach(action => {
                allActions.push({
                    ...action,
                    source: warning.id,
                    sourceTitle: warning.title,
                    type: warning.type,
                    severity: 'high'
                });
            });
        });

        // Fırsatlardan aksiyonlar
        analysis.opportunities.forEach(opp => {
            opp.actions?.forEach(action => {
                allActions.push({
                    ...action,
                    source: opp.id,
                    sourceTitle: opp.title,
                    type: opp.type,
                    severity: 'medium'
                });
            });
        });

        // Öncelik sıralaması
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        allActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        analysis.actions = allActions.slice(0, 10); // En önemli 10 aksiyon
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 💬 3. DOĞAL DİL İŞLEME VE CHAT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Kullanıcı mesajını analiz et ve yanıt üret
     */
    async processUserMessage(message, systemData, analysis) {
        console.log(`💬 [AI Engine] Kullanıcı mesajı işleniyor: "${message}"`);

        const lowerMessage = message.toLowerCase();

        // Intent tespiti
        const intent = this.detectIntent(lowerMessage);

        // Intent'e göre yanıt üret
        let response = {
            message: '',
            suggestions: [],
            data: null
        };

        switch (intent.type) {
            case 'system_status':
                response = this.generateSystemStatusResponse(systemData, analysis);
                break;

            case 'critical_actions':
                response = this.generateCriticalActionsResponse(analysis);
                break;

            case 'opportunities':
                response = this.generateOpportunitiesResponse(analysis);
                break;

            case 'product_analysis':
                response = this.generateProductAnalysisResponse(systemData, analysis);
                break;

            case 'sales_analysis':
                response = this.generateSalesAnalysisResponse(systemData, analysis);
                break;

            case 'help':
                response = this.generateHelpResponse();
                break;

            default:
                response = this.generateGeneralResponse(systemData, analysis);
                break;
        }

        console.log(`✅ [AI Engine] Yanıt oluşturuldu: ${intent.type}`);

        return response;
    }

    /**
     * Intent tespiti
     */
    detectIntent(message) {
        const intents = [
            {
                type: 'system_status',
                keywords: ['durum', 'sistem', 'genel', 'özet', 'analiz', 'rapor', 'nasıl'],
                confidence: 0
            },
            {
                type: 'critical_actions',
                keywords: ['kritik', 'acil', 'sorun', 'problem', 'hata', 'düzelt'],
                confidence: 0
            },
            {
                type: 'opportunities',
                keywords: ['fırsat', 'öneri', 'büyü', 'artır', 'iyileştir', 'gelişim'],
                confidence: 0
            },
            {
                type: 'product_analysis',
                keywords: ['ürün', 'urun', 'stok', 'envanter'],
                confidence: 0
            },
            {
                type: 'sales_analysis',
                keywords: ['satış', 'satis', 'sipariş', 'siparis', 'ciro', 'gelir'],
                confidence: 0
            },
            {
                type: 'help',
                keywords: ['yardım', 'yardim', 'help', 'neler', 'nasıl'],
                confidence: 0
            }
        ];

        // Keyword matching
        intents.forEach(intent => {
            intent.confidence = intent.keywords.filter(kw => message.includes(kw)).length / intent.keywords.length;
        });

        // En yüksek confidence
        const bestIntent = intents.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
        );

        return bestIntent.confidence > 0 ? bestIntent : { type: 'general', confidence: 0 };
    }

    /**
     * Sistem durumu yanıtı
     */
    generateSystemStatusResponse(systemData, analysis) {
        const status = analysis.performanceScore >= 75 ? '✅ Sağlıklı' :
                      analysis.performanceScore >= 50 ? '⚠️ Dikkat Gerekli' : '🚨 Kritik';

        let message = `🧠 **Tüm Sistem Analizi**\n\n`;
        message += `${status} - Performans Skoru: ${analysis.performanceScore}/100\n\n`;

        message += `📊 **Bugünkü Durum:**\n`;
        message += `• Sipariş: ${systemData.orders.today}\n`;
        message += `• Ciro: ${this.formatCurrency(systemData.orders.todayRevenue)}\n`;
        message += `• Kritik Sorun: ${analysis.criticalIssues.length}\n`;
        message += `• Uyarı: ${analysis.warnings.length}\n\n`;

        message += `📦 **Ürün Durumu:**\n`;
        message += `• Toplam: ${systemData.products.total}\n`;
        message += `• Aktif: ${systemData.products.active}\n`;
        message += `• Düşük Stok: ${systemData.products.lowStock.length}\n`;
        message += `• Stokta Yok: ${systemData.products.outOfStock.length}\n\n`;

        message += `🏪 **Pazaryerleri:**\n`;
        message += `• Aktif: ${systemData.marketplaces.active}/${systemData.marketplaces.total}\n\n`;

        if (analysis.actions.length > 0) {
            message += `💡 **Önerilen Aksiyonlar:**\n`;
            analysis.actions.slice(0, 3).forEach((action, i) => {
                message += `${i + 1}. ${action.label}\n`;
            });
        }

        return {
            message,
            suggestions: [
                "Kritik aksiyonları göster",
                "Fırsatları listele",
                "Ürün analizi yap",
                "Satış performansı"
            ],
            data: { performanceScore: analysis.performanceScore, analysis }
        };
    }

    /**
     * Kritik aksiyonlar yanıtı
     */
    generateCriticalActionsResponse(analysis) {
        if (analysis.criticalIssues.length === 0) {
            return {
                message: `✅ **Harika Haber!**\n\nŞu anda kritik sorun yok. Sisteminiz sağlıklı çalışıyor!\n\n💡 Fırsatları değerlendirmek için "fırsatları göster" diyebilirsiniz.`,
                suggestions: ["Fırsatları göster", "Sistem durumu", "Ürün analizi"],
                data: null
            };
        }

        let message = `🚨 **Kritik Sorunlar** (${analysis.criticalIssues.length} adet)\n\n`;

        analysis.criticalIssues.forEach((issue, i) => {
            message += `${i + 1}. **${issue.title}**\n`;
            message += `   ${issue.description}\n`;
            message += `   💡 ${issue.actions[0]?.label || 'Aksiyon gerekli'}\n\n`;
        });

        message += `⚡ **Hemen Yapılması Gerekenler:**\n`;
        analysis.actions.filter(a => a.severity === 'critical').slice(0, 3).forEach((action, i) => {
            message += `${i + 1}. ${action.label}\n`;
        });

        return {
            message,
            suggestions: [
                "Nasıl düzeltebilirim?",
                "Detaylı rapor",
                "Sistem durumu"
            ],
            data: { criticalIssues: analysis.criticalIssues }
        };
    }

    /**
     * Fırsatlar yanıtı
     */
    generateOpportunitiesResponse(analysis) {
        if (analysis.opportunities.length === 0) {
            return {
                message: `💡 **Fırsat Analizi**\n\nŞu anda tespit edilen büyüme fırsatı yok.\n\n📊 Performansınızı artırmak için:\n• Yeni pazaryerleri ekleyin\n• Ürün çeşitliliğini artırın\n• Fiyat optimizasyonu yapın`,
                suggestions: ["Sistem durumu", "Kritik aksiyonlar"],
                data: null
            };
        }

        let message = `💡 **Büyüme Fırsatları** (${analysis.opportunities.length} adet)\n\n`;

        analysis.opportunities.forEach((opp, i) => {
            message += `${i + 1}. **${opp.title}**\n`;
            message += `   ${opp.description}\n`;
            message += `   📈 Etki: ${opp.impact}\n`;
            message += `   ⚡ ${opp.actions[0]?.label || 'Değerlendir'}\n\n`;
        });

        return {
            message,
            suggestions: [
                "Nasıl başlamalıyım?",
                "Detaylı plan",
                "Sistem durumu"
            ],
            data: { opportunities: analysis.opportunities }
        };
    }

    /**
     * Ürün analizi yanıtı
     */
    generateProductAnalysisResponse(systemData, analysis) {
        const { products } = systemData;

        let message = `📦 **Ürün Portföyü Analizi**\n\n`;
        message += `✅ Toplam Ürün: ${products.total}\n`;
        message += `💰 Ort. Fiyat: ${this.formatCurrency(products.avgPrice)}\n`;
        message += `📊 Aktif: ${products.active}\n`;
        message += `⚠️ Düşük Stok: ${products.lowStock.length}\n`;
        message += `🚫 Stokta Yok: ${products.outOfStock.length}\n\n`;

        if (products.outOfStock.length > 0) {
            message += `**Acil Tedarik Gerekli:**\n`;
            products.outOfStock.slice(0, 5).forEach((p, i) => {
                message += `${i + 1}. ${p.name}\n`;
            });
            message += `\n`;
        }

        if (analysis.details.productPerformance?.topPerformers) {
            message += `**En İyi Performans:**\n`;
            analysis.details.productPerformance.topPerformers.slice(0, 3).forEach((p, i) => {
                message += `${i + 1}. ${p.name} - ${p.totalQuantity} adet\n`;
            });
        }

        return {
            message,
            suggestions: [
                "Stok uyarısı kur",
                "Fiyat optimizasyonu",
                "Sistem durumu"
            ],
            data: { products: analysis.details.productPerformance }
        };
    }

    /**
     * Satış analizi yanıtı
     */
    generateSalesAnalysisResponse(systemData, analysis) {
        const { orders } = systemData;

        let message = `📊 **Satış Performans Analizi**\n\n`;
        message += `📈 **Bugün:**\n`;
        message += `• Sipariş: ${orders.today}\n`;
        message += `• Ciro: ${this.formatCurrency(orders.todayRevenue)}\n`;

        if (orders.today > 0) {
            const avgOrder = orders.todayRevenue / orders.today;
            message += `• Ortalama Sepet: ${this.formatCurrency(avgOrder)}\n`;
        }

        message += `\n`;

        if (analysis.details.trends) {
            const trend = analysis.details.trends;
            message += `📉 **Trend:**\n`;
            message += `• Son 7 Gün Ort: ${trend.last7DaysAvg.toFixed(1)} sipariş/gün\n`;
            message += `• Değişim: ${trend.changePercent > 0 ? '+' : ''}${trend.changePercent.toFixed(1)}%\n`;
            message += `• Yön: ${trend.direction === 'increasing' ? '📈 Artış' : trend.direction === 'decreasing' ? '📉 Azalış' : '➡️ Stabil'}\n`;
        }

        return {
            message,
            suggestions: [
                "Satış tahmini",
                "Ürün performansı",
                "Sistem durumu"
            ],
            data: { sales: analysis.details.sales, trends: analysis.details.trends }
        };
    }

    /**
     * Yardım yanıtı
     */
    generateHelpResponse() {
        let message = `👋 **Merhaba! Ben sizin Akıllı AI Asistanınızım.**\n\n`;
        message += `Gerçek verilerinizi analiz edip size özel kararlar sunuyorum:\n\n`;
        message += `🧠 **Yapabileceklerim:**\n`;
        message += `• Tüm sistemi analiz edebilirim\n`;
        message += `• Kritik sorunları tespit edebilirim\n`;
        message += `• Fırsatları gösterebilirim\n`;
        message += `• Ürün ve satış analizi yapabilirim\n`;
        message += `• Akıllı öneriler sunabilirim\n\n`;
        message += `💬 **Örnek Komutlar:**\n`;
        message += `• "Sistem durumu nedir?"\n`;
        message += `• "Kritik sorunlar neler?"\n`;
        message += `• "Fırsatları göster"\n`;
        message += `• "Ürün analizi yap"\n`;
        message += `• "Satış performansı"\n\n`;
        message += `🎯 **Fark:** Ben sadece cevap vermiyorum, sizin yerinize düşünüyor ve karar veriyorum!`;

        return {
            message,
            suggestions: [
                "Sistem durumu",
                "Kritik aksiyonlar",
                "Fırsatları göster",
                "Ürün analizi"
            ],
            data: null
        };
    }

    /**
     * Genel yanıt
     */
    generateGeneralResponse(systemData, analysis) {
        let message = `🤖 **Proaktif Analiz**\n\n`;

        if (analysis.insights.length > 0) {
            message += `💡 **Önemli Bilgiler:**\n`;
            analysis.insights.slice(0, 3).forEach(insight => {
                message += `• ${insight.title}: ${insight.value}\n`;
            });
            message += `\n`;
        }

        if (analysis.actions.length > 0) {
            message += `⚡ **Önerilen Aksiyonlar:**\n`;
            analysis.actions.slice(0, 3).forEach((action, i) => {
                message += `${i + 1}. ${action.label}\n`;
            });
        }

        return {
            message,
            suggestions: [
                "Sistem durumu",
                "Kritik aksiyonlar",
                "Fırsatları göster",
                "Yardım"
            ],
            data: { analysis }
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🛠️ YARDIMCI METODLAR
    // ═══════════════════════════════════════════════════════════════════════

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
            return `${amount.toFixed(2)} TL`;
        }
    }

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
            price: this.parseNumber(item.price || item.itemPrice || 0)
        }));
    }

    parseNumber(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const cleaned = String(value).replace(/[^0-9.-]/g, "");
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
}

module.exports = new IntelligentEngine();
