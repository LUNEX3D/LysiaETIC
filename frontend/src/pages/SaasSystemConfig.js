import React, { useEffect, useState, useCallback } from "react";
import {
    FaCog, FaServer, FaDatabase, FaCrown, FaCheckCircle,
    FaTimesCircle, FaExclamationTriangle, FaSync, FaSave,
    FaEdit, FaTimes, FaInfoCircle, FaBoxOpen,
    FaClipboardList, FaPlug, FaCode, FaUsers, FaClock,
    FaShieldAlt, FaChartBar
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getSystemConfig, updatePlanDefinitions } from "../services/saasAdminApi";

const SaasSystemConfig = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState({ text: "", type: "" });
    const [activeTab, setActiveTab] = useState("plans");

    // Plan editing
    const [editingPlans, setEditingPlans] = useState(false);
    const [planDraft, setPlanDraft] = useState({});
    const [savingPlans, setSavingPlans] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getSystemConfig();
            setConfig(res.data);
            setPlanDraft(JSON.parse(JSON.stringify(res.data.planDefinitions || {})));
        } catch (err) {
            console.error(err);
            setError("Sistem ayarları alınamadı.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const fmtUptime = (seç) => {
        if (!seç) return "—";
        const d = Math.floor(seç / 86400);
        const h = Math.floor((seç % 86400) / 3600);
        const m = Math.floor((seç % 3600) / 60);
        return `${d}g ${h}s ${m}dk`;
    };

    const handlePlanFieldChange = (planKey, field, value) => {
        setPlanDraft(prev => ({
            ...prev,
            [planKey]: { ...prev[planKey], [field]: value }
        }));
    };

    const handlePlanLimitChange = (planKey, limitKey, value) => {
        setPlanDraft(prev => ({
            ...prev,
            [planKey]: {
                ...prev[planKey],
                limits: { ...prev[planKey].limits, [limitKey]: parseInt(value) || 0 }
            }
        }));
    };

    const handleSavePlans = async () => {
        setSavingPlans(true);
        setMessage({ text: "", type: "" });
        try {
            await updatePlanDefinitions(planDraft);
            setMessage({ text: "Paket tanımları başarıyla güncellendi!", type: "success" });
            setEditingPlans(false);
            loadConfig();
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "Paket tanımları güncellenemedi", type: "error" });
        } finally {
            setSavingPlans(false);
        }
    };

    const handleCancelEdit = () => {
        setPlanDraft(JSON.parse(JSON.stringify(config?.planDefinitions || {})));
        setEditingPlans(false);
    };

    const planColors = { trial: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
    const planIcons = { trial: <FaClock />, basic: <FaBoxOpen />, pro: <FaChartBar />, enterprise: <FaShieldAlt /> };

    const limitLabels = {
        maxProducts: { label: "Maks Ürün", icon: <FaBoxOpen /> },
        maxOrders: { label: "Maks Sipariş", icon: <FaClipboardList /> },
        maxMarketplaces: { label: "Maks Pazaryeri", icon: <FaPlug /> },
        maxApiCalls: { label: "API Çağrı", icon: <FaCode /> },
        maxUsers: { label: "Maks Kullanıcı", icon: <FaUsers /> },
    };

    const tabs = [
        { key: "plans", label: "Paket Tanımları", icon: <FaCrown /> },
        { key: "system", label: "Sunucu Bilgileri", icon: <FaServer /> },
        { key: "features", label: "Özellikler & Limitler", icon: <FaCog /> },
    ];

    // ═══════════════════════════════════════════════════════════
    // RENDER: Paket Tanımları (Düzenlenebilir)
    // ═══════════════════════════════════════════════════════════
    const renderPlans = () => {
        const plans = editingPlans ? planDraft : (config?.planDefinitions || {});

        return (
            <>
                {/* Header Actions */}
                <div className="ap-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FaCrown style={{ color: "var(--ap-primary)", fontSize: 18 }} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>Abonelik Paketleri</div>
                            <div style={{ fontSize: 12, color: "var(--ap-muted)" }}>
                                Fiyatları, limitleri ve süreleri buradan yönetin
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        {editingPlans ? (
                            <>
                                <button className="ap-btn ap-btn--ghost" onClick={handleCancelEdit} disabled={savingPlans}>
                                    <FaTimes /> İptal
                                </button>
                                <button className="ap-btn ap-btn--primary" onClick={handleSavePlans} disabled={savingPlans}>
                                    <FaSave /> {savingPlans ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                                </button>
                            </>
                        ) : (
                            <button className="ap-btn ap-btn--primary" onClick={() => setEditingPlans(true)}>
                                <FaEdit /> Paketleri Düzenle
                            </button>
                        )}
                    </div>
                </div>

                {/* Plan Cards */}
                <div className="ap-grid ap-grid--2">
                    {Object.entries(plans).map(([key, plan]) => {
                        const color = planColors[key] || "purple";
                        return (
                            <div key={key} className="ap-card" style={{ position: "relative", overflow: "visible" }}>
                                {/* Plan Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div className={`ap-kpi-icon ap-kpi-icon--${color}`} style={{ width: 42, height: 42, borderRadius: 12, fontSize: 18 }}>
                                            {planIcons[key] || <FaCrown />}
                                        </div>
                                        <div>
                                            {editingPlans ? (
                                                <input
                                                    type="text"
                                                    value={plan.name || ""}
                                                    onChange={(e) => handlePlanFieldChange(key, "name", e.target.value)}
                                                    style={inputStyle}
                                                    placeholder="Paket adı"
                                                />
                                            ) : (
                                                <span className={`ap-badge ap-badge--${color}`} style={{ fontSize: 13, padding: "5px 14px" }}>
                                                    {plan.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        {editingPlans ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ap-text)" }}>₺</span>
                                                <input
                                                    type="number"
                                                    value={plan.price ?? 0}
                                                    onChange={(e) => handlePlanFieldChange(key, "price", parseFloat(e.target.value) || 0)}
                                                    style={{ ...inputStyle, width: 90, fontSize: 20, fontWeight: 800, textAlign: "right" }}
                                                    min="0"
                                                />
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>/ay</span>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ap-text)" }}>
                                                ₺{plan.price}
                                                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ap-muted)" }}>/ay</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Duration */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 12px", borderRadius: 8, background: "rgba(99,102,241,0.04)", border: "1px solid var(--ap-border)" }}>
                                    <FaClock style={{ color: "var(--ap-muted)", fontSize: 12 }} />
                                    <span style={{ fontSize: 12, color: "var(--ap-muted)", fontWeight: 600 }}>Süre:</span>
                                    {editingPlans ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <input
                                                type="number"
                                                value={plan.duration ?? 30}
                                                onChange={(e) => handlePlanFieldChange(key, "duration", parseInt(e.target.value) || 0)}
                                                style={{ ...inputStyle, width: 60, textAlign: "center" }}
                                                min="1"
                                            />
                                            <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>gün</span>
                                        </div>
                                    ) : (
                                        <span style={{ fontWeight: 700, fontSize: 13 }}>{plan.duration} gün</span>
                                    )}
                                </div>

                                {/* Limits */}
                                <div className="ap-list">
                                    {Object.entries(limitLabels).map(([limitKey, { label, icon }]) => (
                                        <div key={limitKey} className="ap-row" style={{ padding: "8px 10px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ap-muted)" }}>
                                                {icon} {label}
                                            </div>
                                            {editingPlans ? (
                                                <input
                                                    type="number"
                                                    value={plan.limits?.[limitKey] ?? 0}
                                                    onChange={(e) => handlePlanLimitChange(key, limitKey, e.target.value)}
                                                    style={{ ...inputStyle, width: 100, textAlign: "right" }}
                                                    min="0"
                                                />
                                            ) : (
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>
                                                    {(plan.limits?.[limitKey] || 0).toLocaleString("tr-TR")}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Info Banner */}
                <div className="ap-alert ap-alert--info" style={{ marginTop: 4 }}>
                    <FaInfoCircle />
                    Paket tanımlarını değiştirmek mevcut abonelikleri etkilemez. Yeni abonelikler güncel tanımlarla oluşturulur.
                    Mevcut abonelikleri güncellemek için "Paket & Abonelik" sayfasını kullanın.
                </div>
            </>
        );
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER: Sunucu Bilgileri
    // ═══════════════════════════════════════════════════════════
    const renderSystem = () => (
        <>
            <div className="ap-card">
                <div className="ap-card-head"><FaServer /> Sunucu Bilgileri</div>
                <div className="ap-grid ap-grid--4">
                    <div className="ap-stat-mini">
                        <FaServer style={{ fontSize: 20, color: "var(--ap-blue)" }} />
                        <div className="ap-stat-mini-label">Node.js</div>
                        <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>{config?.systemInfo?.nodeVersion}</div>
                    </div>
                    <div className="ap-stat-mini">
                        <FaCog style={{ fontSize: 20, color: "var(--ap-yellow)" }} />
                        <div className="ap-stat-mini-label">Platform</div>
                        <div className="ap-stat-mini-val" style={{ fontSize: 14 }}>{config?.systemInfo?.platform}</div>
                    </div>
                    <div className="ap-stat-mini">
                        <FaClock style={{ fontSize: 20, color: "var(--ap-cyan)" }} />
                        <div className="ap-stat-mini-label">Uptime</div>
                        <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>{fmtUptime(config?.systemInfo?.uptime)}</div>
                    </div>
                    <div className="ap-stat-mini">
                        <FaDatabase style={{ fontSize: 20, color: config?.systemInfo?.dbConnected ? "var(--ap-green)" : "var(--ap-red)" }} />
                        <div className="ap-stat-mini-label">Veritabanı</div>
                        <span className={`ap-badge ap-badge--${config?.systemInfo?.dbConnected ? "green" : "red"}`}>
                            {config?.systemInfo?.dbConnected ? "Bağlı ✅" : "Bağlantı Yok ❌"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="ap-card">
                <div className="ap-card-head"><FaDatabase /> Detaylı Bilgiler</div>
                <div className="ap-list">
                    {[
                        { label: "Hostname", value: config?.systemInfo?.hostname },
                        { label: "Ortam", value: config?.systemInfo?.environment, badge: true },
                        { label: "PID", value: config?.systemInfo?.pid },
                        { label: "DB Host", value: config?.systemInfo?.dbHost },
                        { label: "DB Name", value: config?.systemInfo?.dbName },
                    ].map((item, i) => (
                        <div key={i} className="ap-row">
                            <span style={{ color: "var(--ap-muted)", fontSize: 12, fontWeight: 600 }}>{item.label}</span>
                            {item.badge ? (
                                <span className={`ap-badge ap-badge--${item.value === "production" ? "green" : "yellow"}`}>
                                    {item.value || "—"}
                                </span>
                            ) : (
                                <span className="mono" style={{ fontSize: 12 }}>{item.value || "—"}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );

    // ═══════════════════════════════════════════════════════════
    // RENDER: Özellikler & Limitler
    // ═══════════════════════════════════════════════════════════
    const renderFeatures = () => (
        <>
            <div className="ap-card">
                <div className="ap-card-head"><FaCheckCircle /> Aktif Platform Özellikleri</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {Object.entries(config?.features || {}).map(([key, enabled]) => {
                        const featureLabels = {
                            pwa: "PWA Desteği", responsive: "Responsive", aiPanel: "AI Panel",
                            marketplace: "Pazaryeri", finance: "Finans", cargo: "Kargo",
                            tickets: "Destek Sistemi", announcements: "Duyurular"
                        };
                        return (
                            <div
                                key={key}
                                className={`ap-badge ap-badge--${enabled ? "green" : "red"}`}
                                style={{ padding: "8px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                            >
                                {enabled ? <FaCheckCircle /> : <FaTimesCircle />}
                                {featureLabels[key] || key}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="ap-card">
                <div className="ap-card-head"><FaShieldAlt /> Global Limitler</div>
                <div className="ap-list">
                    {Object.entries(config?.limits || {}).map(([key, value]) => {
                        const labels = {
                            maxUploadSize: "Maks Upload Boyutu",
                            apiRateLimit: "API Rate Limit",
                            sessionTimeout: "Oturum Süresi"
                        };
                        const icons = {
                            maxUploadSize: <FaBoxOpen />,
                            apiRateLimit: <FaCode />,
                            sessionTimeout: <FaClock />
                        };
                        return (
                            <div key={key} className="ap-row">
                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ap-muted)", fontSize: 13, fontWeight: 600 }}>
                                    {icons[key] || <FaCog />} {labels[key] || key}
                                </div>
                                <span style={{ fontWeight: 700, color: "var(--ap-text2)", fontSize: 14 }}>{value}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );

    return (
        <AdminLayout
            title="Sistem Ayarları"
            subtitle="Paket tanımları, sunucu bilgileri ve platform yapılandırması"
            actions={
                <button className="ap-btn ap-btn--ghost" onClick={loadConfig} disabled={loading}>
                    <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                </button>
            }
        >
            {/* Messages */}
            {message.text && (
                <div className={`ap-alert ${message.type === "success" ? "ap-alert--success" : "ap-alert--error"}`}>
                    {message.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {message.text}
                </div>
            )}
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}
            {loading && !config && <div className="ap-loading">Yükleniyor...</div>}

            {config && (
                <>
                    {/* Tabs */}
                    <div className="ap-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                className={`ap-tab ${activeTab === tab.key ? "ap-tab--active" : ""}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === "plans" && renderPlans()}
                    {activeTab === "system" && renderSystem()}
                    {activeTab === "features" && renderFeatures()}
                </>
            )}
        </AdminLayout>
    );
};

// ─── Shared Input Style ──────────────────────────────────────────────────────
const inputStyle = {
    padding: "8px 12px",
    background: "rgba(12,15,26,0.9)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 8,
    color: "#f1f5f9",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
};

export default SaasSystemConfig;
