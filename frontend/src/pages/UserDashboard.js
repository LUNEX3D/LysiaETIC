import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getUserMarketplaces, fetchDashboardData } from "../services/marketplaceApi";
import { getProductManagementDashboard } from "../services/productManagementApi";
import { getNotifications, markNotificationAsRead, dismissNotification as apiDismissNotif, createBulkOrderNotifications } from "../services/notificationApi";
import { useApp } from "../context/AppContext";
import MarketplaceIntegration from "../pages/MarketplaceIntegration";
import OrdersPage from "../pages/OrdersPage";
import InventoryPage from "../pages/StockManagement";
import FinancePage from "../pages/FinancePage";
import CargoTrackingPage from "../pages/CargoTrackingPage";
import UserProfilePage from "../pages/UserProfilePage";
import AdvancedAnalytics from "../pages/AdvancedAnalytics";
import LysiaBrain from "../pages/lysiabrain/LysiaBrain";
import AIChatWidget from "../components/AIChatWidget";
import ProductManagementCenter from "../pages/ProductManagementCenter";
import CategoryCenterPage from "../pages/CategoryCenterPage";

import SettingsPage from "../pages/SettingsPage";
import AdminPanelPage from "../pages/AdminPanelPage";
import BillingPage from "../pages/BillingPage";
import SubscriptionPage from "../pages/SubscriptionPage";
import RoketfyPanel from "../pages/RoketfyPanel";
import {
    FaBars, FaTimes, FaClipboardList, FaCog,
    FaChartLine, FaBoxOpen, FaMoneyBillWave,
    FaTruck, FaUsers, FaFileInvoice, FaPlug,
    FaChevronDown, FaBox, FaCrown,
    FaBrain, FaChartBar, FaBell, FaRocket,
    FaCubes, FaSitemap, FaSignOutAlt, FaUserShield,
    FaExclamationTriangle
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import "../styles/userDashboard.css";

/* ═══════════════════════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
   ═══════════════════════════════════════════════════════════ */
const fmtCurrency = (v, lang = "tr") => {
    try {
        const locale = lang === "en" ? "en-US" : "tr-TR";
        return new Intl.NumberFormat(locale, { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0));
    } catch { return `${Number(v || 0).toFixed(0)} ₺`; }
};
const fmtNum = (v, lang = "tr") => {
    const locale = lang === "en" ? "en-US" : "tr-TR";
    return new Intl.NumberFormat(locale).format(Number(v || 0));
};

const statusLabel = (s, t) => s === "active" ? t("dashboard.active") : s === "slow" ? t("dashboard.slow") : s === "error" ? t("dashboard.error") : t("dashboard.unknown");
const statusColor = (s, C) => s === "active" ? C.green : s === "slow" ? C.yellow : C.red;

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
const GlassCard = ({ children, style, C, ...rest }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}dd 100%)`,
                border: `1px solid ${C.border}`,
                borderRadius: mobile ? 12 : 16,
                padding: mobile ? "1rem" : "1.5rem",
                minWidth: 0,
                overflow: "hidden",
                ...style,
            }}
            {...rest}
        >
            {children}
        </motion.div>
    );
};

const KpiCard = ({ icon, label, value, sub, color, delay = 0, onClick, C }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.35 }}
            whileHover={mobile ? {} : { y: -4, boxShadow: `0 12px 32px ${color}30` }}
            onClick={onClick}
            style={{
                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}ee 100%)`,
                border: `1px solid ${color}30`,
                borderRadius: mobile ? 12 : 14,
                padding: mobile ? "0.75rem 0.85rem" : "1.25rem 1.5rem",
                cursor: onClick ? "pointer" : "default",
                position: "relative",
                overflow: "hidden",
                minWidth: 0,
            }}
        >
            <div style={{ position: "absolute", top: 0, right: 0, width: mobile ? 80 : 120, height: mobile ? 80 : 120, background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: mobile ? "0.5rem" : "0.75rem", marginBottom: mobile ? "0.4rem" : "0.75rem", position: "relative", zIndex: 1 }}>
                <div style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, padding: mobile ? "0.4rem" : "0.6rem", borderRadius: mobile ? 8 : 10, fontSize: mobile ? "1rem" : "1.3rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${color}40`, flexShrink: 0 }}>
                    {icon}
                </div>
                <span style={{ color: C.muted, fontSize: mobile ? "0.65rem" : "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: mobile ? "1.15rem" : "1.75rem", fontWeight: 800, color: C.text, margin: 0, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</h3>
                {sub && <p style={{ color: C.dim, fontSize: mobile ? "0.6rem" : "0.75rem", margin: "0.25rem 0 0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>}
            </div>
        </motion.div>
    );
};

const Pill = ({ color, children }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <span style={{
            background: `${color}15`,
            border: `1px solid ${color}35`,
            padding: mobile ? "0.2rem 0.45rem" : "0.3rem 0.7rem",
            borderRadius: mobile ? 8 : 10,
            color,
            fontSize: mobile ? "0.65rem" : "0.75rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            whiteSpace: "nowrap",
            flexShrink: 0,
        }}>
            {children}
        </span>
    );
};

const SectionTitle = ({ icon, title, badge, action, C }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: mobile ? "0.75rem" : "1.25rem", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: mobile ? "0.9rem" : "1.1rem", fontWeight: 700, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <span style={{ fontSize: mobile ? "1rem" : "1.3rem", flexShrink: 0 }}>{icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                {badge && !mobile && <Pill color={C.accent}>{badge}</Pill>}
                {action}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════ */
const UserDashboard = () => {
    const { theme: C, t, language, resolvedTheme } = useApp();
    const isDark = resolvedTheme === "dark";
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

    // ── Bildirim Sistemi (Persistent Backend) ──
    const [notifications, setNotifications] = useState([]);
    const [notifCounts, setNotifCounts] = useState({ total: 0, order: 0, admin: 0, ai: 0, stock: 0, system: 0 });
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [notifSoundEnabled, setNotifSoundEnabled] = useState(true);
    const [notifFilter, setNotifFilter] = useState("all"); // all, order, admin, ai
    const prevNotifCountRef = useRef(0);
    const lastCheckRef = useRef(null);

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
                const data = await getUserMarketplaces();
                setMarketplaces(data.map(m => ({ ...m, name: m.marketplaceName })));
            } catch (e) { console.error("Pazar yerleri yüklenirken hata:", e); }
        })();
    }, [userId]);

    // ── Sipariş bildirimlerini backend'e kaydet ──
    const syncOrderNotifications = useCallback(async (data) => {
        if (!data?.marketplaceStatus) return;
        try {
            const orders = [];
            Object.entries(data.marketplaceStatus).forEach(([mp, mpData]) => {
                if (mpData.orderDetails && Array.isArray(mpData.orderDetails)) {
                    mpData.orderDetails.forEach(o => {
                        if (o.orderNumber) {
                            orders.push({
                                orderNumber: o.orderNumber,
                                marketplace: mp,
                                totalPrice: o.totalPrice || 0,
                                itemCount: o.items?.length || 1,
                                customerName: o.customerName || "",
                                status: o.status || "Created"
                            });
                        }
                    });
                }
            });
            if (orders.length > 0) {
                await createBulkOrderNotifications(orders);
            }
        } catch { /* sessiz */ }
    }, []);

    // ── Bildirimleri backend'den çek ──
    const loadNotifications = useCallback(async () => {
        try {
            const params = {};
            if (lastCheckRef.current) params.lastCheck = lastCheckRef.current;
            if (notifFilter !== "all") params.type = notifFilter;
            params.limit = 50;

            const data = await getNotifications(params);
            const serverNotifs = data.notifications || [];

            if (lastCheckRef.current && serverNotifs.length > 0) {
                // Yeni bildirimler geldi — mevcut listeye ekle
                setNotifications(prev => {
                    const existingIds = new Set(prev.map(n => n._id));
                    const newOnes = serverNotifs.filter(n => !existingIds.has(n._id));
                    return [...newOnes, ...prev].slice(0, 100);
                });

                // Yeni bildirim sesi
                const newCount = serverNotifs.filter(n => !n.isRead).length;
                if (newCount > 0 && notifSoundEnabled) {
                    playNotificationSound();
                }
            } else if (!lastCheckRef.current) {
                // İlk yükleme — tüm listeyi set et
                setNotifications(serverNotifs);
            }

            setNotifCounts(data.counts || { total: 0, order: 0, admin: 0, ai: 0, stock: 0, system: 0 });
            if (data.serverTime) lastCheckRef.current = data.serverTime;
        } catch { /* sessiz */ }
    }, [notifFilter, notifSoundEnabled]);

    // ── Dashboard Verileri (gerçek) ──
    // ✅ v2: Polling 30sn → 90sn + sayfa görünmezken atla (rate limit azaltma)
    useEffect(() => {
        if (!userId) return;
        let intervalId;
        const load = async () => {
            setDashboardLoading(true);
            setDashboardError("");
            try {
                const data = await fetchDashboardData();
                setDashboardData(data);
                syncOrderNotifications(data);
            } catch (e) {
                console.error("Dashboard verileri yüklenirken hata:", e);
                setDashboardError("Veriler yüklenemedi.");
            } finally { setDashboardLoading(false); }
        };
        load();
        intervalId = setInterval(() => {
            if (document.visibilityState === "visible") load();
        }, 90000);
        return () => clearInterval(intervalId);
    }, [userId, syncOrderNotifications]);

    // ── Bildirim Polling ──
    // ✅ v2: 15sn → 45sn + sayfa görünmezken atla (rate limit azaltma)
    useEffect(() => {
        if (!userId) return;
        loadNotifications(); // İlk yükleme
        const iv = setInterval(() => {
            if (document.visibilityState === "visible") loadNotifications();
        }, 45000);
        return () => clearInterval(iv);
    }, [userId, loadNotifications]);

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
    const unreadCount = notifCounts.total || 0;
    const markAllRead = async () => {
        try {
            await markNotificationAsRead("all");
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setNotifCounts({ total: 0, order: 0, admin: 0, ai: 0, stock: 0, system: 0 });
        } catch { /* sessiz */ }
    };
    const dismissNotif = async (id) => {
        try {
            await apiDismissNotif(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            loadNotifications(); // Sayıları güncelle
        } catch { /* sessiz */ }
    };
    const handleNotifClick = async (n) => {
        try {
            if (!n.isRead) {
                await markNotificationAsRead(n._id);
                setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, isRead: true } : x));
                setNotifCounts(prev => ({ ...prev, total: Math.max(0, prev.total - 1), [n.type]: Math.max(0, (prev[n.type] || 0) - 1) }));
            }
        } catch { /* sessiz */ }
        setShowNotifPanel(false);
        if (n.actionLink) handlePanelChange(n.actionLink);
        else if (n.type === "order") handlePanelChange("orders");
    };

    const filteredNotifs = notifFilter === "all" ? notifications : notifications.filter(n => n.type === notifFilter);

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
        const loc = language === "en" ? "en-US" : "tr-TR";
        const timeStr = now.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
        const dateStr = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        return (
            <div style={{ width: "100%", minHeight: "100vh", background: C.bg, padding: 0, margin: 0 }}>

                {/* ── HEADER ── */}
                <div style={{
                    background: isDark ? "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)" : "linear-gradient(135deg, #ffffff 0%, #f0f2f5 100%)",
                    borderBottom: `1px solid ${C.border}`,
                    position: "sticky", top: 0, zIndex: 100,
                    backdropFilter: "blur(12px)",
                    padding: isMobile ? "0.75rem 0.75rem" : "1.25rem clamp(1rem, 4vw, 3rem)",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: isMobile ? "0.5rem" : "1rem" }}>
                        {/* Sol: Karşılama */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                                <h1 style={{
                                    background: `linear-gradient(135deg, ${C.accent} 0%, ${C.purple} 100%)`,
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    fontSize: isMobile ? "1.1rem" : "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 800, margin: 0,
                                }}>
                                    {t(getGreetingKey())} 👋
                                </h1>
                                {dashboardLoading && (
                                    <div style={{ width: 16, height: 16, border: `2px solid ${C.accent}30`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                )}
                            </div>
                            <p style={{ color: C.dim, fontSize: isMobile ? "0.7rem" : "0.78rem", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "nowrap" : "normal" }}>{dateStr}</span>
                                <span style={{ color: C.accent, fontWeight: 700, fontFamily: "monospace" }}>{timeStr}</span>
                                {!isMobile && <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.dim, display: "inline-block" }} />}
                                {!isMobile && <span>{summary.activeMarketplaces || 0} {t("dashboard.activeChannels").toLowerCase()}</span>}
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
                                            position: isMobile ? "fixed" : "absolute",
                                            top: isMobile ? "60px" : "calc(100% + 8px)",
                                            right: isMobile ? "12px" : 0,
                                            left: isMobile ? "12px" : "auto",
                                            width: isMobile ? "auto" : 400,
                                            maxWidth: isMobile ? "100%" : 400,
                                            maxHeight: isMobile ? "calc(100dvh - 80px)" : 520,
                                            background: isDark ? "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)" : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                                            border: `1px solid ${C.border}`,
                                            borderRadius: 16, overflow: "hidden",
                                            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                                            zIndex: 9999,
                                        }}
                                    >
                                        {/* Panel Header */}
                                        <div style={{ padding: "0.85rem 1.25rem", borderBottom: `1px solid ${C.glassBr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <FaBell style={{ color: C.accent, fontSize: "0.9rem" }} />
                                                <span style={{ color: C.text, fontSize: "0.9rem", fontWeight: 700 }}>{t("notif.title")}</span>
                                                {unreadCount > 0 && <Pill color={C.red}>{unreadCount} {t("notif.new")}</Pill>}
                                            </div>
                                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                                    onClick={() => setNotifSoundEnabled(!notifSoundEnabled)}
                                                    title={notifSoundEnabled ? t("notif.soundOn") : t("notif.soundOff")}
                                                    style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.5rem", cursor: "pointer", color: notifSoundEnabled ? C.accent : C.dim, fontSize: "0.75rem" }}>
                                                    {notifSoundEnabled ? "🔔" : "🔕"}
                                                </motion.button>
                                                {unreadCount > 0 && (
                                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                                        onClick={markAllRead}
                                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.muted, fontSize: "0.7rem", fontWeight: 600 }}>
                                                        {t("notif.markAllRead")}
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Filtre Tabları */}
                                        <div style={{ display: "flex", gap: "0.25rem", padding: "0.5rem 0.75rem", borderBottom: `1px solid ${C.glassBr}`, overflowX: "auto" }}>
                                            {[
                                                { key: "all", label: t("notif.all"), icon: "📋", count: notifCounts.total },
                                                { key: "order", label: t("notif.orders"), icon: "🛒", count: notifCounts.order },
                                                { key: "admin", label: t("notif.announcements"), icon: "📢", count: notifCounts.admin },
                                                { key: "ai", label: t("notif.ai"), icon: "🧠", count: notifCounts.ai },
                                            ].map(tab => (
                                                <motion.button key={tab.key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                    onClick={() => { setNotifFilter(tab.key); lastCheckRef.current = null; loadNotifications(); }}
                                                    style={{
                                                        background: notifFilter === tab.key ? `${C.accent}20` : "transparent",
                                                        border: `1px solid ${notifFilter === tab.key ? C.accent + "40" : "transparent"}`,
                                                        borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer",
                                                        color: notifFilter === tab.key ? C.accent : C.muted,
                                                        fontSize: "0.7rem", fontWeight: 600, whiteSpace: "nowrap",
                                                        display: "flex", alignItems: "center", gap: "0.3rem",
                                                    }}>
                                                    <span>{tab.icon}</span> {tab.label}
                                                    {tab.count > 0 && <span style={{ background: C.red, color: "#fff", fontSize: "0.55rem", fontWeight: 800, borderRadius: 6, padding: "0.1rem 0.3rem", minWidth: 16, textAlign: "center" }}>{tab.count}</span>}
                                                </motion.button>
                                            ))}
                                        </div>

                                        {/* Bildirim Listesi */}
                                        <div style={{ maxHeight: 360, overflowY: "auto", padding: "0.5rem" }}>
                                            {filteredNotifs.length > 0 ? filteredNotifs.slice(0, 30).map((n, i) => {
                                                const iconMap = { order: "🛒", admin: "📢", ai: "🧠", stock: "📦", system: "⚙️" };
                                                const gradMap = { order: `linear-gradient(135deg, ${C.green}, #059669)`, admin: `linear-gradient(135deg, ${C.purple}, #6d28d9)`, ai: `linear-gradient(135deg, ${C.blue}, #0284c7)`, stock: `linear-gradient(135deg, ${C.yellow}, #d97706)`, system: `linear-gradient(135deg, ${C.accent}, #44a08d)` };
                                                const priorityDot = { critical: C.red, high: C.yellow, medium: C.blue, low: C.dim };
                                                return (
                                                    <motion.div key={n._id}
                                                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                                                        style={{
                                                            background: n.isRead ? "transparent" : `${C.accent}08`,
                                                            border: `1px solid ${n.isRead ? "transparent" : C.accent + "15"}`,
                                                            borderRadius: 10, padding: "0.7rem 0.85rem", marginBottom: "0.3rem",
                                                            display: "flex", alignItems: "flex-start", gap: "0.6rem",
                                                            cursor: "pointer", transition: "all 0.2s",
                                                        }}
                                                        onClick={() => handleNotifClick(n)}
                                                        whileHover={{ background: `${C.accent}10` }}
                                                    >
                                                        <div style={{
                                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                            background: gradMap[n.type] || gradMap.system,
                                                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                                                        }}>
                                                            {n.icon || iconMap[n.type] || "🔔"}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
                                                                <span style={{ color: C.text, fontSize: "0.8rem", fontWeight: 700 }}>{n.title}</span>
                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                                                                    {n.priority && n.priority !== "medium" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityDot[n.priority] || C.dim }} title={n.priority} />}
                                                                    {!n.isRead && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />}
                                                                </div>
                                                            </div>
                                                            <p style={{ color: C.muted, fontSize: "0.73rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</p>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.15rem" }}>
                                                                <span style={{ color: C.dim, fontSize: "0.6rem", background: `${C.glass}`, border: `1px solid ${C.glassBr}`, borderRadius: 4, padding: "0.05rem 0.3rem" }}>
                                                                    {n.type === "order" ? t("notif.order") : n.type === "admin" ? t("notif.announcement") : n.type === "ai" ? "AI" : n.type === "stock" ? t("notif.stock") : t("notif.system")}
                                                                </span>
                                                                <span style={{ color: C.dim, fontSize: "0.62rem" }}>
                                                                    {n.createdAt ? new Date(n.createdAt).toLocaleString(language === "en" ? "en-US" : "tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}
                                                            onClick={(e) => { e.stopPropagation(); dismissNotif(n._id); }}
                                                            style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.7rem", padding: "0.2rem", flexShrink: 0 }}>
                                                            ✕
                                                        </motion.button>
                                                    </motion.div>
                                                );
                                            }) : (
                                                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: C.dim }}>
                                                    <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>🔔</span>
                                                    <p style={{ fontSize: "0.85rem", margin: 0 }}>{t("notif.noNotifications")}</p>
                                                    <p style={{ fontSize: "0.73rem", margin: "0.25rem 0 0", color: C.dim }}>{t("notif.willAppearHere")}</p>
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
                <div style={{ padding: isMobile ? "0.75rem" : "clamp(1rem, 3vw, 1.75rem) clamp(1rem, 4vw, 3rem)", overflowX: "hidden" }}>

                    {/* ── DURUM ÇUBUĞU (Compact) ── */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                        style={{
                            display: "flex", gap: isMobile ? "0.35rem" : "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem",
                            padding: isMobile ? "0.5rem 0.6rem" : "0.75rem 1rem", borderRadius: 12,
                            background: `linear-gradient(135deg, ${C.accent}08, ${C.purple}08)`,
                            border: `1px solid ${C.accent}15`,
                            overflowX: "auto", WebkitOverflowScrolling: "touch",
                        }}>
                        {[
                            { label: t("dashboard.activeChannels"), value: summary.activeMarketplaces || 0, color: C.green, icon: "🟢" },
                            { label: t("dashboard.error"), value: diagnostics.errorCount || 0, color: (diagnostics.errorCount || 0) > 0 ? C.red : C.green, icon: (diagnostics.errorCount || 0) > 0 ? "🔴" : "🟢" },
                            { label: t("dashboard.pendingSync"), value: summary.pendingSync || 0, color: (summary.pendingSync || 0) > 0 ? C.yellow : C.green, icon: "🔄" },
                            { label: t("dashboard.stockMismatch"), value: summary.stockMismatchCount || 0, color: (summary.stockMismatchCount || 0) > 0 ? C.yellow : C.green, icon: "📦" },
                            { label: t("dashboard.lastUpdate"), value: summary.lastIntegrationUpdate ? new Date(summary.lastIntegrationUpdate).toLocaleTimeString(language === "en" ? "en-US" : "tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—", color: C.accent, icon: "🕐" },
                        ].map((s, i) => (
                            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: isMobile ? "0.15rem 0.4rem" : "0.2rem 0.6rem", borderRadius: 8, background: `${s.color}08`, flexShrink: 0, whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: isMobile ? "0.6rem" : "0.7rem" }}>{s.icon}</span>
                                <span style={{ color: C.muted, fontSize: isMobile ? "0.6rem" : "0.7rem", fontWeight: 600 }}>{s.label}:</span>
                                <span style={{ color: s.color, fontSize: isMobile ? "0.65rem" : "0.75rem", fontWeight: 800 }}>{s.value}</span>
                            </div>
                        ))}
                    </motion.div>

                    {/* ── KPI KARTLARI ── */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(210px, 1fr))", gap: isMobile ? "0.5rem" : "1rem", marginBottom: "1.5rem" }}>
                        <KpiCard C={C} icon="📦" label={t("dashboard.totalOrders")} value={fmtNum(allOrders.total, language)}
                            sub={`🆕 ${allOrders.statusCounts.new} ${t("dashboard.new")} · ⚙️ ${allOrders.statusCounts.processing} ${t("dashboard.processing")} · 🚚 ${allOrders.statusCounts.shipping} ${t("dashboard.shipping")}`}
                            color={C.accent} delay={0.05} onClick={() => setShowOrderDetailsModal(true)} />
                        <KpiCard C={C} icon="💰" label={t("dashboard.totalRevenue")} value={fmtCurrency(summary.todayRevenue, language)}
                            sub={`${t("dashboard.avgBasket")}: ${fmtCurrency(avgOrderValue, language)}`}
                            color={C.green} delay={0.1} />
                        <KpiCard C={C} icon="📊" label={t("dashboard.productCount")} value={fmtNum(summary.totalProducts || pmProducts.total || 0, language)}
                            sub={`✅ ${fmtNum(summary.activeProducts || pmProducts.healthy || 0, language)} ${t("dashboard.active").toLowerCase()} · ⏸️ ${fmtNum(summary.passiveProducts || pmProducts.outOfStock || 0, language)} ${t("dashboard.passive").toLowerCase()}`}
                            color={C.purple} delay={0.15} />
                        <KpiCard C={C} icon="⚠️" label={t("dashboard.lowStockAlert")} value={fmtNum(pmProducts.lowStock || 0, language)}
                            sub={`${t("dashboard.outOfStock")}: ${fmtNum(pmProducts.outOfStock || 0, language)}`}
                            color={(pmProducts.lowStock || 0) > 0 ? C.yellow : C.green} delay={0.2} />
                        <KpiCard C={C} icon="📈" label={t("dashboard.weeklyOrders")} value={fmtNum(trendOrderTotal, language)}
                            sub={`${t("dashboard.totalRevenue")}: ${fmtCurrency(trendRevenueTotal, language)}`}
                            color={C.blue} delay={0.25} />
                        <KpiCard C={C} icon="✅" label={t("dashboard.delivered")} value={fmtNum(allOrders.statusCounts.delivered, language)}
                            sub={`❌ ${allOrders.statusCounts.cancelled} ${t("dashboard.cancelledOrders").toLowerCase()} · ↩️ ${allOrders.statusCounts.returned} ${t("dashboard.returnedOrders").toLowerCase()}`}
                            color={C.green} delay={0.3} />
                    </div>

                    {/* ── PAZARYERI TABLOSU + CANLI SİPARİŞ AKIŞI ── */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: isMobile ? "0.75rem" : "1.5rem", marginBottom: "1.5rem" }}>

                        {/* Pazaryeri Durumu */}
                        {marketplaceEntries.length > 0 && (
                            <GlassCard C={C} style={isMobile ? { padding: "1rem" } : {}}>
                                <SectionTitle C={C} icon="🏪" title={t("dashboard.marketplaceStatus")} badge={`${marketplaceEntries.length} ${t("dashboard.channel")}`} />
                                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", margin: isMobile ? "0 -0.5rem" : 0, padding: isMobile ? "0 0.5rem" : 0 }}>
                                    <table style={{ width: "100%", minWidth: isMobile ? 480 : 500, borderCollapse: "separate", borderSpacing: "0 0.35rem" }}>
                                        <thead>
                                            <tr style={{ color: C.muted, fontSize: isMobile ? "0.6rem" : "0.68rem", fontWeight: 600, textTransform: "uppercase" }}>
                                                <th style={{ textAlign: "left", padding: isMobile ? "0.3rem 0.5rem" : "0.4rem 0.8rem" }}>{t("dashboard.channel")}</th>
                                                <th style={{ textAlign: "center", padding: isMobile ? "0.3rem" : "0.4rem" }}>{t("dashboard.status")}</th>
                                                <th style={{ textAlign: "center", padding: isMobile ? "0.3rem" : "0.4rem" }}>{t("dashboard.orders")}</th>
                                                <th style={{ textAlign: "center", padding: isMobile ? "0.3rem" : "0.4rem" }}>{t("dashboard.revenue")}</th>
                                                <th style={{ textAlign: "center", padding: isMobile ? "0.3rem" : "0.4rem" }}>{t("dashboard.errors")}</th>
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
                                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(mp.status, C), boxShadow: `0 0 6px ${statusColor(mp.status, C)}60` }} />
                                                            <div>
                                                                <p style={{ color: C.text, fontWeight: 600, margin: 0, fontSize: "0.82rem" }}>{name}</p>
                                                                <p style={{ color: C.dim, fontSize: "0.6rem", margin: 0 }}>
                                                                    {mp.updatedAt ? new Date(mp.updatedAt).toLocaleTimeString(language === "en" ? "en-US" : "tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem" }}>
                                                        <Pill color={statusColor(mp.status, C)}>{statusLabel(mp.status, t)}</Pill>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem" }}>
                                                        <span style={{ color: C.accent, fontWeight: 700, fontSize: "0.9rem" }}>{mp.orders || 0}</span>
                                                    </td>
                                                    <td style={{ textAlign: "center", padding: "0.4rem" }}>
                                                        <span style={{ color: C.green, fontWeight: 700, fontSize: "0.82rem" }}>{fmtCurrency(mp.revenue || 0, language)}</span>
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
                        <GlassCard C={C}>
                            <SectionTitle C={C} icon="🔴" title={t("dashboard.recentOrders")}
                                action={
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => handlePanelChange("orders")}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>
                                        {t("dashboard.viewAll")}
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
                                            <span style={{ color: C.green, fontSize: "0.8rem", fontWeight: 800 }}>{fmtCurrency(o.totalPrice || 0, language)}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ color: C.dim, fontSize: "0.68rem", fontFamily: "monospace" }}>#{o.orderNumber || "—"}</span>
                                            <span style={{ color: C.dim, fontSize: "0.65rem" }}>
                                                {o.orderDate ? new Date(o.orderDate).toLocaleString(language === "en" ? "en-US" : "tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                                            </span>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <div style={{ textAlign: "center", padding: "2rem 0", color: C.dim, fontSize: "0.8rem" }}>
                                        <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.3rem" }}>📭</span>
                                        {t("dashboard.noOrders")}
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>

                    {/* ── TREND + ÜRÜN SAĞLIĞI ── */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0.75rem" : "1.5rem", marginBottom: "1.5rem" }}>
                        {/* 7 Günlük Trend */}
                        <GlassCard C={C}>
                            <SectionTitle C={C} icon="📈" title={t("dashboard.weeklyTrend")} badge={`${fmtNum(trendOrderTotal, language)} ${t("dashboard.orders").toLowerCase()} · ${fmtCurrency(trendRevenueTotal, language)}`} />
                            {trends.labels.length > 0 ? (
                                <>
                                    <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.accent }} />
                                            <span style={{ color: C.muted, fontSize: "0.68rem" }}>{t("dashboard.orders")}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.green }} />
                                            <span style={{ color: C.muted, fontSize: "0.68rem" }}>{t("dashboard.revenue")}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: isMobile ? "0.2rem" : "0.35rem", height: isMobile ? 130 : 180, alignItems: "flex-end" }}>
                                        {trends.labels.map((label, i) => {
                                            const oH = Math.max((trends.orderCounts[i] || 0) / orderTrendMax * 100, 4);
                                            const rH = Math.max((trends.revenueTotals[i] || 0) / revenueTrendMax * 100, 4);
                                            return (
                                                <div key={`${label}-${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem", minWidth: 0 }}>
                                                    <div style={{ width: "100%", display: "flex", gap: isMobile ? 1 : 2, alignItems: "flex-end", height: isMobile ? 100 : 150 }}>
                                                        <motion.div initial={{ height: 0 }} animate={{ height: `${rH}%` }} transition={{ delay: 0.3 + i * 0.04, duration: 0.4 }}
                                                            style={{ flex: 1, background: `linear-gradient(180deg, ${C.green}, #059669)`, borderRadius: "3px 3px 0 0", cursor: "pointer" }}
                                                            title={`${t("dashboard.revenue")}: ${fmtCurrency(trends.revenueTotals[i] || 0, language)}`} />
                                                        <motion.div initial={{ height: 0 }} animate={{ height: `${oH}%` }} transition={{ delay: 0.3 + i * 0.04, duration: 0.4 }}
                                                            style={{ flex: 1, background: `linear-gradient(180deg, ${C.accent}, #44a08d)`, borderRadius: "3px 3px 0 0", cursor: "pointer" }}
                                                            title={`${t("dashboard.orders")}: ${trends.orderCounts[i] || 0}`} />
                                                    </div>
                                                    <span style={{ color: C.dim, fontSize: isMobile ? "0.5rem" : "0.6rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: "center", padding: "2.5rem 0", color: C.dim }}>
                                    <span style={{ fontSize: "2rem" }}>📭</span>
                                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem" }}>{t("dashboard.noData")}</p>
                                </div>
                            )}
                        </GlassCard>

                        {/* Ürün & Stok Sağlığı */}
                        <GlassCard C={C}>
                            <SectionTitle C={C} icon="📦" title={t("dashboard.productHealth")} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {[
                                    { label: t("dashboard.totalProducts"), value: fmtNum(summary.totalProducts || pmProducts.total || 0, language), color: C.accent, icon: "📊" },
                                    { label: t("dashboard.activeProducts"), value: fmtNum(summary.activeProducts || pmProducts.healthy || 0, language), color: C.green, icon: "✅" },
                                    { label: t("dashboard.outOfStock"), value: fmtNum(pmProducts.outOfStock || summary.passiveProducts || 0, language), color: C.red, icon: "🚫" },
                                    { label: t("dashboard.lowStock"), value: fmtNum(pmProducts.lowStock || 0, language), color: C.yellow, icon: "⚠️" },
                                    { label: t("dashboard.stockMismatchCount"), value: fmtNum(summary.stockMismatchCount || 0, language), color: (summary.stockMismatchCount || 0) > 0 ? C.red : C.green, icon: "📉" },

                                ].map((s, i) => (
                                    <motion.div key={s.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.03 }}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: isMobile ? "0.45rem 0.6rem" : "0.55rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.35rem" : "0.5rem", minWidth: 0, flex: 1 }}>
                                            <span style={{ fontSize: isMobile ? "0.85rem" : "1rem", flexShrink: 0 }}>{s.icon}</span>
                                            <span style={{ color: C.muted, fontSize: isMobile ? "0.7rem" : "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                                        </div>
                                        <span style={{ color: s.color, fontSize: isMobile ? "0.85rem" : "1rem", fontWeight: 800, flexShrink: 0 }}>{s.value}</span>
                                    </motion.div>
                                ))}
                            </div>
                            {pmMarketplaces.length > 0 && (
                                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${C.glassBr}` }}>
                                    <p style={{ color: C.muted, fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.4rem" }}>{t("dashboard.marketplaceDistribution")}</p>
                                    {pmMarketplaces.map(pm => (
                                        <div key={pm.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0", gap: "0.5rem", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                                            <span style={{ color: C.text, fontSize: isMobile ? "0.7rem" : "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pm.name}</span>
                                            <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                                                <Pill color={C.green}>{pm.syncedProducts || 0} {t("dashboard.synced")}</Pill>
                                                {(pm.errorProducts || 0) > 0 && <Pill color={C.red}>{pm.errorProducts} {t("dashboard.errorProducts")}</Pill>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </GlassCard>
                    </div>

                    {/* ── UYARILAR + CİRO DAĞILIMI + HIZLI AKSİYONLAR ── */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? "0.75rem" : "1.5rem", marginBottom: "1.5rem" }}>

                        {/* Uyarılar */}
                        <GlassCard C={C}>
                            <SectionTitle C={C} icon="🚨" title={t("dashboard.alerts")} badge={alerts.length > 0 ? `${alerts.length}` : null} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {alerts.length > 0 ? alerts.slice(0, 5).map((alert, i) => (
                                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.03 }}
                                        style={{ background: `${C.red}08`, border: `1px solid ${C.red}18`, borderRadius: 8, padding: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, flexShrink: 0, animation: "pulse 2s infinite" }} />
                                        <p style={{ color: C.red, fontSize: "0.75rem", margin: 0, fontWeight: 600 }}>{alert}</p>
                                    </motion.div>
                                )) : (
                                    <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}18`, borderRadius: 8, padding: "0.8rem", textAlign: "center" }}>
                                        <p style={{ color: C.green, fontSize: "0.8rem", margin: 0, fontWeight: 600 }}>✅ {t("dashboard.allSystemsNormal")}</p>
                                    </div>
                                )}
                                {(summary.stockMismatchCount || 0) > 0 && (
                                    <div style={{ background: `${C.yellow}08`, border: `1px solid ${C.yellow}18`, borderRadius: 8, padding: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontSize: "0.85rem" }}>📦</span>
                                        <p style={{ color: C.yellow, fontSize: "0.75rem", margin: 0, fontWeight: 600 }}>{summary.stockMismatchCount} {t("dashboard.stockMismatchCount").toLowerCase()}</p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>

                        {/* Kanal Bazlı Ciro */}
                        <GlassCard C={C}>
                            <SectionTitle C={C} icon="💰" title={t("dashboard.channelRevenue")} badge={fmtCurrency(summary.todayRevenue || 0, language)} />
                            {todayBreakdown.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                    {todayBreakdown.map((b, i) => {
                                        const maxRev = Math.max(...todayBreakdown.map(x => x.revenue || 0), 1);
                                        const pct = ((b.revenue || 0) / maxRev) * 100;
                                        return (
                                            <motion.div key={b.marketplace} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                                    <span style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600 }}>{b.marketplace}</span>
                                                    <span style={{ color: C.green, fontSize: "0.78rem", fontWeight: 700 }}>{fmtCurrency(b.revenue, language)}</span>
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
                                <div style={{ textAlign: "center", padding: "1.5rem 0", color: C.dim, fontSize: "0.8rem" }}>📭 {t("dashboard.noData")}</div>
                            )}
                        </GlassCard>

                        {/* Hızlı Aksiyonlar */}
                        <GlassCard C={C}>
                            <SectionTitle C={C} icon="⚡" title={t("dashboard.quickActions")} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {[
                                    { label: t("dashboard.orderManagement"), icon: <FaClipboardList />, panel: "orders", color: C.accent },
                                    { label: t("dashboard.stockManagement"), icon: <FaBoxOpen />, panel: "inventory", color: C.green },
                                    { label: t("dashboard.productCenter"), icon: <FaCubes />, panel: "pm-center", color: C.purple },
                                    { label: t("dashboard.integrations"), icon: <FaPlug />, panel: "integration", color: C.blue },
                                    { label: t("dashboard.finance"), icon: <FaMoneyBillWave />, panel: "finance", color: C.yellow },
                                    { label: t("dashboard.shipping"), icon: <FaTruck />, panel: "shipping", color: C.pink },
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
                    <GlassCard C={C}>
                        <SectionTitle C={C} icon="📋" title={t("dashboard.operationLogs")}
                            action={
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => handlePanelChange("orders")}
                                    style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>
                                    {t("dashboard.viewAllLogs")}
                                </motion.button>
                            }
                        />
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: isMobile ? "0.35rem" : "0.4rem" }}>
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
                                    {t("dashboard.noLogs")}
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
                            style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
                            <motion.div initial={{ scale: isMobile ? 1 : 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: isMobile ? 1 : 0.92, y: 40 }}
                                onClick={e => e.stopPropagation()}
                                style={{ background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}f2 100%)`, border: `1px solid ${C.border}`, borderRadius: isMobile ? "20px 20px 0 0" : 20, padding: isMobile ? "1rem" : "clamp(1rem, 3vw, 2rem)", maxWidth: isMobile ? "100%" : 900, width: "100%", maxHeight: isMobile ? "85dvh" : "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

                                {/* Modal Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexShrink: 0 }}>
                                    <h2 style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: isMobile ? "1rem" : "1.3rem", fontWeight: 800, margin: 0 }}>
                                        📦 {t("dashboard.totalOrders")} ({allOrders.total})
                                    </h2>
                                    <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowOrderDetailsModal(false)}
                                        style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "1.2rem", fontWeight: 700 }}>
                                        ✕
                                    </motion.button>
                                </div>

                                {/* Status Tabs */}
                                <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.75rem", flexWrap: "nowrap", borderBottom: `1px solid ${C.glassBr}`, paddingBottom: "0.6rem", overflowX: "auto", WebkitOverflowScrolling: "touch", flexShrink: 0 }}>
                                    {[
                                        { id: "all", label: t("dashboard.all"), count: allOrders.total, color: C.accent },
                                        { id: "new", label: t("dashboard.newOrders"), count: allOrders.statusCounts.new, color: C.accent },
                                        { id: "processing", label: t("dashboard.processingOrders"), count: allOrders.statusCounts.processing, color: C.yellow },
                                        { id: "shipping", label: t("dashboard.shippingOrders"), count: allOrders.statusCounts.shipping, color: C.purple },
                                        { id: "delivered", label: t("dashboard.deliveredOrders"), count: allOrders.statusCounts.delivered, color: C.green },
                                        { id: "cancelled", label: t("dashboard.cancelledOrders"), count: allOrders.statusCounts.cancelled, color: C.red },
                                        { id: "returned", label: t("dashboard.returnedOrders"), count: allOrders.statusCounts.returned, color: C.yellow },
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
                                {!isMobile && (
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1fr", gap: "0.75rem", padding: "0.5rem 1rem", borderBottom: `2px solid ${C.accent}20`, marginBottom: "0.5rem", flexShrink: 0 }}>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("dashboard.orderNumber")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("dashboard.marketplace")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>{t("dashboard.amount")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>{t("dashboard.date")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>{t("dashboard.orderStatus")}</span>
                                </div>
                                )}

                                {/* Order Rows */}
                                <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                                    {(allOrders.byStatus[selectedOrderTab] || []).length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                            {allOrders.byStatus[selectedOrderTab].map((order, idx) => (
                                                isMobile ? (
                                                    /* ── Mobile: Card layout ── */
                                                    <motion.div key={`${order.orderNumber}-${idx}`}
                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                                                        style={{ background: idx % 2 === 0 ? C.glass : "transparent", border: `1px solid ${C.glassBr}`, borderRadius: 10, padding: "0.65rem 0.75rem", cursor: "default" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                                                            <span style={{ color: C.accent, fontSize: "0.75rem", fontWeight: 700 }}>{order.marketplace || "N/A"}</span>
                                                            <Pill color={
                                                                String(order.status || "").toLowerCase().includes("deliver") || String(order.status || "").toLowerCase().includes("teslim") ? C.green :
                                                                String(order.status || "").toLowerCase().includes("ship") || String(order.status || "").toLowerCase().includes("kargo") ? C.purple :
                                                                String(order.status || "").toLowerCase().includes("cancel") || String(order.status || "").toLowerCase().includes("iptal") ? C.red : C.yellow
                                                            }>
                                                                {order.status || t("dashboard.unknown")}
                                                            </Pill>
                                                        </div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <span style={{ color: C.dim, fontSize: "0.68rem", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>#{order.orderNumber || "N/A"}</span>
                                                            <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 800 }}>{fmtCurrency(order.totalPrice || 0, language)}</span>
                                                        </div>
                                                        <div style={{ color: C.dim, fontSize: "0.62rem", marginTop: "0.2rem" }}>
                                                            {order.orderDate ? new Date(order.orderDate).toLocaleString(language === "en" ? "en-US" : "tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    /* ── Desktop: Grid row layout ── */
                                                    <motion.div key={`${order.orderNumber}-${idx}`}
                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                                                        style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1fr", gap: "0.75rem", alignItems: "center", padding: "0.6rem 1rem", borderRadius: 8, background: idx % 2 === 0 ? C.glass : "transparent", border: `1px solid transparent`, transition: "background 0.15s ease, border-color 0.15s ease", cursor: "default" }}
                                                        whileHover={{ backgroundColor: `rgba(78,205,196,0.06)`, borderColor: `rgba(78,205,196,0.12)` }}>
                                                        <span style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.orderNumber || "N/A"}</span>
                                                        <span style={{ color: C.accent, fontSize: "0.8rem", fontWeight: 600 }}>{order.marketplace || "N/A"}</span>
                                                        <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 700, textAlign: "right" }}>{fmtCurrency(order.totalPrice || 0, language)}</span>
                                                        <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 500, textAlign: "center" }}>
                                                            {order.orderDate ? new Date(order.orderDate).toLocaleString(language === "en" ? "en-US" : "tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                                                        </span>
                                                        <div style={{ textAlign: "center" }}>
                                                            <Pill color={
                                                                String(order.status || "").toLowerCase().includes("deliver") || String(order.status || "").toLowerCase().includes("teslim") ? C.green :
                                                                String(order.status || "").toLowerCase().includes("ship") || String(order.status || "").toLowerCase().includes("kargo") ? C.purple :
                                                                String(order.status || "").toLowerCase().includes("cancel") || String(order.status || "").toLowerCase().includes("iptal") ? C.red : C.yellow
                                                            }>
                                                                {order.status || t("dashboard.unknown")}
                                                            </Pill>
                                                        </div>
                                                    </motion.div>
                                                )
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", color: C.dim }}>
                                            <span style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📭</span>
                                            <p style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{t("dashboard.noCategoryOrders")}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: `1px solid ${C.glassBr}`, marginTop: "0.5rem", flexShrink: 0 }}>
                                    <span style={{ color: C.dim, fontSize: "0.75rem" }}>
                                        {(allOrders.byStatus[selectedOrderTab] || []).length} {t("dashboard.showingOrders")}
                                    </span>
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => { setShowOrderDetailsModal(false); handlePanelChange("orders"); }}
                                        style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer", color: C.accent, fontSize: "0.78rem", fontWeight: 600 }}>
                                        {t("dashboard.goToOrderManagement")}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── TOAST BİLDİRİMLER (Sağ alt köşe) ── */}
                <div style={{ position: "fixed", bottom: isMobile ? 12 : 20, right: isMobile ? 12 : 20, left: isMobile ? 12 : "auto", zIndex: 9998, display: "flex", flexDirection: "column", gap: "0.5rem", pointerEvents: "none" }}>
                    <AnimatePresence>
                        {notifications.filter(n => !n.isRead).slice(0, isMobile ? 2 : 3).map((n, i) => {
                            const toastColor = n.type === "order" ? C.green : n.type === "admin" ? C.purple : n.type === "ai" ? C.blue : C.accent;
                            const toastIcon = n.icon || (n.type === "order" ? "🛒" : n.type === "admin" ? "📢" : n.type === "ai" ? "🧠" : "🔔");
                            return (
                                <motion.div key={n._id}
                                    initial={{ opacity: 0, x: 80, scale: 0.9 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 80, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                    style={{
                                        background: isDark ? "linear-gradient(135deg, #1a2332 0%, #0f1419 100%)" : "linear-gradient(135deg, #ffffff 0%, #f0f2f5 100%)",
                                        border: `1px solid ${toastColor}40`,
                                        borderRadius: 14, padding: isMobile ? "0.65rem 0.85rem" : "0.85rem 1.1rem",
                                        minWidth: isMobile ? "auto" : 300, maxWidth: isMobile ? "100%" : 380,
                                        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${toastColor}15`,
                                        pointerEvents: "auto",
                                        display: "flex", alignItems: "center", gap: "0.7rem",
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                        background: `linear-gradient(135deg, ${toastColor}, ${toastColor}99)`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.1rem", boxShadow: `0 4px 12px ${toastColor}40`,
                                    }}>
                                        {toastIcon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: C.text, fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>{n.title}</p>
                                        <p style={{ color: C.muted, fontSize: "0.72rem", margin: "0.1rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</p>
                                    </div>
                                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}
                                        onClick={() => { dismissNotif(n._id); }}
                                        style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.8rem", padding: "0.2rem", flexShrink: 0 }}>
                                        ✕
                                    </motion.button>
                                </motion.div>
                            );
                        })}
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
        { id: "category-center", icon: <FaSitemap />, text: t("sidebar.categoryCenter") },

        { type: "divider", label: t("sidebar.analytics") },
        { id: "advanced-analytics", icon: <FaChartBar />, text: t("sidebar.advancedAnalytics") },
        { id: "lysia-brain", icon: <FaBrain />, text: "LysiaBrain" },
        { id: "roketfy", icon: <FaRocket />, text: t("sidebar.roketfy") },
        { type: "divider", label: t("sidebar.management") },
        { id: "users", icon: <FaUsers />, text: t("sidebar.userMgmt") },
        { id: "billing", icon: <FaFileInvoice />, text: t("sidebar.billing") },
        { id: "subscription", icon: <FaCrown />, text: language === "en" ? "Subscription & Plans" : "Abonelik & Paket" },
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
                        <span className="submenu-item-text">{m.name || t("dashboard.unknownMarketplace")}</span>
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
            case "lysia-brain": return <LysiaBrain userId={userId} />;
            case "pm-center": return <ProductManagementCenter userId={userId} />;
            case "category-center": return <CategoryCenterPage userId={userId} />;

            case "settings": return <SettingsPage userId={userId} />;
            case "billing": return <BillingPage userId={userId} />;
            case "subscription": return <SubscriptionPage />;
            case "roketfy": return <RoketfyPanel />;
            case "admin-panel": return isAdmin ? <AdminPanelPage userId={userId} /> : null;
            case "dashboard": return renderDashboard();
            default: return null;
        }
    };

    return (
        <div className="dashboard-container">
            <Particles id="tsparticles" init={particlesInit}
                options={{
                    background: { color: C.particleBg || C.bg },
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

            {/* ── Mobile Hamburger Button ── */}
            <button
                className={`mobile-hamburger ${menuOpen && isMobile ? 'hidden' : ''}`}
                onClick={() => setMenuOpen(true)}
                aria-label="Menü"
            >
                <FaBars />
            </button>

            {/* ── Mobile Overlay ── */}
            <div
                className={`mobile-overlay ${menuOpen && isMobile ? 'visible' : ''}`}
                onClick={() => setMenuOpen(false)}
            />

            <motion.aside
                className={`sidebar ${menuOpen ? "open" : "closed"}`}
                animate={isMobile ? {} : { width: menuOpen ? 260 : 72 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
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
                                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}fa 100%)`,
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
                    className={`content-area${activePanel === "integration" ? " content-area--galaxy" : ""}${activePanel === "lysia-brain" ? " content-area--brain" : ""}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    style={{ color: C.text }}
                >
                    {renderActivePanel()}
                </motion.main>
            </AnimatePresence>

            {/* AI Operatör Chat Widget — Her sayfada görünür */}
            <AIChatWidget />
        </div>
    );
};

export default UserDashboard;
