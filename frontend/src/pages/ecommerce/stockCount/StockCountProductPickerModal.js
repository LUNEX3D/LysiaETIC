import React, { useMemo, useState } from "react";
import { FaTimes, FaSearch } from "react-icons/fa";
import { buildCountLineFromProduct } from "./stockCountFormUtils";
import { lineIdentity } from "../../../components/ecommerce/barcode/productBarcodeUtils";

function productMatchesQuery(product, q) {
    if (product.title?.toLowerCase().includes(q)) return true;
    if (product.barcode?.toLowerCase().includes(q)) return true;
    if (product.sku?.toLowerCase().includes(q)) return true;
    for (const v of product.variants || []) {
        if (v.title?.toLowerCase().includes(q)) return true;
        if (v.barcode?.toLowerCase().includes(q)) return true;
        if (v.sku?.toLowerCase().includes(q)) return true;
    }
    return false;
}

const StockCountProductPickerModal = ({ open, onClose, products, locationName, existingLines, onAdd }) => {
    const [search, setSearch] = useState("");

    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return (products || []).slice(0, 20);
        return (products || []).filter((p) => productMatchesQuery(p, q)).slice(0, 20);
    }, [products, search]);

    if (!open) return null;

    const isInList = (productId, variantBarcode = "") =>
        existingLines.some(
            (l) => lineIdentity(l.productId, l.variantBarcode) === lineIdentity(productId, variantBarcode)
        );

    const handleAdd = (product, variant = null) => {
        if (isInList(product._id, variant?.barcode || "")) return;
        onAdd(buildCountLineFromProduct(product, variant, locationName));
    };

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-prod-modal--bulk" onClick={(e) => e.stopPropagation()}>
                <header className="ec-prod-modal__head">
                    <h3>Ürün Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-prod-bulk-body">
                    <div className="ec-purchase-product-search">
                        <FaSearch className="ec-purchase-product-search__icon" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Ürün ara..."
                            autoFocus
                        />
                    </div>
                    {results.length === 0 ? (
                        <p className="ec-purchase-lines-hint">Ürün bulunamadı.</p>
                    ) : (
                        <ul className="ec-stock-count-picker-list">
                            {results.flatMap((p) => {
                                const hasVariants = (p.variants || []).length > 0;
                                if (hasVariants) {
                                    return (p.variants || []).map((v) => {
                                        const title = v.title ? `${p.title} — ${v.title}` : p.title;
                                        const added = isInList(p._id, v.barcode || "");
                                        return (
                                            <li key={`${p._id}-${v.barcode || v.sku || v.title}`}>
                                                <span>{title}</span>
                                                <button
                                                    type="button"
                                                    className="ec-prod-btn ec-prod-btn--primary"
                                                    disabled={added}
                                                    onClick={() => handleAdd(p, v)}
                                                >
                                                    {added ? "Eklendi" : "Ekle"}
                                                </button>
                                            </li>
                                        );
                                    });
                                }
                                const added = isInList(p._id, "");
                                return [
                                    <li key={p._id}>
                                        <span>{p.title}</span>
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary"
                                            disabled={added}
                                            onClick={() => handleAdd(p)}
                                        >
                                            {added ? "Eklendi" : "Ekle"}
                                        </button>
                                    </li>,
                                ];
                            })}
                        </ul>
                    )}
                </div>
                <footer className="ec-prod-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Kapat
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default StockCountProductPickerModal;
