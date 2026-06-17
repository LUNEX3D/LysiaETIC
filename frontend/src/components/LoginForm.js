import React, { useState, useEffect } from "react";
import axios from "../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { useApp } from "../context/AppContext";

//  FIX E6: Shared auth components
import AuthNavbar from "./auth/AuthNavbar";
import DashboardMockup from "./auth/DashboardMockup";
import PartnerMarquee from "./auth/PartnerMarquee";
import LoginMarketingTabs from "./auth/LoginMarketingTabs";
import { PlantDecoration, GoogleIcon, AuthFooter } from "./auth/AuthShared";
import { persistAuthSession, restoreSessionIfPossible } from "../utils/authSession";
import { isAuthMarketingTab, resolveLoginTabFromSearch } from "../utils/authTabNavigation";
import useLoginPageConfig from "../hooks/useLoginPageConfig";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

const validatePasswordPolicy = (password, t) => {
    if (!password || password.length < 8) return t("auth.passwordTooShort");
    if (!/[A-Z]/.test(password)) return t("auth.passwordNeedUpper");
    if (!/[a-z]/.test(password)) return t("auth.passwordNeedLower");
    if (!/[0-9]/.test(password)) return t("auth.passwordNeedDigit");
    return null;
};

const isLoginFullPageTab = (tab) => isAuthMarketingTab(tab);

/* 
   LOGIN FORM INNER
    */
const LoginFormInner = () => {
    const { t } = useApp();
    const [formData, setFormData] = useState({ email: "", password: "" });

    // Dinamik fiyatlar  API'den ekilir, fallback hardcoded
    const [prices, setPrices] = useState({
        basic: { monthly: "299", yearly: "249", yearlyTotal: "2.990" },
        pro: { monthly: "599", yearly: "499", yearlyTotal: "5.990", oldMonthly: "799" },
        enterprise: { monthly: "1.499", yearly: "1.199", yearlyTotal: "14.390" },
    });

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const res = await axios.get("/paytr/plans");
                if (res.data.success && res.data.plans) {
                    const p = {};
                    res.data.plans.forEach(plan => {
                        const mp = plan.monthlyPrice || plan.price || 0;
                        const yp = plan.yearlyPrice || Math.round(mp * 10);
                        const monthlyFromYearly = Math.round(yp / 12);
                        const fmtMp = mp >= 1000 ? `${mp.toLocaleString("tr-TR")}` : `${mp}`;
                        const fmtYm = monthlyFromYearly >= 1000 ? `${monthlyFromYearly.toLocaleString("tr-TR")}` : `${monthlyFromYearly}`;
                        const fmtYt = yp >= 1000 ? `${yp.toLocaleString("tr-TR")}` : `${yp}`;
                        p[plan.id] = { monthly: fmtMp, yearly: fmtYm, yearlyTotal: fmtYt };
                    });
                    setPrices(prev => ({
                        basic: p.basic || prev.basic,
                        pro: { ...(p.pro || prev.pro), oldMonthly: p.pro ? undefined : prev.pro.oldMonthly },
                        enterprise: p.enterprise || prev.enterprise,
                    }));
                }
            } catch (err) {
                console.warn("LoginForm: Plan fiyatlar yüklenemedi, fallback kullanlyor");
            }
        };
        fetchPrices();
    }, []);

    const [message, setMessage] = useState({ text: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(() => {
        const stored = localStorage.getItem("rememberMe");
        return stored === null ? true : stored === "true";
    });
    const [autoLoginChecked, setAutoLoginChecked] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    // 2FA (ikinci adım)
    const [twoFactorMode, setTwoFactorMode] = useState(false);
    const [twoFactorEmail, setTwoFactorEmail] = useState("");
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [twoFactorResendLoading, setTwoFactorResendLoading] = useState(false);

    // Şifremi unuttum
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => resolveLoginTabFromSearch(searchParams) || "home");

    useEffect(() => {
        const tab = resolveLoginTabFromSearch(searchParams);
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    const { config: pageConfig, partners: partnerItems } = useLoginPageConfig();

    const handleAuthTabChange = (tab) => {
        if (tab === "blog") {
            navigate("/blog");
            return;
        }
        setActiveTab(tab);
        const next = new URLSearchParams(searchParams);
        if (tab === "home") next.delete("tab");
        else next.set("tab", tab);
        setSearchParams(next, { replace: true });
    };

    // Beni hatırla: kayıtlı oturum varsa şifre sormadan yönlendir
    useEffect(() => {
        if (autoLoginChecked) return;
        let cancelled = false;
        (async () => {
            const profile = await restoreSessionIfPossible();
            if (cancelled || !profile?._id) {
                if (!cancelled) setAutoLoginChecked(true);
                return;
            }
            if (profile.role === "admin") {
                navigate("/admin", { replace: true });
            } else {
                navigate("/dashboard", { replace: true });
            }
        })();
        return () => { cancelled = true; };
    }, [autoLoginChecked, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setMessage({ text: "", type: "" });
    };

    //  Normal Login 
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            const response = await axios.post("/auth/login", {
                ...formData,
                rememberMe,
            });

            if (response.data?.requires2FA) {
                setTwoFactorMode(true);
                setTwoFactorEmail(response.data.email || formData.email);
                setTwoFactorCode("");
                setMessage({
                    text: response.data.message || "Doğrulama kodu e-posta adresinize gönderildi.",
                    type: "success",
                });
                return;
            }

            //  FIX: Yeni token' NCE kaydet
            // ESK: Eski/bozuk token localStorage'da kalyordu  interceptor eski token'
            //   profile isteine ekliyordu  "invalid signature" hatas
            localStorage.setItem("token", response.data.token);
            sessionStorage.setItem("token", response.data.token);

            const ok = await completeLoginSession(
                response.data.token,
                response.data.refreshToken,
                response.data.rememberMe ?? rememberMe,
                null
            );
            if (!ok) return;
        } catch (error) {
            const data = error.response?.data;
            const status = error.response?.status;
            const code = data?.code;

            if (data?.needsVerification) {
                setNeedsVerification(true);
                setMessage({ text: data.message, type: "warning" });
            } else if (code === "CORS_BLOCKED") {
                setMessage({
                    text: "Sunucuya erişim engellendi (CORS). Doğru web adresinden bağlandığınızdan emin olun. Sorun devam ediyorsa yöneticinize bildirin.",
                    type: "error"
                });
            } else if (status === 403 && data?.message?.includes("doğrulan")) {
                // E-posta doğrulanmamış — needsVerification flag yoksa da yakala
                setNeedsVerification(true);
                setMessage({ text: data.message, type: "warning" });
            } else if (status === 403) {
                // 403 alındı — backend'ten gelen orijinal mesajı sade şekilde göster.
                // (Eskiden burada otomatik /diagnostic/whoami çağırılıyordu, kaldırıldı —
                //  endpoint bulunamadığında çirkin "[Tanı: ... 404]" metni oluşturuyordu.)
                setMessage({
                    text: data?.message || "Sunucu şu anda erişim izni vermiyor. Lütfen daha sonra tekrar deneyin veya yöneticinize bildirin.",
                    type: "error"
                });
            } else if (!error.response && (error.message?.includes("Network") || error.code === "ERR_NETWORK")) {
                // Sunucuya hiç ulaşılamadı (SSL/CORS/down)
                setMessage({
                    text: "Sunucuya bağlanılamadı. SSL sertifikası geçersiz olabilir veya sunucu kapalı. Adres çubuğundaki uyarıyı kontrol edin.",
                    type: "error"
                });
            } else {
                setMessage({ text: data?.message || "Bir hata oluştu.", type: "error" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    //  Google Login 
    const handleGoogleSuccess = async (tokenResponse) => {
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            const response = await axios.post("/auth/google", {
                access_token: tokenResponse.access_token
            });

            persistAuthSession({
                token: response.data.token,
                refreshToken: response.data.refreshToken,
                rememberMe: true,
                user: response.data.user,
            });

            const user = response.data.user;

            setMessage({ text: t("auth.googleLoginSuccess"), type: "success" });

            setTimeout(() => {
                if (user.role === "admin") {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }, 1500);
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Google ile giriş yaplamad.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => setMessage({ text: "Google ile giriş baarsz.", type: "error" }),
        flow: "implicit",
    });

    //  Forgot Password  Step 1 
    const handleForgotSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            await axios.post("/auth/forgot-password", { email: forgotEmail });
            setMessage({ text: t("auth.resetCodeSent"), type: "success" });
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

    //  Forgot Password  Step 2 
    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            await axios.post("/auth/verify-reset-code", { email: forgotEmail, code: resetCode });
            setMessage({ text: t("auth.codeVerified"), type: "success" });
            setForgotMode("reset");
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Geersiz veya sresi dolmu kod.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    //  Forgot Password  Step 3 
    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        if (newPassword !== newPasswordConfirm) {
            setMessage({ text: t("auth.passwordMismatch"), type: "error" });
            setIsLoading(false);
            return;
        }

        const policyError = validatePasswordPolicy(newPassword, t);
        if (policyError) {
            setMessage({ text: policyError, type: "error" });
            setIsLoading(false);
            return;
        }

        try {
            await axios.post("/auth/reset-password", {
                email: forgotEmail,
                code: resetCode,
                newPassword
            });
            setMessage({ text: t("auth.passwordChanged"), type: "success" });
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
                text: error.response?.data?.message || "şifre sıfırlama baarsz.",
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

    const completeLoginSession = async (token, refreshToken, remember, userFromResponse) => {
        localStorage.setItem("token", token);
        sessionStorage.setItem("token", token);

        let user = userFromResponse;
        if (!user?._id) {
            const userResponse = await axios.get("/auth/profile");
            user = userResponse.data;
        }
        if (!user?._id) {
            setMessage({ text: t("auth.userLoadFailed"), type: "error" });
            return false;
        }

        persistAuthSession({
            token,
            refreshToken,
            rememberMe: remember ?? rememberMe,
            user,
        });

        setMessage({ text: t("auth.loginSuccess"), type: "success" });
        setTimeout(() => {
            if (user.role === "admin") navigate("/admin");
            else navigate("/dashboard");
        }, 1200);
        return true;
    };

    const handle2FASubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });
        try {
            const response = await axios.post("/auth/2fa/verify", {
                email: twoFactorEmail,
                code: twoFactorCode.trim(),
            });
            const ok = await completeLoginSession(
                response.data.token,
                response.data.refreshToken,
                true,
                response.data.user
            );
            if (ok) setTwoFactorMode(false);
        } catch (error) {
            setMessage({
                text: error.response?.data?.message || "Doğrulama kodu geçersiz.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handle2FAResend = async () => {
        setTwoFactorResendLoading(true);
        try {
            await axios.post("/auth/2fa/resend", { email: twoFactorEmail });
            setMessage({ text: "Yeni doğrulama kodu gönderildi.", type: "success" });
        } catch {
            setMessage({ text: t("common.error"), type: "error" });
        } finally {
            setTwoFactorResendLoading(false);
        }
    };

    const exitTwoFactorMode = () => {
        setTwoFactorMode(false);
        setTwoFactorCode("");
        setTwoFactorEmail("");
        setMessage({ text: "", type: "" });
    };

    //  Forgot Password Forms 
    const renderForgotForm = () => {
        if (forgotMode === "email") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>{t("auth.forgotTitle")}</h2>
                        <p>{t("auth.forgotDesc")}</p>
                    </div>
                    <form onSubmit={handleForgotSubmit} className="auth-form">
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaEnvelope className="auth-input-icon" />
                                <input className="auth-input" type="email" placeholder={t("auth.emailPlaceholder")} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" disabled={isLoading} />
                            </div>
                        </div>
                        {message.text && <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>}
                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? <div className="auth-spinner" /> : <>{t("auth.sendCode")} <FaArrowRight className="auth-arrow" /></>}
                        </button>
                    </form>
                    <button className="auth-back-btn" onClick={exitForgotMode} type="button"><FaArrowLeft /> {t("auth.backToLogin")}</button>
                </div>
            );
        }
        if (forgotMode === "code") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>{t("auth.verifyTitle")}</h2>
                        <p>{t("auth.verifyDesc")}</p>
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
                            {isLoading ? <div className="auth-spinner" /> : <>{t("auth.verifyCode")} <FaArrowRight className="auth-arrow" /></>}
                        </button>
                    </form>
                    <button className="auth-back-btn" onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }} type="button"><FaArrowLeft /> {t("auth.goBack")}</button>
                </div>
            );
        }
        if (forgotMode === "reset") {
            return (
                <div className="auth-form-card auth-fade-in">
                    <div className="auth-form-header">
                        <h2>{t("auth.newPasswordTitle")}</h2>
                        <p>{t("auth.newPasswordDesc")}</p>
                    </div>
                    <form onSubmit={handleResetSubmit} className="auth-form">
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaLock className="auth-input-icon" />
                                <input className="auth-input" type={showNewPassword ? "text" : "password"} placeholder={t("auth.newPasswordPlaceholder")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} disabled={isLoading} />
                                <button type="button" className="auth-eye-btn" onClick={() => setShowNewPassword(!showNewPassword)} tabIndex={-1}>{showNewPassword ? <FaEyeSlash /> : <FaEye />}</button>
                            </div>
                        </div>
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaLock className="auth-input-icon" />
                                <input className="auth-input" type={showNewPassword ? "text" : "password"} placeholder={t("auth.confirmNewPlaceholder")} value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required minLength={8} disabled={isLoading} />
                            </div>
                        </div>
                        {message.text && <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>}
                        <button type="submit" className="auth-submit" disabled={isLoading}>
                            {isLoading ? <div className="auth-spinner" /> : <>{t("auth.changePassword")} <FaArrowRight className="auth-arrow" /></>}
                        </button>
                    </form>
                    <button className="auth-back-btn" onClick={exitForgotMode} type="button"><FaArrowLeft /> {t("auth.backToLogin")}</button>
                </div>
            );
        }
        return null;
    };

    //  Main Login Form 
    const renderTwoFactorForm = () => (
        <div className="auth-form-card auth-fade-in">
            <div className="auth-form-header">
                <h2>İki faktörlü doğrulama</h2>
                <p>{twoFactorEmail} adresine gönderilen 6 haneli kodu girin.</p>
            </div>
            <form onSubmit={handle2FASubmit} className="auth-form">
                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaKey className="auth-input-icon" />
                        <input
                            className="auth-input"
                            type="text"
                            placeholder="6 haneli kod"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            required
                            maxLength={6}
                            disabled={isLoading}
                            style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "22px", fontWeight: 700 }}
                        />
                    </div>
                </div>
                {message.text && <div className={`auth-message auth-message--${message.type}`}>{message.text}</div>}
                <button type="submit" className="auth-submit" disabled={isLoading || twoFactorCode.length !== 6}>
                    {isLoading ? <div className="auth-spinner" /> : <>Doğrula <FaArrowRight className="auth-arrow" /></>}
                </button>
            </form>
            <button type="button" className="auth-resend-btn" disabled={twoFactorResendLoading} onClick={handle2FAResend}>
                {twoFactorResendLoading ? "Gönderiliyor..." : "Kodu tekrar gönder"}
            </button>
            <button className="auth-back-btn" onClick={exitTwoFactorMode} type="button"><FaArrowLeft /> Girişe dön</button>
        </div>
    );

    const renderLoginForm = () => (
        <div className="auth-form-card auth-fade-in">
            <div className="auth-form-header">
                <h2>{t("auth.loginTitle")}</h2>
                <p>{t("auth.loginSubtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaEnvelope className="auth-input-icon" />
                        <input className="auth-input" type="email" name="email" placeholder={t("auth.emailPlaceholder")} value={formData.email} onChange={handleChange} required autoComplete="email" disabled={isLoading} />
                    </div>
                </div>

                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaLock className="auth-input-icon" />
                        <input className="auth-input" type={showPassword ? "text" : "password"} name="password" placeholder={t("auth.passwordPlaceholder")} value={formData.password} onChange={handleChange} required autoComplete="current-password" disabled={isLoading} />
                        <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                <div className="auth-options-row">
                    <label className="auth-remember" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`auth-checkbox ${rememberMe ? "checked" : ""}`}><FaCheck /></div>
                        <span className="auth-remember-text">
                            {t("auth.rememberMe")}
                            <small style={{ display: "block", opacity: 0.75, fontWeight: 400, marginTop: 2 }}>
                                30 gün şifre sormaz; oturumu kapatınca sıfırlanır
                            </small>
                        </span>
                    </label>
                    <button type="button" className="auth-forgot" onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }}>
                        {t("auth.forgotPassword")}
                    </button>
                </div>

                {message.text && (
                    <div className={`auth-message auth-message--${message.type}`}>
                        {message.text}
                        {needsVerification && (
                            <button type="button" className="auth-resend-btn" disabled={resendLoading} onClick={async () => {
                                setResendLoading(true);
                                try {
                                    await axios.post("/auth/resend-verification", { email: formData.email });
                                    setMessage({ text: t("auth.verificationResent"), type: "success" });
                                    setNeedsVerification(false);
                                } catch { setMessage({ text: t("common.error"), type: "error" }); }
                                finally { setResendLoading(false); }
                            }}>
                                {resendLoading ? t("auth.resending") : t("auth.resendVerification")}
                            </button>
                        )}
                    </div>
                )}

                <button type="submit" className="auth-submit" disabled={isLoading}>
                    {isLoading ? <div className="auth-spinner" /> : <>{t("auth.loginBtn")} <FaArrowRight className="auth-arrow" /></>}
                </button>
            </form>

            <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">{t("auth.orDivider")}</span>
                <div className="auth-divider-line" />
            </div>

            <button className="auth-google-btn" type="button" onClick={() => googleLogin()} disabled={isLoading}>
                <GoogleIcon />
                {t("auth.googleContinue")}
            </button>

            <div className="auth-switch">
                {t("auth.noAccount")}
                <button type="button" className="auth-switch-link" onClick={() => navigate("/register")}>
                    {t("auth.registerLink")} <span className="auth-switch-arrow"></span>
                </button>
            </div>
        </div>
    );

    // 
    // RENDER
    // 
    return (
        <div className="auth-page">
            <div className="auth-glow-lines" />

            <AuthNavbar activeTab={activeTab} onTabChange={handleAuthTabChange} />

            <div className={`auth-main${isLoginFullPageTab(activeTab) ? " auth-main--fullpage" : ""}`}>
                <div className={`auth-hero auth-fade-in${isLoginFullPageTab(activeTab) ? " auth-hero--fullpage" : ""}`}>
                    {activeTab === "home" && (
                        <>
                            <h1 className="auth-hero-title">
                                {pageConfig.hero?.titleLine1 || t("auth.heroTitle1")}<br />
                                {pageConfig.hero?.titleLine2 || t("auth.heroTitle2")}{" "}
                                <em>{pageConfig.hero?.titleEmphasis || t("auth.heroTitle3")}</em>
                            </h1>
                            <p className="auth-hero-desc">
                                {pageConfig.hero?.description1 || t("auth.heroDesc1")}<br />
                                {pageConfig.hero?.description2 || t("auth.heroDesc2")}
                            </p>
                            <DashboardMockup />
                            <PlantDecoration />
                        </>
                    )}

                    <LoginMarketingTabs
                        activeTab={activeTab}
                        config={pageConfig}
                        prices={prices}
                        onGoHome={() => handleAuthTabChange("home")}
                        onGoPricing={() => handleAuthTabChange("pricing")}
                        onGoContact={() => handleAuthTabChange("contact")}
                    />
                </div>

                {activeTab !== "features" && activeTab !== "pricing" && activeTab !== "about" && activeTab !== "contact" && (
                    <div className="auth-form-panel auth-fade-in-delay">
                        {twoFactorMode ? renderTwoFactorForm() : forgotMode ? renderForgotForm() : renderLoginForm()}
                    </div>
                )}
            </div>

            <PartnerMarquee partners={pageConfig.partners} items={partnerItems} />

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


