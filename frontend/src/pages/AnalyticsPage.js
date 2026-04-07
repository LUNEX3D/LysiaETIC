import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    FaChartLine, FaShoppingCart, FaMoneyBillWave, FaBox, FaArrowUp,
    FaStore, FaCalendarAlt, FaDownload, FaFire, FaStar,
    FaArrowDown, FaClock, FaUsers, FaPercent, FaChartBar, FaChartPie
} from "react-icons/fa";
import axios from "../services/api";
import "../styles/analytics.css";

const AnalyticsPage = () => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState("7"); // 7, 30, 90 days
    const [selectedMarketplace, setSelectedMarketplace] = useState("all");
    const [marketplaces, setMarketplaces] = useState([]);

    // Analytics data
    const [kpiData, setKpiData] = useState({
        totalOrders: 0,
        totalRevenue: 0,
        activeProducts: 0,
        growth: 0,
        avgOrderValue: 0,
        conversionRate: 0
    });

    const [salesTrend, setSalesTrend] = useState([]);
    const [marketplaceDistribution, setMarketplaceDistribution] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [hourlyData, setHourlyData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);

    useEffect(() => {
        loadMarketplaces();
        loadAnalyticsData();
    }, [dateRange, selectedMarketplace]);

    // âœ… FIX #6: DoÄŸru endpoint â€” /marketplaces â†’ /marketplace/user-marketplaces
    const loadMarketplaces = async () => {
        try {
            const response = await axios.get("/marketplace/user-marketplaces", {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            setMarketplaces(response.data || []);
        } catch (error) {
            // silently handle
        }
    };

    const loadAnalyticsData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const params = {
                startDate: getStartDate(),
                endDate: new Date().toISOString(),
                marketplaceId: selectedMarketplace
            };

            // removed debug log

            // Parallel API calls for better performance
            const [overviewRes, trendRes, distributionRes, topProductsRes, categoryRes, hourlyRes] = await Promise.all([
                axios.get("/analytics/overview", {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get("/analytics/sales-trend", {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get("/analytics/marketplace-distribution", {
                    params: { startDate: params.startDate, endDate: params.endDate },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get("/analytics/top-products", {
                    params: { ...params, limit: 5 },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get("/analytics/category-distribution", {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get("/analytics/hourly-sales", {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            console.log("âœ… API responses:", {
                overview: overviewRes.data,
                trend: trendRes.data,
                distribution: distributionRes.data,
                topProducts: topProductsRes.data,
                category: categoryRes.data,
                hourly: hourlyRes.data
            });

            // Set KPI Data
            if (overviewRes.data.success && overviewRes.data.data) {
                // removed debug log
                setKpiData(overviewRes.data.data);
            } else {
                // removed debug log
            }

            // Set Sales Trend
            if (trendRes.data.success && trendRes.data.data) {
                // removed debug log
                const formattedTrend = trendRes.data.data.map(item => ({
                    date: new Date(item.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
                    orders: item.orders,
                    revenue: item.revenue
                }));
                setSalesTrend(formattedTrend);
                // removed debug log
            } else {
                // removed debug log
                setSalesTrend([]);
            }

            // Set Marketplace Distribution
            if (distributionRes.data.success && distributionRes.data.data) {
                // removed debug log
                const colors = ["#FF6B00", "#6C3FD6", "#FF6000", "#4ecdc4", "#3b82f6"];
                const formattedDistribution = distributionRes.data.data.map((item, index) => ({
                    name: item.name,
                    value: parseFloat(item.percentage),
                    orders: item.orders,
                    revenue: item.revenue,
                    color: colors[index % colors.length]
                }));
                setMarketplaceDistribution(formattedDistribution);
            } else {
                // removed debug log
            }

            // Set Top Products
            if (topProductsRes.data.success && topProductsRes.data.data) {
                // removed debug log
                const formattedProducts = topProductsRes.data.data.map(item => ({
                    name: item.name,
                    sales: item.sales,
                    revenue: item.revenue,
                    trend: item.trend || 0 // Real trend from backend
                }));
                setTopProducts(formattedProducts);
                // removed debug log
            } else {
                // removed debug log
                setTopProducts([]);
            }

            // Set Category Distribution
            if (categoryRes.data.success && categoryRes.data.data) {
                // removed debug log
                setCategoryData(categoryRes.data.data);
                // removed debug log
            } else {
                // removed debug log
                setCategoryData([]);
            }

            // Set Hourly Sales
            if (hourlyRes.data.success && hourlyRes.data.data) {
                // removed debug log
                setHourlyData(hourlyRes.data.data);
                // removed debug log
            } else {
                // removed debug log
                setHourlyData([]);
            }

            // removed debug log

        } catch (error) {
            // removed debug log
            // removed debug log

            // Set empty data on error
            setKpiData({
                totalOrders: 0,
                totalRevenue: 0,
                activeProducts: 0,
                growth: 0,
                avgOrderValue: 0,
                conversionRate: 0
            });
            setSalesTrend([]);
            setMarketplaceDistribution([]);
            setTopProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const getStartDate = () => {
        const days = parseInt(dateRange);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 0
        }).format(value);
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat('tr-TR').format(value);
    };

    const exportToExcel = () => {
        alert("Excel export Ã¶zelliÄŸi yakÄ±nda eklenecek!");
    };

    const exportToPDF = () => {
        alert("PDF export Ã¶zelliÄŸi yakÄ±nda eklenecek!");
    };

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="loading-spinner"></div>
                <p>Veriler yÃ¼kleniyor...</p>
            </div>
        );
    }

    // Check if no data
    const hasNoData = kpiData.totalOrders === 0 && salesTrend.length === 0 && topProducts.length === 0;

    if (hasNoData) {
        return (
            <div className="analytics-page">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="analytics-header"
                >
                    <div className="header-left">
                        <h1><FaChartLine /> Analiz ve Raporlama</h1>
                        <p>DetaylÄ± satÄ±ÅŸ analizleri ve performans metrikleri</p>
                    </div>
                </motion.div>

                <div className="empty-state" style={{ padding: '4rem', textAlign: 'center' }}>
                    <FaChartLine style={{ fontSize: '5rem', color: '#4ecdc4', opacity: 0.3, marginBottom: '2rem' }} />
                    <h2 style={{ color: '#fff', marginBottom: '1rem' }}>HenÃ¼z Veri Yok</h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem' }}>
                        Analytics verilerini gÃ¶rmek iÃ§in sipariÅŸ oluÅŸturmanÄ±z gerekiyor.
                    </p>
                    <div style={{ background: 'rgba(78, 205, 196, 0.1)', border: '1px solid rgba(78, 205, 196, 0.3)', borderRadius: '12px', padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
                        <h3 style={{ color: '#4ecdc4', marginBottom: '1rem' }}>Test Verileri OluÅŸturmak Ä°Ã§in:</h3>
                        <code style={{ background: '#1a1a2e', color: '#4ecdc4', padding: '1rem', borderRadius: '8px', display: 'block', fontFamily: 'monospace' }}>
                            cd backend<br/>
                            node scripts/seedOrders.js
                        </code>
                        <p style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '0.9rem' }}>
                            Bu komut son 30 gÃ¼n iÃ§in ~300-400 test sipariÅŸi oluÅŸturacak.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-page">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="analytics-header"
            >
                <div className="header-left">
                    <h1><FaChartLine /> Analiz ve Raporlama</h1>
                    <p>DetaylÄ± satÄ±ÅŸ analizleri ve performans metrikleri</p>
                </div>
                <div className="header-right">
                    <button className="export-btn" onClick={exportToExcel}>
                        <FaDownload /> Excel
                    </button>
                    <button className="export-btn" onClick={exportToPDF}>
                        <FaDownload /> PDF
                    </button>
                </div>
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="analytics-filters"
            >
                <div className="filter-group">
                    <FaCalendarAlt />
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="7">Son 7 GÃ¼n</option>
                        <option value="30">Son 30 GÃ¼n</option>
                        <option value="90">Son 90 GÃ¼n</option>
                    </select>
                </div>
                <div className="filter-group">
                    <FaStore />
                    <select value={selectedMarketplace} onChange={(e) => setSelectedMarketplace(e.target.value)}>
                        <option value="all">TÃ¼m Pazaryerleri</option>
                        {marketplaces.map(mp => (
                            <option key={mp._id} value={mp._id}>{mp.name}</option>
                        ))}
                    </select>
                </div>
            </motion.div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="kpi-card gradient-blue"
                >
                    <div className="kpi-icon">
                        <FaShoppingCart />
                    </div>
                    <div className="kpi-content">
                        <p className="kpi-label">Toplam SipariÅŸ</p>
                        <h2 className="kpi-value">{formatNumber(kpiData.totalOrders)}</h2>
                        <div className="kpi-change positive">
                            <FaArrowUp /> +{kpiData.growth}% bu ay
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="kpi-card gradient-green"
                >
                    <div className="kpi-icon">
                        <FaMoneyBillWave />
                    </div>
                    <div className="kpi-content">
                        <p className="kpi-label">Toplam Gelir</p>
                        <h2 className="kpi-value">{formatCurrency(kpiData.totalRevenue)}</h2>
                        <div className="kpi-change positive">
                            <FaArrowUp /> +18.2% bu ay
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="kpi-card gradient-purple"
                >
                    <div className="kpi-icon">
                        <FaBox />
                    </div>
                    <div className="kpi-content">
                        <p className="kpi-label">Aktif ÃœrÃ¼n</p>
                        <h2 className="kpi-value">{formatNumber(kpiData.activeProducts)}</h2>
                        <div className="kpi-change positive">
                            <FaArrowUp /> +12 yeni Ã¼rÃ¼n
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="kpi-card gradient-orange"
                >
                    <div className="kpi-icon">
                        <FaChartLine />
                    </div>
                    <div className="kpi-content">
                        <p className="kpi-label">Ort. SipariÅŸ DeÄŸeri</p>
                        <h2 className="kpi-value">{formatCurrency(kpiData.avgOrderValue)}</h2>
                        <div className="kpi-change positive">
                            <FaArrowUp /> +5.3% bu ay
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Main Charts Row */}
            <div className="charts-row">
                {/* Sales Trend Chart */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="chart-card large"
                >
                    <div className="chart-header">
                        <h3><FaChartLine /> SatÄ±ÅŸ Trendi (Son 30 GÃ¼n)</h3>
                        <div className="chart-legend">
                            <span className="legend-item">
                                <span className="legend-dot blue"></span> SipariÅŸ SayÄ±sÄ±
                            </span>
                        </div>
                    </div>
                    <div className="line-chart">
                        <div className="chart-grid">
                            {salesTrend.map((data, index) => {
                                const maxOrders = Math.max(...salesTrend.map(d => d.orders));
                                const height = (data.orders / maxOrders) * 100;
                                return (
                                    <div key={index} className="chart-bar-wrapper">
                                        <div
                                            className="chart-line-bar"
                                            style={{ height: `${height}%` }}
                                            title={`${data.date}: ${data.orders} sipariÅŸ`}
                                        >
                                            <div className="bar-dot"></div>
                                        </div>
                                        {index % 5 === 0 && (
                                            <span className="chart-x-label">{data.date}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Secondary Charts Row */}
            <div className="charts-row">
                {/* Marketplace Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="chart-card"
                >
                    <div className="chart-header">
                        <h3><FaChartPie /> Pazaryeri DaÄŸÄ±lÄ±mÄ±</h3>
                    </div>
                    <div className="donut-chart">
                        <div className="donut-segments">
                            {marketplaceDistribution.map((item, index) => (
                                <div
                                    key={index}
                                    className="donut-segment"
                                    style={{
                                        background: `conic-gradient(${item.color} 0deg ${item.value * 3.6}deg, transparent ${item.value * 3.6}deg)`
                                    }}
                                ></div>
                            ))}
                        </div>
                        <div className="donut-center">
                            <h2>100%</h2>
                            <p>Toplam</p>
                        </div>
                    </div>
                    <div className="donut-legend">
                        {marketplaceDistribution.map((item, index) => (
                            <div key={index} className="legend-row">
                                <div className="legend-color" style={{ background: item.color }}></div>
                                <span className="legend-name">{item.name}</span>
                                <span className="legend-value">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Hourly Sales Pattern */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="chart-card"
                >
                    <div className="chart-header">
                        <h3><FaClock /> Saatlik SatÄ±ÅŸ DaÄŸÄ±lÄ±mÄ±</h3>
                    </div>
                    <div className="hourly-chart">
                        {hourlyData.map((data, index) => {
                            const maxOrders = Math.max(...hourlyData.map(d => d.orders));
                            const height = (data.orders / maxOrders) * 100;
                            return (
                                <div key={index} className="hourly-bar-container">
                                    <div
                                        className="hourly-bar"
                                        style={{ height: `${height}%` }}
                                        title={`${data.hour}: ${data.orders} sipariÅŸ`}
                                    ></div>
                                    {index % 3 === 0 && (
                                        <span className="hourly-label">{data.hour}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Row */}
            <div className="charts-row">
                {/* Top Products */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 }}
                    className="chart-card"
                >
                    <div className="chart-header">
                        <h3><FaFire /> En Ã‡ok Satan ÃœrÃ¼nler</h3>
                    </div>
                    <div className="top-products-list">
                        {topProducts.map((product, index) => (
                            <div key={index} className="product-row">
                                <div className="product-rank">#{index + 1}</div>
                                <div className="product-info">
                                    <h4>{product.name}</h4>
                                    <p>{product.sales} satÄ±ÅŸ â€¢ {formatCurrency(product.revenue)}</p>
                                </div>
                                <div className={`product-trend ${product.trend >= 0 ? 'positive' : 'negative'}`}>
                                    {product.trend >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                    {Math.abs(product.trend)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Category Distribution */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0 }}
                    className="chart-card"
                >
                    <div className="chart-header">
                        <h3><FaChartBar /> Kategori DaÄŸÄ±lÄ±mÄ±</h3>
                    </div>
                    <div className="category-bars">
                        {categoryData.map((category, index) => (
                            <div key={index} className="category-row">
                                <div className="category-info">
                                    <span className="category-name">{category.name}</span>
                                    <span className="category-percent">{category.value}%</span>
                                </div>
                                <div className="category-bar-bg">
                                    <div
                                        className="category-bar-fill"
                                        style={{
                                            width: `${category.value}%`,
                                            background: category.color
                                        }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Insights Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="insights-section"
            >
                <h3><FaStar /> Ã–nemli Ä°Ã§gÃ¶rÃ¼ler</h3>
                <div className="insights-grid">
                    <div className="insight-card success">
                        <FaArrowUp />
                        <div>
                            <strong>GÃ¼Ã§lÃ¼ BÃ¼yÃ¼me</strong>
                            <p>Son 30 gÃ¼nde %23.5 bÃ¼yÃ¼me kaydedildi. Trendyol'da Ã¶zellikle gÃ¼Ã§lÃ¼ performans!</p>
                        </div>
                    </div>
                    <div className="insight-card info">
                        <FaClock />
                        <div>
                            <strong>En YoÄŸun Saatler</strong>
                            <p>14:00-18:00 arasÄ± en yoÄŸun sipariÅŸ saatleri. Stok kontrolÃ¼ Ã¶nemli!</p>
                        </div>
                    </div>
                    <div className="insight-card warning">
                        <FaBox />
                        <div>
                            <strong>Stok UyarÄ±sÄ±</strong>
                            <p>En Ã§ok satan 3 Ã¼rÃ¼nde stok azalÄ±yor. Yenileme yapÄ±lmasÄ± Ã¶neriliyor.</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AnalyticsPage;
