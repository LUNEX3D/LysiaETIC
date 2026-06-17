import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaInfoCircle,
    FaSearch,
    FaUpload,
    FaDownload,
    FaSort,
} from "react-icons/fa";
import { fetchStoreBrands } from "../../../services/storeApi";
import BrandExportModal from "./BrandExportModal";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreBrandsPage = ({ onNavigate }) => {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(true);
    const [exportOpen, setExportOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreBrands();
            setBrands(res.brands || []);
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
        let rows = brands;
        if (q) rows = rows.filter((b) => b.name?.toLowerCase().includes(q));
        return [...rows].sort((a, b) => {
            const cmp = String(a.name || "").localeCompare(String(b.name || ""), "tr");
            return sortAsc ? cmp : -cmp;
        });
    }, [brands, search, sortAsc]);

    const openBrand = (id) => onNavigate?.(`ec-brand-edit-${id}`);

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
                            Markalar <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                        </h1>
                    </div>
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
                            onClick={() => onNavigate?.("ec-brand-add")}
                        >
                            <FaPlus /> Marka Ekle
                        </button>
                    </div>
                </header>

                {error && <div className="ec-prod-form-error" style={{ padding: "0.75rem 1.15rem" }}>{error}</div>}

                {loading ? (
                    <p className="ec-prod-muted" style={{ padding: "1rem 1.15rem" }}>Yükleniyor…</p>
                ) : !brands.length ? (
                    <div className="ec-cat-empty">
                        <div className="ec-cat-empty__illus" />
                        <h2>Markalarınızı yönetin</h2>
                        <p>
                            Marka detay sayfalarında aynı marka ürünlerinizi gösterin ve SEO ayarlarını yönetin.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-brand-add")}
                        >
                            Marka Ekle
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
                            <table className="ec-prod-table ec-cat-list-table ec-brand-list-table">
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
                                    {filtered.length ? (
                                        filtered.map((brand) => (
                                            <tr
                                                key={brand._id}
                                                className="ec-cat-list-row"
                                                onClick={() => openBrand(brand._id)}
                                            >
                                                <td>
                                                    <strong>{brand.name}</strong>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td className="ec-cat-list-empty">Marka bulunamadı.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <footer className="ec-brand-list-foot">
                            1 – {filtered.length} / {brands.length} adet
                        </footer>
                    </>
                )}

                <BrandExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
            </div>
        </div>
    );
};

export default StoreBrandsPage;
