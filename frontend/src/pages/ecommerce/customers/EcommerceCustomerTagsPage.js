import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaInfoCircle, FaPlus, FaSearch } from "react-icons/fa";
import { fetchStoreCustomers } from "../../../services/storeApi";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const PAGE_SIZE = 20;

const EcommerceCustomerTagsPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [extraTags, setExtraTags] = useState([]);
    const [customers, setCustomers] = useState([]);

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCustomers();
            setCustomers(res.customers || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    const tags = useMemo(() => {
        const counts = new Map();
        for (const c of customers) {
            for (const t of c.tags || []) {
                const key = String(t).trim();
                if (!key) continue;
                counts.set(key, (counts.get(key) || 0) + 1);
            }
        }
        for (const t of extraTags) {
            if (!counts.has(t)) counts.set(t, 0);
        }
        return [...counts.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    }, [customers, extraTags]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tags;
        return tags.filter((t) => t.name.toLowerCase().includes(q));
    }, [tags, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const addTag = () => {
        const name = newName.trim();
        if (!name) return;
        if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
            setError("Bu etiket zaten mevcut");
            return;
        }
        setExtraTags((prev) => [...prev, name]);
        setNewName("");
        setCreateOpen(false);
        setError("");
    };

    if (loading && !customers.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-customers-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Etiketler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
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
                            <h2>Henüz etiket yok</h2>
                            <p>
                                Müşterilerinize etiket ekleyerek filtreleyebilir ve segment
                                oluşturabilirsiniz.
                            </p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                style={{ marginTop: "1rem" }}
                                onClick={() => setCreateOpen(true)}
                            >
                                Etiket Ekle
                            </button>
                        </div>
                    ) : (
                        <table className="ec-orders-table">
                            <thead>
                                <tr>
                                    <th>Etiket Adı</th>
                                    <th>Müşteri Sayısı</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((t) => (
                                    <tr key={t.name}>
                                        <td>
                                            <strong>{t.name}</strong>
                                        </td>
                                        <td>{t.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {paged.length > 0 && (
                    <footer className="ec-customers-foot">
                        <span>
                            {pageStart + 1} - {Math.min(pageStart + PAGE_SIZE, filtered.length)} /{" "}
                            {filtered.length} Etiket
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
            </div>

            {createOpen && (
                <div
                    className="ec-order-label-modal-backdrop"
                    role="dialog"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setCreateOpen(false);
                    }}
                >
                    <div className="ec-order-label-modal" onMouseDown={(e) => e.stopPropagation()}>
                        <header className="ec-order-label-modal__head">
                            <h3>Etiket Ekle</h3>
                            <button type="button" className="ec-prod-icon-btn" onClick={() => setCreateOpen(false)}>
                                ×
                            </button>
                        </header>
                        <div className="ec-order-label-modal__body">
                            <div className="ec-prod-field">
                                <label>Etiket Adı *</label>
                                <input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Etiket adı"
                                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                                />
                            </div>
                            <p className="ec-prod-muted" style={{ fontSize: "0.8rem" }}>
                                Müşteri oluştururken veya düzenlerken bu etiketi atayabilirsiniz.
                            </p>
                        </div>
                        <footer className="ec-order-label-modal__foot">
                            <button type="button" className="ec-prod-btn" onClick={() => setCreateOpen(false)}>
                                Kapat
                            </button>
                            <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={addTag}>
                                Kaydet
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EcommerceCustomerTagsPage;
