import React, { useState, useEffect } from "react";
import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import { FILTER_TYPE_LABELS } from "./stockCountFormUtils";

const emptyRow = () => ({ type: "brand", value: "" });

const StockCountFilterModal = ({ open, onClose, filterOptions, onStart }) => {
    const [rows, setRows] = useState([emptyRow()]);

    useEffect(() => {
        if (open) setRows([emptyRow()]);
    }, [open]);

    if (!open) return null;

    const valueOptionsFor = (type) => {
        if (type === "brand") return filterOptions.brands;
        if (type === "tag") return filterOptions.tags;
        if (type === "supplier") return filterOptions.suppliers;
        if (type === "category") return filterOptions.categories.map((c) => c.id);
        return [];
    };

    const valueLabel = (type, value) => {
        if (type === "category") {
            return filterOptions.categories.find((c) => c.id === value)?.name || value;
        }
        return value;
    };

    const canStart = rows.some((r) => r.value);

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-prod-modal--bulk">
                <header className="ec-prod-modal__head">
                    <h3>Filtreye Göre Sayım Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-prod-bulk-body">
                    <p className="ec-stock-count-filter-intro">
                        Saymak istediğiniz ürünleri daraltmak için filtreler ekleyin. Seçtiğiniz kriterlere göre
                        sistem sizin için bir sayım listesi oluşturur.
                    </p>
                    {rows.map((row, idx) => (
                        <div key={idx} className="ec-stock-count-filter-row">
                            <EcSelect
                                value={row.type}
                                onChange={(e) => {
                                    const next = [...rows];
                                    next[idx] = { type: e.target.value, value: "" };
                                    setRows(next);
                                }}
                            >
                                {Object.entries(FILTER_TYPE_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>
                                        {label}
                                    </option>
                                ))}
                            </EcSelect>
                            <EcSelect
                                value={row.value}
                                onChange={(e) => {
                                    const next = [...rows];
                                    next[idx] = { ...next[idx], value: e.target.value };
                                    setRows(next);
                                }}
                            >
                                <option value="">
                                    {FILTER_TYPE_LABELS[row.type]} seçin
                                </option>
                                {valueOptionsFor(row.type).map((v) => (
                                    <option key={v} value={v}>
                                        {row.type === "category" ? valueLabel(row.type, v) : v}
                                    </option>
                                ))}
                            </EcSelect>
                            <button
                                type="button"
                                className="ec-prod-icon-btn"
                                aria-label="Filtreyi kaldır"
                                onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                                disabled={rows.length <= 1}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="ec-purchase-summary__link"
                        onClick={() => setRows([...rows, emptyRow()])}
                    >
                        <FaPlus /> Filtre Ekle
                    </button>
                </div>
                <footer className="ec-prod-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={!canStart}
                        onClick={() => {
                            const filters = rows.filter((r) => r.value);
                            onStart(filters);
                            onClose();
                        }}
                    >
                        Sayım Başlat
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default StockCountFilterModal;
