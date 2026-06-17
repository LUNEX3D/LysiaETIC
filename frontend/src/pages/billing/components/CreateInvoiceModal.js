/**
 * Yeni Fatura Oluşturma Modalı
 * VKN/TCKN sorgusu ile alıcı bilgisi otomatik doldurma (Sovos/QNB resmi API)
 */
import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaTimes, FaPlus, FaArrowRight, FaFileInvoice, FaFileInvoiceDollar,
    FaTruck, FaDownload, FaSpinner, FaExclamationTriangle,
    FaLink, FaBuilding, FaClipboardList, FaSearch, FaCheckCircle, FaInfoCircle,
} from "react-icons/fa";
import {
    colors, modalOverlay, modalContent, buttonPrimary, inputStyle as baseInputStyle,
    labelStyle as baseLabelStyle, sectionCardStyle, formSectionTitleStyle, helpTextStyle, infoBannerStyle,
} from "../styles";
import { fmtCurrency, calcInvoiceLines } from "../utils";
import { DEFAULT_INVOICE_FORM, UNIT_OPTIONS, VAT_RATES } from "../constants";
import { BillingSelect, Pill } from "./SharedUI";
import useCustomerLookup from "../hooks/useCustomerLookup";

const CreateInvoiceModal = ({
    isConnected,
    activeProvider,
    onCreateInvoice,
    onClose,
    onGoToProviders,
    onNavigateTab,
    initialDocType = "e-arsiv",
}) => {
    const [step, setStep] = useState(1);
    const [createType, setCreateType] = useState(initialDocType);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_INVOICE_FORM });
    const { lookup, loading: lookupLoading, error: lookupError, result: lookupResult, reset: resetLookup } = useCustomerLookup(activeProvider);

    const setF = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));
    const setLine = (idx, key, val) => {
        const newLines = [...form.lines];
        newLines[idx] = { ...newLines[idx], [key]: val };
        setF("lines", newLines);
    };
    const addLine = () => setF("lines", [...form.lines, { name: "", quantity: 1, unit: "Adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }]);
    const removeLine = (idx) => { if (form.lines.length > 1) setF("lines", form.lines.filter((_, i) => i !== idx)); };

    const { calculated, subTotal, totalVat, grandTotal } = useMemo(() => calcInvoiceLines(form.lines), [form.lines]);
    const vknDigits = String(form.customerVkn || "").replace(/\D/g, "");
    const isIndividual = vknDigits.length === 11;

    const inputStyle = { ...baseInputStyle, borderRadius: 8, padding: "0.55rem 0.75rem" };
    const labelStyle = { ...baseLabelStyle, fontSize: "0.72rem", marginBottom: "0.25rem" };

    const resetForm = () => {
        setStep(1);
        setError("");
        setResult(null);
        setForm({ ...DEFAULT_INVOICE_FORM });
        setCreateType(initialDocType);
        resetLookup();
    };

    const applyLookupToForm = useCallback((data) => {
        if (!data?.customer) return;
        const c = data.customer;
        setForm((prev) => ({
            ...prev,
            customerVkn: c.vkn || prev.customerVkn,
            customerName: c.name || prev.customerName,
            customerFirstName: c.firstName || prev.customerFirstName,
            customerLastName: c.lastName || prev.customerLastName,
            customerTaxOffice: c.taxOffice || prev.customerTaxOffice,
            customerCity: c.city || prev.customerCity,
            customerDistrict: c.district || prev.customerDistrict,
            customerStreet: c.street || prev.customerStreet,
            customerEmail: c.email || prev.customerEmail,
            customerPhone: c.phone || prev.customerPhone,
        }));
        if (data.suggestedDocType) setCreateType(data.suggestedDocType);
    }, []);

    const handleLookup = async () => {
        const data = await lookup(form.customerVkn);
        if (data) applyLookupToForm(data);
    };

    const handleVknBlur = () => {
        if (vknDigits.length === 10 || vknDigits.length === 11) {
            handleLookup();
        }
    };

    const handleSubmit = async () => {
        setError("");
        if (!form.customerName && !form.customerVkn) { setError("Alıcı adı veya VKN/TCKN gerekli"); return; }
        if (form.lines.some((l) => !l.name || !l.unitPrice)) { setError("Tüm kalemlerde ürün adı ve birim fiyat gerekli"); return; }

        setLoading(true);
        try {
            const invoiceData = {
                invoiceTypeCode: "SATIS",
                currency: form.currency || "TRY",
                note: form.note || "",
                sendingType: form.sendingType || "ELEKTRONIK",
                supplier: {
                    vkn: activeProvider?.vknTckn || activeProvider?.vkn || activeProvider?.supplierVkn || "",
                    name: activeProvider?.supplierName || "",
                    taxOffice: activeProvider?.taxOffice || "",
                    street: activeProvider?.street || "",
                    district: activeProvider?.district || "",
                    city: activeProvider?.city || "Istanbul",
                    country: "Turkiye",
                },
                customer: {
                    vkn: form.customerVkn || "11111111111",
                    name: form.customerName || (form.customerFirstName + " " + form.customerLastName).trim(),
                    firstName: isIndividual ? (form.customerFirstName || form.customerName.split(" ")[0] || "") : "",
                    lastName: isIndividual ? (form.customerLastName || form.customerName.split(" ").slice(1).join(" ") || "") : "",
                    taxOffice: form.customerTaxOffice || "",
                    street: form.customerStreet || "",
                    district: form.customerDistrict || "Merkez",
                    city: form.customerCity || "Istanbul",
                    country: "Turkiye",
                    email: form.customerEmail || "",
                    phone: form.customerPhone || "",
                },
                lines: form.lines.map((l) => ({
                    name: l.name,
                    quantity: Number(l.quantity || 1),
                    unit: l.unit || "Adet",
                    unitPrice: Number(l.unitPrice || 0),
                    vatRate: Number(l.vatRate != null ? l.vatRate : 20),
                    discountAmount: Number(l.discountAmount || 0),
                })),
                receiverIdentifier: lookupResult?.receiverIdentifier || "",
            };

            const res = await onCreateInvoice(activeProvider, invoiceData, createType);
            if (res.success) {
                setResult(res.data);
                setStep(3);
            } else {
                setError(res.error || "Fatura oluşturulamadı");
            }
        } catch (err) {
            setError("Bağlantı hatası: " + (err.message || "Sunucuya erişilemiyor"));
        } finally {
            setLoading(false);
        }
    };

    const docTypes = [
        { id: "e-arsiv", label: "e-Arşiv Fatura", icon: <FaFileInvoice />, desc: "Bireysel / e-Fatura mükellefi olmayan alıcı", color: colors.accent, badge: "B2C", action: "create" },
        { id: "e-fatura", label: "Giden e-Fatura", icon: <FaFileInvoiceDollar />, desc: "e-Fatura mükellefi kurumsal alıcı", color: colors.orange, badge: "B2B", action: "create" },
        { id: "e-irsaliye", label: "e-İrsaliye", icon: <FaTruck />, desc: "Sevk irsaliyesi oluştur", color: colors.pink, badge: null, action: "create" },
        { id: "e-fatura-gelen", label: "Gelen e-Fatura", icon: <FaDownload />, desc: "Gelen kutusu — listeyi görüntüle", color: colors.purple, badge: null, action: "navigate", tab: "e-invoice-in" },
    ];

    const handleStep1Continue = () => {
        const sel = docTypes.find((d) => d.id === createType);
        if (sel?.action === "navigate" && sel.tab && onNavigateTab) {
            onNavigateTab(sel.tab);
            onClose();
            resetForm();
            return;
        }
        setStep(2);
    };

    const mukellefStatus = lookupResult?.isEfaturaMukellef === true
        ? { label: "e-Fatura mükellefi", color: colors.green }
        : lookupResult?.isEfaturaMukellef === false && lookupResult?.customer?.vkn
            ? { label: "e-Arşiv (mükellef değil)", color: colors.accent }
            : null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { if (!loading) { onClose(); resetForm(); } }}
                style={{ ...modalOverlay, overflowY: "auto" }}
            >
                <motion.div
                    initial={{ scale: 0.92, y: 40 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 40 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...modalContent, maxWidth: step === 2 ? 820 : 640 }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {step > 1 && step < 3 && (
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => { setStep(step - 1); setError(""); }}
                                    style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer", color: colors.accent, fontSize: "0.75rem" }}>
                                    ← Geri
                                </motion.button>
                            )}
                            <div>
                                <h3 style={{ background: "linear-gradient(135deg, " + colors.accent + ", " + colors.purple + ")", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "1.15rem", fontWeight: 800, margin: 0 }}>
                                    {step === 1 ? "Yeni Belge Oluştur" : step === 2 ? "Alıcı ve Kalemler" : "Fatura Oluşturuldu"}
                                </h3>
                                <p style={{ ...helpTextStyle, margin: "0.2rem 0 0", fontSize: "0.74rem" }}>
                                    {step === 2 ? "VKN/TCKN girin → mükellef sorgusu ile bilgiler otomatik dolar" : "Belge tipini seçin ve devam edin"}
                                </p>
                            </div>
                        </div>
                        <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                            onClick={() => { if (!loading) { onClose(); resetForm(); } }}
                            style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: colors.red, fontSize: "0.9rem" }}>
                            <FaTimes />
                        </motion.button>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                        {[{ n: 1, l: "Tip" }, { n: 2, l: "Form" }, { n: 3, l: "Sonuç" }].map((s) => (
                            <div key={s.n} style={{ flex: 1, textAlign: "center" }}>
                                <div style={{ height: 4, borderRadius: 2, background: s.n <= step ? colors.accent : colors.glass, marginBottom: "0.25rem" }} />
                                <span style={{ color: s.n <= step ? colors.accent : colors.dim, fontSize: "0.65rem", fontWeight: 600 }}>{s.l}</span>
                            </div>
                        ))}
                    </div>

                    {step === 1 && (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem", marginBottom: "1.25rem" }}>
                                {docTypes.map((t) => (
                                    <motion.button key={t.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={() => setCreateType(t.id)}
                                        style={{
                                            background: createType === t.id ? t.color + "18" : colors.glass,
                                            border: createType === t.id ? "2px solid " + t.color : "1px solid " + colors.glassBr,
                                            borderRadius: 12, padding: "1rem", cursor: "pointer", textAlign: "left",
                                        }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                                            <span style={{ color: t.color, fontSize: "1.1rem" }}>{t.icon}</span>
                                            {t.badge && <Pill color={t.color} style={{ fontSize: "0.62rem", padding: "0.15rem 0.4rem" }}>{t.badge}</Pill>}
                                        </div>
                                        <span style={{ color: createType === t.id ? t.color : "#fff", fontSize: "0.88rem", fontWeight: 700, display: "block" }}>{t.label}</span>
                                        <p style={{ color: colors.dim, fontSize: "0.7rem", margin: "0.35rem 0 0", lineHeight: 1.4 }}>{t.desc}</p>
                                    </motion.button>
                                ))}
                            </div>
                            <div style={infoBannerStyle("blue")}>
                                <FaInfoCircle style={{ marginRight: 6 }} />
                                VKN sorgusuna göre sistem e-Fatura veya e-Arşiv önerebilir — mevzuat gereği mükellef olmayan alıcıya e-Arşiv kesilir.
                            </div>
                            {!isConnected ? (
                                <div style={{ ...infoBannerStyle("yellow"), marginTop: "1rem", textAlign: "center" }}>
                                    <FaExclamationTriangle style={{ marginRight: 6 }} />
                                    Belge oluşturmak için önce sağlayıcı bağlayın.
                                    <div style={{ marginTop: "0.75rem" }}>
                                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                            onClick={() => { onClose(); resetForm(); if (onGoToProviders) onGoToProviders(); }}
                                            style={{ ...buttonPrimary, display: "inline-flex" }}>
                                            <FaLink /> Sağlayıcı Bağla
                                        </motion.button>
                                    </div>
                                </div>
                            ) : (
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={handleStep1Continue}
                                    style={{ ...buttonPrimary, width: "100%", padding: "0.75rem", fontSize: "0.88rem", marginTop: "1rem" }}>
                                    <FaArrowRight /> {docTypes.find((d) => d.id === createType)?.action === "navigate" ? "Gelen Kutusu'na Git" : "Devam Et"} — {docTypes.find((d) => d.id === createType)?.label}
                                </motion.button>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div style={sectionCardStyle}>
                                <h4 style={formSectionTitleStyle}><FaBuilding /> Alıcı Bilgileri</h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "end" }}>
                                    <div>
                                        <label style={labelStyle}>VKN / TCKN *</label>
                                        <input
                                            value={form.customerVkn}
                                            onChange={(e) => { setF("customerVkn", e.target.value); resetLookup(); }}
                                            onBlur={handleVknBlur}
                                            placeholder="10 hane VKN veya 11 hane TCKN"
                                            style={inputStyle}
                                            maxLength={11}
                                        />
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleLookup}
                                        disabled={lookupLoading || vknDigits.length < 10}
                                        style={{
                                            ...buttonPrimary,
                                            padding: "0.55rem 0.85rem",
                                            fontSize: "0.78rem",
                                            opacity: lookupLoading || vknDigits.length < 10 ? 0.6 : 1,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {lookupLoading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaSearch />}
                                        {lookupLoading ? " Sorgulanıyor" : " Sorgula"}
                                    </motion.button>
                                </div>

                                {(mukellefStatus || lookupResult?.message) && (
                                    <div style={{ ...infoBannerStyle(mukellefStatus?.color === colors.green ? "green" : "accent"), marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                        {mukellefStatus && <Pill color={mukellefStatus.color}><FaCheckCircle /> {mukellefStatus.label}</Pill>}
                                        <span>{lookupResult?.message}</span>
                                    </div>
                                )}
                                {lookupError && (
                                    <div style={{ ...infoBannerStyle("red"), marginBottom: "0.75rem" }}>{lookupError}</div>
                                )}

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <label style={labelStyle}>{isIndividual ? "Ad Soyad" : "Firma Unvanı"} *</label>
                                        <input value={form.customerName} onChange={(e) => setF("customerName", e.target.value)} placeholder="Sorgu sonrası otomatik dolar" style={inputStyle} />
                                    </div>
                                    {isIndividual && (
                                        <>
                                            <div>
                                                <label style={labelStyle}>Ad</label>
                                                <input value={form.customerFirstName} onChange={(e) => setF("customerFirstName", e.target.value)} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Soyad</label>
                                                <input value={form.customerLastName} onChange={(e) => setF("customerLastName", e.target.value)} style={inputStyle} />
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <label style={labelStyle}>Vergi Dairesi</label>
                                        <input value={form.customerTaxOffice} onChange={(e) => setF("customerTaxOffice", e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>İl</label>
                                        <input value={form.customerCity} onChange={(e) => setF("customerCity", e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>İlçe</label>
                                        <input value={form.customerDistrict} onChange={(e) => setF("customerDistrict", e.target.value)} style={inputStyle} />
                                    </div>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <label style={labelStyle}>Adres</label>
                                        <input value={form.customerStreet} onChange={(e) => setF("customerStreet", e.target.value)} placeholder="Sokak / cadde / no" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>E-posta</label>
                                        <input value={form.customerEmail} onChange={(e) => setF("customerEmail", e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Telefon</label>
                                        <input value={form.customerPhone} onChange={(e) => setF("customerPhone", e.target.value)} style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            <div style={sectionCardStyle}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                                    <h4 style={{ ...formSectionTitleStyle, margin: 0 }}><FaClipboardList /> Fatura Kalemleri</h4>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addLine}
                                        style={{ background: colors.accent + "15", border: "1px solid " + colors.accent + "30", borderRadius: 8, padding: "0.3rem 0.7rem", cursor: "pointer", color: colors.accent, fontSize: "0.72rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                        <FaPlus /> Kalem Ekle
                                    </motion.button>
                                </div>

                                {form.lines.map((line, idx) => (
                                    <div key={idx} style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.75rem", marginBottom: "0.5rem" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem", alignItems: "end" }}>
                                            <div style={{ gridColumn: "1 / -1" }}>
                                                <label style={labelStyle}>Ürün / Hizmet *</label>
                                                <input value={line.name} onChange={(e) => setLine(idx, "name", e.target.value)} placeholder="Ürün adı" style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Miktar</label>
                                                <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLine(idx, "quantity", e.target.value)} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Birim</label>
                                                <BillingSelect value={line.unit} onChange={(e) => setLine(idx, "unit", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Birim Fiyat (₺)</label>
                                                <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => setLine(idx, "unitPrice", e.target.value)} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>KDV %</label>
                                                <BillingSelect value={line.vatRate} onChange={(e) => setLine(idx, "vatRate", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} options={VAT_RATES.map((r) => ({ value: r, label: `%${r}` }))} />
                                            </div>
                                            {form.lines.length > 1 && (
                                                <div>
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeLine(idx)}
                                                        style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: 6, padding: "0.45rem", cursor: "pointer", color: colors.red, width: "100%" }}>
                                                        <FaTimes />
                                                    </motion.button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.4rem", fontSize: "0.68rem" }}>
                                            <span style={{ color: colors.dim }}>Tutar: {fmtCurrency(calculated[idx]?.lineTotal || 0)}</span>
                                            <span style={{ color: colors.green, fontWeight: 700 }}>Toplam: {fmtCurrency(calculated[idx]?.total || 0)}</span>
                                        </div>
                                    </div>
                                ))}

                                <div style={{ background: colors.green + "08", border: "1px solid " + colors.green + "25", borderRadius: 10, padding: "0.85rem", marginTop: "0.5rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                    <span style={{ color: colors.dim, fontSize: "0.75rem" }}>Ara: <strong style={{ color: "#fff" }}>{fmtCurrency(subTotal)}</strong></span>
                                    <span style={{ color: colors.dim, fontSize: "0.75rem" }}>KDV: <strong style={{ color: colors.purple }}>{fmtCurrency(totalVat)}</strong></span>
                                    <span style={{ color: colors.green, fontSize: "1rem", fontWeight: 800 }}>{fmtCurrency(grandTotal)}</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: "1rem" }}>
                                <label style={labelStyle}>Fatura Notu</label>
                                <input value={form.note} onChange={(e) => setF("note", e.target.value)} placeholder="Opsiyonel" style={inputStyle} />
                            </div>

                            {error && (
                                <div style={{ ...infoBannerStyle("red"), marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
                                    <FaExclamationTriangle /> {error}
                                </div>
                            )}

                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={handleSubmit} disabled={loading}
                                style={{ ...buttonPrimary, width: "100%", padding: "0.85rem", fontSize: "0.92rem", opacity: loading ? 0.7 : 1 }}>
                                {loading ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Oluşturuluyor...</> : <><FaFileInvoice /> {createType === "e-fatura" ? "e-Fatura" : "e-Arşiv"} Kes ({fmtCurrency(grandTotal)})</>}
                            </motion.button>
                        </>
                    )}

                    {step === 3 && result && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✓</div>
                            <h3 style={{ color: colors.green, fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>Belge Oluşturuldu</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1.25rem 0", textAlign: "left" }}>
                                {[
                                    { label: "Fatura No", value: result.invoiceNumber || "—", color: colors.accent },
                                    { label: "Toplam", value: result.totals ? fmtCurrency(result.totals.payableAmount) : "—", color: colors.green },
                                ].map((f) => (
                                    <div key={f.label} style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.85rem" }}>
                                        <p style={{ color: colors.dim, fontSize: "0.68rem", margin: 0 }}>{f.label}</p>
                                        <p style={{ color: f.color, fontSize: "0.92rem", fontWeight: 700, margin: "0.2rem 0 0" }}>{f.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <motion.button whileHover={{ scale: 1.02 }} onClick={() => { onClose(); resetForm(); }}
                                    style={{ flex: 1, background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.7rem", cursor: "pointer", color: colors.muted, fontWeight: 600 }}>
                                    Kapat
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} onClick={resetForm}
                                    style={{ ...buttonPrimary, flex: 1, padding: "0.7rem" }}>
                                    <FaPlus /> Yeni Belge
                                </motion.button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CreateInvoiceModal;
