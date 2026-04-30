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

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("userRole");
        if (token && (role === "admin" || role === "dev")) {
            navigate("/admin");
        }
    }, [navigate]);

    useEffect(() => {
        const pingServer = async () => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                await fetch(
                    (process.env.REACT_APP_API_URL ?? "http://localhost:5000") + "/api/status",
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
            const response = await axios.post("/auth/login", formData);
            const token = response.data.token;
            const refreshTokenValue = response.data.refreshToken;

            // FIX: Yeni token'ı önce kaydet, axios interceptor localStorage'dan okuyor
            localStorage.setItem("token", token);
            if (refreshTokenValue) localStorage.setItem("refreshToken", refreshTokenValue);

            const profileRes = await axios.get("/auth/profile");
            const user = profileRes.data;

            if (user.role !== "admin" && user.role !== "dev") {
                // SEC #3: Yetkisiz kullanıcının token'ını hemen temizle
                localStorage.removeItem("token");
                localStorage.removeItem("refreshToken");
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("refreshToken");
                setMessage({
                    text: "Bu hesap admin yetkisine sahip değil. Sadece admin ve dev rolleri erişebilir.",
                    type: "error"
                });
                setIsLoading(false);
                return;
            }

            localStorage.setItem("token", token);
            if (refreshTokenValue) localStorage.setItem("refreshToken", refreshTokenValue);
            localStorage.setItem("userId", user._id);
            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userName", user.name || "Admin");
            localStorage.setItem("userRole", user.role);
            localStorage.setItem("adminLoginTime", new Date().toISOString());

            setMessage({ text: "Giriş başarılı! Yönlendiriliyorsunuz...", type: "success" });
            setTimeout(() => navigate("/admin"), 1000);
        } catch (error) {
            const errMsg = error.response?.data?.message || "Bağlantı hatası oluştu.";
            setMessage({ text: errMsg, type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="al">
            {/* Background */}
            <div className="al-bg">
                <div className="al-grid" />
                <div className="al-orb al-orb--1" />
                <div className="al-orb al-orb--2" />
                <div className="al-orb al-orb--3" />
            </div>

            <div className="al-wrap">
                {/* Login Card */}
                <div className="al-card">
                    <div className="al-header">
                        <div className="al-logo">
                            <FaShieldAlt />
                        </div>
                        <h1 className="al-title">Pazaryönetim</h1>
                        <p className="al-subtitle">Yönetim Konsolu</p>
                    </div>

                    {/* Server Status */}
                    <div className={`al-status al-status--${serverStatus}`}>
                        <FaServer />
                        <span>
                            {serverStatus === "checking" && "Sunucu kontrol ediliyor..."}
                            {serverStatus === "online" && "Sunucu çevrimiçi"}
                            {serverStatus === "offline" && "Sunucu erişilemiyor"}
                        </span>
                        <div className={`al-status-dot al-status-dot--${serverStatus}`} />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="al-form">
                        <div className="al-field">
                            <label className="al-label">E-posta Adresi</label>
                            <div className="al-input-wrap">
                                <FaEnvelope className="al-input-icon" />
                                <input
                                    className="al-input"
                                    type="email"
                                    name="email"
                                    placeholder="admin@pazaryonetim.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="al-field">
                            <label className="al-label">Şifre</label>
                            <div className="al-input-wrap">
                                <FaLock className="al-input-icon" />
                                <input
                                    className="al-input"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder=""
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="al-eye"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {message.text && (
                            <div className={`al-msg al-msg--${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="al-submit"
                            disabled={isLoading || serverStatus === "offline"}
                        >
                            {isLoading ? (
                                <>
                                    <FaSpinner className="al-spinner" />
                                    Doğrulanıyor...
                                </>
                            ) : (
                                <>
                                    <FaShieldAlt />
                                    Giriş Yap
                                </>
                            )}
                        </button>
                    </form>

                    <div className="al-footer">
                        <p>Bu alan sadece yetkili yöneticiler içindir.</p>
                        <p>Tüm giriş denemeleri kayıt altına alınmaktadır.</p>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="al-info">
                    <div className="al-info-card">
                        <div className="al-info-icon"></div>
                        <div>
                            <strong>Güvenli Erişim</strong>
                            <p>256-bit şifreleme ile korunan bağlantı</p>
                        </div>
                    </div>
                    <div className="al-info-card">
                        <div className="al-info-icon"></div>
                        <div>
                            <strong>Tam Kontrol</strong>
                            <p>Sunucu, kullanıcı ve sistem yönetimi</p>
                        </div>
                    </div>
                    <div className="al-info-card">
                        <div className="al-info-icon"></div>
                        <div>
                            <strong>Gerçek Zamanlı</strong>
                            <p>Anlık sistem izleme ve bildirimler</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;

