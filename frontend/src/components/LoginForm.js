import React, { useState, useCallback } from "react";
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
import LandingSection from "./LandingSection";
import "../styles/login.css";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

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

    // Şifremi unuttum state'leri
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Sağ panel scroll ref — landing'den "Giriş Yap" tıklanınca sağ panele focus
    const scrollToLogin = useCallback(() => {
        // Zaten login formu görünür durumda, sadece focus ver
        const emailInput = document.querySelector('.auth-input[name="email"]');
        if (emailInput) emailInput.focus();
    }, []);

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
            localStorage.setItem("token", response.data.token);

            const userResponse = await axios.get("/auth/profile", {
                headers: { Authorization: `Bearer ${response.data.token}` },
            });

            if (!userResponse.data._id) {
                setMessage({ text: "Kullanıcı bilgileri yüklenemedi.", type: "error" });
                return;
            }

            localStorage.setItem("userId", userResponse.data._id);
            localStorage.setItem("userEmail", userResponse.data.email);
            localStorage.setItem("userName", userResponse.data.name || "Bilinmiyor");
            localStorage.setItem("userRole", userResponse.data.role || "user");

            if (!rememberMe) {
                sessionStorage.setItem("token", response.data.token);
                localStorage.removeItem("token");
            }
            localStorage.setItem("rememberMe", rememberMe.toString());

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

    // ─── Render: Forgot Password Forms ───
    const renderForgotForm = () => {
        if (forgotMode === "email") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>Şifremi Unuttum</h2>
                        <p>Kayıtlı e-posta adresinizi girin.</p>
                    </div>

                    <form onSubmit={handleForgotSubmit} className="auth-form">
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaEnvelope className="auth-input-icon" />
                                <input
                                    className="auth-input"
                                    type="email"
                                    placeholder="E-posta adresiniz"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {message.text && (
                            <div className={`auth-message auth-message--${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? (
                                <div className="auth-spinner" />
                            ) : (
                                <>
                                    Kod Gönder
                                    <FaArrowRight className="auth-arrow" />
                                </>
                            )}
                        </button>
                    </form>

                    <button className="auth-back-btn" onClick={exitForgotMode} type="button">
                        <FaArrowLeft />
                        Giriş ekranına dön
                    </button>
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
                                <input
                                    className="auth-input"
                                    type="text"
                                    placeholder="6 haneli kod"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    required
                                    maxLength={6}
                                    disabled={isLoading}
                                    style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "22px", fontWeight: 700 }}
                                />
                            </div>
                        </div>

                        {message.text && (
                            <div className={`auth-message auth-message--${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" className="auth-submit" disabled={isLoading || resetCode.length !== 6}>
                            {isLoading ? (
                                <div className="auth-spinner" />
                            ) : (
                                <>
                                    Kodu Doğrula
                                    <FaArrowRight className="auth-arrow" />
                                </>
                            )}
                        </button>
                    </form>

                    <button className="auth-back-btn" onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }} type="button">
                        <FaArrowLeft />
                        Geri dön
                    </button>
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
                                <input
                                    className="auth-input"
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Yeni şifre (min. 6 karakter)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    tabIndex={-1}
                                >
                                    {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaLock className="auth-input-icon" />
                                <input
                                    className="auth-input"
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Yeni şifre tekrar"
                                    value={newPasswordConfirm}
                                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                    required
                                    minLength={6}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {message.text && (
                            <div className={`auth-message auth-message--${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? (
                                <div className="auth-spinner" />
                            ) : (
                                <>
                                    Şifreyi Değiştir
                                    <FaArrowRight className="auth-arrow" />
                                </>
                            )}
                        </button>
                    </form>

                    <button className="auth-back-btn" onClick={exitForgotMode} type="button">
                        <FaArrowLeft />
                        Giriş ekranına dön
                    </button>
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
                            placeholder="Şifreniz"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            autoComplete="current-password"
                            disabled={isLoading}
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

                {/* Remember & Forgot */}
                <div className="auth-options-row">
                    <label className="auth-remember" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`auth-checkbox ${rememberMe ? "checked" : ""}`}>
                            <FaCheck />
                        </div>
                        <span className="auth-remember-text">Beni hatırla</span>
                    </label>
                    <button
                        type="button"
                        className="auth-forgot"
                        onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }}
                    >
                        Şifremi unuttum?
                    </button>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`auth-message auth-message--${message.type}`}>
                        {message.text}
                        {needsVerification && (
                            <button
                                type="button"
                                className="auth-resend-btn"
                                disabled={resendLoading}
                                onClick={async () => {
                                    setResendLoading(true);
                                    try {
                                        await axios.post("/auth/resend-verification", { email: formData.email });
                                        setMessage({ text: "Doğrulama e-postası yeniden gönderildi! Gelen kutunuzu kontrol edin.", type: "success" });
                                        setNeedsVerification(false);
                                    } catch {
                                        setMessage({ text: "E-posta gönderilemedi. Lütfen tekrar deneyin.", type: "error" });
                                    } finally {
                                        setResendLoading(false);
                                    }
                                }}
                            >
                                {resendLoading ? "Gönderiliyor..." : "Doğrulama e-postasını yeniden gönder"}
                            </button>
                        )}
                    </div>
                )}

                {/* Submit */}
                <button type="submit" className="auth-submit" disabled={isLoading}>
                    {isLoading ? (
                        <div className="auth-spinner" />
                    ) : (
                        <>
                            Giriş Yap
                            <FaArrowRight className="auth-arrow" />
                        </>
                    )}
                </button>
            </form>

            {/* Divider & Google — sadece client_id varsa göster */}
            {GOOGLE_CLIENT_ID && (
                <>
                    <div className="auth-divider">
                        <div className="auth-divider-line" />
                        <span className="auth-divider-text">veya</span>
                        <div className="auth-divider-line" />
                    </div>
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
                        Google ile devam et
                    </button>
                </>
            )}

            {/* Switch */}
            <div className="auth-switch">
                Hesabınız yok mu?
                <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => navigate("/register")}
                >
                    Kayıt olun <span className="auth-switch-arrow">→</span>
                </button>
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════
    // RENDER — Sol: Sekmeli Landing | Sağ: Login Formu
    // Sayfa tam ekran, landing login formunun yanına kadar gelir
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="auth-page">
            {/* ═══ SOL PANEL — Sekmeli Landing İçeriği ═══ */}
            <div className="auth-left">
                <LandingSection onScrollToLogin={scrollToLogin} />
            </div>

            {/* ═══ SAĞ PANEL — Login Formu ═══ */}
            <div className="auth-right">
                {/* Mobile logo */}
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

                {forgotMode ? renderForgotForm() : renderLoginForm()}

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

const LoginForm = () => (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || "placeholder"}>
        <LoginFormInner />
    </GoogleOAuthProvider>
);

export default LoginForm;
