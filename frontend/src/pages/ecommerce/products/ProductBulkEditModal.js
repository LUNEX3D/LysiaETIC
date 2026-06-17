import React, { useState, useMemo } from "react";
import { FaTimes, FaInfoCircle, FaTrash } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import {
    BULK_EDIT_MODES,
    availableBulkFields,
    fieldMeta,
} from "../../../constants/productBulkEdit";
import { bulkUpdateStoreProducts } from "../../../services/storeApi";

const newRow = (field) => ({
    key: `${field}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    field,
    mode: "set",
    value: field === "continueSellingWhenOutOfStock" ? true : field === "saleStatus" ? "on_sale" : "",
});

const ProductBulkEditModal = ({
    onClose,
    selectedIds,
    totalProducts,
    onSaved,
}) => {
    const count = selectedIds.length;
    const [scope, setScope] = useState("selected");
    const [rows, setRows] = useState([]);
    const [addField, setAddField] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const unusedFields = useMemo(() => availableBulkFields(rows.map((r) => r.field)), [rows]);

    const addAction = () => {
        if (!addField) return;
        setRows((prev) => [...prev, newRow(addField)]);
        setAddField("");
    };

    const updateRow = (key, patch) => {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    };

    const removeRow = (key) => {
        setRows((prev) => prev.filter((r) => r.key !== key));
    };

    const handleSave = async () => {
        if (!rows.length) {
            setError("En az bir işlem ekleyin");
            return;
        }
        for (const row of rows) {
            const meta = fieldMeta(row.field);
            if (meta?.valueType === "boolean") continue;
            if (row.value === "" || row.value == null) {
                setError(`${meta?.label || row.field} için değer girin`);
                return;
            }
        }

        setSaving(true);
        setError("");
        try {
            const res = await bulkUpdateStoreProducts({
                scope,
                productIds: selectedIds,
                actions: rows.map((r) => ({
                    field: r.field,
                    mode: r.mode,
                    value: r.value,
                })),
            });
            if (res.errors?.length) {
                setError(`${res.updated} güncellendi, ${res.failed} hata`);
            }
            onSaved?.(res);
            if (!res.errors?.length) onClose();
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const titleCount = scope === "all" ? totalProducts : count;

    return (
        <div className="ec-prod-modal-backdrop" onClick={onClose}>
            <div className="ec-prod-modal ec-prod-modal--bulk" onClick={(e) => e.stopPropagation()}>
                <div className="ec-prod-modal__head">
                    <h2>
                        {titleCount} Ürünü Düzenle{" "}
                        <FaInfoCircle style={{ opacity: 0.45, fontSize: 14 }} />
                    </h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>

                <div className="ec-prod-bulk-body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    <div className="ec-prod-bulk-block">
                        <p className="ec-prod-io-label">Hangi ürünlerinizi düzenleyeceğinizi seçin</p>
                        <label className="ec-prod-io-radio">
                            <input
                                type="radio"
                                name="bulk-scope"
                                checked={scope === "all"}
                                onChange={() => setScope("all")}
                            />
                            <span className="ec-prod-io-radio__dot" />
                            <span>Tüm Ürünler ({totalProducts})</span>
                        </label>
                        <label className={`ec-prod-io-radio ${scope === "selected" ? "ec-prod-io-radio--checked" : ""}`}>
                            <input
                                type="radio"
                                name="bulk-scope"
                                checked={scope === "selected"}
                                onChange={() => setScope("selected")}
                            />
                            <span className="ec-prod-io-radio__dot" />
                            <span>Seçilen {count} ürün</span>
                        </label>
                    </div>

                    <div className="ec-prod-bulk-block">
                        <p className="ec-prod-io-label">Seçili ürünleri düzenlemek için işlem ekleyin</p>
                        <div className="ec-prod-bulk-add-row">
                            <EcSelect
                                className="ec-prod-select-full"
                                value={addField}
                                onChange={(e) => setAddField(e.target.value)}
                            >
                                <option value="">İşlem Ekle</option>
                                {unusedFields.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.label}
                                    </option>
                                ))}
                            </EcSelect>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={!addField}
                                onClick={addAction}
                            >
                                Ekle
                            </button>
                        </div>

                        {rows.map((row) => {
                            const meta = fieldMeta(row.field);
                            return (
                                <div key={row.key} className="ec-prod-bulk-action-row">
                                    <span className="ec-prod-bulk-action-row__label">{meta?.label}</span>
                                    <EcSelect
                                        value={row.mode}
                                        onChange={(e) => updateRow(row.key, { mode: e.target.value })}
                                    >
                                        {BULK_EDIT_MODES.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </EcSelect>
                                    {meta?.valueType === "select" ? (
                                        <EcSelect
                                            value={row.value}
                                            onChange={(e) => updateRow(row.key, { value: e.target.value })}
                                        >
                                            <option value="on_sale">Satışta</option>
                                            <option value="closed">Satışa kapalı</option>
                                        </EcSelect>
                                    ) : meta?.valueType === "boolean" ? (
                                        <label className="ec-prod-check">
                                            <input
                                                type="checkbox"
                                                checked={!!row.value}
                                                onChange={(e) =>
                                                    updateRow(row.key, { value: e.target.checked })
                                                }
                                            />
                                            Aktif
                                        </label>
                                    ) : (
                                        <input
                                            type={meta?.valueType === "number" ? "number" : "text"}
                                            min={meta?.valueType === "number" ? "0" : undefined}
                                            step={meta?.valueType === "number" ? "0.01" : undefined}
                                            placeholder={meta?.placeholder}
                                            value={row.value}
                                            onChange={(e) => updateRow(row.key, { value: e.target.value })}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        className="ec-prod-icon-btn ec-prod-bulk-action-row__del"
                                        aria-label="Kaldır"
                                        onClick={() => removeRow(row.key)}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="ec-prod-io-footer">
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={handleSave}
                        disabled={saving || !rows.length}
                    >
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductBulkEditModal;
