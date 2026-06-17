import React from "react";
import { FaTimes, FaLayerGroup, FaBolt } from "react-icons/fa";

const CategoryAddTypeModal = ({ open, onClose, onSelect }) => {
    if (!open) return null;

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-cat-type-modal" onClick={(e) => e.stopPropagation()}>
                <header className="ec-prod-modal__head">
                    <h3>Kategori Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-cat-type-modal__body">
                    <button
                        type="button"
                        className="ec-cat-type-option"
                        onClick={() => onSelect("normal")}
                    >
                        <FaLayerGroup className="ec-cat-type-option__icon" />
                        <div>
                            <strong>Normal Kategori</strong>
                            <p>Ürünlerinize oluşturacağınız kategoriyi tek tek ekleyin.</p>
                        </div>
                    </button>
                    <button
                        type="button"
                        className="ec-cat-type-option"
                        onClick={() => onSelect("dynamic")}
                    >
                        <FaBolt className="ec-cat-type-option__icon" />
                        <div>
                            <strong>Dinamik Kategori</strong>
                            <p>
                                Belirleyeceğiniz koşullara uyan ürünler yeni kategoriye otomatik eklensin.
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CategoryAddTypeModal;
