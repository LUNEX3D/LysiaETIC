/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LysiaRadar PRO — AI Ürün Fırsat Motoru
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcıya özel ürün fırsatları:
 *   - Skor bazlı sıralama
 *   - Filtreler (trend, kâr, rekabet, kategori)
 *   - AI açıklamalı kartlar
 *   - Simülasyon
 *   - Tek tıkla aksiyon
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import {
    getOpportunities, refreshOpportunities,
    recordOpportunityAction, simulateOpportunity,
    getProductOpportunities,
} from "../services/radarApi";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaRocket, FaSync, FaFilter, FaChartLine, FaFire,
    FaDollarSign, FaShieldAlt, FaSpinner, FaChevronDown,
    FaChevronUp, FaTimes, FaCheck, FaExclamationTriangle,
    FaLightbulb, FaArrowRight, FaPlay, FaPlus, FaEye,
    FaStar, FaBolt, FaCrosshairs, FaChartBar,
    FaBoxOpen, FaExternalLinkAlt, FaSortAmountDown,
    FaStore, FaTag, FaPercentage,
} from "react-icons/fa";

// ═══════════════════════════════════════════════════════════════
// 🎨 Skor Renkleri & Yardımcılar
// ═══════════════════════════════════════════════════════════════
const scoreColor = (s) => s >= 75 ? "#22c55e" : s >= 55 ? "#3b82f6" : s >= 40 ? "#f59e0b" : "#ef4444";
const scoreLabel = (s) => s >= 75 ? "Güçlü Fırsat" : s >= 55 ? "İyi Potansiyel" : s >= 40 ? "Orta" : "Düşük";
const scoreEmoji = (s) => s >= 75 ? "🔥" : s >= 55 ? "✨" : s >= 40 ? "📊" : "📋";
const trendIcon = (d) => d === "breakout" ? "🚀" : d === "rising" ? "📈" : d === "stable" ? "➡️" : d === "declining" ? "📉" : "❓";
const formatMoney = (n) => {
    if (!n || n === 0) return "0 ₺";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M ₺`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K ₺`;
    return `${Math.round(n)} ₺`;
};
const expansionLabel = (t) => {
    if (t === "same_category") return { text: "Aynı Kategori", color: "#22c55e", icon: "🎯" };
    if (t === "adjacent_category") return { text: "Yakın Kategori", color: "#3b82f6", icon: "🔗" };
    if (t === "trending") return { text: "Trend", color: "#f59e0b", icon: "🔥" };
    return { text: "Yeni Kategori", color: "#8b5cf6", icon: "🆕" };
};

// ═══════════════════════════════════════════════════════════════
// 📊 Skor Çubuğu Bileşeni
// ═══════════════════════════════════════════════════════════════
const ScoreBar = ({ label, value, color, icon }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
        <span style={{ fontSize: "0.65rem", width: 14, textAlign: "center" }}>{icon}</span>
        <span style={{ fontSize: "0.62rem", color: "#94a3b8", width: 55, flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ height: "100%", background: color || scoreColor(value), borderRadius: 3 }}
            />
        </div>
        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: color || scoreColor(value), width: 28, textAlign: "right" }}>
            {value}
        </span>
    </div>
);

// ═══════════════════════════════════════════════════════════════
// 🃏 Fırsat Kartı Bileşeni
// ═══════════════════════════════════════════════════════════════
const OpportunityCard = ({ opp, C, isDark, onSimulate, onDismiss, onDetail, index }) => {
    const [expanded, setExpanded] = useState(false);
    const exp = expansionLabel(opp.expansionType);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            style={{
                background: isDark
                    ? "linear-gradient(135deg, rgba(30,35,55,0.95) 0%, rgba(20,24,40,0.95) 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                borderLeft: `4px solid ${scoreColor(opp.totalScore)}`,
                borderRadius: 14,
                padding: "1rem 1.1rem",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s",
                boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.06)",
            }}
        >
            {/* Skor Badge — Sağ üst */}
            <div style={{
                position: "absolute", top: 10, right: 12,
                display: "flex", alignItems: "center", gap: "0.3rem",
            }}>
                <span style={{
                    background: `${scoreColor(opp.totalScore)}18`,
                    color: scoreColor(opp.totalScore),
                    fontSize: "0.9rem", fontWeight: 800,
                    padding: "0.2rem 0.5rem", borderRadius: 8,
                    display: "flex", alignItems: "center", gap: "0.2rem",
                }}>
                    {scoreEmoji(opp.totalScore)} {opp.totalScore}
                </span>
            </div>

            {/* Başlık */}
            <div style={{ marginBottom: "0.5rem", paddingRight: "4rem" }}>
                <h3 style={{
                    margin: 0, fontSize: "1rem", fontWeight: 800,
                    color: C.text, lineHeight: 1.3,
                    textTransform: "capitalize",
                }}>
                    {opp.keyword}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{
                        background: `${exp.color}15`, color: exp.color,
                        fontSize: "0.58rem", fontWeight: 700, padding: "0.12rem 0.4rem",
                        borderRadius: 4, display: "flex", alignItems: "center", gap: "0.2rem",
                    }}>
                        {exp.icon} {exp.text}
                    </span>
                    {opp.category && (
                        <span style={{
                            color: C.dim || "#64748b", fontSize: "0.6rem",
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                            padding: "0.1rem 0.35rem", borderRadius: 4,
                        }}>
                            {opp.category}
                        </span>
                    )}
                    <span style={{
                        fontSize: "0.58rem", color: "#94a3b8",
                        display: "flex", alignItems: "center", gap: "0.15rem",
                    }}>
                        {trendIcon(opp.trendData?.trendDirection)} {opp.trendData?.trendDirection === "breakout" ? "Patlama" : opp.trendData?.trendDirection === "rising" ? "Yükseliş" : opp.trendData?.trendDirection === "stable" ? "Stabil" : opp.trendData?.trendDirection === "declining" ? "Düşüş" : ""}
                    </span>
                </div>
            </div>

            {/* Hızlı Metrikler */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                gap: "0.4rem", marginBottom: "0.6rem",
            }}>
                {[
                    { label: "Ort. Fiyat", value: formatMoney(opp.marketData?.avgPrice), icon: "💰" },
                    { label: "Satıcı", value: opp.marketData?.sellerCount || 0, icon: "🏪" },
                    { label: "Kâr Marjı", value: `%${opp.profitAnalysis?.estimatedMargin || 0}`, icon: "📈" },
                ].map((m, i) => (
                    <div key={i} style={{
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        borderRadius: 8, padding: "0.35rem 0.4rem", textAlign: "center",
                    }}>
                        <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>{m.icon} {m.label}</div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: C.text }}>{m.value}</div>
                    </div>
                ))}
            </div>

            {/* Skor Çubukları */}
            <div style={{ marginBottom: "0.5rem" }}>
                <ScoreBar label="Trend" value={opp.scores?.trend || 0} icon="📈" />
                <ScoreBar label="Talep" value={opp.scores?.demand || 0} icon="🎯" />
                <ScoreBar label="Rekabet" value={opp.scores?.competition || 0} icon="🛡️" color={scoreColor(opp.scores?.competition || 0)} />
                <ScoreBar label="Kâr" value={opp.scores?.profit || 0} icon="💰" />
                <ScoreBar label="Uyum" value={opp.scores?.userFit || 0} icon="🤝" />
            </div>

            {/* AI Açıklama */}
            <div style={{
                background: isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)",
                border: `1px solid ${isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)"}`,
                borderRadius: 8, padding: "0.5rem 0.6rem", marginBottom: "0.5rem",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.2rem" }}>
                    <FaLightbulb style={{ color: "#f59e0b", fontSize: "0.65rem" }} />
                    <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#3b82f6" }}>AI Analizi</span>
                    <span style={{ fontSize: "0.55rem", color: "#94a3b8", marginLeft: "auto" }}>
                        Güven: %{opp.aiConfidence || 50}
                    </span>
                </div>
                <p style={{
                    margin: 0, fontSize: "0.7rem", color: C.text, lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: expanded ? 99 : 3,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                    {opp.aiExplanation}
                </p>
            </div>

            {/* Genişletilmiş Detaylar */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: "hidden" }}
                    >
                        {/* Faydalar & Riskler */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            {/* Faydalar */}
                            <div style={{
                                background: "rgba(34,197,94,0.06)", borderRadius: 8,
                                padding: "0.4rem 0.5rem", border: "1px solid rgba(34,197,94,0.12)",
                            }}>
                                <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#22c55e", marginBottom: "0.2rem" }}>
                                    ✅ Avantajlar
                                </div>
                                {(opp.aiBenefits || []).map((b, i) => (
                                    <div key={i} style={{ fontSize: "0.6rem", color: C.text, marginBottom: "0.1rem", display: "flex", gap: "0.2rem" }}>
                                        <span style={{ color: "#22c55e", flexShrink: 0 }}>•</span> {b}
                                    </div>
                                ))}
                            </div>
                            {/* Riskler */}
                            <div style={{
                                background: "rgba(239,68,68,0.06)", borderRadius: 8,
                                padding: "0.4rem 0.5rem", border: "1px solid rgba(239,68,68,0.12)",
                            }}>
                                <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "#ef4444", marginBottom: "0.2rem" }}>
                                    ⚠️ Riskler
                                </div>
                                {(opp.aiRisks || []).map((r, i) => (
                                    <div key={i} style={{ fontSize: "0.6rem", color: C.text, marginBottom: "0.1rem", display: "flex", gap: "0.2rem" }}>
                                        <span style={{ color: "#ef4444", flexShrink: 0 }}>•</span> {r}
                                    </div>
                                ))}
                                {(!opp.aiRisks || opp.aiRisks.length === 0) && (
                                    <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>Belirgin risk yok</div>
                                )}
                            </div>
                        </div>

                        {/* Pazar Detayları */}
                        <div style={{
                            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                            borderRadius: 8, padding: "0.5rem 0.6rem", marginBottom: "0.5rem",
                        }}>
                            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: C.text, marginBottom: "0.3rem" }}>
                                📊 Pazar Detayları
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.3rem" }}>
                                {[
                                    { l: "Min Fiyat", v: formatMoney(opp.marketData?.minPrice) },
                                    { l: "Max Fiyat", v: formatMoney(opp.marketData?.maxPrice) },
                                    { l: "Ort. Puan", v: `⭐ ${(opp.marketData?.avgRating || 0).toFixed(1)}` },
                                    { l: "Toplam Ürün", v: (opp.marketData?.totalProducts || 0).toLocaleString("tr-TR") },
                                    { l: "Ort. Yorum", v: opp.marketData?.avgReviewCount || 0 },
                                    { l: "Önerilen Fiyat", v: formatMoney(opp.profitAnalysis?.suggestedPrice) },
                                ].map((d, i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: "0.55rem", color: "#94a3b8" }}>{d.l}</div>
                                        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: C.text }}>{d.v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Markalar */}
                        {opp.marketData?.topBrands?.length > 0 && (
                            <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.58rem", color: "#94a3b8" }}>Top Markalar:</span>
                                {opp.marketData.topBrands.map((b, i) => (
                                    <span key={i} style={{
                                        fontSize: "0.55rem", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                        padding: "0.08rem 0.3rem", borderRadius: 4, color: C.text,
                                    }}>{b}</span>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Aksiyon Butonları */}
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.3rem" }}>
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: "transparent", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer",
                        color: C.text, fontSize: "0.68rem", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: "0.25rem",
                    }}
                >
                    {expanded ? <FaChevronUp style={{ fontSize: "0.55rem" }} /> : <FaChevronDown style={{ fontSize: "0.55rem" }} />}
                    {expanded ? "Kapat" : "Detay"}
                </button>

                <button
                    onClick={() => onSimulate(opp)}
                    style={{
                        background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                        borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer",
                        color: "#3b82f6", fontSize: "0.68rem", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: "0.25rem",
                    }}
                >
                    <FaPlay style={{ fontSize: "0.5rem" }} /> Simülasyon
                </button>

                <button
                    onClick={() => onDismiss(opp._id)}
                    style={{
                        background: "transparent", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                        borderRadius: 8, padding: "0.35rem 0.5rem", cursor: "pointer",
                        color: "#94a3b8", fontSize: "0.68rem",
                        display: "flex", alignItems: "center", gap: "0.2rem",
                        marginLeft: "auto",
                    }}
                >
                    <FaTimes style={{ fontSize: "0.5rem" }} /> Kaldır
                </button>
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════
// 🎯 Simülasyon Modal
// ═══════════════════════════════════════════════════════════════
const SimulationModal = ({ opp, C, isDark, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [targetPrice, setTargetPrice] = useState(opp.profitAnalysis?.suggestedPrice || opp.marketData?.avgPrice || 100);
    const [monthlySales, setMonthlySales] = useState(Math.max(1, Math.round((opp.marketData?.estimatedMonthlySales || 10) * 0.02)));
    const [investment, setInvestment] = useState(0);

    const runSimulation = async () => {
        setLoading(true);
        try {
            const res = await simulateOpportunity({
                opportunityId: opp._id,
                targetPrice: parseFloat(targetPrice),
                estimatedMonthlySales: parseInt(monthlySales),
                investmentAmount: parseFloat(investment) || undefined,
            });
            setResult(res.data?.simulation || null);
        } catch (err) {
            console.error("Simülasyon hatası:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { runSimulation(); }, []); // eslint-disable-line

    return (
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: isDark ? "#1a1f35" : "#fff",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: 16, width: "100%", maxWidth: 480,
                    maxHeight: "85vh", overflow: "auto",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                }}
            >
                {/* Header */}
                <div style={{
                    padding: "0.8rem 1rem", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: C.text }}>
                            🧮 Kâr Simülasyonu
                        </h3>
                        <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{opp.keyword}</span>
                    </div>
                    <FaTimes onClick={onClose} style={{ color: "#94a3b8", cursor: "pointer" }} />
                </div>

                {/* Inputs */}
                <div style={{ padding: "0.8rem 1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.8rem" }}>
                        {[
                            { label: "Satış Fiyatı (₺)", value: targetPrice, setter: setTargetPrice },
                            { label: "Aylık Satış (adet)", value: monthlySales, setter: setMonthlySales },
                            { label: "Yatırım (₺)", value: investment, setter: setInvestment },
                        ].map((inp, i) => (
                            <div key={i}>
                                <label style={{ fontSize: "0.6rem", color: "#94a3b8", display: "block", marginBottom: "0.2rem" }}>
                                    {inp.label}
                                </label>
                                <input
                                    type="number"
                                    value={inp.value}
                                    onChange={(e) => inp.setter(e.target.value)}
                                    style={{
                                        width: "100%", padding: "0.35rem 0.5rem",
                                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                                        borderRadius: 8, color: C.text, fontSize: "0.78rem",
                                        fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={runSimulation}
                        disabled={loading}
                        style={{
                            width: "100%", padding: "0.45rem",
                            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                            border: "none", borderRadius: 8, cursor: "pointer",
                            color: "#fff", fontSize: "0.78rem", fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaPlay />}
                        Hesapla
                    </button>
                </div>

                {/* Results */}
                {result && (
                    <div style={{ padding: "0 1rem 1rem" }}>
                        <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem",
                        }}>
                            {[
                                { label: "Birim Kâr", value: formatMoney(result.netProfitPerUnit), color: result.netProfitPerUnit > 0 ? "#22c55e" : "#ef4444" },
                                { label: "Kâr Marjı", value: `%${result.profitMargin}`, color: result.profitMargin > 20 ? "#22c55e" : result.profitMargin > 10 ? "#f59e0b" : "#ef4444" },
                                { label: "Aylık Ciro", value: formatMoney(result.monthlyRevenue), color: "#3b82f6" },
                                { label: "Aylık Kâr", value: formatMoney(result.monthlyProfit), color: result.monthlyProfit > 0 ? "#22c55e" : "#ef4444" },
                                { label: "Yıllık Kâr", value: formatMoney(result.yearlyProfit), color: result.yearlyProfit > 0 ? "#22c55e" : "#ef4444" },
                                { label: "ROI", value: `%${result.roi}`, color: result.roi > 50 ? "#22c55e" : result.roi > 20 ? "#f59e0b" : "#ef4444" },
                                { label: "Başabaş", value: `${result.breakEvenUnits} adet`, color: "#94a3b8" },
                                { label: "Başabaş Süre", value: `${result.breakEvenMonths} ay`, color: "#94a3b8" },
                            ].map((r, i) => (
                                <div key={i} style={{
                                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                    borderRadius: 8, padding: "0.4rem 0.5rem",
                                }}>
                                    <div style={{ fontSize: "0.58rem", color: "#94a3b8" }}>{r.label}</div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 800, color: r.color }}>{r.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// 📦 Ürün Kartı Bileşeni
// ═══════════════════════════════════════════════════════════════
const ProductCard = ({ product, C, isDark, index }) => {
    const [imgError, setImgError] = useState(false);
    const profitColor = product.estimatedProfit > 0 ? "#22c55e" : "#ef4444";
    const exp = expansionLabel(product.expansionType);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
            style={{
                background: isDark
                    ? "linear-gradient(135deg, rgba(30,35,55,0.95) 0%, rgba(20,24,40,0.95) 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                borderRadius: 14,
                overflow: "hidden",
                transition: "all 0.2s",
                boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Ürün Görseli */}
            <div style={{
                position: "relative",
                width: "100%",
                height: 180,
                background: isDark ? "rgba(255,255,255,0.03)" : "#f1f5f9",
                overflow: "hidden",
                flexShrink: 0,
            }}>
                {product.imageUrl && !imgError ? (
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        onError={() => setImgError(true)}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#64748b", fontSize: "2.5rem",
                    }}>
                        <FaBoxOpen />
                    </div>
                )}

                {/* Fırsat Skoru Badge */}
                <div style={{
                    position: "absolute", top: 8, left: 8,
                    background: `${scoreColor(product.opportunityScore)}dd`,
                    color: "#fff", fontSize: "0.62rem", fontWeight: 800,
                    padding: "0.2rem 0.45rem", borderRadius: 6,
                    display: "flex", alignItems: "center", gap: "0.2rem",
                    backdropFilter: "blur(4px)",
                }}>
                    {scoreEmoji(product.opportunityScore)} {product.opportunityScore}
                </div>

                {/* Trend Badge */}
                {product.trendDirection && product.trendDirection !== "unknown" && (
                    <div style={{
                        position: "absolute", top: 8, right: 8,
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff", fontSize: "0.58rem", fontWeight: 700,
                        padding: "0.18rem 0.4rem", borderRadius: 6,
                        backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", gap: "0.15rem",
                    }}>
                        {trendIcon(product.trendDirection)} {product.trendDirection === "breakout" ? "Patlama" : product.trendDirection === "rising" ? "Yükseliş" : product.trendDirection === "stable" ? "Stabil" : "Düşüş"}
                    </div>
                )}

                {/* Kâr Marjı Badge */}
                {product.profitMargin > 0 && (
                    <div style={{
                        position: "absolute", bottom: 8, right: 8,
                        background: `${profitColor}dd`,
                        color: "#fff", fontSize: "0.6rem", fontWeight: 700,
                        padding: "0.18rem 0.4rem", borderRadius: 6,
                        backdropFilter: "blur(4px)",
                    }}>
                        %{product.profitMargin} kâr
                    </div>
                )}
            </div>

            {/* Ürün Bilgileri */}
            <div style={{ padding: "0.7rem 0.8rem", flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Kategori & Keyword */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                    <span style={{
                        background: `${exp.color}15`, color: exp.color,
                        fontSize: "0.52rem", fontWeight: 700, padding: "0.1rem 0.35rem",
                        borderRadius: 4, display: "flex", alignItems: "center", gap: "0.15rem",
                    }}>
                        {exp.icon} {exp.text}
                    </span>
                    <span style={{
                        color: "#94a3b8", fontSize: "0.55rem",
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        padding: "0.08rem 0.3rem", borderRadius: 4,
                    }}>
                        <FaTag style={{ fontSize: "0.45rem", marginRight: "0.15rem" }} />
                        {product.keyword}
                    </span>
                </div>

                {/* Ürün Adı */}
                <h4 style={{
                    margin: "0 0 0.4rem", fontSize: "0.78rem", fontWeight: 700,
                    color: C.text, lineHeight: 1.35,
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                    {product.name || "İsimsiz Ürün"}
                </h4>

                {/* Fiyat & Rating */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: "0.4rem",
                }}>
                    <span style={{
                        fontSize: "1.1rem", fontWeight: 900, color: "#3b82f6",
                    }}>
                        {formatMoney(product.price)}
                    </span>
                    {product.rating > 0 && (
                        <span style={{
                            display: "flex", alignItems: "center", gap: "0.2rem",
                            fontSize: "0.68rem", color: "#f59e0b", fontWeight: 600,
                        }}>
                            <FaStar style={{ fontSize: "0.6rem" }} />
                            {product.rating.toFixed(1)}
                            <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                                ({product.reviewCount || 0})
                            </span>
                        </span>
                    )}
                </div>

                {/* Satıcı */}
                {product.seller && (
                    <div style={{
                        fontSize: "0.6rem", color: "#94a3b8",
                        display: "flex", alignItems: "center", gap: "0.2rem",
                        marginBottom: "0.4rem",
                    }}>
                        <FaStore style={{ fontSize: "0.5rem" }} /> {product.seller}
                    </div>
                )}

                {/* Mini Skor Çubukları */}
                <div style={{ marginBottom: "0.4rem", marginTop: "auto" }}>
                    <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.2rem" }}>
                        {[
                            { label: "Trend", value: product.trendScore, color: scoreColor(product.trendScore) },
                            { label: "Talep", value: product.demandScore, color: scoreColor(product.demandScore) },
                            { label: "Rekabet", value: product.competitionScore, color: scoreColor(product.competitionScore) },
                            { label: "Kâr", value: product.profitScore, color: scoreColor(product.profitScore) },
                        ].map((s, i) => (
                            <div key={i} style={{ flex: 1, textAlign: "center" }}>
                                <div style={{
                                    height: 4, background: "rgba(255,255,255,0.06)",
                                    borderRadius: 2, overflow: "hidden", marginBottom: "0.1rem",
                                }}>
                                    <div style={{
                                        height: "100%", width: `${s.value}%`,
                                        background: s.color, borderRadius: 2,
                                        transition: "width 0.6s ease",
                                    }} />
                                </div>
                                <span style={{ fontSize: "0.48rem", color: "#64748b" }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Kâr Analizi Satırı */}
                <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.3rem", marginBottom: "0.5rem",
                }}>
                    {[
                        { label: "Maliyet", value: formatMoney(product.estimatedCost), icon: "📦" },
                        { label: "Kâr", value: formatMoney(product.estimatedProfit), icon: "💰", color: profitColor },
                        { label: "Marj", value: `%${product.profitMargin}`, icon: "📊", color: profitColor },
                    ].map((m, i) => (
                        <div key={i} style={{
                            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                            borderRadius: 6, padding: "0.25rem 0.3rem", textAlign: "center",
                        }}>
                            <div style={{ fontSize: "0.5rem", color: "#94a3b8" }}>{m.icon} {m.label}</div>
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: m.color || C.text }}>{m.value}</div>
                        </div>
                    ))}
                </div>

                {/* Aksiyon Butonları */}
                <div style={{ display: "flex", gap: "0.35rem" }}>
                    {product.url && (
                        <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: "0.25rem", padding: "0.4rem 0.5rem",
                                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                                borderRadius: 8, cursor: "pointer",
                                color: "#3b82f6", fontSize: "0.65rem", fontWeight: 600,
                                textDecoration: "none",
                            }}
                        >
                            <FaExternalLinkAlt style={{ fontSize: "0.5rem" }} /> İncele
                        </a>
                    )}
                    <button
                        onClick={() => {
                            if (product.url) window.open(product.url, "_blank");
                        }}
                        style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                            gap: "0.25rem", padding: "0.4rem 0.5rem",
                            background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))",
                            border: "1px solid rgba(34,197,94,0.25)",
                            borderRadius: 8, cursor: "pointer",
                            color: "#22c55e", fontSize: "0.65rem", fontWeight: 600,
                            fontFamily: "inherit",
                        }}
                    >
                        <FaPlus style={{ fontSize: "0.5rem" }} /> Mağazama Ekle
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════
// 🏠 ANA BİLEŞEN
// ═══════════════════════════════════════════════════════════════
const MAIN_TABS = [
    { key: "opportunities", label: "Fırsat Radarı", icon: <FaCrosshairs /> },
    { key: "products", label: "Ürün Keşfet", icon: <FaBoxOpen /> },
];

const FILTER_OPTIONS = [
    { key: "best", label: "En İyi Fırsatlar", icon: <FaStar />, sortBy: null },
    { key: "trend", label: "Trend Olanlar", icon: <FaFire />, sortBy: "trend" },
    { key: "profit", label: "Yüksek Kâr", icon: <FaDollarSign />, sortBy: "profit" },
    { key: "competition", label: "Düşük Rekabet", icon: <FaShieldAlt />, sortBy: "competition" },
];

const PRODUCT_SORT_OPTIONS = [
    { key: "score", label: "Fırsat Skoru", icon: <FaStar /> },
    { key: "profit", label: "Yüksek Kâr", icon: <FaDollarSign /> },
    { key: "price", label: "Düşük Fiyat", icon: <FaTag /> },
    { key: "rating", label: "Yüksek Puan", icon: <FaStar /> },
];

export default function RadarProPage({ userId }) {
    const { theme: C, resolvedTheme } = useApp();
    const isDark = resolvedTheme === "dark";

    // ── Ana Tab ──
    const [mainTab, setMainTab] = useState("opportunities");

    // ── Fırsat Tab State ──
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");
    const [activeFilter, setActiveFilter] = useState("best");
    const [simOpp, setSimOpp] = useState(null);

    // ── Ürün Tab State ──
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState("");
    const [productSort, setProductSort] = useState("score");
    const [productStats, setProductStats] = useState({ total: 0, avgScore: 0, avgProfit: 0 });

    // ═══════════════════════════════════════════════════════════
    // Fırsatları yükle
    // ═══════════════════════════════════════════════════════════
    const loadOpportunities = useCallback(async (sortBy) => {
        setLoading(true);
        setError("");
        try {
            const res = await getOpportunities({ sortBy });
            const data = res?.data || {};
            setOpportunities(data.opportunities || []);
            setAnalyzing(data.stats?.analyzing === true);
        } catch (err) {
            setError(err?.response?.data?.message || err.message || "Fırsatlar yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (mainTab !== "opportunities") return;
        const filter = FILTER_OPTIONS.find(f => f.key === activeFilter);
        loadOpportunities(filter?.sortBy);
    }, [activeFilter, loadOpportunities, mainTab]);

    // ═══════════════════════════════════════════════════════════
    // Ürünleri yükle
    // ═══════════════════════════════════════════════════════════
    const loadProducts = useCallback(async (sortBy) => {
        setProductsLoading(true);
        setProductsError("");
        try {
            const res = await getProductOpportunities({ sortBy, limit: 50 });
            const data = res?.data || {};
            setProducts(data.products || []);
            setProductStats(data.stats || { total: 0, avgScore: 0, avgProfit: 0 });
        } catch (err) {
            setProductsError(err?.response?.data?.message || err.message || "Ürünler yüklenemedi");
        } finally {
            setProductsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (mainTab !== "products") return;
        loadProducts(productSort);
    }, [productSort, loadProducts, mainTab]);

    // Polling — analiz devam ediyorsa
    useEffect(() => {
        if (!analyzing) return;
        const interval = setInterval(async () => {
            try {
                const res = await getOpportunities({});
                const data = res?.data || {};
                if (data.opportunities?.length > 0) {
                    setOpportunities(data.opportunities);
                    setAnalyzing(false);
                }
            } catch { /* ignore */ }
        }, 15000);
        return () => clearInterval(interval);
    }, [analyzing]);

    // Yenile
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await refreshOpportunities();
            const data = res?.data || {};
            if (data.opportunities?.length > 0) {
                setOpportunities(data.opportunities);
                setAnalyzing(false);
            } else {
                setAnalyzing(true);
            }
        } catch (err) {
            setError("Yenileme başarısız: " + (err.message || ""));
        } finally {
            setRefreshing(false);
        }
    };

    // Kaldır
    const handleDismiss = async (id) => {
        try {
            await recordOpportunityAction(id, "dismissed");
            setOpportunities(prev => prev.filter(o => o._id !== id));
        } catch { /* ignore */ }
    };

    return (
        <div style={{ width: "100%", minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

            {/* ── HEADER ── */}
            <div style={{
                background: isDark
                    ? "linear-gradient(135deg, #0f1628 0%, #1a1040 50%, #0f1628 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f0f2ff 100%)",
                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                padding: "1rem 1.25rem 0.75rem",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                        <h1 style={{
                            margin: 0, fontSize: "1.3rem", fontWeight: 900,
                            background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            display: "flex", alignItems: "center", gap: "0.4rem",
                        }}>
                            <FaCrosshairs style={{ WebkitTextFillColor: "#f59e0b" }} />
                            Sana Özel Ürün Fırsatları
                        </h1>
                        <p style={{ color: "#94a3b8", fontSize: "0.72rem", margin: "0.15rem 0 0" }}>
                            AI destekli pazar analizi — en iyi fırsatlar, tek tıkla aksiyon
                        </p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                            border: "none", borderRadius: 10,
                            padding: "0.5rem 1rem", cursor: refreshing ? "not-allowed" : "pointer",
                            color: "#fff", fontSize: "0.78rem", fontWeight: 700,
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            opacity: refreshing ? 0.6 : 1,
                            boxShadow: "0 4px 15px rgba(245,158,11,0.3)",
                        }}
                    >
                        {refreshing ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaSync />}
                        {refreshing ? "Analiz Ediliyor..." : "Yeni Analiz"}
                    </motion.button>
                </div>

                {/* ── ANA TAB SEÇİCİ ── */}
                <div style={{
                    display: "flex", gap: "0.25rem", marginTop: "0.7rem",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    borderRadius: 10, padding: "0.2rem",
                }}>
                    {MAIN_TABS.map(tab => {
                        const isActive = mainTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setMainTab(tab.key)}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: "0.35rem", padding: "0.5rem 0.7rem",
                                    background: isActive
                                        ? isDark
                                            ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(139,92,246,0.12))"
                                            : "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(139,92,246,0.08))"
                                        : "transparent",
                                    border: isActive
                                        ? "1px solid rgba(245,158,11,0.25)"
                                        : "1px solid transparent",
                                    borderRadius: 8, cursor: "pointer",
                                    color: isActive ? "#f59e0b" : "#64748b",
                                    fontSize: "0.78rem", fontWeight: isActive ? 700 : 500,
                                    fontFamily: "inherit", transition: "all 0.2s",
                                }}
                            >
                                {tab.icon} {tab.label}
                                {tab.key === "products" && productStats.total > 0 && (
                                    <span style={{
                                        background: isActive ? "rgba(245,158,11,0.2)" : "rgba(100,116,139,0.15)",
                                        color: isActive ? "#f59e0b" : "#94a3b8",
                                        fontSize: "0.58rem", fontWeight: 700,
                                        padding: "0.08rem 0.35rem", borderRadius: 10,
                                    }}>
                                        {productStats.total}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── ALT FİLTRELER (Tab'a göre) ── */}
                {mainTab === "opportunities" && (
                    <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        {FILTER_OPTIONS.map(f => {
                            const isActive = activeFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setActiveFilter(f.key)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "0.3rem",
                                        padding: "0.35rem 0.65rem",
                                        background: isActive
                                            ? "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))"
                                            : "transparent",
                                        border: `1px solid ${isActive ? "rgba(245,158,11,0.3)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                        borderRadius: 8, cursor: "pointer",
                                        color: isActive ? "#f59e0b" : "#94a3b8",
                                        fontSize: "0.68rem", fontWeight: isActive ? 700 : 500,
                                        fontFamily: "inherit", transition: "all 0.15s",
                                    }}
                                >
                                    {f.icon} {f.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {mainTab === "products" && (
                    <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <FaSortAmountDown style={{ color: "#64748b", fontSize: "0.65rem" }} />
                        {PRODUCT_SORT_OPTIONS.map(s => {
                            const isActive = productSort === s.key;
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => setProductSort(s.key)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "0.3rem",
                                        padding: "0.35rem 0.65rem",
                                        background: isActive
                                            ? "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))"
                                            : "transparent",
                                        border: `1px solid ${isActive ? "rgba(59,130,246,0.3)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                        borderRadius: 8, cursor: "pointer",
                                        color: isActive ? "#3b82f6" : "#94a3b8",
                                        fontSize: "0.68rem", fontWeight: isActive ? 700 : 500,
                                        fontFamily: "inherit", transition: "all 0.15s",
                                    }}
                                >
                                    {s.icon} {s.label}
                                </button>
                            );
                        })}

                        {/* Ürün İstatistikleri */}
                        {productStats.total > 0 && (
                            <div style={{
                                marginLeft: "auto", display: "flex", gap: "0.6rem",
                                fontSize: "0.6rem", color: "#94a3b8",
                            }}>
                                <span>Ort. Skor: <b style={{ color: scoreColor(productStats.avgScore) }}>{productStats.avgScore}</b></span>
                                <span>Ort. Kâr: <b style={{ color: productStats.avgProfit > 0 ? "#22c55e" : "#ef4444" }}>{formatMoney(productStats.avgProfit)}</b></span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── CONTENT ── */}
            <div style={{ flex: 1, padding: "0.75rem 1rem", overflow: "auto" }}>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TAB: FIRSATLAR                                        */}
                {/* ═══════════════════════════════════════════════════════ */}
                {mainTab === "opportunities" && (
                    <>
                        {/* Analyzing State */}
                        {analyzing && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    background: isDark ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.05)",
                                    border: "1px solid rgba(245,158,11,0.2)",
                                    borderRadius: 12, padding: "1.2rem", textAlign: "center",
                                    marginBottom: "0.75rem",
                                }}
                            >
                                <FaSpinner style={{ fontSize: "1.5rem", color: "#f59e0b", animation: "spin 1s linear infinite", marginBottom: "0.5rem" }} />
                                <h3 style={{ margin: "0 0 0.3rem", color: C.text, fontSize: "0.95rem" }}>
                                    🔭 Fırsat Analizi Devam Ediyor...
                                </h3>
                                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.72rem" }}>
                                    AI motorumuz sizin için en iyi fırsatları tarıyor. Bu işlem birkaç dakika sürebilir.
                                </p>
                            </motion.div>
                        )}

                        {/* Loading */}
                        {loading && !analyzing && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
                                <FaSpinner style={{ animation: "spin 1s linear infinite", marginRight: "0.5rem" }} />
                                Fırsatlar yükleniyor...
                            </div>
                        )}

                        {/* Error */}
                        {error && !loading && (
                            <div style={{
                                padding: "0.8rem 1rem", background: "rgba(239,68,68,0.08)",
                                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
                                color: "#ef4444", fontSize: "0.78rem",
                                display: "flex", alignItems: "center", gap: "0.4rem",
                            }}>
                                <FaExclamationTriangle /> {error}
                            </div>
                        )}

                        {/* Empty State */}
                        {!loading && !analyzing && !error && opportunities.length === 0 && (
                            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔭</div>
                                <h3 style={{ color: C.text, fontSize: "1rem", margin: "0 0 0.3rem" }}>
                                    Henüz Fırsat Bulunamadı
                                </h3>
                                <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 1rem" }}>
                                    Ürünlerinizi ekledikten sonra AI motorumuz sizin için fırsatları tarayacak.
                                </p>
                                <button
                                    onClick={handleRefresh}
                                    style={{
                                        background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                                        border: "none", borderRadius: 10,
                                        padding: "0.5rem 1.2rem", cursor: "pointer",
                                        color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                                    }}
                                >
                                    <FaSync style={{ marginRight: "0.3rem" }} /> Analiz Başlat
                                </button>
                            </div>
                        )}

                        {/* Opportunity Cards */}
                        {!loading && opportunities.length > 0 && (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                                gap: "0.75rem",
                            }}>
                                {opportunities.map((opp, idx) => (
                                    <OpportunityCard
                                        key={opp._id || idx}
                                        opp={opp}
                                        C={C}
                                        isDark={isDark}
                                        index={idx}
                                        onSimulate={(o) => setSimOpp(o)}
                                        onDismiss={handleDismiss}
                                        onDetail={() => {}}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TAB: ÜRÜNLER                                          */}
                {/* ═══════════════════════════════════════════════════════ */}
                {mainTab === "products" && (
                    <>
                        {/* Loading */}
                        {productsLoading && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", color: "#94a3b8" }}>
                                <FaSpinner style={{ animation: "spin 1s linear infinite", marginRight: "0.5rem" }} />
                                Ürünler yükleniyor...
                            </div>
                        )}

                        {/* Error */}
                        {productsError && !productsLoading && (
                            <div style={{
                                padding: "0.8rem 1rem", background: "rgba(239,68,68,0.08)",
                                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
                                color: "#ef4444", fontSize: "0.78rem",
                                display: "flex", alignItems: "center", gap: "0.4rem",
                            }}>
                                <FaExclamationTriangle /> {productsError}
                            </div>
                        )}

                        {/* Empty State */}
                        {!productsLoading && !productsError && products.length === 0 && (
                            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📦</div>
                                <h3 style={{ color: C.text, fontSize: "1rem", margin: "0 0 0.3rem" }}>
                                    Henüz Ürün Bulunamadı
                                </h3>
                                <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 1rem", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
                                    Önce "Yeni Analiz" butonuna tıklayarak fırsat taraması başlatın.
                                    Analiz tamamlandığında burada ürün bazlı fırsatlar görünecek.
                                </p>
                                <button
                                    onClick={handleRefresh}
                                    style={{
                                        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                                        border: "none", borderRadius: 10,
                                        padding: "0.5rem 1.2rem", cursor: "pointer",
                                        color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                                    }}
                                >
                                    <FaSync style={{ marginRight: "0.3rem" }} /> Analiz Başlat
                                </button>
                            </div>
                        )}

                        {/* Product Cards Grid */}
                        {!productsLoading && products.length > 0 && (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                gap: "0.75rem",
                            }}>
                                {products.map((product, idx) => (
                                    <ProductCard
                                        key={`${product.opportunityId}-${product.name}-${idx}`}
                                        product={product}
                                        C={C}
                                        isDark={isDark}
                                        index={idx}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Simülasyon Modal */}
            <AnimatePresence>
                {simOpp && (
                    <SimulationModal
                        opp={simOpp}
                        C={C}
                        isDark={isDark}
                        onClose={() => setSimOpp(null)}
                    />
                )}
            </AnimatePresence>

            {/* CSS Animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
