/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Satış Zamanlama Analizi Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/timing
 * Shows: hourly/daily order patterns, best/worst times, suggestions
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainTiming = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/timing");
            if (res.data.success) setData(res.data.timing);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.timing")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const maxHourly = Math.max(...(data.hourlyOrders || []), 1);
    const maxDaily = Math.max(...(data.dailyOrders || []).map(d => d.orders), 1);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI Strip */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="⏰" label={t("timing.best_hour")} value={data.bestHour || "--"} color={T.green} />
                <StatCard icon="📅" label={t("timing.best_day")} value={data.bestDay || "--"} color={T.blue} />
                <StatCard icon="🌙" label={t("timing.worst_hour")} value={data.worstHour || "--"} color={T.red} />
                {!isMobile && <StatCard icon="📉" label={t("timing.worst_day")} value={data.worstDay || "--"} color={T.yellow} />}
            </div>

            {/* Hourly Heatmap */}
            <Card>
                <CardHeader icon="⏰" title={t("timing.hourly_title")} subtitle={t("timing.hourly_sub")} color={T.accent} />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(12, 1fr)" : "repeat(24, 1fr)", gap: 3 }}>
                    {(data.peakHours || []).map((h, i) => {
                        const intensity = maxHourly > 0 ? h.orders / maxHourly : 0;
                        const bg = intensity > 0.7 ? T.green : intensity > 0.4 ? T.yellow : intensity > 0.1 ? `${T.accent}40` : T.borderLight;
                        return (
                            <div key={i} title={`${h.hour}: ${h.orders} sipariş — ${fmt(h.revenue)}`} style={{
                                aspectRatio: "1", borderRadius: 4,
                                background: `${bg}`,
                                opacity: Math.max(intensity, 0.15),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.55rem", color: T.text, fontWeight: 700, fontFamily: T.fontMono,
                                cursor: "default", transition: "all 0.2s",
                                border: `1px solid ${T.border}`,
                            }}>
                                {!isMobile && h.hour.slice(0, 2)}
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: "0.65rem", color: T.textDim }}>00:00</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: "0.6rem", color: T.textDim }}>{t("timing.low")}</span>
                        <div style={{ display: "flex", gap: 2 }}>
                            {[0.15, 0.3, 0.5, 0.7, 1].map((v, i) => (
                                <div key={i} style={{ width: 12, height: 8, borderRadius: 2, background: T.green, opacity: v }} />
                            ))}
                        </div>
                        <span style={{ fontSize: "0.6rem", color: T.textDim }}>{t("timing.high")}</span>
                    </div>
                    <span style={{ fontSize: "0.65rem", color: T.textDim }}>23:00</span>
                </div>
            </Card>

            {/* Daily Breakdown */}
            <Card>
                <CardHeader icon="📅" title={t("timing.daily_title")} subtitle={t("timing.daily_sub")} color={T.blue} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {(data.dailyOrders || []).map((d, i) => {
                        const pct = maxDaily > 0 ? (d.orders / maxDaily) * 100 : 0;
                        const isBest = d.day === data.bestDay;
                        const isWorst = d.day === data.worstDay;
                        return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.85rem", borderRadius: T.rSm, background: isBest ? `${T.green}08` : isWorst ? `${T.red}08` : T.bgGlass, border: `1px solid ${isBest ? T.green + "20" : isWorst ? T.red + "20" : T.border}` }}>
                                <span style={{ width: 80, fontSize: "0.82rem", fontWeight: 700, color: isBest ? T.green : isWorst ? T.red : T.text, flexShrink: 0 }}>{d.day}</span>
                                <div style={{ flex: 1, height: 8, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: T.rFull, background: isBest ? T.green : isWorst ? T.red : T.accent, transition: "width 0.8s ease" }} />
                                </div>
                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: T.text, fontFamily: T.fontMono, minWidth: 40, textAlign: "right" }}>{fmtN(d.orders)}</span>
                                {!isMobile && <span style={{ fontSize: "0.72rem", color: T.textDim, fontFamily: T.fontMono, minWidth: 70, textAlign: "right" }}>{fmt(d.revenue)}</span>}
                                {isBest && <Badge color={T.green} size="sm">🏆</Badge>}
                                {isWorst && <Badge color={T.red} size="sm">📉</Badge>}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Suggestions */}
            {(data.suggestions || []).length > 0 && (
                <Card>
                    <CardHeader icon="💡" title={t("timing.tips_title")} subtitle={t("timing.tips_sub")} color={T.yellow} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {data.suggestions.map((s, i) => (
                            <div key={i} style={{ padding: "0.75rem 1rem", borderRadius: T.rSm, background: T.yellowDim, border: `1px solid ${T.yellow}15`, fontSize: "0.84rem", color: T.text, lineHeight: 1.65 }}>
                                💡 {s}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainTiming);
