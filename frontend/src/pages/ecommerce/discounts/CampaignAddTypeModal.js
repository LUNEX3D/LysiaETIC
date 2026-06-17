import React from "react";
import { FaPercent, FaShoppingCart } from "react-icons/fa";

const CampaignAddTypeModal = ({ open, onClose, onSelect }) => {
    if (!open) return null;

    return (
        <div
            className="ec-order-label-modal-backdrop ec-discount-add-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discount-add-modal-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                className="ec-order-label-modal ec-order-label-modal--compact ec-discount-add-modal"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="ec-order-label-modal__head ec-discount-add-modal__head">
                    <h3 id="discount-add-modal-title">Kampanya Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        ×
                    </button>
                </header>
                <div className="ec-order-label-modal__body ec-discount-add-modal__body">
                    <button
                        type="button"
                        className="ec-discount-add-modal__choice"
                        onClick={() => onSelect?.("automatic")}
                    >
                        <span className="ec-discount-add-modal__choice-icon" aria-hidden>
                            <FaShoppingCart />
                        </span>
                        <span className="ec-discount-add-modal__choice-text">
                            <strong>Otomatik İndirim</strong>
                            <p>İndirim sepette otomatik olarak uygulanacaktır.</p>
                        </span>
                    </button>
                    <button
                        type="button"
                        className="ec-discount-add-modal__choice"
                        onClick={() => onSelect?.("code")}
                    >
                        <span className="ec-discount-add-modal__choice-icon" aria-hidden>
                            <FaPercent />
                        </span>
                        <span className="ec-discount-add-modal__choice-text">
                            <strong>İndirim Kodu</strong>
                            <p>Müşteriler, ödeme sırasında bir kod girerlerse indirim alırlar.</p>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CampaignAddTypeModal;
