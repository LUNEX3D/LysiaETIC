/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Hedefler Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * Goal management: create, track progress, daily targets
 * Uses: POST /goals, GET /goals
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, HealthBar, EmptyState, LoadingState, ErrorState, Input, PageHeader } from "./shared/SharedUI";

const GOAL_TYPES = [
    { id: "revenue", icon: "💰", color: T.green },
    { id: "sales", icon: "📦", color: T.blue },
    { id: "profit", icon: "📈", color: T.accent },
];

const STATUS_CFG = {
    active: { color: T.accent, icon: "🎯" },
    completed: { color: T.green, icon: "🏆" },
    failed: { color: T.red, icon: "❌" },
};

const BrainGoals = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [goals, setGoals] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Create form
    const [form, setForm] = useState({ title: "", goalType: "revenue", targetValue: "", endDate: "", description: "" });

    const loadGoals = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const res = await API.get("/ai-engine/goals");
            if (res.data && res.data.success !== false) setGoals(res.data.goals || []);
            else setError(res.data.message || t("error.data_load_fail"));
        } catch (e) { setError(e.response?.data?.message || t("error.data_load_fail")); }
        finally { setLoading(false); }
    }, [t]);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    const handleCreate = async () => {
        if (!form.title.trim() || !form.targetValue || !form.endDate) return;
        setCreating(true);
        try {
            const res = await API.post("/ai-engine/goals", {
                title: form.title.trim(),
                goalType: form.goalType,
                targetValue: Number(form.targetValue),
                endDate: form.endDate,
                description: form.description,
            });
            if (res.data && res.data.success !== false) {
                setGoals(prev => [res.data.goal, ...prev]);
                setShowCreate(false);
                setForm({ title: "", goalType: "revenue", targetValue: "", endDate: "", description: "" });
            }
        } catch (e) { onError?.(e.response?.data?.message || t("error.goal_fail")); }
        finally { setCreating(false); }
    };

    const fmtGoalValue = (goal) => {
        if (goal.goalType === "sales") return fmtN(goal.currentValue || 0);
        return fmt(goal.currentValue || 0);
    };
    const fmtGoalTarget = (goal) => {
        if (goal.goalType === "sales") return fmtN(goal.targetValue || 0);
        return fmt(goal.targetValue || 0);
    };

    if (loading) return <LoadingState message={t("loading.goals")} />;
    if (error && goals.length === 0) return <ErrorState message={error} onRetry={loadGoals} />;

    const activeGoals = goals.filter(g => g.status === "active" || !g.status);
    const completedGoals = goals.filter(g => g.status === "completed" || g.status === "failed");
    const completedCount = goals.filter(g => g.status === "completed").length;
    const failedCount = goals.filter(g => g.status === "failed").length;
    const tldrGoals = (() => {
        if (goals.length === 0) return "Henüz hedef tanımlamadın. AI'nın seni neye odaklayacağını söyleyebilmesi için en az 1 hedef (örn. 'Bu ay 100.000₺ gelir') oluşturalım.";
        if (activeGoals.length === 0) return `Tüm hedefler kapandı (${completedCount} başarılı, ${failedCount} başarısız). Yeni hedef ekleyerek AI'ı yönlendirebilirsin.`;
        const closest = activeGoals.slice().sort((a, b) => {
            const pa = (a.currentValue || 0) / (a.targetValue || 1);
            const pb = (b.currentValue || 0) / (b.targetValue || 1);
            return pb - pa;
        })[0];
        const pct = Math.round(((closest.currentValue || 0) / (closest.targetValue || 1)) * 100);
        return `${activeGoals.length} aktif hedef takip ediliyor. En yakın olanı: "${closest.title}" (%${pct}).`;
    })();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <PageHeader
                icon="🎯"
                title={t("goal.title") || "Hedeflerim"}
                subtitle={t("goal.subtitle") || "AI'a yön ver: gelir, satış, kâr hedefleri"}
                tldr={tldrGoals}
                status={activeGoals.length > 0 ? "good" : "info"}
                kpis={[
                    { label: "Aktif", value: activeGoals.length, color: T.accent },
                    { label: "Tamamlanan", value: completedCount, color: T.green },
                    { label: "Başarısız", value: failedCount, color: T.red },
                ]}
                actions={
                    <Btn color={T.accent} onClick={() => setShowCreate(p => !p)}>
                        {showCreate ? "✕" : "+"} {t("goal.create") || "Hedef Ekle"}
                    </Btn>
                }
            />

            {/* Create Form — sadece açıkken render */}
            {showCreate && (
                <Card>
                    <CardHeader icon="➕" title={t("goal.create") || "Yeni Hedef"} subtitle={t("goal.create_sub") || "AI'ya odaklanacağı yönü göster"} color={T.accent} />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("goal.name")} />
                        <Input value={form.targetValue} onChange={e => setForm(p => ({ ...p, targetValue: e.target.value }))} placeholder={t("goal.target")} type="number" />
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            {GOAL_TYPES.map(gt => (
                                <button key={gt.id} onClick={() => setForm(p => ({ ...p, goalType: gt.id }))}
                                    style={{
                                        flex: 1, padding: "8px", borderRadius: T.rSm, cursor: "pointer",
                                        background: form.goalType === gt.id ? `${gt.color}15` : T.bgGlass,
                                        border: `1px solid ${form.goalType === gt.id ? gt.color + "35" : T.border}`,
                                        color: form.goalType === gt.id ? gt.color : T.textDim,
                                        fontSize: "0.78rem", fontWeight: 600, fontFamily: "inherit",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                    }}>
                                    {gt.icon} {t(`goal.type.${gt.id}`)}
                                </button>
                            ))}
                        </div>
                        <Input value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} placeholder={t("goal.end_date")} type="date" />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Btn color={T.accent} variant="solid" onClick={handleCreate} disabled={creating || !form.title.trim() || !form.targetValue || !form.endDate}>
                            {creating ? "⏳" : "✓"} {t("goal.save")}
                        </Btn>
                        <Btn color={T.textDim} variant="ghost" onClick={() => setShowCreate(false)}>{t("goal.cancel")}</Btn>
                    </div>
                </Card>
            )}

            {/* ═══ Active Goals ═══ */}
            {activeGoals.length === 0 && completedGoals.length === 0 && (
                <Card>
                    <EmptyState icon="🎯" title={t("goal.no_goals")} description={t("goal.no_goals_desc")} />
                </Card>
            )}

            {activeGoals.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
                    {activeGoals.map((goal) => {
                        const gt = GOAL_TYPES.find(g => g.id === goal.goalType) || GOAL_TYPES[0];
                        const pct = Math.min(goal.progressPercent || 0, 100);
                        const daysLeft = goal.endDate ? Math.max(0, Math.ceil((new Date(goal.endDate) - Date.now()) / 86400000)) : 0;
                        return (
                            <Card key={goal._id}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: T.rSm,
                                        background: `${gt.color}12`, border: `1px solid ${gt.color}20`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.4rem", flexShrink: 0,
                                    }}>{gt.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{goal.title}</div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                            <Badge color={gt.color} size="sm">{t(`goal.type.${goal.goalType}`)}</Badge>
                                            {daysLeft > 0 && <Badge color={daysLeft < 7 ? T.red : T.textDim} size="sm">{daysLeft} gün</Badge>}
                                        </div>
                                    </div>
                                </div>

                                <HealthBar value={pct} label={`${t("goal.progress")}: ${fmtGoalValue(goal)} / ${fmtGoalTarget(goal)}`} color={gt.color} />

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: T.textDim }}>
                                        {t("goal.daily_target")}: <span style={{ color: gt.color, fontWeight: 700, fontFamily: T.fontMono }}>{goal.goalType === "sales" ? fmtN(goal.dailyTarget || 0) : fmt(goal.dailyTarget || 0)}</span>
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: T.textDim }}>
                                        {t("goal.remaining")}: <span style={{ color: T.text, fontWeight: 700, fontFamily: T.fontMono }}>{goal.goalType === "sales" ? fmtN(Math.max(0, (goal.targetValue || 0) - (goal.currentValue || 0))) : fmt(Math.max(0, (goal.targetValue || 0) - (goal.currentValue || 0)))}</span>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ═══ Completed Goals ═══ */}
            {completedGoals.length > 0 && (
                <Card>
                    <CardHeader icon="📜" title="Tamamlanan Hedefler" badge={`${completedGoals.length}`} color={T.textDim} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {completedGoals.map((goal) => {
                            const sc = STATUS_CFG[goal.status] || STATUS_CFG.active;
                            return (
                                <div key={goal._id} style={{
                                    display: "flex", alignItems: "center", gap: "0.75rem",
                                    padding: "0.75rem 1rem", borderRadius: T.rSm,
                                    background: goal.status === "completed" ? T.greenDim : T.redDim,
                                    border: `1px solid ${sc.color}18`,
                                }}>
                                    <span style={{ fontSize: "1.1rem" }}>{sc.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: T.text }}>{goal.title}</span>
                                    </div>
                                    <Badge color={sc.color} size="sm">{t(`goal.status.${goal.status}`)}</Badge>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainGoals);
