import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaSearch } from "react-icons/fa";
import { createStoreOrderLabel } from "../../../services/storeApi";

const OrderLabelPickerModal = ({
    open,
    onClose,
    labels,
    selectedIds,
    onSave,
    onLabelCreated,
    title = "Etiket Ekle",
    saving = false,
}) => {
    const [picked, setPicked] = useState(() => new Set());
    const [search, setSearch] = useState("");
    const [createError, setCreateError] = useState("");

    useEffect(() => {
        if (open) {
            setPicked(new Set(selectedIds || []));
            setSearch("");
            setCreateError("");
        }
    }, [open, selectedIds]);

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

    const toggle = (id) => {
        setPicked((prev) => {
            const next = new Set(prev);
            const key = String(id);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const q = search.trim().toLowerCase();
    const filtered = q
        ? (labels || []).filter((l) => l.name?.toLowerCase().includes(q))
        : labels || [];

    const added = (labels || []).filter((l) => picked.has(String(l._id)));

    const handleCreate = async () => {
        const name = search.trim();
        if (!name) return;
        if (filtered.some((l) => l.name?.toLowerCase() === name.toLowerCase())) {
            setCreateError("Bu etiket zaten listede");
            return;
        }
        setCreateError("");
        try {
            const res = await createStoreOrderLabel(name);
            if (res.label) {
                const id = String(res.label._id);
                setPicked((prev) => new Set(prev).add(id));
                setSearch("");
                onLabelCreated?.(res.label);
            }
        } catch (e) {
            setCreateError(e.response?.data?.error || "Oluşturulamadı");
        }
    };

    const canCreate =
        search.trim() &&
        !(labels || []).some((l) => l.name?.toLowerCase() === search.trim().toLowerCase());

    return createPortal(
        <div
            className="ec-order-label-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-label-modal-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="ec-order-label-modal" onMouseDown={(e) => e.stopPropagation()}>
                <header className="ec-order-label-modal__head">
                    <h3 id="order-label-modal-title">{title}</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-order-label-modal__body">
                    <label className="ec-order-label-modal__search">
                        <FaSearch aria-hidden />
                        <input
                            placeholder="Ara ya da yeni oluştur"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCreateError("");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canCreate) handleCreate();
                            }}
                        />
                    </label>

                    {createError && <p className="ec-order-label-modal__error">{createError}</p>}

                    {canCreate && (
                        <button
                            type="button"
                            className="ec-prod-btn ec-order-label-modal__create"
                            onClick={handleCreate}
                        >
                            + &quot;{search.trim()}&quot; oluştur
                        </button>
                    )}

                    <div className="ec-order-label-modal__cols">
                        <span>Seçilebilir</span>
                        <span>Eklenenler</span>
                    </div>
                    <div className="ec-order-label-modal__lists">
                        <div className="ec-order-label-modal__list-col">
                            {filtered.length === 0 ? (
                                <p className="ec-order-label-modal__empty">
                                    {q
                                        ? "Eşleşen etiket yok"
                                        : "Henüz etiket yok. Yukarıdan yeni oluşturun."}
                                </p>
                            ) : (
                                filtered.map((l) => (
                                    <label key={l._id} className="ec-order-label-option">
                                        <input
                                            type="checkbox"
                                            checked={picked.has(String(l._id))}
                                            onChange={() => toggle(l._id)}
                                        />
                                        <span>{l.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="ec-order-label-modal__list-col ec-order-label-modal__list-col--added">
                            {added.length === 0 ? (
                                <p className="ec-order-label-modal__empty">Henüz eklenmedi</p>
                            ) : (
                                added.map((l) => (
                                    <div key={l._id} className="ec-order-label-chip">
                                        {l.name}
                                        <button
                                            type="button"
                                            className="ec-order-label-chip__x"
                                            aria-label="Kaldır"
                                            onClick={() => toggle(l._id)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                <footer className="ec-order-label-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={saving}
                        onClick={() => onSave([...picked])}
                    >
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default OrderLabelPickerModal;
