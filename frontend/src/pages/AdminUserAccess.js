import React, { useEffect, useState, useMemo } from "react";
import {
    FaSearch,
    FaUserShield,
    FaSignInAlt,
    FaExternalLinkAlt,
    FaStore,
    FaUserCog,
    FaEye,
    FaTimesCircle,
    FaCheckCircle,
    FaInfoCircle
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";
import "../styles/admin.css";

const AdminUserAccess = () => {
    const [users, setUsers] = useState([]);
    const [marketplacesByUser, setMarketplacesByUser] = useState({});
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

    useEffect(() => {
        const loadUsers = async () => {
            setLoading(true);
            try {
                const res = await axios.get("/admin/users", { headers });
                const list = Array.isArray(res.data) ? res.data : [];
                setUsers(list);

                // Entegrasyonları yükle
                const entries = await Promise.all(
                    list.map(async user => {
                        try {
                            const mpRes = await axios.get(
                                `/marketplace/user-marketplaces/${user._id}`,
                                { headers }
                            );
                            return [user._id, mpRes.data || []];
                        } catch {
                            return [user._id, []];
                        }
                    })
                );
                setMarketplacesByUser(Object.fromEntries(entries));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter(user => {
            const matchesQuery =
                !q ||
                user.name?.toLowerCase().includes(q) ||
                user.email?.toLowerCase().includes(q);
            const matchesRole = roleFilter === "all" || user.role === roleFilter;
            return matchesQuery && matchesRole;
        });
    }, [users, query, roleFilter]);

    const handleImpersonate = async (user) => {
        setImpersonating(user._id);
        setMessage({ text: "", type: "" });

        try {
            const res = await axios.post(
                `/admin/system/impersonate/${user._id}`,
                {},
                { headers }
            );

            if (res.data.success) {
                // Admin bilgilerini sakla (geri dönüş için)
                const adminToken = localStorage.getItem("token");
                const adminId = localStorage.getItem("userId");
                const adminEmail = localStorage.getItem("userEmail");
                const adminName = localStorage.getItem("userName");
                const adminRole = localStorage.getItem("userRole");

                localStorage.setItem("adminBackup_token", adminToken);
                localStorage.setItem("adminBackup_userId", adminId);
                localStorage.setItem("adminBackup_email", adminEmail);
                localStorage.setItem("adminBackup_name", adminName);
                localStorage.setItem("adminBackup_role", adminRole);

                // Hedef kullanıcı bilgilerini yükle
                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userId", res.data.user._id);
                localStorage.setItem("userEmail", res.data.user.email);
                localStorage.setItem("userName", res.data.user.name);
                localStorage.setItem("userRole", res.data.user.role);
                localStorage.setItem("isImpersonating", "true");
                localStorage.setItem("impersonatedBy", adminEmail);

                // Yeni sekmede aç
                window.open("/dashboard", "_blank");

                // Admin bilgilerini geri yükle
                setTimeout(() => {
                    localStorage.setItem("token", adminToken);
                    localStorage.setItem("userId", adminId);
                    localStorage.setItem("userEmail", adminEmail);
                    localStorage.setItem("userName", adminName);
                    localStorage.setItem("userRole", adminRole);
                    localStorage.removeItem("isImpersonating");
                    localStorage.removeItem("impersonatedBy");
                    localStorage.removeItem("adminBackup_token");
                    localStorage.removeItem("adminBackup_userId");
                    localStorage.removeItem("adminBackup_email");
                    localStorage.removeItem("adminBackup_name");
                    localStorage.removeItem("adminBackup_role");
                }, 2000);

                setMessage({
                    text: `✅ ${user.name} kullanıcısının paneli yeni sekmede açıldı.`,
                    type: "success"
                });
            }
        } catch (err) {
            setMessage({
                text: `❌ Erişim sağlanamadı: ${err.response?.data?.message || err.message}`,
                type: "error"
            });
        } finally {
            setImpersonating(null);
        }
    };

    const getRoleInfo = (role) => {
        const map = {
            admin: { label: "Admin", class: "admin-pill--admin", icon: <FaUserShield /> },
            dev: { label: "Developer", class: "admin-pill--dev", icon: <FaUserCog /> },
            moderator: { label: "Moderatör", class: "admin-pill--moderator", icon: <FaUserCog /> },
            seller: { label: "Satıcı", class: "admin-pill--seller", icon: <FaStore /> },
            user: { label: "Kullanıcı", class: "admin-pill--user", icon: <FaEye /> }
        };
        return map[role] || map.user;
    };

    const getSubscriptionBadge = (sub) => {
        if (!sub?.plan || sub.plan === "free") return <span className="admin-pill admin-pill--neutral">Free</span>;
        if (sub.plan === "basic") return <span className="admin-pill admin-pill--info">Basic</span>;
        if (sub.plan === "pro") return <span className="admin-pill admin-pill--warn">Pro</span>;
        if (sub.plan === "enterprise") return <span className="admin-pill admin-pill--success">Enterprise</span>;
        return null;
    };

    return (
        <AdminLayout
            title="Kullanıcı Erişimi"
            subtitle="Kullanıcı panellerine admin olarak erişim sağlayın"
            actions={
                <div className="admin-action-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
                        <FaInfoCircle />
                        Kullanıcı paneli yeni sekmede açılır
                    </div>
                </div>
            }
        >
            {message.text && (
                <div className={`admin-alert ${message.type === "success" ? "admin-alert--success" : "admin-alert--error"}`}
                     style={{
                         background: message.type === "success" ? "#dcfce7" : undefined,
                         borderColor: message.type === "success" ? "#bbf7d0" : undefined,
                         color: message.type === "success" ? "#15803d" : undefined
                     }}>
                    {message.text}
                </div>
            )}

            {/* Toolbar */}
            <div className="admin-toolbar">
                <div className="admin-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Kullanıcı ara: isim, e-posta..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <div className="admin-filter">
                    <FaUserShield />
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                        <option value="all">Tüm Roller</option>
                        <option value="admin">Admin</option>
                        <option value="dev">Developer</option>
                        <option value="moderator">Moderatör</option>
                        <option value="seller">Satıcı</option>
                        <option value="user">Kullanıcı</option>
                    </select>
                </div>
                <div className="admin-toolbar-meta">
                    {filteredUsers.length} kullanıcı
                </div>
            </div>

            {loading && <div className="admin-loading">Kullanıcılar yükleniyor...</div>}

            {!loading && (
                <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                    {filteredUsers.map(user => {
                        const integrations = marketplacesByUser[user._id] || [];
                        const roleInfo = getRoleInfo(user.role);
                        const isCurrentAdmin = user._id === localStorage.getItem("userId");

                        return (
                            <div key={user._id} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {/* User Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                    <div className="admin-avatar" style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 16,
                                        fontSize: 20,
                                        background: isCurrentAdmin
                                            ? "linear-gradient(135deg, #fee2e2, #fecaca)"
                                            : "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                                        color: isCurrentAdmin ? "#b91c1c" : "#1d4ed8"
                                    }}>
                                        {user.name?.charAt(0).toUpperCase() || "?"}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                                            {user.name}
                                            {isCurrentAdmin && (
                                                <span style={{ fontSize: 10, color: "#b91c1c", fontWeight: 500 }}>(Siz)</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{user.email}</div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                            <span className={`admin-pill ${roleInfo.class}`}>
                                                {roleInfo.label}
                                            </span>
                                            {getSubscriptionBadge(user.subscription)}
                                        </div>
                                    </div>
                                </div>

                                {/* Integrations */}
                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>
                                        <FaStore style={{ marginRight: 6 }} />
                                        Pazaryeri Entegrasyonları ({integrations.length})
                                    </div>
                                    {integrations.length === 0 ? (
                                        <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                                            Entegrasyon yok
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {integrations.slice(0, 4).map(mp => (
                                                <span key={mp._id} className="admin-badge" style={{ fontSize: 11 }}>
                                                    {mp.marketplaceName}
                                                </span>
                                            ))}
                                            {integrations.length > 4 && (
                                                <span className="admin-badge" style={{ background: "var(--neutral-soft)", color: "var(--neutral)" }}>
                                                    +{integrations.length - 4}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Meta Info */}
                                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
                                    <span>
                                        {user.createdAt ? `Kayıt: ${new Date(user.createdAt).toLocaleDateString("tr-TR")}` : ""}
                                    </span>
                                    <span>
                                        {user.profile?.company ? `🏢 ${user.profile.company}` : ""}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                                    <button
                                        className="admin-btn admin-btn--primary"
                                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
                                        onClick={() => handleImpersonate(user)}
                                        disabled={impersonating === user._id || isCurrentAdmin}
                                    >
                                        {impersonating === user._id ? (
                                            <>Erişim sağlanıyor...</>
                                        ) : (
                                            <>
                                                <FaSignInAlt /> Panele Eriş
                                            </>
                                        )}
                                    </button>
                                    <a
                                        href={`/admin/users`}
                                        className="admin-btn admin-btn--ghost"
                                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                                    >
                                        <FaExternalLinkAlt /> Detay
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && filteredUsers.length === 0 && (
                <div className="admin-card">
                    <div className="admin-empty">
                        <FaTimesCircle style={{ fontSize: 24, marginBottom: 8, color: "var(--muted)" }} />
                        <div>Eşleşen kullanıcı bulunamadı.</div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminUserAccess;
