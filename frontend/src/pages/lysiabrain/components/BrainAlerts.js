/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN — Proaktif Uyarılar Tab
 * ═══════════════════════════════════════════════════════════════
 * Endpoint: GET /ai-chat/alerts
 * Shows: proactive alerts from AI operator
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, EmptyState, LoadingState, ErrorState, PageHeader } from "./shared/SharedUI";

const LEVEL_CFG = {
    critical: { color: T.red, bg: T.redDim, icon: "🚨", label: "Kritik" },
    high: { color: T.yellow, bg: T.yellowDim, icon: "⚠️", label: "Yüksek" },
    medium: { color: T.blue, bg: T.blueDim, icon: "ℹ️", label: "Orta" },
    low: { color: T.textDim, bg: T.bgGlass, icon: "💡", label: "Düşük" },
    info: { color: T.accent, bg: T.accentDim, icon: "📋", label: "Bilgi" },
};

const BrainAlerts = ({ t, onError }) => {
    useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-chat/alerts");
            if (res.data && res.data.success !== false) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.alerts")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const alerts = data.alerts || [];
    const filtered = filter === "all" ? alerts : alerts.filter(a => (a.severity || a.level) === filter);

    const critCount = alerts.filter(a => (a.severity || a.level) === "critical").length;
    const highCount = alerts.filter(a => (a.severity || a.level) === "high").length;
    const tldrAlerts = (() => {
        if (alerts.length === 0) return "Şu an proaktif uyarı yok — sistem stabil.";
        if (critCount > 0) return `${critCount} KRİTİK uyarı var, hemen incele. Toplam ${alerts.length} bildirim.`;
        return `${alerts.length} aktif uyarı. ${highCount} yüksek öncelikli — kalanı bilgilendirici.`;
    })();
    const headerStatus = critCount > 0 ? "danger" : highCount > 0 ? "warning" : "info";

    const alertFilters = [
        { id: "all", label: "Tümü", count: alerts.length, active: filter === "all", onClick: () => setFilter("all"), color: T.accent },
        ...Object.entries(LEVEL_CFG).map(([key, cfg]) => ({
            id: key,
            label: `${cfg.icon} ${cfg.label}`,
            count: alerts.filter(a => (a.severity || a.level) === key).length,
            active: filter === key, onClick: () => setFilter(key), color: cfg.color,
        })).filter(f => f.count > 0),
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="🔔"
                title={t("alerts.title") || "Proaktif Uyarılar"}
                subtitle={t("alerts.subtitle") || "AI'nın seninle paylaşmak istediği bildirimler"}
                tldr={tldrAlerts}
                status={headerStatus}
                kpis={[
                    { label: "Toplam", value: alerts.length, color: T.accent },
                    { label: "Kritik", value: critCount, color: T.red },
                    { label: "Yüksek", value: highCount, color: T.yellow },
                ]}
                filters={alertFilters}
                actions={<Btn color={T.accent} variant="ghost" size="sm" onClick={load}>↻ {t("header.refresh") || "Yenile"}</Btn>}
            />

            {filtered.length === 0 ? (
                <Card>
                    <EmptyState icon="✅" title={t("alerts.no_alerts")} description={t("alerts.no_alerts_desc")} />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {filtered.map((alert, i) => {
                        const level = (alert.severity || alert.level || "info");
                        const cfg = LEVEL_CFG[level] || LEVEL_CFG.info;
                        return (
                            <Card key={i} style={{ borderLeft: `3px solid ${cfg.color}`, background: cfg.bg }}>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{alert.icon || cfg.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: T.text }}>{alert.title || alert.headline}</span>
                                            <Badge color={cfg.color} size="sm">{cfg.label}</Badge>
                                        </div>
                                        <p style={{ fontSize: "0.84rem", color: T.textSec, margin: "6px 0 0", lineHeight: 1.65 }}>{alert.message || alert.description}</p>
                                        {(alert.action || alert.suggestion) && (
                                            <div style={{ fontSize: "0.8rem", color: T.accent, marginTop: 8, fontWeight: 600 }}>→ {alert.action || alert.suggestion}</div>
                                        )}
                                        {alert.amount > 0 && (
                                            <div style={{ marginTop: 6 }}>
                                                <Badge color={cfg.color} size="sm">{fmt(alert.amount)}</Badge>
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

export default React.memo(BrainAlerts);
