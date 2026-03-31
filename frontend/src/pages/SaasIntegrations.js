import React, { useEffect, useState } from "react";
import { FaPlug, FaSearch, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaBoxOpen, FaClipboardList } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getAllIntegrations } from "../services/saasAdminApi";

const SaasIntegrations = () => {
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    useEffect(() => { loadIntegrations(); }, []);

    const loadIntegrations = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getAllIntegrations();
            setIntegrations(res.data.integrations || []);
        } catch (err) {
            console.error(err);
            setError("Entegrasyonlar alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const filtered = integrations.filter(i => {
        const matchSearch = !search ||
            i.marketplaceName?.toLowerCase().includes(search.toLowerCase()) ||
            i.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            i.userId?.email?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || i.marketplaceName?.toLowerCase() === filter.toLowerCase();
        return matchSearch && matchFilter;
    });

    const uniqueMarketplaces = [...new Set(integrations.map(i => i.marketplaceName).filter(Boolean))];

    // Marketplace bazlı istatistikler
    const mpStats = {};
    integrations.forEach(i => {
        const name = i.marketplaceName || "Diğer";
        if (!mpStats[name]) mpStats[name] = { count: 0, products: 0, orders: 0 };
        mpStats[name].count++;
        mpStats[name].products += i.productCount || 0;
        mpStats[name].orders += i.orderCount || 0;
    });

    return (
        <AdminLayout
            title="Entegrasyon Kontrolü"
            subtitle="Tüm pazaryeri bağlantılarını izle ve kontrol et"
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* KPI Cards */}
            <div className="ap-kpi-grid">
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaPlug /></div>
                    <div className="ap-kpi-label">Toplam Entegrasyon</div>
                    <div className="ap-kpi-val">{integrations.length}</div>
                    <div className="ap-kpi-sub">{uniqueMarketplaces.length} farklı platform</div>
                </div>
                {Object.entries(mpStats).slice(0, 3).map(([name, stats]) => (
                    <div key={name} className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--blue"><FaPlug /></div>
                        <div className="ap-kpi-label">{name}</div>
                        <div className="ap-kpi-val">{stats.count}</div>
                        <div className="ap-kpi-sub">{stats.products} ürün · {stats.orders} sipariş</div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Pazaryeri veya firma ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">Tüm Platformlar</option>
                        {uniqueMarketplaces.map(mp => (
                            <option key={mp} value={mp}>{mp}</option>
                        ))}
                    </select>
                    <span className="ap-toolbar-count">{filtered.length} entegrasyon</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length === 0 && (
                <div className="ap-card"><div className="ap-empty"><FaPlug /> Entegrasyon bulunamadı.</div></div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Firma</th>
                                    <th>Pazaryeri</th>
                                    <th>Durum</th>
                                    <th>Ürün</th>
                                    <th>Sipariş</th>
                                    <th>Bağlantı Tarihi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(integ => (
                                    <tr key={integ._id}>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{integ.userId?.name || "—"}</div>
                                                <div className="mono" style={{ fontSize: 11 }}>{integ.userId?.email || "—"}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="ap-badge ap-badge--cyan">{integ.marketplaceName || "—"}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span className="ap-dot ap-dot--green ap-dot--pulse" />
                                                <span style={{ fontSize: 12, color: "var(--ap-green)" }}>Aktif</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <FaBoxOpen style={{ fontSize: 12, color: "var(--ap-muted)" }} />
                                                {integ.productCount || 0}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <FaClipboardList style={{ fontSize: 12, color: "var(--ap-muted)" }} />
                                                {integ.orderCount || 0}
                                            </div>
                                        </td>
                                        <td className="mono" style={{ fontSize: 11 }}>
                                            {integ.createdAt ? new Date(integ.createdAt).toLocaleDateString("tr-TR") : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasIntegrations;
