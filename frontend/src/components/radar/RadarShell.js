import React from "react";
import {
    FaCrosshairs, FaBoxOpen, FaChartBar, FaSync, FaSpinner, FaSatellite,
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
    productCount,
    children,
    toolbar,
}) {
    return (
        <div className="rp-shell">
            <div className="rp-bg" aria-hidden>
                <div className="rp-bg-orb rp-bg-orb--1" />
                <div className="rp-bg-orb rp-bg-orb--2" />
                <div className="rp-bg-grid" />
            </div>

            <aside className="rp-side" aria-label="Radar navigasyon">
                <div className="rp-side-brand">
                    <div className="rp-side-logo">
                        <FaSatellite />
                    </div>
                    <div>
                        <span className="rp-side-kicker">Dashtock</span>
                        <strong>Radar</strong>
                    </div>
                </div>

                <nav className="rp-side-nav">
                    {MAIN_TABS.map((tab) => {
                        const Icon = TAB_ICONS[tab.icon] || FaCrosshairs;
                        const active = mainTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                className={`rp-side-link ${active ? "is-active" : ""}`}
                                onClick={() => onTabChange(tab.key)}
                                aria-current={active ? "page" : undefined}
                            >
                                <span className="rp-side-link-icon">
                                    <Icon />
                                </span>
                                <span className="rp-side-link-body">
                                    <span className="rp-side-link-label">{tab.label}</span>
                                    <span className="rp-side-link-desc">{tab.desc}</span>
                                </span>
                                {tab.key === "products" && productCount > 0 && (
                                    <span className="rp-side-badge">{productCount}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="rp-side-foot">
                    <button
                        type="button"
                        className="rp-side-refresh"
                        onClick={onRefresh}
                        disabled={refreshing}
                    >
                        {refreshing ? <FaSpinner className="rp-spin" /> : <FaSync />}
                        <span>{refreshing ? "Analiz sürüyor…" : "Yeni analiz"}</span>
                    </button>
                </div>
            </aside>

            <div className="rp-workspace">
                {toolbar}
                <div className="rp-scroll">{children}</div>
            </div>

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
            </nav>
        </div>
    );
}
