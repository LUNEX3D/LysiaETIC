import React, { useEffect, useState } from "react";
import { FaChartBar, FaArrowUp, FaArrowDown, FaCrown, FaExclamationTriangle, FaSync } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getGlobalReports } from "../services/saasAdminApi";

const SaasReports = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => { loadReports(); }, []);

    const loadReports = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getGlobalReports();
            setData(res.data);
        } catch (err) {
            console.error(err);
            setError("Raporlar alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const fmtMoney = (n) => "₺" + (n || 0).toLocaleString("tr-TR");

    return (
        <AdminLayout
            title="Global Raporlama"
            subtitle="Platform geliri, churn, trendler ve en çok kazandıran firmalar"
            actions={
                <button className="ap-btn ap-btn--ghost" onClick={loadReports} disabled={loading}>
                    <FaSync /> Yenile
                </button>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}
            {loading && !data && <div className="ap-loading">Raporlar yükleniyor...</div>}

            {data && (
                <>
                    {/* KPI */}
                    <div className="ap-kpi-grid">
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--green"><FaChartBar /></div>
                            <div className="ap-kpi-label">Bu Ay Gelir</div>
                            <div className="ap-kpi-val">{fmtMoney(data.monthlyRevenue)}</div>
                            <div className="ap-kpi-sub">
                                {parseFloat(data.revenueGrowth) > 0 ? (
                                    <><FaArrowUp style={{ color: "var(--ap-green)", fontSize: 10 }} /> <span style={{ color: "var(--ap-green)" }}>%{data.revenueGrowth}</span> büyüme</>
                                ) : parseFloat(data.revenueGrowth) < 0 ? (
                                    <><FaArrowDown style={{ color: "var(--ap-red)", fontSize: 10 }} /> <span style={{ color: "var(--ap-red)" }}>%{data.revenueGrowth}</span> düşüş</>
                                ) : (
                                    <span>Önceki ay ile aynı</span>
                                )}
                            </div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--blue"><FaChartBar /></div>
                            <div className="ap-kpi-label">Önceki Ay Gelir</div>
                            <div className="ap-kpi-val">{fmtMoney(data.prevMonthRevenue)}</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaCrown /></div>
                            <div className="ap-kpi-label">Yeni Abonelik</div>
                            <div className="ap-kpi-val">{data.newSubscriptions || 0}</div>
                            <div className="ap-kpi-sub">Son 30 gün</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--red"><FaExclamationTriangle /></div>
                            <div className="ap-kpi-label">Churn (İptal)</div>
                            <div className="ap-kpi-val">{data.churnCount || 0}</div>
                            <div className="ap-kpi-sub">Oran: %{data.churnRate || 0}</div>
                        </div>
                    </div>

                    <div className="ap-grid ap-grid--2">
                        {/* Günlük Gelir Trendi */}
                        <div className="ap-card">
                            <div className="ap-card-head"><FaChartBar /> Son 30 Gün Gelir Trendi</div>
                            <div className="ap-chart-bars ap-chart-bars--wide">
                                {(data.dailyRevenue || []).map((day, i) => {
                                    const max = Math.max(...(data.dailyRevenue || []).map(d => d.revenue), 1);
                                    const pct = (day.revenue / max) * 100;
                                    return (
                                        <div key={i} className="ap-chart-bar-col ap-chart-bar-col--sm">
                                            <div className="ap-chart-bar-track">
                                                <div
                                                    className="ap-chart-bar-fill ap-chart-bar-fill--green"
                                                    style={{ height: `${Math.max(pct, 2)}%` }}
                                                />
                                            </div>
                                            {i % 5 === 0 && (
                                                <div className="ap-chart-bar-label">{day.date?.slice(5)}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Plan Bazlı Gelir */}
                        <div className="ap-card">
                            <div className="ap-card-head"><FaCrown /> Plan Bazlı Gelir</div>
                            <div className="ap-list">
                                {(data.revenueByPlan || []).length === 0 && (
                                    <div className="ap-empty">Henüz veri yok.</div>
                                )}
                                {(data.revenueByPlan || []).map((item, i) => {
                                    const planColors = { trial: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
                                    const planLabels = { trial: "Trial", basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
                                    return (
                                        <div key={i} className="ap-row">
                                            <div className="ap-row-left">
                                                <span className={`ap-badge ap-badge--${planColors[item._id] || "neutral"}`}>
                                                    {planLabels[item._id] || item._id}
                                                </span>
                                                <span className="ap-row-title">{item.count} abonelik</span>
                                            </div>
                                            <span style={{ fontWeight: 700, color: "var(--ap-green)" }}>
                                                {fmtMoney(item.totalPrice)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* En Çok Kazandıran Firmalar */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaChartBar /> En Çok Kazandıran Firmalar (Top 10)</div>
                        {(data.topRevenueTenants || []).length === 0 ? (
                            <div className="ap-empty">Henüz veri yok.</div>
                        ) : (
                            <div className="ap-table-wrap">
                                <table className="ap-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Firma</th>
                                            <th>Sipariş Sayısı</th>
                                            <th>Toplam Gelir</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.topRevenueTenants || []).map((tenant, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <span className={`ap-badge ap-badge--${i < 3 ? "green" : "neutral"}`}>
                                                        #{i + 1}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{tenant.name || "—"}</div>
                                                        <div className="mono" style={{ fontSize: 11 }}>{tenant.email || "—"}</div>
                                                    </div>
                                                </td>
                                                <td>{tenant.orderCount?.toLocaleString("tr-TR") || 0}</td>
                                                <td style={{ fontWeight: 700, color: "var(--ap-green)" }}>
                                                    {fmtMoney(tenant.totalRevenue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default SaasReports;
