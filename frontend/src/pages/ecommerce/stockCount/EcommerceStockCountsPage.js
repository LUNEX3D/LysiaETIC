import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus, FaInfoCircle, FaSearch, FaTrash } from "react-icons/fa";
import {
    fetchStore,
    fetchStoreStockCounts,
    bulkDeleteStoreStockCounts,
} from "../../../services/storeApi";
import StockCountEmptyIllustration from "./StockCountEmptyIllustration";

const STATUS_LABELS = {
    draft: "Taslak",
    submitted: "Onaya gönderildi",
    completed: "Tamamlandı",
    cancelled: "İptal",
};

const EcommerceStockCountsPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(() => new Set());
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Önce mağazanızı oluşturun (Satış Kanalları).");
                setItems([]);
                return;
            }
            const res = await fetchStoreStockCounts();
            setItems(res.stockCounts || []);
            setSelected(new Set());
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
        if (!q) return items;
        return items.filter(
            (c) =>
                c.countNumber?.toLowerCase().includes(q) ||
                c.title?.toLowerCase().includes(q) ||
                c.locationName?.toLowerCase().includes(q)
        );
    }, [items, search]);

    const selectedIds = useMemo(() => [...selected], [selected]);
    const selectedCount = selectedIds.length;
    const allFilteredSelected =
        filtered.length > 0 && filtered.every((c) => selected.has(String(c._id)));
    const someSelected = filtered.some((c) => selected.has(String(c._id)));

    const toggleOne = (id, checked) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleAllFiltered = (checked) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const c of filtered) {
                const id = String(c._id);
                if (checked) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    };

    const handleEdit = () => {
        if (selectedCount !== 1) return;
        onNavigate?.(`ec-stock-count-work-${selectedIds[0]}`);
    };

    const handleDelete = async () => {
        if (!selectedCount) return;
        const ok = window.confirm(
            selectedCount === 1
                ? "Seçili stok sayımını silmek istediğinize emin misiniz?"
                : `${selectedCount} stok sayımını silmek istediğinize emin misiniz?`
        );
        if (!ok) return;
        setDeleting(true);
        setError("");
        try {
            await bulkDeleteStoreStockCounts(selectedIds);
            await load();
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Silinemedi");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return <div className="ec-prod-empty">Stok sayımları yükleniyor…</div>;
    }

    if (error && !items.length) {
        return (
            <div className="ec-prod-page">
                <div className="ec-prod-panel">
                    <div className="ec-prod-empty">
                        <p style={{ color: "var(--ec-red)" }}>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="ec-prod-page ec-purchase-page">
                <div className="ec-prod-panel ec-prod-panel--purchase-empty">
                    <div className="ec-purchase-empty">
                        <StockCountEmptyIllustration />
                        <h1 className="ec-purchase-empty__title">
                            Stok Sayımınızı Yönetin
                            <FaInfoCircle className="ec-purchase-empty__info" />
                        </h1>
                        <p className="ec-purchase-empty__desc">
                            Tedarikçilerinizden ve işletme konumlarınızdan gelen ve gönderilen envanteri takip
                            edebilir ve yönetebilirsiniz.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary ec-purchase-empty__cta"
                            onClick={() => onNavigate?.("ec-stock-count-add")}
                        >
                            <FaPlus /> Stok Sayımı Ekle
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ec-prod-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Stok Sayımı <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => onNavigate?.("ec-stock-count-add")}
                    >
                        <FaPlus /> Stok Sayımı Ekle
                    </button>
                </header>

                {error && (
                    <div style={{ padding: "0.75rem 1.15rem", color: "var(--ec-red)" }}>{error}</div>
                )}

                <div className={`ec-prod-toolbar ${selectedCount > 0 ? "ec-prod-toolbar--selection" : ""}`}>
                    {selectedCount > 0 ? (
                        <div className="ec-prod-bulk-bar">
                            <span className="ec-prod-bulk-count">
                                {selectedCount} sayım seçildi
                            </span>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--ghost"
                                disabled={selectedCount !== 1}
                                onClick={handleEdit}
                            >
                                Düzenle
                            </button>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--danger"
                                disabled={deleting}
                                onClick={handleDelete}
                                aria-label="Sil"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ) : (
                        <label className="ec-prod-search">
                            <FaSearch style={{ color: "var(--ec-muted)" }} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tabloda arama yapın"
                            />
                        </label>
                    )}
                    {selectedCount > 0 && (
                        <label className="ec-prod-search ec-prod-search--compact">
                            <FaSearch style={{ color: "var(--ec-muted)" }} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tabloda arama yapın"
                            />
                        </label>
                    )}
                </div>

                <div className="ec-prod-table-wrap">
                    <table className="ec-prod-table ec-prod-table--purchases">
                        <thead>
                            <tr className={selectedCount > 0 ? "ec-prod-table__head--selection" : ""}>
                                <th className="ec-prod-table__check" scope="col">
                                    <label className="ec-prod-check" title="Tümünü seç">
                                        <input
                                            type="checkbox"
                                            aria-label="Tümünü seç"
                                            checked={allFilteredSelected}
                                            ref={(el) => {
                                                if (el) {
                                                    el.indeterminate = someSelected && !allFilteredSelected;
                                                }
                                            }}
                                            onChange={(e) => toggleAllFiltered(e.target.checked)}
                                        />
                                        <span className="ec-prod-check__box" aria-hidden="true" />
                                    </label>
                                </th>
                                <th>Sayım no</th>
                                <th>Ad</th>
                                <th>Lokasyon</th>
                                <th>Durum</th>
                                <th>Ürün</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => {
                                const id = String(c._id);
                                const isSelected = selected.has(id);
                                return (
                                    <tr
                                        key={c._id}
                                        className={isSelected ? "ec-prod-table__row--selected" : ""}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => onNavigate?.(`ec-stock-count-work-${c._id}`)}
                                    >
                                        <td
                                            className="ec-prod-table__check"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <label className="ec-prod-check">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`${c.title} seç`}
                                                    checked={isSelected}
                                                    onChange={(e) => toggleOne(id, e.target.checked)}
                                                />
                                                <span className="ec-prod-check__box" aria-hidden="true" />
                                            </label>
                                        </td>
                                        <td>
                                            <strong>{c.countNumber}</strong>
                                        </td>
                                        <td>{c.title}</td>
                                        <td>{c.locationName}</td>
                                        <td>
                                            <span className={`ec-purchase-status ec-purchase-status--${c.status}`}>
                                                {STATUS_LABELS[c.status] || c.status}
                                            </span>
                                        </td>
                                        <td>{c.itemCount ?? c.lines?.length ?? 0}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="ec-prod-table-footer">
                    {filtered.length} sayım
                    {selectedCount > 0 ? ` · ${selectedCount} seçili` : ""}
                </div>
            </div>
        </div>
    );
};

export default EcommerceStockCountsPage;
