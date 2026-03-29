/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 ÜRÜN YÖNETİM MERKEZİ — ProductManagementHub.js (v6 — Gelişmiş & Kapsamlı)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 8 Ana Sekme: Dashboard, Ürünlerim, Çek & Yükle, Fiyatlandırma, Karşılaştırma,
 *              Kategori Mapping, Excel İçe/Dışa Aktar, Loglar
 *
 * YENİ ÖZELLİKLER:
 * - Otomatik senkronizasyon (kullanıcı login olunca)
 * - Platform bazlı fiyatlandırma (1 ürün → farklı platformlarda farklı fiyat)
 * - Baz platform seçimi (1 platformdan fiyat al, diğerlerine dağıt)
 * - Kategori mapping entegrasyonu
 * - Excel import/export
 * - Gelişmiş dashboard (gerçek API verileri)
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
    FaClipboardList, FaBox, FaBell, FaBarcode, FaTable,
    FaRocket, FaTags, FaPlus, FaCheck, FaCheckSquare, FaSquare,
    FaChevronRight, FaChevronDown, FaArrowLeft, FaArrowRight, FaTrash, FaTag, FaEye,
    FaUpload, FaDownload, FaCloudDownloadAlt, FaCloudUploadAlt, FaImage, FaFileImport,
    FaFileExcel, FaMapMarkedAlt, FaDollarSign, FaPercentage, FaCog
} from "react-icons/fa";
import {
    getProducts, syncAllMarketplaces, syncStock, syncPrice,
    getProductManagementDashboard, getSyncLogs, createProduct,
    deleteProduct, getComparisonMatrix, bulkDistributeSelected,
    getUnreadNotifications, markNotificationRead,
    syncFromMarketplace, bulkDistribute, updateProduct,
    downloadTemplate, previewImport, executeImport, exportProducts
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementHub.css";

/* ─── Sabitler ─────────────────────────────────────────────────────────────── */
const TABS = [
    { key: "dashboard",    icon: <FaChartBar />,         label: "Dashboard" },
    { key: "products",     icon: <FaBoxOpen />,          label: "Ürünlerim" },
    { key: "pull-push",    icon: <FaCloudDownloadAlt />, label: "Çek & Yükle" },
    { key: "pricing",      icon: <FaDollarSign />,       label: "Fiyatlandırma" },
    { key: "comparison",   icon: <FaTable />,            label: "Karşılaştırma" },
    { key: "categories",   icon: <FaMapMarkedAlt />,     label: "Kategori Mapping" },
    { key: "excel",        icon: <FaFileExcel />,        label: "Excel İçe/Dışa Aktar" },
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
const ProductManagementHub = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || "dashboard");

    useEffect(() => {
        if (initialTab && TABS.some(t => t.key === initialTab)) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

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
    const [discountRate, setDiscountRate] = useState("");
    const [deleteModal, setDeleteModal] = useState(null);

    /* ── Dağıtım State ── */
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkTargets, setBulkTargets] = useState([]);
    const [distResult, setDistResult] = useState(null);

    /* ── Yeni Ürün State ── */
    const [showNewProductForm, setShowNewProductForm] = useState(false);
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

    /* ── Karşılaştırma State ── */
    const [compMatrix, setCompMatrix] = useState([]);
    const [compTotal, setCompTotal] = useState(0);
    const [compPage, setCompPage] = useState(0);
    const [compSearch, setCompSearch] = useState("");
    const [missingOnly, setMissingOnly] = useState(false);
    const [compSummary, setCompSummary] = useState(null);

    /* ── Log & Bildirim State ── */
    const [logs, setLogs] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    /* ── Toplu Fiyat State ── */
    const [bulkPriceMode, setBulkPriceMode] = useState("fixed");
    const [bulkPriceValue, setBulkPriceValue] = useState("");

    /* ── Ürünlerim alt-sekme ── */
    const [productsSubTab, setProductsSubTab] = useState("list"); // list | upload

    /* ── Fiyatlandırma State ── */
    const [pricingMode, setPricingMode] = useState("per-product"); // per-product | bulk | base-sync
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

    /* ── Toast ── */
    const showToast = useCallback((msg, type = "info") => {
        setToast({ msg, type });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4500);
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
            setMarketplaces(list.map(m => ({ ...m, name: m.marketplaceName || m.name || "" })));
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
        try { const res = await getSyncLogs({ limit: 50 }); setLogs(res.logs || []); } catch { }
    }, []);

    const loadNotifications = useCallback(async () => {
        try { const res = await getUnreadNotifications(); setNotifications(res.notifications || []); setUnreadCount(res.counts?.total || 0); } catch { }
    }, []);

    const loadDashboard = useCallback(async () => {
        setDashboardLoading(true);
        try {
            const res = await getProductManagementDashboard();
            setDashboardData(res.dashboard || null);
        } catch { }
        setDashboardLoading(false);
    }, []);

    const runAutoSync = useCallback(async () => {
        if (autoSyncRunning) return;
        setAutoSyncRunning(true);
        setAutoSyncStatus("Tüm pazaryerlerinden ürünler çekiliyor...");
        try {
            const res = await syncAllMarketplaces();
            const { totalNew = 0, totalUpdated = 0, totalErrors = 0 } = res.summary || {};
            const results = res.results || [];

            // Her pazaryerinin sonucunu detaylı göster
            const successMPs = results.filter(r => r.success).map(r => `${r.marketplace}: +${r.stats?.new || 0} yeni, ${r.stats?.updated || 0} güncellenen`);
            const failedMPs = results.filter(r => !r.success).map(r => `${r.marketplace}: ${r.error || "Hata"}`);

            if (failedMPs.length > 0 && successMPs.length > 0) {
                // Kısmi başarı
                setAutoSyncStatus(`Kısmi başarı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated} | ${failedMPs.length} platform hatalı`);
                showToast(`Senkronizasyon kısmen tamamlandı — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}. Hatalı: ${failedMPs.join("; ")}`, "warning");
            } else if (failedMPs.length > 0 && successMPs.length === 0) {
                // Tümü başarısız
                setAutoSyncStatus(`Senkronizasyon başarısız — ${failedMPs.join(", ")}`);
                showToast(`Senkronizasyon başarısız: ${failedMPs.join("; ")}`, "error");
            } else {
                // Tümü başarılı
                setAutoSyncStatus(`Tamamlandı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated}`);
                showToast(`Senkronizasyon tamamlandı — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`, "success");
            }

            // Hatalı platformları konsola logla (debug için)
            if (failedMPs.length > 0) {
                console.warn("[SYNC] Hatalı platformlar:", failedMPs);
                console.warn("[SYNC] Detaylı sonuçlar:", results);
            }

            loadProducts(); loadComparison(); loadDashboard();
        } catch (e) {
            setAutoSyncStatus("Senkronizasyon başarısız");
            showToast("Senkronizasyon başarısız: " + (e?.response?.data?.error || e.message || "Bilinmeyen hata"), "error");
            console.error("[SYNC] Genel hata:", e);
        } finally { setAutoSyncRunning(false); setTimeout(() => setAutoSyncStatus(""), 12000); }
    }, [autoSyncRunning, showToast, loadProducts, loadComparison, loadDashboard]);

    /* ── İlk Yükleme & Otomatik Senkronizasyon ── */
    useEffect(() => {
        loadMarketplaces(); loadNotifications(); loadProducts(); loadDashboard();
        // Otomatik senkronizasyon — kullanıcı login olunca 1 kez çalışır
        if (!autoSyncDone.current) {
            autoSyncDone.current = true;
            const timer = setTimeout(() => { runAutoSync(); }, 2000);
            return () => clearTimeout(timer);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadProducts(); }, [page, search, filterMP, filterStock]);
    useEffect(() => {
        if (activeTab === "logs") { loadLogs(); loadNotifications(); }
        if (activeTab === "comparison") loadComparison();
        if (activeTab === "products" || activeTab === "pricing") loadProducts();
        if (activeTab === "dashboard") loadDashboard();
    }, [activeTab]);
    useEffect(() => { loadComparison(); }, [compPage, compSearch, missingOnly]);

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
            setPriceModal(null); setSalePrice(""); setListPrice(""); setDiscountRate(""); loadProducts();
        } catch { showToast("Fiyat güncellenemedi", "error"); }
        finally { setLoading(false); }
    };

    const handleBulkPriceUpdate = async () => {
        if (selectedProducts.length === 0) { showToast("Ürün seçin", "warning"); return; }
        if (!bulkPriceValue) { showToast("Değer girin", "warning"); return; }
        setLoading(true);
        let ok = 0, err = 0;
        for (const pid of selectedProducts) {
            const p = products.find(x => x._id === pid);
            if (!p) continue;
            const mp = p.masterProduct || p;
            let newPrice = bulkPriceMode === "fixed" ? parseFloat(bulkPriceValue)
                : bulkPriceMode === "percent" ? mp.price * (1 - parseFloat(bulkPriceValue) / 100)
                : mp.price * (1 + parseFloat(bulkPriceValue) / 100);
            if (newPrice > 0) { try { await syncPrice(pid, newPrice); ok++; } catch { err++; } }
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
        setLoading(true);
        try {
            const res = await bulkDistributeSelected(selectedProducts, bulkTargets);
            setDistResult(res.results || {});
            showToast("Dağıtım tamamlandı", "success");
            setSelectedProducts([]); setBulkTargets([]); loadProducts();
        } catch { showToast("Dağıtım başarısız", "error"); }
        finally { setLoading(false); }
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
            setShowNewProductForm(false);
            setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] });
            setNewProductTargets([]);
            loadProducts();
        } catch (e) { showToast("Oluşturulamadı: " + (e?.response?.data?.error || e.message || ""), "error"); }
        finally { setLoading(false); }
    };

    const handleMarkAllRead = async () => { try { await markNotificationRead("all"); loadNotifications(); showToast("Okundu", "success"); } catch { } };

    const toggleProduct = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleAllProducts = () => setSelectedProducts(selectedProducts.length === products.length ? [] : products.map(p => p._id));
    const toggleTarget = (name) => setBulkTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
    const toggleNewProductTarget = (name) => setNewProductTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    const getProductMPs = (p) => (p.marketplaceMappings || []).map(m => m.marketplaceName).filter(Boolean);
    const getMissingMPs = (p) => marketplaces.map(m => m.name).filter(n => !getProductMPs(p).includes(n));
    const getProductSyncStatus = (p, mpName) => { const m = (p.marketplaceMappings || []).find(x => (x.marketplaceName || "").toLowerCase() === (mpName || "").toLowerCase()); return m?.syncStatus || null; };

    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Dashboard (v7 — Profesyonel & Kullanışlı)
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
        const totalCategories = db?.totalCategories || 0;

        // Senkron/hata istatistiklerini backend mpStats'tan hesapla (tüm ürünler)
        // products sadece mevcut sayfadaki 20 ürünü içerir — dashboard için yetersiz
        const totalSyncedFromMP = mpStats.reduce((s, mp) => s + (mp.syncedProducts || 0), 0);
        const totalUnsyncedFromMP = mpStats.reduce((s, mp) => s + (mp.unsyncedProducts || 0), 0);
        const totalErrorsFromMP = mpStats.reduce((s, mp) => s + (mp.errorProducts || 0), 0);
        // Eğer backend'den veri geldiyse onu kullan, yoksa mevcut sayfadan hesapla (fallback)
        const synced = mpStats.length > 0 ? totalSyncedFromMP : products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "synced")).length;
        const errors = mpStats.length > 0 ? totalErrorsFromMP : products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "error")).length;
        const undist = mpStats.length > 0 ? Math.max(0, total - totalSyncedFromMP - totalUnsyncedFromMP - totalErrorsFromMP) : products.filter(p => (p.marketplaceMappings || []).length === 0).length;
        const syncRate = total > 0 ? Math.round((synced / total) * 100) : 0;
        const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0;

        /* ── SVG Donut Chart Helper ── */
        const DonutChart = ({ data, size = 130, strokeWidth = 16 }) => {
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;
            const totalVal = data.reduce((s, d) => s + d.value, 0) || 1;
            let accumulated = 0;
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
                    {data.filter(d => d.value > 0).map((d, i) => {
                        const pct = d.value / totalVal;
                        const dashLen = circumference * pct;
                        const dashOff = circumference * accumulated;
                        accumulated += pct;
                        return <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={d.color} strokeWidth={strokeWidth} strokeDasharray={`${dashLen} ${circumference - dashLen}`} strokeDashoffset={-dashOff} strokeLinecap="round" style={{ transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)" }} />;
                    })}
                </svg>
            );
        };

        /* ── Stok dağılım verileri ── */
        const stockDonutData = [
            { label: "Sağlıklı", value: healthy, color: "#22c55e" },
            { label: "Düşük Stok", value: lowStock, color: "#f59e0b" },
            { label: "Stok Yok", value: outOfStock, color: "#ef4444" },
        ];

        /* ── Senkron dağılım verileri ── */
        const syncDonutData = [
            { label: "Senkron", value: synced, color: "#4ecdc4" },
            { label: "Hatalı", value: errors, color: "#ef4444" },
            { label: "Dağıtılmamış", value: undist, color: "#8b5cf6" },
            { label: "Diğer", value: Math.max(0, total - synced - errors - undist), color: "#334155" },
        ];

        /* ── Pazaryeri bar chart verileri ── */
        const mpBarData = (mpStats.length > 0 ? mpStats : marketplaces.map(m => ({ name: m.name }))).map(mp => {
            const mpProds = mp.totalProducts || products.filter(p => (p.marketplaceMappings || []).some(m2 => m2.marketplaceName === mp.name)).length;
            return { name: mp.name, value: mpProds, color: mpColor(mp.name), synced: mp.syncedProducts || 0, unsynced: mp.unsyncedProducts || (mpProds - (mp.syncedProducts || 0)) };
        });
        const maxBarVal = Math.max(...mpBarData.map(d => d.value), 1);

        return (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ paddingTop: "8px" }}>
                {/* ── Sync Status Banner ── */}
                {autoSyncStatus && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: autoSyncRunning ? "linear-gradient(135deg, rgba(78,205,196,0.08), rgba(78,205,196,0.03))" : autoSyncStatus.includes("başarısız") ? "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))" : "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))", border: `1px solid ${autoSyncRunning ? "rgba(78,205,196,0.2)" : autoSyncStatus.includes("başarısız") ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`, borderRadius: "12px", padding: "12px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", color: autoSyncRunning ? "#4ecdc4" : autoSyncStatus.includes("başarısız") ? "#ef4444" : "#22c55e", fontSize: "13px", fontWeight: 600 }}>
                        {autoSyncRunning && <Spinner />}
                        {!autoSyncRunning && !autoSyncStatus.includes("başarısız") && <FaCheckCircle />}
                        {!autoSyncRunning && autoSyncStatus.includes("başarısız") && <FaTimesCircle />}
                        <span>{autoSyncStatus}</span>
                    </motion.div>
                )}

                {dashboardLoading && !db && (
                    <div className="pmh-center-msg"><Spinner /> <span style={{ color: "#94a3b8" }}>Dashboard yükleniyor...</span></div>
                )}

                {/* ═══ BÖLÜM 1: Ana KPI Kartları — 4 Adet ═══ */}
                <div className="pmh-dash-kpi-grid">
                    {[
                        { icon: <FaBoxOpen />, label: "Toplam Ürün", value: fmtNum(total), sub: `${marketplaces.length} pazaryeri bağlı`, color: "#4ecdc4", gradient: "linear-gradient(135deg, #4ecdc4, #44a08d)", action: () => setActiveTab("products") },
                        { icon: <FaCheckCircle />, label: "Senkron Oranı", value: `%${syncRate}`, sub: `${fmtNum(synced)} / ${fmtNum(total)} ürün`, color: "#22c55e", gradient: "linear-gradient(135deg, #22c55e, #16a34a)" },
                        { icon: <FaExclamationTriangle />, label: "Dikkat Gerektiren", value: fmtNum(errors + outOfStock + lowStock), sub: errors > 0 ? `${errors} hata, ${outOfStock} stoksuz` : outOfStock > 0 ? `${outOfStock} stoksuz, ${lowStock} düşük` : "Sorun yok ✓", color: (errors + outOfStock) > 0 ? "#ef4444" : "#22c55e", gradient: (errors + outOfStock) > 0 ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #22c55e, #16a34a)" },
                        { icon: <FaRocket />, label: "Dağıtım Durumu", value: undist > 0 ? fmtNum(undist) + " bekliyor" : "Tam ✓", sub: undist > 0 ? "Dağıtılmamış ürün var" : "Tüm ürünler dağıtıldı", color: undist > 0 ? "#8b5cf6" : "#22c55e", gradient: undist > 0 ? "linear-gradient(135deg, #8b5cf6, #7c3aed)" : "linear-gradient(135deg, #22c55e, #16a34a)" },
                    ].map((k, i) => (
                        <motion.div key={i} className="pmh-dash-kpi-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 20 }} whileHover={{ y: -6, boxShadow: `0 12px 32px ${k.color}20` }} onClick={k.action || undefined} style={{ cursor: k.action ? "pointer" : "default" }}>
                            <div className="pmh-dash-kpi-icon-wrap" style={{ background: k.gradient }}>
                                {k.icon}
                            </div>
                            <div className="pmh-dash-kpi-content">
                                <span className="pmh-dash-kpi-label">{k.label}</span>
                                <span className="pmh-dash-kpi-value">{k.value}</span>
                                <span className="pmh-dash-kpi-sub">{k.sub}</span>
                            </div>
                            <div className="pmh-dash-kpi-glow" style={{ background: `radial-gradient(circle at top right, ${k.color}12, transparent 70%)` }} />
                        </motion.div>
                    ))}
                </div>

                {/* ═══ BÖLÜM 2: Grafikler — 2 Sütun ═══ */}
                <div className="pmh-dash-charts-row">
                    {/* Sol: Stok Durumu Donut */}
                    <motion.div className="pmh-dash-chart-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                        <div className="pmh-dash-chart-header">
                            <div>
                                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FaWarehouse style={{ color: "#f59e0b" }} /> Stok Durumu
                                </h3>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>Ürün stok dağılımı</p>
                            </div>
                        </div>
                        <div className="pmh-dash-donut-area">
                            <div style={{ position: "relative", width: 130, height: 130 }}>
                                <DonutChart data={stockDonutData} size={130} strokeWidth={18} />
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(0deg)", textAlign: "center" }}>
                                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#e2e8f0", lineHeight: 1 }}>{fmtNum(total)}</div>
                                    <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, marginTop: "2px" }}>TOPLAM</div>
                                </div>
                            </div>
                            <div className="pmh-dash-donut-legend">
                                {stockDonutData.map((d, i) => (
                                    <div key={i} className="pmh-dash-legend-item">
                                        <span className="pmh-dash-legend-dot" style={{ background: d.color }} />
                                        <span className="pmh-dash-legend-label">{d.label}</span>
                                        <span className="pmh-dash-legend-val" style={{ color: d.color }}>{fmtNum(d.value)}</span>
                                        <span className="pmh-dash-legend-pct">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Sağ: Senkronizasyon Durumu Donut */}
                    <motion.div className="pmh-dash-chart-card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                        <div className="pmh-dash-chart-header">
                            <div>
                                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FaSync style={{ color: "#4ecdc4" }} /> Senkronizasyon
                                </h3>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>Platform eşleşme durumu</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: syncRate >= 80 ? "#22c55e" : syncRate >= 50 ? "#f59e0b" : "#ef4444", boxShadow: `0 0 8px ${syncRate >= 80 ? "#22c55e" : syncRate >= 50 ? "#f59e0b" : "#ef4444"}60` }} />
                                <span style={{ fontSize: "12px", fontWeight: 700, color: syncRate >= 80 ? "#22c55e" : syncRate >= 50 ? "#f59e0b" : "#ef4444" }}>{syncRate >= 80 ? "İyi" : syncRate >= 50 ? "Orta" : "Düşük"}</span>
                            </div>
                        </div>
                        <div className="pmh-dash-donut-area">
                            <div style={{ position: "relative", width: 130, height: 130 }}>
                                <DonutChart data={syncDonutData} size={130} strokeWidth={18} />
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(0deg)", textAlign: "center" }}>
                                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#4ecdc4", lineHeight: 1 }}>%{syncRate}</div>
                                    <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, marginTop: "2px" }}>SENKRON</div>
                                </div>
                            </div>
                            <div className="pmh-dash-donut-legend">
                                {syncDonutData.filter(d => d.value > 0).map((d, i) => (
                                    <div key={i} className="pmh-dash-legend-item">
                                        <span className="pmh-dash-legend-dot" style={{ background: d.color }} />
                                        <span className="pmh-dash-legend-label">{d.label}</span>
                                        <span className="pmh-dash-legend-val" style={{ color: d.color }}>{fmtNum(d.value)}</span>
                                        <span className="pmh-dash-legend-pct">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ═══ BÖLÜM 3: Pazaryeri Performansı — Bar Chart + Detay Kartları ═══ */}
                {(marketplaces.length > 0 || mpStats.length > 0) && (
                    <motion.div className="pmh-dash-section-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                        <div className="pmh-dash-chart-header">
                            <div>
                                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FaStore style={{ color: "#8b5cf6" }} /> Pazaryeri Performansı
                                </h3>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>Platform bazlı ürün dağılımı ve senkronizasyon</p>
                            </div>
                        </div>

                        {/* Bar Chart */}
                        <div className="pmh-dash-bar-chart">
                            {mpBarData.map((mp, idx) => {
                                const pct = maxBarVal > 0 ? (mp.value / maxBarVal) * 100 : 0;
                                const syncedPct = mp.value > 0 ? Math.round((mp.synced / mp.value) * 100) : 0;
                                return (
                                    <motion.div key={idx} className="pmh-dash-bar-row" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + idx * 0.06 }}>
                                        <div className="pmh-dash-bar-label">
                                            <span className="pmh-dash-bar-dot" style={{ background: mp.color, boxShadow: `0 0 8px ${mp.color}50` }} />
                                            <span className="pmh-dash-bar-name">{mp.name}</span>
                                        </div>
                                        <div className="pmh-dash-bar-track">
                                            <motion.div className="pmh-dash-bar-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.5 + idx * 0.08, duration: 0.6, ease: "easeOut" }} style={{ background: `linear-gradient(90deg, ${mp.color}, ${mp.color}88)` }}>
                                                {/* Senkron kısmı overlay */}
                                                {mp.synced > 0 && mp.value > 0 && (
                                                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${syncedPct}%`, background: `${mp.color}`, borderRadius: "6px", opacity: 0.6 }} />
                                                )}
                                            </motion.div>
                                        </div>
                                        <div className="pmh-dash-bar-stats">
                                            <span className="pmh-dash-bar-val" style={{ color: mp.color }}>{fmtNum(mp.value)}</span>
                                            <span className="pmh-dash-bar-sync-badge" style={{ background: `${mp.color}15`, color: mp.color, border: `1px solid ${mp.color}30` }}>%{syncedPct}</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Platform Detay Mini Kartları */}
                        <div className="pmh-dash-mp-detail-grid">
                            {mpBarData.map((mp, idx) => {
                                const syncedPct = mp.value > 0 ? Math.round((mp.synced / mp.value) * 100) : 0;
                                return (
                                    <div key={idx} className="pmh-dash-mp-mini-card" style={{ borderColor: `${mp.color}30` }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: mp.color, boxShadow: `0 0 8px ${mp.color}60`, flexShrink: 0 }} />
                                            <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "13px", flex: 1 }}>{mp.name}</span>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                                            <div className="pmh-dash-mp-metric">
                                                <span className="pmh-dash-mp-metric-val" style={{ color: "#e2e8f0" }}>{fmtNum(mp.value)}</span>
                                                <span className="pmh-dash-mp-metric-label">Ürün</span>
                                            </div>
                                            <div className="pmh-dash-mp-metric">
                                                <span className="pmh-dash-mp-metric-val" style={{ color: "#22c55e" }}>{fmtNum(mp.synced)}</span>
                                                <span className="pmh-dash-mp-metric-label">Senkron</span>
                                            </div>
                                            <div className="pmh-dash-mp-metric">
                                                <span className="pmh-dash-mp-metric-val" style={{ color: mp.unsynced > 0 ? "#f59e0b" : "#22c55e" }}>{fmtNum(mp.unsynced)}</span>
                                                <span className="pmh-dash-mp-metric-label">Bekleyen</span>
                                            </div>
                                        </div>
                                        {/* Mini progress */}
                                        <div style={{ marginTop: "8px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${syncedPct}%` }} transition={{ delay: 0.6 + idx * 0.1, duration: 0.5 }} style={{ height: "100%", background: mp.color, borderRadius: "2px" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* ═══ BÖLÜM 4: Alt Kısım — Hızlı Aksiyonlar + Son İşlemler yan yana ═══ */}
                <div className="pmh-dash-bottom-row">
                    {/* Sol: Hızlı Aksiyonlar (Dashboard butonu YOK) */}
                    <motion.div className="pmh-dash-section-card pmh-dash-bottom-left" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                        <div className="pmh-dash-chart-header">
                            <div>
                                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FaRocket style={{ color: "#f59e0b" }} /> Hızlı Aksiyonlar
                                </h3>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>Sık kullanılan işlemler</p>
                            </div>
                        </div>
                        <div className="pmh-dash-quick-actions">
                            {[
                                { icon: <FaSync />, label: "Senkronize Et", desc: "Tüm platformları güncelle", color: "#4ecdc4", action: runAutoSync, disabled: autoSyncRunning },
                                { icon: <FaPlus />, label: "Yeni Ürün", desc: "Manuel ürün oluştur", color: "#22c55e", action: () => { setActiveTab("products"); setProductsSubTab("upload"); } },
                                { icon: <FaCloudDownloadAlt />, label: "Çek & Yükle", desc: "Pazaryerinden aktar", color: "#8b5cf6", action: () => setActiveTab("pull-push") },
                                { icon: <FaDollarSign />, label: "Fiyatlandırma", desc: "Platform bazlı fiyat", color: "#f59e0b", action: () => setActiveTab("pricing") },
                                { icon: <FaTable />, label: "Karşılaştırma", desc: "Ürün matrisi", color: "#3b82f6", action: () => setActiveTab("comparison") },
                                { icon: <FaFileExcel />, label: "Excel İşlemleri", desc: "Toplu içe/dışa aktar", color: "#10b981", action: () => setActiveTab("excel") },
                            ].map((a, i) => (
                                <motion.button key={i} className="pmh-dash-action-btn" onClick={a.action} disabled={a.disabled} whileHover={{ y: -3, boxShadow: `0 6px 20px ${a.color}18` }} whileTap={{ scale: 0.97 }}>
                                    <div className="pmh-dash-action-icon" style={{ background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}25` }}>
                                        {a.disabled ? <Spinner /> : a.icon}
                                    </div>
                                    <div className="pmh-dash-action-text">
                                        <span className="pmh-dash-action-label">{a.label}</span>
                                        <span className="pmh-dash-action-desc">{a.desc}</span>
                                    </div>
                                    <FaChevronRight style={{ color: "#334155", fontSize: "10px", flexShrink: 0 }} />
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Sağ: Son İşlemler */}
                    <motion.div className="pmh-dash-section-card pmh-dash-bottom-right" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                        <div className="pmh-dash-chart-header">
                            <div>
                                <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FaClipboardList style={{ color: "#06b6d4" }} /> Son İşlemler
                                </h3>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>
                                    {recentLogs.length > 0 ? `Son ${Math.min(recentLogs.length, 8)} işlem` : "Henüz işlem yok"}
                                    {unreadCount > 0 && <span style={{ marginLeft: "8px", background: "rgba(139,92,246,0.15)", color: "#8b5cf6", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>{unreadCount} okunmamış</span>}
                                </p>
                            </div>
                            <button className="pmh-btn pmh-btn-outline" onClick={() => setActiveTab("logs")} style={{ fontSize: "11px", padding: "5px 14px" }}>Tümü →</button>
                        </div>
                        {recentLogs.length > 0 ? (
                            <div className="pmh-dash-log-list">
                                {recentLogs.slice(0, 8).map((log, i) => {
                                    const isOk = log.status === "synced" || log.status === "success";
                                    const isErr = log.status === "error";
                                    const statusColor = isOk ? "#22c55e" : isErr ? "#ef4444" : "#f59e0b";
                                    const StatusIcon = isOk ? FaCheckCircle : isErr ? FaTimesCircle : FaExclamationTriangle;
                                    return (
                                        <motion.div key={i} className="pmh-dash-log-item" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.04 }}>
                                            <div className="pmh-dash-log-icon" style={{ color: statusColor, background: `${statusColor}12` }}>
                                                <StatusIcon />
                                            </div>
                                            <div className="pmh-dash-log-content">
                                                <span className="pmh-dash-log-action">{log.actionType || "İşlem"}</span>
                                                <span className="pmh-dash-log-product">{log.product?.name || log.product?.barcode || "—"}</span>
                                            </div>
                                            <span className="pmh-dash-log-time">
                                                {log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: "#475569", gap: "8px" }}>
                                <FaClipboardList style={{ fontSize: "28px", opacity: 0.4 }} />
                                <span style={{ fontSize: "13px" }}>Henüz işlem kaydı yok</span>
                                <span style={{ fontSize: "11px", color: "#334155" }}>Senkronizasyon yapıldığında burada görünecek</span>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* ═══ BÖLÜM 5: Özet Bilgi Şeridi ═══ */}
                <motion.div className="pmh-dash-summary-strip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                    {[
                        { icon: <FaBoxOpen />, label: "Ürün", value: fmtNum(total), color: "#4ecdc4" },
                        { icon: <FaStore />, label: "Platform", value: marketplaces.length, color: "#8b5cf6" },
                        { icon: <FaTags />, label: "Kategori", value: fmtNum(totalCategories), color: "#06b6d4" },
                        { icon: <FaCheckCircle />, label: "Senkron", value: `%${syncRate}`, color: "#22c55e" },
                        { icon: <FaExclamationTriangle />, label: "Hata", value: `%${errorRate}`, color: errors > 0 ? "#ef4444" : "#22c55e" },
                    ].map((item, i) => (
                        <div key={i} className="pmh-dash-summary-item">
                            <span style={{ color: item.color, fontSize: "13px", display: "flex" }}>{item.icon}</span>
                            <span className="pmh-dash-summary-label">{item.label}</span>
                            <span className="pmh-dash-summary-val" style={{ color: item.color }}>{item.value}</span>
                        </div>
                    ))}
                </motion.div>
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Ürünlerim (Birleşik: Liste + Yeni Ürün + Fiyat/Stok)
       ══════════════════════════════════════════════════════════════════════════ */
    const renderProducts = () => {
        const total = products.length;
        const outOfStock = products.filter(p => (p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0) === 0).length;
        const lowStock = products.filter(p => { const s = p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0; return s > 0 && s <= 10; }).length;

        const subTabs = [
            { key: "list", icon: <FaBoxOpen />, label: "Ürün Listesi" },
            { key: "upload", icon: <FaPlus />, label: "Yeni Ürün Ekle" },
        ];

        return (
            <motion.div key="products" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Alt Sekmeler */}
                <div style={{ display: "flex", gap: "6px", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
                    {subTabs.map(st => (
                        <button key={st.key} onClick={() => setProductsSubTab(st.key)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", border: `1px solid ${productsSubTab === st.key ? "rgba(78,205,196,0.4)" : "rgba(255,255,255,0.06)"}`, background: productsSubTab === st.key ? "rgba(78,205,196,0.1)" : "rgba(255,255,255,0.02)", color: productsSubTab === st.key ? "#4ecdc4" : "#94a3b8", fontSize: "13px", fontWeight: productsSubTab === st.key ? 700 : 500, cursor: "pointer", transition: "all 0.2s" }}>
                            {st.icon} {st.label}
                        </button>
                    ))}
                </div>

                {/* ─── ALT SEKME: Ürün Listesi ─── */}
                {productsSubTab === "list" && (
                    <>
                        {/* KPI */}
                        <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(4, 1fr)" }}>
                            {[
                                { icon: "📦", label: "Toplam", val: total, color: "#14b8a6", f: "" },
                                { icon: "✅", label: "Sağlıklı", val: total - outOfStock - lowStock, color: "#22c55e", f: "" },
                                { icon: "⚠️", label: "Düşük Stok", val: lowStock, color: "#f59e0b", f: "lowStock" },
                                { icon: "🚫", label: "Stok Yok", val: outOfStock, color: "#ef4444", f: "outOfStock" }
                            ].map((k, i) => (
                                <div key={i} className="pmh-stat-card pmh-stock-kpi" onClick={() => { setFilterStock(filterStock === k.f ? "" : k.f); setPage(0); }} style={{ cursor: "pointer", borderTop: `3px solid ${k.color}`, background: filterStock === k.f && k.f ? `${k.color}12` : undefined, position: "relative" }}>
                                    <div className="pmh-stat-icon" style={{ background: `${k.color}18`, color: k.color }}>{k.icon}</div>
                                    <div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: k.color }}>{k.val}</span><span className="pmh-stat-label">{k.label}</span></div>
                                    {filterStock === k.f && k.f && <span style={{ position: "absolute", top: 8, right: 10, fontSize: 9, color: "#fff", fontWeight: 700, background: k.color, borderRadius: 4, padding: "2px 8px" }}>FİLTRE</span>}
                                </div>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="pmh-toolbar" style={{ marginBottom: "16px" }}>
                            <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ürün adı, barkod veya SKU ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div>
                            <select value={filterStock} onChange={e => { setFilterStock(e.target.value); setPage(0); }} style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6" }}>
                                <option value="">Tüm Stok</option><option value="outOfStock">🚫 Stok Yok</option><option value="lowStock">⚠️ Düşük</option>
                            </select>
                            <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{totalProducts} ürün</span>
                            <button className="pmh-btn pmh-btn-outline" onClick={toggleAllProducts}>{selectedProducts.length === products.length && products.length > 0 ? <><FaTimesCircle /> Seçimi Kaldır</> : <><FaCheckSquare /> Tümünü Seç</>}</button>
                            <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>{autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et</button>
                        </div>

                        {/* Toplu Dağıtım Barı */}
                        {selectedProducts.length > 0 && (
                            <div style={{ background: "rgba(15,118,110,0.12)", border: "1.5px solid rgba(15,118,110,0.4)", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                <span style={{ color: "#4ecdc4", fontWeight: 700, fontSize: "14px" }}><FaCheckSquare style={{ marginRight: 6 }} />{selectedProducts.length} ürün seçildi</span>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: 1 }}>
                                    {marketplaces.map(mp => (
                                        <label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "6px", background: bulkTargets.includes(mp.name) ? `${mpColor(mp.name)}22` : "rgba(255,255,255,0.04)", border: `1px solid ${bulkTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", color: "#e2e8f0" }}>
                                            <input type="checkbox" style={{ display: "none" }} checked={bulkTargets.includes(mp.name)} onChange={() => toggleTarget(mp.name)} />
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(mp.name) }} />{mp.name}
                                            {bulkTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 10 }} />}
                                        </label>
                                    ))}
                                </div>
                                <button className="pmh-btn pmh-btn-primary" onClick={handleBulkDistribute} disabled={loading || bulkTargets.length === 0}>{loading ? <Spinner /> : <FaRocket />} Dağıt</button>
                                <button className="pmh-btn pmh-btn-outline" onClick={() => { setSelectedProducts([]); setBulkTargets([]); }}><FaTimes /></button>
                            </div>
                        )}

                        {distResult && (
                            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                                <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "8px 14px", color: "#22c55e", fontSize: "13px", fontWeight: 600 }}><FaCheckCircle /> {distResult.success || 0} Başarılı</div>
                                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "8px 14px", color: "#f59e0b", fontSize: "13px", fontWeight: 600 }}><FaExclamationTriangle /> {distResult.skipped || 0} Atlanan</div>
                                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "8px 14px", color: "#ef4444", fontSize: "13px", fontWeight: 600 }}><FaTimesCircle /> {distResult.error || 0} Hata</div>
                                <button onClick={() => setDistResult(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><FaTimes /></button>
                            </div>
                        )}

                        {/* Ürün Tablosu */}
                        {products.length === 0 ? (
                            <div className="pmh-center-msg">
                                <FaBox style={{ fontSize: "3rem", color: "#64748b" }} />
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
                                            const mappings = product.marketplaceMappings || [];
                                            const stockColor = stock === 0 ? "#ef4444" : stock <= 10 ? "#f59e0b" : "#22c55e";
                                            const sel = selectedProducts.includes(product._id);
                                            const missingMPs = getMissingMPs(product);

                                            return (
                                                <tr key={product._id} className="pmh-tr" style={{ background: sel ? "rgba(20,184,166,0.04)" : undefined }}>
                                                    <td><input type="checkbox" checked={sel} onChange={() => toggleProduct(product._id)} /></td>
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                                                    <td><span className="pmh-stock-pill" style={{ background: `${stockColor}15`, color: stockColor, border: `1px solid ${stockColor}30` }}>{stock === 0 ? "Yok" : stock <= 10 ? `${stock} ⚠️` : stock}</span></td>
                                                    <td>
                                                        <div className="pmh-platform-dots">
                                                            {mappings.length > 0 ? mappings.map((m, i) => (
                                                                <span key={i} className="pmh-platform-dot" style={{ background: mpColor(m.marketplaceName) }} title={`${m.marketplaceName} (${m.syncStatus || "?"})`}>{m.marketplaceName?.charAt(0)}</span>
                                                            )) : <span className="pmh-cell-sub">—</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="pmh-actions">
                                                            <button className="pmh-act-btn pmh-act-edit" title="Stok Güncelle" onClick={() => { setStockModal({ product }); setStockValue(String(stock)); }}><FaWarehouse /></button>
                                                            <button className="pmh-act-btn pmh-act-edit" title="Fiyat Güncelle" onClick={() => { setPriceModal({ product }); setSalePrice(String(price)); setListPrice(String(lp)); }}><FaMoneyBillWave /></button>
                                                            {missingMPs.length > 0 && (
                                                                <button className="pmh-act-btn" style={{ color: "#8b5cf6" }} title={`${missingMPs.length} platforma dağıt`} onClick={async () => { setLoading(true); try { await bulkDistributeSelected([product._id], missingMPs); showToast("Dağıtıldı!", "success"); loadProducts(); } catch { showToast("Hata", "error"); } setLoading(false); }}><FaRocket /></button>
                                                            )}
                                                            <button className="pmh-act-btn" style={{ color: "#ef4444" }} title="Sil" onClick={() => setDeleteModal(product)}><FaTrash /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {totalPages > 1 && <div className="pmh-pagination"><button className="pmh-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button><span className="pmh-pg-info">Sayfa {page + 1} / {totalPages}</span><button className="pmh-pg-btn" disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>Sonraki →</button></div>}
                    </>
                )}

                {/* ─── ALT SEKME: Yeni Ürün Ekle ─── */}
                {productsSubTab === "upload" && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(34,197,94,0.3)", borderRadius: "16px", padding: "24px" }}>
                        <h3 style={{ margin: "0 0 20px 0", color: "#22c55e", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><FaPlus /> Yeni Ürün Oluştur</h3>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
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
                                <div key={f.key}>
                                    <label style={{ display: "block", marginBottom: "5px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>{f.label}</label>
                                    <input type={f.type || "text"} value={newProduct[f.key]} onChange={e => setNewProduct(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "0.85rem", boxSizing: "border-box" }} />
                                </div>
                            ))}
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Açıklama</label>
                            <textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Ürün açıklaması..." rows={3} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "0.85rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>

                        {/* Görsel URL */}
                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Görsel URL</label>
                            {newProduct.images.map((img, idx) => (
                                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                                    <input type="text" value={img} onChange={e => setNewProduct(p => ({ ...p, images: p.images.map((im, i) => i === idx ? e.target.value : im) }))} placeholder={`Görsel URL ${idx + 1}`} style={{ flex: 1, padding: "0.6rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "0.82rem", boxSizing: "border-box" }} />
                                    {img && <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.05)" }}><img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /></div>}
                                    {newProduct.images.length > 1 && <button onClick={() => setNewProduct(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#ef4444", padding: "6px 8px", cursor: "pointer", fontSize: "12px" }}><FaTimes /></button>}
                                </div>
                            ))}
                            <button onClick={() => setNewProduct(p => ({ ...p, images: [...p.images, ""] }))} className="pmh-btn pmh-btn-outline" style={{ fontSize: "12px", padding: "6px 12px" }}><FaPlus /> Görsel Ekle</button>
                        </div>

                        {/* Hedef Pazaryerleri */}
                        <div style={{ marginBottom: "20px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Hedef Pazaryerleri</label>
                            {marketplaces.length === 0 ? (
                                <div style={{ color: "#64748b", fontSize: "0.82rem", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>Henüz pazaryeri entegrasyonu yok.</div>
                            ) : (
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    {marketplaces.map(mp => (
                                        <label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "8px", background: newProductTargets.includes(mp.name) ? `${mpColor(mp.name)}18` : "rgba(255,255,255,0.03)", border: `1.5px solid ${newProductTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", padding: "8px 14px", cursor: "pointer" }}>
                                            <input type="checkbox" style={{ display: "none" }} checked={newProductTargets.includes(mp.name)} onChange={() => toggleNewProductTarget(mp.name)} />
                                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: mpColor(mp.name) }} />
                                            <span style={{ color: newProductTargets.includes(mp.name) ? "#e2e8f0" : "#94a3b8", fontWeight: newProductTargets.includes(mp.name) ? 700 : 500, fontSize: "0.85rem" }}>{mp.name}</span>
                                            {newProductTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 11 }} />}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button className="pmh-btn pmh-btn-outline" onClick={() => { setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] }); setNewProductTargets([]); }}><FaTimes /> Temizle</button>
                            <button className="pmh-btn pmh-btn-primary" onClick={handleCreateProduct} disabled={loading || !newProduct.name || !newProduct.barcode || !newProduct.sku || !newProduct.price} style={{ fontSize: "14px", padding: "10px 24px" }}>
                                {loading ? <Spinner /> : <FaRocket />} {newProductTargets.length > 0 ? `Kaydet & ${newProductTargets.length} Platforma Yükle` : "Ürünü Kaydet"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Fiyatlandırma artık ayrı sekme — "pricing" tab'ına taşındı */}
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Çek & Yükle (DÜZELTILMIŞ — Gerçekten Çalışan Versiyon)
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPullPush = () => {
        // ── Adım 1: Kaynak seç & ürünleri çek ──
        const handlePull = async () => {
            if (!pullSource) { showToast("Kaynak pazaryeri seçin", "warning"); return; }
            setPullLoading(true);
            setPullResult(null);
            setPulledProducts([]);
            setSelectedPulledProducts([]);
            try {
                const sourceMP = marketplaces.find(m => m.name === pullSource);
                if (!sourceMP) { showToast("Pazaryeri bulunamadı", "error"); setPullLoading(false); return; }

                // API çağrısı — backend { success, stats: { total, new, updated, skipped, errors } } döner
                const res = await syncFromMarketplace(sourceMP._id, sourceMP.name);

                // Backend yanıt formatı: res.stats.new, res.stats.updated
                const stats = res.stats || res;
                const newCount = stats.new || stats.newProducts || stats.totalNew || 0;
                const updatedCount = stats.updated || stats.updatedProducts || stats.totalUpdated || 0;
                const totalCount = stats.total || (newCount + updatedCount);

                setPullResult({ success: true, newCount, updatedCount, total: totalCount, source: pullSource });
                showToast(`${pullSource}: ${newCount} yeni, ${updatedCount} güncellenen ürün çekildi`, "success");

                // Ürünleri yeniden yükle ve çekilen ürünleri göster
                const freshProducts = await loadProducts();
                setPulledProducts(freshProducts);
                setSelectedPulledProducts(freshProducts.map(p => p._id));

            } catch (e) {
                const errMsg = e?.response?.data?.error || e?.message || "Ürünler çekilemedi";
                setPullResult({ success: false, error: errMsg });
                showToast("Hata: " + errMsg, "error");
            } finally { setPullLoading(false); }
        };

        // ── Adım 2: Seçili ürünleri hedef pazaryerlerine dağıt ──
        const handlePush = async () => {
            if (pushTargets.length === 0) { showToast("Hedef pazaryeri seçin", "warning"); return; }
            if (selectedPulledProducts.length === 0) { showToast("Ürün seçin", "warning"); return; }
            setPushLoading(true);
            setPushResult(null);
            try {
                const res = await bulkDistributeSelected(selectedPulledProducts, pushTargets);
                const results = res.results || {};
                setPushResult({ success: true, distributed: results.distributed || selectedPulledProducts.length, errors: results.errors || 0 });
                showToast(`${selectedPulledProducts.length} ürün ${pushTargets.length} pazaryerine dağıtıldı`, "success");
                loadProducts();
            } catch (e) {
                const errMsg = e?.response?.data?.error || e?.message || "Dağıtım başarısız";
                setPushResult({ success: false, error: errMsg });
                showToast("Hata: " + errMsg, "error");
            } finally { setPushLoading(false); }
        };

        const resetAll = () => {
            setPullSource(""); setPullResult(null); setPushTargets([]);
            setPushResult(null); setPulledProducts([]); setSelectedPulledProducts([]);
        };

        const togglePushTarget = (name) => setPushTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
        const togglePulledProduct = (id) => setSelectedPulledProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        const availableTargets = marketplaces.filter(m => m.name !== pullSource);

        return (
            <motion.div key="pull-push" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Açıklama */}
                <div className="pmh-info-banner" style={{ marginBottom: "20px" }}>
                    <FaCloudDownloadAlt style={{ color: "#8b5cf6", flexShrink: 0, fontSize: "1.2rem" }} />
                    <div className="pmh-info-text">
                        <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#8b5cf6" }}>Pazaryerinden Çek & Başka Pazaryerine Yükle</h3>
                        <p style={{ margin: "4px 0 0" }}>Bir pazaryerindeki ürünlerinizi API ile çekin, ardından diğer pazaryerlerine toplu dağıtın.</p>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    {/* ── SOL PANEL: Kaynak Seç & Çek ── */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(139,92,246,0.25)", borderRadius: "14px", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#8b5cf6", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FaCloudDownloadAlt /> 1. Kaynak Seç & Çek</h3>

                        {marketplaces.length === 0 ? (
                            <div className="pmh-center-msg"><FaStore style={{ fontSize: "2rem", color: "#64748b" }} /><p style={{ fontSize: "13px" }}>Pazaryeri entegrasyonu bulunamadı</p></div>
                        ) : (
                            <>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                                    {marketplaces.map(mp => (
                                        <div key={mp._id} onClick={() => setPullSource(mp.name)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", border: `2px solid ${pullSource === mp.name ? mpColor(mp.name) : "rgba(255,255,255,0.08)"}`, background: pullSource === mp.name ? `${mpColor(mp.name)}12` : "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 0.2s" }}>
                                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: mpColor(mp.name), boxShadow: pullSource === mp.name ? `0 0 8px ${mpColor(mp.name)}60` : "none" }} />
                                            <span style={{ color: pullSource === mp.name ? "#e2e8f0" : "#94a3b8", fontWeight: 600, fontSize: "14px", flex: 1 }}>{mp.name}</span>
                                            {pullSource === mp.name && <FaCheckCircle style={{ color: mpColor(mp.name) }} />}
                                        </div>
                                    ))}
                                </div>

                                <button className="pmh-btn pmh-btn-primary" onClick={handlePull} disabled={!pullSource || pullLoading} style={{ width: "100%", justifyContent: "center", fontSize: "14px", padding: "12px" }}>
                                    {pullLoading ? <><Spinner /> Çekiliyor...</> : <><FaCloudDownloadAlt /> {pullSource ? `${pullSource}'dan Ürünleri Çek` : "Önce Pazaryeri Seçin"}</>}
                                </button>
                            </>
                        )}

                        {/* Çekme Sonucu */}
                        {pullResult && (
                            <div style={{ marginTop: "16px", padding: "12px", borderRadius: "10px", background: pullResult.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${pullResult.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                                {pullResult.success ? (
                                    <div>
                                        <div style={{ color: "#22c55e", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}><FaCheckCircle /> Başarılı!</div>
                                        <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                                            <span style={{ color: "#94a3b8" }}>Toplam: <strong style={{ color: "#e2e8f0" }}>{pullResult.total}</strong></span>
                                            <span style={{ color: "#94a3b8" }}>Yeni: <strong style={{ color: "#22c55e" }}>{pullResult.newCount}</strong></span>
                                            <span style={{ color: "#94a3b8" }}>Güncellenen: <strong style={{ color: "#4ecdc4" }}>{pullResult.updatedCount}</strong></span>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: "#ef4444", fontSize: "13px" }}><FaTimesCircle /> {pullResult.error}</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── SAĞ PANEL: Hedef Seç & Dağıt ── */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(245,158,11,0.25)", borderRadius: "14px", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#f59e0b", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FaCloudUploadAlt /> 2. Hedef Seç & Dağıt</h3>

                        {!pullResult?.success ? (
                            <div className="pmh-center-msg" style={{ padding: "2rem" }}>
                                <FaArrowLeft style={{ fontSize: "2rem", color: "#64748b" }} />
                                <p style={{ fontSize: "13px", color: "#64748b" }}>Önce sol panelden ürünleri çekin</p>
                            </div>
                        ) : (
                            <>
                                {/* Hedef Pazaryerleri */}
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", marginBottom: "8px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Hedef Pazaryerleri</label>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {availableTargets.map(mp => (
                                            <label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", border: `1.5px solid ${pushTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.08)"}`, background: pushTargets.includes(mp.name) ? `${mpColor(mp.name)}12` : "transparent", cursor: "pointer" }}>
                                                <input type="checkbox" style={{ display: "none" }} checked={pushTargets.includes(mp.name)} onChange={() => togglePushTarget(mp.name)} />
                                                <span style={{ width: 10, height: 10, borderRadius: "50%", background: mpColor(mp.name) }} />
                                                <span style={{ color: pushTargets.includes(mp.name) ? "#e2e8f0" : "#94a3b8", fontWeight: 600, fontSize: "14px", flex: 1 }}>{mp.name}</span>
                                                {pushTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 12 }} />}
                                            </label>
                                        ))}
                                        {availableTargets.length === 0 && <div style={{ color: "#64748b", fontSize: "13px" }}>Başka pazaryeri yok</div>}
                                    </div>
                                </div>

                                {/* Ürün Seçimi */}
                                <div style={{ marginBottom: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                        <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Ürünler ({selectedPulledProducts.length}/{pulledProducts.length})</span>
                                        <button className="pmh-btn pmh-btn-outline" onClick={() => setSelectedPulledProducts(selectedPulledProducts.length === pulledProducts.length ? [] : pulledProducts.map(p => p._id))} style={{ fontSize: "11px", padding: "4px 10px" }}>
                                            {selectedPulledProducts.length === pulledProducts.length ? "Kaldır" : "Tümünü Seç"}
                                        </button>
                                    </div>
                                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}>
                                        {pulledProducts.slice(0, 50).map(product => {
                                            const mp = product.masterProduct || product;
                                            const sel = selectedPulledProducts.includes(product._id);
                                            return (
                                                <div key={product._id} onClick={() => togglePulledProduct(product._id)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", background: sel ? "rgba(245,158,11,0.06)" : "transparent", fontSize: "12px" }}>
                                                    {sel ? <FaCheckSquare style={{ color: "#f59e0b", flexShrink: 0 }} /> : <FaSquare style={{ color: "#30363d", flexShrink: 0 }} />}
                                                    <span style={{ color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.name || "İsimsiz"}</span>
                                                    <span style={{ color: "#64748b" }}>{fmt(mp.price || 0)}</span>
                                                </div>
                                            );
                                        })}
                                        {pulledProducts.length === 0 && <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>Ürün yok</div>}
                                    </div>
                                </div>

                                {/* Dağıt Butonu */}
                                <button className="pmh-btn pmh-btn-primary" onClick={handlePush} disabled={pushLoading || pushTargets.length === 0 || selectedPulledProducts.length === 0} style={{ width: "100%", justifyContent: "center", fontSize: "14px", padding: "12px" }}>
                                    {pushLoading ? <><Spinner /> Dağıtılıyor...</> : <><FaCloudUploadAlt /> {pushTargets.length > 0 && selectedPulledProducts.length > 0 ? `${selectedPulledProducts.length} Ürünü ${pushTargets.length} Pazaryerine Dağıt` : "Hedef & Ürün Seçin"}</>}
                                </button>

                                {/* Dağıtım Sonucu */}
                                {pushResult && (
                                    <div style={{ marginTop: "12px", padding: "12px", borderRadius: "10px", background: pushResult.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${pushResult.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                                        {pushResult.success ? (
                                            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: "13px" }}><FaCheckCircle /> Dağıtım tamamlandı!</div>
                                        ) : (
                                            <div style={{ color: "#ef4444", fontSize: "13px" }}><FaTimesCircle /> {pushResult.error}</div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Baştan Başla */}
                {(pullResult || pushResult) && (
                    <div style={{ marginTop: "16px", textAlign: "center" }}>
                        <button className="pmh-btn pmh-btn-outline" onClick={resetAll}><FaSync /> Yeni İşlem Başlat</button>
                    </div>
                )}
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Karşılaştırma
       ══════════════════════════════════════════════════════════════════════════ */
    const renderComparison = () => (
        <motion.div key="comparison" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="pmh-info-banner" style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "1.2rem" }}>🗺️</span>
                <div className="pmh-info-text">
                    <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Karşılaştırma Matrisi</h3>
                    <p style={{ margin: "6px 0 0" }}>Her ürünün hangi pazaryerinde mevcut, hangisinde eksik olduğunu görün.</p>
                    <div style={{ display: "flex", gap: "16px", marginTop: "8px", flexWrap: "wrap", fontSize: "0.78rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: "#22c55e" }}>✅</span> Senkron</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: "#f59e0b" }}>⏳</span> Bekliyor</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: "#ef4444" }}>❌</span> Hata</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: "#475569" }}>⬜</span> Yok</span>
                    </div>
                </div>
            </div>

            {/* Özet Kartları */}
            <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #22c55e" }}><div className="pmh-stat-icon" style={{ background: "#22c55e18", color: "#22c55e" }}>✅</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#22c55e" }}>{compSummary?.fullyDistributed ?? 0}</span><span className="pmh-stat-label">Tam Dağıtılmış</span></div></div>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #f59e0b" }}><div className="pmh-stat-icon" style={{ background: "#f59e0b18", color: "#f59e0b" }}>⚠️</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#f59e0b" }}>{compSummary?.partiallyMissing ?? 0}</span><span className="pmh-stat-label">Kısmi Eksik</span></div></div>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #ef4444" }}><div className="pmh-stat-icon" style={{ background: "#ef444418", color: "#ef4444" }}>🚫</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#ef4444" }}>{compSummary?.notDistributed ?? 0}</span><span className="pmh-stat-label">Dağıtılmamış</span></div></div>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #3b82f6" }}><div className="pmh-stat-icon" style={{ background: "#3b82f618", color: "#3b82f6" }}>📦</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#3b82f6" }}>{compTotal}</span><span className="pmh-stat-label">Toplam Ürün</span></div></div>
            </div>

            {/* Toolbar */}
            <div className="pmh-toolbar" style={{ marginBottom: "16px" }}>
                <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={compSearch} onChange={e => { setCompSearch(e.target.value); setCompPage(0); }} className="pmh-search-input" /></div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: missingOnly ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${missingOnly ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", padding: "8px 14px", cursor: "pointer" }}>
                    <input type="checkbox" checked={missingOnly} onChange={e => { setMissingOnly(e.target.checked); setCompPage(0); }} style={{ accentColor: "#ef4444" }} />
                    <span style={{ color: missingOnly ? "#ef4444" : "#94a3b8", fontWeight: missingOnly ? 700 : 500, fontSize: "0.85rem" }}>Sadece eksik olanlar</span>
                </label>
                <span style={{ color: "#94a3b8" }}>{compTotal} ürün</span>
                <button className="pmh-btn pmh-btn-outline" onClick={loadComparison}><FaSync /> Yenile</button>
            </div>

            {/* Toplu Dağıtım */}
            {selectedProducts.length > 0 && (
                <div style={{ background: "rgba(15,118,110,0.12)", border: "1.5px solid rgba(15,118,110,0.4)", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "#14b8a6" }}><FaCheckSquare style={{ marginRight: 6 }} />{selectedProducts.length} ürün</span>
                    <div style={{ display: "flex", gap: "8px", flex: 1, flexWrap: "wrap" }}>{marketplaces.map(mp => (<label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "6px", background: bulkTargets.includes(mp.name) ? `${mpColor(mp.name)}22` : "rgba(255,255,255,0.04)", border: `1px solid ${bulkTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" }}><input type="checkbox" style={{ display: "none" }} checked={bulkTargets.includes(mp.name)} onChange={() => toggleTarget(mp.name)} /><span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(mp.name) }} />{mp.name}{bulkTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 10 }} />}</label>))}</div>
                    <button className="pmh-btn pmh-btn-primary" onClick={handleBulkDistribute} disabled={loading || bulkTargets.length === 0}>{loading ? <Spinner /> : <FaRocket />} Dağıt</button>
                    <button className="pmh-btn pmh-btn-outline" onClick={() => { setSelectedProducts([]); setBulkTargets([]); }}><FaTimes /></button>
                </div>
            )}

            {/* Matris Tablosu */}
            {compMatrix.length === 0 ? <div className="pmh-center-msg"><FaTable style={{ fontSize: "3rem", color: "#64748b" }} /><p>Veri bulunamadı</p><button className="pmh-btn pmh-btn-primary" onClick={loadComparison}><FaSync /> Yenile</button></div> : (
                <div className="pmh-table-wrap">
                    <table className="pmh-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}><input type="checkbox" checked={selectedProducts.length === compMatrix.length && compMatrix.length > 0} onChange={() => setSelectedProducts(selectedProducts.length === compMatrix.length ? [] : compMatrix.map(p => p._id))} /></th>
                                <th>Ürün</th>
                                <th>Barkod</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                {marketplaces.map((mp, i) => (
                                    <th key={i} style={{ background: `${mpColor(mp.name)}15`, color: mpColor(mp.name), textAlign: "center", borderBottom: `3px solid ${mpColor(mp.name)}`, fontWeight: 700 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(mp.name) }} />
                                            {mp.name}
                                        </div>
                                    </th>
                                ))}
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {compMatrix.map(product => {
                                const missingCount = product.missingCount || 0;
                                const sel = selectedProducts.includes(product._id);
                                return (
                                    <tr key={product._id} style={{ background: sel ? "rgba(20,184,166,0.04)" : undefined }}>
                                        <td><input type="checkbox" checked={sel} onChange={() => toggleProduct(product._id)} /></td>
                                        <td><div style={{ fontWeight: 600, color: "#f1f5f9", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name || "İsimsiz"}</div></td>
                                        <td style={{ color: "#64748b", fontSize: "0.78rem" }}>{product.barcode || "—"}</td>
                                        <td><span className="pmh-price-main">{fmt(product.price || 0)}</span></td>
                                        <td style={{ textAlign: "center" }}><span style={{ fontWeight: 700, color: (product.stock || 0) === 0 ? "#ef4444" : (product.stock || 0) < 10 ? "#f59e0b" : "#22c55e" }}>{product.stock ?? "—"}</span></td>
                                        {marketplaces.map((mp, i) => {
                                            const presence = product.presence?.[mp.name];
                                            const exists = presence?.exists;
                                            const status = presence?.syncStatus;
                                            return (
                                                <td key={i} style={{ textAlign: "center" }}>
                                                    <span style={{ fontSize: "1rem" }}>{exists ? status === "synced" ? "✅" : status === "error" ? "❌" : "⏳" : "⬜"}</span>
                                                </td>
                                            );
                                        })}
                                        <td style={{ textAlign: "center" }}>{missingCount > 0 ? <span className="pmh-stock-pill pmh-stock-low">{missingCount} eksik</span> : <span className="pmh-stock-pill pmh-stock-ok">Tam</span>}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {compTotal > PAGE_SIZE && <div className="pmh-pagination"><button className="pmh-pg-btn" disabled={compPage === 0} onClick={() => setCompPage(p => p - 1)}>← Önceki</button><span>Sayfa {compPage + 1} / {Math.ceil(compTotal / PAGE_SIZE)}</span><button className="pmh-pg-btn" disabled={(compPage + 1) * PAGE_SIZE >= compTotal} onClick={() => setCompPage(p => p + 1)}>Sonraki →</button></div>}
        </motion.div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Fiyatlandırma (YENİ — Platform Bazlı Fiyat Yönetimi)
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPricing = () => {
        const modes = [
            { key: "per-product", icon: <FaTag />, label: "Ürün Bazlı", desc: "Tek ürünün her platformda farklı fiyatı" },
            { key: "bulk", icon: <FaTags />, label: "Toplu Güncelle", desc: "Seçili ürünlere toplu fiyat uygula" },
            { key: "base-sync", icon: <FaExchangeAlt />, label: "Baz Platform", desc: "1 platformdan fiyat al, diğerlerine dağıt" },
        ];

        const openPricingForProduct = (product) => {
            const mp = product.masterProduct || product;
            setPricingProduct(product);
            const prices = {};
            (product.marketplaceMappings || []).forEach(m => {
                prices[m.marketplaceName] = { salePrice: String(m.price || mp.price || ""), listPrice: String(m.listPrice || mp.listPrice || "") };
            });
            marketplaces.forEach(m => {
                if (!prices[m.name]) prices[m.name] = { salePrice: String(mp.price || ""), listPrice: String(mp.listPrice || "") };
            });
            setPlatformPrices(prices);
        };

        const savePlatformPrices = async () => {
            if (!pricingProduct) return;
            setPricingSaving(true);
            let ok = 0, err = 0;
            for (const [mpName, priceData] of Object.entries(platformPrices)) {
                const sp = parseFloat(priceData.salePrice);
                if (!sp || sp <= 0) continue;
                try {
                    await syncPrice(pricingProduct._id, sp, priceData.listPrice ? parseFloat(priceData.listPrice) : null);
                    ok++;
                } catch { err++; }
            }
            showToast(`${ok} platform güncellendi${err > 0 ? `, ${err} hata` : ""}`, ok > 0 ? "success" : "error");
            setPricingSaving(false);
            setPricingProduct(null);
            loadProducts();
        };

        const handleBaseSyncApply = async () => {
            if (!pricingBaseMP || pricingTargetMPs.length === 0) { showToast("Baz ve hedef platform seçin", "warning"); return; }
            const margin = parseFloat(pricingMargin) || 0;
            const roundTo = pricingRoundTo;
            setLoading(true);
            let ok = 0, err = 0;
            for (const product of products) {
                const mp = product.masterProduct || product;
                const baseMapping = (product.marketplaceMappings || []).find(m => m.marketplaceName === pricingBaseMP);
                const basePrice = baseMapping?.price || mp.price || 0;
                if (!basePrice) continue;
                let newPrice = basePrice * (1 + margin / 100);
                if (roundTo) {
                    const decimal = parseFloat(roundTo);
                    newPrice = Math.floor(newPrice) + decimal;
                }
                for (const targetMP of pricingTargetMPs) {
                    try { await syncPrice(product._id, newPrice); ok++; } catch { err++; }
                }
            }
            showToast(`${ok} güncelleme yapıldı${err > 0 ? `, ${err} hata` : ""}`, ok > 0 ? "success" : "error");
            setLoading(false);
            loadProducts();
        };

        return (
            <motion.div key="pricing" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Mod Seçimi */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    {modes.map(m => (
                        <div key={m.key} onClick={() => setPricingMode(m.key)} style={{ flex: 1, background: pricingMode === m.key ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.02)", border: `1.5px solid ${pricingMode === m.key ? "#f59e0b" : "rgba(255,255,255,0.08)"}`, borderRadius: "12px", padding: "14px 16px", cursor: "pointer", transition: "all 0.2s" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <span style={{ color: pricingMode === m.key ? "#f59e0b" : "#94a3b8", fontSize: "16px" }}>{m.icon}</span>
                                <span style={{ color: pricingMode === m.key ? "#f59e0b" : "#e2e8f0", fontWeight: 700, fontSize: "13px" }}>{m.label}</span>
                            </div>
                            <div style={{ color: "#64748b", fontSize: "11px" }}>{m.desc}</div>
                        </div>
                    ))}
                </div>

                {/* ─── MOD: Ürün Bazlı Fiyatlandırma ─── */}
                {pricingMode === "per-product" && (
                    <>
                        {pricingProduct ? (
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(245,158,11,0.3)", borderRadius: "14px", padding: "20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h3 style={{ margin: 0, color: "#f59e0b", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FaDollarSign /> Platform Bazlı Fiyat: <span style={{ color: "#e2e8f0" }}>{(pricingProduct.masterProduct || pricingProduct).name}</span></h3>
                                    <button className="pmh-btn pmh-btn-outline" onClick={() => setPricingProduct(null)}><FaTimes /> Kapat</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                                    {marketplaces.map(mp => {
                                        const color = mpColor(mp.name);
                                        const prices = platformPrices[mp.name] || { salePrice: "", listPrice: "" };
                                        return (
                                            <div key={mp._id} style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: "10px", padding: "14px", borderLeft: `4px solid ${color}` }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                                                    <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "13px" }}>{mp.name}</span>
                                                </div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                                    <div>
                                                        <label style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "3px" }}>Satış Fiyatı (₺)</label>
                                                        <input type="number" value={prices.salePrice} onChange={e => setPlatformPrices(prev => ({ ...prev, [mp.name]: { ...prev[mp.name], salePrice: e.target.value } }))} style={{ width: "100%", padding: "8px", borderRadius: "8px", border: `1px solid ${color}30`, background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "14px", fontWeight: 700, boxSizing: "border-box" }} />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: "block", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "3px" }}>Liste Fiyatı (₺)</label>
                                                        <input type="number" value={prices.listPrice} onChange={e => setPlatformPrices(prev => ({ ...prev, [mp.name]: { ...prev[mp.name], listPrice: e.target.value } }))} style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "14px", boxSizing: "border-box" }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                                    <button className="pmh-btn pmh-btn-outline" onClick={() => setPricingProduct(null)}>İptal</button>
                                    <button className="pmh-btn pmh-btn-primary" onClick={savePlatformPrices} disabled={pricingSaving}>{pricingSaving ? <Spinner /> : <FaSave />} Tüm Platformlara Kaydet</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="pmh-info-banner" style={{ marginBottom: "16px" }}>
                                    <FaInfoCircle style={{ color: "#f59e0b", flexShrink: 0, fontSize: "1.1rem" }} />
                                    <div className="pmh-info-text">
                                        <p style={{ margin: 0 }}>Bir ürüne tıklayarak her platform için ayrı fiyat belirleyebilirsiniz.</p>
                                    </div>
                                </div>
                                <div className="pmh-toolbar" style={{ marginBottom: "16px" }}>
                                    <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ürün ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div>
                                </div>
                                {products.length === 0 ? <div className="pmh-center-msg"><p>Ürün bulunamadı</p></div> : (
                                    <div className="pmh-table-wrap">
                                        <table className="pmh-table">
                                            <thead>
                                                <tr>
                                                    <th>Ürün</th>
                                                    <th>Ana Fiyat</th>
                                                    {marketplaces.map(mp => <th key={mp._id} style={{ textAlign: "center", color: mpColor(mp.name), borderBottom: `3px solid ${mpColor(mp.name)}` }}>{mp.name}</th>)}
                                                    <th>İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.map(product => {
                                                    const mp = product.masterProduct || product;
                                                    const price = mp.price ?? 0;
                                                    return (
                                                        <tr key={product._id} className="pmh-tr">
                                                            <td><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div className="pmh-thumb">{safeImg(mp.images) ? <img src={safeImg(mp.images)} alt="" /> : <FaBox />}</div><div><div className="pmh-cell-title">{mp.name || "İsimsiz"}</div><div className="pmh-cell-sub">{mp.sku || mp.barcode || "—"}</div></div></div></td>
                                                            <td><span className="pmh-price-main">{fmt(price)}</span></td>
                                                            {marketplaces.map(mkt => {
                                                                const mapping = (product.marketplaceMappings || []).find(m => m.marketplaceName === mkt.name);
                                                                const mpPrice = mapping?.price || price;
                                                                const diff = price > 0 ? ((mpPrice - price) / price * 100).toFixed(1) : 0;
                                                                return (
                                                                    <td key={mkt._id} style={{ textAlign: "center" }}>
                                                                        {mapping ? (
                                                                            <div>
                                                                                <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "13px" }}>{fmt(mpPrice)}</div>
                                                                                {diff !== "0.0" && <div style={{ fontSize: "10px", color: parseFloat(diff) > 0 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>{parseFloat(diff) > 0 ? "+" : ""}{diff}%</div>}
                                                                            </div>
                                                                        ) : <span style={{ color: "#475569", fontSize: "12px" }}>—</span>}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td><button className="pmh-btn pmh-btn-primary" style={{ fontSize: "11px", padding: "5px 12px" }} onClick={() => openPricingForProduct(product)}><FaEdit /> Fiyatla</button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {totalPages > 1 && <div className="pmh-pagination"><button className="pmh-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button><span className="pmh-pg-info">Sayfa {page + 1} / {totalPages}</span><button className="pmh-pg-btn" disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>Sonraki →</button></div>}
                            </>
                        )}
                    </>
                )}

                {/* ─── MOD: Toplu Fiyat Güncelleme ─── */}
                {pricingMode === "bulk" && (
                    <>
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px", marginBottom: "20px" }}>
                            <h3 style={{ margin: "0 0 14px 0", color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}><FaTags style={{ marginRight: "8px", color: "#f59e0b" }} />Toplu Fiyat Güncelleme {selectedProducts.length > 0 && <span style={{ background: "rgba(20,184,166,0.12)", borderRadius: 20, padding: "4px 14px", fontSize: "0.78rem", color: "#14b8a6", marginLeft: "10px" }}>{selectedProducts.length} ürün</span>}</h3>
                            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                                {[{ key: "fixed", label: "Sabit Fiyat", icon: "₺" }, { key: "percent", label: "% İndirim", icon: "🏷️" }, { key: "margin", label: "% Kar", icon: "📈" }].map(m => (
                                    <div key={m.key} onClick={() => setBulkPriceMode(m.key)} style={{ background: bulkPriceMode === m.key ? "rgba(78,205,196,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${bulkPriceMode === m.key ? "#4ecdc4" : "rgba(255,255,255,0.08)"}`, borderRadius: "10px", padding: "12px 16px", cursor: "pointer", flex: 1, minWidth: "120px" }}>
                                        <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{m.icon}</div>
                                        <div style={{ color: bulkPriceMode === m.key ? "#4ecdc4" : "#e2e8f0", fontWeight: 700, fontSize: "13px" }}>{m.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>{bulkPriceMode === "fixed" ? "Yeni Fiyat (₺)" : bulkPriceMode === "percent" ? "İndirim (%)" : "Kar (%)"}</label>
                                    <input type="number" value={bulkPriceValue} onChange={e => setBulkPriceValue(e.target.value)} placeholder={bulkPriceMode === "fixed" ? "299.90" : "15"} style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", width: "150px" }} />
                                </div>
                                <button className="pmh-btn pmh-btn-primary" onClick={handleBulkPriceUpdate} disabled={loading || selectedProducts.length === 0 || !bulkPriceValue}>{loading ? <Spinner /> : <FaMoneyBillWave />} {selectedProducts.length > 0 ? `${selectedProducts.length} Ürünü Güncelle` : "Önce Ürün Seçin ↓"}</button>
                                {selectedProducts.length > 0 && <button className="pmh-btn pmh-btn-outline" onClick={() => setSelectedProducts([])}><FaTimes /> Seçimi Temizle</button>}
                            </div>
                        </div>
                        {/* Ürün Tablosu */}
                        <div className="pmh-toolbar" style={{ marginBottom: "16px" }}>
                            <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div>
                            <button className="pmh-btn pmh-btn-outline" onClick={toggleAllProducts}>{selectedProducts.length === products.length ? <><FaTimesCircle /> Seçimi Kaldır</> : <><FaCheckSquare /> Tümünü Seç</>}</button>
                        </div>
                        {products.length === 0 ? <div className="pmh-center-msg"><p>Ürün bulunamadı</p></div> : (
                            <div className="pmh-table-wrap">
                                <table className="pmh-table">
                                    <thead><tr><th style={{ width: 40 }}><input type="checkbox" checked={selectedProducts.length === products.length} onChange={toggleAllProducts} /></th><th>Ürün</th><th>Satış Fiyatı</th><th>Liste Fiyatı</th><th>Stok</th><th>İşlem</th></tr></thead>
                                    <tbody>
                                        {products.map(product => {
                                            const mp = product.masterProduct || product;
                                            const price = mp.price ?? 0;
                                            const lp = mp.listPrice ?? price;
                                            const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                            const sel = selectedProducts.includes(product._id);
                                            return (
                                                <tr key={product._id} className="pmh-tr" style={{ background: sel ? "rgba(20,184,166,0.04)" : undefined }}>
                                                    <td><input type="checkbox" checked={sel} onChange={() => toggleProduct(product._id)} /></td>
                                                    <td><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div className="pmh-thumb">{safeImg(mp.images) ? <img src={safeImg(mp.images)} alt="" /> : <FaBox />}</div><div><div className="pmh-cell-title">{mp.name || "İsimsiz"}</div><div className="pmh-cell-sub">{mp.sku || mp.barcode || "—"}</div></div></div></td>
                                                    <td><span className="pmh-price-main">{fmt(price)}</span></td>
                                                    <td>{lp > price ? <span style={{ color: "#64748b", textDecoration: "line-through" }}>{fmt(lp)}</span> : "—"}</td>
                                                    <td><span style={{ fontWeight: 700, color: stock === 0 ? "#ef4444" : stock < 10 ? "#f59e0b" : "#22c55e" }}>{stock}</span></td>
                                                    <td><button className="pmh-btn pmh-btn-primary" style={{ fontSize: "11px", padding: "5px 10px" }} onClick={() => { setPriceModal({ product }); setSalePrice(String(price)); setListPrice(String(lp)); }}><FaEdit /> Güncelle</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {totalPages > 1 && <div className="pmh-pagination"><button className="pmh-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button><span className="pmh-pg-info">Sayfa {page + 1} / {totalPages}</span><button className="pmh-pg-btn" disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>Sonraki →</button></div>}
                    </>
                )}

                {/* ─── MOD: Baz Platform Senkronizasyonu ─── */}
                {pricingMode === "base-sync" && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(245,158,11,0.25)", borderRadius: "14px", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#f59e0b", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FaExchangeAlt /> Baz Platform Fiyat Senkronizasyonu</h3>
                        <div className="pmh-info-banner" style={{ marginBottom: "16px" }}>
                            <FaInfoCircle style={{ color: "#f59e0b", flexShrink: 0 }} />
                            <div className="pmh-info-text">
                                <p style={{ margin: 0 }}>Bir pazaryerini baz alarak fiyatları diğer platformlara otomatik dağıtın. Kar marjı ve yuvarlama kuralı belirleyebilirsiniz.</p>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                            {/* Baz Platform */}
                            <div>
                                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Baz Platform (Fiyat Kaynağı)</label>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {marketplaces.map(mp => (
                                        <div key={mp._id} onClick={() => { setPricingBaseMP(mp.name); setPricingTargetMPs(prev => prev.filter(t => t !== mp.name)); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", border: `2px solid ${pricingBaseMP === mp.name ? mpColor(mp.name) : "rgba(255,255,255,0.08)"}`, background: pricingBaseMP === mp.name ? `${mpColor(mp.name)}12` : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: mpColor(mp.name) }} />
                                            <span style={{ color: pricingBaseMP === mp.name ? "#e2e8f0" : "#94a3b8", fontWeight: 600, fontSize: "14px", flex: 1 }}>{mp.name}</span>
                                            {pricingBaseMP === mp.name && <FaCheckCircle style={{ color: mpColor(mp.name) }} />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Hedef Platformlar */}
                            <div>
                                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Hedef Platformlar</label>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {marketplaces.filter(mp => mp.name !== pricingBaseMP).map(mp => {
                                        const sel = pricingTargetMPs.includes(mp.name);
                                        return (
                                            <label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", border: `1.5px solid ${sel ? mpColor(mp.name) : "rgba(255,255,255,0.08)"}`, background: sel ? `${mpColor(mp.name)}12` : "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                                                <input type="checkbox" style={{ display: "none" }} checked={sel} onChange={() => setPricingTargetMPs(prev => sel ? prev.filter(t => t !== mp.name) : [...prev, mp.name])} />
                                                <span style={{ width: 12, height: 12, borderRadius: "50%", background: mpColor(mp.name) }} />
                                                <span style={{ color: sel ? "#e2e8f0" : "#94a3b8", fontWeight: 600, fontSize: "14px", flex: 1 }}>{mp.name}</span>
                                                {sel && <FaCheck style={{ color: mpColor(mp.name) }} />}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Ayarlar */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "5px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Kar Marjı (%)</label>
                                <input type="number" value={pricingMargin} onChange={e => setPricingMargin(e.target.value)} placeholder="0 (aynı fiyat)" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "14px", boxSizing: "border-box" }} />
                                <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>Örn: 10 = baz fiyatın %10 üstü</div>
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "5px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Yuvarlama Kuralı</label>
                                <select value={pricingRoundTo} onChange={e => setPricingRoundTo(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "14px", boxSizing: "border-box" }}>
                                    <option value="">Yuvarlama yok</option>
                                    <option value="0.90">.90 (299.90)</option>
                                    <option value="0.99">.99 (299.99)</option>
                                    <option value="0.00">.00 (300.00)</option>
                                    <option value="0.50">.50 (299.50)</option>
                                </select>
                            </div>
                        </div>

                        {/* Önizleme */}
                        {pricingBaseMP && pricingTargetMPs.length > 0 && (
                            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#f59e0b" }}>
                                <strong>{pricingBaseMP}</strong> fiyatları → <strong>{pricingTargetMPs.join(", ")}</strong> platformlarına
                                {pricingMargin && ` (+%${pricingMargin} kar marjı ile)`}
                                {pricingRoundTo && ` (${pricingRoundTo} yuvarlaması)`}
                                {` — ${totalProducts} ürün etkilenecek`}
                            </div>
                        )}

                        <button className="pmh-btn pmh-btn-primary" onClick={handleBaseSyncApply} disabled={loading || !pricingBaseMP || pricingTargetMPs.length === 0} style={{ fontSize: "14px", padding: "12px 24px" }}>
                            {loading ? <Spinner /> : <FaRocket />} Fiyatları Senkronize Et
                        </button>
                    </div>
                )}
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Kategori Mapping (CategoryMappingPage embed)
       ══════════════════════════════════════════════════════════════════════════ */
    const renderCategories = () => (
        <motion.div key="categories" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="pmh-info-banner" style={{ marginBottom: "16px" }}>
                <FaMapMarkedAlt style={{ color: "#06b6d4", flexShrink: 0, fontSize: "1.2rem" }} />
                <div className="pmh-info-text">
                    <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#06b6d4" }}>Kategori Eşleştirme</h3>
                    <p style={{ margin: "4px 0 0" }}>Ürünlerinizin pazaryeri kategorileriyle eşleştirilmesini yönetin. Eşleştirilmemiş kategorileri N11 kategori ağacından seçerek eşleştirin.</p>
                </div>
            </div>
            <CategoryMappingPage />
        </motion.div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Excel İçe/Dışa Aktar
       ══════════════════════════════════════════════════════════════════════════ */
    const renderExcel = () => {
        const handleFileSelect = (e) => {
            const file = e.target.files?.[0];
            if (file) { setExcelFile(file); setExcelPreview(null); setExcelResult(null); }
        };

        const handlePreview = async () => {
            if (!excelFile) return;
            setExcelImporting(true);
            try {
                const res = await previewImport(excelFile);
                setExcelPreview(res);
                showToast(`${res.stats?.total || 0} satır okundu`, "success");
            } catch (e) {
                showToast("Önizleme hatası: " + (e?.response?.data?.error || e.message), "error");
            }
            setExcelImporting(false);
        };

        const handleImport = async () => {
            if (!excelFile) return;
            setExcelImporting(true);
            try {
                const res = await executeImport(excelFile, { skipErrors: true, updateExisting: true });
                setExcelResult(res);
                showToast(`İçe aktarma tamamlandı — ${res.results?.created || 0} yeni, ${res.results?.updated || 0} güncellenen`, "success");
                loadProducts(); loadDashboard();
            } catch (e) {
                showToast("İçe aktarma hatası: " + (e?.response?.data?.error || e.message), "error");
            }
            setExcelImporting(false);
        };

        const handleExport = async () => {
            setExcelExporting(true);
            try {
                const res = await exportProducts({});
                const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
                showToast("Excel dışa aktarıldı", "success");
            } catch (e) {
                showToast("Dışa aktarma hatası: " + (e?.response?.data?.error || e.message), "error");
            }
            setExcelExporting(false);
        };

        const handleDownloadTemplate = async () => {
            try {
                const res = await downloadTemplate();
                const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "urun_yukleme_sablonu.xlsx";
                a.click();
                window.URL.revokeObjectURL(url);
                showToast("Şablon indirildi", "success");
            } catch (e) {
                showToast("Şablon indirilemedi", "error");
            }
        };

        return (
            <motion.div key="excel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    {/* SOL: İçe Aktar */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "14px", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#10b981", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FaFileImport /> Excel İçe Aktar</h3>

                        {/* Şablon İndir */}
                        <button className="pmh-btn pmh-btn-outline" onClick={handleDownloadTemplate} style={{ marginBottom: "16px", width: "100%", justifyContent: "center" }}><FaDownload /> Şablon İndir (.xlsx)</button>

                        {/* Dosya Seç */}
                        <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: "none" }} />
                        <div onClick={() => excelInputRef.current?.click()} style={{ border: "2px dashed rgba(16,185,129,0.3)", borderRadius: "12px", padding: "24px", textAlign: "center", cursor: "pointer", background: excelFile ? "rgba(16,185,129,0.06)" : "transparent", transition: "all 0.2s", marginBottom: "16px" }}>
                            <FaUpload style={{ fontSize: "24px", color: "#10b981", marginBottom: "8px" }} />
                            <div style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>{excelFile ? excelFile.name : "Dosya seçmek için tıklayın"}</div>
                            <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>.xlsx, .xls veya .csv</div>
                        </div>

                        {excelFile && (
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button className="pmh-btn pmh-btn-outline" onClick={handlePreview} disabled={excelImporting} style={{ flex: 1, justifyContent: "center" }}>{excelImporting ? <Spinner /> : <FaEye />} Önizle</button>
                                <button className="pmh-btn pmh-btn-primary" onClick={handleImport} disabled={excelImporting} style={{ flex: 1, justifyContent: "center" }}>{excelImporting ? <Spinner /> : <FaRocket />} İçe Aktar</button>
                            </div>
                        )}

                        {/* Önizleme Sonucu */}
                        {excelPreview && (
                            <div style={{ marginTop: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "14px" }}>
                                <h4 style={{ margin: "0 0 10px 0", color: "#e2e8f0", fontSize: "13px" }}>Önizleme Sonucu</h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", fontSize: "12px" }}>
                                    <div style={{ textAlign: "center", padding: "8px", background: "rgba(78,205,196,0.08)", borderRadius: "8px" }}><div style={{ color: "#4ecdc4", fontWeight: 700, fontSize: "18px" }}>{excelPreview.stats?.total || 0}</div><div style={{ color: "#94a3b8" }}>Toplam</div></div>
                                    <div style={{ textAlign: "center", padding: "8px", background: "rgba(34,197,94,0.08)", borderRadius: "8px" }}><div style={{ color: "#22c55e", fontWeight: 700, fontSize: "18px" }}>{excelPreview.stats?.new || 0}</div><div style={{ color: "#94a3b8" }}>Yeni</div></div>
                                    <div style={{ textAlign: "center", padding: "8px", background: "rgba(245,158,11,0.08)", borderRadius: "8px" }}><div style={{ color: "#f59e0b", fontWeight: 700, fontSize: "18px" }}>{excelPreview.stats?.update || 0}</div><div style={{ color: "#94a3b8" }}>Güncelleme</div></div>
                                    <div style={{ textAlign: "center", padding: "8px", background: "rgba(239,68,68,0.08)", borderRadius: "8px" }}><div style={{ color: "#ef4444", fontWeight: 700, fontSize: "18px" }}>{excelPreview.stats?.invalid || 0}</div><div style={{ color: "#94a3b8" }}>Hatalı</div></div>
                                </div>
                            </div>
                        )}

                        {/* İçe Aktarma Sonucu */}
                        {excelResult && (
                            <div style={{ marginTop: "16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "10px", padding: "14px" }}>
                                <h4 style={{ margin: "0 0 10px 0", color: "#22c55e", fontSize: "13px" }}><FaCheckCircle /> İçe Aktarma Tamamlandı</h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px" }}>
                                    <div><span style={{ color: "#94a3b8" }}>Oluşturulan: </span><strong style={{ color: "#22c55e" }}>{excelResult.results?.created || 0}</strong></div>
                                    <div><span style={{ color: "#94a3b8" }}>Güncellenen: </span><strong style={{ color: "#f59e0b" }}>{excelResult.results?.updated || 0}</strong></div>
                                    <div><span style={{ color: "#94a3b8" }}>Atlanan: </span><strong style={{ color: "#64748b" }}>{excelResult.results?.skipped || 0}</strong></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SAĞ: Dışa Aktar */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(59,130,246,0.25)", borderRadius: "14px", padding: "20px" }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#3b82f6", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}><FaDownload /> Excel Dışa Aktar</h3>

                        <div className="pmh-info-banner" style={{ marginBottom: "16px", borderColor: "rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.06)" }}>
                            <FaInfoCircle style={{ color: "#3b82f6", flexShrink: 0 }} />
                            <div className="pmh-info-text">
                                <p style={{ margin: 0 }}>Tüm ürünlerinizi Excel formatında indirin. Filtreleme uygulanmış ürünler dışa aktarılır.</p>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "14px" }}>Tüm Ürünler</div>
                                        <div style={{ color: "#64748b", fontSize: "12px" }}>{totalProducts} ürün dışa aktarılacak</div>
                                    </div>
                                    <button className="pmh-btn pmh-btn-primary" onClick={handleExport} disabled={excelExporting}>
                                        {excelExporting ? <Spinner /> : <FaFileExcel />} İndir (.xlsx)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bilgi */}
                        <div style={{ marginTop: "20px", padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>Excel Dosyası İçeriği</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#64748b" }}>
                                {["Ürün Adı, Barkod, SKU", "Fiyat, Liste Fiyatı, Stok", "Kategori, Marka", "Pazaryeri Durumları", "Görsel URL'leri"].map((item, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}><FaCheckCircle style={{ color: "#22c55e", fontSize: "10px" }} /> {item}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Loglar
       ══════════════════════════════════════════════════════════════════════════ */
    const renderLogs = () => {
        const successLogs = logs.filter(l => l.status === "synced" || l.status === "success").length;
        const errorLogs = logs.filter(l => l.status === "error").length;
        const pendingLogs = logs.filter(l => l.status === "pending" || l.status === "processing").length;

        return (
            <motion.div key="logs" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* KPI */}
                <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {[
                        { icon: "📋", label: "Toplam", val: logs.length, color: "#14b8a6" },
                        { icon: "✅", label: "Başarılı", val: successLogs, color: "#22c55e" },
                        { icon: "❌", label: "Hatalı", val: errorLogs, color: "#ef4444" },
                        { icon: "🔔", label: "Okunmamış", val: unreadCount, color: "#8b5cf6" }
                    ].map((k, i) => (
                        <div key={i} className="pmh-stat-card" style={{ borderTop: `3px solid ${k.color}` }}>
                            <div className="pmh-stat-icon" style={{ background: `${k.color}18`, color: k.color }}>{k.icon}</div>
                            <div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: k.color }}>{k.val}</span><span className="pmh-stat-label">{k.label}</span></div>
                        </div>
                    ))}
                </div>

                {/* Bildirimler */}
                {notifications.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px", marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}><FaBell style={{ marginRight: "8px", color: "#8b5cf6" }} />Bildirimler {unreadCount > 0 && <span style={{ background: "#8b5cf6", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: "0.7rem", marginLeft: 6 }}>{unreadCount}</span>}</h3>
                            <button className="pmh-btn pmh-btn-outline" onClick={handleMarkAllRead}><FaCheck /> Okundu</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {notifications.slice(0, 5).map((n, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "8px 12px" }}>
                                    <FaBell style={{ color: "#8b5cf6", flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 600 }}>{n.actionType || "Bildirim"}</div>
                                        <div style={{ color: "#64748b", fontSize: "11px" }}>{n.product?.name || "—"}</div>
                                    </div>
                                    <span style={{ color: "#475569", fontSize: "11px" }}>{n.timestamp ? new Date(n.timestamp).toLocaleString("tr-TR") : ""}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Log Tablosu */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}><FaClipboardList style={{ marginRight: "8px", color: "#4ecdc4" }} />İşlem Geçmişi</h3>
                    <button className="pmh-btn pmh-btn-outline" onClick={loadLogs}><FaSync /> Yenile</button>
                </div>

                {logs.length === 0 ? (
                    <div className="pmh-center-msg"><FaClipboardList style={{ fontSize: "2.5rem", color: "#64748b" }} /><p>Henüz log yok</p></div>
                ) : (
                    <div className="pmh-table-wrap">
                        <table className="pmh-table">
                            <thead><tr><th>Tarih</th><th>İşlem</th><th>Ürün</th><th>Pazaryeri</th><th>Durum</th></tr></thead>
                            <tbody>
                                {logs.map((log, i) => {
                                    const statusColor = log.status === "synced" || log.status === "success" ? "#22c55e" : log.status === "error" ? "#ef4444" : "#f59e0b";
                                    const statusIcon = log.status === "synced" || log.status === "success" ? "✅" : log.status === "error" ? "❌" : "⏳";
                                    return (
                                        <tr key={i} className="pmh-tr">
                                            <td style={{ color: "#64748b", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{log.timestamp ? new Date(log.timestamp).toLocaleString("tr-TR") : "—"}</td>
                                            <td><span style={{ background: "rgba(78,205,196,0.1)", color: "#4ecdc4", borderRadius: "6px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600 }}>{log.actionType || "—"}</span></td>
                                            <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.product?.name || log.product?.barcode || "—"}</td>
                                            <td>{log.marketplace?.name ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${mpColor(log.marketplace.name)}15`, border: `1px solid ${mpColor(log.marketplace.name)}30`, borderRadius: "6px", padding: "3px 8px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(log.marketplace.name) }} /><span style={{ color: mpColor(log.marketplace.name), fontWeight: 600, fontSize: "0.8rem" }}>{log.marketplace.name}</span></span>) : "—"}</td>
                                            <td><span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${statusColor}15`, border: `1px solid ${statusColor}30`, borderRadius: 999, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 700, color: statusColor }}>{statusIcon} {log.status === "synced" || log.status === "success" ? "Başarılı" : log.status === "error" ? "Hata" : log.status || "—"}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       ANA RENDER
       ══════════════════════════════════════════════════════════════════════════ */
    return (
        <div className="pmh-root">
            {/* Header */}
            <div className="pmh-page-header">
                <div className="pmh-page-header-left">
                    <div className="pmh-page-icon"><FaLayerGroup /></div>
                    <div>
                        <h1 className="pmh-page-title">Ürün Yönetimi</h1>
                        <p className="pmh-page-subtitle">
                            Stok · Dağıtım · Fiyat
                            {products.length > 0 && <span style={{ marginLeft: "10px", background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", color: "#4ecdc4", fontWeight: 700 }}>{products.length} ürün</span>}
                        </p>
                    </div>
                </div>
                <div className="pmh-page-badges">
                    {autoSyncRunning && <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4ecdc4", fontSize: "11px", fontWeight: 600 }}><Spinner /> Senkronize ediliyor...</div>}
                    <button className="pmh-btn pmh-btn-outline" onClick={() => setActiveTab("logs")} title="Bildirimler"><FaBell />{unreadCount > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "50%", padding: "1px 5px", fontSize: "10px", marginLeft: "4px" }}>{unreadCount}</span>}</button>
                    <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>{autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et</button>
                </div>
            </div>

            {/* Sekmeler */}
            <div className="pmh-tabs">
                {TABS.map(tab => (
                    <motion.button key={tab.key} className={`pmh-tab ${activeTab === tab.key ? "pmh-tab-active" : ""}`} onClick={() => setActiveTab(tab.key)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                        <span className="pmh-tab-icon">{tab.icon}</span>
                        <span className="pmh-tab-label">{tab.label}</span>
                        {tab.key === "logs" && unreadCount > 0 && <span style={{ background: "#8b5cf6", color: "#fff", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", marginLeft: "4px" }}>{unreadCount}</span>}
                    </motion.button>
                ))}
            </div>

            {/* İçerik */}
            <div className="pmh-body">
                <AnimatePresence mode="wait">
                    {activeTab === "dashboard" && renderDashboard()}
                    {activeTab === "products" && renderProducts()}
                    {activeTab === "pull-push" && renderPullPush()}
                    {activeTab === "pricing" && renderPricing()}
                    {activeTab === "comparison" && renderComparison()}
                    {activeTab === "categories" && renderCategories()}
                    {activeTab === "excel" && renderExcel()}
                    {activeTab === "logs" && renderLogs()}
                </AnimatePresence>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div className={`pmh-toast pmh-toast-${toast.type}`} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderRadius: "10px", maxWidth: "400px" }}>
                        {toast.type === "success" && <FaCheckCircle />}
                        {toast.type === "error" && <FaTimesCircle />}
                        {toast.type === "warning" && <FaExclamationTriangle />}
                        {toast.type === "info" && <FaInfoCircle />}
                        <span style={{ flex: 1 }}>{toast.msg}</span>
                        <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}><FaTimes /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stok Modal */}
            <AnimatePresence>
                {stockModal && (
                    <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStockModal(null)}>
                        <motion.div className="pmh-modal pmh-modal-md" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
                            <div className="pmh-modal-head">
                                <h2><FaWarehouse /> Stok Güncelle</h2>
                                <button className="pmh-modal-x" onClick={() => setStockModal(null)}><FaTimes /></button>
                            </div>
                            <div className="pmh-modal-body">
                                <div style={{ marginBottom: "1rem" }}><strong style={{ color: "#e8edf6" }}>{stockModal.product?.masterProduct?.name || stockModal.product?.name}</strong></div>
                                <div className="pmh-info-banner" style={{ marginBottom: "1rem" }}><FaInfoCircle style={{ color: "#4ecdc4" }} /><span>Stok güncellediğinizde tüm pazaryerleri otomatik güncellenir.</span></div>
                                <div style={{ marginBottom: "1rem" }}>
                                    <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.78rem", color: "#94a3b8" }}>Yeni Stok Adedi</label>
                                    <input type="number" value={stockValue} onChange={e => setStockValue(e.target.value)} min="0" style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem", boxSizing: "border-box" }} />
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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
                        <motion.div className="pmh-modal pmh-modal-md" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
                            <div className="pmh-modal-head">
                                <h2><FaMoneyBillWave /> Fiyat Güncelle</h2>
                                <button className="pmh-modal-x" onClick={() => setPriceModal(null)}><FaTimes /></button>
                            </div>
                            <div className="pmh-modal-body">
                                <div style={{ marginBottom: "1rem" }}><strong style={{ color: "#e8edf6" }}>{priceModal.product?.masterProduct?.name || priceModal.product?.name}</strong></div>
                                <div className="pmh-info-banner" style={{ marginBottom: "1rem" }}><FaInfoCircle style={{ color: "#4ecdc4" }} /><span>Fiyat güncellediğinizde tüm pazaryerleri otomatik güncellenir.</span></div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.78rem", color: "#94a3b8" }}>Satış Fiyatı (₺)</label>
                                        <input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} min="0" step="0.01" style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem", boxSizing: "border-box" }} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.78rem", color: "#94a3b8" }}>Liste Fiyatı (₺)</label>
                                        <input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} min="0" step="0.01" style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem", boxSizing: "border-box" }} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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
                        <motion.div className="pmh-modal pmh-modal-md" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}>
                            <div className="pmh-modal-head">
                                <h2><FaTrash /> Ürünü Sil</h2>
                                <button className="pmh-modal-x" onClick={() => setDeleteModal(null)}><FaTimes /></button>
                            </div>
                            <div className="pmh-modal-body">
                                <p style={{ color: "#e8edf6" }}>Bu ürünü silmek istediğinizden emin misiniz?</p>
                                <p><strong style={{ color: "#4ecdc4" }}>{deleteModal.masterProduct?.name || deleteModal.name}</strong></p>
                                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "0.75rem", marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontSize: "0.85rem" }}><FaExclamationTriangle /> Bu işlem geri alınamaz.</div>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
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
