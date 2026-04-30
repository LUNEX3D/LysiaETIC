/**
 * HomePage  Pazarynetim Landing Page
 *
 * Giri yapmam kullanclar iin ana sayfa.
 * Admin panelden ayarlanan paket fiyatlar ve zellikleri burada gsterilir.
 *
 *  Paket bilgileri /api/saas-admin/public/plans endpoint'inden dinamik olarak ekilir
 *  Admin panelden fiyat/zellik deitirildiinde annda yansr
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaRocket, FaCheckCircle, FaArrowRight, FaShieldAlt,
    FaPlug, FaChartLine, FaBrain, FaBoxOpen, FaUsers,
    FaCrown, FaStar, FaBolt, FaGlobe
} from "react-icons/fa";
import axios from "../services/api";

const HomePage = () => {
    const [plans, setPlans] = useState({});
    const [billingCycle, setBillingCycle] = useState("monthly");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const res = await axios.get("/saas-admin/public/plans");
            if (res.data.success && res.data.plans) {
                setPlans(res.data.plans);
            }
        } catch (err) {
            console.warn("Plan bilgileri yklenemedi:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const fmtPrice = (n) => {
        if (!n && n !== 0) return "0";
        return Number(n).toLocaleString("tr-TR");
    };

    const platformFeatures = [
        { icon: <FaPlug />, title: "oklu Pazaryeri", desc: "Trendyol, Hepsiburada, N11, Amazon, iekSepeti tek panelden" },
        { icon: <FaBoxOpen />, title: "rn Ynetimi", desc: "Stok, fiyat ve rn bilgilerini merkezi olarak ynetin" },
        { icon: <FaChartLine />, title: "Gelimi Analitik", desc: "Sat, kr ve performans raporlar ile veriye dayal kararlar" },
        { icon: <FaBrain />, title: "AI Asistan", desc: "Yapay zeka destekli rn nerileri ve fiyat optimizasyonu" },
        { icon: <FaShieldAlt />, title: "Gvenli Altyap", desc: "256-bit SSL, 2FA ve KVKK uyumlu veri gvenlii" },
        { icon: <FaGlobe />, title: "7/24 Eriim", desc: "Bulut tabanl altyap ile her yerden, her cihazdan eriim" },
    ];

    const planOrder = ["basic", "pro", "enterprise"];

    return (
        <div style={S.page}>
            {/*  HERO  */}
            <header style={S.hero}>
                <div style={S.heroContent}>
                    <div style={S.heroBadge}>
                        <FaRocket style={{ fontSize: 12 }} /> E-Ticaret Ynetim Platformu
                    </div>
                    <h1 style={S.heroTitle}>
                        Tm Pazaryerlerinizi
                        <span style={S.heroGradient}> Tek Panelden </span>
                        Ynetin
                    </h1>
                    <p style={S.heroDesc}>
                        Pazarynetim ile Trendyol, Hepsiburada, N11, Amazon ve daha fazlasn
                        tek bir merkezden kontrol edin. Stok, sipari, fiyat ve raporlarnz
                        her zaman gncel.
                    </p>
                    <div style={S.heroBtns}>
                        <button style={S.btnPrimary} onClick={() => navigate("/register")}>
                            cretsiz Dene <FaArrowRight />
                        </button>
                        <button style={S.btnSecondary} onClick={() => navigate("/login")}>
                            Giri Yap
                        </button>
                    </div>
                    <div style={S.heroStats}>
                        <div style={S.heroStat}>
                            <div style={S.heroStatVal}>5+</div>
                            <div style={S.heroStatLabel}>Pazaryeri</div>
                        </div>
                        <div style={S.heroStatDivider} />
                        <div style={S.heroStat}>
                            <div style={S.heroStatVal}>AI</div>
                            <div style={S.heroStatLabel}>Destekli</div>
                        </div>
                        <div style={S.heroStatDivider} />
                        <div style={S.heroStat}>
                            <div style={S.heroStatVal}>7/24</div>
                            <div style={S.heroStatLabel}>Eriim</div>
                        </div>
                    </div>
                </div>
            </header>

            {/*  ZELLKLER  */}
            <section style={S.section}>
                <div style={S.sectionInner}>
                    <h2 style={S.sectionTitle}>Neden Pazarynetim?</h2>
                    <p style={S.sectionDesc}>E-ticaret operasyonlarnz glendiren zellikler</p>
                    <div style={S.featuresGrid}>
                        {platformFeatures.map((f, i) => (
                            <div key={i} style={S.featureCard}>
                                <div style={S.featureIcon}>{f.icon}</div>
                                <h3 style={S.featureTitle}>{f.title}</h3>
                                <p style={S.featureDesc}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/*  FYATLANDIRMA  */}
            <section style={S.pricingSection} id="pricing">
                <div style={S.sectionInner}>
                    <h2 style={S.sectionTitle}>
                        <FaCrown style={{ color: "#fbbf24" }} /> Paketler & Fiyatlandrma
                    </h2>
                    <p style={S.sectionDesc}>letmenize uygun paketi sein, hemen balayn</p>

                    {/* Billing Toggle */}
                    <div style={S.billingToggle}>
                        <button
                            style={S.toggleBtn(billingCycle === "monthly")}
                            onClick={() => setBillingCycle("monthly")}
                        >
                            Aylk
                        </button>
                        <button
                            style={S.toggleBtn(billingCycle === "yearly")}
                            onClick={() => setBillingCycle("yearly")}
                        >
                            Yllk <span style={S.saveBadge}>Tasarruf</span>
                        </button>
                    </div>

                    {/* Plan Cards */}
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                            Paketler ykleniyor...
                        </div>
                    ) : (
                        <div style={S.plansGrid}>
                            {planOrder.filter(k => plans[k]).map((key) => {
                                const plan = plans[key];
                                const price = billingCycle === "yearly"
                                    ? (plan.yearlyPrice || Math.round((plan.monthlyPrice || plan.price || 0) * 10))
                                    : (plan.monthlyPrice || plan.price || 0);
                                const isPopular = (plan.badge || "").includes("POPLER");
                                const monthlyEquiv = billingCycle === "yearly" ? Math.round(price / 12) : price;

                                return (
                                    <div key={key} style={S.planCard(isPopular)}>
                                        {plan.badge && (
                                            <div style={S.planBadge(isPopular)}>
                                                {isPopular ? <FaStar style={{ fontSize: 10 }} /> : <FaBolt style={{ fontSize: 10 }} />}
                                                {" "}{plan.badge}
                                            </div>
                                        )}
                                        <div style={S.planName}>{plan.name}</div>
                                        <div style={S.planDesc}>{plan.description}</div>
                                        <div style={S.planPrice}>
                                            <span style={S.planCurrency}></span>
                                            {fmtPrice(price)}
                                        </div>
                                        <div style={S.planPeriod}>
                                            /{billingCycle === "yearly" ? "yl" : "ay"}
                                            {billingCycle === "yearly" && (
                                                <span style={S.planMonthly}> ({fmtPrice(monthlyEquiv)}/ay)</span>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <div style={S.planFeatures}>
                                            {(plan.features || []).map((f, i) => (
                                                <div key={i} style={S.planFeature}>
                                                    <FaCheckCircle style={{ color: "#34d399", fontSize: 12, flexShrink: 0, marginTop: 2 }} />
                                                    <span>{f}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Limits Summary */}
                                        <div style={S.planLimits}>
                                            <div style={S.planLimit}>
                                                <FaBoxOpen style={{ fontSize: 10 }} />
                                                {(plan.limits?.maxProducts ?? 0) >= 999999 ? "Snrsz" : fmtPrice(plan.limits?.maxProducts)} rn
                                            </div>
                                            <div style={S.planLimit}>
                                                <FaPlug style={{ fontSize: 10 }} />
                                                {(plan.limits?.maxMarketplaces ?? 0) >= 999 ? "Snrsz" : plan.limits?.maxMarketplaces} pazaryeri
                                            </div>
                                            <div style={S.planLimit}>
                                                <FaUsers style={{ fontSize: 10 }} />
                                                {(plan.limits?.maxUsers ?? 0) >= 999 ? "Snrsz" : plan.limits?.maxUsers} kullanc
                                            </div>
                                        </div>

                                        <button
                                            style={S.planBtn(isPopular)}
                                            onClick={() => navigate("/register")}
                                        >
                                            Hemen Bala <FaArrowRight style={{ fontSize: 12 }} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Trial Info */}
                    {plans.trial && (
                        <div style={S.trialBanner}>
                            <FaRocket style={{ color: "#fbbf24", fontSize: 18 }} />
                            <div>
                                <strong>cretsiz {plans.trial.duration || 14} Gn Deneyin!</strong>
                                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                                    Kredi kart gerekmez. Tm temel zelliklere eriim.
                                    {plans.trial.limits?.maxProducts && ` ${plans.trial.limits.maxProducts} rn, `}
                                    {plans.trial.limits?.maxOrders && `${plans.trial.limits.maxOrders} sipari/ay.`}
                                </div>
                            </div>
                            <button style={S.trialBtn} onClick={() => navigate("/register")}>
                                cretsiz Bala
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/*  CTA  */}
            <section style={S.ctaSection}>
                <h2 style={S.ctaTitle}>E-Ticaretinizi Bir st Seviyeye Tayn</h2>
                <p style={S.ctaDesc}>
                    Hemen kayt olun, cretsiz deneme srenizle platformu kefedin.
                </p>
                <div style={S.heroBtns}>
                    <button style={S.btnPrimary} onClick={() => navigate("/register")}>
                        cretsiz Kayt Ol <FaArrowRight />
                    </button>
                    <button style={S.btnSecondary} onClick={() => navigate("/login")}>
                        Giri Yap
                    </button>
                </div>
            </section>

            {/*  FOOTER  */}
            <footer style={S.footer}>
                <div style={S.footerInner}>
                    <div style={S.footerBrand}>
                        <div style={S.footerLogo}>LE</div>
                        <span style={S.footerName}>Pazarynetim</span>
                    </div>
                    <div style={S.footerLinks}>
                        <a href="/privacy" style={S.footerLink}>Gizlilik Politikas</a>
                        <a href="/terms" style={S.footerLink}>Kullanm Koullar</a>
                        <a href="/distance-sales" style={S.footerLink}>Mesafeli Sat Szlemesi</a>
                    </div>
                    <div style={S.footerCopy}>
                         {new Date().getFullYear()} Pazarynetim. Tm haklar sakldr.
                    </div>
                </div>
            </footer>
        </div>
    );
};

/* 
   STYLES
    */
const S = {
    page: {
        minHeight: "100vh",
        background: "#06080f",
        color: "#f1f5f9",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    //  Hero 
    hero: {
        padding: "80px 24px 60px",
        textAlign: "center",
        background: "linear-gradient(180deg, rgba(99,102,241,0.06) 0%, transparent 100%)",
        position: "relative",
    },
    heroContent: {
        maxWidth: 720,
        margin: "0 auto",
    },
    heroBadge: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 20px",
        background: "rgba(99,102,241,0.1)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 30,
        color: "#818cf8",
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 28,
    },
    heroTitle: {
        fontSize: "clamp(2rem, 5vw, 3.2rem)",
        fontWeight: 800,
        lineHeight: 1.15,
        margin: "0 0 20px",
        color: "#fff",
    },
    heroGradient: {
        background: "linear-gradient(135deg, #6366f1, #a78bfa, #34d399)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
    },
    heroDesc: {
        fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
        color: "#94a3b8",
        lineHeight: 1.7,
        margin: "0 0 32px",
        maxWidth: 560,
        marginLeft: "auto",
        marginRight: "auto",
    },
    heroBtns: {
        display: "flex",
        gap: 14,
        justifyContent: "center",
        flexWrap: "wrap",
    },
    btnPrimary: {
        padding: "14px 32px",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        border: "none",
        borderRadius: 12,
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
        transition: "transform 0.15s, box-shadow 0.15s",
    },
    btnSecondary: {
        padding: "14px 32px",
        background: "transparent",
        border: "1.5px solid rgba(99,102,241,0.3)",
        borderRadius: 12,
        color: "#818cf8",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
    },
    heroStats: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 32,
        marginTop: 48,
    },
    heroStat: { textAlign: "center" },
    heroStatVal: { fontSize: 28, fontWeight: 800, color: "#fff" },
    heroStatLabel: { fontSize: 13, color: "#64748b", marginTop: 2 },
    heroStatDivider: { width: 1, height: 40, background: "rgba(99,102,241,0.15)" },

    //  Section 
    section: {
        padding: "80px 24px",
    },
    sectionInner: {
        maxWidth: 1100,
        margin: "0 auto",
    },
    sectionTitle: {
        fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
        fontWeight: 800,
        textAlign: "center",
        margin: "0 0 12px",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    sectionDesc: {
        fontSize: 15,
        color: "#64748b",
        textAlign: "center",
        margin: "0 0 48px",
    },

    //  Features 
    featuresGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 20,
    },
    featureCard: {
        background: "rgba(17,22,49,0.7)",
        border: "1px solid rgba(99,102,241,0.08)",
        borderRadius: 16,
        padding: "28px 24px",
        transition: "border-color 0.2s, transform 0.2s",
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        background: "rgba(99,102,241,0.1)",
        color: "#818cf8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        marginBottom: 16,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: "#fff",
        margin: "0 0 8px",
    },
    featureDesc: {
        fontSize: 13,
        color: "#94a3b8",
        lineHeight: 1.6,
        margin: 0,
    },

    //  Pricing 
    pricingSection: {
        padding: "80px 24px",
        background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.04) 50%, transparent 100%)",
    },
    billingToggle: {
        display: "flex",
        gap: 8,
        justifyContent: "center",
        marginBottom: 40,
    },
    toggleBtn: (active) => ({
        padding: "12px 28px",
        background: active ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "rgba(99,102,241,0.08)",
        border: active ? "none" : "1px solid rgba(99,102,241,0.15)",
        borderRadius: 12,
        color: active ? "#fff" : "#818cf8",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 8,
    }),
    saveBadge: {
        padding: "3px 8px",
        background: "rgba(52,211,153,0.2)",
        borderRadius: 6,
        fontSize: 11,
        color: "#34d399",
    },
    plansGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 20,
        maxWidth: 1000,
        margin: "0 auto",
    },
    planCard: (isPopular) => ({
        background: isPopular
            ? "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))"
            : "rgba(17,22,49,0.7)",
        border: isPopular
            ? "1.5px solid rgba(99,102,241,0.35)"
            : "1px solid rgba(99,102,241,0.08)",
        borderRadius: 20,
        padding: "36px 28px 28px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
    }),
    planBadge: (isPopular) => ({
        position: "absolute",
        top: -12,
        left: "50%",
        transform: "translateX(-50%)",
        background: isPopular ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "linear-gradient(135deg, #34d399, #22c55e)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        padding: "5px 16px",
        borderRadius: 20,
        letterSpacing: "0.03em",
        display: "flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
    }),
    planName: {
        fontSize: 20,
        fontWeight: 700,
        color: "#fff",
        marginBottom: 6,
    },
    planDesc: {
        fontSize: 13,
        color: "#94a3b8",
        lineHeight: 1.5,
        marginBottom: 20,
        minHeight: 40,
    },
    planPrice: {
        fontSize: 42,
        fontWeight: 800,
        color: "#fff",
        lineHeight: 1,
    },
    planCurrency: {
        fontSize: 22,
        fontWeight: 600,
        verticalAlign: "top",
        marginRight: 2,
    },
    planPeriod: {
        fontSize: 14,
        color: "#64748b",
        marginBottom: 24,
        marginTop: 4,
    },
    planMonthly: {
        fontSize: 12,
        color: "#34d399",
    },
    planFeatures: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 20,
    },
    planFeature: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 13,
        color: "#e2e8f0",
        lineHeight: 1.4,
    },
    planLimits: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20,
        padding: "12px",
        background: "rgba(99,102,241,0.04)",
        borderRadius: 10,
        border: "1px solid rgba(99,102,241,0.08)",
    },
    planLimit: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color: "#94a3b8",
        fontWeight: 600,
    },
    planBtn: (isPopular) => ({
        width: "100%",
        padding: "14px",
        borderRadius: 12,
        border: isPopular ? "none" : "1.5px solid rgba(99,102,241,0.3)",
        background: isPopular ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "transparent",
        color: isPopular ? "#fff" : "#818cf8",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "transform 0.15s",
    }),
    trialBanner: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 28px",
        background: "rgba(251,191,36,0.06)",
        border: "1px solid rgba(251,191,36,0.15)",
        borderRadius: 16,
        marginTop: 40,
        maxWidth: 700,
        marginLeft: "auto",
        marginRight: "auto",
        flexWrap: "wrap",
    },
    trialBtn: {
        padding: "10px 24px",
        background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
        border: "none",
        borderRadius: 10,
        color: "#0f172a",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        marginLeft: "auto",
    },

    //  CTA 
    ctaSection: {
        padding: "80px 24px",
        textAlign: "center",
        background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.06) 100%)",
    },
    ctaTitle: {
        fontSize: "clamp(1.5rem, 4vw, 2rem)",
        fontWeight: 800,
        color: "#fff",
        margin: "0 0 12px",
    },
    ctaDesc: {
        fontSize: 15,
        color: "#94a3b8",
        margin: "0 0 32px",
    },

    //  Footer 
    footer: {
        padding: "40px 24px",
        borderTop: "1px solid rgba(99,102,241,0.08)",
    },
    footerInner: {
        maxWidth: 1100,
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
    },
    footerBrand: {
        display: "flex",
        alignItems: "center",
        gap: 10,
    },
    footerLogo: {
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
    },
    footerName: {
        fontSize: 15,
        fontWeight: 700,
        color: "#fff",
    },
    footerLinks: {
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
    },
    footerLink: {
        fontSize: 13,
        color: "#64748b",
        textDecoration: "none",
    },
    footerCopy: {
        fontSize: 12,
        color: "#475569",
    },
};

export default HomePage;

