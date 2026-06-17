import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaSearch,
    FaSort,
    FaUpload,
    FaDownload,
} from "react-icons/fa";
import { fetchStoreVariantTypes } from "../../../services/storeApi";
import VariantTypeDrawer from "./VariantTypeDrawer";
import VariantTypeExportModal from "./VariantTypeExportModal";
import VariantValuesPreview from "./VariantValuesPreview";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import EcUsageGuideButton from "../../../components/ecommerce/EcUsageGuideButton";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/pageHelp.css";

const StoreVariantTypesPage = ({ onNavigate }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editRow, setEditRow] = useState(null);
    const [exportOpen, setExportOpen] = useState(false);
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreVariantTypes();
            setRows(res.variantTypes || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = rows;
        if (q) {
            list = list.filter(
                (row) =>
                    row.name?.toLowerCase().includes(q) ||
                    (row.values || []).some((v) => v.label?.toLowerCase().includes(q))
            );
        }
        return [...list].sort((a, b) => {
            const cmp = String(a.name || "").localeCompare(String(b.name || ""), "tr");
            return sortAsc ? cmp : -cmp;
        });
    }, [rows, search, sortAsc]);

    const openAdd = () => {
        setEditRow(null);
        setDrawerOpen(true);
    };

    const openEdit = (row) => {
        setEditRow(row);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setEditRow(null);
    };

    const handleDeleted = async () => {
        await load();
        pushToast("success", "Varyant türü silindi.");
    };

    const isEmpty = !loading && !rows.length;

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
                            Varyant Türleri
                            <EcUsageGuideButton pageId="ec-products-definitions-variant-types" />
                        </h1>
                    </div>
                    {!isEmpty && (
                        <div className="ec-cat-list-head__actions">
                            <button type="button" className="ec-prod-btn" onClick={() => setExportOpen(true)}>
                                <FaUpload /> Dışa Aktar
                            </button>
                            <button type="button" className="ec-prod-btn" disabled title="Yakında">
                                <FaDownload /> İçe Aktar
                            </button>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={openAdd}
                            >
                                <FaPlus /> Varyant Türü Ekle
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
                        <h2>Varyant Türü Ekleyin</h2>
                        <p>
                            Renk, beden veya model gibi varyant türlerini tanımlayın; ürünlerinize hızlıca
                            uygulayın.
                        </p>
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={openAdd}>
                            Varyant Türü Ekle
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
                            <table className="ec-prod-table ec-cat-list-table ec-vt-list-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <button
                                                type="button"
                                                className="ec-brand-sort-head"
                                                onClick={() => setSortAsc((v) => !v)}
                                            >
                                                Tür <FaSort />
                                            </button>
                                        </th>
                                        <th>Tanımlanmış Değerler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length ? (
                                        filtered.map((row) => (
                                            <tr
                                                key={row._id}
                                                className="ec-cat-list-row"
                                                onClick={() => openEdit(row)}
                                            >
                                                <td>
                                                    <strong>{row.name}</strong>
                                                </td>
                                                <td>
                                                    <VariantValuesPreview variantType={row} />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="ec-cat-list-empty">
                                                Varyant türü bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <footer className="ec-brand-list-foot">
                            1 – {filtered.length} / {rows.length} adet
                        </footer>
                    </>
                )}

                <VariantTypeDrawer
                    open={drawerOpen}
                    variantType={editRow}
                    onClose={closeDrawer}
                    onSaved={load}
                    onDeleted={handleDeleted}
                />
                <VariantTypeExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
                <EcToast toasts={toasts} onDismiss={dismissToast} />
            </div>
        </div>
    );
};

export default StoreVariantTypesPage;
