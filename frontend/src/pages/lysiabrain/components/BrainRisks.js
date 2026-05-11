/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Risk Radarı Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/risks
 * Shows: risk items, risk score, monthly impact
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, Badge, StatCard, ScoreRing, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const LEVEL_CFG = {
    high: { color: T.red, bg: T.redDim, icon: "🔴" },
    medium: { color: T.yellow, bg: T.yellowDim, icon: "🟡" },
    low: { color: T.green, bg: T.greenDim, icon: "🟢" },
};

const BrainRisks = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/risks");
            if (res.data && res.data.success !== false) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.risks")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const risks = data.risks || [];
    const rc = data.riskCount || {};

    const score = data.riskScore || 0;
    const tldrRisks = (() => {
        if (risks.length === 0) return `Güvenlik puanın ${score}/100. Şu an aktif risk yok — temiz iş yapıyorsun.`;
        if ((rc.high || 0) > 0) return `${rc.high} YÜKSEK risk var (aylık etki: ${fmt(data.totalMonthlyRiskImpact || 0)}). Hemen müdahale etmelisin.`;
        return `${risks.length} aktif risk takipte. Güvenlik puanı ${score}/100. Aylık etki: ${fmt(data.totalMonthlyRiskImpact || 0)}.`;
    })();
    const headerStatus = (rc.high || 0) > 0 ? "danger" : (rc.medium || 0) > 2 ? "warning" : "good";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="⚠️"
                title={t("risks.title") || "Risk Radarı"}
                subtitle={t("risks.subtitle") || "İşletmenin maruz kaldığı operasyonel ve finansal riskler"}
                tldr={tldrRisks}
                status={headerStatus}
                kpis={[
                    { label: "Güvenlik Puanı", value: `${score}/100`, color: score >= 70 ? T.green : score >= 40 ? T.yellow : T.red },
                    { label: "Yüksek Risk", value: fmtN(rc.high || 0), color: T.red },
                    { label: "Orta Risk", value: fmtN(rc.medium || 0), color: T.yellow },
                    { label: "Aylık Etki", value: fmt(data.totalMonthlyRiskImpact || 0), color: T.red, hint: "Risk gerçekleşirse kayıp" },
                ]}
            />

            {/* Risk Items */}
            {risks.length === 0 ? (
                <Card>
                    <EmptyState icon="🛡️" title={t("risks.no_risks")} description={t("risks.no_risks_desc")} />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {risks.map((risk, i) => {
                        const cfg = LEVEL_CFG[risk.level] || LEVEL_CFG.medium;
                        return (
                            <Card key={i} style={{ borderLeft: `3px solid ${cfg.color}`, background: cfg.bg }}>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{risk.icon || cfg.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: T.text }}>{risk.title}</span>
                                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                <Badge color={cfg.color} size="sm">{risk.level === "high" ? t("risks.high") : risk.level === "medium" ? t("risks.medium") : t("risks.low_label")}</Badge>
                                                {risk.probability > 0 && <Badge color={T.textDim} size="sm">%{risk.probability}</Badge>}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: "0.84rem", color: T.textSec, margin: "5px 0 0", lineHeight: 1.65 }}>{risk.impact}</p>
                                        {risk.monthlyImpact > 0 && (
                                            <div style={{ fontSize: "0.78rem", color: T.red, marginTop: 4, fontWeight: 600, fontFamily: T.fontMono }}>{t("risks.monthly")}: {fmt(risk.monthlyImpact)}</div>
                                        )}
                                        <div style={{ fontSize: "0.8rem", color: T.accent, marginTop: 8, fontWeight: 600 }}>🛡️ {risk.mitigation}</div>

                                        {/* Affected Products */}
                                        {(risk.affectedProducts || []).length > 0 && (
                                            <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                {risk.affectedProducts.slice(0, 3).map((p, j) => (
                                                    <span key={j} style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: T.rFull, background: T.bgGlass, border: `1px solid ${T.border}`, color: T.textSec }}>{p.name?.slice(0, 25)}</span>
                                                ))}
                                                {risk.affectedProducts.length > 3 && <span style={{ fontSize: "0.7rem", color: T.textDim, padding: "3px 0" }}>+{risk.affectedProducts.length - 3}</span>}
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

export default React.memo(BrainRisks);
