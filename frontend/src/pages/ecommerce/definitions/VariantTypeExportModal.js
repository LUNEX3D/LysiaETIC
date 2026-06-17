import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { exportStoreVariantTypes } from "../../../services/storeApi";

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

const VariantTypeExportModal = ({ open, onClose }) => {
    const [fileType, setFileType] = useState("csv");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!open) return null;

    const handleExport = async () => {
        setLoading(true);
        setError("");
        try {
            if (fileType !== "csv") {
                setError("Şimdilik yalnızca CSV dışa aktarma destekleniyor");
                return;
            }
            const { blob, filename } = await exportStoreVariantTypes();
            downloadBlob(blob, filename);
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || "Dışa aktarma başarısız");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-prod-modal--io" onClick={(e) => e.stopPropagation()}>
                <header className="ec-prod-modal__head">
                    <h2>Varyant Türlerini Dışarı Aktar</h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-prod-io-body">
                    {error && <div className="ec-prod-form-error">{error}</div>}
                    <p className="ec-prod-io-label">Hangi dosya tipi ile dışarı aktaracağınızı seçin</p>
                    <div className="ec-cat-io-format-row">
                        <button
                            type="button"
                            className={`ec-cat-io-format${fileType === "csv" ? " ec-cat-io-format--active" : ""}`}
                            onClick={() => setFileType("csv")}
                        >
                            .CSV ile Aktar
                        </button>
                        <button
                            type="button"
                            className={`ec-cat-io-format${fileType === "xls" ? " ec-cat-io-format--active" : ""}`}
                            onClick={() => setFileType("xls")}
                        >
                            .XLS ile Aktar
                        </button>
                    </div>
                </div>
                <footer className="ec-prod-io-footer">
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={loading}>
                        Kapat
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={handleExport}
                        disabled={loading}
                    >
                        {loading ? "Aktarılıyor…" : "Dışa Aktar"}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default VariantTypeExportModal;
