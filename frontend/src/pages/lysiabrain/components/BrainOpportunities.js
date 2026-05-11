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
import { Card, CardHeader, Badge, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const BrainOpportunities = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/opportunities");
            if (res.data && res.data.success !== false) setData(res.data.opportunities || []);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.opportunities")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const totalPotential = data.reduce((s, o) => s + (o.potential || 0), 0);

    const topOpp = data.slice().sort((a, b) => (b.potential || 0) - (a.potential || 0))[0];
    const tldrOpps = (() => {
        if (data.length === 0) return "AI henüz somut fırsat tespit edemedi. Daha fazla sipariş geçmişi biriktikçe yeni alanlar açılacak.";
        const parts = [];
        parts.push(`${data.length} fırsat bulundu`);
        if (totalPotential > 0) parts.push(`toplam potansiyel +${fmt(totalPotential)}`);
        if (topOpp) parts.push(`en yüksek: "${topOpp.title}"`);
        return parts.join(" · ");
    })();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="✨"
                title={t("opps.title") || "Fırsat Radarı"}
                subtitle={t("opps.subtitle") || "AI'nın tespit ettiği büyüme ve kâr fırsatları"}
                tldr={tldrOpps}
                status={data.length > 0 ? "good" : "info"}
                kpis={[
                    { label: "Toplam Fırsat", value: data.length, color: T.green },
                    { label: "Potansiyel Etki", value: `+${fmt(totalPotential)}`, color: T.green, hint: "Tüm fırsatlar değerlendirilirse" },
                    { label: "En Yüksek", value: topOpp ? `+${fmt(topOpp.potential || 0)}` : "—", color: T.accent },
                ]}
            />

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
