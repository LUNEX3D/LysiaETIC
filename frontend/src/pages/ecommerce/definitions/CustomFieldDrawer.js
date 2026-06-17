import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaChevronDown, FaCheck } from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import {
    CUSTOM_FIELD_TYPES,
    emptyCustomFieldForm,
    fieldToForm,
    formToCustomFieldPayload,
    getCustomFieldTypeMeta,
} from "./customFieldFormUtils";
import {
    createStoreCustomField,
    updateStoreCustomField,
    deleteStoreCustomField,
} from "../../../services/storeApi";

const CustomFieldTypeSelect = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const selected = getCustomFieldTypeMeta(value) || CUSTOM_FIELD_TYPES[0];
    const SelectedIcon = selected.Icon;

    useEffect(() => {
        const onDoc = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    return (
        <div className={`ec-cf-type-select${open ? " ec-cf-type-select--open" : ""}`} ref={wrapRef}>
            <button type="button" className="ec-cf-type-select__trigger" onClick={() => setOpen((v) => !v)}>
                <SelectedIcon className="ec-cf-type-select__icon" aria-hidden="true" />
                <span>{selected.label}</span>
                <FaChevronDown className="ec-cf-type-select__chev" aria-hidden="true" />
            </button>
            {open && (
                <ul className="ec-cf-type-select__menu" role="listbox">
                    {CUSTOM_FIELD_TYPES.map((opt) => {
                        const Icon = opt.Icon;
                        const active = opt.id === value;
                        return (
                            <li key={opt.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    className={`ec-cf-type-select__option${active ? " ec-cf-type-select__option--active" : ""}`}
                                    onClick={() => {
                                        onChange(opt.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Icon className="ec-cf-type-select__icon" aria-hidden="true" />
                                    <span>{opt.label}</span>
                                    {active && <FaCheck className="ec-cf-type-select__check" aria-hidden="true" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const CustomFieldDrawer = ({ open, field, onClose, onSaved, onDeleted }) => {
    const { rootClassName, rootStyle } = useDashtockTheme();
    const isEdit = !!field;
    const [form, setForm] = useState(emptyCustomFieldForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(field ? fieldToForm(field) : emptyCustomFieldForm());
            setError("");
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
        }
    }, [open, field]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    const save = async () => {
        if (!form.name.trim()) {
            setError("Alan adı zorunludur");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToCustomFieldPayload(form);
            if (isEdit) {
                await updateStoreCustomField(field._id, payload);
            } else {
                await createStoreCustomField(payload);
            }
            onSaved?.();
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!isEdit) return;
        if (!window.confirm(`"${field.name}" silinsin mi?`)) return;
        setSaving(true);
        setError("");
        try {
            await deleteStoreCustomField(field._id);
            onDeleted?.();
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className={`ec-cf-drawer-backdrop${visible ? " ec-cf-drawer-backdrop--open" : ""}`}
            onClick={onClose}
            role="presentation"
        >
            <div className="ec-cf-drawer-backdrop__shade" aria-hidden="true" />
            <aside
                className={`ec-cf-drawer ${rootClassName}${visible ? " ec-cf-drawer--open" : ""}`}
                style={rootStyle}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ec-cf-drawer-title"
            >
                <header className="ec-cf-drawer__head">
                    <h2 id="ec-cf-drawer-title">{isEdit ? "Özel Alan Düzenle" : "Özel Alan Ekle"}</h2>
                    <button type="button" className="ec-cf-drawer__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>

                <div className="ec-cf-drawer__body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    <div className="ec-cf-drawer__field">
                        <label htmlFor="ec-cf-name">
                            Ad <span className="ec-cf-required">*</span>
                        </label>
                        <input
                            id="ec-cf-name"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Ad"
                            autoFocus
                        />
                    </div>

                    <div className="ec-cf-drawer__field">
                        <label>
                            Tür <span className="ec-cf-required">*</span>
                        </label>
                        <CustomFieldTypeSelect
                            value={form.type}
                            onChange={(type) => setForm((prev) => ({ ...prev, type }))}
                        />
                    </div>
                </div>

                <footer className={`ec-cf-drawer__foot${isEdit ? " ec-cf-drawer__foot--edit" : ""}`}>
                    {isEdit && (
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--danger-outline"
                            disabled={saving}
                            onClick={remove}
                        >
                            Sil
                        </button>
                    )}
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={saving || !form.name.trim()}
                        onClick={save}
                    >
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                </footer>
            </aside>
        </div>,
        document.body
    );
};

export default CustomFieldDrawer;
