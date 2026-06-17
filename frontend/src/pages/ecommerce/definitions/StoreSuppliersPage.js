import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaArrowLeft, FaPlus, FaInfoCircle, FaSearch, FaSort } from "react-icons/fa";
import { fetchStoreSuppliers } from "../../../services/storeApi";
import { formatSupplierPhone } from "./supplierFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreSuppliersPage = ({ onNavigate }) => {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("name");
    const [sortAsc, setSortAsc] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreSuppliers();
            setSuppliers(res.suppliers || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortAsc((v) => !v);
        else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = suppliers;
        if (q) {
            rows = rows.filter(
                (s) =>
                    s.name?.toLowerCase().includes(q) ||
                    s.email?.toLowerCase().includes(q) ||
                    formatSupplierPhone(s).toLowerCase().includes(q)
            );
        }
        return [...rows].sort((a, b) => {
            let av = "";
            let bv = "";
            if (sortKey === "email") {
                av = a.email || "";
                bv = b.email || "";
            } else if (sortKey === "phone") {
                av = formatSupplierPhone(a);
                bv = formatSupplierPhone(b);
            } else {
                av = a.name || "";
                bv = b.name || "";
            }
            const cmp = String(av).localeCompare(String(bv), "tr");
            return sortAsc ? cmp : -cmp;
        });
    }, [suppliers, search, sortKey, sortAsc]);

    const openSupplier = (id) => onNavigate?.(`ec-supplier-edit-${id}`);

    return (
        <div className="ec-prod-page">
            <div className="ec-prod-panel">
                <header className="ec-cat-list-head ec-prod-head">
                    <div className="ec-cat-list-head__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-products-definitions")}
                        >
                            <FaArrowLeft />
                        </button>
                        <h1>
                            Tedarikçiler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                        </h1>
                    </div>
                    <div className="ec-cat-list-head__actions">
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-supplier-add")}
                        >
                            <FaPlus /> Tedarikçi Ekle
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="ec-prod-form-error" style={{ padding: "0.75rem 1.15rem" }}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <p className="ec-prod-muted" style={{ padding: "1rem 1.15rem" }}>
                        Yükleniyor…
                    </p>
                ) : !suppliers.length ? (
                    <div className="ec-cat-empty">
                        <div className="ec-cat-empty__illus ec-supplier-empty-illus" />
                        <h2>Tedarikçilerinizi yönetin</h2>
                        <p>Tedarikçi iletişim bilgilerini kaydedin ve satın alma süreçlerinizde kullanın.</p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-supplier-add")}
                        >
                            Tedarikçi Ekle
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ec-prod-toolbar" style={{ padding: "0.75rem 1.15rem" }}>
                            <label className="ec-prod-search">
                                <FaSearch style={{ color: "var(--ec-muted)" }} />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Tabloda arama yapın"
                                />
                            </label>
                        </div>

                        <div className="ec-prod-table-wrap">
                            <table className="ec-prod-table ec-cat-list-table ec-supplier-list-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <button type="button" className="ec-brand-sort-head" onClick={() => toggleSort("name")}>
                                                Ad <FaSort />
                                            </button>
                                        </th>
                                        <th>
                                            <button type="button" className="ec-brand-sort-head" onClick={() => toggleSort("email")}>
                                                E-Posta <FaSort />
                                            </button>
                                        </th>
                                        <th>
                                            <button type="button" className="ec-brand-sort-head" onClick={() => toggleSort("phone")}>
                                                Telefon Numarası <FaSort />
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length ? (
                                        filtered.map((supplier) => (
                                            <tr
                                                key={supplier._id}
                                                className="ec-cat-list-row"
                                                onClick={() => openSupplier(supplier._id)}
                                            >
                                                <td>
                                                    <strong>{supplier.name}</strong>
                                                </td>
                                                <td>{supplier.email || "—"}</td>
                                                <td>{formatSupplierPhone(supplier) || "—"}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="ec-cat-list-empty">
                                                Tedarikçi bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <footer className="ec-brand-list-foot">
                            1 – {filtered.length} / {suppliers.length} adet
                        </footer>
                    </>
                )}
            </div>
        </div>
    );
};

export default StoreSuppliersPage;
