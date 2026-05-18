import React, { useState, useEffect } from "react";
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
import { useApp } from "../context/AppContext";

//  FIX E6: Shared auth components
import AuthNavbar from "./auth/AuthNavbar";
import DashboardMockup from "./auth/DashboardMockup";
import { PlantDecoration, GoogleIcon, AuthFooter } from "./auth/AuthShared";
import { BRAND_EMAIL, BRAND_VERIFY_EMAIL_NOTE } from "../constants/brand";
import MarketplaceBlogSection from "./MarketplaceBlogSection";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

/** Giriş sayfası → İletişim sekmesi */
const LOGIN_PAGE_CONTACT = {
    phone: "+905363989092",
    email: BRAND_EMAIL,
    address: "Türkiye/İstanbul/Ümraniye/parseller mah Nil sokak no:55",
    workingHours: "08:00-18:00",
    whatsapp: "+905363989092",
    note: BRAND_VERIFY_EMAIL_NOTE,
};

const isLoginFullPageTab = (tab) =>
    tab === "features" || tab === "pricing" || tab === "about" || tab === "contact" || tab === "blog";

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

    //  Normal Login 
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        try {
            const response = await axios.post("/auth/login", formData);

            //  FIX: Yeni token' NCE kaydet  axios interceptor localStorage'dan okuyor
            // ESK: Eski/bozuk token localStorage'da kalyordu  interceptor eski token'
            //   profile isteine ekliyordu  "invalid signature" hatas
            localStorage.setItem("token", response.data.token);
            sessionStorage.setItem("token", response.data.token);

            const userResponse = await axios.get("/auth/profile");

            if (!userResponse.data._id) {
                setMessage({ text: t("auth.userLoadFailed"), type: "error" });
                return;
            }

            //  FIX H7: rememberMe  localStorage vs sessionStorage doru kullanm
            //  FIX #12: refreshToken' da kaydet
            if (rememberMe) {
                localStorage.setItem("token", response.data.token);
                if (response.data.refreshToken) localStorage.setItem("refreshToken", response.data.refreshToken);
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("refreshToken");
            } else {
                sessionStorage.setItem("token", response.data.token);
                if (response.data.refreshToken) sessionStorage.setItem("refreshToken", response.data.refreshToken);
                localStorage.removeItem("token");
                localStorage.removeItem("refreshToken");
            }
            localStorage.setItem("rememberMe", rememberMe.toString());

            localStorage.setItem("userId", userResponse.data._id);
            localStorage.setItem("userEmail", userResponse.data.email);
            localStorage.setItem("userName", userResponse.data.name || "Bilinmiyor");
            localStorage.setItem("userRole", userResponse.data.role || "user");

            setMessage({ text: t("auth.loginSuccess"), type: "success" });

            setTimeout(() => {
                if (userResponse.data.role === "admin") {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }, 1500);
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

            localStorage.setItem("token", response.data.token);
            //  FIX #12: refreshToken' da kaydet
            if (response.data.refreshToken) localStorage.setItem("refreshToken", response.data.refreshToken);

            const user = response.data.user;
            localStorage.setItem("userId", user._id);
            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userName", user.name || "Bilinmiyor");
            localStorage.setItem("userRole", user.role || "user");

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

        if (newPassword.length < 6) {
            setMessage({ text: t("auth.passwordTooShort"), type: "error" });
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
                                <input className="auth-input" type={showNewPassword ? "text" : "password"} placeholder={t("auth.newPasswordPlaceholder")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} disabled={isLoading} />
                                <button type="button" className="auth-eye-btn" onClick={() => setShowNewPassword(!showNewPassword)} tabIndex={-1}>{showNewPassword ? <FaEyeSlash /> : <FaEye />}</button>
                            </div>
                        </div>
                        <div className="auth-field">
                            <div className="auth-input-wrap">
                                <FaLock className="auth-input-icon" />
                                <input className="auth-input" type={showNewPassword ? "text" : "password"} placeholder={t("auth.confirmNewPlaceholder")} value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required minLength={6} disabled={isLoading} />
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
                        <span className="auth-remember-text">{t("auth.rememberMe")}</span>
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
    // TAB SYSTEM STATE
    // 
    const [activeTab, setActiveTab] = useState("home");

    // 
    // RENDER
    // 
    return (
        <div className="auth-page">
            <div className="auth-glow-lines" />

            <AuthNavbar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className={`auth-main${isLoginFullPageTab(activeTab) ? " auth-main--fullpage" : ""}`}>
                <div className={`auth-hero auth-fade-in${isLoginFullPageTab(activeTab) ? " auth-hero--fullpage" : ""}`}>
                    {activeTab === "home" && (
                        <>
                            <h1 className="auth-hero-title">
                                {t("auth.heroTitle1")}<br />{t("auth.heroTitle2")} <em>{t("auth.heroTitle3")}</em>
                            </h1>
                            <p className="auth-hero-desc">
                                {t("auth.heroDesc1")}<br />
                                {t("auth.heroDesc2")}
                            </p>
                            <DashboardMockup />
                            <PlantDecoration />
                        </>
                    )}

                    {activeTab === "features" && (
                        <div className="auth-tab-content auth-tab-fullpage">
                            {/*  HERO SECTION  */}
                            <div className="ft-hero">
                                <span className="ft-hero-badge"> Türkiye'nin En Kapsamlı E-Ticaret Platformu</span>
                                <h2 className="ft-hero-title">
                                    Tüm E-Ticaret Operasyonlarınızı<br />
                                    <span className="ft-gradient-text">Tek Bir Platformda</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    Pazaryeri entegrasyonundan yapay zeka destekli analize, stok yönetiminden kargo takibine kadar
                                    ihtiyacınız olan her şey PazarYonet'de. Artık 10 farklı araç kullanmanıza gerek yok.
                                </p>
                            </div>

                            {/*  ANA ÖZELLİKLER  3'lü Grid  */}
                            <div className="ft-section">
                                <div className="ft-section-label"> ANA ÖZELLİKLER</div>
                                <h3 className="ft-section-title">İşinizi Büyüten Güçlü Araçlar</h3>
                            </div>

                            <div className="ft-main-grid">
                                <div className="ft-main-card ft-main-card--highlight">
                                    <div className="ft-main-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }} aria-hidden>🛒</div>
                                    <h4>Çoklu Pazaryeri Entegrasyonu</h4>
                                    <p>Trendyol, Hepsiburada, Amazon, N11, Çiçeksepeti ve daha fazlası... Tüm pazaryerlerini tek panelden yönetin. Ürün listeleme, fiyat güncelleme, sipariş takibi hepsi tek ekranda.</p>
                                    <div className="ft-main-tags">
                                        <span className="ft-tag" style={{ color: "#f27a1a" }}>Trendyol</span>
                                        <span className="ft-tag" style={{ color: "#ff6000" }}>Hepsiburada</span>
                                        <span className="ft-tag" style={{ color: "#ff9900" }}>Amazon</span>
                                        <span className="ft-tag" style={{ color: "#7c5cfc" }}>N11</span>
                                        <span className="ft-tag" style={{ color: "#e91e8c" }}>Çiçeksepeti</span>
                                    </div>
                                </div>

                                <div className="ft-main-card">
                                    <div className="ft-main-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }} aria-hidden>📦</div>
                                    <h4>Akıllı Stok & Ürün Yönetimi</h4>
                                    <p>Tüm pazaryerlerinde stok senkronizasyonu, toplu ürün yükleme, varyant yönetimi ve otomatik fiyat güncelleme. Bir yerde satılan ürün anında diğer pazaryerlerinde güncellenir.</p>
                                    <div className="ft-main-tags">
                                        <span className="ft-tag" style={{ color: "#22c55e" }}>Otomatik Senkron</span>
                                        <span className="ft-tag" style={{ color: "#16a34a" }}>Toplu Yükleme</span>
                                        <span className="ft-tag" style={{ color: "#10b981" }}>Varyant</span>
                                    </div>
                                </div>

                                <div className="ft-main-card">
                                    <div className="ft-main-icon" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} aria-hidden>🧠</div>
                                    <h4>PazarYonet AI Yapay Zeka Asistanı</h4>
                                    <p>GPT-4 destekli AI asistanınız. Ürün açıklaması yazma, SEO optimizasyonu, fiyat önerisi, rakip analizi ve satış stratejisi... Hepsini yapay zeka ile yapın.</p>
                                    <div className="ft-main-tags">
                                        <span className="ft-tag" style={{ color: "#8b5cf6" }}>GPT-4</span>
                                        <span className="ft-tag" style={{ color: "#a78bfa" }}>SEO</span>
                                        <span className="ft-tag" style={{ color: "#7c3aed" }}>Strateji</span>
                                    </div>
                                </div>
                            </div>

                            {/*  DETAYLI ÖZELLİKLER  2'li Grid  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> DETAYLI ÖZELLİKLER</div>
                                <h3 className="ft-section-title">Her İhtiyacınız İçin Bir Çözüm</h3>
                            </div>

                            <div className="ft-detail-grid">
                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon" aria-hidden>📊</div>
                                    <div className="ft-detail-body">
                                        <h4>Gelişmiş Analitik & Raporlama</h4>
                                        <p>Satış trendleri, gelir analizi, ürün performansı, pazaryeri karşılaştırması... Tüm verilerle işinizi görselleştirin. Gerçek zamanlı dashboard ile anlık kararlar alın.</p>
                                        <ul className="ft-detail-list">
                                            <li>Gerçek zamanlı satış dashboard'u</li>
                                            <li>Pazaryeri bazlı performans karşılaştırması</li>
                                            <li>Ürün bazlı kârlılık analizi</li>
                                            <li>Özelleştirilebilir raporlar & Excel export</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon" aria-hidden>🎯</div>
                                    <div className="ft-detail-body">
                                        <h4>PazarYonet Radar Fırsat Motoru</h4>
                                        <p>Yapay zeka ile pazaryerlerini tarayarak yüksek kâr potansiyelli ürünleri keşfedin. Rakip analizi, talep tahmini ve fiyat optimizasyonu tek tuşla.</p>
                                        <ul className="ft-detail-list">
                                            <li>AI destekli ürün fırsat keşfi</li>
                                            <li>Kategori bazlı pazar analizi</li>
                                            <li>Kârlılık skoru & talep tahmini</li>
                                            <li>Rakip fiyat takibi & uyarılar</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon" aria-hidden>💰</div>
                                    <div className="ft-detail-body">
                                        <h4>Finans & Muhasebe Yönetimi</h4>
                                        <p>Gelir-gider takibi, komisyon hesaplama, kâr-zarar analizi ve e-fatura entegrasyonu. Finansal durumunuzu her an kontrol altında tutun.</p>
                                        <ul className="ft-detail-list">
                                            <li>Otomatik komisyon hesaplama</li>
                                            <li>Gelir-gider & kâr-zarar raporları</li>
                                            <li>E-fatura entegrasyonu (QNB, Sovos, Paraşüt)</li>
                                            <li>Vergi hesaplama & KDV takibi</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon" aria-hidden>🚚</div>
                                    <div className="ft-detail-body">
                                        <h4>Sipariş & Kargo Takibi</h4>
                                        <p>Tüm pazaryerlerinden gelen siparişleri tek ekranda yönetin. Kargo firmalarıyla entegrasyon, otomatik etiket basımı ve teslimat takibi.</p>
                                        <ul className="ft-detail-list">
                                            <li>Çoklu pazaryeri sipariş birleştirme</li>
                                            <li>Aras, Yurtiçi, MNG, Sürat entegrasyonu</li>
                                            <li>Otomatik kargo etiketi oluşturma</li>
                                            <li>Teslimat durumu & müşteri bildirimi</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon" aria-hidden>📁</div>
                                    <div className="ft-detail-body">
                                        <h4>Kategori Merkezi & Eşleştirme</h4>
                                        <p>Pazaryeri kategori ağacında ürün keşfedin, ürünlerinizi doğru kategorilere eşleştirin. Zorunlu özellik alanlarını otomatik doldurun.</p>
                                        <ul className="ft-detail-list">
                                            <li>Pazaryeri kategori ağacı görüntüleme</li>
                                            <li>Akıllı kategori eşleştirme önerileri</li>
                                            <li>Zorunlu özellik alan yönetimi</li>
                                            <li>Toplu kategori güncelleme</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon" aria-hidden>🏷️</div>
                                    <div className="ft-detail-body">
                                        <h4>Fiyat Senkronizasyonu & Optimizasyon</h4>
                                        <p>Tüm pazaryerlerinde fiyatlarınızı tek tuşla güncelleyin. Komisyon bazlı fiyat hesaplama, rakip fiyat takibi ve otomatik fiyat kuralları.</p>
                                        <ul className="ft-detail-list">
                                            <li>Pazaryeri komisyon bazlı fiyatlama</li>
                                            <li>Toplu fiyat güncelleme</li>
                                            <li>Rakip fiyat takibi & uyarı</li>
                                            <li>Dinamik fiyat kuralları</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/*  ROKETFY & AI BÖLÜMÜ  */}
                            <div className="ft-ai-banner">
                                <div className="ft-ai-banner-glow" />
                                <div className="ft-ai-banner-content">
                                    <div className="ft-ai-badge"> YAPAY ZEKA DESTEKLİ</div>
                                    <h3>Rakiplerinizin Bir Adım Önünde Olun</h3>
                                    <p>PazarYonet AI ve PazarYonet Radar ile pazaryerlerindeki trendleri analiz edin, yüksek kârlı ürünleri keşfedin ve satış stratejinizi optimize edin. Yapay zeka sizin için çalışsın.</p>
                                    <div className="ft-ai-features">
                                        <div className="ft-ai-feat">
                                            <span aria-hidden>📈</span>
                                            <div>
                                                <strong>Pazar Analizi</strong>
                                                <small>Kategori bazlı talep & rekabet analizi</small>
                                            </div>
                                        </div>
                                        <div className="ft-ai-feat">
                                            <span aria-hidden>🔮</span>
                                            <div>
                                                <strong>Trend Tahmini</strong>
                                                <small>AI ile gelecek trendleri önceden görün</small>
                                            </div>
                                        </div>
                                        <div className="ft-ai-feat">
                                            <span aria-hidden>✍️</span>
                                            <div>
                                                <strong>İçerik Üretimi</strong>
                                                <small>SEO uyumlu ürün açıklaması & başlık</small>
                                            </div>
                                        </div>
                                        <div className="ft-ai-feat">
                                            <span aria-hidden>🎯</span>
                                            <div>
                                                <strong>Strateji Önerisi</strong>
                                                <small>Kişiselleştirilmiş satış stratejileri</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*  TEKNOLOJİ STACK  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> TEKNOLOJİ</div>
                                <h3 className="ft-section-title">Güvenilir & Modern Altyapı</h3>
                            </div>

                            <div className="ft-tech-grid">
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon" aria-hidden>☁️</div>
                                    <h5>AWS Cloud</h5>
                                    <p>Amazon Web Services üzerinde %99.9 uptime garantisi</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon" aria-hidden>🔒</div>
                                    <h5>SSL & 2FA</h5>
                                    <p>256-bit şifreleme ve iki faktörlü kimlik doğrulama</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon" aria-hidden>⚡</div>
                                    <h5>Gerçek Zamanlı</h5>
                                    <p>Anlık stok & sipariş senkronizasyonu</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon" aria-hidden>📱</div>
                                    <h5>PWA Desteği</h5>
                                    <p>Mobil uygulama gibi çalışan web deneyimi</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon" aria-hidden>🔌</div>
                                    <h5>API Entegrasyonu</h5>
                                    <p>RESTful API ile kendi sistemlerinize bağlayın</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon" aria-hidden>🌐</div>
                                    <h5>Çoklu Dil</h5>
                                    <p>Türkçe & İngilizce tam dil desteği</p>
                                </div>
                            </div>

                            {/*  İSTATİSTİKLER  */}
                            <div className="ft-stats-banner">
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">5+</div>
                                    <div className="ft-stat-big-label">Pazaryeri<br/>Entegrasyonu</div>
                                </div>
                                <div className="ft-stat-divider" />
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">50K+</div>
                                    <div className="ft-stat-big-label">Yönetilen<br/>Ürün</div>
                                </div>
                                <div className="ft-stat-divider" />
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">99.9%</div>
                                    <div className="ft-stat-big-label">Uptime<br/>Garantisi</div>
                                </div>
                                <div className="ft-stat-divider" />
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">7/24</div>
                                    <div className="ft-stat-big-label">Teknik<br/>Destek</div>
                                </div>
                                <div className="ft-stat-divider" />
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">15+</div>
                                    <div className="ft-stat-big-label">Modül &<br/>Araç</div>
                                </div>
                            </div>

                            {/*  CTA  */}
                            <div className="ft-cta">
                                <h3>Hemen Başlayın - 14 Gün Ücretsiz Deneyin</h3>
                                <p>Kredi kartı gerekmez. Tüm özelliklere tam erişim.</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("pricing")}>
                                    Paketleri İncele 
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "pricing" && (
                        <div className="auth-tab-content auth-tab-fullpage">
                            {/*  HERO  */}
                            <div className="ft-hero">
                                <span className="ft-hero-badge"> Şeffaf & Uygun Fiyatlandırma</span>
                                <h2 className="ft-hero-title">
                                    İşletmenizin Büyüklüğüne<br />
                                    <span className="ft-gradient-text">Uygun Paketler</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    Gizli ücret yok, sürpriz fatura yok. İhtiyacınıza göre paket seçin,
                                    istediğiniz zaman yükseltin veya iptal edin. Tüm paketlerde 14 gün ücretsiz deneme.
                                </p>
                            </div>

                            {/*  PAKETLER  */}
                            <div className="pr-grid">
                                {/*  STARTER  */}
                                <div className="pr-card">
                                    <div className="pr-card-header">
                                        <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }} aria-hidden>🌱</div>
                                        <h3 className="pr-card-name">Starter</h3>
                                        <p className="pr-card-desc">E-ticarete yeni başlayanlar için ideal başlangıç paketi</p>
                                        <div className="pr-card-price">
                                            <span className="pr-price-amount">Ücretsiz</span>
                                            <span className="pr-price-period">14 gün deneme</span>
                                        </div>
                                        <div className="pr-card-after">Sonrasında <strong>{prices.basic.monthly}/ay</strong></div>
                                    </div>
                                    <div className="pr-card-body">
                                        <div className="pr-section-label">Pazaryeri & Ürün</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 2 pazaryeri entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 500 ürün limiti</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 2.000 sipariş / ay</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Manuel stok güncelleme</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Temel ürün yükleme</li>
                                        </ul>
                                        <div className="pr-section-label">Analitik & Raporlama</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Temel satış dashboard'u</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Günlük satış raporu</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Gelişmiş analitik</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Excel / PDF export</li>
                                        </ul>
                                        <div className="pr-section-label">AI & Araçlar</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-no"><span className="pr-x"></span> PazarYonet AI Asistanı</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> PazarYonet Radar</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Fiyat optimizasyonu</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> E-fatura entegrasyonu</li>
                                        </ul>
                                        <div className="pr-section-label">Destek</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> E-posta desteği</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Bilgi bankası erişimi</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Canlı destek</li>
                                        </ul>
                                    </div>
                                    <button className="pr-card-btn pr-btn-outline" type="button" onClick={() => setActiveTab("home")}>
                                        Ücretsiz Dene
                                    </button>
                                </div>

                                {/*  PRO  */}
                                <div className="pr-card pr-card--popular">
                                    <div className="pr-popular-badge"> EN POPÜLER</div>
                                    <div className="pr-card-header">
                                        <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }} aria-hidden>⭐</div>
                                        <h3 className="pr-card-name">Pro</h3>
                                        <p className="pr-card-desc">Büyüyen işletmeler için tam donanımlı profesyonel paket</p>
                                        <div className="pr-card-price">
                                            {prices.pro.oldMonthly && <span className="pr-price-old">{prices.pro.oldMonthly}</span>}
                                            <span className="pr-price-amount">{prices.pro.monthly}</span>
                                            <span className="pr-price-period">/ ay</span>
                                        </div>
                                        <div className="pr-card-save">Yıllık ödemede {prices.pro.yearly}/ay tasarruf edin</div>
                                    </div>
                                    <div className="pr-card-body">
                                        <div className="pr-section-label">Pazaryeri & Ürün</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>5 pazaryeri</strong> entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>10.000 ürün</strong> limiti</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>50.000 sipariş</strong> / ay</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Otomatik stok senkronizasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Toplu ürün yükleme & güncelleme</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Varyant & kategori yönetimi</li>
                                        </ul>
                                        <div className="pr-section-label">Analitik & Raporlama</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gelişmiş satış dashboard'u</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Pazaryeri karşılaştırma raporu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Ürün performans analizi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Excel & PDF export</li>
                                        </ul>
                                        <div className="pr-section-label">AI & Araçlar</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>PazarYonet AI</strong> - 500 sorgu/ay</li>
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>PazarYonet Radar</strong> - Fırsat keşfi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Fiyat optimizasyonu & kuralları</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> E-fatura entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Kargo takibi & etiket basımı</li>
                                        </ul>
                                        <div className="pr-section-label">Destek</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 7/24 canlı destek</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Öncelikli e-posta desteği</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Video eğitim içerikleri</li>
                                        </ul>
                                    </div>
                                    <button className="pr-card-btn pr-btn-primary" type="button" onClick={() => setActiveTab("home")}>
                                        Pro'ya Başla 
                                    </button>
                                </div>

                                {/*  ENTERPRISE  */}
                                <div className="pr-card pr-card--enterprise">
                                    <div className="pr-card-header">
                                        <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} aria-hidden>🏢</div>
                                        <h3 className="pr-card-name">Enterprise</h3>
                                        <p className="pr-card-desc">Yüksek hacimli satıcılar ve kurumsal firmalar için sınırsız paket</p>
                                        <div className="pr-card-price">
                                            <span className="pr-price-amount">{prices.enterprise.monthly}</span>
                                            <span className="pr-price-period">/ ay</span>
                                        </div>
                                        <div className="pr-card-save">Yıllık ödemede {prices.enterprise.yearly}/ay tasarruf edin</div>
                                    </div>
                                    <div className="pr-card-body">
                                        <div className="pr-section-label">Pazaryeri & Ürün</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>Sınırsız</strong> pazaryeri entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>Sınırsız</strong> ürün</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>Sınırsız</strong> sipariş</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Otomatik stok senkronizasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Toplu ürün yükleme & güncelleme</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gelişmiş varyant & kategori</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Özel API erişimi</li>
                                        </ul>
                                        <div className="pr-section-label">Analitik & Raporlama</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Pro'daki tüm özellikler</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Özel rapor oluşturma</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Otomatik rapor gönderimi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Çoklu kullanıcı & rol yönetimi</li>
                                        </ul>
                                        <div className="pr-section-label">AI & Araçlar</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>PazarYonet AI</strong> - Sınırsız sorgu</li>
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>PazarYonet Radar</strong> - Tam erişim</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gelişmiş fiyat optimizasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> E-fatura & muhasebe entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Kargo takibi & etiket basımı</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Webhook & özel entegrasyonlar</li>
                                        </ul>
                                        <div className="pr-section-label">Destek</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Dedicated hesap yöneticisi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> SLA garantisi (%99.9 uptime)</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Öncelikli teknik destek</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Özel onboarding eğitimi</li>
                                        </ul>
                                    </div>
                                    <button className="pr-card-btn pr-btn-gold" type="button" onClick={() => setActiveTab("home")}>
                                        İletişime Geç 
                                    </button>
                                </div>
                            </div>

                            {/*  KARŞILAŞTIRMA TABLOSU  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> KARŞILAŞTIRMA</div>
                                <h3 className="ft-section-title">Paketleri Karşılaştırın</h3>
                            </div>

                            <div className="pr-compare">
                                <div className="pr-compare-row pr-compare-header">
                                    <div className="pr-compare-feature">Özellik</div>
                                    <div className="pr-compare-val">Starter</div>
                                    <div className="pr-compare-val pr-compare-val--pop">Pro</div>
                                    <div className="pr-compare-val">Enterprise</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Pazaryeri Sayısı</div>
                                    <div className="pr-compare-val">2</div>
                                    <div className="pr-compare-val pr-compare-val--pop">5</div>
                                    <div className="pr-compare-val">Sınırsız</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Ürün Limiti</div>
                                    <div className="pr-compare-val">500</div>
                                    <div className="pr-compare-val pr-compare-val--pop">10.000</div>
                                    <div className="pr-compare-val">Sınırsız</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Sipariş / Ay</div>
                                    <div className="pr-compare-val">2.000</div>
                                    <div className="pr-compare-val pr-compare-val--pop">50.000</div>
                                    <div className="pr-compare-val">Sınırsız</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">PazarYonet AI</div>
                                    <div className="pr-compare-val"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val pr-compare-val--pop"><span className="pr-compare-yes">500/ay</span></div>
                                    <div className="pr-compare-val"><span className="pr-compare-yes">Sınırsız</span></div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">PazarYonet Radar</div>
                                    <div className="pr-compare-val"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val pr-compare-val--pop"><span className="pr-compare-yes"></span></div>
                                    <div className="pr-compare-val"><span className="pr-compare-yes"></span></div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">E-Fatura</div>
                                    <div className="pr-compare-val"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val pr-compare-val--pop"><span className="pr-compare-yes"></span></div>
                                    <div className="pr-compare-val"><span className="pr-compare-yes"></span></div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">API Erişimi</div>
                                    <div className="pr-compare-val"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val pr-compare-val--pop"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val"><span className="pr-compare-yes"></span></div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Destek</div>
                                    <div className="pr-compare-val">E-posta</div>
                                    <div className="pr-compare-val pr-compare-val--pop">7/24 Canlı</div>
                                    <div className="pr-compare-val">Dedicated</div>
                                </div>
                            </div>

                            {/*  SSS  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> SIKÇA SORULAN SORULAR</div>
                                <h3 className="ft-section-title">Merak Edilenler</h3>
                            </div>

                            <div className="pr-faq">
                                <div className="pr-faq-item">
                                    <h4>Ücretsiz deneme nasıl alınır?</h4>
                                    <p>14 gün boyunca Pro paketinin tüm özelliklerini ücretsiz kullanabilirsiniz. Kredi kartı bilgisi gerekmez. Deneme süresi bittiğinde otomatik olarak Starter pakete geçersiniz.</p>
                                </div>
                                <div className="pr-faq-item">
                                    <h4>İstediğim zaman paket değiştirebilir miyim?</h4>
                                    <p>Evet! İstediğiniz zaman paketinizi yükseltebilir veya düşürebilirsiniz. Yükseltme anında aktif olur, düşürme ise mevcut dönem sonunda geçerli olur.</p>
                                </div>
                                <div className="pr-faq-item">
                                    <h4>Yıllık ödeme avantajı nedir?</h4>
                                    <p>Yıllık ödeme tercih ettiğinizde Pro pakette %37'ye varan, Enterprise pakette %20'ye varan tasarruf sağlarsınız. Yıllık ödemeler iade edilebilir.</p>
                                </div>
                                <div className="pr-faq-item">
                                    <h4>Verilerim güvende mi?</h4>
                                    <p>Tüm verileriniz AWS altyapısında 256-bit SSL şifreleme ile korunur. KVKK uyumlu veri işleme politikamız mevcuttur. Düzenli yedekleme yapılır.</p>
                                </div>
                            </div>

                            {/*  CTA  */}
                            <div className="ft-cta">
                                <h3>14 Gün Ücretsiz Deneyin</h3>
                                <p>Kredi kartı gerekmez - İstediğiniz zaman iptal edin - Tüm Pro özellikler dahil</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("home")}>
                                    Hemen Kayıt Ol 
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "about" && (
                        <div className="auth-tab-content auth-tab-fullpage">
                            {/*  HERO SECTION  */}
                            <div className="ft-hero">
                                <span className="ft-hero-badge"> PazarYonet Hakkında</span>
                                <h2 className="ft-hero-title">
                                    E-Ticaretin Geleceğini<br />
                                    <span className="ft-gradient-text">Birlikte İnşa Ediyoruz</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    PazarYonet, Türkiye'nin en kapsamlı e-ticaret yönetim platformudur. Yapay zeka destekli
                                    araçlarımızla binlerce satıcının işini büyütmesine yardımcı oluyoruz.
                                </p>
                            </div>

                            {/*  HİKAYEMİZ  */}
                            <div className="ab-story">
                                <div className="ab-story-glow" />
                                <div className="ab-story-content">
                                    <div className="ab-story-badge"> HİKAYEMİZ</div>
                                    <h3>Bir Vizyondan Doğdu</h3>
                                    <p>
                                        E-ticaret satıcılarının her gün onlarca farklı araç, panel ve platform arasında
                                        kaybolduğunu gördük. Stok takibi bir yerde, sipariş yönetimi başka yerde, fiyatlandırma
                                        ayrı bir yerde... Bu karmaşayı ortadan kaldırmak için yola çıktık.
                                    </p>
                                    <p>
                                        PazarYonet, tüm e-ticaret operasyonlarını tek bir çatı altında toplayan, yapay zeka
                                        ile güçlendirilmiş, kullanıcı dostu bir platform olarak doğdu. Amacımız basit:
                                        <strong> Satıcıların teknik detaylarla değil, işlerini büyütmeyle ilgilenmesini sağlamak.</strong>
                                    </p>
                                </div>
                            </div>

                            {/*  MİSYON & VİZYON  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> MİSYON & VİZYON</div>
                                <h3 className="ft-section-title">Neden Varız?</h3>
                            </div>

                            <div className="ab-mv-grid">
                                <div className="ab-mv-card ab-mv-card--mission">
                                    <div className="ab-mv-icon" aria-hidden>🎯</div>
                                    <h4>Misyonumuz</h4>
                                    <p>
                                        E-ticaret işletmelerinin tüm operasyonlarını tek bir platformdan yönetmelerini sağlayarak,
                                        satıcıların verimliliğini artırmak ve büyümelerini hızlandırmak. Her ölçekteki işletmeye
                                        kurumsal düzeyde araçlar sunmak.
                                    </p>
                                    <div className="ab-mv-highlights">
                                        <span> Tek platform, sınırsız imkan</span>
                                        <span> Her ölçeğe uygun çözüm</span>
                                        <span> Satıcı odaklı geliştirme</span>
                                    </div>
                                </div>
                                <div className="ab-mv-card ab-mv-card--vision">
                                    <div className="ab-mv-icon" aria-hidden>🔭</div>
                                    <h4>Vizyonumuz</h4>
                                    <p>
                                        Türkiye'nin ve bölgenin en kapsamlı e-ticaret yönetim platformu olmak. Yapay zeka
                                        destekli çözümlerle satıcıların rakiplerinin bir adım önünde olmasını sağlamak
                                        ve e-ticaret ekosistemini dönüştürmek.
                                    </p>
                                    <div className="ab-mv-highlights">
                                        <span> AI-first yaklaşımı</span>
                                        <span> Global ölçekte büyüme</span>
                                        <span> Ekosistem dönüşümü</span>
                                    </div>
                                </div>
                            </div>

                            {/*  DEĞERLER  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> DEĞERLERİMİZ</div>
                                <h3 className="ft-section-title">Bizi Biz Yapan İlkeler</h3>
                            </div>

                            <div className="ab-values-grid">
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }} aria-hidden>🔐</div>
                                    <h4>Güvenlik & Gizlilik</h4>
                                    <p>Verileriniz 256-bit SSL şifreleme, 2FA ve KVKK uyumlu altyapı ile korunur. Güvenlik bizim için taviz verilmez bir önceliktir.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }} aria-hidden>⚡</div>
                                    <h4>Hız & Performans</h4>
                                    <p>Gerçek zamanlı senkronizasyon, milisaniye düzeyinde yanıt süreleri. İşlemleriniz anında tüm pazaryerlerine yansır.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} aria-hidden>💡</div>
                                    <h4>Sürekli İnovasyon</h4>
                                    <p>Her hafta yeni özellikler, her ay büyük güncellemeler. Kullanıcı geri bildirimlerini dinler, hızla hayata geçiririz.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }} aria-hidden>💬</div>
                                    <h4>Müşteri Odaklılık</h4>
                                    <p>7/24 destek, dedicated hesap yöneticileri ve kişiselleştirilmiş onboarding. Başarınız bizim başarımızdır.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }} aria-hidden>📈</div>
                                    <h4>Ölçeklenebilirlik</h4>
                                    <p>10 ürünle başlayın, 100.000 ürüne kadar büyüyün. Altyapımız işinizle birlikte büyür, sizi asla yavaşlatmaz.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }} aria-hidden>✨</div>
                                    <h4>Şeffaflık</h4>
                                    <p>Gizli ücret yok, sürpriz fatura yok. Fiyatlandırmadan yol haritasına kadar her şey açık ve net.</p>
                                </div>
                            </div>

                            {/*  TEKNOLOJİ ALTYAPISI  */}
                            <div className="ab-tech-banner">
                                <div className="ab-tech-banner-glow" />
                                <div className="ab-tech-banner-content">
                                    <div className="ft-ai-badge"> TEKNOLOJİ ALTYAPIMIZ</div>
                                    <h3>Modern, Güvenilir & Ölçeklenebilir</h3>
                                    <p>En son teknolojilerle inşa edilmiş, kurumsal düzeyde güvenilir bir altyapı.</p>
                                    <div className="ab-tech-stack">
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon" aria-hidden>⚛️</div>
                                            <div>
                                                <strong>React.js</strong>
                                                <small>Modern & hızlı kullanıcı arayüzü</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon" aria-hidden>🟢</div>
                                            <div>
                                                <strong>Node.js</strong>
                                                <small>Yüksek performanslı backend</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon" aria-hidden>🍃</div>
                                            <div>
                                                <strong>MongoDB</strong>
                                                <small>Esnek & ölçeklenebilir veritabanı</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon" aria-hidden>☁️</div>
                                            <div>
                                                <strong>AWS Cloud</strong>
                                                <small>%99.9 uptime garantisi</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon" aria-hidden>🤖</div>
                                            <div>
                                                <strong>GPT-4 AI</strong>
                                                <small>Yapay zeka destekli analiz</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon" aria-hidden>🔒</div>
                                            <div>
                                                <strong>SSL & 2FA</strong>
                                                <small>Kurumsal güvenlik standartları</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*  RAKAMLARLA BİZ  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> RAKAMLARLA PazarYonet</div>
                                <h3 className="ft-section-title">Büyüyen Bir Ekosistem</h3>
                            </div>

                            <div className="ab-numbers-grid">
                                <div className="ab-number-card">
                                    <div className="ab-number-value">5+</div>
                                    <div className="ab-number-label">Pazaryeri<br/>Entegrasyonu</div>
                                    <div className="ab-number-desc">Trendyol, Hepsiburada, Amazon, N11, Çiçeksepeti</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">15+</div>
                                    <div className="ab-number-label">Modül &<br/>Araç</div>
                                    <div className="ab-number-desc">Stok, sipariş, finans, AI, radar, kargo ve daha fazlası</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">50K+</div>
                                    <div className="ab-number-label">Yönetilen<br/>Ürün</div>
                                    <div className="ab-number-desc">Platformumuz üzerinden yönetilen toplam ürün sayısı</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">99.9%</div>
                                    <div className="ab-number-label">Uptime<br/>Garantisi</div>
                                    <div className="ab-number-desc">AWS altyapısı ile kesintisiz hizmet</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">7/24</div>
                                    <div className="ab-number-label">Teknik<br/>Destek</div>
                                    <div className="ab-number-desc">Canlı destek, e-posta ve bilgi bankası</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">2024</div>
                                    <div className="ab-number-label">Kuruluş<br/>Yılı</div>
                                    <div className="ab-number-desc">Genç, dinamik ve hızla büyüyen bir ekip</div>
                                </div>
                            </div>

                            {/*  NEDEN PazarYonet?  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> NEDEN PazarYonet?</div>
                                <h3 className="ft-section-title">Farkımız Ne?</h3>
                            </div>

                            <div className="ab-why-grid">
                                <div className="ab-why-card">
                                    <div className="ab-why-number">01</div>
                                    <h4>Hepsi Bir Arada</h4>
                                    <p>Pazaryeri entegrasyonu, stok yönetimi, sipariş takibi, finans, kargo, AI analiz... Hepsi tek platformda. 10 farklı araç yerine sadece PazarYonet.</p>
                                </div>
                                <div className="ab-why-card">
                                    <div className="ab-why-number">02</div>
                                    <h4>Yapay Zeka Gücü</h4>
                                    <p>PazarYonet AI ve PazarYonet Radar ile rakiplerinizi analiz edin, trendleri önceden görün, fırsatları yakalayın. AI sizin için çalışsın.</p>
                                </div>
                                <div className="ab-why-card">
                                    <div className="ab-why-number">03</div>
                                    <h4>Kolay Kullanım</h4>
                                    <p>Sezgisel arayüz, sürükle-bırak işlemler, akıllı kısayollar. Teknik bilgi gerektirmez, 5 dakikada kullanmaya başlayın.</p>
                                </div>
                                <div className="ab-why-card">
                                    <div className="ab-why-number">04</div>
                                    <h4>Türkiye'ye Özel</h4>
                                    <p>Türk pazaryerlerine tam uyumlu, TL bazlı fiyatlandırma, Türkçe destek, KVKK uyumlu. Yerel ihtiyaçları bilen bir platform.</p>
                                </div>
                            </div>

                            {/*  YOLCULUK / TIMELINE  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> YOLCULUĞUMUZ</div>
                                <h3 className="ft-section-title">Nereden Nereye</h3>
                            </div>

                            <div className="ab-timeline">
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q1</div>
                                        <h4>Fikir & Araştırma</h4>
                                        <p>E-ticaret satıcılarının ihtiyaçları analiz edildi, pazar araştırması yapıldı, teknik altyapı planlandı.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot ab-timeline-dot--active" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q2</div>
                                        <h4>MVP Geliştirme</h4>
                                        <p>Temel pazaryeri entegrasyonları, ürün yönetimi ve sipariş takibi modülleri geliştirildi.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot ab-timeline-dot--active" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q3</div>
                                        <h4>AI Entegrasyonu</h4>
                                        <p>PazarYonet AI asistanı, PazarYonet Radar fırsat motoru ve gelişmiş analitik modülleri eklendi.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q4</div>
                                        <h4>Tam Lansman</h4>
                                        <p>Finans modülü, kargo entegrasyonu, mobil PWA desteği ve kurumsal paketlerle tam lansman.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2025+</div>
                                        <h4>Global Büyüme</h4>
                                        <p>Uluslararası pazaryeri entegrasyonları, çoklu dil desteği ve bölgesel genişleme planları.</p>
                                    </div>
                                </div>
                            </div>

                            {/*  İLETİŞİM  */}
                            <div className="ab-contact-banner">
                                <div className="ab-contact-glow" />
                                <div className="ab-contact-content">
                                    <h3>Bizimle İletişime Geçin</h3>
                                    <p>Sorularınız mı var? Ekibimiz size yardımcı olmaktan mutluluk duyar.</p>
                                    <div className="ab-contact-grid">
                                        <div className="ab-contact-item">
                                            <span aria-hidden>✉️</span>
                                            <div>
                                                <strong>E-posta</strong>
                                                <small>{BRAND_EMAIL}</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>💬</span>
                                            <div>
                                                <strong>Canlı Destek</strong>
                                                <small>7/24 anlık yardım</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>📍</span>
                                            <div>
                                                <strong>Konum</strong>
                                                <small>İstanbul, Türkiye</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>🔗</span>
                                            <div>
                                                <strong>Sosyal Medya</strong>
                                                <small>@PazarYonet</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*  CTA  */}
                            <div className="ft-cta">
                                <h3>Hemen Başlayın - 14 Gün Ücretsiz Deneyin</h3>
                                <p>Kredi kartı gerekmez. Tüm özelliklere tam erişim. İstediğiniz zaman iptal edin.</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("home")}>
                                    Ücretsiz Kayıt Ol 
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "blog" && (
                        <div className="auth-tab-content auth-tab-fullpage auth-tab-blog">
                            <MarketplaceBlogSection />
                        </div>
                    )}

                    {activeTab === "contact" && (
                        <div className="auth-tab-content auth-tab-fullpage">
                            <div className="ft-hero">
                                <span className="ft-hero-badge">İletişim</span>
                                <h2 className="ft-hero-title">
                                    Bize<br />
                                    <span className="ft-gradient-text">Ulaşın</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    Sorularınız ve iş birliği talepleriniz için iletişim bilgilerimiz aşağıdadır.
                                </p>
                            </div>

                            <div className="ab-contact-banner" style={{ marginTop: "32px" }}>
                                <div className="ab-contact-glow" />
                                <div className="ab-contact-content">
                                    <h3>İletişim bilgileri</h3>
                                    <div className="ab-contact-grid">
                                        <div className="ab-contact-item">
                                            <span aria-hidden>📞</span>
                                            <div>
                                                <strong>Telefon</strong>
                                                <small>{LOGIN_PAGE_CONTACT.phone || "—"}</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>✉️</span>
                                            <div>
                                                <strong>E-posta</strong>
                                                <small>{LOGIN_PAGE_CONTACT.email || "—"}</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>📍</span>
                                            <div>
                                                <strong>Adres</strong>
                                                <small>{LOGIN_PAGE_CONTACT.address || "—"}</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>🕐</span>
                                            <div>
                                                <strong>Çalışma saatleri</strong>
                                                <small>{LOGIN_PAGE_CONTACT.workingHours || "—"}</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span aria-hidden>💬</span>
                                            <div>
                                                <strong>WhatsApp</strong>
                                                <small>{LOGIN_PAGE_CONTACT.whatsapp || "—"}</small>
                                            </div>
                                        </div>
                                    </div>
                                    {LOGIN_PAGE_CONTACT.note ? (
                                        <p className="ft-hero-desc" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
                                            {LOGIN_PAGE_CONTACT.note}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="ft-cta">
                                <h3>Girişe dönmek ister misiniz?</h3>
                                <p>Hesabınızla devam etmek için ana giriş ekranına geçin.</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("home")}>
                                    Giriş sayfasına dön
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab !== "features" && activeTab !== "pricing" && activeTab !== "about" && activeTab !== "contact" && (
                    <div className="auth-form-panel auth-fade-in-delay">
                        {forgotMode ? renderForgotForm() : renderLoginForm()}
                    </div>
                )}
            </div>

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


