import React, { useState, useEffect, useMemo } from "react";
import axios from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { FaTruck, FaSearch, FaSync, FaExternalLinkAlt, FaChevronDown, FaChevronLeft, FaChevronRight, FaFilter, FaBoxOpen, FaCheckCircle, FaUndoAlt, FaTimesCircle, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import { useApp } from "../context/AppContext";
import "../styles/CargoTrackingPage.css";

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
};

const CargoTrackingPage = ({ userId, marketplaceId, marketplace }) => {
    const { theme: C, t } = useApp();
    const [orders, setOrders] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortField, setSortField] = useState("timestamp");
    const [sortDir, setSortDir] = useState("desc");
    const [loading, setLoading] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const ordersPerPage = 20;
    const token = localStorage.getItem("token");

    useEffect(() => {
        fetchCargoTrackingOrders();
    }, [marketplaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchCargoTrackingOrders = async () => {
        if (!marketplaceId || !marketplace) return;
        try {
            setLoading(true);
            const params = new URLSearchParams({
                startDate: startDate ? new Date(startDate).toISOString().slice(0, 10) : "",
                endDate: endDate ? new Date(endDate).toISOString().slice(0, 10) : "",
                marketplace: marketplace.marketplaceName
            });
            const response = await axios.get(`/cargo?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const sortedOrders = (response.data.orders || []).sort((a, b) => {
                if (a.status === "Shipped" && b.status !== "Shipped") return -1;
                if (a.status !== "Shipped" && b.status === "Shipped") return 1;
                return new Date(b.timestamp || b.orderDate) - new Date(a.timestamp || a.orderDate);
            });
            setOrders(sortedOrders);
            setTotalOrders(response.data.total || sortedOrders.length);
            setCurrentPage(1);
        } catch (error) {
            console.error("Cargo API Hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    // Status helpers
    const getStatusInfo = (status) => {
        const s = (status || "").toLowerCase();
        if (s.includes("shipped") || s.includes("kargoda") || s.includes("transit")) return { label: t("cargo.shipped"), color: C.yellow, icon: <FaTruck /> };
        if (s.includes("delivered") || s.includes("teslim")) return { label: t("cargo.delivered"), color: C.green, icon: <FaCheckCircle /> };
        if (s.includes("returned") || s.includes("iİade")) return { label: t("cargo.returned"), color: C.red, icon: <FaUndoAlt /> };
        if (s.includes("undelivered") || s.includes("teslim edilemedi")) return { label: t("cargo.undelivered"), color: C.pink, icon: <FaTimesCircle /> };
        return { label: status || t("cargo.unknown"), color: C.muted, icon: <FaBoxOpen /> };
    };

    // Status counts
    const statusCounts = useMemo(() => {
        const counts = { all: orders.length, Shipped: 0, Delivered: 0, Returned: 0, UnDelivered: 0 };
        orders.forEach(o => {
            const s = (o.status || "").toLowerCase();
            if (s.includes("shipped") || s.includes("kargoda") || s.includes("transit")) counts.Shipped++;
            else if (s.includes("delivered") || s.includes("teslim")) counts.Delivered++;
            else if (s.includes("returned") || s.includes("iİade")) counts.Returned++;
            else if (s.includes("undelivered")) counts.UnDelivered++;
        });
        return counts;
    }, [orders]);

    // Filtered + sorted orders
    const filteredOrders = useMemo(() => {
        let result = orders.filter(order => {
            const matchesSearch = !searchQuery ||
                (order.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.orderNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.trackingNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === "all" || (() => {
                const s = (order.status || "").toLowerCase();
                if (statusFilter === "Shipped") return s.includes("shipped") || s.includes("kargoda") || s.includes("transit");
                if (statusFilter === "Delivered") return s.includes("delivered") || s.includes("teslim");
                if (statusFilter === "Returned") return s.includes("returned") || s.includes("iİade");
                if (statusFilter === "UnDelivered") return s.includes("undelivered");
                return true;
            })();
            return matchesSearch && matchesStatus;
        });

        result.sort((a, b) => {
            let valA, valB;
            if (sortField === "timestamp") {
                valA = new Date(a.timestamp || a.orderDate || 0).getTime();
                valB = new Date(b.timestamp || b.orderDate || 0).getTime();
            } else if (sortField === "orderNumber") {
                valA = (a.orderNumber || "").toLowerCase();
                valB = (b.orderNumber || "").toLowerCase();
            } else if (sortField === "customerName") {
                valA = (a.customerName || "").toLowerCase();
                valB = (b.customerName || "").toLowerCase();
            } else if (sortField === "status") {
                valA = (a.status || "").toLowerCase();
                valB = (b.status || "").toLowerCase();
            }
            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [orders, searchQuery, statusFilter, sortField, sortDir]);

    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    const currentOrders = filteredOrders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

    const handleSort = (field) => {
        if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortField(field); setSortDir("desc"); }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <FaSortAmountDown style={{ opacity: 0.3, fontSize: "0.6rem" }} />;
        return sortDir === "asc" ? <FaSortAmountUp style={{ color: C.accent, fontSize: "0.6rem" }} /> : <FaSortAmountDown style={{ color: C.accent, fontSize: "0.6rem" }} />;
    };

    return (
        <div className="cargo-page">
            {/* ── HEADER ── */}
            <div className="cargo-page-header">
                <div className="cargo-page-header-left">
                    <h1>
                        <FaTruck style={{ color: C.accent }} />
                        <span>{marketplace?.name || marketplace?.marketplaceName || ""} {t("cargo.pageTitle")}</span>
                    </h1>
                    <p>{t("cargo.trackingSystem")} • {totalOrders} {t("cargo.cargo")}</p>
                </div>
                <div className="cargo-page-header-right">
                    <button className="cargo-refresh-btn" onClick={fetchCargoTrackingOrders} disabled={loading}>
                        <FaSync className={loading ? "cargo-spin" : ""} />
                        {loading ? t("cargo.loading") : t("cargo.update")}
                    </button>
                </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="cargo-stat-row">
                {[
                    { label: t("cargo.total"), count: statusCounts.all, icon: "📦", color: C.accent },
                    { label: t("cargo.shipped"), count: statusCounts.Shipped, icon: "🚚", color: C.yellow },
                    { label: t("cargo.delivered"), count: statusCounts.Delivered, icon: "✅", color: C.green },
                    { label: t("cargo.returned"), count: statusCounts.Returned, icon: "↩️", color: C.red },
                ].map((s, i) => (
                    <motion.div key={s.label} className="cargo-stat-card" whileHover={{ y: -3 }}
                        style={{ borderTop: `3px solid ${s.color}` }}>
                        <span className="cargo-stat-icon">{s.icon}</span>
                        <div className="cargo-stat-info">
                            <span className="cargo-stat-val" style={{ color: s.color }}>{s.count}</span>
                            <span className="cargo-stat-label">{s.label}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── FILTERS ── */}
            <div className="cargo-filter-bar">
                <div className="cargo-filter-tabs">
                    {[
                        { id: "all", label: t("cargo.all"), count: statusCounts.all },
                        { id: "Shipped", label: t("cargo.shipped"), count: statusCounts.Shipped },
                        { id: "Delivered", label: t("cargo.deliver"), count: statusCounts.Delivered },
                        { id: "Returned", label: t("cargo.returned"), count: statusCounts.Returned },
                    ].map(tab => (
                        <button key={tab.id}
                            className={`cargo-filter-tab ${statusFilter === tab.id ? "active" : ""}`}
                            onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}>
                            {tab.label} <span className="cargo-filter-count">{tab.count}</span>
                        </button>
                    ))}
                </div>
                <div className="cargo-filter-inputs">
                    <div className="cargo-search-wrap">
                        <FaSearch className="cargo-search-icon" />
                        <input type="text" placeholder={t("cargo.searchPlaceholder")}
                            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="cargo-search-input" />
                    </div>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="cargo-date-input" />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="cargo-date-input" />
                    <button className="cargo-apply-btn" onClick={() => { fetchCargoTrackingOrders(); }}>
                        <FaFilter /> {t("cargo.apply")}
                    </button>
                </div>
            </div>

            {/* ── TABLE ── */}
            <div className="cargo-table-wrap">
                {/* Table Header */}
                <div className="cargo-table-header">
                    <div className="cargo-th cargo-th-order" onClick={() => handleSort("orderNumber")}>
                        {t("cargo.orderNo")} <SortIcon field="orderNumber" />
                    </div>
                    <div className="cargo-th cargo-th-customer" onClick={() => handleSort("customerName")}>
                        {t("cargo.customer")} <SortIcon field="customerName" />
                    </div>
                    <div className="cargo-th cargo-th-cargo">{t("cargo.cargoCompany")}</div>
                    <div className="cargo-th cargo-th-tracking">{t("cargo.trackingNo")}</div>
                    <div className="cargo-th cargo-th-date" onClick={() => handleSort("timestamp")}>
                        {t("cargo.date")} <SortIcon field="timestamp" />
                    </div>
                    <div className="cargo-th cargo-th-status" onClick={() => handleSort("status")}>
                        {t("cargo.status")} <SortIcon field="status" />
                    </div>
                    <div className="cargo-th cargo-th-action">{t("cargo.action")}</div>
                </div>

                {/* Table Body */}
                {loading ? (
                    <div className="cargo-loading">
                        <div className="cargo-loading-spinner"></div>
                        <span>{t("cargo.loadingData")}</span>
                    </div>
                ) : currentOrders.length > 0 ? (
                    <div className="cargo-table-body">
                        {currentOrders.map((order, idx) => {
                            const si = getStatusInfo(order.status);
                            const isExpanded = expandedRow === idx;
                            return (
                                <React.Fragment key={`${order.orderNumber}-${idx}`}>
                                    <motion.div
                                        className={`cargo-table-row ${isExpanded ? "expanded" : ""}`}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                        style={{ background: idx % 2 === 0 ? C.glass : "transparent" }}>
                                        <div className="cargo-td cargo-td-order">
                                            <span className="cargo-order-num">{order.orderNumber || "—"}</span>
                                        </div>
                                        <div className="cargo-td cargo-td-customer">
                                            <span>{order.customerName || "—"}</span>
                                        </div>
                                        <div className="cargo-td cargo-td-cargo">
                                            <span>{order.cargoProviderName || "—"}</span>
                                        </div>
                                        <div className="cargo-td cargo-td-tracking">
                                            <span className="cargo-tracking-num">{order.trackingNumber || "—"}</span>
                                        </div>
                                        <div className="cargo-td cargo-td-date">
                                            <span>{fmtDate(order.orderDate || order.timestamp)}</span>
                                        </div>
                                        <div className="cargo-td cargo-td-status">
                                            <span className="cargo-status-badge" style={{ background: `${si.color}15`, color: si.color, border: `1px solid ${si.color}30` }}>
                                                {si.icon} {si.label}
                                            </span>
                                        </div>
                                        <div className="cargo-td cargo-td-action">
                                            {order.cargoTrackingLink ? (
                                                <a href={order.cargoTrackingLink} target="_blank" rel="noopener noreferrer"
                                                    className="cargo-track-link" onClick={e => e.stopPropagation()}>
                                                    <FaExternalLinkAlt /> {t("cargo.track")}
                                                </a>
                                            ) : (
                                                <span className="cargo-no-link">—</span>
                                            )}
                                            <FaChevronDown className={`cargo-expand-icon ${isExpanded ? "rotated" : ""}`} />
                                        </div>
                                    </motion.div>

                                    {/* Expanded Detail */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div className="cargo-expanded-row"
                                                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                                                <div className="cargo-detail-grid">
                                                    <div className="cargo-detail-item">
                                                        <span className="cargo-detail-label">{t("cargo.marketplace")}</span>
                                                        <span className="cargo-detail-value" style={{ color: C.accent }}>{order.marketplace || marketplace?.marketplaceName || "—"}</span>
                                                    </div>
                                                    <div className="cargo-detail-item">
                                                        <span className="cargo-detail-label">{t("cargo.orderDate")}</span>
                                                        <span className="cargo-detail-value">{fmtDate(order.orderDate)}</span>
                                                    </div>
                                                    <div className="cargo-detail-item">
                                                        <span className="cargo-detail-label">{t("cargo.cargoCompany")}</span>
                                                        <span className="cargo-detail-value">{order.cargoProviderName || "—"}</span>
                                                    </div>
                                                    <div className="cargo-detail-item">
                                                        <span className="cargo-detail-label">{t("cargo.trackingNo")}</span>
                                                        <span className="cargo-detail-value" style={{ fontFamily: "monospace" }}>{order.trackingNumber || "—"}</span>
                                                    </div>
                                                </div>
                                                {order.products && order.products.length > 0 && (
                                                    <div className="cargo-products-section">
                                                        <span className="cargo-detail-label" style={{ marginBottom: "0.5rem", display: "block" }}>{t("cargo.productsLabel")} ({order.products.length})</span>
                                                        <div className="cargo-products-list">
                                                            {order.products.map((product, pidx) => (
                                                                <div key={pidx} className="cargo-product-row">
                                                                    {product.imageUrl ? (
                                                                        <img src={product.imageUrl} alt="" className="cargo-product-img"
                                                                            onError={(e) => { e.target.style.display = 'none'; }} />
                                                                    ) : (
                                                                        <div className="cargo-product-img-placeholder">📦</div>
                                                                    )}
                                                                    <span className="cargo-product-name">{product.productName || "Ürün adı yok"}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                    </div>
                ) : (
                    <div className="cargo-empty">
                        <span className="cargo-empty-icon">📭</span>
                        <h3>{t("cargo.notFound")}</h3>
                        <p>{marketplace?.name || marketplace?.marketplaceName || ''} {t("cargo.notFoundDesc")}</p>
                    </div>
                )}
            </div>

            {/* ── PAGINATION ── */}
            {totalPages > 1 && (
                <div className="cargo-pagination">
                    <button className="cargo-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <FaChevronLeft /> {t("cargo.previous")}
                    </button>
                    <div className="cargo-page-numbers">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let page;
                            if (totalPages <= 7) page = i + 1;
                            else if (currentPage <= 4) page = i + 1;
                            else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                            else page = currentPage - 3 + i;
                            return (
                                <button key={page}
                                    className={`cargo-page-num ${currentPage === page ? "active" : ""}`}
                                    onClick={() => setCurrentPage(page)}>
                                    {page}
                                </button>
                            );
                        })}
                    </div>
                    <span className="cargo-page-info">{filteredOrders.length} {t("cargo.cargo")}</span>
                    <button className="cargo-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                        {t("cargo.next")} <FaChevronRight />
                    </button>
                </div>
            )}
        </div>
    );
};

export default CargoTrackingPage;
