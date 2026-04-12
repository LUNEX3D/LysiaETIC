/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Fırsat Radarı Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/opportunities
 * Shows: high margin push, marketplace expansion, trending, seasonal
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainOpportunities = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/opportunities");
            if (res.data.success) setData(res.data.opportunities || []);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.opportunities")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const totalPotential = data.reduce((s, o) => s + (o.potential || 0), 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header */}
            <Card glow>
                <CardHeader icon="🎯" title={t("opps.title")} subtitle={t("opps.subtitle")} color={T.green}
                    badge={data.length > 0 ? `${data.length} ${t("opps.found")}` : undefined} />
                {totalPotential > 0 && (
                    <div style={{ padding: "1rem", borderRadius: T.rSm, background: T.greenDim, border: `1px solid ${T.green}20`, textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("opps.total_potential")}</div>
                        <div style={{ fontSize: isMobile ? "1.5rem" : "2rem", fontWeight: 900, color: T.green, fontFamily: T.fontMono, marginTop: 4 }}>+{fmt(totalPotential)}</div>
                    </div>
                )}
            </Card>

            {/* Opportunity Items */}
            {data.length === 0 ? (
                <Card>
                    <EmptyState icon="🔍" title={t("opps.no_data")} description={t("opps.no_data_desc")} />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {data.map((opp, i) => (
                        <Card key={i} style={{ borderLeft: `3px solid ${T.green}` }}>
                            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: T.rSm,
                                    background: T.greenDim, border: `1px solid ${T.green}20`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.3rem", flexShrink: 0,
                                }}>{opp.icon || "💡"}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ fontWeight: 700, fontSize: "0.92rem", color: T.text }}>{opp.title}</span>
                                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                            {opp.potential > 0 && <Badge color={T.green}>+{fmt(opp.potential)}</Badge>}
                                            {opp.confidence > 0 && <Badge color={T.accent} size="sm">%{opp.confidence}</Badge>}
                                        </div>
                                    </div>
                                    <p style={{ fontSize: "0.84rem", color: T.textSec, margin: "6px 0 0", lineHeight: 1.65 }}>{opp.description}</p>
                                    <div style={{ fontSize: "0.82rem", color: T.accent, marginTop: 8, fontWeight: 600 }}>→ {opp.action}</div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default React.memo(BrainOpportunities);
