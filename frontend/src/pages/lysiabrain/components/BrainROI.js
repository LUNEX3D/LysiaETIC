/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — ROI Takibi Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/roi
 * Shows: total profit/revenue from AI actions, by type breakdown
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, StatCard, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const TYPE_ICONS = {
    price_optimization: "💰",
    loss_detection: "🔴",
    stock_optimization: "📦",
    smart_restock: "🔄",
    performance_boost: "🚀",
    dead_product: "💀",
    campaign_suggestion: "🎯",
};

const BrainROI = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/roi");
            if (res.data && res.data.success !== false) setData(res.data.roi);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.roi")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const byType = Object.entries(data.byType || {}).sort((a, b) => b[1] - a[1]);
    const maxTypeVal = Math.max(...byType.map(([, v]) => Math.abs(v)), 1);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="📈" label={t("roi.profit_generated")} value={fmt(data.totalProfitGenerated || 0)} color={T.green} />
                <StatCard icon="💰" label={t("roi.revenue_generated")} value={fmt(data.totalRevenueGenerated || 0)} color={T.accent} />
                <StatCard icon="✅" label={t("roi.total_executed")} value={fmtN(data.totalExecuted || 0)} color={T.blue} />
            </div>

            {/* Message */}
            <Card glow>
                <CardHeader icon="📈" title={t("roi.title")} subtitle={t("roi.subtitle")} color={T.green} />
                <div style={{
                    padding: "1.25rem", borderRadius: T.rSm,
                    background: data.totalProfitGenerated > 0 ? T.greenDim : T.bgGlass,
                    border: `1px solid ${data.totalProfitGenerated > 0 ? T.green + "20" : T.border}`,
                    textAlign: "center",
                }}>
                    <div style={{ fontSize: isMobile ? "1.5rem" : "2rem", fontWeight: 900, color: data.totalProfitGenerated > 0 ? T.green : T.textDim, fontFamily: T.fontMono }}>
                        {data.totalProfitGenerated > 0 ? "+" : ""}{fmt(data.totalProfitGenerated || 0)}
                    </div>
                    <p style={{ fontSize: "0.88rem", color: T.textSec, margin: "0.5rem 0 0", lineHeight: 1.65 }}>{data.message}</p>
                </div>
            </Card>

            {/* By Type Breakdown */}
            {byType.length > 0 && (
                <Card>
                    <CardHeader icon="📊" title={t("roi.by_type")} subtitle={t("roi.by_type_sub")} color={T.purple} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {byType.map(([type, value], i) => {
                            const pct = maxTypeVal > 0 ? (Math.abs(value) / maxTypeVal) * 100 : 0;
                            const icon = TYPE_ICONS[type] || "📋";
                            return (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.85rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}` }}>
                                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, marginBottom: 4 }}>{type.replace(/_/g, " ")}</div>
                                        <div style={{ width: "100%", height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: T.rFull, background: value >= 0 ? T.green : T.red, transition: "width 0.8s ease" }} />
                                        </div>
                                    </div>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: value >= 0 ? T.green : T.red, fontFamily: T.fontMono, flexShrink: 0 }}>
                                        {value >= 0 ? "+" : ""}{fmt(value)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {byType.length === 0 && (
                <Card>
                    <EmptyState icon="📈" title={t("roi.no_data")} description={t("roi.no_data_desc")} />
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainROI);
