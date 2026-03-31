import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "../services/api";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════
   RENK PALETİ
   ═══════════════════════════════════════════════════════════ */
const C = {
    bg: "#0f1419",
    card: "rgba(26, 31, 53, 0.85)",
    border: "rgba(78, 205, 196, 0.18)",
    accent: "#4ecdc4",
    green: "#22c55e",
    red: "#ef4444",
    yellow: "#f59e0b",
    purple: "#8b5cf6",
    blue: "#06b6d4",
    pink: "#ec4899",
    text: "#e2e8f0",
    muted: "#94a3b8",
    dim: "#64748b",
    glass: "rgba(255,255,255,0.03)",
    glassBr: "rgba(255,255,255,0.06)",
};

const fmtCurrency = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0));
    } catch { return `${Number(v || 0).toFixed(2)} ₺`; }
};

/* ═══════════════════════════════════════════════════════════
   DURUM SINIFLANDIRMA
   ═══════════════════════════════════════════════════════════ */
const classifyStatus = (s) => {
    const l = String(s || "").toLowerCase();
    if (l.includes("created") || l.includes("yeni") || l.includes("new") || l.includes("waiting")) return "new";
    if (l.includes("processing") || l.includes("işlem") || l.includes("hazırlan") || l.includes("picking") || l.includes("approved")) return "processing";
    if (l.includes("shipping") || l.includes("shipped") || l.includes("kargo") || l.includes("transit") || l.includes("invoiced")) return "shipping";
    if (l.includes("delivered") || l.includes("teslim") || l.includes("completed") || l.includes("tamamlan")) return "delivered";
    if (l.includes("cancel") || l.includes("iptal")) return "cancelled";
    if (l.includes("return") || l.includes("iade") || l.includes("refund")) return "returned";
    return "processing";
};

const statusMeta = {
    new: { label: "Yeni", color: C.accent, icon: "🆕" },
    processing: { label: "İşlemde", color: C.yellow, icon: "⚙️" },
    shipping: { label: "Kargoda", color: C.purple, icon: "🚚" },
    delivered: { label: "Teslim Edildi", color: C.green, icon: "✅" },
    cancelled: { label: "İptal", color: C.red, icon: "❌" },
    returned: { label: "İade", color: C.pink, icon: "↩️" },
};

const getStatusBadge = (status) => {
    const cls = classifyStatus(status);
    const meta = statusMeta[cls] || statusMeta.processing;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            background: `${meta.color}15`, border: `1px solid ${meta.color}40`,
            color: meta.color, padding: "0.25rem 0.65rem", borderRadius: 8,
            fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
        }}>
            {meta.icon} {meta.label}
        </span>
    );
};

/* ═══════════════════════════════════════════════════════════
   MARKETPLACE LOGO
   ═══════════════════════════════════════════════════════════ */
const mpColors = {
    trendyol: "#f27a1a",
    n11: "#7b2d8e",
    hepsiburada: "#ff6000",
    çiçeksepeti: "#e91e63",
    ciceksepeti: "#e91e63",
    amazon: "#ff9900",
};

const getMpColor = (name) => {
    const l = String(name || "").toLowerCase();
    return Object.entries(mpColors).find(([k]) => l.includes(k))?.[1] || C.accent;
};

const getMpBadge = (name) => {
    const color = getMpColor(name);
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            background: `${color}18`, border: `1px solid ${color}35`,
            color, padding: "0.22rem 0.6rem", borderRadius: 8,
            fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
        }}>
            {name || "Bilinmiyor"}
        </span>
    );
};

/* ═══════════════════════════════════════════════════════════
   ANA COMPONENT
   ═══════════════════════════════════════════════════════════ */
const OrdersPage = ({ marketplaces = [], userId: propUserId }) => {
    const userId = propUserId || localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMp, setLoadingMp] = useState("");
    const [error, setError] = useState("");

    // Filtreler
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [mpFilter, setMpFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [sortField, setSortField] = useState("orderDate");
    const [sortDir, setSortDir] = useState("desc");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const perPage = 20;

    // Modal
    const [selectedOrder, setSelectedOrder] = useState(null);

    /* ── TÜM PAZARYERLERINDEN SİPARİŞ ÇEK ── */
    const fetchAllOrders = useCallback(async () => {
        if (!marketplaces.length) return;
        setLoading(true);
        setError("");
        const collected = [];

        for (const mp of marketplaces) {
            try {
                setLoadingMp(mp.marketplaceName || mp.name || "...");
                const params = new URLSearchParams({
                    marketplaceId: mp._id,
                    ...(startDate && { startDate }),
                    ...(endDate && { endDate }),
                });

                const response = await axios.get(`/orders/all/${userId}?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const orders = (response.data?.orders || []).map(o => ({
                    ...o,
                    marketplace: response.data?.marketplace || mp.marketplaceName || mp.name || "Bilinmiyor",
                    marketplaceId: mp._id,
                }));
                collected.push(...orders);
            } catch (err) {
                console.error(`❌ ${mp.marketplaceName || mp.name} sipariş hatası:`, err.message);
            }
        }

        // Tarihe göre sırala (en yeni önce)
        collected.sort((a, b) => {
            const da = a.orderDate ? new Date(a.orderDate) : new Date(0);
            const db = b.orderDate ? new Date(b.orderDate) : new Date(0);
            return db - da;
        });

        setAllOrders(collected);
        setCurrentPage(1);
        setLoading(false);
        setLoadingMp("");
    }, [marketplaces, userId, token, startDate, endDate]);

    useEffect(() => {
        fetchAllOrders();
    }, [fetchAllOrders]);

    /* ── FİLTRELEME & SIRALAMA ── */
    const filteredOrders = useMemo(() => {
        let result = [...allOrders];

        // Durum filtresi
        if (statusFilter !== "all") {
            result = result.filter(o => classifyStatus(o.status) === statusFilter);
        }

        // Pazaryeri filtresi
        if (mpFilter !== "all") {
            result = result.filter(o => o.marketplace === mpFilter);
        }

        // Arama
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(o =>
                (o.orderNumber || "").toLowerCase().includes(q) ||
                (o.customerName || "").toLowerCase().includes(q) ||
                (o.trackingNumber || "").toLowerCase().includes(q) ||
                (o.products || []).some(p => (p.productName || "").toLowerCase().includes(q))
            );
        }

        // Sıralama
        result.sort((a, b) => {
            let va, vb;
            if (sortField === "orderDate") {
                va = a.orderDate ? new Date(a.orderDate).getTime() : 0;
                vb = b.orderDate ? new Date(b.orderDate).getTime() : 0;
            } else if (sortField === "totalPrice") {
                va = parseFloat(a.totalPrice) || 0;
                vb = parseFloat(b.totalPrice) || 0;
            } else if (sortField === "customerName") {
                va = (a.customerName || "").toLowerCase();
                vb = (b.customerName || "").toLowerCase();
                return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            } else if (sortField === "marketplace") {
                va = (a.marketplace || "").toLowerCase();
                vb = (b.marketplace || "").toLowerCase();
                return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            } else {
                va = a[sortField] || "";
                vb = b[sortField] || "";
            }
            return sortDir === "asc" ? va - vb : vb - va;
        });

        return result;
    }, [allOrders, statusFilter, mpFilter, searchQuery, sortField, sortDir]);

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / perPage);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * perPage, currentPage * perPage);

    // Durum sayıları
    const statusCounts = useMemo(() => {
        const sc = { all: allOrders.length, new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 };
        allOrders.forEach(o => {
            const cls = classifyStatus(o.status);
            if (sc[cls] !== undefined) sc[cls]++;
        });
        return sc;
    }, [allOrders]);

    // Benzersiz pazaryerleri
    const uniqueMarketplaces = useMemo(() => {
        return [...new Set(allOrders.map(o => o.marketplace).filter(Boolean))];
    }, [allOrders]);

    // Toplam ciro
    const totalRevenue = useMemo(() => {
        return filteredOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
    }, [filteredOrders]);

    /* ── SORT TOGGLE ── */
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <span style={{ color: C.dim, fontSize: "0.65rem", marginLeft: 4 }}>⇅</span>;
        return <span style={{ color: C.accent, fontSize: "0.65rem", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
    };

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div style={{ padding: "clamp(1rem, 2.5vw, 2rem)", color: C.text, minHeight: "100vh" }}>

            {/* ── HEADER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 style={{
                        fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 800, margin: 0,
                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                        📦 Sipariş Yönetimi
                    </h1>
                    <p style={{ color: C.muted, fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>
                        Tüm pazaryerlerinden gelen siparişlerinizi tek ekrandan yönetin
                    </p>
                </div>

                {/* Özet Kartlar */}
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {[
                        { label: "Toplam", value: allOrders.length, color: C.accent },
                        { label: "Ciro", value: fmtCurrency(totalRevenue), color: C.green },
                        { label: "Yeni", value: statusCounts.new, color: C.blue },
                        { label: "Kargoda", value: statusCounts.shipping, color: C.purple },
                    ].map((s, i) => (
                        <div key={i} style={{
                            background: `${s.color}10`, border: `1px solid ${s.color}30`,
                            borderRadius: 12, padding: "0.5rem 1rem", textAlign: "center", minWidth: 80,
                        }}>
                            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: "0.65rem", color: C.muted, fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── DURUM TABLARI ── */}
            <div style={{
                display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap",
                borderBottom: `1px solid ${C.glassBr}`, paddingBottom: "0.75rem",
            }}>
                {[
                    { id: "all", label: "Tümü", count: statusCounts.all, color: C.accent },
                    { id: "new", label: "Yeni", count: statusCounts.new, color: C.blue },
                    { id: "processing", label: "İşlemde", count: statusCounts.processing, color: C.yellow },
                    { id: "shipping", label: "Kargoda", count: statusCounts.shipping, color: C.purple },
                    { id: "delivered", label: "Teslim", count: statusCounts.delivered, color: C.green },
                    { id: "cancelled", label: "İptal", count: statusCounts.cancelled, color: C.red },
                    { id: "returned", label: "İade", count: statusCounts.returned, color: C.pink },
                ].map(tab => (
                    <motion.button key={tab.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                        style={{
                            background: statusFilter === tab.id ? `${tab.color}20` : C.glass,
                            border: statusFilter === tab.id ? `2px solid ${tab.color}` : `1px solid ${C.glassBr}`,
                            borderRadius: 10, padding: "0.45rem 0.85rem", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "0.35rem", transition: "all 0.2s",
                        }}>
                        <span style={{ color: statusFilter === tab.id ? tab.color : C.muted, fontSize: "0.78rem", fontWeight: 700 }}>{tab.label}</span>
                        <span style={{
                            background: statusFilter === tab.id ? tab.color : `${C.muted}30`,
                            color: statusFilter === tab.id ? "#000" : "#fff",
                            padding: "0.12rem 0.4rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 800,
                        }}>{tab.count}</span>
                    </motion.button>
                ))}
            </div>

            {/* ── FİLTRE BARI ── */}
            <div style={{
                display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center",
                background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 14, padding: "0.75rem 1rem",
            }}>
                {/* Arama */}
                <div style={{ position: "relative", flex: "1 1 250px", minWidth: 200 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: C.dim }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Sipariş no, müşteri adı, takip no veya ürün ara..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        style={{
                            width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.2rem",
                            background: "rgba(255,255,255,0.05)", border: `1px solid ${C.glassBr}`,
                            borderRadius: 10, color: C.text, fontSize: "0.82rem", outline: "none",
                            transition: "border-color 0.2s",
                        }}
                        onFocus={e => e.target.style.borderColor = C.accent}
                        onBlur={e => e.target.style.borderColor = C.glassBr}
                    />
                </div>

                {/* Pazaryeri Filtresi */}
                <select
                    value={mpFilter}
                    onChange={e => { setMpFilter(e.target.value); setCurrentPage(1); }}
                    style={{
                        padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${C.glassBr}`, borderRadius: 10, color: C.text,
                        fontSize: "0.82rem", outline: "none", cursor: "pointer", minWidth: 140,
                    }}
                >
                    <option value="all" style={{ background: "#1a1f2e" }}>Tüm Pazaryerleri</option>
                    {uniqueMarketplaces.map(mp => (
                        <option key={mp} value={mp} style={{ background: "#1a1f2e" }}>{mp}</option>
                    ))}
                </select>

                {/* Tarih Filtreleri */}
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    style={{
                        padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${C.glassBr}`, borderRadius: 10, color: C.text,
                        fontSize: "0.82rem", outline: "none", cursor: "pointer",
                    }}
                />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    style={{
                        padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${C.glassBr}`, borderRadius: 10, color: C.text,
                        fontSize: "0.82rem", outline: "none", cursor: "pointer",
                    }}
                />

                {/* Filtrele Butonu */}
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={fetchAllOrders}
                    disabled={loading}
                    style={{
                        padding: "0.6rem 1.2rem", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        border: "none", borderRadius: 10, color: "#000", fontSize: "0.82rem",
                        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
                        display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap",
                    }}
                >
                    {loading ? "⏳ Yükleniyor..." : "🔄 Yenile"}
                </motion.button>

                {/* Temizle */}
                {(searchQuery || mpFilter !== "all" || statusFilter !== "all" || startDate || endDate) && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { setSearchQuery(""); setMpFilter("all"); setStatusFilter("all"); setStartDate(""); setEndDate(""); setCurrentPage(1); }}
                        style={{
                            padding: "0.6rem 1rem", background: `${C.red}15`, border: `1px solid ${C.red}30`,
                            borderRadius: 10, color: C.red, fontSize: "0.82rem", fontWeight: 700,
                            cursor: "pointer", whiteSpace: "nowrap",
                        }}
                    >
                        ✕ Temizle
                    </motion.button>
                )}
            </div>

            {/* ── LOADING ── */}
            {loading && (
                <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: "4rem 2rem", color: C.muted,
                }}>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        style={{
                            width: 48, height: 48, borderRadius: "50%",
                            border: `3px solid ${C.glassBr}`, borderTopColor: C.accent,
                            marginBottom: "1rem",
                        }}
                    />
                    <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Siparişler yükleniyor...</p>
                    {loadingMp && <p style={{ fontSize: "0.78rem", color: C.dim, margin: "0.3rem 0 0 0" }}>{loadingMp} siparişleri çekiliyor...</p>}
                </div>
            )}

            {/* ── HATA ── */}
            {error && !loading && (
                <div style={{
                    background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 12,
                    padding: "1rem 1.5rem", marginBottom: "1rem", color: C.red, fontSize: "0.85rem",
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* ── SİPARİŞ TABLOSU ── */}
            {!loading && (
                <div style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
                    overflow: "hidden", backdropFilter: "blur(20px)",
                }}>
                    {/* Tablo Bilgi Satırı */}
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.glassBr}`,
                        background: "rgba(255,255,255,0.02)",
                    }}>
                        <span style={{ color: C.muted, fontSize: "0.78rem" }}>
                            {filteredOrders.length} sipariş gösteriliyor
                            {filteredOrders.length !== allOrders.length && ` (toplam ${allOrders.length})`}
                        </span>
                        <span style={{ color: C.dim, fontSize: "0.72rem" }}>
                            Sayfa {currentPage} / {totalPages || 1}
                        </span>
                    </div>

                    {/* Tablo */}
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${C.glassBr}` }}>
                                    {[
                                        { field: "orderNumber", label: "Sipariş No", width: "15%" },
                                        { field: "marketplace", label: "Pazaryeri", width: "11%" },
                                        { field: "customerName", label: "Müşteri", width: "17%" },
                                        { field: "products", label: "Ürünler", width: "20%", noSort: true },
                                        { field: "totalPrice", label: "Tutar", width: "10%" },
                                        { field: "orderDate", label: "Tarih", width: "12%" },
                                        { field: "status", label: "Durum", width: "10%", noSort: true },
                                        { field: "actions", label: "", width: "5%", noSort: true },
                                    ].map(col => (
                                        <th key={col.field}
                                            onClick={() => !col.noSort && handleSort(col.field)}
                                            style={{
                                                padding: "0.85rem 1rem", textAlign: "left",
                                                color: C.muted, fontSize: "0.72rem", fontWeight: 700,
                                                textTransform: "uppercase", letterSpacing: "0.05em",
                                                cursor: col.noSort ? "default" : "pointer",
                                                userSelect: "none", width: col.width,
                                                background: "rgba(255,255,255,0.02)",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {col.label}
                                            {!col.noSort && <SortIcon field={col.field} />}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length > 0 ? paginatedOrders.map((order, idx) => (
                                    <motion.tr
                                        key={`${order.orderNumber}-${order.marketplace}-${idx}`}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                        onClick={() => setSelectedOrder(order)}
                                        style={{
                                            borderBottom: `1px solid ${C.glassBr}`,
                                            cursor: "pointer",
                                            transition: "background 0.15s",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(78,205,196,0.04)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                        {/* Sipariş No */}
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{
                                                color: C.accent, fontSize: "0.82rem", fontWeight: 700,
                                                fontFamily: "monospace", letterSpacing: "-0.02em",
                                            }}>
                                                {order.orderNumber || "N/A"}
                                            </span>
                                        </td>

                                        {/* Pazaryeri */}
                                        <td style={{ padding: "0.75rem 0.5rem" }}>
                                            {getMpBadge(order.marketplace)}
                                        </td>

                                        {/* Müşteri */}
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{ color: C.text, fontSize: "0.82rem", fontWeight: 600 }}>
                                                {order.customerName || "Bilinmiyor"}
                                            </span>
                                        </td>

                                        {/* Ürünler */}
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            {(order.products || []).length > 0 ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                                                    <span style={{ color: C.text, fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, display: "block" }}>
                                                        {order.products[0].productName || "Ürün"}
                                                    </span>
                                                    {order.products.length > 1 && (
                                                        <span style={{ color: C.dim, fontSize: "0.68rem" }}>
                                                            +{order.products.length - 1} ürün daha
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: C.dim, fontSize: "0.75rem" }}>—</span>
                                            )}
                                        </td>

                                        {/* Tutar */}
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{ color: C.green, fontSize: "0.85rem", fontWeight: 800 }}>
                                                {fmtCurrency(order.totalPrice)}
                                            </span>
                                        </td>

                                        {/* Tarih */}
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600 }}>
                                                {order.orderDate || "N/A"}
                                            </span>
                                        </td>

                                        {/* Durum */}
                                        <td style={{ padding: "0.75rem 0.5rem" }}>
                                            {getStatusBadge(order.status)}
                                        </td>

                                        {/* Detay */}
                                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                                            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                                                onClick={e => { e.stopPropagation(); setSelectedOrder(order); }}
                                                style={{
                                                    background: `${C.accent}15`, border: `1px solid ${C.accent}30`,
                                                    borderRadius: 8, width: 32, height: 32, cursor: "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: C.accent, fontSize: "0.85rem",
                                                }}
                                            >
                                                →
                                            </motion.button>
                                        </td>
                                    </motion.tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} style={{ padding: "4rem 2rem", textAlign: "center" }}>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: C.dim }}>
                                                <span style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</span>
                                                <p style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: C.muted }}>Sipariş bulunamadı</p>
                                                <p style={{ fontSize: "0.8rem", margin: "0.3rem 0 0 0" }}>
                                                    {allOrders.length === 0
                                                        ? "Henüz hiç sipariş yok veya pazaryeri entegrasyonlarınızı kontrol edin"
                                                        : "Filtre kriterlerinize uygun sipariş bulunamadı"
                                                    }
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── PAGINATION ── */}
                    {totalPages > 1 && (
                        <div style={{
                            display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem",
                            padding: "1rem", borderTop: `1px solid ${C.glassBr}`,
                        }}>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                                style={{ ...paginationBtnStyle, opacity: currentPage === 1 ? 0.3 : 1 }}>
                                «
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                style={{ ...paginationBtnStyle, opacity: currentPage === 1 ? 0.3 : 1 }}>
                                ‹
                            </motion.button>

                            {generatePageNumbers(currentPage, totalPages).map((p, i) =>
                                p === "..." ? (
                                    <span key={`dots-${i}`} style={{ color: C.dim, padding: "0 0.3rem" }}>...</span>
                                ) : (
                                    <motion.button key={p} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                                        onClick={() => setCurrentPage(p)}
                                        style={{
                                            ...paginationBtnStyle,
                                            background: currentPage === p ? C.accent : C.glass,
                                            color: currentPage === p ? "#000" : C.muted,
                                            fontWeight: currentPage === p ? 800 : 600,
                                            border: currentPage === p ? `1px solid ${C.accent}` : `1px solid ${C.glassBr}`,
                                        }}>
                                        {p}
                                    </motion.button>
                                )
                            )}

                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                style={{ ...paginationBtnStyle, opacity: currentPage === totalPages ? 0.3 : 1 }}>
                                ›
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                                style={{ ...paginationBtnStyle, opacity: currentPage === totalPages ? 0.3 : 1 }}>
                                »
                            </motion.button>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
               SİPARİŞ DETAY MODAL
               ═══════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedOrder && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSelectedOrder(null)}
                        style={{
                            position: "fixed", inset: 0, zIndex: 9999,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: `linear-gradient(135deg, ${C.card} 0%, rgba(15,20,25,0.98) 100%)`,
                                border: `1px solid ${C.border}`, borderRadius: 20,
                                padding: "clamp(1.25rem, 3vw, 2rem)", maxWidth: 700, width: "100%",
                                maxHeight: "90vh", overflow: "auto",
                            }}
                        >
                            {/* Modal Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                                <div>
                                    <h2 style={{
                                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                        fontSize: "1.3rem", fontWeight: 800, margin: 0,
                                    }}>
                                        Sipariş Detayı
                                    </h2>
                                    <p style={{ color: C.muted, fontSize: "0.78rem", margin: "0.25rem 0 0 0", fontFamily: "monospace" }}>
                                        #{selectedOrder.orderNumber}
                                    </p>
                                </div>
                                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => setSelectedOrder(null)}
                                    style={{
                                        background: `${C.red}15`, border: `1px solid ${C.red}30`,
                                        borderRadius: "50%", width: 36, height: 36,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", color: C.red, fontSize: "1.1rem", fontWeight: 700,
                                    }}>
                                    ✕
                                </motion.button>
                            </div>

                            {/* Sipariş Bilgileri Grid */}
                            <div style={{
                                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "1rem", marginBottom: "1.5rem",
                            }}>
                                {[
                                    { label: "Pazaryeri", value: selectedOrder.marketplace, icon: "🏪" },
                                    { label: "Müşteri", value: selectedOrder.customerName || "Bilinmiyor", icon: "👤" },
                                    { label: "Tutar", value: fmtCurrency(selectedOrder.totalPrice), icon: "💰", color: C.green },
                                    { label: "Tarih", value: selectedOrder.orderDate || "N/A", icon: "📅" },
                                    { label: "Durum", value: selectedOrder.status || "Bilinmiyor", icon: "📦" },
                                    { label: "Takip No", value: selectedOrder.trackingNumber || "Yok", icon: "🚚" },
                                    { label: "Kargo Firması", value: selectedOrder.cargoCompany || "Bilinmiyor", icon: "📮" },
                                ].map((item, i) => (
                                    <div key={i} style={{
                                        background: C.glass, border: `1px solid ${C.glassBr}`,
                                        borderRadius: 12, padding: "0.75rem 1rem",
                                    }}>
                                        <div style={{ color: C.dim, fontSize: "0.68rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                            {item.icon} {item.label}
                                        </div>
                                        <div style={{ color: item.color || C.text, fontSize: "0.88rem", fontWeight: 700, wordBreak: "break-all" }}>
                                            {item.value}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Ürünler */}
                            <div style={{ marginBottom: "0.5rem" }}>
                                <h3 style={{ color: C.text, fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
                                    🛍️ Ürünler ({(selectedOrder.products || []).length})
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {(selectedOrder.products || []).map((product, idx) => (
                                        <div key={idx} style={{
                                            display: "flex", alignItems: "center", gap: "0.85rem",
                                            background: C.glass, border: `1px solid ${C.glassBr}`,
                                            borderRadius: 12, padding: "0.75rem 1rem",
                                        }}>
                                            {product.imageUrl && product.imageUrl !== "/default-product.jpg" && (
                                                <img src={product.imageUrl} alt={product.productName}
                                                    style={{
                                                        width: 52, height: 52, borderRadius: 10,
                                                        objectFit: "cover", border: `1px solid ${C.glassBr}`,
                                                        flexShrink: 0,
                                                    }}
                                                    onError={e => { e.target.style.display = "none"; }}
                                                />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ color: C.text, fontSize: "0.85rem", fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {product.productName || "Ürün"}
                                                </p>
                                                <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                                                    <span style={{ color: C.muted, fontSize: "0.75rem" }}>Adet: <strong style={{ color: C.text }}>{product.quantity || 1}</strong></span>
                                                    {product.price && <span style={{ color: C.muted, fontSize: "0.75rem" }}>Fiyat: <strong style={{ color: C.green }}>{fmtCurrency(product.price)}</strong></span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedOrder.products || selectedOrder.products.length === 0) && (
                                        <p style={{ color: C.dim, fontSize: "0.82rem", textAlign: "center", padding: "1rem" }}>Ürün bilgisi bulunamadı</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   YARDIMCI
   ═══════════════════════════════════════════════════════════ */
const paginationBtnStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8, width: 36, height: 36,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 700,
};

const generatePageNumbers = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
    }
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
};

export default OrdersPage;
