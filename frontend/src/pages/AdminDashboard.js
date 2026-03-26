import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaUsers,
    FaBoxOpen,
    FaClipboardList,
    FaShieldAlt,
    FaBolt,
    FaChartLine,
    FaSlidersH,
    FaServer
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";
import "../styles/admin.css";

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
                        } catch (err) {
                            if (err.response?.status === 404) {
                                return [user._id, []];
                            }
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

    const marketplaceList = useMemo(() => {
        return Object.values(marketplacesByUser).flat();
    }, [marketplacesByUser]);

    const userMap = useMemo(() => {
        return users.reduce((acc, user) => {
            acc[user._id] = user;
            return acc;
        }, {});
    }, [users]);

    const totalIntegrations = marketplaceList.length;
    const uniqueMarketplaces = useMemo(() => {
        return new Set(marketplaceList.map(mp => mp.marketplaceName || "Diğer"));
    }, [marketplaceList]);

    const usersWithoutIntegrations = useMemo(() => {
        return users.filter(user => (marketplacesByUser[user._id] || []).length === 0).length;
    }, [users, marketplacesByUser]);

    const marketplaceStats = useMemo(() => {
        const stats = {};
        marketplaceList.forEach(mp => {
            const name = mp.marketplaceName || "Diğer";
            stats[name] = (stats[name] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [marketplaceList]);

    const latestIntegrations = useMemo(() => {
        return [...marketplaceList]
            .map(mp => ({
                ...mp,
                userName: userMap[mp.userId]?.name || "Bilinmeyen"
            }))
            .sort((a, b) => {
                const aTime = new Date(a.createdAt || 0).getTime();
                const bTime = new Date(b.createdAt || 0).getTime();
                return bTime - aTime;
            })
            .slice(0, 5);
    }, [marketplaceList, userMap]);

    const userIntegrationSummary = useMemo(() => {
        return users
            .map(user => ({
                id: user._id,
                name: user.name,
                email: user.email,
                count: (marketplacesByUser[user._id] || []).length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [users, marketplacesByUser]);

    return (
        <AdminLayout
            title="Admin Paneli"
            subtitle="Pazaryeri entegrasyonları ve operasyon kontrolü"
            actions={
                <div className="admin-action-row">
                    <button className="admin-btn admin-btn--ghost" type="button">
                        Rapor indir
                    </button>
                    <button className="admin-btn admin-btn--primary" type="button">
                        Yeni duyuru
                    </button>
                </div>
            }
        >
            {error && <div className="admin-alert admin-alert--error">{error}</div>}
            {loading && <div className="admin-loading">Veriler yükleniyor...</div>}

            {!loading && (
                <>
                    <div className="admin-grid admin-grid--kpi">
                        <div className="admin-card admin-kpi">
                            <div className="admin-kpi-label">Toplam Kullanıcı</div>
                            <div className="admin-kpi-value">{users.length}</div>
                            <div className="admin-kpi-foot">Kayıtlı kullanıcı</div>
                        </div>
                        <div className="admin-card admin-kpi">
                            <div className="admin-kpi-label">Toplam Entegrasyon</div>
                            <div className="admin-kpi-value">{totalIntegrations}</div>
                            <div className="admin-kpi-foot">Bağlı pazaryeri</div>
                        </div>
                        <div className="admin-card admin-kpi">
                            <div className="admin-kpi-label">Pazaryeri Çeşidi</div>
                            <div className="admin-kpi-value">{uniqueMarketplaces.size}</div>
                            <div className="admin-kpi-foot">Aktif platform</div>
                        </div>
                        <div className="admin-card admin-kpi">
                            <div className="admin-kpi-label">Entegrasyonsuz Kullanıcı</div>
                            <div className="admin-kpi-value">{usersWithoutIntegrations}</div>
                            <div className="admin-kpi-foot">Dikkat gerektirir</div>
                        </div>
                    </div>

                    <div className="admin-section">
                        <div className="admin-section-title">Hızlı İşlem Kartları</div>
                        <div className="admin-grid admin-grid--cards">
                            <Link to="/admin/users" className="admin-card admin-card--link">
                                <FaUsers />
                                <div>
                                    <div className="admin-card-title">Kullanıcı Yönetimi</div>
                                    <div className="admin-card-subtitle">Rol, yetki ve profil kontrolü</div>
                                </div>
                            </Link>
                            <Link to="/admin/products" className="admin-card admin-card--link">
                                <FaBoxOpen />
                                <div>
                                    <div className="admin-card-title">Ürün Operasyonları</div>
                                    <div className="admin-card-subtitle">Listeleme ve toplu işlemler</div>
                                </div>
                            </Link>
                            <Link to="/admin/orders" className="admin-card admin-card--link">
                                <FaClipboardList />
                                <div>
                                    <div className="admin-card-title">Sipariş Kontrolü</div>
                                    <div className="admin-card-subtitle">Durum ve iade yönetimi</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="admin-grid admin-grid--split">
                        <div className="admin-card">
                            <div className="admin-section-title">Program Dev Alanları</div>
                            <div className="admin-stack">
                                <div className="admin-feature">
                                    <div className="admin-feature-icon">
                                        <FaShieldAlt />
                                    </div>
                                    <div>
                                        <div className="admin-feature-title">Yetki Motoru</div>
                                        <div className="admin-feature-subtitle">
                                            Gelişmiş rol haritası ve erişim profilleri
                                        </div>
                                    </div>
                                    <span className="admin-tag">Dev</span>
                                </div>
                                <div className="admin-feature">
                                    <div className="admin-feature-icon">
                                        <FaSlidersH />
                                    </div>
                                    <div>
                                        <div className="admin-feature-title">Sistem Ayarları</div>
                                        <div className="admin-feature-subtitle">
                                            Pazaryeri anahtarları ve modüller
                                        </div>
                                    </div>
                                    <span className="admin-tag">Yönetici</span>
                                </div>
                                <div className="admin-feature">
                                    <div className="admin-feature-icon">
                                        <FaBolt />
                                    </div>
                                    <div>
                                        <div className="admin-feature-title">Panel Erişimleri</div>
                                        <div className="admin-feature-subtitle">
                                            Kullanıcı paneline kontrollü erişim
                                        </div>
                                    </div>
                                    <span className="admin-tag">Güvenlik</span>
                                </div>
                            </div>
                        </div>

                        <div className="admin-card">
                            <div className="admin-section-title">Pazaryeri Dağılımı</div>
                            <div className="admin-list">
                                {marketplaceStats.length === 0 && (
                                    <div className="admin-empty">Henüz entegrasyon yok.</div>
                                )}
                                {marketplaceStats.map(item => (
                                    <div key={item.name} className="admin-list-row">
                                        <span>{item.name}</span>
                                        <span className="admin-badge">{item.count}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="admin-section-title admin-section-title--compact">
                                Son Entegrasyonlar
                            </div>
                            <div className="admin-list">
                                {latestIntegrations.length === 0 && (
                                    <div className="admin-empty">Entegrasyon bilgisi bulunamadı.</div>
                                )}
                                {latestIntegrations.map(item => (
                                    <div key={item._id} className="admin-list-row">
                                        <div>
                                            <div className="admin-list-title">{item.marketplaceName}</div>
                                            <div className="admin-list-subtitle">{item.userName}</div>
                                        </div>
                                        <span className="admin-pill admin-pill--info">Aktif</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="admin-card">
                        <div className="admin-section-title">Kullanıcı Entegrasyon Özeti</div>
                        <div className="admin-summary-grid">
                            {userIntegrationSummary.map(item => (
                                <div key={item.id} className="admin-summary-item">
                                    <div className="admin-summary-title">{item.name}</div>
                                    <div className="admin-summary-subtitle">{item.email}</div>
                                    <div className="admin-summary-count">{item.count} entegrasyon</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="admin-card">
                        <div className="admin-section-title">Sistem Durumu</div>
                        <div className="admin-status-grid">
                            <div className="admin-status">
                                <FaServer />
                                <div>
                                    <div className="admin-status-title">API Sunucusu</div>
                                    <div className="admin-status-value">Stabil</div>
                                </div>
                            </div>
                            <div className="admin-status">
                                <FaChartLine />
                                <div>
                                    <div className="admin-status-title">İşlem Yoğunluğu</div>
                                    <div className="admin-status-value">Orta</div>
                                </div>
                            </div>
                            <div className="admin-status">
                                <FaBolt />
                                <div>
                                    <div className="admin-status-title">Uyarı Kuyruğu</div>
                                    <div className="admin-status-value">0 Kritik</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminDashboard;