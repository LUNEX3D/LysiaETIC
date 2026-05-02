import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaSync, FaLayerGroup, FaExchangeAlt, FaCheckCircle, FaTimesCircle,
    FaSpinner, FaBox, FaStore, FaChartBar, FaSearch, FaFilter,
    FaDownload, FaUpload, FaEye, FaEdit, FaTrash, FaBell,
    FaExclamationTriangle, FaTags, FaArrowRight, FaCheck, FaTimes,
    FaWarehouse, FaMoneyBillWave, FaListAlt, FaPlus
} from "react-icons/fa";
import {
    pullAllProducts,
    pullProductsFromMarketplace,
    pullCategories,
    getJobStatus,
    getActiveJobs,
    getCompletedJobs,
    compareMarketplaces,
    getUserProducts,
    getUserCategories,
    getDashboardData,
    pollJobStatus
} from "../services/advancedProductApi";
import {
    getProducts,
    syncFromMarketplace,
    distributeProduct,
    bulkDistribute,
    syncStock,
    syncPrice,
    triggerAutoSync,
    getCategoryMappings,
    getSyncLogs,
    getUnreadNotifications,
    markNotificationRead,
    getProductManagementDashboard
} from "../services/productManagementApi";
import "../styles/AdvancedProductManagementPage.css";

// ─── Yardımcı: Görsel URL'sini güvenli al ───────────────────────────────────
const safeImageUrl = (images) => {
    if (!images || images.length === 0) return null;
    const first = images[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
    return null;
};

// ─── Yardımcı: Pazaryeri rengi ──────────────────────────────────────────────
const mpColor = (name) => {
    const n = (name || "").toLowerCase();
    if (n === "trendyol")    return "#f27a1a";
    if (n === "hepsiburada") return "#ff6000";
    if (n === "n11")         return "#6f2da8";
    if (n === "çiçeksepeti") return "#e91e8c";
    if (n === "amazon")      return "#ff9900";
    return "#0f766e";
};

// ─── Yardımcı: Stok durumu badge ────────────────────────────────────────────
const StockBadge = ({ stock, threshold = 10 }) => {
    if (stock === 0)          return <span className="apm-badge apm-badge-danger">Stok Yok</span>;
    if (stock <= threshold)   return <span className="apm-badge apm-badge-warning">Düşük Stok</span>;
    return                           <span className="apm-badge apm-badge-success">Stokta</span>;
};

// ─── Yardımcı: Sync durumu badge ────────────────────────────────────────────
const SyncBadge = ({ status }) => {
    if (status === "synced")  return <span className="apm-badge apm-badge-success">Senkron</span>;
    if (status === "error")   return <span className="apm-badge apm-badge-danger">Hata</span>;
    if (status === "pending") return <span className="apm-badge apm-badge-warning">Bekliyor</span>;
    return                           <span className="apm-badge apm-badge-info">{status || "—"}</span>;
};

const AdvancedProductManagementPage = () => {
    const [activeTab, setActiveTab]               = useState("dashboard");
    const [dashboardData, setDashboardData]       = useState(null);
    const [pmDashboard, setPmDashboard]           = useState(null);
    const [products, setProducts]                 = useState([]);
    const [totalProducts, setTotalProducts]       = useState(0);
    const [categories, setCategories]             = useState([]);
    const [categoryMappings, setCategoryMappings] = useState([]);
    const [marketplaces, setMarketplaces]         = useState([]);
    const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
    const [comparison, setComparison]             = useState(null);
    const [activeJobs, setActiveJobs]             = useState([]);
    const [completedJobs, setCompletedJobs]       = useState([]);
    const [syncLogs, setSyncLogs]                 = useState([]);
    const [notifications, setNotifications]       = useState([]);
    const [unreadCount, setUnreadCount]           = useState(0);
    const [loading, setLoading]                   = useState(false);
    const [searchTerm, setSearchTerm]             = useState("");
    const [filterMarketplace, setFilterMarketplace] = useState("");
    const [filterStock, setFilterStock]           = useState("");
    const [currentPage, setCurrentPage]           = useState(0);
    const [notification, setNotification]         = useState(null);

    // Stok/Fiyat güncelleme modal
    const [syncModal, setSyncModal]               = useState(null); // { product, type: "stock"|"price" }
    const [syncValue, setSyncValue]               = useState("");
    const [syncListPrice, setSyncListPrice]       = useState("");

    // Dağıtım modal
    const [distributeModal, setDistributeModal]   = useState(null); // { product }
    const [distTargets, setDistTargets]           = useState([]);

    // ─── Bildirim göster ────────────────────────────────────────────────────
    const showNotification = useCallback((message, type = "info") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    // ─── Dashboard verilerini yükle ─────────────────────────────────────────
    const loadDashboardData = useCallback(async () => {
        try {
            const [advResult, pmResult] = await Promise.allSettled([
                getDashboardData(),
                getProductManagementDashboard()
            ]);

            if (advResult.status === "fulfilled" && advResult.value?.data) {
                setDashboardData(advResult.value.data);
                setMarketplaces(advResult.value.data.marketplaceStats || []);
            }
            if (pmResult.status === "fulfilled" && pmResult.value?.dashboard) {
                setPmDashboard(pmResult.value.dashboard);
            }
        } catch (error) {
            console.error("Dashboard yüklenemedi:", error);
        }
    }, []);

    // ─── Ürünleri yükle ─────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        try {
            const params = { page: currentPage, limit: 24 };
            if (filterMarketplace) params.marketplace = filterMarketplace;
            if (searchTerm)        params.search      = searchTerm;
            if (filterStock)       params.stockStatus = filterStock;

            const result = await getProducts(params);
            setProducts(result.products || []);
            setTotalProducts(result.total || 0);
        } catch (error) {
            showNotification("Ürünler yüklenemedi: " + (error.response?.data?.error || error.message), "error");
        }
    }, [currentPage, filterMarketplace, searchTerm, filterStock, showNotification]);

    // ─── Kategorileri yükle ─────────────────────────────────────────────────
    const loadCategories = useCallback(async (marketplaceName) => {
        try {
            const result = await getUserCategories(marketplaceName);
            setCategories(result.categories || []);
        } catch (error) {
            showNotification("Kategoriler yüklenemedi", "error");
        }
    }, [showNotification]);

    // ─── Kategori eşleştirmelerini yükle ────────────────────────────────────
    const loadCategoryMappings = useCallback(async () => {
        try {
            const result = await getCategoryMappings();
            setCategoryMappings(result.categories || []);
        } catch (error) {
            console.error("Kategori eşleştirmeleri yüklenemedi:", error);
        }
    }, []);

    // ─── Aktif işlemleri yükle ──────────────────────────────────────────────
    const loadActiveJobs = useCallback(async () => {
        try {
            const result = await getActiveJobs();
            setActiveJobs(result.jobs || []);
        } catch (error) {
            console.error("Aktif işlemler yüklenemedi:", error);
        }
    }, []);

    // ─── Tamamlanan işlemleri yükle ─────────────────────────────────────────
    const loadCompletedJobs = useCallback(async () => {
        try {
            const result = await getCompletedJobs(10);
            setCompletedJobs(result.jobs || []);
        } catch (error) {
            console.error("Tamamlanan işlemler yüklenemedi:", error);
        }
    }, []);

    // ─── Sync loglarını yükle ───────────────────────────────────────────────
    const loadSyncLogs = useCallback(async () => {
        try {
            const result = await getSyncLogs({ limit: 30 });
            setSyncLogs(result.logs || []);
        } catch (error) {
            console.error("Sync logları yüklenemedi:", error);
        }
    }, []);

    // ─── Bildirimleri yükle ─────────────────────────────────────────────────
    const loadNotifications = useCallback(async () => {
        try {
            const result = await getUnreadNotifications();
            setNotifications(result.notifications || []);
            setUnreadCount(result.counts?.total || 0);
        } catch (error) {
            console.error("Bildirimler yüklenemedi:", error);
        }
    }, []);

    // ─── Pazaryerlerini karşılaştır ─────────────────────────────────────────
    const handleCompareMarketplaces = async () => {
        setLoading(true);
        try {
            const result = await compareMarketplaces();
            setComparison(result.comparison);
            showNotification("Pazaryerleri karşılaştırıldı", "success");
        } catch (error) {
            showNotification("Karşılaştırma başarısız: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Pazaryerinden ürün çek ─────────────────────────────────────────────
    const handlePullAllProducts = async () => {
        if (selectedMarketplaces.length === 0) {
            showNotification("Lütfen en az bir pazaryeri seçin", "warning");
            return;
        }
        setLoading(true);
        try {
            const result = await pullAllProducts(selectedMarketplaces);
            showNotification("Ürün çekme işlemi başlatıldı", "success");
            const cleanup = pollJobStatus(result.jobId, (job) => {
                if (job.status === "completed") {
                    showNotification(`Ürün çekme tamamlandı`, "success");
                    loadDashboardData();
                    loadProducts();
                    loadActiveJobs();
                    loadCompletedJobs();
                } else if (job.status === "failed") {
                    showNotification("Ürün çekme başarısız", "error");
                }
                loadActiveJobs();
            });
            return cleanup;
        } catch (error) {
            showNotification("Ürün çekme başlatılamadı: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Pazaryerinden senkronize et ────────────────────────────────────────
    const handleSyncFromMarketplace = async (mp) => {
        setLoading(true);
        try {
            const result = await syncFromMarketplace(mp._id || mp.name, mp.name);
            showNotification(
                `${mp.name} senkronizasyonu tamamlandı — Yeni: ${result.stats?.new || 0}, Güncellenen: ${result.stats?.updated || 0}`,
                "success"
            );
            loadProducts();
            loadDashboardData();
        } catch (error) {
            showNotification(`${mp.name} senkronizasyonu başarısız: ` + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Kategorileri çek ───────────────────────────────────────────────────
    const handlePullCategories = async (mp) => {
        setLoading(true);
        try {
            await pullCategories(mp._id || mp.name, mp.name);
            showNotification(`${mp.name} kategorileri çekildi`, "success");
            loadCategories(mp.name);
        } catch (error) {
            showNotification("Kategori çekme başarısız: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Stok güncelle ──────────────────────────────────────────────────────
    const handleSyncStock = async () => {
        if (!syncModal?.product || syncValue === "") return;
        const newStock = parseInt(syncValue);
        if (isNaN(newStock) || newStock < 0) {
            showNotification("Geçerli bir stok miktarı girin (0 veya üzeri)", "warning");
            return;
        }
        setLoading(true);
        try {
            const priceUpdate = syncListPrice ? { listPrice: parseFloat(syncListPrice) } : null;
            const result = await syncStock(syncModal.product._id, newStock, priceUpdate);
            showNotification(result.message || "Stok güncellendi", "success");
            setSyncModal(null);
            setSyncValue("");
            setSyncListPrice("");
            loadProducts();
            loadSyncLogs();
        } catch (error) {
            showNotification("Stok güncellenemedi: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Fiyat güncelle ─────────────────────────────────────────────────────
    const handleSyncPrice = async () => {
        if (!syncModal?.product || syncValue === "") return;
        const salePrice = parseFloat(syncValue);
        if (isNaN(salePrice) || salePrice <= 0) {
            showNotification("Geçerli bir fiyat girin", "warning");
            return;
        }
        setLoading(true);
        try {
            const listPrice = syncListPrice ? parseFloat(syncListPrice) : null;
            const result = await syncPrice(syncModal.product._id, salePrice, listPrice);
            showNotification(result.message || "Fiyat güncellendi", "success");
            setSyncModal(null);
            setSyncValue("");
            setSyncListPrice("");
            loadProducts();
            loadSyncLogs();
        } catch (error) {
            showNotification("Fiyat güncellenemedi: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Ürün dağıt ─────────────────────────────────────────────────────────
    const handleDistribute = async () => {
        if (!distributeModal?.product || distTargets.length === 0) {
            showNotification("Hedef pazaryeri seçin", "warning");
            return;
        }
        setLoading(true);
        try {
            const result = await distributeProduct(distributeModal.product._id, distTargets);
            const successCount = (result.results || []).filter(r => r.status === "success").length;
            showNotification(`${successCount} pazaryerine dağıtıldı`, "success");
            setDistributeModal(null);
            setDistTargets([]);
            loadProducts();
        } catch (error) {
            showNotification("Dağıtım başarısız: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Otomatik senkronizasyon ─────────────────────────────────────────────
    const handleAutoSync = async () => {
        setLoading(true);
        try {
            const result = await triggerAutoSync();
            showNotification(`Otomatik senkronizasyon tamamlandı — ${(result.results || []).length} ürün işlendi`, "success");
            loadProducts();
            loadSyncLogs();
        } catch (error) {
            showNotification("Otomatik senkronizasyon başarısız", "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Bildirimi okundu işaretle ──────────────────────────────────────────
    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            loadNotifications();
        } catch (error) {
            console.error("Bildirim işaretlenemedi:", error);
        }
    };

    // ─── Marketplace seçimi toggle ──────────────────────────────────────────
    const toggleMarketplace = (id) => {
        setSelectedMarketplaces(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleDistTarget = (name) => {
        setDistTargets(prev =>
            prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
        );
    };

    // ─── İlk yükleme ────────────────────────────────────────────────────────
    useEffect(() => {
        loadDashboardData();
        loadProducts();
        loadActiveJobs();
        loadCompletedJobs();
        loadSyncLogs();
        loadNotifications();
        loadCategoryMappings();

        const interval = setInterval(() => {
            loadActiveJobs();
            loadNotifications();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    // ─── Filtre değişince ürünleri yenile ───────────────────────────────────
    useEffect(() => {
        loadProducts();
    }, [filterMarketplace, searchTerm, filterStock, currentPage]);

    // ─── Tab değişince ilgili veriyi yükle ──────────────────────────────────
    useEffect(() => {
        if (activeTab === "categories") {
            loadCategoryMappings();
        } else if (activeTab === "logs") {
            loadSyncLogs();
        } else if (activeTab === "notifications") {
            loadNotifications();
        }
    }, [activeTab]);

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="apm-container">

            {/* ── Header ── */}
            <div className="apm-header">
                <div className="apm-header-left">
                    <h1><FaLayerGroup /> Ürün Yönetimi</h1>
                    <p className="apm-header-sub">Tüm pazaryerlerİşinizi tek panelden yönetin</p>
                </div>
                <div className="apm-header-right">
                    <button className="apm-btn apm-btn-secondary" onClick={handleAutoSync} disabled={loading}>
                        {loading ? <FaSpinner className="apm-spin" /> : <FaSync />} Otomatik Senkronize Et
                    </button>
                    <div className="apm-notif-btn" onClick={() => setActiveTab("notifications")}>
                        <FaBell />
                        {unreadCount > 0 && <span className="apm-notif-count">{unreadCount}</span>}
                    </div>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="apm-tabs">
                {[
                    { key: "dashboard",     icon: <FaChartBar />,       label: "Dashboard"      },
                    { key: "products",      icon: <FaBox />,             label: "Ürünler"        },
                    { key: "pull",          icon: <FaDownload />,        label: "Ürün Çek"       },
                    { key: "compare",       icon: <FaExchangeAlt />,     label: "Karşılaştır"    },
                    { key: "categories",    icon: <FaLayerGroup />,      label: "Kategoriler"    },
                    { key: "logs",          icon: <FaListAlt />,         label: "İşlem Logları"  },
                    { key: "notifications", icon: <FaBell />,            label: `Bildirimler${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`apm-tab ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div className="apm-content">
                <AnimatePresence mode="wait">

                    {/* ════ DASHBOARD ════ */}
                    {activeTab === "dashboard" && (
                        <motion.div key="dashboard"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-dashboard"
                        >
                            {/* Özet kartlar */}
                            <div className="apm-stats-grid">
                                <div className="apm-stat-card">
                                    <div className="apm-stat-icon blue"><FaBox /></div>
                                    <div className="apm-stat-info">
                                        <h3>{pmDashboard?.products?.total ?? dashboardData?.totalProducts ?? 0}</h3>
                                        <p>Toplam Ürün</p>
                                    </div>
                                </div>
                                <div className="apm-stat-card">
                                    <div className="apm-stat-icon orange"><FaStore /></div>
                                    <div className="apm-stat-info">
                                        <h3>{marketplaces.length}</h3>
                                        <p>Pazaryeri</p>
                                    </div>
                                </div>
                                <div className="apm-stat-card">
                                    <div className="apm-stat-icon red"><FaExclamationTriangle /></div>
                                    <div className="apm-stat-info">
                                        <h3>{pmDashboard?.products?.outOfStock ?? 0}</h3>
                                        <p>Stok Yok</p>
                                    </div>
                                </div>
                                <div className="apm-stat-card">
                                    <div className="apm-stat-icon yellow"><FaWarehouse /></div>
                                    <div className="apm-stat-info">
                                        <h3>{pmDashboard?.products?.lowStock ?? 0}</h3>
                                        <p>Düşük Stok</p>
                                    </div>
                                </div>
                                <div className="apm-stat-card">
                                    <div className="apm-stat-icon green"><FaSync /></div>
                                    <div className="apm-stat-info">
                                        <h3>{activeJobs.length}</h3>
                                        <p>Aktif İşlem</p>
                                    </div>
                                </div>
                                <div className="apm-stat-card">
                                    <div className="apm-stat-icon purple"><FaBell /></div>
                                    <div className="apm-stat-info">
                                        <h3>{unreadCount}</h3>
                                        <p>Okunmamış Bildirim</p>
                                    </div>
                                </div>
                            </div>

                            {/* Pazaryeri kartları */}
                            <h2 className="apm-section-title"><FaStore /> Pazaryeri Durumu</h2>
                            <div className="apm-marketplaces-grid">
                                {(pmDashboard?.marketplaces || marketplaces).map((mp, idx) => (
                                    <div key={idx} className="apm-marketplace-card"
                                        style={{ borderTop: `4px solid ${mpColor(mp.name)}` }}>
                                        <div className="apm-mp-header">
                                            <h3>{mp.name}</h3>
                                            <span className="apm-mp-count">{mp.totalProducts ?? mp.productCount ?? 0} ürün</span>
                                        </div>
                                        {mp.syncedProducts !== undefined && (
                                            <div className="apm-mp-sync">
                                                <span className="apm-badge apm-badge-success">{mp.syncedProducts} senkron</span>
                                                {mp.unsyncedProducts > 0 &&
                                                    <span className="apm-badge apm-badge-warning">{mp.unsyncedProducts} bekliyor</span>
                                                }
                                            </div>
                                        )}
                                        <button
                                            className="apm-btn apm-btn-sm apm-btn-outline"
                                            onClick={() => handleSyncFromMarketplace(mp)}
                                            disabled={loading}
                                        >
                                            <FaSync /> Senkronize Et
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Aktif işlemler */}
                            {activeJobs.length > 0 && (
                                <div className="apm-active-jobs">
                                    <h2 className="apm-section-title"><FaSpinner className="apm-spin" /> Aktif İşlemler</h2>
                                    {activeJobs.map(job => (
                                        <div key={job.id} className="apm-job-card">
                                            <div className="apm-job-info">
                                                <span className="apm-job-type">{job.jobType}</span>
                                                <span className="apm-job-status">{job.status}</span>
                                            </div>
                                            <div className="apm-progress-bar">
                                                <div className="apm-progress-fill"
                                                    style={{ width: `${job.progress?.percentage || 0}%` }} />
                                            </div>
                                            <p className="apm-progress-text">{job.progress?.percentage || 0}% tamamlandı
                                                ({job.progress?.processed || 0}/{job.progress?.total || 0})</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Son loglar */}
                            {pmDashboard?.recentLogs?.length > 0 && (
                                <div className="apm-recent-logs">
                                    <h2 className="apm-section-title"><FaListAlt /> Son İşlemler</h2>
                                    <div className="apm-log-list">
                                        {pmDashboard.recentLogs.slice(0, 8).map((log, idx) => (
                                            <div key={idx} className={`apm-log-item apm-log-${log.status}`}>
                                                <span className="apm-log-action">{log.actionType}</span>
                                                <span className="apm-log-name">{log.product?.name || log.product?.barcode}</span>
                                                <span className="apm-log-time">
                                                    {new Date(log.timestamp).toLocaleString("tr-TR")}
                                                </span>
                                                <span className={`apm-badge apm-badge-${log.status === "success" ? "success" : "danger"}`}>
                                                    {log.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════ ÜRÜNLER ════ */}
                    {activeTab === "products" && (
                        <motion.div key="products"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-products"
                        >
                            {/* Filtreler */}
                            <div className="apm-filters">
                                <div className="apm-search-box">
                                    <FaSearch />
                                    <input
                                        type="text"
                                        placeholder="Ürün adı, barkod veya SKU ara..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(0); }}
                                    />
                                </div>
                                <select
                                    className="apm-select"
                                    value={filterMarketplace}
                                    onChange={e => { setFilterMarketplace(e.target.value); setCurrentPage(0); }}
                                >
                                    <option value="">Tüm Pazaryerleri</option>
                                    {marketplaces.map((mp, idx) => (
                                        <option key={idx} value={mp.name}>{mp.name}</option>
                                    ))}
                                </select>
                                <select
                                    className="apm-select"
                                    value={filterStock}
                                    onChange={e => { setFilterStock(e.target.value); setCurrentPage(0); }}
                                >
                                    <option value="">Tüm Stok Durumları</option>
                                    <option value="outOfStock">Stok Yok</option>
                                    <option value="lowStock">Düşük Stok</option>
                                </select>
                                <span className="apm-total-count">{totalProducts} ürün</span>
                            </div>

                            {/* Ürün grid */}
                            {products.length === 0 ? (
                                <div className="apm-empty">
                                    <FaBox />
                                    <p>Ürün bulunamadı. "Ürün Çek" sekmesinden pazaryerlerinizden ürün çekin.</p>
                                </div>
                            ) : (
                                <div className="apm-products-grid">
                                    {products.map(product => {
                                        const imgUrl = safeImageUrl(product.masterProduct?.images || product.images);
                                        const mp = product.masterProduct || product;
                                        const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                        const price = mp.price ?? 0;
                                        const mappings = product.marketplaceMappings || [];

                                        return (
                                            <div key={product._id} className="apm-product-card">
                                                <div className="apm-product-img">
                                                    {imgUrl
                                                        ? <img src={imgUrl} alt={mp.name} onError={e => { e.target.style.display = "none"; }} />
                                                        : <div className="apm-no-img"><FaBox /></div>
                                                    }
                                                    <StockBadge stock={stock} threshold={product.stockTracking?.lowStockThreshold || 10} />
                                                </div>
                                                <div className="apm-product-body">
                                                    <h4 className="apm-product-name" title={mp.name}>{mp.name}</h4>
                                                    <p className="apm-product-meta">
                                                        <span>Barkod: {mp.barcode}</span>
                                                        <span>SKU: {mp.sku}</span>
                                                    </p>
                                                    <div className="apm-product-price-row">
                                                        <span className="apm-price">₺{price.toLocaleString("tr-TR")}</span>
                                                        <span className="apm-stock">{stock} İadet</span>
                                                    </div>

                                                    {/* Pazaryeri eşleştirmeleri */}
                                                    {mappings.length > 0 && (
                                                        <div className="apm-mp-badges">
                                                            {mappings.map((m, i) => (
                                                                <span key={i}
                                                                    className="apm-mp-badge"
                                                                    style={{ background: mpColor(m.marketplaceName) }}
                                                                    title={`${m.marketplaceName} — ${m.syncStatus || "pending"}`}
                                                                >
                                                                    {m.marketplaceName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="apm-product-actions">
                                                    <button
                                                        className="apm-btn apm-btn-sm apm-btn-blue"
                                                        title="Stok Güncelle"
                                                        onClick={() => { setSyncModal({ product, type: "stock" }); setSyncValue(String(stock)); }}
                                                    >
                                                        <FaWarehouse />
                                                    </button>
                                                    <button
                                                        className="apm-btn apm-btn-sm apm-btn-green"
                                                        title="Fiyat Güncelle"
                                                        onClick={() => { setSyncModal({ product, type: "price" }); setSyncValue(String(price)); }}
                                                    >
                                                        <FaMoneyBillWave />
                                                    </button>
                                                    <button
                                                        className="apm-btn apm-btn-sm apm-btn-orange"
                                                        title="Pazaryerlerine Dağıt"
                                                        onClick={() => { setDistributeModal({ product }); setDistTargets([]); }}
                                                    >
                                                        <FaUpload />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Sayfalama */}
                            {totalProducts > 24 && (
                                <div className="apm-pagination">
                                    <button
                                        className="apm-btn apm-btn-sm apm-btn-outline"
                                        disabled={currentPage === 0}
                                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    >ÖÖnceki</button>
                                    <span>Sayfa {currentPage + 1} / {Math.ceil(totalProducts / 24)}</span>
                                    <button
                                        className="apm-btn apm-btn-sm apm-btn-outline"
                                        disabled={(currentPage + 1) * 24 >= totalProducts}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                    >Sonraki</button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════ ÜRÜN ÇEK ════ */}
                    {activeTab === "pull" && (
                        <motion.div key="pull"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-pull"
                        >
                            <div className="apm-pull-header">
                                <h2><FaDownload /> Pazaryerinden Ürün Çek</h2>
                                <p>Seçili pazaryerlerindeki ürünleri sisteme aktarın ve senkronize edin.</p>
                            </div>

                            <div className="apm-marketplace-selector">
                                {marketplaces.length === 0 ? (
                                    <div className="apm-empty">
                                        <FaStore />
                                        <p>Henüz pazaryeri entegrasyonu eklenmemiş. Pazaryeri Entegrasyonu sayfasından ekleyin.</p>
                                    </div>
                                ) : (
                                    <div className="apm-marketplace-list">
                                        {marketplaces.map((mp, idx) => (
                                            <div
                                                key={idx}
                                                className={`apm-marketplace-item ${selectedMarketplaces.includes(mp._id || mp.name) ? "selected" : ""}`}
                                                onClick={() => toggleMarketplace(mp._id || mp.name)}
                                                style={{ borderLeft: `4px solid ${mpColor(mp.name)}` }}
                                            >
                                                <div className="apm-mp-item-info">
                                                    <FaStore style={{ color: mpColor(mp.name) }} />
                                                    <span className="apm-mp-item-name">{mp.name}</span>
                                                    <span className="apm-mp-item-count">{mp.totalProducts ?? mp.productCount ?? 0} ürün</span>
                                                </div>
                                                {selectedMarketplaces.includes(mp._id || mp.name)
                                                    ? <FaCheckCircle className="apm-check-icon" />
                                                    : <div className="apm-check-empty" />
                                                }
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="apm-pull-actions">
                                <button
                                    className="apm-btn apm-btn-primary"
                                    onClick={handlePullAllProducts}
                                    disabled={loading || selectedMarketplaces.length === 0}
                                >
                                    {loading ? <FaSpinner className="apm-spin" /> : <FaDownload />}
                                    {selectedMarketplaces.length > 0
                                        ? `${selectedMarketplaces.length} Pazaryerinden Ürün Çek`
                                        : "Pazaryeri Seçin"}
                                </button>

                                <div className="apm-pull-divider">veya</div>

                                <div className="apm-individual-sync">
                                    <h3>Tek Pazaryeri Senkronizasyonu</h3>
                                    <div className="apm-individual-list">
                                        {marketplaces.map((mp, idx) => (
                                            <div key={idx} className="apm-individual-item">
                                                <span style={{ color: mpColor(mp.name) }}><FaStore /></span>
                                                <span>{mp.name}</span>
                                                <div className="apm-individual-btns">
                                                    <button
                                                        className="apm-btn apm-btn-sm apm-btn-outline"
                                                        onClick={() => handleSyncFromMarketplace(mp)}
                                                        disabled={loading}
                                                        title="Ürünleri senkronize et"
                                                    >
                                                        <FaSync /> Senkronize Et
                                                    </button>
                                                    <button
                                                        className="apm-btn apm-btn-sm apm-btn-outline"
                                                        onClick={() => handlePullCategories(mp)}
                                                        disabled={loading}
                                                        title="Kategorileri çek"
                                                    >
                                                        <FaTags /> Kategorileri Çek
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tamamlanan işlemler */}
                            {completedJobs.length > 0 && (
                                <div className="apm-completed-jobs">
                                    <h3>Son Tamamlanan İşlemler</h3>
                                    {completedJobs.map(job => (
                                        <div key={job.id} className={`apm-job-card apm-job-${job.status}`}>
                                            <div className="apm-job-info">
                                                <span className="apm-job-type">{job.jobType}</span>
                                                <span className={`apm-badge apm-badge-${job.status === "completed" ? "success" : "danger"}`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                            <p className="apm-job-time">
                                                {job.completedAt ? new Date(job.completedAt).toLocaleString("tr-TR") : "—"}
                                            </p>
                                            {job.result?.message && <p className="apm-job-msg">{job.result.message}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════ KARŞILAŞTIR ════ */}
                    {activeTab === "compare" && (
                        <motion.div key="compare"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-compare"
                        >
                            <div className="apm-compare-header">
                                <div>
                                    <h2><FaExchangeAlt /> Pazaryeri Karşılaştırma</h2>
                                    <p>Hangi ürünlerin hangi pazaryerlerinde eksik olduğunu görün.</p>
                                </div>
                                <button
                                    className="apm-btn apm-btn-primary"
                                    onClick={handleCompareMarketplaces}
                                    disabled={loading}
                                >
                                    {loading ? <FaSpinner className="apm-spin" /> : <FaSync />}
                                    Karşılaştır
                                </button>
                            </div>

                            {comparison ? (
                                <div className="apm-compare-results">
                                    <div className="apm-compare-summary">
                                        <div className="apm-compare-stat-card">
                                            <h3>{comparison.commonProducts?.length || 0}</h3>
                                            <p>Ortak Ürün</p>
                                        </div>
                                        {comparison.marketplaces?.map(mp => (
                                            <div key={mp.name} className="apm-compare-stat-card"
                                                style={{ borderTop: `3px solid ${mpColor(mp.name)}` }}>
                                                <h3>{mp.productCount}</h3>
                                                <p>{mp.name}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="apm-compare-details">
                                        {comparison.marketplaces?.map(mp => {
                                            const missing = comparison.missingProducts?.[mp.name] || [];
                                            return (
                                                <div key={mp.name} className="apm-compare-mp-card">
                                                    <div className="apm-compare-mp-header"
                                                        style={{ background: mpColor(mp.name) }}>
                                                        <h4>{mp.name}</h4>
                                                        <span>{mp.productCount} ürün</span>
                                                    </div>
                                                    {missing.length > 0 ? (
                                                        <div className="apm-missing-products">
                                                            <p className="apm-missing-title">
                                                                <FaExclamationTriangle /> {missing.length} eksik ürün
                                                            </p>
                                                            <ul>
                                                                {missing.slice(0, 10).map((barcode, i) => (
                                                                    <li key={i}>{barcode}</li>
                                                                ))}
                                                                {missing.length > 10 && (
                                                                    <li className="apm-more">... ve {missing.length - 10} ürün daha</li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    ) : (
                                                        <p className="apm-all-synced">
                                                            <FaCheckCircle /> Tüm ürünler mevcut
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="apm-empty">
                                    <FaExchangeAlt />
                                    <p>Karşılaştırma yapmak için "Karşılaştır" butonuna tıklayın.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════ KATEGORİLER ════ */}
                    {activeTab === "categories" && (
                        <motion.div key="categories"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-categories"
                        >
                            <div className="apm-categories-header">
                                <h2><FaLayerGroup /> Kategori Yönetimi</h2>
                                <div className="apm-categories-actions">
                                    <select
                                        className="apm-select"
                                        onChange={e => loadCategories(e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="">Pazaryeri Kategorileri</option>
                                        {marketplaces.map((mp, idx) => (
                                            <option key={idx} value={mp.name}>{mp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Kategori eşleştirmeleri */}
                            {categoryMappings.length > 0 && (
                                <div className="apm-category-mappings">
                                    <h3>Kategori Eşleştirmeleri ({categoryMappings.length})</h3>
                                    <div className="apm-category-table">
                                        <div className="apm-category-table-head">
                                            <span>Ana Kategori</span>
                                            <span>Trendyol</span>
                                            <span>Hepsiburada</span>
                                            <span>N11</span>
                                            <span>ÇiçekSepeti</span>
                                        </div>
                                        {categoryMappings.map(cat => (
                                            <div key={cat._id} className="apm-category-table-row">
                                                <span className="apm-cat-master">{cat.masterCategory?.name}</span>
                                                {["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti"].map(mpName => {
                                                    const mc = cat.marketplaceCategories?.find(m => m.marketplaceName === mpName);
                                                    return (
                                                        <span key={mpName} className={mc ? "apm-cat-mapped" : "apm-cat-unmapped"}>
                                                            {mc ? <><FaCheck /> {mc.categoryName}</> : <FaTimes />}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pazaryeri kategorileri */}
                            {categories.length > 0 && (
                                <div className="apm-categories-list">
                                    <h3>Pazaryeri Kategorileri ({categories.length})</h3>
                                    <div className="apm-category-grid">
                                        {categories.map(cat => (
                                            <div key={cat._id} className="apm-category-item">
                                                <h4>{cat.categoryName}</h4>
                                                <p className="apm-cat-id">ID: {cat.categoryId}</p>
                                                {cat.categoryPath?.length > 0 && (
                                                    <p className="apm-cat-path">
                                                        {cat.categoryPath.map((p, i) => (
                                                            <span key={i}>
                                                                {p.name || p}
                                                                {i < cat.categoryPath.length - 1 && <FaArrowRight className="apm-path-arrow" />}
                                                            </span>
                                                        ))}
                                                    </p>
                                                )}
                                                {cat.attributes?.length > 0 && (
                                                    <p className="apm-cat-attrs">{cat.attributes.length} özellik</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {categories.length === 0 && categoryMappings.length === 0 && (
                                <div className="apm-empty">
                                    <FaLayerGroup />
                                    <p>Kategori bulunamadı. Yukarıdan bir pazaryeri seçin veya "Ürün Çek" sekmesinden kategorileri çekin.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════ İŞLEM LOGLARI ════ */}
                    {activeTab === "logs" && (
                        <motion.div key="logs"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-logs"
                        >
                            <div className="apm-logs-header">
                                <h2><FaListAlt /> İşlem Logları</h2>
                                <button className="apm-btn apm-btn-sm apm-btn-outline" onClick={loadSyncLogs}>
                                    <FaSync /> Yenile
                                </button>
                            </div>
                            {syncLogs.length === 0 ? (
                                <div className="apm-empty"><FaListAlt /><p>Henüz işlem logu yok.</p></div>
                            ) : (
                                <div className="apm-log-table">
                                    <div className="apm-log-table-head">
                                        <span>İşlem</span>
                                        <span>Ürün</span>
                                        <span>Pazaryeri</span>
                                        <span>Değişiklik</span>
                                        <span>Durum</span>
                                        <span>Tarih</span>
                                    </div>
                                    {syncLogs.map((log, idx) => (
                                        <div key={idx} className={`apm-log-row apm-log-${log.status}`}>
                                            <span className="apm-log-action-type">{log.actionType}</span>
                                            <span>{log.product?.name || log.product?.barcode || "—"}</span>
                                            <span>{log.marketplace?.name || "—"}</span>
                                            <span>
                                                {log.changes?.field && (
                                                    <>{log.changes.field}: {log.changes.oldValue} → {log.changes.newValue}</>
                                                )}
                                            </span>
                                            <span>
                                                <span className={`apm-badge apm-badge-${log.status === "success" ? "success" : log.status === "error" ? "danger" : "warning"}`}>
                                                    {log.status}
                                                </span>
                                            </span>
                                            <span className="apm-log-date">
                                                {new Date(log.timestamp).toLocaleString("tr-TR")}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ════ BİLDİRİMLER ════ */}
                    {activeTab === "notifications" && (
                        <motion.div key="notifications"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="apm-notifications"
                        >
                            <div className="apm-notif-header">
                                <h2><FaBell /> Bildirimler</h2>
                                {unreadCount > 0 && (
                                    <button
                                        className="apm-btn apm-btn-sm apm-btn-outline"
                                        onClick={() => handleMarkRead("all")}
                                    >
                                        <FaCheck /> Tümünü Okundu İşaretle
                                    </button>
                                )}
                            </div>
                            {notifications.length === 0 ? (
                                <div className="apm-empty"><FaBell /><p>Okunmamış bildirim yok.</p></div>
                            ) : (
                                <div className="apm-notif-list">
                                    {notifications.map((notif, idx) => (
                                        <div key={idx} className={`apm-notif-item apm-notif-${notif.notification?.priority}`}>
                                            <div className="apm-notif-icon">
                                                {notif.notification?.priority === "critical" ? <FaTimesCircle /> :
                                                 notif.notification?.priority === "high"     ? <FaExclamationTriangle /> :
                                                 <FaBell />}
                                            </div>
                                            <div className="apm-notif-body">
                                                <p className="apm-notif-action">{notif.actionType}</p>
                                                <p className="apm-notif-product">{notif.product?.name || notif.product?.barcode}</p>
                                                {notif.changes?.field && (
                                                    <p className="apm-notif-change">
                                                        {notif.changes.field}: {notif.changes.oldValue} → {notif.changes.newValue}
                                                    </p>
                                                )}
                                                <p className="apm-notif-time">
                                                    {new Date(notif.timestamp).toLocaleString("tr-TR")}
                                                </p>
                                            </div>
                                            <button
                                                className="apm-btn apm-btn-sm apm-btn-ghost"
                                                onClick={() => handleMarkRead(notif._id)}
                                            >
                                                <FaCheck />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* ════ STOK / FİYAT GÜNCELLEME MODAL ════ */}
            <AnimatePresence>
                {syncModal && (
                    <motion.div className="apm-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSyncModal(null)}
                    >
                        <motion.div className="apm-modal"
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="apm-modal-header">
                                <h3>
                                    {syncModal.type === "stock"
                                        ? <><FaWarehouse /> Stok Güncelle</>
                                        : <><FaMoneyBillWave /> Fiyat Güncelle</>
                                    }
                                </h3>
                                <button className="apm-modal-close" onClick={() => setSyncModal(null)}><FaTimes /></button>
                            </div>
                            <div className="apm-modal-body">
                                <p className="apm-modal-product-name">
                                    {syncModal.product.masterProduct?.name || syncModal.product.name}
                                </p>
                                <p className="apm-modal-sub">
                                    Tüm bağlı pazaryerlerinde güncellenir.
                                </p>
                                <div className="apm-modal-field">
                                    <label>
                                        {syncModal.type === "stock" ? "Yeni Stok Miktarı" : "Satış Fiyatı (₺)"}
                                    </label>
                                    <input
                                        type="number"
                                        min={syncModal.type === "stock" ? "0" : "0.01"}
                                        step={syncModal.type === "stock" ? "1" : "0.01"}
                                        value={syncValue}
                                        onChange={e => setSyncValue(e.target.value)}
                                        placeholder={syncModal.type === "stock" ? "0" : "0.00"}
                                        autoFocus
                                    />
                                </div>
                                <div className="apm-modal-field">
                                    <label>
                                        {syncModal.type === "stock" ? "Liste Fiyatı (₺) — Opsiyonel" : "Liste Fiyatı (₺) — Opsiyonel"}
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={syncListPrice}
                                        onChange={e => setSyncListPrice(e.target.value)}
                                        placeholder="Boş bırakılabilir"
                                    />
                                </div>
                            </div>
                            <div className="apm-modal-footer">
                                <button className="apm-btn apm-btn-outline" onClick={() => setSyncModal(null)}>İptal</button>
                                <button
                                    className="apm-btn apm-btn-primary"
                                    onClick={syncModal.type === "stock" ? handleSyncStock : handleSyncPrice}
                                    disabled={loading || syncValue === ""}
                                >
                                    {loading ? <FaSpinner className="apm-spin" /> : <FaCheck />}
                                    {syncModal.type === "stock" ? "Stoku Güncelle" : "Fiyatı Güncelle"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════ DAĞITIM MODAL ════ */}
            <AnimatePresence>
                {distributeModal && (
                    <motion.div className="apm-modal-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setDistributeModal(null)}
                    >
                        <motion.div className="apm-modal"
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="apm-modal-header">
                                <h3><FaUpload /> Pazaryerlerine Dağıt</h3>
                                <button className="apm-modal-close" onClick={() => setDistributeModal(null)}><FaTimes /></button>
                            </div>
                            <div className="apm-modal-body">
                                <p className="apm-modal-product-name">
                                    {distributeModal.product.masterProduct?.name || distributeModal.product.name}
                                </p>
                                <p className="apm-modal-sub">Ürünü göndermek istediğiniz pazaryerlerini seçin:</p>
                                <div className="apm-dist-targets">
                                    {["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti"].map(mpName => {
                                        const alreadyMapped = (distributeModal.product.marketplaceMappings || [])
                                            .some(m => m.marketplaceName === mpName && m.marketplaceProductId);
                                        return (
                                            <div
                                                key={mpName}
                                                className={`apm-dist-target ${distTargets.includes(mpName) ? "selected" : ""} ${alreadyMapped ? "already-mapped" : ""}`}
                                                onClick={() => !alreadyMapped && toggleDistTarget(mpName)}
                                                style={{ borderLeft: `4px solid ${mpColor(mpName)}` }}
                                            >
                                                <span style={{ color: mpColor(mpName) }}><FaStore /></span>
                                                <span>{mpName}</span>
                                                {alreadyMapped
                                                    ? <span className="apm-badge apm-badge-success">Mevcut</span>
                                                    : distTargets.includes(mpName)
                                                        ? <FaCheckCircle className="apm-check-icon" />
                                                        : <div className="apm-check-empty" />
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="apm-modal-footer">
                                <button className="apm-btn apm-btn-outline" onClick={() => setDistributeModal(null)}>İptal</button>
                                <button
                                    className="apm-btn apm-btn-primary"
                                    onClick={handleDistribute}
                                    disabled={loading || distTargets.length === 0}
                                >
                                    {loading ? <FaSpinner className="apm-spin" /> : <FaUpload />}
                                    {distTargets.length > 0 ? `${distTargets.length} Pazaryerine Dağıt` : "Pazaryeri Seçin"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════ TOAST BİLDİRİM ════ */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        className={`apm-toast apm-toast-${notification.type}`}
                        initial={{ opacity: 0, y: 60, x: "-50%" }}
                        animate={{ opacity: 1, y: 0,  x: "-50%" }}
                        exit={{    opacity: 0, y: 60, x: "-50%" }}
                    >
                        {notification.type === "success" ? <FaCheckCircle /> :
                         notification.type === "error"   ? <FaTimesCircle /> :
                         notification.type === "warning" ? <FaExclamationTriangle /> :
                         <FaSync />}
                        <span>{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdvancedProductManagementPage;
