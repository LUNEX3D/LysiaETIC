/**
 * AuthNavbar — Shared Auth Component
 * ✅ FIX E6: LoginForm ve RegisterForm'daki ~200 satır duplicate kod tek dosyaya taşındı
 * ✅ Tab sistemi: Özellikler, Fiyatlandırma, Hakkımızda sekmeleri
 */
import React from "react";
import {
    HiOutlineHome,
    HiOutlineSparkles,
    HiOutlineTag,
    HiOutlineInformationCircle,
} from "react-icons/hi";

const TABS = [
    { id: "home", label: "Ana sayfa", icon: <HiOutlineHome /> },
    { id: "features", label: "Özellikler", icon: <HiOutlineSparkles /> },
    { id: "pricing", label: "Fiyatlandırma", icon: <HiOutlineTag /> },
    { id: "about", label: "Hakkımızda", icon: <HiOutlineInformationCircle /> },
];

const AuthNavbar = ({ activeTab, onTabChange }) => (
    <nav className="auth-navbar">
        <a href="/" className="auth-navbar-logo" onClick={(e) => { e.preventDefault(); if (onTabChange) onTabChange("home"); }}>
            <div className="auth-navbar-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M12 2C8 2 4.5 5 4 9"/>
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
                    onClick={() => onTabChange && onTabChange(tab.id)}
                >
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>
    </nav>
);

export default AuthNavbar;


