import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { FaBox, FaImage } from "react-icons/fa";
import { useApp } from "../context/AppContext";

const fmtCurrency = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0));
    } catch { return `${Number(v || 0).toFixed(2)} ₺`; }
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return String(d); }
};

/* ═══════════════════════════════════════════════════════════
   DURUM SINIFLANDIRMA
   ═══════════════════════════════════════════════════════════ */
const classifyStatus = (s) => {
    const l = String(s || "").toLowerCase();
    // ✅ FIX: HB durumları eklendi — Open, Unpacked, Packaged, Shipped, Delivered, Cancelled
    if (l.includes("created") || l.includes("yeni") || l.includes("new") || l.includes("waiting") || l === "open") return "new";
    if (l.includes("processing") || l.includes("işlem") || l.includes("hazırlan") || l.includes("picking") || l.includes("approved") || l === "unpacked" || l === "packaged" || l.includes("paket")) return "processing";
    if (l.includes("shipping") || l.includes("shipped") || l.includes("kargo") || l.includes("transit") || l.includes("invoiced")) return "shipping";
    if (l.includes("delivered") || l.includes("teslim") || l.includes("completed") || l.includes("tamamlan")) return "delivered";
    if (l.includes("cancel") || l.includes("iptal")) return "cancelled";
    if (l.includes("return") || l.includes("iİade") || l.includes("refund")) return "returned";
    return "processing";
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

/* ═══════════════════════════════════════════════════════════
   PRODUCT IMAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
const ProductImage = ({ src, size = 38, radius = 8, onClick, C }) => {
    const [error, setError] = useState(false);
    const [imgSrc, setImgSrc] = useState(src);

    useEffect(() => {
        setImgSrc(src);
        setError(false);
    }, [src]);

    const isInvalid = (url) => !url || url.includes("default-product.jpg");
    const hasImage = !isInvalid(imgSrc) && !error;

    return (
        <div
            onClick={(e) => {
                if (hasImage && onClick) {
                    e.stopPropagation();
                    onClick(imgSrc);
                }
            }}
            style={{
                width: size, height: size, borderRadius: radius, overflow: "hidden",
                border: `1px solid ${C.glassBr}`, background: C.card,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: hasImage ? "zoom-in" : "default", flexShrink: 0
            }}
        >
            {hasImage ? (
                <img
                    src={imgSrc}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => setError(true)}
                />
            ) : (
                <div style={{
                    width: "100%", height: "100%", display: "flex", alignItems: "center",
                    justifyContent: "center", background: "rgba(255,255,255,0.03)", color: C.muted
                }}>
                    <FaBox size={Math.round(size * 0.38)} />
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   ANA COMPONENT
   ═══════════════════════════════════════════════════════════ */
const OrdersPage = ({ marketplaces = [], userId: propUserId }) => {
    const { theme: C, t } = useApp();
    const userId = propUserId || localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    // ── Veri kaynağı: her zaman pazaryeri API ──
    const viewMode = "api";

    // ── API modu state ──
    const [apiOrders, setApiOrders] = useState([]);
    const [loadingApi, setLoadingApi] = useState(false);
    const [loadingMp, setLoadingMp] = useState("");

    // ── Fatura istatistikleri (API modunda DB'den çekilir) ──
    const [invoiceStats, setInvoiceStats] = useState({ total: 0, invoiced: 0, uninvoiced: 0, error: 0 });

    const [error, setError] = useState("");
    const [zoomedImage, setZoomedImage] = useState(null);

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

    // Aktif veri kaynağı
    const allOrders = apiOrders;
    const loading = loadingApi;

    /* ── Status helpers (C bağımlı) ── */
    const statusMeta = useMemo(() => ({
        new: { label: t("orders.statusNew"), color: C.accent, icon: "🆕" },
        processing: { label: t("orders.statusProcessing"), color: C.yellow, icon: "⚙️" },
        shipping: { label: t("orders.statusShipping"), color: C.purple, icon: "🚚" },
        delivered: { label: t("orders.statusDelivered"), color: C.green, icon: "✅" },
        cancelled: { label: t("orders.statusCancelled"), color: C.red, icon: "❌" },
        returned: { label: t("orders.statusReturned"), color: C.pink, icon: "↩️" },
    }), [C, t]);

    const getStatusBadge = useCallback((status) => {
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
    }, [statusMeta]);

    /* ── Fatura durumu badge ── */
    const getInvoiceBadge = useCallback((order) => {
        const invStatus = order.invoiceStatus || "";
        const hasInvoice = !!order.invoice;

        if (invStatus === "created" || hasInvoice) {
            return (
                <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                    background: `${C.green}15`, border: `1px solid ${C.green}40`,
                    color: C.green, padding: "0.22rem 0.55rem", borderRadius: 8,
                    fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                }}>
                    ✅ {t("orders.invoiceCreated")}
                </span>
            );
        }
        if (invStatus === "pending") {
            return (
                <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                    background: `${C.yellow}15`, border: `1px solid ${C.yellow}40`,
                    color: C.yellow, padding: "0.22rem 0.55rem", borderRadius: 8,
                    fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                }}>
                    ⏳ {t("orders.invoicePending")}
                </span>
            );
        }
        if (invStatus === "error") {
            return (
                <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                    background: `${C.red}15`, border: `1px solid ${C.red}40`,
                    color: C.red, padding: "0.22rem 0.55rem", borderRadius: 8,
                    fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                }}>
                    ❌ {t("orders.invoiceError")}
                </span>
            );
        }
        // Faturasız
        return (
            <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)",
                color: C.dim, padding: "0.22rem 0.55rem", borderRadius: 8,
                fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
            }}>
                📄 {t("orders.uninvoiced")}
            </span>
        );
    }, [C, t]);

    const getMpColor = useCallback((name) => {
        const l = String(name || "").toLowerCase();
        return Object.entries(mpColors).find(([k]) => l.includes(k))?.[1] || C.accent;
    }, [C.accent]);

    const getMpBadge = useCallback((name) => {
        const color = getMpColor(name);
        return (
            <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                background: `${color}18`, border: `1px solid ${color}35`,
                color, padding: "0.22rem 0.6rem", borderRadius: 8,
                fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
            }}>
                {name || t("orders.unknown")}
            </span>
        );
    }, [getMpColor, t]);

    /* ── API SİPARİŞLERİ ÇEK (pazaryeri API) ── */
    const fetchApiOrders = useCallback(async () => {
        if (!marketplaces.length) return;
        setLoadingApi(true);
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

                const response = await axios.get(`/orders/all?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const orders = (response.data?.orders || []).map(o => ({
                    ...o,
                    marketplace: response.data?.marketplace || mp.marketplaceName || mp.name || t("orders.unknown"),
                    marketplaceId: mp._id,
                }));
                collected.push(...orders);
            } catch (err) {
                // silently skip failed marketplace
            }
        }

        collected.sort((a, b) => {
            const da = a.orderDate ? new Date(a.orderDate) : new Date(0);
            const db = b.orderDate ? new Date(b.orderDate) : new Date(0);
            return db - da;
        });

        // ── Fatura durumlarını DB'den çek ve eşleştir ──
        try {
            const dbResponse = await axios.get(`/orders/db-orders?limit=1000`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (dbResponse.data?.success) {
                const dbOrdersData = dbResponse.data.data || [];
                // Fatura istatistiklerini güncelle
                if (dbResponse.data.invoiceStats) {
                    setInvoiceStats(dbResponse.data.invoiceStats);
                }
                // orderNumber ile eşleştir
                const invoiceMap = new Map();
                dbOrdersData.forEach(dbOrder => {
                    invoiceMap.set(dbOrder.orderNumber, {
                        invoiceStatus: dbOrder.invoiceStatus,
                        invoice: dbOrder.invoice,
                        imageUrl: dbOrder.imageUrl,
                        items: dbOrder.items
                    });
                });

                // API siparişlerine fatura bilgisini ekle
                collected.forEach(order => {
                    const dbInfo = invoiceMap.get(order.orderNumber);
                    if (dbInfo) {
                        order.invoiceStatus = dbInfo.invoiceStatus;
                        order.invoice = dbInfo.invoice;
                        
                        // ✅ GÖRSEL GÜNCELLEME: Eğer API'den gelen görsel yoksa veya hatalıysa, 
                        // backend'in Product modelinden (Stok Yönetimi) eşleştirdiği görseli kullan.
                        const isInvalidImg = (url) => !url || url.includes("default-product.jpg") || url.includes("placehold.co");
                        
                        // Backend'den gelen imageUrl zaten stoktaki görselle zenginleştirilmiş olabilir (yeni getAllOrders mantığı)
                        // Ama garantiye alalım: DB verisinden gelen görseli (dbInfo.imageUrl) pazar yeri görseline tercih et
                        if (!isInvalidImg(dbInfo.imageUrl)) {
                            order.imageUrl = dbInfo.imageUrl;
                        }
                        
                        if (dbInfo.items && dbInfo.items.length > 0) {
                            if (!order.products || order.products.length === 0) {
                                order.products = dbInfo.items;
                            } else {
                                // Mevcut ürünlerin görsellerini de DB'den gelen zenginleştirilmiş verilerle güncelle
                                order.products = order.products.map(p => {
                                    const dbItem = dbInfo.items.find(di => di.barcode === p.barcode);
                                    if (dbItem && !isInvalidImg(dbItem.imageUrl)) {
                                        return { ...p, imageUrl: dbItem.imageUrl };
                                    }
                                    return p;
                                });
                            }
                        }
                    }
                });
            }
        } catch (err) {
            // Fatura bilgisi çekilemezse sessizce devam et
            console.warn("Fatura durumları yüklenemedi:", err.message);
        }

        setApiOrders(collected);
        setCurrentPage(1);
        setLoadingApi(false);
        setLoadingMp("");
    }, [marketplaces, token, startDate, endDate, t]);

    /* ── İlk yükleme + marketplaces değiştiğinde otomatik çek ── */
    // ✅ FIX: marketplaces async yüklenince siparişler otomatik çekilsin
    useEffect(() => {
        if (marketplaces && marketplaces.length > 0) {
            fetchApiOrders();
        }
    }, [marketplaces]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRefresh = () => {
        fetchApiOrders();
        setCurrentPage(1);
    };

    /* ── FİLTRELEME & SIRALAMA ── */
    const filteredOrders = useMemo(() => {
        let result = [...allOrders];

        if (statusFilter !== "all") {
            result = result.filter(o => classifyStatus(o.status) === statusFilter);
        }

        if (mpFilter !== "all") {
            result = result.filter(o => o.marketplace === mpFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(o =>
                (o.orderNumber || "").toLowerCase().includes(q) ||
                (o.customerName || "").toLowerCase().includes(q) ||
                (o.trackingNumber || "").toLowerCase().includes(q) ||
                (o.firstProduct || "").toLowerCase().includes(q) ||
                (o.products || []).some(p => (p.productName || "").toLowerCase().includes(q)) ||
                (o.invoice?.invoiceNumber || "").toLowerCase().includes(q)
            );
        }

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

    const totalPages = Math.ceil(filteredOrders.length / perPage);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * perPage, currentPage * perPage);

    const statusCounts = useMemo(() => {
        const sc = { all: allOrders.length, new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 };
        allOrders.forEach(o => {
            const cls = classifyStatus(o.status);
            if (sc[cls] !== undefined) sc[cls]++;
        });
        return sc;
    }, [allOrders]);

    const uniqueMarketplaces = useMemo(() => {
        return [...new Set(allOrders.map(o => o.marketplace).filter(Boolean))];
    }, [allOrders]);

    const totalRevenue = useMemo(() => {
        return filteredOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
    }, [filteredOrders]);

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

    // Tablo kolonları — her iki modda da fatura kolonu gösterilir
    const tableColumns = useMemo(() => {
        const cols = [
            { field: "orderNumber", label: t("orders.orderNo"), width: "12%" },
            { field: "marketplace", label: t("orders.marketplace"), width: "10%" },
            { field: "customerName", label: t("orders.customer"), width: "14%" },
            { field: "products", label: t("orders.products"), width: "21%", noSort: true },
            { field: "totalPrice", label: t("orders.amount"), width: "9%" },
            { field: "orderDate", label: t("orders.date"), width: "11%" },
            { field: "status", label: t("orders.status"), width: "9%", noSort: true },
            { field: "invoiceStatus", label: t("orders.invoice"), width: "12%", noSort: true },
            { field: "actions", label: "", width: "2%", noSort: true },
        ];
        return cols;
    }, [t]);

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div style={{ padding: "clamp(1rem, 2.5vw, 2rem)", color: C.text, minHeight: "100vh" }}>

            {/* ── ZOOM MODAL ── */}
            <AnimatePresence>
                {zoomedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setZoomedImage(null)}
                        style={{
                            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                            background: "rgba(0,0,0,0.85)", zIndex: 10000,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "2rem", backdropFilter: "blur(5px)"
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}
                        >
                            <img
                                src={zoomedImage}
                                alt="zoomed"
                                style={{
                                    maxWidth: "100%", maxHeight: "90vh", borderRadius: 16,
                                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                                    border: `2px solid ${C.glassBr}`
                                }}
                            />
                            <button
                                onClick={() => setZoomedImage(null)}
                                style={{
                                    position: "absolute", top: -40, right: -40,
                                    background: "rgba(255,255,255,0.15)", border: "none",
                                    width: 40, height: 40, borderRadius: "50%",
                                    color: "#fff", fontSize: "1.5rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}
                            >
                                ✕
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── HEADER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 style={{
                        fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 800, margin: 0,
                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                        📦 {t("orders.pageTitle")}
                    </h1>
                    <p style={{ color: C.muted, fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>
                        {t("orders.pageSubtitle")}
                    </p>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {/* ── Özet kartları ── */}
                    {[
                        { label: t("orders.totalLabel"), value: allOrders.length, color: C.accent },
                        { label: t("orders.revenue"), value: fmtCurrency(totalRevenue), color: C.green },
                        { label: t("orders.newLabel"), value: statusCounts.new, color: C.blue },
                        { label: t("orders.shippingLabel"), value: statusCounts.shipping, color: C.purple },
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
                    { id: "all", label: t("orders.all"), count: statusCounts.all, color: C.accent },
                    { id: "new", label: t("orders.new"), count: statusCounts.new, color: C.blue },
                    { id: "processing", label: t("orders.processing"), count: statusCounts.processing, color: C.yellow },
                    { id: "shipping", label: t("orders.shipping"), count: statusCounts.shipping, color: C.purple },
                    { id: "delivered", label: t("orders.deliver"), count: statusCounts.delivered, color: C.green },
                    { id: "cancelled", label: t("orders.cancel"), count: statusCounts.cancelled, color: C.red },
                    { id: "returned", label: t("orders.return"), count: statusCounts.returned, color: C.pink },
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
                <div style={{ position: "relative", flex: "1 1 250px", minWidth: 200 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: C.dim }}>🔍</span>
                    <input
                        type="text"
                        placeholder={t("orders.searchPlaceholder")}
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

                <select
                    value={mpFilter}
                    onChange={e => { setMpFilter(e.target.value); setCurrentPage(1); }}
                    style={{
                        padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${C.glassBr}`, borderRadius: 10, color: C.text,
                        fontSize: "0.82rem", outline: "none", cursor: "pointer", minWidth: 140,
                    }}
                >
                    <option value="all" style={{ background: C.card }}>{t("orders.allMarketplaces")}</option>
                    {uniqueMarketplaces.map(mp => (
                        <option key={mp} value={mp} style={{ background: C.card }}>{mp}</option>
                    ))}
                </select>

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

                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={handleRefresh}
                    disabled={loading}
                    style={{
                        padding: "0.6rem 1.2rem", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        border: "none", borderRadius: 10, color: "#000", fontSize: "0.82rem",
                        fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
                        display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap",
                    }}
                >
                    {loading ? `⏳ ${t("orders.loading")}` : `🔄 ${t("orders.refresh")}`}
                </motion.button>

                {(searchQuery || mpFilter !== "all" || statusFilter !== "all" || startDate || endDate) && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { setSearchQuery(""); setMpFilter("all"); setStatusFilter("all"); setStartDate(""); setEndDate(""); setCurrentPage(1); }}
                        style={{
                            padding: "0.6rem 1rem", background: `${C.red}15`, border: `1px solid ${C.red}30`,
                            borderRadius: 10, color: C.red, fontSize: "0.82rem", fontWeight: 700,
                            cursor: "pointer", whiteSpace: "nowrap",
                        }}
                    >
                        ✕ {t("orders.clear")}
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
                    <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
                        {t("orders.loadingOrders")}
                    </p>
                    {loadingMp && <p style={{ fontSize: "0.78rem", color: C.dim, margin: "0.3rem 0 0 0" }}>{loadingMp} {t("orders.fetchingOrders")}</p>}
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
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.glassBr}`,
                        background: "rgba(255,255,255,0.02)",
                    }}>
                        <span style={{ color: C.muted, fontSize: "0.78rem" }}>
                            {filteredOrders.length} {t("orders.showingOrders")}
                            {filteredOrders.length !== allOrders.length && ` (${t("orders.totalLabel").toLowerCase()} ${allOrders.length})`}
                        </span>
                        <span style={{ color: C.dim, fontSize: "0.72rem" }}>
                            {t("orders.page")} {currentPage} / {totalPages || 1}
                        </span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${C.glassBr}` }}>
                                    {tableColumns.map(col => (
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
                                        key={`${order.orderNumber || order._id}-${order.marketplace}-${idx}`}
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
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{
                                                color: C.accent, fontSize: "0.82rem", fontWeight: 700,
                                                fontFamily: "monospace", letterSpacing: "-0.02em",
                                            }}>
                                                {order.orderNumber || "N/A"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.75rem 0.5rem" }}>
                                            {getMpBadge(order.marketplace)}
                                        </td>
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{ color: C.text, fontSize: "0.82rem", fontWeight: 600 }}>
                                                {order.customerName || t("orders.unknown")}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <ProductImage 
                                                    src={order.imageUrl || (order.items?.[0]?.imageUrl) || (order.products?.[0]?.imageUrl)}
                                                    onClick={(src) => setZoomedImage(src)}
                                                    C={C}
                                                />
                                                {(order.items || order.products || []).length > 0 ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                                                        <span style={{ color: C.text, fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180, display: "block" }}>
                                                            {(order.items?.[0] || order.products[0]).productName || t("orders.product")}
                                                        </span>
                                                        {(order.items || order.products).length > 1 && (
                                                            <span style={{ color: C.dim, fontSize: "0.68rem" }}>
                                                                +{(order.items || order.products).length - 1} {t("orders.moreProducts")}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: C.dim, fontSize: "0.75rem" }}>—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{ color: C.green, fontSize: "0.85rem", fontWeight: 800 }}>
                                                {fmtCurrency(order.totalPrice)}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.75rem 1rem" }}>
                                            <span style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600 }}>
                                                {order.orderDate || "N/A"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.75rem 0.5rem" }}>
                                            {getStatusBadge(order.status)}
                                        </td>
                                        {/* ── FATURA DURUMU KOLONU ── */}
                                        <td style={{ padding: "0.75rem 0.5rem" }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                                {getInvoiceBadge(order)}
                                                {order.invoice?.invoiceNumber && (
                                                    <span style={{
                                                        color: C.dim, fontSize: "0.62rem", fontFamily: "monospace",
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                        maxWidth: 120, display: "block",
                                                    }}>
                                                        {order.invoice.invoiceNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
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
                                        <td colSpan={tableColumns.length} style={{ padding: "4rem 2rem", textAlign: "center" }}>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: C.dim }}>
                                                <span style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</span>
                                                <p style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: C.muted }}>{t("orders.notFound")}</p>
                                                <p style={{ fontSize: "0.8rem", margin: "0.3rem 0 0 0" }}>
                                                    {allOrders.length === 0
                                                        ? t("orders.noOrdersYet")
                                                        : t("orders.noFilterMatch")
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                                <div>
                                    <h2 style={{
                                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                        fontSize: "1.3rem", fontWeight: 800, margin: 0,
                                    }}>
                                        {t("orders.orderDetail")}
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

                            <div style={{
                                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "1rem", marginBottom: "1.5rem",
                            }}>
                                {[
                                    { label: t("orders.marketplace"), value: selectedOrder.marketplace, icon: "🏪" },
                                    { label: t("orders.customer"), value: selectedOrder.customerName || t("orders.unknown"), icon: "👤" },
                                    { label: t("orders.amount"), value: fmtCurrency(selectedOrder.totalPrice), icon: "💰", color: C.green },
                                    { label: t("orders.date"), value: selectedOrder.orderDate || "N/A", icon: "📅" },
                                    { label: t("orders.status"), value: selectedOrder.status || t("orders.unknown"), icon: "📦" },
                                    { label: t("orders.trackingNo"), value: selectedOrder.trackingNumber || selectedOrder.orderNumber || t("orders.none"), icon: "🚚" },
                                    ...(selectedOrder.cargoCompany ? [{ label: t("orders.cargoCompany"), value: selectedOrder.cargoCompany, icon: "📮" }] : []),
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

                            {/* ── FATURA BİLGİSİ ── */}
                            <div style={{
                                background: C.glass, border: `1px solid ${C.glassBr}`,
                                borderRadius: 14, padding: "1rem 1.25rem", marginBottom: "1.5rem",
                            }}>
                                <h3 style={{ color: C.text, fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
                                    🧾 {t("orders.invoiceStatus")}
                                </h3>
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                                    {getInvoiceBadge(selectedOrder)}

                                    {selectedOrder.invoice ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                            <span style={{ color: C.text, fontSize: "0.82rem", fontWeight: 600 }}>
                                                {t("orders.invoiceNo")}: <span style={{ fontFamily: "monospace", color: C.accent }}>{selectedOrder.invoice.invoiceNumber || "—"}</span>
                                            </span>
                                            {selectedOrder.invoice.uuid && (
                                                <span style={{ color: C.dim, fontSize: "0.68rem", fontFamily: "monospace" }}>
                                                    UUID: {selectedOrder.invoice.uuid}
                                                </span>
                                            )}
                                            {selectedOrder.invoice.issueDate && (
                                                <span style={{ color: C.dim, fontSize: "0.72rem" }}>
                                                    📅 {fmtDate(selectedOrder.invoice.issueDate)}
                                                </span>
                                            )}
                                            {selectedOrder.invoice.faturaURL && (
                                                <a href={selectedOrder.invoice.faturaURL} target="_blank" rel="noopener noreferrer"
                                                    style={{
                                                        color: C.accent, fontSize: "0.75rem", fontWeight: 600,
                                                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                                        marginTop: "0.25rem",
                                                    }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    🔗 {t("orders.viewInvoice")}
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: C.dim, fontSize: "0.82rem" }}>
                                            {selectedOrder.invoiceStatus === "error"
                                                ? "❌ " + t("orders.invoiceErrorLabel")
                                                : "📄 " + t("orders.uninvoicedLabel")
                                            }
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginBottom: "0.5rem" }}>
                                <h3 style={{ color: C.text, fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem 0" }}>
                                    🛍️ {t("orders.products")} ({(selectedOrder.items || selectedOrder.products || []).length || selectedOrder.productCount || 0})
                                </h3>
                                {(selectedOrder.items || selectedOrder.products || []).length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                        {(selectedOrder.items || selectedOrder.products || []).map((product, idx) => (
                                            <div key={idx} style={{
                                                display: "flex", alignItems: "center", gap: "12px",
                                                background: C.glass, border: `1px solid ${C.glassBr}`,
                                                borderRadius: 14, padding: "10px 14px",
                                            }}>
                                                <ProductImage 
                                                    src={product.imageUrl}
                                                    size={44}
                                                    radius={10}
                                                    onClick={(src) => setZoomedImage(src)}
                                                    C={C}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ color: C.text, fontSize: "0.82rem", fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3 }}>
                                                        {product.productName || t("orders.product")}
                                                    </p>
                                                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem", flexWrap: "wrap", alignItems: "center" }}>
                                                        <span style={{ color: C.muted, fontSize: "0.75rem" }}>{t("orders.quantity")}: <strong style={{ color: C.accent }}>{product.quantity || 1}</strong></span>
                                                        {product.price && <span style={{ color: C.muted, fontSize: "0.75rem" }}>{t("orders.price")}: <strong style={{ color: C.green }}>{fmtCurrency(product.price)}</strong></span>}
                                                        {product.barcode && <span style={{ color: C.dim, fontSize: "0.68rem", fontFamily: "monospace", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: 4 }}>{product.barcode}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : selectedOrder.firstProduct ? (
                                    <div style={{
                                        background: C.glass, border: `1px solid ${C.glassBr}`,
                                        borderRadius: 12, padding: "1rem",
                                    }}>
                                        <p style={{ color: C.text, fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                                            {selectedOrder.firstProduct}
                                            {selectedOrder.productCount > 1 && (
                                                <span style={{ color: C.dim, fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                                                    +{selectedOrder.productCount - 1} {t("orders.moreProducts")}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <p style={{ color: C.dim, fontSize: "0.82rem", textAlign: "center", padding: "1rem" }}>{t("orders.noProductInfo")}</p>
                                )}
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
