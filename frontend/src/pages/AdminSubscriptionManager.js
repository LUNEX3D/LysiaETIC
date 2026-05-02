/**
 * AdminSubscriptionManager — Admin Abonelik Yönetimi
 *
 * - Tüm kullanıcıların abonelik durumları
 * - Demo/abonelik verme
 * - Toplu demo verme
 * - Süre uzatma
 * - Süresi dolan/dolmak üzere olan kullanıcılar
 */

import React, { useState, useEffect, useMemo } from "react";
import {
    FaCrown, FaSearch, FaGift, FaUsers, FaExclamationTriangle,
    FaCheckCircle, FaClock, FaTimesCircle, FaSync, FaFilter
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import axios from "../services/api";

const AdminSubscriptionManager = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [message, setMessage] = useState({ text: "", type: "" });

    // Grant modal
    const [showGrantModal, setShowGrantModal] = useState(false);
    const [grantTarget, setGrantTarget] = useState(null);
    const [grantForm, setGrantForm] = useState({ plan: "trial", days: 14, note: "" });
    const [grantLoading, setGrantLoading] = useState(false);

    // Bulk demo
    const [bulkDays, setBulkDays] = useState(14);
    const [bulkLoading, setBulkLoading] = useState(false);

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await axios.get("/paytr/admin/subscriptions");
            setUsers(res.data.users || []);
        } catch (err) {
            console.error(err);
            setError("Abonelik listesi alınamadı");
        } finally {
            setLoading(false);
        }
    };

    const handleGrant = async () => {
        if (!grantTarget) return;
        setGrantLoading(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await axios.post("/paytr/admin/grant", {
                userId: grantTarget._id,
                plan: grantForm.plan,
                days: grantForm.days,
                note: grantForm.note
            });
            setMessage({ text: res.data.message, type: "success" });
            setShowGrantModal(false);
            setGrantTarget(null);
            setGrantForm({ plan: "trial", days: 14, note: "" });
            loadUsers();
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "İşlem başarısız", type: "error" });
        } finally {
            setGrantLoading(false);
        }
    };

    const handleBulkDemo = async () => {
        if (!window.confirm(`Tüm aboneliksiz kullanıcılara ${bulkDays} günlük demo verilecek. Onaylıyor musunuz?`)) return;
        setBulkLoading(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await axios.post("/paytr/admin/grant-demo-all", { days: bulkDays });
            setMessage({ text: res.data.message, type: "success" });
            loadUsers();
        } catch (err) {
            setMessage({ text: err.response?.data?.message || "Toplu demo verilemedi", type: "error" });
        } finally {
            setBulkLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter(u => {
            const matchesSearch = !q
                || u.name?.toLowerCase().includes(q)
                || u.email?.toLowerCase().includes(q);
            const sub = u.subscription || {};
            const matchesStatus = statusFilter === "all"
                || (statusFilter === "trial" && sub.plan === "trial")
                || (statusFilter === "active" && sub.status === "active" && sub.plan !== "trial")
                || (statusFilter === "expired" && u.isExpired)
                || (statusFilter === "expiring" && u.isExpiringSoon);
            return matchesSearch && matchesStatus;
        });
    }, [users, search, statusFilter]);

    // Stats
    const stats = useMemo(() => {
        const total = users.length;
        const trial = users.filter(u => u.subscription?.plan === "trial").length;
        const active = users.filter(u => u.subscription?.status === "active" && u.subscription?.plan !== "trial").length;
        const expired = users.filter(u => u.isExpired).length;
        const expiring = users.filter(u => u.isExpiringSoon).length;
        return { total, trial, active, expired, expiring };
    }, [users]);

    const getStatusBadge = (user) => {
        const sub = user.subscription || {};
        if (user.isExpired) return { label: "Süresi Dolmuş", color: "#f87171", bg: "rgba(248,113,113,0.12)" };
        if (user.isExpiringSoon) return { label: `${user.daysLeft} gün kaldı`, color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
        if (sub.status === "active" && sub.plan !== "trial") return { label: `${sub.plan?.toUpperCase()} — ${user.daysLeft}g`, color: "#34d399", bg: "rgba(52,211,153,0.12)" };
        if (sub.plan === "trial") return { label: `Demo — ${user.daysLeft}g`, color: "#22d3ee", bg: "rgba(34,211,238,0.12)" };
        return { label: "Yok", color: "#64748b", bg: "rgba(100,116,139,0.12)" };
    };

    return (
        <AdminLayout
            title="Abonelik Yönetimi"
            subtitle="Kullanıcı abonelikleri, demo süreleri ve ödeme yönetimi"
            actions={
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button className="ap-btn ap-btn--ghost" onClick={loadUsers} disabled={loading}>
                        <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                    </button>
                </div>
            }
        >
            {/* Messages */}
            {message.text && (
                <div className={`ap-alert ${message.type === "success" ? "ap-alert--success" : "ap-alert--error"}`}>
                    {message.text}
                </div>
            )}
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* KPI Cards */}
            <div className="ap-kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--purple"><FaUsers /></div>
                    <div className="ap-kpi-label">Toplam</div>
                    <div className="ap-kpi-val">{stats.total}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--cyan"><FaClock /></div>
                    <div className="ap-kpi-label">Demo</div>
                    <div className="ap-kpi-val">{stats.trial}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--green"><FaCheckCircle /></div>
                    <div className="ap-kpi-label">Aktif Abonelik</div>
                    <div className="ap-kpi-val">{stats.active}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--yellow"><FaExclamationTriangle /></div>
                    <div className="ap-kpi-label">Bitmek Üzere</div>
                    <div className="ap-kpi-val">{stats.expiring}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--red"><FaTimesCircle /></div>
                    <div className="ap-kpi-label">Süresi Dolmuş</div>
                    <div className="ap-kpi-val">{stats.expired}</div>
                </div>
            </div>

            {/* Bulk Actions */}
            <div className="ap-card" style={{ marginBottom: "20px" }}>
                <div className="ap-card-head"><FaGift /> Toplu Demo Verme</div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", color: "var(--ap-muted)" }}>
                        Aboneliği olmayan tüm kullanıcılara demo ver:
                    </span>
                    <select
                        className="ap-select"
                        value={bulkDays}
                        onChange={(e) => setBulkDays(parseInt(e.target.value))}
                        style={{ width: "auto" }}
                    >
                        <option value={7}>7 gün</option>
                        <option value={14}>14 gün</option>
                        <option value={30}>30 gün</option>
                        <option value={60}>60 gün</option>
                    </select>
                    <button
                        className="ap-btn ap-btn--primary"
                        onClick={handleBulkDemo}
                        disabled={bulkLoading}
                    >
                        {bulkLoading ? "Veriliyor..." : `Toplu Demo Ver (${bulkDays} gün)`}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="ap-toolbar">
                <div className="ap-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Kullanıcı ara: isim, e-posta..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="ap-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">Tüm Durumlar</option>
                    <option value="trial">Demo</option>
                    <option value="active">Aktif Abonelik</option>
                    <option value="expiring">Bitmek Üzere</option>
                    <option value="expired">Süresi Dolmuş</option>
                </select>
                <div className="ap-toolbar-count">
                    <FaFilter style={{ marginRight: 4 }} />
                    {filteredUsers.length} kullanıcı
                </div>
            </div>

            {/* Users Table */}
            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && (
                <div className="ap-table-wrap">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>Kullanıcı</th>
                                <th>Rol</th>
                                <th>Paket</th>
                                <th>Durum</th>
                                <th>Kalan Gün</th>
                                <th>Kayıt Tarihi</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const sub = user.subscription || {};
                                const badge = getStatusBadge(user);
                                return (
                                    <tr key={user._id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                                            <div style={{ fontSize: "12px", color: "var(--ap-muted)" }}>{user.email}</div>
                                        </td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${user.role === "admin" ? "red" : user.role === "dev" ? "cyan" : "blue"}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${sub.plan === "enterprise" ? "yellow" : sub.plan === "pro" ? "purple" : sub.plan === "basic" ? "blue" : "cyan"}`}>
                                                {(sub.plan || "yok").toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: "4px 12px",
                                                borderRadius: "8px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                background: badge.bg,
                                                color: badge.color,
                                            }}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td style={{
                                            fontWeight: 700,
                                            color: user.isExpired ? "var(--ap-red)" : user.isExpiringSoon ? "var(--ap-yellow)" : "var(--ap-green)"
                                        }}>
                                            {user.daysLeft} gün
                                        </td>
                                        <td style={{ fontSize: "13px", color: "var(--ap-muted)" }}>
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "-"}
                                        </td>
                                        <td>
                                            <button
                                                className="ap-btn ap-btn--primary ap-btn--sm"
                                                onClick={() => {
                                                    setGrantTarget(user);
                                                    setGrantForm({ plan: "trial", days: 14, note: "" });
                                                    setShowGrantModal(true);
                                                }}
                                            >
                                                <FaGift /> Paket Ver
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="ap-empty">Eşleşen kullanıcı bulunamadı.</div>
                    )}
                </div>
            )}

            {/* Grant Modal */}
            {showGrantModal && grantTarget && (
                <div style={modalStyles.overlay} onClick={() => setShowGrantModal(false)}>
                    <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={modalStyles.header}>
                            <h3 style={modalStyles.title}>
                                <FaGift /> Paket / Demo Ver
                            </h3>
                            <button style={modalStyles.close} onClick={() => setShowGrantModal(false)}>×</button>
                        </div>
                        <div style={modalStyles.body}>
                            <div style={modalStyles.userInfo}>
                                <strong>{grantTarget.name}</strong>
                                <span style={{ color: "var(--ap-muted)", fontSize: "13px" }}>{grantTarget.email}</span>
                            </div>

                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Paket</label>
                                <select
                                    style={modalStyles.select}
                                    value={grantForm.plan}
                                    onChange={(e) => setGrantForm({ ...grantForm, plan: e.target.value })}
                                >
                                    <option value="trial">Demo (Trial)</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>

                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Süre (gün)</label>
                                <input
                                    type="number"
                                    style={modalStyles.input}
                                    value={grantForm.days}
                                    onChange={(e) => setGrantForm({ ...grantForm, days: parseInt(e.target.value) || 0 })}
                                    min={1}
                                    max={365}
                                />
                            </div>

                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Not (opsiyonel)</label>
                                <input
                                    type="text"
                                    style={modalStyles.input}
                                    value={grantForm.note}
                                    onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
                                    placeholder="ÖÖrn: Özel kampanya, test amaçlı..."
                                />
                            </div>
                        </div>
                        <div style={modalStyles.footer}>
                            <button
                                style={modalStyles.cancelBtn}
                                onClick={() => setShowGrantModal(false)}
                            >
                                İptal
                            </button>
                            <button
                                style={modalStyles.submitBtn}
                                onClick={handleGrant}
                                disabled={grantLoading}
                            >
                                {grantLoading ? "Veriliyor..." : `${grantForm.days} Gün ${grantForm.plan.toUpperCase()} Ver`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

const modalStyles = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
    },
    modal: {
        background: "#111631",
        borderRadius: "18px",
        width: "100%",
        maxWidth: "480px",
        border: "1px solid rgba(99,102,241,0.15)",
    },
    header: {
        padding: "24px",
        borderBottom: "1px solid rgba(99,102,241,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#fff",
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    close: {
        background: "none",
        border: "none",
        color: "#64748b",
        fontSize: "28px",
        cursor: "pointer",
        padding: 0,
    },
    body: {
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
    },
    userInfo: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "16px",
        background: "rgba(99,102,241,0.06)",
        borderRadius: "12px",
        color: "#fff",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#94a3b8",
    },
    select: {
        padding: "12px 16px",
        background: "rgba(12,15,26,0.9)",
        border: "1px solid rgba(100,116,139,0.2)",
        borderRadius: "10px",
        color: "#f1f5f9",
        fontSize: "14px",
        fontFamily: "inherit",
        outline: "none",
    },
    input: {
        padding: "12px 16px",
        background: "rgba(12,15,26,0.9)",
        border: "1px solid rgba(100,116,139,0.2)",
        borderRadius: "10px",
        color: "#f1f5f9",
        fontSize: "14px",
        fontFamily: "inherit",
        outline: "none",
    },
    footer: {
        padding: "20px 24px",
        borderTop: "1px solid rgba(99,102,241,0.1)",
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px",
    },
    cancelBtn: {
        padding: "12px 24px",
        background: "transparent",
        border: "1px solid rgba(100,116,139,0.2)",
        borderRadius: "10px",
        color: "#94a3b8",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    submitBtn: {
        padding: "12px 24px",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        border: "none",
        borderRadius: "10px",
        color: "#fff",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
    },
};

export default AdminSubscriptionManager;
