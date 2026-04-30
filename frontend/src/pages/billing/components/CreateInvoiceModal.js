/**
 * Yeni Fatura Oluşturma Modalı
 * LysiaETIC
 *
 * 3 adımlı wizard: Tip Seçimi → Form → Sonuç
 */
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaTimes, FaPlus, FaArrowRight, FaFileInvoice, FaFileInvoiceDollar,
    FaTruck, FaDownload, FaSpinner, FaExclamationTriangle,
    FaLink, FaBuilding, FaClipboardList,
} from "react-icons/fa";
import { colors, modalOverlay, modalContent, buttonPrimary, inputStyle as baseInputStyle, labelStyle as baseLabelStyle } from "../styles";
import { fmtCurrency, calcInvoiceLines } from "../utils";
import { DEFAULT_INVOICE_FORM, UNIT_OPTIONS, VAT_RATES } from "../constants";

const CreateInvoiceModal = ({ isConnected, activeProvider, onCreateInvoice, onClose, onGoToProviders }) => {
    const [step, setStep] = useState(1);
    const [createType, setCreateType] = useState("e-arsiv");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_INVOICE_FORM });

    const setF = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));
    const setLine = (idx, key, val) => {
        const newLines = [...form.lines];
        newLines[idx] = { ...newLines[idx], [key]: val };
        setF("lines", newLines);
    };
    const addLine = () => setF("lines", [...form.lines, { name: "", quantity: 1, unit: "adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }]);
    const removeLine = (idx) => { if (form.lines.length > 1) setF("lines", form.lines.filter((_, i) => i !== idx)); };

    const { calculated, subTotal, totalVat, grandTotal } = useMemo(() => calcInvoiceLines(form.lines), [form.lines]);

    const inputStyle = { ...baseInputStyle, borderRadius: 8, padding: "0.55rem 0.75rem" };
    const labelStyle = { ...baseLabelStyle, fontSize: "0.72rem", marginBottom: "0.25rem" };
    const optionStyle = { background: "#1a1f35" };

    const resetForm = () => {
        setStep(1);
        setError("");
        setResult(null);
        setForm({ ...DEFAULT_INVOICE_FORM });
    };

    const handleSubmit = async () => {
        setError("");
        if (!form.customerName && !form.customerVkn) { setError("Alıcı adı veya VKN/TCKN gerekli"); return; }
        if (form.lines.some((l) => !l.name || !l.unitPrice)) { setError("Tüm kalemlerde ürün adı ve birim fiyat gerekli"); return; }

        setLoading(true);
        try {
            const customerIsIndividual = (form.customerVkn || "").length === 11;
            const invoiceData = {
                invoiceTypeCode: "SATIS",
                currency: form.currency || "TRY",
                note: form.note || "",
                sendingType: form.sendingType || "ELEKTRONIK",
                supplier: {
                    vkn: activeProvider?.vkn || activeProvider?.supplierVkn || "",
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
                    firstName: customerIsIndividual ? (form.customerFirstName || form.customerName.split(" ")[0] || "") : "",
                    lastName: customerIsIndividual ? (form.customerLastName || form.customerName.split(" ").slice(1).join(" ") || "") : "",
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
                    unit: l.unit || "adet",
                    unitPrice: Number(l.unitPrice || 0),
                    vatRate: Number(l.vatRate != null ? l.vatRate : 20),
                    discountAmount: Number(l.discountAmount || 0),
                })),
            };

            const res = await onCreateInvoice(activeProvider, invoiceData);
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
        { id: "e-arsiv", label: "e-Arşiv Fatura", icon: <FaFileInvoice />, desc: "Bireysel müşteriler için", color: colors.accent },
        { id: "e-fatura", label: "e-Fatura", icon: <FaFileInvoiceDollar />, desc: "Tüzel kişiler için", color: colors.orange },
        { id: "e-irsaliye", label: "e-İrsaliye", icon: <FaTruck />, desc: "Sevk irsaliyesi", color: colors.pink },
        { id: "e-fatura-gelen", label: "Gelen e-Fatura", icon: <FaDownload />, desc: "Gelen faturaları görüntüle", color: colors.purple },
    ];

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
                    style={{ ...modalContent, maxWidth: step === 2 ? 780 : 600 }}
                >
                    {/* ── Header ── */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {step > 1 && step < 3 && (
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => { setStep(step - 1); setError(""); }}
                                    style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer", color: colors.accent, fontSize: "0.75rem" }}>
                                    ← Geri
                                </motion.button>
                            )}
                            <h3 style={{ background: "linear-gradient(135deg, " + colors.accent + ", " + colors.purple + ")", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "1.15rem", fontWeight: 800, margin: 0 }}>
                                {step === 1 ? "📄 Yeni Belge Oluştur" : step === 2 ? "📝 Fatura Bilgileri" : "✅ Fatura Oluşturuldu"}
                            </h3>
                        </div>
                        <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                            onClick={() => { if (!loading) { onClose(); resetForm(); } }}
                            style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: colors.red, fontSize: "0.9rem" }}>
                            <FaTimes />
                        </motion.button>
                    </div>

                    {/* ── Adım Göstergesi ── */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                        {[1, 2, 3].map((s) => (
                            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? colors.accent : colors.glass, transition: "background 0.3s" }} />
                        ))}
                    </div>

                    {/* ═══ ADIM 1: TİP SEÇİMİ ═══ */}
                    {step === 1 && (
                        <>
                            <label style={{ ...labelStyle, fontSize: "0.78rem" }}>Belge Tipi</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.5rem" }}>
                                {docTypes.map((t) => (
                                    <motion.button key={t.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={() => setCreateType(t.id)}
                                        style={{ background: createType === t.id ? t.color + "15" : colors.glass, border: createType === t.id ? "2px solid " + t.color : "1px solid " + colors.glassBr, borderRadius: 12, padding: "1rem", cursor: "pointer", textAlign: "left" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                                            <span style={{ color: t.color, fontSize: "1rem" }}>{t.icon}</span>
                                            <span style={{ color: createType === t.id ? t.color : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>{t.label}</span>
                                        </div>
                                        <p style={{ color: colors.dim, fontSize: "0.7rem", margin: 0 }}>{t.desc}</p>
                                    </motion.button>
                                ))}
                            </div>
                            {!isConnected ? (
                                <div style={{ background: colors.yellow + "10", border: "1px solid " + colors.yellow + "30", borderRadius: 12, padding: "1.25rem", textAlign: "center" }}>
                                    <FaExclamationTriangle style={{ color: colors.yellow, fontSize: "1.5rem", marginBottom: "0.5rem" }} />
                                    <p style={{ color: colors.yellow, fontSize: "0.88rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Sağlayıcı Bağlantısı Gerekli</p>
                                    <p style={{ color: colors.muted, fontSize: "0.78rem", margin: "0 0 0.75rem" }}>Belge oluşturmak için önce bir e-Fatura sağlayıcısı bağlamanız gerekiyor.</p>
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => { onClose(); resetForm(); if (onGoToProviders) onGoToProviders(); }}
                                        style={{ ...buttonPrimary, display: "inline-flex" }}>
                                        <FaLink /> Sağlayıcı Bağla
                                    </motion.button>
                                </div>
                            ) : (
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setStep(2)}
                                    style={{ ...buttonPrimary, width: "100%", padding: "0.75rem", fontSize: "0.88rem" }}>
                                    <FaArrowRight /> Devam Et
                                </motion.button>
                            )}
                        </>
                    )}

                    {/* ═══ ADIM 2: FATURA FORMU ═══ */}
                    {step === 2 && (
                        <>
                            {/* Alıcı Bilgileri */}
                            <div style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 14, padding: "1.15rem", marginBottom: "1rem" }}>
                                <h4 style={{ color: colors.accent, fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <FaBuilding /> Alıcı Bilgileri
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label style={labelStyle}>VKN / TCKN *</label>
                                        <input value={form.customerVkn} onChange={(e) => setF("customerVkn", e.target.value)} placeholder="10 veya 11 haneli" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Firma / Kişi Adı *</label>
                                        <input value={form.customerName} onChange={(e) => setF("customerName", e.target.value)} placeholder="Alıcı adı" style={inputStyle} />
                                    </div>
                                    {(form.customerVkn || "").length === 11 && (
                                        <>
                                            <div>
                                                <label style={labelStyle}>Ad</label>
                                                <input value={form.customerFirstName} onChange={(e) => setF("customerFirstName", e.target.value)} placeholder="Ad" style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Soyad</label>
                                                <input value={form.customerLastName} onChange={(e) => setF("customerLastName", e.target.value)} placeholder="Soyad" style={inputStyle} />
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <label style={labelStyle}>Vergi Dairesi</label>
                                        <input value={form.customerTaxOffice} onChange={(e) => setF("customerTaxOffice", e.target.value)} placeholder="Vergi dairesi" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>İl</label>
                                        <input value={form.customerCity} onChange={(e) => setF("customerCity", e.target.value)} placeholder="İl" style={inputStyle} />
                                    </div>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <label style={labelStyle}>Adres</label>
                                        <input value={form.customerStreet} onChange={(e) => setF("customerStreet", e.target.value)} placeholder="Sokak / Cadde / No" style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Fatura Kalemleri */}
                            <div style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 14, padding: "1.15rem", marginBottom: "1rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                                    <h4 style={{ color: colors.accent, fontSize: "0.88rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <FaClipboardList /> Fatura Kalemleri
                                    </h4>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addLine}
                                        style={{ background: colors.accent + "15", border: "1px solid " + colors.accent + "30", borderRadius: 8, padding: "0.3rem 0.7rem", cursor: "pointer", color: colors.accent, fontSize: "0.72rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                        <FaPlus /> Kalem Ekle
                                    </motion.button>
                                </div>

                                {form.lines.map((line, idx) => (
                                    <div key={idx} style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.75rem", marginBottom: "0.5rem" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.7fr 0.7fr 1fr 0.7fr 0.3fr", gap: "0.5rem", alignItems: "end" }}>
                                            <div>
                                                <label style={labelStyle}>Ürün/Hizmet *</label>
                                                <input value={line.name} onChange={(e) => setLine(idx, "name", e.target.value)} placeholder="Ürün adı" style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Miktar</label>
                                                <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLine(idx, "quantity", e.target.value)} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Birim</label>
                                                <select value={line.unit} onChange={(e) => setLine(idx, "unit", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                                    {UNIT_OPTIONS.map((u) => <option key={u} value={u} style={optionStyle}>{u}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Birim Fiyat (₺) *</label>
                                                <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => setLine(idx, "unitPrice", e.target.value)} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>KDV %</label>
                                                <select value={line.vatRate} onChange={(e) => setLine(idx, "vatRate", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                                    {VAT_RATES.map((r) => <option key={r} value={r} style={optionStyle}>%{r}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                {form.lines.length > 1 && (
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeLine(idx)}
                                                        style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: 6, padding: "0.45rem", cursor: "pointer", color: colors.red, fontSize: "0.75rem", display: "flex", width: "100%", justifyContent: "center" }}>
                                                        <FaTimes />
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.4rem", paddingTop: "0.35rem", borderTop: "1px solid " + colors.glassBr }}>
                                            <span style={{ color: colors.dim, fontSize: "0.68rem" }}>Tutar: {fmtCurrency(calculated[idx]?.lineTotal || 0)}</span>
                                            <span style={{ color: colors.purple, fontSize: "0.68rem" }}>KDV: {fmtCurrency(calculated[idx]?.vat || 0)}</span>
                                            <span style={{ color: colors.green, fontSize: "0.68rem", fontWeight: 700 }}>Toplam: {fmtCurrency(calculated[idx]?.total || 0)}</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Genel Toplam */}
                                <div style={{ background: colors.green + "08", border: "1px solid " + colors.green + "25", borderRadius: 10, padding: "0.85rem", marginTop: "0.75rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                        <div style={{ textAlign: "center", flex: 1 }}>
                                            <p style={{ color: colors.dim, fontSize: "0.68rem", margin: 0 }}>Ara Toplam</p>
                                            <p style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700, margin: "0.15rem 0 0" }}>{fmtCurrency(subTotal)}</p>
                                        </div>
                                        <div style={{ textAlign: "center", flex: 1 }}>
                                            <p style={{ color: colors.dim, fontSize: "0.68rem", margin: 0 }}>KDV Toplam</p>
                                            <p style={{ color: colors.purple, fontSize: "0.95rem", fontWeight: 700, margin: "0.15rem 0 0" }}>{fmtCurrency(totalVat)}</p>
                                        </div>
                                        <div style={{ textAlign: "center", flex: 1 }}>
                                            <p style={{ color: colors.dim, fontSize: "0.68rem", margin: 0 }}>Genel Toplam</p>
                                            <p style={{ color: colors.green, fontSize: "1.15rem", fontWeight: 800, margin: "0.15rem 0 0" }}>{fmtCurrency(grandTotal)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Not */}
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={labelStyle}>Fatura Notu (opsiyonel)</label>
                                <input value={form.note} onChange={(e) => setF("note", e.target.value)} placeholder="Fatura ile ilgili not..." style={inputStyle} />
                            </div>

                            {/* Hata */}
                            {error && (
                                <div style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: 10, padding: "0.6rem 0.85rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FaExclamationTriangle style={{ color: colors.red, flexShrink: 0 }} />
                                    <span style={{ color: colors.red, fontSize: "0.8rem" }}>{error}</span>
                                </div>
                            )}

                            {/* Gönder */}
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={handleSubmit} disabled={loading}
                                style={{ ...buttonPrimary, width: "100%", padding: "0.85rem", fontSize: "0.92rem", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                                {loading ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Fatura Oluşturuluyor...</> : <><FaFileInvoice /> Fatura Oluştur ({fmtCurrency(grandTotal)})</>}
                            </motion.button>
                        </>
                    )}

                    {/* ═══ ADIM 3: SONUÇ ═══ */}
                    {step === 3 && result && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
                            <h3 style={{ color: colors.green, fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>Fatura Başarıyla Oluşturuldu!</h3>
                            <p style={{ color: colors.muted, fontSize: "0.85rem", margin: "0 0 1.5rem" }}>Faturanız başarıyla oluşturuldu ve imzalandı.</p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem", textAlign: "left" }}>
                                {[
                                    { label: "Fatura No", value: result.invoiceNumber || "—", color: colors.accent },
                                    { label: "UUID", value: (result.uuid || "—").substring(0, 18) + "...", color: colors.blue },
                                    { label: "Toplam Tutar", value: result.totals ? fmtCurrency(result.totals.payableAmount) : "—", color: colors.green },
                                    { label: "KDV", value: result.totals ? fmtCurrency(result.totals.totalTax) : "—", color: colors.purple },
                                ].map((f) => (
                                    <div key={f.label} style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.85rem" }}>
                                        <p style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 600, margin: "0 0 0.2rem" }}>{f.label}</p>
                                        <p style={{ color: f.color, fontSize: "0.92rem", fontWeight: 700, margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>{f.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => { onClose(); resetForm(); }}
                                    style={{ flex: 1, background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.7rem", cursor: "pointer", color: colors.muted, fontSize: "0.85rem", fontWeight: 600 }}>
                                    Kapat
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={resetForm}
                                    style={{ ...buttonPrimary, flex: 1, padding: "0.7rem", fontSize: "0.85rem" }}>
                                    <FaPlus /> Yeni Fatura Oluştur
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
