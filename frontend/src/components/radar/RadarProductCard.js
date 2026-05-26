import React, { useState } from "react";
import {
    FaBoxOpen, FaStar, FaStore, FaTag, FaExternalLinkAlt, FaPlus,
} from "react-icons/fa";
import { scoreEmoji, expansionLabel, trendIcon } from "../../constants/radarProLabels";
import { scoreColor, formatMoney, trendDirectionLabel } from "./radarUtils";

export default function RadarProductCard({ product, index = 0, onAddToStore }) {
    const [imgError, setImgError] = useState(false);
    const profitColor = product.estimatedProfit > 0 ? "#34d399" : "#f87171";
    const exp = expansionLabel(product.expansionType);
    const sc = scoreColor(product.opportunityScore);

    return (
        <article
            className="rp-product-card"
            style={{ "--rp-delay": `${Math.min(index, 6) * 35}ms`, "--rp-score": sc }}
        >
            <div className="rp-product-media">
                {product.imageUrl && !imgError ? (
                    <img src={product.imageUrl} alt={product.name} onError={() => setImgError(true)} />
                ) : (
                    <div className="rp-product-placeholder">
                        <FaBoxOpen />
                    </div>
                )}
                <div className="rp-product-badges">
                    <span className="rp-product-score">
                        {scoreEmoji(product.opportunityScore)} {product.opportunityScore}
                    </span>
                    {product.profitMargin > 0 && (
                        <span className="rp-product-margin">%{product.profitMargin}</span>
                    )}
                </div>
                {product.trendDirection && product.trendDirection !== "unknown" && (
                    <span className="rp-product-trend">
                        {trendIcon(product.trendDirection)} {trendDirectionLabel(product.trendDirection)}
                    </span>
                )}
            </div>

            <div className="rp-product-body">
                <div className="rp-opp-tags">
                    <span className="rp-tag" style={{ "--tag-color": exp.color }}>
                        {exp.icon} {exp.text}
                    </span>
                    <span className="rp-tag"><FaTag /> {product.keyword}</span>
                </div>
                <h4>{product.name || "İsimsiz ürün"}</h4>
                <div className="rp-product-price-row">
                    <strong>{formatMoney(product.price)}</strong>
                    {product.rating > 0 && (
                        <span><FaStar /> {product.rating.toFixed(1)} · {product.reviewCount || 0}</span>
                    )}
                </div>
                {product.seller && (
                    <p className="rp-product-seller"><FaStore /> {product.seller}</p>
                )}
                <div className="rp-product-mini-scores">
                    {[
                        { label: "Trend", value: product.trendScore },
                        { label: "Talep", value: product.demandScore },
                        { label: "Rekabet", value: product.competitionScore },
                        { label: "Kâr", value: product.profitScore },
                    ].map((s) => (
                        <div key={s.label}>
                            <div className="rp-mini-track">
                                <div style={{ width: `${s.value}%`, background: scoreColor(s.value) }} />
                            </div>
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>
                <div className="rp-product-profit-row">
                    <div><span>Maliyet</span><strong>{formatMoney(product.estimatedCost)}</strong></div>
                    <div><span>Kâr</span><strong style={{ color: profitColor }}>{formatMoney(product.estimatedProfit)}</strong></div>
                    <div><span>Marj</span><strong style={{ color: profitColor }}>%{product.profitMargin}</strong></div>
                </div>
                <div className="rp-product-actions">
                    {product.url && (
                        <a href={product.url} target="_blank" rel="noopener noreferrer" className="rp-action">
                            <FaExternalLinkAlt /> İncele
                        </a>
                    )}
                    <button type="button" className="rp-action rp-action--primary" onClick={() => onAddToStore?.(product)}>
                        <FaPlus /> Ekle
                    </button>
                </div>
            </div>
        </article>
    );
}
