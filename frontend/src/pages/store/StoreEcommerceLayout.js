/**
 * Mağaza ayarları — ikas iç sidebar (domain + menü)
 */
import React from "react";
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
import { STORE_NAV_ITEMS } from "../../constants/ecommerceMenu";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import "../../styles/ecommerceTheme.css";

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

const StoreEcommerceLayout = ({
    activeSection,
    store,
    language = "tr",
    onNavigate,
    onBack,
    children,
}) => {
    const { rootClassName, rootStyle } = useDashtockTheme();
    const en = language === "en";
    const displayDomain =
        store?.customDomain && store?.domainStatus === "verified"
            ? store.customDomain
            : store?.subdomain || (store?.slug ? `${store.slug}.sites.dashtock.com` : "—");

    return (
        <div className={`ec-theme-root ${rootClassName}`} style={rootStyle}>
        <div className="store-ec-layout">
            <aside className="store-ec-sidebar">
                <button type="button" className="store-ec-back" onClick={onBack} aria-label="Geri">
                    <FaArrowLeft />
                </button>

                <div className="store-ec-domain">
                    <span className="store-ec-domain__icon">
                        <FaGlobe />
                    </span>
                    <span className="store-ec-domain__text" title={displayDomain}>
                        {displayDomain}
                    </span>
                </div>

                <nav className="store-ec-nav">
                    {STORE_NAV_ITEMS.map((item) => {
                        const Icon = ICONS[item.icon] || FaGlobe;
                        const active = activeSection === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`store-ec-nav__item ${active ? "store-ec-nav__item--active" : ""}`}
                                onClick={() => onNavigate(item.id)}
                            >
                                <Icon className="store-ec-nav__icon" />
                                <span>{en ? item.labelEn : item.labelTr}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <div className="store-ec-main">{children}</div>
        </div>
        </div>
    );
};

export default StoreEcommerceLayout;
