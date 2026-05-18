/**
 * Giriş ekranı UI önizlemesi — tamamen kod/CSS, harici görsel yok.
 * /login-lunexetic — gerçek giriş: /login
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    FaHome,
    FaStar,
    FaTag,
    FaInfoCircle,
    FaEnvelope,
    FaLock,
    FaArrowRight,
    FaEye,
    FaEyeSlash,
} from "react-icons/fa";
import "../styles/LunexeticLoginPreview.css";

const GoogleIcon = () => (
    <svg className="lx-g-svg" viewBox="0 0 24 24" aria-hidden>
        <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.24 1.26-.95 2.33-2 3.05l3.23 2.5c1.88-1.73 2.96-4.28 2.96-7.3 0-.7-.06-1.37-.18-2.02H12z"
        />
        <path
            fill="#34A853"
            d="M5.5 14.13l-.82.63-2.44 1.9C3.92 19.26 7.64 22 12 22c3 0 5.52-.99 7.36-2.67l-3.23-2.5c-.9.6-2.05.96-3.13.96-2.4 0-4.44-1.62-5.16-3.8z"
        />
        <path
            fill="#4285F4"
            d="M2.24 6.32C1.46 7.9 1 9.65 1 11.5s.46 3.6 1.24 5.18l3.98-3.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.24 6.32z"
        />
        <path
            fill="#FBBC05"
            d="M12 5.38c1.35 0 2.57.46 3.52 1.38l2.64-2.64C16.45 2.45 14.38 1.5 12 1.5 7.64 1.5 3.92 4.24 2.24 6.32l3.98 3.09c.72-2.18 2.76-3.8 5.16-3.8z"
        />
    </svg>
);

const LunexeticLoginPreview = () => {
    const [showPass, setShowPass] = useState(false);

    return (
        <div className="lx-auth">
            <header className="lx-auth-header">
                <div className="lx-auth-header-inner">
                    <Link to="/home" className="lx-auth-logo">
                        <span className="lx-auth-logo-mark">P</span>
                        <span className="lx-auth-logo-text">PazarYonet</span>
                    </Link>
                    <nav className="lx-auth-nav" aria-label="Menü">
                        <a className="lx-active" href="#">
                            <FaHome aria-hidden />
                            <span className="lx-nav-txt">Ana sayfa</span>
                        </a>
                        <a href="#">
                            <FaStar aria-hidden />
                            <span className="lx-nav-txt">Özellikler</span>
                        </a>
                        <a href="#">
                            <FaTag aria-hidden />
                            <span className="lx-nav-txt">Fiyatlandırma</span>
                        </a>
                        <a href="#">
                            <FaInfoCircle aria-hidden />
                            <span className="lx-nav-txt">Hakkımızda</span>
                        </a>
                        <a href="#">
                            <FaEnvelope aria-hidden />
                            <span className="lx-nav-txt">İletişim</span>
                        </a>
                    </nav>
                    <div className="lx-auth-spacer" aria-hidden />
                </div>
            </header>

            <div className="lx-auth-body">
                <section className="lx-hero" aria-labelledby="lx-hero-title">
                    <div className="lx-hero-inner">
                        <h1 id="lx-hero-title">
                            İşinizi tek panelden yönetin, <span className="lx-gradient">büyütün.</span>
                        </h1>
                        <p>
                            Pazaryeri entegrasyonu, stok ve siparişleri tek yerden yönetin. Veriye dayalı kararlarla
                            operasyonunuzu hızlandırın.
                        </p>

                        <div className="lx-showcase">
                            <div className="lx-glow" aria-hidden />
                            <div className="lx-badges" aria-hidden>
                                <span className="lx-mp lx-mp-a">Trendyol</span>
                                <span className="lx-mp lx-mp-b">Hepsiburada</span>
                                <span className="lx-mp lx-mp-c">Amazon</span>
                                <span className="lx-mp lx-mp-d">n11</span>
                            </div>
                            <div className="lx-laptop-wrap">
                                <div className="lx-laptop">
                                    <div className="lx-screen">
                                        <div className="lx-screen-title">Satış grafiği</div>
                                        <div className="lx-chart">
                                            <div className="lx-chart-fill" />
                                        </div>
                                        <div className="lx-stats">
                                            <div className="lx-stat">
                                                <div className="lx-stat-l">Toplam sipariş</div>
                                                <div className="lx-stat-v">1.2K</div>
                                            </div>
                                            <div className="lx-stat">
                                                <div className="lx-stat-l">Toplam ciro</div>
                                                <div className="lx-stat-v">₺842K</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="lx-base" />
                                <div className="lx-phone">
                                    <div className="lx-phone-notch" />
                                    <div className="lx-phone-t">Siparişler</div>
                                    <div className="lx-phone-line" />
                                    <div className="lx-phone-line" />
                                    <div className="lx-phone-line" style={{ width: "72%" }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="lx-panel">
                    <div className="lx-card">
                        <h2>Giriş Yap</h2>
                        <p className="lx-card-sub">Hesabınıza hoş geldiniz.</p>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                            }}
                            noValidate
                        >
                            <div className="lx-field">
                                <FaEnvelope className="lx-field-ic" aria-hidden />
                                <input type="email" name="email" autoComplete="email" placeholder="E-posta adresiniz" />
                            </div>
                            <div className="lx-field lx-field-pass">
                                <FaLock className="lx-field-ic" aria-hidden />
                                <input
                                    type={showPass ? "text" : "password"}
                                    name="password"
                                    autoComplete="current-password"
                                    placeholder="Şifreniz"
                                />
                                <button
                                    type="button"
                                    className="lx-eye"
                                    onClick={() => setShowPass((v) => !v)}
                                    aria-label={showPass ? "Şifreyi gizle" : "Şifreyi göster"}
                                >
                                    {showPass ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>

                            <div className="lx-row">
                                <label className="lx-check">
                                    <input type="checkbox" name="remember" />
                                    Beni hatırla
                                </label>
                                <a className="lx-forgot" href="#">
                                    Şifremi unuttum?
                                </a>
                            </div>

                            <button type="submit" className="lx-btn">
                                Giriş Yap <FaArrowRight aria-hidden />
                            </button>
                        </form>

                        <div className="lx-or">veya</div>

                        <button type="button" className="lx-google">
                            <GoogleIcon /> Google ile devam et
                        </button>

                        <p className="lx-foot">
                            Hesabınız yok mu? <Link to="/register">Kayıt olun</Link> →
                        </p>
                    </div>
                </section>
            </div>

            <footer className="lx-page-foot">
                <span>© {new Date().getFullYear()} PazarYonet. Tüm hakları saklıdır.</span>
                <Link to="/privacy">Gizlilik Politikası</Link>
                <Link to="/terms">Kullanım Şartları</Link>
            </footer>
        </div>
    );
};

export default LunexeticLoginPreview;
