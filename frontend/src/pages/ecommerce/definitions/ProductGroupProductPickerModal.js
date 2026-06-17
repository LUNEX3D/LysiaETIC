import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaSearch } from "react-icons/fa";

function productMatchesQuery(product, q) {
    if (product.title?.toLowerCase().includes(q)) return true;
    if (product.barcode?.toLowerCase().includes(q)) return true;
    if (product.sku?.toLowerCase().includes(q)) return true;
    return false;
}

const ProductGroupProductPickerModal = ({ open, onClose, products, existingProductIds, onAdd }) => {
    const [search, setSearch] = useState("");

    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = (products || []).filter((p) => p.productType === "simple" || p.productType == null);
        if (!q) return list.slice(0, 30);
        return list.filter((p) => productMatchesQuery(p, q)).slice(0, 30);
    }, [products, search]);

    if (!open) return null;

    const isAdded = (id) => existingProductIds.includes(String(id));

    return createPortal(
        <div className="ec-pg-add-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
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
                        <p className="ec-purchase-lines-hint">Basit ürün bulunamadı.</p>
                    ) : (
                        <ul className="ec-stock-count-picker-list">
                            {results.map((p) => {
                                const added = isAdded(p._id);
                                return (
                                    <li key={p._id}>
                                        <span>{p.title}</span>
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary"
                                            disabled={added}
                                            onClick={() => onAdd(p)}
                                        >
                                            {added ? "Eklendi" : "Ekle"}
                                        </button>
                                    </li>
                                );
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
        </div>,
        document.body
    );
};

export default ProductGroupProductPickerModal;
