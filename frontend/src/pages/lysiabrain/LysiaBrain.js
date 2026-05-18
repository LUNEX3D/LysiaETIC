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
import { T, useResponsive, ensureLysiaGlobalStyles } from "./styles";
import { getBrainT } from "./i18n";
import { ScoreRing, LoadingState, ErrorState, Modal, ModalHeader } from "./components/shared/SharedUI";

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
const BrainAutonomy = lazy(() => import("./components/BrainAutonomy"));

const STORAGE_TAB = "pazaryonet_ai_tab";
const STORAGE_STRATEGY = "pazaryonet_ai_strategy";

/* ═══ VALID TAB IDS — Statik liste, render dışında tanımlı ═══ */
const VALID_TAB_IDS = new Set([
    "dashboard", "advisor", "recommendations", "operator", "autonomy",
    "mistakes", "profit_map", "segmentation", "causes", "health", "platforms",
    "costs", "losses", "roi", "risks",
    "predictions", "timing", "opportunities", "retro",
    "simulation", "goals", "learning", "alerts", "decisions", "self_eval",
]);

const LysiaBrain = () => {
    const { language } = useApp();
    const t = getBrainT(language);
    const tRef = useRef(t);
    tRef.current = t;
    const { isMobile, isTablet } = useResponsive();

    /* ═══ TAB ORGANIZATION — Sade: 5 sabit ana sekme + "Gelişmiş" tek dropdown ═══ */
    // PINNED_TABS: her zaman üst navda görünür (en sık kullanılanlar)
    const PINNED_TABS = useMemo(() => [
        { id: "dashboard", icon: "◈", label: t("tab.dashboard") },
        { id: "recommendations", icon: "◆", label: t("tab.recommendations") },
        { id: "advisor", icon: "◇", label: t("tab.advisor") },
        { id: "operator", icon: "⬡", label: t("tab.operator") },
        { id: "autonomy", icon: "🎛️", label: "Kurallar" },
        { id: "decisions", icon: "📜", label: t("tab.decisions") },
    ], [t]);

    // ADVANCED_GROUPS: "Gelişmiş Analizler ▾" dropdown'unun içinde grup başlıkları
    const ADVANCED_GROUPS = useMemo(() => [
        {
            id: "performance", label: "Performans & Sağlık", icon: "📊",
            tabs: [
                { id: "health", icon: "🏥", label: t("tab.health") },
                { id: "profit_map", icon: "📊", label: t("tab.profit_map") },
                { id: "losses", icon: "💸", label: t("tab.losses") },
                { id: "roi", icon: "💰", label: t("tab.roi") },
                { id: "costs", icon: "💶", label: t("tab.costs") },
            ],
        },
        {
            id: "intelligence", label: "Analiz & Risk", icon: "🧠",
            tabs: [
                { id: "mistakes", icon: "△", label: t("tab.mistakes") },
                { id: "segmentation", icon: "◎", label: t("tab.segmentation") },
                { id: "causes", icon: "🔍", label: t("tab.causes") },
                { id: "risks", icon: "⚠️", label: t("tab.risks") },
                { id: "alerts", icon: "🔔", label: t("tab.alerts") },
            ],
        },
        {
            id: "strategy", label: "Strateji & Tahmin", icon: "🎯",
            tabs: [
                { id: "goals", icon: "🥅", label: t("tab.goals") },
                { id: "simulation", icon: "🧪", label: t("tab.simulation") },
                { id: "predictions", icon: "🔮", label: t("tab.predictions") },
                { id: "opportunities", icon: "✨", label: t("tab.opportunities") },
                { id: "timing", icon: "⏰", label: t("tab.timing") },
            ],
        },
        {
            id: "ecosystem", label: "Ekosistem & AI", icon: "🌐",
            tabs: [
                { id: "platforms", icon: "▣", label: t("tab.platforms") },
                { id: "learning", icon: "📚", label: t("tab.learning") },
                { id: "retro", icon: "🔄", label: t("tab.retro") },
                { id: "self_eval", icon: "🤖", label: t("tab.self_eval") },
            ],
        },
    ], [t]);

    // Tüm tab'lar düz liste (label lookup için)
    const ALL_TABS = useMemo(() => [
        ...PINNED_TABS,
        ...ADVANCED_GROUPS.flatMap(g => g.tabs),
    ], [PINNED_TABS, ADVANCED_GROUPS]);

    // Geriye uyumluluk: bazı eski referanslar TAB_GROUPS bekliyor olabilir
    const TAB_GROUPS = useMemo(() => [
        { id: "pinned", label: "Hızlı Erişim", icon: "⚡", tabs: PINNED_TABS },
        ...ADVANCED_GROUPS,
    ], [PINNED_TABS, ADVANCED_GROUPS]);

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
    const [autonomyStatus, setAutonomyStatus] = useState(null);

    const strategyRef = useRef(null);

    /* ═══ GLOBAL ANIMATION CSS — bir kez DOM'a inject edilir ═══ */
    useEffect(() => { ensureLysiaGlobalStyles(); }, []);

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

    /* ═══ Autonomy Status — global mod rozeti için ═══ */
    const loadAutonomyStatus = useCallback(async () => {
        try {
            const res = await API.get("/ai-engine/autonomy-config/status");
            if (res.data?.success !== false) setAutonomyStatus(res.data);
        } catch { /* silent */ }
    }, []);
    useEffect(() => {
        loadAutonomyStatus();
        const interval = setInterval(loadAutonomyStatus, 60_000);
        return () => clearInterval(interval);
    }, [loadAutonomyStatus]);

    /* ═══ DATA FETCHING ═══ */
    // ✅ FIX: selectedStrategy'yi ref ile takip et — loadBrain'in dependency'si olmasın
    const strategyValRef = useRef(selectedStrategy);
    strategyValRef.current = selectedStrategy;

    const loadBrain = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            setError(null);
            const refreshQ = showRefresh ? "&refresh=true" : "";
            const res = await API.get(`/ai-engine/brain?strategy=${encodeURIComponent(strategyValRef.current)}${refreshQ}`);
            if (!res?.data) {
                setError(tRef.current("error.data_load_fail"));
                return;
            }
            if (res.data.success !== false) {
                setBrain(res.data);
                setRecommendations(res.data.recommendations || []);
                setRecSummary(res.data.recSummary || { pending: 0, executed: 0, approved: 0, rejected: 0 });
            } else {
                setError(res.data.message || "Veri yüklenemedi");
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Bağlantı hatası");
        } finally { setRefreshing(false); setLoading(false); }
    }, []); // ✅ Boş dependency — asla yeniden oluşmaz

    const loadOperatorStatus = useCallback(async () => {
        try {
            const res = await API.get("/ai-chat/operator/status");
            if (res.data?.success !== false) setOperatorStatus(res.data);
        } catch { /* silent */ }
    }, []);

    // ✅ FIX: İlk yükleme + polling — loadBrain stabil olduğu için sadece 1 kez çalışır
    useEffect(() => {
        loadBrain();
        loadOperatorStatus();
        // ✅ v2: Brain polling 3 dakika + sayfa görünmezken atla
        const brainId = setInterval(() => {
            if (visibleRef.current) loadBrain(false);
        }, 180000);
        // ✅ FIX (3.13): Operator status polling — mode/last cycle 60s'de bir yenilensin
        const opId = setInterval(() => {
            if (visibleRef.current) loadOperatorStatus();
        }, 60000);
        return () => {
            clearInterval(brainId);
            clearInterval(opId);
        };
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
            if (res.data?.success !== false) {
                await loadBrain(true);
                if (res.data?.executionError) {
                    setError(`${res.data.message || t("error.approve_fail")}: ${res.data.executionError}`);
                } else if (res.data?.executionResult && res.data.executionResult.success === false) {
                    setError(res.data.executionResult.message || t("error.execute_fail"));
                }
            }
        } catch (e) { setError(`${t("error.approve_fail")}: ${e.response?.data?.message || e.message}`); }
    };
    const handleReject = async (recId) => {
        try {
            const res = await API.post(`/ai-engine/recommendations/${recId}/reject`);
            if (res.data?.success !== false) {
                setRecommendations(p => p.map(r => r._id === recId ? { ...r, status: "rejected" } : r));
                setRecSummary(p => ({ ...p, pending: Math.max(0, p.pending - 1), rejected: p.rejected + 1 }));
            }
        } catch (e) { setError(`${t("error.reject_fail")}: ${e.response?.data?.message || e.message}`); }
    };
    const handleExecute = async (recId) => {
        try {
            const res = await API.post(`/ai-engine/recommendations/${recId}/execute`);
            if (res.data?.success !== false) {
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
    const handleExplain = async (recOrId) => {
        const recId = recOrId && typeof recOrId === "object" ? recOrId._id : recOrId;
        if (!recId) return;
        try {
            const res = await API.post(`/ai-engine/brain/explain/${recId}`);
            if (res.data?.success !== false) setExplainModal(res.data);
        } catch { setError(t("error.explain_fail")); }
    };
    const handleBulkApprove = async (ids) => { try { await API.post("/ai-engine/recommendations/bulk-approve", { ids }); await loadBrain(true); } catch (e) { console.error("Bulk approve error:", e); setError(t("error.bulk_approve_fail")); } };
    const handleBulkReject = async (ids) => { try { await API.post("/ai-engine/recommendations/bulk-reject", { ids }); await loadBrain(true); } catch (e) { console.error("Bulk reject error:", e); setError(t("error.bulk_reject_fail")); } };
    const handleChangeMode = async (mode) => { try { const res = await API.post("/ai-chat/operator/mode", { mode }); if (res.data?.success !== false) setOperatorStatus(p => ({ ...p, operationMode: mode })); } catch { setError(t("error.mode_fail")); } };
    const handleRunCycle = async () => {
        setCycleLoading(true);
        try { const mode = operatorStatus?.operationMode || "assisted"; const res = await API.post("/ai-chat/operator/cycle", { mode }); if (res.data?.success !== false) { setCycleResult(res.data); loadBrain(false); loadOperatorStatus(); } }
        catch { setError(t("error.cycle_fail")); } finally { setCycleLoading(false); }
    };
    const handleAutoDecide = async () => {
        setAutoDecideLoading(true); setAutoDecisions(null);
        try { const res = await API.post("/ai-engine/brain/auto-decide"); if (res.data?.success !== false) setAutoDecisions(res.data); }
        catch { setError(t("error.auto_decide_fail")); } finally { setAutoDecideLoading(false); }
    };
    const handleDiagnosis = async () => {
        setDiagnosisLoading(true); setDiagnosisData(null); setShowDiagnosis(true);
        try { const res = await API.get("/ai-engine/brain/diagnosis"); if (res.data?.success !== false) setDiagnosisData(res.data.diagnosis); }
        catch { setError(t("error.diagnosis_fail")); } finally { setDiagnosisLoading(false); }
    };
    const handleStrategyChange = (strategy) => { setSelectedStrategy(strategy); setShowStrategyPicker(false); };
    const handleTabChange = useCallback((tab, filter) => {
        if (!VALID_TAB_IDS.has(tab)) return;
        setActiveTab(tab);
        setShowMobileMenu(false);
        try {
            if (filter && typeof filter === "object" && Object.keys(filter).length > 0) {
                sessionStorage.setItem(`pazaryonet_ai.tabFilter.${tab}`, JSON.stringify({ filter, ts: Date.now() }));
            } else {
                sessionStorage.removeItem(`pazaryonet_ai.tabFilter.${tab}`);
            }
        } catch { /* sessionStorage erişim hatası */ }
    }, []);

    // Alt bileşenlerden CustomEvent ile tab değişimi tetiklenebilsin
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (typeof detail === "string") handleTabChange(detail);
            else if (detail?.tab) handleTabChange(detail.tab, detail.filter);
        };
        window.addEventListener("lysia-goto-tab", handler);
        return () => window.removeEventListener("lysia-goto-tab", handler);
    }, [handleTabChange]);

    /* ═══ TAB CONTENT ═══ */
    const renderTab = () => {
        const lazyFallback = (msg) => <LoadingState message={msg} />;
        switch (activeTab) {
            case "dashboard": return <BrainDashboard brain={brain} recSummary={recSummary} onTabChange={handleTabChange} onAutoDecide={handleAutoDecide} onDiagnosis={handleDiagnosis} autoDecideLoading={autoDecideLoading} diagnosisLoading={diagnosisLoading} autoDecisions={autoDecisions} t={t} />;
            case "advisor": return <Suspense fallback={lazyFallback(t("loading.advisor"))}><BrainAdvisor t={t} onError={setError} /></Suspense>;
            case "recommendations": return <BrainRecommendations recommendations={recommendations} recSummary={recSummary} refreshing={refreshing} onApprove={handleApprove} onReject={handleReject} onExecute={handleExecute} onGenerate={handleGenerate} onExplain={handleExplain} onBulkApprove={handleBulkApprove} onBulkReject={handleBulkReject} t={t} />;
            case "mistakes": return <Suspense fallback={lazyFallback(t("loading.mistakes"))}><BrainMistakes t={t} onError={setError} /></Suspense>;
            case "platforms": return <Suspense fallback={lazyFallback(t("loading.platforms"))}><BrainPlatforms t={t} onError={setError} /></Suspense>;
            case "operator": return <BrainOperator operatorStatus={operatorStatus} cycleResult={cycleResult} cycleLoading={cycleLoading} onChangeMode={handleChangeMode} onRunCycle={handleRunCycle} onRefresh={loadOperatorStatus} t={t} onError={setError} />;
            case "autonomy": return <Suspense fallback={lazyFallback("Otonom kurallar yükleniyor...")}><BrainAutonomy t={t} onError={setError} /></Suspense>;
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
            <div className="lysia-ambient-bg" style={{ width: "100%", height: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", fontFamily: T.font }}>
                <div className="lysia-pulse-soft" style={{
                    width: 96, height: 96, borderRadius: "50%",
                    background: `radial-gradient(circle, ${T.accent}35 0%, ${T.accentDim} 70%)`,
                    border: `2px solid ${T.accent}50`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2.4rem", boxShadow: T.shadowGlow,
                }}>🧠</div>
                <div className="lysia-anim-fade" style={{ textAlign: "center" }}>
                    <div className="lysia-text-gradient" style={{ fontSize: T.fz.h2, fontWeight: 800, letterSpacing: "-0.03em" }}>PazarYonet AI</div>
                    <p style={{ color: T.textSec, fontSize: T.fz.sm, marginTop: "0.5rem", letterSpacing: "0.05em" }}>{t("loading.init")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="lysia-ambient-bg lysia-scroll" style={{ display: "flex", width: "100%", height: "100vh", fontFamily: T.font, background: T.bg, color: T.text, overflow: "hidden" }}>

            {/* ═══ MAIN CONTENT AREA ═══ */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", position: "relative" }}>

                {/* ═══ TOP BAR — NEW INTEGRATED NAV ═══ */}
                <header style={{
                    height: 80, minHeight: 80,
                    background: "rgba(10, 14, 28, 0.85)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
                    borderBottom: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 1.5rem", zIndex: 100,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
                        {/* Logo */}
                        <div onClick={() => handleTabChange("dashboard")} className="lysia-hover-scale lysia-focus" tabIndex={0} role="button" aria-label="Anasayfa"
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTabChange("dashboard"); } }}
                            style={{ display: "flex", alignItems: "center", gap: "0.85rem", cursor: "pointer", borderRadius: T.rSm, padding: "4px 6px" }}>
                            <div className="lysia-pulse-soft" style={{
                                width: 44, height: 44, borderRadius: T.rSm,
                                background: `linear-gradient(135deg, ${T.accent}30, ${T.accentAlt}20)`, border: `1px solid ${T.accent}50`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.5rem", boxShadow: T.shadowGlow, flexShrink: 0,
                            }}>🧠</div>
                            {!isMobile && (
                                <div>
                                    <div className="lysia-text-gradient" style={{ fontSize: "1.3rem", fontWeight: 900, letterSpacing: "-0.03em" }}>PazarYonet AI</div>
                                    <div style={{ fontSize: T.fz.xs, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Neural Command</div>
                                </div>
                            )}
                        </div>

                        {/* Top Navigation — Sade: 5 sabit tab + "Gelişmiş" dropdown */}
                        {!isTablet && (
                            <nav style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                {PINNED_TABS.map(tab => {
                                    const active = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabChange(tab.id)}
                                            className={`lysia-btn lysia-focus lysia-tab-indicator${active ? " active" : ""}`}
                                            style={{
                                                padding: "0.55rem 0.95rem",
                                                background: active ? T.accentDim : "transparent",
                                                border: active ? `1px solid ${T.accent}40` : "1px solid transparent",
                                                borderRadius: T.rSm,
                                                color: active ? T.accent : T.textSec,
                                                fontSize: T.fz.sm,
                                                fontWeight: active ? 800 : 600,
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                            }}
                                        >
                                            <span>{tab.icon}</span>
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}

                                {/* Gelişmiş Analizler — tek dropdown */}
                                <div style={{ position: "relative" }}>
                                    {(() => {
                                        const inAdvanced = ADVANCED_GROUPS.some(g => g.tabs.some(tt => tt.id === activeTab));
                                        return (
                                            <button
                                                onClick={() => setOpenGroup(openGroup === "advanced" ? null : "advanced")}
                                                className="lysia-btn lysia-focus"
                                                aria-expanded={openGroup === "advanced"}
                                                aria-haspopup="menu"
                                                style={{
                                                    padding: "0.55rem 0.95rem",
                                                    background: inAdvanced ? T.accentDim : "transparent",
                                                    border: inAdvanced ? `1px solid ${T.accent}40` : "1px solid transparent",
                                                    borderRadius: T.rSm,
                                                    color: inAdvanced ? T.accent : T.textSec,
                                                    fontSize: T.fz.sm,
                                                    fontWeight: inAdvanced ? 800 : 600,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.5rem",
                                                }}
                                            >
                                                <span>🧠</span>
                                                <span>Gelişmiş</span>
                                                <span style={{ fontSize: T.fz.xs, opacity: 0.7, transition: T.transition.transform, transform: openGroup === "advanced" ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                                            </button>
                                        );
                                    })()}

                                    {openGroup === "advanced" && (
                                        <div ref={menuRef} className="lysia-anim-slide-down lysia-scroll" style={{
                                            position: "absolute", top: "100%", right: 0, marginTop: "0.6rem",
                                            width: 560, maxWidth: "90vw", maxHeight: "70vh", overflowY: "auto",
                                            background: T.bgCardSolid, border: `1px solid ${T.border}`,
                                            borderRadius: T.r, boxShadow: T.shadowLg, padding: "1.1rem",
                                            zIndex: 1000, backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: "0.85rem",
                                        }}>
                                            {ADVANCED_GROUPS.map(group => (
                                                <div key={group.id}>
                                                    <div style={{
                                                        fontSize: "0.6rem",
                                                        fontWeight: 900,
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.08em",
                                                        color: T.textMuted,
                                                        marginBottom: 6,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 5,
                                                    }}>
                                                        <span>{group.icon}</span>
                                                        <span>{group.label}</span>
                                                    </div>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                        {group.tabs.map(tab => (
                                                            <button
                                                                key={tab.id}
                                                                onClick={() => { handleTabChange(tab.id); setOpenGroup(null); }}
                                                                className="lysia-btn lysia-focus"
                                                                style={{
                                                                    width: "100%", textAlign: "left", padding: "0.55rem 0.7rem",
                                                                    background: activeTab === tab.id ? T.accentDim : "transparent",
                                                                    border: "none", borderRadius: T.rSm,
                                                                    color: activeTab === tab.id ? T.accent : T.text,
                                                                    fontSize: T.fz.sm,
                                                                    fontWeight: activeTab === tab.id ? 800 : 500,
                                                                    cursor: "pointer",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "0.6rem",
                                                                }}
                                                            >
                                                                <span style={{ opacity: 0.85, width: 18, display: "inline-block", fontSize: T.fz.base }}>{tab.icon}</span>
                                                                <span>{tab.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </nav>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        {(isMobile || isTablet) && <button type="button" aria-expanded={showMobileMenu} aria-label={t("nav.menu_open")} onClick={() => setShowMobileMenu(!showMobileMenu)} style={{ background: "none", border: "none", color: T.text, fontSize: "1.5rem" }}>☰</button>}
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>{ALL_TABS.find(tabItem => tabItem.id === activeTab)?.label}</h2>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.5rem" : "1rem" }}>
                        {/* ═══ GLOBAL MOD BADGE — Otonom kurallar durumu her sayfada görünür ═══ */}
                        {autonomyStatus && (() => {
                            const mode = autonomyStatus.mode || "manual";
                            const within = autonomyStatus.withinWorkHours !== false;
                            const modeMeta = mode === "autonomous"
                                ? { color: T.green, icon: "🤖", label: "Tam Otonom" }
                                : mode === "supervised"
                                    ? { color: T.accent, icon: "👁️", label: "Denetimli" }
                                    : { color: T.textSec, icon: "✋", label: "Manuel" };
                            return (
                                <button
                                    onClick={() => handleTabChange("autonomy")}
                                    title={`AI çalışma modu: ${modeMeta.label}${!within ? " · ⏰ Çalışma saatleri dışı (AI pasif)" : ""} · Kurallara git`}
                                    className="lysia-btn lysia-focus lysia-anim-fade"
                                    style={{
                                        display: "flex", alignItems: "center", gap: "0.45rem",
                                        background: `${modeMeta.color}15`, border: `1px solid ${modeMeta.color}40`,
                                        padding: isMobile ? "0.35rem 0.6rem" : "0.5rem 0.85rem",
                                        borderRadius: T.rFull, cursor: "pointer",
                                    }}
                                >
                                    <span aria-hidden="true">{modeMeta.icon}</span>
                                    {!isMobile && (
                                        <span style={{ fontSize: T.fz.xs, fontWeight: 800, color: modeMeta.color, letterSpacing: "0.04em" }}>{modeMeta.label}</span>
                                    )}
                                    {!within && (
                                        <span style={{ fontSize: T.fz.xs, color: T.yellow }} title="Çalışma saatleri dışı">⏰</span>
                                    )}
                                </button>
                            );
                        })()}

                        {!isMobile && (
                            <div className="lysia-anim-fade" style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: T.bgGlass, padding: "0.5rem 1rem", borderRadius: T.rFull, border: `1px solid ${T.border}` }}>
                                <div className="lysia-status-blink" style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, color: T.green }} />
                                <span style={{ fontSize: T.fz.xs, fontWeight: 800, color: T.textSec, letterSpacing: "0.05em" }}>AI CORE ACTIVE</span>
                            </div>
                        )}

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

                        <button onClick={() => loadBrain(true)} className="lysia-btn lysia-focus" aria-label="Yenile" title="Yenile"
                            style={{ width: 40, height: 40, borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}`, color: T.textSec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.fz.md }}>
                            <span style={{ animation: refreshing ? "lysia-spin 1s linear infinite" : "none", display: "inline-block" }}>↻</span>
                        </button>
                    </div>
                </header>

                {error && brain && (
                    <div role="alert" style={{
                        margin: "0 1.5rem", marginTop: "0.75rem", padding: "0.65rem 1rem",
                        borderRadius: T.rSm, background: T.redDim, border: `1px solid ${T.red}35`,
                        color: T.text, fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap",
                    }}>
                        <span>{error}</span>
                        <button type="button" onClick={() => setError(null)} style={{
                            background: "transparent", border: `1px solid ${T.border}`, color: T.textSec,
                            borderRadius: T.rSm, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit",
                        }}>{t("error.dismiss")}</button>
                    </div>
                )}

                {/* ═══ SCROLLABLE CONTENT — tab değişimlerinde fade-in animasyon ═══ */}
                <main className="lysia-scroll" style={{
                    flex: 1,
                    overflowY: "auto",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    padding: isMobile ? "1rem 0.75rem" : "1.25rem clamp(0.75rem, 2vw, 1.75rem)",
                    position: "relative",
                }}>
                    {!brain ? (
                        <ErrorState
                            message={error || t("error.data_load_fail")}
                            onRetry={() => { setError(null); loadBrain(true); }}
                            retryLabel={t("header.refresh")}
                        />
                    ) : (
                        <div key={activeTab} className="lysia-anim-fade">
                            {renderTab()}
                        </div>
                    )}
                </main>

                {/* ═══ DIAGNOSIS MODAL ═══ */}
                <Modal open={showDiagnosis} onClose={() => setShowDiagnosis(false)}>
                    <ModalHeader icon="🩺" iconColor={T.purple} title={t("diag.title")} subtitle={t("diag.subtitle")} onClose={() => setShowDiagnosis(false)} />
                    <div style={{ padding: "1.5rem" }}>
                        {diagnosisLoading ? <LoadingState message={t("loading.analyzing")} /> : diagnosisData ? (
                            <>
                                <div style={{ textAlign: "center", padding: "2rem", borderRadius: T.r, border: `1px solid ${T.borderGlow}`, marginBottom: "1.5rem", background: T.gradientCard }}>
                                    <div style={{ width: 72, height: 72, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", marginBottom: "0.85rem", background: T.bgGlass, border: `1px solid ${T.border}`, boxShadow: T.shadowGlow }}>{diagnosisData.verdictEmoji}</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 900, background: T.gradientText, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t("diag.grade")}: {diagnosisData.healthGrade ?? "—"}</div>
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
            {(isMobile || isTablet) && showMobileMenu && (
                <div style={{ position: "fixed", inset: 0, background: T.bgOverlay, zIndex: 1000, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>PazarYonet AI</div>
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
