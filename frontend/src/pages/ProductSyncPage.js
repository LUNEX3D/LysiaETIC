import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaSyncAlt, FaCheck, FaTimes, FaSpinner, FaSearch,
    FaBoxOpen, FaExchangeAlt, FaArrowRight,
    FaCheckCircle, FaTimesCircle,
    FaCloudDownloadAlt, FaCloudUploadAlt,
    FaSave, FaBell, FaPlay, FaStop, FaInfoCircle,
    FaChartBar, FaEdit, FaDollarSign, FaTag
} from "react-icons/fa";
import {
    getProducts, syncFromMarketplace, distributeProduct,
    bulkDistribute, syncStock, syncPrice,
    getProductManagementDashboard, getUnreadNotifications,
    triggerAutoSync
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementPages.css";

// ─── Canlı Stok Bildirim Paneli ──────────────────────────────────
const StockMonitorPanel = ({ notifications, onClose }) => {
    if (!notifications || notifications.length === 0) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
                position: "fixed", top: "1rem", right: "1rem", zIndex: 9999,
                width: "380px", maxHeight: "500px", overflowY: "auto",
                background: "linear-gradient(135deg,#1a1f35,#0f1419)",
                border: "1px solid rgba(78,205,196,0.3)",
                borderRadius: "16px", padding: "1.5rem",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                    <span style={{ color: "#4ecdc4", fontWeight: 700, fontSize: "0.95rem" }}>🔔 Canlı Bildirimler</span>
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>
            {notifications.slice(0, 8).map((n, i) => {
                const isStockZero = n.changes?.newValue === 0 && n.changes?.field === "stock";
                const isLow = n.changes?.field === "stock" && n.changes?.newValue > 0 && n.changes?.newValue <= 10;
                const isPrice = n.changes?.field === "price";
                return (
                    <div key={n._id || i} style={{
                        background: isStockZero ? "rgba(239,68,68,0.1)" : isLow ? "rgba(245,158,11,0.1)" : isPrice ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isStockZero ? "rgba(239,68,68,0.3)" : isLow ? "rgba(245,158,11,0.3)" : isPrice ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: "10px", padding: "0.875rem", marginBottom: "0.75rem"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem" }}>
                                {isStockZero ? "🚨" : isLow ? "⚠️" : isPrice ? "💰" : "📦"} {n.product?.name || n.product?.barcode || "Ürün"}
                            </span>
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{n.marketplace?.name || ""}</span>
                        </div>
                        {n.changes?.field === "stock" && (
                            <div style={{ marginTop: "0.5rem", color: isStockZero ? "#ef4444" : isLow ? "#f59e0b" : "#4ecdc4", fontSize: "0.85rem", fontWeight: 600 }}>
                                Stok: {n.changes.oldValue} → {n.changes.newValue}
                                {isStockZero && " ⚠️ STOK BİTTİ"}
                                {isLow && " — Düşük stok"}
                            </div>
                        )}
                        {n.changes?.field === "price" && (
                            <div style={{ marginTop: "0.5rem", color: "#8b5cf6", fontSize: "0.85rem", fontWeight: 600 }}>
                                Fiyat: {n.changes.oldValue} ₺ → {n.changes.newValue} ₺
                            </div>
                        )}
                        {n.affectedMarketplaces?.length > 0 && (
                            <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                                {n.affectedMarketplaces.map((amp, j) => (
                                    <span key={j} style={{
                                        padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600,
                                        background: amp.syncStatus === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                                        color: amp.syncStatus === "success" ? "#22c55e" : "#ef4444",
                                        border: `1px solid ${amp.syncStatus === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                                    }}>
                                        {amp.syncStatus === "success" ? "✅" : "❌"} {amp.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </motion.div>
    );
};

// ─── Satır içi Stok+Fiyat Düzenleme Bileşeni ─────────────────────
const InlineEditor = ({ product, onSave, onCancel }) => {
    const [stock, setStock]         = useState(String(product.stockTracking?.totalStock ?? 0));
    const [price, setPrice]         = useState(String(product.masterProduct?.price ?? ""));
    const [listPrice, setListPrice] = useState(String(product.masterProduct?.listPrice ?? ""));
    const [saving, setSaving]       = useState(false);

    const handleSave = async () => {
        if (stock === "" || Number(stock) < 0) return;
        setSaving(true);
        await onSave(product._id, Number(stock), {
            salePrice: price ? Number(price) : undefined,
            listPrice: listPrice ? Number(listPrice) : undefined
        });
        setSaving(false);
    };

    return (
        <div className="pm-inline-editor">
            <div className="pm-inline-editor-row">
                <div className="pm-inline-field">
                    <label>📦 Stok</label>
                    <input type="number" className="pm-input pm-input-xs" value={stock}
                        onChange={e => setStock(e.target.value)} min="0" style={{ width: "70px" }} autoFocus />
                </div>
                <div className="pm-inline-field">
                    <label>💰 Fiyat (₺)</label>
                    <input type="number" className="pm-input pm-input-xs" value={price}
                        onChange={e => setPrice(e.target.value)} min="0" step="0.01" style={{ width: "90px" }} />
                </div>
                <div className="pm-inline-field">
                    <label>🏷️ Liste Fiyatı (₺)</label>
                    <input type="number" className="pm-input pm-input-xs" value={listPrice}
                        onChange={e => setListPrice(e.target.value)} min="0" step="0.01" style={{ width: "90px" }} />
                </div>
                <div className="pm-inline-actions">
                    <button className="pm-btn-icon pm-btn-success-sm" onClick={handleSave} disabled={saving} title="Kaydet & Tüm Pazaryerlerine Senkronize Et">
                        {saving ? <FaSpinner className="pm-spin" /> : <FaSave />}
                    </button>
                    <button className="pm-btn-icon pm-btn-danger-sm" onClick={onCancel} title="İptal">
                        <FaTimes />
                    </button>
                </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                💡 Kaydet'e basınca tüm pazaryerlerine otomatik senkronize edilir
            </div>
        </div>
    );
};

// ─── Ana Bileşen ──────────────────────────────────────────────────
const ProductSyncPage = ({ userId, marketplaces: propMarketplaces }) => {
    const [products, setProducts]               = useState([]);
    const [marketplaces, setMarketplaces]       = useState(propMarketplaces || []);
    const [loading, setLoading]                 = useState(false);
    const [syncLoading, setSyncLoading]         = useState({});
    const [dashboardData, setDashboardData]     = useState(null);
    const [search, setSearch]                   = useState("");
    const [filterMarketplace, setFilterMarketplace] = useState("");
    const [filterStock, setFilterStock]         = useState("");
    const [page, setPage]                       = useState(0);
    const [totalPages, setTotalPages]           = useState(0);
    const [totalProducts, setTotalProducts]     = useState(0);
    const [activeTab, setActiveTab]             = useState("products");
    const [bulkSource, setBulkSource]           = useState("");
    const [bulkTargets, setBulkTargets]         = useState([]);
    const [bulkResult, setBulkResult]           = useState(null);
    const [editingProduct, setEditingProduct]   = useState(null);
    const [notification, setNotification]       = useState(null);
    const [liveNotifications, setLiveNotifications] = useState([]);
    const [showLivePanel, setShowLivePanel]     = useState(false);
    const [autoSyncActive, setAutoSyncActive]   = useState(false);
    const [unreadCount, setUnreadCount]         = useState(0);
    const autoSyncRef = useRef(null);

    const showNotif = (message, type = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    // ─── Normalize ───────────────────────────────────────────────
    const normalizeMpName = (name) => {
        if (!name) return "";
        const n = name.trim().toLowerCase();
        if (n === "trendyol")                          return "Trendyol";
        if (n === "hepsiburada")                       return "Hepsiburada";
        if (n === "n11")                               return "N11";
        if (n === "amazon")                            return "Amazon";
        if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
        return name.trim();
    };

    // ─── Veri Yükleme ─────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (search)           params.search      = search;
            if (filterMarketplace) params.marketplace = filterMarketplace;
            if (filterStock)      params.stockStatus  = filterStock;
            const data = await getProducts(params);
            setProducts(data.products || []);
            setTotalPages(data.totalPages || 0);
            setTotalProducts(data.total || 0);
        } catch (err) {
            console.error("Ürünler yüklenemedi:", err);
        } finally {
            setLoading(false);
        }
    }, [page, search, filterMarketplace, filterStock]);

    const loadDashboard = useCallback(async () => {
        try {
            const data = await getProductManagementDashboard();
            setDashboardData(data.dashboard);
        } catch (err) {
            console.error("Dashboard yüklenemedi:", err);
        }
    }, []);

    const loadLiveNotifications = useCallback(async () => {
        try {
            const data = await getUnreadNotifications();
            setLiveNotifications(data.notifications || []);
            setUnreadCount(data.counts?.total || 0);
        } catch (err) {
            console.error("Bildirimler yüklenemedi:", err);
        }
    }, []);

    // Pazaryerlerini yükle
    useEffect(() => {
        if (!propMarketplaces || propMarketplaces.length === 0) {
            const uid = userId || localStorage.getItem("userId");
            if (uid) {
                getUserMarketplaces().then(data => {
                    const list = Array.isArray(data) ? data : (data.marketplaces || data.data || []);
                    setMarketplaces(list.map(m => ({ ...m, name: m.marketplaceName || m.name || "" })));
                }).catch(err => console.error("Pazaryerleri yüklenemedi:", err));
            }
        } else {
            setMarketplaces(propMarketplaces.map(m => ({ ...m, name: m.marketplaceName || m.name || "" })));
        }
    }, [userId, propMarketplaces]);

    useEffect(() => { loadProducts(); },           [loadProducts]);
    useEffect(() => { loadDashboard(); },          [loadDashboard]);
    useEffect(() => { loadLiveNotifications(); },  [loadLiveNotifications]);

    // 15 saniyede bir bildirim polling
    useEffect(() => {
        const interval = setInterval(loadLiveNotifications, 15000);
        return () => clearInterval(interval);
    }, [loadLiveNotifications]);

    // ─── Otomatik Senkronizasyon ──────────────────────────────────
    const startAutoSync = () => {
        setAutoSyncActive(true);
        showNotif("🔄 Otomatik senkronizasyon başlatıldı", "info");
        autoSyncRef.current = setInterval(async () => {
            try {
                await triggerAutoSync();   // Backend'e gerçek istek
                await loadProducts();
                await loadLiveNotifications();
            } catch (err) {
                console.error("Otomatik sync hatası:", err);
            }
        }, 30000);
    };

    const stopAutoSync = () => {
        setAutoSyncActive(false);
        if (autoSyncRef.current) { clearInterval(autoSyncRef.current); autoSyncRef.current = null; }
        showNotif("⏹️ Otomatik senkronizasyon durduruldu", "warning");
    };

    useEffect(() => () => { if (autoSyncRef.current) clearInterval(autoSyncRef.current); }, []);

    // ─── Pazaryerinden Ürün Çek ───────────────────────────────────
    const handleSyncFromMarketplace = async (mp) => {
        const mpName = mp.marketplaceName || mp.name;
        setSyncLoading(prev => ({ ...prev, [mpName]: true }));
        try {
            const result = await syncFromMarketplace(mp._id, mpName);
            const stats  = result.stats || result || {};
            const newCount     = stats.new     || 0;
            const updatedCount = stats.updated || 0;
            const errorCount   = stats.errors  || 0;
            const totalCount   = stats.total   || 0;
            let msg = `${mpName}: `;
            if (totalCount === 0) {
                msg += stats.message || "Mağazada henüz ürün bulunamadı";
            } else {
                if (newCount > 0)     msg += `${newCount} yeni ürün eklendi`;
                if (updatedCount > 0) msg += `${newCount > 0 ? ", " : ""}${updatedCount} ürün güncellendi`;
                if (newCount === 0 && updatedCount === 0) msg += "Tüm ürünler zaten güncel";
                if (errorCount > 0)   msg += ` (${errorCount} hata)`;
            }
            showNotif(msg, errorCount > 0 ? "warning" : "success");
            loadProducts();
            loadDashboard();
        } catch (err) {
            const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Bilinmeyen hata";
            showNotif(`❌ ${mpName}: ${errMsg}`, "error");
        } finally {
            setSyncLoading(prev => ({ ...prev, [mpName]: false }));
        }
    };

    // ─── Stok + Fiyat Güncelle ────────────────────────────────────
    const handleStockPriceSync = async (productId, newStock, priceUpdate) => {
        try {
            const hasPriceUpdate = priceUpdate?.salePrice !== undefined;
            const result = await syncStock(productId, newStock, hasPriceUpdate ? priceUpdate : null);
            const mpResults  = result.result?.marketplaces || [];
            const successMp  = mpResults.filter(m => m.syncStatus === "success").length;
            const errorMp    = mpResults.filter(m => m.syncStatus === "error").length;
            let msg = `✅ Stok: ${newStock}`;
            if (hasPriceUpdate) msg += `, Fiyat: ${priceUpdate.salePrice} ₺`;
            if (mpResults.length > 0) msg += ` — ${successMp} pazaryerinde senkronize edildi`;
            if (errorMp > 0) msg += `, ${errorMp} hata`;
            showNotif(msg, errorMp > 0 ? "warning" : "success");
            setEditingProduct(null);
            loadProducts();
            loadLiveNotifications();
        } catch (err) {
            showNotif("Güncelleme hatası: " + (err.response?.data?.error || err.message), "error");
        }
    };

    // ─── Tek Ürün Dağıt ───────────────────────────────────────────
    const handleDistribute = async (product, targets) => {
        try {
            const result      = await distributeProduct(product._id, targets);
            const resultList  = result.results || [];
            const successCount = resultList.filter(r => r.status === "success").length;
            const skippedCount = resultList.filter(r => r.status === "skipped").length;
            const errorCount   = resultList.filter(r => r.status === "error").length;
            const productName  = product.masterProduct?.name || "Ürün";
            let msg = `${productName}: `;
            if (successCount > 0) msg += `${successCount} pazaryerine yüklendi`;
            if (skippedCount > 0) msg += `${successCount > 0 ? ", " : ""}${skippedCount} zaten mevcut`;
            if (errorCount   > 0) msg += ` — ${errorCount} hata`;
            if (successCount === 0 && skippedCount === 0) msg += "İşlem tamamlandı";
            showNotif(msg, errorCount > 0 ? "warning" : successCount > 0 ? "success" : "info");
            loadProducts();
        } catch (err) {
            showNotif("Dağıtım hatası: " + (err.response?.data?.error || err.message), "error");
        }
    };

    // ─── Toplu Dağıtım ────────────────────────────────────────────
    const handleBulkDistribute = async () => {
        if (!bulkSource || bulkTargets.length === 0) {
            showNotif("Kaynak ve hedef pazaryerlerini seçin", "error");
            return;
        }
        setSyncLoading(prev => ({ ...prev, bulk: true }));
        setBulkResult(null);
        try {
            const result = await bulkDistribute(bulkSource, bulkTargets);
            const stats  = result.results || result || {};
            setBulkResult(stats);
            showNotif(
                `Toplu dağıtım tamamlandı — Toplam: ${stats.total || 0}, Yüklendi: ${stats.distributed || 0}, Atlandı: ${stats.skipped || 0}${stats.errors > 0 ? `, Hata: ${stats.errors}` : ""}`,
                stats.errors > 0 ? "warning" : "success"
            );
            loadProducts();
            loadDashboard();
        } catch (err) {
            showNotif("Toplu dağıtım hatası: " + (err.response?.data?.error || err.message), "error");
        } finally {
            setSyncLoading(prev => ({ ...prev, bulk: false }));
        }
    };

    const toggleBulkTarget = (name) => {
        setBulkTargets(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    };

    // ─── Pazaryeri Durumu ─────────────────────────────────────────
    const getMarketplaceStatus = (product, mpName) => {
        const normalizedTarget = normalizeMpName(mpName);
        const mapping = product.marketplaceMappings?.find(
            m => normalizeMpName(m.marketplaceName) === normalizedTarget
        );
        if (!mapping) return "missing";
        if (mapping.syncStatus === "synced") return "synced";
        if (mapping.syncStatus === "error")  return "error";
        return "pending";
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "synced":  return <FaCheckCircle style={{ color: "#22c55e" }} title="Senkronize" />;
            case "error":   return <FaTimesCircle style={{ color: "#ef4444" }} title="Hata" />;
            case "pending": return <FaSyncAlt     style={{ color: "#f59e0b" }} title="Bekliyor" />;
            default:        return <FaTimes       style={{ color: "#64748b" }} title="Yüklenmemiş" />;
        }
    };

    // ─── Dashboard Kartları ───────────────────────────────────────
    const renderDashboardCards = () => {
        if (!dashboardData) return null;
        const { products: pStats } = dashboardData;
        return (
            <div className="pm-dashboard-cards">
                {[
                    { icon: "📦", value: pStats?.total     || 0, label: "Toplam Ürün",         color: "#4ecdc4", grad: "linear-gradient(135deg,#4ecdc4,#44a08d)" },
                    { icon: "✅", value: pStats?.healthy   || 0, label: "Sağlıklı Stok",       color: "#22c55e", grad: "linear-gradient(135deg,#22c55e,#16a34a)" },
                    { icon: "⚠️", value: pStats?.lowStock  || 0, label: "Düşük Stok",          color: "#f59e0b", grad: "linear-gradient(135deg,#f59e0b,#d97706)" },
                    { icon: "🚫", value: pStats?.outOfStock|| 0, label: "Stokta Yok",          color: "#ef4444", grad: "linear-gradient(135deg,#ef4444,#dc2626)" },
                    { icon: "🔔", value: unreadCount,            label: "Okunmamış Bildirim",  color: "#8b5cf6", grad: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }
                ].map((card, i) => (
                    <motion.div key={i} className="pm-dash-card" style={{ borderColor: `${card.color}40` }}
                        whileHover={{ y: -4, boxShadow: `0 8px 25px ${card.color}30` }}>
                        <div className="pm-dash-card-icon" style={{ background: card.grad }}>{card.icon}</div>
                        <div className="pm-dash-card-info">
                            <span className="pm-dash-card-value" style={{ color: card.color }}>{card.value}</span>
                            <span className="pm-dash-card-label">{card.label}</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        );
    };

    // ─── Ürün Listesi Tab ─────────────────────────────────────────
    const renderProductsTab = () => (
        <>
            {/* Filtreler */}
            <div className="pm-filters">
                <div className="pm-search-box">
                    <FaSearch />
                    <input type="text" placeholder="Ürün adı, barkod veya SKU ara..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
                </div>
                <select className="pm-filter-select" value={filterMarketplace}
                    onChange={e => { setFilterMarketplace(e.target.value); setPage(0); }}>
                    <option value="">Tüm Pazaryerleri</option>
                    {marketplaces.map(mp => (
                        <option key={mp._id} value={mp.marketplaceName || mp.name}>{mp.marketplaceName || mp.name}</option>
                    ))}
                </select>
                <select className="pm-filter-select" value={filterStock}
                    onChange={e => { setFilterStock(e.target.value); setPage(0); }}>
                    <option value="">Tüm Stok Durumları</option>
                    <option value="outOfStock">Stokta Yok</option>
                    <option value="lowStock">Düşük Stok</option>
                </select>
                <span className="pm-result-count">{totalProducts} ürün</span>
            </div>

            {/* Bilgi Kutusu */}
            <div style={{
                background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)",
                borderRadius: "10px", padding: "0.875rem 1.25rem", marginBottom: "1.25rem",
                display: "flex", alignItems: "center", gap: "0.75rem"
            }}>
                <FaInfoCircle style={{ color: "#4ecdc4", flexShrink: 0 }} />
                <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                    <strong style={{ color: "#4ecdc4" }}>Stok veya fiyatı güncellemek için</strong> satırdaki
                    <strong style={{ color: "#fff" }}> ✏️ Düzenle</strong> butonuna tıklayın.
                    Kaydettiğinizde <strong style={{ color: "#22c55e" }}>tüm pazaryerlerine otomatik senkronize edilir.</strong>
                </span>
            </div>

            {loading ? (
                <div className="pm-loading"><FaSpinner className="pm-spin" /> Ürünler yükleniyor...</div>
            ) : products.length === 0 ? (
                <div className="pm-empty-state">
                    <FaBoxOpen style={{ fontSize: "3rem", color: "#4ecdc4" }} />
                    <h3>Henüz ürün yok</h3>
                    <p>Pazaryerlerinden ürün çekin veya yeni ürün ekleyin.</p>
                </div>
            ) : (
                <div className="pm-table-wrapper">
                    <table className="pm-table">
                        <thead>
                            <tr>
                                <th>Ürün</th>
                                <th>Barkod / SKU</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                {marketplaces.slice(0, 5).map(mp => (
                                    <th key={mp._id} className="pm-th-mp">{mp.marketplaceName || mp.name}</th>
                                ))}
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(product => (
                                <React.Fragment key={product._id}>
                                    <motion.tr
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="pm-table-row"
                                    >
                                        {/* Ürün */}
                                        <td>
                                            <div className="pm-product-cell">
                                                {product.masterProduct.images?.[0] && (
                                                    <img src={product.masterProduct.images[0]} alt=""
                                                        className="pm-product-thumb"
                                                        onError={e => { e.target.style.display = "none"; }} />
                                                )}
                                                <div>
                                                    <span className="pm-product-name">{product.masterProduct.name}</span>
                                                    <span className="pm-product-category">{product.masterProduct.category || "—"}</span>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Barkod */}
                                        <td>
                                            <div className="pm-barcode-cell">
                                                <span className="pm-barcode">{product.masterProduct.barcode}</span>
                                                <span className="pm-sku">{product.masterProduct.sku}</span>
                                            </div>
                                        </td>
                                        {/* Fiyat */}
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                                <span className="pm-price">{product.masterProduct.price?.toFixed(2)} ₺</span>
                                                {product.masterProduct.listPrice && product.masterProduct.listPrice > product.masterProduct.price && (
                                                    <span style={{ color: "#64748b", fontSize: "0.78rem", textDecoration: "line-through" }}>
                                                        {product.masterProduct.listPrice?.toFixed(2)} ₺
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Stok */}
                                        <td>
                                            <span
                                                className={`pm-stock ${product.stockTracking?.isOutOfStock ? "out" : product.stockTracking?.isLowStock ? "low" : "ok"}`}
                                            >
                                                {product.stockTracking?.totalStock ?? 0}
                                            </span>
                                        </td>
                                        {/* Pazaryeri Durumları */}
                                        {marketplaces.slice(0, 5).map(mp => {
                                            const mpName = mp.marketplaceName || mp.name;
                                            const status = getMarketplaceStatus(product, mpName);
                                            return (
                                                <td key={mp._id} className="pm-td-mp">
                                                    <div className="pm-mp-status">{getStatusIcon(status)}</div>
                                                </td>
                                            );
                                        })}
                                        {/* İşlemler */}
                                        <td>
                                            <div className="pm-actions">
                                                <button
                                                    className="pm-btn pm-btn-outline pm-btn-xs"
                                                    title="Stok ve fiyat düzenle — tüm pazaryerlerine senkronize edilir"
                                                    onClick={() => setEditingProduct(editingProduct === product._id ? null : product._id)}
                                                >
                                                    <FaEdit /> Düzenle
                                                </button>
                                                <button
                                                    className="pm-btn pm-btn-outline pm-btn-xs"
                                                    title="Eksik pazaryerlerine dağıt"
                                                    onClick={() => {
                                                        const missing = marketplaces
                                                            .map(mp => normalizeMpName(mp.marketplaceName || mp.name))
                                                            .filter(name => getMarketplaceStatus(product, name) === "missing");
                                                        if (missing.length === 0) {
                                                            showNotif("✅ Ürün tüm pazaryerlerinde mevcut", "info");
                                                        } else {
                                                            handleDistribute(product, missing);
                                                        }
                                                    }}
                                                >
                                                    <FaCloudUploadAlt /> Dağıt
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                    {/* Satır içi düzenleme paneli */}
                                    {editingProduct === product._id && (
                                        <tr>
                                            <td colSpan={5 + Math.min(marketplaces.length, 5) + 1} style={{ padding: "0 1rem 1rem 1rem", background: "rgba(78,205,196,0.04)" }}>
                                                <InlineEditor
                                                    product={product}
                                                    onSave={handleStockPriceSync}
                                                    onCancel={() => setEditingProduct(null)}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="pm-pagination">
                    <button className="pm-btn pm-btn-outline pm-btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button>
                    <span className="pm-page-info">Sayfa {page + 1} / {totalPages}</span>
                    <button className="pm-btn pm-btn-outline pm-btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki →</button>
                </div>
            )}
        </>
    );

    // ─── Pazaryerinden Çek Tab ────────────────────────────────────
    const renderSyncTab = () => (
        <div className="pm-sync-section">
            <div style={{
                background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)",
                borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem"
            }}>
                <h4 style={{ color: "#4ecdc4", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FaInfoCircle /> Nasıl Çalışır?
                </h4>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0, lineHeight: 1.6 }}>
                    Seçtiğiniz pazaryerinden tüm ürünler çekilir.{" "}
                    <strong style={{ color: "#fff" }}>Barkod / SKU eşleştirmesi</strong> yapılır:
                    aynı barkodlu ürünler güncellenir (stok + fiyat), yeni ürünler sisteme eklenir.
                    Mevcut ürünler tekrar yüklenmez.
                </p>
            </div>

            <h3 className="pm-section-title"><FaCloudDownloadAlt /> Pazaryerinden Ürün Çek</h3>
            <div className="pm-sync-grid">
                {marketplaces.map(mp => {
                    const mpName    = mp.marketplaceName || mp.name;
                    const isLoading = syncLoading[mpName];
                    const mpStat    = dashboardData?.marketplaces?.find(s => s.name === mpName);
                    return (
                        <motion.div key={mp._id} className="pm-sync-card" whileHover={{ scale: 1.02 }}>
                            <div className="pm-sync-card-header">
                                <h4>{mpName}</h4>
                                {mpStat && (
                                    <span className="pm-sync-stat">{mpStat.totalProducts} ürün / {mpStat.syncedProducts} senkron</span>
                                )}
                            </div>
                            <div className="pm-sync-card-body">
                                <div className="pm-sync-info">
                                    <span>✅ Senkronize: {mpStat?.syncedProducts || 0}</span>
                                    <span>⏳ Bekleyen: {mpStat?.unsyncedProducts || 0}</span>
                                </div>
                                <button
                                    className="pm-btn pm-btn-primary pm-btn-sm"
                                    onClick={() => handleSyncFromMarketplace(mp)}
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? <><FaSpinner className="pm-spin" /> Çekiliyor...</>
                                        : <><FaSyncAlt /> Ürünleri Çek</>
                                    }
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
            {marketplaces.length === 0 && (
                <div className="pm-empty-state"><p>⚠️ Henüz pazaryeri entegrasyonu yapılmamış.</p></div>
            )}
        </div>
    );

    // ─── Toplu Dağıtım Tab ────────────────────────────────────────
    const renderBulkTab = () => (
        <div className="pm-bulk-section">
            <div style={{
                background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)",
                borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem"
            }}>
                <h4 style={{ color: "#4ecdc4", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FaInfoCircle /> Akıllı Dağıtım Sistemi
                </h4>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0, lineHeight: 1.6 }}>
                    Kaynak pazaryerindeki ürünler hedef pazaryerlerine dağıtılır.
                    <strong style={{ color: "#22c55e" }}> Zaten mevcut olan ürünler atlanır</strong> — sadece eksik olanlar yüklenir.
                    Stok ve fiyatlar otomatik eşitlenir.
                </p>
            </div>

            <h3 className="pm-section-title"><FaExchangeAlt /> Toplu Ürün Dağıtımı</h3>
            <div className="pm-bulk-config">
                <div className="pm-bulk-step">
                    <h4>1️⃣ Kaynak Pazaryeri</h4>
                    <p>Ürünlerin çekileceği pazaryerini seçin</p>
                    <div className="pm-bulk-mp-list">
                        {marketplaces.map(mp => {
                            const mpName = mp.marketplaceName || mp.name;
                            return (
                                <button key={mp._id}
                                    className={`pm-bulk-mp-btn ${bulkSource === mpName ? "selected" : ""}`}
                                    onClick={() => { setBulkSource(mpName); setBulkTargets(prev => prev.filter(t => t !== mpName)); }}
                                >
                                    🏪 {mpName}{bulkSource === mpName && " ✓"}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="pm-bulk-arrow"><FaArrowRight /></div>
                <div className="pm-bulk-step">
                    <h4>2️⃣ Hedef Pazaryerleri</h4>
                    <p>Ürünlerin yükleneceği pazaryerlerini seçin (çoklu seçim)</p>
                    <div className="pm-bulk-mp-list">
                        {marketplaces.filter(mp => (mp.marketplaceName || mp.name) !== bulkSource).map(mp => {
                            const mpName     = mp.marketplaceName || mp.name;
                            const isSelected = bulkTargets.includes(mpName);
                            return (
                                <button key={mp._id}
                                    className={`pm-bulk-mp-btn ${isSelected ? "selected" : ""}`}
                                    onClick={() => toggleBulkTarget(mpName)}
                                >
                                    {isSelected ? <FaCheck /> : null} 🏪 {mpName}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {bulkSource && bulkTargets.length > 0 && (
                <motion.div className="pm-bulk-summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <p>
                        📋 <strong style={{ color: "#4ecdc4" }}>{bulkSource}</strong>
                        {" → "}
                        <strong style={{ color: "#22c55e" }}>{bulkTargets.join(", ")}</strong>
                    </p>
                    <p>Mevcut ürünler atlanacak, sadece eksik olanlar yüklenecek. Stok ve fiyatlar otomatik eşitlenecek.</p>
                    <button className="pm-btn pm-btn-success" onClick={handleBulkDistribute} disabled={syncLoading.bulk}>
                        {syncLoading.bulk
                            ? <><FaSpinner className="pm-spin" /> Dağıtılıyor...</>
                            : <><FaCloudUploadAlt /> Toplu Dağıtımı Başlat</>
                        }
                    </button>
                </motion.div>
            )}

            {bulkResult && (
                <motion.div className="pm-bulk-result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h4>📊 Dağıtım Sonuçları</h4>
                    <div className="pm-bulk-result-stats">
                        <span className="pm-stat-badge success">✅ Dağıtılan: {bulkResult.distributed || 0}</span>
                        <span className="pm-stat-badge warning">⏭️ Atlanan: {bulkResult.skipped || 0}</span>
                        <span className="pm-stat-badge error">❌ Hata: {bulkResult.errors || 0}</span>
                        <span className="pm-stat-badge info">📦 Toplam: {bulkResult.total || 0}</span>
                    </div>
                </motion.div>
            )}
        </div>
    );

    // ─── Stok Takip Tab ───────────────────────────────────────────
    const renderStockTab = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Otomatik Senkronizasyon */}
            <div style={{
                background: autoSyncActive ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${autoSyncActive ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "16px", padding: "2rem"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                        <h3 style={{ color: "#fff", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {autoSyncActive && <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />}
                            🔄 Otomatik Stok & Fiyat Senkronizasyonu
                        </h3>
                        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
                            {autoSyncActive
                                ? "Aktif — Her 30 saniyede bir stok ve fiyatlar tüm pazaryerlerine yansıtılıyor."
                                : "Pasif — Başlatıldığında stok ve fiyatlar otomatik olarak tüm pazaryerlerine senkronize edilir."
                            }
                        </p>
                    </div>
                    <button className={`pm-btn ${autoSyncActive ? "pm-btn-outline" : "pm-btn-success"}`}
                        onClick={autoSyncActive ? stopAutoSync : startAutoSync} style={{ minWidth: "160px" }}>
                        {autoSyncActive ? <><FaStop /> Durdur</> : <><FaPlay /> Başlat</>}
                    </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
                    {[
                        { label: "Senkronizasyon Aralığı", value: "30 saniye",                    icon: "⏱️" },
                        { label: "Sipariş Sonrası",         value: "Anlık stok güncelleme",        icon: "🛒" },
                        { label: "Fiyat Değişiminde",       value: "Tüm platformlara yansıtılır",  icon: "💰" }
                    ].map((item, i) => (
                        <div key={i} style={{
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "10px", padding: "1rem"
                        }}>
                            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                            <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "0.25rem" }}>{item.label}</div>
                            <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem" }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stok Durumu Özeti */}
            <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px", padding: "2rem"
            }}>
                <h3 style={{ color: "#fff", margin: "0 0 1.5rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <FaChartBar style={{ color: "#4ecdc4" }} /> Stok & Fiyat Durumu
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>
                    {[
                        { label: "Toplam Ürün",    value: dashboardData?.products?.total      || 0, color: "#4ecdc4", icon: "📦" },
                        { label: "Sağlıklı Stok",  value: dashboardData?.products?.healthy    || 0, color: "#22c55e", icon: "✅" },
                        { label: "Düşük Stok (≤10)",value: dashboardData?.products?.lowStock  || 0, color: "#f59e0b", icon: "⚠️" },
                        { label: "Stok Tükendi",   value: dashboardData?.products?.outOfStock || 0, color: "#ef4444", icon: "🚫" }
                    ].map((stat, i) => (
                        <div key={i} style={{
                            background: `${stat.color}10`, border: `1px solid ${stat.color}30`,
                            borderRadius: "12px", padding: "1.5rem", textAlign: "center"
                        }}>
                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
                            <div style={{ color: stat.color, fontSize: "2rem", fontWeight: 800 }}>{stat.value}</div>
                            <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Son Hareketler */}
            <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px", padding: "2rem"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                    <h3 style={{ color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <FaBell style={{ color: "#f59e0b" }} /> Son Stok & Fiyat Hareketleri
                        {unreadCount > 0 && (
                            <span style={{
                                background: "#ef4444", color: "#fff", padding: "0.2rem 0.6rem",
                                borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700
                            }}>{unreadCount}</span>
                        )}
                    </h3>
                    <button className="pm-btn pm-btn-outline pm-btn-sm" onClick={loadLiveNotifications}>
                        <FaSyncAlt /> Yenile
                    </button>
                </div>
                {liveNotifications.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        <FaBell style={{ fontSize: "2rem", marginBottom: "0.5rem" }} />
                        <p>Henüz stok veya fiyat hareketi yok</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {liveNotifications.slice(0, 15).map((n, i) => {
                            const isZero  = n.changes?.field === "stock" && n.changes?.newValue === 0;
                            const isLow   = n.changes?.field === "stock" && n.changes?.newValue > 0 && n.changes?.newValue <= 10;
                            const isPrice = n.changes?.field === "price";
                            return (
                                <div key={n._id || i} style={{
                                    background: isZero ? "rgba(239,68,68,0.08)" : isLow ? "rgba(245,158,11,0.08)" : isPrice ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${isZero ? "rgba(239,68,68,0.2)" : isLow ? "rgba(245,158,11,0.2)" : isPrice ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.08)"}`,
                                    borderRadius: "10px", padding: "1rem",
                                    display: "flex", justifyContent: "space-between", alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ color: "#fff", fontWeight: 600, marginBottom: "0.25rem" }}>
                                            {isZero ? "🚨" : isLow ? "⚠️" : isPrice ? "💰" : "📦"} {n.product?.name || n.product?.barcode || "Ürün"}
                                        </div>
                                        {n.changes?.field === "stock" && (
                                            <div style={{ color: isZero ? "#ef4444" : isLow ? "#f59e0b" : "#4ecdc4", fontSize: "0.85rem" }}>
                                                Stok: {n.changes.oldValue} → <strong>{n.changes.newValue}</strong>
                                                {isZero && " — TÜM PAZARYERLERİNDE GÜNCELLENDI"}
                                            </div>
                                        )}
                                        {n.changes?.field === "price" && (
                                            <div style={{ color: "#8b5cf6", fontSize: "0.85rem" }}>
                                                Fiyat: {n.changes.oldValue} ₺ → <strong>{n.changes.newValue} ₺</strong>
                                            </div>
                                        )}
                                        {n.affectedMarketplaces?.length > 0 && (
                                            <div style={{ marginTop: "0.375rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                                                {n.affectedMarketplaces.map((amp, j) => (
                                                    <span key={j} style={{
                                                        fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "6px",
                                                        background: amp.syncStatus === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                                                        color: amp.syncStatus === "success" ? "#22c55e" : "#ef4444"
                                                    }}>
                                                        {amp.syncStatus === "success" ? "✅" : "❌"} {amp.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: "0.8rem", textAlign: "right", flexShrink: 0, marginLeft: "1rem" }}>
                                        {n.marketplace?.name && <div>{n.marketplace.name}</div>}
                                        <div>{n.timestamp ? new Date(n.timestamp).toLocaleTimeString("tr-TR") : ""}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────
    return (
        <div className="pm-page">
            <div className="pm-header">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <h1 className="pm-title"><FaSyncAlt /> Ürün Eşitleme & Dağıtım</h1>
                        <p className="pm-subtitle">
                            Pazaryerlerinden ürün çekin, eşleştirin ve otomatik olarak diğer pazaryerlerine dağıtın.
                            Stok ve fiyatlar gerçek zamanlı takip edilir ve tüm platformlara senkronize edilir.
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        {autoSyncActive && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#22c55e", fontSize: "0.85rem", fontWeight: 600 }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                                Canlı Senkronizasyon Aktif
                            </div>
                        )}
                        <button className="pm-btn pm-btn-outline pm-btn-sm"
                            onClick={() => setShowLivePanel(!showLivePanel)} style={{ position: "relative" }}>
                            <FaBell /> Bildirimler
                            {unreadCount > 0 && (
                                <span style={{
                                    position: "absolute", top: "-8px", right: "-8px",
                                    background: "#ef4444", color: "#fff",
                                    width: "20px", height: "20px", borderRadius: "50%",
                                    fontSize: "0.7rem", fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}>{unreadCount}</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {renderDashboardCards()}

            {/* Tabs */}
            <div className="pm-tabs">
                <button className={`pm-tab ${activeTab === "products" ? "active" : ""}`} onClick={() => setActiveTab("products")}>
                    <FaBoxOpen /> Ürün Listesi
                </button>
                <button className={`pm-tab ${activeTab === "sync" ? "active" : ""}`} onClick={() => setActiveTab("sync")}>
                    <FaCloudDownloadAlt /> Pazaryerinden Çek
                </button>
                <button className={`pm-tab ${activeTab === "bulk" ? "active" : ""}`} onClick={() => setActiveTab("bulk")}>
                    <FaExchangeAlt /> Toplu Dağıtım
                </button>
                <button className={`pm-tab ${activeTab === "stock" ? "active" : ""}`} onClick={() => setActiveTab("stock")}>
                    <FaChartBar /> Stok & Fiyat Takibi
                    {unreadCount > 0 && <span className="pm-tab-badge">{unreadCount}</span>}
                </button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === "products" && renderProductsTab()}
                    {activeTab === "sync"     && renderSyncTab()}
                    {activeTab === "bulk"     && renderBulkTab()}
                    {activeTab === "stock"    && renderStockTab()}
                </motion.div>
            </AnimatePresence>

            {/* Canlı Bildirim Paneli */}
            <AnimatePresence>
                {showLivePanel && (
                    <StockMonitorPanel notifications={liveNotifications} onClose={() => setShowLivePanel(false)} />
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        className={`pm-toast ${notification.type}`}
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0,  x: "-50%" }}
                        exit={{ opacity: 0, y: 50,    x: "-50%" }}
                    >
                        {notification.type === "success" ? "✅" :
                         notification.type === "error"   ? "❌" :
                         notification.type === "warning" ? "⚠️" : "ℹ️"} {notification.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    );
};

export default ProductSyncPage;
