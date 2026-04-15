/**
 * LandingSection — Login sayfasının SOL PANELİNDE gösterilen
 * sekmeli tanıtım, özellikler ve fiyatlandırma bölümleri.
 *
 * Sekmeler: Ana Sayfa | Özellikler | Fiyatlandırma
 * Login formu sağda sabit kalır, bu bileşen sol paneli doldurur.
 */
import React, { useState, useEffect } from "react";
import axios from "../services/api";

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

// Fallback plan verileri (API'den yüklenemezse kullanılır)
const FALLBACK_PLANS = [
    {
        id: "trial", name: "Demo", price: "Ücretsiz", period: "14 gün",
        desc: "Platformu keşfedin", color: "#22d3ee",
        features: ["100 ürün limiti", "1.000 sipariş/ay", "2 pazaryeri", "Temel raporlama", "E-posta desteği"],
        cta: "Hemen Başla", popular: false
    },
    {
        id: "basic", name: "Basic", price: "₺299", period: "/ay",
        desc: "Küçük işletmeler için", color: "#60a5fa",
        features: ["500 ürün limiti", "5.000 sipariş/ay", "3 pazaryeri", "Gelişmiş raporlama", "E-fatura", "Öncelikli destek"],
        cta: "Paketi Seç", popular: false
    },
    {
        id: "pro", name: "Pro", price: "₺599", period: "/ay",
        desc: "Büyüyen işletmeler için", color: "#a78bfa",
        features: ["5.000 ürün limiti", "50.000 sipariş/ay", "10 pazaryeri", "AI destekli analiz", "Tüm e-fatura sağlayıcıları", "7/24 destek"],
        cta: "Paketi Seç", popular: true
    },
    {
        id: "enterprise", name: "Enterprise", price: "₺1.299", period: "/ay",
        desc: "Kurumsal çözümler", color: "#f59e0b",
        features: ["Sınırsız ürün", "Sınırsız sipariş", "Sınırsız entegrasyon", "Özel API erişimi", "Dedicated yönetici", "SLA garantisi"],
        cta: "İletişime Geç", popular: false
    }
];

const PLAN_COLORS = { trial: "#22d3ee", basic: "#60a5fa", pro: "#a78bfa", enterprise: "#f59e0b" };
const PLAN_DESCS = { trial: "Platformu keşfedin", basic: "Küçük işletmeler için", pro: "Büyüyen işletmeler için", enterprise: "Kurumsal çözümler" };
const PLAN_CTAS = { trial: "Hemen Başla", basic: "Paketi Seç", pro: "Paketi Seç", enterprise: "İletişime Geç" };

// API'den gelen plan verisini LandingSection formatına dönüştür
const transformApiPlans = (apiPlans) => {
    if (!apiPlans || !Array.isArray(apiPlans) || apiPlans.length === 0) return null;
    const result = [{
        id: "trial", name: "Demo", price: "Ücretsiz", period: "14 gün",
        desc: "Platformu keşfedin", color: "#22d3ee", monthlyPrice: 0, yearlyPrice: 0,
        features: ["100 ürün limiti", "1.000 sipariş/ay", "2 pazaryeri", "Temel raporlama", "E-posta desteği"],
        cta: "Hemen Başla", popular: false
    }];
    apiPlans.forEach(p => {
        const lim = p.limits || {};
        const mp = p.monthlyPrice || p.price || 0;
        const yp = p.yearlyPrice || Math.round(mp * 10);
        const fmtPrice = mp >= 1000 ? `₺${mp.toLocaleString("tr-TR")}` : `₺${mp}`;
        const features = [];
        if (lim.maxProducts) features.push(lim.maxProducts === -1 ? "Sınırsız ürün" : `${lim.maxProducts.toLocaleString("tr-TR")} ürün limiti`);
        if (lim.maxOrders) features.push(lim.maxOrders === -1 ? "Sınırsız sipariş" : `${lim.maxOrders.toLocaleString("tr-TR")} sipariş/ay`);
        if (lim.maxMarketplaces) features.push(lim.maxMarketplaces === -1 ? "Sınırsız entegrasyon" : `${lim.maxMarketplaces} pazaryeri`);
        if (lim.maxUsers) features.push(lim.maxUsers === -1 ? "Sınırsız kullanıcı" : `${lim.maxUsers} kullanıcı`);
        if (p.id === "enterprise") { features.push("Özel API erişimi"); features.push("Dedicated yönetici"); features.push("SLA garantisi"); }
        else if (p.id === "pro") { features.push("AI destekli analiz"); features.push("7/24 destek"); }
        else { features.push("Gelişmiş raporlama"); features.push("Öncelikli destek"); }
        result.push({
            id: p.id,
            name: p.name || p.id,
            price: fmtPrice,
            period: "/ay",
            desc: PLAN_DESCS[p.id] || "",
            color: PLAN_COLORS[p.id] || "#6366f1",
            monthlyPrice: mp,
            yearlyPrice: yp,
            features,
            cta: PLAN_CTAS[p.id] || "Paketi Seç",
            popular: p.id === "pro",
        });
    });
    return result;
};

const FEATURES = [
    { icon: "🔗", title: "Çoklu Pazaryeri", desc: "Trendyol, Hepsiburada, Amazon, N11, ÇiçekSepeti — tek panelden.", color: "#f27a1a" },
    { icon: "📦", title: "Stok & Ürün", desc: "Otomatik stok senkronizasyonu, toplu ürün yükleme ve fiyat eşitleme.", color: "#22c55e" },
    { icon: "📊", title: "Gelişmiş Analitik", desc: "AI destekli satış analizi, trend tahminleri ve performans raporları.", color: "#6366f1" },
    { icon: "🧾", title: "E-Fatura", desc: "QNB, Sovos, Paraşüt, Ödeal — otomatik e-fatura ve e-arşiv.", color: "#ec4899" },
    { icon: "🚚", title: "Kargo Takibi", desc: "Tüm kargo firmalarını tek ekrandan takip edin.", color: "#f59e0b" },
    { icon: "🤖", title: "AI Asistan", desc: "Yapay zeka destekli ürün açıklaması ve fiyat önerisi.", color: "#8b5cf6" }
];

const STATS = [
    { value: "5+", label: "Pazaryeri" },
    { value: "10K+", label: "Ürün" },
    { value: "99.9%", label: "Uptime" },
    { value: "7/24", label: "Destek" }
];

const TABS = [
    { id: "home", label: "Ana Sayfa", icon: "🏠" },
    { id: "features", label: "Özellikler", icon: "⚡" },
    { id: "pricing", label: "Fiyatlandırma", icon: "💎" },
];

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const S = {
    wrapper: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#080b14",
        color: "#f1f5f9",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "hidden",
    },
    navbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: "56px",
        minHeight: "56px",
        background: "rgba(8,11,20,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(99,102,241,0.08)",
        flexShrink: 0,
    },
    navLogo: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    navLogoIcon: {
        width: "32px",
        height: "32px",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        borderRadius: "9px",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
        transform: "rotate(-6deg)",
        flexShrink: 0,
    },
    navLogoText: {
        fontSize: "15px",
        fontWeight: 300,
        letterSpacing: "0.22em",
        color: "#fff",
        textTransform: "uppercase",
    },
    navTabs: {
        display: "flex",
        alignItems: "center",
        gap: "2px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "10px",
        padding: "3px",
        border: "1px solid rgba(99,102,241,0.06)",
    },
    navTab: (active) => ({
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "8px",
        border: "none",
        background: active
            ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))"
            : "transparent",
        color: active ? "#fff" : "#94a3b8",
        fontSize: "12px",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.25s ease",
        whiteSpace: "nowrap",
        position: "relative",
    }),
    navTabIndicator: {
        position: "absolute",
        bottom: "1px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "16px",
        height: "2px",
        borderRadius: "1px",
        background: "linear-gradient(90deg, #6366f1, #a78bfa)",
    },
    navLoginBtn: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        borderRadius: "8px",
        border: "none",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
        transition: "all 0.25s ease",
        whiteSpace: "nowrap",
    },
    contentArea: {
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
    },
    tabContent: {
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
    },
    hero: {
        textAlign: "center",
        padding: "40px 20px 32px",
        position: "relative",
        overflow: "hidden",
    },
    heroGlow: {
        position: "absolute",
        top: "-180px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "700px",
        height: "500px",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
    },
    heroTag: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(99,102,241,0.1)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "20px",
        padding: "6px 16px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#818cf8",
        marginBottom: "20px",
    },
    heroTitle: {
        fontSize: "clamp(24px, 3.5vw, 40px)",
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: "-0.03em",
        margin: "0 0 14px",
        color: "#fff",
    },
    heroGrad: {
        background: "linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    heroSub: {
        fontSize: "14px",
        color: "#94a3b8",
        maxWidth: "480px",
        margin: "0 auto 28px",
        lineHeight: 1.6,
    },
    statsRow: {
        display: "flex",
        justifyContent: "center",
        gap: "32px",
        flexWrap: "wrap",
        marginBottom: "24px",
    },
    statItem: { textAlign: "center" },
    statVal: {
        fontSize: "24px",
        fontWeight: 800,
        background: "linear-gradient(135deg, #6366f1, #a78bfa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    statLabel: {
        fontSize: "11px",
        color: "#64748b",
        fontWeight: 600,
        marginTop: "2px",
    },
    marketplaceRow: {
        display: "flex",
        justifyContent: "center",
        gap: "10px",
        flexWrap: "wrap",
        marginBottom: "12px",
    },
    marketplaceBadge: (color) => ({
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "7px 14px",
        borderRadius: "10px",
        background: `${color}10`,
        border: `1px solid ${color}25`,
        color: color,
        fontSize: "11px",
        fontWeight: 700,
    }),
    section: {
        padding: "32px 20px",
        maxWidth: "900px",
        margin: "0 auto",
        width: "100%",
    },
    sectionTitle: {
        textAlign: "center",
        fontSize: "clamp(20px, 2.5vw, 28px)",
        fontWeight: 800,
        color: "#fff",
        marginBottom: "8px",
        letterSpacing: "-0.02em",
    },
    sectionSub: {
        textAlign: "center",
        fontSize: "13px",
        color: "#64748b",
        marginBottom: "28px",
        maxWidth: "420px",
        margin: "0 auto 28px",
    },
    divider: {
        width: "100%",
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.15), transparent)",
    },
    featGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "12px",
    },
    featCard: () => ({
        background: "rgba(17,22,49,0.7)",
        border: "1px solid rgba(99,102,241,0.08)",
        borderRadius: "14px",
        padding: "20px",
        transition: "all 0.3s ease",
        cursor: "default",
    }),
    featIcon: (color) => ({
        width: "42px",
        height: "42px",
        borderRadius: "10px",
        background: `${color}15`,
        border: `1px solid ${color}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        marginBottom: "10px",
    }),
    featTitle: {
        fontSize: "14px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "4px",
    },
    featDesc: {
        fontSize: "12px",
        color: "#94a3b8",
        lineHeight: 1.5,
    },
    stepsRow: {
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        flexWrap: "wrap",
        marginTop: "28px",
    },
    stepCard: {
        background: "rgba(17,22,49,0.5)",
        border: "1px solid rgba(99,102,241,0.08)",
        borderRadius: "14px",
        padding: "22px 18px",
        textAlign: "center",
        flex: "1 1 160px",
        maxWidth: "220px",
    },
    stepNumber: (color) => ({
        width: "38px",
        height: "38px",
        borderRadius: "10px",
        background: `${color}15`,
        border: `1px solid ${color}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "16px",
        fontWeight: 800,
        color: color,
        margin: "0 auto 10px",
    }),
    stepTitle: { fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "4px" },
    stepDesc: { fontSize: "11px", color: "#94a3b8", lineHeight: 1.4 },
    pricingGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        maxWidth: "900px",
        margin: "0 auto",
    },
    priceCard: (color, popular) => ({
        background: popular
            ? "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))"
            : "rgba(17,22,49,0.7)",
        border: popular
            ? "1.5px solid rgba(99,102,241,0.35)"
            : "1px solid rgba(99,102,241,0.08)",
        borderRadius: "16px",
        padding: "24px 18px",
        position: "relative",
        transition: "all 0.3s ease",
        display: "flex",
        flexDirection: "column",
    }),
    popularBadge: {
        position: "absolute",
        top: "-10px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        fontSize: "9px",
        fontWeight: 700,
        padding: "3px 12px",
        borderRadius: "16px",
        letterSpacing: "0.05em",
        boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
    },
    priceName: { fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "2px" },
    priceDesc: { fontSize: "11px", color: "#64748b", marginBottom: "12px" },
    priceAmount: { fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1 },
    pricePeriod: { fontSize: "12px", fontWeight: 500, color: "#64748b" },
    priceFeatures: { listStyle: "none", padding: 0, margin: "16px 0", flex: 1 },
    priceFeature: {
        fontSize: "11px", color: "#94a3b8", padding: "3px 0",
        display: "flex", alignItems: "center", gap: "6px",
    },
    priceCheck: (color) => ({
        width: "14px", height: "14px", borderRadius: "50%",
        background: `${color}20`, color: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "8px", fontWeight: 700, flexShrink: 0,
    }),
    priceCta: (color, popular) => ({
        width: "100%", padding: "10px", borderRadius: "10px",
        border: popular ? "none" : `1px solid ${color}40`,
        background: popular ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "transparent",
        color: popular ? "#fff" : color,
        fontSize: "12px", fontWeight: 700, cursor: "pointer",
        transition: "all 0.3s ease", fontFamily: "inherit",
    }),
    compTable: {
        width: "100%",
        maxWidth: "800px",
        margin: "0 auto",
        borderCollapse: "separate",
        borderSpacing: "0",
        fontSize: "11px",
    },
    compTh: {
        padding: "10px 12px",
        textAlign: "center",
        fontWeight: 700,
        color: "#fff",
        background: "rgba(99,102,241,0.08)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
    },
    compTd: {
        padding: "8px 12px",
        textAlign: "center",
        color: "#94a3b8",
        borderBottom: "1px solid rgba(99,102,241,0.05)",
    },
    compTdFirst: {
        padding: "8px 12px",
        textAlign: "left",
        color: "#e2e8f0",
        fontWeight: 600,
        borderBottom: "1px solid rgba(99,102,241,0.05)",
    },
    faqGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "12px",
        maxWidth: "800px",
        margin: "0 auto",
    },
    faqCard: {
        background: "rgba(17,22,49,0.5)",
        border: "1px solid rgba(99,102,241,0.08)",
        borderRadius: "12px",
        padding: "16px 18px",
    },
    faqQ: {
        fontSize: "12px",
        fontWeight: 700,
        color: "#fff",
        marginBottom: "6px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    faqA: { fontSize: "11px", color: "#94a3b8", lineHeight: 1.5 },
    footer: {
        textAlign: "center",
        padding: "16px",
        borderTop: "1px solid rgba(99,102,241,0.06)",
        fontSize: "11px",
        color: "#64748b",
        flexShrink: 0,
    },
};

/* ═══════════════════════════════════════════════════════════
   TAB CONTENT COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const HomeTab = ({ onGoToLogin }) => {
    const marketplaces = [
        { name: "Trendyol", color: "#f27a1a", emoji: "🟠" },
        { name: "Hepsiburada", color: "#ff6000", emoji: "🔶" },
        { name: "Amazon", color: "#ff9900", emoji: "📦" },
        { name: "N11", color: "#7b68ee", emoji: "🟣" },
        { name: "ÇiçekSepeti", color: "#ec4899", emoji: "🌸" },
    ];

    return (
        <div style={S.tabContent}>
            <div style={S.hero}>
                <div style={S.heroGlow} />
                <div style={{ position: "relative", zIndex: 2 }}>
                    <div style={S.heroTag}>
                        <span>🚀</span> E-Ticarette Yeni Nesil Yönetim
                    </div>
                    <h1 style={S.heroTitle}>
                        Tüm Pazaryerlerinizi<br />
                        <span style={S.heroGrad}>Tek Panelden</span> Yönetin
                    </h1>
                    <p style={S.heroSub}>
                        Trendyol, Hepsiburada, Amazon, N11 ve ÇiçekSepeti entegrasyonları ile
                        siparişlerinizi, stoklarınızı ve faturalarınızı tek bir yerden kontrol edin.
                    </p>
                    <div style={S.marketplaceRow}>
                        {marketplaces.map((m, i) => (
                            <div key={i} style={S.marketplaceBadge(m.color)}>
                                <span style={{ fontSize: "14px" }}>{m.emoji}</span>
                                {m.name}
                            </div>
                        ))}
                    </div>
                    <div style={S.statsRow}>
                        {STATS.map((s, i) => (
                            <div key={i} style={S.statItem}>
                                <div style={S.statVal}>{s.value}</div>
                                <div style={S.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <button
                        style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                            color: "#fff", border: "none", borderRadius: "12px",
                            padding: "14px 28px", fontSize: "14px", fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit",
                            boxShadow: "0 8px 28px rgba(99,102,241,0.35)",
                            transition: "all 0.3s ease",
                        }}
                        onClick={onGoToLogin}
                    >
                        14 Gün Ücretsiz Dene →
                    </button>
                </div>
            </div>
            <div style={S.divider} />
            <div style={S.section}>
                <h2 style={S.sectionTitle}>Nasıl Çalışır?</h2>
                <p style={S.sectionSub}>3 adımda e-ticaret yönetiminizi kolaylaştırın</p>
                <div style={S.stepsRow}>
                    {[
                        { num: "1", title: "Kayıt Olun", desc: "Ücretsiz hesap oluşturun, 14 gün demo kullanın.", color: "#22d3ee" },
                        { num: "2", title: "Entegre Edin", desc: "Pazaryeri API bilgilerinizi girin, senkronizasyon başlasın.", color: "#6366f1" },
                        { num: "3", title: "Yönetin", desc: "Siparişler, stoklar, faturalar — hepsini tek panelden.", color: "#a78bfa" },
                    ].map((step, i) => (
                        <div key={i} style={S.stepCard}>
                            <div style={S.stepNumber(step.color)}>{step.num}</div>
                            <div style={S.stepTitle}>{step.title}</div>
                            <div style={S.stepDesc}>{step.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FeaturesTab = () => {
    const [hoveredFeat, setHoveredFeat] = useState(null);
    return (
        <div style={S.tabContent}>
            <div style={S.section}>
                <h2 style={S.sectionTitle}>Neden LysiaETIC?</h2>
                <p style={S.sectionSub}>E-ticaret operasyonlarınızı kolaylaştıran güçlü özellikler</p>
                <div style={S.featGrid}>
                    {FEATURES.map((f, i) => (
                        <div
                            key={i}
                            style={{
                                ...S.featCard(f.color),
                                transform: hoveredFeat === i ? "translateY(-3px)" : "none",
                                borderColor: hoveredFeat === i ? `${f.color}30` : "rgba(99,102,241,0.08)",
                                boxShadow: hoveredFeat === i ? `0 8px 28px ${f.color}15` : "none",
                            }}
                            onMouseEnter={() => setHoveredFeat(i)}
                            onMouseLeave={() => setHoveredFeat(null)}
                        >
                            <div style={S.featIcon(f.color)}>{f.icon}</div>
                            <div style={S.featTitle}>{f.title}</div>
                            <div style={S.featDesc}>{f.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div style={S.divider} />
            <div style={{ ...S.section, overflowX: "auto" }}>
                <h2 style={S.sectionTitle}>Paket Karşılaştırma</h2>
                <p style={S.sectionSub}>Hangi paket size uygun?</p>
                <table style={S.compTable}>
                    <thead>
                        <tr>
                            <th style={{ ...S.compTh, textAlign: "left", borderRadius: "8px 0 0 0" }}>Özellik</th>
                            <th style={S.compTh}>Demo</th>
                            <th style={S.compTh}>Basic</th>
                            <th style={S.compTh}>Pro</th>
                            <th style={{ ...S.compTh, borderRadius: "0 8px 0 0" }}>Enterprise</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            ["Ürün Limiti", "100", "500", "5.000", "∞"],
                            ["Sipariş/Ay", "1.000", "5.000", "50.000", "∞"],
                            ["Pazaryeri", "2", "3", "10", "∞"],
                            ["E-Fatura", "—", "✓", "✓", "✓"],
                            ["AI Analiz", "—", "—", "✓", "✓"],
                            ["Kargo Takibi", "—", "—", "✓", "✓"],
                            ["API Erişimi", "—", "—", "—", "✓"],
                            ["Destek", "E-posta", "Öncelikli", "7/24", "Dedicated"],
                        ].map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "rgba(17,22,49,0.3)" : "transparent" }}>
                                <td style={S.compTdFirst}>{row[0]}</td>
                                <td style={S.compTd}>{row[1]}</td>
                                <td style={S.compTd}>{row[2]}</td>
                                <td style={{ ...S.compTd, color: "#a78bfa", fontWeight: 600 }}>{row[3]}</td>
                                <td style={{ ...S.compTd, color: "#f59e0b", fontWeight: 600 }}>{row[4]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PricingTab = ({ onGoToLogin, plans }) => {
    const [hoveredPlan, setHoveredPlan] = useState(null);
    const [billingPeriod, setBillingPeriod] = useState("monthly");

    const displayPlans = plans && plans.length > 0 ? plans : FALLBACK_PLANS;

    // Yıllık fiyatları hesapla (API'den gelen yearlyPrice / 12 = aylık)
    const getYearlyDisplay = (p) => {
        if (p.id === "trial") return "Ücretsiz";
        const yp = p.yearlyPrice || (p.monthlyPrice ? Math.round(p.monthlyPrice * 10) : 0);
        const monthlyFromYearly = Math.round(yp / 12);
        return monthlyFromYearly >= 1000 ? `₺${monthlyFromYearly.toLocaleString("tr-TR")}` : `₺${monthlyFromYearly}`;
    };

    return (
        <div style={S.tabContent}>
            <div style={S.section}>
                <h2 style={S.sectionTitle}>Fiyatlandırma</h2>
                <p style={S.sectionSub}>İşletmenize uygun paketi seçin, 14 gün ücretsiz deneyin</p>
                <div style={{
                    display: "flex", justifyContent: "center", marginBottom: "28px",
                    gap: "3px", background: "rgba(255,255,255,0.03)", borderRadius: "10px",
                    padding: "3px", border: "1px solid rgba(99,102,241,0.06)",
                    width: "fit-content", margin: "0 auto 28px",
                }}>
                    <button
                        style={{
                            padding: "8px 18px", borderRadius: "8px", border: "none",
                            background: billingPeriod === "monthly" ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))" : "transparent",
                            color: billingPeriod === "monthly" ? "#fff" : "#94a3b8",
                            fontSize: "12px", fontWeight: billingPeriod === "monthly" ? 700 : 500,
                            cursor: "pointer", fontFamily: "inherit",
                        }}
                        onClick={() => setBillingPeriod("monthly")}
                    >Aylık</button>
                    <button
                        style={{
                            padding: "8px 18px", borderRadius: "8px", border: "none",
                            background: billingPeriod === "yearly" ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))" : "transparent",
                            color: billingPeriod === "yearly" ? "#fff" : "#94a3b8",
                            fontSize: "12px", fontWeight: billingPeriod === "yearly" ? 700 : 500,
                            cursor: "pointer", fontFamily: "inherit",
                            display: "flex", alignItems: "center", gap: "6px",
                        }}
                        onClick={() => setBillingPeriod("yearly")}
                    >
                        Yıllık
                        <span style={{
                            background: "linear-gradient(135deg, #22c55e, #16a34a)",
                            color: "#fff", fontSize: "9px", fontWeight: 700,
                            padding: "2px 6px", borderRadius: "5px",
                        }}>%17</span>
                    </button>
                </div>
                <div style={S.pricingGrid}>
                    {displayPlans.map((p, i) => (
                        <div
                            key={p.id}
                            style={{
                                ...S.priceCard(p.color, p.popular),
                                transform: hoveredPlan === i ? "translateY(-4px)" : "none",
                                boxShadow: hoveredPlan === i ? `0 16px 48px ${p.color}20` : p.popular ? "0 6px 24px rgba(99,102,241,0.15)" : "none",
                            }}
                            onMouseEnter={() => setHoveredPlan(i)}
                            onMouseLeave={() => setHoveredPlan(null)}
                        >
                            {p.popular && <div style={S.popularBadge}>EN POPÜLER</div>}
                            <div style={S.priceName}>{p.name}</div>
                            <div style={S.priceDesc}>{p.desc}</div>
                            <div style={{ marginBottom: "4px" }}>
                                <span style={S.priceAmount}>
                                    {billingPeriod === "yearly" ? getYearlyDisplay(p) : p.price}
                                </span>
                                <span style={S.pricePeriod}>
                                    {p.id === "trial" ? " / 14 gün" : billingPeriod === "yearly" ? " /ay (yıllık)" : p.period}
                                </span>
                            </div>
                            <ul style={S.priceFeatures}>
                                {p.features.map((feat, fi) => (
                                    <li key={fi} style={S.priceFeature}>
                                        <span style={S.priceCheck(p.color)}>✓</span>
                                        {feat}
                                    </li>
                                ))}
                            </ul>
                            <button style={S.priceCta(p.color, p.popular)} onClick={onGoToLogin}>
                                {p.cta}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div style={S.divider} />
            <div style={S.section}>
                <h2 style={S.sectionTitle}>Sıkça Sorulan Sorular</h2>
                <p style={S.sectionSub}>Merak ettikleriniz</p>
                <div style={S.faqGrid}>
                    {[
                        { q: "Demo sürem bitince ne olur?", a: "Hesabınız askıya alınır. Verileriniz silinmez, paket satın alarak devam edebilirsiniz." },
                        { q: "Paket yükseltme yapabilir miyim?", a: "Evet, istediğiniz zaman paketinizi yükseltebilirsiniz." },
                        { q: "Ödeme yöntemleri nelerdir?", a: "Kredi kartı, banka kartı ve havale/EFT ile ödeme yapabilirsiniz." },
                        { q: "İptal edebilir miyim?", a: "İstediğiniz zaman iptal edebilirsiniz. Mevcut dönem sonuna kadar kullanırsınız." },
                    ].map((faq, i) => (
                        <div key={i} style={S.faqCard}>
                            <div style={S.faqQ}>
                                <span style={{ color: "#6366f1", fontSize: "14px" }}>❓</span>
                                {faq.q}
                            </div>
                            <div style={S.faqA}>{faq.a}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
const LandingSection = ({ onScrollToLogin }) => {
    const [activeTab, setActiveTab] = useState("home");
    const [apiPlans, setApiPlans] = useState(null);

    // API'den güncel plan bilgilerini çek
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await axios.get("/paytr/plans");
                if (res.data.success && res.data.plans) {
                    const transformed = transformApiPlans(res.data.plans);
                    if (transformed) setApiPlans(transformed);
                }
            } catch (err) {
                console.warn("Plan bilgileri yüklenemedi, fallback kullanılıyor", err.message);
            }
        };
        fetchPlans();
    }, []);

    const handleGoToLogin = () => {
        if (onScrollToLogin) onScrollToLogin();
    };

    return (
        <div style={S.wrapper}>
            {/* ═══ NAVBAR ═══ */}
            <div style={S.navbar}>
                <div style={S.navLogo}>
                    <div style={S.navLogoIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <span style={S.navLogoText}>LUNEXETIC</span>
                </div>
                <div style={S.navTabs}>
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            style={S.navTab(activeTab === tab.id)}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span style={{ fontSize: "12px" }}>{tab.icon}</span>
                            {tab.label}
                            {activeTab === tab.id && <div style={S.navTabIndicator} />}
                        </button>
                    ))}
                </div>
                <button style={S.navLoginBtn} onClick={handleGoToLogin}>
                    Giriş Yap →
                </button>
            </div>

            {/* ═══ TAB CONTENT ═══ */}
            <div style={S.contentArea}>
                {activeTab === "home" && <HomeTab onGoToLogin={handleGoToLogin} />}
                {activeTab === "features" && <FeaturesTab />}
                {activeTab === "pricing" && <PricingTab onGoToLogin={handleGoToLogin} plans={apiPlans} />}
            </div>

            {/* Footer */}
            <div style={S.footer}>
                <span>© {new Date().getFullYear()} Lunexetic. Tüm hakları saklıdır.</span>
                <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", textDecoration: "none", transition: "color 0.2s" }}>Gizlilik Politikası</a>
                <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", textDecoration: "none", transition: "color 0.2s" }}>Kullanım Şartları</a>
                <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
                <a href="/cookies" target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", textDecoration: "none", transition: "color 0.2s" }}>Çerez Politikası</a>
                <span style={{ margin: "0 8px", opacity: 0.3 }}>•</span>
                <a href="/distance-sales" target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", textDecoration: "none", transition: "color 0.2s" }}>Mesafeli Satış Sözleşmesi</a>
            </div>
        </div>
    );
};

export default LandingSection;
