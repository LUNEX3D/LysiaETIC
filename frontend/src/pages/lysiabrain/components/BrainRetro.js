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
import { Card, CardHeader, Badge, StatCard, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const BrainRetro = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/retro");
            if (res.data && res.data.success !== false) setData(res.data.retro);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.retro")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const rs = data.recStats || {};

    const totalLost = data.totalLostProfit || 0;
    const mistakesCount = (data.mistakes || []).length;
    const acceptRate = rs.total > 0 ? Math.round((rs.approved / rs.total) * 100) : 0;
    const tldrRetro = (() => {
        if (rs.total === 0) return "Henüz AI önerisi geçmişi yok — analiz için zaman gerekiyor.";
        const parts = [`AI ${rs.total} öneri ürettiğin, %${acceptRate}'i onaylanmış.`];
        if (mistakesCount > 0) parts.push(`${mistakesCount} geçmiş hata tespit edildi`);
        if (totalLost > 0) parts.push(`tahmini kayıp: ${fmt(totalLost)}`);
        return parts.join(" · ") + ".";
    })();
    const headerStatus = mistakesCount > 5 ? "warning" : "info";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="🔄"
                title={t("retro.title") || "Retro Analiz"}
                subtitle={t("retro.subtitle") || "Geçmiş AI önerileri ve karar performansı"}
                tldr={tldrRetro}
                status={headerStatus}
                kpis={[
                    { label: "Toplam Öneri", value: fmtN(rs.total || 0), color: T.blue },
                    { label: "Onaylanan", value: fmtN(rs.approved || 0), color: T.green },
                    { label: "Reddedilen", value: fmtN(rs.rejected || 0), color: T.red },
                    { label: "Kabul Oranı", value: `%${acceptRate}`, color: acceptRate > 60 ? T.green : T.yellow },
                    { label: "Tahmini Kayıp", value: fmt(totalLost), color: T.red, hint: "Reddedilen veya geç kalan aksiyonlardan" },
                ]}
            />

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
                            const isPrice = m.type === "priçing_mistake";
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
