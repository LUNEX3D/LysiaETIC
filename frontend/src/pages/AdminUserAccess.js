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
    FaInfoCircle
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

const AdminUserAccess = () => {
    const [users, setUsers] = useState([]);
    const [marketplacesByUser, setMarketplacesByUser] = useState({});
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState(null);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        const loadUsers = async () => {
            setLoading(true);
            const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
            try {
                const res = await axios.get("/admin/users", { headers: h });
                const list = Array.isArray(res.data) ? res.data : [];
                setUsers(list);

                const entries = await Promise.all(
                    list.map(async user => {
                        try {
                            const mpRes = await axios.get(
                                `/admin/marketplace/user-marketplaces/${user._id}`,
                                { headers: h }
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
            const matchesQuery = !q || user.name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q);
            const matchesRole = roleFilter === "all" || user.role === roleFilter;
            return matchesQuery && matchesRole;
        });
    }, [users, query, roleFilter]);

    const handleImpersonate = async (user) => {
        setImpersonating(user._id);
        setMessage({ text: "", type: "" });

        try {
            const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
            const res = await axios.post(`/admin/system/impersonate/${user._id}`, {}, { headers: h });

            if (res.data.success) {
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

                localStorage.setItem("token", res.data.token);
                localStorage.setItem("userId", res.data.user._id);
                localStorage.setItem("userEmail", res.data.user.email);
                localStorage.setItem("userName", res.data.user.name);
                localStorage.setItem("userRole", res.data.user.role);
                localStorage.setItem("isImpersonating", "true");
                localStorage.setItem("impersonatedBy", adminEmail);

                setMessage({ text: `${user.name} kullanıcısı olarak panele geçiliyor...`, type: "success" });
                window.location.href = "/dashboard";
            }
        } catch (err) {
            setMessage({ text: `Erişim sağlanamadı: ${err.response?.data?.message || err.message}`, type: "error" });
        } finally {
            setImpersonating(null);
        }
    };

    const getRoleInfo = (role) => {
        const map = {
            admin: { label: "Admin", cls: "ap-badge--red", icon: <FaUserShield /> },
            dev: { label: "Developer", cls: "ap-badge--cyan", icon: <FaUserCog /> },
            moderator: { label: "Moderatör", cls: "ap-badge--yellow", icon: <FaUserCog /> },
            seller: { label: "Satıcı", cls: "ap-badge--green", icon: <FaStore /> },
            user: { label: "Kullanıcı", cls: "ap-badge--blue", icon: <FaEye /> }
        };
        return map[role] || map.user;
    };

    const getSubBadge = (sub) => {
        if (!sub?.plan || sub.plan === "free") return <span className="ap-badge ap-badge--neutral">Free</span>;
        if (sub.plan === "basic") return <span className="ap-badge ap-badge--blue">Basic</span>;
        if (sub.plan === "pro") return <span className="ap-badge ap-badge--yellow">Pro</span>;
        if (sub.plan === "enterprise") return <span className="ap-badge ap-badge--green">Enterprise</span>;
        return null;
    };

    return (
        <AdminLayout
            title="Kullanıcı Erişimi"
            subtitle="Kullanıcı panellerine güvenli şekilde erişim sağlayın"
            actions={
                <div className="ap-actions">
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ap-muted)" }}>
                        <FaInfoCircle /> Geçiş aynı sekmede yapılır, dashboard'dan admin'e geri dönebilirsiniz
                    </span>
                </div>
            }
        >
            {message.text && (
                <div className={`ap-alert ${message.type === "success" ? "ap-alert--success" : "ap-alert--error"}`}>
                    {message.text}
                </div>
            )}

            {/* Toolbar */}
            <div className="ap-toolbar">
                <div className="ap-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Kullanıcı ara: isim, e-posta..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <select className="ap-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="all">Tüm Roller</option>
                    <option value="admin">Admin</option>
                    <option value="dev">Developer</option>
                    <option value="moderator">Moderatör</option>
                    <option value="seller">Satıcı</option>
                    <option value="user">Kullanıcı</option>
                </select>
                <div className="ap-toolbar-count">{filteredUsers.length} kullanıcı</div>
            </div>

            {loading && <div className="ap-loading">Kullanıcılar yükleniyor...</div>}

            {!loading && (
                <div className="ap-grid ap-grid--auto">
                    {filteredUsers.map(user => {
                        const integrations = marketplacesByUser[user._id] || [];
                        const roleInfo = getRoleInfo(user.role);
                        const isCurrentAdmin = user._id === localStorage.getItem("userId");

                        return (
                            <div key={user._id} className="ap-user-card">
                                {/* User Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                    <div
                                        className="ap-user-avatar"
                                        style={{
                                            width: 50, height: 50, borderRadius: 14, fontSize: 18,
                                            background: isCurrentAdmin
                                                ? "linear-gradient(135deg, var(--ap-red-soft), rgba(248,113,113,0.2))"
                                                : "linear-gradient(135deg, var(--ap-primary), var(--ap-accent))",
                                            color: isCurrentAdmin ? "var(--ap-red)" : "#fff"
                                        }}
                                    >
                                        {user.name?.charAt(0).toUpperCase() || "?"}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                                            {user.name}
                                            {isCurrentAdmin && (
                                                <span style={{ fontSize: 10, color: "var(--ap-red)", fontWeight: 600 }}>(Siz)</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--ap-muted)", marginTop: 2 }}>{user.email}</div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                            <span className={`ap-badge ${roleInfo.cls}`}>{roleInfo.label}</span>
                                            {getSubBadge(user.subscription)}
                                        </div>
                                    </div>
                                </div>

                                {/* Integrations */}
                                <div className="ap-divider" />
                                <div>
                                    <div style={{ fontSize: 12, color: "var(--ap-muted)", marginBottom: 8, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                        <FaStore /> Entegrasyonlar ({integrations.length})
                                    </div>
                                    {integrations.length === 0 ? (
                                        <div style={{ fontSize: 12, color: "var(--ap-muted)", fontStyle: "italic" }}>Entegrasyon yok</div>
                                    ) : (
                                        <div className="ap-chips">
                                            {integrations.slice(0, 4).map(mp => (
                                                <span key={mp._id} className="ap-chip">{mp.marketplaceName}</span>
                                            ))}
                                            {integrations.length > 4 && (
                                                <span className="ap-chip" style={{ color: "var(--ap-muted)" }}>+{integrations.length - 4}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Meta */}
                                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ap-muted)" }}>
                                    {user.createdAt && <span>Kayıt: {new Date(user.createdAt).toLocaleDateString("tr-TR")}</span>}
                                    {user.profile?.company && <span>🏢 {user.profile.company}</span>}
                                </div>

                                {/* Actions */}
                                <div className="ap-divider" />
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        className="ap-btn ap-btn--primary ap-btn--sm"
                                        style={{ flex: 1, justifyContent: "center" }}
                                        onClick={() => handleImpersonate(user)}
                                        disabled={impersonating === user._id || isCurrentAdmin}
                                    >
                                        {impersonating === user._id ? "Erişim sağlanıyor..." : <><FaSignInAlt /> Panele Eriş</>}
                                    </button>
                                    <a href="/admin/users" className="ap-btn ap-btn--ghost ap-btn--sm">
                                        <FaExternalLinkAlt /> Detay
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && filteredUsers.length === 0 && (
                <div className="ap-empty">
                    <FaTimesCircle />
                    <div>Eşleşen kullanıcı bulunamadı.</div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminUserAccess;
