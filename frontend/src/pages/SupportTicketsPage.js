/**
 * SupportTicketsPage — Kullanıcı Destek Talepleri
 * Kullanıcıların ticket oluşturma, listeleme, detay görme ve yanıt yazma sayfası.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getMyTickets, getMyTicketDetail, createTicket, replyToTicket } from "../services/ticketApi";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaTicketAlt, FaPlus, FaPaperPlane, FaTimes, FaSearch,
    FaClock, FaCheckCircle, FaSpinner, FaExclamationTriangle,
    FaChevronRight, FaFilter, FaInbox, FaReply, FaInfoCircle
} from "react-icons/fa";

/* ═══════════════════════════════════════════════════════════
   SABITLER
   ═══════════════════════════════════════════════════════════ */
const STATUS_MAP = {
    open:             { tr: "Açık",               en: "Open",             color: "#3b82f6", icon: <FaClock /> },
    in_progress:      { tr: "İşlemde",            en: "In Progress",      color: "#f59e0b", icon: <FaSpinner /> },
    waiting_customer: { tr: "Yanıtınız Bekleniyor", en: "Awaiting Reply", color: "#f97316", icon: <FaExclamationTriangle /> },
    resolved:         { tr: "Çözüldü",            en: "Resolved",         color: "#22c55e", icon: <FaCheckCircle /> },
    closed:           { tr: "Kapatıldı",          en: "Closed",           color: "#6b7280", icon: <FaCheckCircle /> },
};

const CATEGORY_MAP = {
    technical:       { tr: "Teknik",          en: "Technical",       icon: "🔧" },
    billing:         { tr: "Fatura / Ödeme",  en: "Billing",         icon: "💳" },
    feature_request: { tr: "Özellik Talebi",  en: "Feature Request", icon: "💡" },
    bug:             { tr: "Hata Bildirimi",  en: "Bug Report",      icon: "🐛" },
    general:         { tr: "Genel",           en: "General",         icon: "📩" },
};

const PRIORITY_MAP = {
    low:    { tr: "Düşük",  en: "Low",    color: "#22c55e" },
    medium: { tr: "Orta",   en: "Medium", color: "#f59e0b" },
    high:   { tr: "Yüksek", en: "High",   color: "#f97316" },
    urgent: { tr: "Acil",   en: "Urgent", color: "#ef4444" },
};

/* ═══════════════════════════════════════════════════════════
   YARDIMCI
   ═══════════════════════════════════════════════════════════ */
const rgba = (hex, alpha) => {
    if (!hex || hex.charAt(0) !== "#") return `rgba(128,128,128,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

const spinCSS = `@keyframes stSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
const Spinner = ({ size = 18, color }) => (
    <>
        <style>{spinCSS}</style>
        <span style={{
            display: "inline-block", width: size, height: size,
            border: `2.5px solid transparent`, borderTopColor: color || "#888",
            borderRightColor: color || "#888",
            borderRadius: "50%", animation: "stSpin 0.6s linear infinite",
        }} />
    </>
);

/* ═══════════════════════════════════════════════════════════
   ANA COMPONENT
   ═══════════════════════════════════════════════════════════ */
const SupportTicketsPage = () => {
    const { theme: C, language } = useApp();
    const tr = language === "tr";

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filtreler
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Yeni ticket modal
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ subject: "", category: "general", priority: "medium", message: "" });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    // Ticket detay modal
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketDetail, setTicketDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);

    /* ── Styles ── */
    const card = {
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: "1.25rem", backdropFilter: "blur(20px)",
    };
    const inp = {
        width: "100%", padding: "0.65rem 0.9rem", background: C.inputBg || C.glass,
        border: `1px solid ${C.inputBorder || C.glassBr}`, borderRadius: 10, color: C.text,
        fontSize: "0.88rem", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
        boxSizing: "border-box",
    };
    const sel = { ...inp, cursor: "pointer", appearance: "auto" };
    const btnP = {
        padding: "0.6rem 1.4rem", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
        border: "none", borderRadius: 10, color: "#fff", fontSize: "0.84rem",
        fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.45rem",
        boxShadow: `0 4px 14px ${rgba(C.accent, 0.25)}`,
    };

    /* ── Data Loading ── */
    const loadTickets = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getMyTickets();
            setTickets(res.data.tickets || []);
        } catch (err) {
            console.error("loadTickets error:", err);
            setError(tr ? "Destek talepleri yüklenemedi." : "Failed to load support tickets.");
        } finally {
            setLoading(false);
        }
    }, [tr]);

    useEffect(() => { loadTickets(); }, [loadTickets]);

    /* ── Create Ticket ── */
    const handleCreate = async () => {
        if (!createForm.subject.trim() || !createForm.message.trim()) {
            setCreateError(tr ? "Konu ve mesaj alanları zorunludur." : "Subject and message are required.");
            return;
        }
        setCreating(true);
        setCreateError("");
        try {
            await createTicket(createForm);
            setShowCreate(false);
            setCreateForm({ subject: "", category: "general", priority: "medium", message: "" });
            loadTickets();
        } catch (err) {
            setCreateError(err.response?.data?.message || (tr ? "Ticket oluşturulamadı." : "Failed to create ticket."));
        } finally {
            setCreating(false);
        }
    };

    /* ── Open Detail ── */
    const openDetail = async (ticket) => {
        setSelectedTicket(ticket);
        setDetailLoading(true);
        setReplyText("");
        try {
            const res = await getMyTicketDetail(ticket._id);
            setTicketDetail(res.data.ticket);
        } catch (err) {
            console.error("openDetail error:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    /* ── Reply ── */
    const handleReply = async () => {
        if (!replyText.trim()) return;
        setReplying(true);
        try {
            const res = await replyToTicket(selectedTicket._id, replyText.trim());
            setTicketDetail(res.data.ticket);
            setReplyText("");
            loadTickets();
        } catch (err) {
            alert(err.response?.data?.message || (tr ? "Yanıt gönderilemedi." : "Failed to send reply."));
        } finally {
            setReplying(false);
        }
    };

    /* ── Filter ── */
    const filtered = tickets.filter(t => {
        const matchSearch = !search ||
            t.subject?.toLowerCase().includes(search.toLowerCase()) ||
            t.ticketNumber?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "all" || t.status === statusFilter;
        return matchSearch && matchStatus;
    });

    /* ── KPI ── */
    const kpis = [
        { label: tr ? "Toplam" : "Total", value: tickets.length, color: C.accent, icon: <FaTicketAlt /> },
        { label: tr ? "Açık" : "Open", value: tickets.filter(t => t.status === "open").length, color: "#3b82f6", icon: <FaClock /> },
        { label: tr ? "İşlemde" : "In Progress", value: tickets.filter(t => t.status === "in_progress").length, color: "#f59e0b", icon: <FaSpinner /> },
        { label: tr ? "Çözüldü" : "Resolved", value: tickets.filter(t => t.status === "resolved" || t.status === "closed").length, color: "#22c55e", icon: <FaCheckCircle /> },
    ];

    const formatDate = (d) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString(tr ? "tr-TR" : "en-US", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div style={{ padding: "clamp(0.75rem, 2vw, 1.5rem)", color: C.text, minHeight: "100vh" }}>

            {/* ════════════ HEADER ════════════ */}
            <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                    <h1 style={{
                        fontSize: "clamp(1.3rem, 2.8vw, 1.7rem)", fontWeight: 800, margin: 0,
                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                        🎫 {tr ? "Destek Talepleri" : "Support Tickets"}
                    </h1>
                    <p style={{ color: C.muted, fontSize: "0.8rem", margin: "0.2rem 0 0 0" }}>
                        {tr ? "Sorunlarınızı bize iletin, en kısa sürede yanıtlayalım" : "Submit your issues and we'll respond as soon as possible"}
                    </p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowCreate(true); setCreateError(""); }}
                    style={btnP}
                >
                    <FaPlus /> {tr ? "Yeni Talep Oluştur" : "New Ticket"}
                </motion.button>
            </div>

            {/* ════════════ KPI CARDS ════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
                {kpis.map((kpi, i) => (
                    <motion.div key={i}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        style={{
                            ...card, padding: "1rem 1.25rem", position: "relative", overflow: "hidden",
                            borderLeft: `3px solid ${kpi.color}`,
                        }}
                    >
                        <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, background: `radial-gradient(circle, ${kpi.color}12 0%, transparent 70%)`, pointerEvents: "none" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                            <span style={{ color: kpi.color, fontSize: "0.9rem" }}>{kpi.icon}</span>
                            <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 600 }}>{kpi.label}</span>
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.text }}>{kpi.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* ════════════ TOOLBAR ════════════ */}
            <div style={{ ...card, marginBottom: "1rem", padding: "0.85rem 1.1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 200,
                        background: C.inputBg || C.glass, border: `1px solid ${C.inputBorder || C.glassBr}`,
                        borderRadius: 10, padding: "0 0.75rem",
                    }}>
                        <FaSearch style={{ color: C.dim, fontSize: "0.8rem", flexShrink: 0 }} />
                        <input
                            type="text" placeholder={tr ? "Ticket no veya konu ara..." : "Search ticket # or subject..."}
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ ...inp, border: "none", padding: "0.55rem 0", background: "transparent" }}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <FaFilter style={{ color: C.dim, fontSize: "0.75rem" }} />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...sel, width: "auto", minWidth: 130 }}>
                            <option value="all">{tr ? "Tüm Durumlar" : "All Status"}</option>
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                                <option key={key} value={key}>{tr ? val.tr : val.en}</option>
                            ))}
                        </select>
                    </div>
                    <span style={{ color: C.dim, fontSize: "0.78rem", fontWeight: 600, flexShrink: 0 }}>
                        {filtered.length} {tr ? "talep" : "ticket(s)"}
                    </span>
                </div>
            </div>

            {/* ════════════ ERROR ════════════ */}
            {error && (
                <div style={{ ...card, marginBottom: "1rem", padding: "0.85rem 1.1rem", borderLeft: `3px solid ${C.red || "#ef4444"}`, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FaExclamationTriangle style={{ color: C.red || "#ef4444" }} />
                    <span style={{ color: C.red || "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>{error}</span>
                </div>
            )}

            {/* ════════════ LOADING ════════════ */}
            {loading && (
                <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
                    <Spinner size={24} color={C.accent} />
                    <p style={{ color: C.muted, marginTop: "0.75rem", fontSize: "0.85rem" }}>
                        {tr ? "Yükleniyor..." : "Loading..."}
                    </p>
                </div>
            )}

            {/* ════════════ EMPTY STATE ════════════ */}
            {!loading && filtered.length === 0 && (
                <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
                    <FaInbox style={{ fontSize: "2.5rem", color: C.dim, marginBottom: "0.75rem" }} />
                    <p style={{ color: C.muted, fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.5rem 0" }}>
                        {tickets.length === 0
                            ? (tr ? "Henüz destek talebiniz yok" : "No support tickets yet")
                            : (tr ? "Filtreye uygun talep bulunamadı" : "No tickets match your filter")
                        }
                    </p>
                    {tickets.length === 0 && (
                        <p style={{ color: C.dim, fontSize: "0.8rem", margin: 0 }}>
                            {tr ? "Yardıma mı ihtiyacınız var? Yukarıdaki butona tıklayarak yeni bir talep oluşturun." : "Need help? Click the button above to create a new ticket."}
                        </p>
                    )}
                </div>
            )}

            {/* ════════════ TICKET LIST ════════════ */}
            {!loading && filtered.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {filtered.map((ticket, idx) => {
                        const st = STATUS_MAP[ticket.status] || STATUS_MAP.open;
                        const cat = CATEGORY_MAP[ticket.category] || CATEGORY_MAP.general;
                        const pri = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.medium;
                        return (
                            <motion.div key={ticket._id}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => openDetail(ticket)}
                                style={{
                                    ...card, cursor: "pointer", padding: "1rem 1.25rem",
                                    transition: "border-color 0.2s, box-shadow 0.2s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = rgba(C.accent, 0.4); e.currentTarget.style.boxShadow = `0 4px 16px ${rgba(C.accent, 0.08)}`; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                    {/* Sol: Kategori ikonu */}
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 11,
                                        background: rgba(st.color, 0.1), border: `1px solid ${rgba(st.color, 0.2)}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.2rem", flexShrink: 0,
                                    }}>
                                        {cat.icon}
                                    </div>

                                    {/* Orta: Bilgiler */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                                            <span style={{ color: C.dim, fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 600 }}>
                                                #{ticket.ticketNumber}
                                            </span>
                                            <span style={{
                                                padding: "0.15rem 0.5rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700,
                                                background: rgba(st.color, 0.1), color: st.color, border: `1px solid ${rgba(st.color, 0.25)}`,
                                                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                            }}>
                                                {st.icon} {tr ? st.tr : st.en}
                                            </span>
                                            <span style={{
                                                padding: "0.15rem 0.5rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700,
                                                background: rgba(pri.color, 0.08), color: pri.color,
                                            }}>
                                                {tr ? pri.tr : pri.en}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {ticket.subject}
                                        </div>
                                        <div style={{ fontSize: "0.73rem", color: C.dim, marginTop: "0.2rem" }}>
                                            {formatDate(ticket.createdAt)} · {ticket.messages?.length || 0} {tr ? "mesaj" : "message(s)"}
                                        </div>
                                    </div>

                                    {/* Sağ: Ok */}
                                    <FaChevronRight style={{ color: C.dim, fontSize: "0.75rem", flexShrink: 0 }} />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ════════════ CREATE TICKET MODAL ════════════ */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowCreate(false)}
                        style={{
                            position: "fixed", inset: 0, zIndex: 9999,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "1rem", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}fa 100%)`,
                                border: `1px solid ${C.border}`, borderRadius: 18,
                                padding: "1.75rem", maxWidth: 560, width: "100%",
                                maxHeight: "90vh", overflowY: "auto",
                            }}
                        >
                            {/* Modal Header */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                                <h2 style={{
                                    fontSize: "1.15rem", fontWeight: 800, margin: 0,
                                    background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    display: "flex", alignItems: "center", gap: "0.5rem",
                                }}>
                                    <FaPlus /> {tr ? "Yeni Destek Talebi" : "New Support Ticket"}
                                </h2>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowCreate(false)}
                                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "1.1rem", padding: "0.3rem" }}>
                                    <FaTimes />
                                </motion.button>
                            </div>

                            {/* Info */}
                            <div style={{
                                padding: "0.7rem 0.9rem", borderRadius: 10, marginBottom: "1rem",
                                background: rgba(C.accent, 0.05), border: `1px solid ${rgba(C.accent, 0.12)}`,
                                display: "flex", alignItems: "flex-start", gap: "0.5rem",
                            }}>
                                <FaInfoCircle style={{ color: C.accent, fontSize: "0.85rem", marginTop: "0.15rem", flexShrink: 0 }} />
                                <p style={{ color: C.muted, fontSize: "0.76rem", margin: 0, lineHeight: 1.5 }}>
                                    {tr
                                        ? "Sorununuzu detaylı açıklayın. Ekâran görüntüsü veya hata mesajı paylaşmanız çözüm sürecini hızlandırır."
                                        : "Describe your issue in detail. Sharing screenshots or error messages will speed up the resolution process."
                                    }
                                </p>
                            </div>

                            {/* Form */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                {/* Konu */}
                                <div>
                                    <label style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.3rem", display: "block" }}>
                                        {tr ? "Konu *" : "Subject *"}
                                    </label>
                                    <input
                                        type="text" value={createForm.subject}
                                        onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))}
                                        placeholder={tr ? "Sorununuzu kısaca özetleyin..." : "Briefly summarize your issue..."}
                                        style={inp}
                                        maxLength={200}
                                    />
                                </div>

                                {/* Kategori + Öncelik */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div>
                                        <label style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.3rem", display: "block" }}>
                                            {tr ? "Kategori" : "Category"}
                                        </label>
                                        <select value={createForm.category} onChange={e => setCreateForm(p => ({ ...p, category: e.target.value }))} style={sel}>
                                            {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                                                <option key={key} value={key}>{val.icon} {tr ? val.tr : val.en}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.3rem", display: "block" }}>
                                            {tr ? "Öncelik" : "Priority"}
                                        </label>
                                        <select value={createForm.priority} onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value }))} style={sel}>
                                            {Object.entries(PRIORITY_MAP).map(([key, val]) => (
                                                <option key={key} value={key}>{tr ? val.tr : val.en}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Mesaj */}
                                <div>
                                    <label style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.3rem", display: "block" }}>
                                        {tr ? "Mesajınız *" : "Your Message *"}
                                    </label>
                                    <textarea
                                        value={createForm.message}
                                        onChange={e => setCreateForm(p => ({ ...p, message: e.target.value }))}
                                        placeholder={tr ? "Sorununuzu detaylı olarak açıklayın..." : "Describe your issue in detail..."}
                                        rows={5}
                                        style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
                                    />
                                </div>

                                {/* Error */}
                                {createError && (
                                    <div style={{ color: C.red || "#ef4444", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                        <FaExclamationTriangle /> {createError}
                                    </div>
                                )}

                                {/* Submit */}
                                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => setShowCreate(false)}
                                        style={{
                                            padding: "0.6rem 1.2rem", background: C.glass,
                                            border: `1px solid ${C.glassBr}`, borderRadius: 10,
                                            color: C.muted, fontSize: "0.84rem", fontWeight: 600, cursor: "pointer",
                                        }}>
                                        {tr ? "İptal" : "Cancel"}
                                    </motion.button>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        onClick={handleCreate} disabled={creating}
                                        style={{ ...btnP, opacity: creating ? 0.6 : 1, cursor: creating ? "not-allowed" : "pointer" }}>
                                        {creating ? <Spinner size={14} color="#fff" /> : <FaPaperPlane />}
                                        {creating ? (tr ? "Gönderiliyor..." : "Sending...") : (tr ? "Gönder" : "Submit")}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════ TICKET DETAIL MODAL ════════════ */}
            <AnimatePresence>
                {selectedTicket && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => { setSelectedTicket(null); setTicketDetail(null); }}
                        style={{
                            position: "fixed", inset: 0, zIndex: 9999,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "1rem", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}fa 100%)`,
                                border: `1px solid ${C.border}`, borderRadius: 18,
                                padding: "1.75rem", maxWidth: 640, width: "100%",
                                maxHeight: "90vh", display: "flex", flexDirection: "column",
                            }}
                        >
                            {/* Detail Header */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                                        <span style={{ color: C.dim, fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 700 }}>
                                            #{(ticketDetail || selectedTicket).ticketNumber}
                                        </span>
                                        {(() => {
                                            const st = STATUS_MAP[(ticketDetail || selectedTicket).status] || STATUS_MAP.open;
                                            return (
                                                <span style={{
                                                    padding: "0.2rem 0.55rem", borderRadius: 7, fontSize: "0.72rem", fontWeight: 700,
                                                    background: rgba(st.color, 0.1), color: st.color, border: `1px solid ${rgba(st.color, 0.25)}`,
                                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                }}>
                                                    {st.icon} {tr ? st.tr : st.en}
                                                </span>
                                            );
                                        })()}
                                        {(() => {
                                            const pri = PRIORITY_MAP[(ticketDetail || selectedTicket).priority] || PRIORITY_MAP.medium;
                                            return (
                                                <span style={{
                                                    padding: "0.2rem 0.55rem", borderRadius: 7, fontSize: "0.72rem", fontWeight: 700,
                                                    background: rgba(pri.color, 0.08), color: pri.color,
                                                }}>
                                                    {tr ? pri.tr : pri.en}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: C.text, margin: 0 }}>
                                        {(ticketDetail || selectedTicket).subject}
                                    </h3>
                                    <p style={{ color: C.dim, fontSize: "0.73rem", margin: "0.25rem 0 0 0" }}>
                                        {formatDate((ticketDetail || selectedTicket).createdAt)}
                                        {(ticketDetail || selectedTicket).assignedTo?.name && (
                                            <> · {tr ? "Atanan:" : "Assigned:"} {(ticketDetail || selectedTicket).assignedTo.name}</>
                                        )}
                                    </p>
                                </div>
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => { setSelectedTicket(null); setTicketDetail(null); }}
                                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "1.1rem", padding: "0.3rem", flexShrink: 0 }}>
                                    <FaTimes />
                                </motion.button>
                            </div>

                            {/* Messages */}
                            <div style={{
                                flex: 1, overflowY: "auto", marginBottom: "1rem",
                                padding: "0.75rem", borderRadius: 12,
                                background: rgba(C.text, 0.02), border: `1px solid ${rgba(C.text, 0.05)}`,
                                maxHeight: 380, minHeight: 150,
                            }}>
                                {detailLoading ? (
                                    <div style={{ textAlign: "center", padding: "2rem" }}>
                                        <Spinner size={20} color={C.accent} />
                                    </div>
                                ) : (
                                    (ticketDetail?.messages || []).map((msg, i) => {
                                        const isUser = msg.senderType === "user";
                                        const bubbleColor = isUser ? C.accent : (C.green || "#22c55e");
                                        return (
                                            <div key={i} style={{
                                                padding: "0.85rem 1rem", marginBottom: "0.5rem",
                                                borderRadius: 12, borderLeft: `3px solid ${bubbleColor}`,
                                                background: rgba(bubbleColor, 0.05),
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", fontSize: "0.72rem" }}>
                                                    <span style={{ fontWeight: 700, color: bubbleColor }}>
                                                        {isUser
                                                            ? (tr ? "Siz" : "You")
                                                            : (msg.sender?.name || (tr ? "Destek Ekibi" : "Support Team"))
                                                        }
                                                    </span>
                                                    <span style={{ color: C.dim }}>
                                                        {msg.timestamp ? formatDate(msg.timestamp) : ""}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: "0.84rem", lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap" }}>
                                                    {msg.message}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {!detailLoading && (!ticketDetail?.messages || ticketDetail.messages.length === 0) && (
                                    <div style={{ textAlign: "center", color: C.dim, padding: "2rem", fontSize: "0.85rem" }}>
                                        {tr ? "Henüz mesaj yok." : "No messages yet."}
                                    </div>
                                )}
                            </div>

                            {/* Reply Box */}
                            {(ticketDetail || selectedTicket).status !== "closed" ? (
                                <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-end" }}>
                                    <textarea
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        placeholder={tr ? "Yanıtınızı yazın..." : "Type your reply..."}
                                        rows={2}
                                        style={{ ...inp, flex: 1, resize: "vertical", lineHeight: 1.5 }}
                                    />
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={handleReply} disabled={!replyText.trim() || replying}
                                        style={{
                                            ...btnP, padding: "0.6rem 1rem", flexShrink: 0,
                                            opacity: (!replyText.trim() || replying) ? 0.5 : 1,
                                            cursor: (!replyText.trim() || replying) ? "not-allowed" : "pointer",
                                        }}>
                                        {replying ? <Spinner size={14} color="#fff" /> : <FaReply />}
                                        {tr ? "Yanıtla" : "Reply"}
                                    </motion.button>
                                </div>
                            ) : (
                                <div style={{
                                    padding: "0.75rem 1rem", borderRadius: 10, textAlign: "center",
                                    background: rgba(C.dim, 0.06), border: `1px solid ${rgba(C.dim, 0.12)}`,
                                    color: C.dim, fontSize: "0.82rem", fontWeight: 600,
                                }}>
                                    {tr ? "Bu talep kapatılmıştır. Yeni bir sorunuz varsa yeni talep oluşturabilirsiniz." : "This ticket is closed. You can create a new ticket if you have further questions."}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SupportTicketsPage;
