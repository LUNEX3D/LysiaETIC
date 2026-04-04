import React, { useEffect, useState } from "react";
import { FaBullhorn, FaPlus, FaEdit, FaTrash, FaExclamationTriangle, FaBell, FaPaperPlane } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, sendAdminNotification } from "../services/saasAdminApi";

const SaasAnnouncements = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        title: "", message: "", type: "info", priority: "medium", targetUsers: "all", targetPlan: "", endDate: ""
    });
    const [sendAsNotif, setSendAsNotif] = useState(true);
    const [showQuickNotif, setShowQuickNotif] = useState(false);
    const [quickNotif, setQuickNotif] = useState({ title: "", message: "", priority: "medium", icon: "📢" });
    const [notifStatus, setNotifStatus] = useState("");

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
                // Aynı zamanda anlık bildirim olarak da gönder
                if (sendAsNotif) {
                    try {
                        await sendAdminNotification({
                            title: formData.title,
                            message: formData.message,
                            priority: formData.priority,
                            targetAudience: formData.targetUsers === "specific_plan" ? "all" : formData.targetUsers,
                            icon: formData.type === "warning" ? "⚠️" : formData.type === "maintenance" ? "🔧" : formData.type === "feature" ? "✨" : formData.type === "update" ? "🔄" : "📢",
                            expiresAt: formData.endDate || undefined
                        });
                    } catch { /* bildirim gönderilemezse sessiz devam */ }
                }
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

    const handleQuickNotif = async () => {
        if (!quickNotif.title || !quickNotif.message) {
            alert("Başlık ve mesaj zorunludur.");
            return;
        }
        setNotifStatus("sending");
        try {
            await sendAdminNotification({
                title: quickNotif.title,
                message: quickNotif.message,
                priority: quickNotif.priority,
                targetAudience: "all",
                icon: quickNotif.icon
            });
            setNotifStatus("success");
            setQuickNotif({ title: "", message: "", priority: "medium", icon: "📢" });
            setTimeout(() => { setNotifStatus(""); setShowQuickNotif(false); }, 2000);
        } catch (err) {
            setNotifStatus("error");
            alert("Bildirim gönderilemedi: " + (err.response?.data?.error || err.message));
            setTimeout(() => setNotifStatus(""), 3000);
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
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="ap-btn ap-btn--ghost" onClick={() => setShowQuickNotif(true)} title="Hızlı bildirim gönder">
                        <FaBell /> Hızlı Bildirim
                    </button>
                    <button className="ap-btn ap-btn--primary" onClick={() => { resetForm(); setShowModal(true); }}>
                        <FaPlus /> Yeni Duyuru
                    </button>
                </div>
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
                                {!editMode && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--ap-border, rgba(255,255,255,0.08))" }}>
                                        <input
                                            type="checkbox"
                                            id="sendAsNotif"
                                            checked={sendAsNotif}
                                            onChange={(e) => setSendAsNotif(e.target.checked)}
                                            style={{ width: 16, height: 16, cursor: "pointer" }}
                                        />
                                        <label htmlFor="sendAsNotif" style={{ fontSize: 13, cursor: "pointer", color: "var(--ap-text, #e2e8f0)" }}>
                                            <FaBell style={{ marginRight: 6, fontSize: 12, color: "#f59e0b" }} />
                                            Anlık bildirim olarak da gönder (kullanıcıların zil ikonunda görünür)
                                        </label>
                                    </div>
                                )}
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
            {/* Hızlı Bildirim Modal */}
            {showQuickNotif && (
                <div className="ap-modal-overlay" onClick={() => setShowQuickNotif(false)}>
                    <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="ap-modal-header">
                            <h3><FaPaperPlane style={{ marginRight: 8 }} /> Hızlı Bildirim Gönder</h3>
                            <button className="ap-modal-close" onClick={() => setShowQuickNotif(false)}>×</button>
                        </div>
                        <div className="ap-modal-body">
                            <p style={{ fontSize: 12, color: "var(--ap-muted)", marginBottom: 16 }}>
                                Bu bildirim tüm kullanıcıların bildirim panelinde anlık olarak görünecektir.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <div>
                                    <label className="ap-label">Başlık *</label>
                                    <input type="text" className="ap-input" placeholder="Bildirim başlığı..."
                                        value={quickNotif.title} onChange={(e) => setQuickNotif({ ...quickNotif, title: e.target.value })} />
                                </div>
                                <div>
                                    <label className="ap-label">Mesaj *</label>
                                    <textarea className="ap-input" rows="3" placeholder="Bildirim mesajı..."
                                        value={quickNotif.message} onChange={(e) => setQuickNotif({ ...quickNotif, message: e.target.value })} />
                                </div>
                                <div className="ap-grid ap-grid--3">
                                    <div>
                                        <label className="ap-label">Öncelik</label>
                                        <select className="ap-select" value={quickNotif.priority} onChange={(e) => setQuickNotif({ ...quickNotif, priority: e.target.value })}>
                                            <option value="low">Düşük</option>
                                            <option value="medium">Orta</option>
                                            <option value="high">Yüksek</option>
                                            <option value="critical">Kritik</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="ap-label">İkon</label>
                                        <select className="ap-select" value={quickNotif.icon} onChange={(e) => setQuickNotif({ ...quickNotif, icon: e.target.value })}>
                                            <option value="📢">📢 Duyuru</option>
                                            <option value="⚠️">⚠️ Uyarı</option>
                                            <option value="🔧">🔧 Bakım</option>
                                            <option value="✨">✨ Yenilik</option>
                                            <option value="🔄">🔄 Güncelleme</option>
                                            <option value="🎉">🎉 Kutlama</option>
                                            <option value="💡">💡 İpucu</option>
                                            <option value="🚨">🚨 Acil</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="ap-modal-footer">
                            <button className="ap-btn ap-btn--ghost" onClick={() => setShowQuickNotif(false)}>İptal</button>
                            <button className="ap-btn ap-btn--primary" onClick={handleQuickNotif}
                                disabled={notifStatus === "sending"} style={{ minWidth: 140 }}>
                                {notifStatus === "sending" ? "Gönderiliyor..." : notifStatus === "success" ? "✅ Gönderildi!" : "Gönder"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasAnnouncements;
