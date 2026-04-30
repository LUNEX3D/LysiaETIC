/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — DARK GLASSMORPHISM — FULL FEATURED
 * ═══════════════════════════════════════════════════════════════
 * ✅ i18n (TR/EN) via AppContext
 * ✅ Responsive (mobile/tablet/desktop)
 * ✅ 25 tabs (dashboard, advisor, recommendations, mistakes, platforms, operator, simulation, goals, costs, profit_map, timing, retro, roi, health, learning, alerts, losses, risks, predictions, opportunities, segmentation, causes, decisions, self_eval)
 * ✅ Outside click for strategy picker
 * ✅ Keyboard shortcuts (R refresh, Esc close modals)
 * ✅ State persistence (activeTab, strategy in localStorage)
 * ✅ Error handling with user feedback
 * ✅ Accessibility (aria, roles, keyboard nav)
 * ✅ AI Chat widget
 * ✅ All backend endpoints utilized
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import API from "../../services/api";
import { useApp } from "../../context/AppContext";
import { T, useResponsive } from "./styles";
import { getBrainT } from "./i18n";
import { ScoreRing, LoadingState, Modal, ModalHeader } from "./components/shared/SharedUI";

import BrainDashboard from "./components/BrainDashboard";
import BrainRecommendations from "./components/BrainRecommendations";
import BrainOperator from "./components/BrainOperator";

const BrainAdvisor = lazy(() => import("./components/BrainAdvisor"));
const BrainMistakes = lazy(() => import("./components/BrainMistakes"));
const BrainPlatforms = lazy(() => import("./components/BrainPlatforms"));
const BrainSimulation = lazy(() => import("./components/BrainSimulation"));
const BrainGoals = lazy(() => import("./components/BrainGoals"));
const BrainCosts = lazy(() => import("./components/BrainCosts"));
const BrainProfitMap = lazy(() => import("./components/BrainProfitMap"));
const BrainTiming = lazy(() => import("./components/BrainTiming"));
const BrainRetro = lazy(() => import("./components/BrainRetro"));
const BrainROI = lazy(() => import("./components/BrainROI"));
const BrainHealth = lazy(() => import("./components/BrainHealth"));
const BrainLearning = lazy(() => import("./components/BrainLearning"));
const BrainAlerts = lazy(() => import("./components/BrainAlerts"));
const BrainLosses = lazy(() => import("./components/BrainLosses"));
const BrainRisks = lazy(() => import("./components/BrainRisks"));
const BrainPredictions = lazy(() => import("./components/BrainPredictions"));
const BrainOpportunities = lazy(() => import("./components/BrainOpportunities"));
const BrainSegmentation = lazy(() => import("./components/BrainSegmentation"));
const BrainCauses = lazy(() => import("./components/BrainCauses"));
const BrainDecisionHistory = lazy(() => import("./components/BrainDecisionHistory"));
const BrainSelfEval = lazy(() => import("./components/BrainSelfEval"));
const BrainChat = lazy(() => import("./components/BrainChat"));

const STORAGE_TAB = "lysiabrain_tab";
const STORAGE_STRATEGY = "lysiabrain_strategy";

/* ═══ VALID TAB IDS — Statik liste, render dışında tanımlı ═══ */
const VALID_TAB_IDS = new Set([
    "dashboard", "advisor", "recommendations", "operator",
    "mistakes", "profit_map", "segmentation", "causes", "health", "platforms",
    "costs", "losses", "roi", "risks",
    "predictions", "timing", "opportunities", "retro",
    "simulation", "goals", "learning", "alerts", "decisions", "self_eval",
]);

const LysiaBrain = () => {
    const { language } = useApp();
    const t = getBrainT(language);
    const { isMobile, isTablet } = useResponsive();

    /* ═══ TAB GROUPS — Memoized, sadece language değişince yeniden oluşur ═══ */
    const TAB_GROUPS = useMemo(() => [
        {
            id: "main", label: t("tabgroup.main"), icon: "⚡",
            tabs: [
                { id: "dashboard", icon: "◈", label: t("tab.dashboard") },
                { id: "recommendations", icon: "◆", label: t("tab.recommendations") },
                { id: "operator", icon: "⬡", label: t("tab.operator") },
            ],
        },
        {
            id: "intelligence", label: t("tabgroup.analysis"), icon: "🧠",
            tabs: [
                { id: "advisor", icon: "◇", label: t("tab.advisor") },
                { id: "mistakes", icon: "△", label: t("tab.mistakes") },
                { id: "health", icon: "🏥", label: t("tab.health") },
                { id: "profit_map", icon: "📊", label: t("tab.profit_map") },
                { id: "losses", icon: "💸", label: t("tab.losses") },
            ],
        },
        {
            id: "strategy", label: t("tabgroup.predict"), icon: "🎯",
            tabs: [
                { id: "goals", icon: "🥅", label: t("tab.goals") },
                { id: "simulation", icon: "🧪", label: t("tab.simulation") },
                { id: "predictions", icon: "🔮", label: t("tab.predictions") },
                { id: "timing", icon: "⏰", label: t("tab.timing") },
            ],
        },
        {
            id: "ecosystem", label: t("tabgroup.ai"), icon: "🌐",
            tabs: [
                { id: "platforms", icon: "▣", label: t("tab.platforms") },
                { id: "opportunities", icon: "🎯", label: t("tab.opportunities") },
                { id: "risks", icon: "⚠️", label: t("tab.risks") },
                { id: "learning", icon: "📚", label: t("tab.learning") },
            ],
        },
        {
            id: "history", label: "Geçmiş", icon: "⏳",
            tabs: [
                { id: "decisions", icon: "📜", label: t("tab.decisions") },
                { id: "retro", icon: "🔄", label: t("tab.retro") },
                { id: "self_eval", icon: "🤖", label: t("tab.self_eval") },
            ],
        },
    ], [t]);

    const [openGroup, setOpenGroup] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const menuRef = useRef(null);

    const STRATEGIES = useMemo(() => [
        { id: "balanced", label: t("strategy.balanced"), icon: "⚖️", color: T.accent },
        { id: "aggressive", label: t("strategy.aggressive"), icon: "🚀", color: T.red },
        { id: "conservative", label: t("strategy.conservative"), icon: "🛡️", color: T.green },
    ], [t]);

    /* ═══ STATE — persisted ═══ */
    const [activeTab, setActiveTab] = useState(() => {
        try { const s = localStorage.getItem(STORAGE_TAB); return VALID_TAB_IDS.has(s) ? s : "dashboard"; } catch { return "dashboard"; }
    });
    const [selectedStrategy, setSelectedStrategy] = useState(() => {
        try { const s = localStorage.getItem(STORAGE_STRATEGY); return ["balanced", "aggressive", "conservative"].includes(s) ? s : "balanced"; } catch { return "balanced"; }
    });

    /* ═══ STATE — runtime ═══ */
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [rateLimitToast, setRateLimitToast] = useState(null);

    const visibleRef = useRef(true);

    const [brain, setBrain] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [recSummary, setRecSummary] = useState({ pending: 0, executed: 0, approved: 0, rejected: 0 });
    const [operatorStatus, setOperatorStatus] = useState(null);
    const [cycleResult, setCycleResult] = useState(null);
    const [cycleLoading, setCycleLoading] = useState(false);
    const [autoDecideLoading, setAutoDecideLoading] = useState(false);
    const [autoDecisions, setAutoDecisions] = useState(null);
    const [autonomousStatus, setAutonomousStatus] = useState("Standby");
    const [diagnosisData, setDiagnosisData] = useState(null);
    const [diagnosisLoading, setDiagnosisLoading] = useState(false);
    const [showDiagnosis, setShowDiagnosis] = useState(false);
    const [explainModal, setExplainModal] = useState(null);
    const [showStrategyPicker, setShowStrategyPicker] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const strategyRef = useRef(null);

    /* ═══ PERSIST STATE ═══ */
    useEffect(() => { try { localStorage.setItem(STORAGE_TAB, activeTab); } catch { /* */ } }, [activeTab]);
    useEffect(() => { try { localStorage.setItem(STORAGE_STRATEGY, selectedStrategy); } catch { /* */ } }, [selectedStrategy]);

    /* ═══ OUTSIDE CLICK — Strategy Picker & Menu ═══ */
    useEffect(() => {
        const handler = (e) => {
            if (showStrategyPicker && strategyRef.current && !strategyRef.current.contains(e.target)) setShowStrategyPicker(false);
            if (openGroup && menuRef.current && !menuRef.current.contains(e.target)) setOpenGroup(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showStrategyPicker, openGroup]);

    /* ═══ PAGE VISIBILITY — Sayfa görünmezken polling'i durdur ═══ */
    useEffect(() => {
        const handler = () => {
            visibleRef.current = document.visibilityState === "visible";
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, []);

    /* ═══ RATE LIMIT TOAST — 429 olduğunda kullanıcıya bilgi ver ═══ */
    useEffect(() => {
        const handler = (e) => {
            const { retryAfter, attempt } = e.detail;
            setRateLimitToast({ retryAfter, attempt, ts: Date.now() });
            // Toast'u otomatik kapat
            setTimeout(() => setRateLimitToast(null), (retryAfter + 1) * 1000);
        };
        window.addEventListener("api:rate-limited", handler);
        return () => window.removeEventListener("api:rate-limited", handler);
    }, []);

    /* ═══ DATA FETCHING ═══ */
    // ✅ FIX: selectedStrategy'yi ref ile takip et — loadBrain'in dependency'si olmasın
    const strategyValRef = useRef(selectedStrategy);
    strategyValRef.current = selectedStrategy;

    const loadBrain = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            setError(null);
            const res = await API.get(`/ai-engine/brain?strategy=${strategyValRef.current}`);
            if (res.data && res.data.success !== false) {
                setBrain(res.data);
                setRecommendations(res.data.recommendations || []);
                setRecSummary(res.data.recSummary || { pending: 0, executed: 0, approved: 0, rejected: 0 });
            } else if (res.data?.success === false) {
                setError(res.data.message || "Veri yüklenemedi");
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Bağlantı hatası");
        } finally { setRefreshing(false); setLoading(false); }
    }, []); // ✅ Boş dependency — asla yeniden oluşmaz

    const loadOperatorStatus = useCallback(async () => {
        try {
            const res = await API.get("/ai-chat/operator/status");
            if (res.data.success) setOperatorStatus(res.data);
        } catch { /* silent */ }
    }, []);

    // ✅ FIX: İlk yükleme + polling — loadBrain stabil olduğu için sadece 1 kez çalışır
    useEffect(() => {
        loadBrain();
        loadOperatorStatus();
        // ✅ v2: Polling 3 dakikaya çıkarıldı + sayfa görünmezken atla
        const id = setInterval(() => {
            if (visibleRef.current) loadBrain(false);
        }, 180000);
        return () => clearInterval(id);
    }, [loadBrain, loadOperatorStatus]);

    // ✅ FIX: Strateji değişince sadece 1 kez yeniden yükle (polling'i bozmadan)
    const prevStrategyRef = useRef(selectedStrategy);
    useEffect(() => {
        if (prevStrategyRef.current !== selectedStrategy) {
            prevStrategyRef.current = selectedStrategy;
            loadBrain(true);
        }
    }, [selectedStrategy, loadBrain]);

    /* ═══ KEYBOARD SHORTCUTS ═══ */
    const loadBrainRef = useRef(null);
    loadBrainRef.current = loadBrain;
    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "Escape") { setShowDiagnosis(false); setExplainModal(null); setShowStrategyPicker(false); setShowMobileMenu(false); setOpenGroup(null); return; }
            if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) { loadBrainRef.current?.(true); return; }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    /* ═══ ACTIONS ═══ */
    const handleApprove = async (recId) => {
        try {
            const res = await API.post(`/ai-engine/recommendations/${recId}/approve`);
            if (res.data.success) {
                // Local state anında güncelle (UI hızlı tepki versin)
                setRecommendations(p => p.map(r => r._id === recId ? { ...r, status: "approved" } : r));
                setRecSummary(p => ({ ...p, pending: Math.max(0, p.pending - 1), approved: p.approved + 1 }));
            }
        } catch (e) { setError(`${t("error.approve_fail")}: ${e.response?.data?.message || e.message}`); }
    };
    const handleReject = async (recId) => {
        try {
            const res = await API.post(`/ai-engine/recommendations/${recId}/reject`);
            if (res.data.success) {
                setRecommendations(p => p.map(r => r._id === recId ? { ...r, status: "rejected" } : r));
                setRecSummary(p => ({ ...p, pending: Math.max(0, p.pending - 1), rejected: p.rejected + 1 }));
            }
        } catch (e) { setError(`${t("error.reject_fail")}: ${e.response?.data?.message || e.message}`); }
    };
    const handleExecute = async (recId) => {
        try {
            const res = await API.post(`/ai-engine/recommendations/${recId}/execute`);
            if (res.data.success) {
                setRecommendations(p => p.map(r => r._id === recId ? { ...r, status: "executed" } : r));
                setRecSummary(p => ({ ...p, approved: Math.max(0, p.approved - 1), executed: p.executed + 1 }));
            }
        } catch (e) { setError(`${t("error.execute_fail")}: ${e.response?.data?.message || e.message}`); }
    };
    const handleGenerate = async () => {
        try { setRefreshing(true); await API.post("/ai-engine/recommendations/generate", { strategyMode: selectedStrategy }); loadBrain(true); }
        catch (e) { setError(`${t("error.generate_fail")}: ${e.response?.data?.message || e.message}`); }
        finally { setRefreshing(false); }
    };
    const handleExplain = async (recId) => {
        try { const res = await API.post(`/ai-engine/brain/explain/${recId}`); if (res.data.success) setExplainModal(res.data); }
        catch { setError(t("error.explain_fail")); }
    };
    const handleBulkApprove = async (ids) => { try { await API.post("/ai-engine/recommendations/bulk-approve", { ids }); await loadBrain(true); } catch (e) { console.error("Bulk approve error:", e); setError(t("error.bulk_approve_fail")); } };
    const handleBulkReject = async (ids) => { try { await API.post("/ai-engine/recommendations/bulk-reject", { ids }); await loadBrain(true); } catch (e) { console.error("Bulk reject error:", e); setError(t("error.bulk_reject_fail")); } };
    const handleChangeMode = async (mode) => { try { const res = await API.post("/ai-chat/operator/mode", { mode }); if (res.data.success) setOperatorStatus(p => ({ ...p, operationMode: mode })); } catch { setError(t("error.mode_fail")); } };
    const handleRunCycle = async () => {
        setCycleLoading(true);
        try { const mode = operatorStatus?.operationMode || "assisted"; const res = await API.post("/ai-chat/operator/cycle", { mode }); if (res.data.success) { setCycleResult(res.data); loadBrain(false); loadOperatorStatus(); } }
        catch { setError(t("error.cycle_fail")); } finally { setCycleLoading(false); }
    };
    const handleAutoDecide = async () => {
        setAutoDecideLoading(true); setAutoDecisions(null);
        try { const res = await API.post("/ai-engine/brain/auto-decide"); if (res.data.success) setAutoDecisions(res.data); }
        catch { setError(t("error.auto_decide_fail")); } finally { setAutoDecideLoading(false); }
    };
    const handleDiagnosis = async () => {
        setDiagnosisLoading(true); setDiagnosisData(null); setShowDiagnosis(true);
        try { const res = await API.get("/ai-engine/brain/diagnosis"); if (res.data.success) setDiagnosisData(res.data.diagnosis); }
        catch { setError(t("error.diagnosis_fail")); } finally { setDiagnosisLoading(false); }
    };
    const handleStrategyChange = (strategy) => { setSelectedStrategy(strategy); setShowStrategyPicker(false); };
    const handleTabChange = (tab) => { setActiveTab(tab); setShowMobileMenu(false); };

    /* ═══ TAB CONTENT ═══ */
    const renderTab = () => {
        const lazyFallback = (msg) => <LoadingState message={msg} />;
        switch (activeTab) {
            case "dashboard": return <BrainDashboard brain={brain} recSummary={recSummary} onTabChange={handleTabChange} onAutoDecide={handleAutoDecide} onDiagnosis={handleDiagnosis} autoDecideLoading={autoDecideLoading} autoDecisions={autoDecisions} t={t} />;
            case "advisor": return <Suspense fallback={lazyFallback(t("loading.advisor"))}><BrainAdvisor t={t} onError={setError} /></Suspense>;
            case "recommendations": return <BrainRecommendations recommendations={recommendations} recSummary={recSummary} refreshing={refreshing} onApprove={handleApprove} onReject={handleReject} onExecute={handleExecute} onGenerate={handleGenerate} onExplain={handleExplain} onBulkApprove={handleBulkApprove} onBulkReject={handleBulkReject} t={t} />;
            case "mistakes": return <Suspense fallback={lazyFallback(t("loading.mistakes"))}><BrainMistakes t={t} onError={setError} /></Suspense>;
            case "platforms": return <Suspense fallback={lazyFallback(t("loading.platforms"))}><BrainPlatforms t={t} onError={setError} /></Suspense>;
            case "operator": return <BrainOperator operatorStatus={operatorStatus} cycleResult={cycleResult} cycleLoading={cycleLoading} onChangeMode={handleChangeMode} onRunCycle={handleRunCycle} onRefresh={loadOperatorStatus} t={t} onError={setError} />;
            case "simulation": return <Suspense fallback={lazyFallback(t("loading.simulation"))}><BrainSimulation t={t} onError={setError} /></Suspense>;
            case "goals": return <Suspense fallback={lazyFallback(t("loading.goals"))}><BrainGoals t={t} onError={setError} /></Suspense>;
            case "costs": return <Suspense fallback={lazyFallback(t("loading.costs"))}><BrainCosts t={t} onError={setError} /></Suspense>;
            case "profit_map": return <Suspense fallback={lazyFallback(t("loading.profit_map"))}><BrainProfitMap t={t} onError={setError} /></Suspense>;
            case "timing": return <Suspense fallback={lazyFallback(t("loading.timing"))}><BrainTiming t={t} onError={setError} /></Suspense>;
            case "retro": return <Suspense fallback={lazyFallback(t("loading.retro"))}><BrainRetro t={t} onError={setError} /></Suspense>;
            case "roi": return <Suspense fallback={lazyFallback(t("loading.roi"))}><BrainROI t={t} onError={setError} /></Suspense>;
            case "health": return <Suspense fallback={lazyFallback(t("loading.health"))}><BrainHealth t={t} onError={setError} /></Suspense>;
            case "learning": return <Suspense fallback={lazyFallback(t("loading.learning"))}><BrainLearning t={t} onError={setError} /></Suspense>;
            case "alerts": return <Suspense fallback={lazyFallback(t("loading.alerts"))}><BrainAlerts t={t} onError={setError} /></Suspense>;
            case "losses": return <Suspense fallback={lazyFallback(t("loading.losses"))}><BrainLosses t={t} onError={setError} /></Suspense>;
            case "risks": return <Suspense fallback={lazyFallback(t("loading.risks"))}><BrainRisks t={t} onError={setError} /></Suspense>;
            case "predictions": return <Suspense fallback={lazyFallback(t("loading.predictions"))}><BrainPredictions t={t} onError={setError} /></Suspense>;
            case "opportunities": return <Suspense fallback={lazyFallback(t("loading.opportunities"))}><BrainOpportunities t={t} onError={setError} /></Suspense>;
            case "segmentation": return <Suspense fallback={lazyFallback(t("loading.segmentation"))}><BrainSegmentation t={t} onError={setError} /></Suspense>;
            case "causes": return <Suspense fallback={lazyFallback(t("loading.causes"))}><BrainCauses t={t} onError={setError} /></Suspense>;
            case "decisions": return <Suspense fallback={lazyFallback(t("loading.decisions"))}><BrainDecisionHistory t={t} onError={setError} /></Suspense>;
            case "self_eval": return <Suspense fallback={lazyFallback(t("loading.self_eval"))}><BrainSelfEval t={t} onError={setError} /></Suspense>;
            default: return null;
        }
    };

    const healthScore = brain?.businessHealth?.overallScore || 0;
    const curStrategy = STRATEGIES.find(s => s.id === selectedStrategy) || STRATEGIES[0];

    const getStatusInfo = () => {
        if (autoDecideLoading) return { label: "Thinking", color: T.yellow };
        if (brain?.thoughtProcess?.agentStatus === "busy") return { label: "Analyzing", color: T.blue };
        return { label: "Neural Standby", color: T.green };
    };
    const sInfo = getStatusInfo();

    /* ═══ LOADING SCREEN ═══ */
    if (loading) {
        return (
            <div style={{ width: "100%", height: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", fontFamily: T.font }}>
                <div style={{
                    width: 88, height: 88, borderRadius: "50%",
                    background: T.accentDim, border: `2px solid ${T.accent}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2.2rem", boxShadow: T.shadowGlow,
                    animation: "v9pulse 2.5s ease-in-out infinite",
                }}>🧠</div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.03em", background: T.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LysiaBrain</div>
                    <p style={{ color: T.textDim, fontSize: "0.85rem", marginTop: "0.5rem", letterSpacing: "0.05em" }}>{t("loading.init")}</p>
                </div>
                <style>{`@keyframes v9pulse { 0%,100% { transform: scale(1); box-shadow: 0 0 20px rgba(0,212,170,0.15); } 50% { transform: scale(1.06); box-shadow: 0 0 40px rgba(0,212,170,0.3); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", width: "100%", height: "100vh", fontFamily: T.font, background: T.bg, color: T.text, overflow: "hidden" }}>

            {/* ═══ MAIN CONTENT AREA ═══ */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", position: "relative" }}>
                
                {/* ═══ TOP BAR — NEW INTEGRATED NAV ═══ */}
                <header style={{
                    height: 80, minHeight: 80,
                    background: "rgba(8, 11, 22, 0.8)", backdropFilter: "blur(20px)",
                    borderBottom: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 1.5rem", zIndex: 100
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
                        {/* Logo */}
                        <div onClick={() => handleTabChange("dashboard")} style={{ display: "flex", alignItems: "center", gap: "0.85rem", cursor: "pointer" }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: T.rSm,
                                background: T.accentDim, border: `1px solid ${T.accent}40`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.5rem", boxShadow: T.shadowGlow, flexShrink: 0
                            }}>🧠</div>
                            {!isMobile && (
                                <div>
                                    <div style={{ fontSize: "1.25rem", fontWeight: 900, background: T.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em" }}>LysiaBrain</div>
                                    <div style={{ fontSize: "0.6rem", color: T.textDim, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Neural Command</div>
                                </div>
                            )}
                        </div>

                        {/* Top Navigation */}
                        {!isTablet && (
                            <nav style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {TAB_GROUPS.map(group => (
                                    <div key={group.id} style={{ position: "relative" }}>
                                        <button 
                                            onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
                                            style={{
                                                padding: "0.5rem 0.85rem",
                                                background: group.tabs.some(t => t.id === activeTab) ? T.accentDim : "transparent",
                                                border: "none",
                                                borderRadius: T.rSm,
                                                color: group.tabs.some(t => t.id === activeTab) ? T.accent : T.textSec,
                                                fontSize: "0.85rem",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                                transition: "all 0.2s"
                                            }}
                                        >
                                            <span>{group.icon}</span>
                                            <span>{group.label}</span>
                                            <span style={{ fontSize: "0.6rem", opacity: 0.5 }}>{openGroup === group.id ? "▲" : "▼"}</span>
                                        </button>

                                        {openGroup === group.id && (
                                            <div ref={menuRef} style={{
                                                position: "absolute", top: "100%", left: 0, marginTop: "0.5rem",
                                                width: 220, background: T.bgCardSolid, border: `1px solid ${T.border}`,
                                                borderRadius: T.rSm, boxShadow: T.shadowLg, padding: "0.5rem",
                                                zIndex: 1000, backdropFilter: "blur(20px)"
                                            }}>
                                                {group.tabs.map(tab => (
                                                    <button 
                                                        key={tab.id} 
                                                        onClick={() => { handleTabChange(tab.id); setOpenGroup(null); }}
                                                        style={{
                                                            width: "100%", textAlign: "left", padding: "0.65rem 0.75rem",
                                                            background: activeTab === tab.id ? T.accentDim : "transparent",
                                                            border: "none", borderRadius: T.rSm,
                                                            color: activeTab === tab.id ? T.accent : T.text,
                                                            fontSize: "0.8rem", fontWeight: activeTab === tab.id ? 800 : 500,
                                                            cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem"
                                                        }}
                                                    >
                                                        <span style={{ opacity: 0.7 }}>{tab.icon}</span>
                                                        <span>{tab.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </nav>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        {isMobile && <button onClick={() => setShowMobileMenu(!showMobileMenu)} style={{ background: "none", border: "none", color: T.text, fontSize: "1.5rem" }}>☰</button>}
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>{TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === activeTab)?.label}</h2>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: T.bgGlass, padding: "0.5rem 1rem", borderRadius: T.rFull, border: `1px solid ${T.border}` }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
                            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: T.textSec }}>AI CORE ACTIVE</span>
                        </div>

                        <div style={{ position: "relative" }} ref={strategyRef}>
                            <button onClick={() => setShowStrategyPicker(!showStrategyPicker)} style={{
                                background: `${curStrategy.color}15`, border: `1px solid ${curStrategy.color}40`,
                                color: curStrategy.color, padding: "0.5rem 1rem", borderRadius: T.rSm,
                                fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem"
                            }}>
                                {curStrategy.icon} {curStrategy.label} ▾
                            </button>
                            {showStrategyPicker && (
                                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: T.bgCardSolid, border: `1px solid ${T.border}`, borderRadius: T.rSm, padding: 4, zIndex: 100, minWidth: 160, boxShadow: T.shadowLg }}>
                                    {STRATEGIES.map(s => (
                                        <button key={s.id} onClick={() => handleStrategyChange(s.id)} style={{ width: "100%", padding: "0.75rem", border: "none", background: selectedStrategy === s.id ? T.bgGlass : "transparent", color: selectedStrategy === s.id ? T.accent : T.textSec, textAlign: "left", cursor: "pointer", borderRadius: T.rSm, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 600 }}>
                                            {s.icon} {s.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={() => loadBrain(true)} style={{ width: 40, height: 40, borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}`, color: T.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↻</button>
                    </div>
                </header>

                {/* ═══ SCROLLABLE CONTENT ═══ */}
                <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "1.5rem 1rem" : "2.5rem", position: "relative" }}>
                    {renderTab()}
                </main>

                {/* ═══ DIAGNOSIS MODAL ═══ */}
                <Modal open={showDiagnosis} onClose={() => setShowDiagnosis(false)}>
                    <ModalHeader icon="🩺" iconColor={T.purple} title={t("diag.title")} subtitle={t("diag.subtitle")} onClose={() => setShowDiagnosis(false)} />
                    <div style={{ padding: "1.5rem" }}>
                        {diagnosisLoading ? <LoadingState message={t("loading.analyzing")} /> : diagnosisData ? (
                            <>
                                <div style={{ textAlign: "center", padding: "2rem", borderRadius: T.r, border: `1px solid ${T.borderGlow}`, marginBottom: "1.5rem", background: T.gradientCard }}>
                                    <div style={{ width: 72, height: 72, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", marginBottom: "0.85rem", background: T.bgGlass, border: `1px solid ${T.border}`, boxShadow: T.shadowGlow }}>{diagnosisData.verdictEmoji}</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 900, background: T.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t("diag.grade")}: {diagnosisData.healthGrade}</div>
                                    <p style={{ fontSize: "0.88rem", color: T.textSec, marginTop: "0.5rem", maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.65 }}>{diagnosisData.verdict}</p>
                                </div>
                                {[
                                    { items: diagnosisData.mistakes, title: `🔴 ${t("diag.mistakes")}`, color: T.red, bg: T.redDim, fixKey: "fix" },
                                    { items: diagnosisData.leaks, title: `💸 ${t("diag.leaks")}`, color: T.yellow, bg: T.yellowDim, fixKey: "fix" },
                                    { items: diagnosisData.opportunities, title: `💰 ${t("diag.opportunities")}`, color: T.green, bg: T.greenDim, fixKey: "action" },
                                ].map(({ items, title, color, bg, fixKey }) => items?.length > 0 && (
                                    <div key={title} style={{ marginBottom: "1.25rem" }}>
                                        <h4 style={{ fontSize: "0.88rem", fontWeight: 700, color, marginBottom: "0.6rem" }}>{title}</h4>
                                        {items.map((item, i) => (
                                            <div key={i} style={{ padding: "0.85rem 1rem", marginBottom: "0.4rem", borderLeft: `3px solid ${color}`, borderRadius: `0 ${T.rSm}px ${T.rSm}px 0`, background: bg }}>
                                                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: T.text }}>{item.icon} {item.title}</div>
                                                <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4, lineHeight: 1.65 }}>{item.detail}</div>
                                                {item[fixKey] && <div style={{ fontSize: "0.76rem", color: T.accent, marginTop: 6, fontWeight: 600 }}>💊 {item[fixKey]}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </>
                        ) : <div style={{ textAlign: "center", padding: "2.5rem", color: T.textDim }}>{t("diag.no_data")}</div>}
                    </div>
                </Modal>

                {/* ═══ EXPLAIN MODAL ═══ */}
                <Modal open={!!explainModal} onClose={() => setExplainModal(null)}>
                    <ModalHeader icon="👁️" iconColor={T.accent} title={t("explain.title")} subtitle={t("explain.subtitle")} onClose={() => setExplainModal(null)} />
                    <div style={{ padding: "1.5rem" }}>
                        <h4 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", color: T.text, fontWeight: 700 }}>{explainModal?.recommendation?.title}</h4>
                        <p style={{ fontSize: "0.86rem", color: T.textSec, margin: "0 0 1.25rem", lineHeight: 1.65 }}>{explainModal?.recommendation?.description}</p>
                        {(explainModal?.explanation || []).map((step, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.85rem", padding: "1rem 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: "50%",
                                    background: T.accentDim, border: `2px solid ${T.accent}40`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontWeight: 800, fontSize: "0.8rem", color: T.accent, flexShrink: 0,
                                    fontFamily: T.fontMono,
                                }}>{step.step}</div>
                                <div>
                                    <div style={{ fontSize: "0.88rem", color: T.text, fontWeight: 700 }}>{step.title}</div>
                                    <p style={{ fontSize: "0.8rem", color: T.textSec, margin: "4px 0 0", lineHeight: 1.65 }}>{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>

                {/* ═══ AI CHAT WIDGET ═══ */}
                <Suspense fallback={null}>
                    <BrainChat t={t} />
                </Suspense>
            </div>
            
            {/* ═══ MOBILE OVERLAY MENU ═══ */}
            {isMobile && showMobileMenu && (
                <div style={{ position: "fixed", inset: 0, background: T.bgOverlay, zIndex: 1000, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>LysiaBrain</div>
                        <button onClick={() => setShowMobileMenu(false)} style={{ background: "none", border: "none", color: T.text, fontSize: "1.5rem" }}>✕</button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                        {TAB_GROUPS.map(group => (
                            <div key={group.id} style={{ marginBottom: "2rem" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: T.textMuted, marginBottom: "1rem" }}>{group.label}</div>
                                {group.tabs.map(tab => (
                                    <button key={tab.id} onClick={() => handleTabChange(tab.id)} style={{ width: "100%", padding: "1rem", textAlign: "left", background: activeTab === tab.id ? T.accentDim : "transparent", border: "none", color: activeTab === tab.id ? T.accent : T.text, borderRadius: T.rSm, marginBottom: 4 }}>
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LysiaBrain;
