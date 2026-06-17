import React from "react";
import {
    FaChartPie,
    FaEnvelope,
    FaSms,
    FaRobot,
    FaUsers,
    FaWindowMaximize,
    FaLink,
    FaChartBar,
    FaCog,
} from "react-icons/fa";

const NAV_ITEMS = [
    { id: "mkt-dashboard", label: "Genel bakış", icon: FaChartPie },
    { id: "mkt-campaigns-email", label: "E-posta", icon: FaEnvelope },
    { id: "mkt-campaigns-sms", label: "SMS", icon: FaSms },
    { id: "mkt-automations", label: "Otomasyonlar", icon: FaRobot },
    { id: "mkt-segments", label: "Segmentler", icon: FaUsers },
    { id: "mkt-popups", label: "Popup", icon: FaWindowMaximize },
    { id: "mkt-affiliate", label: "Ortaklık", icon: FaLink },
    { id: "mkt-reports", label: "Raporlar", icon: FaChartBar },
    { id: "mkt-settings", label: "Ayarlar", icon: FaCog },
];

function resolveActive(panelId) {
    if (!panelId) return "mkt-dashboard";
    if (panelId.startsWith("mkt-automation-")) return "mkt-automations";
    if (panelId === "mkt-campaigns-group") return "mkt-campaigns-email";
    return panelId;
}

export default function MarketingSubNav({ activePanel, onNavigate }) {
    const active = resolveActive(activePanel);

    return (
        <nav className="mkt-subnav" aria-label="Pazarlama menüsü">
            <div className="mkt-subnav__scroll">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`mkt-subnav__item${isActive ? " mkt-subnav__item--active" : ""}`}
                            onClick={() => onNavigate?.(item.id)}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <Icon className="mkt-subnav__icon" aria-hidden />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
