import React, { useEffect, useState, useCallback } from "react";
import {
    FaServer,
    FaDatabase,
    FaGlobe,
    FaMemory,
    FaMicrochip,
    FaClock,
    FaSync,
    FaExternalLinkAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationTriangle,
    FaNetworkWired,
    FaHdd,
    FaTerminal,
    FaChartBar
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";
import "../styles/admin.css";

const AdminServers = () => {
    const [systemStatus, setSystemStatus] = useState(null);
    const [servers, setServers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("overview");
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);

    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

    const loadData = useCallback(async () => {
        try {
            const [statusRes, serversRes] = await Promise.all([
                axios.get("/admin/system/status", { headers }),
                axios.get("/admin/system/servers", { headers })
            ]);

            setSystemStatus(statusRes.data);
            setServers(serversRes.data.servers || []);
            setLastRefresh(new Date());
            setError("");
        } catch (err) {
            console.error(err);
            setError("Sistem verileri alınamadı. Yetkinizi kontrol edin.");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadLogs = useCallback(async () => {
        try {
            const res = await axios.get("/admin/system/logs", { headers });
            setLogs(res.data.logs || []);
        } catch (err) {
            console.error("Log yükleme hatası:", err);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (activeTab === "logs") loadLogs();
    }, [activeTab, loadLogs]);

    // Auto refresh
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, loadData]);

    const getStatusIcon = (status) => {
        if (status === "online") return <FaCheckCircle style={{ color: "#10b981" }} />;
        if (status === "offline") return <FaTimesCircle style={{ color: "#ef4444" }} />;
        return <FaExclamationTriangle style={{ color: "#f59e0b" }} />;
    };

    const getServerTypeIcon = (type) => {
        if (type === "api") return <FaServer />;
        if (type === "web") return <FaGlobe />;
        if (type === "database") return <FaDatabase />;
        return <FaNetworkWired />;
    };

    const formatUptime = (uptime) => {
        if (!uptime) return "-";
        return uptime.formatted || "-";
    };

    const getMemoryColor = (percent) => {
        if (percent >= 90) return "#ef4444";
        if (percent >= 70) return "#f59e0b";
        return "#10b981";
    };

    const renderOverview = () => {
        if (!systemStatus) return null;
        const { server, cpu, memory, database, users } = systemStatus;

        return (
            <>
                {/* KPI Cards */}
                <div className="admin-grid admin-grid--kpi">
                    <div className="admin-card admin-kpi">
                        <div className="admin-kpi-label">
                            <FaClock style={{ marginRight: 6 }} /> Uptime
                        </div>
                        <div className="admin-kpi-value" style={{ fontSize: 20 }}>
                            {formatUptime(server.uptime)}
                        </div>
                        <div className="admin-kpi-foot">Sunucu çalışma süresi</div>
                    </div>
                    <div className="admin-card admin-kpi">
                        <div className="admin-kpi-label">
                            <FaMicrochip style={{ marginRight: 6 }} /> CPU
                        </div>
                        <div className="admin-kpi-value">%{cpu.usage}</div>
                        <div className="admin-kpi-foot">{cpu.cores} çekirdek · {cpu.model.split(" ").slice(0, 3).join(" ")}</div>
                    </div>
                    <div className="admin-card admin-kpi">
                        <div className="admin-kpi-label">
                            <FaMemory style={{ marginRight: 6 }} /> RAM
                        </div>
                        <div className="admin-kpi-value" style={{ color: getMemoryColor(memory.system.usagePercent) }}>
                            %{memory.system.usagePercent}
                        </div>
                        <div className="admin-kpi-foot">{memory.system.used} / {memory.system.total}</div>
                    </div>
                    <div className="admin-card admin-kpi">
                        <div className="admin-kpi-label">
                            <FaDatabase style={{ marginRight: 6 }} /> Veritabanı
                        </div>
                        <div className="admin-kpi-value" style={{ fontSize: 20, color: database.connected ? "#10b981" : "#ef4444" }}>
                            {database.state}
                        </div>
                        <div className="admin-kpi-foot">{database.name} @ {database.host?.split(".")[0]}</div>
                    </div>
                </div>

                {/* Server Cards */}
                <div className="admin-section">
                    <div className="admin-section-title">Kayıtlı Sunucular</div>
                    <div className="admin-grid admin-grid--cards">
                        {servers.map(srv => (
                            <div key={srv.id} className="admin-card" style={{ position: "relative" }}>
                                <div style={{ position: "absolute", top: 16, right: 16 }}>
                                    {getStatusIcon(srv.status)}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                    <div className="admin-feature-icon">
                                        {getServerTypeIcon(srv.type)}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 15 }}>{srv.name}</div>
                                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{srv.description}</div>
                                    </div>
                                </div>
                                <div className="admin-list" style={{ gap: 6 }}>
                                    <div className="admin-list-row" style={{ padding: "8px 12px" }}>
                                        <span style={{ fontSize: 12, color: "var(--muted)" }}>URL</span>
                                        <span className="mono" style={{ fontSize: 11 }}>{srv.url}</span>
                                    </div>
                                    <div className="admin-list-row" style={{ padding: "8px 12px" }}>
                                        <span style={{ fontSize: 12, color: "var(--muted)" }}>Port</span>
                                        <span className="mono">{srv.port || "-"}</span>
                                    </div>
                                    {srv.memory && (
                                        <div className="admin-list-row" style={{ padding: "8px 12px" }}>
                                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Bellek</span>
                                            <span className="mono">{srv.memory}</span>
                                        </div>
                                    )}
                                    {srv.uptime && (
                                        <div className="admin-list-row" style={{ padding: "8px 12px" }}>
                                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Uptime</span>
                                            <span className="mono">{Math.floor(srv.uptime / 60)}dk</span>
                                        </div>
                                    )}
                                </div>
                                {srv.healthCheck && (
                                    <a
                                        href={srv.url + srv.healthCheck}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="admin-btn admin-btn--ghost"
                                        style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                                    >
                                        <FaExternalLinkAlt /> Arayüze Git
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Details */}
                <div className="admin-grid admin-grid--split">
                    <div className="admin-card">
                        <div className="admin-section-title">
                            <FaHdd style={{ marginRight: 8 }} /> Sistem Bilgileri
                        </div>
                        <div className="admin-list">
                            <div className="admin-list-row">
                                <span>Hostname</span>
                                <span className="mono">{server.hostname}</span>
                            </div>
                            <div className="admin-list-row">
                                <span>Platform</span>
                                <span className="mono">{server.platform} ({server.arch})</span>
                            </div>
                            <div className="admin-list-row">
                                <span>Node.js</span>
                                <span className="mono">{server.nodeVersion}</span>
                            </div>
                            <div className="admin-list-row">
                                <span>Ortam</span>
                                <span className={`admin-pill ${server.env === "production" ? "admin-pill--success" : "admin-pill--warn"}`}>
                                    {server.env}
                                </span>
                            </div>
                            <div className="admin-list-row">
                                <span>PID</span>
                                <span className="mono">{server.pid}</span>
                            </div>
                            {systemStatus.os?.loadAvg && (
                                <div className="admin-list-row">
                                    <span>Load Average</span>
                                    <span className="mono">{systemStatus.os.loadAvg.join(" / ")}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="admin-card">
                        <div className="admin-section-title">
                            <FaChartBar style={{ marginRight: 8 }} /> Bellek Detayları
                        </div>
                        <div className="admin-list">
                            <div className="admin-list-row">
                                <span>Sistem RAM</span>
                                <span className="mono">{memory.system.used} / {memory.system.total}</span>
                            </div>
                            <div className="admin-list-row">
                                <span>Heap Used</span>
                                <span className="mono">{memory.process.heapUsed}</span>
                            </div>
                            <div className="admin-list-row">
                                <span>Heap Total</span>
                                <span className="mono">{memory.process.heapTotal}</span>
                            </div>
                            <div className="admin-list-row">
                                <span>RSS</span>
                                <span className="mono">{memory.process.rss}</span>
                            </div>
                            <div className="admin-list-row">
                                <span>External</span>
                                <span className="mono">{memory.process.external}</span>
                            </div>
                        </div>

                        {/* Memory Bar */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "var(--muted)" }}>
                                <span>RAM Kullanımı</span>
                                <span style={{ color: getMemoryColor(memory.system.usagePercent), fontWeight: 600 }}>
                                    %{memory.system.usagePercent}
                                </span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
                                <div style={{
                                    height: "100%",
                                    width: `${memory.system.usagePercent}%`,
                                    borderRadius: 4,
                                    background: getMemoryColor(memory.system.usagePercent),
                                    transition: "width 0.5s ease"
                                }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Stats */}
                <div className="admin-card">
                    <div className="admin-section-title">Kullanıcı İstatistikleri</div>
                    <div className="admin-grid admin-grid--kpi" style={{ marginTop: 12 }}>
                        <div style={{ padding: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid var(--line)", textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{users.total}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Toplam Kullanıcı</div>
                        </div>
                        <div style={{ padding: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid var(--line)", textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: "#b91c1c" }}>{users.admins}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Admin Sayısı</div>
                        </div>
                        <div style={{ padding: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid var(--line)", textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: "#1d4ed8" }}>{users.activeToday}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Bugün Aktif</div>
                        </div>
                        <div style={{ padding: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid var(--line)", textAlign: "center" }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: "#0f766e" }}>{servers.length}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Aktif Sunucu</div>
                        </div>
                    </div>
                </div>

                {/* Network */}
                {systemStatus.os?.networkInterfaces && Object.keys(systemStatus.os.networkInterfaces).length > 0 && (
                    <div className="admin-card">
                        <div className="admin-section-title">
                            <FaNetworkWired style={{ marginRight: 8 }} /> Ağ Arayüzleri
                        </div>
                        <div className="admin-list">
                            {Object.entries(systemStatus.os.networkInterfaces).map(([name, ip]) => (
                                <div key={name} className="admin-list-row">
                                    <span>{name}</span>
                                    <span className="mono">{ip}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderLogs = () => (
        <div className="admin-card">
            <div className="admin-section-title">
                <FaTerminal style={{ marginRight: 8 }} /> Sistem Logları
            </div>
            {logs.length === 0 && <div className="admin-empty">Log dosyası bulunamadı.</div>}
            {logs.map((logFile, idx) => (
                <div key={idx} style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--accent)" }}>
                        📄 {logFile.file}
                    </div>
                    <div style={{
                        background: "#0f172a",
                        borderRadius: 12,
                        padding: 16,
                        maxHeight: 400,
                        overflowY: "auto",
                        fontFamily: "Consolas, monospace",
                        fontSize: 12,
                        lineHeight: 1.8,
                        color: "#e2e8f0"
                    }}>
                        {logFile.lines.slice(-30).map((line, i) => (
                            <div key={i} style={{
                                padding: "2px 0",
                                borderBottom: "1px solid rgba(148,163,184,0.1)",
                                color: line.level === "error" ? "#ef4444" :
                                    line.level === "warn" ? "#f59e0b" :
                                        line.level === "http" ? "#94a3b8" : "#e2e8f0"
                            }}>
                                <span style={{ color: "#64748b", marginRight: 8 }}>
                                    {line.timestamp ? new Date(line.timestamp).toLocaleTimeString("tr-TR") : ""}
                                </span>
                                <span style={{
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    marginRight: 8,
                                    background: line.level === "error" ? "rgba(239,68,68,0.2)" :
                                        line.level === "warn" ? "rgba(245,158,11,0.2)" : "rgba(148,163,184,0.1)",
                                    textTransform: "uppercase"
                                }}>
                                    {line.level || "info"}
                                </span>
                                {line.message}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <AdminLayout
            title="Sunucu Yönetimi"
            subtitle="Sistem durumu, sunucu izleme ve log yönetimi"
            actions={
                <div className="admin-action-row">
                    <button
                        className={`admin-btn ${autoRefresh ? "admin-btn--primary" : "admin-btn--ghost"}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        <FaSync style={{ marginRight: 6 }} />
                        {autoRefresh ? "Otomatik Yenileme: Açık" : "Otomatik Yenileme: Kapalı"}
                    </button>
                    <button className="admin-btn admin-btn--ghost" onClick={() => { setLoading(true); loadData(); }}>
                        <FaSync style={{ marginRight: 6 }} /> Yenile
                    </button>
                </div>
            }
        >
            {error && <div className="admin-alert admin-alert--error">{error}</div>}
            {loading && <div className="admin-loading">Sistem verileri yükleniyor...</div>}

            {!loading && (
                <>
                    {/* Tab Navigation */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        {[
                            { key: "overview", label: "Genel Bakış", icon: <FaServer /> },
                            { key: "logs", label: "Loglar", icon: <FaTerminal /> }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                className={`admin-btn ${activeTab === tab.key ? "admin-btn--primary" : "admin-btn--ghost"}`}
                                onClick={() => setActiveTab(tab.key)}
                                style={{ display: "flex", alignItems: "center", gap: 6 }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                        {lastRefresh && (
                            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                                <FaClock /> Son güncelleme: {lastRefresh.toLocaleTimeString("tr-TR")}
                            </span>
                        )}
                    </div>

                    {activeTab === "overview" && renderOverview()}
                    {activeTab === "logs" && renderLogs()}
                </>
            )}
        </AdminLayout>
    );
};

export default AdminServers;
