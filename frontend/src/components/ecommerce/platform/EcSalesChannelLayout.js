import React, { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaGlobe,
    FaThLarge,
    FaSearch,
    FaBell,
    FaEnvelope,
    FaMapMarkerAlt,
    FaCreditCard,
    FaUserCircle,
    FaBox,
    FaGripHorizontal,
    FaBookOpen,
} from "react-icons/fa";
import {
    STORE_NAV_ITEMS,
    getStoreChannelPanelForNav,
    getStoreNavIdForPanel,
} from "../../../constants/ecStoreChannelNav";
import { getLiveSiteUrls, getWbAppDomain } from "../../../utils/wbStorefrontHost";
import * as wbApi from "../../../services/websiteBuilderApi";
import "../../../styles/ecSalesChannelLayout.css";

const ICONS = {
    themes: FaThLarge,
    seo: FaSearch,
    automations: FaBell,
    notifications: FaEnvelope,
    localization: FaMapMarkerAlt,
    payments: FaCreditCard,
    customers: FaUserCircle,
    shipping: FaBox,
    plugins: FaGripHorizontal,
    blog: FaBookOpen,
};

export default function EcSalesChannelLayout({
    activePanel,
    activeSite,
    language = "tr",
    onNavigate,
    onBack,
    children,
}) {
    const en = language === "en";
    const activeNavId = getStoreNavIdForPanel(activePanel);
    const [displayHost, setDisplayHost] = useState(activeSite?.host || "—");

    useEffect(() => {
        if (!activeSite?.id) {
            setDisplayHost(activeSite?.host || "—");
            return;
        }
        let cancelled = false;
        wbApi.getSite(activeSite.id)
            .then((d) => {
                if (cancelled) return;
                const s = d.site || {};
                const urls = getLiveSiteUrls(s);
                const hostLabel =
                    s.customDomain ||
                    (s.slug ? `${s.slug}.${getWbAppDomain()}` : null) ||
                    (urls.primary ? urls.primary.replace(/^https?:\/\//, "") : null) ||
                    activeSite.host ||
                    "—";
                setDisplayHost(hostLabel);
            })
            .catch(() => {
                if (!cancelled) setDisplayHost(activeSite?.host || "—");
            });
        return () => {
            cancelled = true;
        };
    }, [activeSite?.id, activeSite?.host]);

    return (
        <div className="ec-channel-layout">
            <aside className="ec-channel-sidebar" aria-label={en ? "Store channel" : "Satış kanalı"}>
                <button
                    type="button"
                    className="ec-channel-sidebar__back"
                    onClick={onBack}
                    aria-label={en ? "Back" : "Geri"}
                >
                    <FaArrowLeft />
                </button>

                <div className="ec-channel-sidebar__domain">
                    <span className="ec-channel-sidebar__domain-icon">
                        <FaGlobe />
                    </span>
                    <span className="ec-channel-sidebar__domain-text" title={displayHost}>
                        {displayHost}
                    </span>
                </div>

                <nav className="ec-channel-sidebar__nav">
                    {STORE_NAV_ITEMS.map((item) => {
                        const Icon = ICONS[item.icon] || FaGlobe;
                        const active = activeNavId === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`ec-channel-sidebar__item${active ? " active" : ""}`}
                                onClick={() => onNavigate?.(getStoreChannelPanelForNav(item.id))}
                            >
                                <Icon className="ec-channel-sidebar__item-icon" />
                                <span>{en ? item.labelEn : item.labelTr}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <div className="ec-channel-main">{children}</div>
        </div>
    );
}
