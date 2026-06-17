/**
 * AuthNavbar — LoginForm / RegisterForm ortak üst menü
 * layout="split" → Lunexetic tarzı bölünmüş giriş sayfası üst çubuğu
 */
import React from "react";
import DashtockLogo from "../brand/DashtockLogo";
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
                        <DashtockLogo size={40} full />
                    </a>
                    <nav className="lx-auth-nav" aria-label="Sayfa">
                        {TABS.map((tab) => (
                            <a
                                key={tab.id}
                                href={tab.id === "blog" ? "/blog" : "/login"}
                                className={activeTab === tab.id ? "lx-active" : ""}
                                onClick={(e) => {
                                    e.preventDefault();
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
                <DashtockLogo size={36} full />
            </a>
            <div className="auth-navbar-links">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`auth-navbar-link${activeTab === tab.id ? " active" : ""}`}
                        onClick={() => onTabChange?.(tab.id)}
                    >
                        <tab.Icon /> {tab.label}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default AuthNavbar;
