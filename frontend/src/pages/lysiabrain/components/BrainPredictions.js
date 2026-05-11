/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Tahmin Motoru Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/predictions
 * Shows: stock depletion, revenue forecast, margin erosion, seasonal, trends
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const SEV_CFG = {
    critical: { color: T.red, icon: "🚨" },
    high: { color: T.yellow, icon: "⚠️" },
    medium: { color: T.blue, icon: "ℹ️" },
    info: { color: T.accent, icon: "💡" },
};

const BrainPredictions = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/predictions");
            if (res.data && res.data.success !== false) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.predictions")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const predictions = data.predictions || [];
    const summary = data.summary || {};
    const trend = data.trendData || {};

    const tldrPrediction = (() => {
        const crit = summary.criticalCount || 0;
        const total = summary.totalPredictions || 0;
        const impact = summary.totalFinancialImpact || 0;
        if (total === 0) return "Henüz tahmin üretilecek yeterli veri yok. Sipariş hareketlendikçe LysiaBrain seni 14 gün önceden uyarmaya başlayacak.";
        if (crit > 0) return `${crit} kritik öngörü var (toplam ${total} öngörü). Tahmini etki: ${fmt(impact)}. Önce kritik olanlara bak.`;
        return `${total} öngörü üretildi. Genel beklenen etki ${fmt(impact)}. Trend ${summary.revenueDirection === "up" ? "yukarı 📈" : "aşağı 📉"} yönlü.`;
    })();
    const headerStatus = summary.criticalCount > 0 ? "danger" : summary.totalPredictions > 5 ? "warning" : "good";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="🔮"
                title={t("pred.title") || "Tahmin Motoru"}
                subtitle={t("pred.subtitle") || "AI'nın 7-30 günlük geleceğe dair öngörüleri"}
                tldr={tldrPrediction}
                status={headerStatus}
                kpis={[
                    { label: "Toplam Tahmin", value: fmtN(summary.totalPredictions || 0), color: T.purple },
                    { label: "Kritik", value: fmtN(summary.criticalCount || 0), color: T.red, hint: "Hemen aksiyon gerektiren" },
                    { label: "Finansal Etki", value: fmt(summary.totalFinancialImpact || 0), color: summary.totalFinancialImpact >= 0 ? T.green : T.red },
                    { label: "Gelir Trendi", value: `${summary.revenueTrend >= 0 ? "+" : ""}%${summary.revenueTrend || 0}`, color: summary.revenueTrend >= 0 ? T.green : T.red, trend: summary.revenueTrend },
                ]}
            />

            {/* Revenue Trend Mini Chart */}
            {(trend.dailyRevenues || []).length > 0 && (
                <Card>
                    <CardHeader icon="📈" title={t("pred.revenue_trend")} subtitle={t("pred.revenue_trend_sub")} color={T.accent}
                        badge={`${t("pred.today")}: ${fmt(trend.todayRevenue || 0)}`} />
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, padding: "0 4px" }}>
                        {trend.dailyRevenues.map((d, i) => {
                            const maxRev = Math.max(...trend.dailyRevenues.map(x => x.revenue), 1);
                            const h = Math.max((d.revenue / maxRev) * 100, 4);
                            const isLast = i === trend.dailyRevenues.length - 1;
                            return (
                                <div key={i} title={`${d.date}: ${fmt(d.revenue)}`} style={{
                                    flex: 1, height: `${h}%`, borderRadius: "3px 3px 0 0",
                                    background: isLast ? T.accent : `${T.accent}40`,
                                    transition: "height 0.5s ease", cursor: "default",
                                    minWidth: 0,
                                }} />
                            );
                        })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ fontSize: "0.6rem", color: T.textDim }}>{trend.dailyRevenues[0]?.date}</span>
                        <div style={{ display: "flex", gap: 12 }}>
                            <span style={{ fontSize: "0.65rem", color: T.textDim }}>{t("pred.avg")}: <span style={{ color: T.accent, fontWeight: 700 }}>{fmt(trend.avgDailyRevenue || 0)}</span></span>
                            <span style={{ fontSize: "0.65rem", color: T.textDim }}>{t("pred.orders")}: <span style={{ color: T.text, fontWeight: 700 }}>{fmtN(trend.totalOrders30 || 0)}</span></span>
                        </div>
                        <span style={{ fontSize: "0.6rem", color: T.textDim }}>{trend.dailyRevenues[trend.dailyRevenues.length - 1]?.date}</span>
                    </div>
                </Card>
            )}

            {/* Prediction Items */}
            {predictions.length === 0 ? (
                <Card>
                    <EmptyState icon="🔮" title={t("pred.no_data")} description={data.message || t("pred.no_data_desc")} />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {predictions.map((pred, i) => {
                        const sev = SEV_CFG[pred.severity] || SEV_CFG.medium;
                        return (
                            <Card key={i} style={{ borderLeft: `3px solid ${sev.color}` }}>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{pred.icon || sev.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{pred.prediction}</span>
                                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                {pred.confidence > 0 && <Badge color={T.accent} size="sm">%{pred.confidence}</Badge>}
                                                {pred.date && <Badge color={T.textDim} size="sm">{pred.date}</Badge>}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: "0.82rem", color: T.textSec, margin: "5px 0 0", lineHeight: 1.65 }}>{pred.detail}</p>
                                        {pred.impact && <div style={{ fontSize: "0.78rem", color: sev.color, marginTop: 4, fontWeight: 600 }}>{pred.impact}</div>}
                                        {pred.action && <div style={{ fontSize: "0.8rem", color: T.accent, marginTop: 6, fontWeight: 600 }}>→ {pred.action}</div>}

                                        {/* Product chips */}
                                        {(pred.products || []).length > 0 && (
                                            <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                {pred.products.slice(0, 4).map((p, j) => (
                                                    <span key={j} style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: T.rFull, background: T.bgGlass, border: `1px solid ${T.border}`, color: T.textSec }}>{p.name?.slice(0, 22)}</span>
                                                ))}
                                            </div>
                                        )}
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

export default React.memo(BrainPredictions);
