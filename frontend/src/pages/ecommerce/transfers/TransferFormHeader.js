import React from "react";
import { FaArrowLeft } from "react-icons/fa";

const TransferFormHeader = ({ saving, onBack, onSaveDraft, onSaveApprove }) => (
    <header className="ec-prod-form-topbar ec-purchase-form-topbar">
        <div className="ec-prod-form-topbar__left">
            <button type="button" onClick={onBack} aria-label="Geri" className="ec-prod-icon-btn">
                <FaArrowLeft />
            </button>
            <nav className="ec-prod-breadcrumb" aria-label="Breadcrumb">
                <button type="button" className="ec-prod-breadcrumb__link" onClick={onBack}>
                    Transferler
                </button>
                <span className="ec-prod-breadcrumb__sep">&gt;</span>
                <span>Transfer Ekle</span>
            </nav>
        </div>
        <div className="ec-prod-head-actions">
            <button type="button" className="ec-prod-btn" disabled={saving} onClick={onSaveDraft}>
                {saving ? "Kaydediliyor…" : "Taslak Olarak Kaydet"}
            </button>
            <button
                type="button"
                className="ec-prod-btn ec-prod-btn--primary"
                disabled={saving}
                onClick={onSaveApprove}
            >
                Kaydet ve Onayla
            </button>
        </div>
    </header>
);

export default TransferFormHeader;
