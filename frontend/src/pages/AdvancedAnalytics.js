/**
 * AdvancedAnalytics  LysiaETIC
 *  TAMAMEN YENDEN YAZILDI
 *
 * 7 Tab:
 *    Genel Bak    KPI Bar + Gnlk zet + Aksiyon Kartlar
 *    Sat & Kr    Ciro/Kr trendi + Kr marj + Net kr
 *    rn Performans  Krllk tablosu + Stok devir
 *    Pazaryeri Karlatrma  Yan yana metrikler
 *    Stok & Talep    Talep tahmini + Kritik stok + Devir hz
 *    Komisyon & Gider  Pazaryeri bazl komisyon + Gider dalm
 *    Aksiyon Merkezi  ncelikli neriler
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaChartLine, FaShoppingCart, FaMoneyBillWave, FaArrowUp,
    FaStore, FaFire, FaArrowDown, FaClock, FaPercent,
    FaChartBar, FaChartPie, FaExclamationTriangle, FaSync,
    FaDollarSign, FaWarehouse, FaBoxes, FaCalendarAlt,
    FaLightbulb, FaBalanceScale, FaSearchDollar, FaBullseye,
    FaHandHoldingUsd, FaUndoAlt, FaTimesCircle, FaCubes,
    FaTrophy, FaChartArea
} from "react-icons/fa";
import {
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Treemap
} from "recharts";
import { getUserMarketplaces, fetchDashboardData } from "../services/marketplaceApi";
import axios from "../services/api";
import "../styles/advancedAnalytics.css";

//  Sabitler 
const COLORS = ['#4ecdc4', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#a855f7'];
const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0', fontSize: '0.82rem' };

const fmtCurrency = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0));
const fmtNumber = (v) => new Intl.NumberFormat("tr-TR").format(Number(v || 0));
const fmtPercent = (v) => `%${Number(v || 0).toFixed(1)}`;

//  Tab tanmlar 
const TABS = [
    { id: "overview",     label: "Genel Bak",       icon: FaChartArea },
    { id: "sales",        label: "Sat & Kr",       icon: FaMoneyBillWave },
    { id: "products",     label: "rn Performans",   icon: FaBoxes },
    { id: "marketplaces", label: "Pazaryeri Karlatrma", icon: FaStore },
    { id: "stock",        label: "Stok & Talep",      icon: FaWarehouse },
    { id: "commission",   label: "Komisyon & Gider",  icon: FaHandHoldingUsd },
    { id: "actions",      label: "Aksiyon Merkezi",   icon: FaBullseye }
];

// 
// ANA BLEEN
// 
const AdvancedAnalytics = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [dateRange, setDateRange] = useState("30");
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Data states
    const [overview, setOverview] = useState(null);
    const [salesTrend, setSalesTrend] = useState([]);
    const [mpDistribution, setMpDistribution] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [categoryDist, setCategoryDist] = useState([]);
    const [hourlySales, setHourlySales] = useState([]);
    const [profitOverview, setProfitOverview] = useState(null);
    const [productPerformance, setProductPerformance] = useState([]);
    const [mpComparison, setMpComparison] = useState([]);
    const [commissionAnalysis, setCommissionAnalysis] = useState(null);
    const [stockVelocity, setStockVelocity] = useState(null);
    const [actions, setActions] = useState([]);
    const [dailySummary, setDailySummary] = useState(null);
    const [sortField, setSortField] = useState("totalRevenue");

    //  Date params 
    const getDateParams = useCallback(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(dateRange));
        return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    }, [dateRange]);

    //  API fetch helper 
    const fetchEndpoint = useCallback(async (endpoint, params = {}) => {
        try {
            const dateParams = getDateParams();
            const response = await axios.get(`/analytics/${endpoint}`, { params: { ...dateParams, ...params } });
            return response.data?.data || null;
        } catch (err) {
            console.warn(`Analytics ${endpoint} failed:`, err.response?.data?.message || err.message);
            return null;
        }
    }, [getDateParams]);

    //  Siparis Sync  Pazaryerlerinden siparisleri DB'ye kaydet 
    const syncOrders = useCallback(async () => {
        try {
            const dateParams = getDateParams();
            console.log(" [Analytics] Sipari sync balatlyor...");
            const resp = await axios.get("/orders/sync-all", { params: dateParams, timeout: 180000 });
            if (resp.data?.success) {
                console.log(" [Analytics] Sync tamamland:", resp.data.message);
            }
        } catch (err) {
            // Sync hatasi analytics'i engellemez  sadece logla
            console.warn(" [Analytics] Sipari sync hatas (analiz yine de ykleniyor):", err.message);
        }
    }, [getDateParams]);

    //  ANA VER YKLE 
    const loadAllData = useCallback(async () => {
        if (!userId) {
            console.warn("[AdvancedAnalytics] userId yok, veri yklenemiyor.");
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // 1. nce siparisleri pazaryerlerinden cekip DB'ye kaydet
            //    Bu sayede analyticsController.js'deki Order.aggregate() sorgulari veri bulur
            await syncOrders();

            // 2. Sonra analytics verilerini yukle
            const [
                overviewData, trendData, mpDistData, topProdData, catDistData,
                hourlyData, profitData, prodPerfData, mpCompData, commData,
                stockData, actionsData, summaryData
            ] = await Promise.all([
                fetchEndpoint('overview'),
                fetchEndpoint('sales-trend'),
                fetchEndpoint('marketplace-distribution'),
                fetchEndpoint('top-products', { limit: 20 }),
                fetchEndpoint('category-distribution'),
                fetchEndpoint('hourly-sales'),
                fetchEndpoint('profit-overview'),
                fetchEndpoint('product-performance', { limit: 50 }),
                fetchEndpoint('marketplace-comparison'),
                fetchEndpoint('commission-analysis'),
                fetchEndpoint('stock-velocity'),
                fetchEndpoint('actions'),
                fetchEndpoint('daily-summary')
            ]);

            setOverview(overviewData);
            setSalesTrend(Array.isArray(trendData) ? trendData : []);
            setMpDistribution(Array.isArray(mpDistData) ? mpDistData : []);
            setTopProducts(Array.isArray(topProdData) ? topProdData : []);
            setCategoryDist(Array.isArray(catDistData) ? catDistData : []);
            setHourlySales(Array.isArray(hourlyData) ? hourlyData : []);
            setProfitOverview(profitData);
            setProductPerformance(Array.isArray(prodPerfData) ? prodPerfData : []);
            setMpComparison(Array.isArray(mpCompData) ? mpCompData : []);
            setCommissionAnalysis(commData);
            setStockVelocity(stockData);
            setActions(Array.isArray(actionsData) ? actionsData : []);
            setDailySummary(summaryData);
            setLastUpdate(new Date());
        } catch (error) {
            console.error("Analytics data loading error:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, fetchEndpoint, syncOrders]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData, dateRange]);

    // 
    // KPI KARTLARI
    // 
    const kpiCards = useMemo(() => {
        const o = overview || {};
        const g = o.growth || {};
        const ds = dailySummary || {};
        const todayRev = ds.today?.revenue || 0;
        const todayProfit = ds.today?.netProfit || 0;

        return [
            {
                id: 'todayRevenue', title: "Bugnk Ciro", value: fmtCurrency(todayRev),
                change: ds.comparison?.revenueChange || 0, icon: FaDollarSign, color: '#10b981',
                sub: `Dn: ${fmtCurrency(ds.yesterday?.revenue || 0)}`
            },
            {
                id: 'todayProfit', title: "Bugn Net Kr", value: fmtCurrency(todayProfit),
                change: 0, icon: FaMoneyBillWave, color: '#22c55e',
                sub: `Haftalk: ${fmtCurrency(ds.thisWeek?.netProfit || 0)}`
            },
            {
                id: 'todayOrders', title: "Bugn Sipari", value: fmtNumber(ds.today?.orders || 0),
                change: ds.comparison?.orderChange || 0, icon: FaShoppingCart, color: '#3b82f6',
                sub: `Haftalk: ${fmtNumber(ds.thisWeek?.orders || 0)}`
            },
            {
                id: 'totalRevenue', title: `${dateRange} Gn Ciro`, value: fmtCurrency(o.totalRevenue),
                change: g.revenue || 0, icon: FaChartLine, color: '#8b5cf6',
                sub: `${fmtNumber(o.totalOrders)} sipari`
            },
            {
                id: 'netProfit', title: "Net Kr", value: fmtCurrency(o.netProfit),
                change: g.profit || 0, icon: FaTrophy, color: '#f59e0b',
                sub: `Marj: ${fmtPercent(o.profitMargin)}`
            },
            {
                id: 'activeProducts', title: "Aktif rn", value: fmtNumber(o.activeProducts),
                change: 0, icon: FaBoxes, color: '#06b6d4',
                sub: `Toplam: ${fmtNumber(o.totalProducts)}`
            }
        ];
    }, [overview, dailySummary, dateRange]);

    const sortedProducts = useMemo(() => {
        return [...productPerformance].sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
    }, [sortField, productPerformance]);

    // 
    // LOADING
    // 
    if (loading && !overview) {
        return (
            <div className="aa-loading">
                <div className="aa-loading-spinner" />
                <p>Gelimi analiz verileri ykleniyor...</p>
                <span>Tm veriler hesaplanyor</span>
            </div>
        );
    }

    // 
    // TAB 1: GENEL BAKI
    // 
    const renderOverview = () => {
        const ds = dailySummary || {};
        const criticalActions = actions.filter(a => a.priority === "critical");
        const warningActions = actions.filter(a => a.priority === "warning");

        return (
            <div className="aa-tab-grid">
                {/* Gnlk zet */}
                <div className="aa-card aa-span-2">
                    <div className="aa-card-head">
                        <h3><FaCalendarAlt /> Gnlk zet</h3>
                        <span className="aa-badge">Bugn vs Dn</span>
                    </div>
                    <div className="aa-daily-summary">
                        {[
                            { label: "Ciro", today: ds.today?.revenue, yesterday: ds.yesterday?.revenue, fmt: fmtCurrency },
                            { label: "Net Kr", today: ds.today?.netProfit, yesterday: ds.yesterday?.netProfit, fmt: fmtCurrency },
                            { label: "Sipari", today: ds.today?.orders, yesterday: ds.yesterday?.orders, fmt: fmtNumber },
                            { label: "Komisyon", today: ds.today?.commission, yesterday: 0, fmt: fmtCurrency }
                        ].map((item, i) => {
                            const todayVal = item.today || 0;
                            const yesterdayVal = item.yesterday || 0;
                            const change = yesterdayVal > 0 ? ((todayVal - yesterdayVal) / yesterdayVal * 100) : 0;
                            return (
                                <div key={i} className="aa-ds-item">
                                    <span className="aa-ds-label">{item.label}</span>
                                    <span className="aa-ds-value">{item.fmt(todayVal)}</span>
                                    <div className="aa-ds-compare">
                                        <span className="aa-ds-prev">Dn: {item.fmt(yesterdayVal)}</span>
                                        {change !== 0 && (
                                            <span className={`aa-ds-change ${change >= 0 ? 'up' : 'down'}`}>
                                                {change >= 0 ? <FaArrowUp /> : <FaArrowDown />} {Math.abs(change).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sat Trendi Mini */}
                <div className="aa-card aa-span-2">
                    <div className="aa-card-head">
                        <h3><FaChartLine /> Sat & Kr Trendi</h3>
                        <span className="aa-badge">{dateRange} Gn</span>
                    </div>
                    <div className="aa-card-body">
                        {salesTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <ComposedChart data={salesTrend}>
                                    <defs>
                                        <linearGradient id="gradRevOv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                        </linearGradient>
                                        <linearGradient id="gradProfitOv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch { return v; } }} />
                                    <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 10 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE}
                                        formatter={(v, n) => [n === 'Sipari' ? fmtNumber(v) : fmtCurrency(v), n]}
                                        labelFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return v; } }} />
                                    <Legend />
                                    <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#gradRevOv)" stroke="#10b981" strokeWidth={2} name="Ciro" />
                                    <Area yAxisId="left" type="monotone" dataKey="netProfit" fill="url(#gradProfitOv)" stroke="#f59e0b" strokeWidth={2} name="Net Kr" />
                                    <Bar yAxisId="right" dataKey="orders" fill="#3b82f680" radius={[3, 3, 0, 0]} name="Sipari" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <div className="aa-no-data"><FaChartLine /><p>Henz sat verisi yok</p></div>}
                    </div>
                </div>

                {/* Pazaryeri Dalm */}
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaChartPie /> Pazaryeri Dalm</h3>
                    </div>
                    <div className="aa-card-body">
                        {mpDistribution.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={mpDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                                            dataKey="revenue" nameKey="name" paddingAngle={3}>
                                            {mpDistribution.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtCurrency(v), 'Ciro']} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="aa-pie-legend">
                                    {mpDistribution.map((mp, idx) => (
                                        <div key={idx} className="aa-pie-legend-item">
                                            <span className="aa-legend-dot" style={{ background: COLORS[idx % COLORS.length] }} />
                                            <span className="aa-legend-name">{mp.name}</span>
                                            <span className="aa-legend-val">{fmtPercent(mp.percentage)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : <div className="aa-no-data"><FaChartPie /><p>Dalm verisi yok</p></div>}
                    </div>
                </div>

                {/* En ok Satan 5 rn */}
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaFire /> En ok Satan 5 rn</h3>
                        <button className="aa-link-btn" onClick={() => setActiveTab('products')}>Tm </button>
                    </div>
                    <div className="aa-card-body">
                        {topProducts.length > 0 ? (
                            <div className="aa-top5-list">
                                {topProducts.slice(0, 5).map((p, idx) => (
                                    <div key={idx} className="aa-top5-item">
                                        <div className="aa-top5-rank">{idx === 0 ? '' : idx === 1 ? '' : idx === 2 ? '' : `#${idx + 1}`}</div>
                                        <div className="aa-top5-info">
                                            <span className="aa-top5-name">{p.name}</span>
                                            <span className="aa-top5-meta">{fmtNumber(p.sales)} sat  {fmtCurrency(p.revenue)}</span>
                                        </div>
                                        <div className="aa-top5-right">
                                            <span className={`aa-trend-chip ${p.trend >= 0 ? 'up' : 'down'}`}>
                                                {p.trend >= 0 ? <FaArrowUp /> : <FaArrowDown />} {Math.abs(p.trend).toFixed(1)}%
                                            </span>
                                            {p.profitMargin !== undefined && (
                                                <span className={`aa-margin-chip ${p.profitMargin >= 15 ? 'good' : p.profitMargin >= 5 ? 'mid' : 'low'}`}>
                                                    Kr: {fmtPercent(p.profitMargin)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="aa-no-data"><FaFire /><p>rn verisi yok</p></div>}
                    </div>
                </div>

                {/* Aksiyon Kartlar */}
                {(criticalActions.length > 0 || warningActions.length > 0) && (
                    <div className="aa-card aa-span-2">
                        <div className="aa-card-head">
                            <h3><FaExclamationTriangle /> Dikkat Gerektiren Aksiyonlar</h3>
                            <button className="aa-link-btn" onClick={() => setActiveTab('actions')}>Tmn Gr </button>
                        </div>
                        <div className="aa-actions-preview">
                            {[...criticalActions, ...warningActions].slice(0, 4).map((action, idx) => (
                                <div key={idx} className={`aa-action-preview-card ${action.priority}`}>
                                    <div className="aa-apc-header">
                                        <span className="aa-apc-title">{action.title}</span>
                                        <span className={`aa-priority-badge ${action.priority}`}>
                                            {action.priority === 'critical' ? 'Kritik' : 'Uyar'}
                                        </span>
                                    </div>
                                    <p className="aa-apc-desc">{action.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stok Sal */}
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaWarehouse /> Stok Sal</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-stock-health-grid">
                            {[
                                { label: "Aktif rn", value: ds.stockHealth?.activeProducts || overview?.activeProducts || 0, color: "#22c55e", icon: "" },
                                { label: "Kritik Stok", value: ds.stockHealth?.criticalStock || 0, color: "#f59e0b", icon: "" },
                                { label: "Stok Tkendi", value: ds.stockHealth?.outOfStock || 0, color: "#ef4444", icon: "" }
                            ].map((item, i) => (
                                <div key={i} className="aa-sh-item" style={{ borderLeft: `3px solid ${item.color}` }}>
                                    <span className="aa-sh-icon">{item.icon}</span>
                                    <div>
                                        <span className="aa-sh-value" style={{ color: item.color }}>{fmtNumber(item.value)}</span>
                                        <span className="aa-sh-label">{item.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Haftalk zet */}
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaCalendarAlt /> Bu Hafta</h3>
                    </div>
                    <div className="aa-card-body">
                        <div className="aa-week-summary">
                            {[
                                { label: "Sipari", value: fmtNumber(ds.thisWeek?.orders || 0), color: "#3b82f6" },
                                { label: "Ciro", value: fmtCurrency(ds.thisWeek?.revenue || 0), color: "#10b981" },
                                { label: "Net Kr", value: fmtCurrency(ds.thisWeek?.netProfit || 0), color: "#f59e0b" }
                            ].map((item, i) => (
                                <div key={i} className="aa-ws-item">
                                    <span className="aa-ws-label">{item.label}</span>
                                    <span className="aa-ws-value" style={{ color: item.color }}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 
    // TAB 2: SATI & KR
    // 
    const renderSales = () => {
        const profit = profitOverview || {};
        const expenses = profit.expenseBreakdown || {};
        const dailyData = profit.dailyProfit || [];

        const expensePieData = [
            { name: "rn Maliyeti", value: expenses.productCost || 0, color: "#ef4444" },
            { name: "Komisyon", value: expenses.commission || 0, color: "#f59e0b" },
            { name: "Kargo", value: expenses.shipping || 0, color: "#3b82f6" },
            { name: "Paketleme", value: expenses.packaging || 0, color: "#8b5cf6" },
            { name: "Dier", value: expenses.otherCost || 0, color: "#94a3b8" }
        ].filter(d => d.value > 0);

        return (
            <div className="aa-tab-grid">
                {/* Kr zet Kartlar */}
                <div className="aa-card aa-span-full">
                    <div className="aa-profit-summary-grid">
                        {[
                            { label: "Toplam Ciro", value: fmtCurrency(expenses.totalRevenue), color: "#10b981", icon: <FaDollarSign /> },
                            { label: "Toplam Gider", value: fmtCurrency(expenses.totalExpenses), color: "#ef4444", icon: <FaHandHoldingUsd /> },
                            { label: "Brt Kr", value: fmtCurrency(expenses.grossProfit), color: "#3b82f6", icon: <FaChartBar /> },
                            { label: "Net Kr", value: fmtCurrency(expenses.netProfit), color: "#22c55e", icon: <FaTrophy /> },
                            { label: "Kr Marj", value: fmtPercent(expenses.profitMargin), color: "#f59e0b", icon: <FaPercent /> }
                        ].map((item, i) => (
                            <div key={i} className="aa-profit-card" style={{ borderTop: `3px solid ${item.color}` }}>
                                <div className="aa-pc-icon" style={{ color: item.color, background: `${item.color}15` }}>{item.icon}</div>
                                <div className="aa-pc-body">
                                    <span className="aa-pc-label">{item.label}</span>
                                    <span className="aa-pc-value" style={{ color: item.color }}>{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ciro vs Kr Trendi */}
                <div className="aa-card aa-span-2">
                    <div className="aa-card-head">
                        <h3><FaChartLine /> Ciro vs Net Kr Trendi</h3>
                    </div>
                    <div className="aa-card-body">
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={350}>
                                <ComposedChart data={dailyData}>
                                    <defs>
                                        <linearGradient id="gradRevS" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch { return v; } }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE}
                                        formatter={(v, n) => [fmtCurrency(v), n]}
                                        labelFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' }); } catch { return v; } }} />
                                    <Legend />
                                    <Area type="monotone" dataKey="revenue" fill="url(#gradRevS)" stroke="#10b981" strokeWidth={2} name="Ciro" />
                                    <Line type="monotone" dataKey="netProfit" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} name="Net Kr" />
                                    <Line type="monotone" dataKey="commission" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Komisyon" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <div className="aa-no-data"><FaChartLine /><p>Kr trendi verisi yok</p></div>}
                    </div>
                </div>

                {/* Gider Dalm Pasta */}
                <div className="aa-card">
                    <div className="aa-card-head">
                        <h3><FaChartPie /> Gider Dalm</h3>
                    </div>
                    <div className="aa-card-body">
                        {expensePieData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                                            dataKey="value" paddingAngle={3}>
                                            {expensePieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtCurrency(v)]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="aa-expense-legend">
                                    {expensePieData.map((item, idx) => (
                                        <div key={idx} className="aa-el-item">
                                            <span className="aa-el-dot" style={{ background: item.color }} />
                                            <span className="aa-el-name">{item.name}</span>
                                            <span className="aa-el-value">{fmtCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : <div className="aa-no-data"><FaChartPie /><p>Gider verisi yok</p></div>}
                    </div>
                </div>

                {/* Kr Marj Trendi */}
                <div className="aa-card aa-span-full">
                    <div className="aa-card-head">
                        <h3><FaPercent /> Kr Marj Trendi</h3>
                    </div>
                    <div className="aa-card-body">
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={dailyData}>
                                    <defs>
                                        <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => { try { return new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch { return v; } }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => `%${v}`} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`%${v}`, 'Kr Marj']} />
                                    <Area type="monotone" dataKey="profitMargin" fill="url(#gradMargin)" stroke="#8b5cf6" strokeWidth={2.5} name="Kr Marj %" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <div className="aa-no-data"><FaPercent /><p>Marj verisi yok</p></div>}
                    </div>
                </div>

                {/* Saatlik Sat */}
                {hourlySales.length > 0 && (
                    <div className="aa-card aa-span-full">
                        <div className="aa-card-head">
                            <h3><FaClock /> Saatlik Sat Deseni</h3>
                        </div>
                        <div className="aa-card-body">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={hourlySales}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE}
                                        formatter={(v, n) => [n === 'Gelir' ? fmtCurrency(v) : fmtNumber(v), n]} />
                                    <Legend />
                                    <Bar dataKey="orders" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Sipari" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 3: RN PERFORMANS
    // 
    const renderProducts = () => {

        return (
            <div className="aa-tab-grid">
                {/* rn Performans Tablosu */}
                <div className="aa-card aa-span-full">
                    <div className="aa-card-head">
                        <h3><FaBoxes /> rn Krllk Tablosu</h3>
                        <div className="aa-sort-controls">
                            <span className="aa-sort-label">Srala:</span>
                            {[
                                { key: "totalRevenue", label: "Ciro" },
                                { key: "netProfit", label: "Kr" },
                                { key: "totalSold", label: "Sat" },
                                { key: "profitMargin", label: "Marj" }
                            ].map(s => (
                                <button key={s.key} className={`aa-sort-btn ${sortField === s.key ? 'active' : ''}`}
                                    onClick={() => setSortField(s.key)}>{s.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="aa-card-body">
                        {sortedProducts.length > 0 ? (
                            <div className="aa-table-wrap">
                                <table className="aa-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>rn</th>
                                            <th>Sat</th>
                                            <th>Ciro</th>
                                            <th>Maliyet</th>
                                            <th>Komisyon</th>
                                            <th>Net Kr</th>
                                            <th>Marj</th>
                                            <th>Stok</th>
                                            <th>ade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedProducts.slice(0, 30).map((p, idx) => (
                                            <tr key={idx}>
                                                <td><span className="aa-rank">{idx === 0 ? '' : idx === 1 ? '' : idx === 2 ? '' : idx + 1}</span></td>
                                                <td>
                                                    <div className="aa-product-cell">
                                                        <span className="aa-pc-name">{p.name}</span>
                                                        <span className="aa-pc-cat">{p.category}</span>
                                                    </div>
                                                </td>
                                                <td><strong>{fmtNumber(p.totalSold)}</strong></td>
                                                <td className="aa-td-green">{fmtCurrency(p.totalRevenue)}</td>
                                                <td className="aa-td-red">{fmtCurrency(p.totalCost)}</td>
                                                <td className="aa-td-orange">{fmtCurrency(p.totalCommission)}</td>
                                                <td className={p.netProfit >= 0 ? 'aa-td-green' : 'aa-td-red'}>
                                                    <strong>{fmtCurrency(p.netProfit)}</strong>
                                                </td>
                                                <td>
                                                    <span className={`aa-margin-badge ${p.profitMargin >= 15 ? 'good' : p.profitMargin >= 5 ? 'mid' : 'low'}`}>
                                                        {fmtPercent(p.profitMargin)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`aa-stock-badge ${p.currentStock === 0 ? 'out' : p.currentStock <= 5 ? 'critical' : p.currentStock <= 20 ? 'low' : 'ok'}`}>
                                                        {p.currentStock}
                                                    </span>
                                                </td>
                                                <td>
                                                    {p.returnRate > 0 ? (
                                                        <span className={`aa-return-badge ${p.returnRate > 10 ? 'high' : 'normal'}`}>
                                                            {fmtPercent(p.returnRate)}
                                                        </span>
                                                    ) : <span className="aa-td-dim"></span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <div className="aa-no-data"><FaBoxes /><p>rn performans verisi yok</p></div>}
                    </div>
                </div>

                {/* Kategori Dalm */}
                {categoryDist.length > 0 && (
                    <div className="aa-card aa-span-2">
                        <div className="aa-card-head">
                            <h3><FaChartPie /> Kategori Bazl Performans</h3>
                        </div>
                        <div className="aa-card-body">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={categoryDist.slice(0, 10)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis type="number" stroke="#64748b" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" width={120} tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'Kr' ? fmtCurrency(v) : fmtCurrency(v), n]} />
                                    <Legend />
                                    <Bar dataKey="revenue" fill="#10b981" name="Ciro" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="netProfit" fill="#f59e0b" name="Kr" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Kategori Detay Listesi */}
                {categoryDist.length > 0 && (
                    <div className="aa-card">
                        <div className="aa-card-head">
                            <h3><FaBalanceScale /> Kategori Krllk</h3>
                        </div>
                        <div className="aa-card-body">
                            <div className="aa-cat-list">
                                {categoryDist.map((cat, idx) => (
                                    <div key={idx} className="aa-cat-item">
                                        <div className="aa-cat-color" style={{ background: cat.color || COLORS[idx % COLORS.length] }} />
                                        <div className="aa-cat-info">
                                            <span className="aa-cat-name">{cat.name}</span>
                                            <span className="aa-cat-meta">{fmtNumber(cat.sales)} sat  {cat.productCount} rn</span>
                                        </div>
                                        <div className="aa-cat-metrics">
                                            <span className="aa-cat-revenue">{fmtCurrency(cat.revenue)}</span>
                                            <span className={`aa-cat-margin ${cat.profitMargin >= 10 ? 'good' : 'low'}`}>
                                                Marj: {fmtPercent(cat.profitMargin)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 4: PAZARYERI KARILATIRMA
    // 
    const renderMarketplaces = () => {
        return (
            <div className="aa-tab-grid">
                {/* Pazaryeri Kartlar */}
                {mpComparison.length > 0 ? mpComparison.map((mp, idx) => (
                    <div key={idx} className="aa-mp-card">
                        <div className="aa-mp-header">
                            <div className="aa-mp-rank" style={{
                                background: idx === 0 ? 'linear-gradient(135deg, #ffd700, #ffaa00)' :
                                    idx === 1 ? 'linear-gradient(135deg, #c0c0c0, #a0a0a0)' :
                                        idx === 2 ? 'linear-gradient(135deg, #cd7f32, #b8690e)' :
                                            'linear-gradient(135deg, #4ecdc4, #44a08d)'
                            }}>#{idx + 1}</div>
                            <div className="aa-mp-name-section">
                                <h4>{mp.name}</h4>
                                <span className={`aa-mp-growth ${(mp.growth?.revenue || 0) >= 0 ? 'up' : 'down'}`}>
                                    {(mp.growth?.revenue || 0) >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                    {Math.abs(mp.growth?.revenue || 0).toFixed(1)}% ciro
                                </span>
                            </div>
                        </div>

                        <div className="aa-mp-metrics">
                            {[
                                { label: "Sipari", value: fmtNumber(mp.orders), icon: <FaShoppingCart /> },
                                { label: "Ciro", value: fmtCurrency(mp.revenue), icon: <FaDollarSign /> },
                                { label: "Net Kr", value: fmtCurrency(mp.netProfit), icon: <FaTrophy /> },
                                { label: "Ort. Sepet", value: fmtCurrency(mp.avgOrderValue), icon: <FaShoppingCart /> },
                                { label: "Kr Marj", value: fmtPercent(mp.profitMargin), icon: <FaPercent /> },
                                { label: "Komisyon", value: fmtPercent(mp.commissionRate), icon: <FaHandHoldingUsd /> },
                                { label: "ade Oran", value: fmtPercent(mp.returnRate), icon: <FaUndoAlt /> },
                                { label: "ptal Oran", value: fmtPercent(mp.cancelRate), icon: <FaTimesCircle /> }
                            ].map((m, i) => (
                                <div key={i} className="aa-mp-metric">
                                    <span className="aa-mpm-icon">{m.icon}</span>
                                    <div>
                                        <span className="aa-mpm-value">{m.value}</span>
                                        <span className="aa-mpm-label">{m.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )) : <div className="aa-no-data-full"><FaStore /><p>Pazaryeri karlatrma verisi yok</p></div>}

                {/* Karlatrma Grafii */}
                {mpComparison.length > 1 && (
                    <div className="aa-card aa-span-full">
                        <div className="aa-card-head">
                            <h3><FaChartBar /> Pazaryeri Karlatrma</h3>
                        </div>
                        <div className="aa-card-body">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={mpComparison}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="name" stroke="#64748b" />
                                    <YAxis stroke="#64748b" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmtCurrency(v), n]} />
                                    <Legend />
                                    <Bar dataKey="revenue" fill="#10b981" name="Ciro" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="netProfit" fill="#f59e0b" name="Net Kr" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="totalCommission" fill="#ef4444" name="Komisyon" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 5: STOK & TALEP
    // 
    const renderStock = () => {
        const sv = stockVelocity || {};
        const items = sv.items || [];
        const summary = sv.summary || {};

        const criticalItems = items.filter(i => i.status === 'critical' || i.status === 'outOfStock');
        const deadStockItems = items.filter(i => i.status === 'deadStock');
        const healthyItems = items.filter(i => i.status === 'healthy');

        return (
            <div className="aa-tab-grid">
                {/* Stok zet Kartlar */}
                <div className="aa-card aa-span-full">
                    <div className="aa-stock-summary-grid">
                        {[
                            { label: "Toplam rn", value: fmtNumber(summary.totalProducts), color: "#4ecdc4", icon: "" },
                            { label: "Stok Deeri", value: fmtCurrency(summary.totalStockValue), color: "#10b981", icon: "" },
                            { label: "Kritik Stok", value: fmtNumber(summary.criticalCount), color: "#f59e0b", icon: "" },
                            { label: "Stok Tkendi", value: fmtNumber(summary.outOfStockCount), color: "#ef4444", icon: "" },
                            { label: "l Stok", value: fmtNumber(summary.deadStockCount), color: "#8b5cf6", icon: "" },
                            { label: "l Stok Deeri", value: fmtCurrency(summary.deadStockValue), color: "#ec4899", icon: "" },
                            { label: "Ort. Devir Hz", value: `${summary.avgTurnoverRate || 0}x`, color: "#06b6d4", icon: "" }
                        ].map((item, i) => (
                            <div key={i} className="aa-ss-card" style={{ borderTop: `3px solid ${item.color}` }}>
                                <span className="aa-ss-icon">{item.icon}</span>
                                <span className="aa-ss-value" style={{ color: item.color }}>{item.value}</span>
                                <span className="aa-ss-label">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Kritik Stok rnleri */}
                {criticalItems.length > 0 && (
                    <div className="aa-card aa-span-full">
                        <div className="aa-card-head">
                            <h3><FaExclamationTriangle /> Kritik & Tkenen Stok ({criticalItems.length} rn)</h3>
                        </div>
                        <div className="aa-card-body">
                            <div className="aa-table-wrap">
                                <table className="aa-table">
                                    <thead>
                                        <tr>
                                            <th>rn</th>
                                            <th>Stok</th>
                                            <th>Gnlk Sat</th>
                                            <th>Kalan Gn</th>
                                            <th>Devir Hz</th>
                                            <th>Ciro</th>
                                            <th>Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {criticalItems.slice(0, 20).map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div className="aa-product-cell">
                                                        <span className="aa-pc-name">{item.name}</span>
                                                        <span className="aa-pc-cat">{item.category}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`aa-stock-badge ${item.status}`}>
                                                        {item.currentStock}
                                                    </span>
                                                </td>
                                                <td>{item.avgDailySales.toFixed(1)}</td>
                                                <td>
                                                    <span className={`aa-days-badge ${item.daysOfStock <= 3 ? 'critical' : 'warning'}`}>
                                                        {item.daysOfStock} gn
                                                    </span>
                                                </td>
                                                <td>{item.turnoverRate}x</td>
                                                <td className="aa-td-green">{fmtCurrency(item.revenue)}</td>
                                                <td>
                                                    <span className={`aa-status-badge ${item.status}`}>
                                                        {item.status === 'outOfStock' ? ' Tkendi' : ' Kritik'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* l Stok */}
                {deadStockItems.length > 0 && (
                    <div className="aa-card aa-span-full">
                        <div className="aa-card-head">
                            <h3><FaCubes /> l Stok  Satlmayan rnler ({deadStockItems.length} rn)</h3>
                            <span className="aa-badge">Toplam Deer: {fmtCurrency(summary.deadStockValue)}</span>
                        </div>
                        <div className="aa-card-body">
                            <div className="aa-dead-stock-grid">
                                {deadStockItems.slice(0, 12).map((item, idx) => (
                                    <div key={idx} className="aa-dead-stock-item">
                                        <span className="aa-dsi-name">{item.name}</span>
                                        <div className="aa-dsi-metrics">
                                            <span>Stok: <strong>{item.currentStock}</strong></span>
                                            <span>Deer: <strong className="aa-td-orange">{fmtCurrency(item.stockValue)}</strong></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 6: KOMSYON & GDER
    // 
    const renderCommission = () => {
        const data = commissionAnalysis || {};
        const byMarketplace = data.byMarketplace || [];
        const byCategory = data.byCategory || [];

        return (
            <div className="aa-tab-grid">
                {/* Pazaryeri Bazl Komisyon */}
                {byMarketplace.length > 0 && (
                    <div className="aa-card aa-span-full">
                        <div className="aa-card-head">
                            <h3><FaStore /> Pazaryeri Bazl Komisyon & Gider</h3>
                        </div>
                        <div className="aa-card-body">
                            <div className="aa-table-wrap">
                                <table className="aa-table">
                                    <thead>
                                        <tr>
                                            <th>Pazaryeri</th>
                                            <th>Ciro</th>
                                            <th>Komisyon</th>
                                            <th>Komisyon %</th>
                                            <th>Kargo</th>
                                            <th>rn Maliyeti</th>
                                            <th>Toplam Gider</th>
                                            <th>Net Kr</th>
                                            <th>Gider Oran</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byMarketplace.map((mp, idx) => (
                                            <tr key={idx}>
                                                <td><strong>{mp.name}</strong></td>
                                                <td className="aa-td-green">{fmtCurrency(mp.revenue)}</td>
                                                <td className="aa-td-orange">{fmtCurrency(mp.commission)}</td>
                                                <td><span className="aa-comm-rate">{fmtPercent(mp.commissionRate)}</span></td>
                                                <td>{fmtCurrency(mp.shipping)}</td>
                                                <td className="aa-td-red">{fmtCurrency(mp.productCost)}</td>
                                                <td>{fmtCurrency(mp.totalExpense)}</td>
                                                <td className={mp.netProfit >= 0 ? 'aa-td-green' : 'aa-td-red'}>
                                                    <strong>{fmtCurrency(mp.netProfit)}</strong>
                                                </td>
                                                <td>
                                                    <span className={`aa-expense-rate ${mp.expenseRatio > 80 ? 'high' : mp.expenseRatio > 60 ? 'mid' : 'low'}`}>
                                                        {fmtPercent(mp.expenseRatio)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Komisyon Karlatrma Grafii */}
                {byMarketplace.length > 0 && (
                    <div className="aa-card aa-span-2">
                        <div className="aa-card-head">
                            <h3><FaChartBar /> Gider Karlatrmas</h3>
                        </div>
                        <div className="aa-card-body">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={byMarketplace}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="name" stroke="#64748b" />
                                    <YAxis stroke="#64748b" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmtCurrency(v), n]} />
                                    <Legend />
                                    <Bar dataKey="commission" fill="#f59e0b" name="Komisyon" stackId="a" />
                                    <Bar dataKey="shipping" fill="#3b82f6" name="Kargo" stackId="a" />
                                    <Bar dataKey="productCost" fill="#ef4444" name="rn Maliyeti" stackId="a" />
                                    <Bar dataKey="packaging" fill="#8b5cf6" name="Paketleme" stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Kategori Bazl Komisyon */}
                {byCategory.length > 0 && (
                    <div className="aa-card">
                        <div className="aa-card-head">
                            <h3><FaSearchDollar /> Kategori Komisyon Oranlar</h3>
                        </div>
                        <div className="aa-card-body">
                            <div className="aa-comm-cat-list">
                                {byCategory.map((cat, idx) => (
                                    <div key={idx} className="aa-comm-cat-item">
                                        <div className="aa-cci-info">
                                            <span className="aa-cci-name">{cat.name}</span>
                                            <span className="aa-cci-revenue">{fmtCurrency(cat.revenue)}</span>
                                        </div>
                                        <div className="aa-cci-rates">
                                            <span className="aa-cci-rate">Komisyon: {fmtPercent(cat.effectiveRate)}</span>
                                            <span className="aa-cci-amount">{fmtCurrency(cat.commission)}</span>
                                        </div>
                                        <div className="aa-cci-bar">
                                            <div className="aa-cci-bar-fill" style={{
                                                width: `${Math.min(cat.effectiveRate || 0, 100)}%`,
                                                background: (cat.effectiveRate || 0) > 20 ? '#ef4444' : (cat.effectiveRate || 0) > 10 ? '#f59e0b' : '#22c55e'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // TAB 7: AKSYON MERKEZ
    // 
    const renderActions = () => {
        const criticalActions = actions.filter(a => a.priority === "critical");
        const warningActions = actions.filter(a => a.priority === "warning");
        const infoActions = actions.filter(a => a.priority === "info");

        return (
            <div className="aa-tab-grid">
                {/* Aksiyon zeti */}
                <div className="aa-card aa-span-full">
                    <div className="aa-action-summary">
                        <div className="aa-as-item critical">
                            <span className="aa-as-count">{criticalActions.length}</span>
                            <span className="aa-as-label">Kritik</span>
                        </div>
                        <div className="aa-as-item warning">
                            <span className="aa-as-count">{warningActions.length}</span>
                            <span className="aa-as-label">Uyar</span>
                        </div>
                        <div className="aa-as-item info">
                            <span className="aa-as-count">{infoActions.length}</span>
                            <span className="aa-as-label">Bilgi</span>
                        </div>
                        <div className="aa-as-item total">
                            <span className="aa-as-count">{actions.length}</span>
                            <span className="aa-as-label">Toplam</span>
                        </div>
                    </div>
                </div>

                {/* Aksiyon Kartlar */}
                {actions.length > 0 ? actions.map((action, idx) => (
                    <motion.div key={idx} className={`aa-action-card ${action.priority}`}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
                        <div className="aa-ac-header">
                            <span className="aa-ac-title">{action.title}</span>
                            <span className={`aa-priority-badge ${action.priority}`}>
                                {action.priority === 'critical' ? ' Kritik' : action.priority === 'warning' ? ' Uyar' : ' Bilgi'}
                            </span>
                        </div>
                        <p className="aa-ac-desc">{action.description}</p>
                        {action.impact && (
                            <div className="aa-ac-impact">
                                <FaLightbulb /> <span>Etki: {action.impact}</span>
                            </div>
                        )}
                        {action.items && action.items.length > 0 && (
                            <div className="aa-ac-items">
                                {action.items.map((item, i) => (
                                    <span key={i} className="aa-ac-item-tag">{item}</span>
                                ))}
                                {action.count > action.items.length && (
                                    <span className="aa-ac-more">+{action.count - action.items.length} daha</span>
                                )}
                            </div>
                        )}
                        <div className="aa-ac-footer">
                            <span className="aa-ac-category">{action.category}</span>
                            {action.count && <span className="aa-ac-count">{action.count} rn</span>}
                        </div>
                    </motion.div>
                )) : (
                    <div className="aa-card aa-span-full">
                        <div className="aa-no-data" style={{ padding: '3rem' }}>
                            <FaBullseye />
                            <p> Harika! u anda aksiyon gerektiren bir durum yok.</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 
    // ANA RENDER
    // 
    return (
        <div className="aa-container">
            {/* Header */}
            <div className="aa-header">
                <div className="aa-header-left">
                    <h1><FaChartArea /> Gelimi Analiz & Raporlama</h1>
                    <p>Sat, kr, komisyon, stok  tm verileriniz tek ekranda</p>
                </div>
                <div className="aa-header-right">
                    <div className="aa-last-update">
                        <FaClock />
                        <span>{lastUpdate.toLocaleTimeString('tr-TR')}</span>
                    </div>
                    <select className="aa-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="7">Son 7 Gn</option>
                        <option value="30">Son 30 Gn</option>
                        <option value="90">Son 90 Gn</option>
                        <option value="180">Son 6 Ay</option>
                    </select>
                    <button className="aa-action-btn" onClick={loadAllData} disabled={loading}>
                        <FaSync className={loading ? 'spinning' : ''} /> Yenile
                    </button>
                </div>
            </div>

            {/* KPI Bar */}
            <div className="aa-kpi-grid">
                {kpiCards.map((card, idx) => (
                    <motion.div key={card.id} className="aa-kpi-card"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        style={{ borderTop: `3px solid ${card.color}` }}>
                        <div className="aa-kpi-icon" style={{ background: `${card.color}15`, color: card.color }}>
                            <card.icon />
                        </div>
                        <div className="aa-kpi-body">
                            <span className="aa-kpi-title">{card.title}</span>
                            <span className="aa-kpi-value">{card.value}</span>
                            <div className="aa-kpi-footer">
                                {card.change !== 0 && (
                                    <span className={`aa-kpi-change ${card.change >= 0 ? 'up' : 'down'}`}>
                                        {card.change >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                        {Math.abs(card.change).toFixed(1)}%
                                    </span>
                                )}
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
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.25 }}>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'sales' && renderSales()}
                    {activeTab === 'products' && renderProducts()}
                    {activeTab === 'marketplaces' && renderMarketplaces()}
                    {activeTab === 'stock' && renderStock()}
                    {activeTab === 'commission' && renderCommission()}
                    {activeTab === 'actions' && renderActions()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default AdvancedAnalytics;
