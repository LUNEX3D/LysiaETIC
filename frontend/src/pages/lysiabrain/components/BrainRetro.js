/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Retro Analiz Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/retro
 * Shows: past mistakes, lost profit, recommendation stats
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainRetro = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/retro");
            if (res.data.success) setData(res.data.retro);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.retro")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const rs = data.recStats || {};

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Summary */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="💸" label={t("retro.total_loss")} value={fmt(data.totalLostProfit || 0)} color={T.red} />
                <StatCard icon="📋" label={t("retro.total_recs")} value={fmtN(rs.total || 0)} color={T.blue} />
                <StatCard icon="✅" label={t("retro.approved")} value={fmtN(rs.approved || 0)} color={T.green} />
                {!isMobile && <StatCard icon="❌" label={t("retro.rejected")} value={fmtN(rs.rejected || 0)} color={T.red} />}
            </div>

            {/* Summary Card */}
            <Card glow>
                <CardHeader icon="🔄" title={t("retro.title")} subtitle={t("retro.subtitle")} color={T.purple} />
                <p style={{ fontSize: "0.88rem", color: T.textSec, lineHeight: 1.65, margin: 0 }}>{data.summary || t("common.no_data")}</p>
            </Card>

            {/* Mistakes */}
            {(data.mistakes || []).length > 0 && (
                <Card>
                    <CardHeader icon="⚠️" title={t("retro.mistakes_title")} subtitle={t("retro.mistakes_sub")} color={T.red} badge={`${data.mistakes.length}`} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {data.mistakes.map((m, i) => {
                            const isPrice = m.type === "pricing_mistake";
                            return (
                                <div key={i} style={{
                                    display: "flex", gap: "0.75rem", padding: "0.85rem 1rem",
                                    borderLeft: `3px solid ${isPrice ? T.red : T.yellow}`,
                                    borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`,
                                    background: isPrice ? T.redDim : T.yellowDim,
                                    alignItems: "flex-start",
                                }}>
                                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{isPrice ? "🔴" : "📦"}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.product}</div>
                                        <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{m.description}</div>
                                    </div>
                                    <Badge color={T.red} size="sm">-{fmt(m.lostAmount)}</Badge>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {(data.mistakes || []).length === 0 && (
                <Card>
                    <EmptyState icon="✅" title={t("retro.no_mistakes")} description={t("retro.no_mistakes_desc")} />
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainRetro);
