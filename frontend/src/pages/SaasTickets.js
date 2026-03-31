import React, { useEffect, useState } from "react";
import { FaTicketAlt, FaSearch, FaReply, FaExclamationTriangle, FaCheckCircle, FaClock, FaUser } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getTickets, getTicketDetail, replyTicket, updateTicketStatus } from "../services/saasAdminApi";

const SaasTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketDetail, setTicketDetail] = useState(null);
    const [replyText, setReplyText] = useState("");

    useEffect(() => { loadTickets(); }, []);

    const loadTickets = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getTickets();
            setTickets(res.data.tickets || []);
        } catch (err) {
            console.error(err);
            setError("Ticketlar alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const openTicketDetail = async (ticket) => {
        setSelectedTicket(ticket);
        try {
            const res = await getTicketDetail(ticket._id);
            setTicketDetail(res.data.ticket);
        } catch (err) {
            console.error(err);
        }
    };

    const handleReply = async () => {
        if (!replyText.trim()) return;
        try {
            await replyTicket(selectedTicket._id, replyText);
            setReplyText("");
            openTicketDetail(selectedTicket);
            loadTickets();
        } catch (err) {
            alert("Yanıt gönderilemedi.");
        }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await updateTicketStatus(id, status);
            if (selectedTicket) openTicketDetail(selectedTicket);
            loadTickets();
        } catch (err) {
            alert("Durum güncellenemedi.");
        }
    };

    const filtered = tickets.filter(t => {
        const matchSearch = !search ||
            t.subject?.toLowerCase().includes(search.toLowerCase()) ||
            t.ticketNumber?.toLowerCase().includes(search.toLowerCase()) ||
            t.userId?.name?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || t.status === filter;
        return matchSearch && matchFilter;
    });

    const statusLabels = { open: "Açık", in_progress: "İşlemde", waiting_customer: "Müşteri Bekleniyor", resolved: "Çözüldü", closed: "Kapatıldı" };
    const statusColors = { open: "blue", in_progress: "yellow", waiting_customer: "orange", resolved: "green", closed: "neutral" };
    const priorityLabels = { low: "Düşük", medium: "Orta", high: "Yüksek", urgent: "Acil" };
    const priorityColors = { low: "green", medium: "yellow", high: "orange", urgent: "red" };
    const categoryLabels = { technical: "Teknik", billing: "Fatura", feature_request: "Özellik Talebi", bug: "Hata", general: "Genel" };

    return (
        <AdminLayout
            title="Destek Talepleri"
            subtitle="Kullanıcı destek taleplerini görüntüle ve yanıtla"
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            {/* KPI */}
            <div className="ap-kpi-grid">
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--blue"><FaTicketAlt /></div>
                    <div className="ap-kpi-label">Toplam Ticket</div>
                    <div className="ap-kpi-val">{tickets.length}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--yellow"><FaClock /></div>
                    <div className="ap-kpi-label">Açık</div>
                    <div className="ap-kpi-val">{tickets.filter(t => t.status === "open").length}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--orange"><FaClock /></div>
                    <div className="ap-kpi-label">İşlemde</div>
                    <div className="ap-kpi-val">{tickets.filter(t => t.status === "in_progress").length}</div>
                </div>
                <div className="ap-kpi">
                    <div className="ap-kpi-icon ap-kpi-icon--green"><FaCheckCircle /></div>
                    <div className="ap-kpi-label">Çözüldü</div>
                    <div className="ap-kpi-val">{tickets.filter(t => t.status === "resolved" || t.status === "closed").length}</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Ticket no, konu veya kullanıcı ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">Tüm Ticketlar</option>
                        <option value="open">Açık</option>
                        <option value="in_progress">İşlemde</option>
                        <option value="waiting_customer">Müşteri Bekleniyor</option>
                        <option value="resolved">Çözüldü</option>
                        <option value="closed">Kapatıldı</option>
                    </select>
                    <span className="ap-toolbar-count">{filtered.length} ticket</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length === 0 && (
                <div className="ap-card"><div className="ap-empty"><FaTicketAlt /> Ticket bulunamadı.</div></div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="ap-list" style={{ gap: 8 }}>
                    {filtered.map(ticket => (
                        <div
                            key={ticket._id}
                            className="ap-card"
                            style={{ cursor: "pointer" }}
                            onClick={() => openTicketDetail(ticket)}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                        <span className="mono" style={{ fontSize: 11, color: "var(--ap-muted)" }}>#{ticket.ticketNumber}</span>
                                        <span className={`ap-badge ap-badge--${statusColors[ticket.status]}`}>
                                            {statusLabels[ticket.status]}
                                        </span>
                                        <span className={`ap-badge ap-badge--${priorityColors[ticket.priority]}`}>
                                            {priorityLabels[ticket.priority]}
                                        </span>
                                        <span className="ap-badge ap-badge--neutral">
                                            {categoryLabels[ticket.category] || ticket.category}
                                        </span>
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ticket.subject}</div>
                                    <div style={{ fontSize: 12, color: "var(--ap-muted)" }}>
                                        <FaUser style={{ fontSize: 10 }} /> {ticket.userId?.name || "—"} · {ticket.userId?.email || "—"} · {new Date(ticket.createdAt).toLocaleDateString("tr-TR")}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, color: "var(--ap-muted)" }}>
                                        {ticket.messages?.length || 0} mesaj
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="ap-modal-overlay" onClick={() => { setSelectedTicket(null); setTicketDetail(null); }}>
                    <div className="ap-modal ap-modal--lg" onClick={(e) => e.stopPropagation()}>
                        <div className="ap-modal-header">
                            <div>
                                <h3>#{ticketDetail?.ticketNumber || selectedTicket.ticketNumber} — {ticketDetail?.subject || selectedTicket.subject}</h3>
                                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                    <span className={`ap-badge ap-badge--${statusColors[ticketDetail?.status || selectedTicket.status]}`}>
                                        {statusLabels[ticketDetail?.status || selectedTicket.status]}
                                    </span>
                                    <span className={`ap-badge ap-badge--${priorityColors[ticketDetail?.priority || selectedTicket.priority]}`}>
                                        {priorityLabels[ticketDetail?.priority || selectedTicket.priority]}
                                    </span>
                                </div>
                            </div>
                            <button className="ap-modal-close" onClick={() => { setSelectedTicket(null); setTicketDetail(null); }}>×</button>
                        </div>
                        <div className="ap-modal-body">
                            {/* Status Actions */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                {["open", "in_progress", "waiting_customer", "resolved", "closed"].map(s => (
                                    <button
                                        key={s}
                                        className={`ap-btn ap-btn--sm ${(ticketDetail?.status || selectedTicket.status) === s ? "ap-btn--primary" : "ap-btn--ghost"}`}
                                        onClick={() => handleStatusChange(selectedTicket._id, s)}
                                    >
                                        {statusLabels[s]}
                                    </button>
                                ))}
                            </div>

                            {/* Messages */}
                            <div className="ap-terminal" style={{ maxHeight: 350, marginBottom: 16 }}>
                                {(ticketDetail?.messages || []).map((msg, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: "12px 14px",
                                            marginBottom: 8,
                                            borderRadius: 10,
                                            background: msg.senderType === "admin" ? "rgba(99, 102, 241, 0.08)" : "rgba(52, 211, 153, 0.06)",
                                            borderLeft: `3px solid ${msg.senderType === "admin" ? "var(--ap-primary)" : "var(--ap-green)"}`,
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                                            <span style={{ fontWeight: 700, color: msg.senderType === "admin" ? "var(--ap-primary)" : "var(--ap-green)" }}>
                                                {msg.sender?.name || (msg.senderType === "admin" ? "Admin" : "Kullanıcı")}
                                            </span>
                                            <span style={{ color: "var(--ap-muted)" }}>
                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleString("tr-TR") : ""}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ap-text)" }}>{msg.message}</div>
                                    </div>
                                ))}
                                {(!ticketDetail?.messages || ticketDetail.messages.length === 0) && (
                                    <div style={{ textAlign: "center", color: "var(--ap-muted)", padding: 20 }}>Henüz mesaj yok.</div>
                                )}
                            </div>

                            {/* Reply */}
                            <div style={{ display: "flex", gap: 10 }}>
                                <textarea
                                    className="ap-input"
                                    rows="3"
                                    placeholder="Yanıtınızı yazın..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="ap-btn ap-btn--primary"
                                    onClick={handleReply}
                                    disabled={!replyText.trim()}
                                    style={{ alignSelf: "flex-end" }}
                                >
                                    <FaReply /> Yanıtla
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasTickets;
