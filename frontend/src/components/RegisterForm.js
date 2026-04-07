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
import { useApp } from "../context/AppContext";

// ✅ FIX E6: Shared auth components
import AuthNavbar from "./auth/AuthNavbar";
import DashboardMockup from "./auth/DashboardMockup";
import { PlantDecoration, GoogleIcon, AuthFooter } from "./auth/AuthShared";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

/* ═══════════════════════════════════════════════════════════════════════════
   ✅ FIX E6: AuthNavbar, DashboardMockup, PlantDecoration, GoogleIcon
   artık ./auth/ klasöründen import ediliyor (duplicate kod kaldırıldı)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   REGISTER FORM INNER
   ═══════════════════════════════════════════════════════════════════════════ */
const RegisterFormInner = () => {
    const { t } = useApp();
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState({ text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setMessage({ text: "", type: "" });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        if (formData.password !== confirmPassword) {
            setMessage({ text: t("auth.passwordMismatch"), type: "error" });
            setIsLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setMessage({ text: t("auth.passwordTooShort"), type: "error" });
            setIsLoading(false);
            return;
        }

        try {
            await axios.post("/auth/register", formData);
            setMessage({ text: t("auth.registerSuccess"), type: "success" });
            setTimeout(() => { navigate("/login"); }, 2500);
        } catch (error) {
            setMessage({ text: error.response?.data?.message || "Bir hata oluştu.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (tokenResponse) => {
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            const response = await axios.post("/auth/google", { access_token: tokenResponse.access_token });
            localStorage.setItem("token", response.data.token);
            const user = response.data.user;
            localStorage.setItem("userId", user._id);
            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userName", user.name || "Bilinmiyor");
            localStorage.setItem("userRole", user.role || "user");
            setMessage({ text: t("auth.googleRegisterSuccess"), type: "success" });
            setTimeout(() => { navigate(user.role === "admin" ? "/admin" : "/dashboard"); }, 1500);
        } catch (error) {
            setMessage({ text: error.response?.data?.message || "Google ile kayıt yapılamadı.", type: "error" });
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
            {/* Glow lines */}
            <div className="auth-glow-lines" />

            {/* Navbar */}
            <AuthNavbar />

            {/* Main Content */}
            <div className="auth-main">
                {/* Sol — Hero + Mockup */}
                <div className="auth-hero auth-fade-in">
                    <h1 className="auth-hero-title">
                        {t("auth.heroTitle1")}<br />{t("auth.heroTitle2")} <em>{t("auth.heroTitle3")}</em>
                    </h1>
                    <p className="auth-hero-desc">
                        {t("auth.heroDesc1")}<br />
                        {t("auth.heroDesc2")}
                    </p>
                    <DashboardMockup />

                    {/* Dekoratif bitki */}
                    <PlantDecoration />
                </div>

                {/* Sağ — Register Form */}
                <div className="auth-form-panel auth-fade-in-delay">
                    <div className="auth-form-card auth-fade-in">
                        <div className="auth-form-header">
                            <h2>{t("auth.registerTitle")}</h2>
                            <p>{t("auth.registerSubtitle")}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">
                            {/* Ad Soyad */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaUser className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type="text"
                                        name="name"
                                        placeholder={t("auth.namePlaceholder")}
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        autoComplete="name"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* E-posta */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaEnvelope className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type="email"
                                        name="email"
                                        placeholder={t("auth.emailPlaceholder")}
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        autoComplete="email"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Şifre */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaLock className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        placeholder={t("auth.passwordPlaceholder")}
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

                            {/* Şifre Tekrar */}
                            <div className="auth-field">
                                <div className="auth-input-wrap">
                                    <FaLock className="auth-input-icon" />
                                    <input
                                        className="auth-input"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder={t("auth.confirmPasswordPlaceholder")}
                                        value={confirmPassword}
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            setMessage({ text: "", type: "" });
                                        }}
                                        required
                                        autoComplete="new-password"
                                        disabled={isLoading}
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        className="auth-eye-btn"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        tabIndex={-1}
                                    >
                                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>

                            {/* Message */}
                            {message.text && (
                                <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>
                            )}

                            {/* Submit */}
                            <button type="submit" className="auth-submit" disabled={isLoading}>
                                {isLoading ? <div className="auth-spinner" /> : <>{t("auth.registerBtn")} <FaArrowRight className="auth-arrow" /></>}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="auth-divider">
                            <div className="auth-divider-line" />
                            <span className="auth-divider-text">{t("auth.orDivider")}</span>
                            <div className="auth-divider-line" />
                        </div>

                        {/* Google Button */}
                        <button className="auth-google-btn" type="button" onClick={() => googleLogin()} disabled={isLoading}>
                            <GoogleIcon />
                            {t("auth.googleContinue")}
                        </button>

                        {/* Switch */}
                        <div className="auth-switch">
                            {t("auth.hasAccount")}
                            <button type="button" className="auth-switch-link" onClick={() => navigate("/login")}>
                                {t("auth.loginLink")} <span className="auth-switch-arrow">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer — ✅ FIX E6: Shared component */}
            <AuthFooter />
        </div>
    );
};

const RegisterForm = () => (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || "placeholder"}>
        <RegisterFormInner />
    </GoogleOAuthProvider>
);

export default RegisterForm;
