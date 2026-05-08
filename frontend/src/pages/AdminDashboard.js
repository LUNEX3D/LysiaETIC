import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    FaUsers, FaBuilding, FaCrown, FaCreditCard, FaPlug,
    FaChartBar, FaBullhorn, FaTicketAlt, FaHistory, FaCog,
    FaArrowRight, FaBolt, FaServer, FaChartLine, FaBoxOpen,
    FaClipboardList, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaClock, FaArrowUp, FaArrowDown, FaSync,
    FaDatabase, FaMemory, FaMicrochip, FaBug
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getDashboardMetrics } from "../services/saasAdminApi";

const AdminDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getDashboardMetrics();
            setData(res.data);
            setLastRefresh(new Date());
        } catch (err) {
            console.error(err);
            setError("Dashboard verileri alınamadı. Lütfen tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(loadData, 60000);
        return () => clearInterval(interval);
    }, [loadData]);

    const fmt = (n) => {
        if (n === undefined || n === null) return "0";
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(1) + "K";
        return n.toLocaleString("tr-TR");
    };

    const fmtMoney = (n) => {
        if (!n) return "₺0";
        return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const fmtUptime = (seç) => {
        if (!seç) return "—";
        const d = Math.floor(seç / 86400);
        const h = Math.floor((seç % 86400) / 3600);
        const m = Math.floor((seç % 3600) / 60);
        if (d > 0) return `${d}g ${h}s ${m}dk`;
        if (h > 0) return `${h}s ${m}dk`;
        return `${m}dk`;
    };

    return (
        <AdminLayout
            title="SaaS Dashboard"
            subtitle="Platform genel görünüm — tüm metrikleri tek ekârandan izle"
            actions={
                <div className="ap-actions">
                    {lastRefresh && (
                        <span style={{ fontSize: 11, color: "var(--ap-muted)", marginRight: 8 }}>
                            Son: {lastRefresh.toLocaleTimeString("tr-TR")}
                        </span>
                    )}
                    <button className="ap-btn ap-btn--ghost" onClick={loadData} disabled={loading}>
                        <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                    </button>
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}
            {loading && !data && <div className="ap-loading">Dashboard yükleniyor...</div>}

            {data && (
                <>
                    {/* ═══ KPI CARDS — Ana Metrikler ═══ */}
                    <div className="ap-kpi-grid">
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--purple"><FaUsers /></div>
                            <div className="ap-kpi-label">Toplam Kullanıcı</div>
                            <div className="ap-kpi-val">{fmt(data.users?.total)}</div>
                            <div className="ap-kpi-sub">
                                <FaArrowUp style={{ color: "var(--ap-green)", fontSize: 10 }} />
                                <span style={{ color: "var(--ap-green)" }}>+{data.users?.todayRegistrations || 0}</span> bugün
                            </div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--green"><FaCrown /></div>
                            <div className="ap-kpi-label">Aktif Abonelik</div>
                            <div className="ap-kpi-val">{fmt(data.subscriptions?.active)}</div>
                            <div className="ap-kpi-sub">
                                {data.subscriptions?.trial || 0} deneme · {data.subscriptions?.expired || 0} süresi dolmuş
                            </div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--blue"><FaCreditCard /></div>
                            <div className="ap-kpi-label">Platform Geliri</div>
                            <div className="ap-kpi-val">{fmtMoney(data.payments?.platformRevenue)}</div>
                            <div className="ap-kpi-sub">
                                Bu ay: {fmtMoney(data.payments?.monthlyRevenue)}
                            </div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--orange"><FaClipboardList /></div>
                            <div className="ap-kpi-label">Toplam Sipariş</div>
                            <div className="ap-kpi-val">{fmt(data.orders?.total)}</div>
                            <div className="ap-kpi-sub">
                                Bugün: {data.orders?.today || 0} · Hafta: {data.orders?.week || 0}
                            </div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaPlug /></div>
                            <div className="ap-kpi-label">Entegrasyon</div>
                            <div className="ap-kpi-val">{fmt(data.integrations?.total)}</div>
                            <div className="ap-kpi-sub">
                                {data.integrations?.distribution?.length || 0} farklı platform
                            </div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--yellow"><FaBoxOpen /></div>
                            <div className="ap-kpi-label">Toplam Ürün</div>
                            <div className="ap-kpi-val">{fmt(data.products?.total)}</div>
                            <div className="ap-kpi-sub">Tüm firmalar</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--red"><FaTicketAlt /></div>
                            <div className="ap-kpi-label">Açık Ticket</div>
                            <div className="ap-kpi-val">{fmt(data.tickets?.open)}</div>
                            <div className="ap-kpi-sub">Toplam: {data.tickets?.total || 0}</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--green"><FaCheckCircle /></div>
                            <div className="ap-kpi-label">Aktif Kullanıcı</div>
                            <div className="ap-kpi-val">{fmt(data.users?.active)}</div>
                            <div className="ap-kpi-sub">Son 7 gün</div>
                        </div>
                    </div>

                    {/* ═══ HIZLI İŞLEMLER ═══ */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaBolt /> Hızlı İşlemler</div>
                        <div className="ap-grid ap-grid--4">
                            {[
                                { to: "/admin/tenants", icon: <FaBuilding />, color: "purple", title: "Firma Yönetimi", sub: "Firmalar, durum, askıya alma" },
                                { to: "/admin/subscriptions", icon: <FaCrown />, color: "green", title: "Abonelik Yönetimi", sub: "Paket oluştur, plan değiştir" },
                                { to: "/admin/payments", icon: <FaCreditCard />, color: "blue", title: "Ödeme & Fatura", sub: "Ödeme geçmişi, faturalar" },
                                { to: "/admin/tickets", icon: <FaTicketAlt />, color: "orange", title: "Destek Talepleri", sub: `${data.tickets?.open || 0} açık ticket` },
                                { to: "/admin/integrations", icon: <FaPlug />, color: "cyan", title: "Entegrasyonlar", sub: "Pazaryeri bağlantıları" },
                                { to: "/admin/usage", icon: <FaChartLine />, color: "yellow", title: "Kullanım & Limitler", sub: "Limit aşımı kontrolü" },
                                { to: "/admin/reports", icon: <FaChartBar />, color: "purple", title: "Global Raporlar", sub: "Gelir, churn, trendler" },
                                { to: "/admin/audit-logs", icon: <FaHistory />, color: "red", title: "İşlem Logları", sub: "Audit trail & izleme" },
                                { to: "/admin/client-errors", icon: <FaBug />, color: "orange", title: "İstemci Hataları", sub: "Frontend hata kayıtları" },
                            ].map((item, i) => (
                                <Link key={i} to={item.to} className="ap-quick">
                                    <div className={`ap-quick-icon ap-quick-icon--${item.color}`}>{item.icon}</div>
                                    <div>
                                        <div className="ap-quick-title">{item.title}</div>
                                        <div className="ap-quick-sub">{item.sub}</div>
                                    </div>
                                    <FaArrowRight className="ap-quick-arrow" />
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* ═══ İKİ SÜTUN: Kayıt Trendi + Plan Dağılımı ═══ */}
                    <div className="ap-grid ap-grid--2">
                        {/* Kayıt Trendi */}
                        <div className="ap-card">
                            <div className="ap-card-head"><FaChartLine /> Son 7 Gün Kayıt Trendi</div>
                            <div className="ap-chart-bars">
                                {(data.users?.registrationTrend || []).map((day, i) => {
                                    const max = Math.max(...(data.users?.registrationTrend || []).map(d => d.count), 1);
                                    const pct = (day.count / max) * 100;
                                    return (
                                        <div key={i} className="ap-chart-bar-col">
                                            <div className="ap-chart-bar-val">{day.count}</div>
                                            <div className="ap-chart-bar-track">
                                                <div
                                                    className="ap-chart-bar-fill"
                                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                                />
                                            </div>
                                            <div className="ap-chart-bar-label">{day.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="ap-card-footer">
                                <span>Bu hafta: <strong>{data.users?.weekRegistrations || 0}</strong></span>
                                <span>Bu ay: <strong>{data.users?.monthRegistrations || 0}</strong></span>
                            </div>
                        </div>

                        {/* Plan Dağılımı */}
                        <div className="ap-card">
                            <div className="ap-card-head"><FaCrown /> Plan Dağılımı</div>
                            <div className="ap-list">
                                {Object.entries(data.users?.planDistribution || {}).map(([plan, count]) => {
                                    const total = data.users?.total || 1;
                                    const pct = Math.round((count / total) * 100);
                                    const colors = { free: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
                                    const labels = { free: "Ücretsiz / Trial", basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
                                    return (
                                        <div key={plan} className="ap-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span className={`ap-badge ap-badge--${colors[plan] || "neutral"}`}>
                                                        {(labels[plan] || plan).toUpperCase()}
                                                    </span>
                                                    <span className="ap-row-title">{count} firma</span>
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-text2)" }}>{pct}%</span>
                                            </div>
                                            <div className="ap-progress">
                                                <div
                                                    className={`ap-progress-bar ap-progress-bar--${colors[plan] || "purple"}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Rol Dağılımı */}
                            <div className="ap-divider" style={{ margin: "16px 0" }} />
                            <div className="ap-card-head" style={{ fontSize: 13, marginBottom: 12 }}>Rol Dağılımı</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {Object.entries(data.users?.roleDistribution || {}).map(([role, count]) => {
                                    const colors = { admin: "red", dev: "cyan", moderator: "yellow", seller: "green", user: "blue" };
                                    return (
                                        <div key={role} className={`ap-badge ap-badge--${colors[role] || "neutral"}`}>
                                            {role}: {count}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ═══ İKİ SÜTUN: Pazaryeri Dağılımı + Gelir Özeti ═══ */}
                    <div className="ap-grid ap-grid--2">
                        {/* Pazaryeri Dağılımı */}
                        <div className="ap-card">
                            <div className="ap-card-head"><FaPlug /> Pazaryeri Dağılımı</div>
                            <div className="ap-list">
                                {(data.integrations?.distribution || []).length === 0 && (
                                    <div className="ap-empty">Henüz entegrasyon yok.</div>
                                )}
                                {(data.integrations?.distribution || []).map((mp, i) => {
                                    const total = data.integrations?.total || 1;
                                    const pct = Math.round((mp.count / total) * 100);
                                    return (
                                        <div key={i} className="ap-row">
                                            <div className="ap-row-left">
                                                <div className="ap-kpi-icon ap-kpi-icon--cyan" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>
                                                    <FaPlug />
                                                </div>
                                                <div>
                                                    <div className="ap-row-title">{mp.name || "Bilinmeyen"}</div>
                                                    <div className="ap-row-sub">{mp.count} entegrasyon</div>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div className="ap-progress" style={{ width: 80 }}>
                                                    <div className="ap-progress-bar ap-progress-bar--blue" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="ap-badge ap-badge--cyan">{pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Gelir Özeti */}
                        <div className="ap-card">
                            <div className="ap-card-head"><FaCreditCard /> Gelir Özeti</div>
                            <div className="ap-list">
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--green" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>
                                            <FaCreditCard />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Toplam Platform Geliri</div>
                                            <div className="ap-row-sub">Tüm zamanlar</div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ap-green)" }}>
                                        {fmtMoney(data.payments?.platformRevenue)}
                                    </span>
                                </div>
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--blue" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>
                                            <FaChartLine />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Bu Ay Gelir</div>
                                            <div className="ap-row-sub">Son 30 gün</div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ap-blue)" }}>
                                        {fmtMoney(data.payments?.monthlyRevenue)}
                                    </span>
                                </div>
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--orange" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>
                                            <FaClipboardList />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Sipariş Geliri</div>
                                            <div className="ap-row-sub">Firma siparişleri toplamı</div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ap-orange)" }}>
                                        {fmtMoney(data.orders?.totalRevenue)}
                                    </span>
                                </div>
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--purple" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>
                                            <FaCheckCircle />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Tamamlanan Ödeme</div>
                                            <div className="ap-row-sub">Başarılı işlem sayısı</div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ap-primary)" }}>
                                        {data.payments?.totalCompleted || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ SİSTEM DURUMU ═══ */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaServer /> Sistem Durumu</div>
                        <div className="ap-grid ap-grid--4">
                            <div className="ap-stat-mini">
                                <FaServer style={{ fontSize: 20, color: data.system?.dbConnected ? "var(--ap-green)" : "var(--ap-red)" }} />
                                <div className="ap-stat-mini-label">Veritabanı</div>
                                <span className={`ap-badge ap-badge--${data.system?.dbConnected ? "green" : "red"}`}>
                                    {data.system?.dbConnected ? "Bağlı ✅" : "Bağlantı Yok ❌"}
                                </span>
                            </div>
                            <div className="ap-stat-mini">
                                <FaClock style={{ fontSize: 20, color: "var(--ap-blue)" }} />
                                <div className="ap-stat-mini-label">Uptime</div>
                                <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>
                                    {fmtUptime(data.system?.uptime)}
                                </div>
                            </div>
                            <div className="ap-stat-mini">
                                <FaMicrochip style={{ fontSize: 20, color: "var(--ap-yellow)" }} />
                                <div className="ap-stat-mini-label">CPU Kullanımı</div>
                                <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>
                                    %{data.system?.cpuUsage || 0}
                                </div>
                                <div className="ap-progress" style={{ width: "100%" }}>
                                    <div
                                        className={`ap-progress-bar ap-progress-bar--${(data.system?.cpuUsage || 0) > 80 ? "red" : (data.system?.cpuUsage || 0) > 50 ? "yellow" : "green"}`}
                                        style={{ width: `${data.system?.cpuUsage || 0}%` }}
                                    />
                                </div>
                            </div>
                            <div className="ap-stat-mini">
                                <FaMemory style={{ fontSize: 20, color: "var(--ap-purple)" }} />
                                <div className="ap-stat-mini-label">RAM Kullanımı</div>
                                <div className="ap-stat-mini-val" style={{ fontSize: 16 }}>
                                    %{data.system?.memoryUsage || 0}
                                </div>
                                <div className="ap-progress" style={{ width: "100%" }}>
                                    <div
                                        className={`ap-progress-bar ap-progress-bar--${(data.system?.memoryUsage || 0) > 80 ? "red" : (data.system?.memoryUsage || 0) > 50 ? "yellow" : "green"}`}
                                        style={{ width: `${data.system?.memoryUsage || 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="ap-divider" style={{ margin: "16px 0" }} />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--ap-muted)" }}>
                            <span>Node: <strong style={{ color: "var(--ap-text2)" }}>{data.system?.nodeVersion}</strong></span>
                            <span>Platform: <strong style={{ color: "var(--ap-text2)" }}>{data.system?.platform}</strong></span>
                            <span>CPU Çekirdek: <strong style={{ color: "var(--ap-text2)" }}>{data.system?.cpuCores}</strong></span>
                            <span>RAM: <strong style={{ color: "var(--ap-text2)" }}>{data.system?.memoryTotal}</strong></span>
                            <span>Ortam: <strong style={{ color: "var(--ap-text2)" }}>{data.system?.env}</strong></span>
                            <span>PID: <strong style={{ color: "var(--ap-text2)" }}>{data.system?.pid}</strong></span>
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminDashboard;
