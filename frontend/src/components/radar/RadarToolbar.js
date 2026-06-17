import React from "react";
import { FaClock, FaExclamationCircle, FaFilter } from "react-icons/fa";
import { FILTER_OPTIONS, PRODUCT_SORT_OPTIONS } from "../../constants/radarProLabels";
import { scoreColor, formatMoney } from "./radarUtils";

function KpiCard({ label, value, accent, valueColor }) {
    return (
        <div className={`rp-kpi-card ${accent ? "rp-kpi-card--accent" : ""}`}>
            <span className="rp-kpi-card-label">{label}</span>
            <strong className="rp-kpi-card-value" style={valueColor ? { color: valueColor } : undefined}>
                {value}
            </strong>
        </div>
    );
}

export default function RadarToolbar({
    mainTab,
    activeFilter,
    onFilterChange,
    productSort,
    onProductSortChange,
    productStats,
    radarMeta,
    oppStats,
    loading,
    opportunitiesTabActive,
}) {
    const showOppKpis = oppStats && mainTab === "opportunities" && !loading;
    const showProductKpis = mainTab === "products" && productStats?.total > 0 && !loading;

    return (
        <div className="rp-toolbar">
            {(showOppKpis || showProductKpis) && (
                <div className="rp-kpi-grid">
                    {showOppKpis && (
                        <>
                            <KpiCard label="Listelenen fırsat" value={oppStats.count} />
                            <KpiCard label="Ortalama skor" value={oppStats.avg} valueColor={scoreColor(oppStats.avg)} />
                            <KpiCard label="Güçlü fırsat (75+)" value={oppStats.strong} accent />
                        </>
                    )}
                    {showProductKpis && (
                        <>
                            <KpiCard label="Ürün örneği" value={productStats.total} />
                            <KpiCard
                                label="Ort. skor"
                                value={productStats.avgScore}
                                valueColor={scoreColor(productStats.avgScore)}
                            />
                            <KpiCard label="Ort. kâr" value={formatMoney(productStats.avgProfit)} accent />
                        </>
                    )}
                </div>
            )}

            {opportunitiesTabActive && radarMeta?.newestFreshness && (
                <div className={`rp-meta-strip ${radarMeta.isStale ? "is-stale" : ""}`}>
                    <FaClock aria-hidden />
                    <span>
                        Son analiz:{" "}
                        {new Date(radarMeta.newestFreshness).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                        })}
                    </span>
                    {radarMeta.isStale && (
                        <span className="rp-meta-strip-warn">
                            <FaExclamationCircle /> Güncelleme önerilir
                        </span>
                    )}
                    {radarMeta.nextRotationAt && (
                        <>
                            <span className="rp-meta-strip-dot" />
                            <span className="rp-meta-strip-sub">
                                Sonraki rotasyon:{" "}
                                {new Date(radarMeta.nextRotationAt).toLocaleString("tr-TR", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                })}
                            </span>
                        </>
                    )}
                </div>
            )}

            {mainTab === "opportunities" && (
                <div className="rp-filter-bar">
                    <span className="rp-filter-bar-label">
                        <FaFilter aria-hidden /> Sırala
                    </span>
                    <div className="rp-filter-pills">
                        {FILTER_OPTIONS.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                className={`rp-pill ${activeFilter === f.key ? "is-active" : ""}`}
                                onClick={() => onFilterChange(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {mainTab === "products" && (
                <div className="rp-filter-bar">
                    <span className="rp-filter-bar-label">
                        <FaFilter aria-hidden /> Sırala
                    </span>
                    <div className="rp-filter-pills">
                        {PRODUCT_SORT_OPTIONS.map((s) => (
                            <button
                                key={s.key}
                                type="button"
                                className={`rp-pill ${productSort === s.key ? "is-active" : ""}`}
                                onClick={() => onProductSortChange(s.key)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
