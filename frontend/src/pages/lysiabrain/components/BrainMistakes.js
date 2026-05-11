/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Hata Tespiti Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * + i18n + responsive + error handling
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, LoadingState, ErrorState, GlowLine, IconBox, PageHeader } from "./shared/SharedUI";

const BrainMistakes = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const GRADE = {
        A: { color: T.green, dim: T.greenDim, emoji: "🏆", label: t("mis.grade.A"), desc: t("mis.grade.A_desc") },
        B: { color: T.blue, dim: T.blueDim, emoji: "👍", label: t("mis.grade.B"), desc: t("mis.grade.B_desc") },
        C: { color: T.yellow, dim: T.yellowDim, emoji: "⚠️", label: t("mis.grade.C"), desc: t("mis.grade.C_desc") },
        D: { color: T.red, dim: T.redDim, emoji: "🚨", label: t("mis.grade.D"), desc: t("mis.grade.D_desc") },
    };

    const load = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const res = await API.get("/ai-engine/advisor/mistakes");
            if (res.data && res.data.success !== false) setData(res.data.mistakes);
            else setError(res.data.message || t("error.data_load_fail"));
        } catch (e) { setError(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <LoadingState message={t("loading.mistakes")} />;
    if (error || !data) return <ErrorState message={error || t("error.data_load_fail")} onRetry={load} retryLabel={t("header.refresh")} />;

    const overallLetter = data.summary?.overallGrade;
    const gradeBand = GRADE[overallLetter] || GRADE.C;

    const renderSection = (title, icon, items, sectionColor, sectionDim) => {
        if (!items || items.length === 0) return null;
        return (
            <Card>
                <CardHeader icon={icon} title={title} badge={`${items.length}`} color={sectionColor} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {items.map((item, i) => (
                        <div key={i} style={{
                            display: "flex", gap: "0.85rem", padding: isMobile ? "0.75rem" : "1rem 1.1rem",
                            background: sectionDim, borderLeft: `3px solid ${sectionColor}`,
                            borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, alignItems: "flex-start",
                        }}>
                            <span style={{ fontSize: "1.2rem", flexShrink: 0 }} aria-hidden="true">{item.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text }}>{item.title}</div>
                                <div style={{ fontSize: "0.83rem", color: T.textSec, marginTop: 5, lineHeight: 1.65 }}>{item.detail}</div>
                                {item.fix && <div style={{ fontSize: "0.78rem", color: T.accent, marginTop: 7, fontWeight: 600 }}>💊 {item.fix}</div>}
                                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                    {item.count > 0 && <Badge color={sectionColor} size="sm">{item.count} {t("mis.products")}</Badge>}
                                    {item.impact > 0 && <Badge color={T.red} size="sm">{t("mis.impact")}: {fmt(item.impact)}</Badge>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        );
    };

    const totalImpact = data.summary?.totalImpact || 0;
    const tldrMistakes = (() => {
        const crit = data.summary?.criticalCount || 0;
        const grade = overallLetter || "—";
        if (crit > 0) return `Genel notun: ${grade}. ${crit} KRİTİK hata tespit edildi (tahmini etki: ${fmt(totalImpact)}). Aşağıdaki listede 'kritik' bölümünden başla.`;
        if (grade === "A") return `Genel notun: A 🏆 — operasyonun son derece sağlıklı. Sadece minor iyileştirme alanları kaldı.`;
        return `Genel notun: ${grade}. Tahmini etki: ${fmt(totalImpact)}. İyileştirme alanları aşağıda detaylı listede.`;
    })();
    const headerStatus = (data.summary?.criticalCount || 0) > 0 ? "danger" : overallLetter === "A" ? "good" : "warning";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="△"
                title={t("mis.title") || "Hata Tespiti"}
                subtitle={t("mis.subtitle") || "AI'nın bulduğu operasyonel hatalar ve iyileştirme önerileri"}
                tldr={tldrMistakes}
                status={headerStatus}
                kpis={[
                    { label: "Genel Not", value: overallLetter || "—", color: gradeBand.color },
                    { label: "Kritik", value: data.summary?.criticalCount || 0, color: T.red },
                    { label: "Uyarı", value: data.summary?.warningCount || 0, color: T.yellow },
                    { label: "İyileştirme", value: data.summary?.improvementCount || 0, color: T.blue },
                    { label: "Olumlu", value: data.summary?.positiveCount || 0, color: T.green },
                    { label: "Tahmini Etki", value: fmt(totalImpact), color: T.red, hint: "Düzeltilmezse toplam kayıp" },
                ]}
            />

            {/* Grade hero */}
            <Card glow style={{ background: gradeBand.dim, borderColor: `${gradeBand.color}30` }}>
                <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "1rem" : "1.5rem", flexWrap: "wrap" }}>
                    <div style={{
                        width: isMobile ? 64 : 88, height: isMobile ? 64 : 88, borderRadius: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: isMobile ? "1.8rem" : "2.5rem", flexShrink: 0,
                        background: T.bgGlass, border: `2px solid ${gradeBand.color}30`,
                        boxShadow: `0 0 24px ${gradeBand.color}15`,
                    }}>{gradeBand.emoji}</div>
                    <div style={{ flex: 1, minWidth: isMobile ? 0 : 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
                            <span style={{
                                fontSize: isMobile ? "1.3rem" : "1.75rem", fontWeight: 900, letterSpacing: "-0.025em",
                                background: `linear-gradient(135deg, ${gradeBand.color}, ${gradeBand.color}99)`,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            }}>{t("mis.grade_label")}: {overallLetter ?? "—"}</span>
                            <Badge color={gradeBand.color} size="lg">{gradeBand.label}</Badge>
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: isMobile ? "0.82rem" : "0.92rem", color: T.textSec, lineHeight: 1.65 }}>{gradeBand.desc}</p>
                    </div>
                    {!isMobile && (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", flexShrink: 0 }}>
                            {data.summary?.criticalCount > 0 && <Badge color={T.red}>🔴 {data.summary.criticalCount} {t("dash.critical")}</Badge>}
                            {data.summary?.warningCount > 0 && <Badge color={T.yellow}>🟡 {data.summary.warningCount}</Badge>}
                            {data.summary?.improvementCount > 0 && <Badge color={T.blue}>💡 {data.summary.improvementCount}</Badge>}
                            {data.summary?.positiveCount > 0 && <Badge color={T.green}>✅ {data.summary.positiveCount}</Badge>}
                        </div>
                    )}
                </div>

                {data.summary?.totalImpact > 0 && (
                    <>
                        <GlowLine color={gradeBand.color} />
                        <div style={{
                            padding: "1rem 1.15rem", borderRadius: T.rSm,
                            display: "flex", alignItems: "center", gap: "0.7rem",
                            background: T.bgGlass, border: `1px solid ${T.red}20`,
                        }}>
                            <IconBox icon="💸" color={T.red} size={42} />
                            <div>
                                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: T.red }}>{t("mis.total_impact")}: {fmt(data.summary.totalImpact)}</span>
                                <span style={{ fontSize: "0.78rem", color: T.textDim, display: "block", marginTop: 4 }}>{t("mis.impact_desc")}</span>
                            </div>
                        </div>
                    </>
                )}
            </Card>

            {renderSection(t("mis.critical_title"), "🔴", data.critical, T.red, T.redDim)}
            {renderSection(t("mis.warnings_title"), "🟡", data.warnings, T.yellow, T.yellowDim)}
            {renderSection(t("mis.improvements_title"), "💡", data.improvements, T.blue, T.blueDim)}

            {data.positives?.length > 0 && (
                <Card>
                    <CardHeader icon="✅" title={t("mis.positives_title")} subtitle={t("mis.positives_sub")} badge={`${data.positives.length}`} color={T.green} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {data.positives.map((item, i) => (
                            <div key={i} style={{
                                display: "flex", gap: "0.7rem", padding: "0.9rem 1rem",
                                borderRadius: T.rSm, alignItems: "center",
                                background: T.greenDim, border: `1px solid ${T.green}18`,
                            }}>
                                <span style={{ fontSize: "1.15rem", flexShrink: 0 }} aria-hidden="true">{item.icon}</span>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: "0.86rem", color: T.green }}>{item.title}</span>
                                    <span style={{ fontSize: "0.78rem", color: T.textDim, display: "block", marginTop: 4 }}>{item.detail}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainMistakes);
