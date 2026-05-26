import React, { useState } from "react";
import {
    FaLightbulb, FaChevronDown, FaChevronUp, FaPlay, FaTimes,
} from "react-icons/fa";
import {
    scoreEmoji, scoreLabel, expansionLabel, trendIcon,
} from "../../constants/radarProLabels";
import RadarScoreBar from "./RadarScoreBar";
import { scoreColor, formatMoney, trendDirectionLabel } from "./radarUtils";

function ScoreRing({ score, color }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const pct = Math.min(100, Math.max(0, score || 0)) / 100;
    return (
        <div className="rp-ring" style={{ "--rp-ring-color": color }}>
            <svg viewBox="0 0 60 60" aria-hidden>
                <circle className="rp-ring-track" cx="30" cy="30" r={r} />
                <circle
                    className="rp-ring-fill"
                    cx="30"
                    cy="30"
                    r={r}
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - pct)}
                />
            </svg>
            <div className="rp-ring-label">
                <span>{scoreEmoji(score)}</span>
                <strong>{score}</strong>
            </div>
        </div>
    );
}

export default function RadarOpportunityCard({
    opp,
    index = 0,
    onSimulate,
    onDismiss,
    onKeywordClick,
}) {
    const [expanded, setExpanded] = useState(false);
    const exp = expansionLabel(opp.expansionType);
    const sc = scoreColor(opp.totalScore);
    const tier = scoreLabel(opp.totalScore);

    return (
        <article
            className="rp-opp-card"
            style={{ "--rp-score": sc, "--rp-delay": `${Math.min(index, 6) * 40}ms` }}
        >
            <div className="rp-opp-top">
                <ScoreRing score={opp.totalScore} color={sc} />
                <div className="rp-opp-intro">
                    <button
                        type="button"
                        className="rp-opp-keyword"
                        onClick={() => onKeywordClick?.(opp.keyword)}
                        title="Bu kelimeyle filtrele"
                    >
                        {opp.keyword}
                    </button>
                    <span className="rp-opp-tier" style={{ color: sc }}>{tier}</span>
                    <div className="rp-opp-tags">
                        <span className="rp-tag" style={{ "--tag-color": exp.color }}>
                            {exp.icon} {exp.text}
                        </span>
                        {opp.nicheLabel && <span className="rp-tag rp-tag--accent">{opp.nicheLabel}</span>}
                        {opp.category && <span className="rp-tag">{opp.category}</span>}
                        <span className="rp-tag">
                            {trendIcon(opp.trendData?.trendDirection)}{" "}
                            {trendDirectionLabel(opp.trendData?.trendDirection)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="rp-opp-metrics">
                <div className="rp-metric">
                    <span>Ort. fiyat</span>
                    <strong>{formatMoney(opp.marketData?.avgPrice)}</strong>
                </div>
                <div className="rp-metric">
                    <span>Satıcı</span>
                    <strong>{opp.marketData?.sellerCount || 0}</strong>
                </div>
                <div className="rp-metric rp-metric--profit">
                    <span>Kâr marjı</span>
                    <strong>%{opp.profitAnalysis?.estimatedMargin || 0}</strong>
                </div>
            </div>

            <div className="rp-opp-scores">
                <RadarScoreBar label="Trend" value={opp.scores?.trend} />
                <RadarScoreBar label="Talep" value={opp.scores?.demand} />
                <RadarScoreBar label="Rekabet" value={opp.scores?.competition} />
                <RadarScoreBar label="Kâr" value={opp.scores?.profit} />
                <RadarScoreBar label="Uyum" value={opp.scores?.userFit} />
            </div>

            {opp.aiExplanation && (
                <div className="rp-opp-ai">
                    <div className="rp-opp-ai-head">
                        <FaLightbulb />
                        <span>AI özeti</span>
                        <small>%{opp.aiConfidence || 50} güven</small>
                    </div>
                    <p className={expanded ? "is-open" : ""}>{opp.aiExplanation}</p>
                </div>
            )}

            {expanded && (
                <div className="rp-opp-expand">
                    <div className="rp-opp-pros-cons">
                        <div>
                            <h4>Avantajlar</h4>
                            {(opp.aiBenefits || []).map((b, i) => (
                                <p key={i}>✓ {b}</p>
                            ))}
                        </div>
                        <div>
                            <h4>Riskler</h4>
                            {(opp.aiRisks || []).length === 0 ? (
                                <p className="rp-muted">Belirgin risk yok</p>
                            ) : (
                                opp.aiRisks.map((r, i) => <p key={i}>⚠ {r}</p>)
                            )}
                        </div>
                    </div>
                    <div className="rp-opp-market-detail">
                        {[
                            ["Min", formatMoney(opp.marketData?.minPrice)],
                            ["Max", formatMoney(opp.marketData?.maxPrice)],
                            ["Puan", (opp.marketData?.avgRating || 0).toFixed(1)],
                            ["Ürün", (opp.marketData?.totalProducts || 0).toLocaleString("tr-TR")],
                            ["Öneri", formatMoney(opp.profitAnalysis?.suggestedPrice)],
                        ].map(([l, v]) => (
                            <div key={l}>
                                <span>{l}</span>
                                <strong>{v}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <footer className="rp-opp-foot">
                <button type="button" className="rp-action" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <FaChevronUp /> : <FaChevronDown />}
                    {expanded ? "Daralt" : "Detay"}
                </button>
                <button type="button" className="rp-action rp-action--primary" onClick={() => onSimulate?.(opp)}>
                    <FaPlay /> Simülasyon
                </button>
                <button type="button" className="rp-action rp-action--muted" onClick={() => onDismiss?.(opp._id)}>
                    <FaTimes />
                </button>
            </footer>
        </article>
    );
}
