import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaSync, FaLayerGroup, FaExchangeAlt, FaCheckCircle, FaTimesCircle,
    FaSpinner, FaBox, FaStore, FaChartBar, FaSearch, FaFilter,
    FaDownload, FaUpload, FaEye, FaEdit, FaTrash, FaBell,
    FaExclamationTriangle, FaTags, FaArrowRight, FaCheck, FaTimes,
    FaWarehouse, FaMoneyBillWave, FaListAlt, FaPlus, FaBug, FaCode
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
    getProductManagementDashboard,
    n11DebugRawProducts
} from "../services/productManagementApi";
import "../styles/AdvancedProductManagementPage.css";

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

const safeImageUrl = (images) => {
    if (!images || images.length === 0) return null;
    const first = images[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
    return null;
};

const mpColor = (name) => {
    const n = (name || "").toLowerCase();
    if (n === "trendyol")    return "#f27a1a";
    if (n === "hepsiburada") return "#ff6000";
    if (n === "n11")         return "#6f2da8";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "#e91e8c";
    if (n === "amazon")      return "#ff9900";
    return "#0f766e";
};

const StockBadge = ({ stock, threshold = 10 }) => {
    if (stock === 0)          return <span className="apm-badge apm-badge-danger">Stok Yok</span>;
    if (stock <= threshold)   return <span className="apm-badge apm-badge-warning">Düşük Stok</span>;
    return                           <span className="apm-badge apm-badge-success">Stokta</span>;
};

const SyncBadge = ({ status }) => {
    if (status === "synced")  return <span className="apm-badge apm-badge-success">Senkron</span>;
    if (status === "error")   return <span className="apm-badge apm-badge-danger">Hata</span>;
    if (status === "pending") return <span className="apm-badge apm-badge-warning">Bekliyor</span>;
    return                           <span className="apm-badge apm-badge-info">{status || "—"}</span>;
};

// ═══════════════════════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════════════════════

const AdvancedProductManagementPageV2 = () => {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [dashboardData, setDashboardData] = useState(null);
    const [pmDashboard, setPmDashboard] = useState(null);
    const [products, setProducts] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [categories, setCategories] = useState([]);
    const [categoryMappings, setCategoryMappings] = useState([]);
    const [marketplaces, setMarketplaces] = useState([]);
    const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
    const [comparison, setComparison] = useState(null);
    const [activeJobs, setActiveJobs] = useState([]);
    const [completedJobs, setCompletedJobs] = useState([]);
    const [syncLogs, setSyncLogs] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMarketplace, setFilterMarketplace] = useState("");
    const [filterStock, setFilterStock] = useState("");
    const [currentPage, setCurrentPage] = useState(0);
    const [notification, setNotification] = useState(null);

    // N11 Debug
    const [n11DebugData, setN11DebugData] = useState(null);
    const [showN11Debug, setShowN11Debug] = useState(false);

    // Stok/Fiyat güncelleme modal
    const [syncModal, setSyncModal] = useState(null);
    const [syncValue, setSyncValue] = useState("");
    const [syncListPrice, setSyncListPrice] = useState("");

    // Dağıtım modal
    const [distributeModal, setDistributeModal] = useState(null);
    const [distTargets, setDistTargets] = useState([]);

    // Gerçek zamanlı log
    const [realtimeLogs, setRealtimeLogs] = useState([]);

    // ─── Bildirim göster ────────────────────────────────────────────────────
    const showNotification = useCallback((message, type = "info") => {
        setNotification({ message, type });
        addRealtimeLog(message, type);
        setTimeout(() => setNotification(null), 5000);
    }, []);

    // ─── Gerçek zamanlı log ekle ───────────────────────────────────────────
    const addRealtimeLog = useCallback((message, type = "info") => {
        const log = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString("tr-TR"),
            message,
            type
        };
        setRealtimeLogs(prev => [log, ...prev].slice(0, 100)); // Son 100 log
    }, []);

    // ─── Dashboard verilerini yükle ─────────────────────────────────────────
    const loadDashboardData = useCallback(async () => {
        try {
            addRealtimeLog("Dashboard verileri yükleniyor...", "info");
            const [advResult, pmResult] = await Promise.allSettled([
                getDashboardData(),
                getProductManagementDashboard()
            ]);

            if (advResult.status === "fulfilled" && advResult.value?.data) {
                setDashboardData(advResult.value.data);
                setMarketplaces(advResult.value.data.marketplaceStats || []);
                addRealtimeLog("Dashboard verileri yüklendi", "success");
            }
            if (pmResult.status === "fulfilled" && pmResult.value?.dashboard) {
                setPmDashboard(pmResult.value.dashboard);
            }
        } catch (error) {
            console.error("Dashboard yüklenemedi:", error);
            addRealtimeLog("Dashboard yüklenemedi: " + error.message, "error");
        }
    }, [addRealtimeLog]);

    // ─── Ürünleri yükle ─────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        try {
            addRealtimeLog("Ürünler yükleniyor...", "info");
            const params = { page: currentPage, limit: 24 };
            if (filterMarketplace) params.marketplace = filterMarketplace;
            if (searchTerm)        params.search      = searchTerm;
            if (filterStock)       params.stockStatus = filterStock;

            const result = await getProducts(params);
            setProducts(result.products || []);
            setTotalProducts(result.total || 0);
            addRealtimeLog(`${result.total || 0} ürün yüklendi`, "success");
        } catch (error) {
            showNotification("Ürünler yüklenemedi: " + (error.response?.data?.error || error.message), "error");
        }
    }, [currentPage, filterMarketplace, searchTerm, filterStock, showNotification, addRealtimeLog]);

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

    // ─── N11 Debug Çalıştır ─────────────────────────────────────────────────
    const handleN11Debug = async () => {
        setLoading(true);
        addRealtimeLog("N11 Debug başlatılıyor...", "info");
        try {
            const result = await n11DebugRawProducts();
            setN11DebugData(result);
            setShowN11Debug(true);
            addRealtimeLog("N11 Debug tamamlandı", "success");
            showNotification("N11 Debug tamamlandı — sonuçları inceleyin", "success");
        } catch (error) {
            const errMsg = error.response?.data?.error || error.message;
            showNotification("N11 Debug başarısız: " + errMsg, "error");
            setN11DebugData({ error: errMsg, hint: error.response?.data?.hint });
            setShowN11Debug(true);
        } finally {
            setLoading(false);
        }
    };

    // ─── Pazaryerlerini karşılaştır ─────────────────────────────────────────
    const handleCompareMarketplaces = async () => {
        setLoading(true);
        addRealtimeLog("Pazaryerleri karşılaştırılıyor...", "info");
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
        addRealtimeLog(`${selectedMarketplaces.length} pazaryerinden ürün çekiliyor...`, "info");
        try {
            const result = await pullAllProducts(selectedMarketplaces);
            showNotification("Ürün çekme işlemi başlatıldı", "success");
            const cleanup = pollJobStatus(result.jobId, (job) => {
                addRealtimeLog(`İşlem durumu: ${job.status} (${job.progress?.percentage || 0}%)`, "info");
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
        addRealtimeLog(`${mp.name} senkronizasyonu başlatılıyor...`, "info");
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
        addRealtimeLog(`${mp.name} kategorileri çekiliyor...`, "info");
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
        addRealtimeLog(`Stok güncelleniyor: ${syncModal.product.masterProduct?.name || "Ürün"}`, "info");
        try {
            const priceUpdate = syncListPrice ? { listPrice: parseFloat(syncListPrice) } : null;
            const result = await syncStock(syncModal.product._id, newStock, priceUpdate);
            showNotification(result.message || "Stok güncellendi", "success");
            setSyncModal(null);
            setSyncValue("");
            setSyncListPrice("");
            loadProducts();
            loadDashboardData();
        } catch (error) {
            showNotification("Stok güncelleme başarısız: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Fiyat güncelle ─────────────────────────────────────────────────────
    const handleSyncPrice = async () => {
        if (!syncModal?.product || syncValue === "") return;
        const newPrice = parseFloat(syncValue);
        if (isNaN(newPrice) || newPrice <= 0) {
            showNotification("Geçerli bir fiyat girin", "warning");
            return;
        }
        setLoading(true);
        addRealtimeLog(`Fiyat güncelleniyor: ${syncModal.product.masterProduct?.name || "Ürün"}`, "info");
        try {
            const listPrice = syncListPrice ? parseFloat(syncListPrice) : null;
            const result = await syncPrice(syncModal.product._id, newPrice, listPrice);
            showNotification(result.message || "Fiyat güncellendi", "success");
            setSyncModal(null);
            setSyncValue("");
            setSyncListPrice("");
            loadProducts();
            loadDashboardData();
        } catch (error) {
            showNotification("Fiyat güncelleme başarısız: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── Ürün dağıt ─────────────────────────────────────────────────────────
    const handleDistributeProduct = async () => {
        if (!distributeModal?.product || distTargets.length === 0) {
            showNotification("Lütfen en az bir hedef pazaryeri seçin", "warning");
            return;
        }
        setLoading(true);
        addRealtimeLog(`Ürün dağıtılıyor: ${distributeModal.product.masterProduct?.name || "Ürün"}`, "info");
        try {
            const result = await distributeProduct(distributeModal.product._id, distTargets);
            const successCount = result.results?.filter(r => r.status === "success").length || 0;
            showNotification(`Dağıtım tamamlandı — ${successCount} pazaryerine yüklendi`, "success");
            setDistributeModal(null);
            setDistTargets([]);
            loadProducts();
            loadDashboardData();
        } catch (error) {
            showNotification("Dağıtım başarısız: " + (error.response?.data?.error || error.message), "error");
        } finally {
            setLoading(false);
        }
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
    }, []);

    // ─── Otomatik yenileme (aktif işlemler için) ───────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeJobs.length > 0) {
                loadActiveJobs();
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [activeJobs, loadActiveJobs]);

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    return (
        <div className="apm-container">
            {/* Header */}
            <div className="apm-header">
                <h1><FaLayerGroup /> Gelişmiş Ürün Yönetimi</h1>
                <div className="apm-header-actions">
                    <button className="apm-btn apm-btn-secondary" onClick={handleN11Debug}>
                        <FaBug /> N11 Debug
                    </button>
                    <button className="apm-btn apm-btn-primary" onClick={() => setActiveTab("dashboard")}>
                        <FaChartBar /> Dashboard
                    </button>
                    <div className="apm-notification-badge">
                        <FaBell />
                        {unreadCount > 0 && <span className="apm-badge-count">{unreadCount}</span>}
                    </div>
                </div>
            </div>

            {/* Bildirim Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        className={`apm-toast apm-toast-${notification.type}`}
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                    >
                        {notification.type === "success" && <FaCheckCircle />}
                        {notification.type === "error" && <FaTimesCircle />}
                        {notification.type === "warning" && <FaExclamationTriangle />}
                        <span>{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tabs */}
            <div className="apm-tabs">
                <button
                    className={activeTab === "dashboard" ? "active" : ""}
                    onClick={() => setActiveTab("dashboard")}
                >
                    <FaChartBar /> Dashboard
                </button>
                <button
                    className={activeTab === "products" ? "active" : ""}
                    onClick={() => setActiveTab("products")}
                >
                    <FaBox /> Ürünler
                </button>
                <button
                    className={activeTab === "sync" ? "active" : ""}
                    onClick={() => setActiveTab("sync")}
                >
                    <FaSync /> Senkronizasyon
                </button>
                <button
                    className={activeTab === "logs" ? "active" : ""}
                    onClick={() => setActiveTab("logs")}
                >
                    <FaListAlt /> Loglar
                </button>
                <button
                    className={activeTab === "categories" ? "active" : ""}
                    onClick={() => setActiveTab("categories")}
                >
                    <FaTags /> Kategoriler
                </button>
            </div>

            {/* Tab İçerikleri */}
            <div className="apm-content">
                {/* DASHBOARD TAB */}
                {activeTab === "dashboard" && (
                    <div className="apm-dashboard">
                        <div className="apm-stats-grid">
                            <div className="apm-stat-card">
                                <FaBox className="apm-stat-icon" />
                                <div>
                                    <h3>{pmDashboard?.products?.total || 0}</h3>
                                    <p>Toplam Ürün</p>
                                </div>
                            </div>
                            <div className="apm-stat-card apm-stat-success">
                                <FaCheckCircle className="apm-stat-icon" />
                                <div>
                                    <h3>{pmDashboard?.products?.healthy || 0}</h3>
                                    <p>Sağlıklı Stok</p>
                                </div>
                            </div>
                            <div className="apm-stat-card apm-stat-warning">
                                <FaExclamationTriangle className="apm-stat-icon" />
                                <div>
                                    <h3>{pmDashboard?.products?.lowStock || 0}</h3>
                                    <p>Düşük Stok</p>
                                </div>
                            </div>
                            <div className="apm-stat-card apm-stat-danger">
                                <FaTimesCircle className="apm-stat-icon" />
                                <div>
                                    <h3>{pmDashboard?.products?.outOfStock || 0}</h3>
                                    <p>Stok Yok</p>
                                </div>
                            </div>
                        </div>

                        {/* Pazaryeri İstatistikleri */}
                        <div className="apm-section">
                            <h2><FaStore /> Pazaryeri Dağılımı</h2>
                            <div className="apm-marketplace-grid">
                                {(pmDashboard?.marketplaces || []).map((mp, idx) => (
                                    <div key={idx} className="apm-marketplace-card" style={{ borderColor: mpColor(mp.name) }}>
                                        <div className="apm-mp-header" style={{ backgroundColor: mpColor(mp.name) }}>
                                            <h3>{mp.name}</h3>
                                        </div>
                                        <div className="apm-mp-body">
                                            <div className="apm-mp-stat">
                                                <span>Toplam Ürün:</span>
                                                <strong>{mp.totalProducts || 0}</strong>
                                            </div>
                                            <div className="apm-mp-stat">
                                                <span>Senkron:</span>
                                                <strong>{mp.syncedProducts || 0}</strong>
                                            </div>
                                            <div className="apm-mp-stat">
                                                <span>Bekleyen:</span>
                                                <strong>{mp.unsyncedProducts || 0}</strong>
                                            </div>
                                        </div>
                                        <div className="apm-mp-actions">
                                            <button
                                                className="apm-btn apm-btn-sm apm-btn-primary"
                                                onClick={() => handleSyncFromMarketplace(mp)}
                                                disabled={loading}
                                            >
                                                <FaSync /> Senkronize Et
                                            </button>
                                            <button
                                                className="apm-btn apm-btn-sm apm-btn-secondary"
                                                onClick={() => handlePullCategories(mp)}
                                                disabled={loading}
                                            >
                                                <FaTags /> Kategorileri Çek
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gerçek Zamanlı Loglar */}
                        <div className="apm-section">
                            <h2><FaCode /> Gerçek Zamanlı Loglar</h2>
                            <div className="apm-realtime-logs">
                                {realtimeLogs.slice(0, 20).map(log => (
                                    <div key={log.id} className={`apm-log-entry apm-log-${log.type}`}>
                                        <span className="apm-log-time">{log.timestamp}</span>
                                        <span className="apm-log-message">{log.message}</span>
                                    </div>
                                ))}
                                {realtimeLogs.length === 0 && (
                                    <p className="apm-empty-state">Henüz log yok</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PRODUCTS TAB */}
                {activeTab === "products" && (
                    <div className="apm-products">
                        {/* Filtreler */}
                        <div className="apm-filters">
                            <div className="apm-search-box">
                                <FaSearch />
                                <input
                                    type="text"
                                    placeholder="Ürün ara (isim, barkod, SKU)..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select value={filterMarketplace} onChange={(e) => setFilterMarketplace(e.target.value)}>
                                <option value="">Tüm Pazaryerleri</option>
                                {marketplaces.map((mp, idx) => (
                                    <option key={idx} value={mp.name}>{mp.name}</option>
                                ))}
                            </select>
                            <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)}>
                                <option value="">Tüm Stoklar</option>
                                <option value="outOfStock">Stok Yok</option>
                                <option value="lowStock">Düşük Stok</option>
                            </select>
                            <button className="apm-btn apm-btn-primary" onClick={loadProducts}>
                                <FaFilter /> Filtrele
                            </button>
                        </div>

                        {/* Ürün Listesi */}
                        <div className="apm-product-grid">
                            {products.map((product, idx) => {
                                const master = product.masterProduct || {};
                                const imgUrl = safeImageUrl(master.images);
                                return (
                                    <div key={idx} className="apm-product-card">
                                        <div className="apm-product-image">
                                            {imgUrl ? (
                                                <img src={imgUrl} alt={master.name} />
                                            ) : (
                                                <div className="apm-no-image"><FaBox /></div>
                                            )}
                                        </div>
                                        <div className="apm-product-info">
                                            <h4>{master.name || "İsimsiz Ürün"}</h4>
                                            <p className="apm-product-sku">SKU: {master.sku || "—"}</p>
                                            <p className="apm-product-barcode">Barkod: {master.barcode || "—"}</p>
                                            <div className="apm-product-price">
                                                <span className="apm-price-sale">{master.price || 0} TL</span>
                                                {master.listPrice && master.listPrice !== master.price && (
                                                    <span className="apm-price-list">{master.listPrice} TL</span>
                                                )}
                                            </div>
                                            <div className="apm-product-stock">
                                                <StockBadge stock={master.stock || 0} threshold={product.stockTracking?.lowStockThreshold || 10} />
                                                <span>{master.stock || 0} İadet</span>
                                            </div>
                                            <div className="apm-product-marketplaces">
                                                {(product.marketplaceMappings || []).map((mp, mpIdx) => (
                                                    <span
                                                        key={mpIdx}
                                                        className="apm-mp-badge"
                                                        style={{ backgroundColor: mpColor(mp.marketplaceName) }}
                                                    >
                                                        {mp.marketplaceName}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="apm-product-actions">
                                            <button
                                                className="apm-btn apm-btn-sm apm-btn-primary"
                                                onClick={() => setSyncModal({ product, type: "stock" })}
                                            >
                                                <FaWarehouse /> Stok
                                            </button>
                                            <button
                                                className="apm-btn apm-btn-sm apm-btn-secondary"
                                                onClick={() => setSyncModal({ product, type: "price" })}
                                            >
                                                <FaMoneyBillWave /> Fiyat
                                            </button>
                                            <button
                                                className="apm-btn apm-btn-sm apm-btn-success"
                                                onClick={() => setDistributeModal({ product })}
                                            >
                                                <FaArrowRight /> Dağıt
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {products.length === 0 && (
                            <div className="apm-empty-state">
                                <FaBox size={64} />
                                <p>Henüz ürün yok. Pazaryerlerinden ürün çekin.</p>
                            </div>
                        )}

                        {/* Sayfalama */}
                        {totalProducts > 24 && (
                            <div className="apm-pagination">
                                <button
                                    disabled={currentPage === 0}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                >
                                    ÖÖnceki
                                </button>
                                <span>Sayfa {currentPage + 1} / {Math.ceil(totalProducts / 24)}</span>
                                <button
                                    disabled={(currentPage + 1) * 24 >= totalProducts}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                >
                                    Sonraki
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* SYNC TAB */}
                {activeTab === "sync" && (
                    <div className="apm-sync">
                        <h2><FaSync /> Senkronizasyon İşlemleri</h2>

                        {/* Pazaryeri Seçimi */}
                        <div className="apm-section">
                            <h3>Pazaryeri Seçin</h3>
                            <div className="apm-marketplace-select">
                                {marketplaces.map((mp, idx) => (
                                    <label key={idx} className="apm-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={selectedMarketplaces.includes(mp.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedMarketplaces([...selectedMarketplaces, mp.name]);
                                                } else {
                                                    setSelectedMarketplaces(selectedMarketplaces.filter(m => m !== mp.name));
                                                }
                                            }}
                                        />
                                        <span style={{ color: mpColor(mp.name) }}>{mp.name}</span>
                                    </label>
                                ))}
                            </div>
                            <button
                                className="apm-btn apm-btn-primary"
                                onClick={handlePullAllProducts}
                                disabled={loading || selectedMarketplaces.length === 0}
                            >
                                {loading ? <FaSpinner className="apm-spin" /> : <FaDownload />}
                                Seçili Pazaryerlerinden Ürün Çek
                            </button>
                        </div>

                        {/* Aktif İşlemler */}
                        <div className="apm-section">
                            <h3>Aktif İşlemler</h3>
                            {activeJobs.length > 0 ? (
                                <div className="apm-jobs-list">
                                    {activeJobs.map((job, idx) => (
                                        <div key={idx} className="apm-job-card">
                                            <div className="apm-job-header">
                                                <span className="apm-job-type">{job.jobType}</span>
                                                <span className="apm-job-status">{job.status}</span>
                                            </div>
                                            <div className="apm-job-progress">
                                                <div
                                                    className="apm-progress-bar"
                                                    style={{ width: `${job.progress?.percentage || 0}%` }}
                                                />
                                            </div>
                                            <p>{job.progress?.processed || 0} / {job.progress?.total || 0} işlendi</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="apm-empty-state">Aktif işlem yok</p>
                            )}
                        </div>

                        {/* Tamamlanan İşlemler */}
                        <div className="apm-section">
                            <h3>Son Tamamlanan İşlemler</h3>
                            {completedJobs.length > 0 ? (
                                <div className="apm-jobs-list">
                                    {completedJobs.map((job, idx) => (
                                        <div key={idx} className="apm-job-card">
                                            <div className="apm-job-header">
                                                <span className="apm-job-type">{job.jobType}</span>
                                                <span className={`apm-job-status apm-status-${job.status}`}>
                                                    {job.status === "completed" ? <FaCheckCircle /> : <FaTimesCircle />}
                                                    {job.status}
                                                </span>
                                            </div>
                                            <p>{job.result?.message || "—"}</p>
                                            <small>{new Date(job.completedAt).toLocaleString("tr-TR")}</small>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="apm-empty-state">Tamamlanan işlem yok</p>
                            )}
                        </div>
                    </div>
                )}

                {/* LOGS TAB */}
                {activeTab === "logs" && (
                    <div className="apm-logs">
                        <h2><FaListAlt /> Senkronizasyon Logları</h2>
                        <div className="apm-logs-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tarih</th>
                                        <th>İşlem</th>
                                        <th>Ürün</th>
                                        <th>Pazaryeri</th>
                                        <th>Durum</th>
                                        <th>Detay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {syncLogs.map((log, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(log.timestamp).toLocaleString("tr-TR")}</td>
                                            <td>{log.actionType}</td>
                                            <td>{log.product?.name || "—"}</td>
                                            <td>{log.marketplace?.name || "—"}</td>
                                            <td>
                                                <SyncBadge status={log.status} />
                                            </td>
                                            <td>
                                                {log.changes?.field && (
                                                    <span>
                                                        {log.changes.field}: {log.changes.oldValue} → {log.changes.newValue}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {syncLogs.length === 0 && (
                                <p className="apm-empty-state">Henüz log yok</p>
                            )}
                        </div>
                    </div>
                )}

                {/* CATEGORIES TAB */}
                {activeTab === "categories" && (
                    <div className="apm-categories">
                        <h2><FaTags /> Kategori Eşleştirmeleri</h2>
                        <div className="apm-categories-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ana Kategori</th>
                                        <th>Trendyol</th>
                                        <th>Hepsiburada</th>
                                        <th>N11</th>
                                        <th>ÇiçekSepeti</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryMappings.map((cat, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{cat.masterCategory?.name || "—"}</strong></td>
                                            <td>
                                                {cat.marketplaceCategories?.find(m => m.marketplaceName === "Trendyol")?.categoryName || "—"}
                                            </td>
                                            <td>
                                                {cat.marketplaceCategories?.find(m => m.marketplaceName === "Hepsiburada")?.categoryName || "—"}
                                            </td>
                                            <td>
                                                {cat.marketplaceCategories?.find(m => m.marketplaceName === "N11")?.categoryName || "—"}
                                            </td>
                                            <td>
                                                {cat.marketplaceCategories?.find(m => m.marketplaceName === "ÇiçekSepeti")?.categoryName || "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {categoryMappings.length === 0 && (
                                <p className="apm-empty-state">Henüz kategori eşleştirmesi yok</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}

            {/* Stok/Fiyat Güncelleme Modal */}
            <AnimatePresence>
                {syncModal && (
                    <motion.div
                        className="apm-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSyncModal(null)}
                    >
                        <motion.div
                            className="apm-modal"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="apm-modal-header">
                                <h3>
                                    {syncModal.type === "stock" ? <FaWarehouse /> : <FaMoneyBillWave />}
                                    {syncModal.type === "stock" ? "Stok Güncelle" : "Fiyat Güncelle"}
                                </h3>
                                <button onClick={() => setSyncModal(null)}><FaTimes /></button>
                            </div>
                            <div className="apm-modal-body">
                                <p><strong>{syncModal.product?.masterProduct?.name || "Ürün"}</strong></p>
                                <p>SKU: {syncModal.product?.masterProduct?.sku || "—"}</p>
                                <div className="apm-form-group">
                                    <label>
                                        {syncModal.type === "stock" ? "Yeni Stok Miktarı:" : "Yeni Satış Fiyatı (TL):"}
                                    </label>
                                    <input
                                        type="number"
                                        value={syncValue}
                                        onChange={(e) => setSyncValue(e.target.value)}
                                        placeholder={syncModal.type === "stock" ? "0" : "0.00"}
                                        min="0"
                                        step={syncModal.type === "stock" ? "1" : "0.01"}
                                    />
                                </div>
                                {syncModal.type === "price" && (
                                    <div className="apm-form-group">
                                        <label>Liste Fiyatı (TL) - Opsiyonel:</label>
                                        <input
                                            type="number"
                                            value={syncListPrice}
                                            onChange={(e) => setSyncListPrice(e.target.value)}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                )}
                                <p className="apm-modal-hint">
                                    Bu işlem tüm pazaryerlerinde senkronize edilecektir.
                                </p>
                            </div>
                            <div className="apm-modal-footer">
                                <button className="apm-btn apm-btn-secondary" onClick={() => setSyncModal(null)}>
                                    İptal
                                </button>
                                <button
                                    className="apm-btn apm-btn-primary"
                                    onClick={syncModal.type === "stock" ? handleSyncStock : handleSyncPrice}
                                    disabled={loading}
                                >
                                    {loading ? <FaSpinner className="apm-spin" /> : <FaCheck />}
                                    Güncelle
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dağıtım Modal */}
            <AnimatePresence>
                {distributeModal && (
                    <motion.div
                        className="apm-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setDistributeModal(null)}
                    >
                        <motion.div
                            className="apm-modal"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="apm-modal-header">
                                <h3><FaArrowRight /> Ürün Dağıt</h3>
                                <button onClick={() => setDistributeModal(null)}><FaTimes /></button>
                            </div>
                            <div className="apm-modal-body">
                                <p><strong>{distributeModal.product?.masterProduct?.name || "Ürün"}</strong></p>
                                <p>SKU: {distributeModal.product?.masterProduct?.sku || "—"}</p>
                                <div className="apm-form-group">
                                    <label>Hedef Pazaryerleri:</label>
                                    {marketplaces.map((mp, idx) => (
                                        <label key={idx} className="apm-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={distTargets.includes(mp.name)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setDistTargets([...distTargets, mp.name]);
                                                    } else {
                                                        setDistTargets(distTargets.filter(m => m !== mp.name));
                                                    }
                                                }}
                                            />
                                            <span style={{ color: mpColor(mp.name) }}>{mp.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="apm-modal-footer">
                                <button className="apm-btn apm-btn-secondary" onClick={() => setDistributeModal(null)}>
                                    İptal
                                </button>
                                <button
                                    className="apm-btn apm-btn-primary"
                                    onClick={handleDistributeProduct}
                                    disabled={loading || distTargets.length === 0}
                                >
                                    {loading ? <FaSpinner className="apm-spin" /> : <FaArrowRight />}
                                    Dağıt
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* N11 Debug Modal */}
            <AnimatePresence>
                {showN11Debug && (
                    <motion.div
                        className="apm-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowN11Debug(false)}
                    >
                        <motion.div
                            className="apm-modal apm-modal-large"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.8 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="apm-modal-header">
                                <h3><FaBug /> N11 Debug — Ham API Yanıtı</h3>
                                <button onClick={() => setShowN11Debug(false)}><FaTimes /></button>
                            </div>
                            <div className="apm-modal-body">
                                {n11DebugData?.error ? (
                                    <div className="apm-debug-error">
                                        <FaTimesCircle size={48} />
                                        <h4>Hata</h4>
                                        <p>{n11DebugData.error}</p>
                                        {n11DebugData.hint && <p className="apm-hint">{n11DebugData.hint}</p>}
                                    </div>
                                ) : (
                                    <div className="apm-debug-success">
                                        <h4>API Yanıt Yapısı</h4>
                                        <div className="apm-debug-info">
                                            <p><strong>Durum:</strong> {n11DebugData?.rawResponse?.status || "—"}</p>
                                            <p><strong>Veri Tipi:</strong> {n11DebugData?.rawResponse?.dataType || "—"}</p>
                                            <p><strong>Array mi?:</strong> {n11DebugData?.rawResponse?.isArray ? "Evet" : "Hayır"}</p>
                                            <p><strong>Üst Seviye Anahtarlar:</strong></p>
                                            <pre>{JSON.stringify(n11DebugData?.rawResponse?.topLevelKeys, null, 2)}</pre>
                                        </div>
                                        <h4>Örnek Ürünler (İlk 3)</h4>
                                        <pre className="apm-debug-code">
                                            {JSON.stringify(n11DebugData?.rawResponse?.sampleProducts, null, 2)}
                                        </pre>
                                        <h4>Tam API Yanıtı</h4>
                                        <pre className="apm-debug-code">
                                            {JSON.stringify(n11DebugData?.rawResponse?.fullData, null, 2)}
                                        </pre>
                                        <p className="apm-hint">{n11DebugData?.hint}</p>
                                    </div>
                                )}
                            </div>
                            <div className="apm-modal-footer">
                                <button className="apm-btn apm-btn-secondary" onClick={() => setShowN11Debug(false)}>
                                    Kapat
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdvancedProductManagementPageV2;
