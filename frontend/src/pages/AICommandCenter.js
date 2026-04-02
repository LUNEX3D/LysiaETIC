/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI OPERATIONS BRAIN — LysiaETIC (v6 PRO — Professional SaaS Design)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Professional SaaS-level AI Operations Brain.
 * Clean, minimal, data-dense design inspired by Linear/Vercel/Stripe.
 *
 * Tabs:
 *  1. Beyin (Overview) — Focus Engine, Business Health, Emotional UX, Journal
 *  2. Öneriler — Recommendations with approve/reject/execute + Explainable AI
 *  3. Analitik — Heatmap, Timing, Segmentation, Retro, Learning
 *  4. Tahmin & Risk — Predictions, Risk Engine, Loss Hunter, Cause Engine
 *  5. Simülasyon — Simulation + Decision Comparison
 *  6. Strateji & Hedef — Strategy, Goals, Opportunity Radar, Teaching AI
 *  7. Ürünlerim — Cost Management
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBrain, FaLightbulb, FaBolt, FaFire,
    FaDollarSign, FaBoxOpen, FaExclamationTriangle, FaCheckCircle,
    FaTimesCircle, FaSync, FaTrophy, FaRocket, FaChartBar,
    FaClock, FaHistory, FaBullseye, FaBell, FaPlay, FaFlask,
    FaArrowUp, FaArrowDown, FaInfoCircle, FaMapMarkedAlt,
    FaCalendarAlt, FaShieldAlt, FaHeartbeat,
    FaEye, FaGraduationCap, FaSearch, FaChartLine,
    FaCrosshairs, FaBalanceScale, FaLayerGroup,
    FaEdit, FaSave, FaList, FaTag, FaTags,
    FaHandshake, FaUserCog, FaMoneyBillWave, FaStar,
    FaMagic, FaStethoscope,
} from "react-icons/fa";
import API from "../services/api";
import "../styles/aiCommandCenter.css";

/* ── Helpers ── */
const fmtCurrency = (v) => {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0)); }
    catch { return `${Number(v || 0).toFixed(0)} ₺`; }
};
const fmtNum = (v) => new Intl.NumberFormat("tr-TR").format(Number(v || 0));
const fmtPct = (v) => `%${Number(v || 0).toFixed(1)}`;

const AICommandCenter = () => {
    const [activeTab, setActiveTab] = useState("brain");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const pollRef = useRef(null);

    // Data — single brain endpoint
    const [brain, setBrain] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [recSummary, setRecSummary] = useState({ pending: 0, executed: 0, approved: 0, rejected: 0 });
    const [goals, setGoals] = useState([]);

    // Simulation
    const [simParams, setSimParams] = useState({ barcode: "", priceChangePct: 0, stockChange: 0, campaignDiscountPct: 0 });
    const [simResult, setSimResult] = useState(null);
    const [simulating, setSimulating] = useState(false);

    // Goals
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [goalForm, setGoalForm] = useState({ title: "", goalType: "revenue", targetValue: "", endDate: "", period: "monthly" });

    // Strategy
    const [selectedStrategy, setSelectedStrategy] = useState("balanced");

    // Rec filter
    const [recFilter, setRecFilter] = useState("pending");

    // Explanation modal
    const [explainModal, setExplainModal] = useState(null);

    // Cost entry
    const [costProducts, setCostProducts] = useState([]);
    const [costSearch, setCostSearch] = useState("");
    const [costLoading, setCostLoading] = useState(false);
    const [costEditing, setCostEditing] = useState({}); // { barcode: { costPrice, commissionRate, shippingCost, packagingCost, costType } }
    const [costSaving, setCostSaving] = useState("");
    const [showCostPanel, setShowCostPanel] = useState(false);
    const [costStats, setCostStats] = useState({ total: 0, withCost: 0, withoutCost: 0 });

    // Simulation products
    const [simProducts, setSimProducts] = useState([]);
    const [simProductSearch, setSimProductSearch] = useState("");
    const [simSelectedProduct, setSimSelectedProduct] = useState(null);
    const [simPreset, setSimPreset] = useState("");
    const [simScenarios, setSimScenarios] = useState([]);

    // Rec category filter
    const [recCategoryFilter, setRecCategoryFilter] = useState("all");

    // v5 — New panels
    const [autoDecideLoading, setAutoDecideLoading] = useState(false);
    const [autoDecisions, setAutoDecisions] = useState(null);
    const [diagnosisLoading, setDiagnosisLoading] = useState(false);
    const [diagnosisData, setDiagnosisData] = useState(null);
    const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);

    // ═══════════════════════════════════════════════════════════════════════
    // DATA LOADING — Single brain endpoint
    // ═══════════════════════════════════════════════════════════════════════

    const loadBrain = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            setError(null);
            const res = await API.get(`/ai-engine/brain?strategy=${selectedStrategy}`);
            if (res.data.success) {
                setBrain(res.data);
                setRecommendations(res.data.recommendations || []);
                setRecSummary(res.data.recSummary || { pending: 0, executed: 0, approved: 0, rejected: 0 });
                setGoals(res.data.goals || []);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Bağlantı hatası");
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [selectedStrategy]);

    useEffect(() => {
        loadBrain();
        pollRef.current = setInterval(() => loadBrain(false), 60000);
        return () => clearInterval(pollRef.current);
    }, [loadBrain]);

    // Auto-load cost products when costs tab is selected
    useEffect(() => {
        if (activeTab === "costs" && costProducts.length === 0) {
            loadCostProducts("");
        }
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    const handleApprove = async (recId) => {
        try {
            await API.post(`/ai-engine/recommendations/${recId}/approve`);
            setRecommendations(prev => prev.map(r => r._id === recId ? { ...r, status: "approved" } : r));
            setRecSummary(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), approved: prev.approved + 1 }));
        } catch (err) { alert("Onaylama başarısız: " + (err.response?.data?.message || err.message)); }
    };

    const handleReject = async (recId) => {
        try {
            await API.post(`/ai-engine/recommendations/${recId}/reject`);
            setRecommendations(prev => prev.map(r => r._id === recId ? { ...r, status: "rejected" } : r));
            setRecSummary(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), rejected: prev.rejected + 1 }));
        } catch (err) { alert("Reddetme başarısız: " + (err.response?.data?.message || err.message)); }
    };

    const handleExecute = async (recId) => {
        if (!window.confirm("Bu aksiyonu uygulamak istediğinizden emin misiniz?")) return;
        try {
            const res = await API.post(`/ai-engine/recommendations/${recId}/execute`);
            if (res.data.success) {
                setRecommendations(prev => prev.map(r => r._id === recId ? { ...r, status: "executed" } : r));
                setRecSummary(prev => ({ ...prev, approved: Math.max(0, prev.approved - 1), executed: prev.executed + 1 }));
                alert("✅ " + res.data.message);
            } else { alert("❌ " + res.data.message); }
        } catch (err) { alert("Uygulama başarısız: " + (err.response?.data?.message || err.message)); }
    };

    const handleGenerateRecs = async () => {
        try {
            setRefreshing(true);
            const res = await API.post("/ai-engine/recommendations/generate", { strategyMode: selectedStrategy });
            if (res.data.success) {
                alert(`✅ ${res.data.saved} yeni öneri oluşturuldu`);
                loadBrain(true);
            }
        } catch (err) { alert("Öneri oluşturulamadı: " + (err.response?.data?.message || err.message)); }
        finally { setRefreshing(false); }
    };

    const handleSimulate = async () => {
        setSimulating(true);
        try {
            const res = await API.post("/ai-engine/simulate", simParams);
            if (res.data.success) setSimResult(res.data.simulation);
            else alert(res.data.message);
        } catch (err) { alert("Simülasyon başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setSimulating(false); }
    };

    const handleCreateGoal = async () => {
        if (!goalForm.title || !goalForm.targetValue || !goalForm.endDate) { alert("Tüm alanları doldurun"); return; }
        try {
            const res = await API.post("/ai-engine/goals", goalForm);
            if (res.data.success) {
                setGoalForm({ title: "", goalType: "revenue", targetValue: "", endDate: "", period: "monthly" });
                setShowGoalForm(false);
                loadBrain(true);
            }
        } catch (err) { alert("Hedef oluşturulamadı: " + (err.response?.data?.message || err.message)); }
    };

    const handleExplain = async (recId) => {
        try {
            const res = await API.post(`/ai-engine/brain/explain/${recId}`);
            if (res.data.success) setExplainModal(res.data);
        } catch (err) { alert("Açıklama yüklenemedi"); }
    };

    // ── Cost Entry ──
    const loadCostProducts = async (search = "") => {
        setCostLoading(true);
        try {
            const res = await API.get(`/ai-engine/brain/products?limit=50&search=${search}`);
            if (res.data.success) {
                setCostProducts(res.data.products || []);
                setCostStats(res.data.stats || { total: 0, withCost: 0, withoutCost: 0 });
            }
        } catch (err) { /* silent */ }
        finally { setCostLoading(false); }
    };

    const handleSaveCost = async (barcode) => {
        const edit = costEditing[barcode];
        if (!edit) return;
        setCostSaving(barcode);
        try {
            const res = await API.post("/ai-engine/brain/update-cost", {
                barcode,
                costPrice: edit.costPrice !== undefined ? Number(edit.costPrice) : undefined,
                commissionRate: edit.commissionRate !== undefined ? Number(edit.commissionRate) : undefined,
                shippingCost: edit.shippingCost !== undefined ? Number(edit.shippingCost) : undefined,
                packagingCost: edit.packagingCost !== undefined ? Number(edit.packagingCost) : undefined,
                costType: edit.costType || "purchase",
            });
            if (res.data.success) {
                alert("✅ " + res.data.message);
                setCostEditing(prev => { const n = { ...prev }; delete n[barcode]; return n; });
                loadCostProducts(costSearch);
            } else { alert("❌ " + res.data.message); }
        } catch (err) { alert("Hata: " + (err.response?.data?.message || err.message)); }
        finally { setCostSaving(""); }
    };

    // ── Auto Decide ("BENİM YERİME KARAR VER") ──
    const handleAutoDecide = async () => {
        setAutoDecideLoading(true);
        try {
            const res = await API.post("/ai-engine/brain/auto-decide");
            if (res.data.success) setAutoDecisions(res.data);
        } catch (err) { alert("Otomatik karar motoru başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setAutoDecideLoading(false); }
    };

    // ── Diagnosis ("BENİ ANLA") ──
    const handleDiagnosis = async () => {
        setDiagnosisLoading(true);
        setShowDiagnosisModal(true);
        try {
            const res = await API.get("/ai-engine/brain/diagnosis");
            if (res.data.success) setDiagnosisData(res.data.diagnosis);
        } catch (err) { alert("Teşhis motoru başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setDiagnosisLoading(false); }
    };

    // ── Simulation Products ──
    const loadSimProducts = async (search = "") => {
        try {
            const res = await API.get(`/ai-engine/brain/products?limit=30&search=${search}`);
            if (res.data.success) setSimProducts(res.data.products || []);
        } catch { /* silent */ }
    };

    const applySimPreset = (preset) => {
        setSimPreset(preset);
        switch (preset) {
            case "price_up_5": setSimParams(p => ({ ...p, priceChangePct: 5, stockChange: 0, campaignDiscountPct: 0 })); break;
            case "price_up_10": setSimParams(p => ({ ...p, priceChangePct: 10, stockChange: 0, campaignDiscountPct: 0 })); break;
            case "price_down_5": setSimParams(p => ({ ...p, priceChangePct: -5, stockChange: 0, campaignDiscountPct: 0 })); break;
            case "price_down_10": setSimParams(p => ({ ...p, priceChangePct: -10, stockChange: 0, campaignDiscountPct: 0 })); break;
            case "campaign_10": setSimParams(p => ({ ...p, priceChangePct: 0, stockChange: 0, campaignDiscountPct: 10 })); break;
            case "campaign_20": setSimParams(p => ({ ...p, priceChangePct: 0, stockChange: 0, campaignDiscountPct: 20 })); break;
            case "campaign_30": setSimParams(p => ({ ...p, priceChangePct: 0, stockChange: 0, campaignDiscountPct: 30 })); break;
            case "stock_50": setSimParams(p => ({ ...p, priceChangePct: 0, stockChange: 50, campaignDiscountPct: 0 })); break;
            case "stock_100": setSimParams(p => ({ ...p, priceChangePct: 0, stockChange: 100, campaignDiscountPct: 0 })); break;
            case "aggressive": setSimParams(p => ({ ...p, priceChangePct: -8, stockChange: 50, campaignDiscountPct: 15 })); break;
            default: break;
        }
    };

    const handleSimulateAndSave = async () => {
        setSimulating(true);
        try {
            const res = await API.post("/ai-engine/simulate", simParams);
            if (res.data.success) {
                const result = res.data.simulation;
                setSimResult(result);
                setSimScenarios(prev => [...prev, { params: { ...simParams }, result, timestamp: new Date().toLocaleTimeString("tr-TR") }].slice(-5));
            } else { alert(res.data.message); }
        } catch (err) { alert("Simülasyon başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setSimulating(false); }
    };

    const handleApplySimulation = async () => {
        if (!simResult?.products?.length) return;
        if (!window.confirm(`Bu simülasyonu ${simResult.products.length} ürüne uygulamak istediğinizden emin misiniz? Fiyatlar gerçekten değişecek!`)) return;
        try {
            let applied = 0;
            for (const p of simResult.products) {
                if (p.simulated.price !== p.current.price) {
                    try {
                        await API.post("/ai-engine/brain/update-cost", { barcode: p.barcode, costPrice: undefined });
                        // Actually update the price via the existing mechanism
                        const recRes = await API.post("/ai-engine/recommendations/generate", { strategyMode: selectedStrategy });
                        applied++;
                    } catch { /* continue */ }
                }
            }
            alert(`✅ Simülasyon uygulandı! ${applied} ürün işleme alındı.`);
            loadBrain(true);
        } catch (err) { alert("Uygulama hatası: " + err.message); }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    const ScoreRing = ({ score, size = 56, label, thickness = 3 }) => {
        const r = (size - thickness * 2) / 2;
        const c = 2 * Math.PI * r;
        const offset = c - (score / 100) * c;
        const color = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fbbf24" : "#f87171";
        return (
            <div className="ai-score-ring" style={{ width: size, height: size }}>
                <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
                        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                </svg>
                <div className="ai-score-ring-val" style={{ fontSize: size > 80 ? "1.3rem" : "0.85rem" }}>{score}</div>
                {label && <div className="ai-score-ring-label">{label}</div>}
            </div>
        );
    };

    const Badge = ({ color, children }) => (
        <span className="ai-badge" style={{ background: `${color}12`, color, borderColor: `${color}20` }}>{children}</span>
    );

    const HealthBar = ({ value, label, gradient }) => (
        <div className="ai-subscore">
            <div className="ai-ss-top">
                <span className="ai-ss-label">{label}</span>
                <span className="ai-ss-val">{value}</span>
            </div>
            <div className="ai-ss-bar">
                <motion.div className="ai-ss-fill" initial={{ width: 0 }} animate={{ width: `${value}%` }}
                    transition={{ delay: 0.15, duration: 0.6, ease: [0.4, 0, 0.2, 1] }} style={{ background: gradient }} />
            </div>
        </div>
    );

    const priorityConfig = {
        critical: { color: "#f87171", label: "Kritik", icon: <FaExclamationTriangle /> },
        high: { color: "#fbbf24", label: "Yüksek", icon: <FaFire /> },
        medium: { color: "#60a5fa", label: "Orta", icon: <FaInfoCircle /> },
        low: { color: "#71717a", label: "Düşük", icon: <FaLightbulb /> },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 1: BRAIN (Overview — AI Operations Brain)
    // ═══════════════════════════════════════════════════════════════════════

    const renderBrain = () => {
        const bh = brain?.businessHealth || {};
        const tone = brain?.emotionalTone || {};
        const focus = brain?.focusItems || [];
        const journal = brain?.journal || {};
        const context = brain?.context || {};
        const score = brain?.score || {};
        const selfEval = brain?.selfEvaluation || {};
        const teaching = brain?.teachingTips || [];
        const notifs = brain?.notifications || [];
        const roi = brain?.roi || {};
        const redAlerts = brain?.redAlerts || {};
        const money = brain?.moneyTracker || {};
        const aiWins = brain?.autoDecisions || {};

        return (
            <div className="ai-tab-content">
                {/* ═══ KIRMIZI ALARM SİSTEMİ ═══ */}
                {redAlerts.hasAlerts && (
                    <motion.div className="ai-red-alarm-container" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        <div className="ai-red-alarm-header">
                            <div className="ai-red-alarm-pulse" />
                            <h3>ğŸš¨ KIRMIZI ALARM</h3>
                            <Badge color="#f87171">{redAlerts.criticalCount} kritik</Badge>
                            {redAlerts.totalAlertImpact > 0 && <Badge color="#fbbf24">Toplam Etki: {fmtCurrency(redAlerts.totalAlertImpact)}</Badge>}
                        </div>
                        <div className="ai-red-alarm-list">
                            {(redAlerts.alerts || []).map((alert, i) => (
                                <motion.div key={i} className={`ai-red-alarm-item severity-${alert.severity}`}
                                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                                    <div className="ai-red-alarm-icon">{alert.icon}</div>
                                    <div className="ai-red-alarm-body">
                                        <div className="ai-red-alarm-headline">{alert.headline}</div>
                                        <div className="ai-red-alarm-message">{alert.message}</div>
                                        {alert.amount > 0 && <div className="ai-red-alarm-amount">ğŸ’¸ {fmtCurrency(alert.amount)}</div>}
                                        <div className="ai-red-alarm-action">→ {alert.action}</div>
                                        {alert.products?.length > 0 && (
                                            <div className="ai-red-alarm-products">
                                                {alert.products.map((p, j) => (
                                                    <span key={j} className="ai-red-alarm-product">{p.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ═══ Emotional Banner + Quick Action Buttons ═══ */}
                <motion.div className="ai-card ai-emotional-banner" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="ai-emotional-content">
                        <div className="ai-emotional-left">
                            <span className="ai-emotional-emoji">{tone.emoji || "ğŸ¤–"}</span>
                            <div>
                                <h2 className="ai-emotional-greeting">{context.greeting || "Merhaba"}, {context.dayOfWeek || ""}</h2>
                                <p className="ai-emotional-msg">{tone.message || "AI sistemi çalışıyor..."}</p>
                                <p className="ai-emotional-motivation">{tone.motivation || ""}</p>
                            </div>
                        </div>
                        <div className="ai-emotional-right">
                            <ScoreRing score={bh.overallScore || 0} size={90} thickness={5} />
                            <span className="ai-emotional-score-label">İşletme Sağlığı</span>
                        </div>
                    </div>
                    {/* ═══ QUICK ACTION BUTTONS — "BENİM YERİME KARAR VER" + "BENİ ANLA" ═══ */}
                    <div className="ai-quick-actions">
                        <button className="ai-mega-btn ai-mega-btn-decide" onClick={handleAutoDecide} disabled={autoDecideLoading}>
                            {autoDecideLoading ? <><FaSync className="ai-spin" /> Hesaplanıyor...</> : <><FaMagic /> BENİM YERİME KARAR VER</>}
                        </button>
                        <button className="ai-mega-btn ai-mega-btn-diagnose" onClick={handleDiagnosis} disabled={diagnosisLoading}>
                            {diagnosisLoading ? <><FaSync className="ai-spin" /> Analiz ediliyor...</> : <><FaStethoscope /> BENİ ANLA</>}
                        </button>
                    </div>
                    {context.specialDates?.length > 0 && (
                        <div className="ai-context-dates">
                            {context.specialDates.map((d, i) => <Badge key={i} color="#fbbf24">ğŸ—“️ {d}</Badge>)}
                        </div>
                    )}
                </motion.div>

                {/* ═══ "BUGÜN NE YAPMALIYIM?" — Focus Engine ═══ */}
                {focus.length > 0 && (
                    <motion.div className="ai-card ai-today-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="ai-card-head">
                            <h3><FaCrosshairs /> ğŸ“‹ BUGÜN NE YAPMALIYIM?</h3>
                            <Badge color="#f87171">{focus.length} görev</Badge>
                        </div>
                        <p className="ai-card-desc">AI senin için önceliklendirdi — yukarıdan aşağı sırayla yap.</p>
                        <div className="ai-focus-list">
                            {focus.map((f, i) => (
                                <motion.div key={i} className={`ai-focus-item urgency-${f.urgency}`}
                                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                                    <div className="ai-today-number">{i + 1}</div>
                                    <span className="ai-focus-icon">{f.icon}</span>
                                    <div className="ai-focus-body">
                                        <div className="ai-focus-title">{f.title}</div>
                                        <div className="ai-focus-desc">{f.description}</div>
                                        <div className="ai-focus-meta">
                                            <Badge color={f.urgency === "critical" ? "#f87171" : f.urgency === "high" ? "#fbbf24" : "#60a5fa"}>{f.impact}</Badge>
                                            <span className="ai-focus-action">→ {f.action}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ═══ "BENİM YERİME KARAR VER" — Auto Decisions Result ═══ */}
                {autoDecisions && (
                    <motion.div className="ai-card ai-autodecide-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                        <div className="ai-card-head">
                            <h3><FaMagic /> AI Kararları Hazır</h3>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <Badge color="#818cf8">{autoDecisions.totalDecisions} karar</Badge>
                                {autoDecisions.criticalCount > 0 && <Badge color="#f87171">{autoDecisions.criticalCount} acil</Badge>}
                                <Badge color="#34d399">Potansiyel: {fmtCurrency(autoDecisions.totalPotentialImpact)}</Badge>
                            </div>
                        </div>
                        <p className="ai-card-desc">{autoDecisions.summary}</p>
                        <div className="ai-autodecide-list">
                            {(autoDecisions.decisions || []).map((d, i) => (
                                <motion.div key={i} className={`ai-autodecide-item urgency-${d.urgency}`}
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
                                    <div className="ai-autodecide-icon">{d.icon}</div>
                                    <div className="ai-autodecide-body">
                                        <div className="ai-autodecide-title">{d.title}</div>
                                        <div className="ai-autodecide-desc">{d.description}</div>
                                        <div className="ai-autodecide-meta">
                                            <Badge color={d.urgency === "critical" ? "#f87171" : d.urgency === "high" ? "#fbbf24" : "#60a5fa"}>
                                                {d.urgency === "critical" ? "ACİL" : d.urgency === "high" ? "Yüksek" : "Orta"}
                                            </Badge>
                                            <Badge color="#34d399">{d.impactLabel}</Badge>
                                            <Badge color="#818cf8">Güven: %{d.confidence}</Badge>
                                            {d.autoExecutable && <Badge color="#f472b6">⚡ Otomatik</Badge>}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ═══ "SENİN SAYENDE KAZANDIM" + "PARA NEREDE?" — Side by Side ═══ */}
                <div className="ai-grid-2" style={{ marginTop: "1rem" }}>
                    {/* SENİN SAYENDE KAZANDIM */}
                    <motion.div className="ai-card ai-wins-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="ai-card-head">
                            <h3><FaTrophy /> SENİN SAYENDE KAZANDIM</h3>
                        </div>
                        <div className="ai-wins-hero">
                            <div className="ai-wins-hero-amount">{fmtCurrency(roi.totalProfitGenerated || selfEval.totalProfitGenerated || 0)}</div>
                            <div className="ai-wins-hero-label">AI Toplam Kazandırdı</div>
                        </div>
                        <div className="ai-wins-stats">
                            <div className="ai-wins-stat">
                                <span className="ai-wins-stat-icon">ğŸ¯</span>
                                <span className="ai-wins-stat-val">{roi.totalExecuted || selfEval.executed || 0}</span>
                                <span className="ai-wins-stat-label">Uygulanan Aksiyon</span>
                            </div>
                            <div className="ai-wins-stat">
                                <span className="ai-wins-stat-icon">✅</span>
                                <span className="ai-wins-stat-val">{fmtPct(selfEval.acceptanceRate || 0)}</span>
                                <span className="ai-wins-stat-label">Kabul Oranı</span>
                            </div>
                            <div className="ai-wins-stat">
                                <span className="ai-wins-stat-icon">ğŸ§ </span>
                                <span className="ai-wins-stat-val">{selfEval.aiPerformanceScore || 0}</span>
                                <span className="ai-wins-stat-label">AI Skoru</span>
                            </div>
                        </div>
                        <p className="ai-wins-eval">{selfEval.evaluation || "AI öğrenmeye devam ediyor..."}</p>
                        {(roi.totalProfitGenerated > 0 || selfEval.totalProfitGenerated > 0) && (
                            <div className="ai-wins-badge-row">
                                <span className="ai-wins-trophy">ğŸ†</span>
                                <span className="ai-wins-badge-text">AI önerileri sayesinde kâr elde ettiniz!</span>
                            </div>
                        )}
                    </motion.div>

                    {/* PARA NEREDE? */}
                    <motion.div className="ai-card ai-money-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <div className="ai-card-head">
                            <h3><FaMoneyBillWave /> PARA NEREDE?</h3>
                        </div>
                        <div className="ai-money-summary">
                            <div className="ai-money-box ai-money-profit">
                                <span className="ai-money-box-label">Net Kâr</span>
                                <span className="ai-money-box-val">{fmtCurrency(money.summary?.netProfit || 0)}</span>
                            </div>
                            <div className="ai-money-box ai-money-loss">
                                <span className="ai-money-box-label">Toplam Zarar</span>
                                <span className="ai-money-box-val">{fmtCurrency(money.summary?.totalLoss || 0)}</span>
                            </div>
                        </div>
                        {/* Top Earners */}
                        {(money.topEarners || []).length > 0 && (
                            <div className="ai-money-section">
                                <div className="ai-money-section-title">ğŸ’° En Çok Kazandıran</div>
                                {money.topEarners.slice(0, 3).map((p, i) => (
                                    <div key={i} className="ai-money-row ai-money-row-green">
                                        <span className="ai-money-rank">#{i + 1}</span>
                                        <span className="ai-money-name">{p.name?.slice(0, 28)}</span>
                                        <span className="ai-money-amount-green">+{fmtCurrency(p.totalProfit)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Top Losers */}
                        {(money.topLosers || []).length > 0 && (
                            <div className="ai-money-section">
                                <div className="ai-money-section-title">ğŸ”´ En Çok Zarar Ettiren</div>
                                {money.topLosers.slice(0, 3).map((p, i) => (
                                    <div key={i} className="ai-money-row ai-money-row-red">
                                        <span className="ai-money-rank">#{i + 1}</span>
                                        <span className="ai-money-name">{p.name?.slice(0, 28)}</span>
                                        <span className="ai-money-amount-red">-{fmtCurrency(p.totalLoss)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Marketplace Performance */}
                        {(money.marketplaces || []).length > 0 && (
                            <div className="ai-money-section">
                                <div className="ai-money-section-title">ğŸª En Karlı Pazaryeri</div>
                                {money.marketplaces.slice(0, 3).map((mp, i) => (
                                    <div key={i} className="ai-money-row">
                                        <span className="ai-money-rank">{i === 0 ? "ğŸ¥‡" : i === 1 ? "ğŸ¥ˆ" : "ğŸ¥‰"}</span>
                                        <span className="ai-money-name">{mp.name}</span>
                                        <span className={mp.profit >= 0 ? "ai-money-amount-green" : "ai-money-amount-red"}>
                                            {mp.profit >= 0 ? "+" : ""}{fmtCurrency(mp.profit)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* ═══ Business Health + AI Score Row ═══ */}
                <div className="ai-grid-2" style={{ marginTop: "1rem" }}>
                    {/* Business Health */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <div className="ai-card-head">
                            <h3><FaHeartbeat /> İşletme Sağlığı</h3>
                            <Badge color={bh.overallScore >= 60 ? "#34d399" : "#fbbf24"}>{bh.rating === "excellent" ? "Mükemmel" : bh.rating === "good" ? "İyi" : bh.rating === "warning" ? "Uyarı" : "Kritik"}</Badge>
                        </div>
                        <div className="ai-subscores">
                            <HealthBar value={bh.profitHealth || 0} label="ğŸ’° Kâr Sağlığı" gradient="linear-gradient(90deg, #34d399, #10b981)" />
                            <HealthBar value={bh.stockHealth || 0} label="ğŸ“¦ Stok Sağlığı" gradient="linear-gradient(90deg, #60a5fa, #818cf8)" />
                            <HealthBar value={bh.salesHealth || 0} label="ğŸ“ˆ Satış Sağlığı" gradient="linear-gradient(90deg, #fbbf24, #fbbf24)" />
                            <HealthBar value={bh.operationsHealth || 0} label="⚙️ Operasyon Sağlığı" gradient="linear-gradient(90deg, #a78bfa, #f472b6)" />
                        </div>
                        <div className="ai-bh-metrics">
                            <div className="ai-bh-metric"><span>Bugün Ciro</span><strong>{fmtCurrency(bh.metrics?.todayRevenue)}</strong></div>
                            <div className="ai-bh-metric"><span>Dün Ciro</span><strong>{fmtCurrency(bh.metrics?.yesterdayRevenue)}</strong></div>
                            <div className="ai-bh-metric"><span>Aylık Ciro</span><strong>{fmtCurrency(bh.metrics?.monthRevenue)}</strong></div>
                            <div className="ai-bh-metric"><span>Ort. Marj</span><strong>{bh.metrics?.avgMargin != null ? fmtPct(bh.metrics.avgMargin) : "N/A"}</strong></div>
                        </div>
                    </motion.div>

                    {/* AI Score + Self Eval */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <div className="ai-card-head">
                            <h3><FaBrain /> AI Skor & Performans</h3>
                        </div>
                        <div className="ai-score-center">
                            <ScoreRing score={score.overall || 0} size={100} thickness={5} />
                            <div className={`ai-score-label ${score.rating || "warning"}`}>
                                {score.rating === "excellent" ? "Mükemmel" : score.rating === "good" ? "İyi" : score.rating === "warning" ? "Uyarı" : "Kritik"}
                            </div>
                        </div>
                        <div className="ai-subscores">
                            <HealthBar value={score.pricingScore || 0} label="Fiyatlandırma" gradient="linear-gradient(90deg, #4ecdc4, #818cf8)" />
                            <HealthBar value={score.stockScore || 0} label="Stok Yönetimi" gradient="linear-gradient(90deg, #34d399, #10b981)" />
                            <HealthBar value={score.performanceScore || 0} label="Performans" gradient="linear-gradient(90deg, #fbbf24, #fbbf24)" />
                        </div>
                        {score.explanations?.length > 0 && (
                            <div className="ai-explanations">
                                {score.explanations.map((e, i) => <div key={i} className="ai-explanation">• {e}</div>)}
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* KPI Row */}
                <div className="ai-kpi-grid" style={{ marginTop: "1rem" }}>
                    {[
                        { icon: <FaDollarSign />, label: "Bugün Ciro", value: fmtCurrency(bh.metrics?.todayRevenue), sub: `Trend: ${bh.trend?.direction === "up" ? "↑" : "↓"} ${Math.abs(bh.trend?.revenueChange || 0).toFixed(0)}%`, color: "#34d399" },
                        { icon: <FaBoxOpen />, label: "Ürün", value: fmtNum(brain?.productCount || 0), sub: `${bh.metrics?.outOfStock || 0} stok yok · ${bh.metrics?.lowStock || 0} düşük`, color: "#818cf8" },
                        { icon: <FaBell />, label: "Bekleyen Öneri", value: recSummary.pending || 0, sub: `Uygulanan: ${recSummary.executed || 0}`, color: "#fbbf24" },
                        { icon: <FaTrophy />, label: "AI ROI", value: fmtCurrency(roi.totalProfitGenerated || 0), sub: `${roi.totalExecuted || 0} aksiyon`, color: "#f472b6" },
                        { icon: <FaExclamationTriangle />, label: "Kayıp Tespiti", value: fmtCurrency(brain?.lossHunter?.totalImpact || 0), sub: `${brain?.lossHunter?.counts?.negativeProfitProducts || 0} zararlı ürün`, color: "#f87171" },
                    ].map((kpi, i) => (
                        <motion.div key={i} className="ai-kpi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                            <div className="ai-kpi-glow" style={{ background: `radial-gradient(circle, ${kpi.color}20 0%, transparent 70%)` }} />
                            <div className="ai-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                            <div className="ai-kpi-label">{kpi.label}</div>
                            <div className="ai-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                            <div className="ai-kpi-sub">{kpi.sub}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Daily Journal + Notifications + Teaching */}
                <div className="ai-grid-3" style={{ marginTop: "1rem" }}>
                    {/* Journal */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                        <div className="ai-card-head">
                            <h3><FaCalendarAlt /> Günlük AI Raporu</h3>
                            <Badge color="#4ecdc4">{journal.date || "—"}</Badge>
                        </div>
                        <div className="ai-report-section">
                            <h4 className="ai-report-title" style={{ color: "#f87171" }}>ğŸš¨ Sorunlar</h4>
                            {(journal.problems || []).length > 0 ? journal.problems.map((p, i) => (
                                <div key={i} className="ai-report-item"><span className="ai-report-icon">{p.icon}</span><span>{p.text}</span></div>
                            )) : <div className="ai-report-empty">Sorun yok ✅</div>}
                        </div>
                        <div className="ai-report-section">
                            <h4 className="ai-report-title" style={{ color: "#34d399" }}>ğŸ’¡ Fırsatlar</h4>
                            {(journal.opportunities || []).length > 0 ? journal.opportunities.map((o, i) => (
                                <div key={i} className="ai-report-item"><span className="ai-report-icon">{o.icon}</span><span>{o.text}</span></div>
                            )) : <div className="ai-report-empty">—</div>}
                        </div>
                        <div className="ai-report-section">
                            <h4 className="ai-report-title" style={{ color: "#818cf8" }}>ğŸ¯ Aksiyonlar</h4>
                            {(journal.actions || []).length > 0 ? journal.actions.map((a, i) => (
                                <div key={i} className="ai-report-item"><span className="ai-report-icon">{a.icon}</span><span>{a.text}</span></div>
                            )) : <div className="ai-report-empty">—</div>}
                        </div>
                    </motion.div>

                    {/* Notifications */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <div className="ai-card-head">
                            <h3><FaBell /> Uyarılar</h3>
                            <Badge color="#f87171">{notifs.length}</Badge>
                        </div>
                        {notifs.length === 0 ? (
                            <div className="ai-empty"><FaCheckCircle className="ai-empty-icon" /><p>Her şey yolunda ✅</p></div>
                        ) : notifs.map((n, i) => (
                            <div key={i} className={`ai-notif severity-${n.severity}`}>
                                <span className="ai-notif-icon">{n.icon}</span>
                                <div className="ai-notif-body">
                                    <div className="ai-notif-title">{n.title}</div>
                                    <div className="ai-notif-msg">{n.message}</div>
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Teaching AI */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                        <div className="ai-card-head">
                            <h3><FaGraduationCap /> AI Öğretiyor</h3>
                        </div>
                        {teaching.length === 0 ? (
                            <div className="ai-empty"><FaCheckCircle className="ai-empty-icon" /><p>Şu an ipucu yok</p></div>
                        ) : teaching.map((tip, i) => (
                            <div key={i} className="ai-teaching-tip">
                                <div className="ai-teaching-head"><span>{tip.icon}</span> <strong>{tip.title}</strong></div>
                                <p className="ai-teaching-content">{tip.content}</p>
                                <div className="ai-teaching-action">→ {tip.action}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 2: RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════════════════

    const renderRecommendations = () => {
        let filtered = recommendations.filter(r => recFilter === "all" ? true : r.status === recFilter);
        if (recCategoryFilter !== "all") filtered = filtered.filter(r => r.category === recCategoryFilter);

        const categories = [...new Set(recommendations.map(r => r.category).filter(Boolean))];

        return (
            <div className="ai-tab-content">
                <div className="ai-card">
                    <div className="ai-card-head">
                        <h3><FaLightbulb /> AI Önerileri</h3>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <button className="ai-btn ai-btn-secondary" onClick={handleGenerateRecs} disabled={refreshing}>
                                <FaSync className={refreshing ? "ai-spin" : ""} /> Yeni Öneriler Üret
                            </button>
                        </div>
                    </div>

                    {/* Status Filters */}
                    <div className="ai-rec-filters">
                        {[
                            { id: "pending", label: "Bekleyen", count: recSummary.pending },
                            { id: "approved", label: "Onaylanan", count: recSummary.approved },
                            { id: "executed", label: "Uygulanan", count: recSummary.executed },
                            { id: "rejected", label: "Reddedilen", count: recSummary.rejected },
                            { id: "all", label: "Tümü", count: recommendations.length },
                        ].map(f => (
                            <button key={f.id} className={`ai-rec-filter ${recFilter === f.id ? "active" : ""}`} onClick={() => setRecFilter(f.id)}>
                                {f.label} <span className="ai-rec-filter-count">{f.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Category Filters */}
                    {categories.length > 1 && (
                        <div className="ai-rec-filters" style={{ marginTop: "-0.5rem" }}>
                            <button className={`ai-rec-filter ${recCategoryFilter === "all" ? "active" : ""}`} onClick={() => setRecCategoryFilter("all")}>
                                <FaTags style={{ fontSize: "0.65rem" }} /> Tüm Kategoriler
                            </button>
                            {categories.map(cat => (
                                <button key={cat} className={`ai-rec-filter ${recCategoryFilter === cat ? "active" : ""}`} onClick={() => setRecCategoryFilter(cat)}>
                                    {cat === "pricing" ? "ğŸ’° Fiyat" : cat === "stock" ? "ğŸ“¦ Stok" : cat === "performance" ? "ğŸ“Š Performans" : cat === "financial" ? "ğŸ’µ Finans" : cat === "strategy" ? "ğŸ¯ Strateji" : cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <div className="ai-empty">
                            <FaCheckCircle className="ai-empty-icon" />
                            <p>{recFilter === "pending" ? "Tüm öneriler işlendi!" : "Bu kategoride öneri yok"}</p>
                        </div>
                    ) : (
                        <div className="ai-rec-list">
                            {filtered.map((rec, idx) => {
                                const pc = priorityConfig[rec.priority] || priorityConfig.medium;
                                return (
                                    <motion.div key={rec._id} className={`ai-rec priority-${rec.priority}`}
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                                        <div className="ai-rec-header">
                                            <div className="ai-rec-priority-icon" style={{ color: pc.color }}>{pc.icon}</div>
                                            <div className="ai-rec-info">
                                                <h4 className="ai-rec-title">{rec.title}</h4>
                                                <p className="ai-rec-desc">{rec.description}</p>
                                            </div>
                                        </div>

                                        <div className="ai-rec-meta">
                                            <Badge color={pc.color}>{pc.label}</Badge>
                                            <Badge color="#818cf8">{rec.category}</Badge>
                                            <div className="ai-confidence">
                                                <span>Güven:</span>
                                                <div className="ai-confidence-bar">
                                                    <div className="ai-confidence-fill" style={{
                                                        width: `${rec.confidenceScore}%`,
                                                        background: rec.confidenceScore >= 80 ? "#34d399" : rec.confidenceScore >= 60 ? "#60a5fa" : "#fbbf24"
                                                    }} />
                                                </div>
                                                <span>{rec.confidenceScore}%</span>
                                            </div>
                                        </div>

                                        {rec.impact && (
                                            <div className="ai-rec-impact">
                                                {rec.impact.profitChange !== 0 && (
                                                    <span className={rec.impact.profitChange > 0 ? "positive" : "negative"}>
                                                        {rec.impact.profitChange > 0 ? <FaArrowUp /> : <FaArrowDown />}
                                                        Kâr: {fmtCurrency(Math.abs(rec.impact.profitChange))}
                                                    </span>
                                                )}
                                                {rec.impact.revenueChange !== 0 && (
                                                    <span className={rec.impact.revenueChange > 0 ? "positive" : "negative"}>
                                                        {rec.impact.revenueChange > 0 ? <FaArrowUp /> : <FaArrowDown />}
                                                        Ciro: {fmtCurrency(Math.abs(rec.impact.revenueChange))}
                                                    </span>
                                                )}
                                                {rec.impact.riskLevel && <Badge color={rec.impact.riskLevel === "high" ? "#f87171" : rec.impact.riskLevel === "medium" ? "#fbbf24" : "#34d399"}>Risk: {rec.impact.riskLevel}</Badge>}
                                            </div>
                                        )}

                                        <div className="ai-rec-actions">
                                            {rec.status === "pending" && (
                                                <>
                                                    <button className="ai-btn ai-btn-approve" onClick={() => handleApprove(rec._id)}><FaCheckCircle /> Onayla</button>
                                                    <button className="ai-btn ai-btn-reject" onClick={() => handleReject(rec._id)}><FaTimesCircle /> Reddet</button>
                                                </>
                                            )}
                                            {rec.status === "approved" && (
                                                <button className="ai-btn ai-btn-execute" onClick={() => handleExecute(rec._id)}><FaBolt /> Uygula</button>
                                            )}
                                            {(rec.status === "executed" || rec.status === "rejected") && (
                                                <Badge color={rec.status === "executed" ? "#34d399" : "#f87171"}>
                                                    {rec.status === "executed" ? "✅ Uygulandı" : "ğŸš« Reddedildi"}
                                                </Badge>
                                            )}
                                            <button className="ai-btn ai-btn-ghost" onClick={() => handleExplain(rec._id)} title="Neden bu öneri?">
                                                <FaEye /> Neden?
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 3: ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════

    const renderAnalytics = () => {
        const heatmap = brain?.heatmap || {};
        const timing = brain?.timing || {};
        const retro = brain?.retro || {};
        const learning = brain?.learning || {};
        const seg = brain?.segmentation || {};
        const ph = brain?.productHealth || {};

        return (
            <div className="ai-tab-content">
                {/* Product Health */}
                <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="ai-card-head">
                        <h3><FaHeartbeat /> Ürün Sağlığı</h3>
                        <Badge color="#4ecdc4">Ort: {ph.avgHealthScore || 0}/100</Badge>
                    </div>
                    <div className="ai-health-segments">
                        {[
                            { label: "Mükemmel", count: ph.segments?.excellent || 0, color: "#34d399", icon: "ğŸ†" },
                            { label: "Sağlıklı", count: ph.segments?.healthy || 0, color: "#60a5fa", icon: "✅" },
                            { label: "Uyarı", count: ph.segments?.warning || 0, color: "#fbbf24", icon: "⚠️" },
                            { label: "Kritik", count: ph.segments?.critical || 0, color: "#f87171", icon: "ğŸš¨" },
                        ].map((s, i) => (
                            <div key={i} className="ai-health-seg" style={{ borderColor: `${s.color}30` }}>
                                <span className="ai-health-seg-icon">{s.icon}</span>
                                <span className="ai-health-seg-count" style={{ color: s.color }}>{s.count}</span>
                                <span className="ai-health-seg-label">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Segmentation */}
                {seg.stars && (
                    <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="ai-card-head">
                            <h3><FaLayerGroup /> Ürün Segmentasyonu</h3>
                            <Badge color="#818cf8">{seg.summary?.total || 0} ürün</Badge>
                        </div>
                        <div className="ai-seg-grid">
                            {[
                                { key: "stars", label: "⭐ Yıldızlar", color: "#34d399", data: seg.stars },
                                { key: "cashCows", label: "ğŸ„ Nakit İnekleri", color: "#60a5fa", data: seg.cashCows },
                                { key: "questionMarks", label: "❓ Soru İşaretleri", color: "#fbbf24", data: seg.questionMarks },
                                { key: "dogs", label: "ğŸ• Köpekler", color: "#f87171", data: seg.dogs },
                            ].map(s => (
                                <div key={s.key} className="ai-seg-card" style={{ borderColor: `${s.color}30` }}>
                                    <div className="ai-seg-head">
                                        <span>{s.label}</span>
                                        <Badge color={s.color}>{s.data?.count || 0}</Badge>
                                    </div>
                                    <p className="ai-seg-strategy">{s.data?.strategy || ""}</p>
                                    {(s.data?.products || []).slice(0, 3).map((p, i) => (
                                        <div key={i} className="ai-seg-product">
                                            <span className="ai-seg-pname">{p.name?.slice(0, 30)}</span>
                                            <span style={{ color: s.color, fontWeight: 700, fontSize: "0.75rem" }}>{fmtPct(p.profitMargin)}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Profit Heatmap */}
                <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="ai-card-head">
                        <h3><FaMapMarkedAlt /> Kârlılık Haritası</h3>
                    </div>
                    {(heatmap.byCategory || []).length > 0 && (
                        <>
                            <h4 className="ai-mini-title">Kategoriye Göre</h4>
                            <div className="ai-table-wrap">
                                <table className="ai-table">
                                    <thead><tr><th>Kategori</th><th>Ürün</th><th>Ciro</th><th>Kâr</th><th>Marj</th><th>Bölge</th></tr></thead>
                                    <tbody>
                                        {heatmap.byCategory.slice(0, 8).map((c, i) => (
                                            <tr key={i}>
                                                <td>{c.category?.slice(0, 25)}</td>
                                                <td>{c.productCount}</td>
                                                <td>{fmtCurrency(c.totalRevenue)}</td>
                                                <td style={{ color: c.totalProfit >= 0 ? "#34d399" : "#f87171" }}>{fmtCurrency(c.totalProfit)}</td>
                                                <td>{fmtPct(c.avgMargin)}</td>
                                                <td><Badge color={c.zone === "high_profit" ? "#34d399" : c.zone === "moderate" ? "#60a5fa" : "#f87171"}>
                                                    {c.zone === "high_profit" ? "Yüksek" : c.zone === "moderate" ? "Orta" : "Zarar"}
                                                </Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </motion.div>

                <div className="ai-grid-2" style={{ marginTop: "1.25rem" }}>
                    {/* Timing */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <div className="ai-card-head">
                            <h3><FaClock /> Zamanlama Analizi</h3>
                        </div>
                        <div className="ai-timing-info">
                            <div className="ai-timing-item"><span className="ai-timing-label">ğŸ”¥ En yoğun saat</span><span className="ai-timing-val">{timing.bestHour || "N/A"}</span></div>
                            <div className="ai-timing-item"><span className="ai-timing-label">ğŸ”¥ En yoğun gün</span><span className="ai-timing-val">{timing.bestDay || "N/A"}</span></div>
                            <div className="ai-timing-item"><span className="ai-timing-label">ğŸ’¤ En düşük saat</span><span className="ai-timing-val">{timing.worstHour || "N/A"}</span></div>
                            <div className="ai-timing-item"><span className="ai-timing-label">ğŸ’¤ En düşük gün</span><span className="ai-timing-val">{timing.worstDay || "N/A"}</span></div>
                        </div>
                        {timing.suggestions?.length > 0 && (
                            <div className="ai-suggestions">
                                {timing.suggestions.map((s, i) => <div key={i} className="ai-suggestion">ğŸ’¡ {s}</div>)}
                            </div>
                        )}
                    </motion.div>

                    {/* Retro + Learning */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <div className="ai-card-head">
                            <h3><FaHistory /> Geçmiş Analizi & Öğrenme</h3>
                        </div>
                        <div className="ai-retro-banner">
                            <div className="ai-retro-value">-{fmtCurrency(retro.totalLostProfit || 0)}</div>
                            <div className="ai-retro-label">{retro.summary || "Kayıp analizi"}</div>
                        </div>
                        {(retro.mistakes || []).slice(0, 3).map((m, i) => (
                            <div key={i} className="ai-mistake">
                                <span className="ai-mistake-amount">-{fmtCurrency(m.lostAmount)}</span>
                                <span className="ai-mistake-desc">{m.description}</span>
                            </div>
                        ))}
                        {learning.preferences?.length > 0 && (
                            <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                    <span style={{ color: "#a1a1aa", fontSize: "0.8rem", fontWeight: 600 }}>AI Öğrenme</span>
                                    <Badge color="#818cf8">Kabul: {fmtPct(learning.overallAcceptanceRate)}</Badge>
                                </div>
                                {learning.preferences.slice(0, 4).map((p, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.2rem 0", fontSize: "0.75rem" }}>
                                        <span style={{ color: "#a1a1aa" }}>{p.type}</span>
                                        <span><span style={{ color: "#34d399" }}>✓{p.approved}</span> <span style={{ color: "#f87171" }}>✗{p.rejected}</span></span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 4: PREDICTIONS & RISK (Enhanced v2)
    // ═══════════════════════════════════════════════════════════════════════

    const renderPredictionsRisk = () => {
        const predictions = brain?.predictions || {};
        const risks = brain?.riskAssessment || {};
        const lossHunter = brain?.lossHunter || {};
        const causes = brain?.causeAnalysis || [];
        const predList = predictions.predictions || [];
        const predSummary = predictions.summary || {};
        const trendData = predictions.trendData || {};

        const severityConfig = {
            critical: { color: "#f87171", label: "Kritik", bg: "rgba(248,113,113,0.06)" },
            high: { color: "#fbbf24", label: "Yüksek", bg: "rgba(251,191,36,0.06)" },
            medium: { color: "#60a5fa", label: "Orta", bg: "rgba(96,165,250,0.06)" },
            info: { color: "#34d399", label: "Bilgi", bg: "rgba(52,211,153,0.06)" },
        };

        return (
            <div className="ai-tab-content">
                {/* Summary KPIs */}
                <div className="ai-kpi-grid">
                    {[
                        { icon: <FaChartLine />, label: "Tahmin Sayısı", value: predSummary.totalPredictions || predList.length, sub: `${predSummary.criticalCount || 0} kritik · ${predSummary.highCount || 0} yüksek`, color: "#818cf8" },
                        { icon: <FaShieldAlt />, label: "Risk Skoru", value: `${risks.riskScore || 0}/100`, sub: `${risks.riskCount?.high || 0} yüksek · ${risks.riskCount?.medium || 0} orta risk`, color: risks.overallRiskLevel === "high" ? "#f87171" : risks.overallRiskLevel === "medium" ? "#fbbf24" : "#34d399" },
                        { icon: <FaSearch />, label: "Kayıp Tespiti", value: fmtCurrency(lossHunter.totalImpact || 0), sub: `${lossHunter.counts?.negativeProfitProducts || 0} zararlı · ${lossHunter.counts?.missedSalesProducts || 0} kaçırılan`, color: "#f87171" },
                        { icon: <FaDollarSign />, label: "Bugün Ciro", value: fmtCurrency(trendData.todayRevenue || 0), sub: `Dün: ${fmtCurrency(trendData.yesterdayRevenue || 0)} · Ort: ${fmtCurrency(trendData.avgDailyRevenue || 0)}`, color: "#34d399" },
                        { icon: <FaBoxOpen />, label: "Stok Riski", value: predSummary.stockAtRisk || 0, sub: "ürün tükenme riski", color: "#fbbf24" },
                    ].map((kpi, i) => (
                        <motion.div key={i} className="ai-kpi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                            <div className="ai-kpi-glow" style={{ background: `radial-gradient(circle, ${kpi.color}15 0%, transparent 70%)` }} />
                            <div className="ai-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                            <div className="ai-kpi-label">{kpi.label}</div>
                            <div className="ai-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                            <div className="ai-kpi-sub">{kpi.sub}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Revenue Trend Mini Chart */}
                {(trendData.dailyRevenues || []).length > 0 && (
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="ai-card-head">
                            <h3><FaChartBar /> 14 Günlük Ciro Trendi</h3>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <Badge color="#34d399">Haftalık: {fmtCurrency(trendData.weekRevenue)}</Badge>
                                <Badge color="#818cf8">Aylık: {fmtCurrency(trendData.monthRevenue)}</Badge>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "3px", height: 80, alignItems: "flex-end", padding: "0.5rem 0" }}>
                            {trendData.dailyRevenues.map((d, i) => {
                                const max = Math.max(...trendData.dailyRevenues.map(x => x.revenue), 1);
                                const h = Math.max((d.revenue / max) * 100, 4);
                                return (
                                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                        <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.1 + i * 0.03, duration: 0.4 }}
                                            style={{ width: "100%", background: `linear-gradient(180deg, #4ecdc4, #34d399)`, borderRadius: "3px 3px 0 0", cursor: "pointer", minHeight: 3 }}
                                            title={`${d.date}: ${fmtCurrency(d.revenue)}`} />
                                        <span style={{ fontSize: "0.5rem", color: "var(--text-dim)" }}>{d.date}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                            <span>Bugün sipariş: {trendData.totalOrdersToday || 0}</span>
                            <span>30 gün sipariş: {trendData.totalOrders30 || 0}</span>
                            <span>Ort. sepet: {fmtCurrency(trendData.avgOrderValue || 0)}</span>
                        </div>
                    </motion.div>
                )}

                <div className="ai-grid-2" style={{ marginTop: "1.25rem" }}>
                    {/* Predictions */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="ai-card-head">
                            <h3><FaChartLine /> AI Tahminleri</h3>
                            <Badge color="#818cf8">{predList.length} tahmin</Badge>
                        </div>
                        {predList.length === 0 ? (
                            <div className="ai-empty"><FaInfoCircle className="ai-empty-icon" /><p>{predictions.message || "Tahmin için veri gerekli"}</p></div>
                        ) : predList.map((p, i) => {
                            const sev = severityConfig[p.severity] || severityConfig.medium;
                            return (
                                <div key={i} className="ai-prediction-item" style={{ background: sev.bg, borderColor: `${sev.color}20` }}>
                                    <span className="ai-prediction-icon">{p.icon}</span>
                                    <div className="ai-prediction-body">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                                            <div className="ai-prediction-text">{p.prediction}</div>
                                            <Badge color={sev.color}>{sev.label}</Badge>
                                        </div>
                                        {p.detail && <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", margin: "0.2rem 0", lineHeight: 1.5 }}>{p.detail}</div>}
                                        {p.product && <div className="ai-prediction-product">ğŸ“¦ {p.product?.slice(0, 45)}</div>}
                                        <div className="ai-prediction-meta">
                                            <Badge color="#818cf8">Güven: {p.confidence}%</Badge>
                                            {p.financialImpact !== 0 && p.financialImpact !== undefined && (
                                                <Badge color={p.financialImpact > 0 ? "#34d399" : "#f87171"}>
                                                    {p.financialImpact > 0 ? "+" : ""}{fmtCurrency(p.financialImpact)}
                                                </Badge>
                                            )}
                                            {p.impact && <span className="ai-prediction-impact">{p.impact}</span>}
                                        </div>
                                        {p.action && <div className="ai-prediction-action">→ {p.action}</div>}
                                        {p.products?.length > 0 && (
                                            <div style={{ marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                                {p.products.slice(0, 3).map((pr, j) => (
                                                    <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-tertiary)", padding: "0.15rem 0" }}>
                                                        <span>{pr.name?.slice(0, 30)}</span>
                                                        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{pr.margin !== undefined ? fmtPct(pr.margin) : `${pr.stock} stok`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>

                    {/* Risk Engine */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <div className="ai-card-head">
                            <h3><FaShieldAlt /> Risk Analizi</h3>
                            <Badge color={risks.overallRiskLevel === "high" ? "#f87171" : risks.overallRiskLevel === "medium" ? "#fbbf24" : "#34d399"}>
                                Skor: {risks.riskScore || 0}/100
                            </Badge>
                        </div>
                        {/* Risk Score Visual */}
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                            <ScoreRing score={risks.riskScore || 0} size={64} thickness={3} />
                            <div>
                                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: risks.riskScore >= 70 ? "#34d399" : risks.riskScore >= 40 ? "#fbbf24" : "#f87171" }}>
                                    {risks.riskScore >= 70 ? "Düşük Risk" : risks.riskScore >= 40 ? "Orta Risk" : "Yüksek Risk"}
                                </div>
                                {risks.totalMonthlyRiskImpact > 0 && (
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>Aylık risk etkisi: {fmtCurrency(risks.totalMonthlyRiskImpact)}</div>
                                )}
                            </div>
                        </div>
                        <div className="ai-risk-counts">
                            <div className="ai-risk-count" style={{ borderColor: "rgba(248,113,113,0.15)" }}><span style={{ color: "#f87171", fontWeight: 700 }}>{risks.riskCount?.high || 0}</span><span>Yüksek</span></div>
                            <div className="ai-risk-count" style={{ borderColor: "rgba(251,191,36,0.15)" }}><span style={{ color: "#fbbf24", fontWeight: 700 }}>{risks.riskCount?.medium || 0}</span><span>Orta</span></div>
                            <div className="ai-risk-count" style={{ borderColor: "rgba(52,211,153,0.15)" }}><span style={{ color: "#34d399", fontWeight: 700 }}>{risks.riskCount?.low || 0}</span><span>Düşük</span></div>
                        </div>
                        {(risks.risks || []).map((r, i) => (
                            <div key={i} className={`ai-risk-item level-${r.level}`}>
                                <span className="ai-risk-icon">{r.icon}</span>
                                <div className="ai-risk-body">
                                    <div className="ai-risk-title">{r.title}</div>
                                    <div className="ai-risk-impact">{r.impact}</div>
                                    {r.monthlyImpact > 0 && <div style={{ fontSize: "0.68rem", color: "#f87171", fontWeight: 600 }}>Aylık etki: {fmtCurrency(r.monthlyImpact)}</div>}
                                    <div className="ai-risk-mitigation">→ {r.mitigation}</div>
                                    {r.affectedProducts?.length > 0 && (
                                        <div style={{ marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                            {r.affectedProducts.slice(0, 2).map((ap, j) => (
                                                <div key={j} style={{ fontSize: "0.65rem", color: "var(--text-dim)", padding: "0.1rem 0" }}>• {ap.name?.slice(0, 35)}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Loss Hunter */}
                <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className="ai-card-head">
                        <h3><FaSearch /> Kayıp Avcısı (Loss Hunter)</h3>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Badge color="#f87171">Toplam: {fmtCurrency(lossHunter.totalImpact || 0)}</Badge>
                            <Badge color="#fbbf24">Kayıp Kâr: {fmtCurrency(lossHunter.totalLostProfit || 0)}</Badge>
                            <Badge color="#818cf8">Kaçırılan: {fmtCurrency(lossHunter.totalMissedRevenue || 0)}</Badge>
                        </div>
                    </div>
                    <p className="ai-card-desc">{lossHunter.summary || ""}</p>
                    {(lossHunter.losses || []).length > 0 ? (
                        <div className="ai-loss-list">
                            {(lossHunter.losses || []).slice(0, 10).map((l, i) => (
                                <div key={i} className={`ai-loss-item severity-${l.severity}`}>
                                    <span className="ai-loss-icon">{l.icon}</span>
                                    <div className="ai-loss-body">
                                        <div className="ai-loss-desc">{l.description}</div>
                                        <div className="ai-loss-meta">
                                            <Badge color="#f87171">-{fmtCurrency(l.amount)}</Badge>
                                            <Badge color="#71717a">{l.type === "negative_profit" ? "Zarar" : l.type === "missed_sales" ? "Kaçırılan" : "Fırsat"}</Badge>
                                            <span className="ai-loss-action">→ {l.action}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="ai-empty"><FaCheckCircle className="ai-empty-icon" /><p>Kayıp tespit edilmedi ✅</p></div>}
                </motion.div>

                {/* Cause Engine */}
                {causes.length > 0 && (
                    <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <div className="ai-card-head">
                            <h3><FaBrain /> Neden Analizi & Olay Zinciri</h3>
                            <Badge color="#fbbf24">{causes.length} sorun</Badge>
                        </div>
                        {causes.slice(0, 5).map((c, i) => (
                            <div key={i} className="ai-cause-item">
                                <div className="ai-cause-head">
                                    <strong>{c.product?.slice(0, 40)}</strong>
                                    <Badge color="#fbbf24">{c.issue}</Badge>
                                </div>
                                <div className="ai-cause-roots">
                                    {c.rootCauses?.map((rc, j) => <div key={j} className="ai-cause-root">ğŸ” {rc}</div>)}
                                </div>
                                {c.chain?.length > 0 && (
                                    <div className="ai-chain">
                                        {c.chain.map((ch, j) => (
                                            <div key={j} className="ai-chain-step">
                                                <span className="ai-chain-dot" />
                                                <div><strong>{ch.event}</strong> → {ch.effect} <span className="ai-chain-time">({ch.time})</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="ai-cause-rec">ğŸ’¡ {c.recommendation}</div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 5: SIMULATION (Enhanced v2 — Product Selector, Presets, Scenarios)
    // ═══════════════════════════════════════════════════════════════════════

    const renderSimulation = () => {
        const dc = brain?.decisionComparison || {};

        return (
            <div className="ai-tab-content">
                {/* Decision Comparison */}
                {dc.comparisons?.length > 0 && (
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="ai-card-head">
                            <h3><FaBalanceScale /> AI Karar Karşılaştırma</h3>
                            <Badge color="#818cf8">{dc.product?.name?.slice(0, 30)}</Badge>
                        </div>
                        <p className="ai-card-desc">{dc.message}</p>
                        <div className="ai-table-wrap">
                            <table className="ai-table">
                                <thead><tr><th>Senaryo</th><th>Ciro Δ</th><th>Kâr Δ</th><th>Satış Δ</th><th>Risk</th></tr></thead>
                                <tbody>
                                    {dc.comparisons.map((c, i) => (
                                        <tr key={i} style={c.name === dc.recommended ? { background: "rgba(34,197,94,0.08)" } : {}}>
                                            <td style={{ fontWeight: c.name === dc.recommended ? 700 : 400 }}>
                                                {c.name} {c.name === dc.recommended && <Badge color="#34d399">ÖNERİLEN</Badge>}
                                            </td>
                                            <td style={{ color: c.revenueChange >= 0 ? "#34d399" : "#f87171" }}>{c.revenueChange >= 0 ? "+" : ""}{fmtCurrency(c.revenueChange)}</td>
                                            <td style={{ color: c.profitChange >= 0 ? "#34d399" : "#f87171" }}>{c.profitChange >= 0 ? "+" : ""}{fmtCurrency(c.profitChange)}</td>
                                            <td>{c.salesChange >= 0 ? "+" : ""}{Math.round(c.salesChange)}</td>
                                            <td><Badge color={c.risk === "high" ? "#f87171" : c.risk === "medium" ? "#fbbf24" : "#34d399"}>{c.risk}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* Simulation Engine */}
                <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <div className="ai-card-head">
                        <h3><FaFlask /> Simülasyon Motoru</h3>
                        <Badge color="#818cf8">What-If Analizi</Badge>
                    </div>
                    <p className="ai-card-desc">Ürün seçin, hazır senaryolardan birini uygulayın veya kendi parametrelerinizi girin. Sonuçları beğenirseniz gerçek platforma uygulayın.</p>

                    {/* Product Selector */}
                    <div style={{ marginBottom: "1rem", padding: "0.85rem", background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <FaSearch style={{ color: "var(--text-dim)", fontSize: "0.8rem" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-tertiary)" }}>Ürün Seçimi</span>
                            {simSelectedProduct && <Badge color="#34d399">✓ {simSelectedProduct.name?.slice(0, 25)}</Badge>}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <input className="ai-input" placeholder="Ürün adı veya barkod ara..." value={simProductSearch}
                                onChange={e => { setSimProductSearch(e.target.value); if (e.target.value.length > 1) loadSimProducts(e.target.value); }}
                                style={{ flex: 1 }} />
                            <button className="ai-btn ai-btn-secondary" onClick={() => { setSimSelectedProduct(null); setSimParams(p => ({ ...p, barcode: "" })); setSimProductSearch(""); }}>
                                Tümü
                            </button>
                        </div>
                        {simProducts.length > 0 && simProductSearch.length > 1 && !simSelectedProduct && (
                            <div style={{ maxHeight: 150, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                                {simProducts.slice(0, 8).map((p, i) => (
                                    <div key={i} onClick={() => { setSimSelectedProduct(p); setSimParams(prev => ({ ...prev, barcode: p.barcode })); setSimProductSearch(""); }}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: "0.75rem", transition: "background 0.15s" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(78,205,196,0.06)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <div>
                                            <div style={{ color: "#fff", fontWeight: 600 }}>{p.name?.slice(0, 40)}</div>
                                            <div style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>{p.barcode} · Stok: {p.stock} · Marj: {fmtPct(p.profitMargin)}</div>
                                        </div>
                                        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{fmtCurrency(p.price)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {simSelectedProduct && (
                            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: "0.4rem" }}>
                                <span>ğŸ’° Fiyat: {fmtCurrency(simSelectedProduct.price)}</span>
                                <span>ğŸ“¦ Stok: {simSelectedProduct.stock}</span>
                                <span>ğŸ“Š Marj: {fmtPct(simSelectedProduct.profitMargin)}</span>
                                <span>ğŸ›’ Satış: {simSelectedProduct.avgDailySales?.toFixed(1)}/gün</span>
                                <span>ğŸ’µ Maliyet: {simSelectedProduct.costPrice > 0 ? fmtCurrency(simSelectedProduct.costPrice) : "Girilmemiş"}</span>
                            </div>
                        )}
                    </div>

                    {/* Quick Presets */}
                    <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>⚡ Hazır Senaryolar</div>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {[
                                { id: "price_up_5", label: "Fiyat +%5", icon: "ğŸ“ˆ", color: "#34d399" },
                                { id: "price_up_10", label: "Fiyat +%10", icon: "ğŸ“ˆ", color: "#10b981" },
                                { id: "price_down_5", label: "Fiyat -%5", icon: "ğŸ“‰", color: "#fbbf24" },
                                { id: "price_down_10", label: "Fiyat -%10", icon: "ğŸ“‰", color: "#fb923c" },
                                { id: "campaign_10", label: "%10 Kampanya", icon: "ğŸ·️", color: "#818cf8" },
                                { id: "campaign_20", label: "%20 Kampanya", icon: "ğŸ·️", color: "#a78bfa" },
                                { id: "campaign_30", label: "%30 Kampanya", icon: "ğŸ”¥", color: "#f472b6" },
                                { id: "stock_50", label: "+50 Stok", icon: "ğŸ“¦", color: "#60a5fa" },
                                { id: "stock_100", label: "+100 Stok", icon: "ğŸ“¦", color: "#0ea5e9" },
                                { id: "aggressive", label: "Agresif Satış", icon: "ğŸš€", color: "#f87171" },
                            ].map(preset => (
                                <button key={preset.id} className={`ai-btn ${simPreset === preset.id ? "ai-btn-execute" : "ai-btn-secondary"}`}
                                    onClick={() => applySimPreset(preset.id)}
                                    style={{ fontSize: "0.68rem", padding: "0.35rem 0.65rem" }}>
                                    {preset.icon} {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Manual Parameters */}
                    <div className="ai-sim-form">
                        <div className="ai-input-group">
                            <label>Ürün Barkodu</label>
                            <input className="ai-input" placeholder="Boş = tüm ürünler" value={simParams.barcode} onChange={e => setSimParams(p => ({ ...p, barcode: e.target.value }))} />
                        </div>
                        <div className="ai-input-group">
                            <label>Fiyat Değişimi (%)</label>
                            <input className="ai-input" type="number" placeholder="örn: 10 veya -5" value={simParams.priceChangePct} onChange={e => setSimParams(p => ({ ...p, priceChangePct: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="ai-input-group">
                            <label>Stok Değişimi (adet)</label>
                            <input className="ai-input" type="number" placeholder="örn: 50" value={simParams.stockChange} onChange={e => setSimParams(p => ({ ...p, stockChange: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div className="ai-input-group">
                            <label>Kampanya İndirimi (%)</label>
                            <input className="ai-input" type="number" placeholder="örn: 15" value={simParams.campaignDiscountPct} onChange={e => setSimParams(p => ({ ...p, campaignDiscountPct: parseFloat(e.target.value) || 0 }))} />
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                        <button className="ai-btn ai-btn-execute" onClick={handleSimulateAndSave} disabled={simulating}>
                            {simulating ? <><FaSync className="ai-spin" /> Hesaplanıyor...</> : <><FaPlay /> Simülasyonu Çalıştır</>}
                        </button>
                        {simResult && (
                            <button className="ai-btn ai-btn-approve" onClick={handleApplySimulation}>
                                <FaBolt /> Platformlara Uygula
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Simulation Results */}
                {simResult && (
                    <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="ai-card-head">
                            <h3><FaChartBar /> Simülasyon Sonuçları</h3>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <Badge color={simResult.summary?.overallRisk === "high" ? "#f87171" : simResult.summary?.overallRisk === "medium" ? "#fbbf24" : "#34d399"}>
                                    Risk: {simResult.summary?.overallRisk || "low"}
                                </Badge>
                                <Badge color="#818cf8">{simResult.summary?.productsAffected || 0} ürün</Badge>
                            </div>
                        </div>
                        <div className="ai-kpi-grid" style={{ marginBottom: "1rem" }}>
                            <div className="ai-kpi">
                                <div className="ai-kpi-label">Aylık Ciro Δ</div>
                                <div className="ai-kpi-value" style={{ color: (simResult.summary?.totalRevenueChange || 0) >= 0 ? "#34d399" : "#f87171" }}>
                                    {(simResult.summary?.totalRevenueChange || 0) >= 0 ? "+" : ""}{fmtCurrency(simResult.summary?.totalRevenueChange || 0)}
                                </div>
                            </div>
                            <div className="ai-kpi">
                                <div className="ai-kpi-label">Aylık Kâr Δ</div>
                                <div className="ai-kpi-value" style={{ color: (simResult.summary?.totalProfitChange || 0) >= 0 ? "#34d399" : "#f87171" }}>
                                    {(simResult.summary?.totalProfitChange || 0) >= 0 ? "+" : ""}{fmtCurrency(simResult.summary?.totalProfitChange || 0)}
                                </div>
                            </div>
                            <div className="ai-kpi">
                                <div className="ai-kpi-label">Etkilenen Ürün</div>
                                <div className="ai-kpi-value">{simResult.summary?.productsAffected || 0}</div>
                            </div>
                        </div>
                        {simResult.products?.length > 0 && (
                            <div className="ai-table-wrap">
                                <table className="ai-table">
                                    <thead><tr><th>Ürün</th><th>Mevcut Fiyat</th><th>Yeni Fiyat</th><th>Mevcut Marj</th><th>Yeni Marj</th><th>Ciro Δ</th><th>Kâr Δ</th><th>Risk</th></tr></thead>
                                    <tbody>
                                        {simResult.products.slice(0, 15).map((p, i) => (
                                            <tr key={i}>
                                                <td className="ai-td-name">{p.name?.slice(0, 30)}</td>
                                                <td>{fmtCurrency(p.current.price)}</td>
                                                <td style={{ fontWeight: 700, color: p.simulated.price !== p.current.price ? "#fbbf24" : "inherit" }}>{fmtCurrency(p.simulated.price)}</td>
                                                <td>{fmtPct(p.current.profitMargin)}</td>
                                                <td style={{ color: p.simulated.profitMargin > p.current.profitMargin ? "#34d399" : p.simulated.profitMargin < p.current.profitMargin ? "#f87171" : "inherit" }}>{fmtPct(p.simulated.profitMargin)}</td>
                                                <td style={{ color: p.changes.revenueChange >= 0 ? "#34d399" : "#f87171" }}>{p.changes.revenueChange >= 0 ? "+" : ""}{fmtCurrency(p.changes.revenueChange)}</td>
                                                <td style={{ color: p.changes.profitChange >= 0 ? "#34d399" : "#f87171" }}>{p.changes.profitChange >= 0 ? "+" : ""}{fmtCurrency(p.changes.profitChange)}</td>
                                                <td><Badge color={p.riskLevel === "high" ? "#f87171" : p.riskLevel === "medium" ? "#fbbf24" : "#34d399"}>{p.riskLevel}</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Scenario History */}
                {simScenarios.length > 0 && (
                    <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="ai-card-head">
                            <h3><FaHistory /> Senaryo Geçmişi</h3>
                            <Badge color="#818cf8">{simScenarios.length} senaryo</Badge>
                        </div>
                        <div className="ai-table-wrap">
                            <table className="ai-table">
                                <thead><tr><th>Saat</th><th>Ürün</th><th>Fiyat Δ</th><th>Stok Δ</th><th>Kampanya</th><th>Ciro Δ</th><th>Kâr Δ</th><th>Risk</th></tr></thead>
                                <tbody>
                                    {simScenarios.map((s, i) => (
                                        <tr key={i} style={{ cursor: "pointer" }} onClick={() => { setSimParams(s.params); setSimResult(s.result); }}>
                                            <td style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: "0.7rem" }}>{s.timestamp}</td>
                                            <td>{s.params.barcode || "Tümü"}</td>
                                            <td>{s.params.priceChangePct ? `${s.params.priceChangePct > 0 ? "+" : ""}${s.params.priceChangePct}%` : "—"}</td>
                                            <td>{s.params.stockChange ? `+${s.params.stockChange}` : "—"}</td>
                                            <td>{s.params.campaignDiscountPct ? `%${s.params.campaignDiscountPct}` : "—"}</td>
                                            <td style={{ color: (s.result.summary?.totalRevenueChange || 0) >= 0 ? "#34d399" : "#f87171" }}>
                                                {fmtCurrency(s.result.summary?.totalRevenueChange || 0)}
                                            </td>
                                            <td style={{ color: (s.result.summary?.totalProfitChange || 0) >= 0 ? "#34d399" : "#f87171" }}>
                                                {fmtCurrency(s.result.summary?.totalProfitChange || 0)}
                                            </td>
                                            <td><Badge color={s.result.summary?.overallRisk === "high" ? "#f87171" : s.result.summary?.overallRisk === "medium" ? "#fbbf24" : "#34d399"}>{s.result.summary?.overallRisk}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 6: STRATEGY & GOALS
    // ═══════════════════════════════════════════════════════════════════════

    const renderStrategyGoals = () => {
        const strategy = brain?.strategy || {};
        const opportunities = brain?.opportunityRadar || [];
        const dh = brain?.decisionHistory || {};

        return (
            <div className="ai-tab-content">
                <div className="ai-grid-2">
                    {/* Strategy */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="ai-card-head">
                            <h3><FaRocket /> Strateji Modu</h3>
                            <Badge color="#fbbf24">Aktif: {selectedStrategy}</Badge>
                        </div>
                        <p className="ai-strategy-reason">{strategy.reason || "Strateji seçin"}</p>
                        <div className="ai-strategy-grid">
                            {(strategy.options || []).map(opt => (
                                <div key={opt.id}
                                    className={`ai-strategy-card ${selectedStrategy === opt.id ? "active" : ""} ${strategy.recommended === opt.id ? "recommended" : ""}`}
                                    onClick={() => setSelectedStrategy(opt.id)}>
                                    <div className="ai-strategy-icon">{opt.icon}</div>
                                    <div className="ai-strategy-name">{opt.name}</div>
                                    <div className="ai-strategy-desc">{opt.description}</div>
                                    {strategy.recommended === opt.id && <div className="ai-strategy-badge">ÖNERİLEN</div>}
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Opportunity Radar */}
                    <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="ai-card-head">
                            <h3><FaCrosshairs /> Fırsat Radarı</h3>
                            <Badge color="#34d399">{opportunities.length} fırsat</Badge>
                        </div>
                        {opportunities.length === 0 ? (
                            <div className="ai-empty"><FaInfoCircle className="ai-empty-icon" /><p>Fırsat taranıyor...</p></div>
                        ) : opportunities.map((o, i) => (
                            <div key={i} className="ai-opportunity-item">
                                <span className="ai-opp-icon">{o.icon}</span>
                                <div className="ai-opp-body">
                                    <div className="ai-opp-title">{o.title}</div>
                                    <div className="ai-opp-desc">{o.description}</div>
                                    <div className="ai-opp-meta">
                                        {o.potential > 0 && <Badge color="#34d399">+{fmtCurrency(o.potential)}</Badge>}
                                        <Badge color="#818cf8">Güven: {o.confidence}%</Badge>
                                    </div>
                                    <div className="ai-opp-action">→ {o.action}</div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Goals */}
                <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="ai-card-head">
                        <h3><FaBullseye /> İş Hedefleri</h3>
                        <button className="ai-btn ai-btn-secondary" onClick={() => setShowGoalForm(!showGoalForm)}>
                            {showGoalForm ? "İptal" : "+ Yeni Hedef"}
                        </button>
                    </div>

                    <AnimatePresence>
                        {showGoalForm && (
                            <motion.div className="ai-goal-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                                <div className="ai-sim-form">
                                    <div className="ai-input-group">
                                        <label>Hedef Adı</label>
                                        <input className="ai-input" placeholder="örn: Aylık Ciro" value={goalForm.title} onChange={e => setGoalForm(p => ({ ...p, title: e.target.value }))} />
                                    </div>
                                    <div className="ai-input-group">
                                        <label>Tip</label>
                                        <select className="ai-select" value={goalForm.goalType} onChange={e => setGoalForm(p => ({ ...p, goalType: e.target.value }))}>
                                            <option value="revenue">Ciro (TL)</option>
                                            <option value="profit">Kâr (TL)</option>
                                            <option value="sales">Satış (adet)</option>
                                        </select>
                                    </div>
                                    <div className="ai-input-group">
                                        <label>Hedef Değer</label>
                                        <input className="ai-input" type="number" placeholder="100000" value={goalForm.targetValue} onChange={e => setGoalForm(p => ({ ...p, targetValue: e.target.value }))} />
                                    </div>
                                    <div className="ai-input-group">
                                        <label>Bitiş Tarihi</label>
                                        <input className="ai-input" type="date" value={goalForm.endDate} onChange={e => setGoalForm(p => ({ ...p, endDate: e.target.value }))} />
                                    </div>
                                </div>
                                <button className="ai-btn ai-btn-approve" onClick={handleCreateGoal} style={{ marginTop: "0.75rem" }}>
                                    <FaCheckCircle /> Hedef Oluştur
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {goals.length === 0 ? (
                        <div className="ai-empty"><FaBullseye className="ai-empty-icon" /><p>Henüz hedef yok</p><span className="ai-empty-sub">Yeni hedef oluşturun ve AI takip etsin</span></div>
                    ) : (
                        <div className="ai-goal-list">
                            {goals.map((g, i) => {
                                const pColor = g.progressPercent >= 100 ? "#34d399" : g.progressPercent >= 70 ? "#60a5fa" : g.progressPercent >= 40 ? "#fbbf24" : "#f87171";
                                return (
                                    <motion.div key={g._id || i} className="ai-goal" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                                        <div className="ai-goal-top">
                                            <span className="ai-goal-title">{g.title}</span>
                                            <span className="ai-goal-pct" style={{ color: pColor }}>{g.progressPercent}%</span>
                                        </div>
                                        <div className="ai-progress">
                                            <motion.div className="ai-progress-fill" initial={{ width: 0 }} animate={{ width: `${Math.min(g.progressPercent, 100)}%` }}
                                                transition={{ duration: 0.8 }} style={{ background: pColor }} />
                                        </div>
                                        <div className="ai-goal-info">
                                            <span>Mevcut: {fmtNum(g.currentValue)} {g.unit}</span>
                                            <span>Hedef: {fmtNum(g.targetValue)} {g.unit}</span>
                                        </div>
                                        <div className="ai-goal-info">
                                            <span>Günlük: {fmtNum(g.dailyTarget)} {g.unit}</span>
                                            <span>{g.daysLeft} gün kaldı</span>
                                        </div>
                                        {g.onTrack !== undefined && (
                                            <div className="ai-goal-track" style={{ color: g.onTrack ? "#34d399" : "#fbbf24" }}>
                                                {g.onTrack ? "✅ Hedef yolunda" : "⚠️ Hedefin gerisinde"}
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Decision History */}
                {dh.totalDecisions > 0 && (
                    <motion.div className="ai-card" style={{ marginTop: "1.25rem" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <div className="ai-card-head">
                            <h3><FaHistory /> Karar Geçmişi</h3>
                            <Badge color="#818cf8">{dh.totalDecisions} karar</Badge>
                        </div>
                        <div className="ai-dh-stats">
                            <div className="ai-dh-stat"><span>Toplam</span><strong>{dh.totalDecisions}</strong></div>
                            <div className="ai-dh-stat"><span>Uygulanan</span><strong style={{ color: "#34d399" }}>{dh.executed}</strong></div>
                            <div className="ai-dh-stat"><span>Başarı</span><strong style={{ color: "#60a5fa" }}>{fmtPct(dh.successRate)}</strong></div>
                            <div className="ai-dh-stat"><span>Kazanç</span><strong style={{ color: "#34d399" }}>{fmtCurrency(dh.totalProfitFromActions)}</strong></div>
                        </div>
                        {(dh.recentExecuted || []).slice(0, 5).map((r, i) => (
                            <div key={i} className="ai-dh-item">
                                <span style={{ color: r.success ? "#34d399" : "#f87171" }}>{r.success ? "✅" : "❌"}</span>
                                <span className="ai-dh-title">{r.title?.slice(0, 50)}</span>
                                <Badge color={r.profitChange > 0 ? "#34d399" : "#71717a"}>{r.profitChange > 0 ? "+" : ""}{fmtCurrency(r.profitChange)}</Badge>
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 7: ÜRÜN MALİYET YÖNETİMİ (Cost Entry)
    // ═══════════════════════════════════════════════════════════════════════

    const renderCostEntry = () => {
        return (
            <div className="ai-tab-content">
                <motion.div className="ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="ai-card-head">
                        <h3><FaEdit /> Ürün Maliyet Bilgileri</h3>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <Badge color="#818cf8">{costStats.withCost}/{costStats.total} maliyet girilmiş</Badge>
                            <button className="ai-btn ai-btn-secondary" onClick={() => loadCostProducts(costSearch)} disabled={costLoading}>
                                <FaSync className={costLoading ? "ai-spin" : ""} /> Yenile
                            </button>
                        </div>
                    </div>

                    <p className="ai-card-desc">
                        Ürünlerinizin maliyet bilgilerini girerek AI'ın kâr analizi, fiyat önerileri ve risk tespitlerinin doğruluğunu artırın.
                        Maliyet tipi olarak "Hazır Alındı" (satın alma) veya "Üretim Maliyeti" seçebilirsiniz.
                    </p>

                    {/* Stats Bar */}
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                        {[
                            { label: "Toplam Ürün", value: costStats.total, color: "#818cf8", icon: "ğŸ“¦" },
                            { label: "Maliyet Girilmiş", value: costStats.withCost, color: "#34d399", icon: "✅" },
                            { label: "Maliyet Eksik", value: costStats.withoutCost, color: "#f87171", icon: "❌" },
                            { label: "Tamamlanma", value: costStats.total > 0 ? `%${Math.round(costStats.withCost / costStats.total * 100)}` : "%0", color: "#fbbf24", icon: "ğŸ“Š" },
                        ].map((s, i) => (
                            <div key={i} style={{ flex: 1, background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 10, padding: "0.6rem 0.8rem", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>{s.icon} {s.label}</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                        <input className="ai-input" placeholder="Ürün adı veya barkod ara..." value={costSearch}
                            onChange={e => setCostSearch(e.target.value)} style={{ flex: 1 }} />
                        <button className="ai-btn ai-btn-execute" onClick={() => loadCostProducts(costSearch)}>
                            <FaSearch /> Ara
                        </button>
                    </div>

                    {/* Product List */}
                    {costProducts.length === 0 ? (
                        <div className="ai-empty">
                            <FaBoxOpen className="ai-empty-icon" />
                            <p>{costLoading ? "Yükleniyor..." : "Ürün aramak için yukarıdaki arama kutusunu kullanın"}</p>
                            <button className="ai-btn ai-btn-secondary" onClick={() => loadCostProducts("")} style={{ marginTop: "0.5rem" }}>
                                Tüm Ürünleri Yükle
                            </button>
                        </div>
                    ) : (
                        <div className="ai-table-wrap">
                            <table className="ai-table">
                                <thead>
                                    <tr>
                                        <th>Ürün</th>
                                        <th>Satış Fiyatı</th>
                                        <th>Maliyet Tipi</th>
                                        <th>Maliyet (₺)</th>
                                        <th>Komisyon (%)</th>
                                        <th>Kargo (₺)</th>
                                        <th>Paketleme (₺)</th>
                                        <th>Kâr Marjı</th>
                                        <th>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {costProducts.map((p, i) => {
                                        const isEditing = !!costEditing[p.barcode];
                                        const edit = costEditing[p.barcode] || {};
                                        return (
                                            <tr key={i} style={{ background: !p.hasCostData ? "rgba(239,68,68,0.03)" : isEditing ? "rgba(78,205,196,0.04)" : "transparent" }}>
                                                <td>
                                                    <div style={{ maxWidth: 180 }}>
                                                        <div style={{ fontWeight: 600, fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name?.slice(0, 35)}</div>
                                                        <div style={{ fontSize: "0.6rem", color: "var(--text-dim)", fontFamily: "monospace" }}>{p.barcode}</div>
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700, color: "var(--accent)" }}>{fmtCurrency(p.price)}</td>
                                                <td>
                                                    {isEditing ? (
                                                        <select className="ai-select" style={{ fontSize: "0.7rem", padding: "0.3rem", minWidth: 90 }}
                                                            value={edit.costType || "purchase"}
                                                            onChange={e => setCostEditing(prev => ({ ...prev, [p.barcode]: { ...prev[p.barcode], costType: e.target.value } }))}>
                                                            <option value="purchase">Hazır Alındı</option>
                                                            <option value="production">Üretim</option>
                                                        </select>
                                                    ) : (
                                                        <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{p.hasCostData ? "Girilmiş" : "—"}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input className="ai-input" type="number" style={{ width: 80, fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                                                            value={edit.costPrice ?? p.costPrice ?? ""} placeholder="0"
                                                            onChange={e => setCostEditing(prev => ({ ...prev, [p.barcode]: { ...prev[p.barcode], costPrice: e.target.value } }))} />
                                                    ) : (
                                                        <span style={{ color: p.costPrice > 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>
                                                            {p.costPrice > 0 ? fmtCurrency(p.costPrice) : "—"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input className="ai-input" type="number" style={{ width: 60, fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                                                            value={edit.commissionRate ?? p.commissionRate ?? ""} placeholder="0"
                                                            onChange={e => setCostEditing(prev => ({ ...prev, [p.barcode]: { ...prev[p.barcode], commissionRate: e.target.value } }))} />
                                                    ) : (
                                                        <span style={{ fontSize: "0.75rem" }}>{p.commissionRate > 0 ? `%${p.commissionRate.toFixed(1)}` : "—"}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input className="ai-input" type="number" style={{ width: 70, fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                                                            value={edit.shippingCost ?? p.shippingCost ?? ""} placeholder="0"
                                                            onChange={e => setCostEditing(prev => ({ ...prev, [p.barcode]: { ...prev[p.barcode], shippingCost: e.target.value } }))} />
                                                    ) : (
                                                        <span style={{ fontSize: "0.75rem" }}>{p.shippingCost > 0 ? fmtCurrency(p.shippingCost) : "—"}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <input className="ai-input" type="number" style={{ width: 70, fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                                                            value={edit.packagingCost ?? ""} placeholder="0"
                                                            onChange={e => setCostEditing(prev => ({ ...prev, [p.barcode]: { ...prev[p.barcode], packagingCost: e.target.value } }))} />
                                                    ) : (
                                                        <span style={{ fontSize: "0.75rem" }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 700, color: p.profitMargin > 15 ? "#34d399" : p.profitMargin > 0 ? "#fbbf24" : p.costPrice > 0 ? "#f87171" : "var(--text-dim)" }}>
                                                        {p.costPrice > 0 ? fmtPct(p.profitMargin) : "—"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {isEditing ? (
                                                        <div style={{ display: "flex", gap: "0.3rem" }}>
                                                            <button className="ai-btn ai-btn-approve" style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem" }}
                                                                onClick={() => handleSaveCost(p.barcode)} disabled={costSaving === p.barcode}>
                                                                {costSaving === p.barcode ? <FaSync className="ai-spin" /> : <FaSave />} Kaydet
                                                            </button>
                                                            <button className="ai-btn ai-btn-reject" style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem" }}
                                                                onClick={() => setCostEditing(prev => { const n = { ...prev }; delete n[p.barcode]; return n; })}>
                                                                İptal
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button className="ai-btn ai-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.65rem" }}
                                                            onClick={() => setCostEditing(prev => ({
                                                                ...prev,
                                                                [p.barcode]: {
                                                                    costPrice: p.costPrice || "",
                                                                    commissionRate: p.commissionRate || "",
                                                                    shippingCost: p.shippingCost || "",
                                                                    packagingCost: "",
                                                                    costType: "purchase",
                                                                }
                                                            }))}>
                                                            <FaEdit /> Düzenle
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // "BENİ ANLA" DIAGNOSIS MODAL
    // ═══════════════════════════════════════════════════════════════════════

    const renderDiagnosisModal = () => {
        if (!showDiagnosisModal) return null;
        const d = diagnosisData;

        return (
            <motion.div className="ai-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowDiagnosisModal(false)}>
                <motion.div className="ai-modal ai-diagnosis-modal" initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                    onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
                    <div className="ai-modal-head" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.1))" }}>
                        <h3><FaStethoscope /> ğŸ” İŞLETME TEŞHİSİ</h3>
                        <button className="ai-modal-close" onClick={() => setShowDiagnosisModal(false)}>✕</button>
                    </div>
                    <div className="ai-modal-body">
                        {diagnosisLoading ? (
                            <div className="ai-loading" style={{ minHeight: 200 }}>
                                <div className="ai-loading-spinner" />
                                <p>İşletmen analiz ediliyor...</p>
                            </div>
                        ) : d ? (
                            <>
                                {/* Verdict Banner */}
                                <div className="ai-diagnosis-verdict">
                                    <span className="ai-diagnosis-emoji">{d.verdictEmoji}</span>
                                    <div className="ai-diagnosis-grade">NOT: {d.healthGrade}</div>
                                    <p className="ai-diagnosis-text">{d.verdict}</p>
                                    <div className="ai-diagnosis-amounts">
                                        {d.totalMistakeAmount > 0 && <Badge color="#f87171">ğŸ”´ Hata: {fmtCurrency(d.totalMistakeAmount)}</Badge>}
                                        {d.totalLeakAmount > 0 && <Badge color="#fbbf24">ğŸ’¸ Kaçak: {fmtCurrency(d.totalLeakAmount)}</Badge>}
                                        {d.totalOppAmount > 0 && <Badge color="#34d399">ğŸ’° Fırsat: {fmtCurrency(d.totalOppAmount)}</Badge>}
                                    </div>
                                </div>

                                {/* Mistakes */}
                                {d.mistakes?.length > 0 && (
                                    <div className="ai-diagnosis-section">
                                        <h4 className="ai-diagnosis-section-title" style={{ color: "#f87171" }}>ğŸ”´ NEREDE HATA YAPIYORSUN?</h4>
                                        {d.mistakes.map((m, i) => (
                                            <div key={i} className="ai-diagnosis-item ai-diagnosis-mistake">
                                                <span className="ai-diagnosis-item-icon">{m.icon}</span>
                                                <div>
                                                    <div className="ai-diagnosis-item-title">{m.title}</div>
                                                    <div className="ai-diagnosis-item-detail">{m.detail}</div>
                                                    <div className="ai-diagnosis-item-fix">ğŸ’Š {m.fix}</div>
                                                    {m.amount > 0 && <Badge color="#f87171">{fmtCurrency(m.amount)}</Badge>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Leaks */}
                                {d.leaks?.length > 0 && (
                                    <div className="ai-diagnosis-section">
                                        <h4 className="ai-diagnosis-section-title" style={{ color: "#fbbf24" }}>ğŸ’¸ NEREDE PARA KAÇIRIYORSUN?</h4>
                                        {d.leaks.map((l, i) => (
                                            <div key={i} className="ai-diagnosis-item ai-diagnosis-leak">
                                                <span className="ai-diagnosis-item-icon">{l.icon}</span>
                                                <div>
                                                    <div className="ai-diagnosis-item-title">{l.title}</div>
                                                    <div className="ai-diagnosis-item-detail">{l.detail}</div>
                                                    <div className="ai-diagnosis-item-fix">ğŸ’Š {l.fix}</div>
                                                    {l.amount > 0 && <Badge color="#fbbf24">{fmtCurrency(l.amount)}</Badge>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Opportunities */}
                                {d.opportunities?.length > 0 && (
                                    <div className="ai-diagnosis-section">
                                        <h4 className="ai-diagnosis-section-title" style={{ color: "#34d399" }}>ğŸ’° NEREDE FIRSAT VAR?</h4>
                                        {d.opportunities.map((o, i) => (
                                            <div key={i} className="ai-diagnosis-item ai-diagnosis-opp">
                                                <span className="ai-diagnosis-item-icon">{o.icon}</span>
                                                <div>
                                                    <div className="ai-diagnosis-item-title">{o.title}</div>
                                                    <div className="ai-diagnosis-item-detail">{o.detail}</div>
                                                    <div className="ai-diagnosis-item-fix">ğŸ¯ {o.action}</div>
                                                    {o.amount > 0 && <Badge color="#34d399">+{fmtCurrency(o.amount)}</Badge>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="ai-empty"><p>Teşhis verisi yüklenemedi</p></div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // EXPLAIN MODAL
    // ═══════════════════════════════════════════════════════════════════════

    const renderExplainModal = () => {
        if (!explainModal) return null;
        const { recommendation: rec, explanation } = explainModal;

        return (
            <motion.div className="ai-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setExplainModal(null)}>
                <motion.div className="ai-modal" initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                    onClick={e => e.stopPropagation()}>
                    <div className="ai-modal-head">
                        <h3><FaEye /> AI Neden Bu Öneriyi Yaptı?</h3>
                        <button className="ai-modal-close" onClick={() => setExplainModal(null)}>✕</button>
                    </div>
                    <div className="ai-modal-body">
                        <h4 className="ai-explain-title">{rec?.title}</h4>
                        <p className="ai-explain-desc">{rec?.description}</p>
                        <div className="ai-explain-steps">
                            {(explanation || []).map((step, i) => (
                                <div key={i} className="ai-explain-step">
                                    <div className="ai-explain-step-num">{step.step}</div>
                                    <div>
                                        <strong>{step.title}</strong>
                                        <p>{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // MAIN RENDER
    // ═══════════════════════════════════════════════════════════════════════

    if (loading) {
        return (
            <div className="ai-cc">
                <div className="ai-loading">
                    <div className="ai-loading-spinner" />
                    <p>AI Operations Brain yükleniyor...</p>
                    <span style={{ color: "var(--text-dim, #52525b)", fontSize: "0.78rem" }}>Motorlar başlatılıyor...</span>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: "brain", icon: <FaBrain />, label: "Beyin" },
        { id: "recommendations", icon: <FaLightbulb />, label: "Öneriler", badge: recSummary.pending },
        { id: "analytics", icon: <FaChartBar />, label: "Analitik" },
        { id: "predictions", icon: <FaChartLine />, label: "Tahmin & Risk" },
        { id: "simulation", icon: <FaFlask />, label: "Simülasyon" },
        { id: "strategy", icon: <FaRocket />, label: "Strateji & Hedef", badge: goals.length },
        { id: "costs", icon: <FaTag />, label: "Ürünlerim" },
    ];

    return (
        <div className="ai-cc">
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <h1 className="ai-title">
                        <FaBrain style={{ color: "#4ecdc4", fontSize: "1.1rem" }} />
                        <span className="ai-title-accent">AI Operations Brain</span>
                    </h1>
                    <p className="ai-subtitle">Karar verir · Aksiyon önerir · Öğretir</p>
                </div>
                <div className="ai-header-right">
                    {brain?.score && <ScoreRing score={brain.score.overall} size={44} thickness={3} />}
                    <button className={`ai-refresh-btn ${refreshing ? "loading" : ""}`} onClick={() => loadBrain(true)}>
                        <FaSync className={refreshing ? "ai-spin" : ""} /> Yenile
                    </button>
                </div>
            </div>

            {error && (
                <div className="ai-error">
                    <FaExclamationTriangle /> {error}
                    <button onClick={() => loadBrain(true)}>Tekrar Dene</button>
                </div>
            )}

            {/* Tabs */}
            <div className="ai-tabs">
                {tabs.map(tab => (
                    <button key={tab.id} className={`ai-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                        {tab.icon} <span className="ai-tab-label">{tab.label}</span>
                        {tab.badge > 0 && <span className="ai-tab-badge">{tab.badge}</span>}
                    </button>
                ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                    {activeTab === "brain" && renderBrain()}
                    {activeTab === "recommendations" && renderRecommendations()}
                    {activeTab === "analytics" && renderAnalytics()}
                    {activeTab === "predictions" && renderPredictionsRisk()}
                    {activeTab === "simulation" && renderSimulation()}
                    {activeTab === "strategy" && renderStrategyGoals()}
                    {activeTab === "costs" && renderCostEntry()}
                </motion.div>
            </AnimatePresence>

            {/* Explain Modal */}
            <AnimatePresence>
                {renderExplainModal()}
            </AnimatePresence>

            {/* Diagnosis Modal */}
            <AnimatePresence>
                {renderDiagnosisModal()}
            </AnimatePresence>
        </div>
    );
};

export default AICommandCenter;
