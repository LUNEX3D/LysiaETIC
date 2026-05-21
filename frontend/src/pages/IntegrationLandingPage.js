import React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FaArrowRight, FaCheckCircle } from "react-icons/fa";
import SeoHead from "../components/SeoHead";
import MarketplaceBlogSection from "../components/MarketplaceBlogSection";
import { MARKETPLACE_BLOG_SECTIONS } from "../content/marketplaceBlog";
import { BRAND_NAME, BRAND_EMAIL } from "../constants/brand";
import { getSeoForPath } from "../content/seoMeta";

const SLUG_TO_ID = {
    "trendyol-entegrasyonu": "trendyol",
    "hepsiburada-entegrasyonu": "hepsiburada",
    "amazon-entegrasyonu": "amazon",
    "n11-entegrasyonu": "n11",
    "ciceksepeti-entegrasyonu": "ciceksepeti",
};

export default function IntegrationLandingPage() {
    const location = useLocation();
    const slug = location.pathname.replace(/^\//, "");
    const navigate = useNavigate();
    const path = `/${slug}`;
    const seo = getSeoForPath(path);
    const sectionId = SLUG_TO_ID[slug];
    const section = MARKETPLACE_BLOG_SECTIONS.find((s) => s.id === sectionId);

    if (!section) {
        return (
            <div style={S.page}>
                <SeoHead />
                <p style={{ color: "#94a3b8", textAlign: "center", padding: 48 }}>Sayfa bulunamadı.</p>
                <Link to="/home" style={S.link}>Ana sayfaya dön</Link>
                {/* end notfound */}
            </div>
        );
    }

    return (
        <div style={S.page}>
            <SeoHead title={seo.title} description={seo.description} canonical={seo.canonical} />
            <header style={S.header}>
                <Link to="/" style={S.logo}>
                    {BRAND_NAME}
                </Link>
                <nav style={S.nav}>
                    <Link to="/home" style={S.navLink}>Ana Sayfa</Link>
                    <Link to="/blog" style={S.navLink}>Blog</Link>
                    <Link to="/register" style={S.navLink}>Ücretsiz Dene</Link>
                </nav>
            </header>

            <main style={S.hero}>
                <span style={{ ...S.badge, borderColor: section.color, color: section.color }}>
                    {section.label} Entegrasyonu
                </span>
                <h1 style={S.title}>{section.title}</h1>
                <p style={S.intro}>{section.intro}</p>
                <button type="button" style={S.cta} onClick={() => navigate("/register")}>
                    Hemen Başla <FaArrowRight />
                </button>
            </main>

            <section style={S.content}>
                {section.topics.map((t, i) => (
                    <article key={i} style={S.card}>
                        <h2 style={S.cardTitle}>
                            <FaCheckCircle style={{ color: section.color }} /> {t.heading}
                        </h2>
                        <p style={S.cardBody}>{t.body}</p>
                    </article>
                ))}
            </section>

            <section style={S.contact}>
                <h2>İletişim</h2>
                <p>
                    Kayıt ve e-posta doğrulama mesajları <strong>{BRAND_EMAIL}</strong> adresinden gönderilir.
                    Sorularınız için aynı adrese yazabilirsiniz.
                </p>
            </section>

            <MarketplaceBlogSection compact />
            <footer style={S.footer}>
                <p>© {new Date().getFullYear()} {BRAND_NAME} — https://dashtock.com</p>
            </footer>
        </div>
    );
}

const S = {
    page: { minHeight: "100vh", background: "#0a0e1a", color: "#e2e8f0", fontFamily: "Space Grotesk, Inter, sans-serif" },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
        gap: 12,
    },
    logo: { color: "#fff", fontWeight: 800, textDecoration: "none", fontSize: 18 },
    nav: { display: "flex", gap: 20, fontSize: 14, flexWrap: "wrap" },
    navLink: { color: "#94a3b8", textDecoration: "none" },
    link: { color: "#5eead4", display: "block", textAlign: "center" },
    hero: { maxWidth: 800, margin: "0 auto", padding: "48px 24px", textAlign: "center" },
    badge: {
        display: "inline-block",
        padding: "6px 14px",
        borderRadius: 999,
        border: "1px solid",
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 16,
    },
    title: { fontSize: "clamp(1.75rem, 5vw, 2.5rem)", fontWeight: 800, margin: "0 0 16px", color: "#fff" },
    intro: { fontSize: 16, color: "#94a3b8", lineHeight: 1.65, marginBottom: 28 },
    cta: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "14px 28px",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        color: "#fff",
        fontWeight: 700,
        fontSize: 15,
        cursor: "pointer",
    },
    content: { maxWidth: 800, margin: "0 auto", padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: 20 },
    card: {
        padding: 24,
        borderRadius: 14,
        background: "rgba(15,23,42,0.8)",
        border: "1px solid rgba(255,255,255,0.06)",
    },
    cardTitle: { display: "flex", alignItems: "center", gap: 10, fontSize: 18, margin: "0 0 12px", color: "#f1f5f9" },
    cardBody: { margin: 0, color: "#94a3b8", lineHeight: 1.65, fontSize: 15 },
    contact: { maxWidth: 800, margin: "0 auto 48px", padding: "0 24px", textAlign: "center", color: "#94a3b8" },
    footer: { padding: 24, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#64748b" },
};
