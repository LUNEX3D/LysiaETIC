import React from "react";
import { NavLink } from "react-router-dom";
import {
    FaChartLine,
    FaUsers,
    FaBoxOpen,
    FaClipboardList
} from "react-icons/fa";
import "../styles/admin.css";

const AdminLayout = ({ title, subtitle, actions, children }) => {
    const name = localStorage.getItem("userName") || "Admin";
    const email = localStorage.getItem("userEmail") || "admin@lysiaetic.local";
    const rawRole = (localStorage.getItem("userRole") || "admin").toLowerCase();
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

    return (
        <div className="admin-root">
            <div className="admin-shell">
                <aside className="admin-sidebar">
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
                        <NavLink
                            to="/admin"
                            end
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            <FaChartLine />
                            Genel Bakış
                        </NavLink>
                        <NavLink
                            to="/admin/users"
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            <FaUsers />
                            Kullanıcılar
                        </NavLink>
                        <NavLink
                            to="/admin/products"
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            <FaBoxOpen />
                            Ürünler
                        </NavLink>
                        <NavLink
                            to="/admin/orders"
                            className={({ isActive }) =>
                                `admin-nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            <FaClipboardList />
                            Siparişler
                        </NavLink>
                    </nav>

                    <div className="admin-sidebar-foot">
                        <div className="admin-foot-title">Kısa Notlar</div>
                        <div className="admin-foot-text">
                            Tüm kritik işlemler kayıt altındadır.
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