/**
 * DashboardMockup — Shared Auth Component
 * ✅ FIX E6: LoginForm ve RegisterForm'daki duplicate mockup tek dosyaya taşındı
 */
import React from "react";
import DashtockLogoMark from "../brand/DashtockLogoMark";

const DashboardMockup = ({ gradientId = "chartGrad" }) => (
    <div className="auth-hero-mockup">
        {/* Floating marketplace badges */}
        <div className="auth-float-badges">
            <div className="auth-float-badge auth-float-badge--trendyol">
                <span style={{ fontSize: 10, fontWeight: 800 }}>trendyol</span>
            </div>
            <div className="auth-float-badge auth-float-badge--hepsiburada">
                <span style={{ fontSize: 8, fontWeight: 700 }}>hepsi<br/>burada</span>
            </div>
            <div className="auth-float-badge auth-float-badge--amazon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff9900">
                    <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.222-.1.383-.04.456.18l.083.24c.074.22.01.38-.19.478-.533.257-1.222.544-2.066.86-2.228.84-4.578 1.26-7.046 1.26-4.627 0-8.728-1.233-12.3-3.7-.145-.1-.165-.22-.06-.36l.143-.2z"/>
                    <path d="M6.394 14.736c0-1.14.27-2.086.81-2.836.54-.75 1.26-1.24 2.16-1.47.78-.2 1.89-.3 3.33-.3l1.71.06v-.57c0-.72-.09-1.23-.27-1.53-.3-.48-.84-.72-1.62-.72h-.18c-.54.03-1.02.18-1.44.45-.42.27-.66.66-.72 1.17l-2.58-.36c.12-1.17.72-2.04 1.8-2.61.9-.48 1.95-.72 3.15-.72 1.5 0 2.61.36 3.33 1.08.54.54.81 1.41.81 2.61v4.89c0 .33.03.72.09 1.17.06.45.15.75.27.9l.18.21H14.79l-.27-.63-.12-.36c-.48.48-.99.84-1.53 1.08-.66.3-1.38.45-2.16.45-1.08 0-1.95-.33-2.61-.99-.66-.66-.99-1.5-.99-2.52zm3.12-.18c0 .54.15.96.45 1.26.3.3.69.45 1.17.45.6 0 1.14-.21 1.62-.63.48-.42.72-1.17.72-2.25v-.87l-1.38-.06c-1.08 0-1.8.18-2.16.54-.28.3-.42.84-.42 1.56z"/>
                </svg>
            </div>
            <div className="auth-float-badge auth-float-badge--n11">
                <span style={{ fontSize: 13, fontWeight: 900 }}>n11</span>
            </div>
        </div>

        {/* Laptop */}
        <div className="auth-mockup-laptop">
            <div className="auth-laptop-frame">
                <div className="auth-laptop-screen">
                    <div className="auth-dash-topbar">
                        <div className="auth-dash-dot auth-dash-dot--red" />
                        <div className="auth-dash-dot auth-dash-dot--yellow" />
                        <div className="auth-dash-dot auth-dash-dot--green" />
                        <div className="auth-dash-logo-mini">
                            <DashtockLogoMark size={18} />
                        </div>
                    </div>

                    <div className="auth-dash-stats">
                        <div className="auth-dash-stat">
                            <div className="auth-dash-stat-label">Toplam Sipariş</div>
                            <div className="auth-dash-stat-row">
                                <span className="auth-dash-stat-value">1,245</span>
                                <span className="auth-dash-stat-change">+12.5%</span>
                            </div>
                        </div>
                        <div className="auth-dash-stat">
                            <div className="auth-dash-stat-label">Toplam Ciro</div>
                            <div className="auth-dash-stat-row">
                                <span className="auth-dash-stat-value">₺125,430</span>
                                <span className="auth-dash-stat-change">+8.2%</span>
                            </div>
                        </div>
                    </div>

                    <div className="auth-dash-chart">
                        <div className="auth-dash-chart-title">Satış Grafiği</div>
                        <svg className="auth-dash-chart-svg" viewBox="0 0 400 80" fill="none">
                            <defs>
                                <linearGradient id={gradientId} x1="200" y1="0" x2="200" y2="80" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#7c5cfc" stopOpacity="0.3"/>
                                    <stop offset="100%" stopColor="#7c5cfc" stopOpacity="0"/>
                                </linearGradient>
                            </defs>
                            <path d="M0 60 Q40 55 80 50 T160 35 T240 25 T320 30 T400 20" stroke="#7c5cfc" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                            <path d={`M0 60 Q40 55 80 50 T160 35 T240 25 T320 30 T400 20 V80 H0 Z`} fill={`url(#${gradientId})`}/>
                            <circle cx="240" cy="25" r="4" fill="#7c5cfc" stroke="#fff" strokeWidth="2"/>
                        </svg>
                    </div>

                    <div className="auth-dash-integrations">
                        <div className="auth-dash-int-title">Entegrasyonlar</div>
                        <div className="auth-dash-int-row">
                            <div className="auth-dash-int-badge auth-dash-int-badge--trendyol">trendyol</div>
                            <div className="auth-dash-int-badge auth-dash-int-badge--hepsiburada">hepsiburada</div>
                            <div className="auth-dash-int-badge auth-dash-int-badge--amazon">amazon</div>
                            <div className="auth-dash-int-badge auth-dash-int-badge--n11">n11</div>
                            <div className="auth-dash-int-badge auth-dash-int-badge--plus">+</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Phone */}
        <div className="auth-mockup-phone">
            <div className="auth-phone-frame">
                <div className="auth-phone-screen">
                    <div className="auth-phone-header">Siparişler</div>
                    <div className="auth-phone-order">
                        <div className="auth-phone-order-dot" style={{ background: "#34d399" }} />
                        <div className="auth-phone-order-info">
                            <div className="auth-phone-order-id">#10236</div>
                            <div className="auth-phone-order-date">Bugün</div>
                        </div>
                        <div className="auth-phone-order-price">₺1,249.00</div>
                    </div>
                    <div className="auth-phone-order">
                        <div className="auth-phone-order-dot" style={{ background: "#7c5cfc" }} />
                        <div className="auth-phone-order-info">
                            <div className="auth-phone-order-id">#10233</div>
                            <div className="auth-phone-order-date">Dün</div>
                        </div>
                        <div className="auth-phone-order-price">₺1,298.00</div>
                    </div>
                    <div className="auth-phone-order">
                        <div className="auth-phone-order-dot" style={{ background: "#f87171" }} />
                        <div className="auth-phone-order-info">
                            <div className="auth-phone-order-id">#10232</div>
                            <div className="auth-phone-order-date">Dün</div>
                        </div>
                        <div className="auth-phone-order-price">₺1,018.00</div>
                    </div>
                    <div className="auth-phone-footer">Tümünü Gör</div>
                </div>
            </div>
        </div>
    </div>
);

export default DashboardMockup;
