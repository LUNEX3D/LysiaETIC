import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
    FaChartPie, FaUsers, FaBoxOpen, FaClipboardList, FaServer,
    FaUserShield, FaCog, FaSignOutAlt, FaBars, FaTimes,
    FaExternalLinkAlt, FaBuilding, FaCrown, FaCreditCard,
    FaPlug, FaTachometerAlt, FaChartBar, FaBullhorn,
    FaHistory, FaTicketAlt, FaShieldAlt
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
        admin: { label: "Super Admin", cls: "ap-role--admin" },
        dev: { label: "Developer", cls: "ap-role--dev" },
        moderator: { label: "Moderatör", cls: "ap-role--moderator" },
        seller: { label: "Satıcı", cls: "ap-role--seller" },
        user: { label: "Kullanıcı", cls: "ap-role--user" }
    };
    const role = roleMap[rawRole] || roleMap.admin;

    const handleLogout = () => {
        localStorage.clear();
        navigate("/admin/login");
    };

    const navSections = [
        {
            label: "Ana Kontrol",
            items: [
                { to: "/admin", label: "Dashboard", icon: <FaChartPie />, end: true },
                { to: "/admin/tenants", label: "Firma Yönetimi", icon: <FaBuilding /> },
                { to: "/admin/users", label: "Kullanıcılar", icon: <FaUsers /> },
            ]
        },
        {
            label: "Finans & Abonelik",
            items: [
                { to: "/admin/subscriptions", label: "Paket & Abonelik", icon: <FaCrown /> },
                { to: "/admin/payments", label: "Ödeme & Fatura", icon: <FaCreditCard /> },
            ]
        },
        {
            label: "Operasyon",
            items: [
                { to: "/admin/integrations", label: "Entegrasyonlar", icon: <FaPlug /> },
                { to: "/admin/usage", label: "Kullanım & Limitler", icon: <FaTachometerAlt /> },
                { to: "/admin/reports", label: "Global Raporlar", icon: <FaChartBar /> },
            ]
        },
        {
            label: "İletişim",
            items: [
                { to: "/admin/announcements", label: "Duyurular", icon: <FaBullhorn /> },
                { to: "/admin/tickets", label: "Destek Talepleri", icon: <FaTicketAlt /> },
            ]
        },
        {
            label: "Sistem & Güvenlik",
            items: [
                { to: "/admin/audit-logs", label: "İşlem Logları", icon: <FaHistory /> },
                { to: "/admin/system-config", label: "Sistem Ayarları", icon: <FaCog /> },
            ]
        }
    ];

    return (
        <div className="ap">
            <button
                className="ap-hamburger"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Menü"
            >
                {sidebarOpen ? <FaTimes /> : <FaBars />}
            </button>

            {sidebarOpen && (
                <div className="ap-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            <div className="ap-shell">
                <aside className={`ap-side ${sidebarOpen ? "ap-side--open" : ""}`}>
                    {/* Brand */}
                    <div className="ap-brand">
                        <div className="ap-brand-icon">LE</div>
                        <div>
                            <div className="ap-brand-name">LysiaETIC</div>
                            <div className="ap-brand-tag">SaaS Yönetim Konsolu</div>
                        </div>
                    </div>

                    {/* User Profile */}
                    <div className="ap-user">
                        <div className="ap-user-avatar">
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ap-user-info">
                            <div className="ap-user-name">{name}</div>
                            <div className="ap-user-email">{email}</div>
                            <span className={`ap-user-role ${role.cls}`}>
                                {role.label}
                            </span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="ap-nav">
                        {navSections.map((section, idx) => (
                            <React.Fragment key={idx}>
                                <div className="ap-nav-label">{section.label}</div>
                                {section.items.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.end}
                                        className={({ isActive }) =>
                                            `ap-nav-item ${isActive ? "active" : ""}`
                                        }
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </NavLink>
                                ))}
                            </React.Fragment>
                        ))}

                        <div className="ap-nav-label">Diğer</div>
                        <a
                            href="/"
                            className="ap-nav-item"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FaExternalLinkAlt />
                            Siteye Git
                        </a>
                        <button
                            className="ap-nav-item ap-nav-item--danger"
                            onClick={handleLogout}
                        >
                            <FaSignOutAlt />
                            Çıkış Yap
                        </button>
                    </nav>

                    {/* Footer */}
                    <div className="ap-side-foot">
                        <strong>Oturum Bilgisi</strong>
                        {loginTime
                            ? `Giriş: ${new Date(loginTime).toLocaleString("tr-TR")}`
                            : "Tüm işlemler kayıt altındadır."}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="ap-main">
                    <header className="ap-header">
                        <div className="ap-header-left">
                            <h1 className="ap-title">{title}</h1>
                            {subtitle && <p className="ap-desc">{subtitle}</p>}
                        </div>
                        {actions && <div className="ap-actions">{actions}</div>}
                    </header>
                    <div className="ap-body">{children}</div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
