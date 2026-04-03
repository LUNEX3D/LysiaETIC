/**
 * AuthNavbar — Shared Auth Component
 * ✅ FIX E6: LoginForm ve RegisterForm'daki ~200 satır duplicate kod tek dosyaya taşındı
 */
import React from "react";
import {
    HiOutlineHome,
    HiOutlineSparkles,
    HiOutlineTag,
    HiOutlineInformationCircle,
    HiOutlineMail
} from "react-icons/hi";

const AuthNavbar = () => (
    <nav className="auth-navbar">
        <a href="/" className="auth-navbar-logo">
            <div className="auth-navbar-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M12 2C8 2 4.5 5 4 9"/>
                </svg>
            </div>
            <span className="auth-navbar-logo-text">LUNEXETIC</span>
        </a>
        <div className="auth-navbar-links">
            <a href="/" className="auth-navbar-link active"><HiOutlineHome /> Ana sayfa</a>
            <a href="#" className="auth-navbar-link"><HiOutlineSparkles /> Özellikler</a>
            <a href="#" className="auth-navbar-link"><HiOutlineTag /> Fiyatlandırma</a>
            <a href="#" className="auth-navbar-link"><HiOutlineInformationCircle /> Hakkımızda</a>
            <a href="#" className="auth-navbar-link"><HiOutlineMail /> İletişim</a>
        </div>
    </nav>
);

export default AuthNavbar;
