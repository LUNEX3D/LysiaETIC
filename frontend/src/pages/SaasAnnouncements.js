import React, { useEffect, useState } from "react";
import { FaBullhorn, FaPlus, FaEdit, FaTrash, FaExclamationTriangle } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../services/saasAdminApi";

const SaasAnnouncements = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        title: "", message: "", type: "info", priority: "medium", targetUsers: "all", targetPlan: "", endDate: ""
    });

    useEffect(() => { loadAnnouncements(); }, []);

    const loadAnnouncements = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getAnnouncements();
            setAnnouncements(res.data.announcements || []);
        } catch (err) {
            console.error(err);
            setError("Duyurular alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.message) {
            alert("Başlık ve mesaj zorunludur.");
            return;
        }
        setLoading(true);
        try {
            if (editMode) {
                await updateAnnouncement(formData._id, formData);
            } else {
                await createAnnouncement(formData);
            }
            setShowModal(false);
            resetForm();
            loadAnnouncements();
        } catch (err) {
            alert("İşlem başarısız: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
        setLoading(true);
        try {
            await deleteAnnouncement(id);
            loadAnnouncements();
        } catch (err) {
            alert("Silme başarısız.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ title: "", message: "", type: "info", priority: "medium", targetUsers: "all", targetPlan: "", endDate: "" });
        setEditMode(false);
    };

    const typeLabels = { info: "Bilgi", warning: "Uyarı", maintenance: "Bakım", feature: "Yeni Özellik", update: "Güncelleme" };
    const typeColors = { info: "blue", warning: "yellow", maintenance: "orange", feature: "green", update: "cyan" };
    const priorityLabels = { low: "Düşük", medium: "Orta", high: "Yüksek" };
    const priorityColors = { low: "green", medium: "yellow", high: "red" };

    return (
        <AdminLayout
            title="Bildirim & Duyuru Sistemi"
            subtitle="Tüm kullanıcılara mesaj gönder, bakım bildirimi yap"
            actions={
                <button className="ap-btn ap-btn--primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <FaPlus /> Yeni Duyuru
                </button>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}
            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && announcements.length === 0 && (
                <div className="ap-card"><div className="ap-empty"><FaBullhorn /> Henüz duyuru yok.</div></div>
            )}

            {!loading && announcements.length > 0 && (
                <div className="ap-list" style={{ gap: 12 }}>
                    {announcements.map(ann => (
                        <div key={ann._id} className="ap-card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                        <span className={`ap-badge ap-badge--${typeColors[ann.type] || "blue"}`}>
                                            {typeLabels[ann.type] || ann.type}
                                        </span>
                                        <span className={`ap-badge ap-badge--${priorityColors[ann.priority] || "yellow"}`}>
                                            {priorityLabels[ann.priority] || ann.priority}
                                        </span>
                                        {ann.isActive ? (
                                            <span className="ap-badge ap-badge--green">Aktif</span>
                                        ) : (
                                            <span className="ap-badge ap-badge--neutral">Pasif</span>
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{ann.title}</h3>
                                    <p style={{ fontSize: 13, color: "var(--ap-muted)", lineHeight: 1.6, marginBottom: 8 }}>
                                        {ann.message}
                                    </p>
                                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--ap-muted)" }}>
                                        <span>Hedef: <strong>{ann.targetUsers === "all" ? "Tüm Kullanıcılar" : ann.targetUsers}</strong></span>
                                        <span>Oluşturan: <strong>{ann.createdBy?.name || "—"}</strong></span>
                                        <span>Tarih: <strong>{new Date(ann.createdAt).toLocaleDateString("tr-TR")}</strong></span>
                                        {ann.endDate && <span>Bitiş: <strong>{new Date(ann.endDate).toLocaleDateString("tr-TR")}</strong></span>}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    <button
                                        className="ap-btn ap-btn--sm ap-btn--ghost"
                                        onClick={() => {
                                            setFormData(ann);
                                            setEditMode(true);
                                            setShowModal(true);
                                        }}
                                    >
                                        <FaEdit />
                                    </button>
                                    <button
                                        className="ap-btn ap-btn--sm ap-btn--danger"
                                        onClick={() => handleDelete(ann._id)}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="ap-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <h3>{editMode ? "Duyuru Düzenle" : "Yeni Duyuru Oluştur"}</h3>
                            <button className="ap-modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="ap-modal-body">
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div>
                                    <label className="ap-label">Başlık *</label>
                                    <input
                                        type="text"
                                        className="ap-input"
                                        placeholder="Duyuru başlığı..."
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="ap-label">Mesaj *</label>
                                    <textarea
                                        className="ap-input"
                                        rows="4"
                                        placeholder="Duyuru mesajı..."
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    />
                                </div>
                                <div className="ap-grid ap-grid--3">
                                    <div>
                                        <label className="ap-label">Tür</label>
                                        <select className="ap-select" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="info">Bilgi</option>
                                            <option value="warning">Uyarı</option>
                                            <option value="maintenance">Bakım</option>
                                            <option value="feature">Yeni Özellik</option>
                                            <option value="update">Güncelleme</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="ap-label">Öncelik</label>
                                        <select className="ap-select" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                                            <option value="low">Düşük</option>
                                            <option value="medium">Orta</option>
                                            <option value="high">Yüksek</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="ap-label">Hedef</label>
                                        <select className="ap-select" value={formData.targetUsers} onChange={(e) => setFormData({ ...formData, targetUsers: e.target.value })}>
                                            <option value="all">Tüm Kullanıcılar</option>
                                            <option value="active">Aktif Kullanıcılar</option>
                                            <option value="trial">Trial Kullanıcılar</option>
                                            <option value="specific_plan">Belirli Plan</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="ap-label">Bitiş Tarihi (opsiyonel)</label>
                                    <input
                                        type="date"
                                        className="ap-input"
                                        value={formData.endDate ? formData.endDate.split("T")[0] : ""}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
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

export default SaasAnnouncements;
