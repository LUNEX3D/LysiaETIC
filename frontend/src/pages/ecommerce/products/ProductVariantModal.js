import React, { useState, useRef, useEffect } from "react";
import {
    FaTimes,
    FaCheck,
    FaGripVertical,
    FaPen,
    FaTrash,
    FaCopy,
    FaImage,
} from "react-icons/fa";
import { uploadProductImage } from "../../../services/productManagementApi";
import {
    parseVariantValueInput,
    newVariantValue,
    normalizeVariantOptionGroup,
} from "../../../utils/productVariantOptions";

const emptyDraft = () => ({
    name: "",
    displayStyle: "list",
    showOnListingPages: false,
    values: [],
});

const ProductVariantModal = ({ onClose, onSave, initialGroup = null }) => {
    const [draft, setDraft] = useState(() =>
        initialGroup ? normalizeVariantOptionGroup(initialGroup) : emptyDraft()
    );
    const [valueInput, setValueInput] = useState("");
    const [error, setError] = useState("");
    const [dragIdx, setDragIdx] = useState(null);
    const [editingIdx, setEditingIdx] = useState(null);
    const [colorTab, setColorTab] = useState("color");
    const [uploading, setUploading] = useState(false);
    const valueInputRef = useRef(null);

    useEffect(() => {
        valueInputRef.current?.focus();
    }, []);

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

    const handleSave = () => {
        const normalized = normalizeVariantOptionGroup(draft);
        if (!normalized.name) {
            setError("Varyant türü adı gerekli");
            return;
        }
        if (!normalized.values.length) {
            setError("En az bir varyant değeri ekleyin");
            return;
        }
        onSave(normalized);
        onClose();
    };

    const editingValue = editingIdx != null ? draft.values[editingIdx] : null;

    return (
        <div className="ec-prod-modal-backdrop" onClick={onClose}>
            <div className="ec-prod-modal ec-prod-modal--variant" onClick={(e) => e.stopPropagation()}>
                <div className="ec-prod-modal__head">
                    <h2>Varyant Ekle</h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>

                <div className="ec-prod-var-modal-body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    <div className="ec-prod-field">
                        <label>
                            Varyant Türü Adı <span className="ec-prod-required">*</span>
                        </label>
                        <input
                            value={draft.name}
                            maxLength={100}
                            placeholder="e.g. Renk, Boyut"
                            onChange={(e) => {
                                setError("");
                                setDraft((d) => ({ ...d, name: e.target.value }));
                            }}
                        />
                        <span className="ec-prod-char-count">{nameLen}/100</span>
                    </div>

                    <div className="ec-prod-field">
                        <label>
                            Seçim Stili <span className="ec-prod-required">*</span>
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

                    <div className="ec-prod-field">
                        <label>
                            Varyantlar <span className="ec-prod-required">*</span>
                        </label>
                        <input
                            ref={valueInputRef}
                            value={valueInput}
                            placeholder="Örneğin: Kırmızı, Büyük"
                            onChange={(e) => setValueInput(e.target.value)}
                            onKeyDown={handleValueKeyDown}
                            onPaste={handleValuePaste}
                        />
                        <p className="ec-prod-field-hint">
                            Varyantınızın adını yazın ve ENTER tuşuna basın. Virgülle ayrılmış listeyi yapıştırabilirsiniz.
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
                                        onChange={(e) => updateEditingValue({ colorHex: e.target.value, imageUrl: "" })}
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
                                            const hex = editingValue.colorHex || "#9ca3af";
                                            navigator.clipboard?.writeText(hex);
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

                    <label className="ec-prod-check ec-prod-var-listing-check">
                        <input
                            type="checkbox"
                            checked={draft.showOnListingPages}
                            onChange={(e) =>
                                setDraft((d) => ({ ...d, showOnListingPages: e.target.checked }))
                            }
                        />
                        Bu ürün için varyant değerlerini marka ve kategori sayfalarında ayrı göster.
                    </label>
                </div>

                <div className="ec-prod-var-modal-footer">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Vazgeç
                    </button>
                    <button type="button" className="ec-prod-btn ec-prod-btn--primary ec-prod-var-save-btn" onClick={handleSave}>
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductVariantModal;
