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

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

/* 
    FIX E6: AuthNavbar, DashboardMockup, PlantDecoration, GoogleIcon
   artk ./auth/ klasrnden import ediliyor (duplicate kod kaldrld)
    */

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
                console.warn("LoginForm: Plan fiyatlar yklenemedi, fallback kullanlyor");
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

    // ifremi unuttum
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
            if (data?.needsVerification) {
                setNeedsVerification(true);
                setMessage({ text: data.message, type: "warning" });
            } else {
                setMessage({ text: data?.message || "Bir hata olutu.", type: "error" });
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
                text: error.response?.data?.message || "Google ile giri yaplamad.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => setMessage({ text: "Google ile giri baarsz.", type: "error" }),
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
                text: error.response?.data?.message || "Bir hata olutu.",
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
                text: error.response?.data?.message || "ifre sfrlama baarsz.",
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
                {/* Email */}
                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaEnvelope className="auth-input-icon" />
                        <input className="auth-input" type="email" name="email" placeholder={t("auth.emailPlaceholder")} value={formData.email} onChange={handleChange} required autoComplete="email" disabled={isLoading} />
                    </div>
                </div>

                {/* Password */}
                <div className="auth-field">
                    <div className="auth-input-wrap">
                        <FaLock className="auth-input-icon" />
                        <input className="auth-input" type={showPassword ? "text" : "password"} name="password" placeholder={t("auth.passwordPlaceholder")} value={formData.password} onChange={handleChange} required autoComplete="current-password" disabled={isLoading} />
                        <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                {/* Remember & Forgot */}
                <div className="auth-options-row">
                    <label className="auth-remember" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`auth-checkbox ${rememberMe ? "checked" : ""}`}><FaCheck /></div>
                        <span className="auth-remember-text">{t("auth.rememberMe")}</span>
                    </label>
                    <button type="button" className="auth-forgot" onClick={() => { setForgotMode("email"); setMessage({ text: "", type: "" }); }}>
                        {t("auth.forgotPassword")}
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

                {/* Submit */}
                <button type="submit" className="auth-submit" disabled={isLoading}>
                    {isLoading ? <div className="auth-spinner" /> : <>{t("auth.loginBtn")} <FaArrowRight className="auth-arrow" /></>}
                </button>
            </form>

            {/* Divider */}
            <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">{t("auth.orDivider")}</span>
                <div className="auth-divider-line" />
            </div>

            {/* Google Button  full width (grseldeki gibi) */}
            <button className="auth-google-btn" type="button" onClick={() => googleLogin()} disabled={isLoading}>
                <GoogleIcon />
                {t("auth.googleContinue")}
            </button>

            {/* Switch */}
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
            {/* Glow lines  grseldeki st ksmdaki k izgileri */}
            <div className="auth-glow-lines" />

            {/* Navbar with Tab System */}
            <AuthNavbar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Main Content */}
            <div className={`auth-main${activeTab === "features" || activeTab === "pricing" || activeTab === "about" ? " auth-main--fullpage" : ""}`}>
                {/* Sol  Tab Content */}
                <div className={`auth-hero auth-fade-in${activeTab === "features" || activeTab === "pricing" || activeTab === "about" ? " auth-hero--fullpage" : ""}`}>
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
                                <span className="ft-hero-badge"> Trkiye'nin En Kapsaml E-Ticaret Platformu</span>
                                <h2 className="ft-hero-title">
                                    Tm E-Ticaret Operasyonlarnz<br />
                                    <span className="ft-gradient-text">Tek Bir Platformda</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    Pazaryeri entegrasyonundan yapay zeka destekli analize, stok ynetiminden kargo takibine kadar
                                    ihtiyacnz olan her ey Pazarynetim'de. Artk 10 farkl ara kullanmanza gerek yok.
                                </p>
                            </div>

                            {/*  ANA ZELLKLER  3'l Grid  */}
                            <div className="ft-section">
                                <div className="ft-section-label"> ANA ZELLKLER</div>
                                <h3 className="ft-section-title">inizi Byten Gl Aralar</h3>
                            </div>

                            <div className="ft-main-grid">
                                <div className="ft-main-card ft-main-card--highlight">
                                    <div className="ft-main-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }}></div>
                                    <h4>oklu Pazaryeri Entegrasyonu</h4>
                                    <p>Trendyol, Hepsiburada, Amazon, N11, ieksepeti ve daha fazlas  tm pazaryerlerini tek panelden ynetin. rn listeleme, fiyat gncelleme, sipari takibi hepsi tek ekranda.</p>
                                    <div className="ft-main-tags">
                                        <span className="ft-tag" style={{ color: "#f27a1a" }}>Trendyol</span>
                                        <span className="ft-tag" style={{ color: "#ff6000" }}>Hepsiburada</span>
                                        <span className="ft-tag" style={{ color: "#ff9900" }}>Amazon</span>
                                        <span className="ft-tag" style={{ color: "#7c5cfc" }}>N11</span>
                                        <span className="ft-tag" style={{ color: "#e91e8c" }}>ieksepeti</span>
                                    </div>
                                </div>

                                <div className="ft-main-card">
                                    <div className="ft-main-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}></div>
                                    <h4>Akll Stok & rn Ynetimi</h4>
                                    <p>Tm pazaryerlerinde stok senkronizasyonu, toplu rn ykleme, varyant ynetimi ve otomatik fiyat gncelleme. Bir yerde satlan rn annda dier pazaryerlerinde gncellenir.</p>
                                    <div className="ft-main-tags">
                                        <span className="ft-tag" style={{ color: "#22c55e" }}>Otomatik Senkron</span>
                                        <span className="ft-tag" style={{ color: "#16a34a" }}>Toplu Ykleme</span>
                                        <span className="ft-tag" style={{ color: "#10b981" }}>Varyant</span>
                                    </div>
                                </div>

                                <div className="ft-main-card">
                                    <div className="ft-main-icon" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}></div>
                                    <h4>LysiaBrain  Yapay Zeka Asistan</h4>
                                    <p>GPT-4 destekli AI asistannz. rn aklamas yazma, SEO optimizasyonu, fiyat nerisi, rakip analizi ve sat stratejisi  hepsini yapay zeka ile yapn.</p>
                                    <div className="ft-main-tags">
                                        <span className="ft-tag" style={{ color: "#8b5cf6" }}>GPT-4</span>
                                        <span className="ft-tag" style={{ color: "#a78bfa" }}>SEO</span>
                                        <span className="ft-tag" style={{ color: "#7c3aed" }}>Strateji</span>
                                    </div>
                                </div>
                            </div>

                            {/*  DETAYLI ZELLKLER  2'li Grid  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> DETAYLI ZELLKLER</div>
                                <h3 className="ft-section-title">Her htiyacnz in Bir zm</h3>
                            </div>

                            <div className="ft-detail-grid">
                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon"></div>
                                    <div className="ft-detail-body">
                                        <h4>Gelimi Analitik & Raporlama</h4>
                                        <p>Sat trendleri, gelir analizi, rn performans, pazaryeri karlatrmas  tm verilerinizi grselletirin. Gerek zamanl dashboard ile anlk kararlar aln.</p>
                                        <ul className="ft-detail-list">
                                            <li>Gerek zamanl sat dashboard'u</li>
                                            <li>Pazaryeri bazl performans karlatrmas</li>
                                            <li>rn bazl krllk analizi</li>
                                            <li>zelletirilebilir raporlar & Excel export</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon"></div>
                                    <div className="ft-detail-body">
                                        <h4>LysiaRadar PRO  Frsat Motoru</h4>
                                        <p>Yapay zeka ile pazaryerlerini tarayarak yksek kr potansiyelli rnleri kefedin. Rakip analizi, talep tahmini ve fiyat optimizasyonu tek tula.</p>
                                        <ul className="ft-detail-list">
                                            <li>AI destekli rn frsat kefi</li>
                                            <li>Kategori bazl pazar analizi</li>
                                            <li>Krllk skoru & talep tahmini</li>
                                            <li>Rakip fiyat takibi & uyarlar</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon"></div>
                                    <div className="ft-detail-body">
                                        <h4>Finans & Muhasebe Ynetimi</h4>
                                        <p>Gelir-gider takibi, komisyon hesaplama, kr-zarar analizi ve e-fatura entegrasyonu. Finansal durumunuzu her an kontrol altnda tutun.</p>
                                        <ul className="ft-detail-list">
                                            <li>Otomatik komisyon hesaplama</li>
                                            <li>Gelir-gider & kr-zarar raporlar</li>
                                            <li>E-fatura entegrasyonu (QNB, Sovos, Parat)</li>
                                            <li>Vergi hesaplama & KDV takibi</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon"></div>
                                    <div className="ft-detail-body">
                                        <h4>Sipari & Kargo Takibi</h4>
                                        <p>Tm pazaryerlerinden gelen siparileri tek ekranda ynetin. Kargo firmalaryla entegrasyon, otomatik etiket basm ve teslimat takibi.</p>
                                        <ul className="ft-detail-list">
                                            <li>oklu pazaryeri sipari birletirme</li>
                                            <li>Aras, Yurtii, MNG, Srat entegrasyonu</li>
                                            <li>Otomatik kargo etiketi oluturma</li>
                                            <li>Teslimat durumu & mteri bildirimi</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon"></div>
                                    <div className="ft-detail-body">
                                        <h4>Kategori Merkezi & Eletirme</h4>
                                        <p>Pazaryeri kategori aalarn kefedin, rnlerinizi doru kategorilere eletirin. Zorunlu zellik alanlarn otomatik doldurun.</p>
                                        <ul className="ft-detail-list">
                                            <li>Pazaryeri kategori aac grntleme</li>
                                            <li>Akll kategori eletirme nerileri</li>
                                            <li>Zorunlu zellik alan ynetimi</li>
                                            <li>Toplu kategori gncelleme</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="ft-detail-card">
                                    <div className="ft-detail-icon"></div>
                                    <div className="ft-detail-body">
                                        <h4>Fiyat Senkronizasyonu & Optimizasyon</h4>
                                        <p>Tm pazaryerlerinde fiyatlarnz tek tula gncelleyin. Komisyon bazl fiyat hesaplama, rakip fiyat takibi ve otomatik fiyat kurallar.</p>
                                        <ul className="ft-detail-list">
                                            <li>Pazaryeri komisyon bazl fiyatlama</li>
                                            <li>Toplu fiyat gncelleme</li>
                                            <li>Rakip fiyat takibi & uyar</li>
                                            <li>Dinamik fiyat kurallar</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/*  ROKETFY & AI BLM  */}
                            <div className="ft-ai-banner">
                                <div className="ft-ai-banner-glow" />
                                <div className="ft-ai-banner-content">
                                    <div className="ft-ai-badge"> YAPAY ZEKA DESTEKL</div>
                                    <h3>Rakiplerinizin Bir Adm nnde Olun</h3>
                                    <p>LysiaBrain AI ve LysiaRadar PRO ile pazaryerlerindeki trendleri analiz edin, yksek krl rnleri kefedin ve sat stratejinizi optimize edin. Yapay zeka sizin iin alsn.</p>
                                    <div className="ft-ai-features">
                                        <div className="ft-ai-feat">
                                            <span></span>
                                            <div>
                                                <strong>Pazar Analizi</strong>
                                                <small>Kategori bazl talep & rekabet analizi</small>
                                            </div>
                                        </div>
                                        <div className="ft-ai-feat">
                                            <span></span>
                                            <div>
                                                <strong>Trend Tahmini</strong>
                                                <small>AI ile gelecek trendleri nceden grn</small>
                                            </div>
                                        </div>
                                        <div className="ft-ai-feat">
                                            <span></span>
                                            <div>
                                                <strong>erik retimi</strong>
                                                <small>SEO uyumlu rn aklamas & balk</small>
                                            </div>
                                        </div>
                                        <div className="ft-ai-feat">
                                            <span></span>
                                            <div>
                                                <strong>Strateji nerisi</strong>
                                                <small>Kiiselletirilmi sat stratejileri</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*  TEKNOLOJ STACK  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> TEKNOLOJ</div>
                                <h3 className="ft-section-title">Gvenilir & Modern Altyap</h3>
                            </div>

                            <div className="ft-tech-grid">
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon"></div>
                                    <h5>AWS Cloud</h5>
                                    <p>Amazon Web Services zerinde %99.9 uptime garantisi</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon"></div>
                                    <h5>SSL & 2FA</h5>
                                    <p>256-bit ifreleme ve iki faktrl kimlik dorulama</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon"></div>
                                    <h5>Gerek Zamanl</h5>
                                    <p>Anlk stok & sipari senkronizasyonu</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon"></div>
                                    <h5>PWA Destei</h5>
                                    <p>Mobil uygulama gibi alan web deneyimi</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon"></div>
                                    <h5>API Entegrasyonu</h5>
                                    <p>RESTful API ile kendi sistemlerinize balayn</p>
                                </div>
                                <div className="ft-tech-item">
                                    <div className="ft-tech-icon"></div>
                                    <h5>oklu Dil</h5>
                                    <p>Trke & ngilizce tam dil destei</p>
                                </div>
                            </div>

                            {/*  STATSTKLER  */}
                            <div className="ft-stats-banner">
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">5+</div>
                                    <div className="ft-stat-big-label">Pazaryeri<br/>Entegrasyonu</div>
                                </div>
                                <div className="ft-stat-divider" />
                                <div className="ft-stat-big">
                                    <div className="ft-stat-big-value">50K+</div>
                                    <div className="ft-stat-big-label">Ynetilen<br/>rn</div>
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
                                    <div className="ft-stat-big-label">Modl &<br/>Ara</div>
                                </div>
                            </div>

                            {/*  CTA  */}
                            <div className="ft-cta">
                                <h3>Hemen Balayn  14 Gn cretsiz Deneyin</h3>
                                <p>Kredi kart gerekmez. Tm zelliklere tam eriim.</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("pricing")}>
                                    Paketleri ncele 
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "pricing" && (
                        <div className="auth-tab-content auth-tab-fullpage">
                            {/*  HERO  */}
                            <div className="ft-hero">
                                <span className="ft-hero-badge"> effaf & Uygun Fiyatlandrma</span>
                                <h2 className="ft-hero-title">
                                    letmenizin Byklne<br />
                                    <span className="ft-gradient-text">Uygun Paketler</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    Gizli cret yok, srpriz fatura yok. htiyacnza gre paket sein,
                                    istediiniz zaman ykseltin veya iptal edin. Tm paketlerde 14 gn cretsiz deneme.
                                </p>
                            </div>

                            {/*  PAKETLER  */}
                            <div className="pr-grid">
                                {/*  STARTER  */}
                                <div className="pr-card">
                                    <div className="pr-card-header">
                                        <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}></div>
                                        <h3 className="pr-card-name">Starter</h3>
                                        <p className="pr-card-desc">E-ticarete yeni balayanlar iin ideal balang paketi</p>
                                        <div className="pr-card-price">
                                            <span className="pr-price-amount">cretsiz</span>
                                            <span className="pr-price-period">14 gn deneme</span>
                                        </div>
                                        <div className="pr-card-after">Sonrasnda <strong>{prices.basic.monthly}/ay</strong></div>
                                    </div>
                                    <div className="pr-card-body">
                                        <div className="pr-section-label">Pazaryeri & rn</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 2 pazaryeri entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 500 rn limiti</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 2.000 sipari / ay</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Manuel stok gncelleme</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Temel rn ykleme</li>
                                        </ul>
                                        <div className="pr-section-label">Analitik & Raporlama</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Temel sat dashboard'u</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gnlk sat raporu</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Gelimi analitik</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Excel / PDF export</li>
                                        </ul>
                                        <div className="pr-section-label">AI & Aralar</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-no"><span className="pr-x"></span> LysiaBrain AI Asistan</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> LysiaRadar PRO</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Fiyat optimizasyonu</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> E-fatura entegrasyonu</li>
                                        </ul>
                                        <div className="pr-section-label">Destek</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> E-posta destei</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Bilgi bankas eriimi</li>
                                            <li className="pr-feat-no"><span className="pr-x"></span> Canl destek</li>
                                        </ul>
                                    </div>
                                    <button className="pr-card-btn pr-btn-outline" type="button" onClick={() => setActiveTab("home")}>
                                        cretsiz Dene
                                    </button>
                                </div>

                                {/*  PRO  */}
                                <div className="pr-card pr-card--popular">
                                    <div className="pr-popular-badge"> EN POPLER</div>
                                    <div className="pr-card-header">
                                        <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }}></div>
                                        <h3 className="pr-card-name">Pro</h3>
                                        <p className="pr-card-desc">Byyen iletmeler iin tam donanml profesyonel paket</p>
                                        <div className="pr-card-price">
                                            {prices.pro.oldMonthly && <span className="pr-price-old">{prices.pro.oldMonthly}</span>}
                                            <span className="pr-price-amount">{prices.pro.monthly}</span>
                                            <span className="pr-price-period">/ ay</span>
                                        </div>
                                        <div className="pr-card-save">Yllk demede {prices.pro.yearly}/ay  tasarruf edin</div>
                                    </div>
                                    <div className="pr-card-body">
                                        <div className="pr-section-label">Pazaryeri & rn</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>5 pazaryeri</strong> entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>10.000 rn</strong> limiti</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>50.000 sipari</strong> / ay</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Otomatik stok senkronizasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Toplu rn ykleme & gncelleme</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Varyant & kategori ynetimi</li>
                                        </ul>
                                        <div className="pr-section-label">Analitik & Raporlama</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gelimi sat dashboard'u</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Pazaryeri karlatrma raporu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> rn performans analizi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Excel & PDF export</li>
                                        </ul>
                                        <div className="pr-section-label">AI & Aralar</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>LysiaBrain AI</strong>  500 sorgu/ay</li>
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>LysiaRadar PRO</strong>  Frsat kefi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Fiyat optimizasyonu & kurallar</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> E-fatura entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Kargo takibi & etiket basm</li>
                                        </ul>
                                        <div className="pr-section-label">Destek</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> 7/24 canl destek</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> ncelikli e-posta destei</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Video eitim ierikleri</li>
                                        </ul>
                                    </div>
                                    <button className="pr-card-btn pr-btn-primary" type="button" onClick={() => setActiveTab("home")}>
                                        Pro'ya Bala 
                                    </button>
                                </div>

                                {/*  ENTERPRISE  */}
                                <div className="pr-card pr-card--enterprise">
                                    <div className="pr-card-header">
                                        <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}></div>
                                        <h3 className="pr-card-name">Enterprise</h3>
                                        <p className="pr-card-desc">Yksek hacimli satclar ve kurumsal firmalar iin snrsz paket</p>
                                        <div className="pr-card-price">
                                            <span className="pr-price-amount">{prices.enterprise.monthly}</span>
                                            <span className="pr-price-period">/ ay</span>
                                        </div>
                                        <div className="pr-card-save">Yllk demede {prices.enterprise.yearly}/ay  tasarruf edin</div>
                                    </div>
                                    <div className="pr-card-body">
                                        <div className="pr-section-label">Pazaryeri & rn</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>Snrsz</strong> pazaryeri entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>Snrsz</strong> rn</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> <strong>Snrsz</strong> sipari</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Otomatik stok senkronizasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Toplu rn ykleme & gncelleme</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gelimi varyant & kategori</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> zel API eriimi</li>
                                        </ul>
                                        <div className="pr-section-label">Analitik & Raporlama</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Pro'daki tm zellikler</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> zel rapor oluturma</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Otomatik rapor gnderimi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> oklu kullanc & rol ynetimi</li>
                                        </ul>
                                        <div className="pr-section-label">AI & Aralar</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>LysiaBrain AI</strong>  Snrsz sorgu</li>
                                            <li className="pr-feat-yes pr-feat-highlight"><span className="pr-check"></span> <strong>LysiaRadar PRO</strong>  Tam eriim</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Gelimi fiyat optimizasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> E-fatura & muhasebe entegrasyonu</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Kargo takibi & etiket basm</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Webhook & zel entegrasyonlar</li>
                                        </ul>
                                        <div className="pr-section-label">Destek</div>
                                        <ul className="pr-feature-list">
                                            <li className="pr-feat-yes"><span className="pr-check"></span> Dedicated hesap yneticisi</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> SLA garantisi (%99.9 uptime)</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> ncelikli teknik destek</li>
                                            <li className="pr-feat-yes"><span className="pr-check"></span> zel onboarding eitimi</li>
                                        </ul>
                                    </div>
                                    <button className="pr-card-btn pr-btn-gold" type="button" onClick={() => setActiveTab("home")}>
                                        letiime Ge 
                                    </button>
                                </div>
                            </div>

                            {/*  KARILATIRMA TABLOSU  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> KARILATIRMA</div>
                                <h3 className="ft-section-title">Paketleri Karlatrn</h3>
                            </div>

                            <div className="pr-compare">
                                <div className="pr-compare-row pr-compare-header">
                                    <div className="pr-compare-feature">zellik</div>
                                    <div className="pr-compare-val">Starter</div>
                                    <div className="pr-compare-val pr-compare-val--pop">Pro</div>
                                    <div className="pr-compare-val">Enterprise</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Pazaryeri Says</div>
                                    <div className="pr-compare-val">2</div>
                                    <div className="pr-compare-val pr-compare-val--pop">5</div>
                                    <div className="pr-compare-val">Snrsz</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">rn Limiti</div>
                                    <div className="pr-compare-val">500</div>
                                    <div className="pr-compare-val pr-compare-val--pop">10.000</div>
                                    <div className="pr-compare-val">Snrsz</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Sipari / Ay</div>
                                    <div className="pr-compare-val">2.000</div>
                                    <div className="pr-compare-val pr-compare-val--pop">50.000</div>
                                    <div className="pr-compare-val">Snrsz</div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">LysiaBrain AI</div>
                                    <div className="pr-compare-val"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val pr-compare-val--pop"><span className="pr-compare-yes">500/ay</span></div>
                                    <div className="pr-compare-val"><span className="pr-compare-yes">Snrsz</span></div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">LysiaRadar PRO</div>
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
                                    <div className="pr-compare-feature">API Eriimi</div>
                                    <div className="pr-compare-val"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val pr-compare-val--pop"><span className="pr-compare-no"></span></div>
                                    <div className="pr-compare-val"><span className="pr-compare-yes"></span></div>
                                </div>
                                <div className="pr-compare-row">
                                    <div className="pr-compare-feature">Destek</div>
                                    <div className="pr-compare-val">E-posta</div>
                                    <div className="pr-compare-val pr-compare-val--pop">7/24 Canl</div>
                                    <div className="pr-compare-val">Dedicated</div>
                                </div>
                            </div>

                            {/*  SSS  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> SIKA SORULAN SORULAR</div>
                                <h3 className="ft-section-title">Merak Edilenler</h3>
                            </div>

                            <div className="pr-faq">
                                <div className="pr-faq-item">
                                    <h4>cretsiz deneme nasl alr?</h4>
                                    <p>14 gn boyunca Pro paketinin tm zelliklerini cretsiz kullanabilirsiniz. Kredi kart bilgisi gerekmez. Deneme sresi bittiinde otomatik olarak Starter pakete geersiniz.</p>
                                </div>
                                <div className="pr-faq-item">
                                    <h4>stediim zaman paket deitirebilir miyim?</h4>
                                    <p>Evet! stediiniz zaman paketinizi ykseltebilir veya drebilirsiniz. Ykseltme annda aktif olur, drme ise mevcut dnem sonunda geerli olur.</p>
                                </div>
                                <div className="pr-faq-item">
                                    <h4>Yllk deme avantaj nedir?</h4>
                                    <p>Yllk deme tercih ettiinizde Pro pakette %37'ye varan, Enterprise pakette %20'ye varan tasarruf salarsnz. Yllk demeler iade edilebilir.</p>
                                </div>
                                <div className="pr-faq-item">
                                    <h4>Verilerim gvende mi?</h4>
                                    <p>Tm verileriniz AWS altyapsnda 256-bit SSL ifreleme ile korunur. KVKK uyumlu veri ileme politikamz mevcuttur. Dzenli yedekleme yaplr.</p>
                                </div>
                            </div>

                            {/*  CTA  */}
                            <div className="ft-cta">
                                <h3>14 Gn cretsiz Deneyin</h3>
                                <p>Kredi kart gerekmez  stediiniz zaman iptal edin  Tm Pro zellikler dahil</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("home")}>
                                    Hemen Kayt Ol 
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "about" && (
                        <div className="auth-tab-content auth-tab-fullpage">
                            {/*  HERO SECTION  */}
                            <div className="ft-hero">
                                <span className="ft-hero-badge"> Pazarynetim Hakknda</span>
                                <h2 className="ft-hero-title">
                                    E-Ticaretin Geleceini<br />
                                    <span className="ft-gradient-text">Birlikte na Ediyoruz</span>
                                </h2>
                                <p className="ft-hero-desc">
                                    Pazarynetim, Trkiye'nin en kapsaml e-ticaret ynetim platformudur. Yapay zeka destekli
                                    aralarmzla binlerce satcnn iini bytmesine yardmc oluyoruz.
                                </p>
                            </div>

                            {/*  HKAYEMZ  */}
                            <div className="ab-story">
                                <div className="ab-story-glow" />
                                <div className="ab-story-content">
                                    <div className="ab-story-badge"> HKAYEMZ</div>
                                    <h3>Bir Vizyondan Dodu</h3>
                                    <p>
                                        E-ticaret satclarnn her gn onlarca farkl ara, panel ve platform arasnda
                                        kaybolduunu grdk. Stok takibi bir yerde, sipari ynetimi baka yerde, fiyatlandrma
                                        ayr bir yerde... Bu karmaay ortadan kaldrmak iin yola ktk.
                                    </p>
                                    <p>
                                        Pazarynetim, tm e-ticaret operasyonlarn tek bir at altnda toplayan, yapay zeka
                                        ile glendirilmi, kullanc dostu bir platform olarak dodu. Amacmz basit:
                                        <strong> Satclarn teknik detaylarla deil, ilerini bytmeyle ilgilenmesini salamak.</strong>
                                    </p>
                                </div>
                            </div>

                            {/*  MSYON & VZYON  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> MSYON & VZYON</div>
                                <h3 className="ft-section-title">Neden Varz?</h3>
                            </div>

                            <div className="ab-mv-grid">
                                <div className="ab-mv-card ab-mv-card--mission">
                                    <div className="ab-mv-icon"></div>
                                    <h4>Misyonumuz</h4>
                                    <p>
                                        E-ticaret iletmelerinin tm operasyonlarn tek bir platformdan ynetmelerini salayarak,
                                        satclarn verimliliini artrmak ve bymelerini hzlandrmak. Her lekteki iletmeye
                                        kurumsal dzeyde aralar sunmak.
                                    </p>
                                    <div className="ab-mv-highlights">
                                        <span> Tek platform, snrsz imkan</span>
                                        <span> Her lee uygun zm</span>
                                        <span> Satc odakl gelitirme</span>
                                    </div>
                                </div>
                                <div className="ab-mv-card ab-mv-card--vision">
                                    <div className="ab-mv-icon"></div>
                                    <h4>Vizyonumuz</h4>
                                    <p>
                                        Trkiye'nin ve blgenin en kapsaml e-ticaret ynetim platformu olmak. Yapay zeka
                                        destekli zmlerle satclarn rakiplerinin bir adm nnde olmasn salamak
                                        ve e-ticaret ekosistemini dntrmek.
                                    </p>
                                    <div className="ab-mv-highlights">
                                        <span> AI-first yaklam</span>
                                        <span> Global lekte byme</span>
                                        <span> Ekosistem dnm</span>
                                    </div>
                                </div>
                            </div>

                            {/*  DEERLER  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> DEERLERMZ</div>
                                <h3 className="ft-section-title">Bizi Biz Yapan lkeler</h3>
                            </div>

                            <div className="ab-values-grid">
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }}></div>
                                    <h4>Gvenlik & Gizlilik</h4>
                                    <p>Verileriniz 256-bit SSL ifreleme, 2FA ve KVKK uyumlu altyap ile korunur. Gvenlik bizim iin taviz verilmez bir nceliktir.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}></div>
                                    <h4>Hz & Performans</h4>
                                    <p>Gerek zamanl senkronizasyon, milisaniye dzeyinde yant sreleri. lemleriniz annda tm pazaryerlerine yansr.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}></div>
                                    <h4>Srekli novasyon</h4>
                                    <p>Her hafta yeni zellikler, her ay byk gncellemeler. Kullanc geri bildirimlerini dinler, hzla hayata geiririz.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }}></div>
                                    <h4>Mteri Odakllk</h4>
                                    <p>7/24 destek, dedicated hesap yneticileri ve kiiselletirilmi onboarding. Baarnz bizim baarmzdr.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}></div>
                                    <h4>leklenebilirlik</h4>
                                    <p>10 rnle balayn, 100.000 rne kadar byyn. Altyapmz iinizle birlikte byr, sizi asla yavalatmaz.</p>
                                </div>
                                <div className="ab-value-card">
                                    <div className="ab-value-icon" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}></div>
                                    <h4>effaflk</h4>
                                    <p>Gizli cret yok, srpriz fatura yok. Fiyatlandrmadan yol haritasna kadar her ey ak ve net.</p>
                                </div>
                            </div>

                            {/*  TEKNOLOJ ALTYAPISI  */}
                            <div className="ab-tech-banner">
                                <div className="ab-tech-banner-glow" />
                                <div className="ab-tech-banner-content">
                                    <div className="ft-ai-badge"> TEKNOLOJ ALTYAPIMIZ</div>
                                    <h3>Modern, Gvenilir & leklenebilir</h3>
                                    <p>En son teknolojilerle ina edilmi, kurumsal dzeyde gvenilir bir altyap.</p>
                                    <div className="ab-tech-stack">
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon"></div>
                                            <div>
                                                <strong>React.js</strong>
                                                <small>Modern & hzl kullanc arayz</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon"></div>
                                            <div>
                                                <strong>Node.js</strong>
                                                <small>Yksek performansl backend</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon"></div>
                                            <div>
                                                <strong>MongoDB</strong>
                                                <small>Esnek & leklenebilir veritaban</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon"></div>
                                            <div>
                                                <strong>AWS Cloud</strong>
                                                <small>%99.9 uptime garantisi</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon"></div>
                                            <div>
                                                <strong>GPT-4 AI</strong>
                                                <small>Yapay zeka destekli analiz</small>
                                            </div>
                                        </div>
                                        <div className="ab-tech-item">
                                            <div className="ab-tech-item-icon"></div>
                                            <div>
                                                <strong>SSL & 2FA</strong>
                                                <small>Kurumsal gvenlik standartlar</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*  RAKAMLARLA BZ  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> RAKAMLARLA Pazarynetim</div>
                                <h3 className="ft-section-title">Byyen Bir Ekosistem</h3>
                            </div>

                            <div className="ab-numbers-grid">
                                <div className="ab-number-card">
                                    <div className="ab-number-value">5+</div>
                                    <div className="ab-number-label">Pazaryeri<br/>Entegrasyonu</div>
                                    <div className="ab-number-desc">Trendyol, Hepsiburada, Amazon, N11, ieksepeti</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">15+</div>
                                    <div className="ab-number-label">Modl &<br/>Ara</div>
                                    <div className="ab-number-desc">Stok, sipari, finans, AI, radar, kargo ve daha fazlas</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">50K+</div>
                                    <div className="ab-number-label">Ynetilen<br/>rn</div>
                                    <div className="ab-number-desc">Platformumuz zerinden ynetilen toplam rn says</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">99.9%</div>
                                    <div className="ab-number-label">Uptime<br/>Garantisi</div>
                                    <div className="ab-number-desc">AWS altyaps ile kesintisiz hizmet</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">7/24</div>
                                    <div className="ab-number-label">Teknik<br/>Destek</div>
                                    <div className="ab-number-desc">Canl destek, e-posta ve bilgi bankas</div>
                                </div>
                                <div className="ab-number-card">
                                    <div className="ab-number-value">2024</div>
                                    <div className="ab-number-label">Kurulu<br/>Yl</div>
                                    <div className="ab-number-desc">Gen, dinamik ve hzla byyen bir ekip</div>
                                </div>
                            </div>

                            {/*  NEDEN Pazarynetim?  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> NEDEN Pazarynetim?</div>
                                <h3 className="ft-section-title">Farkmz Ne?</h3>
                            </div>

                            <div className="ab-why-grid">
                                <div className="ab-why-card">
                                    <div className="ab-why-number">01</div>
                                    <h4>Hepsi Bir Arada</h4>
                                    <p>Pazaryeri entegrasyonu, stok ynetimi, sipari takibi, finans, kargo, AI analiz  hepsi tek platformda. 10 farkl ara yerine sadece Pazarynetim.</p>
                                </div>
                                <div className="ab-why-card">
                                    <div className="ab-why-number">02</div>
                                    <h4>Yapay Zeka Gc</h4>
                                    <p>LysiaBrain AI ve LysiaRadar PRO ile rakiplerinizi analiz edin, trendleri nceden grn, frsatlar yakalayn. AI sizin iin alsn.</p>
                                </div>
                                <div className="ab-why-card">
                                    <div className="ab-why-number">03</div>
                                    <h4>Kolay Kullanm</h4>
                                    <p>Sezgisel arayz, srkle-brak ilemler, akll ksayollar. Teknik bilgi gerektirmez, 5 dakikada kullanmaya balayn.</p>
                                </div>
                                <div className="ab-why-card">
                                    <div className="ab-why-number">04</div>
                                    <h4>Trkiye'ye zel</h4>
                                    <p>Trk pazaryerlerine tam uyumlu, TL bazl fiyatlandrma, Trke destek, KVKK uyumlu. Yerel ihtiyalar bilen bir platform.</p>
                                </div>
                            </div>

                            {/*  YOLCULUK / TMELNE  */}
                            <div className="ft-section" style={{ marginTop: "48px" }}>
                                <div className="ft-section-label"> YOLCULUUMUZ</div>
                                <h3 className="ft-section-title">Nereden Nereye</h3>
                            </div>

                            <div className="ab-timeline">
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q1</div>
                                        <h4>Fikir & Aratrma</h4>
                                        <p>E-ticaret satclarnn ihtiyalar analiz edildi, pazar aratrmas yapld, teknik altyap planland.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot ab-timeline-dot--active" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q2</div>
                                        <h4>MVP Gelitirme</h4>
                                        <p>Temel pazaryeri entegrasyonlar, rn ynetimi ve sipari takibi modlleri gelitirildi.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot ab-timeline-dot--active" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q3</div>
                                        <h4>AI Entegrasyonu</h4>
                                        <p>LysiaBrain AI asistan, LysiaRadar PRO frsat motoru ve gelimi analitik modlleri eklendi.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2024 Q4</div>
                                        <h4>Tam Lansman</h4>
                                        <p>Finans modl, kargo entegrasyonu, mobil PWA destei ve kurumsal paketlerle tam lansman.</p>
                                    </div>
                                </div>
                                <div className="ab-timeline-item">
                                    <div className="ab-timeline-dot" />
                                    <div className="ab-timeline-content">
                                        <div className="ab-timeline-date">2025+</div>
                                        <h4>Global Byme</h4>
                                        <p>Uluslararas pazaryeri entegrasyonlar, oklu dil destei ve blgesel genileme planlar.</p>
                                    </div>
                                </div>
                            </div>

                            {/*  LETM  */}
                            <div className="ab-contact-banner">
                                <div className="ab-contact-glow" />
                                <div className="ab-contact-content">
                                    <h3>Bizimle letiime Gein</h3>
                                    <p>Sorularnz m var? Ekibimiz size yardmc olmaktan mutluluk duyar.</p>
                                    <div className="ab-contact-grid">
                                        <div className="ab-contact-item">
                                            <span></span>
                                            <div>
                                                <strong>E-posta</strong>
                                                <small>info@pazaryonetim.com</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span></span>
                                            <div>
                                                <strong>Canl Destek</strong>
                                                <small>7/24 anlk yardm</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span></span>
                                            <div>
                                                <strong>Konum</strong>
                                                <small>stanbul, Trkiye</small>
                                            </div>
                                        </div>
                                        <div className="ab-contact-item">
                                            <span></span>
                                            <div>
                                                <strong>Sosyal Medya</strong>
                                                <small>@pazaryonetim</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/*  CTA  */}
                            <div className="ft-cta">
                                <h3>Hemen Balayn  14 Gn cretsiz Deneyin</h3>
                                <p>Kredi kart gerekmez. Tm zelliklere tam eriim. stediiniz zaman iptal edin.</p>
                                <button className="ft-cta-btn" type="button" onClick={() => setActiveTab("home")}>
                                    cretsiz Kayt Ol 
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sa  Login Form (hidden on features/pricing/about tabs) */}
                {activeTab !== "features" && activeTab !== "pricing" && activeTab !== "about" && (
                    <div className="auth-form-panel auth-fade-in-delay">
                        {forgotMode ? renderForgotForm() : renderLoginForm()}
                    </div>
                )}
            </div>

            {/* Footer   FIX E6: Shared component */}
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


