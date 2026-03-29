/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 ÜRÜN YÖNETİM MERKEZİ — ProductManagementHub.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * 7 Sekme: Dashboard, Stok Takibi, Ürün Dağıtımı, Fiyat&Kampanya,
 *          Kategori Eşleştirme, Karşılaştırma, Loglar
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
    FaChevronRight, FaChevronDown, FaArrowLeft, FaArrowRight, FaTrash, FaTag, FaEye
} from "react-icons/fa";
import {
    getProducts, syncAllMarketplaces, syncStock, syncPrice,
    getProductManagementDashboard, getSyncLogs, createProduct,
    deleteProduct, getComparisonMatrix, bulkDistributeSelected,
    getUnreadNotifications, markNotificationRead
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
const ProductManagementHub = () => {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);
    const [loading, setLoading] = useState(false);
    const [autoSyncRunning, setAutoSyncRunning] = useState(false);
    const [autoSyncStatus, setAutoSyncStatus] = useState("");

    const [products, setProducts] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [filterMP, setFilterMP] = useState("");
    const [filterStock, setFilterStock] = useState("");
    const [marketplaces, setMarketplaces] = useState([]);

    const [stockModal, setStockModal] = useState(null);
    const [stockValue, setStockValue] = useState("");
    const [priceModal, setPriceModal] = useState(null);
    const [salePrice, setSalePrice] = useState("");
    const [listPrice, setListPrice] = useState("");
    const [discountRate, setDiscountRate] = useState("");

    const [selectedProducts, setSelectedProducts] = useState([]);
    const [bulkTargets, setBulkTargets] = useState([]);
    const [distResult, setDistResult] = useState(null);
    const [distDetailProduct, setDistDetailProduct] = useState(null);
    const [distSearch, setDistSearch] = useState("");
    const [distFilterStatus, setDistFilterStatus] = useState("");

    const [showNewProductForm, setShowNewProductForm] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] });
    const [newProductTargets, setNewProductTargets] = useState([]);

    const [compMatrix, setCompMatrix] = useState([]);
    const [compTotal, setCompTotal] = useState(0);
    const [compPage, setCompPage] = useState(0);
    const [compSearch, setCompSearch] = useState("");
    const [missingOnly, setMissingOnly] = useState(false);
    const [compSummary, setCompSummary] = useState(null);

    const [deleteModal, setDeleteModal] = useState(null);
    const [logs, setLogs] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [bulkPriceMode, setBulkPriceMode] = useState("fixed");
    const [bulkPriceValue, setBulkPriceValue] = useState("");

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
        } catch (e) { showToast("Ürünler yüklenemedi", "error"); }
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

    const runAutoSync = useCallback(async () => {
        if (autoSyncRunning) return;
        setAutoSyncRunning(true);
        setAutoSyncStatus("⏳ Tüm pazaryerlerinden ürünler çekiliyor...");
        try {
            const res = await syncAllMarketplaces();
            const { totalNew = 0, totalUpdated = 0 } = res.summary || {};
            setAutoSyncStatus(`✅ Tamamlandı — Yeni: ${totalNew} | Güncellenen: ${totalUpdated}`);
            showToast(`Senkronizasyon tamamlandı`, "success");
            loadProducts(); loadComparison();
        } catch (e) {
            setAutoSyncStatus("❌ Hata");
            showToast("Senkronizasyon başarısız", "error");
        } finally { setAutoSyncRunning(false); setTimeout(() => setAutoSyncStatus(""), 6000); }
    }, [autoSyncRunning, showToast, loadProducts, loadComparison]);

    useEffect(() => { loadMarketplaces(); loadNotifications(); loadProducts(); setTimeout(() => runAutoSync(), 1200); }, []);
    useEffect(() => { loadProducts(); }, [page, search, filterMP, filterStock]);
    useEffect(() => { if (activeTab === "logs") { loadLogs(); loadNotifications(); } if (activeTab === "comparison") loadComparison(); if (["stock", "pricing", "distribution"].includes(activeTab)) loadProducts(); }, [activeTab]);
    useEffect(() => { loadComparison(); }, [compPage, compSearch, missingOnly]);

    /* ── Aksiyonlar ── */
    const handleSyncStock = async () => {
        if (!stockModal?.product) return;
        const val = parseInt(stockValue);
        if (isNaN(val) || val < 0) { showToast("Geçerli stok girin", "warning"); return; }
        setLoading(true);
        try {
            await syncStock(stockModal.product._id, val);
            showToast("✅ Stok güncellendi!", "success");
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
            showToast("✅ Fiyat güncellendi!", "success");
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
        showToast(`✅ ${ok} başarılı, ${err} hata`, "success");
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
        if (!name || !barcode || !sku || !price) { showToast("Zorunlu alanları doldurun", "warning"); return; }
        setLoading(true);
        try {
            await createProduct({ ...newProduct, price: parseFloat(newProduct.price), listPrice: newProduct.listPrice ? parseFloat(newProduct.listPrice) : parseFloat(newProduct.price), stock: parseInt(newProduct.stock) || 0, images: newProduct.images.filter(Boolean).map(url => ({ url })), marketplaceMappings: newProductTargets.map(mpName => ({ marketplaceName: mpName, syncStatus: "pending" })) });
            showToast("Ürün oluşturuldu", "success");
            setShowNewProductForm(false); setNewProduct({ name: "", barcode: "", sku: "", description: "", price: "", listPrice: "", stock: "", category: "", brand: "", images: [""] }); setNewProductTargets([]); loadProducts();
        } catch { showToast("Oluşturulamadı", "error"); }
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

    const calcDiscountRate = (sp, lp) => { if (!sp || !lp || parseFloat(lp) <= 0) return ""; const r = ((parseFloat(lp) - parseFloat(sp)) / parseFloat(lp) * 100).toFixed(1); return r > 0 ? r : ""; };
    const applyDiscount = (lp, rate) => { if (!lp || !rate) return ""; return (parseFloat(lp) * (1 - parseFloat(rate) / 100)).toFixed(2); };

    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Dashboard
       ══════════════════════════════════════════════════════════════════════════ */
    const renderDashboard = () => {
        const total = products.length;
        const outOfStock = products.filter(p => (p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0) === 0).length;
        const lowStock = products.filter(p => { const s = p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0; return s > 0 && s <= 10; }).length;
        const synced = products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "synced")).length;
        const errors = products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "error")).length;
        const undist = products.filter(p => (p.marketplaceMappings || []).length === 0).length;
        const syncRate = total > 0 ? Math.round((synced / total) * 100) : 0;

        const cards = [
            { icon: "📦", label: "Toplam Ürün", value: total, sub: `${marketplaces.length} pazaryeri`, color: "#4ecdc4", onClick: () => setActiveTab("stock") },
            { icon: "✅", label: "Senkron", value: synced, sub: `%${syncRate}`, color: "#22c55e", onClick: () => setActiveTab("distribution") },
            { icon: "❌", label: "Hatalı", value: errors, sub: errors > 0 ? "Dikkat" : "OK", color: errors > 0 ? "#ef4444" : "#22c55e", onClick: () => { setActiveTab("distribution"); setDistFilterStatus("error"); } },
            { icon: "📉", label: "Stok Yok", value: outOfStock, sub: outOfStock > 0 ? "Acil" : "OK", color: outOfStock > 0 ? "#ef4444" : "#22c55e", onClick: () => { setActiveTab("stock"); setFilterStock("outOfStock"); } },
            { icon: "⚠️", label: "Düşük Stok", value: lowStock, color: lowStock > 0 ? "#f59e0b" : "#22c55e", onClick: () => { setActiveTab("stock"); setFilterStock("lowStock"); } },
            { icon: "🚀", label: "Dağıtılmamış", value: undist, color: undist > 0 ? "#8b5cf6" : "#22c55e", onClick: () => { setActiveTab("distribution"); setDistFilterStatus("missing"); } },
        ];

        return (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {autoSyncStatus && <div style={{ background: autoSyncRunning ? "rgba(78,205,196,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${autoSyncRunning ? "rgba(78,205,196,0.2)" : "rgba(34,197,94,0.2)"}`, borderRadius: "10px", padding: "10px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", color: autoSyncRunning ? "#4ecdc4" : "#22c55e", fontSize: "13px" }}>{autoSyncRunning && <Spinner />}<span>{autoSyncStatus}</span></div>}

                <div className="pmh-info-banner" style={{ marginBottom: "20px" }}>
                    <FaInfoCircle style={{ color: "#4ecdc4", flexShrink: 0, fontSize: "1.2rem" }} />
                    <div className="pmh-info-text"><span>Tüm sayılar <strong style={{ color: "#4ecdc4" }}>benzersiz ürün</strong> bazındadır. Kartlara tıklayarak ilgili sekmeye geçin.</span></div>
                </div>

                <div className="pmh-stats-row">
                    {cards.map((k, i) => (
                        <motion.div key={i} className="pmh-stat-card" onClick={k.onClick} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} style={{ cursor: "pointer", borderTop: `3px solid ${k.color}` }} whileHover={{ y: -4 }}>
                            <div className="pmh-stat-icon" style={{ background: `${k.color}18`, color: k.color }}>{k.icon}</div>
                            <div className="pmh-stat-body">
                                <span className="pmh-stat-label">{k.label}</span>
                                <span className="pmh-stat-value" style={{ color: k.color }}>{k.value}</span>
                                {k.sub && <span className="pmh-stat-sub">{k.sub}</span>}
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px", marginTop: "20px" }}>
                    <h3 style={{ margin: "0 0 14px 0", color: "#e2e8f0", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}><FaRocket style={{ color: "#4ecdc4" }} /> Hızlı Aksiyonlar</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                        {[
                            { icon: <FaSync />, label: "Senkronize Et", desc: "Tüm platformları güncelle", color: "#4ecdc4", action: runAutoSync, disabled: autoSyncRunning },
                            { icon: <FaPlus />, label: "Yeni Ürün", desc: "Ürün ekle & dağıt", color: "#22c55e", action: () => { setShowNewProductForm(true); setActiveTab("distribution"); } },
                            { icon: <FaTable />, label: "Karşılaştırma", desc: "Hangi ürün nerede?", color: "#8b5cf6", action: () => setActiveTab("comparison") },
                            { icon: <FaClipboardList />, label: "Loglar", desc: unreadCount > 0 ? `${unreadCount} okunmamış` : "Geçmiş", color: unreadCount > 0 ? "#ec4899" : "#64748b", action: () => setActiveTab("logs") },
                        ].map((a, i) => (
                            <motion.button key={i} onClick={a.action} disabled={a.disabled} whileHover={{ y: -2 }} style={{ background: `${a.color}0d`, border: `1px solid ${a.color}30`, borderRadius: "10px", padding: "12px 14px", cursor: a.disabled ? "not-allowed" : "pointer", opacity: a.disabled ? 0.6 : 1, display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                                <div style={{ width: 36, height: 36, borderRadius: "8px", background: `${a.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, fontSize: "15px" }}>{a.disabled ? <Spinner /> : a.icon}</div>
                                <div><div style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 700 }}>{a.label}</div><div style={{ color: "#475569", fontSize: "11px" }}>{a.desc}</div></div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Stok Takibi
       ══════════════════════════════════════════════════════════════════════════ */
    const renderStock = () => {
        const total = products.length;
        const outOfStock = products.filter(p => (p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0) === 0).length;
        const lowStock = products.filter(p => { const s = p.stockTracking?.totalStock ?? (p.masterProduct || p).stock ?? 0; return s > 0 && s <= 10; }).length;
        const healthy = total - outOfStock - lowStock;

        return (
            <motion.div key="stock" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Açıklama Bandı */}
                <div className="pmh-info-banner" style={{ marginBottom: "16px" }}>
                    <FaInfoCircle style={{ color: "#4ecdc4", flexShrink: 0, fontSize: "1.2rem" }} />
                    <div className="pmh-info-text">
                        <h3 style={{ margin: 0, fontSize: "0.9rem" }}>📦 Stok Takibi</h3>
                        <p style={{ margin: "4px 0 0" }}>KPI kartlarına tıklayarak filtreleme yapabilirsiniz. <strong style={{ color: "#ef4444" }}>🔴 Stok yok</strong> = 0, <strong style={{ color: "#f59e0b" }}>🟡 Düşük</strong> = 1-10, <strong style={{ color: "#22c55e" }}>🟢 Sağlıklı</strong> = 10+</p>
                    </div>
                </div>

                {/* 4 KPI Kartı */}
                <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {[{ icon: "📦", label: "Toplam Ürün", val: total, color: "#14b8a6", f: "" }, { icon: "✅", label: "Sağlıklı Stok", val: healthy, color: "#22c55e", f: "" }, { icon: "⚠️", label: "Düşük Stok", val: lowStock, color: "#f59e0b", f: "lowStock" }, { icon: "🚫", label: "Stok Yok", val: outOfStock, color: "#ef4444", f: "outOfStock" }].map((k, i) => (
                        <div key={i} className="pmh-stat-card pmh-stock-kpi" onClick={() => { setFilterStock(filterStock === k.f ? "" : k.f); setPage(0); }} style={{ cursor: "pointer", borderTop: `3px solid ${k.color}`, background: filterStock === k.f ? `${k.color}12` : undefined, borderColor: filterStock === k.f ? k.color : undefined, position: "relative" }}>
                            <div className="pmh-stat-icon" style={{ background: `${k.color}18`, color: k.color }}>{k.icon}</div>
                            <div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: k.color }}>{k.val}</span><span className="pmh-stat-label">{k.label}</span></div>
                            {filterStock === k.f && k.f && <span style={{ position: "absolute", top: 8, right: 10, fontSize: 9, color: "#fff", fontWeight: 700, background: k.color, borderRadius: 4, padding: "2px 8px", boxShadow: `0 2px 8px ${k.color}50` }}>AKTİF</span>}
                        </div>
                    ))}
                </div>

                <div className="pmh-toolbar" style={{ marginBottom: "16px" }}>
                    <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div>
                    <select value={filterStock} onChange={e => { setFilterStock(e.target.value); setPage(0); }} style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6" }}>
                        <option value="">Tümü</option><option value="outOfStock">🚫 Stok Yok</option><option value="lowStock">⚠️ Düşük</option>
                    </select>
                    <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{totalProducts} ürün</span>
                    <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>{autoSyncRunning ? <Spinner /> : <FaSync />} Senkronize Et</button>
                </div>

                {products.length === 0 ? (
                    <div className="pmh-center-msg"><FaBox style={{ fontSize: "3rem", color: "#64748b" }} /><p>Ürün yok</p><button className="pmh-btn pmh-btn-primary" onClick={runAutoSync}><FaSync /> Çek</button></div>
                ) : (
                    <div className="pmh-table-wrap">
                        <table className="pmh-table">
                            <thead><tr><th>Ürün</th><th>Barkod/SKU</th><th>Stok</th><th>Durum</th><th>Platformlar</th><th>İşlem</th></tr></thead>
                            <tbody>
                                {products.map((product, idx) => {
                                    const mp = product.masterProduct || product;
                                    const img = safeImg(mp.images);
                                    const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                    const mappings = product.marketplaceMappings || [];
                                    const stockColor = stock === 0 ? "#ef4444" : stock <= 10 ? "#f59e0b" : "#22c55e";
                                    return (
                                        <tr key={product._id} className="pmh-tr">
                                            <td><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div className="pmh-thumb">{img ? <img src={img} alt="" /> : <FaBox />}</div><div><div className="pmh-cell-title">{mp.name || "İsimsiz"}</div>{mp.brand && <div className="pmh-cell-sub">{mp.brand}</div>}</div></div></td>
                                            <td><div className="pmh-cell-mono">{mp.barcode || "—"}</div><div className="pmh-cell-sub">{mp.sku || "—"}</div></td>
                                            <td><span className="pmh-stock-pill" style={{ background: `${stockColor}15`, color: stockColor, border: `1px solid ${stockColor}30` }}>{stock}</span></td>
                                            <td>{stock === 0 ? <span className="pmh-stock-pill pmh-stock-out">Yok</span> : stock <= 10 ? <span className="pmh-stock-pill pmh-stock-low">Düşük</span> : <span className="pmh-stock-pill pmh-stock-ok">OK</span>}</td>
                                            <td><div className="pmh-platform-dots">{mappings.length > 0 ? mappings.map((m, i) => <span key={i} className="pmh-platform-dot" style={{ background: mpColor(m.marketplaceName) }} title={m.marketplaceName}>{m.marketplaceName?.charAt(0)}</span>) : <span className="pmh-cell-sub">—</span>}</div></td>
                                            <td>
                                                <div className="pmh-actions">
                                                    <button className="pmh-act-btn pmh-act-edit" title="Stok Güncelle" onClick={() => { setStockModal({ product }); setStockValue(String(stock)); }}><FaWarehouse /></button>
                                                    <button className="pmh-act-btn pmh-act-view" title="Detay" onClick={() => setDistDetailProduct(product)}><FaEye /></button>
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
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Ürün Dağıtımı
       ══════════════════════════════════════════════════════════════════════════ */
    const renderDistribution = () => {
        const distFiltered = products.filter(p => {
            const mp = p.masterProduct || p;
            const q = distSearch.toLowerCase();
            const matchSearch = !distSearch || (mp.name || "").toLowerCase().includes(q) || (mp.sku || mp.barcode || "").toLowerCase().includes(q);
            let matchStatus = true;
            if (distFilterStatus === "missing") matchStatus = getMissingMPs(p).length > 0;
            else if (distFilterStatus === "synced") matchStatus = (p.marketplaceMappings || []).some(m => m.syncStatus === "synced");
            else if (distFilterStatus === "error") matchStatus = (p.marketplaceMappings || []).some(m => m.syncStatus === "error");
            return matchSearch && matchStatus;
        });

        const totalSynced = products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "synced")).length;
        const totalError = products.filter(p => (p.marketplaceMappings || []).some(m => m.syncStatus === "error")).length;
        const totalMissing = products.filter(p => getMissingMPs(p).length > 0).length;

        return (
            <motion.div key="distribution" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="pmh-info-banner" style={{ marginBottom: "14px" }}><FaInfoCircle style={{ color: "#4ecdc4" }} /><span>Tüm sayılar <strong style={{ color: "#4ecdc4" }}>benzersiz ürün</strong> bazındadır. Kartlara tıklayarak filtreleyin.</span></div>

                <div className="pmh-stats-row" style={{ marginBottom: "16px" }}>
                    {[{ label: "Toplam", value: products.length, color: "#4ecdc4", icon: "📦", f: "" }, { label: "Senkron", value: totalSynced, color: "#22c55e", icon: "✅", f: "synced" }, { label: "Hata", value: totalError, color: "#ef4444", icon: "❌", f: "error" }, { label: "Eksik", value: totalMissing, color: "#8b5cf6", icon: "⚠️", f: "missing" }].map((c, i) => (
                        <div key={i} className="pmh-stat-card" onClick={() => setDistFilterStatus(distFilterStatus === c.f ? "" : c.f)} style={{ cursor: "pointer", borderTop: `3px solid ${c.color}`, background: distFilterStatus === c.f ? `${c.color}15` : undefined }}>
                            <div className="pmh-stat-icon" style={{ background: `${c.color}18`, color: c.color }}>{c.icon}</div>
                            <div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: c.color }}>{c.value}</span><span className="pmh-stat-label">{c.label}</span></div>
                        </div>
                    ))}
                </div>

                <div className="pmh-toolbar" style={{ marginBottom: "14px" }}>
                    <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={distSearch} onChange={e => setDistSearch(e.target.value)} className="pmh-search-input" /></div>
                    <div style={{ display: "flex", gap: "6px" }}>
                        {[{ key: "", label: "Tümü", color: "#64748b" }, { key: "synced", label: "✅ Senkron", color: "#22c55e" }, { key: "error", label: "❌ Hata", color: "#ef4444" }, { key: "missing", label: "⚠️ Eksik", color: "#8b5cf6" }].map(f => (
                            <button key={f.key} onClick={() => setDistFilterStatus(f.key)} style={{ background: distFilterStatus === f.key ? `${f.color}22` : "transparent", border: `1px solid ${distFilterStatus === f.key ? f.color : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", color: distFilterStatus === f.key ? f.color : "#64748b", padding: "5px 10px", fontSize: "12px", cursor: "pointer", fontWeight: distFilterStatus === f.key ? 700 : 400 }}>{f.label}</button>
                        ))}
                    </div>
                    <button className="pmh-btn pmh-btn-outline" onClick={toggleAllProducts}>{selectedProducts.length === distFiltered.length && distFiltered.length > 0 ? <><FaTimesCircle /> Seçimi Kaldır</> : <><FaCheckSquare /> Tümünü Seç</>}</button>
                </div>

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
                        <button className="pmh-btn pmh-btn-primary" onClick={handleBulkDistribute} disabled={loading || bulkTargets.length === 0}>{loading ? <Spinner /> : <FaRocket />} {bulkTargets.length > 0 ? `${bulkTargets.length} Platforma Dağıt` : "Platform Seç"}</button>
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

                {distFiltered.length === 0 ? (
                    <div className="pmh-center-msg"><FaSearch style={{ fontSize: "2rem", color: "#64748b" }} /><p>Ürün bulunamadı</p><button className="pmh-btn pmh-btn-outline" onClick={() => { setDistSearch(""); setDistFilterStatus(""); }}>Temizle</button></div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {distFiltered.map(product => {
                            const mp = product.masterProduct || product;
                            const img = safeImg(mp.images);
                            const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                            const sel = selectedProducts.includes(product._id);
                            const isDetail = distDetailProduct?._id === product._id;
                            const productMPs = getProductMPs(product);
                            const missingMPs = getMissingMPs(product);
                            const hasError = (product.marketplaceMappings || []).some(m => m.syncStatus === "error");

                            return (
                                <div key={product._id} style={{ background: isDetail ? "rgba(78,205,196,0.06)" : sel ? "rgba(15,118,110,0.08)" : "rgba(255,255,255,0.02)", border: `1.5px solid ${isDetail ? "#4ecdc4" : sel ? "#0f766e" : hasError ? "rgba(239,68,68,0.3)" : missingMPs.length > 0 ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: "12px", padding: "12px 14px", cursor: "pointer" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div onClick={e => { e.stopPropagation(); toggleProduct(product._id); }} style={{ flexShrink: 0, cursor: "pointer" }}>{sel ? <FaCheckSquare style={{ color: "#0f766e", fontSize: 18 }} /> : <FaSquare style={{ color: "#30363d", fontSize: 18 }} />}</div>
                                        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.05)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FaBox style={{ color: "#30363d", fontSize: 18 }} />}</div>
                                        <div style={{ flex: 1, minWidth: 0 }} onClick={() => setDistDetailProduct(isDetail ? null : product)}>
                                            <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mp.name || "İsimsiz"}</div>
                                            <div style={{ color: "#64748b", fontSize: "11px", display: "flex", gap: "10px" }}><span><FaBarcode style={{ marginRight: 3 }} />{mp.barcode || "—"}</span><span><FaTag style={{ marginRight: 3 }} />{mp.sku || "—"}</span><span>💰 {fmt(mp.price || 0)}</span><span>📦 {stock}</span></div>
                                        </div>
                                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                                            {marketplaces.map((mpItem, i) => {
                                                const status = getProductSyncStatus(product, mpItem.name);
                                                const exists = productMPs.includes(mpItem.name);
                                                return (
                                                    <div key={i} title={`${mpItem.name}: ${status || "Yok"}`} style={{ background: exists ? status === "synced" ? "rgba(34,197,94,0.15)" : status === "error" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${exists ? status === "synced" ? "rgba(34,197,94,0.4)" : status === "error" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "5px", padding: "3px 7px", fontSize: "10px", fontWeight: 600, color: exists ? status === "synced" ? "#22c55e" : status === "error" ? "#ef4444" : "#f59e0b" : "#475569", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: mpColor(mpItem.name) }} />{mpItem.name}{!exists && <span style={{ fontSize: 9 }}>✕</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            {missingMPs.length > 0 && <button className="pmh-btn pmh-btn-primary" style={{ fontSize: "11px", padding: "5px 10px" }} onClick={async e => { e.stopPropagation(); setLoading(true); try { await bulkDistributeSelected([product._id], missingMPs); showToast("Dağıtıldı", "success"); loadProducts(); } catch { showToast("Hata", "error"); } setLoading(false); }}><FaRocket /> Dağıt</button>}
                                            <button onClick={e => { e.stopPropagation(); setDistDetailProduct(isDetail ? null : product); }} style={{ background: isDetail ? "rgba(78,205,196,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${isDetail ? "#4ecdc4" : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", color: isDetail ? "#4ecdc4" : "#64748b", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}>{isDetail ? <FaChevronDown /> : <FaChevronRight />}</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {totalPages > 1 && <div className="pmh-pagination" style={{ marginTop: "16px" }}><button className="pmh-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><FaArrowLeft /> Önceki</button><span style={{ color: "#64748b", fontSize: "13px" }}>Sayfa {page + 1} / {totalPages}</span><button className="pmh-pg-btn" disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>Sonraki <FaArrowRight /></button></div>}

                {showNewProductForm && (
                    <div style={{ marginTop: "20px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(15,118,110,0.4)", borderRadius: "14px", padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}><h3 style={{ margin: 0, color: "#4ecdc4", fontSize: "15px" }}><FaPlus /> Yeni Ürün</h3><button onClick={() => setShowNewProductForm(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><FaTimes /></button></div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                            {[{ key: "name", label: "Ürün Adı *" }, { key: "barcode", label: "Barkod *" }, { key: "sku", label: "SKU *" }, { key: "brand", label: "Marka" }, { key: "category", label: "Kategori" }, { key: "stock", label: "Stok", type: "number" }, { key: "price", label: "Fiyat (₺) *", type: "number" }, { key: "listPrice", label: "Liste Fiyatı", type: "number" }].map(f => (
                                <div key={f.key}><label style={{ display: "block", marginBottom: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>{f.label}</label><input type={f.type || "text"} value={newProduct[f.key]} onChange={e => setNewProduct(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6" }} /></div>
                            ))}
                        </div>
                        <div style={{ marginBottom: "16px" }}><label style={{ display: "block", marginBottom: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>Platformlar</label><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{marketplaces.map(mp => (<label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "6px", background: newProductTargets.includes(mp.name) ? `${mpColor(mp.name)}22` : "rgba(255,255,255,0.04)", border: `1px solid ${newProductTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}><input type="checkbox" style={{ display: "none" }} checked={newProductTargets.includes(mp.name)} onChange={() => toggleNewProductTarget(mp.name)} /><span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(mp.name) }} />{mp.name}{newProductTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 10 }} />}</label>))}</div></div>
                        <div style={{ display: "flex", gap: "10px" }}><button className="pmh-btn pmh-btn-outline" onClick={() => setShowNewProductForm(false)}><FaTimes /> İptal</button><button className="pmh-btn pmh-btn-primary" onClick={handleCreateProduct} disabled={loading}>{loading ? <Spinner /> : <FaRocket />} Oluştur {newProductTargets.length > 0 && `& ${newProductTargets.length} Platforma Dağıt`}</button></div>
                    </div>
                )}
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Fiyat & Kampanya
       ══════════════════════════════════════════════════════════════════════════ */
    const renderPricing = () => {
        const withDiscount = products.filter(p => { const mp = p.masterProduct || p; return mp.listPrice && mp.listPrice > (mp.price || 0); }).length;
        const avgPrice = products.length > 0 ? (products.reduce((s, p) => s + ((p.masterProduct || p).price || 0), 0) / products.length).toFixed(0) : 0;
        const maxPrice = products.length > 0 ? Math.max(...products.map(p => (p.masterProduct || p).price || 0)) : 0;
        const minPrice = products.length > 0 ? Math.min(...products.filter(p => (p.masterProduct || p).price > 0).map(p => (p.masterProduct || p).price || 0)) : 0;

        return (
            <motion.div key="pricing" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* 4 KPI Kartı */}
                <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {[{ icon: "💰", label: "Toplam Ürün", val: products.length, color: "#14b8a6" }, { icon: "🏷️", label: "İndirimli", val: withDiscount, color: "#22c55e" }, { icon: "📊", label: "Ort. Fiyat", val: `₺${fmtNum(avgPrice)}`, color: "#f59e0b" }, { icon: "⬆️", label: "En Yüksek", val: `₺${fmtNum(maxPrice)}`, color: "#8b5cf6" }].map((k, i) => (
                        <div key={i} className="pmh-stat-card" style={{ borderTop: `3px solid ${k.color}` }}>
                            <div className="pmh-stat-icon" style={{ background: `${k.color}18`, color: k.color }}>{k.icon}</div>
                            <div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: k.color }}>{k.val}</span><span className="pmh-stat-label">{k.label}</span></div>
                        </div>
                    ))}
                </div>

                {/* 3 Kampanya Açıklama Kartı */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                    <div className="pmh-campaign-card" style={{ background: "linear-gradient(135deg, rgba(78,205,196,0.08) 0%, rgba(68,160,141,0.04) 100%)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: "12px", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "8px", background: "rgba(78,205,196,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ecdc4", fontSize: "1rem" }}>📦</div>
                            <div style={{ color: "#4ecdc4", fontWeight: 700, fontSize: "0.9rem" }}>Toplu Güncelleme</div>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>Birden fazla ürün seçip tek seferde sabit fiyat, yüzde indirim veya kar marjı uygulayabilirsiniz.</p>
                    </div>
                    <div className="pmh-campaign-card" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(124,58,237,0.04) 100%)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "12px", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "8px", background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", fontSize: "1rem" }}>🏷️</div>
                            <div style={{ color: "#8b5cf6", fontWeight: 700, fontSize: "0.9rem" }}>İndirim Kampanyası</div>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>Liste fiyatı üzerinden % indirim tanımlayın. Satış fiyatı otomatik hesaplanır ve tüm platformlara yansır.</p>
                    </div>
                    <div className="pmh-campaign-card" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(22,163,74,0.04) 100%)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "12px", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "8px", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", fontSize: "1rem" }}>📈</div>
                            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: "0.9rem" }}>Kar Marjı</div>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>Maliyet üzerine % kar ekleyin. Fiyatlandırma stratejinizi kolayca yönetin ve platformlara senkronize edin.</p>
                    </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px", marginBottom: "20px" }}>
                    <h3 style={{ margin: "0 0 14px 0", color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}><FaTags style={{ marginRight: "8px", color: "#4ecdc4" }} />Toplu Fiyat Güncelleme {selectedProducts.length > 0 && <span style={{ background: "rgba(20,184,166,0.12)", borderRadius: 20, padding: "4px 14px", fontSize: "0.78rem", color: "#14b8a6", marginLeft: "10px" }}>{selectedProducts.length} ürün</span>}</h3>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                        {[{ key: "fixed", label: "Sabit Fiyat", icon: "₺" }, { key: "percent", label: "% İndirim", icon: "🏷️" }, { key: "margin", label: "% Kar", icon: "📈" }].map(m => (
                            <div key={m.key} onClick={() => setBulkPriceMode(m.key)} style={{ background: bulkPriceMode === m.key ? "rgba(78,205,196,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${bulkPriceMode === m.key ? "#4ecdc4" : "rgba(255,255,255,0.08)"}`, borderRadius: "10px", padding: "12px 16px", cursor: "pointer", flex: 1, minWidth: "120px" }}>
                                <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{m.icon}</div>
                                <div style={{ color: bulkPriceMode === m.key ? "#4ecdc4" : "#e2e8f0", fontWeight: 700, fontSize: "13px" }}>{m.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div><label style={{ display: "block", marginBottom: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>{bulkPriceMode === "fixed" ? "Yeni Fiyat (₺)" : bulkPriceMode === "percent" ? "İndirim (%)" : "Kar (%)"}</label><input type="number" value={bulkPriceValue} onChange={e => setBulkPriceValue(e.target.value)} placeholder={bulkPriceMode === "fixed" ? "299.90" : "15"} style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", width: "150px" }} /></div>
                        {bulkPriceValue && selectedProducts.length > 0 && (
                            <div style={{ background: "linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(78,205,196,0.05) 100%)", border: "1.5px solid rgba(20,184,166,0.3)", borderRadius: "10px", padding: "12px 18px", fontSize: "0.85rem", color: "#14b8a6", display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ fontSize: "1.3rem" }}>📋</span>
                                <div>
                                    <div style={{ fontWeight: 700, marginBottom: "2px" }}>Canlı Önizleme</div>
                                    <div style={{ color: "#e2e8f0" }}>
                                        <strong style={{ color: "#4ecdc4" }}>{selectedProducts.length}</strong> ürün →
                                        {bulkPriceMode === "fixed" && <span style={{ color: "#22c55e", fontWeight: 700 }}> ₺{bulkPriceValue} sabit fiyat</span>}
                                        {bulkPriceMode === "percent" && <span style={{ color: "#f59e0b", fontWeight: 700 }}> %{bulkPriceValue} indirim uygulanacak</span>}
                                        {bulkPriceMode === "margin" && <span style={{ color: "#8b5cf6", fontWeight: 700 }}> %{bulkPriceValue} kar marjı eklenecek</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                        <button className="pmh-btn pmh-btn-primary" onClick={handleBulkPriceUpdate} disabled={loading || selectedProducts.length === 0 || !bulkPriceValue}>{loading ? <Spinner /> : <FaMoneyBillWave />} {selectedProducts.length > 0 ? `${selectedProducts.length} Ürünü Güncelle` : "Önce Ürün Seçin ↓"}</button>
                        {selectedProducts.length > 0 && <button className="pmh-btn pmh-btn-outline" onClick={() => setSelectedProducts([])}><FaTimes /> Seçimi Temizle</button>}
                    </div>
                </div>

                <div className="pmh-toolbar" style={{ marginBottom: "16px" }}><div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pmh-search-input" /></div><button className="pmh-btn pmh-btn-outline" onClick={toggleAllProducts}>{selectedProducts.length === products.length ? <><FaTimesCircle /> Seçimi Kaldır</> : <><FaCheckSquare /> Tümünü Seç</>}</button></div>

                {products.length === 0 ? <div className="pmh-center-msg"><p>Ürün bulunamadı</p></div> : (
                    <div className="pmh-table-wrap">
                        <table className="pmh-table">
                            <thead><tr><th style={{ width: 40 }}><input type="checkbox" checked={selectedProducts.length === products.length} onChange={toggleAllProducts} /></th><th>Ürün</th><th>Satış Fiyatı</th><th>Liste Fiyatı</th><th>İndirim</th><th>Stok</th><th>Platformlar</th><th>İşlem</th></tr></thead>
                            <tbody>
                                {products.map(product => {
                                    const mp = product.masterProduct || product;
                                    const price = mp.price ?? 0;
                                    const lp = mp.listPrice ?? price;
                                    const discount = lp > price ? ((lp - price) / lp * 100).toFixed(1) : null;
                                    const stock = product.stockTracking?.totalStock ?? mp.stock ?? 0;
                                    const mappings = product.marketplaceMappings || [];
                                    const sel = selectedProducts.includes(product._id);
                                    return (
                                        <tr key={product._id} className="pmh-tr" style={{ background: sel ? "rgba(20,184,166,0.04)" : undefined }}>
                                            <td><input type="checkbox" checked={sel} onChange={() => toggleProduct(product._id)} /></td>
                                            <td><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div className="pmh-thumb">{safeImg(mp.images) ? <img src={safeImg(mp.images)} alt="" /> : <FaBox />}</div><div><div className="pmh-cell-title">{mp.name || "İsimsiz"}</div><div className="pmh-cell-sub">{mp.sku || mp.barcode || "—"}</div></div></div></td>
                                            <td><span className="pmh-price-main">{fmt(price)}</span></td>
                                            <td>{lp > price ? <span style={{ color: "#64748b", textDecoration: "line-through" }}>{fmt(lp)}</span> : "—"}</td>
                                            <td>{discount ? <span className="pmh-stock-pill pmh-stock-ok">%{discount}</span> : "—"}</td>
                                            <td>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700, color: stock === 0 ? "#ef4444" : stock < 10 ? "#f59e0b" : "#22c55e", background: stock === 0 ? "rgba(239,68,68,0.1)" : stock < 10 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)", padding: "3px 8px", borderRadius: "6px", fontSize: "0.8rem" }}>
                                                    {stock === 0 ? "🔴" : stock < 10 ? "🟡" : "🟢"} {stock}
                                                </span>
                                            </td>
                                            <td><div className="pmh-platform-dots">{mappings.length > 0 ? mappings.map((m, i) => <span key={i} className="pmh-platform-dot" style={{ background: mpColor(m.marketplaceName) }}>{m.marketplaceName?.charAt(0)}</span>) : "—"}</div></td>
                                            <td><button className="pmh-btn pmh-btn-primary" style={{ fontSize: "11px", padding: "5px 10px" }} onClick={() => { setPriceModal({ product }); setSalePrice(String(price)); setListPrice(String(lp)); setDiscountRate(discount || ""); }}><FaEdit /> Güncelle</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && <div className="pmh-pagination"><button className="pmh-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button><span className="pmh-pg-info">Sayfa {page + 1} / {totalPages}</span><button className="pmh-pg-btn" disabled={(page + 1) * PAGE_SIZE >= totalProducts} onClick={() => setPage(p => p + 1)}>Sonraki →</button></div>}
            </motion.div>
        );
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER: Karşılaştırma
       ══════════════════════════════════════════════════════════════════════════ */
    const renderComparison = () => (
        <motion.div key="comparison" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Açıklama Bandı - Renk Kodları */}
            <div className="pmh-info-banner" style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "1.5rem" }}>🗺️</span>
                <div className="pmh-info-text">
                    <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Karşılaştırma Matrisi</h3>
                    <p style={{ margin: "6px 0 0" }}>Her ürünün hangi pazaryerinde <strong>mevcut</strong>, hangisinde <strong>eksik</strong> olduğunu görün.</p>
                    <div style={{ display: "flex", gap: "16px", marginTop: "10px", flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}><span style={{ color: "#22c55e", fontSize: "1rem" }}>✅</span> <strong style={{ color: "#22c55e" }}>Senkron</strong></span>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}><span style={{ color: "#f59e0b", fontSize: "1rem" }}>⏳</span> <strong style={{ color: "#f59e0b" }}>Bekliyor</strong></span>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}><span style={{ color: "#ef4444", fontSize: "1rem" }}>❌</span> <strong style={{ color: "#ef4444" }}>Hata</strong></span>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}><span style={{ color: "#475569", fontSize: "1rem" }}>⬜</span> <strong style={{ color: "#475569" }}>Yok</strong></span>
                    </div>
                </div>
            </div>

            {/* 4 Özet Kartı */}
            <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #22c55e" }}><div className="pmh-stat-icon" style={{ background: "#22c55e18", color: "#22c55e" }}>✅</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#22c55e" }}>{compSummary?.fullyDistributed ?? 0}</span><span className="pmh-stat-label">Tam Dağıtılmış</span></div></div>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #f59e0b" }}><div className="pmh-stat-icon" style={{ background: "#f59e0b18", color: "#f59e0b" }}>⚠️</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#f59e0b" }}>{compSummary?.partiallyMissing ?? 0}</span><span className="pmh-stat-label">Kısmi Eksik</span></div></div>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #ef4444" }}><div className="pmh-stat-icon" style={{ background: "#ef444418", color: "#ef4444" }}>🚫</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#ef4444" }}>{compSummary?.notDistributed ?? 0}</span><span className="pmh-stat-label">Dağıtılmamış</span></div></div>
                <div className="pmh-stat-card" style={{ borderTop: "3px solid #3b82f6" }}><div className="pmh-stat-icon" style={{ background: "#3b82f618", color: "#3b82f6" }}>📦</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: "#3b82f6" }}>{compTotal}</span><span className="pmh-stat-label">Toplam Ürün</span></div></div>
            </div>

            <div className="pmh-toolbar" style={{ marginBottom: "16px" }}>
                <div className="pmh-search-box"><FaSearch className="pmh-search-icon" /><input type="text" placeholder="Ara..." value={compSearch} onChange={e => { setCompSearch(e.target.value); setCompPage(0); }} className="pmh-search-input" /></div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: missingOnly ? "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${missingOnly ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", padding: "8px 14px", cursor: "pointer", transition: "all 0.2s" }}>
                    <input type="checkbox" checked={missingOnly} onChange={e => { setMissingOnly(e.target.checked); setCompPage(0); }} style={{ accentColor: "#ef4444" }} />
                    <span style={{ color: missingOnly ? "#ef4444" : "#94a3b8", fontWeight: missingOnly ? 700 : 500, fontSize: "0.85rem" }}>🔍 Sadece eksik olanları göster</span>
                </label>
                <span style={{ color: "#94a3b8" }}>{compTotal} ürün</span>
                <button className="pmh-btn pmh-btn-outline" onClick={loadComparison}><FaSync /> Yenile</button>
            </div>

            {selectedProducts.length > 0 && (
                <div style={{ background: "rgba(15,118,110,0.12)", border: "1.5px solid rgba(15,118,110,0.4)", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "#14b8a6" }}><FaCheckSquare style={{ marginRight: 6 }} />{selectedProducts.length} ürün</span>
                    <div style={{ display: "flex", gap: "8px", flex: 1, flexWrap: "wrap" }}>{marketplaces.map(mp => (<label key={mp._id} style={{ display: "flex", alignItems: "center", gap: "6px", background: bulkTargets.includes(mp.name) ? `${mpColor(mp.name)}22` : "rgba(255,255,255,0.04)", border: `1px solid ${bulkTargets.includes(mp.name) ? mpColor(mp.name) : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" }}><input type="checkbox" style={{ display: "none" }} checked={bulkTargets.includes(mp.name)} onChange={() => toggleTarget(mp.name)} /><span style={{ width: 8, height: 8, borderRadius: "50%", background: mpColor(mp.name) }} />{mp.name}{bulkTargets.includes(mp.name) && <FaCheck style={{ color: mpColor(mp.name), fontSize: 10 }} />}</label>))}</div>
                    <button className="pmh-btn pmh-btn-primary" onClick={handleBulkDistribute} disabled={loading || bulkTargets.length === 0}>{loading ? <Spinner /> : <FaRocket />} {bulkTargets.length > 0 ? `${bulkTargets.length} Platforma Dağıt` : "Platform Seç"}</button>
                    <button className="pmh-btn pmh-btn-outline" onClick={() => { setSelectedProducts([]); setBulkTargets([]); }}><FaTimes /></button>
                </div>
            )}

            {compMatrix.length === 0 ? <div className="pmh-center-msg"><FaTable style={{ fontSize: "3rem", color: "#64748b" }} /><p>Veri bulunamadı</p><button className="pmh-btn pmh-btn-primary" onClick={loadComparison}><FaSync /> Yenile</button></div> : (
                <div className="pmh-table-wrap">
                    <table className="pmh-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}><input type="checkbox" checked={selectedProducts.length === compMatrix.length} onChange={() => setSelectedProducts(selectedProducts.length === compMatrix.length ? [] : compMatrix.map(p => p._id))} /></th>
                                <th>Ürün</th>
                                <th>Barkod</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                {marketplaces.map((mp, i) => (
                                    <th key={i} style={{ background: `linear-gradient(180deg, ${mpColor(mp.name)}25 0%, ${mpColor(mp.name)}10 100%)`, color: mpColor(mp.name), textAlign: "center", borderBottom: `3px solid ${mpColor(mp.name)}`, fontWeight: 700 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: mpColor(mp.name), boxShadow: `0 0 8px ${mpColor(mp.name)}60` }} />
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
                                        <td><div style={{ fontWeight: 600, color: "#f1f5f9", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name || "İsimsiz"}</div>{product.brand && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{product.brand}</div>}</td>
                                        <td style={{ color: "#64748b", fontSize: "0.78rem" }}>{product.barcode || "—"}</td>
                                        <td><span className="pmh-price-main">{fmt(product.price || 0)}</span></td>
                                        <td style={{ textAlign: "center" }}><span style={{ fontWeight: 700, color: (product.stock || 0) === 0 ? "#ef4444" : (product.stock || 0) < 10 ? "#f59e0b" : "#22c55e" }}>{product.stock ?? "—"}</span></td>
                                        {marketplaces.map((mp, i) => {
                                            const presence = product.presence?.[mp.name];
                                            const exists = presence?.exists;
                                            const status = presence?.syncStatus;
                                            const statusColor = !exists ? "#334155" : status === "synced" ? "#22c55e" : status === "error" ? "#ef4444" : "#f59e0b";
                                            return <td key={i} style={{ textAlign: "center" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><span style={{ color: statusColor, fontSize: "1rem" }}>{exists ? status === "synced" ? "✅" : status === "error" ? "❌" : "⏳" : "⬜"}</span><span style={{ fontSize: "0.68rem", color: statusColor, fontWeight: 600 }}>{exists ? status === "synced" ? "Senkron" : status === "error" ? "Hata" : "Bekliyor" : "Yok"}</span></div></td>;
                                        })}
                                        <td style={{ textAlign: "center" }}>{missingCount > 0 ? <span className="pmh-stock-pill pmh-stock-low">{missingCount} eksik</span> : <span className="pmh-stock-pill pmh-stock-ok">✅ Tam</span>}</td>
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
       RENDER: Loglar
       ══════════════════════════════════════════════════════════════════════════ */
    const renderLogs = () => {
        const successLogs = logs.filter(l => l.status === "synced" || l.status === "success").length;
        const errorLogs = logs.filter(l => l.status === "error").length;
        const pendingLogs = logs.filter(l => l.status === "pending" || l.status === "processing").length;

        return (
            <motion.div key="logs" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* 5 İstatistik Kartı */}
                <div className="pmh-stats-row" style={{ marginBottom: "16px", gridTemplateColumns: "repeat(5, 1fr)" }}>
                    {[{ icon: "📋", label: "Toplam Log", val: logs.length, color: "#14b8a6" }, { icon: "✅", label: "Başarılı", val: successLogs, color: "#22c55e" }, { icon: "❌", label: "Hatalı", val: errorLogs, color: "#ef4444" }, { icon: "⏳", label: "Bekleyen", val: pendingLogs, color: "#f59e0b" }, { icon: "🔔", label: "Okunmamış", val: unreadCount, color: "#8b5cf6" }].map((k, i) => (
                        <div key={i} className="pmh-stat-card" style={{ borderTop: `3px solid ${k.color}` }}><div className="pmh-stat-icon" style={{ background: `${k.color}18`, color: k.color }}>{k.icon}</div><div className="pmh-stat-body"><span className="pmh-stat-value" style={{ color: k.color }}>{k.val}</span><span className="pmh-stat-label">{k.label}</span></div></div>
                    ))}
                </div>

                {notifications.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px", marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}><h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}><FaBell style={{ marginRight: "8px", color: "#8b5cf6" }} />Bildirimler {unreadCount > 0 && <span style={{ background: "#8b5cf6", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: "0.7rem", marginLeft: 6 }}>{unreadCount}</span>}</h3><button className="pmh-btn pmh-btn-outline" onClick={handleMarkAllRead}><FaCheck /> Okundu</button></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{notifications.slice(0, 5).map((n, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "10px 14px" }}><FaBell style={{ color: "#8b5cf6" }} /><div style={{ flex: 1 }}><div style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 600 }}>{n.actionType || "Bildirim"}</div><div style={{ color: "#64748b", fontSize: "11px" }}>{n.product?.name || "—"}</div></div><span style={{ color: "#475569", fontSize: "11px" }}>{n.timestamp ? new Date(n.timestamp).toLocaleString("tr-TR") : ""}</span></div>)}</div>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}><h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "14px", fontWeight: 700 }}><FaClipboardList style={{ marginRight: "8px", color: "#4ecdc4" }} />İşlem Geçmişi</h3><div style={{ display: "flex", gap: "8px" }}><span style={{ color: "#64748b" }}>{logs.length} kayıt</span><button className="pmh-btn pmh-btn-outline" onClick={loadLogs}><FaSync /> Yenile</button></div></div>

                {logs.length === 0 ? <div className="pmh-center-msg"><FaClipboardList style={{ fontSize: "2.5rem", color: "#64748b" }} /><p>Henüz log yok</p><button className="pmh-btn pmh-btn-outline" onClick={runAutoSync} disabled={autoSyncRunning}>{autoSyncRunning ? <Spinner /> : <FaSync />} Senkronizasyon Başlat</button></div> : (
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
                                            <td>
                                                {log.marketplace?.name ? (
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${mpColor(log.marketplace.name)}15`, border: `1px solid ${mpColor(log.marketplace.name)}30`, borderRadius: "6px", padding: "4px 10px" }}>
                                                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: mpColor(log.marketplace.name), boxShadow: `0 0 6px ${mpColor(log.marketplace.name)}60` }} />
                                                        <span style={{ color: mpColor(log.marketplace.name), fontWeight: 600, fontSize: "0.8rem" }}>{log.marketplace.name}</span>
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${statusColor}20 0%, ${statusColor}10 100%)`, border: `1.5px solid ${statusColor}40`, borderRadius: 999, padding: "4px 12px", fontSize: "0.75rem", fontWeight: 700, color: statusColor, boxShadow: `0 2px 6px ${statusColor}20` }}>
                                                    {statusIcon} {log.status === "synced" || log.status === "success" ? "Başarılı" : log.status === "error" ? "Hata" : log.status || "—"}
                                                </span>
                                            </td>
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
            <div className="pmh-page-header">
                <div className="pmh-page-header-left">
                    <div className="pmh-page-icon"><FaLayerGroup /></div>
                    <div><h1 className="pmh-page-title">Ürün Yönetimi</h1><p className="pmh-page-subtitle">Stok · Dağıtım · Fiyat{products.length > 0 && <span style={{ marginLeft: "10px", background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", color: "#4ecdc4", fontWeight: 700 }}>{products.length} ürün</span>}</p></div>
                </div>
                <div className="pmh-page-badges">
                    {autoSyncRunning && <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4ecdc4", fontSize: "11px", fontWeight: 600 }}><Spinner /> Senkronize ediliyor...</div>}
                    <button className="pmh-btn pmh-btn-outline" onClick={() => setActiveTab("logs")} title="Bildirimler"><FaBell />{unreadCount > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "50%", padding: "1px 5px", fontSize: "10px", marginLeft: "4px" }}>{unreadCount}</span>}</button>
                    <button className="pmh-btn pmh-btn-primary" onClick={runAutoSync} disabled={autoSyncRunning}>{autoSyncRunning ? <Spinner /> : <FaSync />} {autoSyncRunning ? "Senkronize Ediliyor..." : "Senkronize Et"}</button>
                </div>
            </div>

            <div className="pmh-tabs">
                {TABS.map(tab => (
                    <motion.button key={tab.key} className={`pmh-tab ${activeTab === tab.key ? "pmh-tab-active" : ""}`} onClick={() => setActiveTab(tab.key)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                        <span className="pmh-tab-icon">{tab.icon}</span><span className="pmh-tab-label">{tab.label}</span>
                        {tab.key === "logs" && unreadCount > 0 && <span style={{ background: "#8b5cf6", color: "#fff", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", marginLeft: "4px" }}>{unreadCount}</span>}
                    </motion.button>
                ))}
            </div>

            <div className="pmh-body">
                <AnimatePresence mode="wait">
                    {activeTab === "dashboard" && renderDashboard()}
                    {activeTab === "stock" && renderStock()}
                    {activeTab === "distribution" && renderDistribution()}
                    {activeTab === "pricing" && renderPricing()}
                    {activeTab === "categorymapping" && <motion.div key="categorymapping" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} style={{ padding: 0 }}><CategoryMappingPage /></motion.div>}
                    {activeTab === "comparison" && renderComparison()}
                    {activeTab === "logs" && renderLogs()}
                </AnimatePresence>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && <motion.div className={`pmh-toast pmh-toast-${toast.type}`} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderRadius: "10px" }}>{toast.type === "success" && <FaCheckCircle />}{toast.type === "error" && <FaTimesCircle />}{toast.type === "warning" && <FaExclamationTriangle />}{toast.type === "info" && <FaInfoCircle />}<span style={{ flex: 1 }}>{toast.msg}</span><button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}><FaTimes /></button></motion.div>}
            </AnimatePresence>

            {/* Stok Modal */}
            <AnimatePresence>
                {stockModal && <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStockModal(null)}><motion.div className="pmh-modal pmh-modal-md" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}><div className="pmh-modal-head"><h2><FaWarehouse /> Stok Güncelle</h2><button className="pmh-modal-x" onClick={() => setStockModal(null)}><FaTimes /></button></div><div className="pmh-modal-body"><div style={{ marginBottom: "1rem" }}><strong style={{ color: "#e8edf6" }}>{stockModal.product?.masterProduct?.name || stockModal.product?.name}</strong></div><div className="pmh-info-banner" style={{ marginBottom: "1rem" }}><FaInfoCircle style={{ color: "#4ecdc4" }} /><span>Stok güncellediğinizde <strong>tüm pazaryerleri</strong> otomatik güncellenir.</span></div><div style={{ marginBottom: "1rem" }}><label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "#94a3b8" }}>Yeni Stok</label><input type="number" min="0" value={stockValue} onChange={e => setStockValue(e.target.value)} style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem" }} /></div></div><div className="pmh-modal-foot"><button className="pmh-btn pmh-btn-ghost" onClick={() => setStockModal(null)}>İptal</button><button className="pmh-btn pmh-btn-primary" onClick={handleSyncStock} disabled={loading}>{loading ? <Spinner /> : <FaSave />} Güncelle</button></div></motion.div></motion.div>}
            </AnimatePresence>

            {/* Fiyat Modal */}
            <AnimatePresence>
                {priceModal && <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPriceModal(null)}><motion.div className="pmh-modal pmh-modal-md" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}><div className="pmh-modal-head"><h2><FaMoneyBillWave /> Fiyat Güncelle</h2><button className="pmh-modal-x" onClick={() => setPriceModal(null)}><FaTimes /></button></div><div className="pmh-modal-body"><div style={{ marginBottom: "1rem" }}><strong style={{ color: "#e8edf6" }}>{priceModal.product?.masterProduct?.name || priceModal.product?.name}</strong></div><div className="pmh-info-banner" style={{ marginBottom: "1rem" }}><FaInfoCircle style={{ color: "#4ecdc4" }} /><span>Fiyat güncellediğinizde <strong>tüm pazaryerleri</strong> otomatik güncellenir.</span></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}><div><label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "#94a3b8" }}>Satış Fiyatı *</label><input type="number" min="0" step="0.01" value={salePrice} onChange={e => { setSalePrice(e.target.value); setDiscountRate(calcDiscountRate(e.target.value, listPrice)); }} style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem" }} /></div><div><label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "#94a3b8" }}>Liste Fiyatı</label><input type="number" min="0" step="0.01" value={listPrice} onChange={e => { setListPrice(e.target.value); setDiscountRate(calcDiscountRate(salePrice, e.target.value)); }} style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem" }} /></div><div><label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "#94a3b8" }}>İndirim %</label><input type="number" min="0" max="100" step="0.1" value={discountRate} onChange={e => { setDiscountRate(e.target.value); if (listPrice) setSalePrice(applyDiscount(listPrice, e.target.value)); }} style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8edf6", fontSize: "1rem" }} /></div></div></div><div className="pmh-modal-foot"><button className="pmh-btn pmh-btn-ghost" onClick={() => setPriceModal(null)}>İptal</button><button className="pmh-btn pmh-btn-primary" onClick={handleSyncPrice} disabled={loading}>{loading ? <Spinner /> : <FaSave />} Güncelle</button></div></motion.div></motion.div>}
            </AnimatePresence>

            {/* Silme Modal */}
            <AnimatePresence>
                {deleteModal && <motion.div className="pmh-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal(null)}><motion.div className="pmh-modal pmh-modal-md" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()}><div className="pmh-modal-head"><h2><FaTrash /> Ürünü Sil</h2><button className="pmh-modal-x" onClick={() => setDeleteModal(null)}><FaTimes /></button></div><div className="pmh-modal-body"><p style={{ color: "#e8edf6" }}>Bu ürünü silmek istediğinizden emin misiniz?</p><p><strong style={{ color: "#4ecdc4" }}>{deleteModal.masterProduct?.name || deleteModal.name}</strong></p><div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "0.75rem", marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontSize: "0.85rem" }}><FaExclamationTriangle /> Bu işlem geri alınamaz.</div></div><div className="pmh-modal-foot"><button className="pmh-btn pmh-btn-ghost" onClick={() => setDeleteModal(null)}>İptal</button><button className="pmh-btn" style={{ background: "#ef4444", color: "#fff" }} onClick={handleDelete} disabled={loading}>{loading ? <Spinner /> : <FaTrash />} Sil</button></div></motion.div></motion.div>}
            </AnimatePresence>
        </div>
    );
};

export default ProductManagementHub;
