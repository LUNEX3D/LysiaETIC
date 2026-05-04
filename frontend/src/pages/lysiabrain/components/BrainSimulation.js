/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Simülasyon Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * What-if analysis: single + advanced multi-scenario simulation
 * Uses: POST /simulate, POST /simulate-advanced, POST /simulate/apply
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState } from "react";
import API from "../../../services/api";
import { T, fmt, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, StatCard, EmptyState, LoadingState, ErrorState, Input } from "./shared/SharedUI";

const BrainSimulation = ({ t, onError }) => {
    const { isMobile } = useResponsive();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [applyLoading, setApplyLoading] = useState(false);

    // Single simulation form
    const [barcode, setBarcode] = useState("");
    const [priceChangePct, setPriceChangePct] = useState("");
    const [stockChange, setStockChange] = useState("");
    const [campaignPct, setCampaignPct] = useState("");

    // Advanced simulation
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advResult, setAdvResult] = useState(null);
    const [advLoading, setAdvLoading] = useState(false);
    const [scenarios, setScenarios] = useState([
        { barcode: "", priceChangePct: -5 },
        { barcode: "", priceChangePct: -10 },
        { barcode: "", priceChangePct: 5 },
    ]);

    const handleSimulate = async () => {
        if (!barcode.trim()) return;
        setLoading(true); setError(null); setResult(null);
        try {
            const res = await API.post("/ai-engine/simulate", {
                barcode: barcode.trim(),
                priceChangePct: Number(priceChangePct) || 0,
                stockChange: Number(stockChange) || 0,
                campaignDiscountPct: Number(campaignPct) || 0,
            });
            if (res.data && res.data.success !== false) setResult(res.data.simulation);
            else setError(res.data.message || t("error.simulation_fail"));
        } catch (e) { setError(e.response?.data?.message || t("error.simulation_fail")); }
        finally { setLoading(false); }
    };

    const handleApply = async () => {
        if (!result?.product) return;
        setApplyLoading(true);
        try {
            await API.post("/ai-engine/simulate/apply", {
                products: [{ barcode: result.product.barcode, newPrice: result.product.newPrice, oldPrice: result.product.oldPrice }]
            });
            setResult(prev => prev ? { ...prev, _applied: true } : prev);
        } catch (e) { onError?.(e.response?.data?.message || t("error.simulation_fail")); }
        finally { setApplyLoading(false); }
    };

    const handleAdvanced = async () => {
        const valid = scenarios.filter(s => s.barcode?.trim());
        if (valid.length === 0) return;
        setAdvLoading(true); setAdvResult(null);
        try {
            const res = await API.post("/ai-engine/simulate-advanced", { scenarios: valid });
            if (res.data && res.data.success !== false) setAdvResult(res.data);
        } catch (e) { onError?.(e.response?.data?.message || t("error.simulation_fail")); }
        finally { setAdvLoading(false); }
    };

    const updateScenario = (idx, field, val) => {
        setScenarios(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
    };

    const riskColor = (risk) => risk === "high" ? T.red : risk === "medium" ? T.yellow : T.green;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* ═══ Single Simulation ═══ */}
            <Card glow>
                <CardHeader icon="🧪" title={t("sim.title")} subtitle={t("sim.subtitle")} color={T.accent} />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder={t("sim.barcode")} ariaLabel={t("sim.barcode")} />
                    <Input value={priceChangePct} onChange={e => setPriceChangePct(e.target.value)} placeholder={t("sim.price_change")} type="number" ariaLabel={t("sim.price_change")} />
                    <Input value={stockChange} onChange={e => setStockChange(e.target.value)} placeholder={t("sim.stock_change")} type="number" ariaLabel={t("sim.stock_change")} />
                    <Input value={campaignPct} onChange={e => setCampaignPct(e.target.value)} placeholder={t("sim.campaign")} type="number" ariaLabel={t("sim.campaign")} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Btn color={T.accent} variant="solid" onClick={handleSimulate} disabled={loading || !barcode.trim()}>
                        {loading ? `⏳ ${t("sim.running")}` : `🧪 ${t("sim.run")}`}
                    </Btn>
                    <Btn color={T.purple} variant="ghost" onClick={() => setShowAdvanced(p => !p)}>
                        {showAdvanced ? "▲" : "▼"} {t("sim.advanced")}
                    </Btn>
                </div>
            </Card>

            {/* ═══ Single Result ═══ */}
            {loading && <LoadingState message={t("loading.simulation")} />}
            {error && <ErrorState message={error} onRetry={handleSimulate} />}

            {result && !loading && (
                <Card>
                    <CardHeader icon="📊" title={t("sim.result")} color={T.accent}
                        badge={result._applied ? "✅ Uygulandı" : undefined}
                        action={!result._applied && result.product?.newPrice ? (
                            <Btn color={T.green} variant="solid" size="sm" onClick={handleApply} disabled={applyLoading}>
                                {applyLoading ? "⏳" : "⚡"} {t("sim.apply")}
                            </Btn>
                        ) : undefined}
                    />
                    {/* Product info */}
                    {result.product && (
                        <div style={{ padding: "0.85rem 1rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}`, marginBottom: "1rem" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text, marginBottom: 6 }}>{result.product.name}</div>
                            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8rem", color: T.textSec }}>
                                <span>📦 {result.product.barcode}</span>
                                {result.product.oldPrice > 0 && <span>💰 {fmt(result.product.oldPrice)} → {fmt(result.product.newPrice)}</span>}
                            </div>
                        </div>
                    )}
                    {/* Summary KPIs */}
                    {result.summary && (
                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                            <StatCard icon="📈" label={t("sim.profit_change")} value={fmt(result.summary.totalProfitChange || 0)} color={result.summary.totalProfitChange >= 0 ? T.green : T.red} />
                            <StatCard icon="💰" label={t("sim.revenue_change")} value={fmt(result.summary.totalRevenueChange || 0)} color={result.summary.totalRevenueChange >= 0 ? T.green : T.red} />
                            <StatCard icon="⚠️" label={t("sim.risk")} value={result.summary.overallRisk || "—"} color={riskColor(result.summary.overallRisk)} />
                        </div>
                    )}
                </Card>
            )}

            {!result && !loading && !error && (
                <Card>
                    <EmptyState icon="🧪" title={t("sim.no_result")} description={t("sim.no_result_desc")} />
                </Card>
            )}

            {/* ═══ Advanced Multi-Scenario ═══ */}
            {showAdvanced && (
                <Card>
                    <CardHeader icon="🔬" title={t("sim.advanced")} subtitle={t("sim.advanced_sub")} color={T.purple} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
                        {scenarios.map((s, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                <Badge color={T.accent} size="sm">#{i + 1}</Badge>
                                <Input value={s.barcode} onChange={e => updateScenario(i, "barcode", e.target.value)} placeholder={t("sim.barcode")} style={{ flex: 1, minWidth: 140 }} />
                                <Input value={s.priceChangePct} onChange={e => updateScenario(i, "priceChangePct", Number(e.target.value))} placeholder="%" type="number" style={{ width: 80 }} />
                            </div>
                        ))}
                        <Btn color={T.textDim} variant="ghost" size="sm" onClick={() => setScenarios(p => [...p, { barcode: "", priceChangePct: 0 }])}>+ Senaryo Ekle</Btn>
                    </div>
                    <Btn color={T.purple} variant="solid" onClick={handleAdvanced} disabled={advLoading}>
                        {advLoading ? `⏳ ${t("sim.running")}` : `🔬 ${t("sim.run")}`}
                    </Btn>

                    {advResult && (
                        <div style={{ marginTop: "1.25rem" }}>
                            {advResult.bestScenario && (
                                <div style={{ padding: "1rem", borderRadius: T.rSm, background: T.greenDim, border: `1px solid ${T.green}20`, marginBottom: "1rem" }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.green }}>🏆 {t("sim.best_scenario")}: #{advResult.bestScenario.scenario}</div>
                                    <div style={{ fontSize: "0.8rem", color: T.textSec, marginTop: 4 }}>
                                        {t("sim.profit_change")}: {fmt(advResult.bestScenario.totalProfitChange)} | {t("sim.risk")}: {advResult.bestScenario.risk}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {(advResult.comparison || []).map((c, i) => (
                                    <div key={i} style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "0.75rem 1rem", borderRadius: T.rSm,
                                        background: advResult.bestScenario?.scenario === c.scenario ? T.greenDim : T.bgGlass,
                                        border: `1px solid ${advResult.bestScenario?.scenario === c.scenario ? T.green + "25" : T.border}`,
                                    }}>
                                        <span style={{ fontWeight: 700, color: T.text, fontSize: "0.85rem" }}>Senaryo #{c.scenario}</span>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <Badge color={c.totalProfitChange >= 0 ? T.green : T.red} size="sm">{fmt(c.totalProfitChange)}</Badge>
                                            <Badge color={riskColor(c.risk)} size="sm">{c.risk}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default React.memo(BrainSimulation);
