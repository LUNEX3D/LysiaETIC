import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaSearch, FaFilter, FaTrash } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import { fetchStoreProducts } from "../../../services/storeApi";

const PAGE_SIZE = 10;

const FILTER_FIELDS = [
    { id: "brand", label: "Marka" },
    { id: "tag", label: "Etiket" },
    { id: "category", label: "Kategori" },
];

function fmtTry(v) {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
            Number(v || 0)
        );
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
}

function productMatchesQuery(product, q) {
    if ((product.title || product.name || "").toLowerCase().includes(q)) return true;
    if ((product.barcode || "").toLowerCase().includes(q)) return true;
    if ((product.sku || "").toLowerCase().includes(q)) return true;
    if ((product.brand || "").toLowerCase().includes(q)) return true;
    if (Array.isArray(product.variants)) {
        return product.variants.some(
            (v) =>
                (v.title || "").toLowerCase().includes(q) ||
                (v.sku || "").toLowerCase().includes(q) ||
                (v.barcode || "").toLowerCase().includes(q)
        );
    }
    return false;
}

function productMatchesFilter(product, filter) {
    const val = (filter.value || "").trim().toLowerCase();
    if (!val) return true;
    if (filter.field === "brand") {
        return (product.brand || "").toLowerCase().includes(val);
    }
    if (filter.field === "tag") {
        return (product.tags || []).some((t) => String(t).toLowerCase().includes(val));
    }
    if (filter.field === "category") {
        return (product.categories || []).some((c) => String(c).toLowerCase().includes(val));
    }
    return true;
}

const emptyFilterRow = () => ({ field: "brand", value: "" });

/** Admin seçicide ürün listesi — Ürünler sayfası ile aynı kapsam (satışa kapalı hariç). */
function pickableProducts(products) {
    return (products || []).filter((p) => p.saleStatus !== "closed");
}

function displayTitle(p) {
    return p.title || p.name || "Ürün";
}

function displayPrice(p) {
    if (p.price != null && Number(p.price) > 0) return p.price;
    if (Array.isArray(p.variants) && p.variants.length) {
        const prices = p.variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n) && n > 0);
        if (prices.length) return Math.min(...prices);
    }
    return 0;
}

const CartLinkProductPickerModal = ({ open, onClose, products, existingProductIds = [], onAdd }) => {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(() => new Set());
    const [filterOpen, setFilterOpen] = useState(false);
    const [draftFilters, setDraftFilters] = useState([emptyFilterRow()]);
    const [appliedFilters, setAppliedFilters] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [loadError, setLoadError] = useState("");

    const existingIds = useMemo(
        () => (existingProductIds || []).map(String),
        [existingProductIds]
    );

    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        setLoadingCatalog(true);
        setLoadError("");
        (async () => {
            try {
                const res = await fetchStoreProducts();
                if (!cancelled) setCatalog(res.products || []);
            } catch (e) {
                if (!cancelled) {
                    const fallback = products || [];
                    setCatalog(fallback);
                    if (!fallback.length) {
                        setLoadError(
                            e.response?.data?.error || e.message || "Ürünler yüklenemedi"
                        );
                    }
                }
            } finally {
                if (!cancelled) setLoadingCatalog(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, products]);

    const simpleProducts = useMemo(() => pickableProducts(catalog), [catalog]);

    const hasQuery = search.trim().length > 0;
    const hasFilters = appliedFilters.some((f) => (f.value || "").trim());

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = simpleProducts;
        if (q) {
            list = list.filter((p) => productMatchesQuery(p, q));
        }
        return list.filter((p) => appliedFilters.every((f) => productMatchesFilter(p, f)));
    }, [simpleProducts, search, appliedFilters]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    const resetState = useCallback(() => {
        setSearch("");
        setPage(1);
        setSelected(new Set());
        setFilterOpen(false);
        setDraftFilters([emptyFilterRow()]);
        setAppliedFilters([]);
    }, []);

    useEffect(() => {
        if (!open) {
            resetState();
            return undefined;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose, resetState]);

    useEffect(() => {
        setPage(1);
    }, [search, appliedFilters]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const isAdded = (id) => existingIds.includes(String(id));

    const toggleRow = (id) => {
        if (isAdded(id)) return;
        setSelected((prev) => {
            const next = new Set(prev);
            const key = String(id);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectableOnPage = pageItems.filter((p) => !isAdded(p._id));
    const allPageSelected =
        selectableOnPage.length > 0 &&
        selectableOnPage.every((p) => selected.has(String(p._id)));

    const toggleAllOnPage = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allPageSelected) {
                selectableOnPage.forEach((p) => next.delete(String(p._id)));
            } else {
                selectableOnPage.forEach((p) => next.add(String(p._id)));
            }
            return next;
        });
    };

    const applyFilters = () => {
        setAppliedFilters(draftFilters.filter((f) => (f.value || "").trim()));
        setFilterOpen(false);
    };

    const handleSave = () => {
        const byId = new Map(simpleProducts.map((p) => [String(p._id), p]));
        selected.forEach((id) => {
            const product = byId.get(id);
            if (product && !isAdded(id)) onAdd(product);
        });
        onClose();
    };

    if (!open) return null;

    const rangeLabel =
        total === 0
            ? "0 - 0 / 0 adet"
            : `${pageStart + 1} - ${Math.min(pageStart + PAGE_SIZE, total)} / ${total} adet`;

    const showTable = !loadingCatalog && (!loadError || simpleProducts.length > 0);
    const showSearchEmpty = showTable && filtered.length === 0 && (hasQuery || hasFilters);
    const showCatalogEmpty = !loadingCatalog && !loadError && simpleProducts.length === 0;

    return createPortal(
        <div
            className="ec-cart-link-picker-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-link-picker-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="ec-cart-link-picker"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="ec-cart-link-picker__head">
                    <h3 id="cart-link-picker-title">Ürün Ekle</h3>
                    <button
                        type="button"
                        className="ec-cart-link-picker__close"
                        onClick={onClose}
                        aria-label="Kapat"
                    >
                        <FaTimes />
                    </button>
                </header>

                <div className="ec-cart-link-picker__toolbar">
                    <label className="ec-cart-link-picker__search">
                        <FaSearch aria-hidden="true" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tabloda arama yapın"
                            autoFocus
                        />
                    </label>
                    <button
                        type="button"
                        className={`ec-cart-link-picker__filter-btn${filterOpen ? " ec-cart-link-picker__filter-btn--active" : ""}`}
                        onClick={() => setFilterOpen((v) => !v)}
                    >
                        <FaFilter aria-hidden="true" /> Filtre
                    </button>
                </div>

                {filterOpen && (
                    <div className="ec-cart-link-picker__filter-panel">
                        {draftFilters.length === 0 ? (
                            <p className="ec-cart-link-picker__filter-empty">
                                Henüz filtre eklemediniz.
                            </p>
                        ) : (
                            draftFilters.map((row, idx) => (
                                <div key={idx} className="ec-cart-link-picker__filter-row">
                                    <EcSelect
                                        value={row.field}
                                        onChange={(e) =>
                                            setDraftFilters((prev) =>
                                                prev.map((f, i) =>
                                                    i === idx
                                                        ? { ...f, field: e.target.value }
                                                        : f
                                                )
                                            )
                                        }
                                    >
                                        {FILTER_FIELDS.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </EcSelect>
                                    <span className="ec-cart-link-picker__filter-op">içeren</span>
                                    <input
                                        type="text"
                                        className="ec-cart-link-picker__filter-value"
                                        value={row.value}
                                        onChange={(e) =>
                                            setDraftFilters((prev) =>
                                                prev.map((f, i) =>
                                                    i === idx
                                                        ? { ...f, value: e.target.value }
                                                        : f
                                                )
                                            )
                                        }
                                        placeholder="Seçiniz"
                                    />
                                    <button
                                        type="button"
                                        className="ec-cart-link-picker__filter-del"
                                        title="Filtreyi kaldır"
                                        onClick={() =>
                                            setDraftFilters((prev) =>
                                                prev.length <= 1
                                                    ? [emptyFilterRow()]
                                                    : prev.filter((_, i) => i !== idx)
                                            )
                                        }
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            ))
                        )}
                        <div className="ec-cart-link-picker__filter-actions">
                            <button
                                type="button"
                                className="ec-cart-link-picker__filter-add"
                                onClick={() =>
                                    setDraftFilters((prev) => [...prev, emptyFilterRow()])
                                }
                            >
                                + Filtre Ekle
                            </button>
                            <button
                                type="button"
                                className="ec-cart-link-picker__btn ec-cart-link-picker__btn--primary"
                                onClick={applyFilters}
                            >
                                Uygula
                            </button>
                        </div>
                    </div>
                )}

                <div className="ec-cart-link-picker__body">
                    {loadingCatalog ? (
                        <div className="ec-cart-link-picker__empty">
                            <p>Ürünler yükleniyor…</p>
                        </div>
                    ) : loadError && !simpleProducts.length ? (
                        <div className="ec-cart-link-picker__empty">
                            <h4>Ürünler yüklenemedi</h4>
                            <p>{loadError}</p>
                        </div>
                    ) : showCatalogEmpty ? (
                        <div className="ec-cart-link-picker__empty">
                            <div className="ec-cart-link-picker__empty-icon" aria-hidden="true" />
                            <h4>Henüz ürün yok</h4>
                            <p>Önce Ürünler bölümünden ürün ekleyin, ardından buradan seçebilirsiniz.</p>
                        </div>
                    ) : showTable ? (
                        <>
                            <table className="ec-cart-link-picker__table">
                                <thead>
                                    <tr>
                                        <th className="ec-cart-link-picker__col-check">
                                            <input
                                                type="checkbox"
                                                checked={allPageSelected}
                                                disabled={selectableOnPage.length === 0}
                                                onChange={toggleAllOnPage}
                                                aria-label="Sayfadaki tümünü seç"
                                            />
                                        </th>
                                        <th>Ürün</th>
                                        <th className="ec-cart-link-picker__col-price">Satış Fiyatı</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="ec-cart-link-picker__no-rows">
                                                {showSearchEmpty
                                                    ? "Aramanızla eşleşen ürün bulunamadı."
                                                    : "Ürün bulunamadı."}
                                            </td>
                                        </tr>
                                    ) : (
                                        pageItems.map((p) => {
                                            const id = String(p._id);
                                            const added = isAdded(id);
                                            const checked = added || selected.has(id);
                                            return (
                                                <tr
                                                    key={id}
                                                    className={
                                                        checked
                                                            ? "ec-cart-link-picker__row--checked"
                                                            : ""
                                                    }
                                                >
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={added}
                                                            onChange={() => toggleRow(p._id)}
                                                            aria-label={`${p.title} seç`}
                                                        />
                                                    </td>
                                                    <td>
                                                        <span className="ec-cart-link-picker__product-title">
                                                            {displayTitle(p)}
                                                        </span>
                                                        {p.brand ? (
                                                            <span className="ec-cart-link-picker__product-meta">
                                                                {p.brand}
                                                                {p.productType === "variant" ? " · Varyantlı" : ""}
                                                            </span>
                                                        ) : p.productType === "variant" ? (
                                                            <span className="ec-cart-link-picker__product-meta">
                                                                Varyantlı ürün
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="ec-cart-link-picker__col-price">
                                                        {fmtTry(displayPrice(p))}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </>
                    ) : null}
                </div>

                <footer className="ec-cart-link-picker__foot">
                    <div className="ec-cart-link-picker__pager">
                        <span className="ec-cart-link-picker__pager-count">{rangeLabel}</span>
                        <div className="ec-cart-link-picker__pager-btns">
                            <button
                                type="button"
                                className="ec-cart-link-picker__pager-btn"
                                disabled={safePage <= 1 || filtered.length === 0}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                &lt; Önceki
                            </button>
                            <span className="ec-cart-link-picker__pager-num">{safePage}</span>
                            <button
                                type="button"
                                className="ec-cart-link-picker__pager-btn"
                                disabled={safePage >= totalPages || filtered.length === 0}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Sonraki &gt;
                            </button>
                        </div>
                    </div>
                    <div className="ec-cart-link-picker__foot-actions">
                        <button
                            type="button"
                            className="ec-cart-link-picker__btn ec-cart-link-picker__btn--ghost"
                            onClick={onClose}
                        >
                            İptal Et
                        </button>
                        <button
                            type="button"
                            className="ec-cart-link-picker__btn ec-cart-link-picker__btn--primary"
                            disabled={selected.size === 0}
                            onClick={handleSave}
                        >
                            Kaydet
                        </button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default CartLinkProductPickerModal;
