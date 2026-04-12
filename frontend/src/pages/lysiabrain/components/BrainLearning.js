/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — AI Öğrenme Geçmişi Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/learning
 * Shows: user preferences, acceptance rates by type
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, HealthBar, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainLearning = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/learning");
            if (res.data.success) setData(res.data.learning);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.learning")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const prefs = data.preferences || [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="✅" label={t("learn.approved")} value={fmtN(data.totalApproved || 0)} color={T.green} />
                <StatCard icon="❌" label={t("learn.rejected")} value={fmtN(data.totalRejected || 0)} color={T.red} />
                <StatCard icon="📊" label={t("learn.acceptance")} value={`%${data.overallAcceptanceRate || 0}`} color={T.accent} />
            </div>

            {/* Overall */}
            <Card glow>
                <CardHeader icon="📚" title={t("learn.title")} subtitle={t("learn.subtitle")} color={T.purple} />
                <HealthBar value={data.overallAcceptanceRate || 0} label={t("learn.overall_rate")} color={T.accent} />
                <p style={{ fontSize: "0.84rem", color: T.textSec, lineHeight: 1.65, margin: "0.5rem 0 0" }}>
                    {data.overallAcceptanceRate >= 70
                        ? t("learn.msg_high")
                        : data.overallAcceptanceRate >= 40
                            ? t("learn.msg_mid")
                            : t("learn.msg_low")}
                </p>
            </Card>

            {/* By Type */}
            {prefs.length > 0 && (
                <Card>
                    <CardHeader icon="🧬" title={t("learn.by_type")} subtitle={t("learn.by_type_sub")} color={T.blue} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {prefs.map((p, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                padding: "0.75rem 1rem", borderRadius: T.rSm,
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: T.text, marginBottom: 6 }}>{p.type.replace(/_/g, " ")}</div>
                                    <div style={{ width: "100%", height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${p.acceptanceRate}%`, borderRadius: T.rFull, background: p.acceptanceRate >= 70 ? T.green : p.acceptanceRate >= 40 ? T.yellow : T.red, transition: "width 0.8s ease" }} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    <Badge color={T.green} size="sm">✅ {p.approved}</Badge>
                                    <Badge color={T.red} size="sm">❌ {p.rejected}</Badge>
                                </div>
                                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: T.accent, fontFamily: T.fontMono, minWidth: 40, textAlign: "right" }}>%{p.acceptanceRate}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {prefs.length === 0 && (
                <Card>
                    <EmptyState icon="📚" title={t("learn.no_data")} description={t("learn.no_data_desc")} />
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainLearning);
