/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Dashboard Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n support + responsive layout + accessibility
 * ═══════════════════════════════════════════════════════════════
 */
import React from "react";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, StatCard, ScoreRing, HealthBar, Badge, Btn, EmptyState, GlowLine } from "./shared/SharedUI";

const BrainDashboard = ({ brain, recSummary, onTabChange, onAutoDecide, onDiagnosis, autoDecideLoading, autoDecisions, t }) => {
    const { isMobile, isTablet } = useResponsive();

    if (!brain) return <EmptyState icon="🧠" title={t("common.loading")} description="LysiaBrain" />;

    const bh = brain.businessHealth || {};
    const tone = brain.emotionalTone || {};
    const focus = brain.focusItems || [];
    const context = brain.context || {};
    const score = brain.score || {};
    const notifs = brain.notifications || [];
    const money = brain.moneyTracker || {};
    const teaching = brain.teachingTips || [];
    const redAlerts = brain.redAlerts || {};
    const journal = brain.journal || {};
    const overallScore = bh.overallScore || 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "1rem" : "1.25rem" }}>

            {/* ═══ RED ALERTS ═══ */}
            {redAlerts.hasAlerts && (
                <Card glow style={{ background: T.redDim, borderColor: `${T.red}30` }} role="alert">
                    <CardHeader icon="🚨" title={t("dash.red_alert")} badge={`${redAlerts.criticalCount} ${t("dash.critical")}`} color={T.red} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {(redAlerts.alerts || []).map((alert, i) => (
                            <div key={i} style={{
                                display: "flex", gap: "0.85rem", padding: isMobile ? "0.75rem" : "0.95rem 1rem",
                                background: "rgba(248,113,113,0.06)",
                                borderLeft: `3px solid ${T.red}`,
                                borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`,
                                alignItems: "flex-start",
                            }}>
                                <span style={{ fontSize: "1.2rem", flexShrink: 0 }} aria-hidden="true">{alert.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.red }}>{alert.headline}</div>
                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{alert.message}</div>
                                    <div style={{ fontSize: "0.78rem", color: T.accent, marginTop: 6, fontWeight: 600 }}>→ {alert.action}</div>
                                </div>
                                {alert.amount > 0 && !isMobile && <Badge color={T.red}>{fmt(alert.amount)}</Badge>}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ═══ HERO SECTION ═══ */}
            <Card glow style={{ background: T.gradientHero, borderColor: T.borderGlow, position: "relative", overflow: "hidden" }}>
                <div aria-hidden="true" style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${T.accent}08, transparent 70%)`, pointerEvents: "none" }} />
                <div aria-hidden="true" style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${T.accentAlt}06, transparent 70%)`, pointerEvents: "none" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.25rem", position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", flex: 1, minWidth: isMobile ? 0 : 250 }}>
                        <div style={{
                            width: isMobile ? 48 : 64, height: isMobile ? 48 : 64, borderRadius: 16,
                            background: T.accentDim, border: `2px solid ${T.accent}30`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: isMobile ? "1.5rem" : "2rem", flexShrink: 0,
                            boxShadow: `0 0 24px ${T.accent}15`,
                        }}>{tone.emoji || "🤖"}</div>
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ margin: 0, fontSize: isMobile ? "1.1rem" : "1.35rem", fontWeight: 800, color: T.text, letterSpacing: "-0.025em" }}>{context.greeting || t("dash.greeting_default")}</h2>
                            <p style={{ margin: "6px 0 0", fontSize: isMobile ? "0.8rem" : "0.9rem", color: T.textSec, lineHeight: 1.65, maxWidth: 440 }}>{tone.message || t("dash.ai_analyzing")}</p>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.75rem" : "1.5rem", flexShrink: 0 }}>
                        <ScoreRing score={overallScore} size={isMobile ? 60 : 82} thickness={isMobile ? 3 : 4.5} label={t("dash.health_label")} />
                        <ScoreRing score={score.overall || 0} size={isMobile ? 60 : 82} thickness={isMobile ? 3 : 4.5} label={t("dash.ai_score")} />
                    </div>
                </div>

                <GlowLine />

                <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "0.25rem", position: "relative", zIndex: 1 }}>
                    <Btn color={T.accent} variant="solid" size={isMobile ? "md" : "lg"} onClick={onAutoDecide} disabled={autoDecideLoading} style={{ flex: 1, minWidth: isMobile ? 0 : 190 }}>
                        {autoDecideLoading ? `⏳ ${t("dash.auto_decide_loading")}` : `✦ ${t("dash.auto_decide")}`}
                    </Btn>
                    <Btn color={T.purple} size={isMobile ? "md" : "lg"} onClick={onDiagnosis} style={{ flex: 1, minWidth: isMobile ? 0 : 190 }}>🩺 {t("dash.diagnosis")}</Btn>
                    {!isMobile && <Btn color={T.yellow} size="lg" onClick={() => onTabChange("advisor")} style={{ flex: 1, minWidth: 190 }}>◇ {t("dash.advisor_btn")}</Btn>}
                </div>
            </Card>

            {/* ═══ KPI STRIP ═══ */}
            <div style={{ display: "flex", gap: isMobile ? "0.5rem" : "0.85rem", flexWrap: "wrap" }}>
                <StatCard icon="💰" label={t("dash.today_revenue")} value={fmt(bh.metrics?.todayRevenue)} color={T.green} />
                <StatCard icon="📦" label={t("dash.total_products")} value={fmtN(brain.productCount || 0)} color={T.blue} />
                <StatCard icon="◆" label={t("dash.pending_recs")} value={recSummary?.pending || 0} color={T.yellow} />
                {!isMobile && <StatCard icon="🏆" label={t("dash.ai_earned")} value={fmt(brain.roi?.totalProfitGenerated || 0)} color={T.accent} />}
                {!isMobile && <StatCard icon="△" label={t("dash.loss_detected")} value={fmt(brain.lossHunter?.totalImpact || 0)} color={T.red} />}
            </div>

            {/* ═══ AUTO DECISIONS ═══ */}
            {autoDecisions && (
                <Card glow>
                    <CardHeader icon="✦" title={t("dash.ai_decisions")} subtitle={t("dash.auto_results")} badge={`${autoDecisions.totalDecisions} ${t("dash.decisions_count")}`} color={T.accent} />
                    <p style={{ fontSize: "0.86rem", color: T.textSec, margin: "0 0 1rem", lineHeight: 1.65 }}>{autoDecisions.summary}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {(autoDecisions.decisions || []).slice(0, 8).map((d, i) => (
                            <div key={i} style={{
                                display: "flex", gap: "0.85rem", padding: isMobile ? "0.75rem" : "1rem",
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                                borderRadius: T.rSm, alignItems: "flex-start",
                            }}>
                                <span style={{ fontSize: "1.2rem", flexShrink: 0 }} aria-hidden="true">{d.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{d.title}</div>
                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{d.description}</div>
                                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                        <Badge color={d.urgency === "critical" ? T.red : T.yellow} size="sm">{d.urgency === "critical" ? t("dash.urgent") : t("dash.high")}</Badge>
                                        <Badge color={T.green} size="sm">{d.impactLabel}</Badge>
                                        <Badge color={T.blue} size="sm">{t("dash.confidence")}: %{d.confidence}</Badge>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ═══ FOCUS ITEMS ═══ */}
            {focus.length > 0 && (
                <Card>
                    <CardHeader icon="◈" title={t("dash.focus_title")} subtitle={t("dash.focus_subtitle")} badge={`${focus.length} ${t("dash.tasks")}`} color={T.accent} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {focus.map((f, i) => (
                            <div key={i} style={{
                                display: "flex", gap: "0.85rem", padding: isMobile ? "0.75rem" : "1rem",
                                background: T.bgGlass, border: `1px solid ${T.border}`,
                                borderRadius: T.rSm, alignItems: "flex-start",
                            }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: "50%",
                                    background: T.accentDim, border: `2px solid ${T.accent}35`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontWeight: 800, fontSize: "0.82rem", color: T.accent, flexShrink: 0,
                                    fontFamily: T.fontMono,
                                }}>{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{f.icon} {f.title}</div>
                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{f.description}</div>
                                    <div style={{ fontSize: "0.78rem", color: T.accent, marginTop: 6, fontWeight: 600 }}>→ {f.action}</div>
                                </div>
                                {!isMobile && <Badge color={f.urgency === "critical" ? T.red : f.urgency === "high" ? T.yellow : T.blue}>{f.impact}</Badge>}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ═══ HEALTH + MONEY ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
                <Card>
                    <CardHeader icon="💎" title={t("dash.biz_health")} subtitle={t("dash.biz_health_sub")} color={T.green} />
                    <HealthBar value={bh.profitHealth || 0} label={`💰 ${t("dash.profitability")}`} color={T.green} />
                    <HealthBar value={bh.stockHealth || 0} label={`📦 ${t("dash.stock_status")}`} color={T.blue} />
                    <HealthBar value={bh.salesHealth || 0} label={`📈 ${t("dash.sales_perf")}`} color={T.yellow} />
                    <HealthBar value={bh.operationsHealth || 0} label={`⚙️ ${t("dash.operations")}`} color={T.purple} />
                </Card>

                <Card>
                    <CardHeader icon="💸" title={t("dash.money_where")} subtitle={t("dash.money_sub")} color={T.green} />
                    <div style={{ display: "flex", gap: "0.85rem", marginBottom: "1rem" }}>
                        <div style={{ flex: 1, borderRadius: T.rSm, padding: isMobile ? "0.75rem" : "1rem", textAlign: "center", background: T.greenDim, border: `1px solid ${T.green}20` }}>
                            <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("dash.net_profit")}</div>
                            <div style={{ fontSize: isMobile ? "1.05rem" : "1.3rem", fontWeight: 800, marginTop: 6, color: T.green, fontFamily: T.fontMono }}>{fmt(money.summary?.netProfit || 0)}</div>
                        </div>
                        <div style={{ flex: 1, borderRadius: T.rSm, padding: isMobile ? "0.75rem" : "1rem", textAlign: "center", background: T.redDim, border: `1px solid ${T.red}20` }}>
                            <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("dash.total_loss")}</div>
                            <div style={{ fontSize: isMobile ? "1.05rem" : "1.3rem", fontWeight: 800, marginTop: 6, color: T.red, fontFamily: T.fontMono }}>{fmt(money.summary?.totalLoss || 0)}</div>
                        </div>
                    </div>
                    {(money.topEarners || []).slice(0, 3).map((p, i) => (
                        <div key={`e${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: T.rSm, background: i === 0 ? T.greenDim : "transparent" }}>
                            <span style={{ color: T.textSec, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>💰 {p.name?.slice(0, 28)}</span>
                            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: T.green, fontFamily: T.fontMono }}>+{fmt(p.totalProfit)}</span>
                        </div>
                    ))}
                    {(money.topLosers || []).slice(0, 3).map((p, i) => (
                        <div key={`l${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: T.rSm, background: i === 0 ? T.redDim : "transparent" }}>
                            <span style={{ color: T.textSec, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>🔴 {p.name?.slice(0, 28)}</span>
                            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: T.red, fontFamily: T.fontMono }}>-{fmt(p.totalLoss)}</span>
                        </div>
                    ))}
                </Card>
            </div>

            {/* ═══ JOURNAL + NOTIFICATIONS + TEACHING ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
                <Card>
                    <CardHeader icon="📅" title={t("dash.daily_report")} subtitle={t("dash.daily_sub")} color={T.blue} />
                    {(journal.problems || []).length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.red, marginBottom: 8 }}>🚨 {t("dash.problems")}</div>
                            {journal.problems.map((p, i) => (
                                <div key={i} style={{ fontSize: "0.8rem", color: T.textSec, padding: "5px 0", lineHeight: 1.65 }}>{p.icon} {p.text}</div>
                            ))}
                        </div>
                    )}
                    {(journal.opportunities || []).length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.green, marginBottom: 8 }}>💡 {t("dash.opportunities")}</div>
                            {journal.opportunities.map((o, i) => (
                                <div key={i} style={{ fontSize: "0.8rem", color: T.textSec, padding: "5px 0", lineHeight: 1.65 }}>{o.icon} {o.text}</div>
                            ))}
                        </div>
                    )}
                    {(journal.actions || []).length > 0 && (
                        <div>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.accent, marginBottom: 8 }}>◈ {t("dash.actions")}</div>
                            {journal.actions.map((a, i) => (
                                <div key={i} style={{ fontSize: "0.8rem", color: T.textSec, padding: "5px 0", lineHeight: 1.65 }}>{a.icon} {a.text}</div>
                            ))}
                        </div>
                    )}
                    {(!journal.problems?.length && !journal.opportunities?.length && !journal.actions?.length) && (
                        <EmptyState icon="📋" title={t("dash.report_preparing")} />
                    )}
                </Card>

                <Card>
                    <CardHeader icon="🔔" title={t("dash.alerts")} subtitle={t("dash.alerts_sub")} badge={notifs.length > 0 ? `${notifs.length}` : undefined} color={T.yellow} />
                    {notifs.length === 0 ? (
                        <EmptyState icon="✅" title={t("dash.all_good")} description={t("dash.no_critical")} />
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {notifs.map((n, i) => (
                                <div key={i} style={{
                                    display: "flex", gap: "0.65rem", padding: "0.8rem 0.9rem",
                                    background: T.bgGlass, borderRadius: T.rSm,
                                    border: `1px solid ${T.border}`, alignItems: "flex-start",
                                }}>
                                    <span style={{ fontSize: "1.05rem", flexShrink: 0 }} aria-hidden="true">{n.icon}</span>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.83rem", color: T.text }}>{n.title}</div>
                                        <div style={{ fontSize: "0.76rem", color: T.textDim, marginTop: 3, lineHeight: 1.55 }}>{n.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <CardHeader icon="🎓" title={t("dash.ai_teaching")} subtitle={t("dash.ai_teaching_sub")} color={T.purple} />
                    {teaching.length === 0 ? (
                        <EmptyState icon="📚" title={t("dash.no_tips")} />
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {teaching.map((tip, i) => (
                                <div key={i} style={{ padding: "0.9rem 1rem", borderRadius: T.rSm, background: T.purpleDim, border: `1px solid ${T.purple}18` }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.83rem", color: T.text }}>{tip.icon} {tip.title}</div>
                                    <div style={{ fontSize: "0.78rem", color: T.textSec, margin: "5px 0", lineHeight: 1.65 }}>{tip.content}</div>
                                    <div style={{ fontSize: "0.76rem", color: T.accent, fontWeight: 600 }}>→ {tip.action}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default React.memo(BrainDashboard);
