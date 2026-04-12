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
import { Card, CardHeader, Badge, Btn, EmptyState, LoadingState, ErrorState } from "./shared/SharedUI";

const LEVEL_CFG = {
    critical: { color: T.red, bg: T.redDim, icon: "🚨", label: "Kritik" },
    high: { color: T.yellow, bg: T.yellowDim, icon: "⚠️", label: "Yüksek" },
    medium: { color: T.blue, bg: T.blueDim, icon: "ℹ️", label: "Orta" },
    low: { color: T.textDim, bg: T.bgGlass, icon: "💡", label: "Düşük" },
    info: { color: T.accent, bg: T.accentDim, icon: "📋", label: "Bilgi" },
};

const BrainAlerts = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await API.get("/ai-chat/alerts");
            if (res.data.success) setData(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t, onError]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.alerts")} />;
    if (!data) return <ErrorState message={t("error.data_load_fail")} onRetry={load} />;

    const alerts = data.alerts || [];
    const filtered = filter === "all" ? alerts : alerts.filter(a => (a.severity || a.level) === filter);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Card glow>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <CardHeader icon="🔔" title={t("alerts.title")} subtitle={t("alerts.subtitle")} color={T.yellow} badge={alerts.length > 0 ? `${alerts.length}` : undefined} />
                    <Btn color={T.accent} variant="ghost" size="sm" onClick={load}>↻ {t("header.refresh")}</Btn>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "0.5rem" }}>
                    <button onClick={() => setFilter("all")} style={{
                        padding: "5px 12px", borderRadius: T.rFull, cursor: "pointer",
                        background: filter === "all" ? T.accentDim : "transparent",
                        border: `1px solid ${filter === "all" ? T.accent + "35" : T.border}`,
                        color: filter === "all" ? T.accent : T.textDim,
                        fontSize: "0.73rem", fontWeight: 600, fontFamily: "inherit",
                    }}>{t("alerts.all")} ({alerts.length})</button>
                    {Object.entries(LEVEL_CFG).map(([key, cfg]) => {
                        const count = alerts.filter(a => (a.severity || a.level) === key).length;
                        if (count === 0) return null;
                        return (
                            <button key={key} onClick={() => setFilter(key)} style={{
                                padding: "5px 12px", borderRadius: T.rFull, cursor: "pointer",
                                background: filter === key ? `${cfg.color}15` : "transparent",
                                border: `1px solid ${filter === key ? cfg.color + "35" : T.border}`,
                                color: filter === key ? cfg.color : T.textDim,
                                fontSize: "0.73rem", fontWeight: 600, fontFamily: "inherit",
                            }}>{cfg.icon} {cfg.label} ({count})</button>
                        );
                    })}
                </div>
            </Card>

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
