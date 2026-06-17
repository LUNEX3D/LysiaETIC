import React, { useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";

const TransferCustomizeModal = ({ open, onClose, categories, products, initial, onSave }) => {
    const [filters, setFilters] = useState(initial || { categoryId: "", brand: "", tag: "" });

    const brands = useMemo(() => {
        const s = new Set();
        for (const p of products || []) {
            if (p.brand?.trim()) s.add(p.brand.trim());
        }
        return [...s].sort();
    }, [products]);

    const tags = useMemo(() => {
        const s = new Set();
        for (const p of products || []) {
            for (const t of p.tags || []) {
                if (t?.trim()) s.add(t.trim());
            }
        }
        return [...s].sort();
    }, [products]);

    if (!open) return null;

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-prod-modal--bulk">
                <header className="ec-prod-modal__head">
                    <h3>Özelleştir</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-prod-bulk-body">
                    <div className="ec-prod-field ec-prod-field--full">
                        <label>Spesifik Kategori</label>
                        <EcSelect
                            value={filters.categoryId}
                            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                        >
                            <option value="">Kategori Seç</option>
                            {(categories || []).map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.name}
                                </option>
                            ))}
                        </EcSelect>
                    </div>
                    <div className="ec-prod-grid ec-purchase-grid--2">
                        <div className="ec-prod-field">
                            <label>Spesifik Marka</label>
                            <EcSelect
                                value={filters.brand}
                                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                            >
                                <option value="">Marka Seç</option>
                                {brands.map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>
                        <div className="ec-prod-field">
                            <label>Spesifik Etiket</label>
                            <EcSelect
                                value={filters.tag}
                                onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                            >
                                <option value="">Etiket Seç</option>
                                {tags.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>
                    </div>
                </div>
                <footer className="ec-prod-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        İptal Et
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => {
                            onSave(filters);
                            onClose();
                        }}
                    >
                        Kaydet
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TransferCustomizeModal;
