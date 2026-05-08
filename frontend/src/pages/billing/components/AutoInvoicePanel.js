/**
 * Otomatik Fatura Paneli
 * LysiaETIC
 *
 * Otomatik fatura ayarları, QNB fatura listesi, toplu faturalama.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
    FaSyncAlt, FaCog, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
    FaFileInvoice, FaCalendarAlt, FaMoneyBillWave, FaSpinner, FaSearch,
    FaInfoCircle, FaChartPie, FaEye, FaDownload, FaTimes, FaBuilding,
    FaLink, FaClipboardList,
} from "react-icons/fa";
import { colors, buttonPrimary, buttonSecondary, inputStyle as baseInputStyle, labelStyle as baseLabelStyle, sectionTitleStyle } from "../styles";
import { GlassCard, EmptyState, LoadingState, AlertBox, SpinnerButton } from "./SharedUI";
import { ALL_MARKETPLACES, ALL_TRIGGER_STATUSES } from "../constants";
import { fmtCurrency, fmtDate } from "../utils";

const AutoInvoicePanel = ({ autoInvoice, settingsRequestTick = 0 }) => {
    const {
        config, stats, loading, saving, error,
        fetchData, saveConfig, toggleEnabled, resetErrors, buildConfigForm,
        qnbInvoices, qnbLoading, qnbPagination, fetchQnbInvoices,
        previewQnbInvoice, downloadInvoicePdf,
        processLoading, processResult, processAll,
        clearError, clearProcessResult,
    } = autoInvoice;

    const [showConfigForm, setShowConfigForm] = useState(false);
    const [configForm, setConfigForm] = useState(null);
    const [qnbSearchQuery, setQnbSearchQuery] = useState("");
    // Varsayılan tarih aralığı: son 30 gün
    const [qnbDateRange, setQnbDateRange] = useState(() => {
        const now = new Date();
        const ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: ago.toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
    });
    const [pdfLoading, setPdfLoading] = useState(null);
    const [qnbAutoLoaded, setQnbAutoLoaded] = useState(false);

    const cfg = config || {};
    const st = stats || {};
    const isEnabled = cfg.enabled || false;
    const hasConfig = !!(cfg.supplier && cfg.supplier.vkn);
    const consecutiveErrors = cfg.stats?.consecutiveErrors || 0;

    // İlk yüklemede verileri çek
    useEffect(() => {
        if (!config) fetchData();
    }, [config, fetchData]);

    // Config yüklenince QNB faturalarını otomatik yükle (tek seferlik)
    useEffect(() => {
        if (hasConfig && !qnbAutoLoaded && qnbInvoices.length === 0 && !qnbLoading) {
            setQnbAutoLoaded(true);
            fetchQnbInvoices("", qnbDateRange.start, qnbDateRange.end, 1);
        }
    }, [hasConfig, qnbAutoLoaded, qnbInvoices.length, qnbLoading, fetchQnbInvoices, qnbDateRange]);

    const settingsTickHandledRef = useRef(0);
    useEffect(() => {
        if (!settingsRequestTick || settingsRequestTick <= settingsTickHandledRef.current) return;
        settingsTickHandledRef.current = settingsRequestTick;
        setConfigForm(buildConfigForm());
        setShowConfigForm(true);
    }, [settingsRequestTick, buildConfigForm]);

    const initConfigForm = useCallback(() => {
        setConfigForm(buildConfigForm());
    }, [buildConfigForm]);

    const handleSaveConfig = async () => {
        if (!configForm) return;
        const result = await saveConfig(configForm);
        if (result.success) setShowConfigForm(false);
    };

    const handlePreview = async (uuid, faturaURL) => {
        // faturaURL varsa doğrudan aç — en güvenilir yöntem
        if (faturaURL) {
            window.open(faturaURL, "_blank");
            return;
        }
        setPdfLoading(uuid);
        const result = await previewQnbInvoice(uuid);
        setPdfLoading(null);
        if (result.error) clearError();
    };

    const handleDownload = async (id, number, faturaURL) => {
        // faturaURL varsa doğrudan aç
        if (faturaURL) {
            window.open(faturaURL, "_blank");
            return;
        }
        setPdfLoading(id);
        await downloadInvoicePdf(id, number);
        setPdfLoading(null);
    };

    const handleQnbSearch = () => {
        fetchQnbInvoices(qnbSearchQuery, qnbDateRange.start, qnbDateRange.end, 1);
    };

    // ── Config Form Helpers ──
    const updateField = (path, value) => {
        setConfigForm((prev) => {
            const copy = JSON.parse(JSON.stringify(prev));
            const keys = path.split(".");
            let obj = copy;
            for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
            obj[keys[keys.length - 1]] = value;
            return copy;
        });
    };

    const toggleArrayItem = (path, item) => {
        setConfigForm((prev) => {
            const copy = JSON.parse(JSON.stringify(prev));
            const keys = path.split(".");
            let obj = copy;
            for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
            const arr = obj[keys[keys.length - 1]] || [];
            const idx = arr.indexOf(item);
            if (idx >= 0) arr.splice(idx, 1);
            else arr.push(item);
            obj[keys[keys.length - 1]] = arr;
            return copy;
        });
    };

    const inputStyle = { ...baseInputStyle };
    const labelStyle = { ...baseLabelStyle };

    // ── Yükleniyor ──
    if (loading && !config) {
        return <LoadingState message="Yükleniyor..." />;
    }

    // ═══════════════════════════════════════════════════════
    // AYAR FORMU
    // ═══════════════════════════════════════════════════════
    if (showConfigForm && configForm) {
        const fd = configForm;
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                    <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>⚙️ Otomatik Fatura Ayarları</h3>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setShowConfigForm(false)}
                        style={{ ...buttonSecondary, padding: "0.5rem 0.9rem", fontSize: "0.8rem" }}>
                        <FaTimes /> Geri
                    </motion.button>
                </div>

                <GlassCard animate={false}>
                    {/* Firma Bilgileri */}
                    <h4 style={sectionTitleStyle}><FaBuilding style={{ color: colors.accent }} /> Firma Bilgileri (Satıcı)</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>VKN / TCKN *</label><input style={inputStyle} value={fd.supplier.vkn} onChange={(e) => updateField("supplier.vkn", e.target.value)} placeholder="10 veya 11 haneli" /></div>
                        <div><label style={labelStyle}>Firma Adı *</label><input style={inputStyle} value={fd.supplier.name} onChange={(e) => updateField("supplier.name", e.target.value)} placeholder="Firma ünvanı" /></div>
                        <div><label style={labelStyle}>Vergi Dairesi</label><input style={inputStyle} value={fd.supplier.taxOffice} onChange={(e) => updateField("supplier.taxOffice", e.target.value)} placeholder="Vergi dairesi adı" /></div>
                        <div><label style={labelStyle}>Adres</label><input style={inputStyle} value={fd.supplier.street} onChange={(e) => updateField("supplier.street", e.target.value)} placeholder="Cadde/Sokak" /></div>
                        <div><label style={labelStyle}>İlçe</label><input style={inputStyle} value={fd.supplier.district} onChange={(e) => updateField("supplier.district", e.target.value)} placeholder="İlçe" /></div>
                        <div><label style={labelStyle}>İl</label><input style={inputStyle} value={fd.supplier.city} onChange={(e) => updateField("supplier.city", e.target.value)} placeholder="İl" /></div>
                        <div><label style={labelStyle}>Telefon</label><input style={inputStyle} value={fd.supplier.phone} onChange={(e) => updateField("supplier.phone", e.target.value)} placeholder="05xx xxx xxxx" /></div>
                        <div><label style={labelStyle}>E-posta</label><input style={inputStyle} value={fd.supplier.email} onChange={(e) => updateField("supplier.email", e.target.value)} placeholder="firma@ornek.com" /></div>
                    </div>

                    {/* QNB Bağlantı */}
                    <h4 style={{ ...sectionTitleStyle, marginTop: "1.5rem" }}><FaLink style={{ color: colors.purple }} /> QNB eSolutions Bağlantısı</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>e-Arşiv Kullanıcı Adı *</label><input style={inputStyle} value={fd.qnbCredentials.earsivUsername} onChange={(e) => { updateField("qnbCredentials.earsivUsername", e.target.value); updateField("qnbCredentials.username", e.target.value); }} placeholder="VKN.portaltest" /></div>
                        <div><label style={labelStyle}>e-Arşiv Şifre *</label><input style={inputStyle} type="password" value={fd.qnbCredentials.earsivPassword} onChange={(e) => { updateField("qnbCredentials.earsivPassword", e.target.value); updateField("qnbCredentials.password", e.target.value); }} placeholder="••••••" /></div>
                        <div>
                            <label style={labelStyle}>Ortam</label>
                            <select style={{ ...inputStyle, cursor: "pointer" }} value={fd.qnbCredentials.env} onChange={(e) => updateField("qnbCredentials.env", e.target.value)}>
                                <option value="test">Test Ortamı</option>
                                <option value="production">Canlı Ortam</option>
                            </select>
                        </div>
                        <div><label style={labelStyle}>e-Fatura Kullanıcı Adı</label><input style={inputStyle} value={fd.qnbCredentials.efaturaUsername} onChange={(e) => updateField("qnbCredentials.efaturaUsername", e.target.value)} placeholder="VKN (opsiyonel — B2B için)" /></div>
                        <div><label style={labelStyle}>e-Fatura Şifre</label><input style={inputStyle} type="password" value={fd.qnbCredentials.efaturaPassword} onChange={(e) => updateField("qnbCredentials.efaturaPassword", e.target.value)} placeholder="••••••" /></div>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: colors.textMuted, marginTop: "0.4rem", lineHeight: 1.5 }}>
                        💡 e-Arşiv: Bireysel müşterilere fatura kesmek için (zorunlu). e-Fatura: Kurumsal (B2B) müşteriler için (opsiyonel).
                    </p>

                    {/* Fatura Ayarları */}
                    <h4 style={{ ...sectionTitleStyle, marginTop: "1.5rem" }}><FaFileInvoice style={{ color: colors.green }} /> Fatura Ayarları</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>Fatura Seri Kodu</label><input style={inputStyle} value={fd.invoiceSeriesCode} onChange={(e) => updateField("invoiceSeriesCode", e.target.value)} placeholder="LYS" maxLength={3} /></div>
                        <div><label style={labelStyle}>Varsayılan KDV (%)</label><input style={inputStyle} type="number" value={fd.defaultVatRate} onChange={(e) => updateField("defaultVatRate", Number(e.target.value))} min={0} max={100} /></div>
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <label style={labelStyle}>Fiyatlar KDV Dahil mi?</label>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => updateField("pricesIncludeVat", !fd.pricesIncludeVat)}
                                style={{ background: fd.pricesIncludeVat ? colors.green + "20" : colors.red + "20", border: "1px solid " + (fd.pricesIncludeVat ? colors.green + "50" : colors.red + "50"), borderRadius: 8, padding: "0.55rem 0.85rem", cursor: "pointer", color: fd.pricesIncludeVat ? colors.green : colors.red, fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>
                                {fd.pricesIncludeVat ? "✓ Evet — KDV Dahil" : "✗ Hayır — KDV Hariç"}
                            </motion.button>
                        </div>
                        <div>
                            <label style={labelStyle}>Belge Tipi</label>
                            <select style={{ ...inputStyle, cursor: "pointer" }} value={fd.documentType} onChange={(e) => updateField("documentType", e.target.value)}>
                                <option value="EARSIVFATURA">e-Arşiv Fatura</option>
                                <option value="TICARIFATURA">Ticari Fatura</option>
                                <option value="TEMELFATURA">Temel Fatura</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Fatura Notu</label><input style={inputStyle} value={fd.defaultNote} onChange={(e) => updateField("defaultNote", e.target.value)} placeholder="Faturaya eklenecek not (opsiyonel)" /></div>
                    </div>

                    {/* Varsayılan Alıcı */}
                    <h4 style={{ ...sectionTitleStyle, marginTop: "1.5rem" }}><FaBuilding style={{ color: colors.orange }} /> Varsayılan Alıcı</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>TCKN / VKN</label><input style={inputStyle} value={fd.defaultCustomer.vkn} onChange={(e) => updateField("defaultCustomer.vkn", e.target.value)} placeholder="11 haneli TCKN" /></div>
                        <div><label style={labelStyle}>Ad</label><input style={inputStyle} value={fd.defaultCustomer.firstName} onChange={(e) => updateField("defaultCustomer.firstName", e.target.value)} placeholder="Ad" /></div>
                        <div><label style={labelStyle}>Soyad</label><input style={inputStyle} value={fd.defaultCustomer.lastName} onChange={(e) => updateField("defaultCustomer.lastName", e.target.value)} placeholder="Soyad" /></div>
                        <div><label style={labelStyle}>İl</label><input style={inputStyle} value={fd.defaultCustomer.city} onChange={(e) => updateField("defaultCustomer.city", e.target.value)} placeholder="İl" /></div>
                    </div>

                    {/* Fatura Başlangıç Tarihi */}
                    <h4 style={{ ...sectionTitleStyle, marginTop: "1.5rem" }}><FaCalendarAlt style={{ color: colors.yellow }} /> Fatura Başlangıç Tarihi</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div>
                            <label style={labelStyle}>Bu tarihten önceki siparişler faturalanmaz</label>
                            <input style={inputStyle} type="date" value={fd.autoInvoiceStartDate} onChange={(e) => updateField("autoInvoiceStartDate", e.target.value)} />
                        </div>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: colors.textMuted, marginTop: "0.4rem", lineHeight: 1.5 }}>
                        ⚠️ <strong>Mükerrer fatura koruması:</strong> Sistemi aktif etmeden önce manuel kestiğiniz faturaların tekârar kesilmesini engeller.
                        Bu tarihten önceki siparişler otomatik faturalama ve "Tümünü Faturala" işlemlerinde atlanır.
                        İlk kurulumda otomatik olarak bugünün tarihi atanır. Gerekirse değiştirebilirsiniz.
                    </p>

                    {/* Tetikleme Ayarları */}
                    <h4 style={{ ...sectionTitleStyle, marginTop: "1.5rem" }}><FaClipboardList style={{ color: colors.blue }} /> Tetikleme Ayarları</h4>
                    <div style={{ marginBottom: "1rem" }}>
                        <label style={labelStyle}>Aktif Pazaryerleri <span style={{ color: colors.dim, fontWeight: 400 }}>(boş = tümü)</span></label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.35rem" }}>
                            {ALL_MARKETPLACES.map((mp) => {
                                const active = fd.enabledMarketplaces.includes(mp);
                                return (
                                    <motion.button key={mp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleArrayItem("enabledMarketplaces", mp)}
                                        style={{ background: active ? colors.accent + "20" : colors.glass, border: "1px solid " + (active ? colors.accent + "50" : colors.glassBr), borderRadius: 8, padding: "0.4rem 0.85rem", cursor: "pointer", color: active ? colors.accent : colors.dim, fontSize: "0.78rem", fontWeight: 600 }}>
                                        {active ? "✓ " : ""}{mp}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Tetikleme Durumları</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.35rem" }}>
                            {ALL_TRIGGER_STATUSES.map((s) => {
                                const active = fd.triggerStatuses.includes(s);
                                return (
                                    <motion.button key={s} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleArrayItem("triggerStatuses", s)}
                                        style={{ background: active ? colors.green + "20" : colors.glass, border: "1px solid " + (active ? colors.green + "50" : colors.glassBr), borderRadius: 8, padding: "0.4rem 0.85rem", cursor: "pointer", color: active ? colors.green : colors.dim, fontSize: "0.78rem", fontWeight: 600 }}>
                                        {active ? "✓ " : ""}{s}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
                        <div>
                            <label style={labelStyle}>Otomatik kesim gecikmesi (gün)</label>
                            <input
                                style={inputStyle}
                                type="number"
                                min={0}
                                max={90}
                                value={fd.invoiceDelayDays}
                                onChange={(e) => updateField("invoiceDelayDays", Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                            />
                            <p style={{ fontSize: "0.72rem", color: colors.textMuted, marginTop: "0.35rem", lineHeight: 1.5 }}>
                                Sipariş tarihinden sonra bu kadar tam gün geçmeden otomatik kesilmez (0 = bekleme yok). Çok kullanıcı, &quot;Seçili / Tümünü faturala&quot; ve senkron sonrası manuel işlemlerde gecikme uygulanmaz.
                            </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                            <label style={labelStyle}>Pazaryeri fatura yüklemesi</label>
                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => updateField("autoUploadInvoiceToMarketplace", !fd.autoUploadInvoiceToMarketplace)}
                                style={{
                                    background: fd.autoUploadInvoiceToMarketplace ? colors.accent + "20" : colors.glass,
                                    border: "1px solid " + (fd.autoUploadInvoiceToMarketplace ? colors.accent + "50" : colors.glassBr),
                                    borderRadius: 8,
                                    padding: "0.55rem 0.85rem",
                                    cursor: "pointer",
                                    color: fd.autoUploadInvoiceToMarketplace ? colors.accent : colors.dim,
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    textAlign: "left",
                                }}
                            >
                                {fd.autoUploadInvoiceToMarketplace ? "✓ Açık (hazırlık)" : "✗ Kapalı"}
                            </motion.button>
                            <p style={{ fontSize: "0.72rem", color: colors.textMuted, marginTop: "0.35rem", lineHeight: 1.5 }}>
                                Pazaryeri API entegrasyonu tamamlandığında faturalar otomatik yüklenecek; şu an yalnızca tercih kaydı tutulur.
                            </p>
                        </div>
                    </div>

                    {/* Kaydet */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setShowConfigForm(false)}
                            style={{ ...buttonSecondary }}>
                            İptal
                        </motion.button>
                        <SpinnerButton
                            onClick={handleSaveConfig}
                            loading={saving}
                            disabled={!fd.supplier.vkn || !fd.supplier.name}
                            loadingText="Kaydediliyor..."
                            style={{ ...buttonPrimary, padding: "0.65rem 1.5rem", opacity: (!fd.supplier.vkn || !fd.supplier.name) ? 0.5 : 1, cursor: (!fd.supplier.vkn || !fd.supplier.name) ? "not-allowed" : "pointer" }}>
                            <FaCheckCircle /> Kaydet
                        </SpinnerButton>
                    </div>
                </GlassCard>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════
    // ANA PANEL
    // ═══════════════════════════════════════════════════════
    return (
        <div>
            {/* Başlık + Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <FaSyncAlt style={{ color: colors.accent }} /> Otomatik Fatura Kesme
                    </h3>
                    <p style={{ color: colors.dim, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                        Pazaryerinden sipariş geldiğinde otomatik e-Arşiv fatura kesilir
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { initConfigForm(); setShowConfigForm(true); }}
                        style={{ ...buttonSecondary, padding: "0.6rem 1.1rem" }}>
                        <FaCog /> Ayarlar
                    </motion.button>
                    {hasConfig && (
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={toggleEnabled}
                            style={{ background: isEnabled ? colors.green + "20" : colors.red + "20", border: "1px solid " + (isEnabled ? colors.green + "50" : colors.red + "50"), borderRadius: 10, padding: "0.6rem 1.1rem", cursor: "pointer", color: isEnabled ? colors.green : colors.red, fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {isEnabled ? <><FaCheckCircle /> Aktif</> : <><FaTimesCircle /> Devre Dışı</>}
                        </motion.button>
                    )}
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={fetchData}
                        style={{ ...buttonSecondary, padding: "0.6rem" }}>
                        <FaSyncAlt style={loading ? { animation: "spin 1s linear infinite" } : {}} />
                    </motion.button>
                </div>
            </div>

            {hasConfig && (
                <GlassCard style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem" }}>
                    <p style={{ margin: 0, color: colors.muted, fontSize: "0.8rem", lineHeight: 1.55, display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <FaInfoCircle style={{ color: colors.accent, marginTop: "0.15rem", flexShrink: 0 }} />
                        <span>
                            <strong>Geciktirmeli otomatik kesim:</strong> Üstteki <strong>Ayarlar</strong> düğmesiyle formu açın; &quot;Tetikleme Ayarları&quot; bölümünde <strong>Otomatik kesim gecikmesi (gün)</strong> ve isteğe bağlı pazaryeri yükleme seçenekleri yer alır. Bu gecikme yalnızca senkron ve zamanlanmış otomatik kesimde uygulanır; seçili siparişleri veya &quot;Tümünü faturala&quot;yı etkilemez.
                        </span>
                    </p>
                </GlassCard>
            )}

            {/* Hata */}
            {error && <AlertBox type="error" message={error} onClose={clearError} />}

            {/* Ardışık hata uyarısı */}
            {consecutiveErrors >= 3 && (
                <AlertBox
                    type="warning"
                    message={`${consecutiveErrors} ardışık hata oluştu. ${consecutiveErrors >= 5 ? "Otomatik fatura devre dışı bırakıldı." : "5 hatada otomatik devre dışı kalır."}${cfg.stats?.lastError ? " Son hata: " + cfg.stats.lastError : ""}`}
                    onAction={resetErrors}
                    actionLabel="Sıfırla"
                />
            )}

            {/* Ayar yapılmamış */}
            {!hasConfig && (
                <GlassCard style={{ textAlign: "center", padding: "2.5rem 1.5rem", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>⚙️</div>
                    <p style={{ color: colors.muted, fontSize: "1rem", fontWeight: 600, margin: "0 0 0.35rem" }}>Ayarlar Yapılmadı</p>
                    <p style={{ color: colors.dim, fontSize: "0.82rem", margin: "0 0 1.25rem", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                        Otomatik fatura kesme için firma bilgilerinizi ve QNB bağlantı ayarlarınızı yapmanız gerekiyor.
                    </p>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { initConfigForm(); setShowConfigForm(true); }}
                        style={buttonPrimary}>
                        <FaCog /> Ayarları Yapılandır
                    </motion.button>
                </GlassCard>
            )}

            {/* İşlem sonucu */}
            {processResult && (
                <AlertBox type="success" message={processResult.message} onClose={clearProcessResult} />
            )}

            {/* İstatistik Kartları */}
            {hasConfig && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                    {[
                        { label: "Toplam Fatura", value: st.totalInvoices || 0, icon: <FaFileInvoice />, color: colors.accent },
                        { label: "Bugün Kesilen", value: st.todayInvoices || 0, icon: <FaCalendarAlt />, color: colors.green },
                        { label: "Toplam Tutar", value: fmtCurrency(st.totalAmount || 0), icon: <FaMoneyBillWave />, color: colors.purple },
                        { label: "Faturasız Sipariş", value: st.uninvoicedOrders || 0, icon: <FaExclamationTriangle />, color: (st.uninvoicedOrders || 0) > 0 ? colors.yellow : colors.dim },
                        { label: "Hatalı Sipariş", value: st.errorOrders || 0, icon: <FaTimesCircle />, color: (st.errorOrders || 0) > 0 ? colors.red : colors.dim },
                    ].map((card, i) => (
                        <GlassCard key={i} style={{ padding: "1.15rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <p style={{ color: colors.dim, fontSize: "0.72rem", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</p>
                                    <p style={{ color: "#fff", fontSize: "1.35rem", fontWeight: 800, margin: "0.35rem 0 0" }}>{card.value}</p>
                                </div>
                                <div style={{ color: card.color, fontSize: "1.3rem", opacity: 0.7 }}>{card.icon}</div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {/* Uyarı Mesajı — Neden faturalanmıyor? */}
            {st.autoInvoiceWarning && (
                <AlertBox type="warning" message={st.autoInvoiceWarning} />
            )}

            {/* Tümünü Faturala */}
            {hasConfig && ((st.uninvoicedOrders || 0) > 0 || (st.errorOrders || 0) > 0) && (
                <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <SpinnerButton
                        onClick={() => processAll(50)}
                        loading={processLoading}
                        loadingText="Faturalar Kesiliyor..."
                        style={buttonPrimary}>
                        <FaFileInvoice /> {(st.errorOrders || 0) > 0 && (st.uninvoicedOrders || 0) === 0
                            ? "Hatalı Siparişleri Tekrar Dene (" + (st.errorOrders || 0) + ")"
                            : "Faturasız Siparişleri Faturala (" + Math.min(50, (st.uninvoicedOrders || 0) + (st.errorOrders || 0)) + ")"}
                    </SpinnerButton>
                    <span style={{ color: colors.dim, fontSize: "0.75rem" }}>
                        {(st.errorOrders || 0) > 0
                            ? "Hatalı siparişler sıfırlanıp tekrar denenecek. Tek seferde en fazla 50 sipariş."
                            : "Tek seferde en fazla 50 sipariş faturalanır."}
                    </span>
                </div>
            )}

            {/* Mevcut Ayarlar + Pazaryeri Kırılımı */}
            {hasConfig && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                    <GlassCard animate={false}>
                        <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <FaCog style={{ color: colors.accent }} /> Mevcut Ayarlar
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {[
                                { label: "Durum", value: isEnabled ? "Aktif" : "Devre Dışı", color: isEnabled ? colors.green : colors.red },
                                { label: "Sağlayıcı", value: (cfg.provider || "qnb").toUpperCase() },
                                { label: "Belge Tipi", value: cfg.documentType || "EARSIVFATURA" },
                                { label: "Fatura Serisi", value: cfg.invoiceSeriesCode || "LYS" },
                                { label: "KDV Oranı", value: "%" + (cfg.defaultVatRate || 20) },
                                { label: "Firma VKN", value: cfg.supplier?.vkn || "—" },
                                { label: "Firma Adı", value: cfg.supplier?.name || "—" },
                                { label: "Ortam", value: cfg.qnbCredentials?.env === "production" ? "Canlı" : "Test" },
                                { label: "📅 Başlangıç Tarihi", value: cfg.autoInvoiceStartDate ? fmtDate(cfg.autoInvoiceStartDate) : "—", color: colors.yellow },
                            ].map((row, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <span style={{ color: colors.dim, fontSize: "0.78rem" }}>{row.label}</span>
                                    <span style={{ color: row.color || colors.text, fontSize: "0.78rem", fontWeight: 600 }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </GlassCard>

                    <GlassCard animate={false}>
                        <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <FaChartPie style={{ color: colors.purple }} /> Pazaryeri Kırılımı
                        </h4>
                        {(st.byMarketplace && st.byMarketplace.length > 0) ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {st.byMarketplace.map((mp, i) => {
                                    const total = st.totalInvoices || 1;
                                    const pctVal = ((mp.count / total) * 100).toFixed(0);
                                    const mpColors = { Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#7b2d8e", "ÇiçekSepeti": "#e91e63" };
                                    const barColor = mpColors[mp.marketplace] || colors.accent;
                                    return (
                                        <div key={i}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                                <span style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 600 }}>{mp.marketplace}</span>
                                                <span style={{ color: colors.dim, fontSize: "0.75rem" }}>{mp.count} fatura ({pctVal}%)</span>
                                            </div>
                                            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                                <div style={{ background: barColor, height: "100%", width: pctVal + "%", borderRadius: 4, transition: "width 0.5s" }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ color: colors.dim, fontSize: "0.8rem", textAlign: "center", padding: "1rem 0" }}>Henüz fatura kesilmedi</p>
                        )}

                        {cfg.stats?.lastInvoiceDate && (
                            <div style={{ marginTop: "1rem", padding: "0.65rem 0.85rem", background: colors.green + "10", border: "1px solid " + colors.green + "25", borderRadius: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: colors.green, fontSize: "0.75rem", fontWeight: 600 }}>
                                    <FaCheckCircle /> Son fatura: {fmtDate(cfg.stats.lastInvoiceDate)}
                                </div>
                                <p style={{ color: colors.dim, fontSize: "0.72rem", margin: "0.2rem 0 0" }}>
                                    Toplam {cfg.stats.totalInvoicesCreated || 0} fatura kesildi
                                </p>
                            </div>
                        )}

                        {cfg.stats?.lastError && (
                            <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.85rem", background: colors.red + "10", border: "1px solid " + colors.red + "25", borderRadius: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: colors.red, fontSize: "0.75rem", fontWeight: 600 }}>
                                    <FaTimesCircle /> Son hata
                                </div>
                                <p style={{ color: colors.dim, fontSize: "0.72rem", margin: "0.2rem 0 0", wordBreak: "break-word" }}>{cfg.stats.lastError}</p>
                            </div>
                        )}
                    </GlassCard>
                </div>
            )}

            {/* QNB Fatura Listesi */}
            {hasConfig && (
                <GlassCard animate={false} style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                        <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <FaFileInvoice style={{ color: colors.accent }} /> Kesilen Faturalar (QNB)
                            {qnbPagination.total > 0 && <span style={{ color: colors.dim, fontWeight: 500, fontSize: "0.78rem" }}>({qnbPagination.total})</span>}
                        </h4>
                        <SpinnerButton onClick={handleQnbSearch} loading={qnbLoading} loadingText="Yükleniyor..."
                            style={{ ...buttonSecondary, padding: "0.45rem 0.85rem", fontSize: "0.78rem", color: colors.accent }}>
                            <FaSyncAlt /> Yenile
                        </SpinnerButton>
                    </div>

                    {/* Arama */}
                    <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ flex: "1 1 220px", position: "relative" }}>
                            <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: colors.dim, fontSize: "0.75rem" }} />
                            <input type="text" placeholder="Fatura no, müşteri adı, VKN ara..."
                                value={qnbSearchQuery} onChange={(e) => setQnbSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleQnbSearch(); }}
                                style={{ ...inputStyle, paddingLeft: "2rem" }} />
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <input type="date" value={qnbDateRange.start} onChange={(e) => setQnbDateRange((p) => ({ ...p, start: e.target.value }))} style={{ ...inputStyle, width: "auto" }} />
                            <span style={{ color: colors.dim, fontSize: "0.75rem" }}>—</span>
                            <input type="date" value={qnbDateRange.end} onChange={(e) => setQnbDateRange((p) => ({ ...p, end: e.target.value }))} style={{ ...inputStyle, width: "auto" }} />
                        </div>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={handleQnbSearch} disabled={qnbLoading}
                            style={{ ...buttonPrimary, padding: "0.55rem 1rem", fontSize: "0.78rem" }}>
                            <FaSearch /> Ara
                        </motion.button>
                    </div>

                    {/* Yükleniyor */}
                    {qnbLoading && qnbInvoices.length === 0 && (
                        <LoadingState message="QNB'den faturalar çekiliyor..." />
                    )}

                    {/* Tablo */}
                    {qnbInvoices.length > 0 && (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.3fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr", gap: "0.4rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: "0.5rem" }}>
                                {["Fatura No", "Müşteri", "Pazaryeri", "Tarih", "Tutar", "Durum", "İşlem"].map((h) => (
                                    <span key={h} style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</span>
                                ))}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", maxHeight: 500, overflowY: "auto" }}>
                                {qnbInvoices.map((inv, idx) => {
                                    const displayAmount = (inv.tutar > 0) ? inv.tutar : ((inv.kdvHaric || 0) + (inv.kdv || 0));
                                    const sColors = { created: colors.green, error: colors.red, pending: colors.yellow };
                                    const sLabels = { created: "Kesildi", error: "Hata", pending: "Bekliyor" };
                                    const sColor = sColors[inv.durum] || colors.dim;
                                    const sLabel = sLabels[inv.durum] || inv.durum || "";
                                    const cbIcons = { auto: "\u26A1", manual: "\u270B" };
                                    const cbIcon = cbIcons[inv.createdBy] || "";
                                    return (
                                        <motion.div key={inv.id || idx} whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                                            style={{ display: "grid", gridTemplateColumns: "1.8fr 1.3fr 0.9fr 0.8fr 0.9fr 0.7fr 0.7fr", gap: "0.4rem", padding: "0.55rem 0.75rem", borderRadius: 8, borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                                            <div style={{ overflow: "hidden" }}>
                                                <span style={{ color: colors.accent, fontSize: "0.78rem", fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cbIcon} {inv.faturaNo || "\u2014"}</span>
                                                {inv.orderNumber && <span style={{ color: colors.dim, fontSize: "0.6rem" }}>Siparişs: {inv.orderNumber}</span>}
                                            </div>
                                            <div style={{ overflow: "hidden" }}>
                                                <span style={{ color: colors.text, fontSize: "0.76rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.aliciAdi || "\u2014"}</span>
                                                {inv.aliciVkn && inv.aliciVkn !== "11111111111" && <span style={{ color: colors.dim, fontSize: "0.6rem", fontFamily: "monospace" }}>{inv.aliciVkn}</span>}
                                            </div>
                                            <span style={{ color: colors.muted, fontSize: "0.74rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.marketplaceName || "\u2014"}</span>
                                            <span style={{ color: colors.muted, fontSize: "0.74rem" }}>{fmtDate(inv.tarih)}</span>
                                            <span style={{ color: colors.green, fontSize: "0.8rem", fontWeight: 700, fontFamily: "monospace" }}>{displayAmount > 0 ? fmtCurrency(displayAmount) : "\u2014"}</span>
                                            <span style={{ color: sColor, fontSize: "0.72rem", fontWeight: 600 }}>{sLabel}</span>
                                            <div style={{ display: "flex", gap: "0.25rem" }}>
                                                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} title="Goruntule"
                                                    onClick={() => inv.uuid && handlePreview(inv.uuid, inv.faturaURL)}
                                                    disabled={pdfLoading === inv.uuid || !inv.uuid}
                                                    style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 6, padding: "0.3rem", cursor: inv.uuid ? "pointer" : "not-allowed", color: colors.accent, fontSize: "0.72rem", display: "flex", opacity: pdfLoading === inv.uuid ? 0.5 : 1 }}>
                                                    {pdfLoading === inv.uuid ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaEye />}
                                                </motion.button>
                                                {inv._id && (
                                                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} title="Indir"
                                                        onClick={() => handleDownload(inv._id, inv.faturaNo, inv.faturaURL)}
                                                        disabled={pdfLoading === inv._id}
                                                        style={{ background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 6, padding: "0.3rem", cursor: "pointer", color: colors.blue, fontSize: "0.72rem", display: "flex", opacity: pdfLoading === inv._id ? 0.5 : 1 }}>
                                                        {pdfLoading === inv._id ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaDownload />}
                                                    </motion.button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Sayfalama */}
                            {qnbPagination.totalPages > 1 && (
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => fetchQnbInvoices(qnbSearchQuery, qnbDateRange.start, qnbDateRange.end, qnbPagination.page - 1)}
                                        disabled={qnbPagination.page <= 1 || qnbLoading}
                                        style={{ ...buttonSecondary, padding: "0.35rem 0.7rem", fontSize: "0.75rem", opacity: qnbPagination.page <= 1 ? 0.4 : 1 }}>
                                        ← ÖÖnceki
                                    </motion.button>
                                    <span style={{ color: colors.muted, fontSize: "0.78rem" }}>
                                        Sayfa {qnbPagination.page} / {qnbPagination.totalPages}
                                    </span>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => fetchQnbInvoices(qnbSearchQuery, qnbDateRange.start, qnbDateRange.end, qnbPagination.page + 1)}
                                        disabled={qnbPagination.page >= qnbPagination.totalPages || qnbLoading}
                                        style={{ ...buttonSecondary, padding: "0.35rem 0.7rem", fontSize: "0.75rem", opacity: qnbPagination.page >= qnbPagination.totalPages ? 0.4 : 1 }}>
                                        Sonraki →
                                    </motion.button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Boş durum */}
                    {!qnbLoading && qnbInvoices.length === 0 && (
                        <EmptyState
                            icon={<FaFileInvoice style={{ fontSize: "2rem", color: colors.dim }} />}
                            title={qnbSearchQuery ? "Arama sonucu bulunamadı" : "Henüz fatura kesilmemiş"}
                            description={qnbSearchQuery ? "Farklı arama kâriterleri deneyin." : "Seçili tarih aralığında kesilmiş fatura bulunamadı. Tarih aralığını genişletin veya siparişlerinizi faturalatın."}
                            action={!qnbSearchQuery && (
                                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    onClick={() => fetchQnbInvoices("", qnbDateRange.start, qnbDateRange.end, 1)}
                                    style={buttonPrimary}>
                                    <FaSyncAlt /> Faturaları Yükle
                                </motion.button>
                            )}
                        />
                    )}
                </GlassCard>
            )}

            {/* Nasıl Çalışır */}
            <GlassCard animate={false}>
                <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <FaInfoCircle style={{ color: colors.blue }} /> Nasıl Çalışır?
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    {[
                        { step: "1", title: "Sipariş Gelir", desc: "Pazaryerinden sipariş sync edilir", icon: "📦" },
                        { step: "2", title: "Durum Kontrolü", desc: "Sipariş durumu tetikleme durumlarına uyuyor mu kontrol edilir", icon: "🔍" },
                        { step: "3", title: "Fatura Kesilir", desc: "QNB eSolutions üzerinden otomatik e-Arşiv fatura oluşturulur", icon: "📄" },
                        { step: "4", title: "Kayıt Yapılır", desc: "Fatura bilgileri kaydedilir ve siparişe bağlanır", icon: "✅" },
                    ].map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.accent + "15", border: "1px solid " + colors.accent + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                                {s.icon}
                            </div>
                            <div>
                                <p style={{ color: colors.text, fontSize: "0.82rem", fontWeight: 700, margin: 0 }}>{s.title}</p>
                                <p style={{ color: colors.dim, fontSize: "0.72rem", margin: "0.15rem 0 0", lineHeight: 1.4 }}>{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </div>
    );
};

export default React.memo(AutoInvoicePanel);
