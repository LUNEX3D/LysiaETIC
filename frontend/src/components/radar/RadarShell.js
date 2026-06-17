import React from "react";
import {
    FaCrosshairs, FaBoxOpen, FaChartBar, FaSync, FaSpinner, FaSatelliteDish, FaBolt,
} from "react-icons/fa";
import { MAIN_TABS } from "../../constants/radarProLabels";

const TAB_ICONS = {
    crosshairs: FaCrosshairs,
    box: FaBoxOpen,
    chart: FaChartBar,
};

export default function RadarShell({
    mainTab,
    onTabChange,
    refreshing,
    onRefresh,
    analyzing,
    productCount,
    children,
    toolbar,
}) {
    const activeTabMeta = MAIN_TABS.find((t) => t.key === mainTab);

    return (
        <div className="rp-shell">
            <div className="rp-bg" aria-hidden>
                <div className="rp-bg-grid" />
                <div className="rp-bg-glow rp-bg-glow--1" />
                <div className="rp-bg-glow rp-bg-glow--2" />
            </div>

            <section className="rp-hero">
                <div className="rp-hero-main">
                    <div className="rp-hero-brand">
                        <div className="rp-hero-icon">
                            <FaSatelliteDish />
                        </div>
                        <div>
                            <span className="rp-hero-kicker">Dashtock AI · Fırsat Motoru</span>
                            <h1 className="rp-hero-title">Fırsat Radarı</h1>
                            <p className="rp-hero-desc">
                                Pazar trendleri, kârlılık skorları ve ürün keşfi — tek ekranda
                            </p>
                        </div>
                    </div>

                    <div className="rp-hero-actions">
                        {(analyzing || refreshing) && (
                            <span className="rp-status-pill rp-status-pill--live">
                                <span className="rp-status-dot" />
                                {refreshing ? "Analiz başlatılıyor…" : "AI taraması aktif"}
                            </span>
                        )}
                        <button
                            type="button"
                            className="rp-btn-hero"
                            onClick={onRefresh}
                            disabled={refreshing}
                        >
                            {refreshing ? <FaSpinner className="rp-spin" /> : <FaBolt />}
                            <span>{refreshing ? "Analiz…" : "Yeni analiz"}</span>
                        </button>
                    </div>
                </div>

                <nav className="rp-tabbar" aria-label="Radar sekmeleri">
                    {MAIN_TABS.map((tab) => {
                        const Icon = TAB_ICONS[tab.icon] || FaCrosshairs;
                        const active = mainTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                className={`rp-tabbar-item ${active ? "is-active" : ""}`}
                                onClick={() => onTabChange(tab.key)}
                                aria-current={active ? "page" : undefined}
                                title={tab.desc}
                            >
                                <Icon aria-hidden />
                                <span className="rp-tabbar-label">{tab.label}</span>
                                {tab.key === "products" && productCount > 0 && (
                                    <em className="rp-tabbar-badge">{productCount}</em>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {activeTabMeta && (
                    <p className="rp-hero-tab-hint">{activeTabMeta.desc}</p>
                )}
            </section>

            {toolbar}

            <main className="rp-main">{children}</main>

            <nav className="rp-mobile-nav" aria-label="Radar mobil sekmeler">
                {MAIN_TABS.map((tab) => {
                    const Icon = TAB_ICONS[tab.icon] || FaCrosshairs;
                    const active = mainTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            className={active ? "is-active" : ""}
                            onClick={() => onTabChange(tab.key)}
                            aria-label={tab.label}
                        >
                            <Icon />
                            <span>{tab.label.split(" ")[0]}</span>
                        </button>
                    );
                })}
                <button
                    type="button"
                    className="rp-mobile-nav-refresh"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Yeni analiz"
                >
                    {refreshing ? <FaSpinner className="rp-spin" /> : <FaSync />}
                </button>
            </nav>
        </div>
    );
}
