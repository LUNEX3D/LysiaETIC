import React, { useState, useEffect, useCallback, useMemo } from "react";

import {

    FaBox,

    FaSearch,

    FaFilter,

    FaDownload,

    FaUpload,

    FaPlus,

    FaInfoCircle,

} from "react-icons/fa";

import { fetchStore, fetchStoreProducts, bulkDeleteStoreProducts } from "../../../services/storeApi";

import ProductAddTypeModal from "./ProductAddTypeModal";

import ProductExportModal from "./ProductExportModal";

import ProductImportModal from "./ProductImportModal";

import ProductSalesChannelCell from "./ProductSalesChannelCell";

import ProductBulkEditModal from "./ProductBulkEditModal";



const fmtTry = (v) => {

    try {

        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(v || 0));

    } catch {

        return `${Number(v || 0).toFixed(2)} ₺`;

    }

};



const EcommerceProductsList = ({ onNavigate }) => {

    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState([]);

    const [store, setStore] = useState(null);

    const [publicUrl, setPublicUrl] = useState("");

    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [showAddModal, setShowAddModal] = useState(false);

    const [showExportModal, setShowExportModal] = useState(false);

    const [showImportModal, setShowImportModal] = useState(false);

    const [selected, setSelected] = useState(() => new Set());

    const [bulkEditOpen, setBulkEditOpen] = useState(false);

    const [deleting, setDeleting] = useState(false);



    const load = useCallback(async () => {

        setLoading(true);

        setError("");

        try {

            const storeRes = await fetchStore();

            if (!storeRes.store) {

                setError("Önce mağazanızı oluşturun (Satış Kanalları).");

                setProducts([]);

                return;

            }

            setStore(storeRes.store);

            setPublicUrl(storeRes.publicUrl || "");

            const res = await fetchStoreProducts();

            setProducts(res.products || []);

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

        if (!q) return products;

        return products.filter(

            (p) =>

                p.title?.toLowerCase().includes(q) ||

                p.sku?.toLowerCase().includes(q) ||

                p.barcode?.toLowerCase().includes(q)

        );

    }, [products, search]);



    const selectedIds = useMemo(() => [...selected], [selected]);

    const selectedCount = selectedIds.length;

    const allFilteredSelected =

        filtered.length > 0 && filtered.every((p) => selected.has(String(p._id)));

    const someSelected = filtered.some((p) => selected.has(String(p._id)));



    const toggleOne = (id, checked) => {

        setSelected((prev) => {

            const next = new Set(prev);

            const key = String(id);

            if (checked) next.add(key);

            else next.delete(key);

            return next;

        });

    };



    const toggleAllFiltered = (checked) => {

        setSelected((prev) => {

            const next = new Set(prev);

            filtered.forEach((p) => {

                const key = String(p._id);

                if (checked) next.add(key);

                else next.delete(key);

            });

            return next;

        });

    };



    const handleBulkDelete = async () => {

        if (!selectedCount) return;

        const ok = window.confirm(`${selectedCount} ürünü silmek istediğinize emin misiniz?`);

        if (!ok) return;

        setDeleting(true);

        setError("");

        try {

            await bulkDeleteStoreProducts({

                scope: "selected",

                productIds: selectedIds,

            });

            await load();

        } catch (e) {

            setError(e.response?.data?.error || "Silinemedi");

        } finally {

            setDeleting(false);

        }

    };



    const onSelectType = (type) => {

        setShowAddModal(false);

        onNavigate(type === "variant" ? "ec-product-add-variant" : "ec-product-add-simple");

    };



    if (loading) {

        return <div className="ec-prod-empty">Ürünler yükleniyor…</div>;

    }



    return (

        <div className="ec-prod-page">

            <div className="ec-prod-panel">

                <header className="ec-prod-head">

                    <h1>

                        Ürünler

                        <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />

                    </h1>

                    <div className="ec-prod-head-actions">

                        <button type="button" className="ec-prod-btn" onClick={() => setShowExportModal(true)}>

                            <FaDownload /> Dışa Aktar

                        </button>

                        <button type="button" className="ec-prod-btn" onClick={() => setShowImportModal(true)}>

                            <FaUpload /> İçe Aktar

                        </button>

                        <button

                            type="button"

                            className="ec-prod-btn ec-prod-btn--primary"

                            onClick={() => setShowAddModal(true)}

                        >

                            <FaPlus /> Ürün Ekle

                        </button>

                    </div>

                </header>



                {error && (

                    <div style={{ padding: "0.75rem 1.15rem", color: "var(--ec-red)" }}>{error}</div>

                )}



                <div className={`ec-prod-toolbar ${selectedCount > 0 ? "ec-prod-toolbar--selection" : ""}`}>

                    {selectedCount > 0 ? (

                        <div className="ec-prod-bulk-bar">

                            <span className="ec-prod-bulk-count">{selectedCount} ürün seçildi</span>

                            <button

                                type="button"

                                className="ec-prod-btn ec-prod-btn--ghost"

                                onClick={() => setBulkEditOpen(true)}

                            >

                                Düzenle

                            </button>

                            <button

                                type="button"

                                className="ec-prod-btn ec-prod-btn--danger"

                                disabled={deleting}

                                onClick={handleBulkDelete}

                            >

                                {deleting ? "Siliniyor…" : "Sil"}

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

                    <button type="button" className="ec-prod-btn">

                        <FaFilter /> Filtre

                    </button>

                </div>



                <div className="ec-prod-table-wrap">

                    {filtered.length === 0 ? (

                        <div className="ec-prod-empty">

                            <FaBox size={40} style={{ opacity: 0.35, marginBottom: 12 }} />

                            <p>

                                <strong>Henüz ürün yok</strong>

                            </p>

                            <p style={{ fontSize: "0.85rem" }}>Ürün Ekle ile mağazanıza ilk ürünü ekleyin.</p>

                            <button

                                type="button"

                                className="ec-prod-btn ec-prod-btn--primary"

                                style={{ marginTop: 12 }}

                                onClick={() => setShowAddModal(true)}

                            >

                                Ürün Ekle

                            </button>

                        </div>

                    ) : (

                        <table className="ec-prod-table ec-prod-table--products">

                            <colgroup>

                                <col className="ec-prod-col-check" />

                                <col className="ec-prod-col-product" />

                                <col className="ec-prod-col-price" />

                                <col className="ec-prod-col-cost" />

                                <col className="ec-prod-col-stock" />

                                <col className="ec-prod-col-channels" />

                            </colgroup>

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

                                                        el.indeterminate =

                                                            someSelected && !allFilteredSelected;

                                                    }

                                                }}

                                                onChange={(e) => toggleAllFiltered(e.target.checked)}

                                            />

                                            <span className="ec-prod-check__box" aria-hidden="true" />

                                        </label>

                                    </th>

                                    <th>Ürün</th>

                                    <th>Satış Fiyatı</th>

                                    <th>Alış Fiyatı</th>

                                    <th>Envanter</th>

                                    <th>Satış Kanalları</th>

                                </tr>

                            </thead>

                            <tbody>

                                {filtered.map((p) => {

                                    const id = String(p._id);

                                    const isSelected = selected.has(id);

                                    const img = p.images?.[0];

                                    const variantNote =

                                        p.productType === "variant" && p.variants?.length

                                            ? `${p.variants.length} varyant`

                                            : null;

                                    return (

                                        <tr

                                            key={p._id}

                                            className={isSelected ? "ec-prod-table__row--selected" : ""}

                                            style={{ cursor: "pointer" }}

                                            onClick={() => onNavigate(`ec-product-edit-${p._id}`)}

                                        >

                                            <td

                                                className="ec-prod-table__check"

                                                onClick={(e) => e.stopPropagation()}

                                            >

                                                <label className="ec-prod-check">

                                                    <input

                                                        type="checkbox"

                                                        aria-label={`${p.title} seç`}

                                                        checked={isSelected}

                                                        onChange={(e) => toggleOne(id, e.target.checked)}

                                                    />

                                                    <span className="ec-prod-check__box" aria-hidden="true" />

                                                </label>

                                            </td>

                                            <td>

                                                <div className="ec-prod-product-cell">

                                                    {img ? (

                                                        <img src={img} alt="" className="ec-prod-thumb" />

                                                    ) : (

                                                        <span className="ec-prod-thumb" />

                                                    )}

                                                    <div>

                                                        <strong>{p.title}</strong>

                                                        {variantNote && <span>{variantNote}</span>}

                                                    </div>

                                                </div>

                                            </td>

                                            <td>

                                                {p.compareAtPrice != null &&

                                                    p.compareAtPrice < p.price &&

                                                    p.compareAtPrice > 0 && (

                                                        <>

                                                            <span className="ec-prod-price-old">

                                                                {fmtTry(p.price)}

                                                            </span>

                                                            <strong>{fmtTry(p.compareAtPrice)}</strong>

                                                        </>

                                                    )}

                                                {!(

                                                    p.compareAtPrice != null &&

                                                    p.compareAtPrice < p.price &&

                                                    p.compareAtPrice > 0

                                                ) && <strong>{fmtTry(p.price)}</strong>}

                                            </td>

                                            <td className="ec-prod-table__cost">

                                                {p.costPrice != null && p.costPrice !== ""

                                                    ? fmtTry(p.costPrice)

                                                    : "—"}

                                            </td>

                                            <td className="ec-prod-table__stock">{p.stock ?? 0} adet</td>

                                            <td className="ec-prod-table__channels">

                                                <ProductSalesChannelCell

                                                    product={p}

                                                    store={store}

                                                    publicUrl={publicUrl}

                                                />

                                            </td>

                                        </tr>

                                    );

                                })}

                            </tbody>

                        </table>

                    )}

                </div>



                {filtered.length > 0 && (

                    <div className="ec-prod-table-footer">

                        <span>

                            {filtered.length} ürün

                            {selectedCount > 0 ? ` · ${selectedCount} seçili` : ""}

                        </span>

                    </div>

                )}

            </div>



            {showAddModal && (

                <ProductAddTypeModal onClose={() => setShowAddModal(false)} onSelect={onSelectType} />

            )}

            {showExportModal && <ProductExportModal onClose={() => setShowExportModal(false)} />}

            {showImportModal && (

                <ProductImportModal onClose={() => setShowImportModal(false)} onDone={() => load()} />

            )}

            {bulkEditOpen && (

                <ProductBulkEditModal

                    selectedIds={selectedIds}

                    totalProducts={products.length}

                    onClose={() => setBulkEditOpen(false)}

                    onSaved={() => load()}

                />

            )}

        </div>

    );

};



export default EcommerceProductsList;

