/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Operatör & Otonom Döngü Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n + responsive + cycle history + stats display
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, HealthBar, StatCard, EmptyState, Divider, IconBox, PageHeader } from "./shared/SharedUI";

const BrainOperator = ({ operatorStatus, cycleResult, cycleLoading, onChangeMode, onRunCycle, onRefresh, t, onError }) => {
    const { isMobile, isTablet } = useResponsive();
    const [activePhase, setActivePhase] = useState(null);
    const [completedPhases, setCompletedPhases] = useState([]);
    const [cycleHistory, setCycleHistory] = useState([]);
    const [, setHistoryLoading] = useState(false);
    const [autonomyStatus, setAutonomyStatus] = useState(null);

    // Otonomi config durumunu yükle (mode, eşikler, çalışma saatleri)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await API.get("/ai-engine/autonomy-config/status");
                if (!cancelled && res.data?.status) setAutonomyStatus(res.data.status);
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, []);

    const MODES = {
        passive: { label: t("op.mode.passive"), color: T.green, dim: T.greenDim, icon: "👁️", desc: t("op.mode.passive_desc") },
        assisted: { label: t("op.mode.assisted"), color: T.yellow, dim: T.yellowDim, icon: "🤝", desc: t("op.mode.assisted_desc") },
        autonomous: { label: t("op.mode.autonomous"), color: T.red, dim: T.redDim, icon: "⚡", desc: t("op.mode.autonomous_desc") },
    };

    const PHASES = [
        { key: "observe", label: t("op.phase.observe"), icon: "👁️", color: T.cyan, desc: t("op.phase.observe_desc") },
        { key: "analyze", label: t("op.phase.analyze"), icon: "🔬", color: T.purple, desc: t("op.phase.analyze_desc") },
        { key: "decide", label: t("op.phase.decide"), icon: "🧠", color: T.yellow, desc: t("op.phase.decide_desc") },
        { key: "act", label: t("op.phase.act"), icon: "⚡", color: T.green, desc: t("op.phase.act_desc") },
        { key: "verify", label: t("op.phase.verify"), icon: "✅", color: T.blue, desc: t("op.phase.verify_desc") },
        { key: "learn", label: t("op.phase.learn"), icon: "📚", color: T.pink, desc: t("op.phase.learn_desc") },
    ];

    const GUARD = {
        maxPriceChangePercent: { l: t("op.guard.maxPriceChangePercent"), i: "💰", u: "%", c: T.yellow },
        maxStockOrderQuantity: { l: t("op.guard.maxStockOrderQuantity"), i: "📦", u: "", c: T.blue },
        minProfitMarginPercent: { l: t("op.guard.minProfitMarginPercent"), i: "📈", u: "%", c: T.green },
        maxActionsPerHour: { l: t("op.guard.maxActionsPerHour"), i: "⚡", u: "", c: T.accent },
        requireApprovalForCritical: { l: t("op.guard.requireApprovalForCritical"), i: "🔒", u: "", c: T.red },
        cooldownMinutes: { l: t("op.guard.cooldownMinutes"), i: "⏱️", u: " dk", c: T.purple },
    };

    const currentMode = operatorStatus?.operationMode || "assisted";
    const modeCfg = MODES[currentMode];

    // Load cycle history
    const loadHistory = useCallback(async () => {
        try {
            setHistoryLoading(true);
            const res = await API.get("/ai-chat/operator/cycles?limit=5");
            if (res.data && res.data.success !== false) setCycleHistory(res.data.cycles || []);
        } catch { /* silent */ }
        finally { setHistoryLoading(false); }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleRunCycle = async () => {
        setCompletedPhases([]);
        setActivePhase(null);
        const keys = PHASES.map(p => p.key);
        for (let i = 0; i < keys.length; i++) {
            setActivePhase(keys[i]);
            await new Promise(r => setTimeout(r, 400));
            setCompletedPhases(prev => [...prev, keys[i]]);
        }
        await onRunCycle();
        setActivePhase(null);
        loadHistory();
    };

    const tldrOperator = (() => {
        if (!operatorStatus) return "Operatör durumu yükleniyor...";
        const mode = autonomyStatus?.mode || currentMode;
        const modeText = mode === "autonomous" ? "TAM OTONOM 🤖" : mode === "supervised" ? "DENETİMLİ 👁️" : "MANUEL ✋";
        const work = autonomyStatus?.withinWorkHours === false ? " · ⏰ ÇALIŞMA SAATLERİ DIŞINDA" : "";
        const lastSeen = autonomyStatus?.lastAction?.at ? ` · Son aksiyon: ${new Date(autonomyStatus.lastAction.at).toLocaleString("tr-TR")}` : "";
        return `AI şu anda ${modeText} modunda${work}. Bu saatte ${autonomyStatus?.rateLimit?.hourly || 0}/${autonomyStatus?.rateLimit?.limit || 50} aksiyon yapıldı${lastSeen}.`;
    })();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            <PageHeader
                icon="⬡"
                title="AI Operatör"
                subtitle="Otonom çalışma döngüsü ve performansı"
                tldr={tldrOperator}
                status={autonomyStatus?.mode === "autonomous" ? "warning" : "good"}
                kpis={autonomyStatus ? [
                    { label: "Mod", value: autonomyStatus.mode === "autonomous" ? "Otonom" : autonomyStatus.mode === "supervised" ? "Denetimli" : "Manuel", color: autonomyStatus.mode === "autonomous" ? T.red : autonomyStatus.mode === "supervised" ? T.yellow : T.green },
                    { label: "Çalışma Saatleri", value: autonomyStatus.withinWorkHours ? "İçinde" : "Dışında", color: autonomyStatus.withinWorkHours ? T.green : T.red },
                    { label: "Bu Saat", value: `${autonomyStatus.rateLimit?.hourly || 0}/${autonomyStatus.rateLimit?.limit || 0}`, color: T.cyan },
                    { label: "Bugün", value: autonomyStatus.rateLimit?.daily || 0, color: T.purple },
                    { label: "Şablon", value: autonomyStatus.presetUsed === "balanced" ? "Dengeli" : autonomyStatus.presetUsed === "conservative" ? "Tutucu" : autonomyStatus.presetUsed === "aggressive" ? "Agresif" : "Özel", color: T.accent },
                ] : []}
                actions={
                    <Btn color={T.accent} onClick={() => { try { window.dispatchEvent(new CustomEvent("lysia-goto-tab", { detail: "autonomy" })); } catch {} }}>
                        🎛️ Kuralları Düzenle
                    </Btn>
                }
            />

            {/* ═══ Business Health from operator status ═══ */}
            {operatorStatus?.stats && (
                <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                    <StatCard icon="💎" label={t("op.biz_health")} value={operatorStatus.stats.healthScore || 0} color={T.green} suffix="/100" />
                    <StatCard icon="📦" label={t("dash.total_products")} value={operatorStatus.stats.totalProducts ?? operatorStatus.stats.productCount ?? 0} color={T.blue} />
                    <StatCard icon="🛒" label={t("plat.total_orders")} value={operatorStatus.stats.totalOrders ?? operatorStatus.stats.orderCount ?? 0} color={T.accent} />
                    <StatCard icon="💰" label={t("dash.today_revenue")} value={fmt(operatorStatus.stats.todayRevenue || 0)} color={T.yellow} />
                </div>
            )}

            {/* ═══ Cycle Visualizer ═══ */}
            <Card glow>
                <CardHeader icon="⬡" title={t("op.cycle_title")} subtitle={t("op.cycle_sub")}
                    badge={cycleLoading ? `⚡ ${t("op.running")}` : cycleResult ? `${cycleResult.durationMs || 0}ms` : `✓ ${t("op.ready")}`}
                    color={cycleLoading ? T.yellow : T.accent}
                    action={
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {onRefresh && <Btn color={T.blue} variant="ghost" size={isMobile ? "sm" : "md"} onClick={onRefresh}>↻ {t("op.refresh")}</Btn>}
                            <Btn color={T.accent} variant="solid" size={isMobile ? "sm" : "md"} onClick={handleRunCycle} disabled={cycleLoading}>
                                {cycleLoading ? `⏳ ${t("op.running")}` : `▶ ${t("op.run_cycle")}`}
                            </Btn>
                        </div>
                    }
                />
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 0, flexWrap: "wrap", padding: "0.85rem 0 0.5rem",
                }}>
                    {PHASES.map((phase, i) => {
                        const isActive = activePhase === phase.key;
                        const isDone = completedPhases.includes(phase.key);
                        return (
                            <React.Fragment key={phase.key}>
                                <div style={{
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 4 : 7,
                                    padding: isMobile ? "0.6rem 0.45rem" : "0.85rem 0.75rem",
                                    borderRadius: T.rSm, minWidth: isMobile ? 56 : 88,
                                    border: isActive ? `2px solid ${phase.color}` : `1px solid ${isDone ? T.green + "30" : T.border}`,
                                    background: isActive ? `${phase.color}12` : isDone ? T.greenDim : T.bgGlass,
                                    boxShadow: isActive ? `0 0 16px ${phase.color}20` : "none",
                                    transform: isActive ? "scale(1.06)" : "scale(1)",
                                    transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                                }}>
                                    <span style={{ fontSize: isMobile ? "1rem" : "1.4rem" }}>{isDone && !isActive ? "✅" : phase.icon}</span>
                                    <span style={{
                                        fontSize: isMobile ? "0.5rem" : "0.6rem", fontWeight: 800, letterSpacing: "0.08em",
                                        color: isActive ? phase.color : isDone ? T.green : T.textMuted,
                                        fontFamily: T.fontMono,
                                    }}>{phase.label}</span>
                                    {!isMobile && <span style={{ fontSize: "0.56rem", color: T.textDim, textAlign: "center" }}>{phase.desc}</span>}
                                </div>
                                {i < PHASES.length - 1 && (
                                    <div style={{
                                        width: isMobile ? 12 : 28, height: 2, flexShrink: 0,
                                        background: isDone ? `linear-gradient(90deg, ${T.green}, ${T.green}60)` : T.borderLight,
                                        borderRadius: T.rFull,
                                        boxShadow: isDone ? `0 0 6px ${T.green}20` : "none",
                                    }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </Card>

            {/* ═══ Mode + Guardrails + Memory ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>

                {/* Control Mode */}
                <Card>
                    <CardHeader icon="🎛️" title={t("op.mode_title")} subtitle={t("op.mode_sub")} color={modeCfg.color} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {Object.entries(MODES).map(([key, mode]) => {
                            const isActive = currentMode === key;
                            return (
                                <button key={key} onClick={() => onChangeMode(key)} aria-pressed={isActive} style={{
                                    background: isActive ? mode.dim : T.bgGlass,
                                    border: isActive ? `2px solid ${mode.color}35` : `1px solid ${T.border}`,
                                    borderRadius: T.rSm, padding: isMobile ? "0.75rem" : "1rem 1.15rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: "0.85rem", textAlign: "left",
                                    transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", fontFamily: "inherit", width: "100%",
                                }}>
                                    <div style={{
                                        width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: T.rSm,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: isMobile ? "1.1rem" : "1.35rem", flexShrink: 0,
                                        background: isActive ? T.bgGlass : `${mode.color}08`,
                                        border: `1px solid ${mode.color}20`,
                                        boxShadow: isActive ? `0 0 12px ${mode.color}15` : "none",
                                    }}>{mode.icon}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "0.92rem", fontWeight: 700, color: isActive ? mode.color : T.text }}>{mode.label}</span>
                                            {isActive && <Badge color={mode.color} size="sm">✓ {t("op.active")}</Badge>}
                                        </div>
                                        <span style={{ color: T.textDim, fontSize: "0.76rem", display: "block", marginTop: 4, lineHeight: 1.55 }}>{mode.desc}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </Card>

                {/* Guardrails */}
                <Card>
                    <CardHeader icon="🛡️" title={t("op.guard_title")} subtitle={t("op.guard_sub")} color={T.yellow} />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.55rem" }}>
                        {operatorStatus?.guardrails && Object.entries(operatorStatus.guardrails).map(([key, value]) => {
                            const cfg = GUARD[key] || { l: key, i: "⚙️", u: "", c: T.textDim };
                            return (
                                <div key={key} style={{
                                    borderRadius: T.rSm, padding: "0.85rem 0.95rem",
                                    display: "flex", alignItems: "center", gap: "0.6rem",
                                    background: `${cfg.c}08`, border: `1px solid ${cfg.c}15`,
                                }}>
                                    <IconBox icon={cfg.i} color={cfg.c} size={36} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: T.textDim, fontSize: "0.64rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cfg.l}</div>
                                        <div style={{ fontSize: "0.98rem", fontWeight: 800, marginTop: 3, color: cfg.c, fontFamily: T.fontMono }}>
                                            {typeof value === "boolean" ? (value ? `✅ ${t("op.yes")}` : `❌ ${t("op.no")}`) : `${value}${cfg.u}`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* AI Memory */}
                <Card>
                    <CardHeader icon="🧬" title={t("op.memory_title")} subtitle={t("op.memory_sub")} color={T.purple} />
                    <HealthBar value={Math.min((operatorStatus?.memory?.totalMemories || 0) / 2, 100)} label={t("op.total_memory")} color={T.purple} />
                    <HealthBar value={Math.min((operatorStatus?.memory?.actionMemories || 0), 100)} label={t("op.action_results")} color={T.green} />
                    <HealthBar value={Math.min((operatorStatus?.memory?.learnedPatterns || 0) * 2, 100)} label={t("op.patterns")} color={T.yellow} />
                    <HealthBar value={Math.min((operatorStatus?.memory?.userPreferences || 0) * 3, 100)} label={t("op.preferences")} color={T.blue} />

                    {operatorStatus?.memory?.recentActions?.length > 0 && (
                        <>
                            <Divider spacing="0.9rem" />
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.textDim, marginBottom: "0.55rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("op.recent_actions")}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {operatorStatus.memory.recentActions.map((a, i) => (
                                    <div key={i} style={{
                                        display: "flex", alignItems: "center", gap: "0.55rem",
                                        padding: "0.6rem 0.75rem",
                                        borderLeft: `3px solid ${a.success ? T.green : T.red}`,
                                        borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`,
                                        background: a.success ? T.greenDim : T.redDim,
                                        fontSize: "0.78rem",
                                    }}>
                                        <span aria-hidden="true">{a.success ? "✅" : "❌"}</span>
                                        <span style={{ color: T.text, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.action}</span>
                                        <Badge color={a.success ? T.green : T.red} size="sm">{a.success ? t("op.success") : t("op.failed")}</Badge>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Card>
            </div>

            {/* ═══ Cycle Results ═══ */}
            {cycleResult ? (
                <>
                    <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                        {[
                            { l: t("op.ai_score"), v: cycleResult.analysis?.aiScore?.overall || 0, c: T.accent, i: "◈" },
                            { l: t("op.decisions"), v: cycleResult.decisions?.decisions?.length || 0, c: T.yellow, i: "🧠" },
                            { l: t("op.applied"), v: cycleResult.actionResults?.length || 0, c: T.green, i: "✅" },
                            { l: t("op.critical"), v: cycleResult.decisions?.criticalCount || 0, c: T.red, i: "🚨" },
                            { l: t("op.duration"), v: `${cycleResult.durationMs || 0}`, c: T.blue, i: "⏱️", s: "ms" },
                        ].map((s) => <StatCard key={s.l} icon={s.i} label={s.l} value={s.v} color={s.c} suffix={s.s} />)}
                    </div>

                    {cycleResult.decisions?.decisions?.length > 0 && (
                        <Card>
                            <CardHeader icon="🤖" title={t("op.ai_decisions")} subtitle={t("op.ai_decisions_sub")} badge={`${cycleResult.decisions.decisions.length} ${t("dash.decisions_count")}`} color={T.accent} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", maxHeight: 420, overflowY: "auto" }}>
                                {cycleResult.decisions.decisions.slice(0, 12).map((d, i) => {
                                    const uc = d.urgency === "critical" ? T.red : d.urgency === "high" ? T.yellow : T.blue;
                                    const udim = d.urgency === "critical" ? T.redDim : d.urgency === "high" ? T.yellowDim : T.blueDim;
                                    return (
                                        <div key={i} style={{
                                            borderLeft: `3px solid ${uc}`,
                                            borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`,
                                            padding: isMobile ? "0.75rem" : "1rem 1.1rem", background: udim,
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                                                <span style={{ color: T.text, fontSize: "0.88rem", fontWeight: 700 }}>{d.icon || "◆"} {d.title}</span>
                                                <Badge color={uc} size="sm">{d.urgency}</Badge>
                                            </div>
                                            <p style={{ color: T.textSec, fontSize: "0.8rem", margin: 0, lineHeight: 1.65 }}>{d.description}</p>
                                            <div style={{ display: "flex", gap: "0.5rem", marginTop: 6, flexWrap: "wrap" }}>
                                                {d.impactLabel && <span style={{ color: T.green, fontSize: "0.76rem", fontWeight: 600 }}>💰 {d.impactLabel}</span>}
                                                {d._memoryNote && <span style={{ color: T.purple, fontSize: "0.73rem" }}>🧠 {d._memoryNote}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                </>
            ) : (
                <Card>
                    <EmptyState icon="⬡" title={t("op.no_cycle")} description={t("op.no_cycle_desc")} />
                </Card>
            )}

            {/* ═══ Cycle History ═══ */}
            {cycleHistory.length > 0 && (
                <Card>
                    <CardHeader icon="📜" title={t("op.cycle_history")} subtitle={t("op.cycle_history_sub")} badge={`${cycleHistory.length}`} color={T.textDim} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {cycleHistory.map((cycle, i) => {
                            const decisionN = cycle.decisions?.decisions?.length
                                ?? cycle.decisions?.totalDecisions
                                ?? cycle.decisions?.items?.length
                                ?? 0;
                            const actionN = cycle.actionResults?.length ?? cycle.actions?.length ?? 0;
                            const dur = cycle.durationMs ?? cycle.totalDurationMs ?? 0;
                            const ok = cycle.status !== "failed" && cycle.success !== false;
                            return (
                            <div key={cycle._id || i} style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                padding: "0.75rem 1rem", borderRadius: T.rSm,
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                            }}>
                                <span style={{ fontSize: "1rem" }} aria-hidden="true">{ok ? "✅" : "❌"}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.text }}>
                                        {cycle.operationMode || "assisted"} — {dur}ms
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: T.textDim, marginTop: 2 }}>
                                        {cycle.createdAt ? new Date(cycle.createdAt).toLocaleString("tr-TR") : "—"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                    {decisionN > 0 && <Badge color={T.accent} size="sm">{decisionN} {t("dash.decisions_count")}</Badge>}
                                    {actionN > 0 && <Badge color={T.green} size="sm">{actionN} {t("op.applied")}</Badge>}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainOperator);
