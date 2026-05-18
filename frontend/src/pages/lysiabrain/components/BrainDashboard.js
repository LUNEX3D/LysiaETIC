/**
 *
 * LYSIA BRAIN v10  Dashboard Tab  DARK GLASSMORPHISM
 *
 * + i18n support + responsive layout + accessibility
 *
 */
import React, { useState, useEffect } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, StatCard, HealthBar, Badge, Btn, EmptyState, InsightCard } from "./shared/SharedUI";

const shortName = (name, max = 28) => {
    const s = String(name || "—").trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
};

const sevColor = (severity) => {
    if (severity === "critical") return T.red;
    if (severity === "high") return T.orange || T.red;
    if (severity === "medium") return T.yellow;
    return T.accent;
};

const sevLabel = (severity) => {
    if (severity === "critical") return "KRİTİK";
    if (severity === "high") return "YÜKSEK";
    if (severity === "medium") return "ORTA";
    return "BİLGİ";
};

const fmtMaybeMoney = (val) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "string") return val;
    if (typeof val === "number") return fmt(val);
    return String(val);
};

const RedAlertCard = ({ alert, onTabChange, isTablet }) => {
    const [open, setOpen] = useState(alert.severity === "critical");
    const color = sevColor(alert.severity);
    const isCritical = alert.severity === "critical";
    const products = Array.isArray(alert.products) ? alert.products : [];
    const kpis = Array.isArray(alert.kpis) ? alert.kpis : [];
    const breakdown = alert.breakdown || {};
    const hasDetails = products.length > 0 || kpis.length > 0 || Object.keys(breakdown).length > 0;

    const handleCta = () => {
        if (alert.cta?.tab) {
            onTabChange(alert.cta.tab, alert.cta.filter);
        } else {
            onTabChange("recommendations");
        }
    };

    return (
        <Card glow style={{ background: `${color}12`, borderLeft: `4px solid ${color}`, padding: "1.25rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div className={isCritical ? "lysia-pulse-glow" : ""} style={{ width: 44, height: 44, borderRadius: "50%", background: `${color}30`, border: `1px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>{alert.icon || "⚠️"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 900, fontSize: "1rem", color: T.text }}>{alert.headline}</span>
                        <Badge color={color} size="sm">{sevLabel(alert.severity)}</Badge>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: T.textSec, lineHeight: 1.55, marginBottom: "0.75rem" }}>{alert.message}</div>

                    {kpis.length > 0 && (
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                            {kpis.map((k, idx) => (
                                <div key={idx} style={{ background: "rgba(255,255,255,0.04)", padding: "0.45rem 0.75rem", borderRadius: 8, border: `1px solid ${T.border}` }}>
                                    <div style={{ fontSize: "0.6rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
                                    <div style={{ fontSize: "0.9rem", color: T.text, fontWeight: 800 }}>{fmtMaybeMoney(k.value)}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <Btn color={color} size="sm" onClick={handleCta}>{alert.cta?.label || alert.action || "Aksiyon Al"}</Btn>
                        {hasDetails && (
                            <Btn size="sm" variant="outline" onClick={() => setOpen(o => !o)}>
                                {open ? "▲ Detayı Gizle" : `▼ Detayları Göster${products.length ? ` (${products.length} ürün)` : ""}`}
                            </Btn>
                        )}
                    </div>
                </div>

                {alert.amount > 0 && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "0.55rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase" }}>{alert.amountLabel || "Etki"}</div>
                        <Badge color={color}>{fmt(alert.amount)}</Badge>
                    </div>
                )}
            </div>

            {open && hasDetails && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${T.border}` }}>
                    {products.length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                            <div style={{ fontSize: "0.65rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                                Etkilenen Ürünler ({products.length})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 320, overflowY: "auto" }}>
                                {products.map((p, idx) => {
                                    // "Henüz satılmadı" / "yeni ürün" durumu
                                    let salesInfo = null;
                                    if (p.isNewProduct) {
                                        salesInfo = { color: T.blue, label: p.productAgeDays != null ? `Yeni ürün · ${p.productAgeDays} gün önce eklendi` : "Yeni ürün · Henüz satış yok" };
                                    } else if (p.daysSinceLastSale === null || p.daysSinceLastSale === undefined) {
                                        salesInfo = { color: T.textMuted, label: "Henüz satış kaydı yok" };
                                    } else if (p.daysIdle != null) {
                                        salesInfo = { color: T.textMuted, label: `${p.daysIdle} gün durgun` };
                                    }
                                    return (
                                        <div key={p.barcode || idx} style={{
                                            display: "grid",
                                            gridTemplateColumns: isTablet ? "1fr" : "minmax(0, 1.7fr) repeat(3, minmax(0, 1fr))",
                                            gap: "0.5rem",
                                            padding: "0.6rem 0.75rem",
                                            background: "rgba(255,255,255,0.025)",
                                            borderRadius: 6,
                                            border: `1px solid ${T.border}`,
                                            alignItems: "center",
                                        }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                                    <span style={{ fontSize: "0.8rem", color: T.text, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }} title={p.name}>{p.name}</span>
                                                    {p.isNewProduct && (
                                                        <span style={{ fontSize: "0.55rem", padding: "1px 6px", borderRadius: 3, background: `${T.blue}25`, color: T.blue, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>YENİ</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: "0.65rem", color: T.textMuted, marginTop: 2 }}>
                                                    {p.barcode ? `${p.barcode} · ` : ""}{p.marketplaces || "—"}{p.category ? ` · ${p.category}` : ""}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: "0.7rem", color: T.textSec }}>
                                                <span style={{ color: T.textMuted }}>Stok:</span> <b style={{ color: p.stock === 0 ? T.red : T.text }}>{p.stock ?? "—"}</b>
                                                {p.status ? <div style={{ fontSize: "0.65rem", color: T.textMuted }}>{p.status}</div> : null}
                                            </div>
                                            <div style={{ fontSize: "0.7rem", color: T.textSec }}>
                                                <span style={{ color: T.textMuted }}>Fiyat:</span> <b style={{ color: T.text }}>{fmt(p.price)}</b>
                                                {p.profit !== undefined && p.profit !== null ? (
                                                    <div style={{ fontSize: "0.65rem", color: p.profit < 0 ? T.red : T.green }}>
                                                        Birim kâr: {fmt(p.profit)}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div style={{ fontSize: "0.7rem", color: T.textSec, minWidth: 0 }}>
                                                {p.suggestion ? (
                                                    <div style={{ color: T.accent, fontWeight: 700 }} title={p.suggestion}>{p.suggestion}</div>
                                                ) : null}
                                                {p.projectedLoss ? <div style={{ color: T.red }}>Risk: {fmt(p.projectedLoss)}</div> : null}
                                                {p.capitalLocked ? <div style={{ color: T.yellow }}>Bağlı: {fmt(p.capitalLocked)}</div> : null}
                                                {salesInfo ? <div style={{ color: salesInfo.color }}>{salesInfo.label}</div> : null}
                                                {p.returnRate ? <div style={{ color: T.orange || T.red }}>İade: %{p.returnRate}</div> : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {(breakdown.byMarketplace?.length > 0 || breakdown.byCategory?.length > 0 || breakdown.byMarketplaceDrops?.length > 0) && (
                        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: "0.75rem" }}>
                            {breakdown.byMarketplace?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.6rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Pazaryeri Dağılımı</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {breakdown.byMarketplace.map((b, i) => (
                                            <span key={i} style={{ fontSize: "0.7rem", color: T.text, background: `${T.accent}15`, border: `1px solid ${T.accent}40`, padding: "2px 8px", borderRadius: 4 }}>
                                                {b.label} <b>{b.count}</b>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {breakdown.byCategory?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.6rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Kategori Dağılımı</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {breakdown.byCategory.map((b, i) => (
                                            <span key={i} style={{ fontSize: "0.7rem", color: T.text, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 4 }}>
                                                {b.label} <b>{b.count}</b>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {breakdown.byMarketplaceDrops?.length > 0 && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div style={{ fontSize: "0.6rem", color: T.textMuted, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Pazaryeri Bazında Düşüş</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {breakdown.byMarketplaceDrops.map((b, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", padding: "3px 6px", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>
                                                <span style={{ color: T.text }}>{b.label}</span>
                                                <span style={{ color: T.textMuted }}>Bugün: <b style={{ color: T.text }}>{fmt(b.today)}</b> · Ort: <b style={{ color: T.text }}>{fmt(b.dailyAvg)}</b> · <span style={{ color: T.red }}>-{fmt(b.gap)}</span></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

const BrainDashboard = ({
    brain,
    recSummary,
    onTabChange,
    onAutoDecide,
    onDiagnosis,
    autoDecideLoading,
    diagnosisLoading = false,
    autoDecisions,
    t,
}) => {
    const { isMobile, isTablet } = useResponsive();
    const [autonomyStatus, setAutonomyStatus] = useState(null);

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

    if (!brain) return <EmptyState icon="🧠" title={t("common.loading")} description="PazarYonet AI" />;

    const bh = brain.businessHealth || {};
    const tone = brain.emotionalTone || {};
    const money = brain.moneyTracker || {};
    const moneySummary = money.summary || {};
    const redAlerts = brain.redAlerts || {};
    const thoughtProcess = brain.thoughtProcess || {};
    const overallScore = bh.overallScore || 0;
    const roi = brain.roi || {};
    const lossHunter = brain.lossHunter || {};

    const todayRev = moneySummary.todayRevenue ?? bh.metrics?.todayRevenue ?? 0;
    const aiEarned = roi.totalProfitGenerated ?? 0;
    const lossExposure = lossHunter.totalImpact ?? moneySummary.totalLoss ?? bh.metrics?.totalLoss ?? 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "1.5rem" : "2.5rem", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>

            {/* AI Mode Strip — En üstte: AI'ın şu an hangi yetki ile çalıştığını göster */}
            {autonomyStatus && (
                <div className="lysia-anim-fade" style={{
                    display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
                    padding: "10px 16px",
                    background: autonomyStatus.mode === "autonomous" ? `${T.red}08` : autonomyStatus.mode === "supervised" ? `${T.yellow}08` : `${T.green}08`,
                    border: `1px solid ${autonomyStatus.mode === "autonomous" ? T.red : autonomyStatus.mode === "supervised" ? T.yellow : T.green}30`,
                    borderRadius: T.rSm, fontSize: T.fz.sm,
                }}>
                    <span style={{ fontSize: "1.1rem" }}>
                        {autonomyStatus.mode === "autonomous" ? "🤖" : autonomyStatus.mode === "supervised" ? "👁️" : "✋"}
                    </span>
                    <span style={{ color: T.textDim }}>AI Modu:</span>
                    <b style={{ color: autonomyStatus.mode === "autonomous" ? T.red : autonomyStatus.mode === "supervised" ? T.yellow : T.green }}>
                        {autonomyStatus.mode === "autonomous" ? "Tam Otonom" : autonomyStatus.mode === "supervised" ? "Denetimli" : "Manuel"}
                    </b>
                    {autonomyStatus.withinWorkHours === false && (
                        <Badge color={T.red} size="sm">⏰ Saat dışı</Badge>
                    )}
                    <span style={{ marginLeft: "auto", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ color: T.textDim }}>Bu saat: <b style={{ color: T.cyan, fontFamily: T.fontMono }}>{autonomyStatus.rateLimit?.hourly || 0}/{autonomyStatus.rateLimit?.limit || 50}</b></span>
                        <span style={{ color: T.textDim }}>Bugün: <b style={{ color: T.purple, fontFamily: T.fontMono }}>{autonomyStatus.rateLimit?.daily || 0}</b></span>
                        <Btn size="sm" variant="ghost" onClick={() => onTabChange?.("autonomy")}>🎛️ Kurallar</Btn>
                    </span>
                </div>
            )}

            {/*  AI THOUGHT PROCESS (REAL-TIME AGENT FEEL)  */}
            {thoughtProcess.steps?.length > 0 && (
                <section>
                    <Card style={{
                        background: `${T.bgCard}dd`,
                        border: `1px solid ${T.accent}30`,
                        overflow: "hidden",
                        padding: "1.25rem 1.5rem",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: thoughtProcess.agentStatus === "busy" ? T.yellow : T.green,
                                    boxShadow: `0 0 10px ${thoughtProcess.agentStatus === "busy" ? T.yellow : T.green}`,
                                }} />
                                <h2 style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textDim, margin: 0 }}>
                                    Neural Processing: {thoughtProcess.summary || "—"}
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
                                    gap: "0.5rem",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontSize: "1.1rem" }}>{step.icon || "◆"}</span>
                                        <span style={{ fontWeight: 800, fontSize: "0.8rem", color: step.status === "warning" ? T.red : T.text }}>{step.title}</span>
                                    </div>
                                    <div style={{ fontSize: "0.7rem", color: T.textSec, lineHeight: 1.4 }}>{step.content}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </section>
            )}

            {/*  AI COMMAND CENTER (HERO)  */}
            <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: "1.5rem" }}>
                <Card glow animate={true} style={{
                    background: `radial-gradient(circle at 10% 10%, ${T.accent}15, transparent 45%), radial-gradient(circle at 90% 90%, ${T.accentAlt}10, transparent 40%), ${T.bgCard}`,
                    padding: isMobile ? "1.5rem" : "2rem",
                    border: `1px solid ${T.borderGlow}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                        <Badge color={T.accent} size="lg" pulse>● AI ONLINE</Badge>
                        <span style={{ fontSize: T.fz.xs, color: T.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>VER. 10.4.5</span>
                    </div>
                    <h1 className="lysia-text-gradient" style={{
                        margin: 0,
                        fontSize: isMobile ? T.fz.h2 : T.fz.h1,
                        fontWeight: 900,
                        letterSpacing: "-0.04em",
                        lineHeight: 1.15,
                        marginBottom: "1rem",
                    }}>
                        {brain.context?.greeting || t("dash.greeting_default")}
                    </h1>
                    <p style={{
                        fontSize: T.fz.base,
                        color: T.textSec,
                        lineHeight: 1.65,
                        maxWidth: 540,
                        margin: 0,
                    }}>
                        {tone.message || t("dash.ai_analyzing")}
                    </p>

                    <div style={{ display: "flex", gap: "0.85rem", marginTop: "2rem", flexWrap: "wrap" }}>
                        <Btn variant="solid" onClick={onAutoDecide} loading={autoDecideLoading}>{t("dash.auto_decide")}</Btn>
                        <Btn variant="outline" onClick={() => onTabChange("recommendations")}>{t("tab.recommendations")}</Btn>
                        <Btn variant="ghost" onClick={onDiagnosis} loading={diagnosisLoading}>{t("dash.diagnosis")}</Btn>
                    </div>
                </Card>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <InsightCard
                        icon="💵"
                        title={t("dash.today_revenue")}
                        value={fmt(todayRev)}
                        trend={bh.metrics?.revenueTrend}
                        onClick={() => onTabChange("predictions")}
                    />
                    <InsightCard
                        icon="🤖"
                        title={t("dash.ai_earned")}
                        value={fmt(aiEarned)}
                        status="success"
                        onClick={() => onTabChange("roi")}
                    />
                    <InsightCard
                        icon="📉"
                        title={t("dash.loss_detected")}
                        value={fmt(lossExposure)}
                        status="danger"
                        onClick={() => onTabChange("losses")}
                    />
                    <InsightCard
                        icon="📋"
                        title={t("dash.pending_recs")}
                        value={recSummary.pending || 0}
                        status="warning"
                        onClick={() => onTabChange("recommendations")}
                    />
                </div>
            </section>

            {/*  CRITICAL ALERTS (RICH PRODUCT-LEVEL DETAILS)  */}
            {redAlerts.hasAlerts && (
                <section>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "1.25rem" }} aria-hidden="true">🚨</span>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: T.red }}>{t("dash.immediate_actions")}</h2>
                        {redAlerts.criticalCount > 0 && (
                            <Badge color={T.red} size="sm">{redAlerts.criticalCount} kritik</Badge>
                        )}
                        {redAlerts.totalAlertImpact > 0 && (
                            <span style={{ fontSize: "0.7rem", color: T.textMuted }}>
                                Toplam etki: <b style={{ color: T.red }}>{fmt(redAlerts.totalAlertImpact)}</b>
                            </span>
                        )}
                    </div>
                    <div className="lysia-anim-stagger" style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                        {(redAlerts.alerts || []).map((alert, i) => (
                            <RedAlertCard key={`${alert.type}-${i}`} alert={alert} onTabChange={onTabChange} isTablet={isTablet} />
                        ))}
                    </div>
                </section>
            )}

            {/*  CORE METRICS  */}
            <section className="lysia-anim-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <StatCard icon="💵" label={t("dash.today_revenue")} value={fmt(bh.metrics?.todayRevenue)} color={T.accent} trend={bh.metrics?.revenueTrend} />
                <StatCard icon="💚" label={t("dash.net_profit")} value={fmt(moneySummary.netProfit || 0)} color={T.green} />
                <StatCard icon="🔻" label={t("dash.total_loss")} value={fmt(moneySummary.totalLoss || 0)} color={T.red} />
                <StatCard icon="📋" label={t("dash.pending_recs")} value={recSummary?.pending || 0} color={T.purple} />
                <StatCard icon="📊" label={t("dash.brain_overall_score")} value={`${overallScore}%`} color={overallScore > 70 ? T.green : T.yellow} />
            </section>

            {/*  INTELLIGENCE GRID  */}
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "2fr 1.2fr", gap: "2rem" }}>

                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {autoDecisions?.decisions?.length > 0 ? (
                        <Card glow>
                            <CardHeader icon="🎯" title={t("dash.ai_decisions")} subtitle={autoDecisions.summary} badge={`${autoDecisions.totalDecisions}`} color={T.accent} />
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                                {(autoDecisions.decisions || []).slice(0, 6).map((d, i) => (
                                    <div key={i} style={{ padding: "1rem", background: T.bgGlass, borderRadius: T.rSm, border: `1px solid ${T.border}` }}>
                                        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                            <span style={{ fontSize: "1.1rem" }}>{d.icon || "◆"}</span>
                                            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: T.text }}>{d.title}</span>
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: T.textDim, lineHeight: 1.5, marginBottom: "0.75rem" }}>{d.description}</div>
                                        <Badge color={T.green} size="sm">{d.impactLabel || d.impact || "—"}</Badge>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader icon="🧭" title={t("dash.strategic_block_title")} subtitle={t("dash.strategic_block_sub")} color={T.accent} />
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {(brain.focusItems || []).length === 0 ? (
                                    <p style={{ margin: 0, fontSize: "0.88rem", color: T.textSec }}>{t("dash.all_good")}</p>
                                ) : (
                                    (brain.focusItems || []).slice(0, 4).map((f, i) => (
                                        <div key={i} style={{ display: "flex", gap: "1.25rem", padding: "1.25rem", background: T.bgGlass, borderRadius: T.rSm, border: `1px solid ${T.border}`, alignItems: "center" }}>
                                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>{f.icon || "▸"}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: T.text }}>{f.title}</div>
                                                <div style={{ fontSize: "0.82rem", color: T.textSec, marginTop: 2 }}>{f.description}</div>
                                                {f.impact && <div style={{ fontSize: "0.75rem", color: T.accent, fontWeight: 700, marginTop: 4 }}>Etki: {f.impact}</div>}
                                            </div>
                                            <Btn size="sm" color={T.accent} variant="ghost" onClick={() => onTabChange(f.category === "stock" ? "recommendations" : "losses")}>Detaylar</Btn>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    <Card>
                        <CardHeader icon="🏥" title={t("dash.operational_health")} color={T.green} />
                        <HealthBar value={bh.profitHealth || 0} label={t("dash.profitability")} color={T.green} />
                        <HealthBar value={bh.stockHealth || 0} label={t("dash.stock_status")} color={T.blue} />
                        <HealthBar value={bh.salesHealth || 0} label={t("dash.sales_perf")} color={T.yellow} />
                        <HealthBar value={bh.operationsHealth || 0} label={t("dash.operations")} color={T.purple} />
                    </Card>

                    <Card>
                        <CardHeader icon="🏆" title={t("dash.top_contributors")} color={T.accent} />
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {(money.topEarners || []).slice(0, 3).map((p, i) => (
                                <div key={`e-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(52,211,153,0.06)", borderRadius: T.rSm }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textSec }}>{shortName(p.name)}</span>
                                    <span style={{ fontWeight: 800, color: T.green }}>+{fmt(p.totalProfit)}</span>
                                </div>
                            ))}
                            {(money.topLosers || []).slice(0, 3).map((p, i) => (
                                <div key={`l-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(248,113,113,0.06)", borderRadius: T.rSm }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: T.textSec }}>{shortName(p.name)}</span>
                                    <span style={{ fontWeight: 800, color: T.red }}>-{fmt(p.totalLoss)}</span>
                                </div>
                            ))}
                            {(money.topEarners || []).length === 0 && (money.topLosers || []).length === 0 && (
                                <p style={{ margin: 0, fontSize: "0.82rem", color: T.textSec }}>{t("common.no_data")}</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BrainDashboard);
