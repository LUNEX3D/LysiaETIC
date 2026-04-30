/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Dashboard Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n support + responsive layout + accessibility
 * ═══════════════════════════════════════════════════════════════
 */
import React from "react";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, StatCard, ScoreRing, HealthBar, Badge, Btn, EmptyState, GlowLine, InsightCard } from "./shared/SharedUI";

const BrainDashboard = ({ brain, recSummary, onTabChange, onAutoDecide, onDiagnosis, autoDecideLoading, autoDecisions, t }) => {
    const { isMobile, isTablet } = useResponsive();

    if (!brain) return <EmptyState icon="🧠" title={t("common.loading")} description="LysiaBrain" />;

    const bh = brain.businessHealth || {};
    const tone = brain.emotionalTone || {};
    const score = brain.score || {};
    const money = brain.moneyTracker || {};
    const redAlerts = brain.redAlerts || {};
    const thoughtProcess = brain.thoughtProcess || {};
    const overallScore = bh.overallScore || 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "1.5rem" : "2.5rem", maxWidth: 1400, margin: "0 auto" }}>

            {/* ═══ AI THOUGHT PROCESS (REAL-TIME AGENT FEEL) ═══ */}
            {thoughtProcess.steps && (
                <section>
                    <Card style={{ 
                        background: `${T.bgCard}dd`, 
                        border: `1px solid ${T.accent}30`,
                        overflow: "hidden",
                        padding: "1.25rem 1.5rem"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div style={{ 
                                    width: 8, height: 8, borderRadius: "50%", 
                                    background: thoughtProcess.agentStatus === "busy" ? T.yellow : T.green,
                                    boxShadow: `0 0 10px ${thoughtProcess.agentStatus === "busy" ? T.yellow : T.green}`
                                }} />
                                <h2 style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textDim, margin: 0 }}>
                                    Neural Processing: {thoughtProcess.summary}
                                </h2>
                            </div>
                            <Badge color={T.accentDim} size="sm">ACTIVE AGENT</Badge>
                        </div>
                        
                        <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
                            {thoughtProcess.steps.map((step, i) => (
                                <div key={i} style={{ 
                                    minWidth: isMobile ? 220 : 280, 
                                    background: "rgba(255,255,255,0.03)", 
                                    padding: "1rem", 
                                    borderRadius: T.rSm,
                                    border: `1px solid ${step.status === "warning" ? T.red + "30" : T.border}`,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.5rem"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontSize: "1.1rem" }}>{step.icon}</span>
                                        <span style={{ fontWeight: 800, fontSize: "0.8rem", color: step.status === "warning" ? T.red : T.text }}>{step.title}</span>
                                    </div>
                                    <div style={{ fontSize: "0.7rem", color: T.textSec, lineHeight: 1.4 }}>{step.content}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </section>
            )}

            {/* ═══ AI COMMAND CENTER (HERO) ═══ */}
            <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: "1.5rem" }}>
                <Card glow style={{ 
                    background: `radial-gradient(circle at 10% 10%, ${T.accent}10, transparent 40%), ${T.bgCard}`, 
                    padding: isMobile ? "1.5rem" : "2rem",
                    border: `1px solid ${T.borderGlow}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                        <Badge color={T.accent} size="lg">✦ AI ONLINE</Badge>
                        <span style={{ fontSize: "0.7rem", color: T.textDim, fontWeight: 700 }}>VER. 10.4.5</span>
                    </div>
                    <h1 style={{ 
                        margin: 0, 
                        fontSize: isMobile ? "1.75rem" : "2.25rem", 
                        fontWeight: 900, 
                        color: T.text, 
                        letterSpacing: "-0.04em",
                        lineHeight: 1.1,
                        marginBottom: "1rem"
                    }}>
                        {brain.context?.greeting || t("dash.greeting_default")}
                    </h1>
                    <p style={{ 
                        fontSize: "0.95rem", 
                        color: T.textSec, 
                        lineHeight: 1.6, 
                        maxWidth: 500,
                        margin: 0
                    }}>
                        {tone.message || t("dash.ai_analyzing")}
                    </p>
                    
                    <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
                        <Btn glow onClick={() => onTabChange("recommendations")}>{t("tab.recommendations")}</Btn>
                        <Btn variant="outline" onClick={onDiagnosis} loading={autoDecideLoading}>{t("dash.diagnosis")}</Btn>
                    </div>
                </Card>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <InsightCard 
                        icon="📈" 
                        title={t("dash.today_revenue")} 
                        value={fmt(money.todayRevenue)} 
                        trend={bh.metrics?.revenueTrend}
                        description="Son 24 saatlik satış hacmi"
                        onClick={() => onTabChange("predictions")}
                    />
                    <InsightCard 
                        icon="💎" 
                        title={t("dash.ai_earned")} 
                        value={fmt(money.aiEarnings)} 
                        status="success"
                        description="AI önerileriyle sağlanan ek kâr"
                        onClick={() => onTabChange("roi")}
                    />
                    <InsightCard 
                        icon="🚨" 
                        title={t("dash.loss_detected")} 
                        value={fmt(money.potentialLoss)} 
                        status="danger"
                        description="Kritik zarar riski taşıyan ürünler"
                        onClick={() => onTabChange("losses")}
                    />
                    <InsightCard 
                        icon="🎯" 
                        title={t("dash.pending_recs")} 
                        value={recSummary.pending || 0} 
                        status="warning"
                        description="Uygulanmayı bekleyen stratejik kararlar"
                        onClick={() => onTabChange("recommendations")}
                    />
                </div>
            </section>

            {/* ═══ CRITICAL ALERTS (HIGH CONTRAST) ═══ */}
            {redAlerts.hasAlerts && (
                <section>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                        <span style={{ fontSize: "1.25rem" }}>🚨</span>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: T.red }}>Immediate Actions Required</h2>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                        {(redAlerts.alerts || []).map((alert, i) => (
                            <Card key={i} glow style={{ background: "rgba(248,113,113,0.08)", borderLeft: `5px solid ${T.red}`, padding: "1.5rem" }}>
                                <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
                                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.redDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>{alert.icon}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 900, fontSize: "1.1rem", color: T.text, marginBottom: 4 }}>{alert.headline}</div>
                                        <div style={{ fontSize: "0.9rem", color: T.textSec, lineHeight: 1.6, marginBottom: "1.25rem" }}>{alert.message}</div>
                                        <div style={{ display: "flex", gap: "0.75rem" }}>
                                            <Btn color={T.red} size="sm" onClick={() => onTabChange("recommendations")}>Fix Now: {alert.action}</Btn>
                                            <Btn size="sm" variant="outline" onClick={() => onTabChange("dashboard")}>Analyze</Btn>
                                        </div>
                                    </div>
                                    {alert.amount > 0 && (
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: "0.6rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase" }}>Impact</div>
                                            <Badge color={T.red}>{fmt(alert.amount)}</Badge>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* ═══ CORE METRICS ═══ */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <StatCard icon="⚡" label={t("dash.today_revenue")} value={fmt(bh.metrics?.todayRevenue)} color={T.accent} trend={bh.metrics?.revenueTrend} />
                <StatCard icon="💎" label={t("dash.net_profit")} value={fmt(money.summary?.netProfit || 0)} color={T.green} />
                <StatCard icon="📉" label={t("dash.total_loss")} value={fmt(money.summary?.totalLoss || 0)} color={T.red} />
                <StatCard icon="✦" label={t("dash.pending_recs")} value={recSummary?.pending || 0} color={T.purple} />
                <StatCard icon="🛡️" label="Sistem Sağlığı" value={`%${overallScore}`} color={overallScore > 70 ? T.green : T.yellow} />
            </section>

            {/* ═══ INTELLIGENCE GRID ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "2fr 1.2fr", gap: "2rem" }}>
                
                {/* Left: Recommendations or Decisions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {autoDecisions ? (
                        <Card glow>
                            <CardHeader icon="✦" title={t("dash.ai_decisions")} subtitle={autoDecisions.summary} badge={`${autoDecisions.totalDecisions}`} color={T.accent} />
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                                {(autoDecisions.decisions || []).slice(0, 6).map((d, i) => (
                                    <div key={i} style={{ padding: "1rem", background: T.bgGlass, borderRadius: T.rSm, border: `1px solid ${T.border}` }}>
                                        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                            <span>{d.icon}</span>
                                            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: T.text }}>{d.title}</span>
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: T.textDim, lineHeight: 1.5, marginBottom: "0.75rem" }}>{d.description}</div>
                                        <Badge color={T.green} size="sm">{d.impactLabel}</Badge>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader icon="◈" title="Strategic Intelligence" subtitle="Recent AI findings and focus items" color={T.accent} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {(brain.focusItems || []).slice(0, 4).map((f, i) => (
                                    <div key={i} style={{ display: "flex", gap: "1.25rem", padding: "1.25rem", background: T.bgGlass, borderRadius: T.rSm, border: `1px solid ${T.border}`, alignItems: "center" }}>
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>{f.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: T.text }}>{f.title}</div>
                                            <div style={{ fontSize: "0.82rem", color: T.textSec, marginTop: 2 }}>{f.description}</div>
                                            {f.impact && <div style={{ fontSize: "0.75rem", color: T.accent, fontWeight: 700, marginTop: 4 }}>Etki: {f.impact}</div>}
                                        </div>
                                        <Btn size="sm" color={T.accent} variant="ghost" onClick={() => onTabChange(f.category === "stock" ? "recommendations" : "losses")}>Detaylar</Btn>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right: Health & Top Performers */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    <Card>
                        <CardHeader icon="📊" title="Operational Health" color={T.green} />
                        <HealthBar value={bh.profitHealth || 0} label="PROFITABILITY" color={T.green} />
                        <HealthBar value={bh.stockHealth || 0} label="INVENTORY" color={T.blue} />
                        <HealthBar value={bh.salesHealth || 0} label="SALES VELOCITY" color={T.yellow} />
                        <HealthBar value={bh.operationsHealth || 0} label="OPERATIONS" color={T.purple} />
                    </Card>

                    <Card>
                        <CardHeader icon="🏆" title="Top Contributors" color={T.accent} />
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {(money.topEarners || []).slice(0, 3).map((p, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(52,211,153,0.06)", borderRadius: T.rSm }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textSec }}>{p.name?.slice(0, 24)}...</span>
                                    <span style={{ fontWeight: 800, color: T.green }}>+{fmt(p.totalProfit)}</span>
                                </div>
                            ))}
                            {(money.topLosers || []).slice(0, 3).map((p, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(248,113,113,0.06)", borderRadius: T.rSm }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textSec }}>{p.name?.slice(0, 24)}...</span>
                                    <span style={{ fontWeight: 800, color: T.red }}>-{fmt(p.totalLoss)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BrainDashboard);
