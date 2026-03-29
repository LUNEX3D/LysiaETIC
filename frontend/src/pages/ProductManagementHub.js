/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 ÜRÜN YÖNETİM MERKEZİ — ProductManagementHub.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * Dashboard content-area (position:fixed, padding:2rem, overflow-y:auto) içinde
 * tam sayfa olarak çalışır. CSS'de margin:-2rem ile padding sıfırlanır.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBoxOpen, FaSearch, FaSync, FaStore, FaWarehouse,
    FaMoneyBillWave, FaChartBar, FaEdit, FaTimes, FaSave,
    FaChevronDown, FaChevronUp, FaSpinner, FaInfoCircle,
    FaFilter, FaEye, FaTag, FaPercent, FaLayerGroup,
    FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
    FaArrowUp, FaArrowDown, FaClipboardList, FaHistory
} from "react-icons/fa";
import {
    getProducts, syncAllMarketplaces, syncStock, syncPrice,
    getProductManagementDashboard, getSyncLogs
} from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementHub.css";

/* ─── Sabitler ─────────────────────────────────────────────────────────────── */
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
const PAGE_SIZE = 12;

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

    /* ── State ── */
    const [activeTab, setActiveTab]           = useState("catalog");
    const [toasts, setToasts]                 = useState([]);
    const toastId                             = useRef(0);
    const [marketplaces, setMarketplaces]     = useState([]);
    const [products, setProducts]             = useState([]);
    const [totalProducts, setTotalProducts]   = useState(0);
    const [loading, setLoading]               = useState(false);
    const [syncing, setSyncing]               = useState(false);
    const [dashboardData, setDashboardData]   = useState(null);
    const [syncLogs, setSyncLogs]             = useState([]);
    const [searchQuery, setSearchQuery]       = useState("");
    const [filterMarketplace, setFilterMarketplace] = useState("all");
    const [filterStock, setFilterStock]       = useState("all");
    const [currentPage, setCurrentPage]       = useState(1);
    const [showFilters, setShowFilters]       = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [platformPrices, setPlatformPrices] = useState({});
    const [platformStocks, setPlatformStocks] = useState({});
    const [savingPrices, setSavingPrices]     = useState(false);
    const [detailProduct, setDetailProduct]   = useState(null);

    /* ── Toast ── */
    const addToast = useCallback((message, type = "info") => {
        const id = ++toastId.current;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = useCallback((id) =>
        setToasts(p => p.filter(t => t.id !== id)), []);

    /* ── Pazaryerleri ── */
    useEffect(() => {
        if (!userId) return;
        getUserMarketplaces(userId)
            .then(data => setMarketplaces(
                data.map(m => ({ ...m, name: m.marketplaceName }))
            ))
            .catch(() => {});
    }, [userId]);

    /* ── Ürünler ── */
    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            // Backend 0-tabanlı sayfalama kullanıyor (page=0 → ilk sayfa)
            const params = {
                page: currentPage - 1, limit: PAGE_SIZE,
                ...(searchQuery && { search: searchQuery }),
                ...(filterMarketplace !== "all" && { marketplace: filterMarketplace }),
                ...(filterStock !== "all" && { stockStatus: filterStock })
            };
            const res = await getProducts(params);
            // Backend: { success, total, products } veya { data, totalCount }
            setProducts(res.products || res.data || []);
            setTotalProducts(res.total || res.totalCount || res.totalProducts || 0);
        } catch (err) {
            console.error("[PMH] loadProducts hatası:", err);
            addToast("Ürünler yüklenirken hata oluştu", "error");
        } finally { setLoading(false); }
    }, [currentPage, searchQuery, filterMarketplace, filterStock, addToast]);

    const loadDashboard = useCallback(async () => {
        try {
            const res = await getProductManagementDashboard();
            // Backend: { success, dashboard: { products: { total, outOfStock, lowStock }, marketplaces: [...], recentLogs } }
            // Frontend stats useMemo'su d.totalProducts vb. bekliyor — düzleştiriyoruz
            const d = res?.dashboard || res || {};
            const prods = d.products || {};
            const normalized = {
                totalProducts:    prods.total      ?? d.totalProducts    ?? 0,
                activeProducts:   prods.healthy    ?? d.activeProducts   ?? 0,
                outOfStock:       prods.outOfStock  ?? d.outOfStock       ?? 0,
                lowStock:         prods.lowStock    ?? d.lowStock         ?? 0,
                syncedProducts:   prods.synced      ?? d.syncedProducts   ?? 0,
                priceMismatch:    d.priceMismatch   ?? 0,
                stockMismatch:    d.stockMismatch   ?? 0,
                totalRevenue:     d.totalRevenue    ?? 0,
                avgPrice:         d.avgPrice        ?? 0,
                marketplaceStats: d.marketplaces    ?? [],
                recentLogs:       d.recentLogs      ?? [],
                unreadNotifications: d.unreadNotifications ?? 0
            };
            setDashboardData(normalized);
        } catch (err) {
            console.error("[PMH] loadDashboard hatası:", err);
            /* sessiz — istatistikler 0 kalır */
        }
    }, []);

    const loadLogs = useCallback(async () => {
        try {
            const data = await getSyncLogs({ limit: 25 });
            // Backend: { success, total, logs: [...] }
            setSyncLogs(data.logs || data || []);
        } catch (err) {
            console.error("[PMH] loadLogs hatası:", err);
            /* sessiz */
        }
    }, []);

    useEffect(() => { loadProducts(); }, [loadProducts]);
    useEffect(() => { loadDashboard(); loadLogs(); }, [loadDashboard, loadLogs]);

    /* ── Senkronizasyon ── */
    const handleSyncAll = async () => {
        setSyncing(true);
        try {
            const res = await syncAllMarketplaces();
            const msg = res?.message || "Tüm pazaryerleri senkronize ediliyor...";
            addToast(msg, "success");
            // 3 saniye sonra verileri yenile
            setTimeout(() => { loadProducts(); loadDashboard(); loadLogs(); }, 3000);
        } catch (err) {
            console.error("[PMH] syncAll hatası:", err);
            const errMsg = err?.response?.data?.error || err?.message || "Senkronizasyon başlatılamadı";
            addToast(errMsg, "error");
        } finally { setSyncing(false); }
    };

    /* ── Platform Fiyat Düzenleme ── */
    const openPriceEditor = (product) => {
        setEditingProduct(product);
        const prices = {};
        const stocks = {};
        if (product.marketplaceData) {
            Object.entries(product.marketplaceData).forEach(([mp, data]) => {
                prices[mp] = {
                    salePrice: data.salePrice || data.price || product.price || 0,
                    listPrice: data.listPrice || data.salePrice || product.listPrice || product.price || 0
                };
                stocks[mp] = data.stock ?? data.quantity ?? product.stock ?? 0;
            });
        }
        marketplaces.forEach(mp => {
            const name = mp.name || mp.marketplaceName;
            if (!prices[name]) {
                prices[name] = {
                    salePrice: product.price || 0,
                    listPrice: product.listPrice || product.price || 0
                };
            }
            if (stocks[name] === undefined) stocks[name] = product.stock ?? 0;
        });
        setPlatformPrices(prices);
        setPlatformStocks(stocks);
    };

    const handlePlatformPriceChange = (mp, field, value) =>
        setPlatformPrices(prev => ({
            ...prev, [mp]: { ...prev[mp], [field]: parseFloat(value) || 0 }
        }));

    const handlePlatformStockChange = (mp, value) =>
        setPlatformStocks(prev => ({ ...prev, [mp]: parseInt(value) || 0 }));

    const applyToAllPlatforms = (field, value) =>
        setPlatformPrices(prev => {
            const u = { ...prev };
            Object.keys(u).forEach(mp => { u[mp] = { ...u[mp], [field]: parseFloat(value) || 0 }; });
            return u;
        });

    const applyStockToAll = (value) =>
        setPlatformStocks(prev => {
            const u = { ...prev };
            Object.keys(u).forEach(mp => { u[mp] = parseInt(value) || 0; });
            return u;
        });

    const savePlatformPrices = async () => {
        if (!editingProduct) return;
        setSavingPrices(true);
        const productId = editingProduct._id || editingProduct.id;
        try {
            // Her platform için fiyat + stok güncelle — sıralı çalıştır (rate-limit'e karşı)
            const results = [];
            for (const [mp, priceData] of Object.entries(platformPrices)) {
                const stock = platformStocks[mp];
                try {
                    if (priceData.salePrice > 0) {
                        await syncPrice(
                            productId,
                            priceData.salePrice,
                            priceData.listPrice || priceData.salePrice
                        );
                    }
                    if (stock !== undefined && stock !== null) {
                        await syncStock(
                            productId,
                            stock,
                            { salePrice: priceData.salePrice, listPrice: priceData.listPrice }
                        );
                    }
                    results.push({ mp, success: true });
                } catch (err) {
                    console.error(`[PMH] ${mp} fiyat/stok güncelleme hatası:`, err);
                    results.push({ mp, success: false, error: err?.response?.data?.error || err.message });
                }
            }
            const succeeded = results.filter(r => r.success).length;
            const failed    = results.filter(r => !r.success).length;
            if (failed === 0) {
                addToast(`Tüm platformlarda fiyat ve stok güncellendi! (${succeeded} platform)`, "success");
            } else if (succeeded > 0) {
                addToast(`${succeeded} platform güncellendi, ${failed} platformda hata oluştu`, "warning");
            } else {
                addToast("Hiçbir platformda güncelleme yapılamadı", "error");
            }
            setEditingProduct(null);
            loadProducts();
            loadDashboard();
        } catch (err) {
            console.error("[PMH] savePlatformPrices genel hata:", err);
            addToast("Güncelleme sırasında beklenmeyen hata oluştu", "error");
        } finally { setSavingPrices(false); }
    };

    /* ── İstatistikler ── */
    const stats = useMemo(() => {
        const d = dashboardData || {};
        return {
            // dashboardData normalize edilmiş geliyor (loadDashboard içinde düzleştirildi)
            totalProducts:    d.totalProducts   || totalProducts || 0,
            activeProducts:   d.activeProducts  || 0,
            outOfStock:       d.outOfStock       || 0,
            lowStock:         d.lowStock         || 0,
            syncedProducts:   d.syncedProducts   || 0,
            priceMismatch:    d.priceMismatch    || 0,
            stockMismatch:    d.stockMismatch    || 0,
            totalRevenue:     d.totalRevenue     || 0,
            avgPrice:         d.avgPrice         || 0,
            marketplaceCount: marketplaces.length
        };
    }, [dashboardData, totalProducts, marketplaces]);

    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

    /* ── Sekme Tanımları ── */
    const tabs = [
        { id: "catalog",   label: "Ürün Kataloğu",   icon: <FaBoxOpen /> },
        { id: "pricing",   label: "Fiyat & Stok",     icon: <FaMoneyBillWave /> },
        { id: "analytics", label: "Analitik",          icon: <FaChartBar /> },
        { id: "sync",      label: "Senkronizasyon",    icon: <FaSync /> },
        { id: "logs",      label: "İşlem Geçmişi",     icon: <FaHistory /> },
    ];

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
