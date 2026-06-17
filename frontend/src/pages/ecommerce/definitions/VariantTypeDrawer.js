import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    FaTimes,
    FaCheck,
    FaGripVertical,
    FaPen,
    FaTrash,
    FaCopy,
    FaImage,
} from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import { uploadProductImage } from "../../../services/productManagementApi";
import {
    parseVariantValueInput,
    newVariantValue,
    normalizeVariantOptionGroup,
} from "../../../utils/productVariantOptions";
import {
    emptyVariantTypeForm,
    variantTypeToForm,
    formToVariantTypePayload,
} from "./variantTypeFormUtils";
import {
    createStoreVariantType,
    updateStoreVariantType,
    deleteStoreVariantType,
} from "../../../services/storeApi";

const VariantTypeDrawer = ({ open, variantType, onClose, onSaved, onDeleted }) => {
    const { rootClassName, rootStyle } = useDashtockTheme();
    const isEdit = !!variantType;
    const [draft, setDraft] = useState(emptyVariantTypeForm);
    const [valueInput, setValueInput] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [visible, setVisible] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);
    const [editingIdx, setEditingIdx] = useState(null);
    const [colorTab, setColorTab] = useState("color");
    const [uploading, setUploading] = useState(false);
    const valueInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setDraft(variantType ? variantTypeToForm(variantType) : emptyVariantTypeForm());
            setValueInput("");
            setError("");
            setEditingIdx(null);
            requestAnimationFrame(() => setVisible(true));
            setTimeout(() => valueInputRef.current?.focus(), 200);
        } else {
            setVisible(false);
        }
    }, [open, variantType]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    const nameLen = draft.name.length;

    const addValues = (labels) => {
        const existing = new Set(draft.values.map((v) => v.label.toLowerCase()));
        const toAdd = labels
            .filter((l) => !existing.has(l.toLowerCase()))
            .map((label, i) => newVariantValue(label, draft.displayStyle, draft.values.length + i));
        if (!toAdd.length) return;
        setDraft((d) => ({
            ...d,
            values: [...d.values, ...toAdd].map((v, i) => ({ ...v, sortOrder: i })),
        }));
        setValueInput("");
    };

    const handleValueKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const labels = parseVariantValueInput(valueInput);
            if (labels.length) addValues(labels);
        }
    };

    const handleValuePaste = (e) => {
        const text = e.clipboardData.getData("text/plain");
        if (!text || !/[,;\n]/.test(text)) return;
        e.preventDefault();
        const labels = parseVariantValueInput(text);
        if (labels.length) addValues(labels);
    };

    const removeValue = (index) => {
        setDraft((d) => ({
            ...d,
            values: d.values.filter((_, i) => i !== index).map((v, i) => ({ ...v, sortOrder: i })),
        }));
        if (editingIdx === index) setEditingIdx(null);
    };

    const moveValue = (from, to) => {
        if (from === to || from < 0 || to < 0 || to >= draft.values.length) return;
        const vals = [...draft.values];
        const [moved] = vals.splice(from, 1);
        vals.splice(to, 0, moved);
        setDraft((d) => ({ ...d, values: vals.map((v, i) => ({ ...v, sortOrder: i })) }));
    };

    const updateEditingValue = (patch) => {
        if (editingIdx == null) return;
        setDraft((d) => ({
            ...d,
            values: d.values.map((v, i) => (i === editingIdx ? { ...v, ...patch } : v)),
        }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await uploadProductImage(file);
            if (res?.url) updateEditingValue({ imageUrl: res.url });
        } catch {
            window.alert("Görsel yüklenemedi");
        } finally {
            setUploading(false);
        }
    };

    const save = async () => {
        const payload = formToVariantTypePayload(draft);
        if (!payload.name) {
            setError("Varyant türü adı gerekli");
            return;
        }
        if (!payload.values.length) {
            setError("En az bir varyant değeri ekleyin");
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (isEdit) {
                await updateStoreVariantType(variantType._id, payload);
            } else {
                await createStoreVariantType(payload);
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
        if (!window.confirm(`"${draft.name}" silinsin mi?`)) return;
        setSaving(true);
        setError("");
        try {
            await deleteStoreVariantType(variantType._id);
            onDeleted?.();
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        } finally {
            setSaving(false);
        }
    };

    const editingValue = editingIdx != null ? draft.values[editingIdx] : null;
    const title = isEdit ? draft.name || "Varyant Türü Düzenle" : "Varyant Türü Oluştur";

    return createPortal(
        <div
            className={`ec-cf-drawer-backdrop${visible ? " ec-cf-drawer-backdrop--open" : ""}`}
            onClick={onClose}
            role="presentation"
        >
            <div className="ec-cf-drawer-backdrop__shade" aria-hidden="true" />
            <aside
                className={`ec-vt-drawer ${rootClassName}${visible ? " ec-vt-drawer--open" : ""}`}
                style={rootStyle}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ec-vt-drawer-title"
            >
                <header className="ec-cf-drawer__head">
                    <h2 id="ec-vt-drawer-title">{title}</h2>
                    <button type="button" className="ec-cf-drawer__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>

                <div className="ec-vt-drawer__body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    <div className="ec-cf-drawer__field">
                        <label>
                            Varyant Türü Adı <span className="ec-cf-required">*</span>
                        </label>
                        <input
                            value={draft.name}
                            maxLength={100}
                            placeholder="Örneğin: Renk, Boyut"
                            onChange={(e) => {
                                setError("");
                                setDraft((d) => ({ ...d, name: e.target.value }));
                            }}
                        />
                        <span className="ec-prod-char-count">{nameLen}/100</span>
                    </div>

                    <div className="ec-cf-drawer__field">
                        <label>
                            Seçim Stili <span className="ec-cf-required">*</span>
                        </label>
                        <div className="ec-prod-var-style-cards">
                            <button
                                type="button"
                                className={`ec-prod-var-style-card ${draft.displayStyle === "list" ? "ec-prod-var-style-card--active" : ""}`}
                                onClick={() => setDraft((d) => ({ ...d, displayStyle: "list" }))}
                            >
                                {draft.displayStyle === "list" && (
                                    <span className="ec-prod-var-style-card__check">
                                        <FaCheck />
                                    </span>
                                )}
                                <span className="ec-prod-var-style-card__title">Liste</span>
                                <span className="ec-prod-var-style-card__preview ec-prod-var-style-card__preview--list">
                                    <span className="ec-prod-var-preview-dd">XL</span>
                                    <span className="ec-prod-var-preview-chip">S</span>
                                    <span className="ec-prod-var-preview-chip">M</span>
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`ec-prod-var-style-card ${draft.displayStyle === "color_image" ? "ec-prod-var-style-card--active" : ""}`}
                                onClick={() => setDraft((d) => ({ ...d, displayStyle: "color_image" }))}
                            >
                                {draft.displayStyle === "color_image" && (
                                    <span className="ec-prod-var-style-card__check">
                                        <FaCheck />
                                    </span>
                                )}
                                <span className="ec-prod-var-style-card__title">Renk / Görsel</span>
                                <span className="ec-prod-var-style-card__preview ec-prod-var-style-card__preview--color">
                                    <span className="ec-prod-var-preview-swatch" style={{ background: "#d1d5db" }} />
                                    <span className="ec-prod-var-preview-swatch" style={{ background: "#6b7280" }} />
                                    <span className="ec-prod-var-preview-img">
                                        <FaImage />
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="ec-cf-drawer__field">
                        <label>
                            Varyantlar <span className="ec-cf-required">*</span>
                        </label>
                        <input
                            ref={valueInputRef}
                            value={valueInput}
                            placeholder="Örneğin: Kırmızı, Geniş"
                            onChange={(e) => setValueInput(e.target.value)}
                            onKeyDown={handleValueKeyDown}
                            onPaste={handleValuePaste}
                        />
                        <p className="ec-prod-field-hint">
                            Varyant adını yazıp ENTER&apos;a basın. Virgülle ayrılmış listeyi yapıştırabilirsiniz.
                        </p>
                    </div>

                    {draft.values.length > 0 && (
                        <ul className="ec-prod-var-value-list">
                            {draft.values.map((val, index) => (
                                <li
                                    key={`${val.label}-${index}`}
                                    className={`ec-prod-var-value-row ${dragIdx === index ? "ec-prod-var-value-row--drag" : ""}`}
                                    draggable
                                    onDragStart={() => setDragIdx(index)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                        moveValue(dragIdx, index);
                                        setDragIdx(null);
                                    }}
                                    onDragEnd={() => setDragIdx(null)}
                                >
                                    <span className="ec-prod-var-value-row__drag" aria-hidden>
                                        <FaGripVertical />
                                    </span>
                                    {draft.displayStyle === "color_image" && (
                                        <button
                                            type="button"
                                            className="ec-prod-var-swatch-btn"
                                            style={{
                                                background: val.imageUrl
                                                    ? `center/cover url(${val.imageUrl})`
                                                    : val.colorHex || "#9ca3af",
                                            }}
                                            title="Renk / görsel"
                                            onClick={() => {
                                                setEditingIdx(index);
                                                setColorTab(val.imageUrl ? "image" : "color");
                                            }}
                                        />
                                    )}
                                    <span className="ec-prod-var-value-row__label">{val.label}</span>
                                    <div className="ec-prod-var-value-row__actions">
                                        {draft.displayStyle === "color_image" && (
                                            <button
                                                type="button"
                                                className="ec-prod-icon-btn"
                                                aria-label="Düzenle"
                                                onClick={() => {
                                                    setEditingIdx(index);
                                                    setColorTab(val.imageUrl ? "image" : "color");
                                                }}
                                            >
                                                <FaPen />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="ec-prod-icon-btn"
                                            aria-label="Sil"
                                            onClick={() => removeValue(index)}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {editingValue && draft.displayStyle === "color_image" && (
                        <div className="ec-prod-var-color-pop">
                            <div className="ec-prod-var-color-pop__tabs">
                                <button
                                    type="button"
                                    className={colorTab === "color" ? "ec-prod-var-color-pop__tab--active" : ""}
                                    onClick={() => setColorTab("color")}
                                >
                                    Renk
                                </button>
                                <button
                                    type="button"
                                    className={colorTab === "image" ? "ec-prod-var-color-pop__tab--active" : ""}
                                    onClick={() => setColorTab("image")}
                                >
                                    Görsel
                                </button>
                                <button
                                    type="button"
                                    className="ec-prod-var-color-pop__close"
                                    onClick={() => setEditingIdx(null)}
                                >
                                    <FaTimes />
                                </button>
                            </div>
                            {colorTab === "color" ? (
                                <div className="ec-prod-var-color-pop__color">
                                    <input
                                        type="color"
                                        value={
                                            /^#[0-9a-f]{6}$/i.test(editingValue.colorHex)
                                                ? editingValue.colorHex
                                                : "#9ca3af"
                                        }
                                        onChange={(e) =>
                                            updateEditingValue({ colorHex: e.target.value, imageUrl: "" })
                                        }
                                    />
                                    <span className="ec-prod-var-hex-tag">HEX</span>
                                    <input
                                        className="ec-prod-var-hex-input"
                                        value={editingValue.colorHex || ""}
                                        placeholder="#ff0000"
                                        onChange={(e) => {
                                            let v = e.target.value.trim();
                                            if (v && !v.startsWith("#")) v = `#${v}`;
                                            updateEditingValue({ colorHex: v, imageUrl: "" });
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="ec-prod-icon-btn"
                                        title="Kopyala"
                                        onClick={() => {
                                            navigator.clipboard?.writeText(editingValue.colorHex || "#9ca3af");
                                        }}
                                    >
                                        <FaCopy />
                                    </button>
                                </div>
                            ) : (
                                <div className="ec-prod-var-color-pop__image">
                                    <input
                                        value={editingValue.imageUrl || ""}
                                        placeholder="Görsel URL"
                                        onChange={(e) =>
                                            updateEditingValue({ imageUrl: e.target.value, colorHex: "" })
                                        }
                                    />
                                    <label className="ec-prod-btn ec-prod-btn--sm">
                                        {uploading ? "…" : "Yükle"}
                                        <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                                    </label>
                                </div>
                            )}
                            <p className="ec-prod-field-hint">{editingValue.label}</p>
                        </div>
                    )}
                </div>

                <footer className={`ec-vt-drawer__foot${isEdit ? " ec-vt-drawer__foot--edit" : ""}`}>
                    <button type="button" className="ec-prod-btn" disabled={saving} onClick={onClose}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={saving}
                        onClick={save}
                    >
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                    {isEdit && (
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--danger-outline"
                            disabled={saving}
                            onClick={remove}
                            aria-label="Sil"
                        >
                            <FaTrash />
                        </button>
                    )}
                </footer>
            </aside>
        </div>,
        document.body
    );
};

export default VariantTypeDrawer;
