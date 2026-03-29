import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaChartLine, FaShoppingCart, FaMoneyBillWave, FaArrowUp,
    FaStore, FaDownload, FaFire, FaStar, FaArrowDown,
    FaClock, FaUsers, FaPercent, FaChartBar, FaChartPie,
    FaExclamationTriangle, FaCheckCircle, FaSync,
    FaInfoCircle, FaBolt, FaDollarSign, FaWarehouse,
    FaBoxes, FaLayerGroup, FaCalendarAlt, FaEye,
    FaLightbulb, FaGlobeAmericas, FaBalanceScale,
    FaCubes, FaSearchDollar, FaRegChartBar
} from "react-icons/fa";
import {
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, Treemap, ScatterChart, Scatter, ZAxis
} from "recharts";
import { getUserMarketplaces, fetchDashboardData } from "../services/marketplaceApi";
import axios from "../services/api";
import "../styles/advancedAnalytics.css";

const API_BASE = (process.env.REACT_APP_API_URL || "http://13.51.158.124:5000") + "/api";
const COLORS = ['#4ecdc4', '#ff6b6b', '#ffd93d', '#6bcf7f', '#a29bfe', '#fd79a8', '#fdcb6e', '#00b894', '#e17055', '#0984e3'];

const formatCurrency = (value) => {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
};

const formatNumber = (value) => {
    return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
};

const getToken = () => localStorage.getItem("token");

const authHeaders = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`
});

// ─── Tab definitions ───
const TABS = [
    { id: "overview", label: "Genel Bakış", icon: FaEye },
    { id: "marketplaces", label: "Pazaryerleri", icon: FaStore },
    { id: "products", label: "Ürün Analizi", icon: FaBoxes },
    { id: "categories", label: "Kategori Analizi", icon: FaLayerGroup },
    { id: "trends", label: "Satış Trendleri", icon: FaChartLine },
    { id: "inventory", label: "Envanter & Stok", icon: FaWarehouse },
    { id: "insights", label: "AI İçgörüler", icon: FaLightbulb }
];

const AdvancedAnalytics = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [dateRange, setDateRange] = useState("30");
    const [selectedMarketplace, setSelectedMarketplace] = useState("all");
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Data states
    const [marketplaces, setMarketplaces] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [analyticsOverview, setAnalyticsOverview] = useState(null);
    const [salesTrend, setSalesTrend] = useState([]);
    const [marketplaceDistribution, setMarketplaceDistribution] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [categoryDistribution, setCategoryDistribution] = useState([]);
    const [hourlySales, setHourlySales] = useState([]);
    const [realProducts, setRealProducts] = useState([]);
    const [marketplacePerformance, setMarketplacePerformance] = useState([]);
    const [stockAnalysis, setStockAnalysis] = useState({ healthy: 0, low: 0, critical: 0, outOfStock: 0, total: 0, items: [] });
    const [aiInsights, setAiInsights] = useState([]);
    const [priceAnalysis, setPriceAnalysis] = useState([]);
    const [revenueByDay, setRevenueByDay] = useState([]);
    const [comparisonData, setComparisonData] = useState(null);

    // ─── Date range helper ───
    const getDateParams = useCallback(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(dateRange));
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        };
    }, [dateRange]);

    // ─── Fetch analytics API endpoints ───
    const fetchAnalyticsEndpoint = useCallback(async (endpoint, params = {}) => {
        try {
            const token = getToken();
            if (!token) return null;
            const dateParams = getDateParams();
            const response = await axios.get(`${API_BASE}/analytics/${endpoint}`, {
                headers: authHeaders(),
                params: { ...dateParams, ...params }
            });
            return response.data?.data || response.data || null;
        } catch (err) {
            console.warn(`Analytics ${endpoint} fetch failed:`, err.message);
            return null;
        }
    }, [getDateParams]);

    // ─── Fetch real products from all marketplaces ───
    const fetchAllProducts = useCallback(async (mps) => {
        const allProducts = [];
        const marketplaceList = mps || marketplaces;
        for (const mp of marketplaceList) {
            try {
                const res = await axios.get(`${API_BASE}/products/all/${userId}`, {
                    params: { marketplaceId: mp._id }
                });
                const products = res.data?.products || [];
                allProducts.push(...products.map(p => ({ ...p, marketplaceId: mp._id, marketplaceName: mp.marketplaceName })));
            } catch (err) {
                console.warn(`Products fetch failed for ${mp.marketplaceName}:`, err.message);
            }
        }
        return allProducts;
    }, [userId, marketplaces]);

    // ─── Process stock analysis from real products ───
    const processStockAnalysis = useCallback((products) => {
        let healthy = 0, low = 0, critical = 0, outOfStock = 0;
        const items = [];

        products.forEach(p => {
            const stock = Number(p.stock || 0);
            const price = Number(p.price || p.salePrice || 0);
            let status = 'healthy';

            if (stock === 0) { outOfStock++; status = 'outOfStock'; }
            else if (stock <= 5) { critical++; status = 'critical'; }
            else if (stock <= 20) { low++; status = 'low'; }
            else { healthy++; status = 'healthy'; }

            items.push({
                name: p.productName || p.name || 'Bilinmiyor',
                stock,
                price,
                marketplace: p.marketplaceName || p.marketplace || 'Bilinmiyor',
                category: p.categoryName || p.category || 'Bilinmiyor',
                status,
                image: p.productImage || p.images?.[0] || '',
                barcode: p.barcode || ''
            });
        });

        items.sort((a, b) => a.stock - b.stock);

        return {
            healthy, low, critical, outOfStock,
            total: products.length,
            items: items.slice(0, 50)
        };
    }, []);

    // ─── Process price analysis from real products ───
    const processPriceAnalysis = useCallback((products) => {
        const byMarketplace = {};
        products.forEach(p => {
            const mp = p.marketplaceName || p.marketplace || 'Bilinmiyor';
            if (!byMarketplace[mp]) byMarketplace[mp] = { prices: [], products: 0, totalValue: 0 };
            const price = Number(p.price || p.salePrice || 0);
            const listPrice = Number(p.listPrice || price);
            byMarketplace[mp].prices.push({ price, listPrice, name: p.productName || p.name });
            byMarketplace[mp].products++;
            byMarketplace[mp].totalValue += price * Number(p.stock || 0);
        });

        return Object.entries(byMarketplace).map(([name, data]) => {
            const prices = data.prices.map(p => p.price).filter(p => p > 0);
            const listPrices = data.prices.map(p => p.listPrice).filter(p => p > 0);
            const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
            const avgListPrice = listPrices.length > 0 ? listPrices.reduce((a, b) => a + b, 0) / listPrices.length : 0;
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
            const discountRate = avgListPrice > 0 ? ((avgListPrice - avgPrice) / avgListPrice * 100) : 0;

            return {
                marketplace: name,
                avgPrice,
                avgListPrice,
                minPrice,
                maxPrice,
                discountRate: discountRate.toFixed(1),
                productCount: data.products,
                totalStockValue: data.totalValue
            };
        });
    }, []);

    // ─── Generate AI insights from real data ───
    const generateAIInsights = useCallback((dashboard, products, mpDist, topProds, catDist, hourly, overview) => {
        const insights = [];
        const summary = dashboard?.summary || {};
        const mpStatus = dashboard?.marketplaceStatus || {};

        // 1. Revenue insight
        const totalRevenue = summary.todayRevenue || overview?.totalRevenue || 0;
        const totalOrders = summary.todayOrders || overview?.totalOrders || 0;
        const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        if (totalRevenue > 0) {
            insights.push({
                type: avgOrder > 500 ? 'success' : avgOrder > 200 ? 'info' : 'warning',
                title: 'Gelir Analizi',
                icon: FaMoneyBillWave,
                text: `Toplam ${formatCurrency(totalRevenue)} gelir, ${formatNumber(totalOrders)} sipariş ile elde edildi. Ortalama sepet değeri ${formatCurrency(avgOrder)}.`,
                detail: avgOrder > 500
                    ? 'Ortalama sepet değeriniz yüksek seviyede. Premium ürün stratejiniz başarılı.'
                    : avgOrder > 200
                    ? 'Ortalama sepet değeri makul seviyede. Cross-sell stratejileri ile artırılabilir.'
                    : 'Ortalama sepet değeri düşük. Paket ürünler veya minimum sepet tutarı kampanyaları düşünün.',
                metric: formatCurrency(avgOrder),
                metricLabel: 'Ort. Sepet'
            });
        }

        // 2. Marketplace performance insight
        const mpEntries = Object.entries(mpStatus);
        if (mpEntries.length > 0) {
            const bestMp = mpEntries.reduce((best, [name, data]) => {
                return (data.revenue || 0) > (best.revenue || 0) ? { name, ...data } : best;
            }, { name: '', revenue: 0 });

            const worstMp = mpEntries.reduce((worst, [name, data]) => {
                if (worst.name === '') return { name, ...data };
                return (data.revenue || 0) < (worst.revenue || 0) ? { name, ...data } : worst;
            }, { name: '', revenue: 0 });

            if (bestMp.name) {
                const bestShare = totalRevenue > 0 ? ((bestMp.revenue / totalRevenue) * 100).toFixed(1) : 0;
                insights.push({
                    type: 'success',
                    title: 'En İyi Pazaryeri',
                    icon: FaStar,
                    text: `${bestMp.name} pazaryeri %${bestShare} pazar payı ile lider konumda. ${formatCurrency(bestMp.revenue)} gelir, ${formatNumber(bestMp.orders || 0)} sipariş.`,
                    detail: 'Bu pazaryerindeki başarılı stratejilerinizi diğer platformlara da uygulayın.',
                    metric: `%${bestShare}`,
                    metricLabel: 'Pazar Payı'
                });
            }

            if (worstMp.name && mpEntries.length > 1 && worstMp.name !== bestMp.name) {
                insights.push({
                    type: 'warning',
                    title: 'Geliştirilmesi Gereken Pazaryeri',
                    icon: FaExclamationTriangle,
                    text: `${worstMp.name} pazaryeri en düşük performansı gösteriyor. ${formatCurrency(worstMp.revenue || 0)} gelir.`,
                    detail: 'Bu platformda ürün çeşitliliğini artırın, fiyat optimizasyonu yapın ve kampanyalara katılın.',
                    metric: formatCurrency(worstMp.revenue || 0),
                    metricLabel: 'Gelir'
                });
            }

            // Error insight
            const errorMps = mpEntries.filter(([, data]) => (data.errors || 0) > 0);
            if (errorMps.length > 0) {
                const totalErrors = errorMps.reduce((sum, [, data]) => sum + (data.errors || 0), 0);
                insights.push({
                    type: 'critical',
                    title: 'Entegrasyon Hataları',
                    icon: FaExclamationTriangle,
                    text: `${errorMps.length} pazaryerinde toplam ${totalErrors} hata tespit edildi: ${errorMps.map(([n]) => n).join(', ')}.`,
                    detail: 'Entegrasyon hatalarını hemen kontrol edin. Sipariş kaybına neden olabilir.',
                    metric: totalErrors,
                    metricLabel: 'Hata'
                });
            }
        }

        // 3. Stock insights
        if (products.length > 0) {
            const outOfStock = products.filter(p => Number(p.stock || 0) === 0).length;
            const criticalStock = products.filter(p => { const s = Number(p.stock || 0); return s > 0 && s <= 5; }).length;
            const totalStockValue = products.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.price || p.salePrice || 0)), 0);

            if (outOfStock > 0) {
                insights.push({
                    type: 'critical',
                    title: 'Stok Tükenen Ürünler',
                    icon: FaWarehouse,
                    text: `${outOfStock} ürünün stoğu tamamen tükenmiş durumda. Bu ürünler satışa kapalı.`,
                    detail: 'Stok tükenen ürünleri acilen tedarik edin. Her gün potansiyel satış kaybediyorsunuz.',
                    metric: outOfStock,
                    metricLabel: 'Ürün'
                });
            }

            if (criticalStock > 0) {
                insights.push({
                    type: 'warning',
                    title: 'Kritik Stok Seviyesi',
                    icon: FaBoxes,
                    text: `${criticalStock} ürün kritik stok seviyesinde (5 ve altı). Yakında tükenebilir.`,
                    detail: 'Bu ürünler için tedarik sürecinizi hızlandırın.',
                    metric: criticalStock,
                    metricLabel: 'Ürün'
                });
            }

            insights.push({
                type: 'info',
                title: 'Envanter Değeri',
                icon: FaCubes,
                text: `Toplam ${formatNumber(products.length)} ürün, ${formatCurrency(totalStockValue)} envanter değeri.`,
                detail: `Ortalama ürün fiyatı: ${formatCurrency(totalStockValue / Math.max(products.length, 1))}`,
                metric: formatCurrency(totalStockValue),
                metricLabel: 'Toplam Değer'
            });
        }

        // 4. Top product insight
        if (topProds && topProds.length > 0) {
            const best = topProds[0];
            insights.push({
                type: 'success',
                title: 'En Çok Satan Ürün',
                icon: FaFire,
                text: `"${best.name}" ${formatNumber(best.sales)} adet satış ile birinci sırada. ${formatCurrency(best.revenue)} gelir sağladı.`,
                detail: best.trend > 0
                    ? `Bu ürün %${best.trend} büyüme gösteriyor. Stok seviyesini yüksek tutun.`
                    : `Bu ürünün satışları düşüşte. Fiyat ve kampanya stratejisini gözden geçirin.`,
                metric: formatNumber(best.sales),
                metricLabel: 'Satış'
            });
        }

        // 5. Category insight
        if (catDist && catDist.length > 0) {
            const topCat = catDist[0];
            insights.push({
                type: 'info',
                title: 'Lider Kategori',
                icon: FaLayerGroup,
                text: `"${topCat.name}" kategorisi %${topCat.value || 0} pay ile en çok satan kategori. ${formatNumber(topCat.sales || 0)} adet satış.`,
                detail: 'Bu kategorideki ürün çeşitliliğini artırarak pazar payınızı büyütebilirsiniz.',
                metric: `%${topCat.value || 0}`,
                metricLabel: 'Pay'
            });
        }

        // 6. Hourly pattern insight
        if (hourly && hourly.length > 0) {
            const peakHour = hourly.reduce((best, h) => (h.orders || 0) > (best.orders || 0) ? h : best, { hour: '00:00', orders: 0 });
            if (peakHour.orders > 0) {
                insights.push({
                    type: 'info',
                    title: 'Zirve Saati',
                    icon: FaClock,
                    text: `En yoğun sipariş saati: ${peakHour.hour}. Bu saatte ${formatNumber(peakHour.orders)} sipariş alınıyor.`,
                    detail: 'Kampanya ve reklam zamanlamalarınızı bu saatlere göre optimize edin.',
                    metric: peakHour.hour,
                    metricLabel: 'Zirve'
                });
            }
        }

        // 7. Growth insight
        const growth = overview?.growth || 0;
        if (growth !== 0) {
            insights.push({
                type: growth > 0 ? 'success' : 'warning',
                title: growth > 0 ? 'Büyüme Trendi' : 'Düşüş Uyarısı',
                icon: growth > 0 ? FaArrowUp : FaArrowDown,
                text: growth > 0
                    ? `Siparişleriniz önceki döneme göre %${Math.abs(growth)} artış gösterdi.`
                    : `Siparişleriniz önceki döneme göre %${Math.abs(growth)} düşüş gösterdi.`,
                detail: growth > 0
                    ? 'Mevcut stratejiniz işe yarıyor. Aynı ivmeyi sürdürün.'
                    : 'Fiyatlandırma, kampanya ve ürün çeşitliliği stratejilerinizi gözden geçirin.',
                metric: `%${Math.abs(growth)}`,
                metricLabel: growth > 0 ? 'Artış' : 'Düşüş'
            });
        }

        // 8. Marketplace distribution balance
        if (mpDist && mpDist.length > 1) {
            const maxShare = Math.max(...mpDist.map(m => parseFloat(m.percentage || 0)));
            const minShare = Math.min(...mpDist.map(m => parseFloat(m.percentage || 0)));
            if (maxShare - minShare > 40) {
                insights.push({
                    type: 'warning',
                    title: 'Pazaryeri Dengesizliği',
                    icon: FaBalanceScale,
                    text: `Pazaryerleri arasında %${(maxShare - minShare).toFixed(0)} fark var. Tek platforma bağımlılık riski.`,
                    detail: 'Gelir kaynaklarınızı çeşitlendirin. Düşük performanslı platformlarda ürün ve kampanya stratejinizi geliştirin.',
                    metric: `%${(maxShare - minShare).toFixed(0)}`,
                    metricLabel: 'Fark'
                });
            }
        }

        return insights;
    }, []);

    // ─── Process marketplace performance from dashboard data ───
    const processMarketplacePerformance = useCallback((dashboard, mpDist) => {
        const mpStatus = dashboard?.marketplaceStatus || {};
        const summary = dashboard?.summary || {};
        const totalRevenue = summary.todayRevenue || 0;

        const performance = Object.entries(mpStatus).map(([name, data]) => {
            const orders = data.orders || 0;
            const revenue = data.revenue || 0;
            const errors = data.errors || 0;
            const statusGroups = data.statusGroups || {};

            const orderScore = summary.todayOrders > 0 ? Math.min(100, (orders / summary.todayOrders) * 100) : 0;
            const revenueScore = totalRevenue > 0 ? Math.min(100, (revenue / totalRevenue) * 100) : 0;
            const errorScore = errors === 0 ? 100 : Math.max(0, 100 - (errors * 20));
            const performanceScore = Math.round(orderScore * 0.35 + revenueScore * 0.45 + errorScore * 0.20);

            const distData = (mpDist || []).find(m => m.name?.toLowerCase() === name.toLowerCase());

            return {
                name: name.charAt(0).toUpperCase() + name.slice(1),
                orders,
                revenue,
                errors,
                performanceScore,
                avgOrderValue: orders > 0 ? revenue / orders : 0,
                status: data.status || 'unknown',
                health: data.health || (performanceScore >= 75 ? 'excellent' : performanceScore >= 50 ? 'good' : performanceScore >= 25 ? 'warning' : 'critical'),
                marketShare: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
                pendingSync: data.pendingSync || 0,
                stockMismatch: data.stockMismatch || 0,
                statusGroups,
                orderPercentage: distData ? parseFloat(distData.percentage) : 0,
                newOrders: statusGroups.new || 0,
                processingOrders: statusGroups.processing || 0,
                shippingOrders: statusGroups.shipping || 0,
                deliveredOrders: statusGroups.delivered || 0,
                cancelledOrders: statusGroups.cancelled || 0,
                returnedOrders: statusGroups.returned || 0
            };
        }).sort((a, b) => b.performanceScore - a.performanceScore);

        return performance;
    }, []);

    // ─── Process revenue by day of week ───
    const processRevenueByDay = useCallback((trendData) => {
        if (!trendData || trendData.length === 0) return [];
        const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const byDay = {};
        dayNames.forEach(d => { byDay[d] = { orders: 0, revenue: 0, count: 0 }; });

        trendData.forEach(item => {
            const date = new Date(item.date);
            if (!isNaN(date.getTime())) {
                const dayName = dayNames[date.getDay()];
                byDay[dayName].orders += item.orders || 0;
                byDay[dayName].revenue += item.revenue || 0;
                byDay[dayName].count += 1;
            }
        });

        return dayNames.map(day => ({
            day,
            orders: byDay[day].count > 0 ? Math.round(byDay[day].orders / byDay[day].count) : 0,
            revenue: byDay[day].count > 0 ? Math.round(byDay[day].revenue / byDay[day].count) : 0
        }));
    }, []);

    // ─── Process comparison data (current vs previous period) ───
    const processComparisonData = useCallback((overview, dashboard) => {
        if (!overview && !dashboard) return null;
        const summary = dashboard?.summary || {};
        const totalOrders = overview?.totalOrders || summary.todayOrders || 0;
        const totalRevenue = overview?.totalRevenue || summary.todayRevenue || 0;
        const growth = overview?.growth || 0;
        const avgOrderValue = overview?.avgOrderValue || (totalOrders > 0 ? totalRevenue / totalOrders : 0);

        const prevOrders = growth !== 0 ? Math.round(totalOrders / (1 + growth / 100)) : totalOrders;
        const prevRevenue = prevOrders > 0 ? prevOrders * avgOrderValue * 0.95 : 0;

        return {
            current: { orders: totalOrders, revenue: totalRevenue, avgOrder: avgOrderValue },
            previous: { orders: prevOrders, revenue: prevRevenue, avgOrder: prevOrders > 0 ? prevRevenue / prevOrders : 0 },
            growth: {
                orders: growth,
                revenue: totalRevenue > 0 && prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 0,
                avgOrder: avgOrderValue > 0 && prevOrders > 0 ? (((avgOrderValue - prevRevenue / Math.max(prevOrders, 1)) / Math.max(prevRevenue / Math.max(prevOrders, 1), 1)) * 100).toFixed(1) : 0
            }
        };
    }, []);

    // ─── MAIN DATA LOADER ───
    const loadAllData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);

        try {
            // Phase 1: Load marketplaces + dashboard
            const [mps, dashboard] = await Promise.all([
                getUserMarketplaces(userId).catch(() => []),
                fetchDashboardData(userId).catch(() => null)
            ]);

            const mpList = Array.isArray(mps) ? mps : [];
            setMarketplaces(mpList);
            setDashboardData(dashboard);

            // Phase 2: Load all analytics endpoints + real products in parallel
            const [overview, trend, mpDist, topProds, catDist, hourly, products] = await Promise.all([
                fetchAnalyticsEndpoint('overview'),
                fetchAnalyticsEndpoint('sales-trend'),
                fetchAnalyticsEndpoint('marketplace-distribution'),
                fetchAnalyticsEndpoint('top-products', { limit: 10 }),
                fetchAnalyticsEndpoint('category-distribution'),
                fetchAnalyticsEndpoint('hourly-sales'),
                fetchAllProducts(mpList)
            ]);

            setAnalyticsOverview(overview);
            setSalesTrend(Array.isArray(trend) ? trend : []);
            setMarketplaceDistribution(Array.isArray(mpDist) ? mpDist : []);
            setTopProducts(Array.isArray(topProds) ? topProds : []);
            setCategoryDistribution(Array.isArray(catDist) ? catDist : []);
            setHourlySales(Array.isArray(hourly) ? hourly : []);
            setRealProducts(products);

            // Phase 3: Process derived data
            const stockData = processStockAnalysis(products);
            setStockAnalysis(stockData);

            const priceData = processPriceAnalysis(products);
            setPriceAnalysis(priceData);

            const mpPerf = processMarketplacePerformance(dashboard, mpDist);
            setMarketplacePerformance(mpPerf);

            const revByDay = processRevenueByDay(trend);
            setRevenueByDay(revByDay);

            const comparison = processComparisonData(overview, dashboard);
            setComparisonData(comparison);

            // Phase 4: Generate AI insights
            const insights = generateAIInsights(dashboard, products, mpDist, topProds, catDist, hourly, overview);
            setAiInsights(insights);

            setLastUpdate(new Date());
        } catch (error) {
            console.error("Data loading error:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, fetchAnalyticsEndpoint, fetchAllProducts, processStockAnalysis, processPriceAnalysis, processMarketplacePerformance, processRevenueByDay, processComparisonData, generateAIInsights]);

    // ─── Initial load + auto refresh ───
    useEffect(() => {
        loadAllData();
        if (autoRefresh) {
            const interval = setInterval(loadAllData, 60000);
            return () => clearInterval(interval);
        }
    }, [loadAllData, autoRefresh, dateRange]);

    // ─── KPI Cards ───
    const kpiCards = useMemo(() => {
        const summary = dashboardData?.summary || {};
        const overview = analyticsOverview || {};
        const totalRevenue = overview.totalRevenue || summary.todayRevenue || 0;
        const totalOrders = overview.totalOrders || summary.todayOrders || 0;
        const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const growth = overview.growth || 0;
        const activeProducts = overview.activeProducts || summary.activeProducts || 0;
        const totalProducts = summary.totalProducts || realProducts.length || 0;

        return [
            {
                id: 'revenue', title: 'Toplam Gelir', value: formatCurrency(totalRevenue),
                change: growth > 0 ? `+${growth}%` : `${growth}%`,
                trend: growth >= 0 ? 'up' : 'down',
                icon: FaMoneyBillWave, color: '#10b981',
                sub: `Ort. Sipariş: ${formatCurrency(avgOrder)}`
            },
            {
                id: 'orders', title: 'Toplam Sipariş', value: formatNumber(totalOrders),
                change: growth > 0 ? `+${growth}%` : `${growth}%`,
                trend: growth >= 0 ? 'up' : 'down',
                icon: FaShoppingCart, color: '#3b82f6',
                sub: `${marketplaces.length} pazaryerinden`
            },
            {
                id: 'products', title: 'Toplam Ürün', value: formatNumber(totalProducts),
                change: `${activeProducts} aktif`,
                trend: 'up',
                icon: FaBoxes, color: '#8b5cf6',
                sub: `${stockAnalysis.critical + stockAnalysis.outOfStock} kritik stok`
            },
            {
                id: 'avgOrder', title: 'Ortalama Sepet', value: formatCurrency(avgOrder),
                change: overview.conversionRate ? `%${overview.conversionRate} dönüşüm` : '',
                trend: 'up',
                icon: FaDollarSign, color: '#f59e0b',
                sub: `${marketplaces.length} aktif platform`
            },
            {
                id: 'marketplaces', title: 'Pazaryerleri', value: marketplaces.length,
                change: `${summary.activeMarketplaces || marketplaces.length} aktif`,
                trend: 'up',
                icon: FaStore, color: '#ec4899',
                sub: `${summary.errorCount || 0} hata`
            },
            {
                id: 'stock', title: 'Stok Sağlığı',
                value: `%${stockAnalysis.total > 0 ? Math.round((stockAnalysis.healthy / stockAnalysis.total) * 100) : 0}`,
                change: `${stockAnalysis.outOfStock} tükendi`,
                trend: stockAnalysis.outOfStock > 0 ? 'down' : 'up',
                icon: FaWarehouse, color: '#06b6d4',
                sub: `${stockAnalysis.low} düşük, ${stockAnalysis.critical} kritik`
            }
        ];
    }, [dashboardData, analyticsOverview, marketplaces, realProducts, stockAnalysis]);

    // ─── RENDER: Loading ───
    if (loading && !dashboardData) {
        return (
            <div className="aa-loading">
                <div className="aa-loading-spinner"></div>
                <p>Gelişmiş analiz verileri yükleniyor...</p>
                <span>Tüm pazaryerlerinden veriler toplanıyor</span>
            </div>
        );
    }

    // ─── RENDER: Overview Tab ───
    const renderOverview = () => (
        <div className="aa-overview-grid">
            {/* Sales Trend Chart */}
            <div className="aa-card aa-card-wide">
                <div className="aa-card-head">
                    <h3><FaChartLine /> Satış Trendi</h3>
                    <span className="aa-card-badge">{dateRange} Gün</span>
                </div>
                <div className="aa-card-body">
                    {salesTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={320}>
                            <ComposedChart data={salesTrend}>
                                <defs>
                                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }}
                                    tickFormatter={(v) => { try { const d = new Date(v); return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch { return v; } }}
                                />
                                <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(value, name) => {
                                        if (name === 'revenue') return [formatCurrency(value), 'Gelir'];
                                        if (name === 'orders') return [formatNumber(value), 'Sipariş'];
                                        return [value, name];
                                    }}
                                    labelFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return v; } }}
                                />
                                <Legend />
                                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#gradRevenue)" stroke="#10b981" strokeWidth={2} name="Gelir" />
                                <Bar yAxisId="right" dataKey="orders" fill="#3b82f680" radius={[4, 4, 0, 0]} name="Sipariş" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="aa-no-data">
                            <FaChartLine />
                            <p>Henüz satış trendi verisi yok</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Marketplace Distribution Pie */}
            <div className="aa-card">
                <div className="aa-card-head">
                    <h3><FaChartPie /> Pazaryeri Dağılımı</h3>
                </div>
                <div className="aa-card-body">
                    {marketplaceDistribution.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={marketplaceDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                                        dataKey="orders" nameKey="name" paddingAngle={3}>
                                        {marketplaceDistribution.map((entry, idx) => (
                                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                        formatter={(value, name) => [formatNumber(value) + ' sipariş', name]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="aa-pie-legend">
                                {marketplaceDistribution.map((mp, idx) => (
                                    <div key={idx} className="aa-pie-legend-item">
                                        <span className="aa-legend-dot" style={{ background: COLORS[idx % COLORS.length] }}></span>
                                        <span className="aa-legend-name">{mp.name}</span>
                                        <span className="aa-legend-val">%{mp.percentage}</span>
                                        <span className="aa-legend-rev">{formatCurrency(mp.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="aa-no-data"><FaChartPie /><p>Dağılım verisi yok</p></div>
                    )}
                </div>
            </div>

            {/* Period Comparison */}
            {comparisonData && (
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaBalanceScale /> Dönem Karşılaştırması</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-comparison-grid">
                            <div className="aa-comp-item">
                                <span className="aa-comp-label">Sipariş</span>
                                <div className="aa-comp-values">
                                    <span className="aa-comp-current">{formatNumber(comparisonData.current.orders)}</span>
                                    <span className="aa-comp-vs">vs</span>
                                    <span className="aa-comp-prev">{formatNumber(comparisonData.previous.orders)}</span>
                                </div>
                                <span className={`aa-comp-change ${comparisonData.growth.orders >= 0 ? 'positive' : 'negative'}`}>
                                    {comparisonData.growth.orders >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                    %{Math.abs(comparisonData.growth.orders)}
                                </span>
                            </div>
                            <div className="aa-comp-item">
                                <span className="aa-comp-label">Gelir</span>
                                <div className="aa-comp-values">
                                    <span className="aa-comp-current">{formatCurrency(comparisonData.current.revenue)}</span>
                                    <span className="aa-comp-vs">vs</span>
                                    <span className="aa-comp-prev">{formatCurrency(comparisonData.previous.revenue)}</span>
                                </div>
                                <span className={`aa-comp-change ${comparisonData.growth.revenue >= 0 ? 'positive' : 'negative'}`}>
                                    {comparisonData.growth.revenue >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                    %{Math.abs(comparisonData.growth.revenue)}
                                </span>
                            </div>
                            <div className="aa-comp-item">
                                <span className="aa-comp-label">Ort. Sepet</span>
                                <div className="aa-comp-values">
                                    <span className="aa-comp-current">{formatCurrency(comparisonData.current.avgOrder)}</span>
                                    <span className="aa-comp-vs">vs</span>
                                    <span className="aa-comp-prev">{formatCurrency(comparisonData.previous.avgOrder)}</span>
                                </div>
                                <span className={`aa-comp-change ${comparisonData.growth.avgOrder >= 0 ? 'positive' : 'negative'}`}>
                                    {comparisonData.growth.avgOrder >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                    %{Math.abs(comparisonData.growth.avgOrder)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Revenue by Day of Week */}
            {revenueByDay.length > 0 && (
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaCalendarAlt /> Gün Bazlı Ortalama</h3>
                    </div>
                    <div className="aa-card-body">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={revenueByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(v, n) => n === 'revenue' ? [formatCurrency(v), 'Ort. Gelir'] : [formatNumber(v), 'Ort. Sipariş']} />
                                <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Ort. Gelir" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Quick Top 5 Products */}
            <div className="aa-card aa-card-wide">
                <div className="aa-card-head">
                    <h3><FaFire /> En Çok Satan 5 Ürün</h3>
                    <button className="aa-link-btn" onClick={() => setActiveTab('products')}>Tümünü Gör →</button>
                </div>
                <div className="aa-card-body">
                    {topProducts.length > 0 ? (
                        <div className="aa-top-products-quick">
                            {topProducts.slice(0, 5).map((p, idx) => (
                                <div key={idx} className="aa-top-product-row">
                                    <div className="aa-tp-rank" data-rank={idx + 1}>
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                    </div>
                                    <div className="aa-tp-info">
                                        <span className="aa-tp-name">{p.name}</span>
                                        <span className="aa-tp-meta">{formatNumber(p.sales)} satış • {formatCurrency(p.revenue)}</span>
                                    </div>
                                    <div className={`aa-tp-trend ${p.trend >= 0 ? 'positive' : 'negative'}`}>
                                        {p.trend >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                        %{Math.abs(p.trend)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="aa-no-data"><FaFire /><p>Ürün satış verisi yok</p></div>
                    )}
                </div>
            </div>
        </div>
    );

    // ─── RENDER: Marketplaces Tab ───
    const renderMarketplaces = () => (
        <div className="aa-mp-grid">
            {/* Marketplace Cards */}
            {marketplacePerformance.length > 0 ? marketplacePerformance.map((mp, idx) => (
                <motion.div key={idx} className="aa-mp-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                    <div className="aa-mp-card-header">
                        <div className="aa-mp-rank-badge" style={{ background: idx === 0 ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : idx === 1 ? 'linear-gradient(135deg, #c0c0c0, #a0a0a0)' : idx === 2 ? 'linear-gradient(135deg, #cd7f32, #b8690e)' : 'linear-gradient(135deg, #4ecdc4, #44a08d)' }}>
                            #{idx + 1}
                        </div>
                        <div className="aa-mp-name-section">
                            <h4>{mp.name}</h4>
                            <span className={`aa-mp-health-badge ${mp.health}`}>
                                {mp.health === 'excellent' ? '🟢 Mükemmel' : mp.health === 'good' ? '🔵 İyi' : mp.health === 'warning' ? '🟡 Dikkat' : '🔴 Kritik'}
                            </span>
                        </div>
                        <div className="aa-mp-score-ring" style={{ background: `conic-gradient(${mp.health === 'excellent' ? '#22c55e' : mp.health === 'good' ? '#3b82f6' : mp.health === 'warning' ? '#f59e0b' : '#ef4444'} ${mp.performanceScore * 3.6}deg, #1e293b 0deg)` }}>
                            <span>{mp.performanceScore}</span>
                        </div>
                    </div>

                    <div className="aa-mp-metrics-grid">
                        <div className="aa-mp-metric">
                            <FaShoppingCart />
                            <div>
                                <span className="aa-mp-metric-val">{formatNumber(mp.orders)}</span>
                                <span className="aa-mp-metric-label">Sipariş</span>
                            </div>
                        </div>
                        <div className="aa-mp-metric">
                            <FaMoneyBillWave />
                            <div>
                                <span className="aa-mp-metric-val">{formatCurrency(mp.revenue)}</span>
                                <span className="aa-mp-metric-label">Gelir</span>
                            </div>
                        </div>
                        <div className="aa-mp-metric">
                            <FaDollarSign />
                            <div>
                                <span className="aa-mp-metric-val">{formatCurrency(mp.avgOrderValue)}</span>
                                <span className="aa-mp-metric-label">Ort. Sepet</span>
                            </div>
                        </div>
                        <div className="aa-mp-metric">
                            <FaPercent />
                            <div>
                                <span className="aa-mp-metric-val">%{mp.marketShare.toFixed(1)}</span>
                                <span className="aa-mp-metric-label">Pazar Payı</span>
                            </div>
                        </div>
                    </div>

                    {/* Order Status Breakdown */}
                    <div className="aa-mp-status-breakdown">
                        <h5>Sipariş Durumları</h5>
                        <div className="aa-mp-status-bars">
                            {[
                                { label: 'Yeni', count: mp.newOrders, color: '#3b82f6' },
                                { label: 'İşlemde', count: mp.processingOrders, color: '#f59e0b' },
                                { label: 'Kargoda', count: mp.shippingOrders, color: '#8b5cf6' },
                                { label: 'Teslim', count: mp.deliveredOrders, color: '#22c55e' },
                                { label: 'İptal', count: mp.cancelledOrders, color: '#ef4444' },
                                { label: 'İade', count: mp.returnedOrders, color: '#f97316' }
                            ].filter(s => s.count > 0).map((s, i) => (
                                <div key={i} className="aa-mp-status-bar-item">
                                    <div className="aa-mp-sb-header">
                                        <span style={{ color: s.color }}>{s.label}</span>
                                        <span>{s.count}</span>
                                    </div>
                                    <div className="aa-mp-sb-track">
                                        <div className="aa-mp-sb-fill" style={{ width: `${mp.orders > 0 ? (s.count / mp.orders) * 100 : 0}%`, background: s.color }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Diagnostics */}
                    <div className="aa-mp-diagnostics">
                        {mp.errors > 0 && <span className="aa-mp-diag error">⚠️ {mp.errors} hata</span>}
                        {mp.stockMismatch > 0 && <span className="aa-mp-diag warning">📦 {mp.stockMismatch} stok uyumsuz</span>}
                        {mp.pendingSync > 0 && <span className="aa-mp-diag info">🔄 {mp.pendingSync} senkron bekliyor</span>}
                        {mp.errors === 0 && mp.stockMismatch === 0 && <span className="aa-mp-diag success">✅ Sorun yok</span>}
                    </div>
                </motion.div>
            )) : (
                <div className="aa-no-data-full"><FaStore /><p>Pazaryeri verisi bulunamadı</p></div>
            )}

            {/* Marketplace Comparison Chart */}
            {marketplacePerformance.length > 1 && (
                <div className="aa-card aa-card-full">
                    <div className="aa-card-head">
                        <h3><FaChartBar /> Pazaryeri Karşılaştırması</h3>
                    </div>
                    <div className="aa-card-body">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={marketplacePerformance} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis type="number" stroke="#64748b" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <YAxis type="category" dataKey="name" stroke="#64748b" width={100} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(v, n) => n === 'revenue' ? [formatCurrency(v), 'Gelir'] : [formatNumber(v), 'Sipariş']} />
                                <Legend />
                                <Bar dataKey="revenue" fill="#10b981" name="Gelir" radius={[0, 6, 6, 0]} />
                                <Bar dataKey="orders" fill="#3b82f6" name="Sipariş" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── RENDER: Products Tab ───
    const renderProducts = () => (
        <div className="aa-products-section">
            {/* Top Products Table */}
            <div className="aa-card aa-card-full">
                <div className="aa-card-head">
                    <h3><FaFire /> En Çok Satan Ürünler (Sipariş Verilerinden)</h3>
                    <span className="aa-card-badge">{topProducts.length} ürün</span>
                </div>
                <div className="aa-card-body">
                    {topProducts.length > 0 ? (
                        <div className="aa-products-table-wrap">
                            <table className="aa-products-table">
                                <thead>
                                    <tr>
                                        <th>Sıra</th>
                                        <th>Ürün Adı</th>
                                        <th>Satış Adedi</th>
                                        <th>Gelir</th>
                                        <th>Ort. Fiyat</th>
                                        <th>Trend</th>
                                        <th>Performans</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topProducts.map((p, idx) => {
                                        const avgPrice = p.sales > 0 ? p.revenue / p.sales : 0;
                                        const maxSales = topProducts[0]?.sales || 1;
                                        const perfPercent = (p.sales / maxSales) * 100;
                                        return (
                                            <tr key={idx}>
                                                <td>
                                                    <div className="aa-rank-badge" data-rank={idx + 1}>
                                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                    </div>
                                                </td>
                                                <td><span className="aa-product-name-cell">{p.name}</span></td>
                                                <td><strong>{formatNumber(p.sales)}</strong></td>
                                                <td><strong style={{ color: '#10b981' }}>{formatCurrency(p.revenue)}</strong></td>
                                                <td>{formatCurrency(avgPrice)}</td>
                                                <td>
                                                    <span className={`aa-trend-chip ${p.trend >= 0 ? 'positive' : 'negative'}`}>
                                                        {p.trend >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                                        %{Math.abs(p.trend)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="aa-perf-bar">
                                                        <div className="aa-perf-fill" style={{ width: `${perfPercent}%`, background: perfPercent > 70 ? '#22c55e' : perfPercent > 40 ? '#f59e0b' : '#ef4444' }}></div>
                                                        <span>%{perfPercent.toFixed(0)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="aa-no-data"><FaFire /><p>Sipariş bazlı ürün verisi yok</p></div>
                    )}
                </div>
            </div>

            {/* Real Products from Marketplaces */}
            <div className="aa-card aa-card-full">
                <div className="aa-card-head">
                    <h3><FaBoxes /> Pazaryeri Ürünleri (Gerçek Zamanlı)</h3>
                    <span className="aa-card-badge">{realProducts.length} ürün</span>
                </div>
                <div className="aa-card-body">
                    {realProducts.length > 0 ? (
                        <div className="aa-real-products-grid">
                            {realProducts.slice(0, 20).map((p, idx) => (
                                <div key={idx} className="aa-real-product-card">
                                    <div className="aa-rp-image">
                                        {p.productImage && p.productImage !== 'https://via.placeholder.com/300' ? (
                                            <img src={p.productImage} alt={p.productName} onError={(e) => { e.target.style.display = 'none'; }} />
                                        ) : (
                                            <div className="aa-rp-no-img"><FaBoxes /></div>
                                        )}
                                    </div>
                                    <div className="aa-rp-info">
                                        <h5>{p.productName || 'Bilinmiyor'}</h5>
                                        <span className="aa-rp-mp">{p.marketplace || p.marketplaceName}</span>
                                        <div className="aa-rp-details">
                                            <span className="aa-rp-price">{formatCurrency(p.price || p.salePrice || 0)}</span>
                                            <span className={`aa-rp-stock ${Number(p.stock) === 0 ? 'out' : Number(p.stock) <= 5 ? 'critical' : Number(p.stock) <= 20 ? 'low' : 'ok'}`}>
                                                Stok: {p.stock || 0}
                                            </span>
                                        </div>
                                        {p.categoryName && p.categoryName !== 'Bilinmiyor' && (
                                            <span className="aa-rp-category">{p.categoryName}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="aa-no-data"><FaBoxes /><p>Pazaryeri ürün verisi yok</p></div>
                    )}
                    {realProducts.length > 20 && (
                        <div className="aa-show-more">Toplam {realProducts.length} ürün (ilk 20 gösteriliyor)</div>
                    )}
                </div>
            </div>

            {/* Price Analysis by Marketplace */}
            {priceAnalysis.length > 0 && (
                <div className="aa-card aa-card-full">
                    <div className="aa-card-head">
                        <h3><FaSearchDollar /> Fiyat Analizi (Pazaryeri Bazlı)</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-price-analysis-grid">
                            {priceAnalysis.map((pa, idx) => (
                                <div key={idx} className="aa-price-card">
                                    <h5>{pa.marketplace}</h5>
                                    <div className="aa-price-metrics">
                                        <div className="aa-price-metric">
                                            <span className="aa-pm-label">Ort. Fiyat</span>
                                            <span className="aa-pm-value">{formatCurrency(pa.avgPrice)}</span>
                                        </div>
                                        <div className="aa-price-metric">
                                            <span className="aa-pm-label">Min / Max</span>
                                            <span className="aa-pm-value">{formatCurrency(pa.minPrice)} - {formatCurrency(pa.maxPrice)}</span>
                                        </div>
                                        <div className="aa-price-metric">
                                            <span className="aa-pm-label">Ort. İndirim</span>
                                            <span className="aa-pm-value" style={{ color: parseFloat(pa.discountRate) > 0 ? '#f59e0b' : '#94a3b8' }}>%{pa.discountRate}</span>
                                        </div>
                                        <div className="aa-price-metric">
                                            <span className="aa-pm-label">Ürün Sayısı</span>
                                            <span className="aa-pm-value">{formatNumber(pa.productCount)}</span>
                                        </div>
                                        <div className="aa-price-metric">
                                            <span className="aa-pm-label">Stok Değeri</span>
                                            <span className="aa-pm-value" style={{ color: '#10b981' }}>{formatCurrency(pa.totalStockValue)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── RENDER: Categories Tab ───
    const renderCategories = () => (
        <div className="aa-categories-section">
            <div className="aa-card aa-card-wide">
                <div className="aa-card-head">
                    <h3><FaChartPie /> Kategori Dağılımı</h3>
                    <span className="aa-card-badge">{categoryDistribution.length} kategori</span>
                </div>
                <div className="aa-card-body">
                    {categoryDistribution.length > 0 ? (
                        <div className="aa-cat-chart-row">
                            <ResponsiveContainer width="50%" height={300}>
                                <PieChart>
                                    <Pie data={categoryDistribution} cx="50%" cy="50%" outerRadius={120} innerRadius={60}
                                        dataKey="value" nameKey="name" paddingAngle={2}
                                        label={({ name, value }) => `${name} %${value}`}>
                                        {categoryDistribution.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="aa-cat-details">
                                {categoryDistribution.map((cat, idx) => (
                                    <div key={idx} className="aa-cat-detail-row">
                                        <div className="aa-cat-color" style={{ background: cat.color || COLORS[idx % COLORS.length] }}></div>
                                        <div className="aa-cat-info">
                                            <span className="aa-cat-name">{cat.name}</span>
                                            <div className="aa-cat-stats">
                                                <span>%{cat.value} pay</span>
                                                <span>•</span>
                                                <span>{formatNumber(cat.sales)} satış</span>
                                                <span>•</span>
                                                <span>{formatCurrency(cat.revenue)}</span>
                                            </div>
                                        </div>
                                        <div className="aa-cat-bar-wrap">
                                            <div className="aa-cat-bar" style={{ width: `${cat.value}%`, background: cat.color || COLORS[idx % COLORS.length] }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="aa-no-data"><FaChartPie /><p>Kategori verisi yok</p></div>
                    )}
                </div>
            </div>

            {/* Category Revenue Bar Chart */}
            {categoryDistribution.length > 0 && (
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaChartBar /> Kategori Gelir Karşılaştırması</h3>
                    </div>
                    <div className="aa-card-body">
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={categoryDistribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(v, n) => n === 'revenue' ? [formatCurrency(v), 'Gelir'] : [formatNumber(v), 'Satış']} />
                                <Legend />
                                <Bar dataKey="revenue" name="Gelir" radius={[6, 6, 0, 0]}>
                                    {categoryDistribution.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Category from Real Products */}
            {realProducts.length > 0 && (
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaLayerGroup /> Ürün Kategorileri (Pazaryeri Verileri)</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-product-categories">
                            {(() => {
                                const catMap = {};
                                realProducts.forEach(p => {
                                    const cat = p.categoryName || p.category || 'Bilinmiyor';
                                    if (!catMap[cat]) catMap[cat] = { count: 0, totalPrice: 0, totalStock: 0 };
                                    catMap[cat].count++;
                                    catMap[cat].totalPrice += Number(p.price || p.salePrice || 0);
                                    catMap[cat].totalStock += Number(p.stock || 0);
                                });
                                return Object.entries(catMap)
                                    .sort((a, b) => b[1].count - a[1].count)
                                    .slice(0, 15)
                                    .map(([name, data], idx) => (
                                        <div key={idx} className="aa-pcat-item">
                                            <div className="aa-pcat-rank" style={{ background: COLORS[idx % COLORS.length] + '30', color: COLORS[idx % COLORS.length] }}>
                                                {idx + 1}
                                            </div>
                                            <div className="aa-pcat-info">
                                                <span className="aa-pcat-name">{name}</span>
                                                <span className="aa-pcat-meta">
                                                    {data.count} ürün • Ort. {formatCurrency(data.totalPrice / data.count)} • Stok: {formatNumber(data.totalStock)}
                                                </span>
                                            </div>
                                            <div className="aa-pcat-bar-wrap">
                                                <div className="aa-pcat-bar" style={{ width: `${(data.count / realProducts.length) * 100}%`, background: COLORS[idx % COLORS.length] }}></div>
                                            </div>
                                        </div>
                                    ));
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── RENDER: Trends Tab ───
    const renderTrends = () => (
        <div className="aa-trends-section">
            {/* Detailed Sales Trend */}
            <div className="aa-card aa-card-full">
                <div className="aa-card-head">
                    <h3><FaChartLine /> Detaylı Satış Trendi</h3>
                    <span className="aa-card-badge">Son {dateRange} Gün</span>
                </div>
                <div className="aa-card-body">
                    {salesTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={380}>
                            <ComposedChart data={salesTrend}>
                                <defs>
                                    <linearGradient id="gradRev2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                                    </linearGradient>
                                    <linearGradient id="gradOrd2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }}
                                    tickFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch { return v; } }} />
                                <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(v, n) => n === 'Gelir' ? [formatCurrency(v), n] : [formatNumber(v), n]}
                                    labelFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return v; } }} />
                                <Legend />
                                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#gradRev2)" stroke="#10b981" strokeWidth={2.5} name="Gelir" />
                                <Area yAxisId="right" type="monotone" dataKey="orders" fill="url(#gradOrd2)" stroke="#3b82f6" strokeWidth={2.5} name="Sipariş" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="aa-no-data"><FaChartLine /><p>Trend verisi yok</p></div>
                    )}
                </div>
            </div>

            {/* Hourly Sales Pattern */}
            <div className="aa-card aa-card-full">
                <div className="aa-card-head">
                    <h3><FaClock /> Saatlik Satış Deseni</h3>
                    <p className="aa-card-desc">24 saatlik sipariş ve gelir dağılımı</p>
                </div>
                <div className="aa-card-body">
                    {hourlySales.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={hourlySales}>
                                <defs>
                                    <linearGradient id="gradHourly" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.7}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                                    </linearGradient>
                                    <linearGradient id="gradHourlyRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(v, n) => n === 'Gelir' ? [formatCurrency(v), n] : [formatNumber(v), n]} />
                                <Legend />
                                <Area yAxisId="left" type="monotone" dataKey="orders" fill="url(#gradHourly)" stroke="#8b5cf6" strokeWidth={2} name="Sipariş" />
                                <Area yAxisId="right" type="monotone" dataKey="revenue" fill="url(#gradHourlyRev)" stroke="#f59e0b" strokeWidth={2} name="Gelir" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="aa-no-data"><FaClock /><p>Saatlik veri yok</p></div>
                    )}
                </div>
            </div>

            {/* Revenue by Day of Week */}
            {revenueByDay.length > 0 && (
                <div className="aa-card aa-card-full">
                    <div className="aa-card-head">
                        <h3><FaCalendarAlt /> Haftalık Desen</h3>
                        <p className="aa-card-desc">Haftanın günlerine göre ortalama sipariş ve gelir</p>
                    </div>
                    <div className="aa-card-body">
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={revenueByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="day" stroke="#64748b" />
                                <YAxis yAxisId="left" stroke="#64748b" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }}
                                    formatter={(v, n) => n === 'Ort. Gelir' ? [formatCurrency(v), n] : [formatNumber(v), n]} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="revenue" fill="#10b981" name="Ort. Gelir" radius={[6, 6, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={3} name="Ort. Sipariş" dot={{ r: 5, fill: '#f59e0b' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Trend Summary Stats */}
            {salesTrend.length > 0 && (
                <div className="aa-card aa-card-full">
                    <div className="aa-card-head">
                        <h3><FaRegChartBar /> Trend Özet İstatistikleri</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-trend-stats-grid">
                            {(() => {
                                const revenues = salesTrend.map(d => d.revenue || 0);
                                const orders = salesTrend.map(d => d.orders || 0);
                                const totalRev = revenues.reduce((a, b) => a + b, 0);
                                const totalOrd = orders.reduce((a, b) => a + b, 0);
                                const avgRev = revenues.length > 0 ? totalRev / revenues.length : 0;
                                const avgOrd = orders.length > 0 ? totalOrd / orders.length : 0;
                                const maxRev = Math.max(...revenues, 0);
                                const minRev = Math.min(...revenues.filter(r => r > 0), 0);
                                const maxOrd = Math.max(...orders, 0);
                                const bestDay = salesTrend.find(d => d.revenue === maxRev);

                                return [
                                    { label: 'Toplam Gelir', value: formatCurrency(totalRev), color: '#10b981' },
                                    { label: 'Toplam Sipariş', value: formatNumber(totalOrd), color: '#3b82f6' },
                                    { label: 'Günlük Ort. Gelir', value: formatCurrency(avgRev), color: '#8b5cf6' },
                                    { label: 'Günlük Ort. Sipariş', value: formatNumber(Math.round(avgOrd)), color: '#f59e0b' },
                                    { label: 'En Yüksek Günlük Gelir', value: formatCurrency(maxRev), color: '#22c55e' },
                                    { label: 'En Yüksek Günlük Sipariş', value: formatNumber(maxOrd), color: '#06b6d4' },
                                    { label: 'En İyi Gün', value: bestDay?.date ? new Date(bestDay.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' }) : '-', color: '#ec4899' },
                                    { label: 'Veri Gün Sayısı', value: salesTrend.length + ' gün', color: '#94a3b8' }
                                ].map((stat, i) => (
                                    <div key={i} className="aa-trend-stat" style={{ borderLeft: `3px solid ${stat.color}` }}>
                                        <span className="aa-ts-label">{stat.label}</span>
                                        <span className="aa-ts-value" style={{ color: stat.color }}>{stat.value}</span>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── RENDER: Inventory Tab ───
    const renderInventory = () => (
        <div className="aa-inventory-section">
            {/* Stock Health Overview */}
            <div className="aa-stock-overview-cards">
                {[
                    { label: 'Sağlıklı Stok', count: stockAnalysis.healthy, icon: '✅', color: '#22c55e', desc: '20+ adet' },
                    { label: 'Düşük Stok', count: stockAnalysis.low, icon: '⚠️', color: '#f59e0b', desc: '6-20 adet' },
                    { label: 'Kritik Stok', count: stockAnalysis.critical, icon: '🔴', color: '#ef4444', desc: '1-5 adet' },
                    { label: 'Stok Tükendi', count: stockAnalysis.outOfStock, icon: '❌', color: '#dc2626', desc: '0 adet' }
                ].map((item, idx) => (
                    <motion.div key={idx} className="aa-stock-card" whileHover={{ scale: 1.03 }}
                        style={{ borderTop: `3px solid ${item.color}` }}>
                        <div className="aa-stock-card-icon">{item.icon}</div>
                        <div className="aa-stock-card-val" style={{ color: item.color }}>{formatNumber(item.count)}</div>
                        <div className="aa-stock-card-label">{item.label}</div>
                        <div className="aa-stock-card-desc">{item.desc}</div>
                        {stockAnalysis.total > 0 && (
                            <div className="aa-stock-card-pct">%{((item.count / stockAnalysis.total) * 100).toFixed(1)}</div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Stock Distribution Chart */}
            <div className="aa-card aa-card-wide">
                <div className="aa-card-head">
                    <h3><FaChartPie /> Stok Dağılımı</h3>
                </div>
                <div className="aa-card-body">
                    {stockAnalysis.total > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Sağlıklı', value: stockAnalysis.healthy, fill: '#22c55e' },
                                        { name: 'Düşük', value: stockAnalysis.low, fill: '#f59e0b' },
                                        { name: 'Kritik', value: stockAnalysis.critical, fill: '#ef4444' },
                                        { name: 'Tükendi', value: stockAnalysis.outOfStock, fill: '#dc2626' }
                                    ].filter(d => d.value > 0)}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                                    dataKey="value" paddingAngle={3}
                                    label={({ name, value }) => `${name}: ${value}`}>
                                    {[
                                        { fill: '#22c55e' }, { fill: '#f59e0b' }, { fill: '#ef4444' }, { fill: '#dc2626' }
                                    ].filter((_, i) => [stockAnalysis.healthy, stockAnalysis.low, stockAnalysis.critical, stockAnalysis.outOfStock][i] > 0)
                                    .map((entry, idx) => (
                                        <Cell key={idx} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="aa-no-data"><FaWarehouse /><p>Stok verisi yok</p></div>
                    )}
                </div>
            </div>

            {/* Stock Value by Marketplace */}
            {priceAnalysis.length > 0 && (
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaDollarSign /> Envanter Değeri</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-inv-value-list">
                            {priceAnalysis.map((pa, idx) => (
                                <div key={idx} className="aa-inv-value-item">
                                    <div className="aa-inv-mp-name">
                                        <span className="aa-inv-dot" style={{ background: COLORS[idx % COLORS.length] }}></span>
                                        {pa.marketplace}
                                    </div>
                                    <div className="aa-inv-mp-stats">
                                        <span>{formatNumber(pa.productCount)} ürün</span>
                                        <span className="aa-inv-value">{formatCurrency(pa.totalStockValue)}</span>
                                    </div>
                                    <div className="aa-inv-bar-track">
                                        <div className="aa-inv-bar-fill" style={{
                                            width: `${priceAnalysis.length > 0 ? (pa.totalStockValue / Math.max(...priceAnalysis.map(p => p.totalStockValue), 1)) * 100 : 0}%`,
                                            background: COLORS[idx % COLORS.length]
                                        }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Critical Stock Items */}
            <div className="aa-card aa-card-full">
                <div className="aa-card-head">
                    <h3><FaExclamationTriangle /> Kritik Stok Ürünleri</h3>
                    <span className="aa-card-badge">{stockAnalysis.items.filter(i => i.status === 'critical' || i.status === 'outOfStock').length} ürün</span>
                </div>
                <div className="aa-card-body">
                    {stockAnalysis.items.filter(i => i.status === 'critical' || i.status === 'outOfStock').length > 0 ? (
                        <div className="aa-critical-stock-list">
                            {stockAnalysis.items.filter(i => i.status === 'critical' || i.status === 'outOfStock').slice(0, 20).map((item, idx) => (
                                <div key={idx} className={`aa-critical-item ${item.status}`}>
                                    <div className="aa-ci-image">
                                        {item.image && item.image !== 'https://via.placeholder.com/300' ? (
                                            <img src={item.image} alt={item.name} onError={(e) => { e.target.style.display = 'none'; }} />
                                        ) : (
                                            <div className="aa-ci-no-img">{item.status === 'outOfStock' ? '❌' : '🔴'}</div>
                                        )}
                                    </div>
                                    <div className="aa-ci-info">
                                        <span className="aa-ci-name">{item.name}</span>
                                        <span className="aa-ci-meta">{item.marketplace} • {item.category}</span>
                                    </div>
                                    <div className="aa-ci-stock">
                                        <span className={`aa-ci-stock-val ${item.status}`}>{item.stock} adet</span>
                                        <span className="aa-ci-price">{formatCurrency(item.price)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="aa-no-data success"><FaCheckCircle /><p>Kritik stok seviyesinde ürün yok 🎉</p></div>
                    )}
                </div>
            </div>
        </div>
    );

    // ─── RENDER: AI Insights Tab ───
    const renderInsights = () => (
        <div className="aa-insights-section">
            <div className="aa-insights-header">
                <h2><FaLightbulb /> AI Destekli İçgörüler ve Öneriler</h2>
                <p>Verileriniz analiz edilerek oluşturulan akıllı içgörüler</p>
            </div>

            {aiInsights.length > 0 ? (
                <div className="aa-insights-list">
                    {aiInsights.map((insight, idx) => (
                        <motion.div key={idx} className={`aa-insight-card ${insight.type}`}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
                            <div className="aa-insight-icon">
                                <insight.icon />
                            </div>
                            <div className="aa-insight-content">
                                <div className="aa-insight-header-row">
                                    <h4>{insight.title}</h4>
                                    <span className={`aa-insight-type-badge ${insight.type}`}>
                                        {insight.type === 'success' ? '✅ Başarı' : insight.type === 'warning' ? '⚠️ Uyarı' : insight.type === 'critical' ? '🔴 Kritik' : 'ℹ️ Bilgi'}
                                    </span>
                                </div>
                                <p className="aa-insight-text">{insight.text}</p>
                                <p className="aa-insight-detail">{insight.detail}</p>
                            </div>
                            {insight.metric && (
                                <div className="aa-insight-metric">
                                    <span className="aa-im-value">{insight.metric}</span>
                                    <span className="aa-im-label">{insight.metricLabel}</span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="aa-no-data-full">
                    <FaLightbulb />
                    <p>Henüz yeterli veri yok. Pazaryeri entegrasyonlarınızı tamamlayın.</p>
                </div>
            )}

            {/* Quick Recommendations */}
            <div className="aa-recommendations">
                <h3><FaBolt /> Hızlı Öneriler</h3>
                <div className="aa-rec-grid">
                    {stockAnalysis.outOfStock > 0 && (
                        <div className="aa-rec-card critical">
                            <span className="aa-rec-icon">📦</span>
                            <h5>Stok Yenileme</h5>
                            <p>{stockAnalysis.outOfStock} ürünün stoğu tükenmiş. Acil tedarik süreci başlatın.</p>
                        </div>
                    )}
                    {marketplacePerformance.length > 1 && (
                        <div className="aa-rec-card info">
                            <span className="aa-rec-icon">🏪</span>
                            <h5>Platform Çeşitlendirme</h5>
                            <p>En iyi performans gösteren platformdaki stratejilerinizi diğer platformlara uygulayın.</p>
                        </div>
                    )}
                    {topProducts.length > 0 && (
                        <div className="aa-rec-card success">
                            <span className="aa-rec-icon">🔥</span>
                            <h5>Çok Satan Ürünler</h5>
                            <p>En çok satan ürünlerinizin stok seviyelerini yüksek tutun ve benzer ürünler ekleyin.</p>
                        </div>
                    )}
                    <div className="aa-rec-card warning">
                        <span className="aa-rec-icon">💰</span>
                        <h5>Fiyat Optimizasyonu</h5>
                        <p>Rakip fiyatlarını takip edin ve dinamik fiyatlandırma stratejisi uygulayın.</p>
                    </div>
                    <div className="aa-rec-card info">
                        <span className="aa-rec-icon">📊</span>
                        <h5>Kampanya Zamanlaması</h5>
                        <p>Saatlik satış deseninize göre kampanyalarınızı en yoğun saatlere planlayın.</p>
                    </div>
                    <div className="aa-rec-card success">
                        <span className="aa-rec-icon">🎯</span>
                        <h5>Kategori Genişletme</h5>
                        <p>En çok satan kategorilerinizde ürün çeşitliliğini artırarak pazar payınızı büyütün.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    // ─── MAIN RENDER ───
    return (
        <div className="aa-container">
            {/* Header */}
            <div className="aa-header">
                <div className="aa-header-left">
                    <h1><FaChartLine /> Gelişmiş Analiz ve Raporlama</h1>
                    <p>Tüm pazaryerlerinden gerçek zamanlı veri analizi • {realProducts.length} ürün • {marketplaces.length} platform</p>
                </div>
                <div className="aa-header-right">
                    <div className="aa-last-update">
                        <FaClock />
                        <span>{lastUpdate.toLocaleTimeString('tr-TR')}</span>
                    </div>
                    <button className={`aa-refresh-btn ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)}>
                        <FaSync className={autoRefresh ? 'spinning' : ''} />
                        {autoRefresh ? 'Otomatik' : 'Manuel'}
                    </button>
                    <select className="aa-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="7">Son 7 Gün</option>
                        <option value="30">Son 30 Gün</option>
                        <option value="90">Son 90 Gün</option>
                    </select>
                    <button className="aa-action-btn" onClick={loadAllData} disabled={loading}>
                        <FaSync className={loading ? 'spinning' : ''} /> Yenile
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="aa-kpi-grid">
                {kpiCards.map(card => (
                    <motion.div key={card.id} className="aa-kpi-card" whileHover={{ scale: 1.02, y: -3 }}
                        style={{ borderTop: `3px solid ${card.color}` }}>
                        <div className="aa-kpi-icon" style={{ background: `${card.color}15`, color: card.color }}>
                            <card.icon />
                        </div>
                        <div className="aa-kpi-body">
                            <span className="aa-kpi-title">{card.title}</span>
                            <span className="aa-kpi-value">{card.value}</span>
                            <div className="aa-kpi-footer">
                                <span className={`aa-kpi-change ${card.trend}`}>
                                    {card.trend === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                                    {card.change}
                                </span>
                                <span className="aa-kpi-sub">{card.sub}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Tabs */}
            <div className="aa-tabs">
                {TABS.map(tab => (
                    <button key={tab.id} className={`aa-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}>
                        <tab.icon />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} className="aa-tab-content"
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.25 }}>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'marketplaces' && renderMarketplaces()}
                    {activeTab === 'products' && renderProducts()}
                    {activeTab === 'categories' && renderCategories()}
                    {activeTab === 'trends' && renderTrends()}
                    {activeTab === 'inventory' && renderInventory()}
                    {activeTab === 'insights' && renderInsights()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default AdvancedAnalytics;
