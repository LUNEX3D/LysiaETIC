import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaInfoCircle } from "react-icons/fa";

const CustomerImportModal = ({ open, onClose }) => {
    const [importType, setImportType] = useState("customer");

    if (!open) return null;

    return createPortal(
        <div
            className="ec-order-label-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="ec-order-label-modal ec-customer-export-modal" onMouseDown={(e) => e.stopPropagation()}>
                <header className="ec-order-label-modal__head">
                    <h3>
                        Müşterileri İçe Aktar <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                    </h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-order-label-modal__body">
                    <p className="ec-prod-muted">Hangisini içeri aktaracağınızı seçin</p>
                    <label className="ec-customer-radio">
                        <input
                            type="radio"
                            name="import-type"
                            checked={importType === "customer"}
                            onChange={() => setImportType("customer")}
                        />
                        Müşteri
                    </label>
                    <label className="ec-customer-radio">
                        <input
                            type="radio"
                            name="import-type"
                            checked={importType === "custom"}
                            onChange={() => setImportType("custom")}
                            disabled
                        />
                        Müşteri Özel Alan
                    </label>
                </div>
                <footer className="ec-order-label-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Kapat
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => {
                            alert("CSV içe aktarma yakında eklenecek.");
                            onClose();
                        }}
                    >
                        Devam Et
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default CustomerImportModal;
