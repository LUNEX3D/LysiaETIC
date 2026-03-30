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

const AdminServers = () => {
    const [systemStatus, setSystemStatus] = useState(null);
    const [servers, setServers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("overview");
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);

    const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

    const loadData = useCallback(async () => {
        try {
            const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
            const [statusRes, serversRes] = await Promise.all([
                axios.get("/admin/system/status", { headers: h }),
                axios.get("/admin/system/servers", { headers: h })
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
            const res = await axios.get("/admin/system/logs", { headers: getHeaders() });
            setLogs(res.data.logs || []);
        } catch (err) {
            console.error("Log yükleme hatası:", err);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { if (activeTab === "logs") loadLogs(); }, [activeTab, loadLogs]);
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, loadData]);

    const getStatusIcon = (status) => {
        if (status === "online") return <FaCheckCircle style={{ color: "var(--ap-green)" }} />;
        if (status === "offline") return <FaTimesCircle style={{ color: "var(--ap-red)" }} />;
        return <FaExclamationTriangle style={{ color: "var(--ap-yellow)" }} />;
    };

    const getServerTypeIcon = (type) => {
        if (type === "api") return <FaServer />;
        if (type === "web") return <FaGlobe />;
        if (type === "database") return <FaDatabase />;
        return <FaNetworkWired />;
    };

    const getServerIconColor = (type) => {
        if (type === "api") return "ap-kpi-icon--purple";
        if (type === "web") return "ap-kpi-icon--blue";
        if (type === "database") return "ap-kpi-icon--green";
        return "ap-kpi-icon--cyan";
    };

    const formatUptime = (uptime) => uptime?.formatted || "-";

    const getMemoryColor = (percent) => {
        if (percent >= 90) return "var(--ap-red)";
        if (percent >= 70) return "var(--ap-yellow)";
        return "var(--ap-green)";
    };

    const getMemoryBarClass = (percent) => {
        if (percent >= 90) return "ap-progress-bar--red";
        if (percent >= 70) return "ap-progress-bar--yellow";
        return "ap-progress-bar--green";
    };

    const renderOverview = () => {
        if (!systemStatus) return null;
        const { server, cpu, memory, database, users } = systemStatus;

        return (
            <>
                {/* KPI Cards */}
                <div className="ap-kpi-grid">
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaClock /></div>
                        <div className="ap-kpi-label">Uptime</div>
                        <div className="ap-kpi-val" style={{ fontSize: 22 }}>{formatUptime(server.uptime)}</div>
                        <div className="ap-kpi-sub">Sunucu çalışma süresi</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--blue"><FaMicrochip /></div>
                        <div className="ap-kpi-label">CPU</div>
                        <div className="ap-kpi-val">%{cpu.usage}</div>
                        <div className="ap-kpi-sub">{cpu.cores} çekirdek</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--yellow"><FaMemory /></div>
                        <div className="ap-kpi-label">RAM</div>
                        <div className="ap-kpi-val" style={{ color: getMemoryColor(memory.system.usagePercent) }}>
                            %{memory.system.usagePercent}
                        </div>
                        <div className="ap-kpi-sub">{memory.system.used} / {memory.system.total}</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--green"><FaDatabase /></div>
                        <div className="ap-kpi-label">Veritabanı</div>
                        <div className="ap-kpi-val" style={{ fontSize: 22, color: database.connected ? "var(--ap-green)" : "var(--ap-red)" }}>
                            {database.state}
                        </div>
                        <div className="ap-kpi-sub">{database.name}</div>
                    </div>
                </div>

                {/* Server Cards */}
                <div className="ap-card">
                    <div className="ap-card-head"><FaServer /> Kayıtlı Sunucular</div>
                    <div className="ap-grid ap-grid--3">
                        {servers.map(srv => (
                            <div key={srv.id} className="ap-server-card">
                                <div className="ap-server-status">{getStatusIcon(srv.status)}</div>
                                <div className="ap-server-head">
                                    <div className={`ap-server-icon ap-kpi-icon ${getServerIconColor(srv.type)}`}>
                                        {getServerTypeIcon(srv.type)}
                                    </div>
                                    <div>
                                        <div className="ap-server-name">{srv.name}</div>
                                        <div className="ap-server-desc">{srv.description}</div>
                                    </div>
                                </div>
                                <div className="ap-list">
                                    <div className="ap-row">
                                        <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>URL</span>
                                        <span className="mono" style={{ fontSize: 11 }}>{srv.url}</span>
                                    </div>
                                    <div className="ap-row">
                                        <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Port</span>
                                        <span className="mono">{srv.port || "-"}</span>
                                    </div>
                                    {srv.memory && (
                                        <div className="ap-row">
                                            <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Bellek</span>
                                            <span className="mono">{srv.memory}</span>
                                        </div>
                                    )}
                                    {srv.uptime && (
                                        <div className="ap-row">
                                            <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Uptime</span>
                                            <span className="mono">{Math.floor(srv.uptime / 60)}dk</span>
                                        </div>
                                    )}
                                </div>
                                {srv.healthCheck && (
                                    <a
                                        href={srv.url + srv.healthCheck}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ap-btn ap-btn--ghost ap-btn--sm"
                                        style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
                                    >
                                        <FaExternalLinkAlt /> Arayüze Git
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Details */}
                <div className="ap-grid ap-grid--2">
                    <div className="ap-card">
                        <div className="ap-card-head"><FaHdd /> Sistem Bilgileri</div>
                        <div className="ap-list">
                            <div className="ap-row">
                                <span>Hostname</span>
                                <span className="mono">{server.hostname}</span>
                            </div>
                            <div className="ap-row">
                                <span>Platform</span>
                                <span className="mono">{server.platform} ({server.arch})</span>
                            </div>
                            <div className="ap-row">
                                <span>Node.js</span>
                                <span className="mono">{server.nodeVersion}</span>
                            </div>
                            <div className="ap-row">
                                <span>Ortam</span>
                                <span className={`ap-badge ${server.env === "production" ? "ap-badge--green" : "ap-badge--yellow"}`}>
                                    {server.env}
                                </span>
                            </div>
                            <div className="ap-row">
                                <span>PID</span>
                                <span className="mono">{server.pid}</span>
                            </div>
                            {systemStatus.os?.loadAvg && (
                                <div className="ap-row">
                                    <span>Load Average</span>
                                    <span className="mono">{systemStatus.os.loadAvg.join(" / ")}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ap-card">
                        <div className="ap-card-head"><FaChartBar /> Bellek Detayları</div>
                        <div className="ap-list">
                            <div className="ap-row">
                                <span>Sistem RAM</span>
                                <span className="mono">{memory.system.used} / {memory.system.total}</span>
                            </div>
                            <div className="ap-row">
                                <span>Heap Used</span>
                                <span className="mono">{memory.process.heapUsed}</span>
                            </div>
                            <div className="ap-row">
                                <span>Heap Total</span>
                                <span className="mono">{memory.process.heapTotal}</span>
                            </div>
                            <div className="ap-row">
                                <span>RSS</span>
                                <span className="mono">{memory.process.rss}</span>
                            </div>
                            <div className="ap-row">
                                <span>External</span>
                                <span className="mono">{memory.process.external}</span>
                            </div>
                        </div>
                        <div style={{ marginTop: 18 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, color: "var(--ap-muted)" }}>
                                <span>RAM Kullanımı</span>
                                <span style={{ color: getMemoryColor(memory.system.usagePercent), fontWeight: 700 }}>
                                    %{memory.system.usagePercent}
                                </span>
                            </div>
                            <div className="ap-progress">
                                <div
                                    className={`ap-progress-bar ${getMemoryBarClass(memory.system.usagePercent)}`}
                                    style={{ width: `${memory.system.usagePercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Stats */}
                <div className="ap-card">
                    <div className="ap-card-head"><FaChartBar /> Kullanıcı İstatistikleri</div>
                    <div className="ap-kpi-grid" style={{ marginTop: 4 }}>
                        <div className="ap-stat-mini">
                            <div className="ap-stat-mini-val" style={{ color: "var(--ap-primary)" }}>{users.total}</div>
                            <div className="ap-stat-mini-label">Toplam Kullanıcı</div>
                        </div>
                        <div className="ap-stat-mini">
                            <div className="ap-stat-mini-val" style={{ color: "var(--ap-red)" }}>{users.admins}</div>
                            <div className="ap-stat-mini-label">Admin Sayısı</div>
                        </div>
                        <div className="ap-stat-mini">
                            <div className="ap-stat-mini-val" style={{ color: "var(--ap-blue)" }}>{users.activeToday}</div>
                            <div className="ap-stat-mini-label">Bugün Aktif</div>
                        </div>
                        <div className="ap-stat-mini">
                            <div className="ap-stat-mini-val" style={{ color: "var(--ap-green)" }}>{servers.length}</div>
                            <div className="ap-stat-mini-label">Aktif Sunucu</div>
                        </div>
                    </div>
                </div>

                {/* Network */}
                {systemStatus.os?.networkInterfaces && Object.keys(systemStatus.os.networkInterfaces).length > 0 && (
                    <div className="ap-card">
                        <div className="ap-card-head"><FaNetworkWired /> Ağ Arayüzleri</div>
                        <div className="ap-list">
                            {Object.entries(systemStatus.os.networkInterfaces).map(([name, ip]) => (
                                <div key={name} className="ap-row">
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
        <div className="ap-card">
            <div className="ap-card-head"><FaTerminal /> Sistem Logları</div>
            {logs.length === 0 && <div className="ap-empty">Log dosyası bulunamadı.</div>}
            {logs.map((logFile, idx) => (
                <div key={idx} style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--ap-text2)" }}>
                        📄 {logFile.file}
                    </div>
                    <div className="ap-terminal">
                        {logFile.lines.slice(-30).map((line, i) => (
                            <div key={i} className="ap-log-line">
                                <span className="ap-log-time">
                                    {line.timestamp ? new Date(line.timestamp).toLocaleTimeString("tr-TR") : ""}
                                </span>
                                <span className={`ap-log-level ap-log-level--${line.level || "info"}`}>
                                    {line.level || "info"}
                                </span>
                                <span className="ap-log-msg">{line.message}</span>
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
                <div className="ap-actions">
                    <button
                        className={`ap-btn ${autoRefresh ? "ap-btn--primary" : "ap-btn--ghost"}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        <FaSync />
                        {autoRefresh ? "Oto-Yenileme: Açık" : "Oto-Yenileme: Kapalı"}
                    </button>
                    <button className="ap-btn ap-btn--ghost" onClick={() => { setLoading(true); loadData(); }}>
                        <FaSync /> Yenile
                    </button>
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}
            {loading && <div className="ap-loading">Sistem verileri yükleniyor...</div>}

            {!loading && (
                <>
                    {/* Tabs */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div className="ap-tabs">
                            {[
                                { key: "overview", label: "Genel Bakış", icon: <FaServer /> },
                                { key: "logs", label: "Loglar", icon: <FaTerminal /> }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    className={`ap-tab ${activeTab === tab.key ? "ap-tab--active" : ""}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                        {lastRefresh && (
                            <span style={{ fontSize: 12, color: "var(--ap-muted)", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                                <FaClock /> Son: {lastRefresh.toLocaleTimeString("tr-TR")}
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
