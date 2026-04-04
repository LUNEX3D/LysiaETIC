/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI ASISTAN — LysiaETIC (v7 — Clean Full-Width Design)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Temiz, anlaşılır, tam sayfa genişliğinde AI asistan paneli.
 * İç içe karmaşık yapı yok — her şey düz ve net.
 *
 * 7 Sekme:
 *  1. Genel Bakış — Skor, KPI'lar, Günlük Rapor, Uyarılar
 *  2. Öneriler — Onayla/Reddet/Uygula
 *  3. Analitik — Ürün Sağlığı, Segmentasyon, Zamanlama
 *  4. Tahmin & Risk — Tahminler, Risk Analizi, Kayıp Avcısı
 *  5. Simülasyon — What-If Analizi
 *  6. Strateji & Hedef — Strateji Modu, Hedefler
 *  7. Ürünlerim — Maliyet Girişi
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
import AIErrorBoundary from "../components/AIErrorBoundary";
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
    const [strategyChanging, setStrategyChanging] = useState(false);

    // Rec filter
    const [recFilter, setRecFilter] = useState("pending");

    // Bulk selection
    const [selectedRecs, setSelectedRecs] = useState(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);

    // Worker status
    const [workerStatus, setWorkerStatus] = useState(null);

    // Explanation modal
    const [explainModal, setExplainModal] = useState(null);

    // Cost entry
    const [costProducts, setCostProducts] = useState([]);
    const [costSearch, setCostSearch] = useState("");
    const [costLoading, setCostLoading] = useState(false);
    const [costEditing, setCostEditing] = useState({});
    const [costSaving, setCostSaving] = useState("");
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
    // DATA LOADING
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
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(() => loadBrain(false), 60000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [loadBrain]);

    const costProductsLoadedRef = useRef(false);
    useEffect(() => {
        if (activeTab === "costs" && !costProductsLoadedRef.current) {
            costProductsLoadedRef.current = true;
            loadCostProducts("");
        }
    }, [activeTab]);

    useEffect(() => {
        API.get("/ai-engine/worker-status").then(res => {
            if (res.data.success) setWorkerStatus(res.data.status);
        }).catch(() => {});
    }, []);

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
        const changedProducts = simResult.products.filter(p => p.simulated.price !== p.current.price);
        if (changedProducts.length === 0) { alert("Fiyat değişikliği olan ürün yok."); return; }
        if (!window.confirm(
            `${changedProducts.length} ürünün fiyatı gerçekten değişecek!\n\n` +
            changedProducts.slice(0, 5).map(p => `• ${p.name?.slice(0, 30)}: ${p.current.price}₺ → ${p.simulated.price}₺`).join("\n") +
            (changedProducts.length > 5 ? `\n... ve ${changedProducts.length - 5} ürün daha` : "") +
            "\n\nOnaylıyor musunuz?"
        )) return;
        try {
            const res = await API.post("/ai-engine/simulate/apply", {
                products: changedProducts.map(p => ({ barcode: p.barcode, newPrice: p.simulated.price, oldPrice: p.current.price }))
            });
            if (res.data.success) {
                alert(`✅ ${res.data.applied} ürünün fiyatı güncellendi!${res.data.failed > 0 ? ` (${res.data.failed} başarısız)` : ""}`);
                loadBrain(true);
            } else { alert("❌ " + res.data.message); }
        } catch (err) { alert("Uygulama hatası: " + (err.response?.data?.message || err.message)); }
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

    // Cost Entry
    const loadCostProducts = async (search = "") => {
        setCostLoading(true);
        try {
            const res = await API.get(`/ai-engine/brain/products?limit=100&search=${search}`);
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
                costPrice: edit.costPrice !== undefined && edit.costPrice !== "" ? Number(edit.costPrice) : undefined,
                commissionRate: edit.commissionRate !== undefined && edit.commissionRate !== "" ? Number(edit.commissionRate) : undefined,
                shippingCost: edit.shippingCost !== undefined && edit.shippingCost !== "" ? Number(edit.shippingCost) : undefined,
                packagingCost: edit.packagingCost !== undefined && edit.packagingCost !== "" ? Number(edit.packagingCost) : undefined,
                costType: edit.costType || "purchase",
            });
            if (res.data.success) {
                setCostEditing(prev => { const n = { ...prev }; delete n[barcode]; return n; });
                loadCostProducts(costSearch);
            } else { alert("❌ " + res.data.message); }
        } catch (err) { alert("Hata: " + (err.response?.data?.message || err.message)); }
        finally { setCostSaving(""); }
    };

    // Bulk Actions
    const handleBulkApprove = async () => {
        if (selectedRecs.size === 0) return;
        setBulkLoading(true);
        try {
            const res = await API.post("/ai-engine/recommendations/bulk-approve", { ids: [...selectedRecs] });
            if (res.data.success) {
                alert(`✅ ${res.data.approved} öneri onaylandı`);
                setSelectedRecs(new Set());
                loadBrain(true);
            }
        } catch (err) { alert("Toplu onay başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setBulkLoading(false); }
    };

    const handleBulkReject = async () => {
        if (selectedRecs.size === 0) return;
        if (!window.confirm(`${selectedRecs.size} öneriyi reddetmek istediğinizden emin misiniz?`)) return;
        setBulkLoading(true);
        try {
            const res = await API.post("/ai-engine/recommendations/bulk-reject", { ids: [...selectedRecs] });
            if (res.data.success) {
                alert(`✅ ${res.data.rejected} öneri reddedildi`);
                setSelectedRecs(new Set());
                loadBrain(true);
            }
        } catch (err) { alert("Toplu red başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setBulkLoading(false); }
    };

    const toggleRecSelection = (recId) => {
        setSelectedRecs(prev => {
            const next = new Set(prev);
            if (next.has(recId)) next.delete(recId); else next.add(recId);
            return next;
        });
    };

    const selectAllPendingRecs = () => {
        const pendingIds = recommendations.filter(r => r.status === "pending").map(r => r._id);
        setSelectedRecs(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds));
    };

    const handleStrategyChange = (newStrategy) => {
        if (newStrategy === selectedStrategy) return;
        setStrategyChanging(true);
        setSelectedStrategy(newStrategy);
        setTimeout(() => setStrategyChanging(false), 3000);
    };

    const handleAutoDecide = async () => {
        setAutoDecideLoading(true);
        try {
            const res = await API.post("/ai-engine/brain/auto-decide");
            if (res.data.success) setAutoDecisions(res.data);
        } catch (err) { alert("Otomatik karar motoru başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setAutoDecideLoading(false); }
    };

    const handleDiagnosis = async () => {
        setDiagnosisLoading(true);
        setShowDiagnosisModal(true);
        try {
            const res = await API.get("/ai-engine/brain/diagnosis");
            if (res.data.success) setDiagnosisData(res.data.diagnosis);
        } catch (err) { alert("Teşhis motoru başarısız: " + (err.response?.data?.message || err.message)); }
        finally { setDiagnosisLoading(false); }
    };

    const loadSimProducts = async (search = "") => {
        try {
            const res = await API.get(`/ai-engine/brain/products?limit=30&search=${search}`);
            if (res.data.success) setSimProducts(res.data.products || []);
        } catch { /* silent */ }
    };

    const applySimPreset = (preset) => {
        setSimPreset(preset);
        const presets = {
            "price_up_5": { priceChangePct: 5, stockChange: 0, campaignDiscountPct: 0 },
            "price_up_10": { priceChangePct: 10, stockChange: 0, campaignDiscountPct: 0 },
            "price_down_5": { priceChangePct: -5, stockChange: 0, campaignDiscountPct: 0 },
            "price_down_10": { priceChangePct: -10, stockChange: 0, campaignDiscountPct: 0 },
            "campaign_10": { priceChangePct: 0, stockChange: 0, campaignDiscountPct: 10 },
            "campaign_20": { priceChangePct: 0, stockChange: 0, campaignDiscountPct: 20 },
            "campaign_30": { priceChangePct: 0, stockChange: 0, campaignDiscountPct: 30 },
            "stock_50": { priceChangePct: 0, stockChange: 50, campaignDiscountPct: 0 },
            "stock_100": { priceChangePct: 0, stockChange: 100, campaignDiscountPct: 0 },
            "aggressive": { priceChangePct: -8, stockChange: 50, campaignDiscountPct: 15 },
        };
        if (presets[preset]) setSimParams(p => ({ ...p, ...presets[preset] }));
    };

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    const ScoreRing = ({ score, size = 56, thickness = 3 }) => {
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
            </div>
        );
    };

    const Badge = ({ color, children }) => (
        <span className="ai-badge" style={{ background: `${color}12`, color, borderColor: `${color}20` }}>{children}</span>
    );

    const HealthBar = ({ value, label, gradient }) => (
        <div className="ai-subscore">
            <div className="ai-ss-top"><span className="ai-ss-label">{label}</span><span className="ai-ss-val">{value}</span></div>
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
    // TAB 1: BRAIN (Overview)
    // ═══════════════════════════════════════════════════════════════════════

    const renderBrain = () => {
        const bh = brain?.businessHealth || {};
        const tone = brain?.emotionalTone || {};
        const focus = brain?.focusItems || [];
        const journal = brain?.journal || {};
        const context = brain?.context || {};
        const score = brain?.score || {};
        const selfEval = brain?.selfEvaluation || {};
        const notifs = brain?.notifications || [];
        const roi = brain?.roi || {};
        const redAlerts = brain?.redAlerts || {};
        const money = brain?.moneyTracker || {};
        const teaching = brain?.teachingTips || [];

        return (
            <div className="ai-tab-content">
                {/* Kırmızı Alarm */}
                {redAlerts.hasAlerts && (
                    <div className="ai-card" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
                        <div className="ai-card-head">
                            <h3>🚨 Kırmızı Alarm</h3>
                            <Badge color="#f87171">{redAlerts.criticalCount} kritik</Badge>
                        </div>
                        {(redAlerts.alerts || []).map((alert, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ fontSize: "1.2rem" }}>{alert.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#f87171" }}>{alert.headline}</div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{alert.message}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: "0.3rem" }}>→ {alert.action}</div>
                                </div>
                                {alert.amount > 0 && <Badge color="#f87171">{fmtCurrency(alert.amount)}</Badge>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Karşılama + Skor + Hızlı Aksiyonlar */}
                <div className="ai-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                            <span style={{ fontSize: "2.5rem" }}>{tone.emoji || "🤖"}</span>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{context.greeting || "Merhaba"}</h2>
                                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{tone.message || "AI sistemi çalışıyor..."}</p>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                            <div style={{ textAlign: "center" }}>
                                <ScoreRing score={bh.overallScore || 0} size={72} thickness={4} />
                                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>İşletme Sağlığı</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <ScoreRing score={score.overall || 0} size={72} thickness={4} />
                                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>AI Skor</div>
                            </div>
                        </div>
                    </div>
                    {/* Quick Actions */}
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
                        <button className="ai-btn ai-btn-execute" onClick={handleAutoDecide} disabled={autoDecideLoading} style={{ flex: 1, minWidth: 200 }}>
                            {autoDecideLoading ? <><FaSync className="ai-spin" /> Hesaplanıyor...</> : <><FaMagic /> Benim Yerime Karar Ver</>}
                        </button>
                        <button className="ai-btn ai-btn-secondary" onClick={handleDiagnosis} disabled={diagnosisLoading} style={{ flex: 1, minWidth: 200 }}>
                            {diagnosisLoading ? <><FaSync className="ai-spin" /> Analiz ediliyor...</> : <><FaStethoscope /> İşletme Teşhisi</>}
                        </button>
                    </div>
                </div>

                {/* KPI Kartları */}
                <div className="ai-kpi-grid">
                    {[
                        { icon: <FaDollarSign />, label: "Bugün Ciro", value: fmtCurrency(bh.metrics?.todayRevenue), color: "#34d399" },
                        { icon: <FaBoxOpen />, label: "Ürün", value: fmtNum(brain?.productCount || 0), color: "#818cf8" },
                        { icon: <FaBell />, label: "Bekleyen Öneri", value: recSummary.pending || 0, color: "#fbbf24" },
                        { icon: <FaTrophy />, label: "AI Kazandırdı", value: fmtCurrency(roi.totalProfitGenerated || selfEval.totalProfitGenerated || 0), color: "#f472b6" },
                        { icon: <FaExclamationTriangle />, label: "Kayıp Tespiti", value: fmtCurrency(brain?.lossHunter?.totalImpact || 0), color: "#f87171" },
                    ].map((kpi, i) => (
                        <motion.div key={i} className="ai-kpi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                            <div className="ai-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                            <div className="ai-kpi-label">{kpi.label}</div>
                            <div className="ai-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Bugün Ne Yapmalıyım + Auto Decisions */}
                {focus.length > 0 && (
                    <div className="ai-card">
                        <div className="ai-card-head">
                            <h3><FaCrosshairs /> Bugün Ne Yapmalıyım?</h3>
                            <Badge color="#f87171">{focus.length} görev</Badge>
                        </div>
                        {focus.map((f, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem 0", borderBottom: i < focus.length - 1 ? "1px solid var(--border)" : "none" }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.75rem", color: "var(--accent)", flexShrink: 0 }}>{i + 1}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{f.icon} {f.title}</div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>{f.description}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: "0.25rem" }}>→ {f.action}</div>
                                </div>
                                <Badge color={f.urgency === "critical" ? "#f87171" : f.urgency === "high" ? "#fbbf24" : "#60a5fa"}>{f.impact}</Badge>
                            </div>
                        ))}
                    </div>
                )}

                {autoDecisions && (
                    <div className="ai-card">
                        <div className="ai-card-head">
                            <h3><FaMagic /> AI Kararları</h3>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <Badge color="#818cf8">{autoDecisions.totalDecisions} karar</Badge>
                                <Badge color="#34d399">Potansiyel: {fmtCurrency(autoDecisions.totalPotentialImpact)}</Badge>
                            </div>
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>{autoDecisions.summary}</p>
                        {(autoDecisions.decisions || []).map((d, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ fontSize: "1.1rem" }}>{d.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{d.title}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{d.description}</div>
                                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                                        <Badge color={d.urgency === "critical" ? "#f87171" : "#fbbf24"}>{d.urgency === "critical" ? "ACİL" : "Yüksek"}</Badge>
                                        <Badge color="#34d399">{d.impactLabel}</Badge>
                                        <Badge color="#818cf8">Güven: %{d.confidence}</Badge>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* İşletme Sağlığı + Para Nerede — Yan Yana */}
                <div className="ai-grid-2">
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaHeartbeat /> İşletme Sağlığı</h3></div>
                        <div className="ai-subscores">
                            <HealthBar value={bh.profitHealth || 0} label="💰 Kâr" gradient="linear-gradient(90deg, #34d399, #10b981)" />
                            <HealthBar value={bh.stockHealth || 0} label="📦 Stok" gradient="linear-gradient(90deg, #60a5fa, #818cf8)" />
                            <HealthBar value={bh.salesHealth || 0} label="📈 Satış" gradient="linear-gradient(90deg, #fbbf24, #fbbf24)" />
                            <HealthBar value={bh.operationsHealth || 0} label="⚙️ Operasyon" gradient="linear-gradient(90deg, #a78bfa, #f472b6)" />
                        </div>
                    </div>
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaMoneyBillWave /> Para Nerede?</h3></div>
                        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                            <div style={{ flex: 1, background: "var(--green-muted)", borderRadius: 10, padding: "0.75rem", textAlign: "center" }}>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Net Kâr</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--green)" }}>{fmtCurrency(money.summary?.netProfit || 0)}</div>
                            </div>
                            <div style={{ flex: 1, background: "var(--red-muted)", borderRadius: 10, padding: "0.75rem", textAlign: "center" }}>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Toplam Zarar</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--red)" }}>{fmtCurrency(money.summary?.totalLoss || 0)}</div>
                            </div>
                        </div>
                        {(money.topEarners || []).slice(0, 3).map((p, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", fontSize: "0.75rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>💰 {p.name?.slice(0, 25)}</span>
                                <span style={{ color: "#34d399", fontWeight: 700 }}>+{fmtCurrency(p.totalProfit)}</span>
                            </div>
                        ))}
                        {(money.topLosers || []).slice(0, 3).map((p, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", fontSize: "0.75rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>🔴 {p.name?.slice(0, 25)}</span>
                                <span style={{ color: "#f87171", fontWeight: 700 }}>-{fmtCurrency(p.totalLoss)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Günlük Rapor + Uyarılar + AI Öğretiyor */}
                <div className="ai-grid-3">
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaCalendarAlt /> Günlük Rapor</h3></div>
                        {(journal.problems || []).length > 0 && (
                            <div style={{ marginBottom: "0.75rem" }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f87171", marginBottom: "0.3rem" }}>🚨 Sorunlar</div>
                                {journal.problems.map((p, i) => <div key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0.15rem 0" }}>{p.icon} {p.text}</div>)}
                            </div>
                        )}
                        {(journal.opportunities || []).length > 0 && (
                            <div style={{ marginBottom: "0.75rem" }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34d399", marginBottom: "0.3rem" }}>💡 Fırsatlar</div>
                                {journal.opportunities.map((o, i) => <div key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0.15rem 0" }}>{o.icon} {o.text}</div>)}
                            </div>
                        )}
                        {(journal.actions || []).length > 0 && (
                            <div>
                                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#818cf8", marginBottom: "0.3rem" }}>🎯 Aksiyonlar</div>
                                {journal.actions.map((a, i) => <div key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0.15rem 0" }}>{a.icon} {a.text}</div>)}
                            </div>
                        )}
                    </div>
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaBell /> Uyarılar</h3><Badge color="#f87171">{notifs.length}</Badge></div>
                        {notifs.length === 0 ? (
                            <div className="ai-empty"><FaCheckCircle className="ai-empty-icon" /><p>Her şey yolunda ✅</p></div>
                        ) : notifs.map((n, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                                <span>{n.icon}</span>
                                <div><div style={{ fontWeight: 600, fontSize: "0.78rem" }}>{n.title}</div><div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{n.message}</div></div>
                            </div>
                        ))}
                    </div>
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaGraduationCap /> AI Öğretiyor</h3></div>
                        {teaching.length === 0 ? (
                            <div className="ai-empty"><p>Şu an ipucu yok</p></div>
                        ) : teaching.map((tip, i) => (
                            <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ fontWeight: 600, fontSize: "0.78rem" }}>{tip.icon} {tip.title}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", margin: "0.2rem 0" }}>{tip.content}</div>
                                <div style={{ fontSize: "0.68rem", color: "var(--accent)" }}>→ {tip.action}</div>
                            </div>
                        ))}
                    </div>
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
                        <button className="ai-btn ai-btn-secondary" onClick={handleGenerateRecs} disabled={refreshing}>
                            <FaSync className={refreshing ? "ai-spin" : ""} /> Yeni Öneriler Üret
                        </button>
                    </div>

                    {/* Filtreler */}
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

                    {/* Toplu İşlem */}
                    {recFilter === "pending" && recSummary.pending > 0 && (
                        <div className="ai-bulk-bar">
                            <label className="ai-bulk-select-all">
                                <input type="checkbox" checked={selectedRecs.size > 0 && selectedRecs.size === recommendations.filter(r => r.status === "pending").length} onChange={selectAllPendingRecs} />
                                <span>Tümünü Seç</span>
                            </label>
                            {selectedRecs.size > 0 && (
                                <div className="ai-bulk-actions">
                                    <span className="ai-bulk-count">{selectedRecs.size} seçili</span>
                                    <button className="ai-btn ai-btn-approve" onClick={handleBulkApprove} disabled={bulkLoading}><FaCheckCircle /> Toplu Onayla</button>
                                    <button className="ai-btn ai-btn-reject" onClick={handleBulkReject} disabled={bulkLoading}><FaTimesCircle /> Toplu Reddet</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Kategori Filtresi */}
                    {categories.length > 1 && (
                        <div className="ai-rec-filters" style={{ marginTop: "-0.5rem" }}>
                            <button className={`ai-rec-filter ${recCategoryFilter === "all" ? "active" : ""}`} onClick={() => setRecCategoryFilter("all")}><FaTags style={{ fontSize: "0.65rem" }} /> Tümü</button>
                            {categories.map(cat => (
                                <button key={cat} className={`ai-rec-filter ${recCategoryFilter === cat ? "active" : ""}`} onClick={() => setRecCategoryFilter(cat)}>
                                    {cat === "pricing" ? "💰 Fiyat" : cat === "stock" ? "📦 Stok" : cat === "performance" ? "📊 Performans" : cat === "financial" ? "💵 Finans" : cat === "strategy" ? "🎯 Strateji" : cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Öneri Listesi */}
                    {filtered.length === 0 ? (
                        <div className="ai-empty"><FaCheckCircle className="ai-empty-icon" /><p>{recFilter === "pending" ? "Tüm öneriler işlendi!" : "Bu kategoride öneri yok"}</p></div>
                    ) : (
                        <div className="ai-rec-list">
                            {filtered.map((rec, idx) => {
                                const pc = priorityConfig[rec.priority] || priorityConfig.medium;
                                return (
                                    <motion.div key={rec._id} className={`ai-rec priority-${rec.priority} ${selectedRecs.has(rec._id) ? "selected" : ""}`}
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                                        <div className="ai-rec-header">
                                            {rec.status === "pending" && <input type="checkbox" className="ai-rec-checkbox" checked={selectedRecs.has(rec._id)} onChange={() => toggleRecSelection(rec._id)} />}
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
                                                <div className="ai-confidence-bar"><div className="ai-confidence-fill" style={{ width: `${rec.confidenceScore}%`, background: rec.confidenceScore >= 80 ? "#34d399" : rec.confidenceScore >= 60 ? "#60a5fa" : "#fbbf24" }} /></div>
                                                <span>{rec.confidenceScore}%</span>
                                            </div>
                                        </div>
                                        {rec.impact && (
                                            <div className="ai-rec-impact">
                                                {rec.impact.profitChange !== 0 && <span className={rec.impact.profitChange > 0 ? "positive" : "negative"}>{rec.impact.profitChange > 0 ? <FaArrowUp /> : <FaArrowDown />} Kâr: {fmtCurrency(Math.abs(rec.impact.profitChange))}</span>}
                                                {rec.impact.revenueChange !== 0 && <span className={rec.impact.revenueChange > 0 ? "positive" : "negative"}>{rec.impact.revenueChange > 0 ? <FaArrowUp /> : <FaArrowDown />} Ciro: {fmtCurrency(Math.abs(rec.impact.revenueChange))}</span>}
                                            </div>
                                        )}
                                        <div className="ai-rec-actions">
                                            {rec.status === "pending" && (<><button className="ai-btn ai-btn-approve" onClick={() => handleApprove(rec._id)}><FaCheckCircle /> Onayla</button><button className="ai-btn ai-btn-reject" onClick={() => handleReject(rec._id)}><FaTimesCircle /> Reddet</button></>)}
                                            {rec.status === "approved" && <button className="ai-btn ai-btn-execute" onClick={() => handleExecute(rec._id)}><FaBolt /> Uygula</button>}
                                            {(rec.status === "executed" || rec.status === "rejected") && <Badge color={rec.status === "executed" ? "#34d399" : "#f87171"}>{rec.status === "executed" ? "✅ Uygulandı" : "🚫 Reddedildi"}</Badge>}
                                            <button className="ai-btn ai-btn-ghost" onClick={() => handleExplain(rec._id)}><FaEye /> Neden?</button>
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
                {/* Ürün Sağlığı */}
                <div className="ai-card">
                    <div className="ai-card-head"><h3><FaHeartbeat /> Ürün Sağlığı</h3><Badge color="#4ecdc4">Ort: {ph.avgHealthScore || 0}/100</Badge></div>
                    <div className="ai-health-segments">
                        {[
                            { label: "Mükemmel", count: ph.segments?.excellent || 0, color: "#34d399", icon: "🏆" },
                            { label: "Sağlıklı", count: ph.segments?.healthy || 0, color: "#60a5fa", icon: "✅" },
                            { label: "Uyarı", count: ph.segments?.warning || 0, color: "#fbbf24", icon: "⚠️" },
                            { label: "Kritik", count: ph.segments?.critical || 0, color: "#f87171", icon: "🚨" },
                        ].map((s, i) => (
                            <div key={i} className="ai-health-seg" style={{ borderColor: `${s.color}30` }}>
                                <span style={{ fontSize: "1.3rem" }}>{s.icon}</span>
                                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: s.color }}>{s.count}</span>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Segmentasyon */}
                {seg.stars && (
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaLayerGroup /> Ürün Segmentasyonu</h3></div>
                        <div className="ai-seg-grid">
                            {[
                                { key: "stars", label: "⭐ Yıldızlar", color: "#34d399", data: seg.stars },
                                { key: "cashCows", label: "🐄 Nakit İnekleri", color: "#60a5fa", data: seg.cashCows },
                                { key: "questionMarks", label: "❓ Soru İşaretleri", color: "#fbbf24", data: seg.questionMarks },
                                { key: "dogs", label: "🐕 Köpekler", color: "#f87171", data: seg.dogs },
                            ].map(s => (
                                <div key={s.key} className="ai-seg-card" style={{ borderColor: `${s.color}30` }}>
                                    <div className="ai-seg-head"><span>{s.label}</span><Badge color={s.color}>{s.data?.count || 0}</Badge></div>
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
                    </div>
                )}

                {/* Kârlılık Haritası */}
                {(heatmap.byCategory || []).length > 0 && (
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaMapMarkedAlt /> Kârlılık Haritası</h3></div>
                        <div className="ai-table-wrap">
                            <table className="ai-table">
                                <thead><tr><th>Kategori</th><th>Ürün</th><th>Ciro</th><th>Kâr</th><th>Marj</th></tr></thead>
                                <tbody>
                                    {heatmap.byCategory.slice(0, 8).map((c, i) => (
                                        <tr key={i}>
                                            <td>{c.category?.slice(0, 25)}</td>
                                            <td>{c.productCount}</td>
                                            <td>{fmtCurrency(c.totalRevenue)}</td>
                                            <td style={{ color: c.totalProfit >= 0 ? "#34d399" : "#f87171" }}>{fmtCurrency(c.totalProfit)}</td>
                                            <td>{fmtPct(c.avgMargin)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Zamanlama + Geçmiş */}
                <div className="ai-grid-2">
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaClock /> Zamanlama</h3></div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <div style={{ padding: "0.6rem", background: "var(--surface)", borderRadius: 8 }}><div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>🔥 En yoğun saat</div><div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{timing.bestHour || "N/A"}</div></div>
                            <div style={{ padding: "0.6rem", background: "var(--surface)", borderRadius: 8 }}><div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>🔥 En yoğun gün</div><div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{timing.bestDay || "N/A"}</div></div>
                            <div style={{ padding: "0.6rem", background: "var(--surface)", borderRadius: 8 }}><div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>💤 En düşük saat</div><div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{timing.worstHour || "N/A"}</div></div>
                            <div style={{ padding: "0.6rem", background: "var(--surface)", borderRadius: 8 }}><div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>💤 En düşük gün</div><div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{timing.worstDay || "N/A"}</div></div>
                        </div>
                        {timing.suggestions?.length > 0 && <div style={{ marginTop: "0.75rem" }}>{timing.suggestions.map((s, i) => <div key={i} style={{ fontSize: "0.72rem", color: "var(--accent)", padding: "0.15rem 0" }}>💡 {s}</div>)}</div>}
                    </div>
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaHistory /> Geçmiş Analizi</h3></div>
                        <div style={{ textAlign: "center", padding: "0.5rem 0", marginBottom: "0.5rem" }}>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f87171" }}>-{fmtCurrency(retro.totalLostProfit || 0)}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{retro.summary || "Kayıp analizi"}</div>
                        </div>
                        {(retro.mistakes || []).slice(0, 3).map((m, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", fontSize: "0.75rem" }}>
                                <span style={{ color: "var(--text-secondary)" }}>{m.description?.slice(0, 35)}</span>
                                <span style={{ color: "#f87171", fontWeight: 700 }}>-{fmtCurrency(m.lostAmount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 4: PREDICTIONS & RISK
    // ═══════════════════════════════════════════════════════════════════════

    const renderPredictionsRisk = () => {
        const predictions = brain?.predictions || {};
        const risks = brain?.riskAssessment || {};
        const lossHunter = brain?.lossHunter || {};
        const causes = brain?.causeAnalysis || [];
        const predList = predictions.predictions || [];
        const trendData = predictions.trendData || {};

        return (
            <div className="ai-tab-content">
                {/* KPI */}
                <div className="ai-kpi-grid">
                    {[
                        { icon: <FaChartLine />, label: "Tahmin", value: predList.length, color: "#818cf8" },
                        { icon: <FaShieldAlt />, label: "Risk Skoru", value: `${risks.riskScore || 0}/100`, color: risks.overallRiskLevel === "high" ? "#f87171" : "#34d399" },
                        { icon: <FaSearch />, label: "Kayıp", value: fmtCurrency(lossHunter.totalImpact || 0), color: "#f87171" },
                        { icon: <FaDollarSign />, label: "Bugün Ciro", value: fmtCurrency(trendData.todayRevenue || 0), color: "#34d399" },
                    ].map((kpi, i) => (
                        <motion.div key={i} className="ai-kpi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                            <div className="ai-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                            <div className="ai-kpi-label">{kpi.label}</div>
                            <div className="ai-kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Ciro Trendi */}
                {(trendData.dailyRevenues || []).length > 0 && (
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaChartBar /> 14 Günlük Ciro</h3></div>
                        <div style={{ display: "flex", gap: "3px", height: 80, alignItems: "flex-end", padding: "0.5rem 0" }}>
                            {trendData.dailyRevenues.map((d, i) => {
                                const max = Math.max(...trendData.dailyRevenues.map(x => x.revenue), 1);
                                const h = Math.max((d.revenue / max) * 100, 4);
                                return (
                                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                        <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.1 + i * 0.03, duration: 0.4 }}
                                            style={{ width: "100%", background: "linear-gradient(180deg, #4ecdc4, #34d399)", borderRadius: "3px 3px 0 0", minHeight: 3 }}
                                            title={`${d.date}: ${fmtCurrency(d.revenue)}`} />
                                        <span style={{ fontSize: "0.5rem", color: "var(--text-dim)" }}>{d.date}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tahminler + Risk */}
                <div className="ai-grid-2">
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaChartLine /> AI Tahminleri</h3></div>
                        {predList.length === 0 ? (
                            <div className="ai-empty"><p>{predictions.message || "Tahmin için veri gerekli"}</p></div>
                        ) : predList.map((p, i) => (
                            <div key={i} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                                    <span>{p.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{p.prediction}</div>
                                        {p.detail && <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.15rem" }}>{p.detail}</div>}
                                        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                                            <Badge color="#818cf8">Güven: {p.confidence}%</Badge>
                                            {p.financialImpact !== 0 && p.financialImpact !== undefined && <Badge color={p.financialImpact > 0 ? "#34d399" : "#f87171"}>{p.financialImpact > 0 ? "+" : ""}{fmtCurrency(p.financialImpact)}</Badge>}
                                        </div>
                                        {p.action && <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.2rem" }}>→ {p.action}</div>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaShieldAlt /> Risk Analizi</h3><Badge color={risks.riskScore >= 70 ? "#34d399" : "#fbbf24"}>{risks.riskScore || 0}/100</Badge></div>
                        {(risks.risks || []).map((r, i) => (
                            <div key={i} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <span>{r.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{r.title}</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{r.impact}</div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.2rem" }}>→ {r.mitigation}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Kayıp Avcısı */}
                <div className="ai-card">
                    <div className="ai-card-head">
                        <h3><FaSearch /> Kayıp Avcısı</h3>
                        <Badge color="#f87171">{fmtCurrency(lossHunter.totalImpact || 0)}</Badge>
                    </div>
                    {(lossHunter.losses || []).length === 0 ? (
                        <div className="ai-empty"><FaCheckCircle className="ai-empty-icon" /><p>Kayıp tespit edilmedi ✅</p></div>
                    ) : (lossHunter.losses || []).slice(0, 10).map((l, i) => (
                        <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                            <span>{l.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.8rem" }}>{l.description}</div>
                                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
                                    <Badge color="#f87171">-{fmtCurrency(l.amount)}</Badge>
                                    <span style={{ fontSize: "0.68rem", color: "var(--accent)" }}>→ {l.action}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 5: SIMULATION
    // ═══════════════════════════════════════════════════════════════════════

    const renderSimulation = () => {
        const dc = brain?.decisionComparison || {};

        return (
            <div className="ai-tab-content">
                {/* Karar Karşılaştırma */}
                {dc.comparisons?.length > 0 && (
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaBalanceScale /> AI Karar Karşılaştırma</h3></div>
                        <div className="ai-table-wrap">
                            <table className="ai-table">
                                <thead><tr><th>Senaryo</th><th>Ciro Δ</th><th>Kâr Δ</th><th>Risk</th></tr></thead>
                                <tbody>
                                    {dc.comparisons.map((c, i) => (
                                        <tr key={i} style={c.name === dc.recommended ? { background: "rgba(34,197,94,0.08)" } : {}}>
                                            <td style={{ fontWeight: c.name === dc.recommended ? 700 : 400 }}>{c.name} {c.name === dc.recommended && <Badge color="#34d399">ÖNERİLEN</Badge>}</td>
                                            <td style={{ color: c.revenueChange >= 0 ? "#34d399" : "#f87171" }}>{c.revenueChange >= 0 ? "+" : ""}{fmtCurrency(c.revenueChange)}</td>
                                            <td style={{ color: c.profitChange >= 0 ? "#34d399" : "#f87171" }}>{c.profitChange >= 0 ? "+" : ""}{fmtCurrency(c.profitChange)}</td>
                                            <td><Badge color={c.risk === "high" ? "#f87171" : c.risk === "medium" ? "#fbbf24" : "#34d399"}>{c.risk}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Simülasyon Motoru */}
                <div className="ai-card">
                    <div className="ai-card-head"><h3><FaFlask /> Simülasyon Motoru</h3></div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>Ürün seçin, senaryo uygulayın, sonuçları beğenirseniz platforma uygulayın.</p>

                    {/* Ürün Seçimi */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <input className="ai-input" placeholder="Ürün adı veya barkod ara..." value={simProductSearch}
                            onChange={e => { setSimProductSearch(e.target.value); if (e.target.value.length > 1) loadSimProducts(e.target.value); }}
                            style={{ flex: 1 }} />
                        <button className="ai-btn ai-btn-secondary" onClick={() => { setSimSelectedProduct(null); setSimParams(p => ({ ...p, barcode: "" })); setSimProductSearch(""); }}>Tümü</button>
                    </div>
                    {simProducts.length > 0 && simProductSearch.length > 1 && !simSelectedProduct && (
                        <div style={{ maxHeight: 150, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border)", marginBottom: "0.75rem" }}>
                            {simProducts.slice(0, 8).map((p, i) => (
                                <div key={i} onClick={() => { setSimSelectedProduct(p); setSimParams(prev => ({ ...prev, barcode: p.barcode })); setSimProductSearch(""); }}
                                    style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <div><div style={{ fontWeight: 600 }}>{p.name?.slice(0, 40)}</div><div style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}>{p.barcode} · Stok: {p.stock}</div></div>
                                    <span style={{ color: "var(--accent)", fontWeight: 700 }}>{fmtCurrency(p.price)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {simSelectedProduct && (
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: "0.75rem", padding: "0.5rem", background: "var(--surface)", borderRadius: 8 }}>
                            <span>💰 {fmtCurrency(simSelectedProduct.price)}</span><span>📦 Stok: {simSelectedProduct.stock}</span><span>📊 Marj: {fmtPct(simSelectedProduct.profitMargin)}</span>
                        </div>
                    )}

                    {/* Hazır Senaryolar */}
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-tertiary)", marginBottom: "0.4rem" }}>⚡ Hazır Senaryolar</div>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                        {[
                            { id: "price_up_5", label: "Fiyat +%5" }, { id: "price_up_10", label: "Fiyat +%10" },
                            { id: "price_down_5", label: "Fiyat -%5" }, { id: "price_down_10", label: "Fiyat -%10" },
                            { id: "campaign_10", label: "%10 Kampanya" }, { id: "campaign_20", label: "%20 Kampanya" },
                            { id: "aggressive", label: "🚀 Agresif" },
                        ].map(preset => (
                            <button key={preset.id} className={`ai-btn ${simPreset === preset.id ? "ai-btn-execute" : "ai-btn-secondary"}`}
                                onClick={() => applySimPreset(preset.id)} style={{ fontSize: "0.68rem", padding: "0.35rem 0.65rem" }}>
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Manuel Parametreler */}
                    <div className="ai-sim-form">
                        <div className="ai-input-group"><label>Fiyat Δ (%)</label><input className="ai-input" type="number" value={simParams.priceChangePct} onChange={e => setSimParams(p => ({ ...p, priceChangePct: parseFloat(e.target.value) || 0 }))} /></div>
                        <div className="ai-input-group"><label>Stok Δ</label><input className="ai-input" type="number" value={simParams.stockChange} onChange={e => setSimParams(p => ({ ...p, stockChange: parseInt(e.target.value) || 0 }))} /></div>
                        <div className="ai-input-group"><label>Kampanya (%)</label><input className="ai-input" type="number" value={simParams.campaignDiscountPct} onChange={e => setSimParams(p => ({ ...p, campaignDiscountPct: parseFloat(e.target.value) || 0 }))} /></div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                        <button className="ai-btn ai-btn-execute" onClick={handleSimulate} disabled={simulating}>
                            {simulating ? <><FaSync className="ai-spin" /> Hesaplanıyor...</> : <><FaPlay /> Simülasyonu Çalıştır</>}
                        </button>
                        {simResult && <button className="ai-btn ai-btn-approve" onClick={handleApplySimulation}><FaBolt /> Platformlara Uygula</button>}
                    </div>
                </div>

                {/* Sonuçlar */}
                {simResult && (
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaChartBar /> Sonuçlar</h3><Badge color="#818cf8">{simResult.summary?.productsAffected || 0} ürün</Badge></div>
                        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                            <div style={{ flex: 1, textAlign: "center", padding: "0.75rem", background: "var(--surface)", borderRadius: 8 }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Ciro Δ</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: (simResult.summary?.totalRevenueChange || 0) >= 0 ? "#34d399" : "#f87171" }}>{(simResult.summary?.totalRevenueChange || 0) >= 0 ? "+" : ""}{fmtCurrency(simResult.summary?.totalRevenueChange || 0)}</div>
                            </div>
                            <div style={{ flex: 1, textAlign: "center", padding: "0.75rem", background: "var(--surface)", borderRadius: 8 }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Kâr Δ</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: (simResult.summary?.totalProfitChange || 0) >= 0 ? "#34d399" : "#f87171" }}>{(simResult.summary?.totalProfitChange || 0) >= 0 ? "+" : ""}{fmtCurrency(simResult.summary?.totalProfitChange || 0)}</div>
                            </div>
                        </div>
                        {simResult.products?.length > 0 && (
                            <div className="ai-table-wrap">
                                <table className="ai-table">
                                    <thead><tr><th>Ürün</th><th>Mevcut</th><th>Yeni</th><th>Ciro Δ</th><th>Kâr Δ</th></tr></thead>
                                    <tbody>
                                        {simResult.products.slice(0, 15).map((p, i) => (
                                            <tr key={i}>
                                                <td className="ai-td-name">{p.name?.slice(0, 30)}</td>
                                                <td>{fmtCurrency(p.current.price)}</td>
                                                <td style={{ fontWeight: 700, color: p.simulated.price !== p.current.price ? "#fbbf24" : "inherit" }}>{fmtCurrency(p.simulated.price)}</td>
                                                <td style={{ color: p.changes.revenueChange >= 0 ? "#34d399" : "#f87171" }}>{p.changes.revenueChange >= 0 ? "+" : ""}{fmtCurrency(p.changes.revenueChange)}</td>
                                                <td style={{ color: p.changes.profitChange >= 0 ? "#34d399" : "#f87171" }}>{p.changes.profitChange >= 0 ? "+" : ""}{fmtCurrency(p.changes.profitChange)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
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

        return (
            <div className="ai-tab-content">
                <div className="ai-grid-2">
                    {/* Strateji */}
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaRocket /> Strateji Modu</h3><Badge color="#fbbf24">{selectedStrategy}</Badge></div>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>{strategy.reason || "Strateji seçin"}</p>
                        <div className="ai-strategy-grid">
                            {(strategy.options || []).map(opt => (
                                <div key={opt.id} className={`ai-strategy-card ${selectedStrategy === opt.id ? "active" : ""} ${strategy.recommended === opt.id ? "recommended" : ""}`}
                                    onClick={() => handleStrategyChange(opt.id)}>
                                    <div className="ai-strategy-icon">{opt.icon}</div>
                                    <div className="ai-strategy-name">{opt.name}</div>
                                    <div className="ai-strategy-desc">{opt.description}</div>
                                    {strategy.recommended === opt.id && <div className="ai-strategy-badge">ÖNERİLEN</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fırsat Radarı */}
                    <div className="ai-card">
                        <div className="ai-card-head"><h3><FaCrosshairs /> Fırsat Radarı</h3><Badge color="#34d399">{opportunities.length}</Badge></div>
                        {opportunities.length === 0 ? (
                            <div className="ai-empty"><p>Fırsat taranıyor...</p></div>
                        ) : opportunities.map((o, i) => (
                            <div key={i} style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{o.icon} {o.title}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>{o.description}</div>
                                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem" }}>
                                    {o.potential > 0 && <Badge color="#34d399">+{fmtCurrency(o.potential)}</Badge>}
                                    <Badge color="#818cf8">Güven: {o.confidence}%</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hedefler */}
                <div className="ai-card">
                    <div className="ai-card-head">
                        <h3><FaBullseye /> İş Hedefleri</h3>
                        <button className="ai-btn ai-btn-secondary" onClick={() => setShowGoalForm(!showGoalForm)}>{showGoalForm ? "İptal" : "+ Yeni Hedef"}</button>
                    </div>
                    {showGoalForm && (
                        <div style={{ marginBottom: "1rem", padding: "1rem", background: "var(--surface)", borderRadius: 10 }}>
                            <div className="ai-sim-form">
                                <div className="ai-input-group"><label>Hedef Adı</label><input className="ai-input" placeholder="örn: Aylık Ciro" value={goalForm.title} onChange={e => setGoalForm(p => ({ ...p, title: e.target.value }))} /></div>
                                <div className="ai-input-group"><label>Tip</label><select className="ai-select" value={goalForm.goalType} onChange={e => setGoalForm(p => ({ ...p, goalType: e.target.value }))}><option value="revenue">Ciro</option><option value="profit">Kâr</option><option value="sales">Satış</option></select></div>
                                <div className="ai-input-group"><label>Hedef Değer</label><input className="ai-input" type="number" value={goalForm.targetValue} onChange={e => setGoalForm(p => ({ ...p, targetValue: e.target.value }))} /></div>
                                <div className="ai-input-group"><label>Bitiş</label><input className="ai-input" type="date" value={goalForm.endDate} onChange={e => setGoalForm(p => ({ ...p, endDate: e.target.value }))} /></div>
                            </div>
                            <button className="ai-btn ai-btn-approve" onClick={handleCreateGoal} style={{ marginTop: "0.75rem" }}><FaCheckCircle /> Oluştur</button>
                        </div>
                    )}
                    {goals.length === 0 ? (
                        <div className="ai-empty"><FaBullseye className="ai-empty-icon" /><p>Henüz hedef yok</p></div>
                    ) : goals.map((g, i) => {
                        const pColor = g.progressPercent >= 100 ? "#34d399" : g.progressPercent >= 70 ? "#60a5fa" : g.progressPercent >= 40 ? "#fbbf24" : "#f87171";
                        return (
                            <div key={g._id || i} style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{g.title}</span>
                                    <span style={{ fontWeight: 800, color: pColor }}>{g.progressPercent}%</span>
                                </div>
                                <div className="ai-progress"><motion.div className="ai-progress-fill" initial={{ width: 0 }} animate={{ width: `${Math.min(g.progressPercent, 100)}%` }} transition={{ duration: 0.8 }} style={{ background: pColor }} /></div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.3rem" }}>
                                    <span>Mevcut: {fmtNum(g.currentValue)}</span><span>Hedef: {fmtNum(g.targetValue)}</span><span>{g.daysLeft} gün kaldı</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 7: ÜRÜN MALİYET YÖNETİMİ
    // ═══════════════════════════════════════════════════════════════════════

    const renderCostEntry = () => (
        <div className="ai-tab-content">
            <div className="ai-card">
                <div className="ai-card-head">
                    <h3><FaEdit /> Ürün Maliyet Bilgileri</h3>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <Badge color="#818cf8">{costStats.withCost}/{costStats.total} girilmiş</Badge>
                        <button className="ai-btn ai-btn-secondary" onClick={() => loadCostProducts(costSearch)} disabled={costLoading}>
                            <FaSync className={costLoading ? "ai-spin" : ""} /> Yenile
                        </button>
                    </div>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>
                    Maliyet bilgilerini girerek AI'ın kâr analizi ve fiyat önerilerinin doğruluğunu artırın.
                </p>

                {/* İstatistikler */}
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                    {[
                        { label: "Toplam", value: costStats.total, color: "#818cf8" },
                        { label: "Girilmiş", value: costStats.withCost, color: "#34d399" },
                        { label: "Eksik", value: costStats.withoutCost, color: "#f87171" },
                        { label: "Tamamlanma", value: costStats.total > 0 ? `%${Math.round(costStats.withCost / costStats.total * 100)}` : "%0", color: "#fbbf24" },
                    ].map((s, i) => (
                        <div key={i} style={{ flex: 1, background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 10, padding: "0.6rem", textAlign: "center" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>{s.label}</div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Arama */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    <input className="ai-input" placeholder="Ürün adı veya barkod ara..." value={costSearch}
                        onChange={e => setCostSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && loadCostProducts(costSearch)}
                        style={{ flex: 1 }} />
                    <button className="ai-btn ai-btn-execute" onClick={() => loadCostProducts(costSearch)}><FaSearch /> Ara</button>
                </div>

                {/* Ürün Listesi */}
                {costProducts.length === 0 ? (
                    <div className="ai-empty">
                        <FaBoxOpen className="ai-empty-icon" />
                        <p>{costLoading ? "Yükleniyor..." : "Ürün aramak için arama kutusunu kullanın"}</p>
                        <button className="ai-btn ai-btn-secondary" onClick={() => loadCostProducts("")} style={{ marginTop: "0.5rem" }}>Tüm Ürünleri Yükle</button>
                    </div>
                ) : (
                    <div className="ai-table-wrap">
                        <table className="ai-table">
                            <thead>
                                <tr>
                                    <th>Ürün</th>
                                    <th>Satış Fiyatı</th>
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
                                                    <input className="ai-input" type="number" style={{ width: 80, fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                                                        value={edit.costPrice ?? p.costPrice ?? ""} placeholder="0"
                                                        onChange={e => setCostEditing(prev => ({ ...prev, [p.barcode]: { ...prev[p.barcode], costPrice: e.target.value } }))} />
                                                ) : (
                                                    <span style={{ color: p.costPrice > 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{p.costPrice > 0 ? fmtCurrency(p.costPrice) : "—"}</span>
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
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════════
    // MODALS
    // ═══════════════════════════════════════════════════════════════════════

    const renderDiagnosisModal = () => {
        if (!showDiagnosisModal) return null;
        const d = diagnosisData;
        return (
            <motion.div className="ai-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowDiagnosisModal(false)}>
                <motion.div className="ai-modal" initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
                    <div className="ai-modal-head"><h3><FaStethoscope /> İşletme Teşhisi</h3><button className="ai-modal-close" onClick={() => setShowDiagnosisModal(false)}>✕</button></div>
                    <div className="ai-modal-body">
                        {diagnosisLoading ? (
                            <div className="ai-loading" style={{ minHeight: 200 }}><div className="ai-loading-spinner" /><p>Analiz ediliyor...</p></div>
                        ) : d ? (
                            <>
                                <div style={{ textAlign: "center", padding: "1rem 0", marginBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                                    <span style={{ fontSize: "2.5rem" }}>{d.verdictEmoji}</span>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 800, marginTop: "0.5rem" }}>NOT: {d.healthGrade}</div>
                                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>{d.verdict}</p>
                                </div>
                                {d.mistakes?.length > 0 && (
                                    <div style={{ marginBottom: "1rem" }}>
                                        <h4 style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "0.5rem" }}>🔴 Hatalar</h4>
                                        {d.mistakes.map((m, i) => (
                                            <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                                                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{m.icon} {m.title}</div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{m.detail}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.2rem" }}>💊 {m.fix}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {d.leaks?.length > 0 && (
                                    <div style={{ marginBottom: "1rem" }}>
                                        <h4 style={{ color: "#fbbf24", fontSize: "0.85rem", marginBottom: "0.5rem" }}>💸 Para Kaçakları</h4>
                                        {d.leaks.map((l, i) => (
                                            <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                                                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{l.icon} {l.title}</div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{l.detail}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.2rem" }}>💊 {l.fix}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {d.opportunities?.length > 0 && (
                                    <div>
                                        <h4 style={{ color: "#34d399", fontSize: "0.85rem", marginBottom: "0.5rem" }}>💰 Fırsatlar</h4>
                                        {d.opportunities.map((o, i) => (
                                            <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                                                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{o.icon} {o.title}</div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{o.detail}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--accent)", marginTop: "0.2rem" }}>🎯 {o.action}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : <div className="ai-empty"><p>Teşhis verisi yüklenemedi</p></div>}
                    </div>
                </motion.div>
            </motion.div>
        );
    };

    const renderExplainModal = () => {
        if (!explainModal) return null;
        const { recommendation: rec, explanation } = explainModal;
        return (
            <motion.div className="ai-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setExplainModal(null)}>
                <motion.div className="ai-modal" initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}>
                    <div className="ai-modal-head"><h3><FaEye /> Neden Bu Öneri?</h3><button className="ai-modal-close" onClick={() => setExplainModal(null)}>✕</button></div>
                    <div className="ai-modal-body">
                        <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>{rec?.title}</h4>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 1rem" }}>{rec?.description}</p>
                        {(explanation || []).map((step, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.75rem", color: "var(--accent)", flexShrink: 0 }}>{step.step}</div>
                                <div><strong style={{ fontSize: "0.82rem" }}>{step.title}</strong><p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0.15rem 0 0" }}>{step.description}</p></div>
                            </div>
                        ))}
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
                    <p>AI Asistan yükleniyor...</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: "brain", icon: <FaBrain />, label: "Genel Bakış" },
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
                        <span className="ai-title-accent">AI Asistan</span>
                    </h1>
                    <div className="ai-subtitle-row">
                        <p className="ai-subtitle">Karar verir · Aksiyon önerir · Öğretir</p>
                        {workerStatus?.isActive && <span className="ai-worker-badge"><span className="ai-worker-dot" /> Arka Plan AI Aktif</span>}
                    </div>
                </div>
                <div className="ai-header-right">
                    {strategyChanging && <span className="ai-strategy-loading"><FaSync className="ai-spin" /> Strateji değişiyor...</span>}
                    {brain?.score && <ScoreRing score={brain.score.overall} size={44} thickness={3} />}
                    <button className={`ai-refresh-btn ${refreshing ? "loading" : ""}`} onClick={() => loadBrain(true)}>
                        <FaSync className={refreshing ? "ai-spin" : ""} /> Yenile
                    </button>
                </div>
            </div>

            {error && (
                <div className="ai-error"><FaExclamationTriangle /> {error}<button onClick={() => loadBrain(true)}>Tekrar Dene</button></div>
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

            {/* Modals */}
            <AnimatePresence>{renderExplainModal()}</AnimatePresence>
            <AnimatePresence>{renderDiagnosisModal()}</AnimatePresence>
        </div>
    );
};

const AICommandCenterWithErrorBoundary = () => (
    <AIErrorBoundary>
        <AICommandCenter />
    </AIErrorBoundary>
);

export default AICommandCenterWithErrorBoundary;
