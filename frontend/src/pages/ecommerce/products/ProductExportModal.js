import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { exportStoreProducts } from "../../../services/storeApi";

const FILE_TYPES = [
    { id: "csv", label: ".csv dosyası ile dışa aktar" },
    { id: "xls", label: ".xls dosyası ile dışa aktar" },
];

const SCOPES = [
    { id: "products", label: "Ürünler" },
    { id: "custom_fields_variant", label: "Özel Alanlar (Varyant)" },
    { id: "custom_fields_product", label: "Özel Alanlar (Ürün)" },
];

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

const RadioOption = ({ name, value, checked, label, onChange }) => (
    <label className={`ec-prod-io-radio ${checked ? "ec-prod-io-radio--checked" : ""}`}>
        <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
        <span className="ec-prod-io-radio__dot" />
        <span>{label}</span>
    </label>
);

const ProductExportModal = ({ onClose, onDone }) => {
    const [fileType, setFileType] = useState("csv");
    const [scope, setScope] = useState("products");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleContinue = async () => {
        setLoading(true);
        setError("");
        try {
            const { blob, filename } = await exportStoreProducts({ format: fileType, scope });
            downloadBlob(blob, filename);
            onDone?.();
            onClose();
        } catch (e) {
            const msg = e.response?.data?.error;
            if (typeof msg === "string") setError(msg);
            else setError("Dışa aktarma başarısız");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ec-prod-modal-backdrop" onClick={onClose}>
            <div className="ec-prod-modal ec-prod-modal--io" onClick={(e) => e.stopPropagation()}>
                <div className="ec-prod-modal__head">
                    <h2>Ürünleri Dışarı Aktar</h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>

                <div className="ec-prod-io-body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    <div className="ec-prod-io-block">
                        <p className="ec-prod-io-label">Hangi dosya tipi ile dışarı aktaracağınızı seçin</p>
                        <div className="ec-prod-io-radios">
                            {FILE_TYPES.map((opt) => (
                                <RadioOption
                                    key={opt.id}
                                    name="export-file-type"
                                    value={opt.id}
                                    checked={fileType === opt.id}
                                    label={opt.label}
                                    onChange={setFileType}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="ec-prod-io-block">
                        <p className="ec-prod-io-label">Hangisini dışarı aktaracağınızı seçin</p>
                        <div className="ec-prod-io-radios">
                            {SCOPES.map((opt) => (
                                <RadioOption
                                    key={opt.id}
                                    name="export-scope"
                                    value={opt.id}
                                    checked={scope === opt.id}
                                    label={opt.label}
                                    onChange={setScope}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ec-prod-io-footer">
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={loading}>
                        Kapat
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={handleContinue}
                        disabled={loading}
                    >
                        {loading ? "Aktarılıyor…" : "Devam Et"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductExportModal;
