/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Ürün Sağlık Haritası Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/product-health
 * Shows: product health scores, segments, worst/best products
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmtN, fmtP, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, ScoreRing, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const SEG_CFG = {
    critical: { color: T.red, icon: "🔴", label: "Kritik" },
    warning: { color: T.yellow, icon: "🟡", label: "Dikkat" },
    healthy: { color: T.accent, icon: "🟢", label: "Sağlıklı" },
    excellent: { color: T.green, icon: "🌟", label: "Mükemmel" },
};

const BrainHealth = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/health");
            if (res.data.success) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.health")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const segs = data.segments || {};
    const products = data.products || [];
    const filtered = filter === "all" ? products
        : filter === "critical" ? products.filter(p => p.healthScore < 30)
        : filter === "warning" ? products.filter(p => p.healthScore >= 30 && p.healthScore < 50)
        : filter === "healthy" ? products.filter(p => p.healthScore >= 50 && p.healthScore < 75)
        : products.filter(p => p.healthScore >= 75);

    const getSegColor = (score) => score < 30 ? T.red : score < 50 ? T.yellow : score < 75 ? T.accent : T.green;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI + Score */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="🏥" label={t("health.avg_score")} value={data.avgHealthScore || 0} color={T.accent} suffix="/100" />
                <StatCard icon="🔴" label={SEG_CFG.critical.label} value={fmtN(segs.critical || 0)} color={T.red} />
                <StatCard icon="🟡" label={SEG_CFG.warning.label} value={fmtN(segs.warning || 0)} color={T.yellow} />
                {!isMobile && <StatCard icon="🟢" label={SEG_CFG.healthy.label} value={fmtN(segs.healthy || 0)} color={T.accent} />}
                {!isMobile && <StatCard icon="🌟" label={SEG_CFG.excellent.label} value={fmtN(segs.excellent || 0)} color={T.green} />}
            </div>

            {/* Segment Distribution */}
            <Card glow>
                <CardHeader icon="🏥" title={t("health.title")} subtitle={t("health.subtitle")} color={T.accent} />
                <div style={{ display: "flex", gap: 4, height: 32, borderRadius: T.rSm, overflow: "hidden", marginBottom: "1rem" }}>
                    {Object.entries(SEG_CFG).map(([key, cfg]) => {
                        const count = segs[key] || 0;
                        const total = products.length || 1;
                        const pct = (count / total) * 100;
                        if (pct < 1) return null;
                        return (
                            <div key={key} title={`${cfg.label}: ${count} (${pct.toFixed(0)}%)`} style={{
                                width: `${pct}%`, background: `${cfg.color}30`, borderLeft: `3px solid ${cfg.color}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.65rem", fontWeight: 700, color: cfg.color, cursor: "default",
                                transition: "width 0.5s ease",
                            }}>
                                {pct > 8 && `${count}`}
                            </div>
                        );
                    })}
                </div>

                {/* Filter Buttons */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[{ id: "all", label: t("health.all"), color: T.accent }, ...Object.entries(SEG_CFG).map(([id, cfg]) => ({ id, label: cfg.label, color: cfg.color }))].map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)} style={{
                            padding: "6px 14px", borderRadius: T.rFull, cursor: "pointer",
                            background: filter === f.id ? `${f.color}15` : "transparent",
                            border: `1px solid ${filter === f.id ? f.color + "35" : T.border}`,
                            color: filter === f.id ? f.color : T.textDim,
                            fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit",
                        }}>
                            {f.label} {f.id !== "all" && <span style={{ fontFamily: T.fontMono }}>({segs[f.id] || 0})</span>}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Product List */}
            <Card>
                <CardHeader icon="📋" title={t("health.products_title")} subtitle={`${filtered.length} ${t("pm.products")}`} color={T.blue} />
                {filtered.length === 0 ? <EmptyState icon="✅" title={t("common.no_data")} /> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {filtered.slice(0, 30).map((p, i) => {
                            const c = getSegColor(p.healthScore);
                            return (
                                <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: "0.65rem",
                                    padding: isMobile ? "0.6rem 0.7rem" : "0.6rem 0.85rem",
                                    borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}`,
                                }}>
                                    <ScoreRing score={p.healthScore} size={36} thickness={2.5} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "0.68rem", color: T.textDim }}>📦 {fmtN(p.stock)}</span>
                                            <span style={{ fontSize: "0.68rem", color: T.textDim }}>📈 {fmtN(p.totalSold)}</span>
                                            {p.profitMargin !== undefined && <span style={{ fontSize: "0.68rem", color: p.profitMargin >= 0 ? T.green : T.red }}>{fmtP(p.profitMargin)}</span>}
                                            {!isMobile && p.daysOfStock !== undefined && <span style={{ fontSize: "0.68rem", color: p.daysOfStock < 7 ? T.red : T.textDim }}>⏳ {p.daysOfStock}d</span>}
                                        </div>
                                    </div>
                                    <Badge color={c} size="sm">{p.healthScore}</Badge>
                                </div>
                            );
                        })}
                        {filtered.length > 30 && (
                            <div style={{ textAlign: "center", padding: "0.75rem", fontSize: "0.78rem", color: T.textDim }}>
                                +{filtered.length - 30} {t("health.more_products")}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default React.memo(BrainHealth);
