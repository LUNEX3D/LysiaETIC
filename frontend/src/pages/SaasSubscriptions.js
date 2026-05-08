import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    FaPlus, FaEdit, FaSearch, FaExclamationTriangle, FaSync, FaCrown, FaFilter,
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import {
    getSubscriptions,
    createSubscription,
    updateSubscription,
    getTenants,
} from "../services/saasAdminApi";

const emptyForm = () => ({
    _id: null,
    userId: "",
    plan: "trial",
    status: "active",
    price: 0,
    billingCycle: "monthly",
    startDate: "",
    endDate: "",
});

const SaasSubscriptions = () => {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [tenants, setTenants] = useState([]);
    const [tenantsLoading, setTenantsLoading] = useState(false);
    const [tenantPickSearch, setTenantPickSearch] = useState("");

    const loadSubscriptions = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getSubscriptions();
            setSubscriptions(res.data.subscriptions || []);
        } catch (err) {
            console.error(err);
            setError("Abonelikler alınamadı.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);

    const loadTenantsForPicker = useCallback(async () => {
        setTenantsLoading(true);
        try {
            const res = await getTenants();
            setTenants(res.data.tenants || []);
        } catch (e) {
            console.error(e);
        } finally {
            setTenantsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (showModal && !editMode) loadTenantsForPicker();
    }, [showModal, editMode, loadTenantsForPicker]);

    const planLabels = {
        free: "Ücretsiz",
        trial: "Deneme",
        basic: "Basic",
        pro: "Pro",
        enterprise: "Enterprise",
    };
    const statusLabels = {
        active: "Aktif",
        suspended: "Askıda",
        cancelled: "İptal",
        expired: "Süresi dolmuş",
        trial: "Deneme",
    };
    const planColors = {
        free: "cyan",
        trial: "yellow",
        basic: "blue",
        pro: "purple",
        enterprise: "green",
    };
    const statusColors = {
        active: "green",
        suspended: "yellow",
        cancelled: "red",
        expired: "red",
        trial: "cyan",
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return subscriptions.filter((s) => {
            const name = s.userId?.name || "";
            const email = s.userId?.email || "";
            if (q && !name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;

            if (statusFilter === "all") return true;
            if (statusFilter === "expired") return s.isExpired === true || s.status === "expired";
            if (statusFilter === "expiring") {
                const d = s.daysLeft;
                return typeof d === "number" && d > 0 && d <= 7;
            }
            return (s.status || "") === statusFilter;
        });
    }, [subscriptions, search, statusFilter]);

    const tenantsFiltered = useMemo(() => {
        const q = tenantPickSearch.trim().toLowerCase();
        if (!q) return tenants;
        return tenants.filter((t) => {
            const name = `${t.name || ""} ${t.surname || ""}`.toLowerCase();
            const email = (t.email || "").toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [tenants, tenantPickSearch]);

    const openCreate = () => {
        setEditMode(false);
        setFormData(emptyForm());
        setTenantPickSearch("");
        setShowModal(true);
    };

    const openEdit = (row) => {
        const uid = row.userId && typeof row.userId === "object" ? row.userId._id : row.userId;
        setEditMode(true);
        setFormData({
            _id: row._id,
            userId: uid || "",
            plan: row.plan || "trial",
            status: row.status || "active",
            price: row.price ?? 0,
            billingCycle: row.billingCycle || "monthly",
            startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : "",
            endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : "",
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!editMode) {
            if (!formData.userId || String(formData.userId).length < 8) {
                alert("Lütfen bir kullanıcı seçin.");
                return;
            }
        }
        setSaving(true);
        try {
            const payload = {
                plan: formData.plan,
                status: formData.status,
                price: formData.price,
                billingCycle: formData.billingCycle,
            };
            if (formData.startDate) payload.startDate = formData.startDate;
            if (formData.endDate) payload.endDate = formData.endDate;

            if (editMode) {
                await updateSubscription(formData._id, payload);
            } else {
                await createSubscription({ ...payload, userId: formData.userId });
            }
            setShowModal(false);
            setFormData(emptyForm());
            await loadSubscriptions();
        } catch (err) {
            alert("İşlem başarısız: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminLayout
            title="Abonelik yönetimi"
            subtitle="Kullanıcı abonelikleri (User.subscription ile uyumlu liste). Paket fiyat ve limitleri için Paket Yönetimi sayfasını kullanın."
            actions={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link to="/admin/plan-manager" className="ap-btn ap-btn--ghost">
                        <FaCrown /> Paket tanımları
                    </Link>
                    <button type="button" className="ap-btn ap-btn--ghost" onClick={loadSubscriptions} disabled={loading}>
                        <FaSync className={loading ? "ap-spin-icon" : ""} /> Yenile
                    </button>
                    <button type="button" className="ap-btn ap-btn--primary" onClick={openCreate}>
                        <FaPlus /> Yeni abonelik
                    </button>
                </div>
            }
        >
            {error && (
                <div className="ap-alert ap-alert--error">
                    <FaExclamationTriangle /> {error}
                </div>
            )}

            <div className="ap-card">
                <div className="ap-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="İsim veya e-posta ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FaFilter style={{ color: "var(--ap-muted)" }} />
                        <select
                            className="ap-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ minWidth: 160 }}
                        >
                            <option value="all">Tüm durumlar</option>
                            <option value="active">Aktif</option>
                            <option value="trial">Deneme</option>
                            <option value="suspended">Askıda</option>
                            <option value="cancelled">İptal</option>
                            <option value="expired">Süresi dolmuş</option>
                            <option value="expiring">7 gün içinde bitecek</option>
                        </select>
                    </div>
                    <span className="ap-toolbar-count">{filtered.length} kayıt</span>
                </div>
            </div>

            {loading && subscriptions.length === 0 && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Kullanıcı</th>
                                    <th>Plan</th>
                                    <th>Durum</th>
                                    <th>Kalan gün</th>
                                    <th>Fiyat</th>
                                    <th>Döngü</th>
                                    <th>Başlangıç</th>
                                    <th>Bitiş</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((sub) => (
                                    <tr key={String(sub._id)}>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                    {sub.userId?.name || "—"}
                                                </div>
                                                <div className="mono" style={{ fontSize: 11 }}>
                                                    {sub.userId?.email || "—"}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${planColors[sub.plan] || "purple"}`}>
                                                {planLabels[sub.plan] || sub.plan}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${statusColors[sub.status] || "yellow"}`}>
                                                {statusLabels[sub.status] || sub.status}
                                            </span>
                                            {sub.isExpired && (
                                                <div style={{ color: "#f87171", fontSize: 10, fontWeight: 600, marginTop: 4 }}>
                                                    Süre doldu
                                                </div>
                                            )}
                                        </td>
                                        <td className="mono" style={{ fontSize: 12 }}>
                                            {sub.daysLeft != null ? `${sub.daysLeft} gün` : "—"}
                                        </td>
                                        <td>₺{Number(sub.price || 0).toLocaleString("tr-TR")}</td>
                                        <td>{sub.billingCycle === "monthly" ? "Aylık" : "Yıllık"}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>
                                            {sub.startDate
                                                ? new Date(sub.startDate).toLocaleDateString("tr-TR")
                                                : "—"}
                                        </td>
                                        <td className="mono" style={{ fontSize: 11 }}>
                                            {sub.endDate
                                                ? new Date(sub.endDate).toLocaleDateString("tr-TR")
                                                : "—"}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="ap-btn ap-btn--sm ap-btn--ghost"
                                                onClick={() => openEdit(sub)}
                                            >
                                                <FaEdit /> Düzenle
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="ap-card" style={{ padding: 24, textAlign: "center", color: "var(--ap-muted)" }}>
                    Kayıt bulunamadı. Filtreleri değiştirin veya yeni abonelik oluşturun.
                </div>
            )}

            {showModal && (
                <div className="ap-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3>{editMode ? "Abonelik düzenle" : "Yeni abonelik"}</h3>
                            <button type="button" className="ap-modal-close" onClick={() => setShowModal(false)}>
                                ×
                            </button>
                        </div>
                        <div className="ap-modal-body">
                            {!editMode && (
                                <div style={{ marginBottom: 16 }}>
                                    <label className="ap-label">Kullanıcı seçin</label>
                                    <input
                                        type="text"
                                        className="ap-input"
                                        placeholder="Liste içinde ara..."
                                        value={tenantPickSearch}
                                        onChange={(e) => setTenantPickSearch(e.target.value)}
                                        style={{ marginBottom: 8 }}
                                    />
                                    {tenantsLoading ? (
                                        <div className="ap-loading" style={{ padding: 12 }}>Yükleniyor...</div>
                                    ) : (
                                        <select
                                            className="ap-select"
                                            style={{ width: "100%" }}
                                            value={formData.userId}
                                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                        >
                                            <option value="">— Seçin —</option>
                                            {tenantsFiltered.map((t) => (
                                                <option key={t._id} value={t._id}>
                                                    {t.name} {t.surname || ""} · {t.email}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}
                            {editMode && (
                                <p style={{ fontSize: 12, color: "var(--ap-muted)", marginBottom: 12 }}>
                                    Kayıt kimliği hem abonelik belgesi hem kullanıcı ID ile eşleşir; güncelleme her iki kaynağı da senkronize eder.
                                </p>
                            )}
                            <div className="ap-grid ap-grid--2">
                                <div>
                                    <label className="ap-label">Plan</label>
                                    <select
                                        className="ap-select"
                                        value={formData.plan}
                                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                                    >
                                        <option value="free">Ücretsiz</option>
                                        <option value="trial">Deneme</option>
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="ap-label">Durum</label>
                                    <select
                                        className="ap-select"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="active">Aktif</option>
                                        <option value="trial">Deneme</option>
                                        <option value="suspended">Askıda</option>
                                        <option value="cancelled">İptal</option>
                                        <option value="expired">Süresi dolmuş</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="ap-label">Başlangıç</label>
                                    <input
                                        type="date"
                                        className="ap-input"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="ap-label">Bitiş</label>
                                    <input
                                        type="date"
                                        className="ap-input"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="ap-label">Fiyat (₺)</label>
                                    <input
                                        type="number"
                                        className="ap-input"
                                        value={formData.price}
                                        onChange={(e) =>
                                            setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="ap-label">Döngü</label>
                                    <select
                                        className="ap-select"
                                        value={formData.billingCycle}
                                        onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                                    >
                                        <option value="monthly">Aylık</option>
                                        <option value="yearly">Yıllık</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="ap-modal-footer">
                            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setShowModal(false)}>
                                İptal
                            </button>
                            <button type="button" className="ap-btn ap-btn--primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasSubscriptions;
