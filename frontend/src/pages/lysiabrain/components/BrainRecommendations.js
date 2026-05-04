/**
 * LYSIA BRAIN — AI Önerileri
 * Okunaklı kart düzeni + AI Fiyat / AI Stok / Diğer sınıflandırması
 */
import React, { useState, useMemo } from "react";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, EmptyState } from "./shared/SharedUI";

/** Backend category + type + actionPayload üzerinden öneri ailesi */
export function getRecommendationKind(rec) {
    const cat = String(rec.category || "").toLowerCase();
    const typ = String(rec.type || "").toLowerCase();
    const act = String(rec.actionPayload?.actionType || "").toLowerCase();

    const priceActs = ["update_price", "apply_discount", "mark_inactive"];
    const isPrice =
        cat === "pricing" ||
        typ.includes("price") ||
        typ.includes("pricing") ||
        typ === "dynamic_pricing" ||
        typ === "loss_detection" ||
        typ === "inventory_pressure" ||
        priceActs.includes(act);

    const isStock =
        cat === "stock" ||
        typ.includes("stock") ||
        typ.includes("restock") ||
        act === "create_stock_order";

    if (isPrice && !isStock) return "price";
    if (isStock && !isPrice) return "stock";
    if (isPrice && isStock) return cat === "stock" ? "stock" : "price";
    return "other";
}

const BrainRecommendations = ({ recommendations, recSummary, refreshing, onApprove, onReject, onExecute, onGenerate, onExplain, onBulkApprove, onBulkReject, t }) => {
    const { isMobile, isTablet } = useResponsive();
    const [recFilter, setRecFilter] = useState("pending");
    const [kindFilter, setKindFilter] = useState("all");
    const [catFilter, setCatFilter] = useState("all");
    const [selected, setSelected] = useState(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [lastAction, setLastAction] = useState(null);

    const PRI = {
        critical: { color: T.red, label: t("rec.priority.critical"), icon: "🔴", bg: T.redDim },
        high: { color: T.yellow, label: t("rec.priority.high"), icon: "🟡", bg: T.yellowDim },
        medium: { color: T.blue, label: t("rec.priority.medium"), icon: "🔵", bg: T.blueDim },
        low: { color: T.textDim, label: t("rec.priority.low"), icon: "⚪", bg: T.bgGlass },
    };

    const CAT = {
        pricing: `💰 ${t("rec.cat.pricing")}`,
        stock: `📦 ${t("rec.cat.stock")}`,
        performance: `📊 ${t("rec.cat.performance")}`,
        financial: `💵 ${t("rec.cat.financial")}`,
        strategy: `◈ ${t("rec.cat.strategy")}`,
    };

    const KIND = {
        price: {
            key: "price",
            label: t("rec.kind.price_short"),
            long: t("rec.kind.price"),
            icon: "💹",
            accent: "#f59e0b",
            accentDim: "rgba(245, 158, 11, 0.12)",
            border: "rgba(245, 158, 11, 0.45)",
        },
        stock: {
            key: "stock",
            label: t("rec.kind.stock_short"),
            long: t("rec.kind.stock"),
            icon: "📦",
            accent: "#06b6d4",
            accentDim: "rgba(6, 182, 212, 0.12)",
            border: "rgba(6, 182, 212, 0.45)",
        },
        other: {
            key: "other",
            label: t("rec.kind.other_short"),
            long: t("rec.kind.other"),
            icon: "🧭",
            accent: "#a78bfa",
            accentDim: "rgba(167, 139, 250, 0.12)",
            border: "rgba(167, 139, 250, 0.45)",
        },
    };

    const byStatus = useMemo(
        () => recommendations.filter(r => (recFilter === "all" ? true : r.status === recFilter)),
        [recommendations, recFilter]
    );

    const kindCounts = useMemo(() => {
        const c = { all: byStatus.length, price: 0, stock: 0, other: 0 };
        for (const r of byStatus) {
            c[getRecommendationKind(r)]++;
        }
        return c;
    }, [byStatus]);

    const filtered = useMemo(() => {
        let list = byStatus;
        if (kindFilter !== "all") list = list.filter(r => getRecommendationKind(r) === kindFilter);
        if (catFilter !== "all") list = list.filter(r => r.category === catFilter);
        return list;
    }, [byStatus, kindFilter, catFilter]);

    const cats = useMemo(
        () => [...new Set(byStatus.map(r => r.category).filter(Boolean))],
        [byStatus]
    );

    const pendingIds = useMemo(() => recommendations.filter(r => r.status === "pending").map(r => r._id), [recommendations]);
    const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectAll = () => { setSelected(p => p.size === pendingIds.length ? new Set() : new Set(pendingIds)); };
    const bulkApprove = async () => { if (!selected.size) return; setBulkLoading(true); try { await onBulkApprove([...selected]); } finally { setSelected(new Set()); setBulkLoading(false); } };
    const bulkReject = async () => { if (!selected.size) return; setBulkLoading(true); try { await onBulkReject([...selected]); } finally { setSelected(new Set()); setBulkLoading(false); } };
    const rejectAll = async () => { if (!pendingIds.length) return; setBulkLoading(true); try { await onBulkReject(pendingIds); } finally { setSelected(new Set()); setBulkLoading(false); } };

    const handleApproveWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onApprove(recId);
            setLastAction({ recId, action: "approved", ts: Date.now() });
            setTimeout(() => setLastAction(prev => prev?.recId === recId ? null : prev), 2500);
        } finally { setActionLoading(null); }
    };
    const handleRejectWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onReject(recId);
            setLastAction({ recId, action: "rejected", ts: Date.now() });
            setTimeout(() => setLastAction(prev => prev?.recId === recId ? null : prev), 2500);
        } finally { setActionLoading(null); }
    };
    const handleExecuteWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onExecute(recId);
            setLastAction({ recId, action: "executed", ts: Date.now() });
            setTimeout(() => setLastAction(prev => prev?.recId === recId ? null : prev), 2500);
        } finally { setActionLoading(null); }
    };

    const statusFilters = [
        { id: "pending", label: t("rec.pending"), count: recSummary.pending, color: T.yellow },
        { id: "approved", label: t("rec.approved"), count: recSummary.approved, color: T.green },
        { id: "executed", label: t("rec.executed"), count: recSummary.executed, color: T.accent },
        { id: "rejected", label: t("rec.rejected"), count: recSummary.rejected, color: T.red },
        { id: "all", label: t("rec.all"), count: recommendations.length, color: T.textDim },
    ];

    const pillBtn = (isActive, color, borderColor) => ({
        background: isActive ? (borderColor ? `${color}18` : `${color}15`) : T.bgGlass,
        border: `1px solid ${isActive ? (borderColor || `${color}40`) : T.border}`,
        borderRadius: T.rFull,
        padding: isMobile ? "7px 12px" : "8px 14px",
        cursor: "pointer",
        fontSize: isMobile ? "0.72rem" : "0.78rem",
        fontWeight: isActive ? 700 : 500,
        color: isActive ? color : T.textSec,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        transition: "all 0.2s",
        fontFamily: "inherit",
        boxShadow: isActive ? `0 0 0 1px ${color}20` : "none",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.35rem", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            <Card glow style={{
                background: `linear-gradient(145deg, ${T.bgCard} 0%, rgba(0,212,170,0.04) 100%)`,
                border: `1px solid ${T.borderGlow}`,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.1rem" }}>
                    <div>
                        <CardHeader icon="✨" title={t("rec.title")} subtitle={t("rec.subtitle")} color={T.accent} />
                        <p style={{
                            margin: "0.65rem 0 0",
                            fontSize: "0.8rem",
                            color: T.textDim,
                            lineHeight: 1.55,
                            maxWidth: "min(720px, 100%)",
                        }}>
                            {t("rec.classify_hint")}
                        </p>
                    </div>
                    <Btn color={T.accent} variant="solid" onClick={onGenerate} disabled={refreshing} style={{ flexShrink: 0 }}>
                        {refreshing ? `⏳ ${t("rec.generating")}` : `↻ ${t("rec.generate")}`}
                    </Btn>
                </div>

                <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>
                    Durum
                </div>
                <div role="tablist" aria-label="Status filters" style={{ display: "flex", gap: 8, marginBottom: "1.1rem", flexWrap: "wrap" }}>
                    {statusFilters.map(f => (
                        <button key={f.id} type="button" role="tab" aria-selected={recFilter === f.id} onClick={() => { setRecFilter(f.id); setSelected(new Set()); }} style={pillBtn(recFilter === f.id, f.color)}>
                            {f.label}
                            <span style={{
                                minWidth: 22,
                                textAlign: "center",
                                padding: "1px 8px",
                                borderRadius: T.rFull,
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                background: recFilter === f.id ? `${f.color}28` : T.borderLight,
                                color: recFilter === f.id ? f.color : T.textMuted,
                            }}>{f.count}</span>
                        </button>
                    ))}
                </div>

                <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>
                    {t("rec.kind.label")}
                </div>
                <div role="tablist" aria-label="Recommendation kind" style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
                    {[
                        { id: "all", label: t("rec.kind.all"), count: kindCounts.all, cfg: null },
                        { id: "price", label: `${KIND.price.icon} ${KIND.price.label}`, count: kindCounts.price, cfg: KIND.price },
                        { id: "stock", label: `${KIND.stock.icon} ${KIND.stock.label}`, count: kindCounts.stock, cfg: KIND.stock },
                        { id: "other", label: `${KIND.other.icon} ${KIND.other.label}`, count: kindCounts.other, cfg: KIND.other },
                    ].map(row => (
                        <button
                            key={row.id}
                            type="button"
                            role="tab"
                            aria-selected={kindFilter === row.id}
                            onClick={() => { setKindFilter(row.id); setCatFilter("all"); }}
                            style={pillBtn(kindFilter === row.id, row.cfg?.accent || T.accent, row.cfg?.border)}
                        >
                            {row.label}
                            <span style={{
                                minWidth: 22,
                                textAlign: "center",
                                padding: "1px 8px",
                                borderRadius: T.rFull,
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                background: kindFilter === row.id ? (row.cfg ? `${row.cfg.accent}28` : `${T.accent}28`) : T.borderLight,
                                color: kindFilter === row.id ? (row.cfg?.accent || T.accent) : T.textMuted,
                            }}>{row.count}</span>
                        </button>
                    ))}
                </div>

                {recFilter === "pending" && recSummary.pending > 0 && (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                        padding: "0.85rem 1rem",
                        background: T.bgGlass,
                        border: `1px solid ${T.accent}22`,
                        borderRadius: T.rSm,
                        marginBottom: "1rem",
                        flexWrap: "wrap",
                    }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.8rem", color: T.textSec, fontWeight: 600 }}>
                            <input type="checkbox" checked={selected.size > 0 && selected.size === pendingIds.length} onChange={selectAll} style={{ accentColor: T.accent }} />
                            {t("rec.select_all")}
                        </label>
                        {selected.size > 0 && (
                            <>
                                <Badge color={T.accent}>{selected.size} {t("rec.selected")}</Badge>
                                <Btn color={T.green} size="sm" onClick={bulkApprove} disabled={bulkLoading}>✅ {t("rec.bulk_approve")}</Btn>
                                <Btn color={T.red} size="sm" onClick={bulkReject} disabled={bulkLoading}>❌ {t("rec.bulk_reject")}</Btn>
                            </>
                        )}
                        <div style={{ marginLeft: "auto" }}>
                            <Btn color={T.red} size="sm" variant="solid" onClick={rejectAll} disabled={bulkLoading}>
                                {bulkLoading ? "⏳" : "🗑️"} {t("rec.reject_all")}
                            </Btn>
                        </div>
                    </div>
                )}

                {kindFilter === "all" && cats.length > 1 && (
                    <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>
                            {t("rec.detail_cat")}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => setCatFilter("all")} style={pillBtn(catFilter === "all", T.textDim)}>{t("rec.all")}</button>
                            {cats.map(c => (
                                <button key={c} type="button" onClick={() => setCatFilter(c)} style={pillBtn(catFilter === c, T.blue)}>
                                    {CAT[c] || c}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {filtered.length === 0 ? (
                    <EmptyState
                        icon="📋"
                        title={recFilter === "pending" ? t("rec.all_done") : t("rec.no_category")}
                        description={t("rec.use_button")}
                    />
                ) : (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: isMobile || isTablet ? "1fr" : "repeat(auto-fill, minmax(min(100%, 400px), 1fr))",
                        gap: "1rem",
                        width: "100%",
                        alignItems: "stretch",
                    }}>
                        {filtered.map((rec) => {
                            const pc = PRI[rec.priority] || PRI.medium;
                            const isSel = selected.has(rec._id);
                            const kind = getRecommendationKind(rec);
                            const kc = KIND[kind];
                            return (
                                <article
                                    key={rec._id}
                                    style={{
                                        borderRadius: T.rSm,
                                        border: `1px solid ${isSel ? T.accent + "35" : T.border}`,
                                        background: isSel ? T.accentDim : T.bgCard,
                                        boxShadow: isSel ? `0 8px 28px ${T.accent}10` : T.shadow,
                                        overflow: "hidden",
                                        transition: "box-shadow 0.25s, border-color 0.2s",
                                    }}
                                >
                                    <div style={{
                                        display: "flex",
                                        alignItems: "stretch",
                                        minHeight: 4,
                                        background: `linear-gradient(90deg, ${kc.accent}, ${pc.color}88)`,
                                    }} aria-hidden="true" />
                                    <div style={{ padding: isMobile ? "1rem" : "1.15rem 1.35rem" }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                                            {rec.status === "pending" && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSel}
                                                    onChange={() => toggle(rec._id)}
                                                    aria-label={`Select: ${rec.title}`}
                                                    style={{ marginTop: 6, cursor: "pointer", accentColor: T.accent, flexShrink: 0 }}
                                                />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                                                    <span style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        fontSize: "0.68rem",
                                                        fontWeight: 800,
                                                        letterSpacing: "0.06em",
                                                        textTransform: "uppercase",
                                                        color: kc.accent,
                                                        background: kc.accentDim,
                                                        border: `1px solid ${kc.border}`,
                                                        padding: "4px 10px",
                                                        borderRadius: T.rFull,
                                                    }}>
                                                        {kc.icon} {kc.long}
                                                    </span>
                                                    <Badge color={pc.color} size="sm">{pc.icon} {pc.label}</Badge>
                                                    {rec.category && (
                                                        <Badge color={T.blue} size="sm">{CAT[rec.category] || rec.category}</Badge>
                                                    )}
                                                </div>
                                                <h3 style={{
                                                    margin: 0,
                                                    fontSize: isMobile ? "0.95rem" : "1.02rem",
                                                    fontWeight: 800,
                                                    color: T.text,
                                                    lineHeight: 1.35,
                                                    letterSpacing: "-0.02em",
                                                }}>
                                                    {rec.title}
                                                </h3>
                                                <div style={{
                                                    marginTop: "0.65rem",
                                                    padding: "0.75rem 0.9rem",
                                                    borderRadius: T.rSm,
                                                    background: "rgba(255,255,255,0.03)",
                                                    border: `1px solid ${T.borderLight}`,
                                                    fontSize: "0.84rem",
                                                    color: T.textSec,
                                                    lineHeight: 1.65,
                                                }}>
                                                    {rec.description}
                                                </div>
                                                {rec.confidenceScore > 0 && (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "0.75rem", fontSize: "0.74rem", color: T.textMuted }}>
                                                        <span style={{ fontWeight: 700 }}>{t("rec.confidence")}</span>
                                                        <div style={{ flex: 1, maxWidth: 120, height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                                            <div style={{
                                                                height: "100%",
                                                                width: `${Math.min(100, rec.confidenceScore)}%`,
                                                                borderRadius: T.rFull,
                                                                background: rec.confidenceScore >= 80 ? T.green : rec.confidenceScore >= 60 ? T.accent : T.yellow,
                                                            }} />
                                                        </div>
                                                        <span style={{ fontWeight: 800, fontFamily: T.fontMono }}>{rec.confidenceScore}%</span>
                                                    </div>
                                                )}
                                                {rec.impact && (rec.impact.profitChange !== 0 || rec.impact.revenueChange !== 0) && (
                                                    <div style={{ display: "flex", gap: 8, marginTop: "0.65rem", flexWrap: "wrap" }}>
                                                        {rec.impact.profitChange !== 0 && (
                                                            <Badge color={rec.impact.profitChange > 0 ? T.green : T.red} size="sm">
                                                                {rec.impact.profitChange > 0 ? "📈" : "📉"} {t("rec.profit")}: {fmt(Math.abs(rec.impact.profitChange))}
                                                            </Badge>
                                                        )}
                                                        {rec.impact.revenueChange !== 0 && (
                                                            <Badge color={rec.impact.revenueChange > 0 ? T.green : T.red} size="sm">
                                                                {rec.impact.revenueChange > 0 ? "📈" : "📉"} {t("rec.revenue")}: {fmt(Math.abs(rec.impact.revenueChange))}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 8,
                                            marginTop: "1rem",
                                            paddingTop: "1rem",
                                            borderTop: `1px solid ${T.border}`,
                                            alignItems: "center",
                                        }}>
                                            <Btn color={T.blue} variant="ghost" size="sm" onClick={() => onExplain(rec._id)}>
                                                🔍 {t("rec.explain") || "Analiz et"}
                                            </Btn>
                                            {lastAction?.recId === rec._id && (
                                                <Badge color={lastAction.action === "approved" ? T.green : lastAction.action === "executed" ? T.accent : T.red} size="sm">
                                                    {lastAction.action === "approved" ? `✅ ${t("rec.approved_ok") || "Onaylandı!"}` : lastAction.action === "executed" ? `⚡ ${t("rec.executed_ok") || "Uygulandı!"}` : `🚫 ${t("rec.rejected_ok") || "Reddedildi!"}`}
                                                </Badge>
                                            )}
                                            {rec.status === "pending" && (
                                                <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", marginLeft: isMobile ? 0 : "auto" }}>
                                                    <Btn color={T.green} onClick={() => handleApproveWithFeedback(rec._id)} disabled={actionLoading === rec._id} style={{ flex: isMobile ? 1 : "initial", minWidth: isMobile ? 0 : 120 }}>
                                                        {actionLoading === rec._id ? "⏳" : "✔️"} {t("rec.approve")}
                                                    </Btn>
                                                    <Btn color={T.red} variant="ghost" onClick={() => handleRejectWithFeedback(rec._id)} disabled={actionLoading === rec._id} style={{ flex: isMobile ? 1 : "initial" }}>
                                                        {actionLoading === rec._id ? "⏳" : "✕"} {t("rec.reject")}
                                                    </Btn>
                                                </div>
                                            )}
                                            {rec.status === "approved" && (
                                                <Btn color={T.accent} variant="solid" onClick={() => handleExecuteWithFeedback(rec._id)} disabled={actionLoading === rec._id} style={{ marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto" }}>
                                                    {actionLoading === rec._id ? "⏳" : "⚡"} {t("rec.execute")}
                                                </Btn>
                                            )}
                                            {(rec.status === "executed" || rec.status === "rejected") && (
                                                <Badge color={rec.status === "executed" ? T.green : T.red} style={{ marginLeft: isMobile ? 0 : "auto" }}>
                                                    {rec.status === "executed" ? `✅ ${t("rec.executed_badge")}` : `🚫 ${t("rec.rejected_badge")}`}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default React.memo(BrainRecommendations);
