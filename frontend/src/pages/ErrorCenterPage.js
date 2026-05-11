/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📋 Operasyon Defteri (Operations Journal) — Unified Activity Feed
 * ───────────────────────────────────────────────────────────────────────────
 * İşletmende olan biten her şeyin tek kronolojik defteri.
 * Dört farklı kaynak tek akışta birleşir:
 *   👤 Kullanıcı     → ClientErrorLog   (frontend hataları, HTTP 4xx/5xx)
 *   👤 Kullanıcı     → AuditLog         (login, abonelik, ödeme, profil…)
 *   🤖 AI / Lysia    → AIActionAudit    (otonom aksiyonlar — fiyat/stok)
 *   🤖 AI / Lysia    → Recommendation   (öneriler, kararlar, guardrail izleri)
 *
 * Filtreler: Aktör (kim?), Kayıt Türü (ne?), Önem, Tarih aralığı, Arama.
 * Her kart genişletilebilir — AI aksiyonlarda before/after, rollback izi görünür.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaCheckCircle,
    FaCloudUploadAlt,
    FaExclamationTriangle,
    FaFileExport,
    FaFilter,
    FaInfoCircle,
    FaRedo,
    FaRobot,
    FaSearch,
    FaTimes,
    FaTrash,
    FaUser,
    FaUserShield,
    FaChevronDown,
    FaChevronUp,
} from "react-icons/fa";
import API from "../services/api";
import { clearClientErrors, getClientErrors, removeClientErrorsByIds } from "../services/clientErrorStore";

/* ─────────────────────────────────────────────────────────────────────
 * Tasarım sabitleri
 * ───────────────────────────────────────────────────────────────────── */
const COLORS = {
    bg: "#0b1220",
    bgCard: "rgba(15,23,42,0.72)",
    border: "rgba(148,163,184,0.2)",
    borderStrong: "rgba(148,163,184,0.35)",
    text: "#e2e8f0",
    textDim: "#94a3b8",
    textMuted: "#64748b",
    accent: "#38bdf8",
    blue: "#38bdf8",
    green: "#4ade80",
    yellow: "#facc15",
    red: "#f87171",
    purple: "#c084fc",
    cyan: "#22d3ee",
};

const SEVERITY_COLOR = {
    info: COLORS.blue,
    warning: COLORS.yellow,
    error: COLORS.red,
    critical: COLORS.red,
    success: COLORS.green,
};

const ACTOR_META = {
    user: { icon: <FaUser />, label: "Ben", color: COLORS.blue },
    ai: { icon: <FaRobot />, label: "AI / LysiaBrain", color: COLORS.purple },
    admin: { icon: <FaUserShield />, label: "Admin", color: COLORS.yellow },
    system: { icon: <FaInfoCircle />, label: "Sistem", color: COLORS.cyan },
};

const KIND_META = {
    error: { label: "Hata", icon: "⚠️", color: COLORS.red },
    audit: { label: "Sistem İşlemi", icon: "📝", color: COLORS.blue },
    ai_action: { label: "AI Aksiyon", icon: "⚡", color: COLORS.cyan },
    ai_decision: { label: "AI Kararı", icon: "🤖", color: COLORS.purple },
    activity: { label: "İşlem", icon: "ℹ️", color: COLORS.blue },
};

/* ─────────────────────────────────────────────────────────────────────
 * Lokal aktiviteleri (client cache) standart formata dönüştür
 * ───────────────────────────────────────────────────────────────────── */
const localToView = (row) => {
    const isActivity = row.kind === "activity";
    return {
        id: row.id || `lc_${Math.random()}`,
        source: isActivity ? "local_activity" : "local_error",
        actor: "user",
        kind: isActivity ? "activity" : "error",
        severity: isActivity ? (row.level || "info") : (row.statusCode >= 500 ? "error" : "warning"),
        category: row.source || "frontend",
        title: isActivity ? (row.title || "İşlem") : (row.statusCode ? `HTTP ${row.statusCode} • ${row.method || "GET"} ${row.path || ""}` : (row.message?.slice(0, 80) || "İstemci Hatası")),
        description: row.message || "",
        ts: row.ts || new Date().toISOString(),
        icon: isActivity ? "ℹ️" : "⚠️",
        statusCode: row.statusCode,
        path: row.path,
        method: row.method,
        meta: row.meta || {},
        _local: true,
    };
};

/* ─────────────────────────────────────────────────────────────────────
 * Format yardımcıları
 * ───────────────────────────────────────────────────────────────────── */
const fmtDate = (ts) => {
    try {
        const d = new Date(ts);
        return d.toLocaleString("tr-TR", {
            year: "numeric", month: "short", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });
    } catch { return String(ts || "—"); }
};
const fmtRelative = (ts) => {
    try {
        const diff = Date.now() - new Date(ts).getTime();
        if (diff < 60_000) return "Az önce";
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} dk önce`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sa önce`;
        if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} gün önce`;
        return fmtDate(ts);
    } catch { return ""; }
};
const fmtMoney = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
};

/* ═════════════════════════════════════════════════════════════════════
 * ANA SAYFA
 * ═════════════════════════════════════════════════════════════════════ */
const ErrorCenterPage = () => {
    const [items, setItems] = useState(() => getClientErrors());
    const [serverItems, setServerItems] = useState([]);
    const [counts, setCounts] = useState(null);
    const [loadingServer, setLoadingServer] = useState(false);
    const [sending, setSending] = useState(false);
    const [info, setInfo] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    /* Filtreler */
    const [actorFilter, setActorFilter] = useState("all");      // all|user|ai|admin|system
    const [kindFilter, setKindFilter] = useState("all");        // all|error|audit|ai_action|ai_decision|activity
    const [severityFilter, setSeverityFilter] = useState("all");// all|info|warning|error|critical|success
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // Search debounce
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
        return () => clearTimeout(t);
    }, [search]);

    /* Server-side feed yükle */
    const loadServer = useCallback(async () => {
        setLoadingServer(true);
        try {
            const params = { limit: 200 };
            if (actorFilter !== "all") params.actor = actorFilter;
            if (kindFilter !== "all" && kindFilter !== "activity") params.kind = kindFilter;
            if (severityFilter !== "all") params.severity = severityFilter;
            if (debouncedSearch) params.search = debouncedSearch;
            if (from) params.from = new Date(from).toISOString();
            if (to) params.to = new Date(to).toISOString();

            const { data } = await API.get("/client-errors/feed", { params });
            setServerItems(Array.isArray(data.items) ? data.items : []);
            setCounts(data.counts || null);
        } catch (e) {
            console.warn("Feed yüklenemedi:", e?.message);
            setServerItems([]);
            setCounts(null);
        } finally {
            setLoadingServer(false);
        }
    }, [actorFilter, kindFilter, severityFilter, debouncedSearch, from, to]);

    useEffect(() => { loadServer(); }, [loadServer]);

    /* Lokal aktivite/cache değişimini dinle */
    useEffect(() => {
        const reload = () => setItems(getClientErrors());
        window.addEventListener("client-errors:changed", reload);
        return () => window.removeEventListener("client-errors:changed", reload);
    }, []);

    /* Lokal+server birleşik liste */
    const merged = useMemo(() => {
        const localView = items.map(localToView);
        const all = [...localView, ...serverItems];

        // Filtreler (lokal kayıtlar için de uygula)
        const filtered = all.filter(x => {
            if (actorFilter !== "all" && x.actor !== actorFilter) return false;
            if (kindFilter !== "all" && x.kind !== kindFilter) return false;
            if (severityFilter !== "all" && x.severity !== severityFilter) return false;
            if (debouncedSearch) {
                const q = debouncedSearch.toLowerCase();
                const hay = `${x.title || ""} ${x.description || ""} ${x.path || ""} ${x.category || ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (from) {
                if (new Date(x.ts).getTime() < new Date(from).getTime()) return false;
            }
            if (to) {
                if (new Date(x.ts).getTime() > new Date(to).getTime() + 86_400_000) return false;
            }
            return true;
        });

        // Dedup
        const seen = new Set();
        const out = [];
        for (const x of filtered) {
            const k = x.id || `${x.kind}|${x.title}|${Math.floor(new Date(x.ts).getTime() / 5000)}`;
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(x);
        }
        return out.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    }, [items, serverItems, actorFilter, kindFilter, severityFilter, debouncedSearch, from, to]);

    /* Sayım özetleri (sayfa üstündeki rozetler) */
    const computedCounts = useMemo(() => {
        const c = {
            total: merged.length,
            byActor: { user: 0, ai: 0, admin: 0, system: 0 },
            byKind: { error: 0, audit: 0, ai_action: 0, ai_decision: 0, activity: 0 },
            bySeverity: { info: 0, warning: 0, error: 0, critical: 0, success: 0 },
        };
        for (const x of merged) {
            c.byActor[x.actor] = (c.byActor[x.actor] || 0) + 1;
            c.byKind[x.kind] = (c.byKind[x.kind] || 0) + 1;
            c.bySeverity[x.severity] = (c.bySeverity[x.severity] || 0) + 1;
        }
        return c;
    }, [merged]);

    /* JSON export */
    const exportJson = () => {
        const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `operasyon-defteri-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* Lokal hataları sunucuya gönder */
    const sendToServer = async () => {
        const toSend = items.filter((x) => (x.kind || "error") === "error");
        if (!toSend.length) return;
        setSending(true);
        setInfo("");
        try {
            const payload = toSend.map((x) => ({
                source: x.source,
                statusCode: x.statusCode,
                path: x.path,
                method: x.method,
                message: x.message,
                stack: x.stack || "",
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
                meta: { ...(x.meta || {}), kind: x.kind || "error", ts: x.ts },
            }));
            await API.post("/client-errors/bulk", { items: payload });
            removeClientErrorsByIds(toSend.map((x) => x.id));
            setItems(getClientErrors());
            await loadServer();
            setInfo(`${payload.length} kayıt sunucuya gönderildi.`);
        } catch (e) {
            setInfo(e.response?.data?.message || "Sunucuya gönderim başarısız.");
        } finally {
            setSending(false);
        }
    };

    const clearAllFilters = () => {
        setActorFilter("all");
        setKindFilter("all");
        setSeverityFilter("all");
        setSearch("");
        setFrom("");
        setTo("");
    };
    const hasActiveFilters = actorFilter !== "all" || kindFilter !== "all" || severityFilter !== "all" || search || from || to;

    /* ═══ RENDER ═══ */
    return (
        <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
            {/* HEADER */}
            <PageHero
                total={counts?.total ?? computedCounts.total}
                byActor={counts?.byActor || computedCounts.byActor}
                byKind={counts?.byKind || computedCounts.byKind}
                bySeverity={counts?.bySeverity || computedCounts.bySeverity}
                onRefresh={loadServer}
                onExport={exportJson}
                onSendLocal={sendToServer}
                refreshing={loadingServer}
                sending={sending}
                hasLocalErrors={items.some(x => (x.kind || "error") === "error")}
                onClearLocal={() => { clearClientErrors(); setItems([]); }}
            />

            {/* FİLTRELER */}
            <FilterBar
                actor={actorFilter} setActor={setActorFilter}
                kind={kindFilter} setKind={setKindFilter}
                severity={severityFilter} setSeverity={setSeverityFilter}
                search={search} setSearch={setSearch}
                from={from} setFrom={setFrom}
                to={to} setTo={setTo}
                onClear={clearAllFilters}
                hasActive={hasActiveFilters}
                counts={computedCounts}
            />

            {info && (
                <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(56,189,248,0.08)", border: `1px solid ${COLORS.blue}40`, color: COLORS.blue, fontSize: 13 }}>
                    {info}
                </div>
            )}

            {/* SONUÇ LİSTESİ */}
            {merged.length === 0 ? (
                <EmptyView hasFilters={hasActiveFilters} onClear={clearAllFilters} />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {merged.map((item) => (
                        <ActivityCard
                            key={item.id}
                            item={item}
                            expanded={expandedId === item.id}
                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────
 * HERO — başlık + KPI rozet sırası
 * ───────────────────────────────────────────────────────────────────── */
const PageHero = ({ total, byActor, byKind, bySeverity, onRefresh, onExport, onSendLocal, refreshing, sending, hasLocalErrors, onClearLocal }) => (
    <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `linear-gradient(135deg, ${COLORS.purple}25, ${COLORS.accent}18)`,
                        border: `1px solid ${COLORS.purple}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22,
                    }}>📋</div>
                    <h1 style={{ margin: 0, color: COLORS.text, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
                        Operasyon Defteri
                    </h1>
                </div>
                <p style={{ margin: "4px 0 0", color: COLORS.textDim, fontSize: 13, maxWidth: 720, lineHeight: 1.55 }}>
                    İşletmende olan biten her şeyin <b>tek defteri</b>: <b>senin yaptığın işlemler</b>,
                    <b> karşılaşılan hatalar</b> ve <b>AI / LysiaBrain'in aldığı kararlar + uyguladığı aksiyonlar</b>
                    {" "}kronolojik olarak yer alır. Her satıra tıklayarak detayı (before/after, kural izi, rollback) açabilirsin.
                </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <HeroBtn onClick={onRefresh} disabled={refreshing} color={COLORS.blue}>
                    <FaRedo style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} /> Yenile
                </HeroBtn>
                <HeroBtn onClick={onExport} color={COLORS.textDim}><FaFileExport /> JSON</HeroBtn>
                {hasLocalErrors && (
                    <HeroBtn onClick={onSendLocal} disabled={sending} color={COLORS.cyan}>
                        <FaCloudUploadAlt /> {sending ? "Gönderiliyor…" : "Yerel hataları yükle"}
                    </HeroBtn>
                )}
                <HeroBtn onClick={onClearLocal} color={COLORS.red}><FaTrash /> Yerel temizle</HeroBtn>
            </div>
        </div>

        {/* KPI Şeridi */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 16 }}>
            <KPIBadge label="Toplam Kayıt" value={total} color={COLORS.accent} icon="📊" />
            <KPIBadge label="Ben" value={byActor?.user || 0} color={ACTOR_META.user.color} icon={<FaUser />} />
            <KPIBadge label="AI / LysiaBrain" value={byActor?.ai || ((byKind?.ai_action || 0) + (byKind?.ai_decision || 0))} color={ACTOR_META.ai.color} icon={<FaRobot />} />
            <KPIBadge label="Hatalar" value={byKind?.error || 0} color={COLORS.red} icon="⚠️" />
            <KPIBadge label="AI Aksiyonları" value={byKind?.ai_action || 0} color={COLORS.cyan} icon="⚡" />
            <KPIBadge label="AI Kararları" value={byKind?.ai_decision || 0} color={COLORS.purple} icon="🤖" />
        </div>
    </div>
);

const HeroBtn = ({ children, onClick, disabled, color = COLORS.textDim }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
            border: `1px solid ${color}40`, background: `${color}12`, color,
            borderRadius: 10, padding: "8px 12px", cursor: disabled ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13,
            opacity: disabled ? 0.55 : 1, transition: "all 0.15s",
        }}>
        {children}
    </button>
);

const KPIBadge = ({ label, value, color, icon }) => (
    <div style={{
        padding: "10px 14px", borderRadius: 12,
        background: `${color}10`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", gap: 10, minHeight: 56,
    }}>
        <div style={{ fontSize: 18, color, opacity: 0.85, display: "flex", alignItems: "center" }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
            <div style={{ fontSize: 20, color, fontWeight: 800, fontFamily: "Monaco, monospace" }}>{Number(value) || 0}</div>
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────────────
 * FİLTRE ÇUBUĞU
 * ───────────────────────────────────────────────────────────────────── */
const FilterBar = ({ actor, setActor, kind, setKind, severity, setSeverity, search, setSearch, from, setFrom, to, setTo, onClear, hasActive, counts }) => {
    return (
        <div style={{
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12,
            padding: 12, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10,
        }}>
            {/* Aktör sekmeleri */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: COLORS.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Kim?</span>
                <Chip active={actor === "all"} onClick={() => setActor("all")} label="Hepsi" count={counts.total} />
                <Chip active={actor === "user"} onClick={() => setActor("user")} label={ACTOR_META.user.label} icon={ACTOR_META.user.icon} color={ACTOR_META.user.color} count={counts.byActor.user} />
                <Chip active={actor === "ai"} onClick={() => setActor("ai")} label={ACTOR_META.ai.label} icon={ACTOR_META.ai.icon} color={ACTOR_META.ai.color} count={counts.byActor.ai} />
                {counts.byActor.admin > 0 && (
                    <Chip active={actor === "admin"} onClick={() => setActor("admin")} label={ACTOR_META.admin.label} icon={ACTOR_META.admin.icon} color={ACTOR_META.admin.color} count={counts.byActor.admin} />
                )}
                {counts.byActor.system > 0 && (
                    <Chip active={actor === "system"} onClick={() => setActor("system")} label={ACTOR_META.system.label} icon={ACTOR_META.system.icon} color={ACTOR_META.system.color} count={counts.byActor.system} />
                )}
            </div>

            {/* Kayıt türü */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: COLORS.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ne?</span>
                <Chip active={kind === "all"} onClick={() => setKind("all")} label="Tüm türler" />
                <Chip active={kind === "error"} onClick={() => setKind("error")} label="⚠️ Hatalar" color={COLORS.red} count={counts.byKind.error} />
                <Chip active={kind === "audit"} onClick={() => setKind("audit")} label="📝 Sistem" color={COLORS.blue} count={counts.byKind.audit} />
                <Chip active={kind === "ai_action"} onClick={() => setKind("ai_action")} label="⚡ AI Aksiyon" color={COLORS.cyan} count={counts.byKind.ai_action} />
                <Chip active={kind === "ai_decision"} onClick={() => setKind("ai_decision")} label="🤖 AI Kararı" color={COLORS.purple} count={counts.byKind.ai_decision} />
                {counts.byKind.activity > 0 && (
                    <Chip active={kind === "activity"} onClick={() => setKind("activity")} label="ℹ️ İşlem" count={counts.byKind.activity} />
                )}
            </div>

            {/* Severity */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: COLORS.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Önem</span>
                {["all", "critical", "error", "warning", "success", "info"].map(s => {
                    const label = s === "all" ? "Tüm seviyeler" : ({
                        critical: "🚨 Kritik", error: "🔴 Hata", warning: "🟡 Uyarı",
                        success: "✅ Başarılı", info: "🔵 Bilgi",
                    })[s];
                    const c = SEVERITY_COLOR[s] || COLORS.textDim;
                    const cnt = s === "all" ? counts.total : (counts.bySeverity[s] || 0);
                    if (s !== "all" && cnt === 0) return null;
                    return <Chip key={s} active={severity === s} onClick={() => setSeverity(s)} label={label} color={c} count={s === "all" ? null : cnt} />;
                })}
            </div>

            {/* Arama + tarih */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 280px", minWidth: 220 }}>
                    <FaSearch style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", color: COLORS.textMuted, fontSize: 12 }} />
                    <input
                        type="text"
                        placeholder="Başlık, ürün, ürün barkodu, path, hata mesajı…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: "100%", padding: "8px 32px 8px 32px",
                            background: "#0f172a", border: `1px solid ${COLORS.borderStrong}`,
                            borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none",
                        }}
                    />
                    {search && (
                        <button onClick={() => setSearch("")} style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", background: "transparent", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 4 }}>
                            <FaTimes />
                        </button>
                    )}
                </div>
                <DateInput label="Başlangıç" value={from} onChange={setFrom} />
                <DateInput label="Bitiş" value={to} onChange={setTo} />
                {hasActive && (
                    <button onClick={onClear} style={{
                        border: `1px solid ${COLORS.red}40`, background: `${COLORS.red}10`,
                        color: COLORS.red, borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
                    }}>
                        <FaFilter /> Filtreleri temizle
                    </button>
                )}
            </div>
        </div>
    );
};

const Chip = ({ active, onClick, label, icon, color = COLORS.textDim, count }) => (
    <button
        onClick={onClick}
        style={{
            padding: "6px 12px", borderRadius: 999,
            background: active ? `${color}25` : "transparent",
            border: `1px solid ${active ? color + "70" : COLORS.border}`,
            color: active ? color : COLORS.textDim,
            fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            transition: "all 0.15s",
        }}>
        {icon && <span style={{ display: "inline-flex" }}>{icon}</span>}
        <span>{label}</span>
        {count !== null && count !== undefined && (
            <span style={{
                background: active ? `${color}30` : "rgba(148,163,184,0.18)",
                color: active ? color : COLORS.textMuted,
                fontSize: 10, padding: "1px 7px", borderRadius: 999, fontWeight: 800,
            }}>{count}</span>
        )}
    </button>
);

const DateInput = ({ label, value, onChange }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textMuted, fontSize: 12 }}>
        <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                background: "#0f172a", border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 8, padding: "6px 8px", color: COLORS.text, fontSize: 12,
                outline: "none", fontFamily: "inherit",
            }}
        />
    </label>
);

/* ─────────────────────────────────────────────────────────────────────
 * BOŞ DURUM
 * ───────────────────────────────────────────────────────────────────── */
const EmptyView = ({ hasFilters, onClear }) => (
    <div style={{
        textAlign: "center", padding: "60px 20px",
        background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12,
    }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
        <h3 style={{ color: COLORS.text, margin: "0 0 8px", fontSize: 17 }}>
            {hasFilters ? "Bu filtreyle eşleşen kayıt yok" : "Henüz kayıt yok"}
        </h3>
        <p style={{ color: COLORS.textDim, fontSize: 13, margin: 0, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
            {hasFilters
                ? "Filtreleri gevşeterek veya temizleyerek daha fazla sonuç görebilirsin."
                : "Hata, sistem işlemleri ve AI kararları burada zamanla birikecek. Bir aksiyon gerçekleştir veya AI'ı çalıştırırsanız akış burada görünür."}
        </p>
        {hasFilters && (
            <button onClick={onClear} style={{
                marginTop: 16, padding: "8px 14px", borderRadius: 8,
                background: `${COLORS.accent}15`, border: `1px solid ${COLORS.accent}40`,
                color: COLORS.accent, cursor: "pointer", fontWeight: 700, fontSize: 13,
            }}>
                Filtreleri temizle
            </button>
        )}
    </div>
);

/* ─────────────────────────────────────────────────────────────────────
 * AKTİVİTE KARTI — özet + detaylı
 * ───────────────────────────────────────────────────────────────────── */
const ActivityCard = ({ item, expanded, onToggle }) => {
    const sev = SEVERITY_COLOR[item.severity] || COLORS.blue;
    const actorM = ACTOR_META[item.actor] || ACTOR_META.user;
    const kindM = KIND_META[item.kind] || KIND_META.activity;

    return (
        <div style={{
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.border}`,
            borderLeft: `3px solid ${sev}`,
            borderRadius: 10, overflow: "hidden",
            transition: "all 0.18s",
        }}>
            {/* Özet satır */}
            <button
                onClick={onToggle}
                style={{
                    width: "100%", padding: "10px 14px", textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer",
                    color: COLORS.text, display: "flex", alignItems: "center", gap: 10,
                    fontFamily: "inherit",
                }}>
                {/* Aktör + tür rozeti */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div title={actorM.label} style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: `${actorM.color}18`, border: `1px solid ${actorM.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: actorM.color, fontSize: 13,
                    }}>{actorM.icon}</div>
                </div>

                {/* İçerik */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14 }}>{item.icon || kindM.icon}</span>
                        <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.title}
                        </span>
                        <SevBadge severity={item.severity} />
                        <KindBadge kind={item.kind} />
                    </div>
                    {item.description && (
                        <div style={{
                            color: COLORS.textDim, fontSize: 12, marginTop: 4,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap", maxWidth: "100%",
                        }}>
                            {item.description}
                        </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 11, color: COLORS.textMuted, flexWrap: "wrap" }}>
                        <span title={fmtDate(item.ts)}>{fmtRelative(item.ts)}</span>
                        {item.category && <span>•&nbsp;{item.category}</span>}
                        {item.actor === "ai" && item.confidence != null && (
                            <span style={{ color: COLORS.purple }}>• Güven %{item.confidence}</span>
                        )}
                        {item.impact != null && item.impact !== 0 && (
                            <span style={{ color: item.impact > 0 ? COLORS.green : COLORS.red }}>
                                • Etki {item.impact > 0 ? "+" : ""}{fmtMoney(item.impact)}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ flexShrink: 0, color: COLORS.textMuted }}>
                    {expanded ? <FaChevronUp /> : <FaChevronDown />}
                </div>
            </button>

            {/* Detay (genişletilmiş) */}
            {expanded && (
                <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${COLORS.border}`, marginTop: 4 }}>
                    {/* Hata detayı */}
                    {item.kind === "error" && (
                        <DetailGrid>
                            <DetailRow label="HTTP" value={item.statusCode ? `${item.statusCode} ${item.method || ""}` : "—"} />
                            <DetailRow label="Endpoint" value={item.path || "—"} mono />
                            <DetailRow label="Mesaj" value={item.description || "—"} wide />
                            {item.pageUrl && <DetailRow label="Sayfa" value={item.pageUrl} mono wide />}
                            {item.stack && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <DetailLabel>Stack</DetailLabel>
                                    <pre style={preStyle}>{item.stack}</pre>
                                </div>
                            )}
                        </DetailGrid>
                    )}

                    {/* Sistem (audit) detayı */}
                    {item.kind === "audit" && (
                        <DetailGrid>
                            <DetailRow label="Kategori" value={item.category} />
                            <DetailRow label="Sonuç" value={item.success ? "✓ Başarılı" : "✗ Başarısız"} color={item.success ? COLORS.green : COLORS.red} />
                            {item.ipAddress && <DetailRow label="IP" value={item.ipAddress} mono />}
                            {item.userAgent && <DetailRow label="Cihaz" value={item.userAgent.slice(0, 100)} />}
                            {item.meta && Object.keys(item.meta).length > 0 && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <DetailLabel>Detaylar</DetailLabel>
                                    <pre style={preStyle}>{JSON.stringify(item.meta, null, 2)}</pre>
                                </div>
                            )}
                        </DetailGrid>
                    )}

                    {/* AI Aksiyon detayı */}
                    {item.kind === "ai_action" && (
                        <>
                            {item.productName && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(148,163,184,0.08)" }}>
                                    <span style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Ürün</span>
                                    <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{item.productName}</span>
                                    {item.barcode && <span style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: "Monaco, monospace" }}>#{item.barcode}</span>}
                                    {item.marketplace && <span style={{ color: COLORS.blue, fontSize: 11, fontWeight: 700 }}>{item.marketplace}</span>}
                                </div>
                            )}

                            {/* Before/After */}
                            {(item.before?.price != null || item.after?.price != null) && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, marginTop: 10, alignItems: "center" }}>
                                    <BeforeAfterCell label="Önce" data={item.before} color={COLORS.textDim} />
                                    <div style={{ fontSize: 20, color: COLORS.cyan, fontWeight: 900 }}>→</div>
                                    <BeforeAfterCell label="Sonra" data={item.after} color={COLORS.green} />
                                </div>
                            )}

                            <DetailGrid style={{ marginTop: 10 }}>
                                <DetailRow label="Tetikleyici" value={item.trigger || "—"} />
                                <DetailRow label="Mod" value={item.operationMode || "—"} />
                                <DetailRow label="Güven" value={item.confidence != null ? `%${item.confidence}` : "—"} />
                                <DetailRow label="Etki" value={item.impact != null ? fmtMoney(item.impact) : "—"} />
                                <DetailRow label="Süre" value={item.durationMs ? `${item.durationMs} ms` : "—"} />
                                <DetailRow label="Sonuç" value={item.success ? "✓ Başarılı" : "✗ Başarısız"} color={item.success ? COLORS.green : COLORS.red} />
                                {item.guardrailApplied && (
                                    <DetailRow label="🎛️ Guardrail" value={item.guardrailNote || "Kural uygulandı"} color={COLORS.yellow} wide />
                                )}
                                {item.rolledBack && (
                                    <DetailRow label="↩ Geri Alındı" value={item.rollbackReason ? `${fmtDate(item.rolledBackAt)} · ${item.rollbackReason}` : fmtDate(item.rolledBackAt)} color={COLORS.red} wide />
                                )}
                            </DetailGrid>
                        </>
                    )}

                    {/* AI Karar / Öneri detayı */}
                    {item.kind === "ai_decision" && (
                        <DetailGrid>
                            <DetailRow label="Tür" value={item.category} />
                            <DetailRow label="Öncelik" value={item.priority || "—"} color={item.priority === "critical" ? COLORS.red : item.priority === "high" ? COLORS.yellow : COLORS.textDim} />
                            <DetailRow label="Güven" value={item.confidence != null ? `%${item.confidence}` : "—"} />
                            <DetailRow label="Etki" value={item.impact != null ? fmtMoney(item.impact) : "—"} />
                            <DetailRow label="Durum" value={item.status || "—"} color={item.status === "executed" ? COLORS.green : item.status === "rejected" ? COLORS.red : COLORS.textDim} />
                            {item.executedAt && <DetailRow label="Uygulandı" value={fmtDate(item.executedAt)} />}
                            {item.blocked && (
                                <DetailRow label="🚫 Engellendi" value={(item.blockReasons || []).join(" · ") || "Otonomi kuralı tarafından engellendi"} color={COLORS.red} wide />
                            )}
                            {item.guardrailNote && (
                                <DetailRow label="🎛️ Kural İzi" value={item.guardrailNote} color={COLORS.cyan} wide />
                            )}
                            {item.ruleTrace?.source === "category" && (
                                <DetailRow label="Kategori Kuralı" value={`Hedef marj %${item.ruleTrace.targetMargin || "?"} · Min %${item.ruleTrace.minMargin || "?"} · Maks indirim %${item.ruleTrace.maxDiscount || "?"}`} color={COLORS.purple} wide />
                            )}
                            {item.params && Object.keys(item.params).length > 0 && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <DetailLabel>Parametreler</DetailLabel>
                                    <pre style={preStyle}>{JSON.stringify(item.params, null, 2)}</pre>
                                </div>
                            )}
                        </DetailGrid>
                    )}
                </div>
            )}
        </div>
    );
};

const SevBadge = ({ severity }) => {
    const c = SEVERITY_COLOR[severity] || COLORS.blue;
    const labels = { critical: "Kritik", error: "Hata", warning: "Uyarı", success: "Başarılı", info: "Bilgi" };
    const icon = { critical: <FaExclamationTriangle />, error: <FaExclamationTriangle />, warning: <FaExclamationTriangle />, success: <FaCheckCircle />, info: <FaInfoCircle /> }[severity] || <FaInfoCircle />;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 999,
            background: `${c}18`, border: `1px solid ${c}40`,
            color: c, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em",
            flexShrink: 0,
        }}>
            {icon} {labels[severity] || severity}
        </span>
    );
};

const KindBadge = ({ kind }) => {
    const m = KIND_META[kind] || KIND_META.activity;
    return (
        <span style={{
            padding: "2px 8px", borderRadius: 999,
            background: `${m.color}10`, border: `1px solid ${m.color}30`,
            color: m.color, fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>{m.label}</span>
    );
};

const DetailGrid = ({ children, style }) => (
    <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 8, marginTop: 10, ...(style || {}),
    }}>{children}</div>
);

const DetailLabel = ({ children }) => (
    <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {children}
    </div>
);

const DetailRow = ({ label, value, color = COLORS.text, mono, wide }) => (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
        <DetailLabel>{label}</DetailLabel>
        <div style={{
            color, fontSize: 12, fontFamily: mono ? "Monaco, Consolas, monospace" : "inherit",
            wordBreak: "break-word", lineHeight: 1.45, fontWeight: 600,
        }}>
            {value || "—"}
        </div>
    </div>
);

const BeforeAfterCell = ({ label, data, color }) => (
    <div style={{
        padding: "8px 10px", borderRadius: 8,
        background: "rgba(148,163,184,0.06)", border: `1px solid ${COLORS.border}`,
    }}>
        <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
        {data?.price != null && (
            <div style={{ fontSize: 13, color, fontWeight: 700, fontFamily: "Monaco, monospace" }}>
                💰 {fmtMoney(data.price)}
            </div>
        )}
        {data?.stock != null && (
            <div style={{ fontSize: 12, color: COLORS.text, fontFamily: "Monaco, monospace" }}>
                📦 {data.stock} adet
            </div>
        )}
    </div>
);

const preStyle = {
    background: "#0a0f1e", border: `1px solid ${COLORS.border}`,
    color: COLORS.text, padding: "8px 10px", borderRadius: 6,
    fontSize: 11, fontFamily: "Monaco, Consolas, monospace",
    overflow: "auto", maxHeight: 280, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
};

export default ErrorCenterPage;
