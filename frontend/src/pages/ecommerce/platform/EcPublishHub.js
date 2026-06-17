/**
 * EcPublishHub — Tek tıkla yayın + mağaza durumu özeti
 */
import React, { useCallback, useEffect, useState } from "react";
import {
    FaRocket, FaGlobe, FaShieldAlt, FaSearch, FaCheckCircle,
    FaExclamationTriangle, FaSpinner, FaExternalLinkAlt, FaSync,
} from "react-icons/fa";
import * as wbApi from "../../../services/websiteBuilderApi";
import "../../../styles/ecPublishHub.css";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

function StatusDot({ tone }) {
    return <span className={`eph-dot eph-dot--${tone || "muted"}`} />;
}

function KpiCard({ icon, label, value, sub, tone, onClick }) {
    const Tag = onClick ? "button" : "div";
    return (
        <Tag type={onClick ? "button" : undefined} className="eph-kpi" onClick={onClick}>
            <div className="eph-kpi-icon">{icon}</div>
            <div className="eph-kpi-body">
                <span className="eph-kpi-label">{label}</span>
                <strong className="eph-kpi-value">{value}</strong>
                {sub && <small>{sub}</small>}
            </div>
            {tone && <StatusDot tone={tone} />}
        </Tag>
    );
}

export default function EcPublishHub({ siteId, onNavigate }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState(false);
    const [steps, setSteps] = useState([]);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!siteId) return;
        setError("");
        try {
            const data = await wbApi.getPublishStatus(siteId);
            setStatus(data.publishStatus);
        } catch (e) {
            setError(e?.response?.data?.error || "Durum yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        load();
        const iv = setInterval(load, 45000);
        return () => clearInterval(iv);
    }, [load]);

    const handleDeploy = async () => {
        setDeploying(true);
        setSteps([]);
        setError("");
        try {
            const data = await wbApi.deploySite(siteId);
            if (data.steps) setSteps(data.steps);
            if (data.status) setStatus(data.status);
            else await load();
        } catch (e) {
            setError(e?.response?.data?.error || "Yayın başarısız");
            if (e?.response?.data?.steps) setSteps(e.response.data.steps);
        } finally {
            setDeploying(false);
        }
    };

    if (loading) {
        return (
            <div className="eph-page eph-page--light">
                <div className="eph-loading">
                    <FaSpinner className="eph-spin" />
                    <p>Yayın durumu yükleniyor…</p>
                </div>
            </div>
        );
    }

    const s = status || {};
    const pending = s.pendingChanges || 0;
    const meta = s.site?.publishMeta || {};
    const domain = s.domain || {};
    const seo = s.seo || {};
    const tech = s.technicalSeo || {};

    return (
        <div className="eph-page eph-page--light">
            <header className="eph-header">
                <div className="eph-header-icon"><FaRocket /></div>
                <div>
                    <h1>Yayın Durumu</h1>
                    <p>{s.site?.name || "Mağazanız"} — tek tıkla yayına alın</p>
                </div>
                <button type="button" className="eph-btn-ghost" onClick={load} disabled={deploying}>
                    <FaSync /> Yenile
                </button>
            </header>

            {error && (
                <div className="eph-banner eph-banner--error">
                    <FaExclamationTriangle />
                    <span>{error}</span>
                </div>
            )}

            <section className="eph-hero">
                <div className="eph-hero-main">
                    {s.isLive ? (
                        <>
                            <StatusDot tone="success" />
                            <div>
                                <strong>Mağaza yayında</strong>
                                <span>
                                    v{meta.version || 0}
                                    {meta.lastDeployAt && ` · Son yayın: ${fmtDate(meta.lastDeployAt)}`}
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <StatusDot tone="warning" />
                            <div>
                                <strong>Taslak modunda</strong>
                                <span>Henüz ziyaretçilere açılmadı</span>
                            </div>
                        </>
                    )}
                </div>

                {pending > 0 && !deploying && (
                    <p className="eph-hero-pending">
                        {pending} bekleyen değişiklik (taslak sayfa, SEO vb.)
                    </p>
                )}

                <button
                    type="button"
                    className="eph-btn-publish"
                    onClick={handleDeploy}
                    disabled={deploying}
                >
                    {deploying ? <FaSpinner className="eph-spin" /> : <FaRocket />}
                    {deploying ? "Yayınlanıyor…" : "Düzenlemeleri Yayınla"}
                </button>

                {s.urls?.primary && (
                    <a
                        href={s.urls.primary}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="eph-link-live"
                    >
                        <FaExternalLinkAlt /> Canlı siteyi aç
                    </a>
                )}
            </section>

            {steps.length > 0 && (
                <section className="eph-steps">
                    <h3>Yayın adımları</h3>
                    <ul>
                        {steps.map((step) => (
                            <li key={step.key} className={`eph-step eph-step--${step.status}`}>
                                {step.status === "done" && <FaCheckCircle />}
                                {step.status === "running" && <FaSpinner className="eph-spin" />}
                                {step.status === "failed" && <FaExclamationTriangle />}
                                <div>
                                    <strong>{step.label}</strong>
                                    {step.detail && <span>{step.detail}</span>}
                                    {step.error && <span className="eph-step-err">{step.error}</span>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="eph-kpi-grid">
                <KpiCard
                    icon={<FaGlobe />}
                    label="Domain"
                    value={domain.domain || "Varsayılan adres"}
                    sub={domain.label}
                    tone={domain.tone === "success" ? "success" : domain.tone === "error" ? "error" : "warning"}
                    onClick={() => onNavigate?.("domain")}
                />
                <KpiCard
                    icon={<FaShieldAlt />}
                    label="SSL"
                    value={
                        domain.sslStatus === "active"
                            ? "Aktif"
                            : domain.sslStatus === "pending"
                                ? "Hazırlanıyor"
                                : "—"
                    }
                    sub={
                        domain.sslDaysRemaining != null
                            ? `${domain.sslDaysRemaining} gün kaldı`
                            : domain.autoPolling
                                ? "Otomatik yenilenir"
                                : undefined
                    }
                    tone={domain.sslStatus === "active" ? "success" : "muted"}
                    onClick={() => onNavigate?.("domain")}
                />
                <KpiCard
                    icon={<FaSearch />}
                    label="SEO skoru"
                    value={`${seo.score ?? "—"}/100`}
                    sub={
                        seo.gaps?.productsMissingSeo > 0
                            ? `${seo.gaps.productsMissingSeo} ürün SEO eksik`
                            : "Site meta tamam"
                    }
                    tone={(seo.score || 0) >= 80 ? "success" : "warning"}
                    onClick={() => onNavigate?.("seo")}
                />
            </div>

            <section className="eph-panel">
                <h3>Teknik SEO (otomatik)</h3>
                <div className="eph-tech-grid">
                    {[
                        ["sitemap.xml", tech.sitemap],
                        ["robots.txt", tech.robots],
                        ["Organization schema", tech.organizationSchema],
                        ["Product schema", tech.productSchema],
                        ["Breadcrumb schema", tech.breadcrumbSchema],
                        ["Article schema", tech.articleSchema],
                    ].map(([label, ok]) => (
                        <div key={label} className={`eph-tech-item ${ok ? "is-on" : ""}`}>
                            {ok ? <FaCheckCircle /> : <FaExclamationTriangle />}
                            <span>{label}</span>
                            <em>{ok ? "Aktif" : "Kapalı"}</em>
                        </div>
                    ))}
                </div>
                {s.urls?.sitemap && (
                    <div className="eph-tech-links">
                        <a href={s.urls.sitemap} target="_blank" rel="noopener noreferrer">sitemap.xml</a>
                        <a href={s.urls.robots} target="_blank" rel="noopener noreferrer">robots.txt</a>
                    </div>
                )}
            </section>

            <section className="eph-panel eph-panel--muted">
                <h3>Varsayılan adres</h3>
                <code>{s.urls?.defaultSubdomain}</code>
                <p>Özel domain bağlamadan mağazanıza bu adresten erişilir.</p>
            </section>
        </div>
    );
}
