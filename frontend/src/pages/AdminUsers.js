import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch, FaUserShield } from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";
import "../styles/admin.css";

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
                const list = Array.isArray(res.data) ? res.data : [];
                setUsers(list);
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
            if (!users.length) {
                setMarketplacesByUser({});
                return;
            }

            const entries = await Promise.all(
                users.map(async user => {
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
        };

        loadIntegrations();
    }, [users]);

    const filteredUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter(user => {
            const matchesQuery =
                !q ||
                user.name?.toLowerCase().includes(q) ||
                user.email?.toLowerCase().includes(q) ||
                user._id?.toLowerCase().includes(q);
            const matchesRole = roleFilter === "all" || user.role === roleFilter;
            return matchesQuery && matchesRole;
        });
    }, [users, query, roleFilter]);

    const roleClass = role => {
        const key = (role || "user").toLowerCase();
        if (key === "admin") return "admin-pill admin-pill--admin";
        if (key === "dev") return "admin-pill admin-pill--dev";
        if (key === "moderator") return "admin-pill admin-pill--moderator";
        if (key === "seller") return "admin-pill admin-pill--seller";
        return "admin-pill admin-pill--user";
    };

    const renderIntegrations = userId => {
        const integrations = marketplacesByUser[userId] || [];
        if (!integrations.length) {
            return <span className="admin-chip admin-chip--empty">Entegrasyon yok</span>;
        }

        const preview = integrations.slice(0, 3);
        const extra = integrations.length - preview.length;

        return (
            <div className="admin-chips">
                {preview.map(item => {
                    const meta =
                        item.credentials?.sellerId ||
                        item.credentials?.merchantId ||
                        item.credentials?.supplierId ||
                        item.credentials?.storeId ||
                        null;

                    return (
                        <div key={item._id} className="admin-chip">
                            <div className="admin-chip-title">{item.marketplaceName}</div>
                            {meta && <div className="admin-chip-meta">ID: {meta}</div>}
                        </div>
                    );
                })}
                {extra > 0 && (
                    <span className="admin-chip admin-chip--more">+{extra}</span>
                )}
            </div>
        );
    };

    return (
        <AdminLayout
            title="Kullanıcı Yönetimi"
            subtitle="Roller, erişimler ve entegrasyonlar"
            actions={
                <div className="admin-action-row">
                    <button className="admin-btn admin-btn--ghost" type="button">
                        CSV indir
                    </button>
                    <button className="admin-btn admin-btn--primary" type="button">
                        Yeni kullanıcı
                    </button>
                </div>
            }
        >
            <div className="admin-toolbar">
                <div className="admin-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Ara: isim, e-posta, ID"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <div className="admin-filter">
                    <FaUserShield />
                    <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                        <option value="all">Tüm roller</option>
                        <option value="admin">Admin</option>
                        <option value="dev">Program Dev</option>
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
                <div className="admin-card admin-card--table">
                    <table className="admin-table">
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
                                    <td>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={roleClass(user.role)}>
                                            {user.role || "user"}
                                        </span>
                                    </td>
                                    <td>{renderIntegrations(user._id)}</td>
                                    <td>
                                        <Link to={`/admin/user/${user._id}`} className="admin-link">
                                            Düzenle
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="admin-empty">Eşleşen kullanıcı bulunamadı.</div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminUsers;