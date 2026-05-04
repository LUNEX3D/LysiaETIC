/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — AI Öz Değerlendirme Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/self-eval
 * Shows: AI performance score, acceptance rate, profit generated
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, StatCard, ScoreRing, HealthBar, LoadingState, ErrorState } from "./shared/SharedUI";

const EMPTY_SELF_EVAL = {
    aiPerformanceScore: 0,
    totalRecommendations: 0,
    executed: 0,
    successfulExecutions: 0,
    acceptanceRate: 0,
    totalProfitGenerated: 0,
    evaluation: "",
};

const BrainSelfEval = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/self_eval");
            if (res.data && res.data.success !== false) {
                setData(res.data.selfEvaluation ? { ...EMPTY_SELF_EVAL, ...res.data.selfEvaluation } : { ...EMPTY_SELF_EVAL });
            }
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.self_eval")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const score = data.aiPerformanceScore || 0;
    const scoreColor = score >= 80 ? T.green : score >= 60 ? T.accent : score >= 40 ? T.yellow : T.red;
    const gradeLetter = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Hero Score */}
            <Card glow style={{ textAlign: "center", padding: isMobile ? "2rem 1rem" : "2.5rem 2rem" }}>
                <div style={{ marginBottom: "1.25rem" }}>
                    <ScoreRing score={score} size={isMobile ? 100 : 130} thickness={isMobile ? 5 : 6} label={t("selfeval.ai_score")} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: "0.75rem" }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: T.rSm,
                        background: `${scoreColor}15`, border: `2px solid ${scoreColor}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.5rem", fontWeight: 900, color: scoreColor, fontFamily: T.fontMono,
                    }}>{gradeLetter}</div>
                    <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: T.text }}>{t("selfeval.title")}</div>
                        <div style={{ fontSize: "0.75rem", color: T.textDim }}>{t("selfeval.subtitle")}</div>
                    </div>
                </div>
                <p style={{ fontSize: "0.9rem", color: T.textSec, lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>{data.evaluation}</p>
            </Card>

            {/* KPI Strip */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="📋" label={t("selfeval.total_recs")} value={fmtN(data.totalRecommendations || 0)} color={T.blue} />
                <StatCard icon="✅" label={t("selfeval.executed")} value={fmtN(data.executed || 0)} color={T.green} />
                <StatCard icon="🎯" label={t("selfeval.success_exec")} value={fmtN(data.successfulExecutions || 0)} color={T.accent} />
                {!isMobile && <StatCard icon="💰" label={t("selfeval.profit")} value={fmt(data.totalProfitGenerated || 0)} color={T.green} />}
            </div>

            {/* Metrics Detail */}
            <Card>
                <CardHeader icon="📊" title={t("selfeval.metrics")} subtitle={t("selfeval.metrics_sub")} color={T.blue} />

                <HealthBar value={data.acceptanceRate || 0} label={`📊 ${t("selfeval.acceptance_rate")}`} color={T.accent} />
                <HealthBar value={score} label={`🤖 ${t("selfeval.performance")}`} color={scoreColor} />

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.75rem", marginTop: "1rem" }}>
                    <div style={{ padding: "1rem", borderRadius: T.rSm, background: T.greenDim, border: `1px solid ${T.green}20` }}>
                        <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("selfeval.acceptance_rate")}</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: T.accent, fontFamily: T.fontMono, marginTop: 4 }}>%{data.acceptanceRate || 0}</div>
                        <div style={{ fontSize: "0.75rem", color: T.textSec, marginTop: 4 }}>
                            {data.acceptanceRate >= 70 ? t("selfeval.rate_high") : data.acceptanceRate >= 40 ? t("selfeval.rate_mid") : t("selfeval.rate_low")}
                        </div>
                    </div>
                    <div style={{ padding: "1rem", borderRadius: T.rSm, background: data.totalProfitGenerated > 0 ? T.greenDim : T.bgGlass, border: `1px solid ${data.totalProfitGenerated > 0 ? T.green + "20" : T.border}` }}>
                        <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("selfeval.profit")}</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: data.totalProfitGenerated > 0 ? T.green : T.textDim, fontFamily: T.fontMono, marginTop: 4 }}>
                            {data.totalProfitGenerated > 0 ? "+" : ""}{fmt(data.totalProfitGenerated || 0)}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: T.textSec, marginTop: 4 }}>{t("selfeval.profit_desc")}</div>
                    </div>
                </div>
            </Card>

            {/* Tips */}
            <Card>
                <CardHeader icon="💡" title={t("selfeval.tips_title")} subtitle={t("selfeval.tips_sub")} color={T.yellow} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {score < 60 && (
                        <div style={{ padding: "0.75rem 1rem", borderRadius: T.rSm, background: T.yellowDim, border: `1px solid ${T.yellow}15`, fontSize: "0.84rem", color: T.text, lineHeight: 1.65 }}>
                            💡 {t("selfeval.tip_approve")}
                        </div>
                    )}
                    {data.executed < 3 && (
                        <div style={{ padding: "0.75rem 1rem", borderRadius: T.rSm, background: T.blueDim, border: `1px solid ${T.blue}15`, fontSize: "0.84rem", color: T.text, lineHeight: 1.65 }}>
                            💡 {t("selfeval.tip_execute")}
                        </div>
                    )}
                    <div style={{ padding: "0.75rem 1rem", borderRadius: T.rSm, background: T.accentDim, border: `1px solid ${T.accent}15`, fontSize: "0.84rem", color: T.text, lineHeight: 1.65 }}>
                        💡 {t("selfeval.tip_general")}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default React.memo(BrainSelfEval);
