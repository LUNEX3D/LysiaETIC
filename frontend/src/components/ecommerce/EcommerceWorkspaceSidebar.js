import React, { useEffect, useMemo, useState } from "react";
import {
    FaHome,
    FaBox,
    FaClipboardList,
    FaUsers,
    FaTag,
    FaInbox,
    FaChartBar,
    FaCog,
    FaGlobe,
    FaPlus,
    FaChevronDown,
    FaArrowLeft,
} from "react-icons/fa";
import DashtockLogo from "../brand/DashtockLogo";
import {
    ECOMMERCE_MAIN_NAV,
    isEcommerceProductsPanel,
    isEcommerceOrdersPanel,
    isEcommerceCustomersPanel,
    isEcommerceDiscountsPanel,
    isEcommerceInboxPanel,
} from "../../constants/ecommerceMenu";
import "../../styles/ecommerceWorkspace.css";

const NAV_ICONS = {
    "ec-home": FaHome,
    "ec-products-group": FaBox,
    "ec-orders-group": FaClipboardList,
    "ec-customers-group": FaUsers,
    "ec-discounts-group": FaTag,
    "ec-inbox-group": FaInbox,
    "ec-reports": FaChartBar,
    "ec-settings": FaCog,
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

function isGroupActive(groupId, activePanel) {
    if (groupId === "ec-products-group") return isEcommerceProductsPanel(activePanel);
    if (groupId === "ec-orders-group") return isEcommerceOrdersPanel(activePanel);
    if (groupId === "ec-customers-group") return isEcommerceCustomersPanel(activePanel);
    if (groupId === "ec-discounts-group") return isEcommerceDiscountsPanel(activePanel);
    if (groupId === "ec-inbox-group") return isEcommerceInboxPanel(activePanel);
    return false;
}

export default function EcommerceWorkspaceSidebar({
    activePanel,
    activeSite,
    language = "tr",
    channelActive = false,
    onNavigate,
    onSwitchStore,
    onOpenChannel,
    onExitToProgram,
}) {
    const en = language === "en";
    const [groupOpen, setGroupOpen] = useState({});

    useEffect(() => {
        const next = {};
        ECOMMERCE_MAIN_NAV.forEach((item) => {
            if (item.children && isGroupActive(item.id, activePanel)) {
                next[item.id] = true;
            }
        });
        if (Object.keys(next).length) {
            setGroupOpen((o) => ({ ...o, ...next }));
        }
    }, [activePanel]);

    const initials = useMemo(() => userInitials(), []);
    const userName = localStorage.getItem("userName") || (en ? "Account" : "Hesap");
    const storeLabel = activeSite?.host || activeSite?.name || "—";

    const isItemActive = (item) => {
        if (item.children) return isGroupActive(item.id, activePanel);
        return activePanel === item.id;
    };

    const isChildActive = (child) => activePanel === child.id;

    return (
        <aside className="ec-workspace-sidebar">
            <div className="ec-workspace-sidebar__brand">
                {onExitToProgram && (
                    <button type="button" className="ec-workspace-exit-program" onClick={onExitToProgram}>
                        <FaArrowLeft />
                        <span>{en ? "Main program" : "Ana program"}</span>
                    </button>
                )}
                <button type="button" onClick={() => onNavigate("ec-home")} aria-label={en ? "Home" : "Giriş"}>
                    <DashtockLogo size={32} full />
                </button>
            </div>

            <nav className="ec-workspace-nav" aria-label={en ? "Store menu" : "Mağaza menüsü"}>
                {ECOMMERCE_MAIN_NAV.map((item) => {
                    const Icon = NAV_ICONS[item.id] || FaHome;
                    const label = en ? item.labelEn : item.labelTr;

                    if (item.children?.length) {
                        const open = !!groupOpen[item.id];
                        const active = isItemActive(item);
                        return (
                            <div key={item.id}>
                                <button
                                    type="button"
                                    className={`ec-workspace-nav__group-head ${active ? "ec-workspace-nav__group-head--active" : ""}`}
                                    onClick={() => {
                                        const next = !open;
                                        setGroupOpen((o) => ({ ...o, [item.id]: next }));
                                        if (next && item.children[0]) {
                                            onNavigate(item.children[0].id);
                                        }
                                    }}
                                >
                                    <Icon className="ec-workspace-nav__icon" />
                                    <span>{label}</span>
                                    <FaChevronDown
                                        className={`ec-workspace-nav__chevron ${open ? "ec-workspace-nav__chevron--open" : ""}`}
                                    />
                                </button>
                                {open &&
                                    item.children.map((child) => (
                                        <button
                                            key={child.id}
                                            type="button"
                                            className={`ec-workspace-nav__item ec-workspace-nav__child ${isChildActive(child) ? "ec-workspace-nav__item--active" : ""}`}
                                            onClick={() => onNavigate(child.id)}
                                        >
                                            <span>{en ? child.labelEn : child.labelTr}</span>
                                        </button>
                                    ))}
                            </div>
                        );
                    }

                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`ec-workspace-nav__item ${isItemActive(item) ? "ec-workspace-nav__item--active" : ""}`}
                            onClick={() => onNavigate(item.id)}
                        >
                            <Icon className="ec-workspace-nav__icon" />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="ec-workspace-channels">
                <div className="ec-workspace-channels__head">
                    <span>{en ? "Sales channels" : "Satış Kanalları"}</span>
                    <button
                        type="button"
                        className="ec-workspace-channels__add"
                        aria-label={en ? "Switch store" : "Mağaza değiştir"}
                        onClick={onSwitchStore}
                    >
                        <FaPlus />
                    </button>
                </div>
                <button
                    type="button"
                    className={`ec-workspace-channel${channelActive ? " ec-workspace-channel--active" : ""}`}
                    onClick={() => onOpenChannel?.()}
                    title={storeLabel}
                >
                    <span className="ec-workspace-channel__globe">
                        <FaGlobe />
                    </span>
                    <span>{storeLabel}</span>
                </button>
            </div>

            <div className="ec-workspace-footer">
                <div className="ec-workspace-verify">
                    <p>{en ? "Verify your account to receive payments." : "Ödemenizi alabilmeniz için hesabınızı doğrulayın."}</p>
                    <button type="button" onClick={() => onNavigate("store-seller-verify")}>
                        {en ? "Start verification" : "Doğrulamaya Başla"}
                    </button>
                </div>
                <div className="ec-workspace-wallet">
                    {en ? "Earnings:" : "Hak Edişler:"} ₺0,00
                </div>
                <button type="button" className="ec-workspace-user" onClick={onSwitchStore}>
                    <span className="ec-workspace-user__avatar">{initials}</span>
                    <span className="ec-workspace-user__meta">
                        <strong>{userName}</strong>
                        <span>{activeSite?.slug || activeSite?.name || ""}</span>
                    </span>
                </button>
            </div>
        </aside>
    );
}
