import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaArrowLeft, FaPlus, FaInfoCircle, FaSearch, FaSort } from "react-icons/fa";
import { fetchStorePersonalizations } from "../../../services/storeApi";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreProductPersonalizationsPage = ({ onNavigate }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStorePersonalizations();
            setRows(res.personalizations || []);
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
        if (q) list = list.filter((r) => r.name?.toLowerCase().includes(q));
        return [...list].sort((a, b) => {
            const cmp = String(a.name || "").localeCompare(String(b.name || ""), "tr");
            return sortAsc ? cmp : -cmp;
        });
    }, [rows, search, sortAsc]);

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
                            Ürün Kişiselleştirmeleri{" "}
                            <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                        </h1>
                    </div>
                    <div className="ec-cat-list-head__actions">
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-personalization-add")}
                        >
                            <FaPlus /> Ürün Kişiselleştirmesi Ekle
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
                ) : error && !rows.length ? (
                    <div className="ec-cat-empty">
                        <h2>Liste yüklenemedi</h2>
                        <p>{error}</p>
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={load}>
                            Tekrar dene
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn"
                            style={{ marginLeft: "0.5rem" }}
                            onClick={() => onNavigate?.("ec-personalization-add")}
                        >
                            Yine de ekle
                        </button>
                    </div>
                ) : !rows.length ? (
                    <div className="ec-cat-empty">
                        <div className="ec-cat-empty__illus ec-pers-empty-illus" />
                        <h2>Ürün kişiselleştirmelerinizi yönetin</h2>
                        <p>
                            Müşterilerinizin ürünlerinize özel seçenekler eklemesini sağlayın; metin, dosya,
                            seçim ve daha fazlası.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-personalization-add")}
                        >
                            Ürün Kişiselleştirmesi Ekle
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
                            <table className="ec-prod-table ec-cat-list-table ec-pers-list-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <button
                                                type="button"
                                                className="ec-brand-sort-head"
                                                onClick={() => setSortAsc((v) => !v)}
                                            >
                                                Kişiselleştirme Adı <FaSort />
                                            </button>
                                        </th>
                                        <th>Seçenekler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length ? (
                                        filtered.map((row) => (
                                            <tr
                                                key={row._id}
                                                className="ec-cat-list-row"
                                                onClick={() => onNavigate?.(`ec-personalization-edit-${row._id}`)}
                                            >
                                                <td>
                                                    <strong>{row.name}</strong>
                                                </td>
                                                <td>
                                                    {row.optionCount ?? row.options?.length ?? 0} Seçenek
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="ec-cat-list-empty">
                                                Kişiselleştirme bulunamadı.
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
            </div>
        </div>
    );
};

export default StoreProductPersonalizationsPage;
