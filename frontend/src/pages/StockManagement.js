import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBoxOpen, FaSearch, FaTimes, FaChevronLeft, FaChevronRight,
    FaSortAmountDown, FaSortAmountUp, FaExclamationTriangle,
    FaCheckCircle, FaTimesCircle, FaExternalLinkAlt, FaBarcode,
    FaTag, FaPalette, FaRuler, FaTruck, FaPercent, FaInfoCircle,
    FaBoxes, FaFilter, FaSyncAlt
} from "react-icons/fa";
import { useApp } from "../context/AppContext";
import "../styles/StockManagement.css";

/* ── Format Price ── */
const formatPrice = (price) => {
    const num = Number(price);
    if (!num && num !== 0) return "—";
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
};

const StockManagement = ({ userId, marketplaceId, marketplace }) => {
    const { theme: C, t } = useApp();

    /* ── Stock Status Helper (C ve t bağımlı — component içinde olmalı) ── */
    const getStockStatus = useCallback((stock) => {
        const qty = Number(stock) || 0;
        if (qty === 0) return { label: t("stock.statusOut"), color: C.red, bg: "rgba(239,68,68,0.12)", icon: <FaTimesCircle /> };
        if (qty <= 5)  return { label: t("stock.statusCritical"), color: "#f97316", bg: "rgba(249,115,22,0.12)", icon: <FaExclamationTriangle /> };
        if (qty <= 20) return { label: t("stock.statusLow"), color: C.yellow, bg: "rgba(245,158,11,0.12)", icon: <FaExclamationTriangle /> };
        return { label: t("stock.statusSufficient"), color: C.green, bg: "rgba(34,197,94,0.10)", icon: <FaCheckCircle /> };
    }, [C, t]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [stockFilter, setStockFilter] = useState("all");
    const [sortField, setSortField] = useState("productName");
    const [sortDir, setSortDir] = useState("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const productsPerPage = 25;

    /* ── Fetch Products ── */
    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/products/all?marketplaceId=${marketplaceId}`);
            // ✅ FIX: Backend ok() helper → { success, message, data: { products: [...] } }
            // response.data = axios body, response.data.data = ok() helper'ın data parametresi
            const body = response.data;
            const products = body?.data?.products || body?.products || body?.data || [];
            setProducts(Array.isArray(products) ? products : []);
        } catch (err) {
            console.error("Stok verileri alınamadı:", err);
            setError(t("stock.loadError") || "Ürünler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    }, [userId, marketplaceId, t]);

    useEffect(() => {
        if (marketplaceId) {
            fetchProducts();
            setCurrentPage(1);
        }
    }, [marketplaceId, fetchProducts]);

    /* ── Summary Stats ── */
    const stats = useMemo(() => {
        const total = products.length;
        let inStock = 0, lowStock = 0, critical = 0, outOfStock = 0, totalValue = 0;
        products.forEach(p => {
            const qty = Number(p.stock) || 0;
            const price = Number(p.price) || 0;
            totalValue += qty * price;
            if (qty === 0) outOfStock++;
            else if (qty <= 5) critical++;
            else if (qty <= 20) lowStock++;
            else inStock++;
        });
        return { total, inStock, lowStock, critical, outOfStock, totalValue };
    }, [products]);

    /* ── Filter & Sort ── */
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Search
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                (p.productName || "").toLowerCase().includes(term) ||
                (p.barcode || "").toLowerCase().includes(term) ||
                (p.categoryName || "").toLowerCase().includes(term) ||
                (p.brand || "").toLowerCase().includes(term) ||
                (p.stockCode || "").toLowerCase().includes(term) ||
                (p.productId || "").toString().toLowerCase().includes(term)
            );
        }

        // Stock filter
        if (stockFilter !== "all") {
            result = result.filter(p => {
                const qty = Number(p.stock) || 0;
                switch (stockFilter) {
                    case "inStock":    return qty > 20;
                    case "low":        return qty > 5 && qty <= 20;
                    case "critical":   return qty > 0 && qty <= 5;
                    case "outOfStock": return qty === 0;
                    default: return true;
                }
            });
        }

        // Sort
        result.sort((a, b) => {
            let valA, valB;
            switch (sortField) {
                case "stock":
                    valA = Number(a.stock) || 0;
                    valB = Number(b.stock) || 0;
                    break;
                case "price":
                    valA = Number(a.price) || 0;
                    valB = Number(b.price) || 0;
                    break;
                case "productName":
                default:
                    valA = (a.productName || "").toLowerCase();
                    valB = (b.productName || "").toLowerCase();
                    return sortDir === "asc" ? valA.localeCompare(valB, "tr") : valB.localeCompare(valA, "tr");
            }
            return sortDir === "asc" ? valA - valB : valB - valA;
        });

        return result;
    }, [products, searchTerm, stockFilter, sortField, sortDir]);

    /* ── Pagination ── */
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * productsPerPage,
        currentPage * productsPerPage
    );

    useEffect(() => { setCurrentPage(1); }, [searchTerm, stockFilter, sortField, sortDir]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null;
        return sortDir === "asc" ? <FaSortAmountUp className="sm-sort-icon" /> : <FaSortAmountDown className="sm-sort-icon" />;
    };

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div className="sm-container">
            {/* ── Header ── */}
            <div className="sm-header">
                <div className="sm-header-left">
                    <FaBoxOpen className="sm-header-icon" />
                    <div>
                        <h1 className="sm-title">{t("stock.pageTitle")}</h1>
                        <p className="sm-subtitle">{marketplace?.name || ""} • {stats.total} {t("stock.products")}</p>
                    </div>
                </div>
                <button className="sm-refresh-btn" onClick={fetchProducts} disabled={isLoading}>
                    <FaSyncAlt className={isLoading ? "sm-spin" : ""} />
                    <span>{t("stock.refresh")}</span>
                </button>
            </div>

            {/* ── Summary Cards ── */}
            <div className="sm-stats-row">
                {[
                    { label: t("stock.totalProducts"), value: stats.total, icon: <FaBoxes />, color: C.accent },
                    { label: t("stock.sufficient"), value: stats.inStock, icon: <FaCheckCircle />, color: C.green },
                    { label: t("stock.low"), value: stats.lowStock, icon: <FaExclamationTriangle />, color: C.yellow },
                    { label: t("stock.critical"), value: stats.critical, icon: <FaExclamationTriangle />, color: "#f97316" },
                    { label: t("stock.outOfStock"), value: stats.outOfStock, icon: <FaTimesCircle />, color: C.red },
                ].map((s, i) => (
                    <motion.div key={i} className="sm-stat-card" whileHover={{ y: -2 }}
                        style={{ borderColor: `${s.color}22` }}
                        onClick={() => {
                            const filters = ["all", "inStock", "low", "critical", "outOfStock"];
                            setStockFilter(stockFilter === filters[i] && i !== 0 ? "all" : filters[i]);
                        }}
                    >
                        <div className="sm-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                        <div className="sm-stat-info">
                            <span className="sm-stat-value" style={{ color: s.color }}>{s.value}</span>
                            <span className="sm-stat-label">{s.label}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Toolbar: Search + Filters ── */}
            <div className="sm-toolbar">
                <div className="sm-search-box">
                    <FaSearch className="sm-search-icon" />
                    <input
                        type="text"
                        placeholder={t("stock.searchPlaceholder")}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="sm-search-input"
                    />
                    {searchTerm && (
                        <button className="sm-search-clear" onClick={() => setSearchTerm("")}><FaTimes /></button>
                    )}
                </div>
                <div className="sm-filter-group">
                    <FaFilter className="sm-filter-icon" />
                    <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="sm-select">
                        <option value="all">{t("stock.allStock")}</option>
                        <option value="inStock">{t("stock.sufficientFilter")}</option>
                        <option value="low">{t("stock.lowFilter")}</option>
                        <option value="critical">{t("stock.criticalFilter")}</option>
                        <option value="outOfStock">{t("stock.outFilter")}</option>
                    </select>
                </div>
                <span className="sm-result-count">{filteredProducts.length} {t("stock.results")}</span>
            </div>

            {/* ── Error State ── */}
            {error && (
                <div className="sm-error">
                    <FaExclamationTriangle />
                    <span>{error}</span>
                    <button onClick={fetchProducts}>{t("stock.retryBtn")}</button>
                </div>
            )}

            {/* ── Loading State ── */}
            {isLoading ? (
                <div className="sm-loading">
                    <div className="sm-loading-spinner" />
                    <p>{t("stock.loadingProducts")}</p>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="sm-empty">
                    <FaBoxOpen className="sm-empty-icon" />
                    <h3>{products.length === 0 ? t("stock.noProducts") : t("stock.noFilterMatch")}</h3>
                    <p>{products.length === 0 ? t("stock.noProductsDesc") : t("stock.noFilterMatchDesc")}</p>
                </div>
            ) : (
                <>
                    {/* ── Product List Table ── */}
                    <div className="sm-table-wrapper">
                        <table className="sm-table">
                            <thead>
                                <tr>
                                    <th className="sm-th-img">{t("stock.image")}</th>
                                    <th className="sm-th-name sm-sortable" onClick={() => handleSort("productName")}>
                                        {t("stock.productName")} <SortIcon field="productName" />
                                    </th>
                                    <th className="sm-th-barcode">{t("stock.barcode")}</th>
                                    <th className="sm-th-category">{t("stock.category")}</th>
                                    <th className="sm-th-variant">{t("stock.colorSize")}</th>
                                    <th className="sm-th-price sm-sortable" onClick={() => handleSort("price")}>
                                        {t("stock.price")} <SortIcon field="price" />
                                    </th>
                                    <th className="sm-th-stock sm-sortable" onClick={() => handleSort("stock")}>
                                        {t("stock.stockCol")} <SortIcon field="stock" />
                                    </th>
                                    <th className="sm-th-status">{t("stock.statusCol")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.map((product, idx) => {
                                    const stockStatus = getStockStatus(product.stock);
                                    const qty = Number(product.stock) || 0;
                                    return (
                                        <motion.tr
                                            key={product.productId || product.barcode || idx}
                                            className="sm-row"
                                            onClick={() => setSelectedProduct(product)}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.015, duration: 0.2 }}
                                            whileHover={{ backgroundColor: "rgba(78,205,196,0.04)" }}
                                        >
                                            <td className="sm-td-img">
                                                <div className="sm-product-thumb">
                                                    {product.productImage && product.productImage !== "https://via.placeholder.com/300" ? (
                                                        <img src={product.productImage} alt="" loading="lazy" />
                                                    ) : (
                                                        <div className="sm-no-img"><FaBoxOpen /></div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="sm-td-name">
                                                <span className="sm-product-name">{product.productName || "İsimsiz Ürün"}</span>
                                                {product.brand && product.brand !== "Bilinmiyor" && (
                                                    <span className="sm-product-brand">{product.brand}</span>
                                                )}
                                            </td>
                                            <td className="sm-td-barcode">
                                                <code className="sm-barcode">{product.barcode || "—"}</code>
                                            </td>
                                            <td className="sm-td-category">{product.categoryName || "—"}</td>
                                            <td className="sm-td-variant">
                                                {product.color && product.color !== "Bilinmiyor" ? product.color : "—"}
                                                {" / "}
                                                {product.size && product.size !== "Bilinmiyor" ? product.size : "—"}
                                            </td>
                                            <td className="sm-td-price">{formatPrice(product.price)}</td>
                                            <td className="sm-td-stock">
                                                <span className="sm-stock-qty" style={{ color: stockStatus.color }}>{qty}</span>
                                            </td>
                                            <td className="sm-td-status">
                                                <span className="sm-stock-badge" style={{ color: stockStatus.color, background: stockStatus.bg }}>
                                                    {stockStatus.icon}
                                                    <span>{stockStatus.label}</span>
                                                </span>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination ── */}
                    {totalPages > 1 && (
                        <div className="sm-pagination">
                            <button
                                className="sm-page-btn"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <FaChevronLeft />
                            </button>

                            <div className="sm-page-numbers">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                    .reduce((acc, p, i, arr) => {
                                        if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, i) =>
                                        p === "..." ? (
                                            <span key={`dots-${i}`} className="sm-page-dots">…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                className={`sm-page-num ${currentPage === p ? "active" : ""}`}
                                                onClick={() => setCurrentPage(p)}
                                            >
                                                {p}
                                            </button>
                                        )
                                    )}
                            </div>

                            <button
                                className="sm-page-btn"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <FaChevronRight />
                            </button>

                            <span className="sm-page-info">
                                {(currentPage - 1) * productsPerPage + 1}–{Math.min(currentPage * productsPerPage, filteredProducts.length)} / {filteredProducts.length}
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════
               PRODUCT DETAIL MODAL
               ═══════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedProduct && (
                    <motion.div
                        className="sm-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedProduct(null)}
                    >
                        <motion.div
                            className="sm-modal"
                            initial={{ scale: 0.92, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 30 }}
                            transition={{ type: "spring", damping: 25, stiffness: 350 }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="sm-modal-header">
                                <h2>{t("stock.productDetail")}</h2>
                                <button className="sm-modal-close" onClick={() => setSelectedProduct(null)}>
                                    <FaTimes />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="sm-modal-body">
                                {/* Top Section: Image + Key Info */}
                                <div className="sm-modal-top">
                                    <div className="sm-modal-image">
                                        {selectedProduct.productImage && selectedProduct.productImage !== "https://via.placeholder.com/300" ? (
                                            <img src={selectedProduct.productImage} alt={selectedProduct.productName} />
                                        ) : (
                                            <div className="sm-modal-no-img"><FaBoxOpen /><span>{t("stock.noImage")}</span></div>
                                        )}
                                    </div>
                                    <div className="sm-modal-key-info">
                                        <h3 className="sm-modal-product-name">{selectedProduct.productName || "İsimsiz Ürün"}</h3>
                                        <span className="sm-modal-marketplace">{selectedProduct.marketplace || marketplace?.name}</span>

                                        {/* Stock Status Big Badge */}
                                        {(() => {
                                            const ss = getStockStatus(selectedProduct.stock);
                                            return (
                                                <div className="sm-modal-stock-badge" style={{ color: ss.color, background: ss.bg, borderColor: `${ss.color}33` }}>
                                                    {ss.icon}
                                                    <span className="sm-modal-stock-qty">{Number(selectedProduct.stock) || 0}</span>
                                                    <span className="sm-modal-stock-label">{t("stock.pieces")} — {ss.label}</span>
                                                </div>
                                            );
                                        })()}

                                        <div className="sm-modal-price-row">
                                            <span className="sm-modal-price">{formatPrice(selectedProduct.price)}</span>
                                            {selectedProduct.commissionRate && selectedProduct.commissionRate !== "Bilinmiyor" && (
                                                <span className="sm-modal-commission">
                                                    <FaPercent /> Komisyon: {selectedProduct.commissionRate}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Detail Grid */}
                                <div className="sm-modal-details">
                                    {[
                                        { icon: <FaBarcode />, label: t("stock.barcode"), value: selectedProduct.barcode },
                                        { icon: <FaTag />, label: t("stock.productId"), value: selectedProduct.productId },
                                        { icon: <FaTag />, label: t("stock.stockCode"), value: selectedProduct.stockCode },
                                        { icon: <FaBoxes />, label: t("stock.category"), value: selectedProduct.categoryName },
                                        { icon: <FaPalette />, label: t("stock.color"), value: selectedProduct.color },
                                        { icon: <FaRuler />, label: t("stock.size"), value: selectedProduct.size },
                                        { icon: <FaTruck />, label: t("stock.deliveryTime"), value: selectedProduct.deliveryTime },
                                        { icon: <FaInfoCircle />, label: t("stock.statusCol"), value: selectedProduct.status },
                                        { icon: <FaTag />, label: t("stock.brand"), value: selectedProduct.brand },
                                    ]
                                        .filter(d => d.value && d.value !== "Bilinmiyor" && d.value !== "UNKNOWN" && d.value !== "Yok")
                                        .map((d, i) => (
                                            <div key={i} className="sm-detail-item">
                                                <span className="sm-detail-icon">{d.icon}</span>
                                                <span className="sm-detail-label">{d.label}</span>
                                                <span className="sm-detail-value">{d.value}</span>
                                            </div>
                                        ))
                                    }
                                </div>

                                {/* Description */}
                                {selectedProduct.description && (
                                    <div className="sm-modal-desc">
                                        <h4>{t("stock.description")}</h4>
                                        <p>{selectedProduct.description}</p>
                                    </div>
                                )}

                                {/* Attributes */}
                                {selectedProduct.attributes && selectedProduct.attributes.length > 0 && (
                                    <div className="sm-modal-attrs">
                                        <h4>{t("stock.attributes")}</h4>
                                        <div className="sm-attrs-grid">
                                            {selectedProduct.attributes.map((attr, i) => (
                                                <div key={i} className="sm-attr-chip">
                                                    <span className="sm-attr-name">{attr.attributeName || attr.name || `Özellik ${i + 1}`}</span>
                                                    <span className="sm-attr-val">{attr.attributeValue || attr.value || "—"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Product Link */}
                                {selectedProduct.productUrl && selectedProduct.productUrl !== "#" && (
                                    <a href={selectedProduct.productUrl} target="_blank" rel="noopener noreferrer" className="sm-modal-link">
                                        <FaExternalLinkAlt /> {t("stock.viewOnMarketplace")}
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StockManagement;
