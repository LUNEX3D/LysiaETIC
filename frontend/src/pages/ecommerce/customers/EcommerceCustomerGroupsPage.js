import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaInfoCircle, FaPlus, FaSearch, FaUsers } from "react-icons/fa";
import { fetchStoreCustomerGroups } from "../../../services/storeApi";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const PAGE_SIZE = 20;

const typeLabel = (type) => (type === "dynamic" ? "Dinamik Müşteri Grubu" : "Müşteri Grubu");

const EcommerceCustomerGroupsPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [groups, setGroups] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCustomerGroups();
            setGroups(res.groups || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter((g) => (g.name || "").toLowerCase().includes(q));
    }, [groups, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * pageSize;
    const paged = filtered.slice(pageStart, pageStart + pageSize);

    useEffect(() => {
        setPage(1);
    }, [search, pageSize]);

    if (loading && !groups.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    const isEmpty = groups.length === 0;

    return (
        <div className="ec-prod-page ec-customers-page">
            <div className="ec-prod-panel">
                {!isEmpty && (
                    <header className="ec-prod-head">
                        <h1>
                            Müşteri Grupları{" "}
                            <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} title="Müşteri gruplarını kampanya ve raporlarda kullanabilirsiniz." />
                        </h1>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-customer-group-create")}
                        >
                            <FaPlus /> Müşteri Grubu Ekle
                        </button>
                    </header>
                )}

                {error && (
                    <div className="ec-purchase-form-error" style={{ margin: isEmpty ? "1rem 0 0" : 0 }}>
                        {error}
                    </div>
                )}

                {isEmpty ? (
                    <div className="ec-customers-groups-empty">
                        <div className="ec-customers-groups-empty__icon" aria-hidden>
                            <span />
                            <span />
                            <span />
                        </div>
                        <h2>
                            Müşteri Gruplarınızı Yönetin{" "}
                            <FaInfoCircle style={{ fontSize: 14, opacity: 0.45 }} />
                        </h2>
                        <p>
                            Müşteri gruplarınızı kampanyalarda ve raporlamalarda, dinamik müşteri gruplarınızı ise
                            toplu e-posta gönderimlerinde kullanabilirsiniz.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-customer-group-create")}
                        >
                            Müşteri Grubu Ekle
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ec-orders-toolbar ec-customers-toolbar">
                            <label className="ec-orders-search ec-customers-search">
                                <FaSearch />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Tabloda arama yapın"
                                />
                            </label>
                        </div>

                        <div className="ec-orders-table-wrap">
                            {paged.length === 0 ? (
                                <div className="ec-orders-empty">
                                    <p>Aramanızla eşleşen grup bulunamadı.</p>
                                </div>
                            ) : (
                                <table className="ec-orders-table ec-customers-groups-table">
                                    <thead>
                                        <tr>
                                            <th className="ec-orders-table__check">
                                                <input type="checkbox" aria-label="Tümünü seç" disabled />
                                            </th>
                                            <th>Müşteri Grubu Adı</th>
                                            <th>Tür</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.map((g) => (
                                            <tr
                                                key={g._id}
                                                className="ec-orders-table__row--click"
                                                onClick={() => onNavigate?.(`ec-customer-group-edit-${g._id}`)}
                                            >
                                                <td className="ec-orders-table__check" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" aria-label={`${g.name} seç`} />
                                                </td>
                                                <td>
                                                    <strong>{g.name}</strong>
                                                </td>
                                                <td>
                                                    <span className="ec-customers-group-type">
                                                        <FaUsers aria-hidden />
                                                        {typeLabel(g.type)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {filtered.length > 0 && (
                            <footer className="ec-customers-foot">
                                <label className="ec-customers-foot__size">
                                    Satır Adedi:
                                    <select
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                    >
                                        {[20, 50, 100].map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <span>
                                    {filtered.length === 0
                                        ? "0 adet"
                                        : `${pageStart + 1} - ${Math.min(pageStart + pageSize, filtered.length)} / ${filtered.length} adet`}
                                </span>
                                <div className="ec-customers-foot__pages">
                                    <button
                                        type="button"
                                        className="ec-prod-btn"
                                        disabled={safePage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        Önceki
                                    </button>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default EcommerceCustomerGroupsPage;
