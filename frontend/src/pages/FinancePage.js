import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaMoneyBillWave, FaShoppingCart, FaPercentage, FaChartLine,
    FaCheckCircle, FaCreditCard, FaWallet, FaSync,
    FaExclamationTriangle, FaCalendarAlt, FaFileExcel,
    FaFilePdf, FaArrowDown, FaClock, FaBox,
    FaChartBar, FaTable, FaSpinner, FaChevronDown,
    FaTrendingUp, FaTrendingDown, FaInfoCircle
} from "react-icons/fa";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { fetchFinanceSummary } from "../services/financeApi";
import { getUserMarketplaces } from "../services/marketplaceApi";

dayjs.locale("tr");

const fmt = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0));

const COLORS = ["#4ecdc4", "#44a08d", "#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#06b6d4", "#ec4899"];
const MP_LOGO = { Trendyol: "\u{1F6CD}\uFE0F", Hepsiburada: "\u{1F6D2}", N11: "\u{1F3EA}", n11: "\u{1F3EA}", Amazon: "\u{1F4E6}", "Amazon T\u00FCrkiye": "\u{1F4E6}", "Amazon Europe": "\u{1F4E6}", "Amazon USA": "\u{1F4E6}", "\u00C7i\u00E7ekSepeti": "\u{1F338}", "\u00C7i\u00E7eksepeti": "\u{1F338}" };
const getLogo = (n) => MP_LOGO[n] || "\u{1F3EC}";

const ttip = { background: "rgba(10,14,26,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" };

const FinancePage = ({ userId, marketplaceId, marketplace, marketplaces: propMarketplaces }) => {
    const isSingleMode = !!marketplaceId;
    const [marketplaces, setMarketplaces] = useState(propMarketplaces || []);
    const [selectedMp, setSelectedMp] = useState(marketplace || null);
    const [dateRange, setDateRange] = useState({ start: dayjs().subtract(30, "day").format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") });
    const [loading, setLoading] = useState(false);
    const [financeData, setFinanceData] = useState(null);
    const [activeView, setActiveView] = useState("overview");
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [expandedCard, setExpandedCard] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!propMarketplaces || propMarketplaces.length === 0) {
            getUserMarketplaces().then(d => setMarketplaces(Array.isArray(d) ? d : [])).catch(() => setMarketplaces([]));
        } else { setMarketplaces(propMarketplaces); }
    }, [propMarketplaces]);

    useEffect(() => {
        if (isSingleMode && marketplace) setSelectedMp(marketplace);
        else if (isSingleMode && marketplaceId && marketplaces.length > 0) {
            const mp = marketplaces.find(m => m._id === marketplaceId);
            if (mp) setSelectedMp(mp);
        } else if (!isSingleMode && marketplaces.length > 0 && !selectedMp) setSelectedMp(marketplaces[0]);
    }, [isSingleMode, marketplaceId, marketplace, marketplaces, selectedMp]);

    const loadFinanceData = useCallback(async () => {
        if (!selectedMp) return;
        setLoading(true); setError(null);
        try {
            const res = await fetchFinanceSummary({
                startDate: dateRange.start,
                endDate: dateRange.end,
                marketplaceId: selectedMp._id
            });
            if (res.success && res.data) { setFinanceData(res.data); setLastUpdate(new Date()); }
            else setError("Finans verileri alinamadi.");
        } catch (err) { setError(err.message || "Bir hata olustu."); }
        finally { setLoading(false); }
    }, [selectedMp, dateRange]);

    useEffect(() => { if (selectedMp) loadFinanceData(); }, [selectedMp, dateRange, loadFinanceData]);

    useEffect(() => {
        if (!autoRefresh || !selectedMp) return;
        const id = setInterval(loadFinanceData, 60000);
        return () => clearInterval(id);
    }, [autoRefresh, selectedMp, loadFinanceData]);

    const analytics = useMemo(() => {
        const empty = { totalSales: 0, totalReturns: 0, totalRevenue: 0, totalCommission: 0, totalDiscounts: 0, totalCoupons: 0, orderCount: 0, returnCount: 0, returnRate: 0, avgOrderValue: 0, avgCommissionRate: 0, totalPayments: 0, totalDeductions: 0, netProfit: 0, profitMargin: 0, grossMargin: 0, avgDailyRevenue: 0, avgDailyOrders: 0, avgDailyProfit: 0, trendData: [], daysCount: 1, txTypes: {} };
        if (!financeData || !selectedMp) return empty;
        const mpData = financeData[selectedMp.marketplaceName] || Object.values(financeData)[0];
        if (!mpData) return empty;
        if (mpData.supported === false) return { ...empty, unsupported: true, message: mpData.message || mpData.error };

        const sett = mpData.settlements || [];
        const oth = mpData.otherFinancials || [];
        const sales = sett.filter(s => /^(Sale|Sat[ıi][sş])$/i.test(s.transactionType || ""));
        const rets = sett.filter(s => /^(Return|[İI]ade)$/i.test(s.transactionType || ""));
        const discs = sett.filter(s => /^(Discount|[İI]ndirim)$/i.test(s.transactionType || ""));
        const coups = sett.filter(s => /^(Coupon|Kupon)$/i.test(s.transactionType || ""));

        const totalSales = sales.reduce((a, s) => a + Number(s.credit || 0), 0);
        const totalReturns = rets.reduce((a, s) => a + Number(s.debt || 0), 0);
        const totalRevenue = sett.reduce((a, s) => a + Number(s.sellerRevenue || 0), 0);
        const totalCommission = sett.reduce((a, s) => a + Number(s.commissionAmount || 0), 0);
        const totalDiscounts = discs.reduce((a, s) => a + Number(s.debt || 0), 0);
        const totalCoupons = coups.reduce((a, s) => a + Number(s.debt || 0), 0);
        const orderCount = sales.length;
        const returnCount = rets.length;
        const returnRate = orderCount > 0 ? (returnCount / orderCount) * 100 : 0;
        const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
        const avgCommissionRate = totalSales > 0 ? (totalCommission / totalSales) * 100 : 0;

        const payments = oth.filter(o => /^(PaymentOrder|[Öö]deme)$/i.test(o.transactionType || ""));
        const deductions = oth.filter(o => /^(DeductionInvoices|Kesinti)$/i.test(o.transactionType || ""));
        const totalPayments = payments.reduce((a, p) => a + Number(p.credit || 0), 0);
        const totalDeductions = deductions.reduce((a, d) => a + Number(d.debt || 0), 0);
        const netProfit = totalRevenue - totalCommission + totalPayments - totalDeductions;
        const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
        const grossMargin = totalSales > 0 ? ((totalSales - totalCommission) / totalSales) * 100 : 0;

        const daily = {};
        sett.forEach(s => {
            const d = dayjs(s.transactionDate).format("DD MMM");
            if (!daily[d]) daily[d] = { date: d, revenue: 0, commission: 0, orders: 0, sales: 0, returns: 0, netRevenue: 0 };
            daily[d].revenue += Number(s.sellerRevenue || 0);
            daily[d].commission += Number(s.commissionAmount || 0);
            if (/^(Sale|Sat[ıi][sş])$/i.test(s.transactionType || "")) { daily[d].orders += 1; daily[d].sales += Number(s.credit || 0); }
            if (/^(Return|[İI]ade)$/i.test(s.transactionType || "")) daily[d].returns += Number(s.debt || 0);
            daily[d].netRevenue = daily[d].sales - daily[d].returns - daily[d].commission;
        });
        const trendData = Object.values(daily).sort((a, b) => dayjs(a.date, "DD MMM").valueOf() - dayjs(b.date, "DD MMM").valueOf());
        const daysCount = trendData.length || 1;

        return {
            totalSales, totalReturns, totalRevenue, totalCommission, totalDiscounts, totalCoupons,
            orderCount, returnCount, returnRate, avgOrderValue, avgCommissionRate,
            totalPayments, totalDeductions, netProfit, profitMargin, grossMargin,
            avgDailyRevenue: totalRevenue / daysCount, avgDailyOrders: orderCount / daysCount, avgDailyProfit: netProfit / daysCount,
            trendData, daysCount,
            txTypes: { sales: { count: sales.length, amount: totalSales }, returns: { count: rets.length, amount: totalReturns }, discounts: { count: discs.length, amount: totalDiscounts }, coupons: { count: coups.length, amount: totalCoupons }, payments: { count: payments.length, amount: totalPayments }, deductions: { count: deductions.length, amount: totalDeductions } }
        };
    }, [financeData, selectedMp]);

    const currentSettlements = useMemo(() => {
        if (!financeData || !selectedMp) return [];
        const mpData = financeData[selectedMp.marketplaceName] || Object.values(financeData)[0];
        return mpData?.settlements || [];
    }, [financeData, selectedMp]);

    const kpiCards = [
        { id: "totalSales", label: "Toplam Satis", value: fmt(analytics.totalSales), sub: `${analytics.orderCount} siparis`, icon: FaShoppingCart, color: "#10b981", details: [{ l: "Gunluk Ort.", v: fmt(analytics.avgDailyRevenue) }, { l: "Siparis Basina", v: fmt(analytics.avgOrderValue) }, { l: "Toplam Gun", v: `${analytics.daysCount} gun` }, { l: "Gunluk Siparis", v: `${analytics.avgDailyOrders.toFixed(1)} adet` }] },
        { id: "netRevenue", label: "Net Gelir", value: fmt(analytics.totalRevenue), sub: "Komisyon oncesi", icon: FaMoneyBillWave, color: "#4ecdc4", details: [{ l: "Brut Satis", v: fmt(analytics.totalSales) }, { l: "Iadeler", v: fmt(analytics.totalReturns) }, { l: "Indirimler", v: fmt(analytics.totalDiscounts) }, { l: "Kuponlar", v: fmt(analytics.totalCoupons) }] },
        { id: "commission", label: "Toplam Komisyon", value: fmt(analytics.totalCommission), sub: `Ort. %${analytics.avgCommissionRate.toFixed(1)}`, icon: FaPercentage, color: "#f59e0b", details: [{ l: "Komisyon Orani", v: `%${analytics.avgCommissionRate.toFixed(2)}` }, { l: "Brut Marj", v: `%${analytics.grossMargin.toFixed(2)}` }, { l: "Satistan Kesinti", v: fmt(analytics.totalCommission) }, { l: "Gunluk Ort.", v: fmt(analytics.totalCommission / analytics.daysCount) }] },
        { id: "netProfit", label: "Net Kar", value: fmt(analytics.netProfit), sub: "Tum kesintiler sonrasi", icon: FaWallet, color: analytics.netProfit >= 0 ? "#8b5cf6" : "#ef4444", details: [{ l: "Kar Marji", v: `%${analytics.profitMargin.toFixed(2)}` }, { l: "Gunluk Ort. Kar", v: fmt(analytics.avgDailyProfit) }, { l: "Toplam Gelir", v: fmt(analytics.totalRevenue) }, { l: "Toplam Gider", v: fmt(analytics.totalCommission + analytics.totalDeductions) }] },
        { id: "returnRate", label: "Iade Orani", value: `%${analytics.returnRate.toFixed(1)}`, sub: `${analytics.returnCount} iade`, icon: FaArrowDown, color: analytics.returnRate > 10 ? "#ef4444" : "#22c55e", details: [{ l: "Toplam Iade", v: `${analytics.returnCount} adet` }, { l: "Iade Tutari", v: fmt(analytics.totalReturns) }, { l: "Basarili Siparis", v: `${analytics.orderCount - analytics.returnCount} adet` }, { l: "Iade/Satis", v: `%${analytics.returnRate.toFixed(2)}` }] },
        { id: "avgBasket", label: "Ortalama Sepet", value: fmt(analytics.avgOrderValue), sub: "Siparis basina", icon: FaBox, color: "#06b6d4", details: [{ l: "Toplam Siparis", v: `${analytics.orderCount} adet` }, { l: "Toplam Tutar", v: fmt(analytics.totalSales) }, { l: "Gunluk Ort. Siparis", v: `${analytics.avgDailyOrders.toFixed(1)} adet` }, { l: "Gunluk Ort. Ciro", v: fmt(analytics.totalSales / analytics.daysCount) }] },
        { id: "payments", label: "Odeme Alinan", value: fmt(analytics.totalPayments), sub: "Hesaba gecen", icon: FaCheckCircle, color: "#22c55e", details: [{ l: "Odeme Sayisi", v: `${analytics.txTypes.payments?.count || 0} adet` }, { l: "Ort. Odeme", v: fmt(analytics.totalPayments / Math.max(analytics.txTypes.payments?.count || 1, 1)) }, { l: "Bekleyen Gelir", v: fmt(analytics.totalRevenue - analytics.totalPayments) }, { l: "Odeme Orani", v: `%${((analytics.totalPayments / Math.max(analytics.totalRevenue, 1)) * 100).toFixed(1)}` }] },
        { id: "deductions", label: "Kesintiler", value: fmt(analytics.totalDeductions), sub: "Kargo, platform vb.", icon: FaCreditCard, color: "#ef4444", details: [{ l: "Kesinti Sayisi", v: `${analytics.txTypes.deductions?.count || 0} adet` }, { l: "Ort. Kesinti", v: fmt(analytics.totalDeductions / Math.max(analytics.txTypes.deductions?.count || 1, 1)) }, { l: "Gelire Orani", v: `%${((analytics.totalDeductions / Math.max(analytics.totalRevenue, 1)) * 100).toFixed(2)}` }, { l: "Gunluk Ort.", v: fmt(analytics.totalDeductions / analytics.daysCount) }] }
    ];

    const exportToExcel = () => {
        if (currentSettlements.length === 0) return alert("Disa aktarilacak veri yok!");
        const h = ["Tarih", "Siparis No", "Barkod", "Islem Tipi", "Alacak", "Borc", "Komisyon", "Net Gelir"];
        const rows = currentSettlements.map(i => [dayjs(i.transactionDate).format("DD/MM/YYYY"), i.orderNumber || "-", i.barcode || "-", i.transactionType, i.credit > 0 ? i.credit.toFixed(2) : "-", i.debt > 0 ? i.debt.toFixed(2) : "-", (i.commissionAmount || 0).toFixed(2), (i.sellerRevenue || 0).toFixed(2)]);
        let csv = "data:text/csv;charset=utf-8,\uFEFF" + h.join(",") + "\n";
        rows.forEach(r => { csv += r.join(",") + "\n"; });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute("download", `finans_raporu_${selectedMp?.marketplaceName}_${dayjs().format("YYYY-MM-DD")}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const exportToPDF = () => { if (currentSettlements.length === 0) return alert("Disa aktarilacak veri yok!"); window.print(); };

    // --- Styles ---
    const cardBg = "linear-gradient(135deg, rgba(26,31,53,0.6) 0%, rgba(15,20,25,0.6) 100%)";
    const headerBg = "linear-gradient(135deg, #1a1f35 0%, #0a0e1a 100%)";

    const Btn = ({ onClick, disabled, bg, children, style: s }) => (
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClick} disabled={disabled}
            style={{ background: disabled ? bg + "80" : bg, border: "none", padding: "0.6rem 1.25rem", borderRadius: "8px", color: "#fff", fontWeight: "600", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", ...s }}>
            {children}
        </motion.button>
    );

    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#0f1419", color: "#fff" }}>
            {/* Header */}
            <div style={{ background: headerBg, borderBottom: "1px solid rgba(78,205,196,0.2)", padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, background: "linear-gradient(135deg,#4ecdc4,#44a08d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <FaMoneyBillWave /> {isSingleMode && selectedMp ? `${selectedMp.name || selectedMp.marketplaceName} Finans Yonetimi` : "Finans Yonetimi"}
                    </h1>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
                            {selectedMp ? `${getLogo(selectedMp.marketplaceName)} ${selectedMp.marketplaceName} - Detayli finansal analiz` : "Pazaryeri secin"}
                        </p>
                        {lastUpdate && <span style={{ color: "#64748b", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}><FaClock /> Son: {dayjs(lastUpdate).format("HH:mm:ss")}</span>}
                    </div>
                </div>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    {selectedMp && (
                        <>
                            <Btn onClick={() => setAutoRefresh(!autoRefresh)} bg={autoRefresh ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)"} style={{ border: `1px solid ${autoRefresh ? "#22c55e" : "rgba(255,255,255,0.1)"}`, color: autoRefresh ? "#22c55e" : "#94a3b8", fontSize: "0.75rem" }}>
                                <FaClock /> Oto Yenileme {autoRefresh ? "Acik" : "Kapali"}
                            </Btn>
                            <div style={{ background: "rgba(255,255,255,0.05)", padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaCalendarAlt style={{ color: "#4ecdc4", fontSize: "0.875rem" }} />
                                <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} style={{ background: "transparent", border: "none", color: "#fff", outline: "none", fontSize: "0.875rem", width: "130px" }} />
                                <span style={{ color: "#64748b" }}>-</span>
                                <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} style={{ background: "transparent", border: "none", color: "#fff", outline: "none", fontSize: "0.875rem", width: "130px" }} />
                            </div>
                            <Btn onClick={loadFinanceData} disabled={loading} bg={loading ? "rgba(78,205,196,0.3)" : "linear-gradient(135deg,#4ecdc4,#44a08d)"}>
                                {loading ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Yukleniyor...</> : <><FaSync /> Yenile</>}
                            </Btn>
                        </>
                    )}
                </div>
            </div>

            {/* Marketplace Selector — genel modda pazaryeri secimi */}
            {!isSingleMode && marketplaces.length > 1 && (
                <div style={{ background: "rgba(78,205,196,0.05)", borderBottom: "1px solid rgba(78,205,196,0.15)", padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600 }}>Pazaryeri:</span>
                    {marketplaces.map(mp => (
                        <motion.button key={mp._id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedMp(mp)}
                            style={{
                                background: selectedMp?._id === mp._id ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.05)",
                                border: selectedMp?._id === mp._id ? "1px solid #4ecdc4" : "1px solid rgba(255,255,255,0.1)",
                                padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer",
                                color: selectedMp?._id === mp._id ? "#4ecdc4" : "#94a3b8",
                                fontWeight: 600, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem",
                                transition: "all 0.2s ease"
                            }}>
                            <span>{getLogo(mp.marketplaceName)}</span>
                            <span>{mp.name || mp.marketplaceName}</span>
                        </motion.button>
                    ))}
                </div>
            )}

            {/* Single Mode Indicator */}
            {isSingleMode && selectedMp && (
                <div style={{ background: "rgba(78,205,196,0.1)", borderBottom: "1px solid rgba(78,205,196,0.2)", padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>{getLogo(selectedMp.marketplaceName)}</span>
                    <span style={{ color: "#4ecdc4", fontWeight: 600, fontSize: "0.875rem" }}>{selectedMp.marketplaceName} Finans Detaylari</span>
                    <span style={{ color: "#64748b", fontSize: "0.75rem", marginLeft: "auto" }}>Seller ID: {selectedMp.credentials?.supplierId || selectedMp.credentials?.sellerId || "N/A"}</span>
                </div>
            )}

            {/* No Marketplace */}
            {marketplaces.length === 0 && (
                <div style={{ padding: "2rem" }}>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "3rem", textAlign: "center", maxWidth: "600px", margin: "4rem auto" }}>
                        <FaExclamationTriangle style={{ fontSize: "4rem", color: "#ef4444", marginBottom: "1.5rem" }} />
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#fff" }}>Pazaryeri Entegrasyonu Bulunamadi</h3>
                        <p style={{ color: "#94a3b8", fontSize: "1rem" }}>Finans verilerini goruntulemek icin once bir pazaryeri entegrasyonu eklemelisiniz.</p>
                    </motion.div>
                </div>
            )}

            {/* View Tabs */}
            {selectedMp && (
                <div style={{ background: "#0f1419", padding: "1rem 2rem 0 2rem" }}>
                    <div style={{ display: "flex", gap: "0.25rem", borderBottom: "2px solid rgba(255,255,255,0.05)" }}>
                        {[{ id: "overview", label: "Genel Bakis", icon: FaChartLine }, { id: "charts", label: "Grafikler", icon: FaChartBar }, { id: "transactions", label: "Islemler", icon: FaTable }].map(v => (
                            <motion.button key={v.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveView(v.id)}
                                style={{ background: activeView === v.id ? "rgba(78,205,196,0.15)" : "transparent", border: "none", borderBottom: activeView === v.id ? "2px solid #4ecdc4" : "2px solid transparent", padding: "0.75rem 1.5rem", color: activeView === v.id ? "#4ecdc4" : "#94a3b8", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", transition: "all 0.2s ease", marginBottom: "-2px" }}>
                                <v.icon /> {v.label}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div style={{ padding: "2rem", background: "#0f1419" }}>
                <AnimatePresence mode="wait">
                    {/* Error */}
                    {error && (
                        <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "2rem", textAlign: "center", marginBottom: "2rem" }}>
                            <FaExclamationTriangle style={{ fontSize: "3rem", color: "#ef4444", marginBottom: "1rem" }} />
                            <h3 style={{ color: "#fff", marginBottom: "0.5rem" }}>Hata Olustu</h3>
                            <p style={{ color: "#94a3b8" }}>{error}</p>
                        </motion.div>
                    )}

                    {/* Unsupported */}
                    {analytics.unsupported && (
                        <motion.div key="unsupported" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
                            <FaInfoCircle style={{ fontSize: "3rem", color: "#f59e0b", marginBottom: "1rem" }} />
                            <h3 style={{ color: "#fff", marginBottom: "0.5rem" }}>Finans API Henuz Desteklenmiyor</h3>
                            <p style={{ color: "#94a3b8" }}>{analytics.message || `${selectedMp?.marketplaceName} icin finans API entegrasyonu gelistirme asamasinda.`}</p>
                        </motion.div>
                    )}

                    {/* No MP Selected */}
                    {!selectedMp && marketplaces.length > 0 && (
                        <motion.div key="no-mp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ background: "#1a1f35", borderRadius: "12px", padding: "3rem", textAlign: "center" }}>
                            <FaExclamationTriangle style={{ fontSize: "3rem", color: "#f59e0b", marginBottom: "1rem" }} />
                            <h3 style={{ color: "#f8fafc", marginBottom: "0.5rem", fontSize: "1.5rem" }}>Pazaryeri Secilmedi</h3>
                            <p style={{ color: "#94a3b8" }}>Lutfen soldaki menuden bir pazaryeri secin.</p>
                        </motion.div>
                    )}

                    {/* Overview */}
                    {activeView === "overview" && selectedMp && !analytics.unsupported && (
                        <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
                                {kpiCards.map((kpi, i) => (
                                    <motion.div key={kpi.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3, boxShadow: `0 10px 30px ${kpi.color}40` }}
                                        style={{ background: cardBg, border: `1px solid ${kpi.color}30`, padding: "1.25rem", borderRadius: "12px", position: "relative", overflow: "hidden", cursor: "pointer" }}
                                        onClick={() => setExpandedCard(expandedCard === kpi.id ? null : kpi.id)}>
                                        <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", background: `radial-gradient(circle, ${kpi.color}20 0%, transparent 70%)`, pointerEvents: "none" }} />
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                            <div style={{ background: `${kpi.color}20`, padding: "0.6rem", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <kpi.icon style={{ fontSize: "1.25rem", color: kpi.color }} />
                                            </div>
                                            <motion.div animate={{ rotate: expandedCard === kpi.id ? 180 : 0 }} style={{ color: kpi.color, fontSize: "0.875rem" }}><FaChevronDown /></motion.div>
                                        </div>
                                        <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "0.5rem" }}>{kpi.label}</p>
                                        <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem" }}>{kpi.value}</h3>
                                        <p style={{ color: "#64748b", fontSize: "0.7rem" }}>{kpi.sub}</p>
                                        <AnimatePresence>
                                            {expandedCard === kpi.id && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${kpi.color}30` }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                                        {kpi.details.map((d, idx) => (
                                                            <div key={idx} style={{ background: "rgba(255,255,255,0.03)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                                                <p style={{ color: "#94a3b8", fontSize: "0.7rem", marginBottom: "0.25rem" }}>{d.l}</p>
                                                                <p style={{ color: kpi.color, fontSize: "0.875rem", fontWeight: 600 }}>{d.v}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Charts */}
                    {activeView === "charts" && selectedMp && !analytics.unsupported && (
                        <motion.div key="charts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                                {/* Revenue Trend */}
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: cardBg, border: "1px solid rgba(78,205,196,0.2)", padding: "1.5rem", borderRadius: "12px" }}>
                                    <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>📈 Gelir Trendi</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={analytics.trendData}>
                                            <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.8} /><stop offset="95%" stopColor="#4ecdc4" stopOpacity={0} /></linearGradient></defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                            <YAxis stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                            <Tooltip contentStyle={ttip} />
                                            <Area type="monotone" dataKey="revenue" stroke="#4ecdc4" fillOpacity={1} fill="url(#colorRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </motion.div>
                                {/* Orders */}
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} style={{ background: cardBg, border: "1px solid rgba(68,160,141,0.2)", padding: "1.5rem", borderRadius: "12px" }}>
                                    <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>📦 Siparis Sayisi</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={analytics.trendData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                            <YAxis stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                            <Tooltip contentStyle={ttip} />
                                            <Bar dataKey="orders" fill="#44a08d" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </motion.div>
                                {/* Commission */}
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} style={{ background: cardBg, border: "1px solid rgba(245,158,11,0.2)", padding: "1.5rem", borderRadius: "12px" }}>
                                    <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>💰 Komisyon Analizi</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={analytics.trendData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                            <YAxis stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                            <Tooltip contentStyle={ttip} />
                                            <Line type="monotone" dataKey="commission" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </motion.div>
                                {/* Pie */}
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} style={{ background: cardBg, border: "1px solid rgba(139,92,246,0.2)", padding: "1.5rem", borderRadius: "12px" }}>
                                    <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>🎯 Islem Dagilimi</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={[{ name: "Satis", value: analytics.orderCount }, { name: "Iade", value: analytics.returnCount }, { name: "Diger", value: currentSettlements.filter(s => !/^(Sale|Sat[\u0131i][s\u015f]|Return|[\u0130I]ade)$/i.test(s.transactionType || "")).length }]} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                                                {COLORS.map((c, i) => <Cell key={`c-${i}`} fill={c} />)}
                                            </Pie>
                                            <Tooltip contentStyle={ttip} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}

                    {/* Transactions */}
                    {activeView === "transactions" && selectedMp && !analytics.unsupported && (
                        <motion.div key="transactions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: cardBg, border: "1px solid rgba(78,205,196,0.2)", padding: "1.5rem", borderRadius: "12px", overflowX: "auto" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                    <h3 style={{ fontSize: "1.25rem", color: "#fff" }}>📋 Tum Islemler ({currentSettlements.length})</h3>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <Btn onClick={exportToExcel} disabled={currentSettlements.length === 0} bg="linear-gradient(135deg,#22c55e,#16a34a)" style={{ padding: "0.5rem 1rem" }}><FaFileExcel /> Excel</Btn>
                                        <Btn onClick={exportToPDF} disabled={currentSettlements.length === 0} bg="linear-gradient(135deg,#ef4444,#dc2626)" style={{ padding: "0.5rem 1rem" }}><FaFilePdf /> PDF</Btn>
                                    </div>
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                                            {["Tarih", "Siparis No", "Barkod", "Islem Tipi"].map(h => <th key={h} style={{ padding: "1rem", textAlign: "left", color: "#94a3b8", fontWeight: 600, fontSize: "0.875rem" }}>{h}</th>)}
                                            {["Alacak", "Borc", "Komisyon", "Net Gelir"].map(h => <th key={h} style={{ padding: "1rem", textAlign: "right", color: "#94a3b8", fontWeight: 600, fontSize: "0.875rem" }}>{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentSettlements.map((item, i) => (
                                            <motion.tr key={item.id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }} whileHover={{ background: "rgba(255,255,255,0.05)" }}>
                                                <td style={{ padding: "1rem", color: "#e2e8f0", fontSize: "0.875rem" }}>{dayjs(item.transactionDate).format("DD MMM YYYY")}</td>
                                                <td style={{ padding: "1rem", color: "#e2e8f0", fontSize: "0.875rem" }}>{item.orderNumber || "-"}</td>
                                                <td style={{ padding: "1rem", color: "#94a3b8", fontSize: "0.875rem" }}>{item.barcode || "-"}</td>
                                                <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                                                    <span style={{ background: /^(Sale|Sat[\u0131i][s\u015f])$/i.test(item.transactionType || "") ? "rgba(34,197,94,0.2)" : /^(Return|[\u0130I]ade)$/i.test(item.transactionType || "") ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)", color: /^(Sale|Sat[\u0131i][s\u015f])$/i.test(item.transactionType || "") ? "#22c55e" : /^(Return|[\u0130I]ade)$/i.test(item.transactionType || "") ? "#ef4444" : "#f59e0b", padding: "0.25rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600 }}>{item.transactionType}</span>
                                                </td>
                                                <td style={{ padding: "1rem", textAlign: "right", color: "#22c55e", fontWeight: 600, fontSize: "0.875rem" }}>{item.credit > 0 ? fmt(item.credit) : "-"}</td>
                                                <td style={{ padding: "1rem", textAlign: "right", color: "#ef4444", fontWeight: 600, fontSize: "0.875rem" }}>{item.debt > 0 ? fmt(item.debt) : "-"}</td>
                                                <td style={{ padding: "1rem", textAlign: "right", color: "#f59e0b", fontSize: "0.875rem" }}>{fmt(item.commissionAmount || 0)}</td>
                                                <td style={{ padding: "1rem", textAlign: "right", color: "#4ecdc4", fontWeight: 600, fontSize: "0.875rem" }}>{fmt(item.sellerRevenue || 0)}</td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                                {currentSettlements.length === 0 && !loading && (
                                    <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                                        <FaInfoCircle style={{ fontSize: "2rem", marginBottom: "1rem" }} />
                                        <p>Secilen tarih araliginda islem bulunamadi.</p>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default FinancePage;