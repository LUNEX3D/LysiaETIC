import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaInfoCircle,
    FaSearch,
    FaFilter,
    FaUpload,
    FaDownload,
    FaPlus,
    FaTrash,
    FaUserCheck,
} from "react-icons/fa";
import { fetchStoreCustomers } from "../../../services/storeApi";
import CustomerExportModal from "./CustomerExportModal";
import CustomerImportModal from "./CustomerImportModal";
import {
    fmtTry,
    fmtCustomerDate,
    customerFullName,
    CUSTOMER_FILTER_TYPES,
} from "./customerUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const PAGE_SIZE = 20;

const FILTER_OPS = {
    marketingConsent: [
        { value: "yes", label: "İzni Var" },
        { value: "no", label: "İzni Yok" },
    ],
    hasAccount: [
        { value: "yes", label: "Hesabı Var" },
        { value: "no", label: "Hesabı Yok" },
    ],
};

const EcommerceCustomersListPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterType, setFilterType] = useState("marketingConsent");
    const [filterValue, setFilterValue] = useState("");
    const [appliedFilter, setAppliedFilter] = useState(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = { q: search.trim() || undefined };
            if (appliedFilter?.type === "marketingConsent") {
                params.marketingConsent = appliedFilter.value;
            }
            if (appliedFilter?.type === "hasAccount") {
                params.hasAccount = appliedFilter.value;
            }
            if (appliedFilter?.type === "group") params.group = appliedFilter.value;
            if (appliedFilter?.type === "tag") params.tag = appliedFilter.value;
            const res = await fetchStoreCustomers(params);
            setCustomers(res.customers || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [search, appliedFilter]);

    useEffect(() => {
        const t = setTimeout(() => load(), search ? 300 : 0);
        return () => clearTimeout(t);
    }, [load, search]);

    useEffect(() => {
        setPage(1);
    }, [search, appliedFilter, pageSize]);

    const filtered = customers;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * pageSize;
    const paged = filtered.slice(pageStart, pageStart + pageSize);

    const applyFilter = () => {
        if (!filterValue && filterType !== "group" && filterType !== "tag") {
            if (filterType === "marketingConsent" || filterType === "hasAccount") {
                setAppliedFilter(null);
                setFilterOpen(false);
                return;
            }
        }
        setAppliedFilter({ type: filterType, value: filterValue });
        setFilterOpen(false);
    };

    const clearFilter = () => {
        setAppliedFilter(null);
        setFilterValue("");
    };

    if (loading && !customers.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-customers-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Müşteriler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" className="ec-prod-btn" onClick={() => setExportOpen(true)}>
                            <FaUpload /> Dışa Aktar
                        </button>
                        <button type="button" className="ec-prod-btn" onClick={() => setImportOpen(true)}>
                            <FaDownload /> İçe Aktar
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-customer-create")}
                        >
                            <FaPlus /> Müşteri Ekle
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="ec-purchase-form-error" style={{ margin: 0 }}>
                        {error}
                    </div>
                )}

                <div className="ec-orders-toolbar ec-customers-toolbar">
                    <label className="ec-orders-search ec-customers-search">
                        <FaSearch />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tabloda arama yapın"
                        />
                    </label>
                    <button
                        type="button"
                        className={`ec-prod-btn${filterOpen ? " ec-prod-btn--active" : ""}`}
                        onClick={() => setFilterOpen((o) => !o)}
                    >
                        <FaFilter /> Filtre
                    </button>
                </div>

                {filterOpen && (
                    <div className="ec-customer-filter-row">
                        <select
                            value={filterType}
                            onChange={(e) => {
                                setFilterType(e.target.value);
                                setFilterValue("");
                            }}
                        >
                            {CUSTOMER_FILTER_TYPES.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                        {(filterType === "marketingConsent" || filterType === "hasAccount") && (
                            <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                                <option value="">Seçiniz</option>
                                {(FILTER_OPS[filterType] || []).map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        {(filterType === "group" || filterType === "tag") && (
                            <input
                                value={filterValue}
                                onChange={(e) => setFilterValue(e.target.value)}
                                placeholder="Değer girin"
                            />
                        )}
                        {appliedFilter && (
                            <button type="button" className="ec-prod-icon-btn" onClick={clearFilter} title="Filtreyi kaldır">
                                <FaTrash />
                            </button>
                        )}
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={applyFilter}>
                            Uygula
                        </button>
                    </div>
                )}

                <div className="ec-orders-table-wrap">
                    {paged.length === 0 ? (
                        <div className="ec-orders-empty">
                            <h2>Müşteri bulunamadı</h2>
                            <p>Henüz müşteri yok veya arama kriterlerinize uygun sonuç bulunamadı.</p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                style={{ marginTop: "1rem" }}
                                onClick={() => onNavigate?.("ec-customer-create")}
                            >
                                Müşteri Ekle
                            </button>
                        </div>
                    ) : (
                        <table className="ec-orders-table ec-customers-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input type="checkbox" aria-label="Tümünü seç" disabled />
                                    </th>
                                    <th>Müşteri</th>
                                    <th>Oluşturulma Tarihi</th>
                                    <th>İletişim İzni</th>
                                    <th>Toplam Sipariş</th>
                                    <th>Hesap Durumu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((c) => {
                                    const id = String(c._id);
                                    const orders = c.orderCount || 0;
                                    return (
                                        <tr key={id} onClick={() => onNavigate?.(`ec-customer-${id}`)}>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" disabled />
                                            </td>
                                            <td>
                                                <div className="ec-customer-cell">
                                                    <strong>{customerFullName(c)}</strong>
                                                    <span>
                                                        {c.email}
                                                        {c.phone ? ` · ${c.phoneCountryCode || ""}${c.phone}` : ""}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{fmtCustomerDate(c.createdAt)}</td>
                                            <td>
                                                <span
                                                    className={`ec-customer-badge${
                                                        c.marketingEmailConsent
                                                            ? " ec-customer-badge--ok"
                                                            : " ec-customer-badge--muted"
                                                    }`}
                                                >
                                                    {c.marketingEmailConsent ? "İzni Var" : "İzni Yok"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="ec-customer-cell">
                                                    {orders > 0 ? (
                                                        <>
                                                            <strong>{fmtTry(c.totalSpent)}</strong>
                                                            <span>{orders} Sipariş</span>
                                                        </>
                                                    ) : (
                                                        <span className="ec-prod-muted">Sipariş Yok</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="ec-customer-account">
                                                    <FaUserCheck />
                                                    {c.hasAccount ? "Hesabı Var" : "Hesabı Yok"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {paged.length > 0 && (
                    <footer className="ec-customers-foot">
                        <div className="ec-customers-foot__left">
                            <label>
                                Satır Adedi
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                >
                                    {[10, 20, 50].map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <span>
                                {pageStart + 1} - {Math.min(pageStart + pageSize, filtered.length)} /{" "}
                                {filtered.length} Müşteri
                            </span>
                        </div>
                        <div className="ec-customers-foot__pages">
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Önceki
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`ec-prod-btn${n === safePage ? " ec-prod-btn--primary" : ""}`}
                                    onClick={() => setPage(n)}
                                >
                                    {n}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Sonraki
                            </button>
                        </div>
                    </footer>
                )}
            </div>

            <CustomerExportModal
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                customers={filtered}
                totalCount={filtered.length}
            />
            <CustomerImportModal open={importOpen} onClose={() => setImportOpen(false)} />
        </div>
    );
};

export default EcommerceCustomersListPage;
