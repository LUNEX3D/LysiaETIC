/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 ÜRÜN YÖNETİM MERKEZİ — ProductManagementHub.js (v9 — Tam Revizyon)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 7 Sekme: Dashboard, Ürünlerim, Çek & Yükle, Fiyatlandırma, Platform Analizi,
 *          Kategori Eşleştirme, Loglar & Excel
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CategoryMappingPage from "./CategoryMappingPage";
import {
    FaBoxOpen, FaSearch, FaSync, FaStore, FaWarehouse,
    FaMoneyBillWave, FaChartBar, FaEdit, FaTimes, FaSave,
    FaSpinner, FaInfoCircle, FaLayerGroup, FaExchangeAlt,
    FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
    FaClipboardList, FaBox, FaBell,
    FaRocket, FaTags, FaPlus, FaCheck, FaCheckSquare, FaSquare,
    FaArrowLeft, FaTrash, FaTag, FaEye,
    FaUpload, FaDownload, FaCloudDownloadAlt, FaCloudUploadAlt, FaFileImport,
    FaFileExcel, FaMapMarkedAlt, FaDollarSign, FaGlobe
} from "react-icons/fa";
import {
    getProducts, syncAllMarketplaces, syncStock, syncPrice,
    getProductManagementDashboard, getSyncLogs, createProduct,
    deleteProduct, getComparisonMatrix, bulkDistributeSelected,
    getUnreadNotifications, markNotificationRead,
    syncFromMarketplace,
    downloadTemplate, previewImport, executeImport, exportProducts,
    basePriceSync, checkPendingTasks
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementHub.css";

/* ─── Sabitler ─────────────────────────────────────────────────────────────── */
const TABS = [
    { key: "dashboard",    icon: <FaChartBar />,         label: "Dashboard" },
    { key: "products",     icon: <FaBoxOpen />,          label: "Ürünlerim" },
    { key: "pull-push",    icon: <FaCloudDownloadAlt />, label: "Çek & Yükle" },
    { key: "pricing",      icon: <FaDollarSign />,       label: "Fiyatlandırma" },
    { key: "comparison",   icon: <FaGlobe />,            label: "Platform Analizi" },
    { key: "categories",   icon: <FaMapMarkedAlt />,     label: "Kategori Eşleştirme" },
    { key: "logs",         icon: <FaClipboardList />,    label: "Loglar" },
];

const MP_COLORS = {
    Trendyol: "#f27a1a", trendyol: "#f27a1a",
    Hepsiburada: "#ff6000", hepsiburada: "#ff6000",
    N11: "#6f3695", n11: "#6f3695",
    Amazon: "#ff9900", amazon: "#ff9900",
    ÇiçekSepeti: "#e91e8c", çiçeksepeti: "#e91e8c"
};
const mpColor = (name = "") => MP_COLORS[name] || MP_COLORS[name?.toLowerCase()] || "#4ecdc4";

const normalizeMP = (name) => {
    if (!name) return "";
    const n = name.trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon" || n === "amazon türkiye") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return name.trim();
};

const fmt = (n) => {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n || 0); }
    catch { return `${(n || 0).toFixed(2)} ₺`; }
};
const fmtNum = (n) => new Intl.NumberFormat("tr-TR").format(n || 0);
const PAGE_SIZE = 20;

const Spinner = () => <FaSpinner className="pmh-spin" />;
const safeImg = (images) => { if (!images || !images.length) return null; const f = images[0]; return typeof f === "string" ? f : f?.url || null; };

/* ═══════════════════════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════════════════════════ */
const ProductManagementHub = () => {
    const [activeTab, setActiveTab] = useState("dashboard");

    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);
    const [loading, setLoading] = useState(false);
    const [autoSyncRunning, setAutoSyncRunning] = useState(false);
    const [autoSyncStatus, setAutoSyncStatus] = useState("");
    const autoSyncDone = useRef(false);

    /* ── Ürün State ── */
    const [products, setProducts] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [filterMP, setFilterMP] = useState("");
    const [filterStock, setFilterStock] = useState("");
    const [marketplaces, setMarketplaces] = useState([]);

    /* ── Dashboard State ── */
    const [dashboardData, setDashboardData] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);

    /* ── Modal State ── */
    const [stockModal, setStockModal] = useState(null);
    const [stockValue, setStockValue] = useState("");
    const [priceModal, setPriceModal] = useState(null);
    const [salePrice, setSalePrice] = useState("");
    const [listPrice, setListPrice] = useState("");
    const [deleteModal, setDeleteModal] = useState(null);

    /* ── Dağıtım State ── */
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkTargets, setBulkTargets] = useState([]);
    const [distLoading, setDistLoading] = useState(false);

    /* ── Yeni Ürün State ── */
    const [newProduct, setNewProduct] = useState({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] });
    const [newProductTargets, setNewProductTargets] = useState([]);

    /* ── Çek & Yükle State ── */
    const [pullSource, setPullSource] = useState("");
    const [pullLoading, setPullLoading] = useState(false);
    const [pullResult, setPullResult] = useState(null);
    const [pushTargets, setPushTargets] = useState([]);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushResult, setPushResult] = useState(null);
    const [pulledProducts, setPulledProducts] = useState([]);
    const [selectedPulledProducts, setSelectedPulledProducts] = useState([]);

    /* ── Karşılaştırma / Platform Analizi State ── */
    const [compMatrix, setCompMatrix] = useState([]);
    const [compTotal, setCompTotal] = useState(0);
    const [compPage, setCompPage] = useState(0);
    const [compSearch, setCompSearch] = useState("");
    const [missingOnly, setMissingOnly] = useState(false);
    const [compSummary, setCompSummary] = useState(null);
    const [compDistributing, setCompDistributing] = useState({});

    /* ── Log & Bildirim State ── */
    const [logs, setLogs] = useState([]);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsPage, setLogsPage] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    /* ── Toplu Fiyat State ── */
    const [bulkPriceMode, setBulkPriceMode] = useState("fixed");
    const [bulkPriceValue, setBulkPriceValue] = useState("");

    /* ── Ürünlerim alt-sekme ── */
    const [productsSubTab, setProductsSubTab] = useState("list");

    /* ── Fiyatlandırma State ── */
    const [pricingMode, setPricingMode] = useState("per-product");
    const [pricingBaseMP, setPricingBaseMP] = useState("");
    const [pricingTargetMPs, setPricingTargetMPs] = useState([]);
    const [pricingMargin, setPricingMargin] = useState("");
    const [pricingRoundTo, setPricingRoundTo] = useState("0.90");
    const [platformPrices, setPlatformPrices] = useState({});
    const [pricingProduct, setPricingProduct] = useState(null);
    const [pricingSaving, setPricingSaving] = useState(false);

    /* ── Excel State ── */
    const [excelFile, setExcelFile] = useState(null);
    const [excelPreview, setExcelPreview] = useState(null);
    const [excelImporting, setExcelImporting] = useState(false);
    const [excelResult, setExcelResult] = useState(null);
    const [excelExporting, setExcelExporting] = useState(false);
    const excelInputRef = useRef(null);

    /* ── Loglar alt-sekme ── */
    const [logsSubTab, setLogsSubTab] = useState("logs");

    /* ── Toast ── */
    const showToast = useCallback((msg, type = "info") => {
        setToast({ msg, type });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4500);
    }, []);

    /* ── Dashboard Cache ── */
    const dashboardCacheRef = useRef(null);
    const loadDashboardCached = useCallback(async () => {
        if (dashboardCacheRef.current && (Date.now() - dashboardCacheRef.current.ts) < 30000) {
            setDashboardData(dashboardCacheRef.current.data);
            return;
        }
        setDashboardLoading(true);
        try {
            const res = await getProductManagementDashboard();
            const data = res.dashboard || null;
            setDashboardData(data);
            dashboardCacheRef.current = { data, ts: Date.now() };
        } catch { }
        setDashboardLoading(false);
    }, []);

    /* ── Veri Yükleme ── */
    const loadProducts = useCallback(async () => {
        try {
            const params = { page, limit: PAGE_SIZE };
            if (search) params.search = search;
            if (filterMP) params.marketplace = filterMP;
            if (filterStock) params.stockStatus = filterStock;
            const res = await getProducts(params);
            setProducts(res.products || []);
            setTotalProducts(res.total || 0);
            return res.products || [];
        } catch (e) { showToast("Ürünler yüklenemedi", "error"); return []; }
    }, [page, search, filterMP, filterStock, showToast]);

    const loadMarketplaces = useCallback(async () => {
        try {
            const uid = localStorage.getItem("userId");
            if (!uid) return;
            const res = await getUserMarketplaces(uid);
            const list = Array.isArray(res) ? res : (res.marketplaces || res.data || []);
            setMarketplaces(list.map(m => ({ ...m, name: normalizeMP(m.marketplaceName || m.name || "") })));
        } catch { }
    }, []);

    const loadComparison = useCallback(async () => {
        try {
            const params = { page: compPage, limit: PAGE_SIZE };
            if (compSearch) params.search = compSearch;
            if (missingOnly) params.missingOnly = "true";
            const res = await getComparisonMatrix(params);
            setCompMatrix(res.matrix || []);
            setCompTotal(res.total || 0);
            setCompSummary(res.summary || null);
        } catch { }
    }, [compPage, compSearch, missingOnly]);

    const loadLogs = useCallback(async () => {
        try {
            const res = await getSyncLogs({ page: logsPage, limit: 50 });
            setLogs(res.logs || []);
            setLogsTotal(res.total || 0);
        } catch { }
    }, [logsPage]);

    const loadNotifications = useCallback(async () => {
        try { const res = await getUnreadNotifications(); setNotifications(res.notifications || []); setUnreadCount(res.counts?.total || 0); } catch { }
    }, []);

    const runAutoSync = useCallback(async () => {
        if (autoSyncRunning) return;
        setAutoSyncRunning(true);
        setAutoSyncStatus("Tüm pazaryerlerinden ürünler çekiliyor...");
        try {
            const res = await syncAllMarketplaces();
            const { totalNew = 0, totalUpdated = 0 } = res.summary || {};
            const results = res.results || [];
            const failedMPs = results.filter(r => !r.success).map(r => `${r.marketplace}: ${r.error || "Hata"}`);

            if (failedMPs.length > 0 && results.some(r => r.success)) {
                setAutoSyncStatus(`Kısmi başarı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated}`);
                showToast(`Senkronizasyon kısmen tamamlandı — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`, "warning");
            } else if (failedMPs.length > 0) {
                setAutoSyncStatus("Senkronizasyon başarısız");
                showToast(`Senkronizasyon başarısız: ${failedMPs.join("; ")}`, "error");
            } else {
                setAutoSyncStatus(`Tamamlandı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated}`);
                showToast(`Senkronizasyon tamamlandı — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`, "success");
            }

            dashboardCacheRef.current = null;
            loadProducts(); loadComparison(); loadDashboardCached();

            setTimeout(async () => {
                try {
                    const pendingResult = await checkPendingTasks();
                    if (pendingResult.updated > 0 || pendingResult.failed > 0) {
                        dashboardCacheRef.current = null;
                        loadProducts(); loadDashboardCached();
                        showToast(`N11 kontrol: ${pendingResult.updated} kesinleşti, ${pendingResult.failed} başarısız`, pendingResult.failed > 0 ? "warning" : "success");
                    }
                } catch { }
            }, 10000);
        } catch (e) {
            setAutoSyncStatus("Senkronizasyon başarısız");
            showToast("Senkronizasyon başarısız: " + (e?.response?.data?.error || e.message || "Bilinmeyen hata"), "error");
        } finally { setAutoSyncRunning(false); setTimeout(() => setAutoSyncStatus(""), 12000); }
    }, [autoSyncRunning, showToast, loadProducts, loadComparison, loadDashboardCached]);

    /* ── İlk Yükleme ── */
    useEffect(() => {
        loadMarketplaces(); loadNotifications(); loadProducts(); loadDashboardCached(); loadComparison();
        if (!autoSyncDone.current) {
            autoSyncDone.current = true;
            const timer = setTimeout(() => { runAutoSync(); }, 2000);
            return () => clearTimeout(timer);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadProducts(); }, [page, search, filterMP, filterStock]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (activeTab === "logs") { loadLogs(); loadNotifications(); }
        if (activeTab === "comparison") loadComparison();
        if (activeTab === "dashboard") loadDashboardCached();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { loadComparison(); }, [compPage, compSearch, missingOnly]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (activeTab === "logs") loadLogs(); }, [logsPage]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Aksiyonlar ── */
    const handleSyncStock = async () => {
        if (!stockModal?.product) return;
        const val = parseInt(stockValue);
        if (isNaN(val) || val < 0) { showToast("Geçerli stok girin", "warning"); return; }
        setLoading(true);
        try {
            await syncStock(stockModal.product._id, val);
            showToast("Stok güncellendi!", "success");
            setStockModal(null); setStockValue(""); loadProducts();
        } catch { showToast("Stok güncellenemedi", "error"); }
        finally { setLoading(false); }
    };

    const handleSyncPrice = async () => {
        if (!priceModal?.product) return;
        const sp = parseFloat(salePrice);
        if (isNaN(sp) || sp <= 0) { showToast("Geçerli fiyat girin", "warning"); return; }
        setLoading(true);
        try {
            await syncPrice(priceModal.product._id, sp, listPrice ? parseFloat(listPrice) : null);
            showToast("Fiyat güncellendi!", "success");
            setPriceModal(null); setSalePrice(""); setListPrice(""); loadProducts();
        } catch { showToast("Fiyat güncellenemedi", "error"); }
        finally { setLoading(false); }
    };

    const handleBulkPriceUpdate = async () => {
        if (selectedProducts.length === 0) { showToast("Ürün seçin", "warning"); return; }
        if (!bulkPriceValue) { showToast("Değer girin", "warning"); return; }
        setLoading(true);
        let ok = 0, err = 0;
        const BATCH = 3;
        for (let i = 0; i < selectedProducts.length; i += BATCH) {
            const batch = selectedProducts.slice(i, i + BATCH);
            const results = await Promise.allSettled(batch.map(pid => {
                const p = products.find(x => x._id === pid);
                if (!p) return Promise.resolve(null);
                const mp = p.masterProduct || p;
                let newPrice = bulkPriceMode === "fixed" ? parseFloat(bulkPriceValue)
                    : bulkPriceMode === "percent" ? mp.price * (1 - parseFloat(bulkPriceValue) / 100)
                    : mp.price * (1 + parseFloat(bulkPriceValue) / 100);
                if (newPrice > 0) return syncPrice(pid, newPrice);
                return Promise.resolve(null);
            }));
            results.forEach(r => { if (r.status === "fulfilled" && r.value) ok++; else if (r.status === "rejected") err++; });
        }
        showToast(`${ok} başarılı, ${err} hata`, ok > 0 ? "success" : "error");
        setBulkPriceValue(""); setSelectedProducts([]); loadProducts();
        setLoading(false);
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        setLoading(true);
        try { await deleteProduct(deleteModal._id); showToast("Ürün silindi", "success"); setDeleteModal(null); loadProducts(); }
        catch { showToast("Silinemedi", "error"); }
        finally { setLoading(false); }
    };

    const handleBulkDistribute = async () => {
        if (selectedProducts.length === 0 || bulkTargets.length === 0) { showToast("Ürün ve platform seçin", "warning"); return; }
        setDistLoading(true);
        try {
            const res = await bulkDistributeSelected(selectedProducts, bulkTargets);
            const r = res.results || {};
            showToast(`Dağıtım: ${r.success || 0} başarılı, ${r.skipped || 0} atlanan, ${r.error || 0} hata`, (r.success || 0) > 0 ? "success" : "warning");
            setSelectedProducts([]); setBulkTargets([]); loadProducts(); loadComparison();
        } catch { showToast("Dağıtım başarısız", "error"); }
        finally { setDistLoading(false); }
    };

    const handleCreateProduct = async () => {
        const { name, barcode, sku, price } = newProduct;
        if (!name || !barcode || !sku || !price) { showToast("Zorunlu alanları doldurun (Ad, Barkod, SKU, Fiyat)", "warning"); return; }
        setLoading(true);
        try {
            await createProduct({
                ...newProduct,
                price: parseFloat(newProduct.price),
                listPrice: newProduct.listPrice ? parseFloat(newProduct.listPrice) : parseFloat(newProduct.price),
                stock: parseInt(newProduct.stock) || 0,
                images: newProduct.images.filter(Boolean).map(url => ({ url })),
                marketplaceMappings: newProductTargets.map(mpName => ({ marketplaceName: mpName, syncStatus: "pending" }))
            });
            showToast("Ürün oluşturuldu!", "success");
            setProductsSubTab("list");
            setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] });
            setNewProductTargets([]);
            loadProducts();
        } catch (e) { showToast("Oluşturulamadı: " + (e?.response?.data?.error || e.message || ""), "error"); }
        finally { setLoading(false); }
    };

    /* ── Karşılaştırma: Tek ürünü eksik platformlara dağıt ── */
    const handleDistributeSingle = async (productId, missingMPs) => {
        if (!missingMPs || missingMPs.length === 0) return;
        setCompDistributing(prev => ({ ...prev, [productId]: true }));
        try {
            const res = await bulkDistributeSelected([productId], missingMPs);
            const r = res.results || {};
            showToast(`${(r.success || 0)} platforma dağıtıldı`, (r.success || 0) > 0 ? "success" : "warning");
            loadProducts(); loadComparison();
        } catch { showToast("Dağıtım başarısız", "error"); }
        finally { setCompDistributing(prev => ({ ...prev, [productId]: false })); }
    };

    const handleMarkAllRead = async () => { try { await markNotificationRead("all"); loadNotifications(); showToast("Okundu", "success"); } catch { } };

    const toggleProduct = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleAllProducts = () => setSelectedProducts(selectedProducts.length === products.length ? [] : products.map(p => p._id));
    const toggleTarget = (name) => setBulkTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
    const toggleNewProductTarget = (name) => setNewProductTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    const getProductMPs = (p) => (p.marketplaceMappings || []).map(m => normalizeMP(m.marketplaceName)).filter(Boolean);
    const getMissingMPs = (p) => { const have = getProductMPs(p); return marketplaces.map(m => m.name).filter(n => !have.includes(n)); };

    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

    /* ── Platform varlık rozeti ── */
    const PlatformBadges = ({ product }) => {
        const mappings = product.marketplaceMappings || [];
        if (marketplaces.length === 0) return <span className="pmh-cell-sub">—</span>;
        return (
            <div className="pmh-platform-badges">
                {marketplaces.map((mp, i) => {
                    const mapping = mappings.find(m => normalizeMP(m.marketplaceName) === normalizeMP(mp.name));
                    const exists = !!mapping;
                    const synced = mapping?.syncStatus === "synced";
                    const hasError = mapping?.syncStatus === "error";
                    const pending = mapping?.syncStatus === "pending";
                    const color = mpColor(mp.name);
                    return (
                        <span
                            key={i}
                            className={`pmh-platform-badge ${exists ? (synced ? "synced" : hasError ? "error" : pending ? "pending" : "exists") : "missing"}`}
                            style={{ "--mp-color": color }}
                            title={`${mp.name}: ${synced ? "Senkron ✓" : hasError ? "Hata ✗" : pending ? "Bekliyor..." : exists ? "Var" : "Yok"}`}
                        >
                            <span className="pmh-platform-badge-dot" />
                            <span className="pmh-platform-badge-name">{mp.name?.substring(0, 3)}</span>
                            <span className="pmh-platform-badge-status">
                                {synced ? "✓" : hasError ? "✗" : pending ? "⏳" : exists ? "~" : "—"}
                            </span>
                        </span>
                    );
                })}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Dashboard
       ══════════════════════════════════════════════════════════════════════════ */
    const renderDashboard = () => {
        const db = dashboardData;
        const pData = db?.products || {};
        const total = pData.total || totalProducts || products.length;
        const outOfStock = pData.outOfStock || 0;
        const lowStock = pData.lowStock || 0;
        const healthy = pData.healthy || (total - outOfStock - lowStock);
        const mpStats = db?.marketplaces || [];
        const recentLogs = db?.recentLogs || [];

        const totalSyncedFromMP = mpStats.reduce((s, mp) => s + (mp.syncedProducts || 0), 0);
        const totalErrorsFromMP = mpStats.reduce((s, mp) => s + (mp.errorProducts || 0), 0);
        const synced = mpStats.length > 0 ? totalSyncedFromMP : products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "synced")).length;
        const errors = mpStats.length > 0 ? totalErrorsFromMP : products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "error")).length;
        const syncRate = total > 0 ? Math.round((synced / total) * 100) : 0;

        // Platform dağılım analizi
        const compData = compSummary || {};
        const fullyDist = compData.fullyDistributed || 0;
        const partialDist = compData.partiallyMissing || 0;
        const notDist = compData.notDistributed || 0;
        const coverageRate = total > 0 ? Math.round((fullyDist / total) * 100) : 0;

        const mpBarData = (mpStats.length > 0 ? mpStats : marketplaces.map(m => ({ name: m.name }))).map(mp => {
            const mpProds = mp.totalProducts || 0;
            return { name: mp.name, value: mpProds, color: mpColor(mp.name), synced: mp.syncedProducts || 0, errors: mp.errorProducts || 0 };
        });
        const maxBarVal = Math.max(...mpBarData.map(d => d.value), 1);

        return (
            <div className="pmh-fade-in">
                {/* Sync Banner */}
                {autoSyncStatus && (
                    <div className={`pmh-sync-banner ${autoSyncRunning ? "running" : autoSyncStatus.includes("başarısız") ? "error" : "success"}`}>
                        {autoSyncRunning && <Spinner />}
                        {!autoSyncRunning && !autoSyncStatus.includes("başarısız") && <FaCheckCircle />}
                        {!autoSyncRunning && autoSyncStatus.includes("başarısız") && <FaTimesCircle />}
                        <span>{autoSyncStatus}</span>
                    </div>
                )}

                {dashboardLoading && !db && (
                    <div className="pmh-empty"><Spinner /> <span>Dashboard yükleniyor...</span></div>
                )}

                {/* KPI Grid */}
                <div className="pmh-kpi-grid">
                    {[
                        { icon: <FaBoxOpen />, label: "Toplam Ürün", value: fmtNum(total), sub: `${marketplaces.length} pazaryeri bağlı`, color: "#4ecdc4", onClick: () => setActiveTab("products") },
                        { icon: <FaGlobe />, label: "Platform Kapsama", value: `%${coverageRate}`, sub: `${fmtNum(fullyDist)} tam, ${fmtNum(partialDist)} kısmi`, color: coverageRate >= 80 ? "#22c55e" : coverageRate >= 50 ? "#f59e0b" : "#ef4444", onClick: () => setActiveTab("comparison") },
                        { icon: <FaCheckCircle />, label: "Senkron Oranı", value: `%${syncRate}`, sub: `${fmtNum(synced)} / ${fmtNum(total)}`, color: "#22c55e" },
                        { icon: <FaExclamationTriangle />, label: "Dikkat Gerektiren", value: fmtNum(errors + outOfStock + lowStock), sub: errors > 0 ? `${errors} hata, ${outOfStock} stoksuz` : "Sorun yok ✓", color: (errors + outOfStock) > 0 ? "#ef4444" : "#22c55e", onClick: () => { setActiveTab("products"); setFilterStock("outOfStock"); } },
                    ].map((k, i) => (
                        <div key={i} className="pmh-kpi-card" onClick={k.onClick} style={{ "--kpi-color": k.color, cursor: k.onClick ? "pointer" : "default" }}>
                            <div className="pmh-kpi-icon">{k.icon}</div>
                            <div className="pmh-kpi-body">
                                <span className="pmh-kpi-label">{k.label}</span>
                                <span className="pmh-kpi-value">{k.value}</span>
                                <span className="pmh-kpi-sub">{k.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* İki Sütun: Pazaryeri + Hızlı Aksiyonlar */}
                <div className="pmh-dash-grid">
                    {/* Pazaryeri Performansı */}
                    <div className="pmh-card">
                        <div className="pmh-card-head">
                            <h3><FaStore style={{ color: "#8b5cf6" }} /> Pazaryeri Dağılımı</h3>
                        </div>
                        <div className="pmh-card-body">
                            {mpBarData.length === 0 ? (
                                <div className="pmh-empty"><FaStore style={{ fontSize: "2rem" }} /><p>Pazaryeri entegrasyonu yok</p></div>
                            ) : (
                                <div className="pmh-bar-list">
                                    {mpBarData.map((mp, idx) => {
                                        const pct = maxBarVal > 0 ? (mp.value / maxBarVal) * 100 : 0;
                                        const syncedPct = mp.value > 0 ? Math.round((mp.synced / mp.value) * 100) : 0;
                                        return (
                                            <div key={idx} className="pmh-bar-row">
                                                <div className="pmh-bar-label">
                                                    <span className="pmh-bar-dot" style={{ background: mp.color }} />
                                                    <span>{mp.name}</span>
                                                </div>
                                                <div className="pmh-bar-track">
                                                    <div className="pmh-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${mp.color}, ${mp.color}88)` }} />
                                                </div>
                                                <div className="pmh-bar-stats">
                                                    <span style={{ color: mp.color, fontWeight: 700 }}>{fmtNum(mp.value)}</span>
                                                    <span className="pmh-bar-sync-badge" style={{ color: syncedPct >= 80 ? "#22c55e" : "#f59e0b" }}>%{syncedPct}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Platform Kapsama Özeti */}
                            {total > 0 && (
                                <div className="pmh-coverage-summary">
                                    <div className="pmh-coverage-bar">
                                        <div className="pmh-coverage-fill pmh-coverage-full" style={{ width: `${total > 0 ? (fullyDist / total) * 100 : 0}%` }} />
                                        <div className="pmh-coverage-fill pmh-coverage-partial" style={{ width: `${total > 0 ? (partialDist / total) * 100 : 0}%` }} />
                                        <div className="pmh-coverage-fill pmh-coverage-none" style={{ width: `${total > 0 ? (notDist / total) * 100 : 0}%` }} />
                                    </div>
                                    <div className="pmh-coverage-legend">
                                        <span><span className="pmh-cov-dot" style={{ background: "#22c55e" }} /> Tam ({fullyDist})</span>
                                        <span><span className="pmh-cov-dot" style={{ background: "#f59e0b" }} /> Kısmi ({partialDist})</span>
                                        <span><span className="pmh-cov-dot" style={{ background: "#ef4444" }} /> Yok ({notDist})</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hızlı Aksiyonlar + Son İşlemler */}
                    <div className="pmh-card">
                        <div className="pmh-card-head">
                            <h3><FaRocket style={{ color: "#f59e0b" }} /> Hızlı Aksiyonlar</h3>
                        </div>
                        <div className="pmh-card-body">
                            <div className="pmh-quick-actions">
                                {[
                                    { icon: <FaSync />, label: "Senkronize Et", color: "#4ecdc4", action: runAutoSync, disabled: autoSyncRunning },
                                    { icon: <FaPlus />, label: "Yeni Ürün", color: "#22c55e", action: () => { setActiveTab("products"); setProductsSubTab("upload"); } },
                                    { icon: <FaCloudDownloadAlt />, label: "Çek & Yükle", color: "#8b5cf6", action: () => setActiveTab("pull-push") },
                                    { icon: <FaDollarSign />, label: "Fiyatlandırma", color: "#f59e0b", action: () => setActiveTab("pricing") },
                                    { icon: <FaGlobe />, label: "Platform Analizi", color: "#3b82f6", action: () => setActiveTab("comparison") },
                                    { icon: <FaFileExcel />, label: "Excel", color: "#10b981", action: () => { setActiveTab("logs"); setLogsSubTab("excel"); } },
                                ].map((a, i) => (
                                    <button key={i} className="pmh-quick-btn" onClick={a.action} disabled={a.disabled} style={{ "--btn-color": a.color }}>
                                        <span className="pmh-quick-icon">{a.disabled ? <Spinner /> : a.icon}</span>
                                        <span>{a.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Son İşlemler */}
                            {recentLogs.length > 0 && (
                                <div className="pmh-recent-logs">
                                    <h4><FaClipboardList /> Son İşlemler</h4>
                                    {recentLogs.slice(0, 5).map((log, i) => {
                                        const isOk = log.status === "synced" || log.status === "success";
                                        const isErr = log.status === "error";
                                        return (
                                            <div key={i} className="pmh-log-mini">
                                                <span className={`pmh-log-dot ${isOk ? "ok" : isErr ? "err" : "warn"}`} />
                                                <span className="pmh-log-action">{log.actionType || "İşlem"}</span>
                                                <span className="pmh-log-product">{log.product?.name || "—"}</span>
                                                <span className="pmh-log-time">{log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Ürünlerim
       ══════════════════════════════════════════════════════════════════════════ */
    const renderProducts = () => {
        const total = products.length;
        const outOfStock = products.filter(p => (p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0) === 0).length;
        const lowStock = products.filter(p => { const s = p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0; return s > 0 && s <= 10; }).length;

        return (
            <div className="pmh-fade-in">
                {/* Alt Sekmeler */}
                <div className="pmh-sub-tabs">
                    <button className={`pmh-sub-tab ${productsSubTab === "list" ? "active" : ""}`} onClick={() => setProductsSubTab("list")}><FaBoxOpen /> Ürün Listesi</button>
                    <button className={`pmh-sub-tab ${productsSubTab === "upload" ? "active" : ""}`} onClick={() => setProductsSubTab("upload")}><FaPlus /> Yeni Ürün Ekle</button>
                </div>

                {productsSubTab === "list" && (
                    <>
                        {/* Mini KPI */}
                        <div className="pmh-mini-kpi-row">
                            {[
                                { icon: "📦", label: "Toplam", val: total, color: "#14b8a6", f: "" },
                                { icon: "✅", label: "Sağlıklı", val: total - outOfStock - lowStock, color: "#22c55e", f: "" },
                                { icon: "⚠️", label: "Düşük Stok", val: lowStock, color: "#f59e0b", f: "lowStock" },
                                { icon: "🚫", label: "Stok Yok", val: outOfStock, color: "#ef4444", f: "outOfStock" }
                            ].map((k, i) => (
                                <div key={i} className={`pmh-mini-kpi ${filterStock === k.f && k.f ? "active" : ""}`} onClick={() => { setFilterStock(filterStock === k.f ? "" : k.f); setPage(0); }} style={{ "--kpi-color": k.color }}>
                                    <span className="pmh-mini-kpi-icon">{k.icon}</span>
                                    <span className="pmh-mini-kpi-val">{k.val}</span>
                                    <span className="pmh-mini-kpi-label">{k.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="pmh-toolbar">
                            <div className="pmh-search-box">
                                <FaSearch className="pmh-search-icon" />
                                <input type="text" placeholder="Ürün adı, barkod veya SKU ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" />
                            </div>
                            <select value={filterMP} onChange={e => { setFilterMP(e.target.value); setPage(0); }} className="pmh-select">
                                <option value="">Tüm Platformlar</option>
                                {marketplaces.map(mp => <option key={mp._id} value={mp.name}>{mp.name}</option>)}
                            </select>
                            <select value={filterStock} onChange={e => { setFilterStock(e.target.value); setPage(0); }} className="pmh-select">
                                <option value="">Tüm Stok</option>
                                <option value="outOfStock">🚫 Stok Yok</option>
                                <option value="lowStock">⚠️ Düşük</option>
                            </select>
                            <span className="pmh-count-badge">{totalProducts} ürün</span>
                            <button className="pmh-btn pmh-btn-outline" onClick={toggleAllProducts}>{selectedProducts.length === products.length && products.length > 0 ? <><FaTimesCircle /> Seçimi Kaldır</> : <><FaCheckSquare /> Tümünü Seç</>}</button>
                            <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>{autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et</button>
                        </div>

                        {/* Toplu Dağıtım Barı */}
                        {selectedProducts.length > 0 && (
                            <div className="pmh-bulk-bar">
                                <span className="pmh-bulk-count"><FaCheckSquare /> {selectedProducts.length} ürün seçildi</span>
                                <div className="pmh-bulk-targets">
                                    {marketplaces.map(mp => (
                                        <label key={mp._id} className={`pmh-mp-chip ${bulkTargets.includes(mp.name) ? "active" : ""}`} style={{ "--mp-color": mpColor(mp.name) }}>
                                            <input type="checkbox" checked={bulkTargets.includes(mp.name)} onChange={() => toggleTarget(mp.name)} />
                                            <span className="pmh-mp-chip-dot" />
                                            {mp.name}
                                            {bulkTargets.includes(mp.name) && <FaCheck />}
                                        </label>
                                    ))}
                                </div>
                                <button className="pmh-btn pmh-btn-primary" onClick={handleBulkDistribute} disabled={distLoading || bulkTargets.length === 0}>{distLoading ? <Spinner /> : <FaRocket />} Dağıt</button>
                                <button className="pmh-btn pmh-btn-ghost" onClick={() => { setSelectedProducts([]); setBulkTargets([]); }}><FaTimes /></button>
                            </div>
                        )}

                        {/* Ürün Tablosu */}
                        {products.length === 0 ? (
                            <div className="pmh-empty">
                                <FaBox style={{ fontSize: "3rem" }} />
                                <p>Henüz ürün yok</p>
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}><FaSync /> Pazaryerlerinden Çek</button>
                                    <button className="pmh-btn pmh-btn-outline" onClick={() => setProductsSubTab("upload")}><FaPlus /> Manuel Ekle</button>
                                </div>
                            </div>
                        ) : (
                            <div className="pmh-table-wrap">
                                <table className="pmh-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}><input type="checkbox" checked={selectedProducts.length === products.length && products.length > 0} onChange={toggleAllProducts} /></th>
                                            <th>Ürün</th>
                                            <th>Barkod / SKU</th>
                                            <th>Fiyat</th>
                                            <th>Stok</th>
                                            <th>Platformlar</th>
                                            <th>İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(product => {
                                            const mp = product.masterProduct || product;
                                            const img = safeImg(mp.images);
                                            const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                            const price = mp.price ?? 0;
                                            const lp = mp.listPrice ?? price;
                                            const stockColor = stock === 0 ? "#ef4444" : stock <= 10 ? "#f59e0b" : "#22c55e";
                                            const sel = selectedProducts.includes(product._id);
                                            const missingMPs = getMissingMPs(product);

                                            return (
                                                <tr key={product._id} className={`pmh-tr ${sel ? "selected" : ""}`}>
                                                    <td><input type="checkbox" checked={sel} onChange={() => toggleProduct(product._id)} /></td>
                                                    <td>
                                                        <div className="pmh-product-cell">
                                                            <div className="pmh-thumb">{img ? <img src={img} alt="" /> : <FaBox />}</div>
                                                            <div>
                                                                <div className="pmh-cell-title">{mp.name || "İsimsiz"}</div>
                                                                {mp.brand && <div className="pmh-cell-sub">{mp.brand}</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><div className="pmh-cell-mono">{mp.barcode || "—"}</div><div className="pmh-cell-sub">{mp.sku || "—"}</div></td>
                                                    <td>
                                                        <span className="pmh-price-main">{fmt(price)}</span>
                                                        {lp > price && <span className="pmh-price-old">{fmt(lp)}</span>}
                                                    </td>
                                                    <td><span className="pmh-stock-pill" style={{ "--stock-color": stockColor }}>{stock === 0 ? "Yok" : stock <= 10 ? `${stock} ⚠️` : stock}</span></td>
                                                    <td><PlatformBadges product={product} /></td>
                                                    <td>
                                                        <div className="pmh-actions">
                                                            <button className="pmh-act-btn" title="Stok Güncelle" onClick={() => { setStockModal({ product }); setStockValue(String(stock)); }}><FaWarehouse /></button>
                                                            <button className="pmh-act-btn" title="Fiyat Güncelle" onClick={() => { setPriceModal({ product }); setSalePrice(String(price)); setListPrice(String(lp)); }}><FaMoneyBillWave /></button>
                                                            {missingMPs.length > 0 && (
                                                                <button className="pmh-act-btn distribute" title={`${missingMPs.length} platforma dağıt`} onClick={() => handleDistributeSingle(product._id, missingMPs)}><FaRocket /></button>
                                                            )}
                                                            <button className="pmh-act-btn danger" title="Sil" onClick={() => setDeleteModal(product)}><FaTrash /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="pmh-pagination">
                                <button className="pmh-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button>
                                <span className="pmh-pg-info">Sayfa {page + 1} / {totalPages}</span>
                                <button className="pmh-pg-btn" disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>Sonraki →</button>
                            </div>
                        )}
                    </>
                )}

                {/* Yeni Ürün Ekle */}
                {productsSubTab === "upload" && (
                    <div className="pmh-card">
                        <div className="pmh-card-head"><h3><FaPlus style={{ color: "#22c55e" }} /> Yeni Ürün Oluştur</h3></div>
                        <div className="pmh-card-body">
                            <div className="pmh-form-grid">
                                {[
                                    { key: "name", label: "Ürün Adı *", placeholder: "Ürün adını girin" },
                                    { key: "barcode", label: "Barkod *", placeholder: "8680000000000" },
                                    { key: "sku", label: "SKU *", placeholder: "SKU-001" },
                                    { key: "brand", label: "Marka", placeholder: "Marka adı" },
                                    { key: "category", label: "Kategori", placeholder: "Giyim > Kadın" },
                                    { key: "stock", label: "Stok *", type: "number", placeholder: "100" },
                                    { key: "price", label: "Satış Fiyatı (₺) *", type: "number", placeholder: "299.90" },
                                    { key: "listPrice", label: "Liste Fiyatı (₺)", type: "number", placeholder: "399.90" },
                                ].map(f => (
                                    <div key={f.key} className="pmh-form-field">
                                        <label>{f.label}</label>
                                        <input type={f.type || "text"} value={newProduct[f.key]} onChange={e => setNewProduct(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                                    </div>
                                ))}
                            </div>
                            <div className="pmh-form-field" style={{ marginTop: "1rem" }}>
                                <label>Açıklama</label>
                                <textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Ürün açıklaması..." rows={3} />
                            </div>
                            <div className="pmh-form-field" style={{ marginTop: "1rem" }}>
                                <label>Hedef Pazaryerleri</label>
                                <div className="pmh-mp-chips">
                                    {marketplaces.length === 0 ? (
                                        <span className="pmh-cell-sub">Henüz pazaryeri entegrasyonu yok.</span>
                                    ) : marketplaces.map(mp => (
                                        <label key={mp._id} className={`pmh-mp-chip ${newProductTargets.includes(mp.name) ? "active" : ""}`} style={{ "--mp-color": mpColor(mp.name) }}>
                                            <input type="checkbox" checked={newProductTargets.includes(mp.name)} onChange={() => toggleNewProductTarget(mp.name)} />
                                            <span className="pmh-mp-chip-dot" />
                                            {mp.name}
                                            {newProductTargets.includes(mp.name) && <FaCheck />}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="pmh-form-actions">
                                <button className="pmh-btn pmh-btn-outline" onClick={() => { setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] }); setNewProductTargets([]); }}><FaTimes /> Temizle</button>
                                <button className="pmh-btn pmh-btn-primary" onClick={handleCreateProduct} disabled={loading || !newProduct.name || !newProduct.barcode || !newProduct.sku || !newProduct.price}>
                                    {loading ? <Spinner /> : <FaRocket />} {newProductTargets.length > 0 ? `Kaydet & ${newProductTargets.length} Platforma Yükle` : "Ürünü Kaydet"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Çek & Yükle
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPullPush = () => {
        const handlePull = async () => {
            if (!pullSource) { showToast("Kaynak pazaryeri seçin", "warning"); return; }
            if (autoSyncRunning) { showToast("Arka plan senkronizasyonu devam ediyor", "warning"); return; }
            setPullLoading(true); setPullResult(null); setPulledProducts([]); setSelectedPulledProducts([]); setPushResult(null);
            try {
                const sourceMP = marketplaces.find(m => m.name === pullSource);
                if (!sourceMP) { showToast("Pazaryeri bulunamadı", "error"); return; }
                const res = await syncFromMarketplace(sourceMP._id, sourceMP.name);
                const stats = res.stats || res;
                const newCount = stats.new || stats.newProducts || 0;
                const updatedCount = stats.updated || stats.updatedProducts || 0;
                setPullResult({ success: true, newCount, updatedCount, total: newCount + updatedCount, source: pullSource });
                showToast(`${pullSource}: ${newCount} yeni, ${updatedCount} güncellenen`, "success");
                const freshProducts = await loadProducts();
                setPulledProducts(freshProducts);
                setSelectedPulledProducts(freshProducts.map(p => p._id));
                loadComparison();
            } catch (e) {
                const rawError = e?.response?.data?.error || e?.message || "Ürünler çekilemedi";
                setPullResult({ success: false, error: rawError });
                showToast("Hata: " + rawError, "error");
            } finally { setPullLoading(false); }
        };

        const handlePush = async () => {
            if (pushTargets.length === 0 || selectedPulledProducts.length === 0) { showToast("Hedef ve ürün seçin", "warning"); return; }
            setPushLoading(true); setPushResult(null);
            try {
                const res = await bulkDistributeSelected(selectedPulledProducts, pushTargets);
                const results = res.results || res;
                setPushResult({ success: true, successCount: results.success || results.distributed || 0, errorCount: results.error || results.errors || 0, skippedCount: results.skipped || 0 });
                showToast("Dağıtım tamamlandı", "success");
                loadProducts(); loadComparison();
            } catch (e) {
                setPushResult({ success: false, error: e?.response?.data?.error || e?.message || "Dağıtım başarısız" });
                showToast("Hata", "error");
            } finally { setPushLoading(false); }
        };

        const availableTargets = marketplaces.filter(m => m.name !== pullSource);
        const currentStep = !pullResult?.success ? 1 : !pushResult ? 2 : 3;

        return (
            <div className="pmh-fade-in">
                <div className="pmh-steps">
                    {[{ num: 1, label: "Kaynak Seç & Çek" }, { num: 2, label: "Kontrol Et & Dağıt" }, { num: 3, label: "Sonuç" }].map((step, i) => (
                        <React.Fragment key={step.num}>
                            {i > 0 && <div className={`pmh-step-line ${currentStep > step.num - 1 ? "done" : ""}`} />}
                            <div className={`pmh-step ${currentStep === step.num ? "active" : currentStep > step.num ? "done" : ""}`}>
                                <span className="pmh-step-num">{currentStep > step.num ? "✓" : step.num}</span>
                                <span className="pmh-step-label">{step.label}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                <div className="pmh-pull-push-grid">
                    <div className={`pmh-card ${currentStep === 1 ? "highlight-accent" : ""}`}>
                        <div className="pmh-card-head"><h3><FaCloudDownloadAlt style={{ color: "#8b5cf6" }} /> Kaynak Pazaryeri</h3></div>
                        <div className="pmh-card-body">
                            {marketplaces.length === 0 ? (
                                <div className="pmh-empty"><FaStore /><p>Pazaryeri entegrasyonu yok</p></div>
                            ) : (
                                <>
                                    <div className="pmh-mp-select-list">
                                        {marketplaces.map(mp => (
                                            <div key={mp._id} className={`pmh-mp-select-item ${pullSource === mp.name ? "active" : ""}`} onClick={() => { if (!pullLoading) setPullSource(mp.name); }} style={{ "--mp-color": mpColor(mp.name) }}>
                                                <span className="pmh-mp-select-dot" />
                                                <span>{mp.name}</span>
                                                {pullSource === mp.name && <FaCheckCircle />}
                                            </div>
                                        ))}
                                    </div>
                                    <button className="pmh-btn pmh-btn-primary pmh-btn-full" onClick={handlePull} disabled={!pullSource || pullLoading || autoSyncRunning}>
                                        {pullLoading ? <><Spinner /> Çekiliyor...</> : <><FaCloudDownloadAlt /> {pullSource ? `${pullSource} Çek` : "Önce Seçin"}</>}
                                    </button>
                                </>
                            )}
                            {pullResult && (
                                <div className={`pmh-result-box ${pullResult.success ? "success" : "error"}`}>
                                    {pullResult.success ? (<><FaCheckCircle /> <strong>{pullResult.source}</strong> — {pullResult.newCount} yeni, {pullResult.updatedCount} güncellenen</>) : (<><FaTimesCircle /> {pullResult.error}</>)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`pmh-card ${currentStep >= 2 ? "highlight-warning" : "dimmed"}`}>
                        <div className="pmh-card-head"><h3><FaCloudUploadAlt style={{ color: "#f59e0b" }} /> Hedef Seç & Dağıt</h3></div>
                        <div className="pmh-card-body">
                            {!pullResult?.success ? (
                                <div className="pmh-empty"><FaArrowLeft /><p>Önce sol panelden ürünleri çekin</p></div>
                            ) : (
                                <>
                                    <div className="pmh-mp-chips" style={{ marginBottom: "1rem" }}>
                                        {availableTargets.map(mp => (
                                            <label key={mp._id} className={`pmh-mp-chip ${pushTargets.includes(mp.name) ? "active" : ""}`} style={{ "--mp-color": mpColor(mp.name) }} onClick={() => setPushTargets(prev => prev.includes(mp.name) ? prev.filter(x => x !== mp.name) : [...prev, mp.name])}>
                                                <span className="pmh-mp-chip-dot" />
                                                {mp.name}
                                                {pushTargets.includes(mp.name) && <FaCheck />}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pmh-pull-product-list">
                                        <div className="pmh-pull-product-header">
                                            <span>Ürünler ({selectedPulledProducts.length}/{pulledProducts.length})</span>
                                            <button className="pmh-btn pmh-btn-ghost" onClick={() => setSelectedPulledProducts(selectedPulledProducts.length === pulledProducts.length ? [] : pulledProducts.map(p => p._id))}>
                                                {selectedPulledProducts.length === pulledProducts.length ? "Seçimi Kaldır" : "Tümünü Seç"}
                                            </button>
                                        </div>
                                        <div className="pmh-pull-product-scroll">
                                            {pulledProducts.map(product => {
                                                const mp = product.masterProduct || product;
                                                const sel = selectedPulledProducts.includes(product._id);
                                                return (
                                                    <div key={product._id} className={`pmh-pull-product-item ${sel ? "selected" : ""}`} onClick={() => setSelectedPulledProducts(prev => prev.includes(product._id) ? prev.filter(x => x !== product._id) : [...prev, product._id])}>
                                                        {sel ? <FaCheckSquare className="pmh-pull-check" /> : <FaSquare className="pmh-pull-check" />}
                                                        <span className="pmh-pull-product-name">{mp.name || "İsimsiz"}</span>
                                                        <span className="pmh-pull-product-price">{fmt(mp.price || 0)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <button className="pmh-btn pmh-btn-primary pmh-btn-full" onClick={handlePush} disabled={pushLoading || pushTargets.length === 0 || selectedPulledProducts.length === 0}>
                                        {pushLoading ? <><Spinner /> Dağıtılıyor...</> : <><FaCloudUploadAlt /> {selectedPulledProducts.length} Ürünü Dağıt</>}
                                    </button>
                                </>
                            )}
                            {pushResult && (
                                <div className={`pmh-result-box ${pushResult.success ? "success" : "error"}`}>
                                    {pushResult.success ? (<><FaCheckCircle /> {pushResult.successCount} başarılı, {pushResult.skippedCount} atlanan, {pushResult.errorCount} hata</>) : (<><FaTimesCircle /> {pushResult.error}</>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {(pullResult || pushResult) && (
                    <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                        <button className="pmh-btn pmh-btn-outline" onClick={() => { setPullSource(""); setPullResult(null); setPushTargets([]); setPushResult(null); setPulledProducts([]); setSelectedPulledProducts([]); }}><FaSync /> Yeni İşlem Başlat</button>
                    </div>
                )}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Fiyatlandırma
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPricing = () => {
        const modes = [
            { key: "per-product", icon: <FaTag />, label: "Ürün Bazlı", desc: "Her platformda farklı fiyat" },
            { key: "bulk", icon: <FaTags />, label: "Toplu Güncelle", desc: "Seçili ürünlere toplu fiyat" },
            { key: "base-sync", icon: <FaExchangeAlt />, label: "Baz Platform", desc: "1 platformdan diğerlerine" },
        ];

        const openPricingForProduct = (product) => {
            const mp = product.masterProduct || product;
            setPricingProduct(product);
            const prices = {};
            (product.marketplaceMappings || []).forEach(m => { prices[m.marketplaceName] = { salePrice: String(m.price || mp.price || ""), listPrice: String(m.listPrice || mp.listPrice || "") }; });
            marketplaces.forEach(m => { if (!prices[m.name]) prices[m.name] = { salePrice: String(mp.price || ""), listPrice: String(mp.listPrice || "") }; });
            setPlatformPrices(prices);
        };

        const savePlatformPrices = async () => {
            if (!pricingProduct) return;
            setPricingSaving(true);
            let ok = 0, err = 0;
            for (const [mpName, priceData] of Object.entries(platformPrices)) {
                const sp = parseFloat(priceData.salePrice);
                if (!sp || sp <= 0) continue;
                try { await syncPrice(pricingProduct._id, sp, priceData.listPrice ? parseFloat(priceData.listPrice) : null, mpName); ok++; } catch { err++; }
            }
            showToast(`${ok} platform güncellendi${err > 0 ? `, ${err} hata` : ""}`, ok > 0 ? "success" : "error");
            setPricingSaving(false); setPricingProduct(null); loadProducts();
        };

        const handleBaseSyncApply = async () => {
            if (!pricingBaseMP || pricingTargetMPs.length === 0) { showToast("Baz ve hedef platform seçin", "warning"); return; }
            setLoading(true);
            try {
                const res = await basePriceSync(pricingBaseMP, pricingTargetMPs, parseFloat(pricingMargin) || 0, pricingRoundTo || "");
                const r = res.results || {};
                showToast(`Baz fiyat sync — ${r.updated || 0} güncellendi, ${r.skipped || 0} atlandı`, r.updated > 0 ? "success" : "warning");
                dashboardCacheRef.current = null; loadProducts(); loadDashboardCached();
            } catch (e) { showToast("Hata: " + (e?.response?.data?.error || e.message), "error"); }
            setLoading(false);
        };

        return (
            <div className="pmh-fade-in">
                <div className="pmh-mode-selector">
                    {modes.map(m => (
                        <div key={m.key} className={`pmh-mode-card ${pricingMode === m.key ? "active" : ""}`} onClick={() => setPricingMode(m.key)}>
                            <span className="pmh-mode-icon">{m.icon}</span>
                            <span className="pmh-mode-label">{m.label}</span>
                            <span className="pmh-mode-desc">{m.desc}</span>
                        </div>
                    ))}
                </div>

                {pricingMode === "per-product" && (
                    <>
                        {pricingProduct ? (
                            <div className="pmh-card highlight-warning">
                                <div className="pmh-card-head">
                                    <h3><FaDollarSign /> Platform Bazlı Fiyat: <span style={{ color: "#e2e8f0" }}>{(pricingProduct.masterProduct || pricingProduct).name}</span></h3>
                                    <button className="pmh-btn pmh-btn-ghost" onClick={() => setPricingProduct(null)}><FaTimes /></button>
                                </div>
                                <div className="pmh-card-body">
                                    <div className="pmh-pricing-platform-grid">
                                        {marketplaces.map(mp => {
                                            const color = mpColor(mp.name);
                                            const prices = platformPrices[mp.name] || { salePrice: "", listPrice: "" };
                                            return (
                                                <div key={mp._id} className="pmh-pricing-platform-card" style={{ "--mp-color": color }}>
                                                    <div className="pmh-pricing-platform-head"><span className="pmh-mp-select-dot" style={{ "--mp-color": color }} /><span>{mp.name}</span></div>
                                                    <div className="pmh-pricing-inputs">
                                                        <div className="pmh-form-field"><label>Satış Fiyatı (₺)</label><input type="number" value={prices.salePrice} onChange={e => setPlatformPrices(prev => ({ ...prev, [mp.name]: { ...prev[mp.name], salePrice: e.target.value } }))} /></div>
                                                        <div className="pmh-form-field"><label>Liste Fiyatı (₺)</label><input type="number" value={prices.listPrice} onChange={e => setPlatformPrices(prev => ({ ...prev, [mp.name]: { ...prev[mp.name], listPrice: e.target.value } }))} /></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="pmh-form-actions">
                                        <button className="pmh-btn pmh-btn-outline" onClick={() => setPricingProduct(null)}>İptal</button>
                                        <button className="pmh-btn pmh-btn-primary" onClick={savePlatformPrices} disabled={pricingSaving}>{pricingSaving ? <Spinner /> : <FaSave />} Tüm Platformlara Kaydet</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="pmh-info-banner"><FaInfoCircle /> <span>Bir ürüne tıklayarak her platform için ayrı fiyat belirleyebilirsiniz.</span></div>
                                <div className="pmh-toolbar"><div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ürün ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div></div>
                                {products.length === 0 ? <div className="pmh-empty"><p>Ürün bulunamadı</p></div> : (
                                    <div className="pmh-table-wrap">
                                        <table className="pmh-table">
                                            <thead><tr><th>Ürün</th><th>Ana Fiyat</th>{marketplaces.map(mp => <th key={mp._id} style={{ color: mpColor(mp.name) }}>{mp.name}</th>)}<th>İşlem</th></tr></thead>
                                            <tbody>
                                                {products.map(product => {
                                                    const mp = product.masterProduct || product;
                                                    const price = mp.price ?? 0;
                                                    return (
                                                        <tr key={product._id} className="pmh-tr">
                                                            <td><div className="pmh-product-cell"><div className="pmh-thumb">{safeImg(mp.images) ? <img src={safeImg(mp.images)} alt="" /> : <FaBox />}</div><div><div className="pmh-cell-title">{mp.name || "İsimsiz"}</div></div></div></td>
                                                            <td><span className="pmh-price-main">{fmt(price)}</span></td>
                                                            {marketplaces.map(mkt => {
                                                                const mapping = (product.marketplaceMappings || []).find(m => m.marketplaceName === mkt.name);
                                                                const mpPrice = mapping?.price || price;
                                                                return <td key={mkt._id} style={{ textAlign: "center" }}>{mapping ? <span style={{ fontWeight: 700 }}>{fmt(mpPrice)}</span> : <span className="pmh-cell-sub">—</span>}</td>;
                                                            })}
                                                            <td><button className="pmh-btn pmh-btn-primary" style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }} onClick={() => openPricingForProduct(product)}><FaEdit /> Fiyatla</button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {pricingMode === "bulk" && (
                    <div className="pmh-card">
                        <div className="pmh-card-head"><h3><FaTags style={{ color: "#f59e0b" }} /> Toplu Fiyat Güncelleme</h3></div>
                        <div className="pmh-card-body">
                            <div className="pmh-mode-selector" style={{ marginBottom: "1rem" }}>
                                {[{ key: "fixed", label: "Sabit Fiyat", icon: "₺" }, { key: "percent", label: "% İndirim", icon: "🏷️" }, { key: "margin", label: "% Kar", icon: "📈" }].map(m => (
                                    <div key={m.key} className={`pmh-mode-card ${bulkPriceMode === m.key ? "active" : ""}`} onClick={() => setBulkPriceMode(m.key)}>
                                        <span style={{ fontSize: "1.2rem" }}>{m.icon}</span>
                                        <span className="pmh-mode-label">{m.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "1rem" }}>
                                <div className="pmh-form-field" style={{ minWidth: "150px" }}>
                                    <label>{bulkPriceMode === "fixed" ? "Yeni Fiyat (₺)" : bulkPriceMode === "percent" ? "İndirim (%)" : "Kar (%)"}</label>
                                    <input type="number" value={bulkPriceValue} onChange={e => setBulkPriceValue(e.target.value)} placeholder={bulkPriceMode === "fixed" ? "299.90" : "15"} />
                                </div>
                                <button className="pmh-btn pmh-btn-primary" onClick={handleBulkPriceUpdate} disabled={loading || selectedProducts.length === 0 || !bulkPriceValue}>{loading ? <Spinner /> : <FaMoneyBillWave />} {selectedProducts.length > 0 ? `${selectedProducts.length} Ürünü Güncelle` : "Önce Ürün Seçin"}</button>
                            </div>
                            <div className="pmh-toolbar"><div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div><button className="pmh-btn pmh-btn-outline" onClick={toggleAllProducts}>{selectedProducts.length === products.length ? "Seçimi Kaldır" : "Tümünü Seç"}</button></div>
                            {products.length > 0 && (
                                <div className="pmh-table-wrap">
                                    <table className="pmh-table">
                                        <thead><tr><th style={{ width: 40 }}><input type="checkbox" checked={selectedProducts.length === products.length} onChange={toggleAllProducts} /></th><th>Ürün</th><th>Fiyat</th><th>Stok</th></tr></thead>
                                        <tbody>{products.map(product => { const mp = product.masterProduct || product; const sel = selectedProducts.includes(product._id); return (<tr key={product._id} className={`pmh-tr ${sel ? "selected" : ""}`}><td><input type="checkbox" checked={sel} onChange={() => toggleProduct(product._id)} /></td><td><div className="pmh-cell-title">{mp.name || "İsimsiz"}</div></td><td><span className="pmh-price-main">{fmt(mp.price ?? 0)}</span></td><td>{product.stockTracking?.totalStock ?? mp.stock ?? 0}</td></tr>); })}</tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {pricingMode === "base-sync" && (
                    <div className="pmh-card">
                        <div className="pmh-card-head"><h3><FaExchangeAlt style={{ color: "#f59e0b" }} /> Baz Platform Fiyat Senkronizasyonu</h3></div>
                        <div className="pmh-card-body">
                            <div className="pmh-info-banner"><FaInfoCircle /> <span>Bir pazaryerini baz alarak fiyatları diğer platformlara otomatik dağıtın.</span></div>
                            <div className="pmh-pull-push-grid">
                                <div>
                                    <label className="pmh-field-label">Baz Platform (Fiyat Kaynağı)</label>
                                    <div className="pmh-mp-select-list">
                                        {marketplaces.map(mp => (
                                            <div key={mp._id} className={`pmh-mp-select-item ${pricingBaseMP === mp.name ? "active" : ""}`} onClick={() => { setPricingBaseMP(mp.name); setPricingTargetMPs(prev => prev.filter(t => t !== mp.name)); }} style={{ "--mp-color": mpColor(mp.name) }}>
                                                <span className="pmh-mp-select-dot" /><span>{mp.name}</span>{pricingBaseMP === mp.name && <FaCheckCircle />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="pmh-field-label">Hedef Platformlar</label>
                                    <div className="pmh-mp-select-list">
                                        {marketplaces.filter(mp => mp.name !== pricingBaseMP).map(mp => {
                                            const sel = pricingTargetMPs.includes(mp.name);
                                            return (
                                                <div key={mp._id} className={`pmh-mp-select-item ${sel ? "active" : ""}`} onClick={() => setPricingTargetMPs(prev => sel ? prev.filter(t => t !== mp.name) : [...prev, mp.name])} style={{ "--mp-color": mpColor(mp.name) }}>
                                                    <span className="pmh-mp-select-dot" /><span>{mp.name}</span>{sel && <FaCheck />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="pmh-form-grid" style={{ marginTop: "1rem" }}>
                                <div className="pmh-form-field"><label>Kar Marjı (%)</label><input type="number" value={pricingMargin} onChange={e => setPricingMargin(e.target.value)} placeholder="0" /></div>
                                <div className="pmh-form-field">
                                    <label>Yuvarlama</label>
                                    <select value={pricingRoundTo} onChange={e => setPricingRoundTo(e.target.value)} className="pmh-select">
                                        <option value="">Yok</option><option value="0.90">.90</option><option value="0.99">.99</option><option value="0.00">.00</option>
                                    </select>
                                </div>
                            </div>
                            <button className="pmh-btn pmh-btn-primary" onClick={handleBaseSyncApply} disabled={loading || !pricingBaseMP || pricingTargetMPs.length === 0} style={{ marginTop: "1rem" }}>{loading ? <Spinner /> : <FaRocket />} Fiyatları Senkronize Et</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Platform Analizi (Karşılaştırma)
       ══════════════════════════════════════════════════════════════════════════ */
    const renderComparison = () => {
        const perMP = compSummary?.perMarketplace || {};

        return (
            <div className="pmh-fade-in">
                {/* Özet KPI */}
                <div className="pmh-mini-kpi-row">
                    <div className="pmh-mini-kpi" style={{ "--kpi-color": "#22c55e" }}><span className="pmh-mini-kpi-icon">✅</span><span className="pmh-mini-kpi-val">{compSummary?.fullyDistributed ?? 0}</span><span className="pmh-mini-kpi-label">Tüm Platformlarda</span></div>
                    <div className="pmh-mini-kpi" style={{ "--kpi-color": "#f59e0b" }}><span className="pmh-mini-kpi-icon">⚠️</span><span className="pmh-mini-kpi-val">{compSummary?.partiallyMissing ?? 0}</span><span className="pmh-mini-kpi-label">Kısmi Eksik</span></div>
                    <div className="pmh-mini-kpi" style={{ "--kpi-color": "#ef4444" }}><span className="pmh-mini-kpi-icon">🚫</span><span className="pmh-mini-kpi-val">{compSummary?.notDistributed ?? 0}</span><span className="pmh-mini-kpi-label">Hiçbir Platformda Yok</span></div>
                    <div className="pmh-mini-kpi" style={{ "--kpi-color": "#3b82f6" }}><span className="pmh-mini-kpi-icon">📦</span><span className="pmh-mini-kpi-val">{compSummary?.totalProducts ?? compTotal}</span><span className="pmh-mini-kpi-label">Toplam Ürün</span></div>
                </div>

                {/* Platform bazlı özet kartları */}
                {Object.keys(perMP).length > 0 && (
                    <div className="pmh-platform-summary-row">
                        {Object.entries(perMP).map(([mpName, data]) => {
                            const color = mpColor(mpName);
                            const total = (data.present || 0) + (data.missing || 0);
                            const pct = total > 0 ? Math.round((data.present / total) * 100) : 0;
                            return (
                                <div key={mpName} className="pmh-platform-summary-card" style={{ "--mp-color": color }}>
                                    <div className="pmh-ps-header">
                                        <span className="pmh-ps-dot" />
                                        <span className="pmh-ps-name">{mpName}</span>
                                        <span className="pmh-ps-pct">%{pct}</span>
                                    </div>
                                    <div className="pmh-ps-bar">
                                        <div className="pmh-ps-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="pmh-ps-stats">
                                        <span>✅ {data.present || 0} var</span>
                                        <span>⬜ {data.missing || 0} eksik</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Toolbar */}
                <div className="pmh-toolbar">
                    <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ürün adı, barkod veya SKU ara..." value={compSearch} onChange={e => { setCompSearch(e.target.value); setCompPage(0); }} className="pmh-search-input" /></div>
                    <label className={`pmh-filter-toggle ${missingOnly ? "active" : ""}`}>
                        <input type="checkbox" checked={missingOnly} onChange={e => { setMissingOnly(e.target.checked); setCompPage(0); }} />
                        Sadece eksik olanlar
                    </label>
                    <button className="pmh-btn pmh-btn-outline" onClick={loadComparison}><FaSync /> Yenile</button>
                </div>

                {/* Tablo */}
                {compMatrix.length === 0 ? <div className="pmh-empty"><FaGlobe style={{ fontSize: "3rem" }} /><p>Veri bulunamadı — önce ürünleri senkronize edin</p></div> : (
                    <div className="pmh-table-wrap">
                        <table className="pmh-table">
                            <thead>
                                <tr>
                                    <th>Ürün</th><th>Barkod</th><th>Fiyat</th><th>Stok</th>
                                    {marketplaces.map((mp, i) => <th key={i} style={{ textAlign: "center", color: mpColor(mp.name), borderBottom: `3px solid ${mpColor(mp.name)}` }}>{mp.name}</th>)}
                                    <th style={{ textAlign: "center" }}>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {compMatrix.map(product => {
                                    const missingCount = product.missingCount || 0;
                                    const missingMPs = product.missingMarketplaces || [];
                                    const isDistributing = compDistributing[product._id];
                                    return (
                                        <tr key={product._id} className={`pmh-tr ${missingCount > 0 ? "has-missing" : ""}`}>
                                            <td><div className="pmh-cell-title">{product.name || "İsimsiz"}</div></td>
                                            <td className="pmh-cell-mono">{product.barcode || "—"}</td>
                                            <td><span className="pmh-price-main">{fmt(product.price || 0)}</span></td>
                                            <td style={{ textAlign: "center" }}><span style={{ fontWeight: 700, color: (product.stock || 0) === 0 ? "#ef4444" : "#22c55e" }}>{product.stock ?? "—"}</span></td>
                                            {marketplaces.map((mp, i) => {
                                                const mpNorm = normalizeMP(mp.name);
                                                const presence = product.presence?.[mpNorm] || product.presence?.[mp.name];
                                                const exists = presence?.exists;
                                                const color = mpColor(mp.name);
                                                return (
                                                    <td key={i} style={{ textAlign: "center" }}>
                                                        {exists ? (
                                                            <span className="pmh-comp-badge synced" style={{ "--mp-color": color }} title={`${mp.name}: Yüklü ✓`}>
                                                                <FaCheckCircle style={{ color: "#22c55e", fontSize: "1.15rem" }} />
                                                            </span>
                                                        ) : (
                                                            <span className="pmh-comp-badge missing" title={`${mp.name}: Yok`}>
                                                                <FaTimesCircle style={{ color: "#ef4444", fontSize: "1.15rem" }} />
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td style={{ textAlign: "center" }}>
                                                {missingCount > 0 ? (
                                                    <button
                                                        className="pmh-btn pmh-btn-primary"
                                                        style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}
                                                        onClick={() => handleDistributeSingle(product._id, missingMPs)}
                                                        disabled={isDistributing}
                                                    >
                                                        {isDistributing ? <Spinner /> : <FaRocket />} {missingCount} eksik
                                                    </button>
                                                ) : (
                                                    <span className="pmh-stock-pill" style={{ "--stock-color": "#22c55e" }}>Tam ✓</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {compTotal > PAGE_SIZE && <div className="pmh-pagination"><button className="pmh-pg-btn" disabled={compPage === 0} onClick={() => setCompPage(p => p - 1)}>← Önceki</button><span className="pmh-pg-info">Sayfa {compPage + 1} / {Math.ceil(compTotal / PAGE_SIZE)}</span><button className="pmh-pg-btn" disabled={(compPage + 1) * PAGE_SIZE >= compTotal} onClick={() => setCompPage(p => p + 1)}>Sonraki →</button></div>}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Kategori Eşleştirme
       ══════════════════════════════════════════════════════════════════════════ */
    const renderCategories = () => (
        <div className="pmh-fade-in">
            <CategoryMappingPage />
        </div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Loglar & Excel
       ══════════════════════════════════════════════════════════════════════════ */
    const renderLogs = () => {
        const successLogs = logs.filter(l => l.status === "synced" || l.status === "success").length;
        const errorLogs = logs.filter(l => l.status === "error").length;

        const handlePreview = async () => { if (!excelFile) return; setExcelImporting(true); try { const res = await previewImport(excelFile); setExcelPreview(res); showToast(`${res.stats?.total || 0} satır okundu`, "success"); } catch { showToast("Önizleme hatası", "error"); } setExcelImporting(false); };
        const handleImport = async () => { if (!excelFile) return; setExcelImporting(true); try { const res = await executeImport(excelFile, { skipErrors: true, updateExisting: true }); setExcelResult(res); showToast("İçe aktarma tamamlandı", "success"); dashboardCacheRef.current = null; loadProducts(); loadDashboardCached(); } catch { showToast("İçe aktarma hatası", "error"); } setExcelImporting(false); };
        const handleExport = async () => { setExcelExporting(true); try { const res = await exportProducts({}); const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); window.URL.revokeObjectURL(url); showToast("Excel dışa aktarıldı", "success"); } catch { showToast("Dışa aktarma hatası", "error"); } setExcelExporting(false); };
        const handleDownloadTemplate = async () => { try { const res = await downloadTemplate(); const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "urun_yukleme_sablonu.xlsx"; a.click(); window.URL.revokeObjectURL(url); showToast("Şablon indirildi", "success"); } catch { showToast("Şablon indirilemedi", "error"); } };

        return (
            <div className="pmh-fade-in">
                {/* Alt Sekmeler */}
                <div className="pmh-sub-tabs">
                    <button className={`pmh-sub-tab ${logsSubTab === "logs" ? "active" : ""}`} onClick={() => setLogsSubTab("logs")}><FaClipboardList /> İşlem Geçmişi</button>
                    <button className={`pmh-sub-tab ${logsSubTab === "notifications" ? "active" : ""}`} onClick={() => setLogsSubTab("notifications")}><FaBell /> Bildirimler {unreadCount > 0 && <span className="pmh-tab-badge">{unreadCount}</span>}</button>
                    <button className={`pmh-sub-tab ${logsSubTab === "excel" ? "active" : ""}`} onClick={() => setLogsSubTab("excel")}><FaFileExcel /> Excel İçe/Dışa Aktar</button>
                </div>

                {logsSubTab === "logs" && (
                    <>
                        <div className="pmh-mini-kpi-row">
                            <div className="pmh-mini-kpi" style={{ "--kpi-color": "#14b8a6" }}><span className="pmh-mini-kpi-icon">📋</span><span className="pmh-mini-kpi-val">{logs.length}</span><span className="pmh-mini-kpi-label">Toplam</span></div>
                            <div className="pmh-mini-kpi" style={{ "--kpi-color": "#22c55e" }}><span className="pmh-mini-kpi-icon">✅</span><span className="pmh-mini-kpi-val">{successLogs}</span><span className="pmh-mini-kpi-label">Başarılı</span></div>
                            <div className="pmh-mini-kpi" style={{ "--kpi-color": "#ef4444" }}><span className="pmh-mini-kpi-icon">❌</span><span className="pmh-mini-kpi-val">{errorLogs}</span><span className="pmh-mini-kpi-label">Hatalı</span></div>
                            <div className="pmh-mini-kpi" style={{ "--kpi-color": "#8b5cf6" }}><span className="pmh-mini-kpi-icon">🔔</span><span className="pmh-mini-kpi-val">{unreadCount}</span><span className="pmh-mini-kpi-label">Okunmamış</span></div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "1rem", fontWeight: 700 }}><FaClipboardList style={{ marginRight: "0.5rem", color: "#4ecdc4" }} />İşlem Geçmişi</h3>
                            <button className="pmh-btn pmh-btn-outline" onClick={loadLogs}><FaSync /> Yenile</button>
                        </div>

                        {logs.length === 0 ? (
                            <div className="pmh-empty"><FaClipboardList style={{ fontSize: "2.5rem" }} /><p>Henüz log yok</p></div>
                        ) : (
                            <div className="pmh-table-wrap">
                                <table className="pmh-table">
                                    <thead><tr><th>Tarih</th><th>İşlem</th><th>Ürün</th><th>Pazaryeri</th><th>Durum</th></tr></thead>
                                    <tbody>
                                        {logs.map((log, i) => {
                                            const isOk = log.status === "synced" || log.status === "success";
                                            const isErr = log.status === "error";
                                            const statusColor = isOk ? "#22c55e" : isErr ? "#ef4444" : "#f59e0b";
                                            return (
                                                <tr key={i} className="pmh-tr">
                                                    <td className="pmh-cell-sub">{log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR") : "—"}</td>
                                                    <td><span className="pmh-action-badge">{log.actionType || "—"}</span></td>
                                                    <td className="pmh-cell-title" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.product?.name || log.product?.barcode || "—"}</td>
                                                    <td>{log.marketplace?.name ? <span className="pmh-mp-tag" style={{ "--mp-color": mpColor(log.marketplace.name) }}><span className="pmh-mp-chip-dot" />{log.marketplace.name}</span> : "—"}</td>
                                                    <td><span className="pmh-status-pill" style={{ "--status-color": statusColor }}>{isOk ? "✅ Başarılı" : isErr ? "❌ Hata" : "⏳ " + (log.status || "—")}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {logsTotal > 50 && (
                            <div className="pmh-pagination">
                                <button className="pmh-pg-btn" disabled={logsPage === 0} onClick={() => setLogsPage(p => p - 1)}>← Önceki</button>
                                <span className="pmh-pg-info">Sayfa {logsPage + 1} / {Math.ceil(logsTotal / 50)}</span>
                                <button className="pmh-pg-btn" disabled={(logsPage + 1) * 50 >= logsTotal} onClick={() => setLogsPage(p => p + 1)}>Sonraki →</button>
                            </div>
                        )}
                    </>
                )}

                {logsSubTab === "notifications" && (
                    <>
                        {notifications.length > 0 && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                                <button className="pmh-btn pmh-btn-outline" onClick={handleMarkAllRead}><FaCheck /> Tümünü Okundu İşaretle</button>
                            </div>
                        )}
                        {notifications.length === 0 ? (
                            <div className="pmh-empty"><FaBell style={{ fontSize: "2.5rem" }} /><p>Okunmamış bildirim yok</p></div>
                        ) : (
                            <div className="pmh-card">
                                <div className="pmh-card-body">
                                    {notifications.slice(0, 20).map((n, i) => (
                                        <div key={i} className="pmh-log-mini">
                                            <FaBell style={{ color: "#8b5cf6", flexShrink: 0 }} />
                                            <span className="pmh-log-action">{n.actionType || "Bildirim"}</span>
                                            <span className="pmh-log-product">{n.product?.name || "—"}</span>
                                            <span className="pmh-log-time">{n.timestamp ? new Date(n.timestamp).toLocaleString("tr-TR") : ""}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {logsSubTab === "excel" && (
                    <div className="pmh-pull-push-grid">
                        <div className="pmh-card highlight-accent">
                            <div className="pmh-card-head"><h3><FaFileImport style={{ color: "#10b981" }} /> Excel İçe Aktar</h3></div>
                            <div className="pmh-card-body">
                                <button className="pmh-btn pmh-btn-outline pmh-btn-full" onClick={handleDownloadTemplate}><FaDownload /> Şablon İndir (.xlsx)</button>
                                <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const file = e.target.files?.[0]; if (file) { setExcelFile(file); setExcelPreview(null); setExcelResult(null); } }} style={{ display: "none" }} />
                                <div className="pmh-upload-zone" onClick={() => excelInputRef.current?.click()}>
                                    <FaUpload />
                                    <span>{excelFile ? excelFile.name : "Dosya seçmek için tıklayın"}</span>
                                    <small>.xlsx, .xls veya .csv</small>
                                </div>
                                {excelFile && (
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button className="pmh-btn pmh-btn-outline" onClick={handlePreview} disabled={excelImporting} style={{ flex: 1 }}>{excelImporting ? <Spinner /> : <FaEye />} Önizle</button>
                                        <button className="pmh-btn pmh-btn-primary" onClick={handleImport} disabled={excelImporting} style={{ flex: 1 }}>{excelImporting ? <Spinner /> : <FaRocket />} İçe Aktar</button>
                                    </div>
                                )}
                                {excelPreview && (<div className="pmh-result-box success">Toplam: {excelPreview.stats?.total || 0} | Yeni: {excelPreview.stats?.new || 0} | Güncelleme: {excelPreview.stats?.update || 0} | Hatalı: {excelPreview.stats?.invalid || 0}</div>)}
                                {excelResult && (<div className="pmh-result-box success"><FaCheckCircle /> Oluşturulan: {excelResult.results?.created || 0} | Güncellenen: {excelResult.results?.updated || 0}</div>)}
                            </div>
                        </div>
                        <div className="pmh-card">
                            <div className="pmh-card-head"><h3><FaDownload style={{ color: "#3b82f6" }} /> Excel Dışa Aktar</h3></div>
                            <div className="pmh-card-body">
                                <div className="pmh-info-banner"><FaInfoCircle /> <span>Tüm ürünlerinizi Excel formatında indirin.</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div><strong>{totalProducts}</strong> ürün dışa aktarılacak</div>
                                    <button className="pmh-btn pmh-btn-primary" onClick={handleExport} disabled={excelExporting}>{excelExporting ? <Spinner /> : <FaFileExcel />} İndir</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       ANA RENDER
       ══════════════════════════════════════════════════════════════════════════ */
    return (
        <div className="pmh-root">
            {/* Header */}
            <div className="pmh-header">
                <div className="pmh-header-left">
                    <div className="pmh-header-icon"><FaLayerGroup /></div>
                    <div>
                        <h1 className="pmh-title">Ürün Yönetimi</h1>
                        <p className="pmh-subtitle">Stok · Dağıtım · Fiyat · Senkronizasyon</p>
                    </div>
                </div>
                <div className="pmh-header-right">
                    {autoSyncRunning && <span className="pmh-sync-indicator"><Spinner /> Senkronize ediliyor...</span>}
                    <button className="pmh-btn pmh-btn-outline" onClick={() => { setActiveTab("logs"); setLogsSubTab("notifications"); }} title="Bildirimler">
                        <FaBell />{unreadCount > 0 && <span className="pmh-notif-badge">{unreadCount}</span>}
                    </button>
                    <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>
                        {autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et
                    </button>
                </div>
            </div>

            {/* Sekmeler */}
            <div className="pmh-tabs">
                {TABS.map(tab => (
                    <button key={tab.key} className={`pmh-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>
                        <span className="pmh-tab-icon">{tab.icon}</span>
                        <span className="pmh-tab-label">{tab.label}</span>
                        {tab.key === "logs" && unreadCount > 0 && <span className="pmh-tab-badge">{unreadCount}</span>}
                        {tab.key === "comparison" && (compSummary?.partiallyMissing || 0) + (compSummary?.notDistributed || 0) > 0 && (
                            <span className="pmh-tab-badge pmh-tab-badge-warn">{(compSummary?.partiallyMissing || 0) + (compSummary?.notDistributed || 0)}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* İçerik */}
            <div className="pmh-content">
                {activeTab === "dashboard" && renderDashboard()}
                {activeTab === "products" && renderProducts()}
                {activeTab === "pull-push" && renderPullPush()}
                {activeTab === "pricing" && renderPricing()}
                {activeTab === "comparison" && renderComparison()}
                {activeTab === "categories" && renderCategories()}
                {activeTab === "logs" && renderLogs()}
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`pmh-toast ${toast.type}`} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
                        {toast.type === "success" && <FaCheckCircle />}
                        {toast.type === "error" && <FaTimesCircle />}
                        {toast.type === "warning" && <FaExclamationTriangle />}
                        {toast.type === "info" && <FaInfoCircle />}
                        <span>{toast.msg}</span>
                        <button onClick={() => setToast(null)}><FaTimes /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stok Modal */}
            <AnimatePresence>
                {stockModal && (
                    <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStockModal(null)}>
                        <motion.div className="pmh-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
                            <div className="pmh-modal-head"><h2><FaWarehouse /> Stok Güncelle</h2><button onClick={() => setStockModal(null)}><FaTimes /></button></div>
                            <div className="pmh-modal-body">
                                <p className="pmh-modal-product">{stockModal.product?.masterProduct?.name || stockModal.product?.name}</p>
                                <div className="pmh-info-banner"><FaInfoCircle /> <span>Stok güncellediğinizde tüm pazaryerleri otomatik güncellenir.</span></div>
                                <div className="pmh-form-field"><label>Yeni Stok Adedi</label><input type="number" value={stockValue} onChange={e => setStockValue(e.target.value)} min="0" /></div>
                                <div className="pmh-modal-actions">
                                    <button className="pmh-btn pmh-btn-outline" onClick={() => setStockModal(null)}>İptal</button>
                                    <button className="pmh-btn pmh-btn-primary" onClick={handleSyncStock} disabled={loading}>{loading ? <Spinner /> : <FaSave />} Güncelle</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fiyat Modal */}
            <AnimatePresence>
                {priceModal && (
                    <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPriceModal(null)}>
                        <motion.div className="pmh-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
                            <div className="pmh-modal-head"><h2><FaMoneyBillWave /> Fiyat Güncelle</h2><button onClick={() => setPriceModal(null)}><FaTimes /></button></div>
                            <div className="pmh-modal-body">
                                <p className="pmh-modal-product">{priceModal.product?.masterProduct?.name || priceModal.product?.name}</p>
                                <div className="pmh-info-banner"><FaInfoCircle /> <span>Fiyat güncellediğinizde tüm pazaryerleri otomatik güncellenir.</span></div>
                                <div className="pmh-form-grid">
                                    <div className="pmh-form-field"><label>Satış Fiyatı (₺)</label><input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} min="0" step="0.01" /></div>
                                    <div className="pmh-form-field"><label>Liste Fiyatı (₺)</label><input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} min="0" step="0.01" /></div>
                                </div>
                                <div className="pmh-modal-actions">
                                    <button className="pmh-btn pmh-btn-outline" onClick={() => setPriceModal(null)}>İptal</button>
                                    <button className="pmh-btn pmh-btn-primary" onClick={handleSyncPrice} disabled={loading}>{loading ? <Spinner /> : <FaSave />} Güncelle</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Silme Modal */}
            <AnimatePresence>
                {deleteModal && (
                    <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal(null)}>
                        <motion.div className="pmh-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
                            <div className="pmh-modal-head"><h2><FaTrash /> Ürünü Sil</h2><button onClick={() => setDeleteModal(null)}><FaTimes /></button></div>
                            <div className="pmh-modal-body">
                                <p>Bu ürünü silmek istediğinizden emin misiniz?</p>
                                <p className="pmh-modal-product">{deleteModal.masterProduct?.name || deleteModal.name}</p>
                                <div className="pmh-danger-banner"><FaExclamationTriangle /> Bu işlem geri alınamaz.</div>
                                <div className="pmh-modal-actions">
                                    <button className="pmh-btn pmh-btn-outline" onClick={() => setDeleteModal(null)}>İptal</button>
                                    <button className="pmh-btn pmh-btn-danger" onClick={handleDelete} disabled={loading}>{loading ? <Spinner /> : <FaTrash />} Sil</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductManagementHub;
