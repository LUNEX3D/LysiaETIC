import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaArrowLeft, FaPlus, FaInfoCircle, FaSearch, FaSort } from "react-icons/fa";
import { fetchStoreTags } from "../../../services/storeApi";
import TagDrawer from "./TagDrawer";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const PAGE_SIZE = 20;

const StoreTagsPage = ({ onNavigate }) => {
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editTag, setEditTag] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreTags();
            setTags(res.tags || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPage(1);
    }, [search, sortAsc]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = tags;
        if (q) rows = rows.filter((t) => t.name?.toLowerCase().includes(q));
        return [...rows].sort((a, b) => {
            const cmp = String(a.name || "").localeCompare(String(b.name || ""), "tr");
            return sortAsc ? cmp : -cmp;
        });
    }, [tags, search, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);
    const rangeStart = filtered.length ? pageStart + 1 : 0;
    const rangeEnd = filtered.length ? Math.min(pageStart + PAGE_SIZE, filtered.length) : 0;

    const openAdd = () => {
        setEditTag(null);
        setDrawerOpen(true);
    };

    const openEdit = (tag) => {
        setEditTag(tag);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setEditTag(null);
    };

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
                            Etiketler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                        </h1>
                    </div>
                    <div className="ec-cat-list-head__actions">
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={openAdd}>
                            <FaPlus /> Etiket Ekle
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
                ) : !tags.length ? (
                    <div className="ec-cat-empty">
                        <div className="ec-cat-empty__illus ec-tag-empty-illus" />
                        <h2>Etiketlerinizi yönetin</h2>
                        <p>Ürünlerinize etiket ekleyerek filtreleme ve dışa aktarmayı kolaylaştırın.</p>
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={openAdd}>
                            Etiket Ekle
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
                            <table className="ec-prod-table ec-cat-list-table ec-tag-list-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <button
                                                type="button"
                                                className="ec-brand-sort-head"
                                                onClick={() => setSortAsc((v) => !v)}
                                            >
                                                Ad <FaSort />
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.length ? (
                                        paged.map((tag) => (
                                            <tr
                                                key={tag._id}
                                                className="ec-cat-list-row"
                                                onClick={() => openEdit(tag)}
                                            >
                                                <td>
                                                    <strong>{tag.name}</strong>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td className="ec-cat-list-empty">Etiket bulunamadı.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <footer className="ec-brand-list-foot ec-tag-list-foot">
                            <span>
                                {rangeStart} – {rangeEnd} / {filtered.length} adet
                            </span>
                            {totalPages > 1 && (
                                <nav className="ec-tag-pagination" aria-label="Sayfalama">
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--sm"
                                        disabled={safePage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    >
                                        Önceki
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(
                                            (n) =>
                                                n === 1 ||
                                                n === totalPages ||
                                                Math.abs(n - safePage) <= 1
                                        )
                                        .map((n, idx, arr) => {
                                            const prev = arr[idx - 1];
                                            const items = [];
                                            if (prev && n - prev > 1) {
                                                items.push(
                                                    <span key={`gap-${n}`} className="ec-tag-pagination__gap">
                                                        …
                                                    </span>
                                                );
                                            }
                                            items.push(
                                                <button
                                                    key={n}
                                                    type="button"
                                                    className={`ec-tag-pagination__page${
                                                        n === safePage ? " ec-tag-pagination__page--active" : ""
                                                    }`}
                                                    onClick={() => setPage(n)}
                                                >
                                                    {n}
                                                </button>
                                            );
                                            return items;
                                        })}
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--sm"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    >
                                        Sonraki
                                    </button>
                                </nav>
                            )}
                        </footer>
                    </>
                )}

                <TagDrawer
                    open={drawerOpen}
                    tag={editTag}
                    onClose={closeDrawer}
                    onSaved={load}
                    onDeleted={load}
                />
            </div>
        </div>
    );
};

export default StoreTagsPage;
