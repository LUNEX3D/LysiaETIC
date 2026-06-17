import React, { useState } from "react";
import {
    FaLightbulb, FaChevronDown, FaChevronUp, FaPlay, FaTimes,
    FaChartLine, FaUsers, FaPercent, FaExpandAlt,
} from "react-icons/fa";
import {
    scoreEmoji, scoreLabel, expansionLabel, trendIcon,
} from "../../constants/radarProLabels";
import RadarScoreBar from "./RadarScoreBar";
import { scoreColor, formatMoney, trendDirectionLabel } from "./radarUtils";

function ScoreBadge({ score, color }) {
    return (
        <div className="rp-score-badge" style={{ "--score-color": color }}>
            <span className="rp-score-badge-emoji">{scoreEmoji(score)}</span>
            <strong>{score}</strong>
            <small>skor</small>
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
            style={{ "--score-color": sc, "--anim-delay": `${Math.min(index, 8) * 45}ms` }}
        >
            <div className="rp-opp-accent" aria-hidden />

            <div className="rp-opp-head">
                <ScoreBadge score={opp.totalScore} color={sc} />
                <div className="rp-opp-head-body">
                    <div className="rp-opp-title-row">
                        <button
                            type="button"
                            className="rp-opp-keyword"
                            onClick={() => onKeywordClick?.(opp.keyword)}
                            title="Bu kelimeyle filtrele"
                        >
                            {opp.keyword}
                        </button>
                        <span className="rp-opp-tier" style={{ color: sc }}>{tier}</span>
                    </div>
                    <div className="rp-tag-row">
                        <span className="rp-tag" style={{ "--tag-color": exp.color }}>
                            {exp.icon} {exp.text}
                        </span>
                        {opp.nicheLabel && <span className="rp-tag rp-tag--highlight">{opp.nicheLabel}</span>}
                        {opp.category && <span className="rp-tag">{opp.category}</span>}
                        <span className="rp-tag rp-tag--trend">
                            {trendIcon(opp.trendData?.trendDirection)}{" "}
                            {trendDirectionLabel(opp.trendData?.trendDirection)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="rp-opp-stats">
                <div className="rp-stat-pill">
                    <FaChartLine />
                    <div>
                        <span>Ort. fiyat</span>
                        <strong>{formatMoney(opp.marketData?.avgPrice)}</strong>
                    </div>
                </div>
                <div className="rp-stat-pill">
                    <FaUsers />
                    <div>
                        <span>Satıcı</span>
                        <strong>{opp.marketData?.sellerCount || 0}</strong>
                    </div>
                </div>
                <div className="rp-stat-pill rp-stat-pill--profit">
                    <FaPercent />
                    <div>
                        <span>Kâr marjı</span>
                        <strong>%{opp.profitAnalysis?.estimatedMargin || 0}</strong>
                    </div>
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
                    <p className={expanded ? "is-expanded" : ""}>{opp.aiExplanation}</p>
                </div>
            )}

            {expanded && (
                <div className="rp-opp-detail">
                    <div className="rp-opp-columns">
                        <div className="rp-opp-column">
                            <h4>Avantajlar</h4>
                            {(opp.aiBenefits || []).length === 0 ? (
                                <p className="rp-muted">—</p>
                            ) : (
                                opp.aiBenefits.map((b, i) => <p key={i}>✓ {b}</p>)
                            )}
                        </div>
                        <div className="rp-opp-column">
                            <h4>Riskler</h4>
                            {(opp.aiRisks || []).length === 0 ? (
                                <p className="rp-muted">Belirgin risk yok</p>
                            ) : (
                                opp.aiRisks.map((r, i) => <p key={i}>⚠ {r}</p>)
                            )}
                        </div>
                    </div>
                    <div className="rp-opp-market-grid">
                        {[
                            ["Min fiyat", formatMoney(opp.marketData?.minPrice)],
                            ["Max fiyat", formatMoney(opp.marketData?.maxPrice)],
                            ["Ort. puan", (opp.marketData?.avgRating || 0).toFixed(1)],
                            ["Ürün sayısı", (opp.marketData?.totalProducts || 0).toLocaleString("tr-TR")],
                            ["Öneri fiyat", formatMoney(opp.profitAnalysis?.suggestedPrice)],
                        ].map(([label, val]) => (
                            <div key={label} className="rp-market-cell">
                                <span>{label}</span>
                                <strong>{val}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <footer className="rp-opp-foot">
                <button type="button" className="rp-btn-ghost" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <FaChevronUp /> : <FaExpandAlt />}
                    {expanded ? "Daralt" : "Detay"}
                </button>
                <button type="button" className="rp-btn-primary" onClick={() => onSimulate?.(opp)}>
                    <FaPlay /> Simülasyon
                </button>
                <button
                    type="button"
                    className="rp-btn-icon"
                    onClick={() => onDismiss?.(opp._id)}
                    aria-label="Kaldır"
                >
                    <FaTimes />
                </button>
            </footer>
        </article>
    );
}
