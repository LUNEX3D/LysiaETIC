import React from "react";
import { FaArrowLeft, FaClock } from "react-icons/fa";

const STATUS_LABELS = {
    draft: "Taslak",
    ordered: "Onaylandı",
    in_transit: "Yolda",
    received: "Teslim alındı",
    cancelled: "İptal",
};

const PurchaseFormHeader = ({
    isEdit,
    status,
    saving,
    onBack,
    onSave,
    onSaveApprove,
}) => (
    <header className="ec-prod-form-topbar ec-purchase-form-topbar">
        <div className="ec-prod-form-topbar__left">
            <button type="button" onClick={onBack} aria-label="Geri" className="ec-prod-icon-btn">
                <FaArrowLeft />
            </button>
            <nav className="ec-prod-breadcrumb" aria-label="Breadcrumb">
                <button type="button" className="ec-prod-breadcrumb__link" onClick={onBack}>
                    Satın Alma
                </button>
                <span className="ec-prod-breadcrumb__sep">&gt;</span>
                <span>{isEdit ? "Satın Alma Düzenle" : "Satın Alma Oluştur"}</span>
            </nav>
            <span className="ec-purchase-status-badge">
                <FaClock /> {STATUS_LABELS[status] || "Taslak"}
            </span>
        </div>
        <div className="ec-prod-head-actions">
            <button type="button" className="ec-prod-btn" disabled={saving} onClick={() => onSave(false)}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
                type="button"
                className="ec-prod-btn ec-prod-btn--primary"
                disabled={saving}
                onClick={() => onSaveApprove(true)}
            >
                Kaydet ve Onayla
            </button>
        </div>
    </header>
);

export default PurchaseFormHeader;
