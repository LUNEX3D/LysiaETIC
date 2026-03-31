import React, { useEffect, useState } from "react";
import { FaHistory, FaSearch, FaExclamationTriangle, FaSync } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getAuditLogs } from "../services/saasAdminApi";

const SaasAuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [severity, setSeverity] = useState("all");

    useEffect(() => { loadLogs(); }, [category, severity]);

    const loadLogs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getAuditLogs({ category, severity, limit: 300 });
            setLogs(res.data.logs || []);
        } catch (err) {
            console.error(err);
            setError("Loglar alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const filtered = logs.filter(log =>
        !search ||
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.description?.toLowerCase().includes(search.toLowerCase()) ||
        log.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.adminId?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const severityColors = { info: "blue", warning: "yellow", error: "orange", critical: "red" };
    const severityLabels = { info: "Bilgi", warning: "Uyarı", error: "Hata", critical: "Kritik" };
    const categoryLabels = {
        user: "Kullanıcı", subscription: "Abonelik", payment: "Ödeme", product: "Ürün",
        order: "Sipariş", marketplace: "Pazaryeri", system: "Sistem", security: "Güvenlik"
    };
    const categoryColors = {
        user: "purple", subscription: "green", payment: "blue", product: "yellow",
        order: "orange", marketplace: "cyan", system: "neutral", security: "red"
    };

    return (
        <AdminLayout
            title="İşlem Logları (Audit Trail)"
            subtitle="Tüm admin ve kullanıcı işlemlerini izle — debug kralı modu 🔍"
            actions={
                <button className="ap-btn ap-btn--ghost" onClick={loadLogs} disabled={loading}>
                    <FaSync /> Yenile
                </button>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* Toolbar */}
            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="İşlem, açıklama veya kullanıcı ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="all">Tüm Kategoriler</option>
                        <option value="user">Kullanıcı</option>
                        <option value="subscription">Abonelik</option>
                        <option value="payment">Ödeme</option>
                        <option value="product">Ürün</option>
                        <option value="order">Sipariş</option>
                        <option value="marketplace">Pazaryeri</option>
                        <option value="system">Sistem</option>
                        <option value="security">Güvenlik</option>
                    </select>
                    <select className="ap-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                        <option value="all">Tüm Seviyeler</option>
                        <option value="info">Bilgi</option>
                        <option value="warning">Uyarı</option>
                        <option value="error">Hata</option>
                        <option value="critical">Kritik</option>
                    </select>
                    <span className="ap-toolbar-count">{filtered.length} kayıt</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length === 0 && (
                <div className="ap-card"><div className="ap-empty"><FaHistory /> Log bulunamadı.</div></div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-terminal" style={{ maxHeight: "none" }}>
                        {filtered.map((log, i) => (
                            <div key={log._id || i} className="ap-log-line">
                                <span className="ap-log-time">
                                    {new Date(log.createdAt).toLocaleString("tr-TR")}
                                </span>
                                <span className={`ap-log-level ap-log-level--${severityColors[log.severity] === "blue" ? "info" : severityColors[log.severity] === "yellow" ? "warn" : severityColors[log.severity] === "red" ? "error" : "http"}`}>
                                    {severityLabels[log.severity] || log.severity}
                                </span>
                                <span className={`ap-badge ap-badge--${categoryColors[log.category] || "neutral"}`} style={{ fontSize: 9, padding: "1px 6px" }}>
                                    {categoryLabels[log.category] || log.category}
                                </span>
                                <span className="ap-log-msg" style={{ flex: 1 }}>
                                    <strong style={{ color: "var(--ap-text2)" }}>{log.action}</strong>
                                    {log.description && <span style={{ marginLeft: 8, color: "var(--ap-muted)" }}>— {log.description}</span>}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--ap-muted)", flexShrink: 0 }}>
                                    {log.adminId?.name && <span>Admin: {log.adminId.name}</span>}
                                    {log.userId?.name && <span style={{ marginLeft: 8 }}>User: {log.userId.name}</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasAuditLogs;
