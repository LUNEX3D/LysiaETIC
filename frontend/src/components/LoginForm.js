import React, { useState } from "react";
import axios from "../services/api";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import {
    FaEnvelope,
    FaLock,
    FaEye,
    FaEyeSlash,
    FaCheck,
    FaArrowRight,
    FaArrowLeft,
    FaKey
} from "react-icons/fa";
import "../styles/login.css";

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
   LOGIN FORM INNER
   ═══════════════════════════════════════════════════════════════════════════ */
const LoginFormInner = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [message, setMessage] = useState({ text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(() => {
        return localStorage.getItem("rememberMe") !== "false";
    });
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    // Şifremi unuttum
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setMessage({ text: "", type: "" });
    };

    // ─── Normal Login ───
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            const response = await axios.post("/auth/login", formData);

            const userResponse = await axios.get("/auth/profile", {
                headers: { Authorization: `Bearer ${response.data.token}` },
            });

            if (!userResponse.data._id) {
                setMessage({ text: "Kullanıcı bilgileri yüklenemedi.", type: "error" });
                return;
            }

            // ✅ FIX H7: rememberMe — localStorage vs sessionStorage doğru kullanımı
            if (rememberMe) {
                localStorage.setItem("token", response.data.token);
                sessionStorage.removeItem("token");
            } else {
                sessionStorage.setItem("token", response.data.token);
                localStorage.removeItem("token");
            }
            localStorage.setItem("rememberMe", rememberMe.toString());

            localStorage.setItem("userId", userResponse.data._id);
            localStorage.setItem("userEmail", userResponse.data.email);
            localStorage.setItem("userName", userResponse.data.name || "Bilinmiyor");
            localStorage.setItem("userRole", userResponse.data.role || "user");

            setMessage({ text: "Giriş başarılı! Yönlendiriliyorsunuz...", type: "success" });

            setTimeout(() => {
                if (userResponse.data.role === "admin") {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }, 1500);
        } catch (error) {
            const data = error.response?.data;
            if (data?.needsVerification) {
                setNeedsVerification(true);
                setMessage({ text: data.message, type: "warning" });
            } else {
                setMessage({ text: data?.message || "Bir hata oluştu.", type: "error" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Google Login ───
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

            setMessage({ text: "Google ile giriş başarılı!", type: "success" });

            setTimeout(() => {
                if (user.role === "admin") {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }, 1500);
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Google ile giriş yapılamadı.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => setMessage({ text: "Google ile giriş başarısız.", type: "error" }),
        flow: "implicit",
    });

    // ─── Forgot Password — Step 1 ───
    const handleForgotSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            await axios.post("/auth/forgot-password", { email: forgotEmail });
            setMessage({ text: "Şifre sıfırlama kodu e-posta adresinize gönderildi.", type: "success" });
            setForgotMode("code");
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Bir hata oluştu.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Forgot Password — Step 2 ───
    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            await axios.post("/auth/verify-reset-code", { email: forgotEmail, code: resetCode });
            setMessage({ text: "Kod doğrulandı! Yeni şifrenizi belirleyin.", type: "success" });
            setForgotMode("reset");
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Geçersiz veya süresi dolmuş kod.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Forgot Password — Step 3 ───
    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        if (newPassword !== newPasswordConfirm) {
            setMessage({ text: "Şifreler eşleşmiyor!", type: "error" });
            setIsLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ text: "Şifre en az 6 karakter olmalıdır!", type: "error" });
            setIsLoading(false);
            return;
        }

        try {
            await axios.post("/auth/reset-password", {
                email: forgotEmail,
                code: resetCode,
                newPassword
            });
            setMessage({ text: "Şifreniz başarıyla değiştirildi! Giriş yapabilirsiniz.", type: "success" });
            setTimeout(() => {
                setForgotMode(false);
                setForgotEmail("");
                setResetCode("");
                setNewPassword("");
                setNewPasswordConfirm("");
                setMessage({ text: "", type: "" });
            }, 2000);
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Şifre sıfırlama başarısız.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const exitForgotMode = () => {
        setForgotMode(false);
        setForgotEmail("");
        setResetCode("");
        setNewPassword("");
        setNewPasswordConfirm("");
        setMessage({ text: "", type: "" });
    };

    // ─── Forgot Password Forms ───
    const renderForgotForm = () => {
        if (forgotMode === "email") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>Şifremi Unuttum</h2>
                        <p>Kayıtlı e-posta adresinizi girin, size bir sıfırlama kodu göndereceğiz.</p>
                    </div>
                    <form onSubmit={handleForgotSubmit} className="auth-form">
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaEnvelope className="auth-input-icon" />
                                <input className="auth-input" type="email" placeholder="E-posta adresiniz" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" disabled={isLoading} />
                            </div>
                        </div>
                        {message.text && <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>}
                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? <div className="auth-spinner" /> : <>Kod Gönder <FaArrowRight className="auth-arrow" /></>}
                        </button>
                    </form>
                    <button className="auth-back-btn" onClick={exitForgotMode} type="button"><FaArrowLeft /> Giriş ekranına dön</button>
                </div>
            );
        }
        if (forgotMode === "code") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>Doğrulama Kodu</h2>
                        <p>E-postanıza gönderilen 6 haneli kodu girin.</p>
                    </div>
                    <form onSubmit={handleCodeSubmit} className="auth-form">
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaKey className="auth-input-icon" />
                                <input className="auth-input" type="text" placeholder="6 haneli kod" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required maxLength={6} disabled={isLoading} style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "22px", fontWeight: 700 }} />
                            </div>
                        </div>
                        {message.text && <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>}
                        <button type="submit" className="auth-submit" disabled={isLoading || resetCode.length !== 6}>
                            {isLoading ? <div className="auth-spinner" /> : <>Kodu Doğrula <FaArrowRight className="auth-arrow" /></>}
                        </button>
                    </form>
                    <button className="auth-back-btn" onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }} type="button"><FaArrowLeft /> Geri dön</button>
                </div>
            );
        }
        if (forgotMode === "reset") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>Yeni Şifre</h2>
                        <p>Yeni şifrenizi belirleyin.</p>
                    </div>
                    <form onSubmit={handleResetSubmit} className="auth-form">
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaLock className="auth-input-icon" />
                                <input className="auth-input" type={showNewPassword ? "text" : "password"} placeholder="Yeni şifre (min. 6 karakter)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} disabled={isLoading} />
                                <button type="button" className="auth-eye-btn" onClick={() => setShowNewPassword(!showNewPassword)} tabIndex={-1}>{showNewPassword ? <FaEyeSlash /> : <FaEye />}</button>
                            </div>
                        </div>
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaLock className="auth-input-icon" />
                                <input className="auth-input" type={showNewPassword ? "text" : "password"} placeholder="Şifrenizi tekrar girin" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required minLength={6} disabled={isLoading} />
                            </div>
                        </div>
                        {message.text && <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>}
                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? <div className="auth-spinner" /> : <>Şifreyi Değiştir <FaArrowRight className="auth-arrow" /></>}
                        </button>
                    </form>
                    <button className="auth-back-btn" onClick={exitForgotMode} type="button"><FaArrowLeft /> Giriş ekranına dön</button>
                </div>
            );
        }
        return null;
    };

    // ─── Main Login Form ───
    const renderLoginForm = () => (
        <div className="auth-form-card auth-fade-in">
            <div className="auth-form-header">
                <h2>Giriş Yap</h2>
                <p>Lunexetic hesabınıza hoş geldiniz.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
                {/* Email */}
                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaEnvelope className="auth-input-icon" />
                        <input className="auth-input" type="email" name="email" placeholder="E-posta adresiniz" value={formData.email} onChange={handleChange} required autoComplete="email" disabled={isLoading} />
                    </div>
                </div>

                {/* Password */}
                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaLock className="auth-input-icon" />
                        <input className="auth-input" type={showPassword ? "text" : "password"} name="password" placeholder="Şifreniz" value={formData.password} onChange={handleChange} required autoComplete="current-password" disabled={isLoading} />
                        <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                {/* Remember & Forgot */}
                <div className="auth-options-row">
                    <label className="auth-remember" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`auth-checkbox ${rememberMe ? "checked" : ""}`}><FaCheck /></div>
                        <span className="auth-remember-text">Beni hatırla</span>
                    </label>
                    <button type="button" className="auth-forgot" onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }}>
                        Şifremi unuttum?
                    </button>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`auth-message auth-message--${message.type}`}>
                        {message.text}
                        {needsVerification && (
                            <button type="button" className="auth-resend-btn" disabled={resendLoading} onClick={async () => {
                                setResendLoading(true);
                                try {
                                    await axios.post("/auth/resend-verification", { email: formData.email });
                                    setMessage({ text: "Doğrulama e-postası yeniden gönderildi!", type: "success" });
                                    setNeedsVerification(false);
                                } catch { setMessage({ text: "E-posta gönderilemedi.", type: "error" }); }
                                finally { setResendLoading(false); }
                            }}>
                                {resendLoading ? "Gönderiliyor..." : "Doğrulama e-postasını yeniden gönder"}
                            </button>
                        )}
                    </div>
                )}

                {/* Submit */}
                <button type="submit" className="auth-submit" disabled={isLoading}>
                    {isLoading ? <div className="auth-spinner" /> : <>Giriş Yap <FaArrowRight className="auth-arrow" /></>}
                </button>
            </form>

            {/* Divider */}
            <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">veya</span>
                <div className="auth-divider-line" />
            </div>

            {/* Google Button — full width (görseldeki gibi) */}
            <button className="auth-google-btn" type="button" onClick={() => googleLogin()} disabled={isLoading}>
                <GoogleIcon />
                Google ile devam et
            </button>

            {/* Switch */}
            <div className="auth-switch">
                Hesabınız yok mu?
                <button type="button" className="auth-switch-link" onClick={() => navigate("/register")}>
                    Kayıt olun <span className="auth-switch-arrow">→</span>
                </button>
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="auth-page">
            {/* Glow lines — görseldeki üst kısımdaki ışık çizgileri */}
            <div className="auth-glow-lines" />

            {/* Navbar */}
            <AuthNavbar />

            {/* Main Content */}
            <div className="auth-main">
                {/* Sol — Hero + Mockup */}
                <div className="auth-hero auth-fade-in">
                    <h1 className="auth-hero-title">
                        İşinizi tek panelden<br />yönetin, <em>büyütün.</em>
                    </h1>
                    <p className="auth-hero-desc">
                        Pazaryeri entegrasyonu, stok, sipariş ve daha fazlası.<br />
                        Lunexetic ile e-ticarette bir adım önde olun.
                    </p>
                    <DashboardMockup />

                    {/* Dekoratif bitki — görseldeki sol alt */}
                    <PlantDecoration />
                </div>

                {/* Sağ — Login Form */}
                <div className="auth-form-panel auth-fade-in-delay">
                    {forgotMode ? renderForgotForm() : renderLoginForm()}
                </div>
            </div>

            {/* Footer — ✅ FIX E6: Shared component */}
            <AuthFooter />
        </div>
    );
};

const LoginForm = () => (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || "placeholder"}>
        <LoginFormInner />
    </GoogleOAuthProvider>
);

export default LoginForm;
