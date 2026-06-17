import React from "react";
import { FaBox, FaLayerGroup, FaTimes, FaInfoCircle } from "react-icons/fa";

const ProductAddTypeModal = ({ onClose, onSelect }) => (
    <div className="ec-prod-modal-backdrop" onClick={onClose}>
        <div className="ec-prod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ec-prod-modal__head">
                <h2>
                    <FaInfoCircle style={{ marginRight: 6, opacity: 0.6 }} />
                    Ürün Ekle
                </h2>
                <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                    <FaTimes />
                </button>
            </div>
            <div className="ec-prod-modal__body">
                <button type="button" className="ec-prod-type-card" onClick={() => onSelect("simple")}>
                    <div className="ec-prod-type-card__icon">
                        <FaBox />
                    </div>
                    <div className="ec-prod-type-card__text">
                        <strong>Basit Ürün</strong>
                        <span>Tek parça olarak bir ürün ekleyin</span>
                    </div>
                </button>
                <button type="button" className="ec-prod-type-card" onClick={() => onSelect("variant")}>
                    <div className="ec-prod-type-card__icon">
                        <FaLayerGroup />
                    </div>
                    <div className="ec-prod-type-card__text">
                        <strong>Varyantlı Ürün</strong>
                        <span>Beden, renk gibi farklı özelliklerde birden fazla ürün ekleyin</span>
                    </div>
                </button>
            </div>
        </div>
    </div>
);

export default ProductAddTypeModal;
