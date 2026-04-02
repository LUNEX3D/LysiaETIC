import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getUserMarketplaces, fetchDashboardData } from "../services/marketplaceApi";
import { getProductManagementDashboard } from "../services/productManagementApi";
import { useApp } from "../context/AppContext";
import MarketplaceIntegration from "../pages/MarketplaceIntegration";
import OrdersPage from "../pages/OrdersPage";
import InventoryPage from "../pages/StockManagement";
import FinancePage from "../pages/FinancePage";
import CargoTrackingPage from "../pages/CargoTrackingPage";
import UserProfilePage from "../pages/UserProfilePage";
import AdvancedAnalytics from "../pages/AdvancedAnalytics";
import AICommandCenter from "../pages/AICommandCenter";
import ProductManagementCenter from "../pages/ProductManagementCenter";
import CategoryMappingPage from "../pages/CategoryMappingPage";
import SettingsPage from "../pages/SettingsPage";
import AdminPanelPage from "../pages/AdminPanelPage";
import BillingPage from "../pages/BillingPage";
import SubscriptionPage from "../pages/SubscriptionPage";
import {
    FaBars, FaTimes, FaClipboardList, FaCog,
    FaChartLine, FaBoxOpen, FaMoneyBillWave,
    FaTruck, FaUsers, FaFileInvoice, FaPlug,
    FaChevronDown, FaBox, FaCrown,
    FaBrain, FaChartBar, FaBell,
    FaCubes, FaSitemap, FaSignOutAlt, FaUserShield
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import "../styles/userDashboard.css";

/* ═══════════════════════════════════════════════════════════
   RENK PALETİ
   ═══════════════════════════════════════════════════════════ */
const C = {
    bg:       "#0f1419",
    card:     "rgba(26, 31, 53, 0.85)",
    border:   "rgba(78, 205, 196, 0.18)",
    accent:   "#4ecdc4",
    green:    "#22c55e",
    red:      "#ef4444",
    yellow:   "#f59e0b",
    purple:   "#8b5cf6",
    blue:     "#06b6d4",
    pink:     "#ec4899",
    text:     "#e2e8f0",
    muted:    "#94a3b8",
    dim:      "#64748b",
    glass:    "rgba(255,255,255,0.03)",
    glassBr:  "rgba(255,255,255,0.06)",
};

/* ═══════════════════════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
   ═══════════════════════════════════════════════════════════ */
const fmtCurrency = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0));
    } catch { return `${Number(v || 0).toFixed(0)} ₺`; }
};
const fmtNum = (v) => new Intl.NumberFormat("tr-TR").format(Number(v || 0));

const statusLabel = (s) => s === "active" ? "Aktif" : s === "slow" ? "Yavaş" : s === "error" ? "Hata" : "Bilinmiyor";
const statusColor = (s) => s === "active" ? C.green : s === "slow" ? C.yellow : C.red;

const getGreetingKey = () => {
    const h = new Date().getHours();
    if (h < 6) return "dashboard.greeting.night";
    if (h < 12) return "dashboard.greeting.morning";
    if (h < 18) return "dashboard.greeting.afternoon";
    return "dashboard.greeting.evening";
};

/* ═══════════════════════════════════════════════════════════
   BİLDİRİM SESİ (Web Audio API — dosya gerektirmez)
   ═══════════════════════════════════════════════════════════ */
const playNotificationSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // İlk nota
        const o1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        o1.type = "sine";
        o1.frequency.setValueAtTime(880, ctx.currentTime);       // A5
        o1.frequency.setValueAtTime(1108, ctx.currentTime + 0.1); // C#6
        g1.gain.setValueAtTime(0.15, ctx.currentTime);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o1.connect(g1);
        g1.connect(ctx.destination);
        o1.start(ctx.currentTime);
        o1.stop(ctx.currentTime + 0.35);
        // İkinci nota
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = "sine";
        o2.frequency.setValueAtTime(1318, ctx.currentTime + 0.12); // E6
        g2.gain.setValueAtTime(0, ctx.currentTime);
        g2.gain.setValueAtTime(0.18, ctx.currentTime + 0.12);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.start(ctx.currentTime + 0.12);
        o2.stop(ctx.currentTime + 0.5);
        // Cleanup
        setTimeout(() => ctx.close(), 600);
    } catch { /* ses çalamazsa sessiz devam */ }
};

/* ═══════════════════════════════════════════════════════════
   KÜÇÜK BİLEŞENLER
   ═══════════════════════════════════════════════════════════ */
const GlassCard = ({ children, style, ...rest }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
            background: `linear-gradient(135deg, ${C.card} 0%, rgba(15,20,25,0.85) 100%)`,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: "1.5rem",
            ...style,
        }}
        {...rest}
    >
        {children}
    </motion.div>
);

const KpiCard = ({ icon, label, value, sub, color, delay = 0, onClick }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.35 }}
        whileHover={{ y: -4, boxShadow: `0 12px 32px ${color}30` }}
        onClick={onClick}
        style={{
            background: `linear-gradient(135deg, ${C.card} 0%, rgba(15,20,25,0.9) 100%)`,
            border: `1px solid ${color}30`,
            borderRadius: 14,
            padding: "1.25rem 1.5rem",
            cursor: onClick ? "pointer" : "default",
            position: "relative",
            overflow: "hidden",
        }}
    >
        <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", position: "relative", zIndex: 1 }}>
            <div style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, padding: "0.6rem", borderRadius: 10, fontSize: "1.3rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${color}40` }}>
                {icon}
            </div>
            <span style={{ color: C.muted, fontSize: "0.8rem", fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.1 }}>{value}</h3>
            {sub && <p style={{ color: C.dim, fontSize: "0.75rem", margin: "0.35rem 0 0", fontWeight: 500 }}>{sub}</p>}
        </div>
    </motion.div>
);

const Pill = ({ color, children }) => (
    <span style={{
        background: `${color}15`,
        border: `1px solid ${color}35`,
        padding: "0.3rem 0.7rem",
        borderRadius: 10,
        color,
        fontSize: "0.75rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
    }}>
        {children}
    </span>
);

const SectionTitle = ({ icon, title, badge, action }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.3rem" }}>{icon}</span> {title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {badge && <Pill color={C.accent}>{badge}</Pill>}
            {action}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════ */
const UserDashboard = () => {
    const { theme: CT, t, language, resolvedTheme } = useApp();
    const [menuOpen, setMenuOpen] = useState(true);
    const [activePanel, setActivePanel] = useState("dashboard");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const userRole = localStorage.getItem("userRole") || "user";
    const userName = localStorage.getItem("userName") || "";

    const [marketplaces, setMarketplaces] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardError, setDashboardError] = useState("");
    const [pmDashboard, setPmDashboard] = useState(null);

    // Tek bir state ile tüm submenu'leri yönet — aynı anda sadece 1 submenu açık
    const [openSubmenu, setOpenSubmenu] = useState(null);

    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
    const [selectedOrderTab, setSelectedOrderTab] = useState("all");

    // ── Bildirim Sistemi ──
    const [notifications, setNotifications] = useState([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [notifSoundEnabled, setNotifSoundEnabled] = useState(true);
    const prevOrderCountRef = useRef(null);
    const prevOrderIdsRef = useRef(new Set());

    const userId = localStorage.getItem("userId");

    // ── Responsive ──
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile && menuOpen) setMenuOpen(false);
            if (!mobile && !menuOpen) setMenuOpen(true);
        };
        window.addEventListener("resize", handleResize);
        if (window.innerWidth < 768) setMenuOpen(false);
        return () => window.removeEventListener("resize", handleResize);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePanelChange = useCallback((panelId) => {
        setActivePanel(panelId);
        if (isMobile) setMenuOpen(false);
    }, [isMobile]);

    // ── Pazaryerleri ──
    useEffect(() => {
        if (!userId) return;
        (async () => {
            try {
                const data = await getUserMarketplaces(userId);
                setMarketplaces(data.map(m => ({ ...m, name: m.marketplaceName })));
            } catch (e) { console.error("Pazar yerleri yüklenirken hata:", e); }
        })();
    }, [userId]);

    // ── Bildirim oluştur (yeni sipariş geldiğinde) ──
    const checkForNewOrders = useCallback((data) => {
        if (!data?.marketplaceStatus) return;

        // Tüm siparişleri topla
        const currentOrders = [];
        Object.entries(data.marketplaceStatus).forEach(([mp, mpData]) => {
            if (mpData.orderDetails && Array.isArray(mpData.orderDetails)) {
                mpData.orderDetails.forEach(o => currentOrders.push({ ...o, marketplace: mp }));
            }
        });

        const currentIds = new Set(currentOrders.map(o => o.orderNumber).filter(Boolean));
        const currentCount = currentOrders.length;

        // İlk yükleme — sadece referansı kaydet
        if (prevOrderCountRef.current === null) {
            prevOrderCountRef.current = currentCount;
            prevOrderIdsRef.current = currentIds;
            return;
        }

        // Yeni siparişleri bul
        const newOrders = currentOrders.filter(o => o.orderNumber && !prevOrderIdsRef.current.has(o.orderNumber));

        if (newOrders.length > 0) {
            const newNotifs = newOrders.map(o => ({
                id: `${o.orderNumber}-${Date.now()}`,
                type: "new_order",
                title: "Yeni Sipariş!",
                message: `${o.marketplace} — #${o.orderNumber} — ${fmtCurrency(o.totalPrice || 0)}`,
                marketplace: o.marketplace,
                amount: o.totalPrice || 0,
                time: new Date(),
                read: false,
            }));

            setNotifications(prev => [...newNotifs, ...prev].slice(0, 50));

            // Ses çal
            if (notifSoundEnabled) {
                playNotificationSound();
            }
        }

        prevOrderCountRef.current = currentCount;
        prevOrderIdsRef.current = currentIds;
    }, [notifSoundEnabled]);

    // ── Dashboard Verileri (gerçek) ──
    useEffect(() => {
        if (!userId) return;
        let intervalId;
        const load = async () => {
            setDashboardLoading(true);
            setDashboardError("");
            try {
                const data = await fetchDashboardData(userId);
                setDashboardData(data);
                checkForNewOrders(data);
            } catch (e) {
                console.error("Dashboard verileri yüklenirken hata:", e);
                setDashboardError("Veriler yüklenemedi.");
            } finally { setDashboardLoading(false); }
        };
        load();
        intervalId = setInterval(load, 30000);
        return () => clearInterval(intervalId);
    }, [userId, checkForNewOrders]);

    // ── Ürün Yönetimi Dashboard (gerçek) ──
    useEffect(() => {
        if (!userId) return;
        (async () => {
            try {
                const res = await getProductManagementDashboard();
                setPmDashboard(res?.dashboard || null);
            } catch { /* sessiz */ }
        })();
    }, [userId]);

    // ── Particles ──
    const particlesInit = async engine => { await loadSlim(engine); };

    // ── Bildirim yardımcıları ──
    const unreadCount = notifications.filter(n => !n.read).length;
    const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const dismissNotif = (id) => setNotifications(prev => prev.filter(n => n.id !== id));

    /* ═══════════════════════════════════════════════════════
       GERÇEK VERİ HESAPLAMALARI
       ═══════════════════════════════════════════════════════ */
    const summary = dashboardData?.summary || {};
    const diagnostics = dashboardData?.diagnostics || {};
    const marketplaceStatus = useMemo(() => dashboardData?.marketplaceStatus || {}, [dashboardData]);
    const trends = dashboardData?.trends || { labels: [], orderCounts: [], revenueTotals: [] };
    const alerts = dashboardData?.alerts || [];
    const logs = dashboardData?.logs || [];
    const todayBreakdown = dashboardData?.todayBreakdown || [];

    const marketplaceEntries = useMemo(() => {
        const entries = Object.entries(marketplaceStatus);
        if (entries.length > 0) return entries;
        return marketplaces.map(mp => [mp.marketplaceName, {
            status: mp.credentials && Object.keys(mp.credentials || {}).length > 0 ? "active" : "down",
            orders: 0, revenue: 0, pendingSync: 0, errors: 0, stockMismatch: 0,
            updatedAt: mp.updatedAt || mp.createdAt,
        }]);
    }, [marketplaceStatus, marketplaces]);

    const allOrders = useMemo(() => {
        if (!dashboardData?.marketplaceStatus) return { all: [], byStatus: {}, total: 0, statusCounts: { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 } };
        const orders = [];
        const sc = { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 };

        Object.entries(dashboardData.marketplaceStatus).forEach(([marketplace, data]) => {
            if (data.orderDetails && Array.isArray(data.orderDetails)) {
                data.orderDetails.forEach(o => orders.push({ ...o, marketplace }));
            }
            if (data.statusGroups) {
                Object.keys(sc).forEach(k => { sc[k] += (data.statusGroups[k] || 0); });
            }
        });

        const classify = (s) => {
            const l = String(s || "").toLowerCase();
            if (l.includes("created") || l.includes("yeni") || l.includes("new")) return "new";
            if (l.includes("processing") || l.includes("işlem") || l.includes("hazırlan") || l.includes("picking")) return "processing";
            if (l.includes("shipping") || l.includes("shipped") || l.includes("kargo") || l.includes("transit")) return "shipping";
            if (l.includes("delivered") || l.includes("teslim")) return "delivered";
            if (l.includes("cancel") || l.includes("iptal")) return "cancelled";
            if (l.includes("return") || l.includes("iade") || l.includes("refund")) return "returned";
            return "processing";
        };

        const byStatus = { all: orders };
        ["new", "processing", "shipping", "delivered", "cancelled", "returned"].forEach(k => {
            byStatus[k] = orders.filter(o => classify(o.status) === k);
        });

        return { all: orders, byStatus, total: orders.length, statusCounts: sc };
    }, [dashboardData]);

    const trendOrderTotal = trends.orderCounts.reduce((s, v) => s + v, 0);
    const trendRevenueTotal = trends.revenueTotals.reduce((s, v) => s + v, 0);
    const orderTrendMax = Math.max(...trends.orderCounts, 1);
    const revenueTrendMax = Math.max(...trends.revenueTotals, 1);
    const avgOrderValue = allOrders.total > 0 ? (summary.todayRevenue || 0) / allOrders.total : 0;

    const pmProducts = pmDashboard?.products || {};
    const pmMarketplaces = pmDashboard?.marketplaces || [];

    // Son 5 sipariş (canlı akış için)
    const recentOrdersFeed = useMemo(() => {
        return allOrders.all
            .filter(o => o.orderDate)
            .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
            .slice(0, 6);
    }, [allOrders]);

    /* ═══════════════════════════════════════════════════════
       RENDER: ANA SAYFA
       ═══════════════════════════════════════════════════════ */
    const renderDashboard = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const dateStr = now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        return (
            <div style={{ width: "100%", minHeight: "100vh", background: C.bg, padding: 0, margin: 0 }}>

                {/* ── HEADER ── */}
                <div style={{
                    background: "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)",
                    borderBottom: `1px solid ${C.border}`,
                    position: "sticky", top: 0, zIndex: 100,
                    backdropFilter: "blur(12px)",
                    padding: "1.25rem clamp(1rem, 4vw, 3rem)",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                        {/* Sol: Karşılama */}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                                <h1 style={{
                                    background: "linear-gradient(135deg, #4ecdc4 0%, #8b5cf6 100%)",
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 800, margin: 0,
                                }}>
                                    {t(getGreetingKey())} 👋
                                </h1>
                                {dashboardLoading && (
                                    <div style={{ width: 16, height: 16, border: `2px solid ${C.accent}30`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                )}
                            </div>
                            <p style={{ color: C.dim, fontSize: "0.78rem", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <span>{dateStr}</span>
                                <span style={{ color: C.accent, fontWeight: 700, fontFamily: "monospace" }}>{timeStr}</span>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.dim, display: "inline-block" }} />
                                <span>{summary.activeMarketplaces || 0} aktif kanal</span>
                            </p>
                        </div>

                        {/* Sağ: Bildirim Zili */}
                        <div style={{ position: "relative" }}>
                            <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setShowNotifPanel(!showNotifPanel)}
                                style={{
                                    background: unreadCount > 0 ? `${C.accent}15` : C.glass,
                                    border: `1px solid ${unreadCount > 0 ? C.accent + "40" : C.glassBr}`,
                                    borderRadius: 12, padding: "0.65rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: unreadCount > 0 ? C.accent : C.muted, fontSize: "1.15rem",
                                    position: "relative",
                                }}
                            >
                                <FaBell />
                                {unreadCount > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        style={{
                                            position: "absolute", top: -4, right: -4,
                                            background: C.red, color: "#fff",
                                            fontSize: "0.6rem", fontWeight: 800,
                                            width: 18, height: 18, borderRadius: "50%",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            boxShadow: `0 2px 8px ${C.red}60`,
                                            animation: "pulse 2s infinite",
                                        }}
                                    >
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </motion.span>
                                )}
                            </motion.button>

                            {/* Bildirim Paneli */}
                            <AnimatePresence>
                                {showNotifPanel && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                            position: "absolute", top: "calc(100% + 8px)", right: 0,
                                            width: 380, maxHeight: 440,
                                            background: "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)",
                                            border: `1px solid ${C.border}`,
                                            borderRadius: 16, overflow: "hidden",
                                            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                                            zIndex: 200,
                                        }}
                                    >
                                        {/* Panel Header */}
                                        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${C.glassBr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <FaBell style={{ color: C.accent, fontSize: "0.9rem" }} />
                                                <span style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700 }}>Bildirimler</span>
                                                {unreadCount > 0 && <Pill color={C.red}>{unreadCount} yeni</Pill>}
                                            </div>
                                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                                    onClick={() => setNotifSoundEnabled(!notifSoundEnabled)}
                                                    title={notifSoundEnabled ? "Sesi kapat" : "Sesi aç"}
                                                    style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.5rem", cursor: "pointer", color: notifSoundEnabled ? C.accent : C.dim, fontSize: "0.75rem" }}>
                                                    {notifSoundEnabled ? "🔔" : "🔕"}
                                                </motion.button>
                                                {unreadCount > 0 && (
                                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                                        onClick={markAllRead}
                                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.muted, fontSize: "0.7rem", fontWeight: 600 }}>
                                                        Tümünü oku
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bildirim Listesi */}
                                        <div style={{ maxHeight: 340, overflowY: "auto", padding: "0.5rem" }}>
                                            {notifications.length > 0 ? notifications.slice(0, 20).map((n, i) => (
                                                <motion.div key={n.id}
                                                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                                                    style={{
                                                        background: n.read ? "transparent" : `${C.accent}08`,
                                                        border: `1px solid ${n.read ? "transparent" : C.accent + "15"}`,
                                                        borderRadius: 10, padding: "0.7rem 0.85rem", marginBottom: "0.3rem",
                                                        display: "flex", alignItems: "flex-start", gap: "0.6rem",
                                                        cursor: "pointer", transition: "all 0.2s",
                                                    }}
                                                    onClick={() => {
                                                        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                                        setShowNotifPanel(false);
                                                        handlePanelChange("orders");
                                                    }}
                                                    whileHover={{ background: `${C.accent}10` }}
                                                >
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                        background: n.type === "new_order" ? `linear-gradient(135deg, ${C.green}, #059669)` : `linear-gradient(135deg, ${C.accent}, #44a08d)`,
                                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                                                    }}>
                                                        {n.type === "new_order" ? "🛒" : "📋"}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
                                                            <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 700 }}>{n.title}</span>
                                                            {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />}
                                                        </div>
                                                        <p style={{ color: C.muted, fontSize: "0.73rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</p>
                                                        <span style={{ color: C.dim, fontSize: "0.65rem" }}>
                                                            {n.time ? new Date(n.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                                                        </span>
                                                    </div>
                                                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}
                                                        onClick={(e) => { e.stopPropagation(); dismissNotif(n.id); }}
                                                        style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.7rem", padding: "0.2rem", flexShrink: 0 }}>
                                                        ✕
                                                    </motion.button>
                                                </motion.div>
                                            )) : (
                                                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: C.dim }}>
                                                    <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>🔔</span>
                                                    <p style={{ fontSize: "0.85rem", margin: 0 }}>Henüz bildirim yok</p>
                                                    <p style={{ fontSize: "0.73rem", margin: "0.25rem 0 0", color: C.dim }}>Yeni sipariş geldiğinde burada görünecek</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Bildirim paneli dışına tıklayınca kapat */}
                {showNotifPanel && (
                    <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowNotifPanel(false)} />
                )}

                {dashboardError && (
                    <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, padding: "0.6rem 2rem", color: C.red, fontSize: "0.8rem" }}>
                        ⚠️ {dashboardError}
                    </div>
                )}

                {/* ── İÇERİK ── */}
                <div style={{ padding: "clamp(1rem, 3vw, 1.75rem) clamp(1rem, 4vw, 3rem)" }}>

                    {/* ── DURUM ÇUBUĞU (Compact) ── */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                        style={{
                            display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem",
                            padding: "0.75rem 1rem", borderRadius: 12,
                            background: `linear-gradient(135deg, ${C.accent}08, ${C.purple}08)`,
                            border: `1px solid ${C.accent}15`,
                        }}>
                        {[
                            { label: "Aktif Kanal", value: summary.activeMarketplaces || 0, color: C.green, icon: "🟢" },
                            { label: "Hata", value: diagnostics.errorCount || 0, color: (diagnostics.errorCount || 0) > 0 ? C.red : C.green, icon: (diagnostics.errorCount || 0) > 0 ? "🔴" : "🟢" },
                            { label: "Bekleyen Sync", value: summary.pendingSync || 0, color: (summary.pendingSync || 0) > 0 ? C.yellow : C.green, icon: "🔄" },
                            { label: "Stok Farkı", value: summary.stockMismatchCount || 0, color: (summary.stockMismatchCount || 0) > 0 ? C.yellow : C.green, icon: "📦" },
                            { label: "Son Güncelleme", value: summary.lastIntegrationUpdate ? new Date(summary.lastIntegrationUpdate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—", color: C.accent, icon: "🕐" },
                        ].map((s, i) => (
                            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.2rem 0.6rem", borderRadius: 8, background: `${s.color}08` }}>
                                <span style={{ fontSize: "0.7rem" }}>{s.icon}</span>
                                <span style={{ color: C.muted, fontSize: "0.7rem", fontWeight: 600 }}>{s.label}:</span>
                                <span style={{ color: s.color, fontSize: "0.75rem", fontWeight: 800 }}>{s.value}</span>
                            </div>
                        ))}
                    </motion.div>

                    {/* ── KPI KARTLARI ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                        <KpiCard icon="📦" label="Toplam Sipariş" value={fmtNum(allOrders.total)}
                            sub={`🆕 ${allOrders.statusCounts.new} yeni · ⚙️ ${allOrders.statusCounts.processing} işlemde · 🚚 ${allOrders.statusCounts.shipping} kargoda`}
                            color={C.accent} delay={0.05} onClick={() => setShowOrderDetailsModal(true)} />
                        <KpiCard icon="💰" label="Toplam Ciro" value={fmtCurrency(summary.todayRevenue)}
                            sub={`Ort. sepet: ${fmtCurrency(avgOrderValue)}`}
                            color={C.green} delay={0.1} />
                        <KpiCard icon="📊" label="Ürün Sayısı" value={fmtNum(summary.totalProducts || pmProducts.total || 0)}
                            sub={`✅ ${fmtNum(summary.activeProducts || pmProducts.healthy || 0)} aktif · ⏸️ ${fmtNum(summary.passiveProducts || pmProducts.outOfStock || 0)} pasif`}
                            color={C.purple} delay={0.15} />
                        <KpiCard icon="⚠️" label="Düşük Stok" value={fmtNum(pmProducts.lowStock || 0)}
                            sub={`Stok biten: ${fmtNum(pmProducts.outOfStock || 0)} ürün`}
                            color={(pmProducts.lowStock || 0) > 0 ? C.yellow : C.green} delay={0.2} />
                        <KpiCard icon="📈" label="7 Günlük Sipariş" value={fmtNum(trendOrderTotal)}
                            sub={`Toplam ciro: ${fmtCurrency(trendRevenueTotal)}`}
                            color={C.blue} delay={0.25} />
                        <KpiCard icon="✅" label="Teslim Edilen" value={fmtNum(allOrders.statusCounts.delivered)}
                            sub={`❌ ${allOrders.statusCounts.cancelled} iptal · ↩️ ${allOrders.statusCounts.returned} iade`}
                            color={C.green} delay={0.3} />
                    </div>

                    {/* ── PAZARYERI TABLOSU + CANLI SİPARİŞ AKIŞI ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

                        {/* Pazaryeri Durumu */}
                        {marketplaceEntries.length > 0 && (
                            <GlassCard>
                                <SectionTitle icon="🏪" title="Pazaryeri Durumu" badge={`${marketplaceEntries.length} Kanal`} />
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", minWidth: 500, borderCollapse: "separate", borderSpacing: "0 0.35rem" }}>
                                        <thead>
                                            <tr style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase" }}>
                                                <th style={{ textAlign: "left", padding: "0.4rem 0.8rem" }}>Kanal</th>
                                                <th style={{ textAlign: "center", padding: "0.4rem" }}>Durum</th>
                                                <th style={{ textAlign: "center", padding: "0.4rem" }}>Sipariş</th>
                                                <th style={{ textAlign: "center", padding: "0.4rem" }}>Ciro</th>
                                                <th style={{ textAlign: "center", padding: "0.4rem" }}>Hata</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {marketplaceEntries.map(([name, mp], idx) => (
                                                <motion.tr key={name}
                                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.2 + idx * 0.04 }}
                                                    whileHover={{ backgroundColor: `${C.accent}06` }}
                                                    style={{ background: C.glass, borderRadius: 8 }}>
                                                    <td style={{ padding: "0.7rem 0.8rem", borderRadius: "8px 0 0 8px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(mp.status), boxShadow: `0 0 6px ${statusColor(mp.status)}60` }} />
                                                            <div>
                                                                <p style={{ color: "#fff", fontWeight: 600, margin: 0, fontSize: "0.82rem" }}>{name}</p>
                                                                <p style={{ color: C.dim, fontSize: "0.6rem", margin: 0 }}>
                                                                    {mp.updatedAt ? new Date(mp.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem" }}>
                                                        <Pill color={statusColor(mp.status)}>{statusLabel(mp.status)}</Pill>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem" }}>
                                                        <span style={{ color: C.accent, fontWeight: 700, fontSize: "0.9rem" }}>{mp.orders || 0}</span>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem" }}>
                                                        <span style={{ color: C.green, fontWeight: 700, fontSize: "0.82rem" }}>{fmtCurrency(mp.revenue || 0)}</span>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem", borderRadius: "0 8px 8px 0" }}>
                                                        <Pill color={(mp.errors || 0) > 0 ? C.red : C.green}>{mp.errors || 0}</Pill>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </GlassCard>
                        )}

                        {/* Canlı Sipariş Akışı */}
                        <GlassCard>
                            <SectionTitle icon="🔴" title="Son Siparişler"
                                action={
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => handlePanelChange("orders")}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>
                                        Tümü →
                                    </motion.button>
                                }
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {recentOrdersFeed.length > 0 ? recentOrdersFeed.map((o, i) => (
                                    <motion.div key={`${o.orderNumber}-${i}`}
                                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 10, padding: "0.65rem 0.8rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                            <span style={{ color: C.accent, fontSize: "0.75rem", fontWeight: 700 }}>{o.marketplace}</span>
                                            <span style={{ color: C.green, fontSize: "0.8rem", fontWeight: 800 }}>{fmtCurrency(o.totalPrice || 0)}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ color: C.dim, fontSize: "0.68rem", fontFamily: "monospace" }}>#{o.orderNumber || "—"}</span>
                                            <span style={{ color: C.dim, fontSize: "0.65rem" }}>
                                                {o.orderDate ? new Date(o.orderDate).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                                            </span>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <div style={{ textAlign: "center", padding: "2rem 0", color: C.dim, fontSize: "0.8rem" }}>
                                        <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.3rem" }}>📭</span>
                                        Henüz sipariş yok
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>

                    {/* ── TREND + ÜRÜN SAĞLIĞI ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                        {/* 7 Günlük Trend */}
                        <GlassCard>
                            <SectionTitle icon="📈" title="7 Günlük Trend" badge={`${fmtNum(trendOrderTotal)} sipariş · ${fmtCurrency(trendRevenueTotal)}`} />
                            {trends.labels.length > 0 ? (
                                <>
                                    <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.accent }} />
                                            <span style={{ color: C.muted, fontSize: "0.68rem" }}>Sipariş</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.green }} />
                                            <span style={{ color: C.muted, fontSize: "0.68rem" }}>Ciro</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.35rem", height: 180, alignItems: "flex-end" }}>
                                        {trends.labels.map((label, i) => {
                                            const oH = Math.max((trends.orderCounts[i] || 0) / orderTrendMax * 100, 4);
                                            const rH = Math.max((trends.revenueTotals[i] || 0) / revenueTrendMax * 100, 4);
                                            return (
                                                <div key={`${label}-${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
                                                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 150 }}>
                                                        <motion.div initial={{ height: 0 }} animate={{ height: `${rH}%` }} transition={{ delay: 0.3 + i * 0.04, duration: 0.4 }}
                                                            style={{ flex: 1, background: `linear-gradient(180deg, ${C.green}, #059669)`, borderRadius: "3px 3px 0 0", cursor: "pointer" }}
                                                            title={`Ciro: ${fmtCurrency(trends.revenueTotals[i] || 0)}`} />
                                                        <motion.div initial={{ height: 0 }} animate={{ height: `${oH}%` }} transition={{ delay: 0.3 + i * 0.04, duration: 0.4 }}
                                                            style={{ flex: 1, background: `linear-gradient(180deg, ${C.accent}, #44a08d)`, borderRadius: "3px 3px 0 0", cursor: "pointer" }}
                                                            title={`Sipariş: ${trends.orderCounts[i] || 0}`} />
                                                    </div>
                                                    <span style={{ color: C.dim, fontSize: "0.6rem", fontWeight: 600 }}>{label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: "center", padding: "2.5rem 0", color: C.dim }}>
                                    <span style={{ fontSize: "2rem" }}>📭</span>
                                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem" }}>Henüz trend verisi yok</p>
                                </div>
                            )}
                        </GlassCard>

                        {/* Ürün & Stok Sağlığı */}
                        <GlassCard>
                            <SectionTitle icon="📦" title="Ürün & Stok Sağlığı" />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {[
                                    { label: "Toplam Ürün", value: fmtNum(summary.totalProducts || pmProducts.total || 0), color: C.accent, icon: "📊" },
                                    { label: "Aktif Ürün", value: fmtNum(summary.activeProducts || pmProducts.healthy || 0), color: C.green, icon: "✅" },
                                    { label: "Stok Biten", value: fmtNum(pmProducts.outOfStock || summary.passiveProducts || 0), color: C.red, icon: "🚫" },
                                    { label: "Düşük Stok", value: fmtNum(pmProducts.lowStock || 0), color: C.yellow, icon: "⚠️" },
                                    { label: "Stok Uyuşmazlığı", value: fmtNum(summary.stockMismatchCount || 0), color: (summary.stockMismatchCount || 0) > 0 ? C.red : C.green, icon: "📉" },
                                    { label: "Kategori Eşleşme", value: fmtNum(pmDashboard?.totalCategories || 0), color: C.purple, icon: "🗂️" },
                                ].map((s, i) => (
                                    <motion.div key={s.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.03 }}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.55rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ fontSize: "1rem" }}>{s.icon}</span>
                                            <span style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600 }}>{s.label}</span>
                                        </div>
                                        <span style={{ color: s.color, fontSize: "1rem", fontWeight: 800 }}>{s.value}</span>
                                    </motion.div>
                                ))}
                            </div>
                            {pmMarketplaces.length > 0 && (
                                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${C.glassBr}` }}>
                                    <p style={{ color: C.muted, fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.4rem" }}>Pazaryeri Ürün Dağılımı</p>
                                    {pmMarketplaces.map(pm => (
                                        <div key={pm.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0" }}>
                                            <span style={{ color: C.text, fontSize: "0.75rem" }}>{pm.name}</span>
                                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                                <Pill color={C.green}>{pm.syncedProducts || 0} sync</Pill>
                                                {(pm.errorProducts || 0) > 0 && <Pill color={C.red}>{pm.errorProducts} hata</Pill>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </GlassCard>
                    </div>

                    {/* ── UYARILAR + CİRO DAĞILIMI + HIZLI AKSİYONLAR ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

                        {/* Uyarılar */}
                        <GlassCard>
                            <SectionTitle icon="🚨" title="Uyarılar" badge={alerts.length > 0 ? `${alerts.length}` : null} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {alerts.length > 0 ? alerts.slice(0, 5).map((alert, i) => (
                                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.03 }}
                                        style={{ background: `${C.red}08`, border: `1px solid ${C.red}18`, borderRadius: 8, padding: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, flexShrink: 0, animation: "pulse 2s infinite" }} />
                                        <p style={{ color: C.red, fontSize: "0.75rem", margin: 0, fontWeight: 600 }}>{alert}</p>
                                    </motion.div>
                                )) : (
                                    <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}18`, borderRadius: 8, padding: "0.8rem", textAlign: "center" }}>
                                        <p style={{ color: C.green, fontSize: "0.8rem", margin: 0, fontWeight: 600 }}>✅ Tüm sistemler normal</p>
                                    </div>
                                )}
                                {(summary.stockMismatchCount || 0) > 0 && (
                                    <div style={{ background: `${C.yellow}08`, border: `1px solid ${C.yellow}18`, borderRadius: 8, padding: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontSize: "0.85rem" }}>📦</span>
                                        <p style={{ color: C.yellow, fontSize: "0.75rem", margin: 0, fontWeight: 600 }}>{summary.stockMismatchCount} stok uyuşmazlığı</p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>

                        {/* Kanal Bazlı Ciro */}
                        <GlassCard>
                            <SectionTitle icon="💰" title="Kanal Ciro" badge={fmtCurrency(summary.todayRevenue || 0)} />
                            {todayBreakdown.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                    {todayBreakdown.map((b, i) => {
                                        const maxRev = Math.max(...todayBreakdown.map(x => x.revenue || 0), 1);
                                        const pct = ((b.revenue || 0) / maxRev) * 100;
                                        return (
                                            <motion.div key={b.marketplace} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                                    <span style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600 }}>{b.marketplace}</span>
                                                    <span style={{ color: C.green, fontSize: "0.78rem", fontWeight: 700 }}>{fmtCurrency(b.revenue)}</span>
                                                </div>
                                                <div style={{ width: "100%", height: 5, background: `${C.accent}12`, borderRadius: 3, overflow: "hidden" }}>
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }}
                                                        style={{ height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.green})`, borderRadius: 3 }} />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "1.5rem 0", color: C.dim, fontSize: "0.8rem" }}>📭 Veri yok</div>
                            )}
                        </GlassCard>

                        {/* Hızlı Aksiyonlar */}
                        <GlassCard>
                            <SectionTitle icon="⚡" title="Hızlı Erişim" />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {[
                                    { label: "Sipariş Yönetimi", icon: <FaClipboardList />, panel: "orders", color: C.accent },
                                    { label: "Stok Yönetimi", icon: <FaBoxOpen />, panel: "inventory", color: C.green },
                                    { label: "Ürün Merkezi", icon: <FaCubes />, panel: "pm-center", color: C.purple },
                                    { label: "Entegrasyonlar", icon: <FaPlug />, panel: "integration", color: C.blue },
                                    { label: "Finans", icon: <FaMoneyBillWave />, panel: "finance", color: C.yellow },
                                    { label: "Kargo Takip", icon: <FaTruck />, panel: "shipping", color: C.pink },
                                ].map((a, i) => (
                                    <motion.button key={a.panel}
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.03 }}
                                        whileHover={{ x: 4, background: `${a.color}15` }} whileTap={{ scale: 0.97 }}
                                        onClick={() => handlePanelChange(a.panel)}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.55rem 0.7rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", transition: "all 0.15s" }}>
                                        <div style={{ color: a.color, fontSize: "0.85rem", display: "flex" }}>{a.icon}</div>
                                        <span style={{ color: C.text, fontSize: "0.78rem", fontWeight: 600, flex: 1, textAlign: "left" }}>{a.label}</span>
                                        <span style={{ color: C.dim, fontSize: "0.7rem" }}>→</span>
                                    </motion.button>
                                ))}
                            </div>
                        </GlassCard>
                    </div>

                    {/* ── SON İŞLEMLER ── */}
                    <GlassCard>
                        <SectionTitle icon="📋" title="Son İşlem Logları"
                            action={
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => handlePanelChange("orders")}
                                    style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>
                                    Tümünü Gör →
                                </motion.button>
                            }
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.4rem" }}>
                            {logs.length > 0 ? logs.slice(0, 8).map((log, i) => (
                                <motion.div key={log.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.02 }}
                                    style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.55rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: 0 }}>
                                        <span style={{ color: C.dim, fontSize: "0.65rem", fontFamily: "monospace" }}>#{log.id}</span>
                                        <span style={{ color: C.muted, fontSize: "0.72rem", fontWeight: 600 }}>{log.marketplace}</span>
                                        <span style={{ color: "#fff", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.type}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                                        <Pill color={log.status === "error" ? C.red : log.status === "slow" ? C.yellow : C.green}>{log.status}</Pill>
                                        <span style={{ color: C.dim, fontSize: "0.65rem" }}>{log.time}</span>
                                    </div>
                                </motion.div>
                            )) : (
                                <div style={{ textAlign: "center", padding: "1.5rem 0", color: C.dim, fontSize: "0.8rem", gridColumn: "1 / -1" }}>
                                    Henüz işlem kaydı yok
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>

                {/* ── SİPARİŞ DETAY MODAL ── */}
                <AnimatePresence>
                    {showOrderDetailsModal && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowOrderDetailsModal(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
                            <motion.div initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                                onClick={e => e.stopPropagation()}
                                style={{ background: `linear-gradient(135deg, ${C.card} 0%, rgba(15,20,25,0.95) 100%)`, border: `1px solid ${C.border}`, borderRadius: 20, padding: "clamp(1rem, 3vw, 2rem)", maxWidth: 900, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

                                {/* Modal Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexShrink: 0 }}>
                                    <h2 style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>
                                        📦 Siparişler ({allOrders.total})
                                    </h2>
                                    <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowOrderDetailsModal(false)}
                                        style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "1.2rem", fontWeight: 700 }}>
                                        ✕
                                    </motion.button>
                                </div>

                                {/* Status Tabs */}
                                <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem", flexWrap: "nowrap", borderBottom: `1px solid ${C.glassBr}`, paddingBottom: "0.75rem", overflowX: "auto", flexShrink: 0 }}>
                                    {[
                                        { id: "all", label: "Tümü", count: allOrders.total, color: C.accent },
                                        { id: "new", label: "Yeni", count: allOrders.statusCounts.new, color: C.accent },
                                        { id: "processing", label: "İşlemde", count: allOrders.statusCounts.processing, color: C.yellow },
                                        { id: "shipping", label: "Kargoda", count: allOrders.statusCounts.shipping, color: C.purple },
                                        { id: "delivered", label: "Teslim", count: allOrders.statusCounts.delivered, color: C.green },
                                        { id: "cancelled", label: "İptal", count: allOrders.statusCounts.cancelled, color: C.red },
                                        { id: "returned", label: "İade", count: allOrders.statusCounts.returned, color: C.yellow },
                                    ].map(tab => (
                                        <motion.button key={tab.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                            onClick={() => setSelectedOrderTab(tab.id)}
                                            style={{
                                                background: selectedOrderTab === tab.id ? `${tab.color}20` : C.glass,
                                                border: selectedOrderTab === tab.id ? `2px solid ${tab.color}` : `1px solid ${C.glassBr}`,
                                                borderRadius: 10, padding: "0.4rem 0.7rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0,
                                            }}>
                                            <span style={{ color: selectedOrderTab === tab.id ? tab.color : C.muted, fontSize: "0.75rem", fontWeight: 700 }}>{tab.label}</span>
                                            <span style={{ background: selectedOrderTab === tab.id ? tab.color : `${C.muted}30`, color: selectedOrderTab === tab.id ? "#000" : "#fff", padding: "0.1rem 0.3rem", borderRadius: 6, fontSize: "0.65rem", fontWeight: 800, minWidth: 20, textAlign: "center" }}>{tab.count}</span>
                                        </motion.button>
                                    ))}
                                </div>

                                {/* Table Header */}
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1fr", gap: "0.75rem", padding: "0.5rem 1rem", borderBottom: `2px solid ${C.accent}20`, marginBottom: "0.5rem", flexShrink: 0 }}>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sipariş No</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pazaryeri</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Tutar</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Tarih</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Durum</span>
                                </div>

                                {/* Order Rows */}
                                <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                                    {(allOrders.byStatus[selectedOrderTab] || []).length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                            {allOrders.byStatus[selectedOrderTab].map((order, idx) => (
                                                <motion.div key={`${order.orderNumber}-${idx}`}
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                                                    style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1fr", gap: "0.75rem", alignItems: "center", padding: "0.6rem 1rem", borderRadius: 8, background: idx % 2 === 0 ? C.glass : "transparent", border: `1px solid transparent`, transition: "background 0.15s ease, border-color 0.15s ease", cursor: "default" }}
                                                    whileHover={{ backgroundColor: `rgba(78,205,196,0.06)`, borderColor: `rgba(78,205,196,0.12)` }}>
                                                    <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.orderNumber || "N/A"}</span>
                                                    <span style={{ color: C.accent, fontSize: "0.8rem", fontWeight: 600 }}>{order.marketplace || "N/A"}</span>
                                                    <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 700, textAlign: "right" }}>{fmtCurrency(order.totalPrice || 0)}</span>
                                                    <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 500, textAlign: "center" }}>
                                                        {order.orderDate ? new Date(order.orderDate).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                                                    </span>
                                                    <div style={{ textAlign: "center" }}>
                                                        <Pill color={
                                                            String(order.status || "").toLowerCase().includes("deliver") || String(order.status || "").toLowerCase().includes("teslim") ? C.green :
                                                            String(order.status || "").toLowerCase().includes("ship") || String(order.status || "").toLowerCase().includes("kargo") ? C.purple :
                                                            String(order.status || "").toLowerCase().includes("cancel") || String(order.status || "").toLowerCase().includes("iptal") ? C.red : C.yellow
                                                        }>
                                                            {order.status || "Bilinmiyor"}
                                                        </Pill>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", color: C.dim }}>
                                            <span style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📭</span>
                                            <p style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Bu kategoride sipariş bulunamadı</p>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: `1px solid ${C.glassBr}`, marginTop: "0.5rem", flexShrink: 0 }}>
                                    <span style={{ color: C.dim, fontSize: "0.75rem" }}>
                                        {(allOrders.byStatus[selectedOrderTab] || []).length} sipariş gösteriliyor
                                    </span>
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => { setShowOrderDetailsModal(false); handlePanelChange("orders"); }}
                                        style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer", color: C.accent, fontSize: "0.78rem", fontWeight: 600 }}>
                                        Sipariş Yönetimine Git →
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── TOAST BİLDİRİMLER (Sağ alt köşe) ── */}
                <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9998, display: "flex", flexDirection: "column", gap: "0.5rem", pointerEvents: "none" }}>
                    <AnimatePresence>
                        {notifications.filter(n => !n.read).slice(0, 3).map((n, i) => (
                            <motion.div key={n.id}
                                initial={{ opacity: 0, x: 80, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 80, scale: 0.9 }}
                                transition={{ duration: 0.3 }}
                                style={{
                                    background: "linear-gradient(135deg, #1a2332 0%, #0f1419 100%)",
                                    border: `1px solid ${C.green}40`,
                                    borderRadius: 14, padding: "0.85rem 1.1rem",
                                    minWidth: 300, maxWidth: 380,
                                    boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${C.green}15`,
                                    pointerEvents: "auto",
                                    display: "flex", alignItems: "center", gap: "0.7rem",
                                }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                    background: `linear-gradient(135deg, ${C.green}, #059669)`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.1rem", boxShadow: `0 4px 12px ${C.green}40`,
                                }}>
                                    🛒
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>{n.title}</p>
                                    <p style={{ color: C.muted, fontSize: "0.72rem", margin: "0.1rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</p>
                                </div>
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}
                                    onClick={() => { dismissNotif(n.id); }}
                                    style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.8rem", padding: "0.2rem", flexShrink: 0 }}>
                                    ✕
                                </motion.button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                `}</style>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════
       SIDEBAR & PANEL RENDER
       ═══════════════════════════════════════════════════════ */
    const isAdmin = userRole === "admin" || userRole === "dev";

    const menuItems = [
        { id: "dashboard", icon: <FaChartLine />, text: t("sidebar.home") },
        { type: "divider", label: t("sidebar.marketplace") },
        { id: "integration", icon: <FaPlug />, text: t("sidebar.integrations") },
        { id: "orders", icon: <FaClipboardList />, text: t("sidebar.orders"), hasSubmenu: true },
        { id: "inventory", icon: <FaBoxOpen />, text: t("sidebar.inventory"), hasSubmenu: true },
        { id: "shipping", icon: <FaTruck />, text: t("sidebar.shipping"), hasSubmenu: true },
        { id: "finance", icon: <FaMoneyBillWave />, text: t("sidebar.finance"), hasSubmenu: true },
        { type: "divider", label: t("sidebar.productMgmt") },
        { id: "pm-center", icon: <FaCubes />, text: t("sidebar.productCenter") },
        { id: "pm-categories", icon: <FaSitemap />, text: t("sidebar.categoryMapping") },
        { type: "divider", label: t("sidebar.analytics") },
        { id: "advanced-analytics", icon: <FaChartBar />, text: t("sidebar.advancedAnalytics") },
        { id: "advanced-ai", icon: <FaBrain />, text: t("sidebar.aiAssistant") },
        { type: "divider", label: t("sidebar.management") },
        { id: "users", icon: <FaUsers />, text: t("sidebar.userMgmt") },
        { id: "billing", icon: <FaFileInvoice />, text: t("sidebar.billing") },
        { id: "subscription", icon: <FaCrown />, text: "Abonelik & Paket" },
        { id: "settings", icon: <FaCog />, text: t("sidebar.settings") },
        ...(isAdmin ? [
            { type: "divider", label: "Admin" },
            { id: "admin-panel", icon: <FaUserShield />, text: t("sidebar.adminPanel") },
        ] : []),
    ];

    /* ── Submenu render ── */
    const renderMarketplaceSubmenu = (type, isOpen) => (
        <div className={`submenu ${isOpen ? "submenu--open" : ""}`}>
            <div className="submenu-inner">
                {marketplaces.map((m) => (
                    <div
                        key={m._id}
                        className={`submenu-item ${activePanel === `${type}-${m._id}` ? "active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); handlePanelChange(`${type}-${m._id}`); }}
                    >
                        <div className="submenu-item-icon">
                            {m.logo ? <img src={m.logo} alt={m.name} /> : <FaBox />}
                        </div>
                        <span className="submenu-item-text">{m.name || "Bilinmeyen Pazaryeri"}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    const handleLogout = () => {
        setShowLogoutConfirm(false);
        localStorage.clear();
        window.location.href = "/login";
    };

    const renderActivePanel = () => {
        if (activePanel.startsWith("finance-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return <FinancePage userId={userId} marketplaces={marketplaces} marketplaceId={marketplaceId} marketplace={marketplace} />;
        }
        if (activePanel.startsWith("orders-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return <OrdersPage userId={userId} marketplaces={[marketplace].filter(Boolean)} marketplaceId={marketplaceId} marketplace={marketplace} />;
        }
        if (activePanel.startsWith("inventory-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return <InventoryPage userId={userId} marketplaceId={marketplaceId} marketplace={marketplace} />;
        }
        if (activePanel.startsWith("shipping-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return <CargoTrackingPage userId={userId} marketplaceId={marketplaceId} marketplace={marketplace} />;
        }
        if (activePanel.startsWith("integration-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return <MarketplaceIntegration userId={userId} marketplaceId={marketplaceId} marketplace={marketplace} />;
        }

        switch (activePanel) {
            case "orders": return <OrdersPage userId={userId} marketplaces={marketplaces} />;
            case "finance": return <FinancePage userId={userId} marketplaces={marketplaces} />;
            case "integration": return <MarketplaceIntegration userId={userId} />;
            case "users": return <UserProfilePage userId={userId} marketplaces={marketplaces} />;
            case "advanced-analytics": return <AdvancedAnalytics userId={userId} />;
            case "advanced-ai": return <AICommandCenter userId={userId} />;
            case "pm-center": return <ProductManagementCenter userId={userId} />;
            case "pm-categories": return <CategoryMappingPage userId={userId} />;
            case "settings": return <SettingsPage userId={userId} />;
            case "billing": return <BillingPage userId={userId} />;
            case "subscription": return <SubscriptionPage />;
            case "admin-panel": return isAdmin ? <AdminPanelPage userId={userId} /> : null;
            case "dashboard": return renderDashboard();
            default: return null;
        }
    };

    return (
        <div className="dashboard-container">
            <Particles id="tsparticles" init={particlesInit}
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

            <AnimatePresence>
                {isMobile && menuOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                        className="tw-fixed tw-inset-0 tw-bg-black/60 tw-backdrop-blur-sm tw-z-[9998]"
                        onClick={() => setMenuOpen(false)} />
                )}
            </AnimatePresence>

            <motion.aside
                className={`sidebar ${menuOpen ? "open" : "closed"}`}
                animate={{ width: isMobile ? (menuOpen ? 280 : 0) : (menuOpen ? 260 : 72) }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                style={isMobile ? { transform: menuOpen ? "translateX(0)" : "translateX(-100%)" } : {}}
            >
                <div className="sidebar-header">
                    <motion.div className="logo-container" animate={{ opacity: menuOpen ? 1 : 0 }} transition={{ duration: 0.12 }}>
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
                    {menuItems.map((item, itemIdx) => {
                        if (item.type === "divider") {
                            return (
                                <React.Fragment key={`div-${itemIdx}`}>
                                    <div className="menu-divider" />
                                    {item.label && <div className="menu-section-label">{item.label}</div>}
                                </React.Fragment>
                            );
                        }

                        const hasSubmenu = !!item.hasSubmenu;
                        const isSubmenuOpen = openSubmenu === item.id;

                        return (
                            <React.Fragment key={item.id}>
                                <div
                                    className={`menu-item ${activePanel === item.id || activePanel.startsWith(item.id + "-") ? "active" : ""} ${hasSubmenu && isSubmenuOpen ? "submenu-open" : ""}`}
                                    onClick={() => {
                                        if (hasSubmenu) {
                                            setOpenSubmenu(isSubmenuOpen ? null : item.id);
                                        } else {
                                            setOpenSubmenu(null);
                                            handlePanelChange(item.id);
                                        }
                                    }}
                                >
                                    <div className="icon-wrapper">{item.icon}</div>
                                    <span className="menu-text">{item.text}</span>
                                    {hasSubmenu && (
                                        <span className={`menu-chevron ${isSubmenuOpen ? "menu-chevron--open" : ""}`}>
                                            <FaChevronDown />
                                        </span>
                                    )}
                                    <span className="sidebar-tooltip">{item.text}</span>
                                </div>

                                {hasSubmenu && renderMarketplaceSubmenu(item.id, isSubmenuOpen)}
                            </React.Fragment>
                        );
                    })}

                    {/* Logout Button */}
                    <div style={{ marginTop: "auto", padding: "0.5rem 0.5rem 1rem 0.5rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <motion.div
                            className="menu-item"
                            onClick={() => setShowLogoutConfirm(true)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                        >
                            <div className="icon-wrapper" style={{ color: "#ef4444" }}><FaSignOutAlt /></div>
                            <span className="menu-text">{t("sidebar.logout")}</span>
                            <span className="sidebar-tooltip">{t("sidebar.logout")}</span>
                        </motion.div>
                    </div>
                </nav>
            </motion.aside>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowLogoutConfirm(false)}
                        style={{
                            position: "fixed", inset: 0, zIndex: 9999,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
                        }}>
                        <motion.div
                            initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: `linear-gradient(135deg, ${C.card} 0%, rgba(15,20,25,0.98) 100%)`,
                                border: `1px solid ${C.border}`, borderRadius: 20,
                                padding: "2rem", maxWidth: 420, width: "100%", textAlign: "center",
                            }}>
                            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👋</div>
                            <h2 style={{
                                background: `linear-gradient(135deg, ${C.red}, ${C.pink})`,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.5rem 0",
                            }}>
                                {t("sidebar.logout")}
                            </h2>
                            <p style={{ color: C.muted, fontSize: "0.88rem", margin: "0 0 1.5rem 0" }}>
                                {t("sidebar.logoutConfirm")}
                            </p>
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={handleLogout}
                                    style={{
                                        flex: 1, padding: "0.75rem", background: `linear-gradient(135deg, ${C.red}, ${C.pink})`,
                                        border: "none", borderRadius: 10, color: "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                                    }}>
                                    {t("common.yes")}
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowLogoutConfirm(false)}
                                    style={{
                                        flex: 1, padding: "0.75rem", background: C.glass,
                                        border: `1px solid ${C.glassBr}`, borderRadius: 10,
                                        color: C.muted, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                                    }}>
                                    {t("common.no")}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                <motion.main
                    key={activePanel}
                    className={`content-area${activePanel === "integration" ? " content-area--galaxy" : ""}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    style={{ color: "#ffffff" }}
                >
                    {renderActivePanel()}
                </motion.main>
            </AnimatePresence>
        </div>
    );
};

export default UserDashboard;
