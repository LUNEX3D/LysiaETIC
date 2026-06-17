import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaSearch,
    FaSort,
    FaInfoCircle,
    FaTrash,
} from "react-icons/fa";
import {
    fetchStoreProductGroups,
    deleteStoreProductGroup,
} from "../../../services/storeApi";
import ProductGroupAddTypeModal from "./ProductGroupAddTypeModal";
import EcUsageGuideButton from "../../../components/ecommerce/EcUsageGuideButton";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import { GROUP_TYPE_LABELS } from "./productGroupFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/pageHelp.css";

const StoreProductGroupsPage = ({ onNavigate }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreProductGroups();
            setRows(res.groups || []);
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
                    (row.variantTypeLabels || []).some((l) => l.toLowerCase().includes(q))
            );
        }
        return [...list].sort((a, b) => {
            const cmp = String(a.name || "").localeCompare(String(b.name || ""), "tr");
            return sortAsc ? cmp : -cmp;
        });
    }, [rows, search, sortAsc]);

    const handleDelete = async (row, e) => {
        e.stopPropagation();
        if (!window.confirm(`"${row.name}" ürün grubunu silmek istediğinize emin misiniz?`)) return;
        try {
            await deleteStoreProductGroup(row._id);
            pushToast("success", "Ürün grubu silindi.");
            await load();
        } catch (err) {
            pushToast("error", err.response?.data?.error || "Silinemedi");
        }
    };

    const isEmpty = !loading && !rows.length;

    return (
        <div className="ec-prod-page">
            <EcToast toasts={toasts} onDismiss={dismissToast} />
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
                            Ürün Grupları
                            <EcUsageGuideButton pageId="ec-products-definitions-product-groups" />
                        </h1>
                    </div>
                    {!isEmpty && (
                        <div className="ec-cat-list-head__actions">
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={() => setAddModalOpen(true)}
                            >
                                <FaPlus /> Ürün Grubu Ekle
                            </button>
                        </div>
                    )}
                </header>

                <div className="ec-pg-plan-note">
                    <FaInfoCircle />
                    <span>
                        Ürün grupları, ürünlerinizi tek bir detay sayfasında varyant benzeri görünümle sunmanızı
                        sağlar. Her ürün kendi slug, meta bilgileri, açıklama ve görselleriyle ayrı yapılandırılabilir.
                    </span>
                </div>

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
                    <div className="ec-cat-empty">
                        <div className="ec-cat-empty__illus ec-pg-empty-illus" />
                        <h2>Ürün gruplarınızı yönetin</h2>
                        <p>
                            Ürünlerinizi belirli kriterlere göre gruplayarak detay sayfasında nasıl görüneceklerini
                            ayarlayın.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => setAddModalOpen(true)}
                        >
                            Ürün Grubu Ekle
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
                            <table className="ec-prod-table ec-cat-list-table ec-pg-list-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <button
                                                type="button"
                                                className="ec-prod-table-sort"
                                                onClick={() => setSortAsc((v) => !v)}
                                            >
                                                Grup Adı <FaSort />
                                            </button>
                                        </th>
                                        <th>Tür</th>
                                        <th>Seçenek Başlıkları</th>
                                        <th>Ürün Sayısı</th>
                                        <th aria-label="İşlemler" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((row) => (
                                        <tr
                                            key={row._id}
                                            className="ec-prod-table-row--clickable"
                                            onClick={() => onNavigate?.(`ec-product-group-edit-${row._id}`)}
                                        >
                                            <td>{row.name}</td>
                                            <td>{GROUP_TYPE_LABELS[row.groupType] || row.groupType}</td>
                                            <td>{(row.variantTypeLabels || []).join(", ") || "—"}</td>
                                            <td>{row.productCount ?? row.items?.length ?? 0}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                    title="Sil"
                                                    onClick={(e) => handleDelete(row, e)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            <ProductGroupAddTypeModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSelectManual={() => {
                    setAddModalOpen(false);
                    onNavigate?.("ec-product-group-add-manual");
                }}
                onSelectAutomatic={() => {
                    setAddModalOpen(false);
                    onNavigate?.("ec-product-group-add-automatic");
                }}
            />
        </div>
    );
};

export default StoreProductGroupsPage;
