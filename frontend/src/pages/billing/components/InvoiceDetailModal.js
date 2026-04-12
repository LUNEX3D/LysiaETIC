/**
 * Fatura Detay Modalı — Zengin belge görüntüleme
 * LysiaETIC
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaTimes, FaFileInvoiceDollar, FaBuilding, FaCalendarAlt, FaLink,
    FaCog, FaHashtag, FaClipboardList, FaFileInvoice, FaChevronDown,
    FaInfoCircle, FaEye, FaDownload, FaPrint, FaSpinner, FaExclamationTriangle,
} from "react-icons/fa";
import { colors, modalOverlay, modalContent } from "../styles";
import { StatusBadge, TypeBadge, Pill, DetailField } from "./SharedUI";
import { PROVIDERS } from "../constants";
import { fmtCurrency, fmtDate } from "../utils";

const InvoiceDetailModal = ({
    invoice,
    detailData,
    detailLoading,
    pdfLoading,
    onClose,
    onPreview,
    onDownload,
}) => {
    const [rawDataOpen, setRawDataOpen] = useState(false);
    const [linesOpen, setLinesOpen] = useState(true);

    if (!invoice) return null;

    // Veri kaynağını belirle
    const dbInv = detailData?.invoice;
    const dbOrder = detailData?.order;
    const hasDbData = !!dbInv;

    // Birleşik veri
    const invNo = (hasDbData ? dbInv.invoiceNumber : invoice.number) || invoice.faturaNo || "—";
    const invUuid = (hasDbData ? dbInv.uuid : invoice.id) || invoice.uuid || "";
    const invStatus = (hasDbData ? dbInv.status : invoice.status) || "";
    const invDate = (hasDbData ? dbInv.issueDate : invoice.date) || invoice.tarih || "";
    const invCurrency = (hasDbData ? dbInv.currency : invoice.currency) || "TRY";
    const invNote = (hasDbData ? dbInv.note : "") || "";

    // Profil & tip
    const profileId = (hasDbData ? dbInv.profileId : "") || "";
    const profileLabels = { EARSIVFATURA: "e-Arşiv Fatura", TICARIFATURA: "Ticari Fatura", TEMELFATURA: "Temel Fatura", IRSALIYE: "İrsaliye" };
    const invoiceTypeCode = (hasDbData ? dbInv.invoiceTypeCode : "") || "";
    const typeLabels = { SATIS: "Satış", IADE: "İade", TEVKIFAT: "Tevkifat", ISTISNA: "İstisna" };
    const invType = invoice.type || (profileId === "EARSIVFATURA" ? "e-arsiv" : "e-fatura");

    // Tutarlar
    const payable = hasDbData ? (dbInv.totals?.payableAmount || 0) : (invoice.total || invoice.tutar || 0);
    const subtotal = hasDbData ? (dbInv.totals?.lineExtensionAmount || 0) : (invoice.amount || 0);
    const tax = hasDbData ? (dbInv.totals?.totalTax || 0) : (invoice.tax || 0);
    const discount = hasDbData ? (dbInv.totals?.totalDiscount || 0) : 0;

    // Alıcı & Satıcı
    const custName = (hasDbData ? dbInv.customer?.name : invoice.customer) || invoice.aliciAdi || "—";
    const custVkn = (hasDbData ? dbInv.customer?.vkn : invoice.vkn) || invoice.aliciVkn || "";
    const custTaxOffice = (hasDbData ? dbInv.customer?.taxOffice : "") || "";
    const suppName = (hasDbData ? dbInv.supplier?.name : "") || "";
    const suppVkn = (hasDbData ? dbInv.supplier?.vkn : "") || "";
    const suppTaxOffice = (hasDbData ? dbInv.supplier?.taxOffice : "") || "";

    // Kalemler
    const lines = hasDbData ? (dbInv.lines || []) : [];

    // Sipariş & Sağlayıcı
    const orderNo = (hasDbData ? dbInv.orderNumber : "") || "";
    const marketplace = (hasDbData ? dbInv.marketplaceName : "") || "";
    const providerKey = (hasDbData ? dbInv.provider : invoice.provider) || "";
    const providerLabel = (PROVIDERS.find((p) => p.id === providerKey) || {}).name || providerKey || "—";
    const envLabel = (hasDbData ? dbInv.env : "") === "production" ? "Canlı" : "Test";
    const createdBy = (hasDbData ? dbInv.createdBy : "") || "";
    const createdByLabels = { auto: "Otomatik", manual: "Manuel", "batch-script": "Toplu İşlem" };

    // QNB yanıt
    const provResp = hasDbData ? dbInv.providerResponse : null;
    const faturaURL = (hasDbData ? dbInv.faturaURL : "") || "";
    const errorMsg = (hasDbData ? dbInv.errorMessage : "") || "";
    const createdAt = (hasDbData ? dbInv.createdAt : "") || "";
    const updatedAt = (hasDbData ? dbInv.updatedAt : "") || "";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ ...modalOverlay, background: "rgba(0,0,0,0.85)" }}
            >
                <motion.div
                    initial={{ scale: 0.92, y: 40 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 40 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...modalContent, maxWidth: 780, padding: "1.75rem" }}
                >
                    {/* ── Yükleniyor ── */}
                    {detailLoading && (
                        <div style={{ textAlign: "center", padding: "2rem" }}>
                            <FaSpinner style={{ animation: "spin 1s linear infinite", fontSize: "1.5rem", color: colors.accent }} />
                            <p style={{ color: colors.muted, marginTop: "0.75rem", fontSize: "0.85rem" }}>Fatura detayları yükleniyor...</p>
                        </div>
                    )}

                    {/* ── Header ── */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                                <FaFileInvoiceDollar style={{ color: colors.accent, fontSize: "1.1rem" }} />
                                <h3 style={{ color: "#fff", fontSize: "1.15rem", fontWeight: 800, margin: 0, fontFamily: "monospace" }}>{invNo}</h3>
                                <TypeBadge type={invType} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <StatusBadge status={invStatus} />
                                {profileId && <Pill color={colors.blue}>{profileLabels[profileId] || profileId}</Pill>}
                                {invoiceTypeCode && <Pill color={colors.orange}>{typeLabels[invoiceTypeCode] || invoiceTypeCode}</Pill>}
                                {createdBy && <Pill color={colors.dim}>{createdByLabels[createdBy] || createdBy}</Pill>}
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClose}
                            style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: colors.red, fontSize: "0.9rem", flexShrink: 0 }}
                        >
                            <FaTimes />
                        </motion.button>
                    </div>

                    {/* ── Hata Mesajı ── */}
                    {errorMsg && (
                        <div style={{ background: colors.red + "10", border: "1px solid " + colors.red + "30", borderRadius: 10, padding: "0.7rem 0.85rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FaExclamationTriangle style={{ color: colors.red, fontSize: "0.85rem", flexShrink: 0 }} />
                            <span style={{ color: colors.red, fontSize: "0.78rem", fontWeight: 600, wordBreak: "break-word" }}>{errorMsg}</span>
                        </div>
                    )}

                    {/* ── Tutar Kartı ── */}
                    <div style={{ background: "linear-gradient(135deg, " + colors.green + "08, " + colors.accent + "05)", border: "1px solid " + colors.green + "20", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" }}>
                        <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
                            <p style={{ color: colors.dim, fontSize: "0.72rem", fontWeight: 600, margin: "0 0 0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ödenecek Tutar</p>
                            <p style={{ color: colors.green, fontSize: "2rem", fontWeight: 800, margin: 0 }}>{payable > 0 ? fmtCurrency(payable) : "—"}</p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
                            {[
                                { label: "Ara Toplam (KDV Hariç)", value: fmtCurrency(subtotal), color: colors.text },
                                { label: "Toplam KDV", value: fmtCurrency(tax), color: colors.purple },
                                { label: "İndirim", value: discount > 0 ? fmtCurrency(discount) : "—", color: colors.yellow },
                                { label: "Para Birimi", value: invCurrency, color: colors.blue },
                            ].map((item, i) => (
                                <div key={i} style={{ textAlign: "center" }}>
                                    <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0 0 0.15rem", fontWeight: 600 }}>{item.label}</p>
                                    <p style={{ color: item.color, fontSize: "0.92rem", fontWeight: 700, margin: 0 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Alıcı & Satıcı ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ background: colors.accent + "06", border: "1px solid " + colors.accent + "18", borderRadius: 12, padding: "0.85rem" }}>
                            <p style={{ color: colors.accent, fontSize: "0.72rem", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <FaBuilding /> Satıcı
                            </p>
                            <p style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700, margin: "0 0 0.2rem" }}>{suppName || "—"}</p>
                            {suppVkn && <p style={{ color: colors.muted, fontSize: "0.75rem", margin: "0 0 0.15rem", fontFamily: "monospace" }}>VKN: {suppVkn}</p>}
                            {suppTaxOffice && <p style={{ color: colors.dim, fontSize: "0.72rem", margin: 0 }}>VD: {suppTaxOffice}</p>}
                        </div>
                        <div style={{ background: colors.orange + "06", border: "1px solid " + colors.orange + "18", borderRadius: 12, padding: "0.85rem" }}>
                            <p style={{ color: colors.orange, fontSize: "0.72rem", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <FaBuilding /> Alıcı
                            </p>
                            <p style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700, margin: "0 0 0.2rem" }}>{custName}</p>
                            {custVkn && <p style={{ color: colors.muted, fontSize: "0.75rem", margin: "0 0 0.15rem", fontFamily: "monospace" }}>VKN/TCKN: {custVkn}</p>}
                            {custTaxOffice && <p style={{ color: colors.dim, fontSize: "0.72rem", margin: 0 }}>VD: {custTaxOffice}</p>}
                        </div>
                    </div>

                    {/* ── Genel Bilgiler ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
                        <DetailField icon={<FaCalendarAlt />} label="Fatura Tarihi" value={fmtDate(invDate)} color={colors.blue} />
                        <DetailField icon={<FaLink />} label="Sağlayıcı" value={providerLabel} color={colors.green} />
                        <DetailField icon={<FaCog />} label="Ortam" value={envLabel} color={colors.dim} />
                        {invUuid && <DetailField icon={<FaHashtag />} label="UUID (ETTN)" value={invUuid} color={colors.purple} mono span2 />}
                        {orderNo && <DetailField icon={<FaClipboardList />} label="Sipariş No" value={orderNo} color={colors.yellow} />}
                        {marketplace && <DetailField icon={<FaBuilding />} label="Pazaryeri" value={marketplace} color={colors.orange} />}
                    </div>

                    {/* ── Sipariş Bilgisi ── */}
                    {dbOrder && (
                        <div style={{ background: colors.purple + "06", border: "1px solid " + colors.purple + "18", borderRadius: 12, padding: "0.85rem", marginBottom: "1rem" }}>
                            <p style={{ color: colors.purple, fontSize: "0.72rem", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <FaClipboardList /> İlişkili Sipariş
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
                                {[
                                    { label: "Sipariş No", value: dbOrder.orderNumber || "—" },
                                    { label: "Pazaryeri", value: dbOrder.marketplaceName || "—" },
                                    { label: "Durum", value: dbOrder.status || "—" },
                                    { label: "Tutar", value: dbOrder.totalPrice ? fmtCurrency(dbOrder.totalPrice) : "—" },
                                    { label: "Müşteri", value: [dbOrder.customerFirstName, dbOrder.customerLastName].filter(Boolean).join(" ") || "—" },
                                    { label: "Sipariş Tarihi", value: fmtDate(dbOrder.createdAt) },
                                ].map((f, i) => (
                                    <div key={i}>
                                        <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0 0 0.1rem", fontWeight: 600 }}>{f.label}</p>
                                        <p style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 600, margin: 0 }}>{f.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Fatura Kalemleri ── */}
                    {lines.length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                            <div onClick={() => setLinesOpen((p) => !p)}
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 0.85rem", background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: linesOpen ? "10px 10px 0 0" : 10, cursor: "pointer" }}>
                                <FaFileInvoice style={{ color: colors.accent, fontSize: "0.8rem" }} />
                                <span style={{ color: colors.muted, fontSize: "0.78rem", fontWeight: 700, flex: 1 }}>Fatura Kalemleri ({lines.length})</span>
                                <FaChevronDown style={{ color: colors.dim, fontSize: "0.7rem", transform: linesOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                            </div>
                            {linesOpen && (
                                <div style={{ border: "1px solid " + colors.glassBr, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "0.4fr 2.5fr 0.6fr 0.6fr 0.8fr 0.6fr 0.7fr 0.9fr", gap: "0.3rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)" }}>
                                        {["#", "Ürün / Hizmet", "Miktar", "Birim", "Birim Fiyat", "KDV %", "KDV", "Toplam"].map((h) => (
                                            <span key={h} style={{ color: colors.dim, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase" }}>{h}</span>
                                        ))}
                                    </div>
                                    {lines.map((line, idx) => (
                                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "0.4fr 2.5fr 0.6fr 0.6fr 0.8fr 0.6fr 0.7fr 0.9fr", gap: "0.3rem", padding: "0.5rem 0.75rem", borderTop: "1px solid rgba(255,255,255,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                                            <span style={{ color: colors.dim, fontSize: "0.75rem" }}>{idx + 1}</span>
                                            <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name || "—"}</span>
                                            <span style={{ color: colors.text, fontSize: "0.78rem" }}>{line.quantity}</span>
                                            <span style={{ color: colors.muted, fontSize: "0.75rem" }}>{line.unit}</span>
                                            <span style={{ color: colors.text, fontSize: "0.78rem", fontFamily: "monospace" }}>{fmtCurrency(line.unitPrice)}</span>
                                            <span style={{ color: colors.purple, fontSize: "0.78rem", fontWeight: 600 }}>%{line.vatRate}</span>
                                            <span style={{ color: colors.purple, fontSize: "0.78rem", fontFamily: "monospace" }}>{fmtCurrency(line.vatAmount)}</span>
                                            <span style={{ color: colors.green, fontSize: "0.78rem", fontWeight: 700, fontFamily: "monospace" }}>{fmtCurrency(line.lineTotal)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Not ── */}
                    {invNote && (
                        <div style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.75rem 0.85rem", marginBottom: "1rem" }}>
                            <p style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Not</p>
                            <p style={{ color: colors.text, fontSize: "0.8rem", margin: 0, lineHeight: 1.5 }}>{invNote}</p>
                        </div>
                    )}

                    {/* ── QNB Yanıt ── */}
                    {provResp && (provResp.resultCode || provResp.islemId) && (
                        <div style={{ background: colors.blue + "06", border: "1px solid " + colors.blue + "18", borderRadius: 12, padding: "0.85rem", marginBottom: "1rem" }}>
                            <p style={{ color: colors.blue, fontSize: "0.72rem", fontWeight: 700, margin: "0 0 0.5rem", textTransform: "uppercase" }}>QNB Yanıt Bilgileri</p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.4rem" }}>
                                {[
                                    provResp.resultCode && { label: "Sonuç Kodu", value: provResp.resultCode },
                                    provResp.resultText && { label: "Sonuç Mesajı", value: provResp.resultText },
                                    provResp.islemId && { label: "İşlem ID", value: provResp.islemId },
                                    { label: "İmzalı", value: provResp.signedDocument ? "Evet ✅" : "Hayır" },
                                ].filter(Boolean).map((f, i) => (
                                    <div key={i}>
                                        <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0 0 0.1rem", fontWeight: 600 }}>{f.label}</p>
                                        <p style={{ color: colors.text, fontSize: "0.75rem", fontWeight: 600, margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>{f.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Zaman Damgaları ── */}
                    {(createdAt || updatedAt) && (
                        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", padding: "0.5rem 0" }}>
                            {createdAt && (
                                <div>
                                    <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0 0 0.1rem", fontWeight: 600 }}>Oluşturulma</p>
                                    <p style={{ color: colors.muted, fontSize: "0.75rem", margin: 0 }}>{new Date(createdAt).toLocaleString("tr-TR")}</p>
                                </div>
                            )}
                            {updatedAt && (
                                <div>
                                    <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0 0 0.1rem", fontWeight: 600 }}>Son Güncelleme</p>
                                    <p style={{ color: colors.muted, fontSize: "0.75rem", margin: 0 }}>{new Date(updatedAt).toLocaleString("tr-TR")}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Ham Veri ── */}
                    {(invoice.raw || hasDbData) && (
                        <div style={{ marginBottom: "1.25rem" }}>
                            <div onClick={() => setRawDataOpen((p) => !p)}
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 0.85rem", background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: rawDataOpen ? "10px 10px 0 0" : 10, cursor: "pointer" }}>
                                <FaInfoCircle style={{ color: colors.accent, fontSize: "0.75rem" }} />
                                <span style={{ color: colors.muted, fontSize: "0.75rem", fontWeight: 600, flex: 1 }}>Ham Veri (API / DB Response)</span>
                                <FaChevronDown style={{ color: colors.dim, fontSize: "0.65rem", transform: rawDataOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                            </div>
                            {rawDataOpen && (
                                <pre style={{ background: "rgba(0,0,0,0.35)", border: "1px solid " + colors.glassBr, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0.85rem", margin: 0, color: colors.muted, fontSize: "0.68rem", lineHeight: 1.5, maxHeight: 280, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                    {JSON.stringify(hasDbData ? detailData : (invoice.raw || invoice), null, 2)}
                                </pre>
                            )}
                        </div>
                    )}

                    {/* ── Alt Butonlar ── */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {(faturaURL || (hasDbData && dbInv.uuid)) && (
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    if (hasDbData && dbInv._id) onDownload(dbInv._id, invNo);
                                    else if (faturaURL) window.open(faturaURL, "_blank");
                                    else if (invUuid) onPreview(invUuid);
                                }}
                                disabled={!!pdfLoading}
                                style={{ flex: 1, minWidth: 120, background: colors.accent + "15", border: "1px solid " + colors.accent + "30", borderRadius: 10, padding: "0.65rem", cursor: pdfLoading ? "not-allowed" : "pointer", color: colors.accent, fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", opacity: pdfLoading ? 0.6 : 1 }}>
                                {pdfLoading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaEye />} Önizleme
                            </motion.button>
                        )}
                        {hasDbData && dbInv._id && (
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => onDownload(dbInv._id, invNo)}
                                disabled={!!pdfLoading}
                                style={{ flex: 1, minWidth: 120, background: colors.blue + "15", border: "1px solid " + colors.blue + "30", borderRadius: 10, padding: "0.65rem", cursor: pdfLoading ? "not-allowed" : "pointer", color: colors.blue, fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", opacity: pdfLoading ? 0.6 : 1 }}>
                                {pdfLoading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaDownload />} İndir
                            </motion.button>
                        )}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                if (hasDbData && dbInv._id) onDownload(dbInv._id, invNo);
                                else if (faturaURL) { const w = window.open(faturaURL, "_blank"); if (w) setTimeout(() => { try { w.print(); } catch {} }, 2000); }
                            }}
                            style={{ flex: 1, minWidth: 100, background: colors.muted + "15", border: "1px solid " + colors.muted + "30", borderRadius: 10, padding: "0.65rem", cursor: "pointer", color: colors.muted, fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                            <FaPrint /> Yazdır
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={onClose}
                            style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 10, padding: "0.65rem 1.25rem", cursor: "pointer", color: colors.dim, fontSize: "0.82rem", fontWeight: 600 }}>
                            Kapat
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default InvoiceDetailModal;
