import React, { useState, useEffect, useMemo } from "react";
import { getUserMarketplaces, fetchDashboardData } from "../services/marketplaceApi";
import MarketplaceIntegration from "../pages/MarketplaceIntegration";
import OrdersPage from "../pages/OrdersPage";
import InventoryPage from "../pages/StockManagement";
// ⭐ Finansal Panel: Eski FinanceDashboard yerine modern FinancePage
import FinancePage from "../pages/FinancePage";
import { FaRobot } from "react-icons/fa";
import AIPanel from "../pages/AIPanel";
import CargoTrackingPage from "../pages/CargoTrackingPage";
import UserProfilePage from "../pages/UserProfilePage";
import AnalyticsPage from "../pages/AnalyticsPage";
import AdvancedAnalytics from "../pages/AdvancedAnalytics";
import AdvancedAIAssistant from "../pages/AdvancedAIAssistant";
import {
    FaBars, FaTimes, FaClipboardList, FaCog,
    FaChartLine, FaBoxOpen, FaMoneyBillWave, FaChartPie,
    FaTruck, FaUsers, FaFileInvoice, FaPlug,
    FaChevronDown, FaChevronUp, FaBox,
    FaBrain, FaChartBar, FaLayerGroup, FaExchangeAlt, FaBell,
    FaCloudDownloadAlt, FaTable
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import "../styles/userDashboard.css";
import UnifiedProductManagement from "../pages/UnifiedProductManagement";
import ProductManagementPageV3 from "../pages/ProductManagementPageV3";
import ProductManagementHub from "../pages/ProductManagementHub";

// Mock-realistic dashboard snapshot for fallback/demo (25 Feb 2026)
const sampleDashboard = {
    summary: {
        todayOrders: 482,
        todayRevenue: 1940000,
        pendingOrders: 15,
        totalProducts: 44500,
        syncedProducts: 42180,
        stockMismatchCount: 126,
        errorCount: 7,
        pendingSync: 15,
        activeMarketplaces: 3,
        missingCredentials: 1,
        lastIntegrationUpdate: "2026-02-25T14:12:00+03:00"
    },
    diagnostics: {
        pendingSyncTotal: 15,
        errorCount: 7,
        stockMismatchCount: 126
    },
    marketplaceStatus: {
        Trendyol: { status: "active", orders: 210, revenue: 910000, pendingSync: 0, errors: 0, updatedAt: "2026-02-25T14:18:00+03:00", lastDataMinutes: 2 },
        Hepsiburada: { status: "slow", orders: 142, revenue: 560000, pendingSync: 6, errors: 2, updatedAt: "2026-02-25T14:10:00+03:00", lastDataMinutes: 11 },
        Amazon: { status: "down", orders: 98, revenue: 470000, pendingSync: 9, errors: 5, updatedAt: "2026-02-25T13:17:00+03:00", lastDataMinutes: 63 },
        n11: { status: "active", orders: 32, revenue: 100000, pendingSync: 0, errors: 0, updatedAt: "2026-02-25T14:17:00+03:00", lastDataMinutes: 3 }
    },
    trends: {
        labels: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "19:00", "23:00"],
        orderCounts: [18, 32, 41, 50, 62, 44, 38, 27],
        revenueTotals: [42000, 68000, 79000, 101000, 88000, 73000, 55000, 39000],
        errorRate: [0.4, 0.6, 1.0, 1.8, 0.7, 0.5, 0.4, 0.3]
    },
    alerts: [
        "Amazon API token 18 saat içinde doluyor",
        "SKU TY-8843 stok -12",
        "15 sipariş aktarımı başarısız (Amazon)",
        "Trendyol rate limit 3 kez aşıldı"
    ],
    inventory: {
        priceMismatch: 410,
        stockMismatch: 126,
        topErrorSkus: ["TY-8843", "HB-5520", "AMZ-KIT-991", "TY-1200", "HB-0042"]
    },
    logs: [
        { id: "984421", marketplace: "Trendyol", type: "Sipariş çekildi", status: "success", time: "14:18" },
        { id: "984398", marketplace: "Amazon", type: "Stok güncellendi", status: "error", time: "14:15" },
        { id: "984350", marketplace: "Hepsiburada", type: "Sipariş çekildi", status: "slow", time: "14:12" },
        { id: "984330", marketplace: "n11", type: "Fiyat güncellendi", status: "success", time: "14:10" }
    ],
    quickActions: ["addMarketplace", "manualSync", "bulkStockUpdate", "priceUpdate", "apiSettings"]
};

const UserDashboard = () => {
    const demoMode = process.env.REACT_APP_DEMO_MODE === "true";
    const [menuOpen, setMenuOpen] = useState(true);
    const [activePanel, setActivePanel] = useState("dashboard");
    const [marketplaces, setMarketplaces] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardError, setDashboardError] = useState("");
    const [showProductManagement, setShowProductManagement] = useState(false);
    const [showProductManagementNew, setShowProductManagementNew] = useState(false);
    const [showOrdersSubmenu, setShowOrdersSubmenu] = useState(false);
    const [showInventorySubmenu, setShowInventorySubmenu] = useState(false);
    const [showShippingSubmenu, setShowShippingSubmenu] = useState(false);
    const [showFinanceSubmenu, setShowFinanceSubmenu] = useState(false);
    const [showIntegrationSubmenu, setShowIntegrationSubmenu] = useState(false);
    const [showProductManagementSubmenu, setShowProductManagementSubmenu] = useState(false);
    const [expandedKpiCard, setExpandedKpiCard] = useState(null);
    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
    const [selectedOrderTab, setSelectedOrderTab] = useState('all');
    const [realtimeData, setRealtimeData] = useState({
        liveOrders: 0,
        liveRevenue: 0,
        activeUsers: 0,
        serverLoad: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        networkLatency: 0
    });
    const [performanceMetrics, setPerformanceMetrics] = useState({
        apiResponseTime: 0,
        successRate: 100,
        activeConnections: 0,
        requestsPerMinute: 0,
        avgProcessingTime: 0,
        cacheHitRate: 0
    });
    const [marketplaceComparison, setMarketplaceComparison] = useState([]);
    const [hourlyStats, setHourlyStats] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [showRealtimePanel, setShowRealtimePanel] = useState(true);
    const [animatedNumbers, setAnimatedNumbers] = useState({});
    const [heatmapData, setHeatmapData] = useState([]);
    const [performanceScores, setPerformanceScores] = useState({});
    const [criticalAlerts, setCriticalAlerts] = useState([]);
    const [systemHealth, setSystemHealth] = useState({
        overall: 100,
        api: 100,
        database: 100,
        sync: 100
    });
    const userId = localStorage.getItem("userId");

    useEffect(() => {
        const fetchMarketplaces = async () => {
            if (!userId) return;
            try {
                const data = await getUserMarketplaces(userId);
                const formatted = data.map(m => ({ ...m, name: m.marketplaceName }));
                setMarketplaces(formatted);
            } catch (error) {
                console.error("Pazar yerleri yüklenirken hata:", error);
            }
        };
        fetchMarketplaces();
    }, [userId]);

    // Gerçek zamanlı veri çekme ve işleme
    useEffect(() => {
        const loadDashboard = async () => {
            if (!userId) return;
            setDashboardLoading(true);
            setDashboardError("");
            try {
                const data = await fetchDashboardData(userId);
                console.log("📊 Dashboard Data:", data);
                console.log("🏪 Marketplace Status:", data?.marketplaceStatus);
                console.log("📈 Summary:", data?.summary);
                setDashboardData(data);

                // Gerçek zamanlı metrikleri hesapla
                processRealtimeMetrics(data);
                processMarketplaceComparison(data);
                processHourlyStats(data);
                processTopProducts(data);
                processRecentActivities(data);
            } catch (error) {
                console.error("Genel bakış verileri yüklenirken hata:", error);
                setDashboardError("Genel bakış verileri yüklenemedi.");
            } finally {
                setDashboardLoading(false);
            }
        };
        let intervalId;
        loadDashboard();
        intervalId = setInterval(loadDashboard, 3000);
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [userId]);

    // Gerçek zamanlı metrik işleme - ÇOK DAHA GELİŞMİŞ
    const processRealtimeMetrics = (data) => {
        const summary = data?.summary || {};
        const trends = data?.trends || {};
        const marketplaceStatus = data?.marketplaceStatus || {};

        // Canlı sipariş sayısı (Sadece Yeni ve İşleme Alınan - son 1.5 hafta)
        const liveOrders = (summary.todayOrders || 0) - ((data?.diagnostics?.pendingSyncTotal || 0) * 0); // Tüm siparişler

        // Canlı gelir
        const liveRevenue = summary.todayRevenue || 0;

        // Aktif kullanıcı simülasyonu (pazaryeri sayısı * 2 + random)
        const activeUsers = (summary.activeMarketplaces || 0) * 2 + Math.floor(Math.random() * 3);

        // Sunucu yükü (hata oranına göre + gerçekçi dalgalanma)
        const errorCount = data?.diagnostics?.errorCount || 0;
        const baseLoad = (errorCount * 8) + (liveOrders * 0.5);
        const serverLoad = Math.min(100, baseLoad + Math.random() * 15);

        // CPU kullanımı (sipariş yoğunluğuna göre)
        const cpuUsage = Math.min(100, 30 + (liveOrders * 0.3) + Math.random() * 20);

        // Bellek kullanımı (ürün sayısına göre)
        const memoryUsage = Math.min(100, 40 + ((summary.totalProducts || 0) * 0.001) + Math.random() * 15);

        // Ağ gecikmesi (pazaryeri durumuna göre)
        const activeMarketplaces = Object.values(marketplaceStatus).filter(mp => mp.status === 'active').length;
        const networkLatency = Math.round(20 + (activeMarketplaces * 5) + Math.random() * 30);

        setRealtimeData({
            liveOrders,
            liveRevenue,
            activeUsers,
            serverLoad: Math.round(serverLoad),
            cpuUsage: Math.round(cpuUsage),
            memoryUsage: Math.round(memoryUsage),
            networkLatency
        });

        // Gelişmiş API performans metrikleri
        const totalRequests = liveOrders + (data?.diagnostics?.pendingSyncTotal || 0);
        const successfulRequests = totalRequests - errorCount;
        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

        // Dakika başına istek sayısı
        const requestsPerMinute = Math.round(liveOrders / 60 + Math.random() * 10);

        // Ortalama işlem süresi (ms)
        const avgProcessingTime = Math.round(100 + (errorCount * 20) + Math.random() * 50);

        // Cache hit oranı
        const cacheHitRate = Math.round(75 + Math.random() * 20);

        setPerformanceMetrics({
            apiResponseTime: Math.round(50 + Math.random() * 150), // 50-200ms
            successRate: Math.round(successRate * 10) / 10,
            activeConnections: (summary.activeMarketplaces || 0) + Math.floor(Math.random() * 5),
            requestsPerMinute,
            avgProcessingTime,
            cacheHitRate
        });

        // Sistem sağlığı skorları
        const apiHealth = Math.round(successRate);
        const databaseHealth = Math.round(95 + Math.random() * 5);
        const syncHealth = (data?.diagnostics?.pendingSyncTotal || 0) === 0 ? 100 : Math.max(50, 100 - (data?.diagnostics?.pendingSyncTotal || 0) * 2);
        const overallHealth = Math.round((apiHealth + databaseHealth + syncHealth) / 3);

        setSystemHealth({
            overall: overallHealth,
            api: apiHealth,
            database: databaseHealth,
            sync: syncHealth
        });
    };

    // Pazaryeri karşılaştırma verilerini işle - GELİŞMİŞ
    const processMarketplaceComparison = (data) => {
        const marketplaceStatus = data?.marketplaceStatus || {};
        const summary = data?.summary || {};

        const comparison = Object.entries(marketplaceStatus).map(([name, mp]) => {
            const orders = mp.orders || 0;
            const revenue = mp.revenue || 0;
            const errors = mp.errors || 0;
            const pendingSync = mp.pendingSync || 0;

            // Performans skoru hesaplama (0-100)
            const orderScore = Math.min(100, (orders / Math.max(summary.todayOrders || 1, 1)) * 100);
            const revenueScore = Math.min(100, (revenue / Math.max(summary.todayRevenue || 1, 1)) * 100);
            const errorScore = errors === 0 ? 100 : Math.max(0, 100 - (errors * 10));
            const syncScore = pendingSync === 0 ? 100 : Math.max(0, 100 - (pendingSync * 5));
            const statusScore = mp.status === 'active' ? 100 : mp.status === 'slow' ? 60 : 20;

            const performanceScore = Math.round((orderScore * 0.25 + revenueScore * 0.35 + errorScore * 0.2 + syncScore * 0.1 + statusScore * 0.1));

            // Sağlık durumu
            let health = 'excellent';
            if (performanceScore < 50) health = 'critical';
            else if (performanceScore < 70) health = 'warning';
            else if (performanceScore < 90) health = 'good';

            // Ortalama sipariş değeri
            const avgOrderValue = orders > 0 ? revenue / orders : 0;

            // Dönüşüm oranı (simüle)
            const conversionRate = Math.round(50 + Math.random() * 30);

            return {
                name,
                orders,
                revenue,
                errors,
                pendingSync,
                health,
                performanceScore,
                avgOrderValue,
                conversionRate,
                status: mp.status || 'unknown',
                lastUpdate: mp.updatedAt || new Date().toISOString()
            };
        }).sort((a, b) => b.performanceScore - a.performanceScore);

        setMarketplaceComparison(comparison);

        // Performans skorlarını ayrı state'e kaydet
        const scores = {};
        comparison.forEach(mp => {
            scores[mp.name] = mp.performanceScore;
        });
        setPerformanceScores(scores);
    };

    // Saatlik istatistikleri işle - GELİŞMİŞ
    const processHourlyStats = (data) => {
        const trends = data?.trends || {};
        const labels = trends.labels || [];
        const orderCounts = trends.orderCounts || [];
        const revenueTotals = trends.revenueTotals || [];
        const errorRate = trends.errorRate || [];

        const hourly = labels.map((label, idx) => {
            const orders = orderCounts[idx] || 0;
            const revenue = revenueTotals[idx] || 0;
            const errors = errorRate[idx] || 0;

            return {
                hour: label,
                orders,
                revenue,
                avgOrderValue: orders > 0 ? (revenue / orders) : 0,
                errorRate: errors,
                successRate: orders > 0 ? ((orders - errors) / orders * 100) : 100,
                // Yoğunluk seviyesi (0-100)
                intensity: Math.min(100, (orders / Math.max(...orderCounts, 1)) * 100)
            };
        });

        setHourlyStats(hourly);

        // Heatmap verisi oluştur (7 gün x 24 saat)
        const heatmap = [];
        const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const value = Math.floor(Math.random() * 100); // Gerçek verilerle değiştirilecek
                heatmap.push({
                    day: days[day],
                    hour: `${hour}:00`,
                    value,
                    orders: Math.floor(value * 0.5),
                    dayIndex: day,
                    hourIndex: hour
                });
            }
        }

        setHeatmapData(heatmap);
    };

    // En çok satan ürünleri işle - GELİŞMİŞ
    const processTopProducts = (data) => {
        const summary = data?.summary || {};
        const totalOrders = summary.todayOrders || 0;
        const totalRevenue = summary.todayRevenue || 0;

        if (totalOrders > 0) {
            const products = [
                {
                    sku: 'PRD-001',
                    name: 'Premium Ürün A',
                    sales: Math.floor(totalOrders * 0.25),
                    revenue: Math.floor(totalRevenue * 0.3),
                    stock: Math.floor(Math.random() * 500) + 100,
                    trend: '+15%',
                    category: 'Elektronik',
                    rating: 4.8,
                    margin: 35
                },
                {
                    sku: 'PRD-002',
                    name: 'Popüler Ürün B',
                    sales: Math.floor(totalOrders * 0.20),
                    revenue: Math.floor(totalRevenue * 0.25),
                    stock: Math.floor(Math.random() * 400) + 80,
                    trend: '+12%',
                    category: 'Giyim',
                    rating: 4.6,
                    margin: 42
                },
                {
                    sku: 'PRD-003',
                    name: 'Trend Ürün C',
                    sales: Math.floor(totalOrders * 0.15),
                    revenue: Math.floor(totalRevenue * 0.20),
                    stock: Math.floor(Math.random() * 300) + 50,
                    trend: '+8%',
                    category: 'Ev & Yaşam',
                    rating: 4.7,
                    margin: 38
                },
                {
                    sku: 'PRD-004',
                    name: 'Klasik Ürün D',
                    sales: Math.floor(totalOrders * 0.12),
                    revenue: Math.floor(totalRevenue * 0.15),
                    stock: Math.floor(Math.random() * 250) + 40,
                    trend: '+5%',
                    category: 'Kozmetik',
                    rating: 4.5,
                    margin: 45
                },
                {
                    sku: 'PRD-005',
                    name: 'Yeni Ürün E',
                    sales: Math.floor(totalOrders * 0.10),
                    revenue: Math.floor(totalRevenue * 0.10),
                    stock: Math.floor(Math.random() * 200) + 30,
                    trend: '+20%',
                    category: 'Spor',
                    rating: 4.9,
                    margin: 40
                }
            ];

            // Her ürün için ek metrikler hesapla
            const enrichedProducts = products.map(product => ({
                ...product,
                avgPrice: product.sales > 0 ? product.revenue / product.sales : 0,
                stockStatus: product.stock < 50 ? 'critical' : product.stock < 100 ? 'low' : 'good',
                profitMargin: product.margin,
                estimatedProfit: Math.floor(product.revenue * (product.margin / 100))
            }));

            setTopProducts(enrichedProducts);
        }
    };

    // Tüm siparişleri topla ve grupla
    const getAllOrders = useMemo(() => {
        if (!dashboardData?.marketplaceStatus) return { all: [], byStatus: {}, total: 0, statusCounts: {} };

        const allOrders = [];
        const statusCounts = {
            new: 0,
            processing: 0,
            shipping: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0
        };

        Object.entries(dashboardData.marketplaceStatus).forEach(([marketplace, data]) => {
            if (data.orderDetails && Array.isArray(data.orderDetails)) {
                data.orderDetails.forEach(order => {
                    allOrders.push({
                        ...order,
                        marketplace: marketplace
                    });
                });
            }

            // Status sayılarını topla
            if (data.statusGroups) {
                Object.keys(statusCounts).forEach(status => {
                    statusCounts[status] += (data.statusGroups[status] || 0);
                });
            }
        });

        // Status bazlı gruplama
        const byStatus = {
            all: allOrders,
            new: allOrders.filter(o => {
                const s = String(o.status || "").toLowerCase();
                return s.includes('created') || s.includes('yeni') || s.includes('new');
            }),
            processing: allOrders.filter(o => {
                const s = String(o.status || "").toLowerCase();
                return s.includes('processing') || s.includes('işlem') || s.includes('hazırlan') || s.includes('picking') || s.includes('packing');
            }),
            shipping: allOrders.filter(o => {
                const s = String(o.status || "").toLowerCase();
                return s.includes('shipping') || s.includes('shipped') || s.includes('kargo') || s.includes('taşı') || s.includes('transit');
            }),
            delivered: allOrders.filter(o => {
                const s = String(o.status || "").toLowerCase();
                return s.includes('delivered') || s.includes('teslim');
            }),
            cancelled: allOrders.filter(o => {
                const s = String(o.status || "").toLowerCase();
                return s.includes('cancel') || s.includes('iptal');
            }),
            returned: allOrders.filter(o => {
                const s = String(o.status || "").toLowerCase();
                return s.includes('return') || s.includes('iade') || s.includes('refund');
            })
        };

        return {
            all: allOrders,
            byStatus,
            total: allOrders.length,
            statusCounts
        };
    }, [dashboardData]);

    // Son aktiviteleri işle - GELİŞMİŞ
    const processRecentActivities = (data) => {
        const logs = data?.logs || [];
        const marketplaceStatus = data?.marketplaceStatus || {};
        const summary = data?.summary || {};

        const activities = [];

        // Log'lardan aktivite oluştur
        logs.slice(0, 5).forEach(log => {
            activities.push({
                id: log.id,
                type: log.type,
                marketplace: log.marketplace,
                status: log.status,
                time: log.time,
                icon: log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏱️',
                priority: log.status === 'error' ? 'high' : 'normal',
                details: `${log.marketplace} - ${log.type}`
            });
        });

        // Pazaryeri durumlarından aktivite ekle
        Object.entries(marketplaceStatus).forEach(([name, mp]) => {
            if (mp.orders > 0) {
                activities.push({
                    id: `mp-${name}`,
                    type: `${mp.orders} yeni sipariş`,
                    marketplace: name,
                    status: 'success',
                    time: 'Şimdi',
                    icon: '🛒',
                    priority: 'normal',
                    details: `${formatCurrency(mp.revenue || 0)} gelir`
                });
            }
        });

        // Kritik uyarıları işle
        const alerts = data?.alerts || [];
        const critical = [];

        alerts.forEach((alert, idx) => {
            let priority = 'medium';
            let icon = '⚠️';

            if (alert.includes('token') || alert.includes('API')) {
                priority = 'critical';
                icon = '🔴';
            } else if (alert.includes('stok -') || alert.includes('başarısız')) {
                priority = 'high';
                icon = '🟠';
            }

            critical.push({
                id: `alert-${idx}`,
                message: alert,
                priority,
                icon,
                timestamp: new Date().toISOString(),
                actionRequired: priority === 'critical'
            });
        });

        // Stok uyarıları ekle
        if (summary.stockMismatchCount > 0) {
            critical.push({
                id: 'stock-alert',
                message: `${summary.stockMismatchCount} üründe stok uyuşmazlığı tespit edildi`,
                priority: summary.stockMismatchCount > 100 ? 'high' : 'medium',
                icon: '📦',
                timestamp: new Date().toISOString(),
                actionRequired: true
            });
        }

        // Hata uyarıları ekle
        if ((data?.diagnostics?.errorCount || 0) > 0) {
            critical.push({
                id: 'error-alert',
                message: `${data.diagnostics.errorCount} sistem hatası mevcut`,
                priority: data.diagnostics.errorCount > 5 ? 'critical' : 'high',
                icon: '⚠️',
                timestamp: new Date().toISOString(),
                actionRequired: true
            });
        }

        setRecentActivities(activities.slice(0, 15));
        setCriticalAlerts(critical.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }));
    };

    const particlesInit = async engine => {
        await loadSlim(engine);
    };

    const formatDateTime = (value) => {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleString("tr-TR");
    };

    const formatCurrency = (value) => {
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
    };

    const getCredentialStatusLabel = (row) => {
        if (row.status === "active") return "Aktif";
        if (row.status === "incomplete") return "Eksik";
        return "Bilinmiyor";
    };

    const getCredentialStatusClass = (row) => {
        if (row.status === "active") return "status-badge status-active";
        if (row.status === "incomplete") return "status-badge status-warning";
        return "status-badge";
    };

    const fallbackSummary = React.useMemo(() => {
        const total = marketplaces.length;
        const active = marketplaces.filter(mp => mp.credentials && Object.keys(mp.credentials || {}).length > 0)
            .length;
        const lastUpdate = marketplaces.reduce((latest, mp) => {
            const updated = mp.updatedAt ? new Date(mp.updatedAt) : null;
            if (!updated || Number.isNaN(updated.getTime())) return latest;
            return !latest || updated > latest ? updated : latest;
        }, null);
        return {
            totalMarketplaces: total,
            activeMarketplaces: active,
            missingCredentials: total - active,
            totalOrders: 0,
            pendingOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            lastOrderDate: null,
            lastIntegrationUpdate: lastUpdate ? lastUpdate.toISOString() : null,
            totalActiveProducts: 0,
            totalProducts: 0,
            activeProducts: 0,
            passiveProducts: 0,
            todayOrders: 0,
            todayRevenue: 0,
            pendingSync: 0,
            errorCount: 0,
            stockMismatchCount: 0
        };
    }, [marketplaces]);

    const summary = dashboardData?.summary || (demoMode ? sampleDashboard.summary : { ...fallbackSummary });
    const diagnostics = dashboardData?.diagnostics || (demoMode ? sampleDashboard.diagnostics : {
        marketplaces: [],
        pendingSyncTotal: summary.pendingSync || 0,
        errorCount: summary.errorCount || 0,
        stockMismatchCount: summary.stockMismatchCount || 0
    });
    const marketplaceStatus = React.useMemo(
        () => dashboardData?.marketplaceStatus || (demoMode ? sampleDashboard.marketplaceStatus : {}),
        [dashboardData, demoMode]
    );
    const fallbackTrends = React.useMemo(() => {
        const labels = [];
        const orderCounts = [];
        const revenueTotals = [];
        const today = new Date();
        for (let offset = 6; offset >= 0; offset -= 1) {
            const day = new Date(today);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - offset);
            labels.push(day.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }));
            orderCounts.push(0);
            revenueTotals.push(0);
        }
        return { labels, orderCounts, revenueTotals };
    }, []);
    const trends = dashboardData?.trends || (demoMode ? sampleDashboard.trends : fallbackTrends);
    const alerts = dashboardData?.alerts || (demoMode ? sampleDashboard.alerts : []);
    const inventory = dashboardData?.inventory || (demoMode ? sampleDashboard.inventory : {
        priceMismatch: summary.priceMismatch || 0,
        stockMismatch: summary.stockMismatchCount || 0,
        topErrorSkus: []
    });
    const logs = dashboardData?.logs || (demoMode ? sampleDashboard.logs : []);
    const quickActions = dashboardData?.quickActions || (demoMode ? sampleDashboard.quickActions : []);
    const orderTrendMax = Math.max(...trends.orderCounts, 1);
    const revenueTrendMax = Math.max(...trends.revenueTotals, 1);
    const trendOrderTotal = trends.orderCounts.reduce((sum, value) => sum + value, 0);
    const trendRevenueTotal = trends.revenueTotals.reduce((sum, value) => sum + value, 0);
    const trendAverageTicket = trendOrderTotal > 0 ? trendRevenueTotal / trendOrderTotal : 0;
    const last3Orders = trends.orderCounts.slice(-3);
    const growthFactor =
        last3Orders.length === 3 && trends.orderCounts.length >= 3
            ? ((last3Orders.reduce((a, b) => a + b, 0) + 1) / ((trendOrderTotal - last3Orders.reduce((a, b) => a + b, 0)) / Math.max(trends.orderCounts.length - 3, 1) + 1))
            : 1;
    const forecastNext7Orders = Math.round((trendOrderTotal / Math.max(trends.orderCounts.length, 1)) * 7 * growthFactor);
    const forecastNext7Revenue = (trendRevenueTotal / Math.max(trends.revenueTotals.length, 1)) * 7 * growthFactor;
    const todayRevenue = summary.todayRevenue || 0;
    const last7Revenue = trendRevenueTotal || 0;

    const aiInsights = React.useMemo(() => {
        const topMarketplace = Object.entries(marketplaceStatus || {}).sort((a, b) => (b[1]?.revenue || 0) - (a[1]?.revenue || 0))[0];
        const warnings = [];
        if (summary.stockMismatchCount > 0) warnings.push("Stok farklarını gider: eşleşmeyen SKU satış kaybı yaratır.");
        if ((diagnostics.errorCount || 0) > 0) warnings.push("API hatalarını temizle: 401/429 isteklerini yeniden yetkilendir.");
        if ((summary.pendingSync || 0) > 0) warnings.push("Bekleyen senkronları kapat: sipariş akışını aksatmasın.");

        return [
            {
                title: "7 Günlük Satış Tahmini",
                description: `Öngörülen sipariş: ${forecastNext7Orders} | Öngörülen ciro: ${formatCurrency(forecastNext7Revenue)}`
            },
            {
                title: "En Güçlü Kanal",
                description: topMarketplace
                    ? `${topMarketplace[0]} bugün ${formatCurrency(topMarketplace[1].revenue)} ile önde.`
                    : "Kanal verisi yok."
            },
            {
                title: "Uyarılar",
                description: warnings.length > 0 ? warnings.join(" ") : "Kritik uyarı yok."
            }
        ];
    }, [marketplaceStatus, summary.stockMismatchCount, diagnostics.errorCount, summary.pendingSync, forecastNext7Orders, forecastNext7Revenue]);

    const todayBreakdown = dashboardData?.todayBreakdown || [];
    const tableRows = (dashboardData?.table && dashboardData.table.length > 0
            ? dashboardData.table
            : marketplaces.map(mp => ({
                id: mp._id,
                marketplaceName: mp.marketplaceName,
                sellerId: mp.credentials?.sellerId || mp.credentials?.merchantId || mp.credentials?.supplierId || "—",
                status: mp.credentials && Object.keys(mp.credentials || {}).length > 0 ? "active" : "incomplete",
                requiredCredentialCount: 0,
                providedCredentialCount: mp.credentials ? Object.keys(mp.credentials).length : 0,
                missingCredentialCount: 0,
                updatedAt: mp.updatedAt || mp.createdAt || null,
                pendingSync: 0,
                stockMismatch: 0,
                healthStatus: "warning",
                orderCount: 0,
                revenue: 0
            }))
    );

    const getHealthClass = (healthStatus) => {
        if (healthStatus === "healthy") return "health-pill health-ok";
        if (healthStatus === "rate-limit") return "health-pill health-warn";
        if (healthStatus === "auth" || healthStatus === "warning") return "health-pill health-warn";
        return "health-pill health-error";
    };

    const formatMinutesAgo = (mins) => {
        if (mins === undefined || mins === null) return "—";
        if (mins < 1) return "Şimdi";
        if (mins < 60) return `${mins} dk önce`;
        const hours = Math.floor(mins / 60);
        return `${hours} sa ${mins % 60} dk`;
    };

    const renderDashboard = () => {
        // Gelişmiş KPI Kartları - Çok daha detaylı metrikler
        const advancedKpiCards = [
            {
                id: "today-orders",
                title: "Aktif Sipariş Performansı (Son 1.5 Hafta)",
                mainValue: getAllOrders.total || 0,
                mainLabel: "Toplam Aktif Sipariş",
                icon: "📦",
                color: "#4ecdc4",
                gradient: "linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)",
                metrics: [
                    { label: "Yeni Siparişler", value: `${getAllOrders.statusCounts.new} adet`, icon: "🆕", color: "#4ecdc4" },
                    { label: "İşleme Alınan", value: `${getAllOrders.statusCounts.processing} adet`, icon: "⚙️", color: "#f59e0b" },
                    { label: "Kargoda", value: `${getAllOrders.statusCounts.shipping} adet`, icon: "🚚", color: "#8b5cf6" },
                    { label: "Teslim Edildi", value: `${getAllOrders.statusCounts.delivered} adet`, icon: "✅", color: "#22c55e" },
                    { label: "İptal/İade", value: `${getAllOrders.statusCounts.cancelled + getAllOrders.statusCounts.returned} adet`, icon: "❌", color: "#ef4444" }
                ],
                trend: { value: "+12.5%", isPositive: true, label: "Geçen haftaya göre" },
                clickable: true,
                onClick: () => setShowOrderDetailsModal(true)
            },
            {
                id: "revenue",
                title: "Gelir Analizi",
                mainValue: formatCurrency(summary.todayRevenue || 0),
                mainLabel: "Bugünkü Ciro",
                icon: "💰",
                color: "#10b981",
                gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                metrics: [
                    { label: "7 Günlük Ortalama", value: formatCurrency(last7Revenue / 7), icon: "📈", color: "#4ecdc4" },
                    { label: "Ortalama Sepet", value: formatCurrency(summary.todayOrders > 0 ? (summary.todayRevenue / summary.todayOrders) : 0), icon: "🛒", color: "#f59e0b" },
                    { label: "Hedef Gerçekleşme", value: `%${((summary.todayRevenue || 0) / Math.max(last7Revenue / 7, 1) * 100).toFixed(1)}`, icon: "🎯", color: "#8b5cf6" },
                    { label: "Tahmini Aylık", value: formatCurrency((summary.todayRevenue || 0) * 30), icon: "📅", color: "#ec4899" }
                ],
                trend: { value: "+8.3%", isPositive: true, label: "Dün ile karşılaştırma" }
            },
            {
                id: "marketplaces",
                title: "Pazaryeri Sağlığı",
                mainValue: summary.activeMarketplaces || 0,
                mainLabel: "Aktif Pazaryeri",
                icon: "🏪",
                color: "#8b5cf6",
                gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                metrics: [
                    { label: "Toplam Entegrasyon", value: `${marketplaces.length} adet`, icon: "🔗", color: "#4ecdc4" },
                    { label: "Eksik Bilgi", value: `${summary.missingCredentials || 0} adet`, icon: "⚠️", color: "#ef4444" },
                    { label: "Sağlıklı Bağlantı", value: `%${marketplaces.length > 0 ? ((summary.activeMarketplaces || 0) / marketplaces.length * 100).toFixed(0) : 0}`, icon: "💚", color: "#22c55e" },
                    { label: "Son Güncelleme", value: summary.lastIntegrationUpdate ? new Date(summary.lastIntegrationUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : "—", icon: "🕐", color: "#06b6d4" }
                ],
                trend: { value: "Stabil", isPositive: true, label: "Tüm sistemler çalışıyor" }
            },
            {
                id: "products",
                title: "Ürün Envanteri",
                mainValue: summary.totalProducts || 0,
                mainLabel: "Toplam Ürün",
                icon: "📊",
                color: "#f59e0b",
                gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                metrics: [
                    { label: "Aktif Ürün", value: `${summary.activeProducts || 0} adet`, icon: "✅", color: "#22c55e" },
                    { label: "Pasif Ürün", value: `${summary.passiveProducts || 0} adet`, icon: "⏸️", color: "#64748b" },
                    { label: "Senkronize", value: `${summary.activeProducts || 0} adet`, icon: "🔄", color: "#4ecdc4" },
                    { label: "Senkron Oranı", value: `%${Math.round(((summary.activeProducts || 0) / Math.max(summary.totalProducts || 1, 1)) * 100)}`, icon: "📈", color: "#8b5cf6" }
                ],
                trend: { value: `${summary.pendingSync || 0} bekliyor`, isPositive: (summary.pendingSync || 0) === 0, label: "Senkronizasyon kuyruğu" }
            },
            {
                id: "errors",
                title: "Sistem Sağlığı",
                mainValue: diagnostics.errorCount || 0,
                mainLabel: "Toplam Hata",
                icon: "⚠️",
                color: (diagnostics.errorCount || 0) > 4 ? "#ef4444" : (diagnostics.errorCount || 0) > 0 ? "#f59e0b" : "#22c55e",
                gradient: (diagnostics.errorCount || 0) > 4 ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : (diagnostics.errorCount || 0) > 0 ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                metrics: [
                    { label: "API Hataları", value: `${Math.floor((diagnostics.errorCount || 0) * 0.6)} adet`, icon: "🔌", color: "#ef4444" },
                    { label: "Senkron Hataları", value: `${Math.floor((diagnostics.errorCount || 0) * 0.4)} adet`, icon: "🔄", color: "#f59e0b" },
                    { label: "Hata Oranı", value: `%${summary.todayOrders > 0 ? ((diagnostics.errorCount || 0) / summary.todayOrders * 100).toFixed(2) : 0}`, icon: "📉", color: "#8b5cf6" },
                    { label: "Sistem Durumu", value: (diagnostics.errorCount || 0) === 0 ? "Mükemmel" : (diagnostics.errorCount || 0) < 5 ? "İyi" : "Dikkat", icon: "💚", color: (diagnostics.errorCount || 0) === 0 ? "#22c55e" : "#f59e0b" }
                ],
                trend: { value: (diagnostics.errorCount || 0) === 0 ? "Hatasız" : "Dikkat gerekli", isPositive: (diagnostics.errorCount || 0) === 0, label: "Son 24 saat" }
            },
            {
                id: "stock",
                title: "Stok Uyumu",
                mainValue: summary.stockMismatchCount || 0,
                mainLabel: "Uyuşmazlık",
                icon: "📦",
                color: (summary.stockMismatchCount || 0) > 100 ? "#ef4444" : (summary.stockMismatchCount || 0) > 0 ? "#f59e0b" : "#22c55e",
                gradient: (summary.stockMismatchCount || 0) > 100 ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : (summary.stockMismatchCount || 0) > 0 ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                metrics: [
                    { label: "Stok Farkı", value: `${summary.stockMismatchCount || 0} SKU`, icon: "📉", color: "#ef4444" },
                    { label: "Fiyat Farkı", value: `${inventory.priceMismatch || 0} SKU`, icon: "💰", color: "#f59e0b" },
                    { label: "Uyum Oranı", value: `%${summary.totalProducts > 0 ? (100 - ((summary.stockMismatchCount || 0) / summary.totalProducts * 100)).toFixed(1) : 100}`, icon: "✅", color: "#22c55e" },
                    { label: "Kritik Ürün", value: `${Math.min(summary.stockMismatchCount || 0, 5)} adet`, icon: "🚨", color: "#ef4444" }
                ],
                trend: { value: (summary.stockMismatchCount || 0) === 0 ? "Mükemmel" : "Düzeltme gerekli", isPositive: (summary.stockMismatchCount || 0) === 0, label: "Envanter durumu" }
            },
            {
                id: "forecast",
                title: "7 Günlük Tahmin",
                mainValue: forecastNext7Orders,
                mainLabel: "Tahmini Sipariş",
                icon: "🔮",
                color: "#ec4899",
                gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                metrics: [
                    { label: "Tahmini Ciro", value: formatCurrency(forecastNext7Revenue), icon: "💰", color: "#10b981" },
                    { label: "Büyüme Faktörü", value: `x${growthFactor.toFixed(2)}`, icon: "📈", color: "#4ecdc4" },
                    { label: "Günlük Ortalama", value: `${(forecastNext7Orders / 7).toFixed(1)} sipariş`, icon: "📅", color: "#f59e0b" },
                    { label: "Trend", value: growthFactor > 1 ? "Yükseliş" : "Düşüş", icon: growthFactor > 1 ? "📈" : "📉", color: growthFactor > 1 ? "#22c55e" : "#ef4444" }
                ],
                trend: { value: growthFactor > 1 ? `+${((growthFactor - 1) * 100).toFixed(1)}%` : `-${((1 - growthFactor) * 100).toFixed(1)}%`, isPositive: growthFactor >= 1, label: "Büyüme trendi" }
            },
            {
                id: "basket",
                title: "Sepet Analizi",
                mainValue: formatCurrency(trendAverageTicket),
                mainLabel: "Ortalama Sepet",
                icon: "🛒",
                color: "#06b6d4",
                gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                metrics: [
                    { label: "Toplam Sipariş", value: `${trendOrderTotal} adet`, icon: "📦", color: "#4ecdc4" },
                    { label: "Toplam Ciro", value: formatCurrency(trendRevenueTotal), icon: "💰", color: "#10b981" },
                    { label: "En Yüksek Sepet", value: formatCurrency(Math.max(...trends.revenueTotals.map((rev, idx) => trends.orderCounts[idx] > 0 ? rev / trends.orderCounts[idx] : 0))), icon: "⬆️", color: "#22c55e" },
                    { label: "En Düşük Sepet", value: formatCurrency(Math.min(...trends.revenueTotals.map((rev, idx) => trends.orderCounts[idx] > 0 ? rev / trends.orderCounts[idx] : 0).filter(v => v > 0))), icon: "⬇️", color: "#ef4444" }
                ],
                trend: { value: "+5.2%", isPositive: true, label: "Geçen haftaya göre" }
            }
        ];

        const statusLabel = (status) => {
            if (status === "active") return "Aktif";
            if (status === "slow") return "Yavaş";
            if (status === "down") return "Bağlantı Yok";
            return "Bilinmiyor";
        };

        const statusTone = (status) => {
            if (status === "active") return "pill-ok";
            if (status === "slow") return "pill-warn";
            return "pill-error";
        };

        const errorRates = trends.errorRate || [];
        const peakErrorRate = errorRates.length ? Math.max(...errorRates) : null;
        const avgErrorRate = errorRates.length
            ? (errorRates.reduce((a, b) => a + b, 0) / errorRates.length).toFixed(1)
            : ((diagnostics.errorCount || 0) / Math.max(summary.todayOrders || 1, 1) * 100).toFixed(1);

        const marketplaceEntries = Object.entries(marketplaceStatus).length > 0
            ? Object.entries(marketplaceStatus)
            : tableRows.map(row => [row.marketplaceName, {
                status: row.status === "active" ? "active" : "down",
                orders: row.orderCount || 0,
                revenue: row.revenue || 0,
                pendingSync: row.pendingSync || 0,
                errors: row.stockMismatch || 0,
                updatedAt: row.updatedAt || row.createdAt,
                lastDataMinutes: 10
            }]);

        const quickActionConfig = [
            { id: "addMarketplace", label: "Yeni Pazaryeri", icon: <FaPlug />, action: () => setActivePanel("integration") },
            { id: "manualSync", label: "Manuel Senkron", icon: <FaClipboardList />, action: () => setActivePanel("integration") },
            { id: "bulkStockUpdate", label: "Toplu Stok Güncelle", icon: <FaBoxOpen />, action: () => setActivePanel("inventory") },
            { id: "priceUpdate", label: "Fiyat Güncelle", icon: <FaMoneyBillWave />, action: () => setActivePanel("finance") },
            { id: "apiSettings", label: "API Ayarları", icon: <FaCog />, action: () => setActivePanel("settings") }
        ].filter(item => quickActions.includes(item.id) || quickActions.length === 0);

        return (
            <div style={{
                width: '100%',
                minHeight: '100vh',
                background: '#0a0e1a',
                padding: 0,
                margin: 0,
                overflow: 'auto'
            }}>
                {/* Modern Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)',
                    borderBottom: '1px solid rgba(78, 205, 196, 0.2)',
                    padding: '2rem 3rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                <h1 style={{
                                    fontSize: '2.5rem',
                                    fontWeight: '800',
                                    background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    margin: 0
                                }}>
                                    Pazaryeri Operasyon Merkezi
                                </h1>
                                {dashboardLoading && (
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        border: '3px solid rgba(78, 205, 196, 0.3)',
                                        borderTop: '3px solid #4ecdc4',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                )}
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0 }}>
                                Gerçek zamanlı performans izleme ve analiz platformu
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                <span style={{
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '20px',
                                    color: '#22c55e',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>✅</span>
                                    {summary.activeMarketplaces || 0} Aktif Pazaryeri
                                </span>
                                <span style={{
                                    background: (diagnostics.errorCount || 0) > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                    border: `1px solid ${(diagnostics.errorCount || 0) > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                    padding: '0.5rem 1rem',
                                    borderRadius: '20px',
                                    color: (diagnostics.errorCount || 0) > 0 ? '#ef4444' : '#22c55e',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>{(diagnostics.errorCount || 0) > 0 ? '⚠️' : '💚'}</span>
                                    {diagnostics.errorCount || 0} Hata
                                </span>
                                <span style={{
                                    background: 'rgba(78, 205, 196, 0.1)',
                                    border: '1px solid rgba(78, 205, 196, 0.3)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '20px',
                                    color: '#4ecdc4',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>🕐</span>
                                    {summary.lastIntegrationUpdate ? new Date(summary.lastIntegrationUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : "—"}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActivePanel("orders")}
                                style={{
                                    background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                                    border: 'none',
                                    padding: '0.875rem 1.5rem',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontWeight: '700',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 15px rgba(78, 205, 196, 0.3)'
                                }}
                            >
                                📦 Siparişler
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActivePanel("integration")}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '0.875rem 1.5rem',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                ➕ Pazaryeri Ekle
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActivePanel("ai-assistant")}
                                style={{
                                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                    border: 'none',
                                    padding: '0.875rem 1.5rem',
                                    borderRadius: '10px',
                                    color: '#fff',
                                    fontWeight: '700',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
                                }}
                            >
                                🤖 AI Asistan
                            </motion.button>
                        </div>
                    </div>
                </div>

                {dashboardError && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '1rem 3rem',
                        color: '#ef4444',
                        fontSize: '0.875rem'
                    }}>
                        ⚠️ {dashboardError}
                    </div>
                )}

                {/* Gerçek Zamanlı Veri Paneli */}
                {showRealtimePanel && (
                    <div style={{ padding: '2rem 3rem 0 3rem' }}>
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(78, 205, 196, 0.15) 100%)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '16px',
                                padding: '1.5rem 2rem',
                                marginBottom: '2rem',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '200px',
                                height: '200px',
                                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
                                pointerEvents: 'none'
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        background: '#22c55e',
                                        animation: 'pulse 2s infinite',
                                        boxShadow: '0 0 15px rgba(34, 197, 94, 0.6)'
                                    }} />
                                    <h2 style={{
                                        fontSize: '1.5rem',
                                        fontWeight: '800',
                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #4ecdc4 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        margin: 0
                                    }}>
                                        🔴 CANLI VERİ AKIŞI
                                    </h2>
                                    <span style={{
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '12px',
                                        color: '#22c55e',
                                        fontSize: '0.75rem',
                                        fontWeight: '700'
                                    }}>
                                        Son 1.5 hafta - 3 saniyede bir güncelleniyor
                                    </span>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowRealtimePanel(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        color: '#94a3b8',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Gizle ✕
                                </motion.button>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1rem',
                                position: 'relative',
                                zIndex: 1
                            }}>
                                {[
                                    { label: 'Aktif Sipariş (1.5 Hafta)', value: realtimeData.liveOrders, icon: '📦', color: '#4ecdc4', suffix: ' adet' },
                                    { label: 'Canlı Gelir', value: formatCurrency(realtimeData.liveRevenue), icon: '💰', color: '#10b981', suffix: '' },
                                    { label: 'Aktif Kullanıcı', value: realtimeData.activeUsers, icon: '👥', color: '#8b5cf6', suffix: ' kişi' },
                                    { label: 'Sunucu Yükü', value: `${realtimeData.serverLoad}%`, icon: '⚡', color: realtimeData.serverLoad > 70 ? '#ef4444' : '#22c55e', suffix: '' },
                                    { label: 'CPU Kullanımı', value: `${realtimeData.cpuUsage}%`, icon: '🖥️', color: realtimeData.cpuUsage > 80 ? '#ef4444' : '#4ecdc4', suffix: '' },
                                    { label: 'Bellek', value: `${realtimeData.memoryUsage}%`, icon: '💾', color: realtimeData.memoryUsage > 85 ? '#ef4444' : '#10b981', suffix: '' },
                                    { label: 'Ağ Gecikmesi', value: `${realtimeData.networkLatency}ms`, icon: '🌐', color: realtimeData.networkLatency > 100 ? '#f59e0b' : '#22c55e', suffix: '' },
                                    { label: 'API Yanıt', value: `${performanceMetrics.apiResponseTime}ms`, icon: '⚙️', color: performanceMetrics.apiResponseTime > 150 ? '#f59e0b' : '#22c55e', suffix: '' },
                                    { label: 'Başarı Oranı', value: `${performanceMetrics.successRate}%`, icon: '✅', color: performanceMetrics.successRate > 95 ? '#22c55e' : '#f59e0b', suffix: '' },
                                    { label: 'Aktif Bağlantı', value: performanceMetrics.activeConnections, icon: '🔗', color: '#8b5cf6', suffix: ' adet' },
                                    { label: 'İstek/Dakika', value: performanceMetrics.requestsPerMinute, icon: '📊', color: '#4ecdc4', suffix: ' req' },
                                    { label: 'Cache Hit', value: `${performanceMetrics.cacheHitRate}%`, icon: '💨', color: '#10b981', suffix: '' }
                                ].map((metric, idx) => (
                                    <motion.div
                                        key={metric.label}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.03, duration: 0.3 }}
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1.25rem' }}>{metric.icon}</span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>{metric.label}</span>
                                        </div>
                                        <div style={{
                                            fontSize: '1.5rem',
                                            fontWeight: '800',
                                            color: metric.color,
                                            fontFamily: 'monospace'
                                        }}>
                                            {metric.value}{metric.suffix}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Sistem Sağlığı Göstergesi */}
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                position: 'relative',
                                zIndex: 1
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: '600' }}>🏥 Sistem Sağlığı</span>
                                    <span style={{
                                        color: systemHealth.overall > 90 ? '#22c55e' : systemHealth.overall > 70 ? '#f59e0b' : '#ef4444',
                                        fontSize: '1.25rem',
                                        fontWeight: '800'
                                    }}>
                                        {systemHealth.overall}%
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                    {[
                                        { label: 'API', value: systemHealth.api, icon: '🔌' },
                                        { label: 'Database', value: systemHealth.database, icon: '💾' },
                                        { label: 'Sync', value: systemHealth.sync, icon: '🔄' },
                                        { label: 'Overall', value: systemHealth.overall, icon: '🎯' }
                                    ].map(item => (
                                        <div key={item.label} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{item.icon}</div>
                                            <div style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '700',
                                                color: item.value > 90 ? '#22c55e' : item.value > 70 ? '#f59e0b' : '#ef4444'
                                            }}>
                                                {item.value}%
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {!showRealtimePanel && (
                    <div style={{ padding: '2rem 3rem 0 3rem' }}>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowRealtimePanel(true)}
                            style={{
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(78, 205, 196, 0.1) 100%)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                padding: '1rem 2rem',
                                borderRadius: '12px',
                                color: '#8b5cf6',
                                fontSize: '0.875rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                width: '100%',
                                marginBottom: '2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            🔴 Canlı Veri Panelini Göster
                        </motion.button>
                    </div>
                )}

                {/* Advanced KPI Grid */}
                <div style={{ padding: '2rem 3rem' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: '1.5rem',
                        marginBottom: '2rem'
                    }}>
                        {advancedKpiCards.map((card, index) => (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05, duration: 0.4 }}
                                whileHover={{ y: -5, boxShadow: `0 20px 40px ${card.color}40` }}
                                onClick={() => {
                                    if (card.clickable && card.onClick) {
                                        card.onClick();
                                    } else {
                                        setExpandedKpiCard(expandedKpiCard === card.id ? null : card.id);
                                    }
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                    border: `1px solid ${card.color}30`,
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {/* Background Gradient */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    width: '150px',
                                    height: '150px',
                                    background: `radial-gradient(circle, ${card.color}20 0%, transparent 70%)`,
                                    pointerEvents: 'none'
                                }} />

                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            background: card.gradient,
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            fontSize: '1.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: `0 4px 15px ${card.color}40`
                                        }}>
                                            {card.icon}
                                        </div>
                                        <div>
                                            <h3 style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: '#94a3b8',
                                                margin: 0,
                                                marginBottom: '0.25rem'
                                            }}>
                                                {card.title}
                                            </h3>
                                            <p style={{
                                                fontSize: '0.75rem',
                                                color: '#64748b',
                                                margin: 0
                                            }}>
                                                {card.mainLabel}
                                            </p>
                                        </div>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: expandedKpiCard === card.id ? 180 : 0 }}
                                        style={{
                                            color: card.color,
                                            fontSize: '1.25rem',
                                            fontWeight: '700'
                                        }}
                                    >
                                        ▼
                                    </motion.div>
                                </div>

                                {/* Main Value */}
                                <div style={{ marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
                                    <h2 style={{
                                        fontSize: '2.5rem',
                                        fontWeight: '800',
                                        color: '#fff',
                                        margin: 0,
                                        marginBottom: '0.5rem'
                                    }}>
                                        {card.mainValue}
                                    </h2>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap'
                                    }}>
                                        <span style={{
                                            background: card.trend.isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            border: `1px solid ${card.trend.isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '12px',
                                            color: card.trend.isPositive ? '#22c55e' : '#ef4444',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}>
                                            {card.trend.isPositive ? '📈' : '📉'} {card.trend.value}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                            {card.trend.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Metrics */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '0.75rem',
                                    position: 'relative',
                                    zIndex: 1
                                }}>
                                    {card.metrics.slice(0, 2).map((metric, idx) => (
                                        <div key={idx} style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '10px',
                                            padding: '0.75rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <span style={{ fontSize: '1rem' }}>{metric.icon}</span>
                                                <p style={{
                                                    fontSize: '0.7rem',
                                                    color: '#94a3b8',
                                                    margin: 0
                                                }}>
                                                    {metric.label}
                                                </p>
                                            </div>
                                            <p style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '700',
                                                color: metric.color,
                                                margin: 0
                                            }}>
                                                {metric.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Expanded Metrics */}
                                <AnimatePresence>
                                    {expandedKpiCard === card.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            style={{
                                                marginTop: '1rem',
                                                paddingTop: '1rem',
                                                borderTop: `1px solid ${card.color}30`,
                                                position: 'relative',
                                                zIndex: 1
                                            }}
                                        >
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '0.75rem'
                                            }}>
                                                {card.metrics.slice(2).map((metric, idx) => (
                                                    <div key={idx} style={{
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '10px',
                                                        padding: '0.75rem'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '1rem' }}>{metric.icon}</span>
                                                            <p style={{
                                                                fontSize: '0.7rem',
                                                                color: '#94a3b8',
                                                                margin: 0
                                                            }}>
                                                                {metric.label}
                                                            </p>
                                                        </div>
                                                        <p style={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: '700',
                                                            color: metric.color,
                                                            margin: 0
                                                        }}>
                                                            {metric.value}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <style>
                    {`
                        @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                    `}
                </style>

                {/* Pazaryeri Detaylı Durum Tablosu */}
                <div style={{ padding: '0 3rem 2rem 3rem' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        style={{
                            background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                            border: '1px solid rgba(78, 205, 196, 0.2)',
                            borderRadius: '16px',
                            padding: '2rem',
                            marginBottom: '2rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '700',
                                    color: '#fff',
                                    margin: 0,
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <span style={{ fontSize: '2rem' }}>🏪</span>
                                    Pazaryeri Performans Tablosu
                                </h2>
                                <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                                    Tüm entegrasyonların gerçek zamanlı durumu ve performans metrikleri
                                </p>
                            </div>
                            <span style={{
                                background: 'rgba(78, 205, 196, 0.1)',
                                border: '1px solid rgba(78, 205, 196, 0.3)',
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                color: '#4ecdc4',
                                fontSize: '0.875rem',
                                fontWeight: '700'
                            }}>
                                {marketplaceEntries.length} Kanal
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                                <thead>
                                    <tr style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
                                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Pazaryeri</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Durum</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Sipariş</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Ciro</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Senkron</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Hata</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Stok Farkı</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>Sağlık</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marketplaceEntries.map(([name, mp], idx) => (
                                        <motion.tr
                                            key={name}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.7 + idx * 0.05 }}
                                            whileHover={{ backgroundColor: 'rgba(78, 205, 196, 0.05)' }}
                                            style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <td style={{ padding: '1rem', borderRadius: '12px 0 0 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{
                                                        background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                                                        padding: '0.5rem',
                                                        borderRadius: '8px',
                                                        fontSize: '1.25rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        🛒
                                                    </div>
                                                    <div>
                                                        <p style={{ color: '#fff', fontWeight: '600', margin: 0, fontSize: '0.875rem' }}>{name}</p>
                                                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>
                                                            Son güncelleme: {mp.updatedAt ? new Date(mp.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : formatMinutesAgo(mp.lastDataMinutes)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    background: mp.status === "active" ? 'rgba(34, 197, 94, 0.1)' : mp.status === "slow" ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    border: `1px solid ${mp.status === "active" ? 'rgba(34, 197, 94, 0.3)' : mp.status === "slow" ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                                    padding: '0.375rem 0.75rem',
                                                    borderRadius: '12px',
                                                    color: mp.status === "active" ? '#22c55e' : mp.status === "slow" ? '#f59e0b' : '#ef4444',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem'
                                                }}>
                                                    {mp.status === "active" ? "✅" : mp.status === "slow" ? "⏱️" : "❌"}
                                                    {statusLabel(mp.status)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <p style={{ color: '#4ecdc4', fontWeight: '700', fontSize: '1rem', margin: 0 }}>
                                                    {mp.orders || 0}
                                                </p>
                                                <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>sipariş</p>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <p style={{ color: '#10b981', fontWeight: '700', fontSize: '0.875rem', margin: 0 }}>
                                                    {formatCurrency(mp.revenue || 0)}
                                                </p>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    background: (mp.pendingSync || 0) > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                    border: `1px solid ${(mp.pendingSync || 0) > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                                    padding: '0.375rem 0.75rem',
                                                    borderRadius: '12px',
                                                    color: (mp.pendingSync || 0) > 0 ? '#f59e0b' : '#22c55e',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700'
                                                }}>
                                                    {mp.pendingSync || 0}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    background: (mp.errors || 0) > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                    border: `1px solid ${(mp.errors || 0) > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                                    padding: '0.375rem 0.75rem',
                                                    borderRadius: '12px',
                                                    color: (mp.errors || 0) > 0 ? '#ef4444' : '#22c55e',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem'
                                                }}>
                                                    {(mp.errors || 0) > 0 ? '⚠️' : '✅'} {mp.errors || 0}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    background: (mp.stockMismatch || 0) > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                                    border: `1px solid ${(mp.stockMismatch || 0) > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                                    padding: '0.375rem 0.75rem',
                                                    borderRadius: '12px',
                                                    color: (mp.stockMismatch || 0) > 0 ? '#ef4444' : '#22c55e',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700'
                                                }}>
                                                    {mp.stockMismatch || 0}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center', borderRadius: '0 12px 12px 0' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: mp.status === "active" && (mp.errors || 0) === 0 ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : mp.status === "slow" || (mp.errors || 0) > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    margin: '0 auto',
                                                    fontSize: '1.25rem',
                                                    boxShadow: mp.status === "active" && (mp.errors || 0) === 0 ? '0 4px 15px rgba(34, 197, 94, 0.4)' : mp.status === "slow" || (mp.errors || 0) > 0 ? '0 4px 15px rgba(245, 158, 11, 0.4)' : '0 4px 15px rgba(239, 68, 68, 0.4)'
                                                }}>
                                                    {mp.status === "active" && (mp.errors || 0) === 0 ? '💚' : mp.status === "slow" || (mp.errors || 0) > 0 ? '⚠️' : '❌'}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* Gelişmiş Grafikler ve Analizler */}
                <div style={{ padding: '0 3rem 2rem 3rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Sipariş & Ciro Trend Grafiği */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: '1px solid rgba(78, 205, 196, 0.2)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{
                                    fontSize: '1.25rem',
                                    fontWeight: '700',
                                    color: '#fff',
                                    margin: 0,
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    📈 Sipariş & Ciro Trend Analizi
                                </h2>
                                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#4ecdc4' }} />
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Sipariş: {trendOrderTotal}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Ciro: {formatCurrency(trendRevenueTotal)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Hata: {avgErrorRate}%</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', height: '250px', alignItems: 'flex-end' }}>
                                {trends.labels.map((label, index) => {
                                    const orders = trends.orderCounts[index] || 0;
                                    const revenue = trends.revenueTotals[index] || 0;
                                    const orderHeight = Math.max((orders / orderTrendMax) * 100, 3);
                                    const revenueHeight = Math.max((revenue / revenueTrendMax) * 100, 3);
                                    return (
                                        <div key={`${label}-${index}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: '200px' }}>
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${revenueHeight}%` }}
                                                    transition={{ delay: 0.9 + index * 0.05, duration: 0.5 }}
                                                    style={{
                                                        flex: 1,
                                                        background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                                                        borderRadius: '4px 4px 0 0',
                                                        position: 'relative',
                                                        cursor: 'pointer'
                                                    }}
                                                    whileHover={{ opacity: 0.8 }}
                                                    title={`Ciro: ${formatCurrency(revenue)}`}
                                                />
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${orderHeight}%` }}
                                                    transition={{ delay: 0.9 + index * 0.05, duration: 0.5 }}
                                                    style={{
                                                        flex: 1,
                                                        background: 'linear-gradient(180deg, #4ecdc4 0%, #44a08d 100%)',
                                                        borderRadius: '4px 4px 0 0',
                                                        position: 'relative',
                                                        cursor: 'pointer'
                                                    }}
                                                    whileHover={{ opacity: 0.8 }}
                                                    title={`Sipariş: ${orders}`}
                                                />
                                            </div>
                                            <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: '600' }}>{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Stok & Ürün Sağlığı */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: '1px solid rgba(78, 205, 196, 0.2)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: '#fff',
                                margin: 0,
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                📦 Stok Sağlığı
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[
                                    { label: 'Toplam Ürün', value: summary.totalProducts || 0, color: '#4ecdc4', icon: '📊' },
                                    { label: 'Aktif Ürün', value: summary.activeProducts || 0, color: '#22c55e', icon: '✅' },
                                    { label: 'Pasif Ürün', value: summary.passiveProducts || 0, color: '#64748b', icon: '⏸️' },
                                    { label: 'Fiyat Farkı', value: inventory.priceMismatch || 0, color: '#f59e0b', icon: '💰' },
                                    { label: 'Stok Farkı', value: inventory.stockMismatch || summary.stockMismatchCount || 0, color: '#ef4444', icon: '⚠️' }
                                ].map((stat, idx) => (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.9 + idx * 0.05 }}
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: '600' }}>{stat.label}</span>
                                        </div>
                                        <span style={{ color: stat.color, fontSize: '1.25rem', fontWeight: '800' }}>{stat.value}</span>
                                    </motion.div>
                                ))}
                            </div>

                            {(inventory.topErrorSkus || []).length > 0 && (
                                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <h4 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                                        🚨 Kritik Ürünler
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {(inventory.topErrorSkus || []).slice(0, 5).map((sku, idx) => (
                                            <div key={sku} style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                borderRadius: '8px',
                                                padding: '0.5rem 0.75rem',
                                                color: '#ef4444',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                fontFamily: 'monospace'
                                            }}>
                                                {idx + 1}. {sku}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* AI Önerileri ve Kritik Uyarılar */}
                <div style={{ padding: '0 3rem 2rem 3rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* AI Önerileri */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: '#fff',
                                margin: 0,
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                🤖 AI Önerileri & İçgörüler
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {aiInsights.map((insight, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1.1 + idx * 0.1 }}
                                        style={{
                                            background: 'rgba(139, 92, 246, 0.1)',
                                            border: '1px solid rgba(139, 92, 246, 0.2)',
                                            borderRadius: '12px',
                                            padding: '1.25rem'
                                        }}
                                    >
                                        <h4 style={{
                                            color: '#8b5cf6',
                                            fontSize: '0.875rem',
                                            fontWeight: '700',
                                            margin: 0,
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            💡 {insight.title}
                                        </h4>
                                        <p style={{
                                            color: '#94a3b8',
                                            fontSize: '0.875rem',
                                            margin: 0,
                                            lineHeight: '1.6'
                                        }}>
                                            {insight.description}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Kritik Uyarılar */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: `1px solid ${(alerts && alerts.length > 0) ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{
                                    fontSize: '1.25rem',
                                    fontWeight: '700',
                                    color: '#fff',
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    🚨 Kritik Uyarılar
                                </h2>
                                <span style={{
                                    background: (alerts && alerts.length > 0) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                    border: `1px solid ${(alerts && alerts.length > 0) ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '12px',
                                    color: (alerts && alerts.length > 0) ? '#ef4444' : '#22c55e',
                                    fontSize: '0.75rem',
                                    fontWeight: '700'
                                }}>
                                    {(alerts && alerts.length > 0) ? alerts.length : '0'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(alerts && alerts.length > 0 ? alerts : ["✅ Kritik uyarı yok. Tüm sistemler normal çalışıyor."]).map((alert, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 1.1 + idx * 0.05 }}
                                        style={{
                                            background: alert.startsWith("✅") ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                            border: `1px solid ${alert.startsWith("✅") ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                            borderRadius: '10px',
                                            padding: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {!alert.startsWith("✅") && (
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: '#ef4444',
                                                flexShrink: 0,
                                                animation: 'pulse 2s infinite'
                                            }} />
                                        )}
                                        <p style={{
                                            color: alert.startsWith("✅") ? '#22c55e' : '#ef4444',
                                            fontSize: '0.875rem',
                                            margin: 0,
                                            fontWeight: '600'
                                        }}>
                                            {alert}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* En Çok Satan Ürünler */}
                {topProducts.length > 0 && (
                    <div style={{ padding: '0 3rem 2rem 3rem' }}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.4 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: '1px solid rgba(78, 205, 196, 0.2)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '700',
                                    color: '#fff',
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <span style={{ fontSize: '2rem' }}>🏆</span>
                                    En Çok Satan Ürünler
                                </h2>
                                <span style={{
                                    background: 'rgba(78, 205, 196, 0.1)',
                                    border: '1px solid rgba(78, 205, 196, 0.3)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '20px',
                                    color: '#4ecdc4',
                                    fontSize: '0.875rem',
                                    fontWeight: '700'
                                }}>
                                    Top {topProducts.length}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                {topProducts.map((product, idx) => (
                                    <motion.div
                                        key={product.sku}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.5 + idx * 0.05 }}
                                        whileHover={{ y: -5, boxShadow: '0 10px 30px rgba(78, 205, 196, 0.2)' }}
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '12px',
                                            padding: '1.25rem',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {/* Rank Badge */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '1rem',
                                            right: '1rem',
                                            background: idx === 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : idx === 1 ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' : 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.875rem',
                                            fontWeight: '800',
                                            color: '#fff',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                                        }}>
                                            #{idx + 1}
                                        </div>

                                        <div style={{ marginBottom: '1rem' }}>
                                            <h4 style={{
                                                color: '#fff',
                                                fontSize: '1rem',
                                                fontWeight: '700',
                                                margin: 0,
                                                marginBottom: '0.25rem'
                                            }}>
                                                {product.name}
                                            </h4>
                                            <p style={{
                                                color: '#64748b',
                                                fontSize: '0.75rem',
                                                margin: 0,
                                                fontFamily: 'monospace'
                                            }}>
                                                SKU: {product.sku}
                                            </p>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                            <div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Satış</p>
                                                <p style={{ color: '#4ecdc4', fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>{product.sales}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Gelir</p>
                                                <p style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '700', margin: 0 }}>{formatCurrency(product.revenue)}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Stok</p>
                                                <p style={{
                                                    color: product.stockStatus === 'critical' ? '#ef4444' : product.stockStatus === 'low' ? '#f59e0b' : '#22c55e',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '700',
                                                    margin: 0
                                                }}>
                                                    {product.stock}
                                                </p>
                                            </div>
                                            <div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Kar Marjı</p>
                                                <p style={{ color: '#8b5cf6', fontSize: '0.875rem', fontWeight: '700', margin: 0 }}>%{product.margin}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{
                                                background: 'rgba(34, 197, 94, 0.1)',
                                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '8px',
                                                color: '#22c55e',
                                                fontSize: '0.7rem',
                                                fontWeight: '700'
                                            }}>
                                                {product.trend}
                                            </span>
                                            <span style={{
                                                background: 'rgba(78, 205, 196, 0.1)',
                                                border: '1px solid rgba(78, 205, 196, 0.3)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '8px',
                                                color: '#4ecdc4',
                                                fontSize: '0.7rem',
                                                fontWeight: '600'
                                            }}>
                                                {product.category}
                                            </span>
                                            <span style={{
                                                background: 'rgba(245, 158, 11, 0.1)',
                                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '8px',
                                                color: '#f59e0b',
                                                fontSize: '0.7rem',
                                                fontWeight: '600'
                                            }}>
                                                ⭐ {product.rating}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Pazaryeri Karşılaştırma Detaylı */}
                {marketplaceComparison.length > 0 && (
                    <div style={{ padding: '0 3rem 2rem 3rem' }}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.6 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: '1px solid rgba(78, 205, 196, 0.2)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <h2 style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: '#fff',
                                margin: 0,
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <span style={{ fontSize: '2rem' }}>📊</span>
                                Pazaryeri Performans Karşılaştırması
                            </h2>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                {marketplaceComparison.map((mp, idx) => (
                                    <motion.div
                                        key={mp.name}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 1.7 + idx * 0.05 }}
                                        whileHover={{ scale: 1.03 }}
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: `2px solid ${mp.performanceScore > 90 ? 'rgba(34, 197, 94, 0.3)' : mp.performanceScore > 70 ? 'rgba(78, 205, 196, 0.3)' : mp.performanceScore > 50 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                            borderRadius: '12px',
                                            padding: '1.5rem',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Performance Score Circle */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '1rem',
                                            right: '1rem',
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '50%',
                                            background: `conic-gradient(${mp.performanceScore > 90 ? '#22c55e' : mp.performanceScore > 70 ? '#4ecdc4' : mp.performanceScore > 50 ? '#f59e0b' : '#ef4444'} ${mp.performanceScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <div style={{
                                                width: '50px',
                                                height: '50px',
                                                borderRadius: '50%',
                                                background: 'rgba(15, 20, 25, 0.95)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.875rem',
                                                fontWeight: '800',
                                                color: '#fff'
                                            }}>
                                                {mp.performanceScore}
                                            </div>
                                        </div>

                                        <h3 style={{
                                            color: '#fff',
                                            fontSize: '1.25rem',
                                            fontWeight: '700',
                                            margin: 0,
                                            marginBottom: '0.5rem'
                                        }}>
                                            {mp.name}
                                        </h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>📦 Sipariş</span>
                                                <span style={{ color: '#4ecdc4', fontSize: '0.875rem', fontWeight: '700' }}>{mp.orders}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>💰 Gelir</span>
                                                <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '700' }}>{formatCurrency(mp.revenue)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>🛒 Ort. Sepet</span>
                                                <span style={{ color: '#8b5cf6', fontSize: '0.875rem', fontWeight: '700' }}>{formatCurrency(mp.avgOrderValue)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>📈 Dönüşüm</span>
                                                <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: '700' }}>%{mp.conversionRate}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>⚠️ Hata</span>
                                                <span style={{
                                                    color: mp.errors > 0 ? '#ef4444' : '#22c55e',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '700'
                                                }}>
                                                    {mp.errors}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{
                                            marginTop: '1rem',
                                            paddingTop: '1rem',
                                            borderTop: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <span style={{
                                                background: mp.health === 'excellent' ? 'rgba(34, 197, 94, 0.1)' : mp.health === 'good' ? 'rgba(78, 205, 196, 0.1)' : mp.health === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                border: `1px solid ${mp.health === 'excellent' ? 'rgba(34, 197, 94, 0.3)' : mp.health === 'good' ? 'rgba(78, 205, 196, 0.3)' : mp.health === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                                padding: '0.375rem 0.75rem',
                                                borderRadius: '12px',
                                                color: mp.health === 'excellent' ? '#22c55e' : mp.health === 'good' ? '#4ecdc4' : mp.health === 'warning' ? '#f59e0b' : '#ef4444',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.375rem'
                                            }}>
                                                {mp.health === 'excellent' ? '🌟 Mükemmel' : mp.health === 'good' ? '✅ İyi' : mp.health === 'warning' ? '⚠️ Dikkat' : '❌ Kritik'}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Son İşlemler ve Hızlı Aksiyonlar */}
                <div style={{ padding: '0 3rem 3rem 3rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                        {/* Son İşlemler */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: '1px solid rgba(78, 205, 196, 0.2)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{
                                    fontSize: '1.25rem',
                                    fontWeight: '700',
                                    color: '#fff',
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    📋 Son İşlemler
                                </h2>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setActivePanel("orders")}
                                    style={{
                                        background: 'rgba(78, 205, 196, 0.1)',
                                        border: '1px solid rgba(78, 205, 196, 0.3)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        color: '#4ecdc4',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Tümünü Gör →
                                </motion.button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {(logs && logs.length > 0 ? logs : []).slice(0, 8).map((log, idx) => (
                                    <motion.div
                                        key={log.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1.3 + idx * 0.03 }}
                                        style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '10px',
                                            padding: '0.875rem 1rem',
                                            display: 'grid',
                                            gridTemplateColumns: '80px 120px 1fr 100px 60px',
                                            gap: '1rem',
                                            alignItems: 'center',
                                            transition: 'all 0.2s ease'
                                        }}
                                        whileHover={{ background: 'rgba(78, 205, 196, 0.05)' }}
                                    >
                                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>#{log.id}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>{log.marketplace}</span>
                                        <span style={{ color: '#fff', fontSize: '0.875rem' }}>{log.type}</span>
                                        <span style={{
                                            background: log.status === "error" ? 'rgba(239, 68, 68, 0.1)' : log.status === "slow" ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                            border: `1px solid ${log.status === "error" ? 'rgba(239, 68, 68, 0.3)' : log.status === "slow" ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '8px',
                                            color: log.status === "error" ? '#ef4444' : log.status === "slow" ? '#f59e0b' : '#22c55e',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            textAlign: 'center'
                                        }}>
                                            {log.status}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'right' }}>{log.time}</span>
                                    </motion.div>
                                ))}
                                {(!logs || logs.length === 0) && (
                                    <div style={{
                                        padding: '2rem',
                                        textAlign: 'center',
                                        color: '#64748b',
                                        fontSize: '0.875rem'
                                    }}>
                                        Henüz işlem kaydı yok.
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Hızlı Aksiyonlar */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.8) 0%, rgba(15, 20, 25, 0.8) 100%)',
                                border: '1px solid rgba(78, 205, 196, 0.2)',
                                borderRadius: '16px',
                                padding: '2rem'
                            }}
                        >
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: '#fff',
                                margin: 0,
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                ⚡ Hızlı Aksiyonlar
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {quickActionConfig.map((action, idx) => (
                                    <motion.button
                                        key={action.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1.3 + idx * 0.05 }}
                                        whileHover={{ scale: 1.02, x: 5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={action.action}
                                        style={{
                                            background: 'rgba(78, 205, 196, 0.05)',
                                            border: '1px solid rgba(78, 205, 196, 0.2)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{
                                            background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                                            padding: '0.75rem',
                                            borderRadius: '10px',
                                            color: '#fff',
                                            fontSize: '1.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 15px rgba(78, 205, 196, 0.3)'
                                        }}>
                                            {action.icon}
                                        </div>
                                        <span style={{
                                            color: '#fff',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            flex: 1,
                                            textAlign: 'left'
                                        }}>
                                            {action.label}
                                        </span>
                                        <span style={{ color: '#4ecdc4', fontSize: '1rem' }}>→</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Sipariş Detayları Modal */}
                <AnimatePresence>
                    {showOrderDetailsModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowOrderDetailsModal(false)}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.8)',
                                backdropFilter: 'blur(10px)',
                                zIndex: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2rem'
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 50 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 50 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: 'linear-gradient(135deg, rgba(26, 31, 53, 0.95) 0%, rgba(15, 20, 25, 0.95) 100%)',
                                    border: '1px solid rgba(78, 205, 196, 0.3)',
                                    borderRadius: '20px',
                                    padding: '2rem',
                                    maxWidth: '1200px',
                                    width: '100%',
                                    maxHeight: '90vh',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
                                }}
                            >
                                {/* Modal Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <h2 style={{
                                        fontSize: '2rem',
                                        fontWeight: '800',
                                        background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        margin: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}>
                                        <span style={{ fontSize: '2.5rem' }}>📦</span>
                                        Aktif Siparişler (Son 1.5 Hafta) - Detaylı Görünüm
                                    </h2>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowOrderDetailsModal(false)}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '50%',
                                            width: '40px',
                                            height: '40px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: '#ef4444',
                                            fontSize: '1.5rem',
                                            fontWeight: '700'
                                        }}
                                    >
                                        ✕
                                    </motion.button>
                                </div>

                                {/* Status Tabs */}
                                <div style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    marginBottom: '1.5rem',
                                    flexWrap: 'wrap',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    paddingBottom: '1rem'
                                }}>
                                    {[
                                        { id: 'all', label: 'Tümü', count: getAllOrders.total, icon: '📦', color: '#4ecdc4' },
                                        { id: 'new', label: 'Yeni', count: getAllOrders.statusCounts.new, icon: '🆕', color: '#4ecdc4' },
                                        { id: 'processing', label: 'İşlemde', count: getAllOrders.statusCounts.processing, icon: '⚙️', color: '#f59e0b' },
                                        { id: 'shipping', label: 'Kargoda', count: getAllOrders.statusCounts.shipping, icon: '🚚', color: '#8b5cf6' },
                                        { id: 'delivered', label: 'Teslim', count: getAllOrders.statusCounts.delivered, icon: '✅', color: '#22c55e' },
                                        { id: 'cancelled', label: 'İptal', count: getAllOrders.statusCounts.cancelled, icon: '❌', color: '#ef4444' },
                                        { id: 'returned', label: 'İade', count: getAllOrders.statusCounts.returned, icon: '↩️', color: '#f59e0b' }
                                    ].map(tab => (
                                        <motion.button
                                            key={tab.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setSelectedOrderTab(tab.id)}
                                            style={{
                                                background: selectedOrderTab === tab.id
                                                    ? `linear-gradient(135deg, ${tab.color}30 0%, ${tab.color}20 100%)`
                                                    : 'rgba(255,255,255,0.03)',
                                                border: selectedOrderTab === tab.id
                                                    ? `2px solid ${tab.color}`
                                                    : '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                                padding: '0.75rem 1.5rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <span style={{ fontSize: '1.25rem' }}>{tab.icon}</span>
                                            <span style={{
                                                color: selectedOrderTab === tab.id ? tab.color : '#94a3b8',
                                                fontSize: '0.875rem',
                                                fontWeight: '700'
                                            }}>
                                                {tab.label}
                                            </span>
                                            <span style={{
                                                background: selectedOrderTab === tab.id ? tab.color : 'rgba(255,255,255,0.1)',
                                                color: selectedOrderTab === tab.id ? '#000' : '#fff',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: '800'
                                            }}>
                                                {tab.count}
                                            </span>
                                        </motion.button>
                                    ))}
                                </div>

                                {/* Orders List */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    paddingRight: '1rem'
                                }}>
                                    {getAllOrders.byStatus[selectedOrderTab]?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {getAllOrders.byStatus[selectedOrderTab].map((order, idx) => (
                                                <motion.div
                                                    key={`${order.orderNumber}-${idx}`}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.02 }}
                                                    whileHover={{ x: 5, boxShadow: '0 10px 30px rgba(78, 205, 196, 0.2)' }}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: '12px',
                                                        padding: '1rem 1.5rem',
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                                                        gap: '1rem',
                                                        alignItems: 'center',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    <div>
                                                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Sipariş No</p>
                                                        <p style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '700', margin: 0, fontFamily: 'monospace' }}>
                                                            {order.orderNumber || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Pazaryeri</p>
                                                        <p style={{ color: '#4ecdc4', fontSize: '0.875rem', fontWeight: '700', margin: 0, textTransform: 'capitalize' }}>
                                                            {order.marketplace || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Tutar</p>
                                                        <p style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '700', margin: 0 }}>
                                                            {formatCurrency(order.totalPrice || 0)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, marginBottom: '0.25rem' }}>Tarih</p>
                                                        <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', margin: 0 }}>
                                                            {order.orderDate ? new Date(order.orderDate).toLocaleString('tr-TR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            }) : 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span style={{
                                                            background: order.status?.toLowerCase().includes('delivered') || order.status?.toLowerCase().includes('teslim') ? 'rgba(34, 197, 94, 0.1)' :
                                                                       order.status?.toLowerCase().includes('shipping') || order.status?.toLowerCase().includes('kargo') ? 'rgba(139, 92, 246, 0.1)' :
                                                                       order.status?.toLowerCase().includes('cancel') || order.status?.toLowerCase().includes('iptal') ? 'rgba(239, 68, 68, 0.1)' :
                                                                       'rgba(245, 158, 11, 0.1)',
                                                            border: order.status?.toLowerCase().includes('delivered') || order.status?.toLowerCase().includes('teslim') ? '1px solid rgba(34, 197, 94, 0.3)' :
                                                                   order.status?.toLowerCase().includes('shipping') || order.status?.toLowerCase().includes('kargo') ? '1px solid rgba(139, 92, 246, 0.3)' :
                                                                   order.status?.toLowerCase().includes('cancel') || order.status?.toLowerCase().includes('iptal') ? '1px solid rgba(239, 68, 68, 0.3)' :
                                                                   '1px solid rgba(245, 158, 11, 0.3)',
                                                            color: order.status?.toLowerCase().includes('delivered') || order.status?.toLowerCase().includes('teslim') ? '#22c55e' :
                                                                  order.status?.toLowerCase().includes('shipping') || order.status?.toLowerCase().includes('kargo') ? '#8b5cf6' :
                                                                  order.status?.toLowerCase().includes('cancel') || order.status?.toLowerCase().includes('iptal') ? '#ef4444' :
                                                                  '#f59e0b',
                                                            padding: '0.375rem 0.75rem',
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '700',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {order.status || 'Bilinmiyor'}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '4rem',
                                            color: '#64748b'
                                        }}>
                                            <span style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</span>
                                            <p style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Bu kategoride sipariş bulunamadı</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <style>
                    {`
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.5; }
                        }
                    `}
                </style>
            </div>
        );
    };

    const menuItems = [
        { id: "dashboard", icon: <FaChartLine />, text: "Genel Bakış" },
        { id: "integration", icon: <FaPlug />, text: "Entegrasyonlar" },
        { id: "orders", icon: <FaClipboardList />, text: "Sipariş Yönetimi" },
        { id: "inventory", icon: <FaBoxOpen />, text: "Stok Yönetimi" },
        { id: "shipping", icon: <FaTruck />, text: "Kargo Yönetimi" },
        { id: "finance", icon: <FaMoneyBillWave />, text: "Finans Yönetimi" },
        { id: "analytics", icon: <FaChartPie />, text: "Analiz (Eski)" },
        { id: "advanced-analytics", icon: <FaChartBar />, text: "Gelişmiş Analiz" },
        { id: "users", icon: <FaUsers />, text: "Kullanıcı Yönetimi" },
        { id: "billing", icon: <FaFileInvoice />, text: "Faturalandırma" },
        { id: "ai-assistant", icon: <FaRobot />, text: "AI Asistanı (Eski)" },
        { id: "advanced-ai", icon: <FaBrain />, text: "Gelişmiş AI Asistan" },
        { id: "settings", icon: <FaCog />, text: "Ayarlar" },
    ];

    const renderMarketplaceSubmenu = type => (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="submenu"
        >
            {marketplaces.map(m => (
                <motion.div
                    key={m._id}
                    className={`menu-item submenu-item ${
                        activePanel === `${type}-${m._id}` ? "active" : ""
                    }`}
                    onClick={() => {
                        setActivePanel(`${type}-${m._id}`);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <div className="icon-wrapper">
                        {m.logo ? (
                            <img src={m.logo} alt={m.name} style={{ width: 20, height: 20 }} />
                        ) : (
                            <FaBox />
                        )}
                    </div>
                    <motion.span className="menu-text" animate={{ opacity: menuOpen ? 1 : 0 }}>
                        {m.name || "Bilinmeyen Pazaryeri"}
                    </motion.span>
                </motion.div>
            ))}
        </motion.div>
    );

    const renderSettings = () => (
        <div className="content-wrapper">
            <h1 className="content-title">
                <FaCog /> Ayarlar
            </h1>
            <p>Hesap ve uygulama ayarlarınızı buradan yönetin.</p>
        </div>
    );

    const renderActivePanel = () => {
        if (activePanel.startsWith("finance-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return (
                <FinancePage
                    userId={userId}
                    marketplaces={marketplaces}
                    marketplaceId={marketplaceId}
                    marketplace={marketplace}
                />
            );
        }

        if (activePanel.startsWith("orders-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return (
                <OrdersPage
                    userId={userId}
                    marketplaceId={marketplaceId}
                    marketplace={marketplace}
                />
            );
        }

        if (activePanel.startsWith("inventory-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return (
                <InventoryPage
                    userId={userId}
                    marketplaceId={marketplaceId}
                    marketplace={marketplace}
                />
            );
        }

        if (activePanel.startsWith("shipping-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return (
                <CargoTrackingPage
                    userId={userId}
                    marketplaceId={marketplaceId}
                    marketplace={marketplace}
                />
            );
        }

        if (activePanel.startsWith("integration-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return (
                <MarketplaceIntegration
                    userId={userId}
                    marketplaceId={marketplaceId}
                    marketplace={marketplace}
                />
            );
        }

        // Ürün Yönetimi alt menü panelleri — her biri ProductManagementHub'ı ilgili sekmeyle açar
        const pmhTabMap = {
            "product-management": "dashboard",
            "pm-products": "products",
            "pm-pull-push": "pull-push",
            "pm-pricing": "pricing",
            "pm-comparison": "comparison",
            "pm-categories": "categories",
            "pm-excel": "excel",
            "pm-logs": "logs",
        };

        if (pmhTabMap[activePanel] !== undefined) {
            return (
                <div style={{ margin: "-2rem", width: "calc(100% + 4rem)", minHeight: "100%", color: "inherit" }}>
                    <ProductManagementHub initialTab={pmhTabMap[activePanel]} />
                </div>
            );
        }

        switch (activePanel) {
            case "product-management-v4":
            case "new-product-upload":
            case "product-sync":
            case "sync-notifications":
            case "advanced-product-management":
                return <ProductManagementPageV3 />;
            case "finance":
                return (
                    <FinancePage userId={userId} marketplaces={marketplaces} />
                );
            case "ai-assistant":
                return <AIPanel userId={userId} marketplaces={marketplaces} />;
            case "integration":
                return (
                    <div className="content-wrapper">
                        <h1 className="content-title">
                            <FaPlug /> Entegrasyon Yönetimi
                        </h1>
                        <MarketplaceIntegration userId={userId} />
                    </div>
                );
            case "users":
                return <UserProfilePage userId={userId} marketplaces={marketplaces} />;
            case "analytics":
                return <AnalyticsPage userId={userId} marketplaces={marketplaces} />;
            case "advanced-analytics":
                return <AdvancedAnalytics userId={userId} />;
            case "advanced-ai":
                return <AdvancedAIAssistant userId={userId} />;
            case "dashboard":
                return renderDashboard();
            case "settings":
                return renderSettings();
            default:
                return null;
        }
    };


    return (
        <div className="dashboard-container">
            <Particles
                id="tsparticles"
                init={particlesInit}
                options={{
                    background: { color: "#0a0e1a" },
                    particles: {
                        number: { value: 120 },
                        color: { value: ["#ff6b6b", "#4ecdc4", "#45b7d1"] },
                        shape: { type: "circle" },
                        opacity: { value: 0.7 },
                        size: { value: { min: 1, max: 5 } },
                        move: { enable: true, speed: 2.5, direction: "none", outModes: "bounce" },
                    },
                }}
            />

            <motion.aside
                className={`sidebar ${menuOpen ? "open" : "closed"}`}
                animate={{ width: menuOpen ? 280 : 80 }}
                transition={{ type: "spring", stiffness: 300 }}
            >
                <div className="sidebar-header">
                    <motion.div
                        className="logo-container"
                        animate={{ opacity: menuOpen ? 1 : 0, x: menuOpen ? 0 : -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h1 className="logo">
                            <span className="logo-main">LUNEX</span>
                            <span className="logo-sub">ETİC</span>
                        </h1>
                    </motion.div>
                    <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <FaTimes /> : <FaBars />}
                    </button>
                </div>

                <nav className="sidebar-menu">
                    {menuItems.map(item => (
                        <React.Fragment key={item.id}>
                            <motion.div
                                className={`menu-item ${activePanel === item.id ? "active" : ""}`}
                                onClick={() => {
                                    setShowOrdersSubmenu(false);
                                    setShowInventorySubmenu(false);
                                    setShowProductManagement(false);
                                    setShowShippingSubmenu(false);
                                    setShowFinanceSubmenu(false);
                                    setShowIntegrationSubmenu(false);
                                    if (item.id === "orders") setShowOrdersSubmenu(!showOrdersSubmenu);
                                    else if (item.id === "inventory") setShowInventorySubmenu(!showInventorySubmenu);
                                    else if (item.id === "shipping") setShowShippingSubmenu(!showShippingSubmenu);
                                    else if (item.id === "finance") setShowFinanceSubmenu(!showFinanceSubmenu);
                                    else if (item.id === "integration") setShowIntegrationSubmenu(!showIntegrationSubmenu);
                                    else setActivePanel(item.id);
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div className="icon-wrapper">{item.icon}</div>
                                <motion.span className="menu-text" animate={{ opacity: menuOpen ? 1 : 0 }}>
                                    {item.text}
                                </motion.span>
                                {["orders", "inventory", "shipping", "finance", "integration"].includes(
                                    item.id
                                ) && (
                                    showFinanceSubmenu && item.id === "finance" ? (
                                        <FaChevronUp />
                                    ) : !showFinanceSubmenu && item.id === "finance" ? (
                                        <FaChevronDown />
                                    ) : (item.id !== "finance") &&
                                    ((item.id === "orders" && showOrdersSubmenu) ||
                                        (item.id === "inventory" && showInventorySubmenu) ||
                                        (item.id === "shipping" && showShippingSubmenu) ||
                                        (item.id === "integration" && showIntegrationSubmenu)) ? (
                                        <FaChevronUp />
                                    ) : (
                                        <FaChevronDown />
                                    )
                                )}
                                <div className="active-indicator" />
                            </motion.div>

                            {item.id === "orders" && (
                                <AnimatePresence>
                                    {showOrdersSubmenu && renderMarketplaceSubmenu("orders")}
                                </AnimatePresence>
                            )}
                            {item.id === "inventory" && (
                                <AnimatePresence>
                                    {showInventorySubmenu && renderMarketplaceSubmenu("inventory")}
                                </AnimatePresence>
                            )}
                            {item.id === "shipping" && (
                                <AnimatePresence>
                                    {showShippingSubmenu && renderMarketplaceSubmenu("shipping")}
                                </AnimatePresence>
                            )}
                            {item.id === "finance" && (
                                <AnimatePresence>
                                    {showFinanceSubmenu && renderMarketplaceSubmenu("finance")}
                                </AnimatePresence>
                            )}
                            {item.id === "integration" && (
                                <AnimatePresence>
                                    {showIntegrationSubmenu && renderMarketplaceSubmenu("integration")}
                                </AnimatePresence>
                            )}
                        </React.Fragment>
                    ))}

                    {/* ═══════════════════════════════════════════════════
                         ÜRÜN YÖNETİMİ — AÇILIR ALT MENÜ
                    ═══════════════════════════════════════════════════ */}
                    <motion.div
                        className={`menu-item ${
                            activePanel.startsWith("pm-") || activePanel === "product-management" ? "active" : ""
                        }`}
                        onClick={() => {
                            setShowOrdersSubmenu(false);
                            setShowInventorySubmenu(false);
                            setShowShippingSubmenu(false);
                            setShowFinanceSubmenu(false);
                            setShowIntegrationSubmenu(false);
                            setShowProductManagementSubmenu(!showProductManagementSubmenu);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <div className="icon-wrapper" style={{
                            background: 'linear-gradient(135deg, #0f766e, #0891b2)',
                            borderRadius: '8px',
                            padding: '4px'
                        }}>
                            <FaLayerGroup style={{ color: '#fff' }} />
                        </div>
                        <motion.span className="menu-text" animate={{ opacity: menuOpen ? 1 : 0 }}>
                            Ürün Yönetimi
                        </motion.span>
                        {showProductManagementSubmenu ? <FaChevronUp /> : <FaChevronDown />}
                    </motion.div>

                    <AnimatePresence>
                        {showProductManagementSubmenu && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="submenu"
                            >
                                {[
                                    { id: "product-management", icon: <FaChartBar />, text: "Dashboard" },
                                    { id: "pm-products", icon: <FaBoxOpen />, text: "Ürünlerim" },
                                    { id: "pm-pull-push", icon: <FaCloudDownloadAlt />, text: "Çek & Yükle" },
                                    { id: "pm-pricing", icon: <FaMoneyBillWave />, text: "Fiyatlandırma" },
                                    { id: "pm-comparison", icon: <FaTable />, text: "Karşılaştırma" },
                                    { id: "pm-categories", icon: <FaLayerGroup />, text: "Kategori Mapping" },
                                    { id: "pm-excel", icon: <FaFileInvoice />, text: "Excel İçe/Dışa" },
                                    { id: "pm-logs", icon: <FaClipboardList />, text: "Loglar" },
                                ].map(sub => (
                                    <motion.div
                                        key={sub.id}
                                        className={`menu-item submenu-item ${
                                            activePanel === sub.id ? "active" : ""
                                        }`}
                                        onClick={() => setActivePanel(sub.id)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <div className="icon-wrapper">{sub.icon}</div>
                                        <motion.span className="menu-text" animate={{ opacity: menuOpen ? 1 : 0 }}>
                                            {sub.text}
                                        </motion.span>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </nav>
            </motion.aside>

            <AnimatePresence mode="wait">
                <motion.main
                    key={activePanel}
                    className="content-area"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    style={{ color: "#ffffff" }}
                >
                    {renderActivePanel()}
                </motion.main>
            </AnimatePresence>
        </div>
    );
};

export default UserDashboard;
