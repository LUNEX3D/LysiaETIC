/**
 * 
 * LYSIA BRAIN  Kâr Haritas (Profit Heatmap) Tab
 * 
 * Endpoint: GET /ai-engine/profit-heatmap
 * Shows: byCategory, byMarketplace, byProduct profit zones
 * 
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, fmtP, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const ZONE_CFG = {
    high_profit: { color: T.green, label: "Yksek Kâr", icon: "🟢" },
    moderate: { color: T.yellow, label: "Orta", icon: "🟡" },
    loss: { color: T.red, label: "Zarar", icon: "🔴" },
};

const EMPTY_HEATMAP = { byCategory: [], byMarketplace: [], byProduct: [] };

const BrainProfitMap = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [view, setView] = useState("category");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/heatmap");
            if (res.data && res.data.success !== false) {
                const h = res.data.heatmap;
                setData(h && typeof h === "object" ? { ...EMPTY_HEATMAP, ...h } : { ...EMPTY_HEATMAP });
            }
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.profit_map")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} retryLabel={t("header.refresh")} />;

    const views = [
        { id: "category", label: t("pm.by_category"), icon: "📂" },
        { id: "marketplace", label: t("pm.by_marketplace"), icon: "🏪" },
        { id: "product", label: t("pm.by_product"), icon: "📦" },
    ];

    const renderBar = (value, max, color) => {
        const pct = max > 0 ? Math.min(Math.abs(value) / max * 100, 100) : 0;
        return (
            <div style={{ width: "100%", height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: T.rFull, background: value >= 0 ? color : T.red, transition: "width 0.8s ease" }} />
            </div>
        );
    };

    const maxCatProfit = Math.max(...(data.byCategory || []).map(c => Math.abs(c.totalProfit)), 1);
    const maxMpProfit = Math.max(...(data.byMarketplace || []).map(m => Math.abs(m.totalProfit)), 1);
    // maxProdProfit removed  unused

    // Toplam kâr/zarar özetlerini hesapla
    const totalProfit = (data.byCategory || []).reduce((s, c) => s + (c.totalProfit || 0), 0);
    const lossCount = (data.byCategory || []).filter(c => c.totalProfit < 0).length;
    const bestCat = (data.byCategory || []).slice().sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0))[0];
    const worstCat = (data.byCategory || []).slice().sort((a, b) => (a.totalProfit || 0) - (b.totalProfit || 0))[0];
    const tldrProfit = (() => {
        if (!data.byCategory || data.byCategory.length === 0) return "Henüz kâr/zarar haritası oluşturmak için yeterli veri yok.";
        const parts = [];
        if (bestCat?.totalProfit > 0) parts.push(`En kârlı kategori: ${bestCat.category} (${fmt(bestCat.totalProfit)})`);
        if (worstCat?.totalProfit < 0) parts.push(`Zararda: ${worstCat.category} (${fmt(worstCat.totalProfit)})`);
        if (lossCount > 0) parts.push(`${lossCount} kategori zararda — odak buraya`);
        return parts.length ? parts.join(" · ") : `Toplam kâr ${fmt(totalProfit)} — tüm kategoriler pozitif.`;
    })();
    const headerStatus = lossCount > 0 ? "warning" : totalProfit > 0 ? "good" : "info";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="🗺️"
                title={t("pm.title") || "Kâr Haritası"}
                subtitle={t("pm.subtitle") || "Kategori, pazaryeri ve ürün bazında nerede kazanıyoruz, nerede kaybediyoruz?"}
                tldr={tldrProfit}
                status={headerStatus}
                kpis={[
                    { label: "Toplam Kâr", value: fmt(totalProfit), color: totalProfit >= 0 ? T.green : T.red },
                    { label: "Kategori", value: (data.byCategory || []).length, color: T.blue },
                    { label: "Pazaryeri", value: (data.byMarketplace || []).length, color: T.purple },
                    { label: "Zararda Kategori", value: lossCount, color: lossCount > 0 ? T.red : T.green },
                ]}
                filters={views.map(v => ({ id: v.id, label: `${v.icon} ${v.label}`, active: view === v.id, onClick: () => setView(v.id), color: T.accent }))}
            />

            {view === "category" && (
                <Card>
                    <CardHeader icon="📂" title={t("pm.category_title")} subtitle={t("pm.category_sub")} color={T.blue} badge={`${(data.byCategory || []).length}`} />
                    {(data.byCategory || []).length === 0 ? <EmptyState icon="📭" title={t("common.no_data")} /> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                            {data.byCategory.map((cat, i) => {
                                const z = ZONE_CFG[cat.zone] || ZONE_CFG.moderate;
                                return (
                                    <div key={i} style={{ padding: "0.85rem 1rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: "0.85rem" }}>{z.icon}</span>
                                                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.category}</span>
                                                <Badge color={T.textDim} size="sm">{cat.productCount} {t("pm.products")}</Badge>
                                            </div>
                                            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                                                {!isMobile && <span style={{ fontSize: "0.78rem", color: T.textDim }}>{t("pm.revenue")}: <span style={{ color: T.text, fontWeight: 700, fontFamily: T.fontMono }}>{fmt(cat.totalRevenue)}</span></span>}
                                                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: cat.totalProfit >= 0 ? T.green : T.red, fontFamily: T.fontMono }}>{cat.totalProfit >= 0 ? "+" : ""}{fmt(cat.totalProfit)}</span>
                                            </div>
                                        </div>
                                        {renderBar(cat.totalProfit, maxCatProfit, z.color)}
                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                                            <span style={{ fontSize: "0.7rem", color: T.textDim }}>{t("pm.avg_margin")}: <span style={{ color: z.color, fontWeight: 700 }}>{fmtP(cat.avgMargin)}</span></span>
                                            <Badge color={z.color} size="sm">{z.label}</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}

            {view === "marketplace" && (
                <Card>
                    <CardHeader icon="🏪" title={t("pm.mp_title")} subtitle={t("pm.mp_sub")} color={T.purple} badge={`${(data.byMarketplace || []).length}`} />
                    {(data.byMarketplace || []).length === 0 ? <EmptyState icon="📭" title={t("common.no_data")} /> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                            {data.byMarketplace.map((mp, i) => {
                                const z = ZONE_CFG[mp.zone] || ZONE_CFG.moderate;
                                return (
                                    <div key={i} style={{ padding: "0.85rem 1rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{mp.marketplace}</span>
                                                <Badge color={T.textDim} size="sm">{mp.productCount} {t("pm.products")}</Badge>
                                            </div>
                                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: mp.totalProfit >= 0 ? T.green : T.red, fontFamily: T.fontMono }}>{mp.totalProfit >= 0 ? "+" : ""}{fmt(mp.totalProfit)}</span>
                                        </div>
                                        {renderBar(mp.totalProfit, maxMpProfit, z.color)}
                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                                            <span style={{ fontSize: "0.7rem", color: T.textDim }}>{t("pm.revenue")}: {fmt(mp.totalRevenue)}</span>
                                            <span style={{ fontSize: "0.7rem", color: T.textDim }}>{t("pm.avg_margin")}: <span style={{ color: z.color, fontWeight: 700 }}>{fmtP(mp.avgMargin)}</span></span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}

            {view === "product" && (
                <Card>
                    <CardHeader icon="📦" title={t("pm.product_title")} subtitle={t("pm.product_sub")} color={T.accent} badge={`Top ${(data.byProduct || []).length}`} />
                    {(data.byProduct || []).length === 0 ? <EmptyState icon="📭" title={t("common.no_data")} /> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {data.byProduct.map((p, i) => {
                                const z = ZONE_CFG[p.zone] || ZONE_CFG.moderate;
                                return (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.85rem", borderRadius: T.rSm, background: i < 3 ? `${T.green}08` : T.bgGlass, border: `1px solid ${T.border}` }}>
                                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${z.color}15`, border: `1px solid ${z.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, color: z.color, fontFamily: T.fontMono, flexShrink: 0 }}>{i + 1}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: "0.82rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                            <div style={{ fontSize: "0.7rem", color: T.textDim, marginTop: 2 }}>{fmtN(p.totalSold)} {t("pm.sold")}  {t("pm.margin")}: {fmtP(p.profitMargin)}</div>
                                        </div>
                                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: p.totalProfit >= 0 ? T.green : T.red, fontFamily: T.fontMono, flexShrink: 0 }}>{p.totalProfit >= 0 ? "+" : ""}{fmt(p.totalProfit)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainProfitMap);
