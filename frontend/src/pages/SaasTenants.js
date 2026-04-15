import React, { useEffect, useState, useMemo } from "react";
import {
    FaBuilding, FaSearch, FaBan, FaCheckCircle, FaPause, FaKey,
    FaEye, FaExclamationTriangle, FaTrash, FaUserCog, FaSave,
    FaTimes, FaSync, FaEdit, FaPlug, FaBoxOpen, FaClipboardList,
    FaDollarSign, FaFilter
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import {
    getTenants, suspendTenant, activateTenant, banTenant,
    adminResetPassword, deleteTenant, updateUserRole, updateTenantProfile
} from "../services/saasAdminApi";

const SaasTenants = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");
    const [message, setMessage] = useState({ text: "", type: "" });

    // Detail modal
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [editingProfile, setEditingProfile] = useState(false);
    const [profileDraft, setProfileDraft] = useState({});

    // Action modal
    const [actionModal, setActionModal] = useState({ show: false, type: "", tenant: null });
    const [reason, setReason] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => { loadTenants(); }, []);

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
        setActionLoading(true);
        setMessage({ text: "", type: "" });
        try {
            const id = actionModal.tenant._id;
            if (actionModal.type === "suspend") {
                await suspendTenant(id, reason);
                setMessage({ text: `${actionModal.tenant.name} askıya alındı`, type: "success" });
            } else if (actionModal.type === "activate") {
                await activateTenant(id);
                setMessage({ text: `${actionModal.tenant.name} aktifleştirildi`, type: "success" });
            } else if (actionModal.type === "ban") {
                await banTenant(id, reason);
                setMessage({ text: `${actionModal.tenant.name} banlandı`, type: "success" });
            } else if (actionModal.type === "resetPassword") {
                if (!newPassword || newPassword.length < 8) {
                    setMessage({ text: "Şifre en az 8 karakter olmalıdır", type: "error" });
                    setActionLoading(false);
                    return;
                }
                await adminResetPassword(id, newPassword);
                setMessage({ text: `${actionModal.tenant.name} şifresi sıfırlandı`, type: "success" });
            } else if (actionModal.type === "delete") {
                const res = await deleteTenant(id);
                setMessage({ text: res.data.message || "Kullanıcı silindi", type: "success" });
                setSelectedTenant(null);
            }
            setActionModal({ show: false, type: "", tenant: null });
            setReason("");
            setNewPassword("");
            loadTenants();
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "İşlem başarısız", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRoleChange = async (tenantId, newRole) => {
        setMessage({ text: "", type: "" });
        try {
            const res = await updateUserRole(tenantId, newRole);
            setMessage({ text: res.data.message, type: "success" });
            loadTenants();
            if (selectedTenant?._id === tenantId) {
                setSelectedTenant(prev => ({ ...prev, role: newRole }));
            }
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "Rol değiştirilemedi", type: "error" });
        }
    };

    const handleSaveProfile = async () => {
        if (!selectedTenant) return;
        setActionLoading(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await updateTenantProfile(selectedTenant._id, profileDraft);
            setMessage({ text: "Profil güncellendi", type: "success" });
            setEditingProfile(false);
            setSelectedTenant(prev => ({ ...prev, ...res.data.user }));
            loadTenants();
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "Profil güncellenemedi", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const openDetail = (tenant) => {
        setSelectedTenant(tenant);
        setEditingProfile(false);
        setProfileDraft({ name: tenant.name, email: tenant.email, phone: tenant.profile?.phone || "", company: tenant.profile?.company || "" });
    };

    const filtered = useMemo(() => {
        return tenants.filter(t => {
            const matchSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase());
            const matchFilter = filter === "all" ||
                (filter === "active" && t.subscription?.status === "active") ||
                (filter === "trial" && t.subscription?.plan === "free") ||
                (filter === "suspended" && t.subscription?.status === "cancelled");
            const matchRole = roleFilter === "all" || t.role === roleFilter;
            return matchSearch && matchFilter && matchRole;
        });
    }, [tenants, search, filter, roleFilter]);

    const fmt = (n) => n?.toLocaleString("tr-TR") || "0";
    const fmtMoney = (n) => "₺" + (n || 0).toLocaleString("tr-TR");

    const stats = useMemo(() => ({
        total: tenants.length,
        active: tenants.filter(t => t.subscription?.status === "active").length,
        suspended: tenants.filter(t => t.subscription?.status === "cancelled").length,
        admins: tenants.filter(t => t.role === "admin" || t.role === "dev").length,
    }), [tenants]);

    const roleColors = { admin: "red", dev: "cyan", moderator: "yellow", seller: "green", user: "blue" };
    const statusColors = { active: "green", cancelled: "red", expired: "yellow" };
    const planColors = { free: "yellow", basic: "blue", pro: "purple", enterprise: "green", trial: "yellow" };

    return (
        <AdminLayout
            title="Firma Yönetimi"
            subtitle="Tüm firmaları görüntüle, düzenle, askıya al veya sil"
            actions={
                <button className="ap-btn ap-btn--ghost" onClick={loadTenants} disabled={loading}>
                    <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                </button>
            }
        >
            {/* Messages */}
            {message.text && (
                <div className={`ap-alert ${message.type === "success" ? "ap-alert--success" : "ap-alert--error"}`}>
                    {message.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {message.text}
                </div>
            )}
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* KPI Cards */}
            <div className="ap-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--purple"><FaBuilding /></div>
                    <div className="ap-kpi-label">Toplam Firma</div>
                    <div className="ap-kpi-val">{stats.total}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--green"><FaCheckCircle /></div>
                    <div className="ap-kpi-label">Aktif</div>
                    <div className="ap-kpi-val">{stats.active}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--red"><FaBan /></div>
                    <div className="ap-kpi-label">Askıda / Banlı</div>
                    <div className="ap-kpi-val">{stats.suspended}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaUserCog /></div>
                    <div className="ap-kpi-label">Admin / Dev</div>
                    <div className="ap-kpi-val">{stats.admins}</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input type="text" placeholder="Firma veya email ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">Tüm Durumlar</option>
                        <option value="active">Aktif</option>
                        <option value="trial">Trial / Ücretsiz</option>
                        <option value="suspended">Askıya Alınmış</option>
                    </select>
                    <select className="ap-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="all">Tüm Roller</option>
                        <option value="admin">Admin</option>
                        <option value="dev">Developer</option>
                        <option value="seller">Satıcı</option>
                        <option value="user">Kullanıcı</option>
                    </select>
                    <span className="ap-toolbar-count"><FaFilter style={{ marginRight: 4 }} />{filtered.length} firma</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length === 0 && (
                <div className="ap-card"><div className="ap-empty"><FaBuilding /> Firma bulunamadı.</div></div>
            )}

            {/* Table */}
            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Firma</th>
                                    <th>Rol</th>
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
                                    return (
                                        <tr key={tenant._id}>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{tenant.name}</div>
                                                <div className="mono" style={{ fontSize: 11 }}>{tenant.email}</div>
                                            </td>
                                            <td>
                                                <span className={`ap-badge ap-badge--${roleColors[tenant.role] || "blue"}`}>
                                                    {tenant.role || "user"}
                                                </span>
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
                                            <td style={{ textAlign: "center" }}>{tenant.stats?.marketplaces || 0}</td>
                                            <td style={{ textAlign: "center" }}>{fmt(tenant.stats?.products)}</td>
                                            <td style={{ textAlign: "center" }}>{fmt(tenant.stats?.orders)}</td>
                                            <td style={{ fontWeight: 600 }}>{fmtMoney(tenant.stats?.revenue)}</td>
                                            <td className="mono" style={{ fontSize: 11 }}>
                                                {new Date(tenant.createdAt).toLocaleDateString("tr-TR")}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                    <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => openDetail(tenant)} title="Detay & Düzenle">
                                                        <FaEye />
                                                    </button>
                                                    {status === "active" ? (
                                                        <button className="ap-btn ap-btn--sm" style={{ background: "var(--ap-yellow-soft)", color: "var(--ap-yellow)" }}
                                                            onClick={() => setActionModal({ show: true, type: "suspend", tenant })} title="Askıya Al">
                                                            <FaPause />
                                                        </button>
                                                    ) : (
                                                        <button className="ap-btn ap-btn--sm" style={{ background: "var(--ap-green-soft)", color: "var(--ap-green)" }}
                                                            onClick={() => setActionModal({ show: true, type: "activate", tenant })} title="Aktifleştir">
                                                            <FaCheckCircle />
                                                        </button>
                                                    )}
                                                    <button className="ap-btn ap-btn--sm" style={{ background: "var(--ap-red-soft)", color: "var(--ap-red)" }}
                                                        onClick={() => setActionModal({ show: true, type: "ban", tenant })} title="Banla">
                                                        <FaBan />
                                                    </button>
                                                    <button className="ap-btn ap-btn--sm" style={{ background: "var(--ap-cyan-soft)", color: "var(--ap-cyan)" }}
                                                        onClick={() => setActionModal({ show: true, type: "resetPassword", tenant })} title="Şifre Sıfırla">
                                                        <FaKey />
                                                    </button>
                                                    <button className="ap-btn ap-btn--sm" style={{ background: "var(--ap-red-soft)", color: "var(--ap-red)" }}
                                                        onClick={() => setActionModal({ show: true, type: "delete", tenant })} title="Sil">
                                                        <FaTrash />
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

            {/* ═══ DETAY MODAL ═══ */}
            {selectedTenant && (
                <div className="ap-modal-overlay" onClick={() => { setSelectedTenant(null); setEditingProfile(false); }}>
                    <div className="ap-modal ap-modal--lg" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <FaBuilding /> Firma Detayı — {selectedTenant.name}
                            </h3>
                            <button className="ap-modal-close" onClick={() => { setSelectedTenant(null); setEditingProfile(false); }}>×</button>
                        </div>
                        <div className="ap-modal-body" style={{ padding: 22 }}>
                            {/* Profile Section */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                                    <FaUserCog style={{ color: "var(--ap-primary)" }} /> Profil Bilgileri
                                </div>
                                {!editingProfile ? (
                                    <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setEditingProfile(true)}>
                                        <FaEdit /> Düzenle
                                    </button>
                                ) : (
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setEditingProfile(false)}><FaTimes /> İptal</button>
                                        <button className="ap-btn ap-btn--sm ap-btn--primary" onClick={handleSaveProfile} disabled={actionLoading}>
                                            <FaSave /> {actionLoading ? "Kaydediliyor..." : "Kaydet"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="ap-grid ap-grid--2" style={{ gap: 12, marginBottom: 20 }}>
                                {[
                                    { label: "İsim", key: "name", value: selectedTenant.name },
                                    { label: "Email", key: "email", value: selectedTenant.email },
                                    { label: "Telefon", key: "phone", value: selectedTenant.profile?.phone || "—" },
                                    { label: "Şirket", key: "company", value: selectedTenant.profile?.company || "—" },
                                ].map(field => (
                                    <div key={field.key} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,0.04)", border: "1px solid var(--ap-border)" }}>
                                        <div style={{ fontSize: 11, color: "var(--ap-muted)", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
                                        {editingProfile ? (
                                            <input
                                                type="text"
                                                value={profileDraft[field.key] || ""}
                                                onChange={(e) => setProfileDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                style={{ width: "100%", padding: "6px 10px", background: "rgba(12,15,26,0.9)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                                            />
                                        ) : (
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{field.value}</div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Role Change */}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.04)", border: "1px solid var(--ap-border)" }}>
                                <div style={{ fontSize: 12, color: "var(--ap-muted)", fontWeight: 600 }}>Rol:</div>
                                <select
                                    className="ap-select"
                                    value={selectedTenant.role || "user"}
                                    onChange={(e) => {
                                        if (window.confirm(`Rolü "${e.target.value}" olarak değiştirmek istediğinize emin misiniz?`)) {
                                            handleRoleChange(selectedTenant._id, e.target.value);
                                        }
                                    }}
                                    style={{ flex: 1 }}
                                >
                                    <option value="user">Kullanıcı</option>
                                    <option value="seller">Satıcı</option>
                                    <option value="moderator">Moderatör</option>
                                    <option value="dev">Developer</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <span className={`ap-badge ap-badge--${roleColors[selectedTenant.role] || "blue"}`}>
                                    {selectedTenant.role || "user"}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="ap-divider" style={{ margin: "16px 0" }} />
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                <FaClipboardList style={{ color: "var(--ap-primary)" }} /> İstatistikler
                            </div>
                            <div className="ap-grid ap-grid--4" style={{ gap: 10 }}>
                                {[
                                    { icon: <FaPlug />, label: "Entegrasyon", value: selectedTenant.stats?.marketplaces || 0, color: "cyan" },
                                    { icon: <FaBoxOpen />, label: "Ürün", value: fmt(selectedTenant.stats?.products), color: "yellow" },
                                    { icon: <FaClipboardList />, label: "Sipariş", value: fmt(selectedTenant.stats?.orders), color: "blue" },
                                    { icon: <FaDollarSign />, label: "Gelir", value: fmtMoney(selectedTenant.stats?.revenue), color: "green" },
                                ].map((s, i) => (
                                    <div key={i} className="ap-stat-mini">
                                        <div className={`ap-kpi-icon ap-kpi-icon--${s.color}`} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14 }}>{s.icon}</div>
                                        <div className="ap-stat-mini-val" style={{ fontSize: 18 }}>{s.value}</div>
                                        <div className="ap-stat-mini-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Meta */}
                            <div className="ap-divider" style={{ margin: "16px 0" }} />
                            <div className="ap-list">
                                <div className="ap-row">
                                    <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Plan</span>
                                    <span className={`ap-badge ap-badge--${planColors[selectedTenant.subscription?.plan] || "neutral"}`}>
                                        {(selectedTenant.subscription?.plan || "free").toUpperCase()}
                                    </span>
                                </div>
                                <div className="ap-row">
                                    <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Durum</span>
                                    <span className={`ap-badge ap-badge--${statusColors[selectedTenant.subscription?.status] || "neutral"}`}>
                                        {selectedTenant.subscription?.status || "active"}
                                    </span>
                                </div>
                                <div className="ap-row">
                                    <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Kayıt Tarihi</span>
                                    <span className="mono" style={{ fontSize: 12 }}>{new Date(selectedTenant.createdAt).toLocaleString("tr-TR")}</span>
                                </div>
                                <div className="ap-row">
                                    <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>Son Güncelleme</span>
                                    <span className="mono" style={{ fontSize: 12 }}>{new Date(selectedTenant.updatedAt).toLocaleString("tr-TR")}</span>
                                </div>
                                <div className="ap-row">
                                    <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>ID</span>
                                    <span className="mono" style={{ fontSize: 11 }}>{selectedTenant._id}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ ACTION MODAL ═══ */}
            {actionModal.show && (
                <div className="ap-modal-overlay" onClick={() => setActionModal({ show: false, type: "", tenant: null })}>
                    <div className="ap-modal ap-modal--sm" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3>
                                {actionModal.type === "suspend" && "⏸️ Firmayı Askıya Al"}
                                {actionModal.type === "activate" && "✅ Firmayı Aktifleştir"}
                                {actionModal.type === "ban" && "🚫 Firmayı Banla"}
                                {actionModal.type === "resetPassword" && "🔑 Şifre Sıfırla"}
                                {actionModal.type === "delete" && "🗑️ Firmayı Sil"}
                            </h3>
                            <button className="ap-modal-close" onClick={() => setActionModal({ show: false, type: "", tenant: null })}>×</button>
                        </div>
                        <div className="ap-modal-body" style={{ padding: 22 }}>
                            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.06)", marginBottom: 16 }}>
                                <div style={{ fontWeight: 700 }}>{actionModal.tenant?.name}</div>
                                <div style={{ fontSize: 12, color: "var(--ap-muted)" }}>{actionModal.tenant?.email}</div>
                            </div>

                            {(actionModal.type === "suspend" || actionModal.type === "ban") && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ap-muted)", display: "block", marginBottom: 6 }}>Sebep (opsiyonel)</label>
                                    <textarea
                                        rows="3"
                                        placeholder="İşlem sebebini yazın..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        style={{ width: "100%", padding: "10px 14px", background: "rgba(12,15,26,0.9)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
                                    />
                                </div>
                            )}

                            {actionModal.type === "resetPassword" && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ap-muted)", display: "block", marginBottom: 6 }}>Yeni Şifre (min 8 karakter, büyük/küçük harf + rakam)</label>
                                    <input
                                        type="text"
                                        placeholder="Yeni şifre..."
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        style={{ width: "100%", padding: "10px 14px", background: "rgba(12,15,26,0.9)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                                    />
                                </div>
                            )}

                            {actionModal.type === "delete" && (
                                <div className="ap-alert ap-alert--error" style={{ marginBottom: 12 }}>
                                    <FaExclamationTriangle />
                                    <div>
                                        <strong>DİKKAT!</strong> Bu işlem geri alınamaz. Kullanıcının tüm verileri (abonelikler, entegrasyonlar, siparişler, ürünler) kalıcı olarak silinecektir.
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="ap-modal-footer" style={{ padding: "16px 22px", borderTop: "1px solid var(--ap-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button className="ap-btn ap-btn--ghost" onClick={() => setActionModal({ show: false, type: "", tenant: null })}>İptal</button>
                            <button
                                className={`ap-btn ${actionModal.type === "ban" || actionModal.type === "delete" ? "ap-btn--danger" : "ap-btn--primary"}`}
                                onClick={handleAction}
                                disabled={actionLoading}
                            >
                                {actionLoading ? "İşleniyor..." : "Onayla"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasTenants;
