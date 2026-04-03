import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch, FaUsers } from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [marketplacesByUser, setMarketplacesByUser] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUsers = async () => {
            setLoading(true);
            try {
                const res = await axios.get("/admin/users", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                setUsers(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
                setUsers([]);
            } finally {
                setLoading(false);
            }
        };
        loadUsers();
    }, []);

    useEffect(() => {
        const loadIntegrations = async () => {
            if (!users.length) { setMarketplacesByUser({}); return; }
            const entries = await Promise.all(
                users.map(async user => {
                    try {
                        const res = await axios.get(
                            `/admin/marketplace/user-marketplaces/${user._id}`,
                            { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
                        );
                        return [user._id, res.data || []];
                    } catch {
                        return [user._id, []];
                    }
                })
            );
            setMarketplacesByUser(Object.fromEntries(entries));
        };
        loadIntegrations();
    }, [users]);

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter(user => {
            const matchesQuery = !q || user.name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q) || user._id?.toLowerCase().includes(q);
            const matchesRole = roleFilter === "all" || user.role === roleFilter;
            return matchesQuery && matchesRole;
        });
    }, [users, query, roleFilter]);

    const roleClass = role => {
        const key = (role || "user").toLowerCase();
        if (key === "admin") return "ap-badge ap-badge--red";
        if (key === "dev") return "ap-badge ap-badge--cyan";
        if (key === "moderator") return "ap-badge ap-badge--yellow";
        if (key === "seller") return "ap-badge ap-badge--green";
        return "ap-badge ap-badge--blue";
    };

    const renderIntegrations = userId => {
        const integrations = marketplacesByUser[userId] || [];
        if (!integrations.length) {
            return <span style={{ fontSize: 12, color: "var(--ap-muted)", fontStyle: "italic" }}>Yok</span>;
        }
        const preview = integrations.slice(0, 3);
        const extra = integrations.length - preview.length;
        return (
            <div className="ap-chips">
                {preview.map(item => (
                    <span key={item._id} className="ap-chip">{item.marketplaceName}</span>
                ))}
                {extra > 0 && <span className="ap-chip" style={{ color: "var(--ap-muted)" }}>+{extra}</span>}
            </div>
        );
    };

    return (
        <AdminLayout
            title="Kullanıcı Yönetimi"
            subtitle="Roller, erişimler ve entegrasyonlar"
            actions={
                <div className="ap-actions">
                    <button className="ap-btn ap-btn--ghost">CSV İndir</button>
                    <button className="ap-btn ap-btn--primary">Yeni Kullanıcı</button>
                </div>
            }
        >
            <div className="ap-toolbar">
                <div className="ap-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Ara: isim, e-posta, ID"
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
                <div className="ap-toolbar-count">
                    <FaUsers style={{ marginRight: 4 }} />
                    {filteredUsers.length} kullanıcı
                </div>
            </div>

            {loading && <div className="ap-loading">Kullanıcılar yükleniyor...</div>}

            {!loading && (
                <div className="ap-table-wrap">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>İsim</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Entegrasyonlar</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user._id}>
                                    <td className="mono">{user._id}</td>
                                    <td style={{ fontWeight: 600 }}>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={roleClass(user.role)}>{user.role || "user"}</span>
                                    </td>
                                    <td>{renderIntegrations(user._id)}</td>
                                    <td>
                                        <Link to={`/admin/user/${user._id}`} className="ap-btn ap-btn--ghost ap-btn--sm">
                                            Düzenle
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="ap-empty">Eşleşen kullanıcı bulunamadı.</div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminUsers;
