/**
 * AuthNavbar — LoginForm / RegisterForm ortak üst menü
 * layout="split" → Lunexetic tarzı bölünmüş giriş sayfası üst çubuğu
 */
import React from "react";
import {
    HiOutlineHome,
    HiOutlineSparkles,
    HiOutlineTag,
    HiOutlineInformationCircle,
    HiOutlinePhone,
} from "react-icons/hi";

const TABS = [
    { id: "home", label: "Ana sayfa", Icon: HiOutlineHome },
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
                        <span className="lx-auth-logo-mark">P</span>
                        <span className="lx-auth-logo-text">PAZARYÖNETİM</span>
                    </a>
                    <nav className="lx-auth-nav" aria-label="Sayfa">
                        {TABS.map((tab) => (
                            <a
                                key={tab.id}
                                href="/"
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
                <div className="auth-navbar-logo-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M12 2C8 2 4.5 5 4 9" />
                    </svg>
                </div>
                <span className="auth-navbar-logo-text">PAZARYONETIM</span>
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
