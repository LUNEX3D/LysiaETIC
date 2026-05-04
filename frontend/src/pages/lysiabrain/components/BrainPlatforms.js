/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Platform Karşılaştırma Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n + responsive + error handling
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, ScoreRing, StatCard, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainPlatforms = ({ t, onError }) => {
    const { isMobile, isTablet } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const res = await API.get("/ai-engine/advisor/platforms");
            if (res.data && res.data.success !== false) setData(res.data);
            else setError(res.data.message || t("error.data_load_fail"));
        } catch (e) { setError(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.platforms")} />;
    if (error) return <ErrorState message={error} onRetry={load} retryLabel={t("header.refresh")} />;
    if (!data || !data.platforms?.length) return <EmptyState icon="▣" title={t("plat.no_data")} description={t("plat.no_data_desc")} />;

    const maxRev = Math.max(...data.platforms.map(p => p.revenue), 1);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI Strip */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="▣" label={t("plat.active")} value={data.platformCount} color={T.accent} />
                <StatCard icon="🛒" label={t("plat.total_orders")} value={fmtN(data.totalOrders)} color={T.blue} />
                <StatCard icon="💰" label={t("plat.total_revenue")} value={fmt(data.totalRevenue)} color={T.green} />
                {!isMobile && <StatCard icon="⚠️" label={t("plat.issues_found")} value={data.issues?.length || 0} color={T.yellow} />}
            </div>

            {/* Platform Cards */}
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
                {data.platforms.map((p) => {
                    const pct = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                    const sc = p.score >= 80 ? T.green : p.score >= 60 ? T.accent : p.score >= 40 ? T.yellow : T.red;
                    return (
                        <Card key={p.name} style={{ position: "relative", overflow: "hidden" }}>
                            <div aria-hidden="true" style={{
                                position: "absolute", top: -30, right: -30,
                                width: 100, height: 100, borderRadius: "50%",
                                background: `radial-gradient(circle, ${sc}08, transparent 70%)`,
                                pointerEvents: "none",
                            }} />

                            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.1rem", position: "relative", zIndex: 1 }}>
                                <ScoreRing score={p.score} size={isMobile ? 48 : 60} thickness={isMobile ? 3 : 3.5} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: isMobile ? "0.95rem" : "1.1rem", fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>{p.name}</div>
                                    <Badge color={sc} size="sm">{p.score}/100 {t("plat.score")}</Badge>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginBottom: "1.1rem" }}>
                                {[
                                    { label: t("plat.orders"), value: fmtN(p.orderCount), icon: "🛒" },
                                    { label: t("plat.revenue"), value: fmt(p.revenue), icon: "💰" },
                                    { label: t("plat.products"), value: fmtN(p.productCount), icon: "📦" },
                                    { label: t("plat.avg_basket"), value: fmt(p.avgOrderValue), icon: "🧺" },
                                ].map((m, j) => (
                                    <div key={j} style={{
                                        background: T.bgGlass, border: `1px solid ${T.border}`,
                                        borderRadius: T.rSm, padding: "0.75rem 0.85rem",
                                    }}>
                                        <div style={{ fontSize: "0.68rem", color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.icon} {m.label}</div>
                                        <div style={{ fontSize: isMobile ? "0.88rem" : "1.02rem", fontWeight: 700, color: T.text, marginTop: 5, fontFamily: T.fontMono }}>{m.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Revenue Bar */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "center" }}>
                                    <span style={{ fontSize: "0.72rem", color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("plat.revenue_share")}</span>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: sc, fontFamily: T.fontMono }}>%{pct.toFixed(0)}</span>
                                </div>
                                <div style={{ width: "100%", height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", width: `${pct}%`,
                                        background: `linear-gradient(90deg, ${sc}, ${sc}88)`,
                                        borderRadius: T.rFull,
                                        boxShadow: `0 0 8px ${sc}25`,
                                        transition: "width 1.2s ease",
                                    }} />
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Issues */}
            {data.issues?.length > 0 && (
                <Card>
                    <CardHeader icon="⚠️" title={t("plat.issues_title")} subtitle={t("plat.issues_sub")} badge={`${data.issues.length}`} color={T.yellow} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                        {data.issues.map((issue, i) => (
                            <div key={i} style={{
                                display: "flex", gap: "0.75rem", padding: isMobile ? "0.75rem" : "1rem 1.1rem",
                                background: T.yellowDim, borderLeft: `3px solid ${T.yellow}`,
                                borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, alignItems: "flex-start",
                            }}>
                                <span style={{ fontSize: "1.15rem", flexShrink: 0 }} aria-hidden="true">{issue.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{issue.title}</div>
                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{issue.detail}</div>
                                    {issue.suggestion && <div style={{ fontSize: "0.78rem", color: T.accent, marginTop: 6, fontWeight: 600 }}>💡 {issue.suggestion}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Opportunities */}
            {data.opportunities?.length > 0 && (
                <Card>
                    <CardHeader icon="💡" title={t("plat.opps_title")} subtitle={t("plat.opps_sub")} badge={`${data.opportunities.length}`} color={T.green} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                        {data.opportunities.map((opp, i) => (
                            <div key={i} style={{
                                display: "flex", gap: "0.75rem", padding: isMobile ? "0.75rem" : "1rem 1.1rem",
                                background: T.greenDim, borderLeft: `3px solid ${T.green}`,
                                borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, alignItems: "flex-start",
                            }}>
                                <span style={{ fontSize: "1.15rem", flexShrink: 0 }} aria-hidden="true">{opp.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{opp.title}</div>
                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{opp.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainPlatforms);
