import React, { useState, useRef } from "react";
import { FaTimes, FaInfoCircle, FaUpload } from "react-icons/fa";
import { importStoreProducts } from "../../../services/storeApi";

const SCOPES = [
    { id: "products", label: "Ürünler" },
    { id: "custom_fields_variant", label: "Özel Alanlar (Varyant)" },
    { id: "custom_fields_product", label: "Özel Alanlar (Ürün)" },
];

const RadioOption = ({ name, value, checked, label, onChange }) => (
    <label className={`ec-prod-io-radio ${checked ? "ec-prod-io-radio--checked" : ""}`}>
        <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
        <span className="ec-prod-io-radio__dot" />
        <span>{label}</span>
    </label>
);

const ProductImportModal = ({ onClose, onDone }) => {
    const [step, setStep] = useState(1);
    const [scope, setScope] = useState("products");
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const fileRef = useRef(null);

    const handleContinue = () => {
        if (step === 1) {
            setStep(2);
            setError("");
            return;
        }
        handleImport();
    };

    const handleImport = async () => {
        if (!file) {
            setError("Lütfen bir .csv veya .xlsx dosyası seçin");
            return;
        }
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await importStoreProducts(file, scope);
            setResult(res);
            onDone?.(res);
        } catch (e) {
            setError(e.response?.data?.error || "İçe aktarma başarısız");
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = (e) => {
        const f = e.target.files?.[0];
        setFile(f || null);
        setError("");
        setResult(null);
    };

    return (
        <div className="ec-prod-modal-backdrop" onClick={onClose}>
            <div className="ec-prod-modal ec-prod-modal--io" onClick={(e) => e.stopPropagation()}>
                <div className="ec-prod-modal__head">
                    <h2>
                        Ürünleri İçe Aktar{" "}
                        <FaInfoCircle style={{ fontSize: 14, opacity: 0.45, verticalAlign: "middle" }} />
                    </h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>

                <div className="ec-prod-io-body">
                    {error && <div className="ec-prod-form-error">{error}</div>}

                    {step === 1 ? (
                        <div className="ec-prod-io-block">
                            <p className="ec-prod-io-label">Hangisini içeri aktaracağınızı seçin</p>
                            <div className="ec-prod-io-radios">
                                {SCOPES.map((opt) => (
                                    <RadioOption
                                        key={opt.id}
                                        name="import-scope"
                                        value={opt.id}
                                        checked={scope === opt.id}
                                        label={opt.label}
                                        onChange={setScope}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="ec-prod-io-label">
                                {SCOPES.find((s) => s.id === scope)?.label} — dosyanızı yükleyin
                            </p>
                            <div
                                className={`ec-prod-io-drop ${file ? "ec-prod-io-drop--has-file" : ""}`}
                                onClick={() => fileRef.current?.click()}
                                onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                                role="button"
                                tabIndex={0}
                            >
                                <FaUpload />
                                <p>
                                    {file ? file.name : ".csv veya .xlsx dosyası seçin"}
                                </p>
                                <span className="ec-prod-muted">Tıklayın veya sürükleyip bırakın</span>
                            </div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                hidden
                                onChange={onFileChange}
                            />
                            {result && (
                                <div className="ec-prod-io-result">
                                    <p>
                                        <strong>{result.created || 0}</strong> yeni,{" "}
                                        <strong>{result.updated || 0}</strong> güncellendi
                                        {(result.skipped > 0 || result.errors?.length > 0) && (
                                            <>
                                                , <strong>{result.skipped || 0}</strong> atlandı
                                            </>
                                        )}
                                    </p>
                                    {result.errors?.length > 0 && (
                                        <ul className="ec-prod-io-errors">
                                            {result.errors.slice(0, 5).map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                            {result.errors.length > 5 && (
                                                <li>…ve {result.errors.length - 5} hata daha</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="ec-prod-io-footer">
                    {step === 2 && (
                        <button
                            type="button"
                            className="ec-prod-btn"
                            onClick={() => {
                                setStep(1);
                                setFile(null);
                                setResult(null);
                                setError("");
                            }}
                            disabled={loading}
                        >
                            Geri
                        </button>
                    )}
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={loading}>
                        Kapat
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => {
                            if (step === 2 && result) {
                                onClose();
                                return;
                            }
                            handleContinue();
                        }}
                        disabled={loading}
                    >
                        {loading ? "Aktarılıyor…" : step === 1 ? "Devam Et" : result ? "Tamam" : "İçe Aktar"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductImportModal;
