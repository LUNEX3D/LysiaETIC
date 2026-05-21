/**
 * AuthNavbar — LoginForm / RegisterForm ortak üst menü
 * layout="split" → Lunexetic tarzı bölünmüş giriş sayfası üst çubuğu
 */
import React from "react";
import DashtockLogo from "../brand/DashtockLogo";
import { BRAND_NAME_UPPER } from "../../constants/brand";
import {
    HiOutlineHome,
    HiOutlineSparkles,
    HiOutlineTag,
    HiOutlineInformationCircle,
    HiOutlinePhone,
    HiOutlineBookOpen,
} from "react-icons/hi";

const TABS = [
    { id: "home", label: "Ana sayfa", Icon: HiOutlineHome },
    { id: "blog", label: "Blog", Icon: HiOutlineBookOpen },
    { id: "features", label: "Özellikler", Icon: HiOutlineSparkles },
    { id: "pricing", label: "Fiyatlandırma", Icon: HiOutlineTag },
    { id: "about", label: "Hakkımızda", Icon: HiOutlineInformationCircle },
    { id: "contact", label: "İletişim", Icon: HiOutlinePhone },
];

const AuthNavbar = ({ activeTab, onTabChange, layout = "default" }) => {
    if (layout === "split") {
        return (
            <header className="lx-auth-header">
                <div className="lx-auth-header-inner">
                    <a
                        href="/"
                        className="lx-auth-logo"
                        onClick={(e) => {
                            e.preventDefault();
                            onTabChange?.("home");
                        }}
                    >
                        <DashtockLogo size={36} />
                        <span className="lx-auth-logo-text">{BRAND_NAME_UPPER}</span>
                    </a>
                    <nav className="lx-auth-nav" aria-label="Sayfa">
                        {TABS.map((tab) => (
                            <a
                                key={tab.id}
                                href="/"
                                className={activeTab === tab.id ? "lx-active" : ""}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (tab.id === "blog") {
                                        window.location.href = "/blog";
                                        return;
                                    }
                                    onTabChange?.(tab.id);
                                }}
                            >
                                <tab.Icon aria-hidden />
                                <span className="lx-nav-txt">{tab.label}</span>
                            </a>
                        ))}
                    </nav>
                    <div className="lx-auth-spacer" aria-hidden />
                </div>
            </header>
        );
    }

    return (
        <nav className="auth-navbar">
            <a
                href="/"
                className="auth-navbar-logo"
                onClick={(e) => {
                    e.preventDefault();
                    onTabChange?.("home");
                }}
            >
                <DashtockLogo size={32} variant="light" />
                <span className="auth-navbar-logo-text">{BRAND_NAME_UPPER}</span>
            </a>
            <div className="auth-navbar-links">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`auth-navbar-link${activeTab === tab.id ? " active" : ""}`}
                        onClick={() => {
                            if (tab.id === "blog") {
                                window.location.href = "/blog";
                                return;
                            }
                            onTabChange?.(tab.id);
                        }}
                    >
                        <tab.Icon /> {tab.label}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default AuthNavbar;
