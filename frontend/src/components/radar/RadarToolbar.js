import React from "react";
import { FaClock, FaExclamationCircle, FaSync, FaSpinner } from "react-icons/fa";
import { FILTER_OPTIONS, PRODUCT_SORT_OPTIONS, MAIN_TABS } from "../../constants/radarProLabels";
import { scoreColor, formatMoney } from "./radarUtils";

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
    refreshing,
    onRefresh,
}) {
    const tabMeta = MAIN_TABS.find((t) => t.key === mainTab);

    return (
        <header className="rp-toolbar">
            <div className="rp-toolbar-head">
                <div>
                    <h1>{tabMeta?.label}</h1>
                    <p>{tabMeta?.desc}</p>
                </div>
                <button
                    type="button"
                    className="rp-cta rp-toolbar-refresh"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? <FaSpinner className="rp-spin" /> : <FaSync />}
                    Analiz
                </button>
                {opportunitiesTabActive && radarMeta?.newestFreshness && (
                    <div className={`rp-toolbar-meta ${radarMeta.isStale ? "is-warn" : ""}`}>
                        <FaClock />
                        <span>
                            Son analiz:{" "}
                            {new Date(radarMeta.newestFreshness).toLocaleString("tr-TR", {
                                dateStyle: "short",
                                timeStyle: "short",
                            })}
                        </span>
                        {radarMeta.isStale && (
                            <span className="rp-pill rp-pill--warn">
                                <FaExclamationCircle /> Güncelle
                            </span>
                        )}
                    </div>
                )}
            </div>

            {oppStats && mainTab === "opportunities" && !loading && (
                <div className="rp-kpi-row">
                    <div className="rp-kpi">
                        <span>Listelenen</span>
                        <strong>{oppStats.count}</strong>
                    </div>
                    <div className="rp-kpi">
                        <span>Ort. skor</span>
                        <strong style={{ color: scoreColor(oppStats.avg) }}>{oppStats.avg}</strong>
                    </div>
                    <div className="rp-kpi rp-kpi--hot">
                        <span>Güçlü (75+)</span>
                        <strong>{oppStats.strong}</strong>
                    </div>
                </div>
            )}

            {mainTab === "opportunities" && (
                <div className="rp-filter-bar">
                    {FILTER_OPTIONS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={`rp-filter ${activeFilter === f.key ? "is-active" : ""}`}
                            onClick={() => onFilterChange(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}

            {mainTab === "products" && (
                <div className="rp-filter-bar">
                    <span className="rp-filter-label">Sırala</span>
                    {PRODUCT_SORT_OPTIONS.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            className={`rp-filter ${productSort === s.key ? "is-active" : ""}`}
                            onClick={() => onProductSortChange(s.key)}
                        >
                            {s.label}
                        </button>
                    ))}
                    {productStats?.total > 0 && (
                        <span className="rp-filter-extra">
                            Ort. skor{" "}
                            <b style={{ color: scoreColor(productStats.avgScore) }}>{productStats.avgScore}</b>
                            <span className="rp-filter-dot" />
                            Ort. kâr <b>{formatMoney(productStats.avgProfit)}</b>
                        </span>
                    )}
                </div>
            )}

            {opportunitiesTabActive && radarMeta?.nextRotationAt && !loading && (
                <p className="rp-toolbar-hint">
                    Liste 3 saatte bir karışır · Sonraki:{" "}
                    {new Date(radarMeta.nextRotationAt).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                    })}
                </p>
            )}
        </header>
    );
}
