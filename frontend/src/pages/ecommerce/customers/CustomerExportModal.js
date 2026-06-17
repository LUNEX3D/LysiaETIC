import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaInfoCircle } from "react-icons/fa";
import { customersToCsv } from "./customerUtils";

const CustomerExportModal = ({ open, onClose, customers, totalCount }) => {
    const [fileType, setFileType] = useState("csv");
    const [scope, setScope] = useState("all");
    const [dataType, setDataType] = useState("customers");

    if (!open) return null;

    const exportData = () => {
        if (fileType === "xls") {
            alert("XLS dışa aktarma yakında eklenecek. Şimdilik CSV kullanın.");
            return;
        }
        const csv = customersToCsv(customers);
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `musteriler-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
    };

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
                        Müşterileri Dışarı Aktar <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                    </h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-order-label-modal__body">
                    <p className="ec-prod-muted">Hangi dosya tipi ile dışarı aktaracağınızı seçin</p>
                    <div className="ec-customer-export-cards">
                        <button
                            type="button"
                            className={`ec-customer-export-card${fileType === "csv" ? " ec-customer-export-card--on" : ""}`}
                            onClick={() => setFileType("csv")}
                        >
                            .CSV ile Aktar
                        </button>
                        <button
                            type="button"
                            className={`ec-customer-export-card${fileType === "xls" ? " ec-customer-export-card--on" : ""}`}
                            onClick={() => setFileType("xls")}
                        >
                            .XLS ile Aktar
                        </button>
                    </div>
                    <p className="ec-prod-muted" style={{ marginTop: "1rem" }}>
                        Hangisini dışarı aktaracağınızı seçin
                    </p>
                    <label className="ec-customer-radio">
                        <input
                            type="radio"
                            name="export-data"
                            checked={dataType === "customers"}
                            onChange={() => setDataType("customers")}
                        />
                        Müşteriler
                    </label>
                    <label className="ec-customer-radio">
                        <input
                            type="radio"
                            name="export-data"
                            checked={dataType === "custom"}
                            onChange={() => setDataType("custom")}
                            disabled
                        />
                        Müşteri Özel Alanları
                    </label>
                    <p className="ec-prod-muted" style={{ marginTop: "1rem" }}>
                        Hangi müşterilerinizi dışarı aktaracağınızı seçin
                    </p>
                    <label className="ec-customer-radio">
                        <input
                            type="radio"
                            name="export-scope"
                            checked={scope === "all"}
                            onChange={() => setScope("all")}
                        />
                        Tüm Müşteriler ({totalCount})
                    </label>
                </div>
                <footer className="ec-order-label-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Kapat
                    </button>
                    <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={exportData}>
                        Dışa Aktar
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default CustomerExportModal;
