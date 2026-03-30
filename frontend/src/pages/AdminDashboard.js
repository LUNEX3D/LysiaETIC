import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaUsers,
    FaBoxOpen,
    FaClipboardList,
    FaServer,
    FaUserShield,
    FaChartLine,
    FaArrowRight,
    FaBolt,
    FaShieldAlt,
    FaSlidersH,
    FaStore
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [marketplacesByUser, setMarketplacesByUser] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError("");
            try {
                const userResponse = await axios.get("/admin/users", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                const userList = Array.isArray(userResponse.data) ? userResponse.data : [];
                setUsers(userList);

                if (!userList.length) {
                    setMarketplacesByUser({});
                    setLoading(false);
                    return;
                }

                const entries = await Promise.all(
                    userList.map(async user => {
                        try {
                            const res = await axios.get(
                                `/marketplace/user-marketplaces/${user._id}`,
                                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                            );
                            return [user._id, res.data || []];
                        } catch {
                            return [user._id, []];
                        }
                    })
                );
                setMarketplacesByUser(Object.fromEntries(entries));
            } catch (err) {
                console.error(err);
                setError("Veriler alınamadı. Lütfen tekrar deneyin.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const marketplaceList = useMemo(() => Object.values(marketplacesByUser).flat(), [marketplacesByUser]);

    const userMap = useMemo(() => {
        return users.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});
    }, [users]);

    const totalIntegrations = marketplaceList.length;
    const uniqueMarketplaces = useMemo(() => new Set(marketplaceList.map(m => m.marketplaceName || "Diğer")), [marketplaceList]);
    const usersWithoutIntegrations = useMemo(() => users.filter(u => (marketplacesByUser[u._id] || []).length === 0).length, [users, marketplacesByUser]);

    const marketplaceStats = useMemo(() => {
        const stats = {};
        marketplaceList.forEach(m => {
            const name = m.marketplaceName || "Diğer";
            stats[name] = (stats[name] || 0) + 1;
        });
        return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [marketplaceList]);

    const latestIntegrations = useMemo(() => {
        return [...marketplaceList]
            .map(m => ({ ...m, userName: userMap[m.userId]?.name || "Bilinmeyen" }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 5);
    }, [marketplaceList, userMap]);

    const userIntegrationSummary = useMemo(() => {
        return users
            .map(u => ({ id: u._id, name: u.name, email: u.email, count: (marketplacesByUser[u._id] || []).length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [users, marketplacesByUser]);

    return (
        <AdminLayout
            title="Genel Bakış"
            subtitle="Sistem durumu, pazaryeri entegrasyonları ve operasyon kontrolü"
            actions={
                <div className="ap-actions">
                    <button className="ap-btn ap-btn--ghost">Rapor İndir</button>
                    <button className="ap-btn ap-btn--primary">Yeni Duyuru</button>
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}
            {loading && <div className="ap-loading">Veriler yükleniyor...</div>}

            {!loading && (
                <>
                    {/* ─── KPI Cards ─── */}
                    <div className="ap-kpi-grid">
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--purple"><FaUsers /></div>
                            <div className="ap-kpi-label">Toplam Kullanıcı</div>
                            <div className="ap-kpi-val">{users.length}</div>
                            <div className="ap-kpi-sub">Kayıtlı hesap</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--green"><FaStore /></div>
                            <div className="ap-kpi-label">Toplam Entegrasyon</div>
                            <div className="ap-kpi-val">{totalIntegrations}</div>
                            <div className="ap-kpi-sub">Bağlı pazaryeri</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--blue"><FaChartLine /></div>
                            <div className="ap-kpi-label">Pazaryeri Çeşidi</div>
                            <div className="ap-kpi-val">{uniqueMarketplaces.size}</div>
                            <div className="ap-kpi-sub">Aktif platform</div>
                        </div>
                        <div className="ap-kpi">
                            <div className="ap-kpi-icon ap-kpi-icon--orange"><FaBolt /></div>
                            <div className="ap-kpi-label">Entegrasyonsuz</div>
                            <div className="ap-kpi-val">{usersWithoutIntegrations}</div>
                            <div className="ap-kpi-sub">Dikkat gerektirir</div>
                        </div>
                    </div>

                    {/* ─── Quick Actions ─── */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaBolt /> Hızlı İşlemler</div>
                        <div className="ap-grid ap-grid--3">
                            <Link to="/admin/users" className="ap-quick">
                                <div className="ap-quick-icon ap-quick-icon--purple"><FaUsers /></div>
                                <div>
                                    <div className="ap-quick-title">Kullanıcı Yönetimi</div>
                                    <div className="ap-quick-sub">Rol, yetki ve profil kontrolü</div>
                                </div>
                                <FaArrowRight className="ap-quick-arrow" />
                            </Link>
                            <Link to="/admin/products" className="ap-quick">
                                <div className="ap-quick-icon ap-quick-icon--green"><FaBoxOpen /></div>
                                <div>
                                    <div className="ap-quick-title">Ürün Operasyonları</div>
                                    <div className="ap-quick-sub">Listeleme ve toplu işlemler</div>
                                </div>
                                <FaArrowRight className="ap-quick-arrow" />
                            </Link>
                            <Link to="/admin/orders" className="ap-quick">
                                <div className="ap-quick-icon ap-quick-icon--blue"><FaClipboardList /></div>
                                <div>
                                    <div className="ap-quick-title">Sipariş Kontrolü</div>
                                    <div className="ap-quick-sub">Durum ve iade yönetimi</div>
                                </div>
                                <FaArrowRight className="ap-quick-arrow" />
                            </Link>
                        </div>
                    </div>

                    {/* ─── Two Column: Dev Areas + Marketplace Stats ─── */}
                    <div className="ap-grid ap-grid--2">
                        <div className="ap-card">
                            <div className="ap-card-head"><FaShieldAlt /> Geliştirici Alanları</div>
                            <div className="ap-list">
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--red" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14 }}>
                                            <FaShieldAlt />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Yetki Motoru</div>
                                            <div className="ap-row-sub">Gelişmiş rol haritası ve erişim profilleri</div>
                                        </div>
                                    </div>
                                    <span className="ap-badge ap-badge--red">Dev</span>
                                </div>
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--yellow" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14 }}>
                                            <FaSlidersH />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Sistem Ayarları</div>
                                            <div className="ap-row-sub">Pazaryeri anahtarları ve modüller</div>
                                        </div>
                                    </div>
                                    <span className="ap-badge ap-badge--yellow">Yönetici</span>
                                </div>
                                <div className="ap-row">
                                    <div className="ap-row-left">
                                        <div className="ap-kpi-icon ap-kpi-icon--cyan" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14 }}>
                                            <FaUserShield />
                                        </div>
                                        <div>
                                            <div className="ap-row-title">Panel Erişimleri</div>
                                            <div className="ap-row-sub">Kullanıcı paneline kontrollü erişim</div>
                                        </div>
                                    </div>
                                    <span className="ap-badge ap-badge--cyan">Güvenlik</span>
                                </div>
                            </div>
                        </div>

                        <div className="ap-card">
                            <div className="ap-card-head"><FaStore /> Pazaryeri Dağılımı</div>
                            <div className="ap-list">
                                {marketplaceStats.length === 0 && (
                                    <div className="ap-empty">Henüz entegrasyon yok.</div>
                                )}
                                {marketplaceStats.map(item => (
                                    <div key={item.name} className="ap-row">
                                        <span className="ap-row-title">{item.name}</span>
                                        <span className="ap-badge ap-badge--purple">{item.count}</span>
                                    </div>
                                ))}
                            </div>

                            {latestIntegrations.length > 0 && (
                                <>
                                    <div className="ap-divider" style={{ margin: "16px 0" }} />
                                    <div className="ap-card-head" style={{ fontSize: 13, marginBottom: 12 }}>Son Entegrasyonlar</div>
                                    <div className="ap-list">
                                        {latestIntegrations.map(item => (
                                            <div key={item._id} className="ap-row">
                                                <div>
                                                    <div className="ap-row-title">{item.marketplaceName}</div>
                                                    <div className="ap-row-sub">{item.userName}</div>
                                                </div>
                                                <span className="ap-badge ap-badge--green">Aktif</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ─── User Integration Summary ─── */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaUsers /> Kullanıcı Entegrasyon Özeti</div>
                        <div className="ap-grid ap-grid--3">
                            {userIntegrationSummary.map(item => (
                                <div key={item.id} className="ap-stat-mini">
                                    <div className="ap-stat-mini-val" style={{ color: item.count > 0 ? "var(--ap-green)" : "var(--ap-muted)" }}>
                                        {item.count}
                                    </div>
                                    <div className="ap-stat-mini-label">{item.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--ap-muted)" }}>{item.email}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ─── System Status ─── */}
                    <div className="ap-card">
                        <div className="ap-card-head"><FaServer /> Sistem Durumu</div>
                        <div className="ap-grid ap-grid--3">
                            <div className="ap-row" style={{ padding: 16 }}>
                                <div className="ap-row-left">
                                    <div className="ap-kpi-icon ap-kpi-icon--green" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14 }}>
                                        <FaServer />
                                    </div>
                                    <div>
                                        <div className="ap-row-title">API Sunucusu</div>
                                        <div className="ap-row-sub">Stabil</div>
                                    </div>
                                </div>
                                <span className="ap-dot ap-dot--green ap-dot--pulse" />
                            </div>
                            <div className="ap-row" style={{ padding: 16 }}>
                                <div className="ap-row-left">
                                    <div className="ap-kpi-icon ap-kpi-icon--blue" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14 }}>
                                        <FaChartLine />
                                    </div>
                                    <div>
                                        <div className="ap-row-title">İşlem Yoğunluğu</div>
                                        <div className="ap-row-sub">Orta</div>
                                    </div>
                                </div>
                                <span className="ap-dot ap-dot--yellow" />
                            </div>
                            <div className="ap-row" style={{ padding: 16 }}>
                                <div className="ap-row-left">
                                    <div className="ap-kpi-icon ap-kpi-icon--purple" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14 }}>
                                        <FaBolt />
                                    </div>
                                    <div>
                                        <div className="ap-row-title">Uyarı Kuyruğu</div>
                                        <div className="ap-row-sub">0 Kritik</div>
                                    </div>
                                </div>
                                <span className="ap-dot ap-dot--green ap-dot--pulse" />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminDashboard;
