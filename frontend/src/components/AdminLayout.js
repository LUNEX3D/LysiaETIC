import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
    FaChartLine,
    FaUsers,
    FaBoxOpen,
    FaClipboardList,
    FaServer,
    FaSignInAlt,
    FaCog,
    FaSignOutAlt,
    FaBars,
    FaTimes,
    FaHome
} from "react-icons/fa";
import "../styles/admin.css";

const AdminLayout = ({ title, subtitle, actions, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const name = localStorage.getItem("userName") || "Admin";
    const email = localStorage.getItem("userEmail") || "admin@lysiaetic.local";
    const rawRole = (localStorage.getItem("userRole") || "admin").toLowerCase();
    const loginTime = localStorage.getItem("adminLoginTime");

    const roleMap = {
        admin: "Admin",
        dev: "Program Dev",
        moderator: "Moderatör",
        seller: "Satıcı",
        user: "Kullanıcı"
    };
    const roleLabel = roleMap[rawRole] || "Admin";
    const roleClass = (() => {
        if (rawRole === "dev") return "admin-pill admin-pill--dev";
        if (rawRole === "moderator") return "admin-pill admin-pill--moderator";
        if (rawRole === "seller") return "admin-pill admin-pill--seller";
        if (rawRole === "user") return "admin-pill admin-pill--user";
        return "admin-pill admin-pill--admin";
    })();

    const handleLogout = () => {
        localStorage.clear();
        navigate("/admin/login");
    };

    const navItems = [
        { to: "/admin", label: "Genel Bakış", icon: <FaChartLine />, end: true },
        { to: "/admin/servers", label: "Sunucular", icon: <FaServer /> },
        { to: "/admin/user-access", label: "Kullanıcı Erişimi", icon: <FaSignInAlt /> },
        { to: "/admin/users", label: "Kullanıcılar", icon: <FaUsers /> },
        { to: "/admin/products", label: "Ürünler", icon: <FaBoxOpen /> },
        { to: "/admin/orders", label: "Siparişler", icon: <FaClipboardList /> },
    ];

    return (
        <div className="admin-root">
            {/* Mobile Hamburger */}
            <button
                className="admin-hamburger"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Menü"
            >
                {sidebarOpen ? <FaTimes /> : <FaBars />}
            </button>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            <div className="admin-shell">
                <aside className={`admin-sidebar ${sidebarOpen ? "admin-sidebar--open" : ""}`}>
                    <div className="admin-brand">
                        <div className="admin-logo">LE</div>
                        <div className="admin-brand-text">
                            <div className="admin-brand-title">LysiaETIC</div>
                            <div className="admin-brand-sub">Yönetim Konsolu</div>
                        </div>
                    </div>

                    <div className="admin-profile">
                        <div className="admin-avatar">{name.slice(0, 1).toUpperCase()}</div>
                        <div className="admin-profile-info">
                            <div className="admin-profile-name">{name}</div>
                            <div className="admin-profile-email">{email}</div>
                            <div className={roleClass}>{roleLabel}</div>
                        </div>
                    </div>

                    <nav className="admin-nav">
                        <div className="admin-nav-section">YÖNETİM</div>
                        {navItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `admin-nav-item ${isActive ? "active" : ""}`
                                }
                                onClick={() => setSidebarOpen(false)}
                            >
                                {item.icon}
                                {item.label}
                            </NavLink>
                        ))}

                        <div className="admin-nav-section" style={{ marginTop: 16 }}>SİSTEM</div>
                        <NavLink
                            to="/admin/settings"
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                            onClick={() => setSidebarOpen(false)}
                        >
                            <FaCog />
                            Ayarlar
                        </NavLink>
                        <a
                            href="/"
                            className="admin-nav-item"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FaHome />
                            Siteye Git
                        </a>
                        <button
                            className="admin-nav-item admin-nav-item--logout"
                            onClick={handleLogout}
                        >
                            <FaSignOutAlt />
                            Çıkış Yap
                        </button>
                    </nav>

                    <div className="admin-sidebar-foot">
                        <div className="admin-foot-title">Oturum Bilgisi</div>
                        <div className="admin-foot-text">
                            {loginTime
                                ? `Giriş: ${new Date(loginTime).toLocaleString("tr-TR")}`
                                : "Tüm kritik işlemler kayıt altındadır."}
                        </div>
                    </div>
                </aside>

                <main className="admin-main">
                    <header className="admin-header">
                        <div>
                            <div className="admin-title">{title}</div>
                            {subtitle && <div className="admin-subtitle">{subtitle}</div>}
                        </div>
                        {actions && <div className="admin-header-actions">{actions}</div>}
                    </header>

                    <section className="admin-content">{children}</section>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;