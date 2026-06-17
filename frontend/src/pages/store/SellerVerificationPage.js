/**
 * Satıcı doğrulaması — çok adımlı sihirbaz (Şirketim Yok / Şahıs / Kurumsal)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
    FaArrowLeft,
    FaUser,
    FaBuilding,
    FaIdCard,
    FaFileAlt,
    FaTrash,
    FaPaperPlane,
    FaCheck,
    FaInfoCircle,
} from "react-icons/fa";
import {
    fetchSellerVerification,
    saveSellerVerification,
    uploadSellerDocument,
    deleteSellerDocument,
} from "../../services/storeApi";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import {
    SELLER_VERIFY_STEPS,
    BUSINESS_TYPES,
    BUSINESS_TYPE_LABELS,
    TR_CITIES,
    STEP_INFO,
    DOC_DEFS,
} from "../../constants/sellerVerification";
import "../../styles/dashboardHome.css";
import "../../styles/sellerVerification.css";

const emptyGeneral = () => ({
    firstName: "",
    lastName: "",
    identityNumber: "",
    birthDate: "",
    address: "",
    country: "TR",
    postalCode: "",
    city: "",
    district: "",
});

const emptyIban = () => ({
    iban: "TR",
    holderName: "",
    currency: "TRY",
});

function buildSavePayload({ businessType, step, general, documents, iban, validateStep, submit }) {
    const body = {
        currentStep: step,
        general,
        documents: { hasTaxExemption: documents.hasTaxExemption },
        iban,
    };
    if (businessType) body.businessType = businessType;
    if (validateStep) body.validateStep = validateStep;
    if (submit) body.submit = true;
    return body;
}

const SellerVerificationPage = ({ onBack }) => {
    const { C, isDark, rootClassName, rootStyle } = useDashtockTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState("draft");
    const [businessType, setBusinessType] = useState(null);
    const [general, setGeneral] = useState(emptyGeneral());
    const [documents, setDocuments] = useState({ hasTaxExemption: false });
    const [iban, setIban] = useState(emptyIban());
    const fileRefs = useRef({});

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3200);
    };

    const applyVerification = (v) => {
        if (!v) return;
        setStep(v.currentStep || 1);
        setStatus(v.status || "draft");
        setBusinessType(v.businessType || null);
        setGeneral({ ...emptyGeneral(), ...(v.general || {}) });
        setDocuments({
            hasTaxExemption: !!v.documents?.hasTaxExemption,
            idFront: v.documents?.idFront,
            idBack: v.documents?.idBack,
            residence: v.documents?.residence,
            taxPlate: v.documents?.taxPlate,
            taxExemption: v.documents?.taxExemption,
        });
        setIban({ ...emptyIban(), ...(v.iban || {}), iban: v.iban?.iban || "TR" });
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchSellerVerification();
            if (!res.store) {
                setError("Önce mağazanızı oluşturun.");
                return;
            }
            applyVerification(res.verification);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const districts = useMemo(() => {
        const city = TR_CITIES.find((c) => c.name === general.city);
        return city?.districts || [];
    }, [general.city]);

    const docDefs = DOC_DEFS[businessType] || DOC_DEFS.none;

    const persist = async (payload) => {
        setSaving(true);
        setError("");
        try {
            const res = await saveSellerVerification(payload);
            applyVerification(res.verification);
            return res.verification;
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleDraft = () =>
        persist(buildSavePayload({ businessType, step, general, documents, iban })).then(
            (v) => v && showToast("Taslak kaydedildi.")
        );

    const selectBusinessType = async (value) => {
        setBusinessType(value);
        setError("");
        const v = await persist(
            buildSavePayload({ businessType: value, step: 1, general, documents, iban })
        );
        if (v) showToast(`${BUSINESS_TYPE_LABELS[value]} seçildi.`);
    };

    const handleContinue = async () => {
        if (step === 1 && !businessType) {
            setError("İşletme türü seçin");
            return;
        }
        const next = Math.min(5, step + 1);
        const v = await persist(
            buildSavePayload({ businessType, step: next, general, documents, iban, validateStep: step })
        );
        if (v) setStep(next);
    };

    const handleSubmit = async () => {
        const v = await persist(
            buildSavePayload({ businessType, step: 5, general, documents, iban, submit: true })
        );
        if (v) showToast("Başvurunuz onaya gönderildi.");
    };

    const onUpload = async (docType, file) => {
        if (!file) return;
        setSaving(true);
        setError("");
        try {
            const res = await uploadSellerDocument(docType, file);
            applyVerification(res.verification);
            const label = DOC_DEFS[businessType]?.find((d) => d.key === docType)?.title || "Belge";
            showToast(`${label} kaydedildi.`);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setSaving(false);
        }
    };

    const onDeleteDoc = async (docType) => {
        setSaving(true);
        try {
            const res = await deleteSellerDocument(docType);
            applyVerification(res.verification);
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        } finally {
            setSaving(false);
        }
    };

    const readOnly = status === "pending_review" || status === "approved";

    const renderStepper = () => (
        <aside className="sv-stepper">
            {SELLER_VERIFY_STEPS.map((s) => {
                const done = step > s.id || (status !== "draft" && s.id < 5);
                const active = step === s.id;
                return (
                    <div key={s.id} className={`sv-step ${done ? "sv-step--done" : ""} ${active ? "sv-step--active" : ""}`}>
                        <div className="sv-step__marker">{done ? <FaCheck size={12} /> : s.id}</div>
                        <div className="sv-step__body">
                            <div className="sv-step__title">{s.title}</div>
                            {s.id === 1 && businessType && (
                                <span className="sv-step__badge">{BUSINESS_TYPE_LABELS[businessType]}</span>
                            )}
                        </div>
                    </div>
                );
            })}
            {STEP_INFO[step] && (
                <div className="sv-info-box">
                    <strong>{STEP_INFO[step].title}</strong>
                    <p>{STEP_INFO[step].text}</p>
                    {STEP_INFO[step].title2 && (
                        <>
                            <strong>{STEP_INFO[step].title2}</strong>
                            <p>{STEP_INFO[step].text2}</p>
                        </>
                    )}
                </div>
            )}
        </aside>
    );

    const renderBusinessStep = () => (
        <>
            <h2>İşletme Türünüzü Seçin</h2>
            <p className="sv-main__sub">
                Satış yapacağınız işletme türünü seçin. Seçiminize göre gerekli bilgiler sonraki adımlarda talep edilecektir.
            </p>
            <div className="sv-cards">
                {BUSINESS_TYPES.map((bt) => (
                    <button
                        key={bt.value}
                        type="button"
                        disabled={readOnly}
                        className={`sv-type-card ${businessType === bt.value ? "sv-type-card--selected" : ""}`}
                        onClick={() => selectBusinessType(bt.value)}
                    >
                        <div className="sv-type-card__icon">
                            {bt.value === "corporate" ? <FaBuilding /> : bt.value === "sole" ? <FaIdCard /> : <FaUser />}
                        </div>
                        <div className="sv-type-card__body">
                            <strong>{bt.title}</strong>
                            <span>{bt.description}</span>
                        </div>
                    </button>
                ))}
            </div>
        </>
    );

    const renderGeneralStep = () => (
        <>
            <h2>Genel Bilgiler</h2>
            <p className="sv-main__sub">
                {businessType === "none"
                    ? "Bireysel satıcı doğrulaması için kimlik ve adres bilgilerinizi girin."
                    : "Şahıs / kurumsal işletme doğrulaması için kimlik ve iş adresi bilgilerinizi girin."}
            </p>
            <div className="sv-form-grid">
                <div className="sv-field">
                    <label>Ad *</label>
                    <input
                        value={general.firstName}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, firstName: e.target.value })}
                    />
                </div>
                <div className="sv-field">
                    <label>Soyad *</label>
                    <input
                        value={general.lastName}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, lastName: e.target.value })}
                    />
                </div>
                <div className="sv-field">
                    <label>TC Kimlik No *</label>
                    <input
                        value={general.identityNumber}
                        disabled={readOnly}
                        maxLength={11}
                        onChange={(e) =>
                            setGeneral({ ...general, identityNumber: e.target.value.replace(/\D/g, "").slice(0, 11) })
                        }
                    />
                </div>
                <div className="sv-field">
                    <label>Doğum Tarihi *</label>
                    <input
                        type="date"
                        value={general.birthDate}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, birthDate: e.target.value })}
                    />
                </div>
            </div>
            <h3 className="sv-section-title">Adres Bilgileri</h3>
            <p className="sv-hint">
                <FaInfoCircle style={{ color: C.accent, flexShrink: 0, marginTop: 2 }} />
                {businessType === "none"
                    ? "İkametgah belgenizde bulunan resmi adresi giriniz."
                    : "Vergi levhanızdaki resmi iş adresini giriniz."}
            </p>
            <div className="sv-form-grid">
                <div className="sv-field sv-field--full">
                    <label>Adres *</label>
                    <textarea
                        value={general.address}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, address: e.target.value })}
                    />
                </div>
                <div className="sv-field">
                    <label>Ülke *</label>
                    <select
                        value={general.country}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, country: e.target.value })}
                    >
                        <option value="TR">Türkiye</option>
                    </select>
                </div>
                <div className="sv-field">
                    <label>Posta Kodu *</label>
                    <input
                        value={general.postalCode}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, postalCode: e.target.value })}
                    />
                </div>
                <div className="sv-field">
                    <label>Şehir *</label>
                    <select
                        value={general.city}
                        disabled={readOnly}
                        onChange={(e) => setGeneral({ ...general, city: e.target.value, district: "" })}
                    >
                        <option value="">Seçin</option>
                        {TR_CITIES.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="sv-field">
                    <label>İlçe *</label>
                    <select
                        value={general.district}
                        disabled={readOnly || !general.city}
                        onChange={(e) => setGeneral({ ...general, district: e.target.value })}
                    >
                        <option value="">Seçin</option>
                        {districts.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </>
    );

    const renderDocUpload = (docKey, title, hint) => {
        const meta = documents[docKey];
        return (
            <div key={docKey} className="sv-doc-row">
                <div className="sv-doc-row__info">
                    <strong>{title}</strong>
                    <span>{hint}</span>
                </div>
                <div className="sv-doc-files">
                    {meta?.url ? (
                        <div className="sv-doc-file">
                            <FaFileAlt style={{ color: C.accent }} />
                            <span>{meta.fileName || "Dosya"}</span>
                            {!readOnly && (
                                <button type="button" aria-label="Sil" onClick={() => onDeleteDoc(docKey)}>
                                    <FaTrash />
                                </button>
                            )}
                        </div>
                    ) : (
                        !readOnly && (
                            <>
                                <input
                                    ref={(el) => {
                                        fileRefs.current[docKey] = el;
                                    }}
                                    className="sv-hidden-input"
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) onUpload(docKey, f);
                                        e.target.value = "";
                                    }}
                                />
                                <button
                                    type="button"
                                    className="sv-btn-upload"
                                    disabled={saving}
                                    onClick={() => fileRefs.current[docKey]?.click()}
                                >
                                    <FaFileAlt /> Belge Yükle
                                </button>
                            </>
                        )
                    )}
                </div>
            </div>
        );
    };

    const renderDocumentsStep = () => (
        <>
            <h2>Gerekli Belgeler</h2>
            <p className="sv-main__sub">Satıcı doğrulama sürecini tamamlamak için gerekli belgeleri yükleyin.</p>
            <div className="sv-docs-card">
                {docDefs.map((d) => renderDocUpload(d.key, d.title + (d.part ? ` (${d.part})` : ""), d.hint))}
                <div className="sv-toggle-row">
                    <button
                        type="button"
                        className={`sv-toggle ${documents.hasTaxExemption ? "sv-toggle--on" : ""}`}
                        disabled={readOnly}
                        onClick={() =>
                            setDocuments({ ...documents, hasTaxExemption: !documents.hasTaxExemption })
                        }
                        aria-pressed={documents.hasTaxExemption}
                    />
                    <div>
                        <strong style={{ display: "block", fontSize: "0.88rem", color: "var(--ec-text)" }}>
                            Vergi muafiyetim var
                        </strong>
                        <span style={{ fontSize: "0.78rem", color: "var(--ec-muted)" }}>
                            Vergi dairesi onaylı muafiyet belgenizi yükleyiniz. Yoksa seçmeden devam edebilirsiniz.
                        </span>
                    </div>
                </div>
                {documents.hasTaxExemption &&
                    renderDocUpload(
                        "taxExemption",
                        "Vergi Muafiyet Belgesi",
                        "Vergi dairesi onaylı muafiyet belgesini yükleyiniz."
                    )}
            </div>
        </>
    );

    const renderIbanStep = () => (
        <>
            <h2>Banka IBAN Bilgisi</h2>
            <p className="sv-main__sub">
                Satış gelirlerinizin doğru ve güvenli şekilde aktarılması için IBAN bilgisine ihtiyacımız var.
            </p>
            <div className="sv-form-grid">
                <div className="sv-field sv-field--full">
                    <label>IBAN *</label>
                    <input
                        value={iban.iban}
                        disabled={readOnly}
                        onChange={(e) => {
                            let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                            if (!v.startsWith("TR")) v = `TR${v.replace(/^TR/, "")}`;
                            setIban({ ...iban, iban: v.slice(0, 26) });
                        }}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                    />
                </div>
                <div className="sv-field sv-field--full">
                    <label>IBAN Sahibinin Ad veya Ünvanı *</label>
                    <input
                        value={iban.holderName}
                        disabled={readOnly}
                        onChange={(e) => setIban({ ...iban, holderName: e.target.value })}
                    />
                </div>
                <div className="sv-field sv-field--full">
                    <label>Kur *</label>
                    <select
                        value={iban.currency}
                        disabled={readOnly}
                        onChange={(e) => setIban({ ...iban, currency: e.target.value })}
                    >
                        <option value="TRY">₺ / TRY / Turkish Lira</option>
                    </select>
                </div>
            </div>
        </>
    );

    const fullName = `${general.firstName || ""} ${general.lastName || ""}`.trim();
    const addressLine = [general.address, general.postalCode, general.district, general.city]
        .filter(Boolean)
        .join(" ");

    const renderSummary = () => (
        <>
            <h2>Özet</h2>
            <p className="sv-main__sub">Satıcı doğrulamanızı onaya göndermeden önce bilgilerinizi kontrol ediniz.</p>

            <div className="sv-summary-block">
                <div className="sv-summary-block__head">
                    <h3>İşletme Türü</h3>
                    {!readOnly && (
                        <button type="button" className="sv-summary-block__edit" onClick={() => setStep(1)}>
                            Düzenle
                        </button>
                    )}
                </div>
                <span className="sv-step__badge">{BUSINESS_TYPE_LABELS[businessType]}</span>
            </div>

            <div className="sv-summary-block">
                <div className="sv-summary-block__head">
                    <h3>Genel Bilgiler</h3>
                    {!readOnly && (
                        <button type="button" className="sv-summary-block__edit" onClick={() => setStep(2)}>
                            Düzenle
                        </button>
                    )}
                </div>
                <div className="sv-summary-grid">
                    <div>
                        <label>Ad Soyad</label>
                        <span>{fullName || "—"}</span>
                    </div>
                    <div>
                        <label>TC Kimlik No</label>
                        <span>{general.identityNumber || "—"}</span>
                    </div>
                    <div>
                        <label>Doğum Tarihi</label>
                        <span>
                            {general.birthDate
                                ? new Date(general.birthDate).toLocaleDateString("tr-TR")
                                : "—"}
                        </span>
                    </div>
                    <div>
                        <label>{businessType === "none" ? "İkamet Adresi" : "İş Adresi"}</label>
                        <span>{addressLine || "—"}</span>
                    </div>
                </div>
            </div>

            <div className="sv-summary-block">
                <div className="sv-summary-block__head">
                    <h3>Belgeler</h3>
                    {!readOnly && (
                        <button type="button" className="sv-summary-block__edit" onClick={() => setStep(3)}>
                            Düzenle
                        </button>
                    )}
                </div>
                {docDefs.map((d) => (
                    <div key={d.key} style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                        <strong style={{ color: "var(--ec-muted)" }}>{d.title}: </strong>
                        <span>{documents[d.key]?.fileName || "—"}</span>
                    </div>
                ))}
            </div>

            <div className="sv-summary-block">
                <div className="sv-summary-block__head">
                    <h3>IBAN</h3>
                    {!readOnly && (
                        <button type="button" className="sv-summary-block__edit" onClick={() => setStep(4)}>
                            Düzenle
                        </button>
                    )}
                </div>
                <div className="sv-summary-grid">
                    <div>
                        <label>IBAN</label>
                        <span>{iban.iban || "—"}</span>
                    </div>
                    <div>
                        <label>IBAN Sahibi</label>
                        <span>{iban.holderName || "—"}</span>
                    </div>
                    <div>
                        <label>Kur</label>
                        <span>₺ / TRY</span>
                    </div>
                </div>
            </div>
        </>
    );

    const renderMain = () => {
        if (step === 1) return renderBusinessStep();
        if (step === 2) return renderGeneralStep();
        if (step === 3) return renderDocumentsStep();
        if (step === 4) return renderIbanStep();
        return renderSummary();
    };

    if (loading) {
        return (
            <div
                className={`dashboard-home-layout${isDark ? "" : " dashboard-home-layout--light"}`}
                style={{ background: C.bg }}
            >
                <div className="sv-page-body sv-loading">Yükleniyor…</div>
            </div>
        );
    }

    return (
        <div
            className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={{ background: C.bg }}
        >
            <div className="sv-page-body">
                <div className="sv-panel" style={rootStyle}>
                    <header className="sv-page__head">
                        <button type="button" className="sv-page__back" onClick={onBack} aria-label="Geri">
                            <FaArrowLeft />
                        </button>
                        <h1>Satıcı Doğrulaması</h1>
                    </header>

                    <div className="sv-panel__alerts">
                        {status === "pending_review" && (
                            <div className="sv-alert sv-alert--info">
                                Başvurunuz inceleniyor. Onaylandığında ödeme almaya başlayabilirsiniz.
                            </div>
                        )}
                        {status === "approved" && (
                            <div className="sv-alert sv-alert--info">Hesabınız doğrulandı.</div>
                        )}
                        {error && <div className="sv-alert sv-alert--error">{error}</div>}
                    </div>

                    <div className="sv-panel__body">
                        <div className="sv-layout">
                            {renderStepper()}
                            <main className="sv-main">{renderMain()}</main>
                        </div>
                    </div>

                    {!readOnly && (
                        <footer className="sv-footer">
                            <button type="button" className="sv-btn-ghost" disabled={saving} onClick={handleDraft}>
                                Taslak Olarak Kaydet
                            </button>
                            {step < 5 ? (
                                <button
                                    type="button"
                                    className="sv-btn-primary"
                                    disabled={saving || (step === 1 && !businessType)}
                                    onClick={handleContinue}
                                >
                                    Devam Et
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="sv-btn-primary"
                                    disabled={saving}
                                    onClick={handleSubmit}
                                >
                                    <FaPaperPlane style={{ marginRight: 6 }} />
                                    Onaya Gönder
                                </button>
                            )}
                        </footer>
                    )}
                </div>
            </div>

            {toast && <div className="sv-toast">{toast}</div>}
        </div>
    );
};

export default SellerVerificationPage;
