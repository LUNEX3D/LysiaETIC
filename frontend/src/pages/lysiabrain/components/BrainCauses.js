/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Kök Neden Analizi Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/causes
 * Shows: root cause analysis with chain reasoning
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, useResponsive } from "../styles";
import { Card, CardHeader, Badge, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const BrainCauses = ({ t, onError }) => {
    useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/causes");
            if (res.data.success) setData(res.data.causes || []);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.causes")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    if (data.length === 0) {
        return (
            <Card>
                <EmptyState icon="🔍" title={t("causes.no_data")} description={t("causes.no_data_desc")} />
            </Card>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Card glow>
                <CardHeader icon="🔍" title={t("causes.title")} subtitle={t("causes.subtitle")} color={T.purple} badge={`${data.length} ${t("causes.issues")}`} />
            </Card>

            {data.map((cause, i) => (
                <Card key={i} style={{ borderLeft: `3px solid ${cause.issue === "Stok tükenmesi" ? T.yellow : T.red}` }}>
                    {/* Product + Issue */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: "0.85rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.92rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cause.product}</div>
                            <div style={{ fontSize: "0.72rem", color: T.textDim, marginTop: 2, fontFamily: T.fontMono }}>{cause.barcode}</div>
                        </div>
                        <Badge color={cause.issue === "Stok tükenmesi" ? T.yellow : T.red}>{cause.issue}</Badge>
                    </div>

                    {/* Root Causes */}
                    <div style={{ marginBottom: "0.85rem" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>🎯 {t("causes.root_causes")}</div>
                        {(cause.rootCauses || []).map((rc, j) => (
                            <div key={j} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "6px 10px", marginBottom: 4,
                                borderRadius: T.rSm, background: T.redDim,
                                border: `1px solid ${T.red}12`,
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, flexShrink: 0 }} />
                                <span style={{ fontSize: "0.82rem", color: T.text, lineHeight: 1.5 }}>{rc}</span>
                            </div>
                        ))}
                    </div>

                    {/* Chain Reasoning */}
                    {(cause.chain || []).length > 0 && (
                        <div style={{ marginBottom: "0.85rem" }}>
                            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.blue, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>🔗 {t("causes.chain")}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative", paddingLeft: 16 }}>
                                {/* Vertical line */}
                                <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: `${T.blue}30`, borderRadius: 1 }} />
                                {cause.chain.map((step, j) => (
                                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", position: "relative" }}>
                                        <div style={{
                                            width: 16, height: 16, borderRadius: "50%",
                                            background: T.blueDim, border: `2px solid ${T.blue}40`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "0.5rem", fontWeight: 800, color: T.blue,
                                            flexShrink: 0, position: "relative", zIndex: 1,
                                            marginLeft: -8,
                                        }}>{j + 1}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "0.82rem", color: T.text, fontWeight: 600 }}>{step.event}</div>
                                            <div style={{ fontSize: "0.76rem", color: T.textSec, marginTop: 2 }}>→ {step.effect}</div>
                                            {step.time && <span style={{ fontSize: "0.65rem", color: T.textDim }}>{step.time}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendation */}
                    <div style={{ padding: "0.7rem 1rem", borderRadius: T.rSm, background: T.accentDim, border: `1px solid ${T.accent}18` }}>
                        <span style={{ fontSize: "0.82rem", color: T.accent, fontWeight: 600 }}>💊 {cause.recommendation}</span>
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default React.memo(BrainCauses);
