import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaInfoCircle, FaPlus, FaSearch, FaTrash } from "react-icons/fa";
import {
    fetchStoreOrderLabels,
    deleteStoreOrderLabel,
} from "../../../services/storeApi";
import OrderLabelCreateModal from "./OrderLabelCreateModal";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";

const PAGE_SIZE = 20;

const EcommerceOrderTagsPage = ({ onNavigate }) => {
    const [labels, setLabels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(() => new Set());
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreOrderLabels();
            setLabels(res.labels || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPage(1);
        setSelected(new Set());
    }, [search]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return labels;
        return labels.filter((l) => l.name?.toLowerCase().includes(q));
    }, [labels, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const removeOne = async (id) => {
        if (!window.confirm("Bu etiketi silmek istediğinize emin misiniz?")) return;
        try {
            await deleteStoreOrderLabel(id);
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(String(id));
                return next;
            });
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    const removeSelected = async () => {
        if (!selected.size) return;
        if (
            !window.confirm(
                `${selected.size} etiketi silmek istediğinize emin misiniz? İlgili siparişlerden de kaldırılır.`
            )
        )
            return;
        setDeleting(true);
        try {
            await Promise.all([...selected].map((id) => deleteStoreOrderLabel(id)));
            setSelected(new Set());
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        } finally {
            setDeleting(false);
        }
    };

    const existingNames = useMemo(() => labels.map((l) => l.name), [labels]);

    if (loading && !labels.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-orders-page ec-order-tags-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Sipariş Etiketleri{" "}
                        <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => setCreateOpen(true)}
                    >
                        <FaPlus /> Etiket Ekle
                    </button>
                </header>

                {error && (
                    <div className="ec-purchase-form-error" style={{ margin: 0 }}>
                        {error}
                    </div>
                )}

                <div className="ec-orders-toolbar">
                    {selected.size > 0 && (
                        <div className="ec-orders-toolbar__left">
                            <span className="ec-orders-toolbar__sel">
                                {selected.size} seçildi
                            </span>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-icon-btn--danger"
                                disabled={deleting}
                                onClick={removeSelected}
                            >
                                <FaTrash /> Sil
                            </button>
                        </div>
                    )}
                    <label className="ec-orders-search">
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
                            <h2>Henüz sipariş etiketi yok</h2>
                            <p>
                                Siparişlerinizi gruplamak için etiket oluşturun. Örneğin &quot;Kargo
                                Etiketi Yazdırıldı&quot;.
                            </p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                style={{ marginTop: "1rem" }}
                                onClick={() => setCreateOpen(true)}
                            >
                                <FaPlus /> Etiket Ekle
                            </button>
                        </div>
                    ) : (
                        <table className="ec-orders-table ec-order-tags-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 48 }}>
                                        <input
                                            type="checkbox"
                                            aria-label="Tümünü seç"
                                            checked={
                                                paged.length > 0 &&
                                                paged.every((l) => selected.has(String(l._id)))
                                            }
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelected(
                                                        new Set(paged.map((l) => String(l._id)))
                                                    );
                                                } else setSelected(new Set());
                                            }}
                                        />
                                    </th>
                                    <th>Ad</th>
                                    <th style={{ width: 56 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((l) => {
                                    const id = String(l._id);
                                    return (
                                        <tr key={id}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(id)}
                                                    onChange={() => toggleSelect(id)}
                                                />
                                            </td>
                                            <td>
                                                <span className="ec-order-tags-table__name">
                                                    {l.name}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                    title="Sil"
                                                    onClick={() => removeOne(l._id)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {paged.length > 0 && (
                    <footer className="ec-orders-foot">
                        <span>
                            {filtered.length ? pageStart + 1 : 0} –{" "}
                            {Math.min(pageStart + PAGE_SIZE, filtered.length)} / {filtered.length}{" "}
                            adet
                        </span>
                        <div className="ec-orders-foot__pages">
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Önceki
                            </button>
                            <span>{safePage}</span>
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

            <OrderLabelCreateModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                existingNames={existingNames}
                onCreated={() => load()}
            />
        </div>
    );
};

export default EcommerceOrderTagsPage;
