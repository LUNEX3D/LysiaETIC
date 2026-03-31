import React, { useEffect, useState } from "react";
import { FaCrown, FaPlus, FaEdit, FaSearch, FaExclamationTriangle } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getSubscriptions, createSubscription, updateSubscription } from "../services/saasAdminApi";

const SaasSubscriptions = () => {
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        userId: "", plan: "trial", status: "active", price: 0, billingCycle: "monthly"
    });

    useEffect(() => { loadSubscriptions(); }, []);

    const loadSubscriptions = async () => {
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
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            if (editMode) {
                await updateSubscription(formData._id, formData);
            } else {
                await createSubscription(formData);
            }
            setShowModal(false);
            setFormData({ userId: "", plan: "trial", status: "active", price: 0, billingCycle: "monthly" });
            loadSubscriptions();
        } catch (err) {
            alert("İşlem başarısız: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const filtered = subscriptions.filter(s =>
        !search || s.userId?.name?.toLowerCase().includes(search.toLowerCase()) || s.userId?.email?.toLowerCase().includes(search.toLowerCase())
    );

    const planLabels = { trial: "Trial", basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
    const statusLabels = { active: "Aktif", suspended: "Askıda", cancelled: "İptal", expired: "Süresi Dolmuş", trial: "Deneme" };
    const planColors = { trial: "yellow", basic: "blue", pro: "purple", enterprise: "green" };
    const statusColors = { active: "green", suspended: "yellow", cancelled: "red", expired: "red", trial: "cyan" };

    return (
        <AdminLayout
            title="Paket & Abonelik Yönetimi"
            subtitle="Kullanıcı aboneliklerini görüntüle, oluştur ve düzenle"
            actions={
                <button className="ap-btn ap-btn--primary" onClick={() => { setEditMode(false); setShowModal(true); }}>
                    <FaPlus /> Yeni Abonelik
                </button>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Kullanıcı ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <span className="ap-toolbar-count">{filtered.length} abonelik</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Kullanıcı</th>
                                    <th>Plan</th>
                                    <th>Durum</th>
                                    <th>Fiyat</th>
                                    <th>Döngü</th>
                                    <th>Başlangıç</th>
                                    <th>Bitiş</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(sub => (
                                    <tr key={sub._id}>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.userId?.name || "—"}</div>
                                                <div className="mono" style={{ fontSize: 11 }}>{sub.userId?.email || "—"}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${planColors[sub.plan]}`}>
                                                {planLabels[sub.plan] || sub.plan}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${statusColors[sub.status]}`}>
                                                {statusLabels[sub.status] || sub.status}
                                            </span>
                                        </td>
                                        <td>₺{sub.price?.toLocaleString("tr-TR") || 0}</td>
                                        <td>{sub.billingCycle === "monthly" ? "Aylık" : "Yıllık"}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>
                                            {sub.startDate ? new Date(sub.startDate).toLocaleDateString("tr-TR") : "—"}
                                        </td>
                                        <td className="mono" style={{ fontSize: 11 }}>
                                            {sub.endDate ? new Date(sub.endDate).toLocaleDateString("tr-TR") : "—"}
                                        </td>
                                        <td>
                                            <button
                                                className="ap-btn ap-btn--sm ap-btn--ghost"
                                                onClick={() => {
                                                    setFormData(sub);
                                                    setEditMode(true);
                                                    setShowModal(true);
                                                }}
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

            {/* Modal */}
            {showModal && (
                <div className="ap-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3>{editMode ? "Abonelik Düzenle" : "Yeni Abonelik Oluştur"}</h3>
                            <button className="ap-modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="ap-modal-body">
                            <div className="ap-grid ap-grid--2">
                                {!editMode && (
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <label className="ap-label">Kullanıcı ID</label>
                                        <input
                                            type="text"
                                            className="ap-input"
                                            placeholder="Kullanıcı MongoDB ID"
                                            value={formData.userId}
                                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="ap-label">Plan</label>
                                    <select
                                        className="ap-select"
                                        value={formData.plan}
                                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                                    >
                                        <option value="trial">Trial</option>
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
                                        <option value="expired">Süresi Dolmuş</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="ap-label">Fiyat (₺)</label>
                                    <input
                                        type="number"
                                        className="ap-input"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
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
                            <button className="ap-btn ap-btn--ghost" onClick={() => setShowModal(false)}>İptal</button>
                            <button className="ap-btn ap-btn--primary" onClick={handleSubmit} disabled={loading}>
                                {loading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasSubscriptions;
