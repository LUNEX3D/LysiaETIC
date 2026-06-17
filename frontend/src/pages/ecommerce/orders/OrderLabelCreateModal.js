import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaSearch } from "react-icons/fa";
import { createStoreOrderLabel } from "../../../services/storeApi";

/** Mağaza etiket kataloğuna yeni etiket ekler (Sipariş Etiketleri sayfası). */
const OrderLabelCreateModal = ({ open, onClose, onCreated, existingNames = [] }) => {
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setName("");
            setError("");
            setSaving(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open) return null;

    const trimmed = name.trim();
    const duplicate = existingNames.some(
        (n) => String(n).toLowerCase() === trimmed.toLowerCase()
    );

    const submit = async () => {
        if (!trimmed) {
            setError("Etiket adı girin");
            return;
        }
        if (duplicate) {
            setError("Bu etiket zaten var");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const res = await createStoreOrderLabel(trimmed);
            onCreated?.(res.label);
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || "Etiket eklenemedi");
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className="ec-order-label-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-label-create-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="ec-order-label-modal ec-order-label-modal--compact" onMouseDown={(e) => e.stopPropagation()}>
                <header className="ec-order-label-modal__head">
                    <h3 id="order-label-create-title">Etiket Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-order-label-modal__body">
                    <label className="ec-order-label-modal__search">
                        <FaSearch aria-hidden />
                        <input
                            placeholder="Etiket adı yazın"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submit();
                            }}
                            autoFocus
                        />
                    </label>
                    <p className="ec-order-label-modal__hint">
                        Örn. Kargo Etiketi Yazdırıldı — siparişlere sonra atayabilirsiniz.
                    </p>
                    {error && <p className="ec-order-label-modal__error">{error}</p>}
                </div>
                <footer className="ec-order-label-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={saving || !trimmed}
                        onClick={submit}
                    >
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default OrderLabelCreateModal;
