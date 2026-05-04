/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Kayıp Avcısı Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/losses
 * Shows: negative profit, missed sales, margin opportunities
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const TYPE_CFG = {
    negative_profit: { color: T.red, icon: "🔴", label: "Zararda Satış" },
    missed_sales: { color: T.yellow, icon: "📦", label: "Kaçırılan Satış" },
    margin_opportunity: { color: T.blue, icon: "💸", label: "Düşük Marj" },
};

const BrainLosses = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/losses");
            if (res.data && res.data.success !== false) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.losses")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const losses = data.losses || [];
    const counts = data.counts || {};
    const filtered = filter === "all" ? losses : losses.filter(l => l.type === filter);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="💸" label={t("losses.total_impact")} value={fmt(data.totalImpact || 0)} color={T.red} />
                <StatCard icon="🔴" label={t("losses.lost_profit")} value={fmt(data.totalLostProfit || 0)} color={T.red} />
                <StatCard icon="📦" label={t("losses.missed_revenue")} value={fmt(data.totalMissedRevenue || 0)} color={T.yellow} />
            </div>

            {/* Summary */}
            <Card glow>
                <CardHeader icon="🎯" title={t("losses.title")} subtitle={t("losses.subtitle")} color={T.red} />
                <p style={{ fontSize: "0.88rem", color: T.textSec, lineHeight: 1.65, margin: 0 }}>{data.summary}</p>

                {/* Filters */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "1rem" }}>
                    <button onClick={() => setFilter("all")} style={{
                        padding: "5px 12px", borderRadius: T.rFull, cursor: "pointer",
                        background: filter === "all" ? T.accentDim : "transparent",
                        border: `1px solid ${filter === "all" ? T.accent + "35" : T.border}`,
                        color: filter === "all" ? T.accent : T.textDim,
                        fontSize: "0.73rem", fontWeight: 600, fontFamily: "inherit",
                    }}>{t("losses.all")} ({losses.length})</button>
                    {Object.entries(TYPE_CFG).map(([key, cfg]) => {
                        const count = key === "negative_profit" ? counts.negativeProfitProducts : key === "missed_sales" ? counts.missedSalesProducts : counts.lowMarginProducts;
                        return (
                            <button key={key} onClick={() => setFilter(key)} style={{
                                padding: "5px 12px", borderRadius: T.rFull, cursor: "pointer",
                                background: filter === key ? `${cfg.color}15` : "transparent",
                                border: `1px solid ${filter === key ? cfg.color + "35" : T.border}`,
                                color: filter === key ? cfg.color : T.textDim,
                                fontSize: "0.73rem", fontWeight: 600, fontFamily: "inherit",
                            }}>{cfg.icon} {cfg.label} ({count || 0})</button>
                        );
                    })}
                </div>
            </Card>

            {/* Loss Items */}
            {filtered.length === 0 ? (
                <Card>
                    <EmptyState icon="✅" title={t("losses.no_losses")} description={t("losses.no_losses_desc")} />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {filtered.map((loss, i) => {
                        const cfg = TYPE_CFG[loss.type] || TYPE_CFG.negative_profit;
                        return (
                            <Card key={i} style={{ borderLeft: `3px solid ${cfg.color}` }}>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{loss.icon || cfg.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? "60%" : "70%" }}>{loss.product}</span>
                                            <Badge color={cfg.color}>{fmt(loss.amount)}</Badge>
                                        </div>
                                        <p style={{ fontSize: "0.82rem", color: T.textSec, margin: "5px 0 0", lineHeight: 1.65 }}>{loss.description}</p>
                                        <div style={{ fontSize: "0.8rem", color: T.accent, marginTop: 8, fontWeight: 600 }}>→ {loss.action}</div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default React.memo(BrainLosses);
