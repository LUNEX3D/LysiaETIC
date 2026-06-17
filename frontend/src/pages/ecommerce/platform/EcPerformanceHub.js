/**
 * EcPerformanceHub — Lighthouse hedefleri ve Core Web Vitals (canlı API)
 */
import React, { useCallback, useEffect, useState } from "react";
import {
    FaTachometerAlt, FaMobileAlt, FaCheckCircle, FaInfoCircle, FaSpinner, FaSync,
} from "react-icons/fa";
import * as wbApi from "../../../services/websiteBuilderApi";
import "../../../styles/ecPublishHub.css";

const SCORE_LABELS = [
    { key: "performance", label: "Performans", target: 90 },
    { key: "accessibility", label: "Erişilebilirlik", target: 90 },
    { key: "seo", label: "SEO", target: 90 },
    { key: "bestPractices", label: "En İyi Uygulamalar", target: 90 },
];

const CWV_KEYS = [
    { key: "lcp", label: "LCP", hint: "≤ 2.5s hedef", statusKey: "lcpStatus" },
    { key: "inp", label: "INP", hint: "≤ 200ms hedef", statusKey: "inpStatus" },
    { key: "cls", label: "CLS", hint: "≤ 0.1 hedef", statusKey: "clsStatus" },
];

const OPT_KEYS = [
    { key: "webp", label: "Görseller WebP dönüşümü" },
    { key: "avif", label: "Görseller AVIF dönüşümü" },
    { key: "lazyLoad", label: "Lazy loading ve async decode" },
    { key: "responsiveImages", label: "Responsive srcset (400–1600px)" },
    { key: "cdnCache", label: "CDN önbellek başlıkları" },
];

export default function EcPerformanceHub({ siteId }) {
    const [perf, setPerf] = useState(null);
    const [cached, setCached] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async (refresh = false) => {
        if (!siteId) return;
        setError("");
        if (refresh) setRefreshing(true);
        else setLoading(true);
        try {
            const d = await wbApi.getPerformance(siteId, refresh);
            setPerf(d.performance || null);
            setCached(!!d.cached);
        } catch (e) {
            setError(e?.response?.data?.error || "Performans verisi alınamadı");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [siteId]);

    useEffect(() => { load(false); }, [load]);

    if (loading) {
        return (
            <div className="eph-page eph-page--light">
                <div className="eph-loading"><FaSpinner className="eph-spin" /><p>Yükleniyor…</p></div>
            </div>
        );
    }

    const cwv = perf?.cwv || {};
    const opts = perf?.optimizations || {};
    const measuredAt = perf?.measuredAt ? new Date(perf.measuredAt).toLocaleString("tr-TR") : null;

    return (
        <div className="eph-page eph-page--light">
            <header className="eph-header">
                <div className="eph-header-icon"><FaTachometerAlt /></div>
                <div>
                    <h1>Performans</h1>
                    <p>Google Lighthouse 90+ ve Core Web Vitals uyumu</p>
                    {measuredAt && (
                        <p className="eph-muted" style={{ marginTop: "0.35rem" }}>
                            Son ölçüm: {measuredAt}
                            {cached && " · önbellek"}
                            {perf?.source === "pagespeed" && " · PageSpeed API"}
                            {perf?.source === "estimated" && " · tahmini skor"}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    className="eph-btn-ghost"
                    onClick={() => load(true)}
                    disabled={refreshing}
                >
                    {refreshing ? <FaSpinner className="eph-spin" /> : <FaSync />}
                    Yeniden ölç
                </button>
            </header>

            {error && <div className="eph-banner eph-banner--error"><span>{error}</span></div>}

            <aside className="eph-info">
                <FaInfoCircle />
                <p>
                    Skorlar mağaza yayınlandıktan sonra ölçülür. PageSpeed API anahtarı tanımlı değilse
                    platform optimizasyonlarına dayalı tahmini skorlar gösterilir.
                </p>
            </aside>

            <div className="eph-score-grid">
                {SCORE_LABELS.map((s) => {
                    const value = perf?.[s.key] ?? "—";
                    const num = typeof value === "number" ? value : 0;
                    return (
                        <div key={s.key} className={`eph-score-card ${num >= s.target ? "is-ok" : ""}`}>
                            <strong>{value}</strong>
                            <span>{s.label}</span>
                            <em>Hedef {s.target}+</em>
                        </div>
                    );
                })}
            </div>

            <section className="eph-panel">
                <h3><FaMobileAlt /> Core Web Vitals</h3>
                <div className="eph-cwv-grid">
                    {CWV_KEYS.map((m) => {
                        const status = cwv[m.statusKey] || "good";
                        return (
                            <div key={m.key} className={`eph-cwv eph-cwv--${status === "good" ? "good" : "warn"}`}>
                                <span className="eph-cwv-label">{m.label}</span>
                                <strong>{cwv[m.key] || "—"}</strong>
                                <small>{m.hint}</small>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="eph-panel">
                <h3>Otomatik optimizasyonlar</h3>
                <ul className="eph-checklist">
                    {OPT_KEYS.map((item) => (
                        <li key={item.key}>
                            {opts[item.key] !== false ? <FaCheckCircle /> : <span className="eph-dot eph-dot--muted" />}
                            {item.label}
                        </li>
                    ))}
                    <li><FaCheckCircle /> Kritik CSS inline (tema motoru)</li>
                </ul>
            </section>
        </div>
    );
}
