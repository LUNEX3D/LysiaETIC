import React, { useEffect, useState } from "react";
import { FaTachometerAlt, FaSearch, FaExclamationTriangle, FaExclamationCircle } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getUsageStats } from "../services/saasAdminApi";

const SaasUsage = () => {
    const [usage, setUsage] = useState([]);
    const [overLimitUsers, setOverLimitUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    useEffect(() => { loadUsage(); }, []);

    const loadUsage = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getUsageStats();
            setUsage(res.data.usage || []);
            setOverLimitUsers(res.data.overLimitUsers || []);
        } catch (err) {
            console.error(err);
            setError("Kullanım verileri alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const filtered = usage.filter(u => {
        const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" ||
            (filter === "overlimit" && (u.overLimit?.products || u.overLimit?.orders || u.overLimit?.marketplaces));
        return matchSearch && matchFilter;
    });

    const pct = (used, max) => {
        if (!max || max === 0) return 0;
        return Math.min(Math.round((used / max) * 100), 100);
    };

    const barColor = (used, max) => {
        const p = pct(used, max);
        if (p >= 90) return "red";
        if (p >= 70) return "yellow";
        return "green";
    };

    return (
        <AdminLayout
            title="Kullanım & Limitler"
            subtitle="Firma bazlı kaynak kullanımını izle, limit aşımlarını tespit et"
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* Limit Aşımı Uyarısı */}
            {overLimitUsers.length > 0 && (
                <div className="ap-alert ap-alert--warn">
                    <FaExclamationCircle />
                    <strong>{overLimitUsers.length} firma</strong> limit aşımında! Aşağıda kırmızı ile işaretlendi.
                </div>
            )}

            {/* KPI */}
            <div className="ap-kpi-grid">
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--purple"><FaTachometerAlt /></div>
                    <div className="ap-kpi-label">Toplam Firma</div>
                    <div className="ap-kpi-val">{usage.length}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--red"><FaExclamationCircle /></div>
                    <div className="ap-kpi-label">Limit Aşımı</div>
                    <div className="ap-kpi-val">{overLimitUsers.length}</div>
                    <div className="ap-kpi-sub">Dikkat gerektirir</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Firma ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">Tüm Firmalar</option>
                        <option value="overlimit">Limit Aşanlar</option>
                    </select>
                    <span className="ap-toolbar-count">{filtered.length} firma</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Firma</th>
                                    <th>Plan</th>
                                    <th>Ürün Kullanımı</th>
                                    <th>Sipariş Kullanımı</th>
                                    <th>Pazaryeri</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(u => {
                                    const isOver = u.overLimit?.products || u.overLimit?.orders || u.overLimit?.marketplaces;
                                    const planColors = { free: "yellow", trial: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
                                    return (
                                        <tr key={u.userId} style={isOver ? { background: "rgba(248, 113, 113, 0.04)" } : {}}>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                                                    <div className="mono" style={{ fontSize: 11 }}>{u.email}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`ap-badge ap-badge--${planColors[u.plan] || "neutral"}`}>
                                                    {u.plan?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                                        <span>{u.usage?.products || 0} / {u.limits?.maxProducts || 0}</span>
                                                        <span style={{ color: u.overLimit?.products ? "var(--ap-red)" : "var(--ap-muted)" }}>
                                                            {pct(u.usage?.products, u.limits?.maxProducts)}%
                                                        </span>
                                                    </div>
                                                    <div className="ap-progress">
                                                        <div
                                                            className={`ap-progress-bar ap-progress-bar--${barColor(u.usage?.products, u.limits?.maxProducts)}`}
                                                            style={{ width: `${pct(u.usage?.products, u.limits?.maxProducts)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                                        <span>{u.usage?.orders || 0} / {u.limits?.maxOrders || 0}</span>
                                                        <span style={{ color: u.overLimit?.orders ? "var(--ap-red)" : "var(--ap-muted)" }}>
                                                            {pct(u.usage?.orders, u.limits?.maxOrders)}%
                                                        </span>
                                                    </div>
                                                    <div className="ap-progress">
                                                        <div
                                                            className={`ap-progress-bar ap-progress-bar--${barColor(u.usage?.orders, u.limits?.maxOrders)}`}
                                                            style={{ width: `${pct(u.usage?.orders, u.limits?.maxOrders)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                    {u.usage?.marketplaces || 0} / {u.limits?.maxMarketplaces || 0}
                                                </span>
                                            </td>
                                            <td>
                                                {isOver ? (
                                                    <span className="ap-badge ap-badge--red">LİMİT AŞIMI</span>
                                                ) : (
                                                    <span className="ap-badge ap-badge--green">Normal</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasUsage;
