import React from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaPen, FaMagic } from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";

const ProductGroupAddTypeModal = ({ open, onClose, onSelectManual, onSelectAutomatic }) => {
    const { C } = useDashtockTheme();

    if (!open) return null;

    return createPortal(
        <div className="ec-pg-add-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="ec-pg-add-modal" onClick={(e) => e.stopPropagation()}>
                <header className="ec-pg-add-modal__head">
                    <h3>Ürün Grubu Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <p className="ec-pg-add-modal__hint">
                    Ürün grubu oluşturma yöntemini seçin. Manuel ekleme ile ürünleri tek tek seçebilir; otomatik
                    ekleme ile özel alan veya varyant bilgisine göre gruplama yapabilirsiniz.
                </p>
                <div className="ec-pg-add-modal__grid">
                    <button type="button" className="ec-pg-add-modal__card" onClick={onSelectManual}>
                        <span className="ec-pg-add-modal__icon" style={{ color: C.accent }}>
                            <FaPen />
                        </span>
                        <strong>Manuel Ekle</strong>
                        <p>Ürünleri tek tek seçerek gruplama yapın.</p>
                    </button>
                    <button type="button" className="ec-pg-add-modal__card" onClick={onSelectAutomatic}>
                        <span className="ec-pg-add-modal__icon" style={{ color: C.accent }}>
                            <FaMagic />
                        </span>
                        <strong>Otomatik Ekle</strong>
                        <p>Özel alan veya varyant bilgisine göre otomatik gruplama yapın.</p>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProductGroupAddTypeModal;
