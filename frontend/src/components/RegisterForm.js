import React, { useState } from "react";
import axios from "../services/api";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import {
    FaUser,
    FaEnvelope,
    FaLock,
    FaEye,
    FaEyeSlash,
    FaArrowRight
} from "react-icons/fa";
import "../styles/login.css";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

const RegisterFormInner = () => {
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [message, setMessage] = useState({ text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setMessage({ text: "", type: "" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            await axios.post("/auth/register", formData);
            setMessage({ text: "Kayıt başarılı! Doğrulama e-postası gönderildi. Giriş sayfasına yönlendiriliyorsunuz...", type: "success" });

            setTimeout(() => {
                navigate("/login");
            }, 2500);
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Bir hata oluştu.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (tokenResponse) => {
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            const response = await axios.post("/auth/google", {
                access_token: tokenResponse.access_token
            });

            localStorage.setItem("token", response.data.token);

            const user = response.data.user;
            localStorage.setItem("userId", user._id);
            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userName", user.name || "Bilinmiyor");
            localStorage.setItem("userRole", user.role || "user");

            setMessage({ text: "Google ile kayıt başarılı!", type: "success" });

            setTimeout(() => {
                if (user.role === "admin") {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }, 1500);
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Google ile kayıt yapılamadı.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => setMessage({ text: "Google ile kayıt başarısız.", type: "error" }),
        flow: "implicit",
    });

    return (
            <div className="auth-page">
                {/* ═══ LEFT PANEL ═══ */}
                <div className="auth-left">
                    <div className="auth-left-grid" />
                    <div className="auth-orb auth-orb--1" />
                    <div className="auth-orb auth-orb--2" />
                    <div className="auth-orb auth-orb--3" />

                    {/* Logo */}
                    <div className="auth-logo auth-fade-in">
                        <div className="auth-logo-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <span className="auth-logo-text">LUNEXETIC</span>
                    </div>

                    {/* Hero */}
                    <div className="auth-hero auth-slide-up">
                        <h1>
                            E-ticarette<br />
                            <span className="auth-highlight">yeni nesil</span> yönetim.
                        </h1>
                        <p>
                            Hemen ücretsiz hesap oluşturun ve tüm pazaryerlerinizi
                            tek bir panelden yönetmeye başlayın.
                        </p>
                    </div>

                    {/* Dashboard Mockup */}
                    <div className="auth-mockup-area auth-fade-in-delay">
                        <div className="auth-float-badge auth-float-badge--trendyol">trendyol</div>
                        <div className="auth-float-badge auth-float-badge--hepsiburada">hepsiburada</div>
                        <div className="auth-float-badge auth-float-badge--amazon">
                            <span style={{ fontSize: 20, fontWeight: 900 }}>a</span>
                        </div>
                        <div className="auth-float-badge auth-float-badge--n11">n11</div>

                        <div className="auth-laptop">
                            <div className="auth-laptop-topbar">
                                <div className="auth-laptop-dot" />
                                <div className="auth-laptop-dot" />
                                <div className="auth-laptop-dot" />
                            </div>
                            <div className="auth-laptop-body">
                                <div className="auth-mock-stats">
                                    <div className="auth-mock-stat">
                                        <div className="auth-mock-stat-label">Toplam Sipariş</div>
                                        <div className="auth-mock-stat-row">
                                            <span className="auth-mock-stat-value">1,245</span>
                                            <span className="auth-mock-stat-badge">↑ 12.5%</span>
                                        </div>
                                    </div>
                                    <div className="auth-mock-stat">
                                        <div className="auth-mock-stat-label">Toplam Ciro</div>
                                        <div className="auth-mock-stat-row">
                                            <span className="auth-mock-stat-value">₺125,430</span>
                                            <span className="auth-mock-stat-badge">↑ 8.2%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="auth-mock-chart">
                                    <div className="auth-mock-chart-title">Satış Grafiği</div>
                                    <svg className="auth-mock-chart-svg" viewBox="0 0 460 60" fill="none">
                                        <defs>
                                            <linearGradient id="chartGradReg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path
                                            d="M0,45 C30,42 60,38 90,30 C120,22 150,35 180,28 C210,21 240,15 270,18 C300,21 330,12 360,8 C390,4 420,10 460,5"
                                            stroke="#6366f1"
                                            strokeWidth="2.5"
                                            fill="none"
                                        />
                                        <path
                                            d="M0,45 C30,42 60,38 90,30 C120,22 150,35 180,28 C210,21 240,15 270,18 C300,21 330,12 360,8 C390,4 420,10 460,5 L460,60 L0,60 Z"
                                            fill="url(#chartGradReg)"
                                        />
                                    </svg>
                                </div>

                                <div className="auth-mock-integrations">
                                    <span className="auth-mock-int-title">Entegrasyonlar</span>
                                    <div className="auth-mock-int-logo ty">T</div>
                                    <div className="auth-mock-int-logo hb">HB</div>
                                    <div className="auth-mock-int-logo az">a</div>
                                    <div className="auth-mock-int-logo n1">n11</div>
                                    <div className="auth-mock-int-logo plus">+</div>
                                </div>
                            </div>
                        </div>

                        <div className="auth-phone">
                            <div className="auth-phone-notch" />
                            <div className="auth-phone-body">
                                <div className="auth-phone-title">Siparişler</div>
                                <div className="auth-phone-order">
                                    <div className="auth-phone-order-left">
                                        <span className="auth-phone-order-id">#10254</span>
                                        <span className="auth-phone-order-date">Bugün</span>
                                    </div>
                                    <span className="auth-phone-order-price">₺1,249.90</span>
                                </div>
                                <div className="auth-phone-order">
                                    <div className="auth-phone-order-left">
                                        <span className="auth-phone-order-id">#10233</span>
                                        <span className="auth-phone-order-date">Dün</span>
                                    </div>
                                    <span className="auth-phone-order-price">₺799.90</span>
                                </div>
                                <div className="auth-phone-order">
                                    <div className="auth-phone-order-left">
                                        <span className="auth-phone-order-id">#10232</span>
                                        <span className="auth-phone-order-date">2 gün</span>
                                    </div>
                                    <span className="auth-phone-order-price">₺1,099.90</span>
                                </div>
                                <div className="auth-phone-btn">Tümünü Gör</div>
                            </div>
                        </div>
                    </div>

                    <div className="auth-plant" />
                </div>

                {/* ═══ RIGHT PANEL ═══ */}
                <div className="auth-right">
                    <div className="auth-mobile-logo">
                        <div className="auth-logo-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <span className="auth-logo-text">LUNEXETIC</span>
                    </div>

                    <div className="auth-form-card auth-fade-in">
                        <div className="auth-form-header">
                            <h2>Kayıt Ol</h2>
                            <p>Ücretsiz hesabınızı oluşturun.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">
                            {/* Name */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaUser className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type="text"
                                        name="name"
                                        placeholder="Adınız Soyadınız"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        autoComplete="name"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaEnvelope className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type="email"
                                        name="email"
                                        placeholder="E-posta adresiniz"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        autoComplete="email"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaLock className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        placeholder="Şifreniz (min. 6 karakter)"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        autoComplete="new-password"
                                        disabled={isLoading}
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        className="auth-eye-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>

                            {/* Message */}
                            {message.text && (
                                <div className={`auth-message auth-message--${message.type}`}>
                                    {message.text}
                                </div>
                            )}

                            {/* Submit */}
                            <button type="submit" className="auth-submit" disabled={isLoading}>
                                {isLoading ? (
                                    <div className="auth-spinner" />
                                ) : (
                                    <>
                                        Kayıt Ol
                                        <FaArrowRight className="auth-arrow" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="auth-divider">
                            <div className="auth-divider-line" />
                            <span className="auth-divider-text">veya</span>
                            <div className="auth-divider-line" />
                        </div>

                        {/* Google */}
                        <button
                            className="auth-google-btn"
                            type="button"
                            onClick={() => googleLogin()}
                            disabled={isLoading}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Google ile kayıt ol
                        </button>

                        {/* Switch */}
                        <div className="auth-switch">
                            Zaten hesabınız var mı?
                            <button
                                type="button"
                                className="auth-switch-link"
                                onClick={() => navigate("/login")}
                            >
                                Giriş yapın <span className="auth-switch-arrow">→</span>
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="auth-footer">
                        <span>© 2024 Lunexetic. Tüm hakları saklıdır.</span>
                        <span className="auth-footer-dot" />
                        <a href="/privacy">Gizlilik Politikası</a>
                        <span className="auth-footer-dot" />
                        <a href="/terms">Kullanım Şartları</a>
                    </div>
                </div>
            </div>
    );
};

const RegisterForm = () => (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <RegisterFormInner />
    </GoogleOAuthProvider>
);

export default RegisterForm;
