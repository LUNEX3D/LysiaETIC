/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Karar Geçmişi Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/decision-history
 * Shows: executed/rejected decisions, success rate, profit from actions
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, HealthBar, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainDecisionHistory = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/decisions");
            if (res.data && res.data.success !== false) setData(res.data.decisionHistory);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.decisions")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const recentExec = data.recentExecuted || [];
    const recentRej = data.recentRejected || [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="📋" label={t("dh.total")} value={fmtN(data.totalDecisions || 0)} color={T.blue} />
                <StatCard icon="✅" label={t("dh.executed")} value={fmtN(data.executed || 0)} color={T.green} />
                <StatCard icon="📊" label={t("dh.success_rate")} value={`%${data.successRate || 0}`} color={T.accent} />
                {!isMobile && <StatCard icon="💰" label={t("dh.profit_from_ai")} value={fmt(data.totalProfitFromActions || 0)} color={T.green} />}
            </div>

            {/* Success Rate */}
            <Card glow>
                <CardHeader icon="📜" title={t("dh.title")} subtitle={t("dh.subtitle")} color={T.purple} />
                <HealthBar value={data.successRate || 0} label={t("dh.success_rate")} color={T.green} />
                <div style={{ display: "flex", gap: "0.85rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, padding: "0.75rem", borderRadius: T.rSm, background: T.greenDim, border: `1px solid ${T.green}20`, textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: T.green, fontFamily: T.fontMono }}>{fmtN(data.successfulExecutions || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{t("dh.successful")}</div>
                    </div>
                    <div style={{ flex: 1, padding: "0.75rem", borderRadius: T.rSm, background: T.yellowDim, border: `1px solid ${T.yellow}20`, textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: T.yellow, fontFamily: T.fontMono }}>{fmtN(data.pending || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{t("dh.pending")}</div>
                    </div>
                    <div style={{ flex: 1, padding: "0.75rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}`, textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: T.textDim, fontFamily: T.fontMono }}>{fmtN(data.expired || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{t("dh.expired")}</div>
                    </div>
                </div>
            </Card>

            {/* Recent Executed */}
            {recentExec.length > 0 && (
                <Card>
                    <CardHeader icon="✅" title={t("dh.recent_executed")} subtitle={t("dh.recent_executed_sub")} color={T.green} badge={`${recentExec.length}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {recentExec.map((r, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.65rem",
                                padding: "0.65rem 0.85rem", borderRadius: T.rSm,
                                background: r.success ? `${T.green}06` : `${T.red}06`,
                                border: `1px solid ${r.success ? T.green + "15" : T.red + "15"}`,
                            }}>
                                <span style={{ fontSize: "1rem", flexShrink: 0 }}>{r.success ? "✅" : "❌"}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                                    {r.message && <div style={{ fontSize: "0.72rem", color: T.textDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message}</div>}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                                    {r.profitChange !== 0 && (
                                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: r.profitChange >= 0 ? T.green : T.red, fontFamily: T.fontMono }}>
                                            {r.profitChange >= 0 ? "+" : ""}{fmt(r.profitChange)}
                                        </span>
                                    )}
                                    {r.executedAt && <span style={{ fontSize: "0.6rem", color: T.textDim }}>{new Date(r.executedAt).toLocaleDateString("tr-TR")}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Recent Rejected */}
            {recentRej.length > 0 && (
                <Card>
                    <CardHeader icon="❌" title={t("dh.recent_rejected")} subtitle={t("dh.recent_rejected_sub")} color={T.red} badge={`${recentRej.length}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {recentRej.map((r, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.65rem",
                                padding: "0.6rem 0.85rem", borderRadius: T.rSm,
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                            }}>
                                <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>🚫</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                                </div>
                                <Badge color={T.textDim} size="sm">{r.type?.replace(/_/g, " ")}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {recentExec.length === 0 && recentRej.length === 0 && (
                <Card>
                    <EmptyState icon="📜" title={t("dh.no_data")} description={t("dh.no_data_desc")} />
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainDecisionHistory);
