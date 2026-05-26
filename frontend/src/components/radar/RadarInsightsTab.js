import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    FaGoogle, FaAmazon, FaDatabase, FaSync, FaSpinner,
    FaExclamationTriangle, FaFire, FaGlobe, FaChartPie, FaBolt,
} from "react-icons/fa";
import {
    getRadarStats, getGoogleTrends, getTrendingKeywords,
    getArbitrageOpportunities, getDataSourceStatus, unwrapRadar,
} from "../../services/radarApi";
import RadarTabGuide from "./RadarTabGuide";

const fmt = (n) => (n ?? 0).toLocaleString("tr-TR");
const CACHE_MS = 120000;

let insightsCache = null;
let insightsCacheAt = 0;

export function invalidateRadarInsightsCache() {
    insightsCache = null;
    insightsCacheAt = 0;
}

const SOURCE_LABELS = {
    trendyol: "Trendyol",
    googleTrends: "Google Trends",
    google_trends: "Google Trends",
    amazon: "Amazon",
    instagram: "Instagram",
    tiktok: "TikTok",
    serpapi: "SerpAPI",
};

export default function RadarInsightsTab({ active, onKeywordSelect, onGoOpportunities }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stats, setStats] = useState(null);
    const [googleTrends, setGoogleTrends] = useState([]);
    const [keywords, setKeywords] = useState([]);
    const [arbitrage, setArbitrage] = useState([]);
    const [sources, setSources] = useState(null);
    const [sectionErrors, setSectionErrors] = useState({});
    const loadedRef = useRef(false);

    const applyCache = useCallback((cached) => {
        setStats(cached.stats);
        setGoogleTrends(cached.googleTrends);
        setKeywords(cached.keywords);
        setArbitrage(cached.arbitrage);
        setSources(cached.sources);
        setSectionErrors(cached.sectionErrors);
        setError(cached.error || "");
    }, []);

    const load = useCallback(async ({ force = false } = {}) => {
        if (
            !force &&
            insightsCache &&
            Date.now() - insightsCacheAt < CACHE_MS
        ) {
            applyCache(insightsCache);
            loadedRef.current = true;
            return;
        }

        setLoading(true);
        setError("");
        const errs = {};
        try {
            const [st, gt, kw, arb, ds] = await Promise.all([
                getRadarStats().catch(() => { errs.stats = true; return null; }),
                getGoogleTrends({ limit: 12 }).catch(() => { errs.google = true; return null; }),
                getTrendingKeywords({ limit: 20 }).catch(() => { errs.keywords = true; return null; }),
                getArbitrageOpportunities({ limit: 10 }).catch(() => { errs.arb = true; return null; }),
                getDataSourceStatus().catch(() => { errs.sources = true; return null; }),
            ]);
            const stD = st ? unwrapRadar(st) : null;
            const gtD = gt ? unwrapRadar(gt) : null;
            const kwD = kw ? unwrapRadar(kw) : null;
            const arbD = arb ? unwrapRadar(arb) : null;
            const dsD = ds ? unwrapRadar(ds) : null;

            const next = {
                stats: stD,
                googleTrends: gtD?.trendingSearches || gtD?.trends || gtD?.items || [],
                keywords: kwD?.keywords || kwD?.items || kwD?.breakouts || [],
                arbitrage: arbD?.opportunities || arbD?.items || [],
                sources: dsD?.sources || dsD,
                sectionErrors: errs,
                error:
                    !stD && !gtD && !kwD
                        ? "Veri kaynaklarına ulaşılamadı. Bağlantınızı kontrol edin."
                        : "",
            };

            insightsCache = next;
            insightsCacheAt = Date.now();
            applyCache(next);
            loadedRef.current = true;
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [applyCache]);

    useEffect(() => {
        if (!active) return;
        if (loadedRef.current && insightsCache && Date.now() - insightsCacheAt < CACHE_MS) {
            applyCache(insightsCache);
            return;
        }
        load();
    }, [active, load, applyCache]);

    if (loading && !loadedRef.current && active) {
        return (
            <div className="rp-empty-state">
                <FaSpinner className="rp-spin rp-empty-state__icon" />
                <p>Trend verileri yükleniyor…</p>
            </div>
        );
    }

    return (
        <div className="rp-insights">
            <RadarTabGuide tabKey="insights" />
            {error && (
                <div className="rp-alert rp-alert--error">
                    <FaExclamationTriangle />
                    <span>{error}</span>
                    <button type="button" className="rp-action" onClick={() => load({ force: true })}>
                        Tekrar dene
                    </button>
                </div>
            )}

            <div className="rp-insights-toolbar">
                <button type="button" className="rp-action" onClick={() => load({ force: true })} disabled={loading}>
                    {loading ? <FaSpinner className="rp-spin" /> : <FaSync />}
                    Yenile
                </button>
                <button type="button" className="rp-action rp-action--primary" onClick={onGoOpportunities}>
                    <FaBolt /> Fırsat listesi
                </button>
            </div>

            {stats && (
                <div className="rp-stats-grid rp-stats-grid--hero">
                    <div className="rp-stat-card rp-stat-card--accent">
                        <FaChartPie />
                        <span className="rp-stat-label">Aktif fırsat</span>
                        <strong>{fmt(stats.totalActive)}</strong>
                    </div>
                    <div className="rp-stat-card">
                        <span className="rp-stat-label">Ortalama skor</span>
                        <strong>{stats.avgScore ?? "—"}</strong>
                    </div>
                    <div className="rp-stat-card">
                        <span className="rp-stat-label">Son analiz</span>
                        <strong className="rp-stat-small">
                            {stats.lastAnalysis
                                ? new Date(stats.lastAnalysis).toLocaleString("tr-TR", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                  })
                                : "—"}
                        </strong>
                    </div>
                    <div className="rp-stat-card">
                        <span className="rp-stat-label">Worker</span>
                        <strong className="rp-stat-small">
                            {stats.worker?.running ? "Çalışıyor" : stats.worker?.lastRun ? "Beklemede" : "—"}
                        </strong>
                    </div>
                </div>
            )}

            {sources && !sectionErrors.sources && (
                <section className="rp-panel">
                    <h3><FaDatabase /> Veri kaynakları</h3>
                    <div className="rp-source-grid">
                        {Object.entries(sources).map(([key, val]) => {
                            if (key === "worker") return null;
                            const ok = val?.configured ?? val?.ok ?? val?.available;
                            const label = val?.label || SOURCE_LABELS[key] || key;
                            return (
                                <div key={key} className={`rp-source-tile ${ok ? "ok" : "off"}`}>
                                    <span className="rp-source-dot" />
                                    <span>{label}</span>
                                    <em>{ok ? "Aktif" : "Kapalı"}</em>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className="rp-insights-grid">
                <section className="rp-panel">
                    <h3><FaGoogle /> Google Trends</h3>
                    {sectionErrors.google ? (
                        <p className="rp-muted">Google trend verisi alınamadı.</p>
                    ) : googleTrends.length === 0 ? (
                        <p className="rp-muted">SerpAPI anahtarı yoksa veya veri henüz toplanmadıysa liste boş olabilir.</p>
                    ) : (
                        <ul className="rp-trend-list">
                            {googleTrends.slice(0, 12).map((t, i) => {
                                const kw = t.keyword || t.query || t.title;
                                return (
                                    <li key={i}>
                                        <button
                                            type="button"
                                            className="rp-trend-kw rp-link-btn"
                                            onClick={() => onKeywordSelect?.(kw)}
                                        >
                                            {kw}
                                        </button>
                                        {t.interest != null && <span className="rp-trend-val">{t.interest}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section className="rp-panel">
                    <h3><FaFire /> Yükselen kelimeler</h3>
                    {sectionErrors.keywords ? (
                        <p className="rp-muted">Anahtar kelime verisi alınamadı.</p>
                    ) : keywords.length === 0 ? (
                        <p className="rp-muted">
                            Henüz veri yok. Fırsat Radarı sekmesinde &quot;Yeni analiz&quot; çalıştırın.
                        </p>
                    ) : (
                        <div className="rp-kw-cloud">
                            {keywords.map((k, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className="rp-kw-tag"
                                    style={{ opacity: 0.45 + Math.min(0.55, (k.score || k.strength || 5) / 18) }}
                                    onClick={() => onKeywordSelect?.(k.keyword || k.term)}
                                >
                                    {k.keyword || k.term}
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="rp-panel">
                <h3><FaAmazon /> Arbitraj fırsatları</h3>
                {sectionErrors.arb ? (
                    <p className="rp-muted">Arbitraj listesi yüklenemedi.</p>
                ) : arbitrage.length === 0 ? (
                    <p className="rp-muted">Amazon ↔ Trendyol fiyat farkı bulunamadı veya analiz bekleniyor.</p>
                ) : (
                    <div className="rp-arb-grid">
                        {arbitrage.map((a, i) => (
                            <div key={i} className="rp-arb-card">
                                <strong>{a.keyword || a.productName}</strong>
                                <span className="rp-arb-margin">Marj: %{a.marginPercent ?? a.margin ?? "—"}</span>
                                {a.suggestedAction && <p>{a.suggestedAction}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className="rp-tip-card">
                <FaGlobe />
                <p>
                    Arka planda worker her <strong>6 saatte</strong> fırsat havuzunu günceller. En taze sonuç için
                    <strong> Fırsat Radarı</strong> sekmesinde &quot;Yeni analiz&quot; kullanın.
                </p>
            </div>
        </div>
    );
}
