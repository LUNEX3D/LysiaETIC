import React, { useEffect, useState } from "react";
import {
    FaCog, FaServer, FaDatabase, FaCrown, FaCheckCircle,
    FaTimesCircle, FaExclamationTriangle, FaSync
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getSystemConfig } from "../services/saasAdminApi";

const SaasSystemConfig = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => { loadConfig(); }, []);

    const loadConfig = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getSystemConfig();
            setConfig(res.data);
        } catch (err) {
            console.error(err);
            setError("Sistem ayarları alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const fmtUptime = (sec) => {
        if (!sec) return "—";
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `${d}g ${h}s ${m}dk`;
    };

    return (
        <AdminLayout
            title="Sistem Ayarları"
            subtitle="Global ayarlar, paket tanımları ve sistem bilgileri"
            actions={
                <button className="ap-btn ap-btn--ghost" onClick={loadConfig} disabled={loading}>
                    <FaSync /> Yenile
                </button>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}
            {loading && !config && <div className="ap-loading">Yükleniyor...</div>}

            {config && (
                <>
                    {/* Sistem Bilgileri */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaServer /> Sunucu Bilgileri</div>
                        <div className="ap-grid ap-grid--3">
                            <div className="ap-stat-mini">
                                <FaServer style={{ fontSize: 20, color: "var(--ap-blue)" }} />
                                <div className="ap-stat-mini-label">Node.js</div>
                                <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>{config.systemInfo?.nodeVersion}</div>
                            </div>
                            <div className="ap-stat-mini">
                                <FaCog style={{ fontSize: 20, color: "var(--ap-yellow)" }} />
                                <div className="ap-stat-mini-label">Platform</div>
                                <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>{config.systemInfo?.platform}</div>
                            </div>
                            <div className="ap-stat-mini">
                                <FaDatabase style={{ fontSize: 20, color: config.systemInfo?.dbConnected ? "var(--ap-green)" : "var(--ap-red)" }} />
                                <div className="ap-stat-mini-label">Veritabanı</div>
                                <span className={`ap-badge ap-badge--${config.systemInfo?.dbConnected ? "green" : "red"}`}>
                                    {config.systemInfo?.dbConnected ? "Bağlı ✅" : "Bağlantı Yok ❌"}
                                </span>
                            </div>
                        </div>
                        <div className="ap-divider" style={{ margin: "16px 0" }} />
                        <div className="ap-list">
                            {[
                                { label: "Hostname", value: config.systemInfo?.hostname },
                                { label: "Ortam", value: config.systemInfo?.environment },
                                { label: "PID", value: config.systemInfo?.pid },
                                { label: "Uptime", value: fmtUptime(config.systemInfo?.uptime) },
                                { label: "DB Host", value: config.systemInfo?.dbHost },
                                { label: "DB Name", value: config.systemInfo?.dbName },
                            ].map((item, i) => (
                                <div key={i} className="ap-row">
                                    <span style={{ color: "var(--ap-muted)", fontSize: 12, fontWeight: 600 }}>{item.label}</span>
                                    <span className="mono" style={{ fontSize: 12 }}>{item.value || "—"}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Paket Tanımları */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaCrown /> Paket Tanımları</div>
                        <div className="ap-grid ap-grid--2">
                            {Object.entries(config.planDefinitions || {}).map(([key, plan]) => {
                                const colors = { trial: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
                                return (
                                    <div key={key} className="ap-card" style={{ background: "rgba(99, 102, 241, 0.03)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                            <div>
                                                <span className={`ap-badge ap-badge--${colors[key]}`} style={{ fontSize: 12, padding: "4px 12px" }}>
                                                    {plan.name}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ap-text)" }}>
                                                ₺{plan.price}
                                                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ap-muted)" }}>/ay</span>
                                            </div>
                                        </div>
                                        <div className="ap-list">
                                            <div className="ap-row">
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Maks Ürün</span>
                                                <span style={{ fontWeight: 600 }}>{plan.limits?.maxProducts?.toLocaleString("tr-TR")}</span>
                                            </div>
                                            <div className="ap-row">
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Maks Sipariş</span>
                                                <span style={{ fontWeight: 600 }}>{plan.limits?.maxOrders?.toLocaleString("tr-TR")}</span>
                                            </div>
                                            <div className="ap-row">
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Maks Pazaryeri</span>
                                                <span style={{ fontWeight: 600 }}>{plan.limits?.maxMarketplaces}</span>
                                            </div>
                                            <div className="ap-row">
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>API Çağrı</span>
                                                <span style={{ fontWeight: 600 }}>{plan.limits?.maxApiCalls?.toLocaleString("tr-TR")}</span>
                                            </div>
                                            <div className="ap-row">
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Maks Kullanıcı</span>
                                                <span style={{ fontWeight: 600 }}>{plan.limits?.maxUsers}</span>
                                            </div>
                                            <div className="ap-row">
                                                <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Süre</span>
                                                <span style={{ fontWeight: 600 }}>{plan.duration} gün</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Aktif Özellikler */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaCheckCircle /> Aktif Özellikler</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {Object.entries(config.features || {}).map(([key, enabled]) => (
                                <div
                                    key={key}
                                    className={`ap-badge ap-badge--${enabled ? "green" : "red"}`}
                                    style={{ padding: "6px 14px", fontSize: 12 }}
                                >
                                    {enabled ? <FaCheckCircle /> : <FaTimesCircle />}
                                    {key}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Limitler */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaCog /> Global Limitler</div>
                        <div className="ap-list">
                            {Object.entries(config.limits || {}).map(([key, value]) => {
                                const labels = { maxUploadSize: "Maks Upload Boyutu", apiRateLimit: "API Rate Limit", sessionTimeout: "Oturum Süresi" };
                                return (
                                    <div key={key} className="ap-row">
                                        <span style={{ color: "var(--ap-muted)", fontSize: 12, fontWeight: 600 }}>{labels[key] || key}</span>
                                        <span style={{ fontWeight: 700, color: "var(--ap-text2)" }}>{value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default SaasSystemConfig;
