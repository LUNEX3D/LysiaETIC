import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaInfoCircle, FaSearch, FaTrash } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import { fetchStore, fetchStoreProducts } from "../../../services/storeApi";
import CartLinkProductPickerModal from "../definitions/CartLinkProductPickerModal";
import {
    buildLocationOptions,
    linesFromProduct,
    productMatchesSearch,
    PRICE_LIST_OPTIONS,
    saveBarcodeLabelDraft,
} from "./barcodeLabelUtils";
import "../../../styles/ecommerceBarcodeLabel.css";
import "../../../styles/ecommerceProducts.css";

function fmtTry(v) {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
            Number(v || 0)
        );
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
}

const EcommerceBarcodeLabelPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [products, setProducts] = useState([]);
    const [locationId, setLocationId] = useState("Tüm Lokasyonlar");
    const [priceListId, setPriceListId] = useState("default");
    const [lines, setLines] = useState([]);
    const [search, setSearch] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Önce mağazanızı oluşturun.");
                return;
            }
            const prodRes = await fetchStoreProducts();
            const prods = prodRes.products || [];
            setProducts(prods);
            setStoreName(storeRes.store.name || "");
            const locs = buildLocationOptions(storeRes.store.name, prods);
            setLocationId((prev) =>
                locs.includes(prev) ? prev : locs[0] || "Tüm Lokasyonlar"
            );
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
        if (!lines.length) return;
        setLines((prev) => {
            const byId = new Map(products.map((p) => [String(p._id), p]));
            return prev.map((line) => {
                const product = byId.get(line.productId);
                if (!product) return line;
                const refreshed = linesFromProduct(product, priceListId).find(
                    (r) => r.key === line.key
                );
                return refreshed ? { ...line, price: refreshed.price } : line;
            });
        });
    }, [priceListId, products]);

    const [storeName, setStoreName] = useState("");

    const locationOptions = useMemo(
        () => buildLocationOptions(storeName, products),
        [storeName, products]
    );

    const existingProductIds = useMemo(
        () => lines.filter((l) => !l.variantBarcode).map((l) => l.productId),
        [lines]
    );

    const mergeLines = useCallback(
        (newLines) => {
            setLines((prev) => {
                const map = new Map(prev.map((l) => [l.key, l]));
                for (const row of newLines) {
                    if (!map.has(row.key)) map.set(row.key, row);
                }
                return [...map.values()];
            });
        },
        []
    );

    const addProduct = useCallback(
        (product) => {
            mergeLines(linesFromProduct(product, priceListId));
        },
        [mergeLines, priceListId]
    );

    const removeLine = (key) => {
        setLines((prev) => prev.filter((l) => l.key !== key));
    };

    const updateQty = (key, quantity) => {
        setLines((prev) =>
            prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Number(quantity) || 1) } : l))
        );
    };

    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (q.length < 2) return [];
        return (products || [])
            .filter((p) => productMatchesSearch(p, q))
            .slice(0, 12);
    }, [products, search]);

    const filteredLines = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return lines;
        return lines.filter(
            (l) =>
                l.title?.toLowerCase().includes(q) ||
                l.barcode?.toLowerCase().includes(q) ||
                l.sku?.toLowerCase().includes(q)
        );
    }, [lines, search]);

    const canContinue = lines.length > 0 && locationId;

    const handleContinue = () => {
        if (!canContinue) return;
        saveBarcodeLabelDraft({
            locationId,
            priceListId,
            lines,
        });
        onNavigate?.("ec-barcode-label-continue");
    };

    const pickFromSearch = (product) => {
        mergeLines(linesFromProduct(product, priceListId));
        setSearch("");
        setSearchOpen(false);
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-barcode-label-page">
            <div className="ec-prod-panel ec-barcode-label-panel">
                <header className="ec-prod-head ec-barcode-label-head">
                    <h1>
                        Ürün Barkod Etiketi
                        <FaInfoCircle className="ec-barcode-label-head__info" aria-hidden="true" />
                    </h1>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={!canContinue}
                        onClick={handleContinue}
                    >
                        Devam et
                    </button>
                </header>

                {error && <div className="ec-barcode-label-error">{error}</div>}

                <div className="ec-barcode-label-body">
                    <div className="ec-barcode-label-filters">
                        <div className="ec-barcode-label-field">
                            <label className="ec-barcode-label-field__label" htmlFor="barcode-location">
                                Stok Lokasyonu
                            </label>
                            <EcSelect
                                id="barcode-location"
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                            >
                                {locationOptions.map((loc) => (
                                    <option key={loc} value={loc}>
                                        {loc}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>
                        <div className="ec-barcode-label-field">
                            <label className="ec-barcode-label-field__label" htmlFor="barcode-price-list">
                                Fiyat Listesi
                            </label>
                            <EcSelect
                                id="barcode-price-list"
                                value={priceListId}
                                onChange={(e) => setPriceListId(e.target.value)}
                            >
                                {PRICE_LIST_OPTIONS.map((pl) => (
                                    <option key={pl.id} value={pl.id}>
                                        {pl.label}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>
                    </div>

                    <div className="ec-barcode-label-search-wrap">
                        <label className="ec-barcode-label-search">
                            <FaSearch aria-hidden="true" />
                            <input
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setSearchOpen(true);
                                }}
                                onFocus={() => setSearchOpen(true)}
                                placeholder="Ürün ara..."
                                autoComplete="off"
                            />
                        </label>
                        {searchOpen && searchResults.length > 0 && (
                            <ul className="ec-barcode-label-search-dropdown">
                                {searchResults.map((p) => (
                                    <li key={p._id}>
                                        <button type="button" onClick={() => pickFromSearch(p)}>
                                            <span className="ec-barcode-label-search-dropdown__title">
                                                {p.title}
                                            </span>
                                            {p.barcode ? (
                                                <span className="ec-barcode-label-search-dropdown__meta">
                                                    {p.barcode}
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {filteredLines.length === 0 ? (
                        <div
                            className="ec-barcode-label-empty"
                            role="button"
                            tabIndex={0}
                            onClick={() => setPickerOpen(true)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setPickerOpen(true);
                            }}
                        >
                            <div className="ec-barcode-label-empty__icon" aria-hidden="true" />
                            <h2>Ürünleri Ekleyin</h2>
                            <p>
                                Ürün arayın ve ekleyin. Eklediğiniz ürünler burada gözükecek.
                            </p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPickerOpen(true);
                                }}
                            >
                                Ürün Seç
                            </button>
                        </div>
                    ) : (
                        <div className="ec-barcode-label-table-wrap">
                            <table className="ec-barcode-label-table">
                                <thead>
                                    <tr>
                                        <th>Ürün</th>
                                        <th>Barkod</th>
                                        <th>SKU</th>
                                        <th className="ec-barcode-label-table__col-price">Fiyat</th>
                                        <th className="ec-barcode-label-table__col-qty">Adet</th>
                                        <th className="ec-barcode-label-table__col-actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLines.map((line) => (
                                        <tr key={line.key}>
                                            <td>
                                                <span className="ec-barcode-label-table__title">
                                                    {line.title}
                                                </span>
                                            </td>
                                            <td>{line.barcode || "—"}</td>
                                            <td>{line.sku || "—"}</td>
                                            <td className="ec-barcode-label-table__col-price">
                                                {fmtTry(line.price)}
                                            </td>
                                            <td className="ec-barcode-label-table__col-qty">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    className="ec-barcode-label-qty"
                                                    value={line.quantity}
                                                    onChange={(e) =>
                                                        updateQty(line.key, e.target.value)
                                                    }
                                                />
                                            </td>
                                            <td className="ec-barcode-label-table__col-actions">
                                                <button
                                                    type="button"
                                                    className="ec-barcode-label-remove"
                                                    title="Kaldır"
                                                    onClick={() => removeLine(line.key)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                type="button"
                                className="ec-barcode-label-add-more"
                                onClick={() => setPickerOpen(true)}
                            >
                                + Ürün Ekle
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <CartLinkProductPickerModal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                products={products}
                existingProductIds={existingProductIds}
                onAdd={addProduct}
            />
        </div>
    );
};

export default EcommerceBarcodeLabelPage;
