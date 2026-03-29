import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../services/api";
import {
    FaShieldAlt,
    FaEnvelope,
    FaLock,
    FaEye,
    FaEyeSlash,
    FaServer,
    FaSpinner
} from "react-icons/fa";
import "../styles/adminLogin.css";

const AdminLogin = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [serverStatus, setServerStatus] = useState("checking");
    const navigate = useNavigate();

    // Zaten admin giriş yapmışsa yönlendir
    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("userRole");
        if (token && (role === "admin" || role === "dev")) {
            navigate("/admin");
        }
    }, [navigate]);

    // Sunucu durumunu kontrol et
    useEffect(() => {
        const checkServer = async () => {
            try {
                await axios.get("/auth/profile", {
                    headers: { Authorization: "Bearer test" }
                }).catch(() => {});
                setServerStatus("online");
            } catch {
                // Eğer 401 dönüyorsa sunucu çalışıyor demektir
                setServerStatus("online");
            }
        };

        // Basit bir ping
        const pingServer = async () => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                await fetch(
                    (process.env.REACT_APP_API_URL || "http://13.51.158.124:5000") + "/api/status",
                    { signal: controller.signal }
                );
                clearTimeout(timeout);
                setServerStatus("online");
            } catch {
                setServerStatus("offline");
            }
        };

        pingServer();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setMessage({ text: "", type: "" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            // Login isteği
            const response = await axios.post("/auth/login", formData);
            const token = response.data.token;

            // Profil bilgilerini al
            const profileRes = await axios.get("/auth/profile", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const user = profileRes.data;

            // Admin kontrolü
            if (user.role !== "admin" && user.role !== "dev") {
                setMessage({
                    text: "⛔ Bu hesap admin yetkisine sahip değil. Sadece admin ve dev rolleri erişebilir.",
                    type: "error"
                });
                setIsLoading(false);
                return;
            }

            // Bilgileri kaydet
            localStorage.setItem("token", token);
            localStorage.setItem("userId", user._id);
            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userName", user.name || "Admin");
            localStorage.setItem("userRole", user.role);
            localStorage.setItem("adminLoginTime", new Date().toISOString());

            setMessage({ text: "✅ Admin girişi başarılı! Yönlendiriliyorsunuz...", type: "success" });

            setTimeout(() => navigate("/admin"), 1200);
        } catch (error) {
            const errMsg = error.response?.data?.message || "Bağlantı hatası oluştu.";
            setMessage({ text: `❌ ${errMsg}`, type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-login-root">
            {/* Animated Background */}
            <div className="admin-login-bg">
                <div className="admin-login-grid-overlay" />
                <div className="admin-login-glow admin-login-glow--1" />
                <div className="admin-login-glow admin-login-glow--2" />
                <div className="admin-login-glow admin-login-glow--3" />
            </div>

            {/* Login Card */}
            <div className="admin-login-container">
                <div className="admin-login-card">
                    {/* Header */}
                    <div className="admin-login-header">
                        <div className="admin-login-logo">
                            <FaShieldAlt />
                        </div>
                        <h1 className="admin-login-title">LysiaETIC</h1>
                        <p className="admin-login-subtitle">Yönetim Konsolu</p>
                    </div>

                    {/* Server Status */}
                    <div className={`admin-login-status admin-login-status--${serverStatus}`}>
                        <FaServer />
                        <span>
                            {serverStatus === "checking" && "Sunucu kontrol ediliyor..."}
                            {serverStatus === "online" && "Sunucu çevrimiçi"}
                            {serverStatus === "offline" && "Sunucu erişilemiyor"}
                        </span>
                        <div className={`admin-login-dot admin-login-dot--${serverStatus}`} />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="admin-login-form">
                        <div className="admin-login-field">
                            <label>E-posta Adresi</label>
                            <div className="admin-login-input-wrap">
                                <FaEnvelope className="admin-login-input-icon" />
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="admin@lysiaetic.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="admin-login-field">
                            <label>Şifre</label>
                            <div className="admin-login-input-wrap">
                                <FaLock className="admin-login-input-icon" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="admin-login-eye"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {message.text && (
                            <div className={`admin-login-message admin-login-message--${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="admin-login-btn"
                            disabled={isLoading || serverStatus === "offline"}
                        >
                            {isLoading ? (
                                <>
                                    <FaSpinner className="admin-login-spinner" />
                                    Doğrulanıyor...
                                </>
                            ) : (
                                <>
                                    <FaShieldAlt />
                                    Admin Girişi
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="admin-login-footer">
                        <p>Bu alan sadece yetkili yöneticiler içindir.</p>
                        <p>Tüm giriş denemeleri kayıt altına alınmaktadır.</p>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="admin-login-info">
                    <div className="admin-login-info-card">
                        <div className="admin-login-info-icon">🔒</div>
                        <div>
                            <strong>Güvenli Erişim</strong>
                            <p>256-bit şifreleme ile korunan bağlantı</p>
                        </div>
                    </div>
                    <div className="admin-login-info-card">
                        <div className="admin-login-info-icon">📊</div>
                        <div>
                            <strong>Tam Kontrol</strong>
                            <p>Sunucu, kullanıcı ve sistem yönetimi</p>
                        </div>
                    </div>
                    <div className="admin-login-info-card">
                        <div className="admin-login-info-icon">👁️</div>
                        <div>
                            <strong>Kullanıcı Erişimi</strong>
                            <p>Herhangi bir kullanıcı paneline direkt erişim</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
