import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaPlay, FaSpinner } from "react-icons/fa";
import { simulateOpportunity, unwrapRadar } from "../../services/radarApi";
import { formatMoney } from "./radarUtils";

export default function RadarSimulationModal({ opp, onClose }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [targetPrice, setTargetPrice] = useState(
        opp.profitAnalysis?.suggestedPrice || opp.marketData?.avgPrice || 100
    );
    const [monthlySales, setMonthlySales] = useState(
        Math.max(1, Math.round((opp.marketData?.estimatedMonthlySales || 10) * 0.02))
    );
    const [investment, setInvestment] = useState(0);

    const runSimulation = useCallback(async () => {
        setLoading(true);
        try {
            const res = await simulateOpportunity({
                opportunityId: opp._id,
                targetPrice: parseFloat(targetPrice),
                estimatedMonthlySales: parseInt(monthlySales, 10),
                investmentAmount: parseFloat(investment) || undefined,
            });
            const body = unwrapRadar(res);
            setResult(body.simulation || null);
        } catch (err) {
            console.error("Simülasyon hatası:", err);
        } finally {
            setLoading(false);
        }
    }, [opp._id, targetPrice, monthlySales, investment]);

    useEffect(() => {
        runSimulation();
    }, [runSimulation]);

    return (
        <div className="rp-modal-backdrop" onClick={onClose} role="presentation">
            <motion.div
                className="rp-modal"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="rp-sim-title"
            >
                <header className="rp-modal-head">
                    <div>
                        <h3 id="rp-sim-title">Kâr simülasyonu</h3>
                        <span>{opp.keyword}</span>
                    </div>
                    <button type="button" className="rp-modal-close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>

                <div className="rp-modal-body">
                    <div className="rp-sim-inputs">
                        <label>
                            Satış fiyatı (₺)
                            <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
                        </label>
                        <label>
                            Aylık satış (adet)
                            <input type="number" value={monthlySales} onChange={(e) => setMonthlySales(e.target.value)} />
                        </label>
                        <label>
                            Yatırım (₺)
                            <input type="number" value={investment} onChange={(e) => setInvestment(e.target.value)} />
                        </label>
                    </div>
                    <button type="button" className="rp-btn-primary rp-btn-primary--block" onClick={runSimulation} disabled={loading}>
                        {loading ? <FaSpinner className="rp-spin" /> : <FaPlay />}
                        Hesapla
                    </button>
                </div>

                {result && (
                    <div className="rp-sim-results">
                        {[
                            { label: "Birim kâr", value: formatMoney(result.netProfitPerUnit), ok: result.netProfitPerUnit > 0 },
                            { label: "Kâr marjı", value: `%${result.profitMargin}`, ok: result.profitMargin > 15 },
                            { label: "Aylık ciro", value: formatMoney(result.monthlyRevenue) },
                            { label: "Aylık kâr", value: formatMoney(result.monthlyProfit), ok: result.monthlyProfit > 0 },
                            { label: "Yıllık kâr", value: formatMoney(result.yearlyProfit), ok: result.yearlyProfit > 0 },
                            { label: "ROI", value: `%${result.roi}`, ok: result.roi > 20 },
                            { label: "Başabaş", value: `${result.breakEvenUnits} adet` },
                            { label: "Başabaş süre", value: `${result.breakEvenMonths} ay` },
                        ].map((r) => (
                            <div key={r.label} className="rp-sim-cell">
                                <span>{r.label}</span>
                                <strong className={r.ok === false ? "rp-text-danger" : r.ok ? "rp-text-success" : ""}>
                                    {r.value}
                                </strong>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
