import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import { getUserMarketplaces, fetchDashboardData, syncRecentOrders } from "../services/marketplaceApi";
import { getProductManagementDashboard } from "../services/productManagementApi";
import { getNotifications, markNotificationAsRead, dismissNotification as apiDismissNotif, createBulkOrderNotifications } from "../services/notificationApi";
import API, { logoutUser } from "../services/api";
import { useApp } from "../context/AppContext";
import MarketplaceIntegration from "../pages/MarketplaceIntegration";
import OrdersPage from "../pages/OrdersPage";
import ReturnsManagementPage from "../pages/ReturnsManagementPage";
import InventoryPage from "../pages/StockManagement";
import FinancePage from "../pages/FinancePage";
import CargoTrackingPage from "../pages/CargoTrackingPage";
import UserProfilePage from "../pages/UserProfilePage";
import AdvancedAnalytics from "../pages/AdvancedAnalytics";
import LysiaBrain from "../pages/lysiabrain/LysiaBrain";
import DashtockLogo from "../components/brand/DashtockLogo";
import { BRAND_NAME, BRAND_PANEL_SUB, formatBrandPageTitle } from "../constants/brand";
import AIChatWidget from "../components/AIChatWidget";
import { PageHelpProvider } from "../context/PageHelpContext";
import PageHelpButton, { PageHelpFloating } from "../components/help/PageHelpButton";
import ProductManagementCenter from "../pages/ProductManagementCenter";
import StoreEcommerceRouter from "../pages/store/StoreEcommerceRouter";
import EcommerceSectionPage from "../pages/ecommerce/EcommerceSectionPage";
import EcommerceHomePage from "../pages/ecommerce/EcommerceHomePage";
import EcommerceStoresPickerPage from "../pages/ecommerce/EcommerceStoresPickerPage";
import StoreCreationWizard from "../pages/ecommerce/onboarding/StoreCreationWizard";
import AppearanceMarketplacePage from "../pages/ecommerce/platform/AppearanceMarketplacePage";
import DomainWizardPage from "../pages/ecommerce/platform/DomainWizardPage";
import AppsMarketplacePage from "../pages/ecommerce/platform/AppsMarketplacePage";
import EcSalesChannelWorkspace from "./ecommerce/platform/EcSalesChannelWorkspace";
import EcommerceWbChannelHub from "../pages/ecommerce/EcommerceWbChannelHub";
import { isEcSalesChannelWorkspacePanel } from "../constants/ecStoreChannelNav";
import EcommercePlatformShell from "../components/ecommerce/platform/EcommercePlatformShell";
import EcommerceStoreSettingsHub from "../pages/ecommerce/platform/EcommerceStoreSettingsHub";
import EcommerceStoreReportsPage from "../pages/ecommerce/platform/EcommerceStoreReportsPage";
import { getActiveEcSite, setActiveEcSite, clearActiveEcSite } from "../utils/ecStoreContext";
import "../styles/ecommerceWbChannel.css";
import "../styles/ecommercePlatform.css";
import EcommerceProductsHub from "../pages/ecommerce/products/EcommerceProductsHub";
import EcommerceOrdersHub from "../pages/ecommerce/orders/EcommerceOrdersHub";
import EcommerceCustomersHub from "../pages/ecommerce/customers/EcommerceCustomersHub";
import EcommerceDiscountsHub from "../pages/ecommerce/discounts/EcommerceDiscountsHub";
import EcommerceInboxHub from "../pages/ecommerce/inbox/EcommerceInboxHub";
import MarketingHub from "../pages/marketing/MarketingHub";
import "../styles/ecommerceTheme.css";
import SellerVerificationPage from "../pages/store/SellerVerificationPage";
import {
    isStoreChannelView,
    isEcommerceMainPanel,
    normalizeStorePanel,
    getStoreNavLabel,
    getStoreRouterSection,
    buildEcommerceMainSubmenu,
    isEcommerceProductsPanel,
    isEcommerceOrdersPanel,
    isEcommerceCustomersPanel,
    isEcommerceDiscountsPanel,
    isEcommerceInboxPanel,
    STORE_CHANNEL_PANEL,
    ECOMMERCE_DEFAULT_PANEL,
    isEcWbChannelPanel,
    isEcWbFullBleedPanel,
    EC_WB_DEFAULT_PANEL,
    EC_WB_THEMES_EDITOR_PANEL,
    EC_WB_THEMES_MARKETPLACE_PANEL,
} from "../constants/ecommerceMenu";
import { isEcPlatformEditorPanel } from "../constants/ecommercePlatform";
import {
    buildMarketingSubmenu,
    isMarketingPanel,
    MARKETING_DEFAULT_PANEL,
} from "../constants/marketingMenu";
import CategoryCenterPage from "../pages/CategoryCenterPage";
import SettingsPage from "../pages/SettingsPage";
import SupportTicketsPage from "../pages/SupportTicketsPage";
import AdminPanelPage from "../pages/AdminPanelPage";
import BillingPage from "../pages/BillingPage";
import SubscriptionPage from "../pages/SubscriptionPage";
import RoketfyPanel from "../pages/RoketfyPanel";
import RadarProPage from "../pages/RadarProPage";
import ErrorCenterPage from "../pages/ErrorCenterPage";
import {
    FaBars, FaTimes, FaClipboardList, FaCog,
    FaChartLine, FaBoxOpen, FaMoneyBillWave,
    FaTruck, FaUsers, FaFileInvoice, FaPlug,
    FaChevronDown, FaBox, FaCrown,
    FaBrain, FaChartBar, FaBell, FaRocket, FaCrosshairs,
    FaCubes, FaSitemap, FaSignOutAlt, FaUserShield, FaStore,
    FaCloudUploadAlt, FaHeadset, FaBug, FaBookOpen, FaLock, FaArrowRight,
    FaGlobe, FaBullhorn, FaPalette, FaUndoAlt,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import {
    classifyOrderStatus,
    countActiveOrders,
    getOrderStatusLabelTr,
    parseOrderDateForDisplay,
    formatOrderNumberForDisplay,
} from "../utils/orderStatus";
import useMobileShell from "../utils/useMobileShell";
import usePlanEntitlements from "../hooks/usePlanEntitlements";
import { MENU_FEATURE_MAP } from "../constants/planFeatures";
import PlanFeatureGate from "../components/PlanFeatureGate";
import { KpiCard, Pill } from "../components/dashboard/DashboardUI";
import {
    DashboardHero,
    DashboardSpotlight,
    DashboardMarketplaceGrid,
    DashboardTrendChart,
    DashboardOrderTimeline
} from "../components/dashboard/DashboardHomeParts";
import ShippingLabelModal, { supportsCargoLabel } from "../components/orders/ShippingLabelModal";
import BulkShippingLabelModal from "../components/orders/BulkShippingLabelModal";
import "../styles/userDashboard.css";
import "../styles/dashboardHome.css";

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

const DASHBOARD_PANEL_STORAGE_KEY = "dashboardActivePanel";

const PANEL_DOC_TITLE = {
    dashboard: "Yönetim Paneli",
    integration: "Pazaryeri Entegrasyonu",
    orders: "Siparişler",
    inventory: "Stok",
    shipping: "Kargo",
    finance: "Finans",
    "pm-center": "Ürün Merkezi",
    "product-upload": "Ürün Yükle",
    ecommerce: "E-Ticaret",
    "ec-home": "Giriş",
    "ec-stores": "Mağazalarım",
    "ec-store-create": "Yeni mağaza",
    "ec-products": "Ürünler",
    "ec-products-purchase": "Satın Alma",
    "ec-product-add-simple": "Basit Ürün Ekle",
    "ec-product-add-variant": "Varyantlı Ürün Ekle",
    "ec-orders": "Siparişler",
    "ec-customers": "Müşteriler",
    "ec-discounts": "İndirimler",
    "ec-inbox": "Gelen Kutusu",
    "ec-reports": "Raporlar",
    "ec-settings": "Ayarlar",
    "store-channel": "Satış Kanalı",
    "store-themes": "Temalarım",
    "store-seo-domain": "SEO ve Alan Adı",
    "store-automations": "Otomasyonlar",
    "store-notifications": "Bildirimler",
    "store-localization": "Lokalizasyon",
    "store-payments": "Ödeme Ayarları",
    "store-seller-verify": "Satıcı Doğrulaması",
    "store-customers": "Müşteri Ayarları",
    "store-shipping": "Kargo Ayarları",
    "store-plugins": "Eklentiler",
    "store-blog": "Blog",
    "category-center": "Kategori Merkezi",
    "advanced-analytics": "Gelişmiş Analitik",
    "lysia-brain": "Dashtock AI",
    roketfy: "Ürün Araştırma",
    "radar-pro": "Fırsat Radarı",
    users: "Kullanıcılar",
    billing: "Faturalama",
    subscription: "Abonelik",
    "error-center": "Operasyon Defteri",
    support: "Destek",
    settings: "Ayarlar",
    "admin-panel": "Admin",
};

function resolveDashboardDocumentTitle(activePanel, marketplaces, language = "tr") {
    if (!activePanel) return formatBrandPageTitle(BRAND_PANEL_SUB);
    if (isEcommerceMainPanel(activePanel) || isEcWbChannelPanel(activePanel) || isStoreChannelView(activePanel)) {
        return formatBrandPageTitle(`E-Ticaret · ${getStoreNavLabel(activePanel, language)}`);
    }
    const dash = activePanel.indexOf("-");
    if (dash > 0) {
        const type = activePanel.slice(0, dash);
        const mpId = activePanel.slice(dash + 1);
        const base = PANEL_DOC_TITLE[type] || BRAND_PANEL_SUB;
        const mp = (marketplaces || []).find((m) => m._id === mpId);
        if (mp?.name) return formatBrandPageTitle(`${base} · ${mp.name}`);
        return formatBrandPageTitle(base);
    }
    return formatBrandPageTitle(PANEL_DOC_TITLE[activePanel] || BRAND_PANEL_SUB);
}

const getInitialDashboardPanel = () => {
    try {
        const v = localStorage.getItem(DASHBOARD_PANEL_STORAGE_KEY);
        if (v && typeof v === "string") return v;
    } catch {
        // no-op
    }
    return "dashboard";
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
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════ */
const resolvePanelFeatureId = (panelId) => {
    if (!panelId) return null;
    if (MENU_FEATURE_MAP[panelId]) return MENU_FEATURE_MAP[panelId];
    if (panelId === "store-payments") return "store_checkout";
    if (isMarketingPanel(panelId)) return "store_marketing";
    if (isEcommerceMainPanel(panelId)) return "own_storefront";
    if (panelId === STORE_CHANNEL_PANEL || panelId.startsWith("store-") || panelId === "store-hub") return "own_storefront";
    const base = String(panelId).split("-")[0];
    return MENU_FEATURE_MAP[base] || null;
};

const UserDashboard = () => {
    const navigate = useNavigate();
    const { theme: C, t, language, resolvedTheme } = useApp();
    const {
        loading: entitlementsLoading,
        canAccess,
        planDisplayName,
        upgradeHint
    } = usePlanEntitlements();
    const isDark = resolvedTheme === "dark";
    const [menuOpen, setMenuOpen] = useState(true);
    const [activePanel, setActivePanel] = useState(getInitialDashboardPanel);
    const [ecActiveSite, setEcActiveSiteState] = useState(() => getActiveEcSite());
    const [ecWbEditorIntent, setEcWbEditorIntent] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const userRole = localStorage.getItem("userRole") || "user";


    const [marketplaces, setMarketplaces] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardError, setDashboardError] = useState("");
    const [subscriptionExpired, setSubscriptionExpired] = useState(false);
    const [subscriptionMessage, setSubscriptionMessage] = useState("");
    const [subscriptionDetail, setSubscriptionDetail] = useState(null);
    // Erişim engellendi (rate-limit aşımı, admin blok, vs.) — banner + yardım butonu
    const [accessBlocked, setAccessBlocked] = useState(null);
    const [helpSending, setHelpSending] = useState(false);
    const [helpSent, setHelpSent] = useState(false);
    const [helpError, setHelpError] = useState("");
    const [pmDashboard, setPmDashboard] = useState(null);

    // Tek bir state ile tüm submenu'leri yönet — aynı anda sadece 1 submenu açık
    const [openSubmenu, setOpenSubmenu] = useState(null);
    const [marketingGroupOpen, setMarketingGroupOpen] = useState({
        "mkt-campaigns-group": false,
    });
    const [ecommerceGroupOpen, setEcommerceGroupOpen] = useState({
        "ec-products-group": false,
        "ec-orders-group": false,
        "ec-customers-group": false,
        "ec-discounts-group": false,
    });

    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
    const [labelOrder, setLabelOrder] = useState(null);
    const [bulkLabelOpen, setBulkLabelOpen] = useState(false);
    const [selectedOrderTab, setSelectedOrderTab] = useState("all");

    // ── Bildirim Sistemi (Persistent Backend) ──
    const [notifications, setNotifications] = useState([]);
    const [notifCounts, setNotifCounts] = useState({ total: 0, order: 0, admin: 0, ai: 0, stock: 0, system: 0 });
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [notifSoundEnabled, setNotifSoundEnabled] = useState(true);
    const [notifFilter, setNotifFilter] = useState("all"); // all, order, admin, ai
    /** Sağ alt toast — 10 sn sonra gizlenir (zil panelinde okunmamış kalabilir) */
    const [toastHiddenIds, setToastHiddenIds] = useState(() => new Set());
    const toastAutoHideTimers = useRef(new Map());
    const TOAST_AUTO_HIDE_MS = 10000;

    const lastCheckRef = useRef(null);

    const userId = localStorage.getItem("userId");
    const isImpersonating = localStorage.getItem("isImpersonating") === "true";

    // ── Abonelik süresi dolmuş global event dinleyicisi ──
    // Code'a göre farklı mesaj göster:
    //   TRIAL_ENDED        → Demo bitti, paket al
    //   SUBSCRIPTION_EXPIRED → Aboneliği yenile
    //   SUBSCRIPTION_SUSPENDED → Hesap askıya alındı, destek
    //   NO_SUBSCRIPTION    → Aktif aboneliğin yok
    useEffect(() => {
        const handler = (e) => {
            setSubscriptionExpired(true);
            const detail = e.detail || {};
            setSubscriptionDetail(detail);
            // Code yoksa default mesajı kullan
            setSubscriptionMessage(detail.message || "Abonelik süreniz dolmuştur.");
        };
        window.addEventListener("api:subscription-expired", handler);
        return () => window.removeEventListener("api:subscription-expired", handler);
    }, []);

    // ── Erişim engellendi (ACCESS_BLOCKED) dinleyicisi ──
    // 403 + code=ACCESS_BLOCKED gelirse api.js global event tetikler.
    // Kullanıcıya banner göster, "Yardım talep et" butonuyla admin'e bildirim attır.
    useEffect(() => {
        const handler = (e) => {
            setAccessBlocked(e.detail || { message: "Erişiminiz engellendi." });
            setHelpSent(false);
            setHelpError("");
        };
        window.addEventListener("api:access-blocked", handler);
        return () => window.removeEventListener("api:access-blocked", handler);
    }, []);

    // Blok banner açıkken durum bilgisini soft-auth endpoint ile güncelle (403 döngüsünden bağımsız)
    useEffect(() => {
        if (!accessBlocked) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await API.get("/access/my-status");
                if (cancelled || !res.data?.success) return;
                const acc = res.data.accessStatus || {};
                const blockedReason = res.data.reasons?.find((r) => r.code === "ACCESS_BLOCKED");
                setAccessBlocked((prev) => ({
                    ...(prev || {}),
                    message: blockedReason?.detail || prev?.message,
                    expiresAt: acc.blockExpiresAt || prev?.expiresAt,
                    note: acc.blockNote || prev?.note,
                    reason: acc.blockReason || prev?.reason,
                    canRequestHelp: true,
                }));
                const hadHelp = (res.data.recentIncidents || []).some(
                    (i) => i.type === "help_request" && Date.now() - new Date(i.createdAt).getTime() < 24 * 60 * 60 * 1000
                );
                if (hadHelp) setHelpSent(true);
            } catch (_) { /* sessiz */ }
        })();
        return () => { cancelled = true; };
    }, [accessBlocked?.timestamp, accessBlocked?.reason]);

    // ── Responsive (matchMedia — orientation / tarayıcı chrome uyumlu) ──
    const shell = useMobileShell({ lockScroll: true, scrollLocked: menuOpen, setHtmlClasses: false });
    useEffect(() => {
        setIsMobile(shell.isMobile);
        if (shell.isMobile && menuOpen) setMenuOpen(false);
        if (!shell.isMobile && !menuOpen) setMenuOpen(true);
    }, [shell.isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (shell.isMobile) setMenuOpen(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePanelChange = useCallback((panelId) => {
        let nextPanel = panelId;
        if (panelId === STORE_CHANNEL_PANEL) {
            nextPanel = STORE_CHANNEL_PANEL;
        } else if (panelId && (panelId.startsWith("store-") || panelId === "store-hub")) {
            nextPanel = normalizeStorePanel(panelId);
        }
        const featureId = resolvePanelFeatureId(nextPanel);
        if (featureId && !entitlementsLoading && !canAccess(featureId)) {
            setActivePanel("subscription");
            if (isMobile) setMenuOpen(false);
            return;
        }
        setActivePanel(nextPanel);
        if (isMobile) setMenuOpen(false);
    }, [isMobile, entitlementsLoading, canAccess]);

    const enterEcStore = useCallback(
        (site) => {
            const ctx = setActiveEcSite(site);
            setEcActiveSiteState(ctx);
            handlePanelChange("ec-home");
        },
        [handlePanelChange]
    );

    const exitToMainProgram = useCallback(() => {
        clearActiveEcSite();
        setEcActiveSiteState(null);
        handlePanelChange("dashboard");
    }, [handlePanelChange]);

    const inEcPicker = activePanel === "ec-stores";
    const inEcWbFullBleed = isEcWbFullBleedPanel(activePanel);
    const inEcEditor = isEcPlatformEditorPanel(activePanel);
    /** V6 — tek platform kabuğu (ec-* + ec-wb-* birlikte) */
    const inEcPlatformWorkspace =
        !!ecActiveSite &&
        activePanel !== "ec-stores" &&
        isEcommerceMainPanel(activePanel);
    const hideErpSidebar = inEcPicker || inEcPlatformWorkspace;

    useEffect(() => {
        if (
            isEcommerceMainPanel(activePanel) &&
            activePanel !== "ec-stores" &&
            activePanel !== "ec-store-create" &&
            !ecActiveSite
        ) {
            handlePanelChange("ec-stores");
        }
    }, [activePanel, ecActiveSite, handlePanelChange]);

    const openEcStoreChannel = useCallback(() => {
        handlePanelChange(EC_WB_DEFAULT_PANEL);
    }, [handlePanelChange]);

    const openEcStoreEditor = useCallback((intent) => {
        if (ecActiveSite?.id) {
            navigate(`/website-builder/${ecActiveSite.id}/themes/editor`);
            return;
        }
        setEcWbEditorIntent(intent || null);
        handlePanelChange(EC_WB_THEMES_EDITOR_PANEL);
    }, [ecActiveSite, navigate, handlePanelChange]);

    useEffect(() => {
        document.title = resolveDashboardDocumentTitle(activePanel, marketplaces, language);
    }, [activePanel, marketplaces, language]);

    useEffect(() => {
        if (isEcommerceMainPanel(activePanel)) setOpenSubmenu("ecommerce");
        if (isMarketingPanel(activePanel)) setOpenSubmenu("marketing");
    }, [activePanel]);

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const panel = params.get("panel");
            const oauth = params.get("inbox_oauth");
            if (panel) {
                setActivePanel(panel);
                localStorage.setItem(DASHBOARD_PANEL_STORAGE_KEY, panel);
                if (panel.startsWith("ec-inbox")) setOpenSubmenu("ecommerce");
            }
            if (oauth) {
                sessionStorage.setItem("inbox_oauth_result", oauth);
                const err = params.get("inbox_error");
                if (err) sessionStorage.setItem("inbox_oauth_error", err);
                const kind = params.get("inbox_oauth_kind");
                if (kind) sessionStorage.setItem("inbox_oauth_kind", kind);
            }
            if (panel || oauth) {
                const url = new URL(window.location.href);
                url.searchParams.delete("panel");
                url.searchParams.delete("inbox_oauth");
                url.searchParams.delete("inbox_error");
                url.searchParams.delete("inbox_oauth_kind");
                window.history.replaceState({}, "", url.pathname + url.search + url.hash);
            }
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        const removed = ["ec-marketing", "ec-apps", "app-store", "my-apps", "marketing-email", "marketing-automation", "marketing-segments", "marketing-popup", "marketing-discounts"];
        if (
            removed.includes(activePanel) ||
            activePanel?.startsWith("ecommerce-")
        ) {
            setActivePanel(
                activePanel?.startsWith("ec-") || activePanel?.startsWith("ecommerce-")
                    ? ECOMMERCE_DEFAULT_PANEL
                    : "dashboard"
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca kayıtlı panel geri yükleme
    }, []);

    // Refresh sonrası aynı panelde kalması için activePanel'i sakla
    useEffect(() => {
        try {
            if (activePanel) {
                localStorage.setItem(DASHBOARD_PANEL_STORAGE_KEY, activePanel);
            }
        } catch {
            // no-op
        }
    }, [activePanel]);

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

    // ── Sipariş bildirimlerini backend'e kaydet (yalnızca İstanbul takvimine göre bugün) ──
    const syncOrderNotifications = useCallback(async (data) => {
        if (!data?.marketplaceStatus) return;
        const isOrderDateTodayIstanbul = (orderDate) => {
            if (!orderDate) return false;
            const t = new Date(orderDate);
            if (Number.isNaN(t.getTime())) return false;
            const tz = "Europe/Istanbul";
            const dStr = t.toLocaleDateString("en-CA", { timeZone: tz });
            const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
            return dStr === todayStr;
        };
        try {
            const orders = [];
            Object.entries(data.marketplaceStatus).forEach(([mp, mpData]) => {
                if (mpData.orderDetails && Array.isArray(mpData.orderDetails)) {
                    mpData.orderDetails.forEach((o) => {
                        if (o.orderNumber && isOrderDateTodayIstanbul(o.orderDate)) {
                            orders.push({
                                orderNumber: o.orderNumber,
                                marketplace: mp,
                                totalPrice: o.totalPrice || 0,
                                itemCount: o.items?.length || 1,
                                customerName: o.customerName || "",
                                status: o.status || "Created",
                                orderDate: o.orderDate,
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

    const notifFilterRef = useRef(notifFilter);
    useEffect(() => {
        notifFilterRef.current = notifFilter;
    }, [notifFilter]);

    const pollNotifications = useCallback(async () => {
        try {
            const params = {};
            if (lastCheckRef.current) params.lastCheck = lastCheckRef.current;
            if (notifFilterRef.current !== "all") params.type = notifFilterRef.current;
            params.limit = 50;
            const data = await getNotifications(params);
            const serverNotifs = data.notifications || [];
            if (lastCheckRef.current && serverNotifs.length > 0) {
                setNotifications((prev) => {
                    const existingIds = new Set(prev.map((n) => n._id));
                    const newOnes = serverNotifs.filter((n) => !existingIds.has(n._id));
                    return [...newOnes, ...prev].slice(0, 100);
                });
                const newCount = serverNotifs.filter((n) => !n.isRead).length;
                if (newCount > 0 && notifSoundEnabled) playNotificationSound();
            } else if (!lastCheckRef.current) {
                setNotifications(serverNotifs);
            }
            setNotifCounts(data.counts || { total: 0, order: 0, admin: 0, ai: 0, stock: 0, system: 0 });
            if (data.serverTime) lastCheckRef.current = data.serverTime;
        } catch { /* sessiz */ }
    }, [notifSoundEnabled]);

    const dashboardPanelActive = activePanel === "dashboard";
    const pmPanelActive = activePanel === "pm-center" || activePanel === "product-upload";
    const orderNotifSyncedRef = useRef(false);
    const orderSyncInFlightRef = useRef(false);
    const lastOrderSyncAtRef = useRef(0);
    const prevOrderNotifCountRef = useRef(0);

    const DASHBOARD_DATA_POLL_MS = 30000;
    const DASHBOARD_ORDER_SYNC_MS = 90000;
    const DASHBOARD_ORDER_SYNC_MIN_GAP_MS = 60000;

    const refreshDashboard = useCallback(async ({ bustCache = false, showSpinner = false } = {}) => {
        if (!userId) return;
        if (showSpinner) {
            setDashboardLoading(true);
            setDashboardError("");
        }
        try {
            const data = await fetchDashboardData({ refresh: bustCache });
            setDashboardData(data);
            if (!orderNotifSyncedRef.current) {
                syncOrderNotifications(data);
                orderNotifSyncedRef.current = true;
            }
        } catch (e) {
            console.error("Dashboard verileri yüklenirken hata:", e);
            if (e.subscriptionExpired || (e.response?.status === 403 && e.response?.data?.subscriptionExpired)) {
                setSubscriptionExpired(true);
                setSubscriptionMessage(e.response?.data?.message || e.message || "Abonelik süreniz dolmuştur.");
                setDashboardError("");
            } else if (showSpinner) {
                setDashboardError("Veriler yüklenemedi.");
            }
        } finally {
            if (showSpinner) setDashboardLoading(false);
        }
    }, [userId, syncOrderNotifications]);

    const syncMarketplaceOrders = useCallback(async () => {
        if (!userId || orderSyncInFlightRef.current) return;
        const now = Date.now();
        if (now - lastOrderSyncAtRef.current < DASHBOARD_ORDER_SYNC_MIN_GAP_MS) return;
        orderSyncInFlightRef.current = true;
        lastOrderSyncAtRef.current = now;
        try {
            await syncRecentOrders();
            await refreshDashboard({ bustCache: true, showSpinner: false });
        } catch (e) {
            console.warn("Sipariş senkronizasyonu:", e?.message || e);
            await refreshDashboard({ bustCache: true, showSpinner: false });
        } finally {
            orderSyncInFlightRef.current = false;
        }
    }, [userId, refreshDashboard]);

    // ── Ana sayfa: önce hızlı DB özeti, arka planda pazaryeri sync ──
    useEffect(() => {
        if (!userId || !dashboardPanelActive) return;

        orderNotifSyncedRef.current = false;

        refreshDashboard({ bustCache: false, showSpinner: true });
        syncMarketplaceOrders();

        const dataPollId = setInterval(() => {
            if (document.visibilityState === "visible") {
                refreshDashboard({ bustCache: false, showSpinner: false });
            }
        }, DASHBOARD_DATA_POLL_MS);

        const syncPollId = setInterval(() => {
            if (document.visibilityState === "visible") {
                syncMarketplaceOrders();
            }
        }, DASHBOARD_ORDER_SYNC_MS);

        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            refreshDashboard({ bustCache: false, showSpinner: false });
            if (Date.now() - lastOrderSyncAtRef.current >= DASHBOARD_ORDER_SYNC_MIN_GAP_MS) {
                syncMarketplaceOrders();
            }
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearInterval(dataPollId);
            clearInterval(syncPollId);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [userId, dashboardPanelActive, refreshDashboard, syncMarketplaceOrders]);

    // Yeni sipariş bildirimi → hemen pazaryeri sync + kart güncelle
    useEffect(() => {
        if (!dashboardPanelActive) return;
        const orderCount = notifCounts.order || 0;
        if (orderCount > prevOrderNotifCountRef.current) {
            syncMarketplaceOrders();
        }
        prevOrderNotifCountRef.current = orderCount;
    }, [notifCounts.order, dashboardPanelActive, syncMarketplaceOrders]);

    const openOrdersModal = useCallback(() => {
        setSelectedOrderTab("all");
        setShowOrderDetailsModal(true);
    }, []);

    const marketplaceIdByKey = useMemo(() => {
        const map = new Map();
        (marketplaces || []).forEach((mp) => {
            const key = String(mp.marketplaceName || "").toLowerCase().trim();
            if (key) map.set(key, mp._id);
        });
        return map;
    }, [marketplaces]);

    const resolveDashboardMarketplaceId = useCallback(
        (order) => {
            if (order?.marketplaceId) return order.marketplaceId;
            const name = String(order?.marketplace || order?.marketplaceName || "").toLowerCase();
            for (const [k, id] of marketplaceIdByKey) {
                if (name.includes(k) || k.includes(name.replace(/\s/g, ""))) return id;
            }
            return undefined;
        },
        [marketplaceIdByKey]
    );

    const normalizeDashboardOrderForLabel = useCallback(
        (order) => {
            const orderNo = String(order.orderNumber || formatOrderNumberForDisplay(order) || "").trim();
            return {
                marketplace: order.marketplace || order.marketplaceName,
                marketplaceName: order.marketplace || order.marketplaceName,
                marketplaceId: resolveDashboardMarketplaceId(order),
                orderNumber: orderNo,
                trackingNumber: orderNo,
                _id: order._id,
                packageNumber: order.packageNumber || "",
                cargoTrackingNumber: order.cargoTrackingNumber || "",
                shipmentPackageId: order.shipmentPackageId || "",
                cargoTrackingLink: order.cargoTrackingLink || "",
                orderItemId: order.orderItemId || "",
                customerName: order.customerName || order.customer || "",
            };
        },
        [resolveDashboardMarketplaceId]
    );

    const openDashboardCargoLabel = useCallback(
        (order) => {
            setLabelOrder(normalizeDashboardOrderForLabel(order));
        },
        [normalizeDashboardOrderForLabel]
    );

    // ── Bildirim Polling ──
    useEffect(() => {
        if (!userId) return;
        loadNotifications();
    }, [userId, notifFilter, loadNotifications]);

    useEffect(() => {
        if (!userId) return;
        pollNotifications();
        const iv = setInterval(() => {
            if (document.visibilityState === "visible") pollNotifications();
        }, 45000);
        return () => clearInterval(iv);
    }, [userId, pollNotifications]);

    const hideToastNotif = useCallback((id) => {
        const sid = String(id);
        const timer = toastAutoHideTimers.current.get(sid);
        if (timer) {
            clearTimeout(timer);
            toastAutoHideTimers.current.delete(sid);
        }
        setToastHiddenIds((prev) => {
            if (prev.has(sid)) return prev;
            const next = new Set(prev);
            next.add(sid);
            return next;
        });
    }, []);

    useEffect(() => {
        const visibleIds = notifications
            .filter((n) => !n.isRead && !toastHiddenIds.has(String(n._id)))
            .slice(0, isMobile ? 2 : 3)
            .map((n) => String(n._id));

        visibleIds.forEach((id) => {
            if (toastAutoHideTimers.current.has(id)) return;
            const timer = setTimeout(() => hideToastNotif(id), TOAST_AUTO_HIDE_MS);
            toastAutoHideTimers.current.set(id, timer);
        });

        for (const [id, timer] of [...toastAutoHideTimers.current.entries()]) {
            if (!visibleIds.includes(id)) {
                clearTimeout(timer);
                toastAutoHideTimers.current.delete(id);
            }
        }
    }, [notifications, toastHiddenIds, isMobile, hideToastNotif]);

    useEffect(() => () => {
        toastAutoHideTimers.current.forEach((t) => clearTimeout(t));
        toastAutoHideTimers.current.clear();
    }, []);

    // ── Ürün Yönetimi Dashboard — yalnızca PM panelinde ──
    useEffect(() => {
        if (!userId || !pmPanelActive) return;
        (async () => {
            try {
                const res = await getProductManagementDashboard();
                setPmDashboard(res?.dashboard || null);
            } catch { /* sessiz */ }
        })();
    }, [userId, pmPanelActive]);

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
        hideToastNotif(id);
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

    const emptyOrderState = {
        all: [],
        byStatus: { all: [], new: [], processing: [], shipping: [], delivered: [], cancelled: [], returned: [] },
        total: 0,
        statusCounts: { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 },
    };

    /** Sipariş modalı — backend ordersModal (tek kaynak) */
    const allOrders = useMemo(() => {
        const modal = dashboardData?.ordersModal;
        if (modal && Array.isArray(modal.orders)) {
            return {
                all: modal.orders,
                byStatus: modal.byStatus || { all: modal.orders },
                total: modal.total ?? modal.orders.length,
                statusCounts: modal.statusCounts || emptyOrderState.statusCounts,
            };
        }
        if (!dashboardData?.marketplaceStatus) return emptyOrderState;

        const orders = [];
        const sc = { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 };
        Object.entries(dashboardData.marketplaceStatus).forEach(([marketplace, data]) => {
            (data.orderDetails || []).forEach((o) => {
                orders.push({
                    ...o,
                    marketplace,
                    _id: o._id,
                    packageNumber: o.packageNumber,
                    cargoTrackingNumber: o.cargoTrackingNumber,
                    shipmentPackageId: o.shipmentPackageId,
                    cargoTrackingLink: o.cargoTrackingLink,
                    orderItemId: o.orderItemId,
                    marketplaceId: o.marketplaceId,
                });
                const bucket = classifyOrderStatus(o.status, marketplace);
                if (sc[bucket] !== undefined) sc[bucket]++;
            });
        });
        const byStatus = { all: orders };
        ["new", "processing", "shipping", "delivered", "cancelled", "returned"].forEach((k) => {
            byStatus[k] = orders.filter((o) => classifyOrderStatus(o.status, o.marketplace) === k);
        });
        return { all: orders, byStatus, total: orders.length, statusCounts: sc };
    }, [dashboardData]);

    const activeOrderCount = useMemo(() => {
        if (dashboardData?.summary?.activeOrders != null) {
            return Number(dashboardData.summary.activeOrders) || 0;
        }
        if (dashboardData?.ordersModal?.activeOrderCount != null) {
            return Number(dashboardData.ordersModal.activeOrderCount) || 0;
        }
        return countActiveOrders(allOrders.statusCounts);
    }, [dashboardData, allOrders.statusCounts]);

    const trendOrderTotal = trends.orderCounts.reduce((s, v) => s + v, 0);
    const trendRevenueTotal = trends.revenueTotals.reduce((s, v) => s + v, 0);
    const orderTrendMax = Math.max(...trends.orderCounts, 1);
    const revenueTrendMax = Math.max(...trends.revenueTotals, 1);
    const orders24h = summary.orders24h ?? summary.todayOrders ?? 0;
    const revenue24h = summary.revenue24h ?? summary.todayRevenue ?? 0;
    const avgOrderValue = orders24h > 0 ? revenue24h / orders24h : 0;
    const revenueBreakdown = useMemo(() => {
        const day = summary.revenueDay ?? 0;
        const month = summary.revenueMonth ?? 0;
        const year = summary.revenueYear ?? 0;
        return language === "en"
            ? [
                { label: "Daily", value: fmtCurrency(day, language) },
                { label: "Monthly", value: fmtCurrency(month, language) },
                { label: "Yearly", value: fmtCurrency(year, language) },
            ]
            : [
                { label: "Günlük", value: fmtCurrency(day, language) },
                { label: "Aylık", value: fmtCurrency(month, language) },
                { label: "Yıllık", value: fmtCurrency(year, language) },
            ];
    }, [summary.revenueDay, summary.revenueMonth, summary.revenueYear, language]);

    /** Pazaryeri bazında bugünkü ciro (İstanbul takvimi) */
    const marketplaceDayRevenue = useMemo(() => {
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
        const totals = new Map();

        const addOrder = (o) => {
            if (!o?.orderDate) return;
            const t = new Date(o.orderDate);
            if (Number.isNaN(t.getTime())) return;
            if (t.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) !== todayStr) return;
            const mp = o.marketplace || o.marketplaceName || "—";
            totals.set(mp, (totals.get(mp) || 0) + Number(o.totalPrice || 0));
        };

        allOrders.all.forEach(addOrder);

        if (totals.size > 0) {
            return Array.from(totals.entries())
                .map(([name, revenue]) => ({ name, revenue }))
                .filter((r) => r.revenue > 0)
                .sort((a, b) => b.revenue - a.revenue);
        }

        return (todayBreakdown || [])
            .filter((b) => (b.revenue || 0) > 0)
            .map((b) => ({ name: b.marketplace, revenue: b.revenue }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [allOrders, todayBreakdown]);

    const formatOrderDate = (orderDate) => {
        const d = parseOrderDateForDisplay(orderDate);
        if (!d) return "N/A";
        return d.toLocaleString(language === "en" ? "en-US" : "tr-TR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

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
        const dateStr = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
        const userName = (localStorage.getItem("userName") || "").trim();
        const displayName = userName ? userName.split(" ")[0] : (language === "en" ? "there" : "");
        const greeting = displayName
            ? `${t(getGreetingKey())}, ${displayName}`
            : t(getGreetingKey());

        const quickActions = [
            { label: t("dashboard.orderManagement"), icon: <FaClipboardList />, panel: "orders", color: C.accent },
            { label: t("dashboard.productCenter"), icon: <FaCubes />, panel: "pm-center", color: C.purple },
            { label: t("dashboard.integrations"), icon: <FaPlug />, panel: "integration", color: C.blue },
            { label: t("dashboard.finance"), icon: <FaMoneyBillWave />, panel: "finance", color: C.green },
            { label: t("sidebar.advancedAnalytics"), icon: <FaChartBar />, panel: "advanced-analytics", color: C.yellow },
            { label: t("sidebar.categoryCenter"), icon: <FaSitemap />, panel: "category-center", color: C.pink || "#ec4899" },
        ];

        const healthItems = [
            { label: t("dashboard.activeChannels"), value: summary.activeMarketplaces || 0, color: C.green },
            { label: t("dashboard.error"), value: diagnostics.errorCount || 0, color: (diagnostics.errorCount || 0) > 0 ? C.red : C.green },
            { label: t("dashboard.pendingSync"), value: summary.pendingSync || 0, color: (summary.pendingSync || 0) > 0 ? C.yellow : C.green },
            { label: t("dashboard.stockMismatch"), value: summary.stockMismatchCount || 0, color: (summary.stockMismatchCount || 0) > 0 ? C.yellow : C.green },
            { label: t("dashboard.lastUpdate"), value: summary.lastIntegrationUpdate ? new Date(summary.lastIntegrationUpdate).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : "—", color: C.accent },
        ];

        const opsScore = Math.max(
            28,
            Math.min(
                100,
                100
                    - Math.min(40, (diagnostics.errorCount || 0) * 10)
                    - Math.min(25, (summary.pendingSync || 0) * 5)
                    - Math.min(20, (summary.stockMismatchCount || 0) * 4)
            )
        );

        return (
            <div className={`dashboard-home-layout${isDark ? "" : " dashboard-home-layout--light"}`} style={{ background: C.bg }}>

                <DashboardHero
                    BRAND_NAME={BRAND_NAME}
                    greeting={greeting}
                    dateStr={dateStr}
                    timeStr={timeStr}
                    activeChannels={summary.activeMarketplaces || 0}
                    planDisplayName={planDisplayName}
                    opsScore={opsScore}
                    dashboardLoading={dashboardLoading}
                    isDark={isDark}
                    isMobile={isMobile}
                    C={C}
                    unreadCount={unreadCount}
                    onNotifToggle={() => setShowNotifPanel(!showNotifPanel)}
                    language={language}
                />

                <div className="dashboard-home-body">

                {/* ✅ Abonelik / Trial / Suspended uyarısı — code'a göre farklılaşır */}
                {subscriptionExpired && (() => {
                    const code = subscriptionDetail?.code || "SUBSCRIPTION_EXPIRED";
                    const presets = {
                        TRIAL_ENDED: {
                            icon: "⏳", title: "Demo Süreniz Doldu",
                            desc: subscriptionMessage || "Demo sürenizin sonuna geldiniz. Dashtock AI'i kullanmaya devam etmek için bir paket seçin.",
                            cta: "🚀 Paketleri İncele", border: C.yellow,
                        },
                        SUBSCRIPTION_EXPIRED: {
                            icon: "⏰", title: "Abonelik Süreniz Doldu",
                            desc: subscriptionMessage || "Aboneliğinizin süresi doldu. Yenileyerek hizmete devam edebilirsiniz.",
                            cta: "🔄 Aboneliği Yenile", border: C.yellow,
                        },
                        SUBSCRIPTION_SUSPENDED: {
                            icon: "⛔", title: "Hesabınız Askıya Alındı",
                            desc: subscriptionMessage || "Hesabınız geçici olarak askıya alındı. Destek ekibimizle iletişime geçin.",
                            cta: "💬 Destek ile İletişim", border: C.red,
                        },
                        NO_SUBSCRIPTION: {
                            icon: "📭", title: "Aktif Aboneliğiniz Yok",
                            desc: subscriptionMessage || "Hesabınızda aktif bir abonelik bulunmuyor. Bir paket seçerek başlayın.",
                            cta: "🚀 Paket Seç", border: C.yellow,
                        },
                    };
                    const p = presets[code] || presets.SUBSCRIPTION_EXPIRED;
                    const isSuspended = code === "SUBSCRIPTION_SUSPENDED";
                    return (
                        <div style={{
                            background: `linear-gradient(135deg, ${p.border}15, ${C.orange || "#f97316"}15)`,
                            border: `1px solid ${p.border}50`,
                            padding: isMobile ? "1rem" : "1.25rem 2rem",
                            display: "flex", flexDirection: isMobile ? "column" : "row",
                            alignItems: isMobile ? "flex-start" : "center",
                            gap: "1rem", justifyContent: "space-between"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <span style={{ fontSize: "1.5rem" }}>{p.icon}</span>
                                <div>
                                    <div style={{ color: C.text, fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                                        {p.title}
                                    </div>
                                    <div style={{ color: C.muted, fontSize: "0.8rem" }}>
                                        {p.desc}
                                    </div>
                                    {subscriptionDetail?.plan && (
                                        <div style={{ color: C.muted, fontSize: "0.7rem", marginTop: 4, opacity: 0.8 }}>
                                            Plan: <strong style={{ color: C.text }}>{subscriptionDetail.plan}</strong>
                                            {subscriptionDetail.endDate && <> · Bitiş: <strong style={{ color: C.text }}>{new Date(subscriptionDetail.endDate).toLocaleDateString("tr-TR")}</strong></>}
                                            {subscriptionDetail.trialEndDate && !subscriptionDetail.endDate && <> · Trial bitiş: <strong style={{ color: C.text }}>{new Date(subscriptionDetail.trialEndDate).toLocaleDateString("tr-TR")}</strong></>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handlePanelChange(isSuspended ? "support" : "subscription")}
                                style={{
                                    background: `linear-gradient(135deg, ${isSuspended ? C.red : C.accent}, ${C.purple})`,
                                    color: "#fff", border: "none", borderRadius: 10,
                                    padding: "0.6rem 1.5rem", fontWeight: 700, fontSize: "0.85rem",
                                    cursor: "pointer", whiteSpace: "nowrap",
                                    boxShadow: `0 4px 12px ${(isSuspended ? C.red : C.accent)}40`
                                }}
                            >
                                {p.cta}
                            </button>
                        </div>
                    );
                })()}

                {dashboardError && !subscriptionExpired && (
                    <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, padding: "0.6rem 2rem", color: C.red, fontSize: "0.8rem" }}>
                        ⚠️ {dashboardError}
                    </div>
                )}

                {/* ── Erişim Engellendi Bannerı ── */}
                {accessBlocked && (
                    <div style={{
                        background: `linear-gradient(135deg, ${C.red}15, ${C.purple}15)`,
                        border: `1px solid ${C.red}55`,
                        padding: isMobile ? "1rem" : "1.25rem 2rem",
                        display: "flex", flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "flex-start" : "center",
                        gap: "1rem", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                            <span style={{ fontSize: "1.6rem" }}>🚫</span>
                            <div>
                                <div style={{ color: C.text, fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                                    Hesabınıza Erişim Geçici Olarak Engellendi
                                </div>
                                <div style={{ color: C.muted, fontSize: "0.8rem", marginBottom: 4 }}>
                                    {accessBlocked.message || "Detay bilgi için aşağıdaki 'Yardım Talep Et' butonuna basarak yönetici ile iletişime geçebilirsiniz."}
                                </div>
                                {accessBlocked.expiresAt && (
                                    <div style={{ color: C.muted, fontSize: "0.75rem" }}>
                                        Otomatik bitiş: {new Date(accessBlocked.expiresAt).toLocaleString("tr-TR")}
                                    </div>
                                )}
                                {accessBlocked.note && (
                                    <div style={{ color: C.muted, fontSize: "0.75rem", fontStyle: "italic", marginTop: 2 }}>
                                        Not: {accessBlocked.note}
                                    </div>
                                )}
                            </div>
                        </div>
                        {helpError && (
                            <div style={{ color: "#fca5a5", fontSize: "0.8rem", marginBottom: 8, width: "100%" }}>
                                {helpError}
                            </div>
                        )}
                        {accessBlocked.canRequestHelp !== false && (
                            <button
                                onClick={async () => {
                                    if (helpSending || helpSent) return;
                                    setHelpSending(true);
                                    setHelpError("");
                                    try {
                                        const res = await API.post("/access/help", {
                                            email: localStorage.getItem("userEmail") || undefined,
                                            message: "Hesap erişim engelinin açılması için yardım talebi.",
                                        });
                                        if (res.data?.success === false) {
                                            throw new Error(res.data?.message || "Talep iletilemedi");
                                        }
                                        setHelpSent(true);
                                    } catch (err) {
                                        const msg = err.response?.data?.message || err.message || "Talep gönderilemedi";
                                        if (err.response?.status === 401) {
                                            setHelpError("Oturum süresi dolmuş olabilir. Çıkış yapıp tekrar giriş yapın, ardından yardım talebini yenileyin.");
                                        } else {
                                            setHelpError(msg);
                                        }
                                    } finally {
                                        setHelpSending(false);
                                    }
                                }}
                                disabled={helpSending || helpSent}
                                style={{
                                    background: helpSent
                                        ? `linear-gradient(135deg, ${C.green || "#34d399"}, ${C.accent})`
                                        : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                                    color: "#fff", border: "none", borderRadius: 10,
                                    padding: "0.6rem 1.5rem", fontWeight: 700, fontSize: "0.85rem",
                                    cursor: helpSending || helpSent ? "default" : "pointer",
                                    opacity: helpSending ? 0.7 : 1,
                                    whiteSpace: "nowrap",
                                    boxShadow: `0 4px 12px ${C.accent}40`
                                }}
                            >
                                {helpSent ? "✅ Talep İletildi" : (helpSending ? "Gönderiliyor…" : "🆘 Yardım Talep Et")}
                            </button>
                        )}
                    </div>
                )}

                    {/* Hızlı erişim */}
                    <motion.div className="dh-quick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                        {quickActions.map((a, i) => (
                            <motion.button
                                key={a.panel}
                                type="button"
                                className="dh-quick__btn"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 + i * 0.04 }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handlePanelChange(a.panel)}
                            >
                                <div className="dh-quick__icon" style={{ background: `${a.color}22`, color: a.color }}>{a.icon}</div>
                                <span className="dh-quick__label">{a.label}</span>
                            </motion.button>
                        ))}
                    </motion.div>

                    {/* Sistem durumu */}
                    <motion.div className="dh-health" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                        {healthItems.map((s) => (
                            <div key={s.label} className="dh-health__item">
                                <div className="dh-health__dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}80` }} />
                                <div>
                                    <p className="dh-health__label">{s.label}</p>
                                    <p className="dh-health__value" style={{ color: s.color }}>{s.value}</p>
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                        <DashboardSpotlight
                            revenue={fmtCurrency(revenue24h, language)}
                            revenueSub={`${t("dashboard.avgBasket")}: ${fmtCurrency(avgOrderValue, language)} · ${orders24h} ${language === "en" ? "orders" : "sipariş"}`}
                            revenueBreakdown={revenueBreakdown}
                            marketplaceDayRevenue={marketplaceDayRevenue}
                            fmtCurrency={fmtCurrency}
                            orders={fmtNum(activeOrderCount, language)}
                            ordersSub={[
                                `${allOrders.statusCounts.new || 0} ${t("dashboard.new")}`,
                                `${allOrders.statusCounts.processing || 0} ${t("dashboard.processing")}`,
                            ].join(" · ")}
                            products={fmtNum(summary.totalProducts || pmProducts.total || 0, language)}
                            productsSub={`${fmtNum(pmProducts.lowStock || 0, language)} ${t("dashboard.lowStockAlert").toLowerCase()}`}
                            onFinance={() => handlePanelChange("finance")}
                            onOrders={openOrdersModal}
                            onProducts={() => handlePanelChange("pm-center")}
                            language={language}
                        />
                    </motion.div>

                    {/* Detay KPI */}
                    <div className="dh-kpi-grid">
                        <KpiCard C={C} icon="📈" label={t("dashboard.weeklyOrders")} value={fmtNum(trendOrderTotal, language)}
                            sub={fmtCurrency(trendRevenueTotal, language)}
                            color={C.blue} delay={0.05} />
                        <KpiCard C={C} icon="✅" label={t("dashboard.delivered")} value={fmtNum(allOrders.statusCounts.delivered, language)}
                            sub={`${allOrders.statusCounts.cancelled} ${t("dashboard.cancelledOrders").toLowerCase()}`}
                            color={C.green} delay={0.1} />
                        <KpiCard C={C} icon="⚠️" label={t("dashboard.lowStockAlert")} value={fmtNum(pmProducts.lowStock || 0, language)}
                            sub={`${t("dashboard.outOfStock")}: ${fmtNum(pmProducts.outOfStock || 0, language)}`}
                            color={(pmProducts.lowStock || 0) > 0 ? C.yellow : C.green} delay={0.15} />
                        <KpiCard C={C} icon="🔄" label={t("dashboard.pendingSync")} value={fmtNum(summary.pendingSync || 0, language)}
                            sub={t("dashboard.lastUpdate")}
                            color={C.accent} delay={0.2} />
                    </div>

                    {/* Bento: pazaryeri + grafik | canlı siparişler */}
                    <div className="dh-bento">
                        <div className="dh-bento__main">
                            <DashboardMarketplaceGrid
                                entries={marketplaceEntries}
                                fmtCurrency={fmtCurrency}
                                language={language}
                                statusColor={statusColor}
                                statusLabel={statusLabel}
                                t={t}
                                C={C}
                            />
                            <DashboardTrendChart
                                trends={trends}
                                orderTrendMax={orderTrendMax}
                                revenueTrendMax={revenueTrendMax}
                                trendOrderTotal={trendOrderTotal}
                                trendRevenueTotal={trendRevenueTotal}
                                fmtCurrency={fmtCurrency}
                                fmtNum={fmtNum}
                                language={language}
                                t={t}
                                C={C}
                                isMobile={isMobile}
                            />
                        </div>
                        <div className="dh-bento__side">
                            <DashboardOrderTimeline
                                orders={recentOrdersFeed}
                                fmtCurrency={fmtCurrency}
                                language={language}
                                onViewAll={() => handlePanelChange("orders")}
                                t={t}
                                C={C}
                            />
                        </div>
                    </div>

                    <div className="dh-bottom-grid">
                        <div className="dh-panel">
                            <div className="dh-panel__head">
                                <div className="dh-panel__title">
                                    <span className="dh-panel__title-icon"><FaBoxOpen /></span>
                                    {t("dashboard.productHealth")}
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {[
                                    { label: t("dashboard.totalProducts"), value: fmtNum(summary.totalProducts || pmProducts.total || 0, language), color: C.accent },
                                    { label: t("dashboard.activeProducts"), value: fmtNum(summary.activeProducts || pmProducts.healthy || 0, language), color: C.green },
                                    { label: t("dashboard.outOfStock"), value: fmtNum(pmProducts.outOfStock || summary.passiveProducts || 0, language), color: C.red },
                                    { label: t("dashboard.lowStock"), value: fmtNum(pmProducts.lowStock || 0, language), color: C.yellow },
                                    { label: t("dashboard.stockMismatchCount"), value: fmtNum(summary.stockMismatchCount || 0, language), color: (summary.stockMismatchCount || 0) > 0 ? C.red : C.green },
                                ].map((s, i) => (
                                    <motion.div key={s.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.03 }}
                                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "0.55rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600 }}>{s.label}</span>
                                        <span style={{ color: s.color, fontWeight: 800 }}>{s.value}</span>
                                    </motion.div>
                                ))}
                            </div>
                            {pmMarketplaces.length > 0 && (
                                <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                    <p style={{ color: C.muted, fontSize: "0.7rem", fontWeight: 600, marginBottom: "0.45rem" }}>{t("dashboard.marketplaceDistribution")}</p>
                                    {pmMarketplaces.map(pm => (
                                        <div key={pm.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", gap: "0.5rem" }}>
                                            <span style={{ color: C.text, fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pm.name}</span>
                                            <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                                                <Pill color={C.green}>{pm.syncedProducts || 0} {t("dashboard.synced")}</Pill>
                                                {(pm.errorProducts || 0) > 0 && <Pill color={C.red}>{pm.errorProducts} {t("dashboard.errorProducts")}</Pill>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="dh-panel">
                            <div className="dh-panel__head">
                                <div className="dh-panel__title">{t("dashboard.alerts")}</div>
                                {alerts.length > 0 && <span className="dh-panel__badge">{alerts.length}</span>}
                            </div>
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
                        </div>

                        <div className="dh-panel">
                            <div className="dh-panel__head">
                                <div className="dh-panel__title">
                                    <span className="dh-panel__title-icon"><FaMoneyBillWave /></span>
                                    {t("dashboard.channelRevenue")}
                                </div>
                                <span className="dh-panel__badge">{fmtCurrency(revenue24h, language)}</span>
                            </div>
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
                                <div className="dh-empty dh-empty--sm"><p>{t("dashboard.noData")}</p></div>
                            )}
                        </div>

                        <div className="dh-panel">
                            <div className="dh-panel__head">
                                <div className="dh-panel__title">{language === "en" ? "Shortcuts" : "Kısayollar"}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <button
                                    type="button"
                                    onClick={() => handlePanelChange("subscription")}
                                    style={{
                                        width: "100%", padding: "0.85rem 1rem", borderRadius: 12, border: "none", cursor: "pointer",
                                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, color: "#fff",
                                        fontWeight: 700, fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                    }}
                                >
                                    <FaCrown /> {language === "en" ? "Plans & billing" : "Paketler & faturalandırma"}
                                </button>
                                {[
                                    { label: t("dashboard.stockManagement"), icon: <FaBoxOpen />, panel: "inventory", color: C.green },
                                    { label: t("sidebar.shipping"), icon: <FaTruck />, panel: "shipping", color: C.pink || "#ec4899" },
                                    { label: t("sidebar.support"), icon: <FaHeadset />, panel: "support", color: C.blue },
                                ].map((a) => (
                                    <button
                                        key={a.panel}
                                        type="button"
                                        onClick={() => handlePanelChange(a.panel)}
                                        className="dh-quick__btn"
                                        style={{ flexDirection: "row", alignItems: "center", width: "100%" }}
                                    >
                                        <div className="dh-quick__icon" style={{ background: `${a.color}22`, color: a.color, width: 32, height: 32 }}>{a.icon}</div>
                                        <span className="dh-quick__label" style={{ flex: 1 }}>{a.label}</span>
                                        <FaArrowRight style={{ color: C.dim, fontSize: 12 }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="dh-logs-wrap">
                    <div className="dh-panel">
                        <div className="dh-panel__head">
                            <div className="dh-panel__title">
                                <span className="dh-panel__title-icon"><FaClipboardList /></span>
                                {t("dashboard.operationLogs")}
                            </div>
                            <button type="button" className="dh-panel__link" onClick={() => handlePanelChange("orders")}>
                                {t("dashboard.viewAllLogs")} <FaArrowRight />
                            </button>
                        </div>
                        <div className="dh-logs-grid">
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
                    </div>
                    </div>
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
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        {/* Toplu kargo etiketi — yalnızca "İşlemde" sekmesinde */}
                                        {selectedOrderTab === "processing" && (() => {
                                            const procLabelOrders = (allOrders.byStatus.processing || []).filter((o) => supportsCargoLabel(o.marketplace));
                                            return (
                                                <motion.button
                                                    type="button"
                                                    whileHover={{ scale: procLabelOrders.length ? 1.04 : 1 }}
                                                    whileTap={{ scale: procLabelOrders.length ? 0.96 : 1 }}
                                                    onClick={() => procLabelOrders.length && setBulkLabelOpen(true)}
                                                    disabled={!procLabelOrders.length}
                                                    title={procLabelOrders.length ? "İşlemdeki siparişlerin kargo etiketlerini topluca yazdır" : "İşlemde, etiket destekli sipariş yok"}
                                                    style={{
                                                        display: "flex", alignItems: "center", gap: "0.4rem",
                                                        background: procLabelOrders.length ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.glass,
                                                        color: procLabelOrders.length ? "#000" : C.muted,
                                                        border: `1px solid ${procLabelOrders.length ? "transparent" : C.glassBr}`,
                                                        borderRadius: 10, padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.85rem",
                                                        fontSize: isMobile ? "0.7rem" : "0.78rem", fontWeight: 800,
                                                        cursor: procLabelOrders.length ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                                                    }}>
                                                    🏷️ {isMobile ? "Toplu Etiket" : "Toplu Kargo Etiketi"}
                                                    <span style={{ background: procLabelOrders.length ? "rgba(0,0,0,0.18)" : `${C.muted}30`, borderRadius: 7, padding: "0.1rem 0.4rem", fontSize: "0.68rem", fontWeight: 800 }}>
                                                        {procLabelOrders.length}
                                                    </span>
                                                </motion.button>
                                            );
                                        })()}
                                        <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                            onClick={() => setShowOrderDetailsModal(false)}
                                            style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "1.2rem", fontWeight: 700, flexShrink: 0 }}>
                                            ✕
                                        </motion.button>
                                    </div>
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
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1fr 52px", gap: "0.75rem", padding: "0.5rem 1rem", borderBottom: `2px solid ${C.accent}20`, marginBottom: "0.5rem", flexShrink: 0 }}>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("dashboard.orderNumber")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("dashboard.marketplace")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>{t("dashboard.amount")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>{t("dashboard.date")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>{t("dashboard.orderStatus")}</span>
                                    <span style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>{t("orders.cargoLabelBtn")}</span>
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
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "delivered" ? C.green :
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "shipping" ? C.purple :
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "cancelled" ? C.red :
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "new" ? C.accent : C.yellow
                                                            }>
                                                                {getOrderStatusLabelTr(order.status || t("dashboard.unknown"), order.marketplace)}
                                                            </Pill>
                                                        </div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <span style={{ color: C.dim, fontSize: "0.68rem", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>#{formatOrderNumberForDisplay(order)}</span>
                                                            <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 800 }}>{fmtCurrency(order.totalPrice || 0, language)}</span>
                                                        </div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                                                            <span style={{ color: C.dim, fontSize: "0.62rem" }}>
                                                                {formatOrderDate(order.orderDate)}
                                                            </span>
                                                            {supportsCargoLabel(order.marketplace) && (
                                                                <motion.button
                                                                    type="button"
                                                                    whileTap={{ scale: 0.92 }}
                                                                    title={t("orders.cargoLabelTitle")}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDashboardCargoLabel(order);
                                                                    }}
                                                                    style={{
                                                                        background: `${C.purple}18`,
                                                                        border: `1px solid ${C.purple}40`,
                                                                        borderRadius: 8,
                                                                        padding: "0.25rem 0.5rem",
                                                                        cursor: "pointer",
                                                                        color: C.purple,
                                                                        fontSize: "0.85rem",
                                                                        fontWeight: 700,
                                                                    }}
                                                                >
                                                                    🏷️ {t("orders.cargoLabelBtn")}
                                                                </motion.button>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    /* ── Desktop: Grid row layout ── */
                                                    <motion.div key={`${order.orderNumber}-${idx}`}
                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                                                        style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.2fr 1fr 52px", gap: "0.75rem", alignItems: "center", padding: "0.6rem 1rem", borderRadius: 8, background: idx % 2 === 0 ? C.glass : "transparent", border: `1px solid transparent`, transition: "background 0.15s ease, border-color 0.15s ease", cursor: "default" }}
                                                        whileHover={{ backgroundColor: `rgba(78,205,196,0.06)`, borderColor: `rgba(78,205,196,0.12)` }}>
                                                        <span style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatOrderNumberForDisplay(order)}</span>
                                                        <span style={{ color: C.accent, fontSize: "0.8rem", fontWeight: 600 }}>{order.marketplace || "N/A"}</span>
                                                        <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 700, textAlign: "right" }}>{fmtCurrency(order.totalPrice || 0, language)}</span>
                                                        <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 500, textAlign: "center" }}>
                                                            {formatOrderDate(order.orderDate)}
                                                        </span>
                                                        <div style={{ textAlign: "center" }}>
                                                            <Pill color={
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "delivered" ? C.green :
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "shipping" ? C.purple :
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "cancelled" ? C.red :
                                                                (order.statusNormalized || classifyOrderStatus(order.status, order.marketplace)) === "new" ? C.accent : C.yellow
                                                            }>
                                                                {getOrderStatusLabelTr(order.status || t("dashboard.unknown"), order.marketplace)}
                                                            </Pill>
                                                        </div>
                                                        <div style={{ display: "flex", justifyContent: "center" }}>
                                                            {supportsCargoLabel(order.marketplace) ? (
                                                                <motion.button
                                                                    type="button"
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    title={t("orders.cargoLabelTitle")}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDashboardCargoLabel(order);
                                                                    }}
                                                                    style={{
                                                                        background: `${C.purple}18`,
                                                                        border: `1px solid ${C.purple}40`,
                                                                        borderRadius: 8,
                                                                        width: 32,
                                                                        height: 32,
                                                                        cursor: "pointer",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        color: C.purple,
                                                                        fontSize: "0.9rem",
                                                                    }}
                                                                >
                                                                    🏷️
                                                                </motion.button>
                                                            ) : (
                                                                <span style={{ color: C.dim, fontSize: "0.75rem" }}>—</span>
                                                            )}
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

                {labelOrder && (
                    <ShippingLabelModal
                        order={labelOrder}
                        onClose={() => setLabelOrder(null)}
                        C={C}
                        t={t}
                    />
                )}

                {bulkLabelOpen && (
                    <BulkShippingLabelModal
                        orders={(allOrders.byStatus.processing || [])
                            .filter((o) => supportsCargoLabel(o.marketplace))
                            .map((o) => normalizeDashboardOrderForLabel(o))}
                        onClose={() => setBulkLabelOpen(false)}
                        onPrintSingle={(o) => setLabelOrder(o)}
                        C={C}
                        t={t}
                    />
                )}

                {/* ── TOAST BİLDİRİMLER (Sağ alt köşe) ── */}
                <div style={{ position: "fixed", bottom: isMobile ? 12 : 20, right: isMobile ? 12 : 20, left: isMobile ? 12 : "auto", zIndex: 9998, display: "flex", flexDirection: "column", gap: "0.5rem", pointerEvents: "none" }}>
                    <AnimatePresence>
                        {notifications.filter(n => !n.isRead && !toastHiddenIds.has(String(n._id))).slice(0, isMobile ? 2 : 3).map((n, i) => {
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

                {showNotifPanel && typeof document !== "undefined" && ReactDOM.createPortal(
                    <AnimatePresence>
                        <motion.div
                            key="notif-backdrop"
                            className="dashboard-notif-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowNotifPanel(false)}
                        />
                        <motion.div
                            key="notif-panel"
                            className="dashboard-notif-panel"
                            role="dialog"
                            aria-label={t("notif.title")}
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: isDark ? "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)" : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                                border: `1px solid ${C.border}`,
                                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                            }}
                        >
                            <div className="dashboard-notif-panel-header" style={{ borderBottom: `1px solid ${C.glassBr}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                                    <FaBell style={{ color: C.accent, fontSize: "0.9rem", flexShrink: 0 }} />
                                    <span style={{ color: C.text, fontSize: "0.9rem", fontWeight: 700 }}>{t("notif.title")}</span>
                                    {unreadCount > 0 && <Pill color={C.red}>{unreadCount} {t("notif.new")}</Pill>}
                                </div>
                                <div className="dashboard-notif-panel-actions">
                                    <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => setNotifSoundEnabled(!notifSoundEnabled)}
                                        title={notifSoundEnabled ? t("notif.soundOn") : t("notif.soundOff")}
                                        style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.35rem 0.55rem", cursor: "pointer", color: notifSoundEnabled ? C.accent : C.dim, fontSize: "0.8rem" }}>
                                        {notifSoundEnabled ? "🔔" : "🔕"}
                                    </motion.button>
                                    {unreadCount > 0 && (
                                        <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            onClick={markAllRead}
                                            style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 8, padding: "0.35rem 0.65rem", cursor: "pointer", color: C.muted, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                                            {t("notif.markAllRead")}
                                        </motion.button>
                                    )}
                                </div>
                            </div>

                            <div className="dashboard-notif-tabs" style={{ borderBottom: `1px solid ${C.glassBr}` }}>
                                {[
                                    { key: "all", label: t("notif.all"), icon: "📋", count: notifCounts.total },
                                    { key: "order", label: t("notif.orders"), icon: "🛒", count: notifCounts.order },
                                    { key: "admin", label: t("notif.announcements"), icon: "📢", count: notifCounts.admin },
                                    { key: "ai", label: t("notif.ai"), icon: "🧠", count: notifCounts.ai },
                                ].map(tab => (
                                    <motion.button type="button" key={tab.key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => { setNotifFilter(tab.key); lastCheckRef.current = null; loadNotifications(); }}
                                        style={{
                                            background: notifFilter === tab.key ? `${C.accent}20` : "transparent",
                                            border: `1px solid ${notifFilter === tab.key ? C.accent + "40" : "transparent"}`,
                                            borderRadius: 8, padding: "0.35rem 0.65rem", cursor: "pointer",
                                            color: notifFilter === tab.key ? C.accent : C.muted,
                                            fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap",
                                            display: "inline-flex", alignItems: "center", gap: "0.35rem", flexShrink: 0,
                                        }}>
                                        <span aria-hidden>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        {tab.count > 0 && (
                                            <span style={{ background: C.red, color: "#fff", fontSize: "0.55rem", fontWeight: 800, borderRadius: 6, padding: "0.1rem 0.35rem", minWidth: 16, textAlign: "center" }}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </motion.button>
                                ))}
                            </div>

                            <div className="dashboard-notif-list">
                                {filteredNotifs.length > 0 ? filteredNotifs.slice(0, 30).map((n, i) => {
                                    const iconMap = { order: "🛒", admin: "📢", ai: "🧠", stock: "📦", system: "⚙️" };
                                    const gradMap = { order: `linear-gradient(135deg, ${C.green}, #059669)`, admin: `linear-gradient(135deg, ${C.purple}, #6d28d9)`, ai: `linear-gradient(135deg, ${C.blue}, #0284c7)`, stock: `linear-gradient(135deg, ${C.yellow}, #d97706)`, system: `linear-gradient(135deg, ${C.accent}, #44a08d)` };
                                    const priorityDot = { critical: C.red, high: C.yellow, medium: C.blue, low: C.dim };
                                    return (
                                        <motion.div key={n._id} role="button" tabIndex={0}
                                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                                            className="dashboard-notif-item"
                                            style={{
                                                background: n.isRead ? "transparent" : `${C.accent}08`,
                                                border: `1px solid ${n.isRead ? "transparent" : C.accent + "15"}`,
                                            }}
                                            onClick={() => handleNotifClick(n)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleNotifClick(n); }}
                                            whileHover={{ background: `${C.accent}10` }}
                                        >
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                background: gradMap[n.type] || gradMap.system,
                                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                                            }}>
                                                {n.icon || iconMap[n.type] || "🔔"}
                                            </div>
                                            <div className="dashboard-notif-item-body">
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem", marginBottom: "0.15rem" }}>
                                                    <span style={{ color: C.text, fontSize: "0.8rem", fontWeight: 700, lineHeight: 1.3 }}>{n.title}</span>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                                                        {n.priority && n.priority !== "medium" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityDot[n.priority] || C.dim }} title={n.priority} />}
                                                        {!n.isRead && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />}
                                                    </div>
                                                </div>
                                                <p className="dashboard-notif-item-msg">{n.message}</p>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                                                    <span style={{ color: C.dim, fontSize: "0.6rem", background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 4, padding: "0.05rem 0.35rem" }}>
                                                        {n.type === "order" ? t("notif.order") : n.type === "admin" ? t("notif.announcement") : n.type === "ai" ? "AI" : n.type === "stock" ? t("notif.stock") : t("notif.system")}
                                                    </span>
                                                    <span style={{ color: C.dim, fontSize: "0.62rem" }}>
                                                        {n.createdAt ? new Date(n.createdAt).toLocaleString(language === "en" ? "en-US" : "tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                                                    </span>
                                                </div>
                                            </div>
                                            <motion.button type="button" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}
                                                onClick={(e) => { e.stopPropagation(); dismissNotif(n._id); }}
                                                aria-label="Bildirimi kapat"
                                                style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.85rem", padding: "0.25rem", flexShrink: 0, lineHeight: 1 }}>
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
                    </AnimatePresence>,
                    document.body
                )}

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
        { id: "returns", icon: <FaUndoAlt />, text: t("sidebar.returns") },
        { id: "inventory", icon: <FaBoxOpen />, text: t("sidebar.inventory"), hasSubmenu: true },
        { id: "shipping", icon: <FaTruck />, text: t("sidebar.shipping"), hasSubmenu: true },
        { id: "finance", icon: <FaMoneyBillWave />, text: t("sidebar.finance"), hasSubmenu: true },
        { type: "divider", label: t("sidebar.productMgmt") },
        { id: "pm-center", icon: <FaCubes />, text: t("sidebar.productCenter") },
        { id: "product-upload", icon: <FaCloudUploadAlt />, text: t("sidebar.productUpload") },
        { id: "category-center", icon: <FaSitemap />, text: t("sidebar.categoryCenter") },
        { type: "divider", label: language === "en" ? "E-Commerce" : "E-Ticaret" },
        { type: "ecommerce-btn" },
        { type: "divider", label: t("sidebar.analytics") },
        { id: "advanced-analytics", icon: <FaChartBar />, text: t("sidebar.advancedAnalytics") },
        { id: "lysia-brain", icon: <FaBrain />, text: "Dashtock AI" },
        { id: "roketfy", icon: <FaRocket />, text: t("sidebar.roketfy") },
        { id: "radar-pro", icon: <FaCrosshairs />, text: t("sidebar.radarPro") },
        { type: "divider", label: t("sidebar.management") },
        { id: "users", icon: <FaUsers />, text: t("sidebar.userMgmt") },
        { id: "billing", icon: <FaFileInvoice />, text: t("sidebar.billing") },
        { id: "subscription", icon: <FaCrown />, text: language === "en" ? "Subscription & Plans" : "Abonelik & Paket" },
        { id: "error-center", icon: <FaBookOpen />, text: "Operasyon Defteri" },
        { id: "support", icon: <FaHeadset />, text: t("sidebar.support") },
        { id: "settings", icon: <FaCog />, text: t("sidebar.settings") },
        ...(isAdmin ? [
            { type: "divider", label: "Admin" },
            { id: "admin-panel", icon: <FaUserShield />, text: t("sidebar.adminPanel") },
        ] : []),
    ];

    const ECOMMERCE_MAIN_SUBMENU = useMemo(() => buildEcommerceMainSubmenu(language), [language]);
    const MARKETING_SUBMENU = useMemo(() => buildMarketingSubmenu(language), [language]);

    useEffect(() => {
        if (isEcommerceProductsPanel(activePanel)) {
            setEcommerceGroupOpen((o) => ({ ...o, "ec-products-group": true }));
        }
        if (isEcommerceOrdersPanel(activePanel)) {
            setEcommerceGroupOpen((o) => ({ ...o, "ec-orders-group": true }));
        }
        if (isEcommerceCustomersPanel(activePanel)) {
            setEcommerceGroupOpen((o) => ({ ...o, "ec-customers-group": true }));
        }
        if (isEcommerceDiscountsPanel(activePanel)) {
            setEcommerceGroupOpen((o) => ({ ...o, "ec-discounts-group": true }));
        }
        if (isEcommerceInboxPanel(activePanel)) {
            setEcommerceGroupOpen((o) => ({ ...o, "ec-inbox-group": true }));
        }
        if (activePanel === "mkt-campaigns-email" || activePanel === "mkt-campaigns-sms") {
            setMarketingGroupOpen((o) => ({ ...o, "mkt-campaigns-group": true }));
        }
    }, [activePanel]);

    const renderMarketingSubmenu = (isOpen) => (
        <div className={`submenu submenu--ecommerce ${isOpen ? "submenu--open" : ""}`}>
            <div className="submenu-inner">
                {MARKETING_SUBMENU.map((item) => {
                    if (item.children?.length) {
                        const subOpen = isOpen && marketingGroupOpen[item.id];
                        const groupActive =
                            activePanel === "mkt-campaigns-email" || activePanel === "mkt-campaigns-sms";
                        return (
                            <React.Fragment key={item.id}>
                                <div
                                    className={`submenu-item submenu-item--parent ${groupActive ? "active" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMarketingGroupOpen((o) => ({
                                            ...o,
                                            [item.id]: !o[item.id],
                                        }));
                                    }}
                                >
                                    <span className="submenu-item-text">{item.label}</span>
                                    <FaChevronDown
                                        className={`submenu-chevron ${subOpen ? "submenu-chevron--open" : ""}`}
                                        style={{ marginLeft: "auto", fontSize: 10 }}
                                    />
                                </div>
                                {subOpen &&
                                    item.children.map((child) => (
                                        <div
                                            key={child.id}
                                            className={`submenu-item submenu-item--child ${activePanel === child.id ? "active" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePanelChange(child.id);
                                            }}
                                        >
                                            <span className="submenu-item-text">{child.label}</span>
                                        </div>
                                    ))}
                            </React.Fragment>
                        );
                    }
                    const childActive =
                        activePanel === item.id || (item.id === "mkt-automations" && activePanel?.startsWith("mkt-automation-"));
                    return (
                        <div
                            key={item.id}
                            className={`submenu-item ${childActive ? "active" : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePanelChange(item.id);
                            }}
                        >
                            <span className="submenu-item-text">{item.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderEcommerceMainSubmenu = (isOpen) => (
        <div className={`submenu submenu--ecommerce ${isOpen ? "submenu--open" : ""}`}>
            <div className="submenu-inner">
                {ECOMMERCE_MAIN_SUBMENU.map((item) => {
                    if (item.children?.length) {
                        const subOpen = isOpen && ecommerceGroupOpen[item.id];
                        const groupActive =
                            item.id === "ec-products-group"
                                ? isEcommerceProductsPanel(activePanel)
                                : item.id === "ec-orders-group"
                                  ? isEcommerceOrdersPanel(activePanel)
                                  : item.id === "ec-customers-group"
                                    ? isEcommerceCustomersPanel(activePanel)
                                    : item.id === "ec-discounts-group"
                                      ? isEcommerceDiscountsPanel(activePanel)
                                      : item.id === "ec-inbox-group"
                                        ? isEcommerceInboxPanel(activePanel)
                                        : false;
                        const isChildActive = (child) => {
                            if (activePanel === child.id) return true;
                            if (child.id === "ec-orders" && activePanel?.startsWith("ec-order-"))
                                return true;
                            if (
                                child.id === "ec-orders-gift-cards" &&
                                activePanel?.startsWith("ec-gift-card")
                            )
                                return true;
                            if (
                                child.id === "ec-customers" &&
                                activePanel?.startsWith("ec-customer-")
                            )
                                return true;
                            if (
                                child.id === "ec-discounts-campaigns" &&
                                (activePanel === "ec-discounts-campaigns" ||
                                    activePanel === "ec-discounts" ||
                                    activePanel === "ec-campaign-auto-create" ||
                                    (activePanel?.startsWith("ec-campaign-") &&
                                        activePanel !== "ec-campaign-code-create"))
                            )
                                return true;
                            if (
                                child.id === "ec-discounts-coupons" &&
                                (activePanel === "ec-discounts-coupons" ||
                                    activePanel === "ec-campaign-code-create")
                            )
                                return true;
                            if (
                                child.id === "ec-inbox-messages" &&
                                (activePanel === "ec-inbox-messages" || activePanel === "ec-inbox")
                            )
                                return true;
                            if (child.id === "ec-inbox-settings" && activePanel === "ec-inbox-settings")
                                return true;
                            return false;
                        };
                        return (
                            <React.Fragment key={item.id}>
                                <div
                                    className={`submenu-item submenu-item--parent ${groupActive ? "active" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const next = !ecommerceGroupOpen[item.id];
                                        setEcommerceGroupOpen((o) => ({
                                            ...o,
                                            [item.id]: next,
                                        }));
                                        if (next && item.children[0]) {
                                            handlePanelChange(item.children[0].id);
                                        }
                                    }}
                                >
                                    <span className="submenu-item-text">{item.label}</span>
                                    <FaChevronDown
                                        className={`menu-chevron ${subOpen ? "menu-chevron--open" : ""}`}
                                        style={{ marginLeft: "auto", fontSize: 10 }}
                                    />
                                </div>
                                {subOpen &&
                                    item.children.map((child) => (
                                        <div
                                            key={child.id}
                                            className={`submenu-item submenu-item--child ${isChildActive(child) ? "active" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePanelChange(child.id);
                                            }}
                                        >
                                            <span className="submenu-item-text">{child.label}</span>
                                        </div>
                                    ))}
                            </React.Fragment>
                        );
                    }
                    return (
                        <div
                            key={item.id}
                            className={`submenu-item ${activePanel === item.id ? "active" : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePanelChange(item.id);
                            }}
                        >
                            <span className="submenu-item-text">{item.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderEcommerceMainPanel = (panelId) => {
        if (panelId === "ec-store-create") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <StoreCreationWizard
                        language={language}
                        onCancel={() => handlePanelChange("ec-stores")}
                        onComplete={() => handlePanelChange("ec-home")}
                    />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-appearance-marketplace") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <AppearanceMarketplacePage siteId={ecActiveSite?.id} onNavigate={handlePanelChange} onExitToProgram={exitToMainProgram} />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-domain-wizard") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <DomainWizardPage language={language} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-apps-marketplace") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <AppsMarketplacePage language={language} />
                </PlanFeatureGate>
            );
        }
        if (isEcSalesChannelWorkspacePanel(panelId)) {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcSalesChannelWorkspace
                        panelId={panelId}
                        siteId={ecActiveSite?.id}
                        activeSite={ecActiveSite}
                        language={language}
                        onNavigate={handlePanelChange}
                        onExitToProgram={exitToMainProgram}
                        onOpenEditor={openEcStoreEditor}
                        editorIntent={ecWbEditorIntent}
                        onEditorIntentConsumed={() => setEcWbEditorIntent(null)}
                    />
                </PlanFeatureGate>
            );
        }
        if (isEcWbChannelPanel(panelId)) {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceWbChannelHub
                        key={panelId}
                        panelId={panelId}
                        siteId={ecActiveSite?.id}
                        onNavigate={handlePanelChange}
                        onExitToProgram={exitToMainProgram}
                        onOpenEditor={openEcStoreEditor}
                        editorIntent={ecWbEditorIntent}
                        onEditorIntentConsumed={() => setEcWbEditorIntent(null)}
                    />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-stores") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceStoresPickerPage
                        language={language}
                        onEnterStore={enterEcStore}
                        onCreateStore={() => handlePanelChange("ec-store-create")}
                        onExitToProgram={exitToMainProgram}
                    />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-home") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceHomePage onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (isEcommerceProductsPanel(panelId)) {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceProductsHub panelId={panelId} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (isEcommerceOrdersPanel(panelId)) {
            return (
                <PlanFeatureGate featureId="orders" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceOrdersHub panelId={panelId} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (isEcommerceCustomersPanel(panelId)) {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceCustomersHub panelId={panelId} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (isEcommerceDiscountsPanel(panelId)) {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceDiscountsHub panelId={panelId} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (isEcommerceInboxPanel(panelId)) {
            const inboxPanel = panelId === "ec-inbox" ? "ec-inbox-messages" : panelId;
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceInboxHub panelId={inboxPanel} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-reports") {
            return (
                <PlanFeatureGate featureId="profit_analytics" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceStoreReportsPage />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-store-settings") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceStoreSettingsHub onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (panelId === "ec-settings") {
            return (
                <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <EcommerceStoreSettingsHub onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        return (
            <PlanFeatureGate featureId="own_storefront" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                <EcommerceSectionPage panelId={panelId} />
            </PlanFeatureGate>
        );
    };

    const renderStorePanel = (panelId) => (
        <PlanFeatureGate
            featureId="own_storefront"
            canAccess={canAccess}
            planDisplayName={planDisplayName}
            upgradeHint={upgradeHint}
            onUpgrade={() => handlePanelChange("subscription")}
        >
            <StoreEcommerceRouter
                section={getStoreRouterSection(panelId)}
                onNavigate={handlePanelChange}
                onBack={() => handlePanelChange("dashboard")}
            />
        </PlanFeatureGate>
    );

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

    const handleLogout = async () => {
        setShowLogoutConfirm(false);
        await logoutUser().catch(() => {});
        window.location.href = "/login";
    };

    const handleExitImpersonation = () => {
        const backupToken = localStorage.getItem("adminBackup_token");
        const backupUserId = localStorage.getItem("adminBackup_userId");
        if (!backupToken || !backupUserId) return;

        localStorage.setItem("token", backupToken);
        localStorage.setItem("userId", backupUserId);
        localStorage.setItem("userEmail", localStorage.getItem("adminBackup_email") || "");
        localStorage.setItem("userName", localStorage.getItem("adminBackup_name") || "");
        localStorage.setItem("userRole", localStorage.getItem("adminBackup_role") || "admin");
        localStorage.removeItem("isImpersonating");
        localStorage.removeItem("impersonatedBy");
        localStorage.removeItem("adminBackup_token");
        localStorage.removeItem("adminBackup_userId");
        localStorage.removeItem("adminBackup_email");
        localStorage.removeItem("adminBackup_name");
        localStorage.removeItem("adminBackup_role");
        window.location.href = "/admin/user-access";
    };

    /** Sipariş sayfasına her render'da yeni [] vermeyelim (OrdersPage gereksiz API tekrarını keser) */
    const marketplacesForOrdersPage = useMemo(() => {
        if (activePanel === "orders") return marketplaces;
        if (activePanel.startsWith("orders-")) {
            const marketplaceId = activePanel.slice("orders-".length);
            const mp = marketplaces.find((m) => String(m._id) === String(marketplaceId));
            return mp ? [mp] : [];
        }
        return marketplaces;
    }, [activePanel, marketplaces]);

    const renderActivePanel = () => {
        if (activePanel.startsWith("finance-")) {
            const marketplaceId = activePanel.split("-")[1];
            const marketplace = marketplaces.find(m => m._id === marketplaceId);
            return <FinancePage userId={userId} marketplaces={marketplaces} marketplaceId={marketplaceId} marketplace={marketplace} />;
        }
        if (activePanel.startsWith("orders-")) {
            const marketplaceId = activePanel.slice("orders-".length);
            const marketplace = marketplaces.find((m) => String(m._id) === String(marketplaceId));
            return <OrdersPage key={activePanel} userId={userId} marketplaces={marketplacesForOrdersPage} marketplaceId={marketplaceId} marketplace={marketplace} />;
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
        if (isEcommerceMainPanel(activePanel)) {
            const panel = renderEcommerceMainPanel(activePanel);
            if (inEcPlatformWorkspace) {
                return (
                    <EcommercePlatformShell
                        activePanel={activePanel}
                        activeSite={ecActiveSite}
                        language={language}
                        onNavigate={handlePanelChange}
                        onSwitchStore={() => handlePanelChange("ec-stores")}
                        onExitToProgram={exitToMainProgram}
                    >
                        {panel}
                    </EcommercePlatformShell>
                );
            }
            return panel;
        }
        if (isMarketingPanel(activePanel)) {
            return (
                <PlanFeatureGate
                    featureId="store_marketing"
                    canAccess={canAccess}
                    planDisplayName={planDisplayName}
                    upgradeHint={upgradeHint}
                    onUpgrade={() => handlePanelChange("subscription")}
                >
                    <MarketingHub panelId={activePanel} onNavigate={handlePanelChange} />
                </PlanFeatureGate>
            );
        }
        if (activePanel === "store-seller-verify") {
            return (
                <PlanFeatureGate
                    featureId="own_storefront"
                    canAccess={canAccess}
                    planDisplayName={planDisplayName}
                    upgradeHint={upgradeHint}
                    onUpgrade={() => handlePanelChange("subscription")}
                >
                    <SellerVerificationPage onBack={() => handlePanelChange("ec-home")} />
                </PlanFeatureGate>
            );
        }
        if (isStoreChannelView(activePanel)) {
            return renderStorePanel(activePanel);
        }

        switch (activePanel) {
            case "orders": return <OrdersPage key="orders-all" userId={userId} marketplaces={marketplacesForOrdersPage} />;
            case "returns": return <ReturnsManagementPage marketplaces={marketplaces} />;
            case "finance": return <FinancePage userId={userId} marketplaces={marketplaces} />;
            case "integration": return <MarketplaceIntegration userId={userId} />;
            case "users": return <UserProfilePage userId={userId} marketplaces={marketplaces} />;
            case "advanced-analytics": return (
                <PlanFeatureGate featureId="profit_analytics" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <AdvancedAnalytics userId={userId} />
                </PlanFeatureGate>
            );
            case "lysia-brain": return (
                <PlanFeatureGate featureId="ai_assistant" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <LysiaBrain userId={userId} />
                </PlanFeatureGate>
            );
            case "pm-center": return <ProductManagementCenter userId={userId} initialTab="products" />;
            case "product-upload": return <ProductManagementCenter userId={userId} initialTab="newProduct" />;
            case "category-center": return <CategoryCenterPage userId={userId} />;
            case "settings": return <SettingsPage userId={userId} />;
            case "billing": return <BillingPage embedded />;
            case "subscription": return <SubscriptionPage />;
            case "error-center": return <ErrorCenterPage />;
            case "support": return <SupportTicketsPage />;
            case "roketfy": return (
                <PlanFeatureGate featureId="roketfy" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <RoketfyPanel />
                </PlanFeatureGate>
            );
            case "radar-pro": return (
                <PlanFeatureGate featureId="ai_radar" canAccess={canAccess} planDisplayName={planDisplayName} upgradeHint={upgradeHint} onUpgrade={() => handlePanelChange("subscription")}>
                    <RadarProPage userId={userId} />
                </PlanFeatureGate>
            );
            case "admin-panel": return isAdmin ? <AdminPanelPage userId={userId} /> : null;
            case "dashboard": return renderDashboard();
            default: return null;
        }
    };

    return (
        <PageHelpProvider activePanel={activePanel}>
        <div
            className={`dashboard-container${isMobile ? " dashboard-container--mobile" : ""}${inEcPlatformWorkspace ? " dashboard-container--ec-platform" : ""}${inEcWbFullBleed ? " dashboard-container--ec-wb-fullbleed" : ""}${inEcPicker ? " dashboard-container--ec-picker" : ""}`}
        >
            {isImpersonating && (
                <div style={{ position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 12000, background: "rgba(99,102,241,0.95)", color: "#fff", border: "1px solid rgba(165,180,252,0.45)", borderRadius: 999, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    Admin olarak kullanıcı görünümündesiniz
                    <button onClick={handleExitImpersonation} style={{ border: "none", borderRadius: 999, background: "#fff", color: "#3730a3", fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}>
                        Admin'e Dön
                    </button>
                </div>
            )}
            {dashboardPanelActive && (
            <Particles id="tsparticles" init={particlesInit}
                options={{
                    background: { color: C.particleBg || C.bg },
                    particles: {
                        number: { value: 48 },
                        color: { value: ["#ff6b6b", "#4ecdc4", "#45b7d1"] },
                        shape: { type: "circle" },
                        opacity: { value: 0.7 },
                        size: { value: { min: 1, max: 5 } },
                        move: { enable: true, speed: 2.5, direction: "none", outModes: "bounce" },
                    },
                }}
            />
            )}

            {/* ── Mobile Hamburger Button ── */}
            {!hideErpSidebar && (
            <button
                className={`mobile-hamburger ${menuOpen && isMobile ? 'hidden' : ''}`}
                onClick={() => setMenuOpen(true)}
                aria-label="Menü"
            >
                <FaBars />
            </button>
            )}

            {/* ── Mobile Overlay ── */}
            <div
                className={`mobile-overlay ${menuOpen && isMobile ? 'visible' : ''}`}
                onClick={() => setMenuOpen(false)}
            />


            {(inEcPlatformWorkspace || inEcPicker) && (
                <button
                    type="button"
                    className={`ec-exit-erp${inEcEditor || inEcWbFullBleed || inEcPicker ? " ec-exit-erp--bare" : " ec-exit-erp--platform"}`}
                    onClick={exitToMainProgram}
                >
                    ← {language === "en" ? "Dashtock Home" : "Dashtock Ana Sayfa"}
                </button>
            )}

            {inEcWbFullBleed && activePanel !== EC_WB_THEMES_MARKETPLACE_PANEL && !inEcPlatformWorkspace && (
                <button
                    type="button"
                    className="ec-exit-erp"
                    onClick={exitToMainProgram}
                >
                    ← {language === "en" ? "Back to main program" : "Ana programa dön"}
                </button>
            )}

            {!hideErpSidebar && (
            <motion.aside
                className={`sidebar ${menuOpen ? "open" : "closed"}${isMobile ? " sidebar--mobile" : ""}`}
                animate={isMobile ? {} : { width: menuOpen ? 260 : 72 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            >
                <div className="sidebar-header">
                    <div className="logo-container" style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
                        <DashtockLogo size={menuOpen ? 38 : 32} full={menuOpen} />
                    </div>
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

                        if (item.type === "ecommerce-btn") {
                            const ecActive = isEcommerceMainPanel(activePanel);
                            const ecLocked = !entitlementsLoading && !canAccess("own_storefront");
                            const ecLabel = language === "en" ? "E-Commerce" : "E-Ticaret";
                            return (
                                <div
                                    key="ecommerce-btn"
                                    role="button"
                                    tabIndex={0}
                                    className={`menu-item menu-item--channel menu-item--ecommerce-btn ${ecActive ? "active" : ""} ${ecLocked ? "menu-item--locked" : ""}`}
                                    onClick={() => {
                                        if (ecLocked) {
                                            handlePanelChange("subscription");
                                            return;
                                        }
                                        setOpenSubmenu(null);
                                        handlePanelChange(ecActiveSite ? "ec-home" : ECOMMERCE_DEFAULT_PANEL);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            if (ecLocked) handlePanelChange("subscription");
                                            else handlePanelChange(ecActiveSite ? "ec-home" : ECOMMERCE_DEFAULT_PANEL);
                                        }
                                    }}
                                >
                                    <div className="icon-wrapper menu-channel-icon">
                                        <FaGlobe />
                                    </div>
                                    <span className="menu-text">{ecLabel}</span>
                                    {ecLocked && (
                                        <FaLock style={{ fontSize: 10, opacity: 0.55, marginLeft: 4 }} title="Paket yükseltmesi gerekli" />
                                    )}
                                    <span className="sidebar-tooltip">{ecLabel}</span>
                                </div>
                            );
                        }

                        const hasSubmenu = !!item.hasSubmenu;
                        const isSubmenuOpen = openSubmenu === item.id;
                        const featureId = item.href
                            ? (MENU_FEATURE_MAP[item.id] || "website_builder")
                            : resolvePanelFeatureId(item.id);
                        const isLocked = featureId && !entitlementsLoading && !canAccess(featureId);

                        return (
                            <React.Fragment key={item.id}>
                                <div
                                    className={`menu-item ${activePanel === item.id || activePanel.startsWith(item.id + "-") || (item.id === "ecommerce" && isEcommerceMainPanel(activePanel)) || (item.id === "ecommerce" && isEcommerceProductsPanel(activePanel)) || (item.id === "ecommerce" && isEcommerceOrdersPanel(activePanel)) || (item.id === "ecommerce" && isEcommerceCustomersPanel(activePanel)) || (item.id === "ecommerce" && isEcommerceDiscountsPanel(activePanel)) || (item.id === "ecommerce" && isEcommerceInboxPanel(activePanel)) || (item.id === "marketing" && isMarketingPanel(activePanel)) ? "active" : ""} ${hasSubmenu && isSubmenuOpen ? "submenu-open" : ""} ${isLocked ? "menu-item--locked" : ""}`}
                                    onClick={() => {
                                        if (item.href) {
                                            if (isLocked) {
                                                handlePanelChange("subscription");
                                                return;
                                            }
                                            setOpenSubmenu(null);
                                            if (isMobile) setMenuOpen(false);
                                            navigate(item.href);
                                            return;
                                        }
                                        if (hasSubmenu) {
                                            const opening = !isSubmenuOpen;
                                            setOpenSubmenu(opening ? item.id : null);
                                            if (item.id === "ecommerce" && opening) {
                                                handlePanelChange(ECOMMERCE_DEFAULT_PANEL);
                                            }
                                            if (item.id === "marketing" && opening) {
                                                handlePanelChange(MARKETING_DEFAULT_PANEL);
                                            }
                                        } else {
                                            setOpenSubmenu(null);
                                            handlePanelChange(item.id);
                                        }
                                    }}
                                >
                                    <div className="icon-wrapper">{item.icon}</div>
                                    <span className="menu-text">{item.text}</span>
                                    {isLocked && (
                                        <FaLock style={{ fontSize: 10, opacity: 0.55, marginLeft: 4 }} title="Paket yükseltmesi gerekli" />
                                    )}
                                    {hasSubmenu && (
                                        <span className={`menu-chevron ${isSubmenuOpen ? "menu-chevron--open" : ""}`}>
                                            <FaChevronDown />
                                        </span>
                                    )}
                                    <span className="sidebar-tooltip">{item.text}</span>
                                </div>

                                {hasSubmenu && item.id === "ecommerce" && renderEcommerceMainSubmenu(isSubmenuOpen)}
                                {hasSubmenu && item.id === "marketing" && renderMarketingSubmenu(isSubmenuOpen)}
                                {hasSubmenu && item.id !== "ecommerce" && item.id !== "marketing" && renderMarketplaceSubmenu(item.id, isSubmenuOpen)}
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
            )}

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
                    className={`content-area${isMobile ? " content-area--mobile" : ""}${inEcPlatformWorkspace ? " content-area--ec-platform" : ""}${inEcEditor ? " content-area--ec-editor" : ""}${inEcWbFullBleed ? " content-area--ec-wb-fullbleed" : ""}${activePanel === "integration" ? " content-area--galaxy" : ""}${activePanel === "lysia-brain" ? " content-area--brain" : ""}${activePanel === "dashboard" || activePanel === "pm-center" || activePanel === "product-upload" || activePanel === "store-seller-verify" || isEcommerceMainPanel(activePanel) || isEcommerceProductsPanel(activePanel) || isEcommerceOrdersPanel(activePanel) || isEcommerceCustomersPanel(activePanel) || isEcommerceDiscountsPanel(activePanel) || isEcommerceInboxPanel(activePanel) || isMarketingPanel(activePanel) || isStoreChannelView(activePanel) ? " content-area--dashboard" : ""}${isStoreChannelView(activePanel) ? " content-area--store-ec" : ""}${activePanel === "ec-home" ? " content-area--ec-home" : ""}${activePanel === "ec-stores" ? " content-area--ec-stores" : ""}${activePanel === "roketfy" || activePanel === "radar-pro" ? " content-area--radar" : ""}${activePanel === "billing" ? " content-area--billing" : ""}`}
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
            {canAccess("ai_assistant") && <AIChatWidget />}

            {/* Sayfa yardımı — tüm panel sayfalarında (i) */}
            <PageHelpFloating />
        </div>
        </PageHelpProvider>
    );
};

export default UserDashboard;
