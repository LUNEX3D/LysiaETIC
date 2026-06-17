/**
 * Giriş sayfası — Özellikler / Fiyatlandırma / Hakkımızda / İletişim
 */
import React from "react";
import { BRAND_EMAIL } from "../../constants/brand";

const HeroBlock = ({ badge, title, titleAccent, description }) => (
    <div className="lp-hero">
        {badge && <span className="lp-badge">{badge}</span>}
        <h2 className="lp-title">
            {title}
            {titleAccent && (
                <>
                    <br />
                    <span className="lp-title-accent">{titleAccent}</span>
                </>
            )}
        </h2>
        {description && <p className="lp-desc">{description}</p>}
    </div>
);

const FeatureCard = ({ icon, title, text, tags = [] }) => (
    <article className="lp-card">
        <div className="lp-card-icon" aria-hidden>{icon}</div>
        <h4>{title}</h4>
        <p>{text}</p>
        {tags.length > 0 && (
            <div className="lp-tags">
                {tags.map((t) => (
                    <span key={t} className="lp-tag">{t}</span>
                ))}
            </div>
        )}
    </article>
);

const LoginMarketingTabs = ({
    activeTab,
    config = {},
    prices = {},
    onGoHome,
    onGoPricing,
}) => {
    const f = config.sections?.features || {};
    const p = config.sections?.pricing || {};
    const a = config.sections?.about || {};
    const c = config.sections?.contact || {};

    if (activeTab === "features") {
        const highlights = f.highlights || [];
        return (
            <div className="auth-tab-content auth-tab-fullpage lp-page">
                <HeroBlock
                    badge={f.badge}
                    title={f.title}
                    titleAccent={f.titleAccent}
                    description={f.description}
                />
                <div className="lp-grid">
                    {highlights.map((item) => (
                        <FeatureCard key={item.title} {...item} />
                    ))}
                </div>
                <div className="lp-cta">
                    <h3>{f.ctaTitle || "Hemen başlayın"}</h3>
                    <p>{f.ctaText}</p>
                    <button type="button" className="lp-cta-btn" onClick={onGoPricing}>
                        Paketleri incele
                    </button>
                </div>
            </div>
        );
    }

    if (activeTab === "pricing") {
        const pro = prices.pro || { monthly: "599", yearly: "499" };
        const basic = prices.basic || { monthly: "299", yearly: "249" };
        const ent = prices.enterprise || { monthly: "1.499", yearly: "1.199" };
        return (
            <div className="auth-tab-content auth-tab-fullpage lp-page">
                <HeroBlock
                    badge={p.badge}
                    title={p.title}
                    titleAccent={p.titleAccent}
                    description={p.description}
                />
                {p.note && <p className="lp-note">{p.note}</p>}
                <div className="lp-pricing-grid">
                    <div className="lp-price-card">
                        <h3>Starter</h3>
                        <p className="lp-price-amount">Ücretsiz</p>
                        <p className="lp-price-sub">14 gün deneme · sonra {basic.monthly} ₺/ay</p>
                        <ul className="lp-price-list">
                            <li>2 pazaryeri entegrasyonu</li>
                            <li>500 ürün · 2.000 sipariş/ay</li>
                            <li>Temel dashboard</li>
                        </ul>
                    </div>
                    <div className="lp-price-card lp-price-card--pop">
                        <span className="lp-pop-badge">En popüler</span>
                        <h3>Pro</h3>
                        <p className="lp-price-amount">{pro.monthly} ₺<small>/ay</small></p>
                        <p className="lp-price-sub">Yıllık: {pro.yearly} ₺/ay</p>
                        <ul className="lp-price-list">
                            <li>5 pazaryeri · 10.000 ürün</li>
                            <li>e-Arşiv & otomatik fatura</li>
                            <li>Dashtock AI & Radar</li>
                            <li>7/24 destek</li>
                        </ul>
                    </div>
                    <div className="lp-price-card">
                        <h3>Enterprise</h3>
                        <p className="lp-price-amount">{ent.monthly} ₺<small>/ay</small></p>
                        <p className="lp-price-sub">Sınırsız pazaryeri & sipariş</p>
                        <ul className="lp-price-list">
                            <li>Özel API & dedicated destek</li>
                            <li>Gelişmiş raporlama</li>
                            <li>Çoklu kullanıcı</li>
                        </ul>
                    </div>
                </div>
                <div className="lp-cta">
                    <h3>14 gün ücretsiz deneyin</h3>
                    <button type="button" className="lp-cta-btn" onClick={onGoHome}>
                        Kayıt ol
                    </button>
                </div>
            </div>
        );
    }

    if (activeTab === "about") {
        const points = a.points || [];
        return (
            <div className="auth-tab-content auth-tab-fullpage lp-page">
                <HeroBlock
                    badge={a.badge}
                    title={a.title}
                    titleAccent={a.titleAccent}
                    description={a.description}
                />
                <ul className="lp-about-list">
                    {points.map((pt) => (
                        <li key={pt}>{pt}</li>
                    ))}
                </ul>
                <div className="lp-cta">
                    <h3>14 gün ücretsiz deneyin</h3>
                    <button type="button" className="lp-cta-btn" onClick={onGoHome}>
                        Ücretsiz kayıt ol
                    </button>
                </div>
            </div>
        );
    }

    if (activeTab === "contact") {
        const email = c.email || BRAND_EMAIL;
        return (
            <div className="auth-tab-content auth-tab-fullpage lp-page">
                <HeroBlock
                    badge={c.badge}
                    title={c.title}
                    titleAccent={c.titleAccent}
                    description={c.description}
                />
                <div className="lp-contact-grid">
                    {c.phone && (
                        <div className="lp-contact-item">
                            <strong>Telefon</strong>
                            <span>{c.phone}</span>
                        </div>
                    )}
                    <div className="lp-contact-item">
                        <strong>E-posta</strong>
                        <span>{email}</span>
                    </div>
                    {c.address && (
                        <div className="lp-contact-item">
                            <strong>Adres</strong>
                            <span>{c.address}</span>
                        </div>
                    )}
                    {c.workingHours && (
                        <div className="lp-contact-item">
                            <strong>Çalışma saatleri</strong>
                            <span>{c.workingHours}</span>
                        </div>
                    )}
                    {c.whatsapp && (
                        <div className="lp-contact-item">
                            <strong>WhatsApp</strong>
                            <span>{c.whatsapp}</span>
                        </div>
                    )}
                </div>
                <div className="lp-cta">
                    <button type="button" className="lp-cta-btn" onClick={onGoHome}>
                        Giriş sayfasına dön
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default LoginMarketingTabs;
