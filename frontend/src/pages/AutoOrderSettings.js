/**
 * AutoOrderSettings.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════════
 * Otomatik Sipariş İşleme Ayarları Sayfası
 *
 * Her pazaryeri için:
 *   - Otomatik işleme açık/kapalı toggle
 *   - Birincil kargo şirketi seçimi
 *   - Yedek kargo şirketi seçimi (birincil başarısız olursa)
 *   - Manuel tetikleme butonu
 *   - İşlem geçmişi ve istatistikler
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import {
    getAutoOrderConfigs,
    updateAutoOrderConfig,
    processMarketplaceOrders,
    processAllOrders,
    getCargoCompanies
} from "../services/autoOrderApi";
import {
    FaTruck, FaPlay, FaCog, FaCheck, FaTimes,
    FaExclamationTriangle, FaSync, FaChevronDown,
    FaChevronUp, FaRocket, FaShippingFast,
    FaBoxOpen, FaClock, FaCheckCircle, FaTimesCircle,
    FaExchangeAlt, FaInfoCircle
} from "react-icons/fa";
import "../styles/AutoOrderSettings.css";

/* ═══════════════════════════════════════════════════════════════
   SABİTLER
   ═══════════════════════════════════════════════════════════════ */
const PL_COLOR = {
    Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#8b5cf6",
    Amazon: "#f59e0b", "ÇiçekSepeti": "#ec4899", "Amazon Türkiye": "#f59e0b"
};
const PL_SHORT = {
    Trendyol: "TY", Hepsiburada: "HB", N11: "N11",
    Amazon: "AZ", "ÇiçekSepeti": "ÇS", "Amazon Türkiye": "AZ"
};

const STATUS_ICONS = {
    success: <FaCheckCircle style={{ color: "#22c55e" }} />,
    failed: <FaTimesCircle style={{ color: "#ef4444" }} />,
    fallback_success: <FaExchangeAlt style={{ color: "#f59e0b" }} />,
    fallback_failed: <FaTimesCircle style={{ color: "#dc2626" }} />,
};
const STATUS_LABELS = {
    success: "Başarılı",
    failed: "Başarısız",
    fallback_success: "Yedek Kargo ile Başarılı",
    fallback_failed: "Yedek Kargo da Başarısız",
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const AutoOrderSettings = ({ embedded = false }) => {
    const { theme: C, language } = useApp();
    const tr = language !== "en";

    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [processing, setProcessing] = useState({});
    const [processingAll, setProcessingAll] = useState(false);
    const [cargoLists, setCargoLists] = useState({});
    const [cargoLoading, setCargoLoading] = useState({});
    const [expandedCards, setExpandedCards] = useState({});
    const [toast, setToast] = useState(null);
    const [processResults, setProcessResults] = useState({});

    // Ref ile cargoLists'in güncel halini takip et (closure sorununu çözer)
    const cargoListsRef = React.useRef(cargoLists);
    React.useEffect(() => { cargoListsRef.current = cargoLists; }, [cargoLists]);

    const cargoLoadingRef = React.useRef(cargoLoading);
    React.useEffect(() => { cargoLoadingRef.current = cargoLoading; }, [cargoLoading]);

    /* ── Toast helper ── */
    const showToast = useCallback((msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    /* ── Kargo şirketlerini yükle ── */
    const loadCargoCompanies = useCallback(async (marketplaceId) => {
        if (!marketplaceId) return;
        // Ref üzerinden güncel state'i kontrol et
        if (cargoLoadingRef.current[marketplaceId]) return;
        if (cargoListsRef.current[marketplaceId]?.length > 0) return;

        setCargoLoading(prev => ({ ...prev, [marketplaceId]: true }));
        try {
            const res = await getCargoCompanies(marketplaceId);
            if (res.success && res.data?.companies) {
                setCargoLists(prev => ({ ...prev, [marketplaceId]: res.data.companies }));
            }
        } catch (err) {
            console.warn("Kargo şirketleri yüklenemedi:", marketplaceId, err);
        } finally {
            setCargoLoading(prev => ({ ...prev, [marketplaceId]: false }));
        }
    }, []);

    /* ── Config'leri yükle ── */
    const loadConfigs = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getAutoOrderConfigs();
            if (res.success && res.data?.configs) {
                const cfgList = res.data.configs;
                setConfigs(cfgList);
                // Her pazaryeri için kargo listesini otomatik yükle
                for (const cfg of cfgList) {
                    const mpId = cfg.marketplaceId || cfg.marketplace;
                    if (mpId) {
                        loadCargoCompanies(mpId);
                    }
                }
            }
        } catch (err) {
            showToast(tr ? "Ayarlar yüklenemedi" : "Failed to load settings", "error");
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadCargoCompanies, showToast]);

    useEffect(() => { loadConfigs(); }, [loadConfigs]);

    /* ── mpId helper — config'ten güvenli marketplaceId çıkar ── */
    const getMpId = (cfg) => String(cfg.marketplaceId || cfg.marketplace || "");

    /* ── Config kaydet ── */
    const saveConfig = async (marketplaceId, data) => {
        setSaving(prev => ({ ...prev, [marketplaceId]: true }));
        try {
            const res = await updateAutoOrderConfig(marketplaceId, data);
            if (res.success) {
                showToast(tr ? "Ayarlar kaydedildi ✓" : "Settings saved ✓");
                // Config'i güncelle — marketplaceId'yi koru
                setConfigs(prev => prev.map(c => {
                    const cId = getMpId(c);
                    if (cId !== String(marketplaceId)) return c;
                    // Backend'den dönen config'i merge et ama marketplaceId'yi koru
                    const backendCfg = res.data?.config || {};
                    return {
                        ...c,
                        ...data,
                        ...backendCfg,
                        // marketplaceId her zaman korunsun
                        marketplaceId: c.marketplaceId,
                        marketplaceName: c.marketplaceName
                    };
                }));
            } else {
                showToast(res.message || (tr ? "Kaydetme hatası" : "Save error"), "error");
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            showToast(msg, "error");
        } finally {
            setSaving(prev => ({ ...prev, [marketplaceId]: false }));
        }
    };

    /* ── Toggle enabled ── */
    const toggleEnabled = (marketplaceId, currentConfig) => {
        const newEnabled = !currentConfig.enabled;
        // Açılıyorsa ve kargo seçilmemişse uyar
        if (newEnabled && (!currentConfig.primaryCargo?.id)) {
            showToast(tr ? "Önce birincil kargo şirketini seçin" : "Select primary cargo first", "error");
            return;
        }
        saveConfig(marketplaceId, { enabled: newEnabled, primaryCargo: currentConfig.primaryCargo, fallbackCargo: currentConfig.fallbackCargo });
    };

    /* ── Kargo seçimi değişti ── */
    const handleCargoChange = (marketplaceId, type, cargoId) => {
        const companies = cargoLists[marketplaceId] || [];
        const selected = companies.find(c => c.id === cargoId);
        const cfg = configs.find(c => getMpId(c) === String(marketplaceId));
        if (!cfg) return;

        const newCargo = cargoId ? { id: cargoId, name: selected?.name || "" } : { id: "", name: "" };
        const update = {
            enabled: cfg.enabled,
            primaryCargo: type === "primary" ? newCargo : (cfg.primaryCargo || { id: "", name: "" }),
            fallbackCargo: type === "fallback" ? newCargo : (cfg.fallbackCargo || { id: "", name: "" })
        };

        // Aynı kargo birincil ve yedek olamaz
        if (update.primaryCargo.id && update.primaryCargo.id === update.fallbackCargo.id) {
            showToast(tr ? "Birincil ve yedek kargo aynı olamaz" : "Primary and fallback cannot be the same", "error");
            return;
        }

        saveConfig(marketplaceId, update);
    };

    /* ── Manuel tetikleme (tek pazaryeri) ── */
    const handleProcess = async (marketplaceId, marketplaceName) => {
        setProcessing(prev => ({ ...prev, [marketplaceId]: true }));
        setProcessResults(prev => ({ ...prev, [marketplaceId]: null }));
        try {
            const res = await processMarketplaceOrders(marketplaceId);
            if (res.success) {
                showToast(res.message || `${marketplaceName}: İşlem tamamlandı`);
                setProcessResults(prev => ({ ...prev, [marketplaceId]: res.data }));
                loadConfigs(); // İstatistikleri güncelle
            } else {
                showToast(res.message || "İşlem hatası", "error");
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            showToast(msg, "error");
        } finally {
            setProcessing(prev => ({ ...prev, [marketplaceId]: false }));
        }
    };

    /* ── Tümünü işle ── */
    const handleProcessAll = async () => {
        setProcessingAll(true);
        try {
            const res = await processAllOrders();
            if (res.success) {
                showToast(res.message || "Tüm pazaryerleri işlendi");
                loadConfigs();
            } else {
                showToast(res.message || "İşlem hatası", "error");
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            showToast(msg, "error");
        } finally {
            setProcessingAll(false);
        }
    };

    /* ── Kart aç/kapa — açılırken kargo listesini yükle ── */
    const toggleCard = (id) => {
        setExpandedCards(prev => {
            const willExpand = !prev[id];
            // Kart açılıyorsa ve kargo listesi henüz yüklenmediyse yükle
            if (willExpand && !(cargoLists[id]?.length > 0) && !cargoLoading[id]) {
                loadCargoCompanies(id);
            }
            return { ...prev, [id]: willExpand };
        });
    };

    /* ── Kargo listesini zorla yeniden yükle (Tekrar Dene butonu için) ── */
    const forceReloadCargo = async (marketplaceId) => {
        if (!marketplaceId) return;
        setCargoLoading(prev => ({ ...prev, [marketplaceId]: true }));
        try {
            const res = await getCargoCompanies(marketplaceId);
            if (res.success && res.data?.companies) {
                setCargoLists(prev => ({ ...prev, [marketplaceId]: res.data.companies }));
            } else {
                showToast(tr ? "Kargo şirketleri yüklenemedi" : "Failed to load cargo companies", "error");
            }
        } catch (err) {
            console.warn("Kargo şirketleri yüklenemedi:", marketplaceId, err);
            showToast(tr ? "Kargo şirketleri yüklenemedi" : "Failed to load cargo companies", "error");
        } finally {
            setCargoLoading(prev => ({ ...prev, [marketplaceId]: false }));
        }
    };

    /* ── Tarih formatla ── */
    const fmtDate = (d) => {
        if (!d) return "-";
        try { return new Date(d).toLocaleString("tr-TR"); } catch { return "-"; }
    };

    /* ═══════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════ */

    const containerStyle = embedded
        ? { color: C.text, padding: "0.5rem 0" }
        : { background: C.bg, color: C.text, minHeight: "100vh", padding: "2rem" };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div className="aos-loading" style={embedded ? { minHeight: "30vh" } : {}}>
                    <div className="aos-spinner" />
                    <p>{tr ? "Ayarlar yükleniyor..." : "Loading settings..."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={embedded ? "" : "aos-container"} style={containerStyle}>
            {/* ── Toast ── */}
            {toast && (
                <div className={`aos-toast aos-toast--${toast.type}`}>
                    {toast.type === "success" ? <FaCheck /> : <FaExclamationTriangle />}
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* ── Header ── */}
            {!embedded && (
            <div className="aos-header">
                <div className="aos-header-left">
                    <FaShippingFast className="aos-header-icon" />
                    <div>
                        <h1 className="aos-title">
                            {tr ? "Otomatik Sipariş İşleme" : "Auto Order Processing"}
                        </h1>
                        <p className="aos-subtitle">
                            {tr
                                ? "Yeni siparişleri otomatik olarak işleme alın, kargo şirketini seçin"
                                : "Automatically process new orders, select cargo company"}
                        </p>
                    </div>
                </div>
                <div className="aos-header-right">
                    <button
                        className="aos-btn aos-btn--refresh"
                        onClick={loadConfigs}
                        disabled={loading}
                        title={tr ? "Yenile" : "Refresh"}
                    >
                        <FaSync className={loading ? "aos-spin" : ""} />
                    </button>
                    <button
                        className="aos-btn aos-btn--primary aos-btn--process-all"
                        onClick={handleProcessAll}
                        disabled={processingAll || configs.filter(c => c.enabled).length === 0}
                    >
                        {processingAll ? (
                            <><div className="aos-btn-spinner" /> {tr ? "İşleniyor..." : "Processing..."}</>
                        ) : (
                            <><FaRocket /> {tr ? "Tümünü İşle" : "Process All"}</>
                        )}
                    </button>
                </div>
            </div>
            )}

            {/* ── Embedded Header (compact) ── */}
            {embedded && (
            <div className="aos-header" style={{ marginBottom: "1rem" }}>
                <div className="aos-header-left" style={{ gap: "0.5rem" }}>
                    <p className="aos-subtitle" style={{ margin: 0 }}>
                        {tr
                            ? "Her pazaryeri için birincil ve yedek kargo şirketi seçin. Yeni siparişler otomatik olarak işleme alınır."
                            : "Select primary and fallback cargo for each marketplace. New orders are processed automatically."}
                    </p>
                </div>
                <div className="aos-header-right">
                    <button
                        className="aos-btn aos-btn--refresh"
                        onClick={loadConfigs}
                        disabled={loading}
                        title={tr ? "Yenile" : "Refresh"}
                    >
                        <FaSync className={loading ? "aos-spin" : ""} />
                    </button>
                    <button
                        className="aos-btn aos-btn--primary aos-btn--process-all"
                        onClick={handleProcessAll}
                        disabled={processingAll || configs.filter(c => c.enabled).length === 0}
                    >
                        {processingAll ? (
                            <><div className="aos-btn-spinner" /> {tr ? "İşleniyor..." : "Processing..."}</>
                        ) : (
                            <><FaRocket /> {tr ? "Tümünü İşle" : "Process All"}</>
                        )}
                    </button>
                </div>
            </div>
            )}

            {/* ── Info Banner ── */}
            {!embedded && (
            <div className="aos-info-banner" style={{ borderColor: C.border, background: `${C.card}cc` }}>
                <FaInfoCircle className="aos-info-icon" />
                <div>
                    <strong>{tr ? "Nasıl Çalışır?" : "How It Works?"}</strong>
                    <p>
                        {tr
                            ? "Her pazaryeri için birincil ve yedek kargo şirketi seçin. Yeni gelen siparişler otomatik olarak seçtiğiniz kargo şirketi ile \"İşlemde\" statüsüne alınır. Birincil kargo başarısız olursa yedek kargo ile tekrar denenir."
                            : "Select primary and fallback cargo companies for each marketplace. New orders are automatically moved to \"Processing\" status with your selected cargo. If primary fails, fallback cargo is used."}
                    </p>
                </div>
            </div>
            )}

            {/* ── Marketplace Cards ── */}
            {configs.length === 0 ? (
                <div className="aos-empty">
                    <FaBoxOpen className="aos-empty-icon" />
                    <h3>{tr ? "Pazaryeri Bulunamadı" : "No Marketplaces Found"}</h3>
                    <p>{tr ? "Önce pazaryeri entegrasyonu ekleyin" : "Add marketplace integration first"}</p>
                </div>
            ) : (
                <div className="aos-cards">
                    {configs.map(cfg => {
                        const mpId = cfg.marketplaceId || cfg.marketplace;
                        const mpName = cfg.marketplaceName || "Bilinmiyor";
                        const color = PL_COLOR[mpName] || "#6366f1";
                        const short = PL_SHORT[mpName] || mpName.substring(0, 2).toUpperCase();
                        const companies = cargoLists[mpId] || [];
                        const isExpanded = expandedCards[mpId];
                        const isSaving = saving[mpId];
                        const isProcessing = processing[mpId];
                        const result = processResults[mpId];

                        return (
                            <div
                                key={mpId}
                                className={`aos-card ${cfg.enabled ? "aos-card--enabled" : ""}`}
                                style={{ borderColor: cfg.enabled ? color : C.border, background: C.card }}
                            >
                                {/* ── Card Header ── */}
                                <div className="aos-card-header" onClick={() => toggleCard(mpId)}>
                                    <div className="aos-card-header-left">
                                        <div className="aos-mp-badge" style={{ background: color }}>
                                            {short}
                                        </div>
                                        <div className="aos-card-info">
                                            <h3 className="aos-card-title">{mpName}</h3>
                                            <div className="aos-card-meta">
                                                {cfg.enabled ? (
                                                    <span className="aos-status aos-status--active">
                                                        <FaCheckCircle /> {tr ? "Aktif" : "Active"}
                                                    </span>
                                                ) : (
                                                    <span className="aos-status aos-status--inactive">
                                                        <FaTimesCircle /> {tr ? "Pasif" : "Inactive"}
                                                    </span>
                                                )}
                                                {cfg.primaryCargo?.name && (
                                                    <span className="aos-cargo-badge">
                                                        <FaTruck /> {cfg.primaryCargo.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="aos-card-header-right">
                                        {/* Toggle */}
                                        <div
                                            className={`aos-toggle ${cfg.enabled ? "aos-toggle--on" : ""}`}
                                            style={cfg.enabled ? { background: color } : {}}
                                            onClick={(e) => { e.stopPropagation(); toggleEnabled(mpId, cfg); }}
                                            title={cfg.enabled ? (tr ? "Kapat" : "Disable") : (tr ? "Aç" : "Enable")}
                                        >
                                            <div className="aos-toggle-knob" />
                                        </div>
                                        <span className="aos-chevron">
                                            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Expanded Content ── */}
                                {isExpanded && (
                                    <div className="aos-card-body">
                                        {/* ── Kargo Seçimi ── */}
                                        <div className="aos-cargo-section">
                                            <h4 className="aos-section-title">
                                                <FaTruck /> {tr ? "Kargo Şirketi Ayarları" : "Cargo Company Settings"}
                                            </h4>

                                            {cargoLoading[mpId] ? (
                                                <div className="aos-cargo-loading">
                                                    <div className="aos-spinner-sm" />
                                                    <span>{tr ? "Kargo şirketleri yükleniyor..." : "Loading cargo companies..."}</span>
                                                </div>
                                            ) : companies.length === 0 ? (
                                                <div className="aos-cargo-empty">
                                                    <FaExclamationTriangle />
                                                    <span>{tr ? "Kargo şirketleri yüklenemedi" : "Failed to load cargo companies"}</span>
                                                    <button className="aos-btn aos-btn--sm" onClick={() => forceReloadCargo(mpId)}>
                                                        <FaSync /> {tr ? "Tekrar Dene" : "Retry"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="aos-cargo-selects">
                                                    {/* Birincil Kargo */}
                                                    <div className="aos-select-group">
                                                        <label className="aos-label">
                                                            <span className="aos-label-badge aos-label-badge--primary">1</span>
                                                            {tr ? "Birincil Kargo Şirketi" : "Primary Cargo Company"}
                                                        </label>
                                                        <select
                                                            className="aos-select"
                                                            value={cfg.primaryCargo?.id || ""}
                                                            onChange={(e) => handleCargoChange(mpId, "primary", e.target.value)}
                                                            disabled={isSaving}
                                                            style={{ borderColor: color }}
                                                        >
                                                            <option value="">{tr ? "-- Seçiniz --" : "-- Select --"}</option>
                                                            {companies.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="aos-select-hint">
                                                            {tr ? "Siparişler önce bu kargo ile işlenir" : "Orders are processed with this cargo first"}
                                                        </p>
                                                    </div>

                                                    {/* Yedek Kargo */}
                                                    <div className="aos-select-group">
                                                        <label className="aos-label">
                                                            <span className="aos-label-badge aos-label-badge--fallback">2</span>
                                                            {tr ? "Yedek Kargo Şirketi" : "Fallback Cargo Company"}
                                                        </label>
                                                        <select
                                                            className="aos-select"
                                                            value={cfg.fallbackCargo?.id || ""}
                                                            onChange={(e) => handleCargoChange(mpId, "fallback", e.target.value)}
                                                            disabled={isSaving}
                                                        >
                                                            <option value="">{tr ? "-- Seçiniz (Opsiyonel) --" : "-- Select (Optional) --"}</option>
                                                            {companies.filter(c => c.id !== cfg.primaryCargo?.id).map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="aos-select-hint">
                                                            {tr ? "Birincil başarısız olursa bu kargo denenir" : "Used if primary cargo fails"}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Manuel Tetikleme ── */}
                                        <div className="aos-action-section">
                                            <h4 className="aos-section-title">
                                                <FaPlay /> {tr ? "Manuel İşleme" : "Manual Processing"}
                                            </h4>
                                            <div className="aos-action-row">
                                                <button
                                                    className="aos-btn aos-btn--action"
                                                    style={{ background: color }}
                                                    onClick={() => handleProcess(mpId, mpName)}
                                                    disabled={isProcessing || !cfg.primaryCargo?.id}
                                                >
                                                    {isProcessing ? (
                                                        <><div className="aos-btn-spinner" /> {tr ? "İşleniyor..." : "Processing..."}</>
                                                    ) : (
                                                        <><FaPlay /> {tr ? "Yeni Siparişleri İşle" : "Process New Orders"}</>
                                                    )}
                                                </button>
                                                {!cfg.primaryCargo?.id && (
                                                    <span className="aos-action-hint">
                                                        <FaExclamationTriangle /> {tr ? "Önce kargo şirketi seçin" : "Select cargo first"}
                                                    </span>
                                                )}
                                            </div>

                                            {/* İşlem Sonucu */}
                                            {result && (
                                                <div className="aos-result-box">
                                                    <div className="aos-result-summary">
                                                        <div className="aos-result-stat">
                                                            <span className="aos-result-num" style={{ color: "#22c55e" }}>{result.success || 0}</span>
                                                            <span className="aos-result-label">{tr ? "Başarılı" : "Success"}</span>
                                                        </div>
                                                        <div className="aos-result-stat">
                                                            <span className="aos-result-num" style={{ color: "#ef4444" }}>{result.failed || 0}</span>
                                                            <span className="aos-result-label">{tr ? "Başarısız" : "Failed"}</span>
                                                        </div>
                                                        {(result.fallbackUsed || 0) > 0 && (
                                                            <div className="aos-result-stat">
                                                                <span className="aos-result-num" style={{ color: "#f59e0b" }}>{result.fallbackUsed}</span>
                                                                <span className="aos-result-label">{tr ? "Yedek Kargo" : "Fallback"}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {result.results && result.results.length > 0 && (
                                                        <div className="aos-result-details">
                                                            {result.results.slice(0, 10).map((r, i) => (
                                                                <div key={i} className="aos-result-row">
                                                                    {STATUS_ICONS[r.status] || <FaInfoCircle />}
                                                                    <span className="aos-result-order">#{r.orderNumber}</span>
                                                                    <span className="aos-result-status">{STATUS_LABELS[r.status] || r.status}</span>
                                                                    {r.cargoUsed && <span className="aos-result-cargo">{r.cargoUsed}</span>}
                                                                    {r.error && <span className="aos-result-error" title={r.error}>{r.error.substring(0, 60)}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── İstatistikler ── */}
                                        <div className="aos-stats-section">
                                            <h4 className="aos-section-title">
                                                <FaCog /> {tr ? "İstatistikler" : "Statistics"}
                                            </h4>
                                            <div className="aos-stats-grid">
                                                <div className="aos-stat-item">
                                                    <FaBoxOpen className="aos-stat-icon" style={{ color: "#6366f1" }} />
                                                    <div className="aos-stat-value">{cfg.stats?.totalProcessed || 0}</div>
                                                    <div className="aos-stat-label">{tr ? "Toplam İşlenen" : "Total Processed"}</div>
                                                </div>
                                                <div className="aos-stat-item">
                                                    <FaCheckCircle className="aos-stat-icon" style={{ color: "#22c55e" }} />
                                                    <div className="aos-stat-value">{cfg.stats?.totalSuccess || 0}</div>
                                                    <div className="aos-stat-label">{tr ? "Başarılı" : "Success"}</div>
                                                </div>
                                                <div className="aos-stat-item">
                                                    <FaTimesCircle className="aos-stat-icon" style={{ color: "#ef4444" }} />
                                                    <div className="aos-stat-value">{cfg.stats?.totalFailed || 0}</div>
                                                    <div className="aos-stat-label">{tr ? "Başarısız" : "Failed"}</div>
                                                </div>
                                                <div className="aos-stat-item">
                                                    <FaExchangeAlt className="aos-stat-icon" style={{ color: "#f59e0b" }} />
                                                    <div className="aos-stat-value">{cfg.stats?.totalFallbackUsed || 0}</div>
                                                    <div className="aos-stat-label">{tr ? "Yedek Kargo" : "Fallback Used"}</div>
                                                </div>
                                            </div>
                                            {cfg.stats?.lastRun && (
                                                <div className="aos-last-run">
                                                    <FaClock /> {tr ? "Son çalışma:" : "Last run:"} {fmtDate(cfg.stats.lastRun)}
                                                </div>
                                            )}
                                            {cfg.stats?.lastError && (
                                                <div className="aos-last-error">
                                                    <FaExclamationTriangle /> {cfg.stats.lastError}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Son İşlenen Siparişler ── */}
                                        {cfg.recentOrders && cfg.recentOrders.length > 0 && (
                                            <div className="aos-recent-section">
                                                <h4 className="aos-section-title">
                                                    <FaClock /> {tr ? "Son İşlenen Siparişler" : "Recent Orders"}
                                                </h4>
                                                <div className="aos-recent-list">
                                                    {cfg.recentOrders.slice(-10).reverse().map((ro, i) => (
                                                        <div key={i} className="aos-recent-row">
                                                            {STATUS_ICONS[ro.status] || <FaInfoCircle />}
                                                            <span className="aos-recent-order">#{ro.orderNumber}</span>
                                                            <span className="aos-recent-cargo">{ro.cargoUsed}</span>
                                                            <span className="aos-recent-date">{fmtDate(ro.processedAt)}</span>
                                                            {ro.error && (
                                                                <span className="aos-recent-error" title={ro.error}>
                                                                    <FaExclamationTriangle />
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AutoOrderSettings;
