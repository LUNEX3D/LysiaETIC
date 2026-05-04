/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Ürün Segmentasyonu (BCG Matrix) Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/segmentation
 * Shows: stars, cashCows, questionMarks, dogs, newProducts
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, fmtP, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const SEG_CFG = {
    stars: { color: T.green, icon: "⭐", label: "Yıldızlar", desc: "Yüksek satış + Yüksek marj" },
    cashCows: { color: T.blue, icon: "🐄", label: "Nakit İnekleri", desc: "Düzenli satış + İyi marj" },
    questionMarks: { color: T.yellow, icon: "❓", label: "Soru İşaretleri", desc: "Düşük satış + Yüksek marj" },
    dogs: { color: T.red, icon: "🐕", label: "Köpekler", desc: "Düşük satış + Düşük marj" },
    newProducts: { color: T.purple, icon: "🆕", label: "Yeni Ürünler", desc: "Henüz veri yok" },
};

const BrainSegmentation = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [activeSegment, setActiveSegment] = useState("stars");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/segmentation");
            if (res.data && res.data.success !== false) setData(res.data.segmentation);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.segmentation")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const summary = data.summary || {};
    const activeSeg = data[activeSegment] || { count: 0, products: [], strategy: "" };
    const activeCfg = SEG_CFG[activeSegment];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* KPI */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="📦" label={t("seg.total")} value={fmtN(summary.total || 0)} color={T.accent} />
                <StatCard icon="⭐" label={t("seg.stars_pct")} value={`%${summary.starsPercent || 0}`} color={T.green} />
                <StatCard icon="🐕" label={t("seg.dogs_pct")} value={`%${summary.dogsPercent || 0}`} color={T.red} />
            </div>

            {/* BCG Visual Matrix */}
            <Card glow>
                <CardHeader icon="🧬" title={t("seg.title")} subtitle={t("seg.subtitle")} color={T.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "1rem" }}>
                    {Object.entries(SEG_CFG).map(([key, cfg]) => {
                        const seg = data[key] || { count: 0 };
                        const isActive = activeSegment === key;
                        const total = summary.total || 1;
                        const pct = ((seg.count / total) * 100).toFixed(0);
                        return (
                            <button key={key} onClick={() => setActiveSegment(key)} style={{
                                padding: isMobile ? "0.75rem" : "1rem",
                                borderRadius: T.rSm, cursor: "pointer",
                                background: isActive ? `${cfg.color}15` : T.bgGlass,
                                border: `2px solid ${isActive ? cfg.color + "50" : T.border}`,
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                                fontFamily: "inherit", transition: "all 0.2s",
                            }}>
                                <span style={{ fontSize: isMobile ? "1.3rem" : "1.6rem" }}>{cfg.icon}</span>
                                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: isActive ? cfg.color : T.text }}>{cfg.label}</span>
                                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: cfg.color, fontFamily: T.fontMono }}>{seg.count}</span>
                                <span style={{ fontSize: "0.65rem", color: T.textDim }}>%{pct}</span>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Active Segment Detail */}
            <Card>
                <CardHeader icon={activeCfg.icon} title={`${activeCfg.label} (${activeSeg.count})`} subtitle={activeCfg.desc} color={activeCfg.color} />

                {/* Strategy */}
                <div style={{ padding: "0.85rem 1rem", borderRadius: T.rSm, background: `${activeCfg.color}08`, border: `1px solid ${activeCfg.color}18`, marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{t("seg.strategy")}</div>
                    <div style={{ fontSize: "0.86rem", color: T.text, lineHeight: 1.65 }}>{activeSeg.strategy}</div>
                </div>

                {/* Products */}
                {(activeSeg.products || []).length === 0 ? (
                    <EmptyState icon={activeCfg.icon} title={t("seg.no_products")} />
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {activeSeg.products.map((p, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: "0.65rem",
                                padding: "0.6rem 0.85rem", borderRadius: T.rSm,
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                            }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: "50%",
                                    background: `${activeCfg.color}15`, border: `1px solid ${activeCfg.color}25`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.7rem", fontWeight: 800, color: activeCfg.color, fontFamily: T.fontMono, flexShrink: 0,
                                }}>{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                    <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.68rem", color: T.textDim }}>💰 {fmt(p.price)}</span>
                                        <span style={{ fontSize: "0.68rem", color: T.textDim }}>📦 {fmtN(p.stock)}</span>
                                        <span style={{ fontSize: "0.68rem", color: T.textDim }}>📈 {fmtN(p.totalSold)}</span>
                                        {!isMobile && <span style={{ fontSize: "0.68rem", color: p.profitMargin >= 15 ? T.green : p.profitMargin >= 0 ? T.yellow : T.red }}>{fmtP(p.profitMargin)}</span>}
                                    </div>
                                </div>
                                {p.revenue > 0 && <Badge color={activeCfg.color} size="sm">{fmt(p.revenue)}</Badge>}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default React.memo(BrainSegmentation);
