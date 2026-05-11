/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Kayıp Avcısı Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-engine/brain/losses
 * Shows: negative profit, missed sales, margin opportunities
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, StatCard, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const TYPE_CFG = {
    negative_profit: { color: T.red, icon: "🔴", label: "Zararda Satış" },
    missed_sales: { color: T.yellow, icon: "📦", label: "Kaçırılan Satış" },
    margin_opportunity: { color: T.blue, icon: "💸", label: "Düşük Marj" },
};

const BrainLosses = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-engine/brain/section/losses");
            if (res.data && res.data.success !== false) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.losses")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const losses = data.losses || [];
    const counts = data.counts || {};
    const filtered = filter === "all" ? losses : losses.filter(l => l.type === filter);

    // Sayfa tepesinde gösterilecek TLDR mesajını üret
    const totalImpact = Number(data.totalImpact) || 0;
    const lossCount = losses.length;
    const tldrText = lossCount === 0
        ? "Şu anda zararda ürün yok ve büyük kayıp tespit edilmedi. Marjlarını koruyabiliyorsun."
        : `${lossCount} üründe toplam ${fmt(totalImpact)} potansiyel kayıp tespit ettim. ${counts.negativeProfitProducts > 0 ? `${counts.negativeProfitProducts} ürün ZARARDA satılıyor — önceliğin bunlar.` : "Marj ve kaçırılan satış fırsatlarına bak."}`;

    const headerStatus = totalImpact > 5000 ? "danger" : totalImpact > 1000 ? "warning" : "good";

    const headerFilters = [
        { id: "all", label: `Tümü`, count: losses.length, active: filter === "all", onClick: () => setFilter("all"), color: T.accent },
        ...Object.entries(TYPE_CFG).map(([key, cfg]) => ({
            id: key, label: `${cfg.icon} ${cfg.label}`,
            count: key === "negative_profit" ? counts.negativeProfitProducts : key === "missed_sales" ? counts.missedSalesProducts : counts.lowMarginProducts,
            active: filter === key, onClick: () => setFilter(key), color: cfg.color,
        })),
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="💸"
                title={t("losses.title") || "Kayıp Avcısı"}
                subtitle={t("losses.subtitle") || "AI'nın tespit ettiği kâr ve satış kayıpları"}
                tldr={tldrText}
                status={headerStatus}
                kpis={[
                    { label: "Toplam Etki", value: fmt(totalImpact), color: T.red, hint: "Tüm kayıpların TRY karşılığı" },
                    { label: "Zararda Ürün", value: counts.negativeProfitProducts || 0, color: T.red, hint: "Maliyet > satış" },
                    { label: "Kaçırılan Satış", value: counts.missedSalesProducts || 0, color: T.yellow, hint: "Stok yokken talep edilen" },
                    { label: "Düşük Marj", value: counts.lowMarginProducts || 0, color: T.blue, hint: "Hedef marjın altında" },
                ]}
                filters={headerFilters}
            />

            {/* Açıklama Card */}
            {data.summary && (
                <Card>
                    <p style={{ fontSize: T.fz.base, color: T.textSec, lineHeight: 1.65, margin: 0 }}>{data.summary}</p>
                </Card>
            )}

            {/* Loss Items */}
            {filtered.length === 0 ? (
                <Card>
                    <EmptyState icon="✅" title={t("losses.no_losses")} description={t("losses.no_losses_desc")} />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {filtered.map((loss, i) => {
                        const cfg = TYPE_CFG[loss.type] || TYPE_CFG.negative_profit;
                        return (
                            <Card key={i} style={{ borderLeft: `3px solid ${cfg.color}` }}>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{loss.icon || cfg.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? "60%" : "70%" }}>{loss.product}</span>
                                            <Badge color={cfg.color}>{fmt(loss.amount)}</Badge>
                                        </div>
                                        <p style={{ fontSize: "0.82rem", color: T.textSec, margin: "5px 0 0", lineHeight: 1.65 }}>{loss.description}</p>
                                        <div style={{ fontSize: "0.8rem", color: T.accent, marginTop: 8, fontWeight: 600 }}>→ {loss.action}</div>
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

export default React.memo(BrainLosses);
