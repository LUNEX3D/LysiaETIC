import React, { useState } from "react";
import {
    FaBoxOpen, FaStar, FaStore, FaTag, FaExternalLinkAlt, FaPlus,
} from "react-icons/fa";
import { scoreEmoji, expansionLabel, trendIcon } from "../../constants/radarProLabels";
import { scoreColor, formatMoney, trendDirectionLabel } from "./radarUtils";

export default function RadarProductCard({ product, index = 0, onAddToStore }) {
    const [imgError, setImgError] = useState(false);
    const profitPositive = product.estimatedProfit > 0;
    const exp = expansionLabel(product.expansionType);
    const sc = scoreColor(product.opportunityScore);

    return (
        <article
            className="rp-product-card"
            style={{ "--score-color": sc, "--anim-delay": `${Math.min(index, 8) * 40}ms` }}
        >
            <div className="rp-product-visual">
                {product.imageUrl && !imgError ? (
                    <img src={product.imageUrl} alt={product.name} onError={() => setImgError(true)} loading="lazy" />
                ) : (
                    <div className="rp-product-fallback">
                        <FaBoxOpen />
                    </div>
                )}
                <div className="rp-product-overlay">
                    <span className="rp-product-score-chip" style={{ borderColor: sc }}>
                        {scoreEmoji(product.opportunityScore)} {product.opportunityScore}
                    </span>
                    {product.profitMargin > 0 && (
                        <span className="rp-product-margin-chip">%{product.profitMargin} marj</span>
                    )}
                </div>
                {product.trendDirection && product.trendDirection !== "unknown" && (
                    <span className="rp-product-trend-badge">
                        {trendIcon(product.trendDirection)} {trendDirectionLabel(product.trendDirection)}
                    </span>
                )}
            </div>

            <div className="rp-product-content">
                <div className="rp-tag-row rp-tag-row--compact">
                    <span className="rp-tag" style={{ "--tag-color": exp.color }}>
                        {exp.icon} {exp.text}
                    </span>
                    <span className="rp-tag rp-tag--muted">
                        <FaTag /> {product.keyword}
                    </span>
                </div>

                <h3 className="rp-product-name">{product.name || "İsimsiz ürün"}</h3>

                <div className="rp-product-meta">
                    <strong className="rp-product-price">{formatMoney(product.price)}</strong>
                    {product.rating > 0 && (
                        <span className="rp-product-rating">
                            <FaStar /> {product.rating.toFixed(1)} · {product.reviewCount || 0}
                        </span>
                    )}
                </div>

                {product.seller && (
                    <p className="rp-product-seller"><FaStore /> {product.seller}</p>
                )}

                <div className="rp-product-bars">
                    {[
                        { label: "Trend", value: product.trendScore },
                        { label: "Talep", value: product.demandScore },
                        { label: "Rekabet", value: product.competitionScore },
                        { label: "Kâr", value: product.profitScore },
                    ].map((s) => (
                        <div key={s.label} className="rp-product-bar">
                            <span>{s.label}</span>
                            <div className="rp-bar-track">
                                <div
                                    className="rp-bar-fill"
                                    style={{ width: `${s.value}%`, background: scoreColor(s.value) }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rp-product-economics">
                    <div>
                        <span>Maliyet</span>
                        <strong>{formatMoney(product.estimatedCost)}</strong>
                    </div>
                    <div>
                        <span>Kâr</span>
                        <strong className={profitPositive ? "is-positive" : "is-negative"}>
                            {formatMoney(product.estimatedProfit)}
                        </strong>
                    </div>
                    <div>
                        <span>Marj</span>
                        <strong className={profitPositive ? "is-positive" : "is-negative"}>
                            %{product.profitMargin}
                        </strong>
                    </div>
                </div>

                <div className="rp-product-foot">
                    {product.url && (
                        <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rp-btn-ghost"
                        >
                            <FaExternalLinkAlt /> İncele
                        </a>
                    )}
                    <button type="button" className="rp-btn-primary" onClick={() => onAddToStore?.(product)}>
                        <FaPlus /> Mağazaya ekle
                    </button>
                </div>
            </div>
        </article>
    );
}
