/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 ÜRÜN YÖNETİM MERKEZİ — ProductManagementHub.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * ProductManagementPageV3'deki tüm özellikleri kapsayan tam entegrasyon.
 * 7 Sekme: Dashboard, Stok Takibi, Ürün Dağıtımı, Fiyat&Kampanya,
 *          Kategori Eşleştirme, Karşılaştırma, Loglar
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CategoryMappingPage from "./CategoryMappingPage";
import {
    FaBoxOpen, FaSearch, FaSync, FaStore, FaWarehouse,
    FaMoneyBillWave, FaChartBar, FaEdit, FaTimes, FaSave,
    FaChevronDown, FaChevronUp, FaSpinner, FaInfoCircle,
    FaFilter, FaEye, FaTag, FaPercent, FaLayerGroup,
    FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
    FaArrowUp, FaArrowDown, FaClipboardList, FaHistory, FaBox,
    FaBell, FaBarcode, FaBolt, FaTable, FaRocket, FaTags, FaPlus,
    FaCheck, FaCheckSquare, FaSquare, FaGlobe, FaExclamation,
    FaChevronRight, FaImage, FaArrowLeft, FaArrowRight, FaTrash
} from "react-icons/fa";
import {
    getProducts, syncAllMarketplaces, syncStock, syncPrice,
    getProductManagementDashboard, getSyncLogs, createProduct,
    updateProduct, deleteProduct, getComparisonMatrix,
    bulkDistributeSelected, getUnreadNotifications, markNotificationRead
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementHub.css";

/* ─── Sabitler ─────────────────────────────────────────────────────────────── */
const TABS = [
    { key: "dashboard",       icon: <FaChartBar />,      label: "Dashboard"            },
    { key: "stock",           icon: <FaWarehouse />,     label: "Stok Takibi"          },
    { key: "distribution",    icon: <FaExchangeAlt />,   label: "Ürün Dağıtımı"        },
    { key: "pricing",         icon: <FaMoneyBillWave />, label: "Fiyat & Kampanya"     },
    { key: "categorymapping", icon: <FaLayerGroup />,    label: "Kategori Eşleştirme"  },
    { key: "comparison",      icon: <FaTable />,         label: "Karşılaştırma"        },
    { key: "logs",            icon: <FaClipboardList />, label: "Loglar"               },
];

const MP_COLORS = {
    Trendyol: "#f27a1a", trendyol: "#f27a1a",
    Hepsiburada: "#ff6000", hepsiburada: "#ff6000",
    N11: "#6f3695", n11: "#6f3695",
    Amazon: "#ff9900", amazon: "#ff9900",
    ÇiçekSepeti: "#e91e8c", çiçeksepeti: "#e91e8c"
};
const mpColor = (name = "") =>
    MP_COLORS[name] || MP_COLORS[name?.toLowerCase()] || "#4ecdc4";

const fmt = (n) => {
    try {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency", currency: "TRY", maximumFractionDigits: 2
        }).format(n || 0);
    } catch { return `${(n || 0).toFixed(2)} ₺`; }
};
const fmtNum = (n) => new Intl.NumberFormat("tr-TR").format(n || 0);
const PAGE_SIZE = 20;

/* ─── Yardımcı Bileşenler ──────────────────────────────────────────────────── */
const StockBadge = ({ stock, threshold = 10 }) => {
    if (stock === 0)        return <span className="pmh-stock-pill pmh-stock-out">Stok Yok</span>;
    if (stock <= threshold) return <span className="pmh-stock-pill pmh-stock-low">Düşük Stok</span>;
    return                         <span className="pmh-stock-pill pmh-stock-ok">Stokta</span>;
};

const SyncBadge = ({ status }) => {
    const map = {
        synced:  ["pmh-synced",       "Senkron"],
        success: ["pmh-synced",       "Senkron"],
        error:   ["pmh-sync-err",     "Hata"],
        pending: ["pmh-sync-pending", "Bekliyor"],
    };
    const [cls, label] = map[status] || ["pmh-sync-pending", status || "—"];
    return <span className={`pmh-sync-pill ${cls}`}>{label}</span>;
};

const safeImg = (images) => {
    if (!images || !images.length) return null;
    const f = images[0];
    return typeof f === "string" ? f : f?.url || null;
};

const Spinner = () => <FaSpinner className="pmh-spin" />;

/* ─── Toast ────────────────────────────────────────────────────────────────── */
const Toast = ({ toasts, remove }) => (
    <div className="pmh-toast-wrap">
        <AnimatePresence>
            {toasts.map(t => (
                <motion.div key={t.id}
                    className={`pmh-toast pmh-toast-${t.type}`}
                    initial={{ opacity: 0, x: 80 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 80 }}>
                    <span className="pmh-toast-icon">
                        {t.type === "success" ? <FaCheckCircle />
                            : t.type === "error" ? <FaTimesCircle />
                            : <FaInfoCircle />}
                    </span>
                    <span className="pmh-toast-msg">{t.message}</span>
                    <button className="pmh-toast-close" onClick={() => remove(t.id)}>
                        <FaTimes />
                    </button>
                </motion.div>
            ))}
        </AnimatePresence>
    </div>
);

/* ─── Donut Chart ──────────────────────────────────────────────────────────── */
const DonutChart = ({ segments, size = 150, strokeWidth = 16, centerLabel, centerValue }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    let accumulated = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
            {segments.map((seg, i) => {
                const pct = seg.value / total;
                const dashLen = pct * circumference;
                const dashOffset = -accumulated * circumference + circumference * 0.25;
                accumulated += pct;
                return (
                    <circle key={i} cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke={seg.color} strokeWidth={strokeWidth}
                        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                        strokeDashoffset={dashOffset} strokeLinecap="round"
                        style={{ transition: "all 0.8s ease" }} />
                );
            })}
            <text x={size / 2} y={size / 2 - 5} textAnchor="middle"
                fill="#fff" fontSize="20" fontWeight="800">{centerValue}</text>
            <text x={size / 2} y={size / 2 + 13} textAnchor="middle"
                fill="#94a3b8" fontSize="9" fontWeight="500">{centerLabel}</text>
        </svg>
    );
};

/* ─── Yatay Bar Chart ──────────────────────────────────────────────────────── */
const HBarChart = ({ items, maxVal }) => {
    const max = maxVal || Math.max(...items.map(i => i.value), 1);
    return (
        <div className="pmh-hbar-chart">
            {items.map((item, i) => (
                <div key={item.label} className="pmh-hbar-row">
                    <div className="pmh-hbar-label">
                        <span className="pmh-hbar-dot" style={{ background: item.color }} />
                        <span>{item.label}</span>
                    </div>
                    <div className="pmh-hbar-track">
                        <motion.div className="pmh-hbar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                            transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                            style={{ background: `linear-gradient(90deg, ${item.color}, ${item.color}99)` }} />
                    </div>
                    <span className="pmh-hbar-val" style={{ color: item.color }}>
                        {fmtNum(item.value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

/* ─── Dikey Bar Chart ──────────────────────────────────────────────────────── */
const VBarChart = ({ items }) => {
    const max = Math.max(...items.map(i => i.value), 1);
    return (
        <div className="pmh-vbar-chart">
            {items.map((item, i) => (
                <div key={item.label} className="pmh-vbar-col">
                    <span className="pmh-vbar-val">{item.value}</span>
                    <div className="pmh-vbar-track">
                        <motion.div className="pmh-vbar-fill"
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max((item.value / max) * 100, 3)}%` }}
                            transition={{ delay: i * 0.07, duration: 0.5, ease: "easeOut" }}
                            style={{ background: `linear-gradient(0deg, ${item.color}60, ${item.color})` }} />
                    </div>
                    <span className="pmh-vbar-label">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════════════════════════ */
const ProductManagementHub = () => {
    const userId = localStorage.getItem("userId");

    /* ── Genel State ── */
    const [activeTab, setActiveTab]           = useState("dashboard");
    const [toast, setToast]                   = useState(null);
    const toastTimer                          = useRef(null);
    const [loading, setLoading]               = useState(false);
    const [autoSyncRunning, setAutoSyncRunning] = useState(false);
    const [autoSyncStatus, setAutoSyncStatus] = useState("");

    /* ── Dashboard ── */
    const [dashboard, setDashboard]           = useState(null);

    /* ── Ürünler (Stok & Fiyat sekmelerinde ortak) ── */
    const [products, setProducts]             = useState([]);
    const [totalProducts, setTotalProducts]   = useState(0);
    const [page, setPage]                     = useState(0);
    const [search, setSearch]                 = useState("");
    const [filterMP, setFilterMP]             = useState("");
    const [filterStock, setFilterStock]       = useState("");
    const [marketplaces, setMarketplaces]     = useState([]);

    /* ── Stok Modal ── */
    const [stockModal, setStockModal]         = useState(null);
    const [stockValue, setStockValue]         = useState("");
    const [stockThreshold, setStockThreshold] = useState("");

    /* ── Fiyat Modal ── */
    const [priceModal, setPriceModal]         = useState(null);
    const [salePrice, setSalePrice]           = useState("");
    const [listPrice, setListPrice]           = useState("");
    const [discountRate, setDiscountRate]     = useState("");

    /* ── Ürün Dağıtımı ── */
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkTargets, setBulkTargets]       = useState([]);
    const [distResult, setDistResult]         = useState(null);
    const [distDetailProduct, setDistDetailProduct] = useState(null);
    const [distSearch, setDistSearch]         = useState("");
    const [distFilterStatus, setDistFilterStatus] = useState("");
    const [distFilterMP, setDistFilterMP]     = useState("");

    /* ── Yeni Ürün Formu ── */
    const [showNewProductForm, setShowNewProductForm] = useState(false);
    const [newProduct, setNewProduct]         = useState({
        name: "", barcode: "", sku: "", description: "",
        price: "", listPrice: "", stock: "", category: "", brand: "",
        images: [""],
    });
    const [newProductTargets, setNewProductTargets] = useState([]);

    /* ── Karşılaştırma ── */
    const [compMatrix, setCompMatrix]         = useState([]);
    const [compTotal, setCompTotal]           = useState(0);
    const [compPage, setCompPage]             = useState(0);
    const [compSearch, setCompSearch]         = useState("");
    const [missingOnly, setMissingOnly]       = useState(false);
    const [compSummary, setCompSummary]       = useState(null);

    /* ── Silme onay ── */
    const [deleteModal, setDeleteModal]       = useState(null);

    /* ── Loglar & Bildirimler ── */
    const [logs, setLogs]                     = useState([]);
    const [notifications, setNotifications]   = useState([]);
    const [unreadCount, setUnreadCount]       = useState(0);

    /* ── Toplu Fiyat Güncelleme ── */
    const [bulkPriceMode, setBulkPriceMode]   = useState("fixed");
    const [bulkPriceValue, setBulkPriceValue] = useState("");
    const [bulkPriceTargets, setBulkPriceTargets] = useState([]);

    /* ── Toast ── */
    const showToast = useCallback((msg, type = "info") => {
        setToast({ msg, type });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4500);
    }, []);

    /* ── Veri Yükleme Fonksiyonları ── */
    const loadDashboard = useCallback(async () => {
        try {
            const res = await getProductManagementDashboard();
            if (res?.dashboard) setDashboard(res.dashboard);
        } catch { /* sessiz */ }
    }, []);

    const loadProducts = useCallback(async () => {
        try {
            const params = { page, limit: PAGE_SIZE };
            if (search)      params.search      = search;
            if (filterMP)    params.marketplace = filterMP;
            if (filterStock) params.stockStatus = filterStock;
            const res = await getProducts(params);
            setProducts(res.products || []);
            setTotalProducts(res.total || 0);
        } catch (e) {
            showToast("Ürünler yüklenemedi: " + (e.response?.data?.error || e.message), "error");
        }
    }, [page, search, filterMP, filterStock, showToast]);

    const loadMarketplaces = useCallback(async () => {
        try {
            const uid = localStorage.getItem("userId");
            if (!uid) return;
            const res = await getUserMarketplaces(uid);
            const list = Array.isArray(res) ? res : (res.marketplaces || res.data || []);
            setMarketplaces(list.map(m => ({ ...m, name: m.marketplaceName || m.name || "" })));
        } catch { /* sessiz */ }
    }, []);

    const loadComparison = useCallback(async () => {
        try {
            const params = { page: compPage, limit: PAGE_SIZE };
            if (compSearch)  params.search     = compSearch;
            if (missingOnly) params.missingOnly = "true";
            const res = await getComparisonMatrix(params);
            setCompMatrix(res.matrix || []);
            setCompTotal(res.total || 0);
            setCompSummary(res.summary || null);
        } catch (e) {
            showToast("Karşılaştırma yüklenemedi: " + (e.response?.data?.error || e.message), "error");
        }
    }, [compPage, compSearch, missingOnly, showToast]);

    const loadLogs = useCallback(async () => {
        try {
            const res = await getSyncLogs({ limit: 50 });
            setLogs(res.logs || []);
        } catch { /* sessiz */ }
    }, []);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await getUnreadNotifications();
            setNotifications(res.notifications || []);
            setUnreadCount(res.counts?.total || 0);
        } catch { /* sessiz */ }
    }, []);

    /* ── Otomatik Sync ── */
    const runAutoSync = useCallback(async () => {
        if (autoSyncRunning) return;
        setAutoSyncRunning(true);
        setAutoSyncStatus("⏳ Tüm pazaryerlerinden ürünler çekiliyor...");
        try {
            const res = await syncAllMarketplaces();
            const { totalNew = 0, totalUpdated = 0, totalErrors = 0 } = res.summary || {};
            setAutoSyncStatus(`✅ Tamamlandı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated} | Hata: ${totalErrors}`);
            showToast(`Senkronizasyon tamamlandı — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`, "success");
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            setAutoSyncStatus("❌ Hata: " + (e.response?.data?.error || e.message));
            showToast("Senkronizasyon başarısız: " + (e.response?.data?.error || e.message), "error");
        } finally {
            setAutoSyncRunning(false);
            setTimeout(() => setAutoSyncStatus(""), 6000);
        }
    }, [autoSyncRunning, showToast, loadProducts, loadDashboard, loadComparison]);

    /* ── İlk Yükleme ── */
    useEffect(() => {
        loadDashboard();
        loadMarketplaces();
        loadNotifications();
        loadProducts();
        setTimeout(() => runAutoSync(), 1200);
        const iv = setInterval(() => loadNotifications(), 15000);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { loadProducts(); }, [page, search, filterMP, filterStock]);

    useEffect(() => {
        if (activeTab === "logs")       { loadLogs(); loadNotifications(); }
        if (activeTab === "dashboard")  loadDashboard();
        if (activeTab === "comparison") loadComparison();
        if (activeTab === "stock" || activeTab === "pricing" || activeTab === "distribution") loadProducts();
    }, [activeTab]);

    useEffect(() => { loadComparison(); }, [compPage, compSearch, missingOnly]);

    /* ── Stok Güncelle ── */
    const handleSyncStock = async () => {
        if (!stockModal?.product) return;
        const val = parseInt(stockValue);
        if (isNaN(val) || val < 0) { showToast("Geçerli bir stok girin (0 veya üzeri)", "warning"); return; }
        setLoading(true);
        try {
            const priceUpd = listPrice ? { listPrice: parseFloat(listPrice) } : null;
            await syncStock(stockModal.product._id, val, priceUpd);
            showToast("✅ Stok tüm pazaryerlerinde güncellendi!", "success");
            setStockModal(null); setStockValue(""); setStockThreshold("");
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Stok güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    /* ── Fiyat Güncelle ── */
    const handleSyncPrice = async () => {
        if (!priceModal?.product) return;
        const sp = parseFloat(salePrice);
        if (isNaN(sp) || sp <= 0) { showToast("Geçerli bir satış fiyatı girin", "warning"); return; }
        setLoading(true);
        try {
            const lp = listPrice ? parseFloat(listPrice) : null;
            await syncPrice(priceModal.product._id, sp, lp);
            showToast("✅ Fiyat tüm pazaryerlerinde güncellendi!", "success");
            setPriceModal(null); setSalePrice(""); setListPrice(""); setDiscountRate("");
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Fiyat güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    /* ── Fiyat Hesaplama Yardımcıları ── */
    const calcDiscountRate = (sp, lp) => {
        if (!sp || !lp || parseFloat(lp) <= 0) return "";
        const rate = ((parseFloat(lp) - parseFloat(sp)) / parseFloat(lp) * 100).toFixed(1);
        return rate > 0 ? rate : "";
    };

    const applyDiscount = (lp, rate) => {
        if (!lp || !rate) return "";
        return (parseFloat(lp) * (1 - parseFloat(rate) / 100)).toFixed(2);
    };

    /* ── Toplu Fiyat Güncelleme ── */
    const handleBulkPriceUpdate = async () => {
        if (selectedProducts.length === 0) { showToast("En az bir ürün seçin", "warning"); return; }
        if (!bulkPriceValue) { showToast("Fiyat değeri girin", "warning"); return; }
        setLoading(true);
        let successCount = 0, errorCount = 0;
        try {
            for (const pid of selectedProducts) {
                const product = products.find(p => p._id === pid);
                if (!product) continue;
                const mp = product.masterProduct || product;
                let newPrice;
                if (bulkPriceMode === "fixed") {
                    newPrice = parseFloat(bulkPriceValue);
                } else if (bulkPriceMode === "percent") {
                    newPrice = parseFloat(mp.price || 0) * (1 - parseFloat(bulkPriceValue) / 100);
                } else if (bulkPriceMode === "margin") {
                    newPrice = parseFloat(mp.price || 0) * (1 + parseFloat(bulkPriceValue) / 100);
                }
                if (!newPrice || newPrice <= 0) continue;
                try {
                    await syncPrice(pid, parseFloat(newPrice.toFixed(2)));
                    successCount++;
                } catch { errorCount++; }
            }
            showToast(`✅ Toplu fiyat güncellendi — Başarılı: ${successCount}, Hata: ${errorCount}`, "success");
            setBulkPriceValue(""); setSelectedProducts([]);
            loadProducts(); loadDashboard();
        } catch (e) {
            showToast("Toplu fiyat güncellenemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    /* ── Ürün Sil ── */
    const handleDelete = async () => {
        if (!deleteModal) return;
        setLoading(true);
        try {
            await deleteProduct(deleteModal._id);
            showToast("✅ Ürün silindi", "success");
            setDeleteModal(null);
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Ürün silinemedi: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    /* ── Toplu Dağıtım ── */
    const handleBulkDistribute = async () => {
        if (selectedProducts.length === 0) { showToast("En az bir ürün seçin", "warning"); return; }
        if (bulkTargets.length === 0)       { showToast("En az bir hedef pazaryeri seçin", "warning"); return; }
        setLoading(true);
        setDistResult(null);
        try {
            const res = await bulkDistributeSelected(selectedProducts, bulkTargets);
            const r = res.results || {};
            setDistResult(r);
            showToast(`✅ Dağıtım tamamlandı — Başarılı: ${r.success || 0}, Atlanan: ${r.skipped || 0}, Hata: ${r.error || 0}`, "success");
            setSelectedProducts([]); setBulkTargets([]);
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Toplu dağıtım başarısız: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    /* ── Yeni Ürün Oluştur ── */
    const handleCreateProduct = async () => {
        const { name, barcode, sku, price } = newProduct;
        if (!name || !barcode || !sku || !price) {
            showToast("Ad, barkod, SKU ve fiyat zorunludur", "warning"); return;
        }
        setLoading(true);
        try {
            const payload = {
                ...newProduct,
                price:     parseFloat(newProduct.price),
                listPrice: newProduct.listPrice ? parseFloat(newProduct.listPrice) : parseFloat(newProduct.price),
                stock:     parseInt(newProduct.stock) || 0,
                images:    newProduct.images.filter(Boolean).map(url => ({ url })),
                marketplaceMappings: newProductTargets.map(mpName => {
                    const mp = marketplaces.find(m => m.name === mpName);
                    return { marketplaceId: mp?._id, marketplaceName: mpName, syncStatus: "pending" };
                }),
            };
            await createProduct(payload);
            showToast("✅ Ürün oluşturuldu ve seçili pazaryerlerine dağıtıldı!", "success");
            setShowNewProductForm(false);
            setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] });
            setNewProductTargets([]);
            loadProducts(); loadDashboard(); loadComparison();
        } catch (e) {
            showToast("Ürün oluşturulamadı: " + (e.response?.data?.error || e.message), "error");
        } finally { setLoading(false); }
    };

    /* ── Seçim Yardımcıları ── */
    const toggleProduct = (id) =>
        setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const toggleAllProducts = () =>
        setSelectedProducts(selectedProducts.length === products.length ? [] : products.map(p => p._id));

    const toggleTarget = (name) =>
        setBulkTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    const toggleNewProductTarget = (name) =>
        setNewProductTargets(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

    /* ── Dağıtım Yardımcıları ── */
    const getProductSyncStatus = (product, mpName) => {
        const m = (product.marketplaceMappings || []).find(
            x => (x.marketplaceName || "").toLowerCase() === (mpName || "").toLowerCase()
        );
        return m?.syncStatus || null;
    };

    const getProductMPs = (product) =>
        (product.marketplaceMappings || []).map(m => m.marketplaceName).filter(Boolean);

    const getMissingMPs = (product) =>
        marketplaces.map(m => m.name).filter(
            mpName => !getProductMPs(product).includes(mpName)
        );

    /* ── Bildirim ── */
    const handleMarkRead = async (id) => {
        try { await markNotificationRead(id); loadNotifications(); } catch { /* sessiz */ }
    };
    const handleMarkAllRead = async () => {
        try { await markNotificationRead("all"); loadNotifications(); showToast("Tüm bildirimler okundu ✅", "success"); } catch { /* sessiz */ }
    };

    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Özet Kartları
       ══════════════════════════════════════════════════════════════════════════ */
    const renderStatCards = () => {
        const cards = [
            { label: "Toplam Ürün",  value: fmtNum(stats.totalProducts),  icon: "📦", color: "#4ecdc4", sub: `${fmtNum(stats.activeProducts)} aktif` },
            { label: "Stokta Yok",   value: fmtNum(stats.outOfStock),      icon: "🚫", color: stats.outOfStock  > 0 ? "#ef4444" : "#22c55e", sub: stats.outOfStock  > 0 ? "Acil aksiyon" : "Sorun yok ✓" },
            { label: "Düşük Stok",   value: fmtNum(stats.lowStock),        icon: "⚠️", color: stats.lowStock    > 0 ? "#f59e0b" : "#22c55e", sub: "10 adetten az" },
            { label: "Fiyat Farkı",  value: fmtNum(stats.priceMismatch),   icon: "💰", color: stats.priceMismatch > 0 ? "#f59e0b" : "#22c55e", sub: "Platformlar arası" },
            { label: "Stok Farkı",   value: fmtNum(stats.stockMismatch),   icon: "📊", color: stats.stockMismatch > 0 ? "#ef4444" : "#22c55e", sub: "Platformlar arası" },
            { label: "Pazaryeri",    value: stats.marketplaceCount,         icon: "🏪", color: "#8b5cf6", sub: "Aktif entegrasyon" },
        ];
        return (
            <div className="pmh-stats-row">
                {cards.map((c, i) => (
                    <motion.div key={c.label} className="pmh-stat-card"
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}>
                        <div className="pmh-stat-icon"
                            style={{ background: `${c.color}18`, color: c.color }}>
                            {c.icon}
                        </div>
                        <div className="pmh-stat-body">
                            <span className="pmh-stat-label">{c.label}</span>
                            <span className="pmh-stat-value" style={{ color: c.color }}>{c.value}</span>
                            <span className="pmh-stat-sub">{c.sub}</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Ürün Kataloğu
       ══════════════════════════════════════════════════════════════════════════ */
    const renderCatalog = () => (
        <div className="pmh-section">
            {/* Toolbar */}
            <div className="pmh-toolbar">
                <div className="pmh-search-box">
                    <FaSearch className="pmh-search-icon" />
                    <input type="text"
                        placeholder="Ürün adı, SKU veya barkod ile ara..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="pmh-search-input" />
                    {searchQuery && (
                        <button className="pmh-search-clear" onClick={() => setSearchQuery("")}>
                            <FaTimes />
                        </button>
                    )}
                </div>
                <div className="pmh-toolbar-right">
                    <button className="pmh-btn pmh-btn-outline"
                        onClick={() => setShowFilters(!showFilters)}>
                        <FaFilter /> Filtreler {showFilters ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                    <button className="pmh-btn pmh-btn-primary"
                        onClick={handleSyncAll} disabled={syncing}>
                        {syncing ? <FaSpinner className="pmh-spin" /> : <FaSync />}
                        {syncing ? "Senkronize ediliyor..." : "Tümünü Senkronize Et"}
                    </button>
                </div>
            </div>

            {/* Filtreler */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div className="pmh-filter-panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}>
                        <div className="pmh-filter-row">
                            <div className="pmh-filter-group">
                                <label>Pazaryeri</label>
                                <select value={filterMarketplace}
                                    onChange={e => { setFilterMarketplace(e.target.value); setCurrentPage(1); }}>
                                    <option value="all">Tüm Pazaryerleri</option>
                                    {marketplaces.map(mp =>
                                        <option key={mp._id} value={mp.name}>{mp.name}</option>
                                    )}
                                </select>
                            </div>
                            <div className="pmh-filter-group">
                                <label>Stok Durumu</label>
                                <select value={filterStock}
                                    onChange={e => { setFilterStock(e.target.value); setCurrentPage(1); }}>
                                    <option value="all">Tümü</option>
                                    <option value="inStock">Stokta</option>
                                    <option value="lowStock">Düşük Stok</option>
                                    <option value="outOfStock">Stok Yok</option>
                                </select>
                            </div>
                            <button className="pmh-btn pmh-btn-ghost"
                                onClick={() => {
                                    setFilterMarketplace("all");
                                    setFilterStock("all");
                                    setSearchQuery("");
                                    setCurrentPage(1);
                                }}>
                                <FaTimes /> Temizle
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sonuç Bilgisi */}
            <div className="pmh-result-bar">
                <span>Toplam <strong>{fmtNum(totalProducts)}</strong> ürün</span>
                <span>Sayfa {currentPage} / {totalPages}</span>
            </div>

            {/* Tablo */}
            {loading ? (
                <div className="pmh-center-msg">
                    <FaSpinner className="pmh-spin" style={{ fontSize: "2rem", color: "#4ecdc4" }} />
                    <p>Ürünler yükleniyor...</p>
                </div>
            ) : products.length === 0 ? (
                <div className="pmh-center-msg">
                    <span style={{ fontSize: "3rem" }}>📭</span>
                    <h3>Ürün bulunamadı</h3>
                    <p>Arama kriterlerinizi değiştirin veya pazaryerlerinden senkronize edin.</p>
                    <button className="pmh-btn pmh-btn-primary" onClick={handleSyncAll}>
                        <FaSync /> Pazaryerlerinden Çek
                    </button>
                </div>
            ) : (
                <div className="pmh-table-wrap">
                    <table className="pmh-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: 48 }}>Görsel</th>
                                <th>Ürün Adı</th>
                                <th>SKU / Barkod</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                <th>Platformlar</th>
                                <th>Durum</th>
                                <th style={{ width: 90 }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product, idx) => {
                                const img = product.images?.[0]?.url || product.images?.[0] || product.imageUrl || null;
                                const stock = product.stock ?? product.quantity ?? 0;
                                const price = product.price || product.salePrice || 0;
                                const platforms = product.marketplaceData
                                    ? Object.keys(product.marketplaceData)
                                    : product.marketplaces || [];
                                const stockCls = stock === 0 ? "pmh-stock-out"
                                    : stock < 10 ? "pmh-stock-low" : "pmh-stock-ok";
                                return (
                                    <motion.tr key={product._id || product.id || idx}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.012 }}
                                        className="pmh-tr">
                                        <td className="pmh-td-num">
                                            {(currentPage - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td>
                                            <div className="pmh-thumb">
                                                {img ? <img src={img} alt="" /> : <FaBoxOpen />}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="pmh-cell-col">
                                                <span className="pmh-cell-title">
                                                    {product.title || product.name || "İsimsiz Ürün"}
                                                </span>
                                                {product.brand && (
                                                    <span className="pmh-cell-sub">{product.brand}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="pmh-cell-col">
                                                <span className="pmh-cell-mono">
                                                    {product.sku || product.stockCode || "—"}
                                                </span>
                                                {product.barcode && (
                                                    <span className="pmh-cell-sub">{product.barcode}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="pmh-price-main">{fmt(price)}</span>
                                            {product.listPrice && product.listPrice > price && (
                                                <span className="pmh-price-old">{fmt(product.listPrice)}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`pmh-stock-pill ${stockCls}`}>
                                                {stock === 0 ? "Yok"
                                                    : stock < 10 ? `${stock} (Az)`
                                                    : fmtNum(stock)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="pmh-platform-dots">
                                                {platforms.length > 0
                                                    ? platforms.map(p => (
                                                        <span key={p} className="pmh-platform-dot"
                                                            style={{ background: mpColor(p) }}
                                                            title={p}>
                                                            {p.charAt(0).toUpperCase()}
                                                        </span>
                                                    ))
                                                    : <span className="pmh-cell-sub">—</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`pmh-sync-pill ${
                                                product.syncStatus === "synced" ? "pmh-synced"
                                                : product.syncStatus === "error" ? "pmh-sync-err"
                                                : "pmh-sync-pending"}`}>
                                                {product.syncStatus === "synced" ? "✓ Senkron"
                                                    : product.syncStatus === "error" ? "✗ Hata"
                                                    : "⏳ Bekliyor"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="pmh-actions">
                                                <button className="pmh-act-btn pmh-act-edit"
                                                    title="Fiyat & Stok Düzenle"
                                                    onClick={() => openPriceEditor(product)}>
                                                    <FaEdit />
                                                </button>
                                                <button className="pmh-act-btn pmh-act-view"
                                                    title="Detay"
                                                    onClick={() => setDetailProduct(product)}>
                                                    <FaEye />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sayfalama */}
            {totalPages > 1 && (
                <div className="pmh-pagination">
                    <button className="pmh-pg-btn"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                        ← Önceki
                    </button>
                    <div className="pmh-pg-nums">
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            let page;
                            if (totalPages <= 7) page = i + 1;
                            else if (currentPage <= 4) page = i + 1;
                            else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                            else page = currentPage - 3 + i;
                            return (
                                <button key={page}
                                    className={`pmh-pg-num ${currentPage === page ? "active" : ""}`}
                                    onClick={() => setCurrentPage(page)}>
                                    {page}
                                </button>
                            );
                        })}
                    </div>
                    <button className="pmh-pg-btn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                        Sonraki →
                    </button>
                </div>
            )}
        </div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Fiyat & Stok Matrisi
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPricing = () => (
        <div className="pmh-section">
            <div className="pmh-info-banner">
                <div className="pmh-info-icon-wrap">💡</div>
                <div className="pmh-info-text">
                    <h3>Platform Bazlı Fiyat & Stok Yönetimi</h3>
                    <p>Her ürün için farklı platformlarda farklı fiyat belirleyebilirsiniz.
                        Örneğin: Trendyol'da <strong>100₺</strong>, N11'de <strong>120₺</strong>.
                        Satır sonundaki <strong>düzenle</strong> butonuna tıklayın.</p>
                </div>
            </div>

            <div className="pmh-toolbar" style={{ marginBottom: "1rem" }}>
                <div className="pmh-search-box">
                    <FaSearch className="pmh-search-icon" />
                    <input type="text" placeholder="Ürün ara..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="pmh-search-input" />
                </div>
            </div>

            {loading ? (
                <div className="pmh-center-msg">
                    <FaSpinner className="pmh-spin" style={{ fontSize: "2rem", color: "#4ecdc4" }} />
                    <p>Yükleniyor...</p>
                </div>
            ) : (
                <div className="pmh-table-wrap">
                    <table className="pmh-table pmh-price-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: 170 }}>Ürün</th>
                                <th>Ana Fiyat</th>
                                <th>Stok</th>
                                {marketplaces.map(mp => (
                                    <th key={mp._id} style={{ minWidth: 140 }}>
                                        <div className="pmh-mp-th">
                                            <span className="pmh-mp-dot-sm"
                                                style={{ background: mpColor(mp.name) }} />
                                            {mp.name}
                                        </div>
                                    </th>
                                ))}
                                <th style={{ width: 60 }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product, idx) => {
                                const mpData = product.marketplaceData || {};
                                const basePrice = product.price || product.salePrice || 0;
                                const stock = product.stock ?? product.quantity ?? 0;
                                return (
                                    <tr key={product._id || idx} className="pmh-tr">
                                        <td>
                                            <div className="pmh-cell-col">
                                                <span className="pmh-cell-title">
                                                    {product.title || product.name || "İsimsiz"}
                                                </span>
                                                <span className="pmh-cell-mono">
                                                    {product.sku || "—"}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="pmh-price-main">{fmt(basePrice)}</span>
                                        </td>
                                        <td>
                                            <span className={`pmh-stock-pill ${
                                                stock === 0 ? "pmh-stock-out"
                                                : stock < 10 ? "pmh-stock-low"
                                                : "pmh-stock-ok"}`}>
                                                {fmtNum(stock)}
                                            </span>
                                        </td>
                                        {marketplaces.map(mp => {
                                            const data = mpData[mp.name] || {};
                                            const mpPrice = data.salePrice || data.price || null;
                                            const mpStock = data.stock ?? data.quantity ?? null;
                                            const diff = mpPrice && basePrice
                                                ? ((mpPrice - basePrice) / basePrice * 100).toFixed(1)
                                                : null;
                                            return (
                                                <td key={mp._id}>
                                                    {mpPrice !== null ? (
                                                        <div className="pmh-mp-cell">
                                                            <span className="pmh-mp-price">
                                                                {fmt(mpPrice)}
                                                            </span>
                                                            {diff !== null && diff !== "0.0" && (
                                                                <span className={`pmh-mp-diff ${parseFloat(diff) > 0 ? "up" : "down"}`}>
                                                                    {parseFloat(diff) > 0 ? <FaArrowUp /> : <FaArrowDown />}
                                                                    {Math.abs(parseFloat(diff))}%
                                                                </span>
                                                            )}
                                                            {mpStock !== null && (
                                                                <span className="pmh-mp-stock-sm">
                                                                    Stok: {mpStock}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="pmh-cell-sub"
                                                            style={{ fontStyle: "italic" }}>
                                                            Yüklenmedi
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td>
                                            <button className="pmh-act-btn pmh-act-edit"
                                                onClick={() => openPriceEditor(product)}
                                                title="Fiyat Düzenle">
                                                <FaEdit />
                                            </button>
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
                    <button className="pmh-pg-btn"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                        ← Önceki
                    </button>
                    <span className="pmh-pg-info">Sayfa {currentPage} / {totalPages}</span>
                    <button className="pmh-pg-btn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                        Sonraki →
                    </button>
                </div>
            )}
        </div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Analitik
       ══════════════════════════════════════════════════════════════════════════ */
    const renderAnalytics = () => {
        const platformData = marketplaces.map(mp => ({
            label: mp.name,
            value: products.filter(p =>
                p.marketplaceData?.[mp.name] || p.marketplaces?.includes(mp.name)
            ).length,
            color: mpColor(mp.name)
        }));

        const stockDist = {
            inStock:    products.filter(p => (p.stock ?? p.quantity ?? 0) >= 10).length,
            lowStock:   products.filter(p => { const s = p.stock ?? p.quantity ?? 0; return s > 0 && s < 10; }).length,
            outOfStock: products.filter(p => (p.stock ?? p.quantity ?? 0) === 0).length
        };
        const totalStockItems = stockDist.inStock + stockDist.lowStock + stockDist.outOfStock || 1;

        const priceRanges = [
            { label: "0-50₺",    min: 0,    max: 50,       color: "#4ecdc4" },
            { label: "50-100₺",  min: 50,   max: 100,      color: "#10b981" },
            { label: "100-250₺", min: 100,  max: 250,      color: "#8b5cf6" },
            { label: "250-500₺", min: 250,  max: 500,      color: "#f59e0b" },
            { label: "500-1K₺",  min: 500,  max: 1000,     color: "#ec4899" },
            { label: "1K₺+",     min: 1000, max: Infinity, color: "#ef4444" }
        ].map(r => ({
            ...r,
            value: products.filter(p => {
                const pr = p.price || p.salePrice || 0;
                return pr >= r.min && pr < r.max;
            }).length
        }));

        const mpPerf = marketplaces.map(mp => {
            const mpProds = products.filter(p =>
                p.marketplaceData?.[mp.name] || p.marketplaces?.includes(mp.name)
            );
            const avgPrice = mpProds.length > 0
                ? mpProds.reduce((s, p) =>
                    s + (p.marketplaceData?.[mp.name]?.salePrice || p.price || 0), 0
                ) / mpProds.length : 0;
            const totalStock = mpProds.reduce((s, p) =>
                s + (p.marketplaceData?.[mp.name]?.stock ?? p.stock ?? 0), 0);
            const oos = mpProds.filter(p =>
                (p.marketplaceData?.[mp.name]?.stock ?? p.stock ?? 0) === 0
            ).length;
            return { name: mp.name, count: mpProds.length, avgPrice, totalStock, outOfStock: oos, color: mpColor(mp.name) };
        });

        return (
            <div className="pmh-section">
                {renderStatCards()}
                <div className="pmh-chart-grid">
                    {/* Platform Dağılımı */}
                    <motion.div className="pmh-chart-card"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="pmh-chart-head">
                            <h3><FaStore /> Platform Bazlı Ürün Dağılımı</h3>
                            <p>Her platformdaki ürün sayısını karşılaştırın</p>
                        </div>
                        {platformData.length > 0
                            ? <HBarChart items={platformData} />
                            : <div className="pmh-center-msg"><p>Platform verisi yok</p></div>}
                    </motion.div>

                    {/* Stok Donut */}
                    <motion.div className="pmh-chart-card"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}>
                        <div className="pmh-chart-head">
                            <h3><FaWarehouse /> Stok Durumu Dağılımı</h3>
                            <p>Ürünlerin stok sağlığı genel görünümü</p>
                        </div>
                        <div className="pmh-donut-area">
                            <DonutChart
                                segments={[
                                    { value: stockDist.inStock,    color: "#22c55e" },
                                    { value: stockDist.lowStock,   color: "#f59e0b" },
                                    { value: stockDist.outOfStock, color: "#ef4444" }
                                ]}
                                centerValue={products.length}
                                centerLabel="Toplam Ürün" />
                            <div className="pmh-donut-legend">
                                {[
                                    { label: "Stokta (≥10)",    value: stockDist.inStock,    color: "#22c55e" },
                                    { label: "Düşük Stok (<10)", value: stockDist.lowStock,   color: "#f59e0b" },
                                    { label: "Stok Yok (0)",    value: stockDist.outOfStock, color: "#ef4444" }
                                ].map(item => (
                                    <div key={item.label} className="pmh-legend-row">
                                        <span className="pmh-legend-dot"
                                            style={{ background: item.color }} />
                                        <span className="pmh-legend-label">{item.label}</span>
                                        <strong className="pmh-legend-val">{item.value}</strong>
                                        <span className="pmh-legend-pct">
                                            %{(item.value / totalStockItems * 100).toFixed(0)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Fiyat Dağılımı */}
                    <motion.div className="pmh-chart-card pmh-chart-wide"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}>
                        <div className="pmh-chart-head">
                            <h3><FaTag /> Fiyat Aralığı Dağılımı</h3>
                            <p>Ürünlerin fiyat segmentasyonu — hangi aralıkta kaç ürün var</p>
                        </div>
                        <VBarChart items={priceRanges} />
                    </motion.div>

                    {/* Platform Performans */}
                    <motion.div className="pmh-chart-card pmh-chart-wide"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}>
                        <div className="pmh-chart-head">
                            <h3><FaChartBar /> Platform Performans Karşılaştırması</h3>
                            <p>Platformlar arası ürün, fiyat ve stok metrikleri</p>
                        </div>
                        <div className="pmh-perf-grid">
                            {mpPerf.map((mp, i) => (
                                <motion.div key={mp.name} className="pmh-perf-card"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.35 + i * 0.08 }}
                                    style={{ borderLeftColor: mp.color }}>
                                    <div className="pmh-perf-head">
                                        <span className="pmh-perf-dot"
                                            style={{ background: mp.color }} />
                                        <h4>{mp.name}</h4>
                                    </div>
                                    <div className="pmh-perf-metrics">
                                        <div className="pmh-perf-m">
                                            <span className="pmh-perf-ml">Ürün Sayısı</span>
                                            <span className="pmh-perf-mv">{fmtNum(mp.count)}</span>
                                        </div>
                                        <div className="pmh-perf-m">
                                            <span className="pmh-perf-ml">Ort. Fiyat</span>
                                            <span className="pmh-perf-mv">{fmt(mp.avgPrice)}</span>
                                        </div>
                                        <div className="pmh-perf-m">
                                            <span className="pmh-perf-ml">Toplam Stok</span>
                                            <span className="pmh-perf-mv">{fmtNum(mp.totalStock)}</span>
                                        </div>
                                        <div className="pmh-perf-m">
                                            <span className="pmh-perf-ml">Stok Yok</span>
                                            <span className="pmh-perf-mv"
                                                style={{ color: mp.outOfStock > 0 ? "#ef4444" : "#22c55e" }}>
                                                {mp.outOfStock}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Senkronizasyon
       ══════════════════════════════════════════════════════════════════════════ */
    const renderSync = () => (
        <div className="pmh-section">
            <div className="pmh-section-head">
                <h2><FaExchangeAlt /> Senkronizasyon Merkezi</h2>
                <p>Tüm platformlarla ürün, fiyat ve stok senkronizasyonunu yönetin</p>
            </div>

            <div className="pmh-sync-cards">
                <motion.button className="pmh-sync-card"
                    whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                    onClick={handleSyncAll} disabled={syncing}>
                    <div className="pmh-sync-card-icon"
                        style={{ background: "linear-gradient(135deg, #4ecdc4, #44a08d)" }}>
                        {syncing ? <FaSpinner className="pmh-spin" /> : <FaSync />}
                    </div>
                    <h4>Tümünü Senkronize Et</h4>
                    <p>Tüm pazaryerlerinden ürünleri çek ve güncelle</p>
                </motion.button>

                {marketplaces.map(mp => (
                    <motion.div key={mp._id} className="pmh-sync-card" whileHover={{ y: -3 }}>
                        <div className="pmh-sync-card-icon"
                            style={{ background: mpColor(mp.name) }}>
                            <FaStore />
                        </div>
                        <h4>{mp.name}</h4>
                        <p>Son senkron: {mp.lastSync
                            ? new Date(mp.lastSync).toLocaleString("tr-TR")
                            : "Henüz yapılmadı"}</p>
                        <div className="pmh-sync-status-row">
                            <span className="pmh-sync-status-dot"
                                style={{ background: mp.syncStatus === "error" ? "#ef4444" : "#22c55e" }} />
                            <span>{mp.syncStatus === "error" ? "Hata" : "Bağlı"}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="pmh-sync-log-box">
                <h3><FaClipboardList /> Son Senkronizasyon İşlemleri</h3>
                {syncLogs.length > 0 ? (
                    <div className="pmh-log-list">
                        {syncLogs.slice(0, 15).map((log, idx) => (
                            <div key={log._id || idx} className="pmh-log-row">
                                <span className={`pmh-log-icon ${
                                    log.status === "success" ? "ok"
                                    : log.status === "error" ? "err" : "warn"}`}>
                                    {log.status === "success" ? <FaCheckCircle />
                                        : log.status === "error" ? <FaTimesCircle />
                                        : <FaExclamationTriangle />}
                                </span>
                                <span className="pmh-log-type">{log.type || log.action || "Senkron"}</span>
                                <span className="pmh-log-mp">{log.marketplace || "—"}</span>
                                <span className="pmh-log-msg">{log.message || log.details || "—"}</span>
                                <span className="pmh-log-time">
                                    {log.createdAt
                                        ? new Date(log.createdAt).toLocaleString("tr-TR")
                                        : "—"}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="pmh-center-msg">
                        <FaInfoCircle /> Henüz senkronizasyon kaydı yok
                    </div>
                )}
            </div>
        </div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: İşlem Geçmişi
       ══════════════════════════════════════════════════════════════════════════ */
    const renderLogs = () => (
        <div className="pmh-section">
            <div className="pmh-section-head">
                <h2><FaHistory /> İşlem Geçmişi</h2>
                <p>Tüm fiyat, stok ve senkronizasyon işlemlerinin detaylı kaydı</p>
            </div>
            {syncLogs.length > 0 ? (
                <div className="pmh-table-wrap">
                    <table className="pmh-table">
                        <thead>
                            <tr>
                                <th>Durum</th>
                                <th>İşlem Tipi</th>
                                <th>Pazaryeri</th>
                                <th>Detay</th>
                                <th>Ürün</th>
                                <th>Tarih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {syncLogs.map((log, idx) => (
                                <tr key={log._id || idx} className="pmh-tr">
                                    <td>
                                        <span className={`pmh-sync-pill ${
                                            log.status === "success" ? "pmh-synced"
                                            : log.status === "error" ? "pmh-sync-err"
                                            : "pmh-sync-pending"}`}>
                                            {log.status === "success" ? "✓ Başarılı"
                                                : log.status === "error" ? "✗ Hata"
                                                : "⏳ Bekliyor"}
                                        </span>
                                    </td>
                                    <td>{log.type || log.action || "—"}</td>
                                    <td>
                                        {log.marketplace ? (
                                            <span className="pmh-mp-tag"
                                                style={{ borderColor: mpColor(log.marketplace) }}>
                                                <span className="pmh-mp-dot-sm"
                                                    style={{ background: mpColor(log.marketplace) }} />
                                                {log.marketplace}
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td className="pmh-td-ellipsis">
                                        {log.message || log.details || "—"}
                                    </td>
                                    <td>{log.productTitle || log.sku || "—"}</td>
                                    <td className="pmh-td-mono">
                                        {log.createdAt
                                            ? new Date(log.createdAt).toLocaleString("tr-TR")
                                            : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="pmh-center-msg">
                    <span style={{ fontSize: "3rem" }}>📋</span>
                    <h3>Henüz işlem kaydı yok</h3>
                    <p>Fiyat, stok veya senkronizasyon işlemi yaptığınızda burada görünecektir.</p>
                </div>
            )}
        </div>
    );

    /* ══════════════════════════════════════════════════════════════════════════
       MODAL: Platform Fiyat Düzenleme
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPriceModal = () => {
        if (!editingProduct) return null;
        const basePrice     = editingProduct.price || editingProduct.salePrice || 0;
        const baseListPrice = editingProduct.listPrice || basePrice;
        const baseStock     = editingProduct.stock ?? editingProduct.quantity ?? 0;

        return (
            <AnimatePresence>
                <motion.div className="pmh-overlay"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setEditingProduct(null)}>
                    <motion.div className="pmh-modal pmh-modal-lg"
                        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.92, y: 30 }}
                        onClick={e => e.stopPropagation()}>

                        {/* Başlık */}
                        <div className="pmh-modal-head">
                            <div>
                                <h2><FaMoneyBillWave /> Platform Bazlı Fiyat & Stok</h2>
                                <p>{editingProduct.title || editingProduct.name || "Ürün"}
                                    {" — SKU: "}{editingProduct.sku || "—"}</p>
                            </div>
                            <button className="pmh-modal-x" onClick={() => setEditingProduct(null)}>
                                <FaTimes />
                            </button>
                        </div>

                        {/* Mevcut Değerler */}
                        <div className="pmh-modal-info-row">
                            <div className="pmh-modal-info-item">
                                <span className="pmh-modal-info-l">Ana Satış Fiyatı</span>
                                <span className="pmh-modal-info-v">{fmt(basePrice)}</span>
                            </div>
                            <div className="pmh-modal-info-item">
                                <span className="pmh-modal-info-l">Liste Fiyatı</span>
                                <span className="pmh-modal-info-v">{fmt(baseListPrice)}</span>
                            </div>
                            <div className="pmh-modal-info-item">
                                <span className="pmh-modal-info-l">Mevcut Stok</span>
                                <span className="pmh-modal-info-v">{fmtNum(baseStock)}</span>
                            </div>
                        </div>

                        {/* Toplu İşlem */}
                        <div className="pmh-modal-bulk-row">
                            <span className="pmh-modal-bulk-label">Toplu İşlem:</span>
                            <button className="pmh-quick-btn"
                                onClick={() => applyToAllPlatforms("salePrice", basePrice)}>
                                Tümüne Ana Fiyat
                            </button>
                            <button className="pmh-quick-btn"
                                onClick={() => applyToAllPlatforms("salePrice", (basePrice * 1.1).toFixed(2))}>
                                Tümüne +10%
                            </button>
                            <button className="pmh-quick-btn"
                                onClick={() => applyToAllPlatforms("salePrice", (basePrice * 0.9).toFixed(2))}>
                                Tümüne -10%
                            </button>
                            <button className="pmh-quick-btn"
                                onClick={() => applyStockToAll(baseStock)}>
                                Tümüne Ana Stok
                            </button>
                        </div>

                        {/* Platform Kartları */}
                        <div className="pmh-modal-body">
                            <div className="pmh-pe-grid">
                                {Object.entries(platformPrices).map(([mpName, priceData]) => {
                                    const stock = platformStocks[mpName] ?? 0;
                                    const diffSale = basePrice > 0
                                        ? ((priceData.salePrice - basePrice) / basePrice * 100).toFixed(1)
                                        : 0;
                                    return (
                                        <motion.div key={mpName} className="pmh-pe-card"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            style={{ borderLeftColor: mpColor(mpName) }}>
                                            <div className="pmh-pe-head">
                                                <span className="pmh-pe-dot"
                                                    style={{ background: mpColor(mpName) }} />
                                                <h4>{mpName}</h4>
                                                {diffSale !== "0.0" && parseFloat(diffSale) !== 0 && (
                                                    <span className={`pmh-pe-diff ${parseFloat(diffSale) > 0 ? "up" : "down"}`}>
                                                        {parseFloat(diffSale) > 0 ? "+" : ""}{diffSale}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pmh-pe-fields">
                                                <div className="pmh-pe-field">
                                                    <label>Satış Fiyatı (₺)</label>
                                                    <div className="pmh-pe-input-wrap">
                                                        <FaTag className="pmh-pe-input-icon" />
                                                        <input type="number" step="0.01" min="0"
                                                            value={priceData.salePrice}
                                                            onChange={e => handlePlatformPriceChange(mpName, "salePrice", e.target.value)}
                                                            className="pmh-pe-input" />
                                                    </div>
                                                </div>
                                                <div className="pmh-pe-field">
                                                    <label>Liste Fiyatı (₺)</label>
                                                    <div className="pmh-pe-input-wrap">
                                                        <FaPercent className="pmh-pe-input-icon" />
                                                        <input type="number" step="0.01" min="0"
                                                            value={priceData.listPrice}
                                                            onChange={e => handlePlatformPriceChange(mpName, "listPrice", e.target.value)}
                                                            className="pmh-pe-input" />
                                                    </div>
                                                </div>
                                                <div className="pmh-pe-field">
                                                    <label>Stok Adedi</label>
                                                    <div className="pmh-pe-input-wrap">
                                                        <FaWarehouse className="pmh-pe-input-icon" />
                                                        <input type="number" step="1" min="0"
                                                            value={stock}
                                                            onChange={e => handlePlatformStockChange(mpName, e.target.value)}
                                                            className="pmh-pe-input" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pmh-pe-quick">
                                                <button onClick={() => handlePlatformPriceChange(mpName, "salePrice", basePrice)}>
                                                    Ana Fiyat
                                                </button>
                                                <button onClick={() => handlePlatformPriceChange(mpName, "salePrice", (basePrice * 1.1).toFixed(2))}>
                                                    +10%
                                                </button>
                                                <button onClick={() => handlePlatformPriceChange(mpName, "salePrice", (basePrice * 1.2).toFixed(2))}>
                                                    +20%
                                                </button>
                                                <button onClick={() => handlePlatformPriceChange(mpName, "salePrice", (basePrice * 0.9).toFixed(2))}>
                                                    -10%
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pmh-modal-foot">
                            <button className="pmh-btn pmh-btn-ghost"
                                onClick={() => setEditingProduct(null)}>
                                <FaTimes /> İptal
                            </button>
                            <button className="pmh-btn pmh-btn-primary"
                                onClick={savePlatformPrices} disabled={savingPrices}>
                                {savingPrices ? <FaSpinner className="pmh-spin" /> : <FaSave />}
                                {savingPrices ? "Kaydediliyor..." : "Tüm Platformlara Kaydet"}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       MODAL: Ürün Detay
       ══════════════════════════════════════════════════════════════════════════ */
    const renderDetailModal = () => {
        if (!detailProduct) return null;
        const p = detailProduct;
        const img = p.images?.[0]?.url || p.images?.[0] || p.imageUrl || null;
        return (
            <AnimatePresence>
                <motion.div className="pmh-overlay"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setDetailProduct(null)}>
                    <motion.div className="pmh-modal pmh-modal-md"
                        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.92, y: 30 }}
                        onClick={e => e.stopPropagation()}>

                        <div className="pmh-modal-head">
                            <h2><FaEye /> Ürün Detayı</h2>
                            <button className="pmh-modal-x" onClick={() => setDetailProduct(null)}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className="pmh-modal-body">
                            <div className="pmh-detail-top">
                                {img && (
                                    <div className="pmh-detail-img">
                                        <img src={img} alt={p.title || ""} />
                                    </div>
                                )}
                                <div className="pmh-detail-info">
                                    <h3>{p.title || p.name || "İsimsiz Ürün"}</h3>
                                    {p.brand && (
                                        <span className="pmh-detail-brand">{p.brand}</span>
                                    )}
                                    <div className="pmh-detail-meta">
                                        <div><strong>SKU:</strong> {p.sku || p.stockCode || "—"}</div>
                                        <div><strong>Barkod:</strong> {p.barcode || "—"}</div>
                                        <div><strong>Kategori:</strong> {p.category || p.categoryName || "—"}</div>
                                        <div><strong>Fiyat:</strong> {fmt(p.price || p.salePrice || 0)}</div>
                                        <div><strong>Liste Fiyatı:</strong> {fmt(p.listPrice || 0)}</div>
                                        <div><strong>Stok:</strong> {fmtNum(p.stock ?? p.quantity ?? 0)}</div>
                                    </div>
                                </div>
                            </div>

                            {p.marketplaceData && Object.keys(p.marketplaceData).length > 0 && (
                                <div className="pmh-detail-platforms">
                                    <h4>Platform Bilgileri</h4>
                                    <div className="pmh-detail-mp-grid">
                                        {Object.entries(p.marketplaceData).map(([mp, data]) => (
                                            <div key={mp} className="pmh-detail-mp-card"
                                                style={{ borderLeftColor: mpColor(mp) }}>
                                                <div className="pmh-detail-mp-name">
                                                    <span className="pmh-mp-dot-sm"
                                                        style={{ background: mpColor(mp) }} />
                                                    {mp}
                                                </div>
                                                <div className="pmh-detail-mp-data">
                                                    <span>Fiyat: {fmt(data.salePrice || data.price || 0)}</span>
                                                    <span>Stok: {fmtNum(data.stock ?? data.quantity ?? 0)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {p.description && (
                                <div className="pmh-detail-desc">
                                    <h4>Açıklama</h4>
                                    <p>{p.description}</p>
                                </div>
                            )}
                        </div>

                        <div className="pmh-modal-foot">
                            <button className="pmh-btn pmh-btn-ghost"
                                onClick={() => setDetailProduct(null)}>
                                Kapat
                            </button>
                            <button className="pmh-btn pmh-btn-primary"
                                onClick={() => { setDetailProduct(null); openPriceEditor(p); }}>
                                <FaEdit /> Fiyat & Stok Düzenle
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       ANA RENDER
       ══════════════════════════════════════════════════════════════════════════ */
    return (
        <div className="pmh-root">
            <Toast toasts={toasts} remove={removeToast} />

            {/* ── Sayfa Başlığı ── */}
            <div className="pmh-page-header">
                <div className="pmh-page-header-left">
                    <div className="pmh-page-icon"><FaLayerGroup /></div>
                    <div>
                        <h1 className="pmh-page-title">Ürün Yönetim Merkezi</h1>
                        <p className="pmh-page-subtitle">
                            Katalog · Platform Bazlı Fiyat · Stok · Analitik · Senkronizasyon
                        </p>
                    </div>
                </div>
                <div className="pmh-page-badges">
                    {marketplaces.map(mp => (
                        <span key={mp._id} className="pmh-mp-badge"
                            style={{ borderColor: mpColor(mp.name) }}>
                            <span className="pmh-mp-dot-sm"
                                style={{ background: mpColor(mp.name) }} />
                            {mp.name}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Sekmeler ── */}
            <div className="pmh-tabs">
                {tabs.map(tab => (
                    <motion.button key={tab.id}
                        className={`pmh-tab ${activeTab === tab.id ? "pmh-tab-active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                        whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                        <span className="pmh-tab-icon">{tab.icon}</span>
                        <span className="pmh-tab-label">{tab.label}</span>
                    </motion.button>
                ))}
            </div>

            {/* ── Özet Kartları (analitik sekmesinde zaten içinde var) ── */}
            {activeTab !== "analytics" && renderStatCards()}

            {/* ── Sekme İçeriği ── */}
            <div className="pmh-body">
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: 0.18 }}>
                        {activeTab === "catalog"   && renderCatalog()}
                        {activeTab === "pricing"   && renderPricing()}
                        {activeTab === "analytics" && renderAnalytics()}
                        {activeTab === "sync"      && renderSync()}
                        {activeTab === "logs"      && renderLogs()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ── Modaller ── */}
            {editingProduct && renderPriceModal()}
            {detailProduct  && renderDetailModal()}
        </div>
    );
};

export default ProductManagementHub;
