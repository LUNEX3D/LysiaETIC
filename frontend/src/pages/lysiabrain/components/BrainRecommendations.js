/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Öneriler Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n + responsive + accessibility
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState } from "react";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, EmptyState } from "./shared/SharedUI";

const BrainRecommendations = ({ recommendations, recSummary, refreshing, onApprove, onReject, onExecute, onGenerate, onExplain, onBulkApprove, onBulkReject, t }) => {
    const { isMobile } = useResponsive();
    const [recFilter, setRecFilter] = useState("pending");
    const [catFilter, setCatFilter] = useState("all");
    const [selected, setSelected] = useState(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // recId being processed
    const [lastAction, setLastAction] = useState(null); // { recId, action, ts }

    const handleApproveWithFeedback = async (recId) => {
        setActionLoading(recId);
        try {
            await onApprove(recId);
            setLastAction({ recId, action: "approved", ts: Date.now() });
            // 2 saniye sonra feedback'i temizle
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

    const PRI = {
        critical: { color: T.red, label: t("rec.priority.critical"), icon: "🔴", bg: T.redDim },
        high: { color: T.yellow, label: t("rec.priority.high"), icon: "🟡", bg: T.yellowDim },
        medium: { color: T.blue, label: t("rec.priority.medium"), icon: "🔵", bg: T.blueDim },
        low: { color: T.textDim, label: t("rec.priority.low"), icon: "⚪", bg: T.bgGlass },
    };
    const CAT = {
        pricing: `💰 ${t("rec.cat.pricing")}`, stock: `📦 ${t("rec.cat.stock")}`,
        performance: `📊 ${t("rec.cat.performance")}`, financial: `💵 ${t("rec.cat.financial")}`,
        strategy: `◈ ${t("rec.cat.strategy")}`,
    };

    let filtered = recommendations.filter(r => recFilter === "all" ? true : r.status === recFilter);
    if (catFilter !== "all") filtered = filtered.filter(r => r.category === catFilter);
    const cats = [...new Set(recommendations.map(r => r.category).filter(Boolean))];

    const pendingIds = recommendations.filter(r => r.status === "pending").map(r => r._id);
    const toggle = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectAll = () => { setSelected(p => p.size === pendingIds.length ? new Set() : new Set(pendingIds)); };
    const bulkApprove = async () => { if (!selected.size) return; setBulkLoading(true); try { await onBulkApprove([...selected]); } finally { setSelected(new Set()); setBulkLoading(false); } };
    const bulkReject = async () => { if (!selected.size) return; setBulkLoading(true); try { await onBulkReject([...selected]); } finally { setSelected(new Set()); setBulkLoading(false); } };
    const rejectAll = async () => { if (!pendingIds.length) return; setBulkLoading(true); try { await onBulkReject(pendingIds); } finally { setSelected(new Set()); setBulkLoading(false); } };

    const statusFilters = [
        { id: "pending", label: t("rec.pending"), count: recSummary.pending, color: T.yellow },
        { id: "approved", label: t("rec.approved"), count: recSummary.approved, color: T.green },
        { id: "executed", label: t("rec.executed"), count: recSummary.executed, color: T.accent },
        { id: "rejected", label: t("rec.rejected"), count: recSummary.rejected, color: T.red },
        { id: "all", label: t("rec.all"), count: recommendations.length, color: T.textDim },
    ];

    const fbtn = (isActive, color) => ({
        background: isActive ? `${color}15` : T.bgGlass,
        border: `1px solid ${isActive ? color + "35" : T.border}`,
        borderRadius: T.rSm, padding: isMobile ? "6px 10px" : "8px 14px", cursor: "pointer",
        fontSize: isMobile ? "0.72rem" : "0.78rem", fontWeight: isActive ? 700 : 500,
        color: isActive ? color : T.textDim,
        display: "flex", alignItems: "center", gap: 6,
        transition: "all 0.2s", fontFamily: "inherit",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                    <CardHeader icon="◆" title={t("rec.title")} subtitle={t("rec.subtitle")} color={T.accent} />
                    <Btn color={T.accent} variant="solid" onClick={onGenerate} disabled={refreshing}>
                        {refreshing ? `⏳ ${t("rec.generating")}` : `↻ ${t("rec.generate")}`}
                    </Btn>
                </div>

                {/* Status Filters */}
                <div role="tablist" aria-label="Recommendation filters" style={{ display: "flex", gap: 6, marginBottom: "0.85rem", flexWrap: "wrap" }}>
                    {statusFilters.map(f => (
                        <button key={f.id} role="tab" aria-selected={recFilter === f.id} onClick={() => setRecFilter(f.id)} style={fbtn(recFilter === f.id, f.color)}>
                            {f.label}
                            <span style={{
                                padding: "2px 7px", borderRadius: T.rFull,
                                fontSize: "0.68rem", fontWeight: 800,
                                background: recFilter === f.id ? `${f.color}20` : T.borderLight,
                                color: recFilter === f.id ? f.color : T.textMuted,
                            }}>{f.count}</span>
                        </button>
                    ))}
                </div>

                {/* Bulk Actions */}
                {recFilter === "pending" && recSummary.pending > 0 && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: "0.65rem",
                        padding: "0.75rem 1rem",
                        background: T.bgGlass, border: `1px solid ${T.border}`,
                        borderRadius: T.rSm, marginBottom: "0.85rem", flexWrap: "wrap",
                    }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: "0.8rem", color: T.textSec, fontWeight: 600 }}>
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
                                {bulkLoading ? "⏳" : "🗑️"} {t("rec.reject_all") || `Tümünü Reddet (${pendingIds.length})`}
                            </Btn>
                        </div>
                    </div>
                )}

                {/* Category Filters */}
                {cats.length > 1 && (
                    <div style={{ display: "flex", gap: 5, marginBottom: "0.85rem", flexWrap: "wrap" }}>
                        <button onClick={() => setCatFilter("all")} style={fbtn(catFilter === "all", T.accent)}>{t("rec.all")}</button>
                        {cats.map(c => <button key={c} onClick={() => setCatFilter(c)} style={fbtn(catFilter === c, T.accent)}>{CAT[c] || c}</button>)}
                    </div>
                )}

                {/* Recommendation List */}
                {filtered.length === 0 ? (
                    <EmptyState icon="✅" title={recFilter === "pending" ? t("rec.all_done") : t("rec.no_category")} description={t("rec.use_button")} />
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {filtered.map((rec) => {
                            const pc = PRI[rec.priority] || PRI.medium;
                            const isSel = selected.has(rec._id);
                            return (
                                <div key={rec._id} style={{
                                    padding: isMobile ? "0.85rem" : "1.1rem 1.2rem",
                                    borderLeft: `3px solid ${pc.color}`,
                                    borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`,
                                    border: `1px solid ${isSel ? T.accent + "30" : T.border}`,
                                    borderLeftWidth: 3, borderLeftColor: pc.color, borderLeftStyle: "solid",
                                    background: isSel ? T.accentDim : T.bgGlass,
                                    transition: "all 0.2s",
                                }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                                        {rec.status === "pending" && (
                                            <input type="checkbox" checked={isSel} onChange={() => toggle(rec._id)} aria-label={`Select: ${rec.title}`} style={{ marginTop: 3, cursor: "pointer", accentColor: T.accent }} />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text, lineHeight: 1.3 }}>{rec.title}</div>
                                            <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 5, lineHeight: 1.65 }}>{rec.description}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                                        <Badge color={pc.color} size="sm">{pc.icon} {pc.label}</Badge>
                                        {rec.category && <Badge color={T.blue} size="sm">{CAT[rec.category] || rec.category}</Badge>}
                                        {rec.confidenceScore > 0 && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.73rem", color: T.textMuted }}>
                                                <span>{t("rec.confidence")}:</span>
                                                <div style={{ width: 52, height: 5, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%", width: `${rec.confidenceScore}%`, borderRadius: T.rFull,
                                                        background: rec.confidenceScore >= 80 ? T.green : rec.confidenceScore >= 60 ? T.accent : T.yellow,
                                                        boxShadow: `0 0 6px ${rec.confidenceScore >= 80 ? T.green : T.accent}30`,
                                                        transition: "width 0.5s",
                                                    }} />
                                                </div>
                                                <span style={{ fontWeight: 700, fontFamily: T.fontMono }}>{rec.confidenceScore}%</span>
                                            </div>
                                        )}
                                    </div>
                                    {rec.impact && (rec.impact.profitChange !== 0 || rec.impact.revenueChange !== 0) && (
                                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                            {rec.impact.profitChange !== 0 && <Badge color={rec.impact.profitChange > 0 ? T.green : T.red} size="sm">{rec.impact.profitChange > 0 ? "📈" : "📉"} {t("rec.profit")}: {fmt(Math.abs(rec.impact.profitChange))}</Badge>}
                                            {rec.impact.revenueChange !== 0 && <Badge color={rec.impact.revenueChange > 0 ? T.green : T.red} size="sm">{rec.impact.revenueChange > 0 ? "📈" : "📉"} {t("rec.revenue")}: {fmt(Math.abs(rec.impact.revenueChange))}</Badge>}
                                        </div>
                                    )}
                                    <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                                        {/* Aksiyon sonrası anlık geri bildirim */}
                                        {lastAction?.recId === rec._id && (
                                            <Badge color={lastAction.action === "approved" ? T.green : lastAction.action === "executed" ? T.accent : T.red} size="sm">
                                                {lastAction.action === "approved" ? `✅ ${t("rec.approved_ok") || "Onaylandı!"}` : lastAction.action === "executed" ? `⚡ ${t("rec.executed_ok") || "Uygulandı!"}` : `🚫 ${t("rec.rejected_ok") || "Reddedildi!"}`}
                                            </Badge>
                                        )}
                                        {rec.status === "pending" && !lastAction?.recId?.includes?.(rec._id) && (
                                            <>
                                                <Btn color={T.green} size="sm" onClick={() => handleApproveWithFeedback(rec._id)} disabled={actionLoading === rec._id}>
                                                    {actionLoading === rec._id ? "⏳" : "✅"} {t("rec.approve")}
                                                </Btn>
                                                <Btn color={T.red} size="sm" onClick={() => handleRejectWithFeedback(rec._id)} disabled={actionLoading === rec._id}>
                                                    {actionLoading === rec._id ? "⏳" : "❌"} {t("rec.reject")}
                                                </Btn>
                                            </>
                                        )}
                                        {rec.status === "approved" && (
                                            <Btn color={T.accent} variant="solid" size="sm" onClick={() => handleExecuteWithFeedback(rec._id)} disabled={actionLoading === rec._id}>
                                                {actionLoading === rec._id ? "⏳" : "⚡"} {t("rec.execute")}
                                            </Btn>
                                        )}
                                        {(rec.status === "executed" || rec.status === "rejected") && !lastAction?.recId?.includes?.(rec._id) && (
                                            <Badge color={rec.status === "executed" ? T.green : T.red}>
                                                {rec.status === "executed" ? `✅ ${t("rec.executed_badge")}` : `🚫 ${t("rec.rejected_badge")}`}
                                            </Badge>
                                        )}
                                        <Btn color={T.textDim} variant="ghost" size="sm" onClick={() => onExplain(rec._id)}>👁️ {t("rec.why")}</Btn>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default React.memo(BrainRecommendations);
