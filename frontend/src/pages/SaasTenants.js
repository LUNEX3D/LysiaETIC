import React, { useEffect, useState } from "react";
import { FaBuilding, FaSearch, FaBan, FaCheckCircle, FaPause, FaKey, FaEye, FaExclamationTriangle } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getTenants, suspendTenant, activateTenant, banTenant, adminResetPassword } from "../services/saasAdminApi";

const SaasTenants = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [actionModal, setActionModal] = useState({ show: false, type: "", tenant: null });
    const [reason, setReason] = useState("");
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getTenants();
            setTenants(res.data.tenants || []);
        } catch (err) {
            console.error(err);
            setError("Firma listesi alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (!actionModal.tenant) return;
        setLoading(true);
        try {
            const id = actionModal.tenant._id;
            if (actionModal.type === "suspend") {
                await suspendTenant(id, reason);
            } else if (actionModal.type === "activate") {
                await activateTenant(id);
            } else if (actionModal.type === "ban") {
                await banTenant(id, reason);
            } else if (actionModal.type === "resetPassword") {
                await adminResetPassword(id, newPassword || "LysiaETIC2024!");
            }
            setActionModal({ show: false, type: "", tenant: null });
            setReason("");
            setNewPassword("");
            loadTenants();
        } catch (err) {
            alert("İşlem başarısız: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const filtered = tenants.filter(t => {
        const matchSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" ||
            (filter === "active" && t.subscription?.status === "active") ||
            (filter === "trial" && t.subscription?.plan === "free") ||
            (filter === "suspended" && t.subscription?.status === "cancelled");
        return matchSearch && matchFilter;
    });

    const fmt = (n) => n?.toLocaleString("tr-TR") || "0";
    const fmtMoney = (n) => "₺" + (n || 0).toLocaleString("tr-TR");

    return (
        <AdminLayout
            title="Firma Yönetimi"
            subtitle="Tüm firmaları görüntüle, yönet, askıya al veya banla"
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* Toolbar */}
            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Firma veya email ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">Tüm Firmalar</option>
                        <option value="active">Aktif</option>
                        <option value="trial">Trial / Ücretsiz</option>
                        <option value="suspended">Askıya Alınmış</option>
                    </select>
                    <span className="ap-toolbar-count">{filtered.length} firma</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length === 0 && (
                <div className="ap-card">
                    <div className="ap-empty"><FaBuilding /> Firma bulunamadı.</div>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Firma</th>
                                    <th>Plan</th>
                                    <th>Durum</th>
                                    <th>Entegrasyon</th>
                                    <th>Ürün</th>
                                    <th>Sipariş</th>
                                    <th>Gelir</th>
                                    <th>Kayıt</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(tenant => {
                                    const status = tenant.subscription?.status || "active";
                                    const plan = tenant.subscription?.plan || "free";
                                    const statusColors = { active: "green", cancelled: "red", expired: "yellow" };
                                    const planColors = { free: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
                                    return (
                                        <tr key={tenant._id}>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{tenant.name}</div>
                                                    <div className="mono" style={{ fontSize: 11 }}>{tenant.email}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`ap-badge ap-badge--${planColors[plan] || "neutral"}`}>
                                                    {plan.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`ap-badge ap-badge--${statusColors[status] || "neutral"}`}>
                                                    {status === "active" ? "Aktif" : status === "cancelled" ? "Askıda" : "Süresi Dolmuş"}
                                                </span>
                                            </td>
                                            <td>{tenant.stats?.marketplaces || 0}</td>
                                            <td>{fmt(tenant.stats?.products)}</td>
                                            <td>{fmt(tenant.stats?.orders)}</td>
                                            <td>{fmtMoney(tenant.stats?.revenue)}</td>
                                            <td className="mono" style={{ fontSize: 11 }}>
                                                {new Date(tenant.createdAt).toLocaleDateString("tr-TR")}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button
                                                        className="ap-btn ap-btn--sm ap-btn--ghost"
                                                        onClick={() => setSelectedTenant(tenant)}
                                                        title="Detay"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    {status === "active" ? (
                                                        <button
                                                            className="ap-btn ap-btn--sm"
                                                            style={{ background: "var(--ap-yellow-soft)", color: "var(--ap-yellow)" }}
                                                            onClick={() => setActionModal({ show: true, type: "suspend", tenant })}
                                                            title="Askıya Al"
                                                        >
                                                            <FaPause />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="ap-btn ap-btn--sm"
                                                            style={{ background: "var(--ap-green-soft)", color: "var(--ap-green)" }}
                                                            onClick={() => setActionModal({ show: true, type: "activate", tenant })}
                                                            title="Aktifleştir"
                                                        >
                                                            <FaCheckCircle />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="ap-btn ap-btn--sm"
                                                        style={{ background: "var(--ap-red-soft)", color: "var(--ap-red)" }}
                                                        onClick={() => setActionModal({ show: true, type: "ban", tenant })}
                                                        title="Banla"
                                                    >
                                                        <FaBan />
                                                    </button>
                                                    <button
                                                        className="ap-btn ap-btn--sm"
                                                        style={{ background: "var(--ap-cyan-soft)", color: "var(--ap-cyan)" }}
                                                        onClick={() => setActionModal({ show: true, type: "resetPassword", tenant })}
                                                        title="Şifre Sıfırla"
                                                    >
                                                        <FaKey />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detay Modal */}
            {selectedTenant && (
                <div className="ap-modal-overlay" onClick={() => setSelectedTenant(null)}>
                    <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3>Firma Detayı</h3>
                            <button className="ap-modal-close" onClick={() => setSelectedTenant(null)}>×</button>
                        </div>
                        <div className="ap-modal-body">
                            <div className="ap-grid ap-grid--2">
                                <div>
                                    <div className="ap-label">Firma Adı</div>
                                    <div className="ap-value">{selectedTenant.name}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Email</div>
                                    <div className="ap-value">{selectedTenant.email}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Telefon</div>
                                    <div className="ap-value">{selectedTenant.profile?.phone || "—"}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Şirket</div>
                                    <div className="ap-value">{selectedTenant.profile?.company || "—"}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Plan</div>
                                    <div className="ap-value">{selectedTenant.subscription?.plan || "free"}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Durum</div>
                                    <div className="ap-value">{selectedTenant.subscription?.status || "active"}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Kayıt Tarihi</div>
                                    <div className="ap-value">{new Date(selectedTenant.createdAt).toLocaleString("tr-TR")}</div>
                                </div>
                                <div>
                                    <div className="ap-label">Son Güncelleme</div>
                                    <div className="ap-value">{new Date(selectedTenant.updatedAt).toLocaleString("tr-TR")}</div>
                                </div>
                            </div>
                            <div className="ap-divider" style={{ margin: "16px 0" }} />
                            <div className="ap-grid ap-grid--4">
                                <div className="ap-stat-mini">
                                    <div className="ap-stat-mini-val">{selectedTenant.stats?.marketplaces || 0}</div>
                                    <div className="ap-stat-mini-label">Entegrasyon</div>
                                </div>
                                <div className="ap-stat-mini">
                                    <div className="ap-stat-mini-val">{fmt(selectedTenant.stats?.products)}</div>
                                    <div className="ap-stat-mini-label">Ürün</div>
                                </div>
                                <div className="ap-stat-mini">
                                    <div className="ap-stat-mini-val">{fmt(selectedTenant.stats?.orders)}</div>
                                    <div className="ap-stat-mini-label">Sipariş</div>
                                </div>
                                <div className="ap-stat-mini">
                                    <div className="ap-stat-mini-val">{fmtMoney(selectedTenant.stats?.revenue)}</div>
                                    <div className="ap-stat-mini-label">Gelir</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {actionModal.show && (
                <div className="ap-modal-overlay" onClick={() => setActionModal({ show: false, type: "", tenant: null })}>
                    <div className="ap-modal ap-modal--sm" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3>
                                {actionModal.type === "suspend" && "Firmayı Askıya Al"}
                                {actionModal.type === "activate" && "Firmayı Aktifleştir"}
                                {actionModal.type === "ban" && "Firmayı Banla"}
                                {actionModal.type === "resetPassword" && "Şifre Sıfırla"}
                            </h3>
                            <button className="ap-modal-close" onClick={() => setActionModal({ show: false, type: "", tenant: null })}>×</button>
                        </div>
                        <div className="ap-modal-body">
                            <p style={{ marginBottom: 16, color: "var(--ap-muted)" }}>
                                <strong>{actionModal.tenant?.name}</strong> firması için işlem yapıyorsunuz.
                            </p>
                            {(actionModal.type === "suspend" || actionModal.type === "ban") && (
                                <div>
                                    <label className="ap-label">Sebep (opsiyonel)</label>
                                    <textarea
                                        className="ap-input"
                                        rows="3"
                                        placeholder="İşlem sebebini yazın..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>
                            )}
                            {actionModal.type === "resetPassword" && (
                                <div>
                                    <label className="ap-label">Yeni Şifre (boş bırakılırsa: LysiaETIC2024!)</label>
                                    <input
                                        type="text"
                                        className="ap-input"
                                        placeholder="Yeni şifre..."
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="ap-modal-footer">
                            <button className="ap-btn ap-btn--ghost" onClick={() => setActionModal({ show: false, type: "", tenant: null })}>
                                İptal
                            </button>
                            <button
                                className={`ap-btn ${actionModal.type === "ban" ? "ap-btn--danger" : "ap-btn--primary"}`}
                                onClick={handleAction}
                                disabled={loading}
                            >
                                {loading ? "İşleniyor..." : "Onayla"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasTenants;
