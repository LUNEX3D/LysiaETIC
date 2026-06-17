import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import { emptyTagForm, tagToForm, formToTagPayload, TAG_NAME_MAX } from "./tagFormUtils";
import { createStoreTag, updateStoreTag, deleteStoreTag } from "../../../services/storeApi";

const TagDrawer = ({ open, tag, onClose, onSaved, onDeleted }) => {
    const { rootClassName, rootStyle } = useDashtockTheme();
    const isEdit = !!tag;
    const [form, setForm] = useState(emptyTagForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(tag ? tagToForm(tag) : emptyTagForm());
            setError("");
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
        }
    }, [open, tag]);

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
            setError("Etiket adı zorunludur");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToTagPayload(form);
            if (isEdit) {
                await updateStoreTag(tag._id, payload);
            } else {
                await createStoreTag(payload);
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
        if (!window.confirm(`"${tag.name}" silinsin mi?`)) return;
        setSaving(true);
        setError("");
        try {
            await deleteStoreTag(tag._id);
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
                aria-labelledby="ec-tag-drawer-title"
            >
                <header className="ec-cf-drawer__head">
                    <h2 id="ec-tag-drawer-title">{isEdit ? "Etiket Düzenle" : "Etiket Ekle"}</h2>
                    <button type="button" className="ec-cf-drawer__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>

                <div className="ec-cf-drawer__body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    <div className="ec-cf-drawer__field">
                        <label htmlFor="ec-tag-name">
                            Ad <span className="ec-cf-required">*</span>
                        </label>
                        <input
                            id="ec-tag-name"
                            value={form.name}
                            maxLength={TAG_NAME_MAX}
                            onChange={(e) => setForm({ name: e.target.value })}
                            placeholder="Ad"
                            autoFocus
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

export default TagDrawer;
