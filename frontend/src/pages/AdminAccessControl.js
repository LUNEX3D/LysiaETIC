/**
 * AdminAccessControl — Erişim Kontrol Merkezi
 *
 * Bloklu kullanıcılar, erişim olayları (rate-limit, blokaj, yardım talepleri),
 * cihaz/IP geçmişi ve tek tıkla blokaj kaldırma.
 *
 * Tasarım kuralı (PazarYonet AI ile aynı dil): sade KPI'lar, filtre çubuğu, kart listesi.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
    FaShieldAlt, FaBan, FaUnlock, FaSearch, FaSyncAlt, FaUser,
    FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaHistory,
    FaDesktop, FaGlobe, FaClock, FaTimesCircle, FaStethoscope,
    FaUserSlash, FaFire, FaLightbulb
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

/* ─────────────── Yardımcı renkler/tema ─────────────── */
const T = {
    bg: "#0b1220",
    panel: "rgba(15,23,42,0.7)",
    border: "rgba(148,163,184,0.18)",
    text: "#e2e8f0",
    dim: "#94a3b8",
    accent: "#4ecdc4",
    red: "#f87171",
    yellow: "#fbbf24",
    green: "#34d399",
    purple: "#a78bfa",
};

const SEVERITY_COLOR = {
    info: T.accent,
    warning: T.yellow,
    error: "#fb923c",
    critical: T.red,
};

const TYPE_ICON = {
    rate_limit_429: "⚡",
    auth_failed: "🔐",
    auth_token_invalid: "🪙",
    blocked_attempt: "🚧",
    suspicious_activity: "👀",
    auto_block: "🤖",
    auto_unblock: "🔓",
    admin_block: "🛑",
    admin_unblock: "✅",
    help_request: "🆘",
    subscription_expired: "💳",
    subscription_suspended: "⛔",
    trial_ended: "⏰",
    no_subscription: "📭",
    admin_required: "🔒",
    role_denied: "🚷",
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        return new Intl.DateTimeFormat("tr-TR", {
            timeZone: "Europe/Istanbul",
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
            hour12: false,
        }).format(new Date(d));
    } catch { return String(d); }
};
const fmtRelative = (d) => {
    if (!d) return "—";
    const diff = Date.now() - new Date(d).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "az önce";
    if (min < 60) return `${min} dk önce`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} saat önce`;
    const day = Math.floor(h / 24);
    return `${day} gün önce`;
};
const fmtExpiresIn = (ms) => {
    if (!ms || ms <= 0) return "—";
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min} dk`;
    const h = Math.floor(min / 60);
    return `${h} sa ${min % 60} dk`;
};

/* ─────────────── Reusable UI bits ─────────────── */
const Card = ({ children, style }) => (
    <div style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: 16,
        backdropFilter: "blur(8px)",
        ...style,
    }}>{children}</div>
);

const KpiTile = ({ icon, label, value, color }) => (
    <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${color || T.accent}22`,
            color: color || T.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
        }}>{icon}</div>
        <div>
            <div style={{ color: T.dim, fontSize: 12, fontWeight: 600 }}>{label}</div>
            <div style={{ color: T.text, fontSize: 22, fontWeight: 800 }}>{value}</div>
        </div>
    </Card>
);

const SeverityBadge = ({ severity }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: `${SEVERITY_COLOR[severity] || T.dim}20`,
        color: SEVERITY_COLOR[severity] || T.dim,
        border: `1px solid ${SEVERITY_COLOR[severity] || T.dim}50`,
        padding: "2px 8px", borderRadius: 8,
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    }}>{severity || "—"}</span>
);

const TypeBadge = ({ type, label }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: `${T.accent}15`, color: T.text,
        border: `1px solid ${T.accent}30`,
        padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
    }}>
        <span>{TYPE_ICON[type] || "•"}</span> {label || type}
    </span>
);

const Btn = ({ children, onClick, kind = "default", disabled = false, style }) => {
    const colors = {
        default: { bg: "rgba(148,163,184,0.12)", border: T.border, color: T.text },
        primary: { bg: `${T.accent}22`, border: `${T.accent}55`, color: T.accent },
        danger:  { bg: `${T.red}22`, border: `${T.red}55`, color: T.red },
        success: { bg: `${T.green}22`, border: `${T.green}55`, color: T.green },
    }[kind];
    return (
        <button onClick={onClick} disabled={disabled} style={{
            background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`,
            padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            display: "inline-flex", alignItems: "center", gap: 6,
            ...style,
        }}>{children}</button>
    );
};

/* ─────────────── Ana bileşen ─────────────── */
const AdminAccessControl = () => {
    const [tab, setTab] = useState("troubled");  // troubled | blocked | incidents | diagnose
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [blockedUsers, setBlockedUsers] = useState([]);
    const [troubledUsers, setTroubledUsers] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [counts, setCounts] = useState({ last7: 0, critical7: 0, unresolved: 0 });
    const [labels, setLabels] = useState({ types: {}, reasons: {} });

    // Diagnose
    const [diagEmail, setDiagEmail] = useState("");
    const [diagResult, setDiagResult] = useState(null);
    const [diagLoading, setDiagLoading] = useState(false);

    // Filtreler
    const [type, setType] = useState("");
    const [severity, setSeverity] = useState("");
    const [resolved, setResolved] = useState("");
    const [query, setQuery] = useState("");

    // Modal
    const [historyUser, setHistoryUser] = useState(null);

    const authHeader = useMemo(() => ({
        Authorization: `Bearer ${localStorage.getItem("token")}`,
    }), []);

    const loadBlocked = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const res = await axios.get("/access/blocked-users", { headers: authHeader });
            setBlockedUsers(res.data?.data || []);
        } catch (e) {
            setError(e.response?.data?.message || "Bloklu kullanıcılar yüklenemedi.");
        } finally { setLoading(false); }
    }, [authHeader]);

    const loadTroubled = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const res = await axios.get("/access/troubled-users", { headers: authHeader });
            setTroubledUsers(res.data?.data || []);
        } catch (e) {
            setError(e.response?.data?.message || "Sorunlu kullanıcılar yüklenemedi.");
        } finally { setLoading(false); }
    }, [authHeader]);

    const runDiagnose = useCallback(async (emailOverride) => {
        const email = String(emailOverride || diagEmail || "").trim();
        if (!email) { setError("E-posta gerekli."); return; }
        setDiagLoading(true); setError(""); setDiagResult(null);
        try {
            const res = await axios.get("/access/diagnose", {
                params: { email },
                headers: authHeader,
            });
            setDiagResult(res.data);
        } catch (e) {
            setDiagResult({
                success: false,
                error: e.response?.data?.message || e.message,
                hint: e.response?.data?.hint || "",
            });
        } finally { setDiagLoading(false); }
    }, [authHeader, diagEmail]);

    const loadIncidents = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const params = { limit: 100 };
            if (type) params.type = type;
            if (severity) params.severity = severity;
            if (resolved !== "") params.resolved = resolved;
            if (query.trim()) params.q = query.trim();
            const res = await axios.get("/access/incidents", { params, headers: authHeader });
            setIncidents(res.data?.data || []);
            if (res.data?.counts) setCounts(res.data.counts);
            if (res.data?.labels) setLabels(res.data.labels);
        } catch (e) {
            setError(e.response?.data?.message || "Olaylar yüklenemedi.");
        } finally { setLoading(false); }
    }, [authHeader, type, severity, resolved, query]);

    useEffect(() => {
        if (tab === "blocked") loadBlocked();
        else if (tab === "troubled") loadTroubled();
        else if (tab === "incidents") loadIncidents();
    }, [tab, loadBlocked, loadTroubled, loadIncidents]);

    const handleUnblock = async (userId) => {
        if (!window.confirm("Bu kullanıcının erişim engelini kaldırmak istediğinize emin misiniz?")) return;
        try {
            await axios.post(`/access/users/${userId}/unblock`, { note: "Admin paneli üzerinden açıldı." }, { headers: authHeader });
            await loadBlocked();
            if (tab === "incidents") await loadIncidents();
        } catch (e) {
            alert("Açma başarısız: " + (e.response?.data?.message || e.message));
        }
    };

    const handleResolve = async (incidentId) => {
        try {
            await axios.post(`/access/incidents/${incidentId}/resolve`, { note: "İncelendi." }, { headers: authHeader });
            await loadIncidents();
        } catch (e) {
            alert("İşlem başarısız: " + (e.response?.data?.message || e.message));
        }
    };

    const handleBlock = async (userId, email) => {
        const reason = window.prompt(
            `${email} kullanıcısını ne sebeple blokluyorsunuz?\n` +
            "1 = Şüpheli aktivite\n2 = Ödeme gecikmesi\n3 = Kural ihlali\n4 = Güvenlik şüphesi\n5 = Diğer (manuel)\n\nNumara giriniz:",
            "5"
        );
        const map = { "1": "suspicious_activity", "2": "payment_overdue", "3": "tos_violation", "4": "security_concern", "5": "admin_manual" };
        const reasonKey = map[reason];
        if (!reasonKey) return;
        const note = window.prompt("Kısa not (kullanıcıya gösterilecek):", "") || "";
        const dur = window.prompt("Süre (dakika) — boş bırakırsanız süresiz:", "");
        const expiresInMinutes = dur && Number(dur) > 0 ? Number(dur) : null;
        try {
            await axios.post(`/access/users/${userId}/block`, {
                reason: reasonKey, note, expiresInMinutes,
            }, { headers: authHeader });
            await loadBlocked();
        } catch (e) {
            alert("Bloklama başarısız: " + (e.response?.data?.message || e.message));
        }
    };

    const openHistory = async (userId, userName) => {
        try {
            const res = await axios.get(`/access/users/${userId}/history`, { headers: authHeader });
            setHistoryUser({ ...res.data, displayName: userName });
        } catch (e) {
            alert("Geçmiş yüklenemedi: " + (e.response?.data?.message || e.message));
        }
    };

    const actions = (
        <Btn onClick={() => {
            if (tab === "blocked") loadBlocked();
            else if (tab === "troubled") loadTroubled();
            else if (tab === "incidents") loadIncidents();
            else if (tab === "diagnose") runDiagnose();
        }} kind="primary">
            <FaSyncAlt /> Yenile
        </Btn>
    );

    return (
        <AdminLayout
            title="Erişim Kontrol Merkezi"
            subtitle="Engellenmiş kullanıcılar, otomatik blokajlar, IP/cihaz olayları"
            actions={actions}
        >
            {/* KPI satırı */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12, marginBottom: 16,
            }}>
                <KpiTile icon={<FaBan />} label="Şu an bloklu" value={blockedUsers.length} color={T.red} />
                <KpiTile icon={<FaExclamationTriangle />} label="Son 7 gün kritik" value={counts.critical7 || 0} color={T.yellow} />
                <KpiTile icon={<FaHistory />} label="Son 7 gün olay" value={counts.last7 || 0} color={T.accent} />
                <KpiTile icon={<FaInfoCircle />} label="Çözülmemiş" value={counts.unresolved || 0} color={T.purple} />
            </div>

            {/* Tab seçici */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <Btn onClick={() => setTab("troubled")} kind={tab === "troubled" ? "primary" : "default"}>
                    <FaFire /> Sorunlu Kullanıcılar (24sa)
                </Btn>
                <Btn onClick={() => setTab("diagnose")} kind={tab === "diagnose" ? "primary" : "default"}>
                    <FaStethoscope /> Diagnoz Aracı
                </Btn>
                <Btn onClick={() => setTab("blocked")} kind={tab === "blocked" ? "primary" : "default"}>
                    <FaBan /> Bloklu Kullanıcılar
                </Btn>
                <Btn onClick={() => setTab("incidents")} kind={tab === "incidents" ? "primary" : "default"}>
                    <FaHistory /> Olay Akışı
                </Btn>
            </div>

            {/* Hata */}
            {error && (
                <Card style={{ marginBottom: 12, border: `1px solid ${T.red}55`, color: T.red }}>
                    <FaTimesCircle /> {error}
                </Card>
            )}

            {/* Filtre çubuğu — sadece incidents tab'ında */}
            {tab === "incidents" && (
                <Card style={{ marginBottom: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                        <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
                            <option value="">Tip — tümü</option>
                            {Object.entries(labels.types || {}).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        <select value={severity} onChange={e => setSeverity(e.target.value)} style={selectStyle}>
                            <option value="">Severity — tümü</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                            <option value="critical">Critical</option>
                        </select>
                        <select value={resolved} onChange={e => setResolved(e.target.value)} style={selectStyle}>
                            <option value="">Çözüm — tümü</option>
                            <option value="false">Çözülmemiş</option>
                            <option value="true">Çözülmüş</option>
                        </select>
                        <div style={{ position: "relative" }}>
                            <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.dim }} />
                            <input
                                type="text"
                                placeholder="IP / mesaj / e-posta…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && loadIncidents()}
                                style={{ ...selectStyle, paddingLeft: 30, width: "100%" }}
                            />
                        </div>
                        <Btn onClick={loadIncidents} kind="primary"><FaSyncAlt /> Uygula</Btn>
                    </div>
                </Card>
            )}

            {loading ? (
                <Card style={{ textAlign: "center", padding: 30, color: T.dim }}>Yükleniyor…</Card>
            ) : tab === "blocked" ? (
                <BlockedList users={blockedUsers} onUnblock={handleUnblock} onHistory={openHistory} />
            ) : tab === "troubled" ? (
                <TroubledList users={troubledUsers} onUnblock={handleUnblock} onHistory={openHistory} onDiagnose={(email) => { setDiagEmail(email); setTab("diagnose"); runDiagnose(email); }} />
            ) : tab === "diagnose" ? (
                <DiagnosePanel
                    email={diagEmail}
                    setEmail={setDiagEmail}
                    onRun={runDiagnose}
                    loading={diagLoading}
                    result={diagResult}
                    onUnblock={handleUnblock}
                    onHistory={openHistory}
                />
            ) : (
                <IncidentList incidents={incidents} onResolve={handleResolve} onUnblock={handleUnblock} onBlock={handleBlock} onHistory={openHistory} />
            )}

            {/* Kullanıcı geçmişi modalı */}
            {historyUser && (
                <HistoryModal data={historyUser} onClose={() => setHistoryUser(null)} />
            )}
        </AdminLayout>
    );
};

const selectStyle = {
    background: "rgba(15,23,42,0.6)",
    color: T.text,
    border: `1px solid ${T.border}`,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
};

/* ─────────────── Engellenenler tablosu ─────────────── */
const BlockedList = ({ users, onUnblock, onHistory }) => {
    if (!users || users.length === 0) {
        return (
            <Card style={{ textAlign: "center", padding: 40, color: T.dim }}>
                <FaCheckCircle style={{ fontSize: 32, color: T.green, marginBottom: 8 }} />
                <div style={{ fontSize: 14 }}>Şu an engellenmiş kullanıcı yok.</div>
            </Card>
        );
    }
    return (
        <div style={{ display: "grid", gap: 10 }}>
            {users.map(u => (
                <Card key={u._id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                            <FaUser style={{ color: T.dim }} />
                            <span style={{ fontWeight: 700, color: T.text, fontSize: 15 }}>{u.name || "—"}</span>
                            <span style={{ color: T.dim, fontSize: 13 }}>{u.email}</span>
                            <span style={{
                                background: `${T.red}20`, color: T.red, border: `1px solid ${T.red}50`,
                                padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            }}>
                                {u.accessStatus.blockReasonLabel}
                            </span>
                            {u.plan && (
                                <span style={{
                                    background: `${T.purple}15`, color: T.purple, border: `1px solid ${T.purple}40`,
                                    padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                }}>{u.plan}</span>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: T.dim, fontSize: 12 }}>
                            <span><FaClock /> Engel: <span style={{ color: T.text }}>{fmtRelative(u.accessStatus.blockedAt)}</span></span>
                            <span>Süre: <span style={{ color: T.text }}>{u.accessStatus.expiresIn ? fmtExpiresIn(u.accessStatus.expiresIn) : "Süresiz"}</span></span>
                            {u.accessStatus.lastIp && <span><FaGlobe /> IP: <span style={{ color: T.text }}>{u.accessStatus.lastIp}</span></span>}
                            {u.accessStatus.blockedByName && <span>Engelleyen: <span style={{ color: T.text }}>{u.accessStatus.blockedByName}</span></span>}
                        </div>
                        {u.accessStatus.blockNote && (
                            <div style={{ marginTop: 6, color: T.dim, fontSize: 12, fontStyle: "italic" }}>
                                Not: {u.accessStatus.blockNote}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Btn onClick={() => onHistory(u._id, u.name || u.email)}><FaHistory /> Geçmiş</Btn>
                        <Btn onClick={() => onUnblock(u._id)} kind="success"><FaUnlock /> Engeli Kaldır</Btn>
                    </div>
                </Card>
            ))}
        </div>
    );
};

/* ─────────────── Olay akışı ─────────────── */
const IncidentList = ({ incidents, onResolve, onUnblock, onBlock, onHistory }) => {
    if (!incidents || incidents.length === 0) {
        return <Card style={{ textAlign: "center", padding: 40, color: T.dim }}>Hiç olay bulunamadı.</Card>;
    }
    return (
        <div style={{ display: "grid", gap: 8 }}>
            {incidents.map(inc => {
                const user = inc.userId;
                const userIsBlocked = user && user.accessStatus?.isBlocked;
                return (
                    <Card key={inc._id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${SEVERITY_COLOR[inc.severity] || T.dim}20`, color: SEVERITY_COLOR[inc.severity] || T.dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                            {TYPE_ICON[inc.type] || "•"}
                        </div>
                        <div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <SeverityBadge severity={inc.severity} />
                                <TypeBadge type={inc.type} label={inc.typeLabel} />
                                {user && <span style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{user.name || user.email}</span>}
                                {userIsBlocked && <span style={{ color: T.red, fontSize: 11, fontWeight: 700 }}>🚫 BLOKLU</span>}
                                {inc.resolved && <span style={{ color: T.green, fontSize: 11 }}>✔ Çözüldü</span>}
                                <span style={{ color: T.dim, fontSize: 12, marginLeft: "auto" }}>{fmtRelative(inc.createdAt)}</span>
                            </div>
                            <div style={{ color: T.text, fontSize: 13, marginBottom: 4 }}>{inc.description}</div>
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: T.dim, fontSize: 11 }}>
                                {inc.ip && <span><FaGlobe /> {inc.ip}</span>}
                                {inc.deviceSummary && <span><FaDesktop /> {inc.deviceSummary}</span>}
                                {inc.endpoint && <span style={{ fontFamily: "monospace" }}>{inc.method} {inc.endpoint.slice(0, 50)}</span>}
                                {inc.autoActionTaken && inc.autoActionTaken !== "none" && (
                                    <span style={{ color: T.yellow }}>⚙ {inc.autoActionTaken}</span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                            {user && (
                                <Btn onClick={() => onHistory(user._id, user.name || user.email)} style={{ fontSize: 11 }}>
                                    <FaUser /> Detay
                                </Btn>
                            )}
                            {userIsBlocked && (
                                <Btn onClick={() => onUnblock(user._id)} kind="success" style={{ fontSize: 11 }}>
                                    <FaUnlock /> Aç
                                </Btn>
                            )}
                            {user && !userIsBlocked && inc.type !== "admin_unblock" && inc.type !== "auto_unblock" && (
                                <Btn onClick={() => onBlock(user._id, user.email)} kind="danger" style={{ fontSize: 11 }}>
                                    <FaBan /> Blokla
                                </Btn>
                            )}
                            {!inc.resolved && (
                                <Btn onClick={() => onResolve(inc._id)} style={{ fontSize: 11 }}>
                                    <FaCheckCircle /> Çözüldü işaretle
                                </Btn>
                            )}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

/* ─────────────── Sorunlu kullanıcılar (son 24 saatte 403 yiyen) ─────────────── */
const TroubledList = ({ users, onUnblock, onHistory, onDiagnose }) => {
    if (!users || users.length === 0) {
        return (
            <Card style={{ textAlign: "center", padding: 40, color: T.dim }}>
                <FaCheckCircle style={{ fontSize: 32, color: T.green, marginBottom: 8 }} />
                <div style={{ fontSize: 14 }}>Son 24 saatte 403 alan kullanıcı yok.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Eğer kullanıcı hâlâ "erişim engelli" diyorsa, Diagnoz Aracı sekmesinde e-posta ile sorgulayın.</div>
            </Card>
        );
    }
    return (
        <div style={{ display: "grid", gap: 10 }}>
            <Card style={{ background: `${T.yellow}10`, border: `1px solid ${T.yellow}40`, fontSize: 12, color: T.text }}>
                <FaLightbulb style={{ color: T.yellow, marginRight: 6 }} />
                <strong>İpucu:</strong> Bu listede son 24 saatte en az bir 403 hatası alan TÜM kullanıcılar görünür. "Bloklu" gözükmeseler bile.
                Abonelik bitmiş, trial sürmüş, suspended olmuş kullanıcılar da burada.
            </Card>
            {users.map(u => (
                <Card key={u.userId} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                            <FaUserSlash style={{ color: T.yellow }} />
                            <span style={{ fontWeight: 700, color: T.text, fontSize: 15 }}>{u.name || "—"}</span>
                            <span style={{ color: T.dim, fontSize: 13 }}>{u.email}</span>
                            <span style={{
                                background: `${T.red}15`, color: T.red, border: `1px solid ${T.red}40`,
                                padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            }}>
                                {u.count} × 403
                            </span>
                            {u.isBlocked && (
                                <span style={{
                                    background: `${T.red}25`, color: T.red, border: `1px solid ${T.red}60`,
                                    padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                }}>🚫 BLOKLU</span>
                            )}
                            {u.subscriptionState && u.subscriptionState !== "active" && u.subscriptionState !== "trial" && (
                                <span style={{
                                    background: `${T.purple}15`, color: T.purple, border: `1px solid ${T.purple}40`,
                                    padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                }}>💳 {u.subscriptionState}</span>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: T.dim, fontSize: 12, marginBottom: 4 }}>
                            <span><FaClock /> Son: <span style={{ color: T.text }}>{fmtRelative(u.lastIncident)}</span></span>
                            {u.lastIp && <span><FaGlobe /> IP: <span style={{ color: T.text }}>{u.lastIp}</span></span>}
                            {u.plan && <span>Plan: <span style={{ color: T.text }}>{u.plan}</span></span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(u.typeCounts || []).map(tc => (
                                <span key={tc.t} style={{
                                    background: `${T.accent}12`, color: T.accent, border: `1px solid ${T.accent}30`,
                                    padding: "2px 8px", borderRadius: 6, fontSize: 11,
                                }}>
                                    {TYPE_ICON[tc.t] || "•"} {tc.label}
                                </span>
                            ))}
                        </div>
                        {u.lastDescription && (
                            <div style={{ color: T.dim, fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                                {String(u.lastDescription).slice(0, 200)}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                        <Btn onClick={() => onDiagnose(u.email)} kind="primary" style={{ fontSize: 11 }}>
                            <FaStethoscope /> Diagnoz
                        </Btn>
                        <Btn onClick={() => onHistory(u.userId, u.name || u.email)} style={{ fontSize: 11 }}>
                            <FaHistory /> Geçmiş
                        </Btn>
                        {u.isBlocked && (
                            <Btn onClick={() => onUnblock(u.userId)} kind="success" style={{ fontSize: 11 }}>
                                <FaUnlock /> Aç
                            </Btn>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
};

/* ─────────────── Diagnoz paneli ─────────────── */
const DiagnosePanel = ({ email, setEmail, onRun, loading, result, onUnblock, onHistory }) => {
    return (
        <div>
            <Card style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8, color: T.text, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <FaStethoscope style={{ color: T.accent }} />
                    Kullanıcı Tanı Aracı
                </div>
                <div style={{ color: T.dim, fontSize: 12, marginBottom: 10 }}>
                    Kullanıcı "erişim engelli" diyor ama Bloklu listesinde göremiyorsanız buradan e-posta ile sorgulayın.
                    Sistem otomatik teşhis yapar: abonelik durumu, blok, son 403'ler, IP/cihaz, önerilen aksiyon.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        type="email"
                        placeholder="kullanici@ornek.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && onRun()}
                        style={{ ...selectStyle, flex: 1 }}
                    />
                    <Btn onClick={() => onRun()} kind="primary" disabled={loading}>
                        {loading ? "Aranıyor…" : <><FaSearch /> Tanıla</>}
                    </Btn>
                </div>
            </Card>

            {result && result.success === false && (
                <Card style={{ border: `1px solid ${T.red}55`, color: T.red, marginBottom: 12 }}>
                    <FaTimesCircle /> {result.error || "Kullanıcı bulunamadı."}
                    {result.hint && <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>{result.hint}</div>}
                </Card>
            )}

            {result && result.success && (
                <div style={{ display: "grid", gap: 12 }}>
                    {/* Kullanıcı özeti */}
                    <Card>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 24,
                                background: T.accent + "22", color: T.accent,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 22, fontWeight: 800,
                            }}>
                                {(result.user.name || result.user.email || "?")[0].toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{result.user.name || "—"}</div>
                                <div style={{ color: T.dim, fontSize: 13 }}>{result.user.email} · {result.user.role}</div>
                            </div>
                            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                <Btn onClick={() => onHistory(result.user._id, result.user.name || result.user.email)}>
                                    <FaHistory /> Tam Geçmiş
                                </Btn>
                                {result.accessStatus?.isBlocked && (
                                    <Btn onClick={() => onUnblock(result.user._id)} kind="success">
                                        <FaUnlock /> Engeli Kaldır
                                    </Btn>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Aktif sorunlar */}
                    <Card>
                        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
                            🔍 Tespit Edilen Sorunlar ({(result.issues || []).length})
                        </div>
                        {(result.issues || []).map((issue, idx) => (
                            <div key={idx} style={{
                                padding: 12,
                                borderLeft: `4px solid ${SEVERITY_COLOR[issue.severity] || T.dim}`,
                                background: `${SEVERITY_COLOR[issue.severity] || T.dim}10`,
                                borderRadius: 6,
                                marginBottom: 8,
                            }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                                    <SeverityBadge severity={issue.severity} />
                                    <span style={{ fontWeight: 700, color: T.text }}>{issue.title}</span>
                                    <span style={{ color: T.dim, fontSize: 11, marginLeft: "auto" }}>{issue.code}</span>
                                </div>
                                <div style={{ color: T.dim, fontSize: 12 }}>{issue.detail}</div>
                                {issue.note && <div style={{ color: T.dim, fontSize: 11, fontStyle: "italic", marginTop: 4 }}>Not: {issue.note}</div>}
                            </div>
                        ))}
                    </Card>

                    {/* Önerilen aksiyonlar */}
                    {(result.suggestedActions || []).length > 0 && (
                        <Card style={{ background: `${T.accent}10`, border: `1px solid ${T.accent}40` }}>
                            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14, color: T.accent }}>
                                💡 Önerilen Aksiyonlar
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {result.suggestedActions.map((act, idx) => (
                                    <div key={idx} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: 10, background: T.panel, borderRadius: 6,
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{act.label}</div>
                                            {act.hint && <div style={{ color: T.dim, fontSize: 11 }}>{act.hint}</div>}
                                        </div>
                                        {act.action === "unblock" && (
                                            <Btn onClick={() => onUnblock(result.user._id)} kind="success" style={{ fontSize: 11 }}>
                                                Uygula
                                            </Btn>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Subscription + AccessStatus özeti */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Card>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>💳 Abonelik</div>
                            <div style={{ fontSize: 12, color: T.dim, display: "grid", gap: 4 }}>
                                <div>Durum: <span style={{ color: T.text }}>{result.subscription.state}</span></div>
                                <div>Plan: <span style={{ color: T.text }}>{result.subscription.plan || "—"}</span></div>
                                <div>Status: <span style={{ color: T.text }}>{result.subscription.status || "—"}</span></div>
                                {result.subscription.trialEndDate && <div>Trial bitiş: <span style={{ color: T.text }}>{fmtDate(result.subscription.trialEndDate)}</span></div>}
                                {result.subscription.endDate && <div>Abonelik bitiş: <span style={{ color: T.text }}>{fmtDate(result.subscription.endDate)}</span></div>}
                                <div>Gün kaldı: <span style={{ color: T.text }}>{result.subscription.daysLeft || 0}</span></div>
                            </div>
                        </Card>
                        <Card>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>🛡 Erişim Durumu</div>
                            <div style={{ fontSize: 12, color: T.dim, display: "grid", gap: 4 }}>
                                <div>Bloklu: <span style={{ color: result.accessStatus.isBlocked ? T.red : T.green }}>{result.accessStatus.isBlocked ? "EVET" : "Hayır"}</span></div>
                                {result.accessStatus.blockReasonLabel && <div>Sebep: <span style={{ color: T.text }}>{result.accessStatus.blockReasonLabel}</span></div>}
                                {result.accessStatus.blockedAt && <div>Engel zamanı: <span style={{ color: T.text }}>{fmtDate(result.accessStatus.blockedAt)}</span></div>}
                                {result.accessStatus.blockExpiresAt && <div>Bitiş: <span style={{ color: T.text }}>{fmtDate(result.accessStatus.blockExpiresAt)}</span></div>}
                                <div>Son IP: <span style={{ color: T.text }}>{result.accessStatus.lastIp || "—"}</span></div>
                                <div>Son görüldü: <span style={{ color: T.text }}>{result.accessStatus.lastSeenAt ? fmtRelative(result.accessStatus.lastSeenAt) : "—"}</span></div>
                                <div>Toplam incident: <span style={{ color: T.text }}>{result.accessStatus.totalIncidents || 0}</span></div>
                            </div>
                        </Card>
                    </div>

                    {/* Son 24 saat 403 breakdown */}
                    {(result.last24h403Breakdown || []).length > 0 && (
                        <Card>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>⏱ Son 24 Saatte Aldığı 403'ler</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {result.last24h403Breakdown.map(b => (
                                    <span key={b.type} style={{
                                        background: T.panel, border: `1px solid ${T.border}`,
                                        padding: "4px 10px", borderRadius: 6, fontSize: 12, color: T.text,
                                    }}>
                                        {TYPE_ICON[b.type] || "•"} {b.typeLabel}: <strong style={{ color: T.red }}>{b.count}</strong>
                                    </span>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Son incident'ler */}
                    <Card>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>📜 Son 50 Olay</div>
                        <div style={{ display: "grid", gap: 6, maxHeight: 400, overflow: "auto" }}>
                            {(result.recentIncidents || []).map(inc => (
                                <div key={inc._id} style={{
                                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10,
                                    padding: 8, background: T.panel, borderRadius: 6, alignItems: "center",
                                }}>
                                    <span style={{ fontSize: 18 }}>{TYPE_ICON[inc.type] || "•"}</span>
                                    <div>
                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                            <SeverityBadge severity={inc.severity} />
                                            <span style={{ color: T.text, fontWeight: 600, fontSize: 12 }}>{inc.typeLabel}</span>
                                        </div>
                                        <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>{inc.description}</div>
                                        {inc.endpoint && <div style={{ color: T.dim, fontSize: 10, fontFamily: "monospace" }}>{inc.statusCode} {inc.endpoint.slice(0, 80)}</div>}
                                    </div>
                                    <div style={{ color: T.dim, fontSize: 11, whiteSpace: "nowrap" }}>
                                        {fmtRelative(inc.createdAt)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

/* ─────────────── Kullanıcı geçmişi modalı ─────────────── */
const HistoryModal = ({ data, onClose }) => {
    const { user, incidents = [], stats = {} } = data || {};
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
        }} onClick={onClose}>
            <div style={{
                background: T.bg, color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: 16, padding: 20,
                maxWidth: 900, width: "100%", maxHeight: "90vh", overflow: "auto",
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{user?.name || "—"}</div>
                        <div style={{ color: T.dim, fontSize: 13 }}>{user?.email} · {user?.role}</div>
                    </div>
                    <Btn onClick={onClose} kind="danger"><FaTimesCircle /> Kapat</Btn>
                </div>

                {/* Erişim durumu */}
                {user?.accessStatus?.isBlocked && (
                    <Card style={{ marginBottom: 12, border: `1px solid ${T.red}55` }}>
                        <div style={{ color: T.red, fontWeight: 700, marginBottom: 4 }}>🚫 Şu an BLOKLU</div>
                        <div style={{ color: T.dim, fontSize: 12 }}>
                            Sebep: <span style={{ color: T.text }}>{user.accessStatus.blockReasonLabel}</span>{" "}
                            · Engel zamanı: <span style={{ color: T.text }}>{fmtDate(user.accessStatus.blockedAt)}</span>{" "}
                            {user.accessStatus.blockExpiresAt && <>· Bitiş: <span style={{ color: T.text }}>{fmtDate(user.accessStatus.blockExpiresAt)}</span></>}
                        </div>
                        {user.accessStatus.blockNote && <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", color: T.dim }}>Not: {user.accessStatus.blockNote}</div>}
                    </Card>
                )}

                {/* Top IP / Cihaz */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <Card>
                        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>En sık IP'ler</div>
                        {(stats.topIps || []).length === 0 ? <span style={{ color: T.dim, fontSize: 12 }}>—</span> :
                            stats.topIps.map(t => (
                                <div key={t.ip} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: `1px dashed ${T.border}` }}>
                                    <span style={{ fontFamily: "monospace" }}>{t.ip}</span>
                                    <span style={{ color: T.dim }}>{t.count}</span>
                                </div>
                            ))
                        }
                    </Card>
                    <Card>
                        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>En sık cihazlar</div>
                        {(stats.topDevices || []).length === 0 ? <span style={{ color: T.dim, fontSize: 12 }}>—</span> :
                            stats.topDevices.map(t => (
                                <div key={t.device} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: `1px dashed ${T.border}` }}>
                                    <span>{t.device}</span>
                                    <span style={{ color: T.dim }}>{t.count}</span>
                                </div>
                            ))
                        }
                    </Card>
                </div>

                {/* Olay akışı */}
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Olaylar ({incidents.length})</div>
                <div style={{ display: "grid", gap: 6 }}>
                    {incidents.map(inc => (
                        <Card key={inc._id} style={{ padding: 10 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                                <span style={{ fontSize: 18 }}>{TYPE_ICON[inc.type] || "•"}</span>
                                <SeverityBadge severity={inc.severity} />
                                <span style={{ color: T.text, fontWeight: 600 }}>{inc.typeLabel}</span>
                                <span style={{ color: T.dim, marginLeft: "auto" }}>{fmtDate(inc.createdAt)}</span>
                            </div>
                            <div style={{ color: T.dim, fontSize: 12, marginTop: 4 }}>{inc.description}</div>
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: T.dim, fontSize: 11, marginTop: 4 }}>
                                {inc.ip && <span><FaGlobe /> {inc.ip}</span>}
                                {inc.deviceSummary && <span><FaDesktop /> {inc.deviceSummary}</span>}
                                {inc.endpoint && <span style={{ fontFamily: "monospace" }}>{inc.method} {inc.endpoint.slice(0, 70)}</span>}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminAccessControl;
