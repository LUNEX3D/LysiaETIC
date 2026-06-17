import React, { useEffect, useMemo, useState } from "react";
import {
    FaHome,
    FaStore,
    FaBox,
    FaClipboardList,
    FaUsers,
    FaTag,
    FaInbox,
    FaChartLine,
    FaCog,
    FaChevronDown,
    FaArrowLeft,
    FaGlobe,
    FaPlus,
    FaTh,
    FaThLarge,
    FaSearch,
    FaBell,
    FaEnvelope,
    FaMapMarkerAlt,
    FaCreditCard,
    FaUserCircle,
    FaGripHorizontal,
    FaBookOpen,
    FaRocket,
    FaTachometerAlt,
    FaLink,
} from "react-icons/fa";
import DashtockLogo from "../../brand/DashtockLogo";
import {
    EC_PLATFORM_NAV,
    platformPanelActiveInGroup,
} from "../../../constants/ecommercePlatform";
import { getEcommerceMainLabel } from "../../../constants/ecommerceMenu";
import { getLiveSiteUrls, getWbAppDomain } from "../../../utils/wbStorefrontHost";
import * as wbApi from "../../../services/websiteBuilderApi";
import { EC_WB_MY_THEMES_PANEL } from "../../../constants/ecommerceMenu";
import {
    STORE_NAV_ITEMS,
    getStoreChannelPanelForNav,
    getStoreNavIdForPanel,
    isEcSalesChannelWorkspacePanel,
} from "../../../constants/ecStoreChannelNav";

const ICONS = {
    home: FaHome,
    storefront: FaStore,
    products: FaBox,
    orders: FaClipboardList,
    customers: FaUsers,
    discounts: FaTag,
    inbox: FaInbox,
    analytics: FaChartLine,
    settings: FaCog,
    seo: FaGlobe,
    apps: FaTh,
};

const CHANNEL_ICONS = {
    themes: FaThLarge,
    publish: FaRocket,
    domain: FaGlobe,
    seo: FaSearch,
    redirects: FaLink,
    performance: FaTachometerAlt,
    brandEmail: FaEnvelope,
    automations: FaBell,
    notifications: FaEnvelope,
    localization: FaMapMarkerAlt,
    payments: FaCreditCard,
    customers: FaUserCircle,
    shipping: FaBox,
    plugins: FaGripHorizontal,
    blog: FaBookOpen,
};

function userInitials() {
    const name = localStorage.getItem("userName") || "";
    const email = localStorage.getItem("userEmail") || "";
    if (name.trim()) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "DS";
}

export default function EcommercePlatformSidebar({
    activePanel,
    activeSite,
    language = "tr",
    onNavigate,
    onSwitchStore,
    onExitToProgram,
}) {
    const en = language === "en";
    const [groupOpen, setGroupOpen] = useState({});
    const [siteStatus, setSiteStatus] = useState(null);
    const [displayHost, setDisplayHost] = useState(activeSite?.host || "—");

    const initials = useMemo(() => userInitials(), []);
    const userName = localStorage.getItem("userName") || (en ? "Account" : "Hesap");
    const storeLabel = activeSite?.host || activeSite?.name || "—";
    const inChannelWorkspace = isEcSalesChannelWorkspacePanel(activePanel);
    const activeChannelNavId = getStoreNavIdForPanel(activePanel);

    useEffect(() => {
        const next = {};
        EC_PLATFORM_NAV.forEach((item) => {
            if (item.children && platformPanelActiveInGroup(item.id, activePanel)) {
                next[item.id] = true;
            }
        });
        if (Object.keys(next).length) {
            setGroupOpen((o) => ({ ...o, ...next }));
        }
    }, [activePanel]);

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
                setSiteStatus(s.status || "draft");
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

    const isItemActive = (item) => {
        if (item.children) return platformPanelActiveInGroup(item.id, activePanel);
        return activePanel === item.id;
    };

    const openChannel = () => {
        onNavigate?.(getStoreChannelPanelForNav("store-publish"));
    };

    const sidebarFooter = (
        <div className="ec-platform-sidebar__footer">
            <div className="ec-platform-sidebar__verify">
                <p>
                    {en
                        ? "Verify your account to receive payments."
                        : "Ödemenizi alabilmeniz için hesabınızı doğrulayın."}
                </p>
                <button type="button" onClick={() => onNavigate?.("store-seller-verify")}>
                    {en ? "Start verification" : "Doğrulamaya Başla"}
                </button>
            </div>
            <button type="button" className="ec-platform-sidebar__user" onClick={onSwitchStore}>
                <span className="ec-platform-sidebar__user-avatar">{initials}</span>
                <span className="ec-platform-sidebar__user-meta">
                    <strong>{userName}</strong>
                    <span>{activeSite?.name || activeSite?.slug || ""}</span>
                </span>
            </button>
        </div>
    );

    if (inChannelWorkspace) {
        return (
            <aside className="ec-platform-sidebar ec-platform-sidebar--channel">
                <div className="ec-platform-sidebar__channel-head">
                    {onExitToProgram && (
                        <button
                            type="button"
                            className="ec-platform-sidebar__exit ec-platform-sidebar__exit--channel"
                            onClick={onExitToProgram}
                        >
                            <FaArrowLeft />
                            <span>{en ? "Dashtock Home" : "Dashtock Ana Sayfa"}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="ec-platform-sidebar__back-icon"
                        onClick={() => onNavigate?.("ec-home")}
                        aria-label={en ? "Back to dashboard" : "E-ticaret paneline dön"}
                        title={en ? "E-commerce home" : "E-ticaret giriş"}
                    >
                        <FaHome />
                    </button>
                    <div className="ec-platform-sidebar__domain">
                        <span className="ec-platform-sidebar__domain-icon">
                            <FaGlobe />
                        </span>
                        <span className="ec-platform-sidebar__domain-text" title={displayHost}>
                            {displayHost}
                        </span>
                    </div>
                </div>

                <nav className="ec-platform-sidebar__nav" aria-label={en ? "Store channel" : "Satış kanalı"}>
                    {STORE_NAV_ITEMS.map((item) => {
                        const Icon = CHANNEL_ICONS[item.icon] || FaGlobe;
                        const active = activeChannelNavId === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`ec-platform-sidebar__item${active ? " active" : ""}`}
                                onClick={() => onNavigate?.(getStoreChannelPanelForNav(item.id))}
                            >
                                <Icon className="ec-platform-sidebar__icon" />
                                <span className="ec-platform-sidebar__label">
                                    {en ? item.labelEn : item.labelTr}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </aside>
        );
    }

    return (
        <aside className="ec-platform-sidebar">
            <div className="ec-platform-sidebar__brand">
                {onExitToProgram && (
                    <button type="button" className="ec-platform-sidebar__exit" onClick={onExitToProgram}>
                        <FaArrowLeft />
                        <span>{en ? "Main program" : "Dashtock Ana Sayfa"}</span>
                    </button>
                )}
                <button
                    type="button"
                    className="ec-platform-sidebar__logo-btn"
                    onClick={() => onNavigate?.("ec-home")}
                    aria-label={en ? "Dashboard" : "Giriş"}
                >
                    <DashtockLogo size={30} full />
                </button>
            </div>

            <nav className="ec-platform-sidebar__nav" aria-label={en ? "E-commerce" : "E-ticaret"}>
                {EC_PLATFORM_NAV.map((item) => {
                    const Icon = ICONS[item.icon] || FaHome;
                    const label = en ? item.labelEn : item.labelTr;

                    if (item.children?.length) {
                        const open = !!groupOpen[item.id];
                        const active = isItemActive(item);
                        return (
                            <div key={item.id} className="ec-platform-sidebar__group">
                                <button
                                    type="button"
                                    className={`ec-platform-sidebar__item${active ? " active" : ""}`}
                                    onClick={() => {
                                        const next = !open;
                                        setGroupOpen((o) => ({ ...o, [item.id]: next }));
                                        if (next && item.children[0]) {
                                            onNavigate?.(item.children[0].id);
                                        }
                                    }}
                                >
                                    <Icon className="ec-platform-sidebar__icon" />
                                    <span className="ec-platform-sidebar__label">{label}</span>
                                    <FaChevronDown
                                        className={`ec-platform-sidebar__chev${open ? " ec-platform-sidebar__chev--open" : ""}`}
                                    />
                                </button>
                                {open &&
                                    item.children.map((child) => (
                                        <button
                                            key={child.id}
                                            type="button"
                                            className={`ec-platform-sidebar__child${activePanel === child.id ? " active" : ""}`}
                                            onClick={() => onNavigate?.(child.id)}
                                        >
                                            {en ? child.labelEn : child.labelTr}
                                        </button>
                                    ))}
                            </div>
                        );
                    }

                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`ec-platform-sidebar__item${isItemActive(item) ? " active" : ""}`}
                            onClick={() => onNavigate?.(item.id)}
                        >
                            <Icon className="ec-platform-sidebar__icon" />
                            <span className="ec-platform-sidebar__label">{label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="ec-platform-sidebar__channels">
                <div className="ec-platform-sidebar__channels-head">
                    <span>{en ? "Sales channels" : "Satış Kanalları"}</span>
                    <button
                        type="button"
                        className="ec-platform-sidebar__channels-add"
                        aria-label={en ? "Switch store" : "Mağaza değiştir"}
                        onClick={onSwitchStore}
                    >
                        <FaPlus />
                    </button>
                </div>
                <button
                    type="button"
                    className="ec-platform-sidebar__channel"
                    onClick={openChannel}
                    title={storeLabel}
                >
                    <span className="ec-platform-sidebar__channel-icon">
                        <FaGlobe />
                    </span>
                    <span className="ec-platform-sidebar__channel-label">{storeLabel}</span>
                    {siteStatus && (
                        <span
                            className={`ec-platform-sidebar__channel-badge ec-platform-sidebar__channel-badge--${
                                siteStatus === "published" ? "live" : "draft"
                            }`}
                        >
                            {siteStatus === "published" ? (en ? "Live" : "Yayında") : en ? "Draft" : "Taslak"}
                        </span>
                    )}
                </button>
            </div>

            {sidebarFooter}
        </aside>
    );
}

export function getPlatformTopbarTitle(panelId, language) {
    return getEcommerceMainLabel(panelId, language);
}
