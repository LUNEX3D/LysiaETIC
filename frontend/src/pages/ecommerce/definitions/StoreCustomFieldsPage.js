import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaArrowLeft, FaPlus, FaInfoCircle, FaSearch, FaSort } from "react-icons/fa";
import { fetchStoreCustomFields } from "../../../services/storeApi";
import CustomFieldDrawer from "./CustomFieldDrawer";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import {
    getCustomFieldTypeLabel,
    getCustomFieldTypeMeta,
    definedValuesLabel,
} from "./customFieldFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreCustomFieldsPage = ({ onNavigate }) => {
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("name");
    const [sortAsc, setSortAsc] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editField, setEditField] = useState(null);
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCustomFields();
            setFields(res.fields || []);
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
        let rows = fields;
        if (q) {
            rows = rows.filter(
                (f) =>
                    f.name?.toLowerCase().includes(q) ||
                    getCustomFieldTypeLabel(f.type).toLowerCase().includes(q)
            );
        }
        return [...rows].sort((a, b) => {
            let cmp = 0;
            if (sortKey === "type") {
                cmp = getCustomFieldTypeLabel(a.type).localeCompare(
                    getCustomFieldTypeLabel(b.type),
                    "tr"
                );
            } else {
                cmp = String(a.name || "").localeCompare(String(b.name || ""), "tr");
            }
            return sortAsc ? cmp : -cmp;
        });
    }, [fields, search, sortKey, sortAsc]);

    const openAdd = () => {
        setEditField(null);
        setDrawerOpen(true);
    };

    const openEdit = (field) => {
        setEditField(field);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setEditField(null);
    };

    const handleDeleted = async () => {
        await load();
        pushToast("success", "Özel Alan silindi.");
    };

    const isEmpty = !loading && !fields.length;

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
                            Özel Alanlar <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                        </h1>
                    </div>
                    {!isEmpty && (
                        <div className="ec-cat-list-head__actions">
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={openAdd}
                            >
                                <FaPlus /> Özel Alan Ekle
                            </button>
                        </div>
                    )}
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
                ) : isEmpty ? (
                    <div className="ec-cf-empty">
                        <div className="ec-cf-empty__illus" aria-hidden="true">
                            <span className="ec-cf-empty__card ec-cf-empty__card--back" />
                            <span className="ec-cf-empty__card ec-cf-empty__card--mid" />
                            <span className="ec-cf-empty__card ec-cf-empty__card--front">
                                <FaPlus />
                            </span>
                        </div>
                        <h2>Özel Alan Ekleyin</h2>
                        <p>
                            Online mağazanız hakkında özel bilgileri takip etmek amacıyla veya çeşitli
                            şekillerde görüntülemek için özel alan ekleyin.
                        </p>
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={openAdd}>
                            Özel Alan Ekle
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
                            <table className="ec-prod-table ec-cat-list-table ec-cf-list-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <button
                                                type="button"
                                                className="ec-brand-sort-head"
                                                onClick={() => toggleSort("name")}
                                            >
                                                Ad <FaSort />
                                            </button>
                                        </th>
                                        <th>
                                            <button
                                                type="button"
                                                className="ec-brand-sort-head"
                                                onClick={() => toggleSort("type")}
                                            >
                                                Tür <FaSort />
                                            </button>
                                        </th>
                                        <th>Tanımlanmış Değerler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length ? (
                                        filtered.map((field) => {
                                            const typeMeta = getCustomFieldTypeMeta(field.type);
                                            const TypeIcon = typeMeta?.Icon;
                                            const values = definedValuesLabel(field);
                                            return (
                                                <tr
                                                    key={field._id}
                                                    className="ec-cat-list-row"
                                                    onClick={() => openEdit(field)}
                                                >
                                                    <td>
                                                        <strong>{field.name}</strong>
                                                    </td>
                                                    <td>
                                                        <span className="ec-cf-list-type">
                                                            {TypeIcon && <TypeIcon aria-hidden="true" />}
                                                            {getCustomFieldTypeLabel(field.type)}
                                                        </span>
                                                    </td>
                                                    <td className="ec-cf-list-values">{values || ""}</td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="ec-cat-list-empty">
                                                Özel alan bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <footer className="ec-brand-list-foot">
                            1 – {filtered.length} / {fields.length} adet
                        </footer>
                    </>
                )}

                <CustomFieldDrawer
                    open={drawerOpen}
                    field={editField}
                    onClose={closeDrawer}
                    onSaved={load}
                    onDeleted={handleDeleted}
                />

                <EcToast toasts={toasts} onDismiss={dismissToast} />
            </div>
        </div>
    );
};

export default StoreCustomFieldsPage;
