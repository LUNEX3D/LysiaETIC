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

const FeatureRow = ({ yes, highlight, children }) => (
    <li className={`${yes ? "pr-feat-yes" : "pr-feat-no"}${highlight ? " pr-feat-highlight" : ""}`}>
        <span className={yes ? "pr-check" : "pr-x"}>{yes ? "✓" : "✗"}</span>
        {children}
    </li>
);

const CompareRow = ({ feature, starter, pro, enterprise }) => (
    <div className="pr-compare-row">
        <div className="pr-compare-feature">{feature}</div>
        <div className="pr-compare-val">{starter}</div>
        <div className="pr-compare-val pr-compare-val--pop">{pro}</div>
        <div className="pr-compare-val">{enterprise}</div>
    </div>
);

const LoginMarketingTabs = ({
    activeTab,
    config = {},
    prices = {},
    onGoHome,
    onGoPricing,
    onGoContact,
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
        const pro = prices.pro || { monthly: "599", yearly: "499", oldMonthly: "799" };
        const basic = prices.basic || { monthly: "299", yearly: "249" };
        const ent = prices.enterprise || { monthly: "1.499", yearly: "1.199" };
        const goContact = onGoContact || onGoHome;

        return (
            <div className="auth-tab-content auth-tab-fullpage">
                <div className="ft-hero">
                    <span className="ft-hero-badge">💎 {p.badge || "Şeffaf fiyatlandırma"}</span>
                    <h2 className="ft-hero-title">
                        {p.title || "İşletmenize uygun"}
                        <br />
                        <span className="ft-gradient-text">{p.titleAccent || "paketler"}</span>
                    </h2>
                    <p className="ft-hero-desc">
                        {p.description || "Gizli ücret yok. İstediğiniz zaman yükseltin veya iptal edin. Tüm paketlerde 14 gün deneme."}
                    </p>
                    {p.note && <p className="lp-note">{p.note}</p>}
                </div>

                <div className="pr-grid">
                    <div className="pr-card">
                        <div className="pr-card-header">
                            <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>🌱</div>
                            <h3 className="pr-card-name">Starter</h3>
                            <p className="pr-card-desc">E-ticarete yeni başlayanlar için ideal başlangıç paketi</p>
                            <div className="pr-card-price">
                                <span className="pr-price-amount">Ücretsiz</span>
                                <span className="pr-price-period">14 gün deneme</span>
                            </div>
                            <div className="pr-card-after">Sonrasında <strong>₺{basic.monthly}/ay</strong></div>
                        </div>
                        <div className="pr-card-body">
                            <div className="pr-section-label">Pazaryeri & Ürün</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>2 pazaryeri entegrasyonu</FeatureRow>
                                <FeatureRow yes>500 ürün limiti</FeatureRow>
                                <FeatureRow yes>2.000 sipariş / ay</FeatureRow>
                                <FeatureRow yes>Manuel stok güncelleme</FeatureRow>
                                <FeatureRow yes>Temel ürün yükleme</FeatureRow>
                            </ul>
                            <div className="pr-section-label">Analitik & Raporlama</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>Temel satış dashboard&apos;u</FeatureRow>
                                <FeatureRow yes>Günlük satış raporu</FeatureRow>
                                <FeatureRow no>Gelişmiş analitik</FeatureRow>
                                <FeatureRow no>Excel / PDF export</FeatureRow>
                            </ul>
                            <div className="pr-section-label">AI & Araçlar</div>
                            <ul className="pr-feature-list">
                                <FeatureRow no>Dashtock AI Asistan</FeatureRow>
                                <FeatureRow no>Dashtock Radar</FeatureRow>
                                <FeatureRow no>Fiyat optimizasyonu</FeatureRow>
                                <FeatureRow no>E-fatura entegrasyonu</FeatureRow>
                            </ul>
                            <div className="pr-section-label">Destek</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>E-posta desteği</FeatureRow>
                                <FeatureRow yes>Bilgi bankası erişimi</FeatureRow>
                                <FeatureRow no>Canlı destek</FeatureRow>
                            </ul>
                        </div>
                        <button className="pr-card-btn pr-btn-outline" type="button" onClick={onGoHome}>
                            Ücretsiz Dene
                        </button>
                    </div>

                    <div className="pr-card pr-card--popular">
                        <div className="pr-popular-badge">⭐ EN POPÜLER</div>
                        <div className="pr-card-header">
                            <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #7c5cfc, #a855f7)" }}>🚀</div>
                            <h3 className="pr-card-name">Pro</h3>
                            <p className="pr-card-desc">Büyüyen işletmeler için tam donanımlı profesyonel paket</p>
                            <div className="pr-card-price">
                                {pro.oldMonthly && <span className="pr-price-old">₺{pro.oldMonthly}</span>}
                                <span className="pr-price-amount">₺{pro.monthly}</span>
                                <span className="pr-price-period">/ ay</span>
                            </div>
                            <div className="pr-card-save">Yıllık ödemede ₺{pro.yearly}/ay — tasarruf</div>
                        </div>
                        <div className="pr-card-body">
                            <div className="pr-section-label">Pazaryeri & Ürün</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes><strong>5 pazaryeri</strong> entegrasyonu</FeatureRow>
                                <FeatureRow yes><strong>10.000 ürün</strong> limiti</FeatureRow>
                                <FeatureRow yes><strong>50.000 sipariş</strong> / ay</FeatureRow>
                                <FeatureRow yes>Otomatik stok senkronizasyonu</FeatureRow>
                                <FeatureRow yes>Toplu ürün yükleme & güncelleme</FeatureRow>
                                <FeatureRow yes>Varyant & kategori yönetimi</FeatureRow>
                            </ul>
                            <div className="pr-section-label">Analitik & Raporlama</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>Gelişmiş satış dashboard&apos;u</FeatureRow>
                                <FeatureRow yes>Pazaryeri karşılaştırma raporu</FeatureRow>
                                <FeatureRow yes>Ürün performans analizi</FeatureRow>
                                <FeatureRow yes>Excel & PDF export</FeatureRow>
                            </ul>
                            <div className="pr-section-label">AI & Araçlar</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes highlight><strong>Dashtock AI</strong> — 500 sorgu/ay</FeatureRow>
                                <FeatureRow yes highlight><strong>Dashtock Radar</strong> — Fırsat keşfi</FeatureRow>
                                <FeatureRow yes>Fiyat optimizasyonu & kurallar</FeatureRow>
                                <FeatureRow yes>E-fatura & e-Arşiv entegrasyonu</FeatureRow>
                                <FeatureRow yes>Kargo takibi & etiket basımı</FeatureRow>
                            </ul>
                            <div className="pr-section-label">Destek</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>7/24 canlı destek</FeatureRow>
                                <FeatureRow yes>Öncelikli e-posta desteği</FeatureRow>
                                <FeatureRow yes>Video eğitim içerikleri</FeatureRow>
                            </ul>
                        </div>
                        <button className="pr-card-btn pr-btn-primary" type="button" onClick={onGoHome}>
                            Pro&apos;ya Başla →
                        </button>
                    </div>

                    <div className="pr-card pr-card--enterprise">
                        <div className="pr-card-header">
                            <div className="pr-card-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>👑</div>
                            <h3 className="pr-card-name">Enterprise</h3>
                            <p className="pr-card-desc">Yüksek hacimli satıcılar ve kurumsal firmalar için sınırsız paket</p>
                            <div className="pr-card-price">
                                <span className="pr-price-amount">₺{ent.monthly}</span>
                                <span className="pr-price-period">/ ay</span>
                            </div>
                            <div className="pr-card-save">Yıllık ödemede ₺{ent.yearly}/ay — tasarruf</div>
                        </div>
                        <div className="pr-card-body">
                            <div className="pr-section-label">Pazaryeri & Ürün</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes><strong>Sınırsız</strong> pazaryeri entegrasyonu</FeatureRow>
                                <FeatureRow yes><strong>Sınırsız</strong> ürün</FeatureRow>
                                <FeatureRow yes><strong>Sınırsız</strong> sipariş</FeatureRow>
                                <FeatureRow yes>Otomatik stok senkronizasyonu</FeatureRow>
                                <FeatureRow yes>Toplu ürün yükleme & güncelleme</FeatureRow>
                                <FeatureRow yes>Gelişmiş varyant & kategori</FeatureRow>
                                <FeatureRow yes>Özel API erişimi</FeatureRow>
                            </ul>
                            <div className="pr-section-label">Analitik & Raporlama</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>Pro&apos;daki tüm özellikler</FeatureRow>
                                <FeatureRow yes>Özel rapor oluşturma</FeatureRow>
                                <FeatureRow yes>Otomatik rapor gönderimi</FeatureRow>
                                <FeatureRow yes>Çoklu kullanıcı & rol yönetimi</FeatureRow>
                            </ul>
                            <div className="pr-section-label">AI & Araçlar</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes highlight><strong>Dashtock AI</strong> — Sınırsız sorgu</FeatureRow>
                                <FeatureRow yes highlight><strong>Dashtock Radar</strong> — Tam erişim</FeatureRow>
                                <FeatureRow yes>Gelişmiş fiyat optimizasyonu</FeatureRow>
                                <FeatureRow yes>E-fatura & muhasebe entegrasyonu</FeatureRow>
                                <FeatureRow yes>Kargo takibi & etiket basımı</FeatureRow>
                                <FeatureRow yes>Webhook & özel entegrasyonlar</FeatureRow>
                            </ul>
                            <div className="pr-section-label">Destek</div>
                            <ul className="pr-feature-list">
                                <FeatureRow yes>Dedicated hesap yöneticisi</FeatureRow>
                                <FeatureRow yes>SLA garantisi (%99.9 uptime)</FeatureRow>
                                <FeatureRow yes>Öncelikli teknik destek</FeatureRow>
                                <FeatureRow yes>Özel onboarding eğitimi</FeatureRow>
                            </ul>
                        </div>
                        <button className="pr-card-btn pr-btn-gold" type="button" onClick={goContact}>
                            İletişime Geç →
                        </button>
                    </div>
                </div>

                <div className="ft-section" style={{ marginTop: "48px" }}>
                    <div className="ft-section-label">📋 KARŞILAŞTIRMA</div>
                    <h3 className="ft-section-title">Paketleri Karşılaştırın</h3>
                </div>

                <div className="pr-compare">
                    <div className="pr-compare-row pr-compare-header">
                        <div className="pr-compare-feature">Özellik</div>
                        <div className="pr-compare-val">Starter</div>
                        <div className="pr-compare-val pr-compare-val--pop">Pro</div>
                        <div className="pr-compare-val">Enterprise</div>
                    </div>
                    <CompareRow feature="Pazaryeri Sayısı" starter="2" pro="5" enterprise="Sınırsız" />
                    <CompareRow feature="Ürün Limiti" starter="500" pro="10.000" enterprise="Sınırsız" />
                    <CompareRow feature="Sipariş / Ay" starter="2.000" pro="50.000" enterprise="Sınırsız" />
                    <CompareRow
                        feature="Dashtock AI"
                        starter={<span className="pr-compare-no">✗</span>}
                        pro={<span className="pr-compare-yes">500/ay</span>}
                        enterprise={<span className="pr-compare-yes">Sınırsız</span>}
                    />
                    <CompareRow
                        feature="Dashtock Radar"
                        starter={<span className="pr-compare-no">✗</span>}
                        pro={<span className="pr-compare-yes">✓</span>}
                        enterprise={<span className="pr-compare-yes">✓</span>}
                    />
                    <CompareRow
                        feature="E-Fatura"
                        starter={<span className="pr-compare-no">✗</span>}
                        pro={<span className="pr-compare-yes">✓</span>}
                        enterprise={<span className="pr-compare-yes">✓</span>}
                    />
                    <CompareRow
                        feature="API Erişimi"
                        starter={<span className="pr-compare-no">✗</span>}
                        pro={<span className="pr-compare-no">✗</span>}
                        enterprise={<span className="pr-compare-yes">✓</span>}
                    />
                    <CompareRow feature="Destek" starter="E-posta" pro="7/24 Canlı" enterprise="Dedicated" />
                </div>

                <div className="ft-section" style={{ marginTop: "48px" }}>
                    <div className="ft-section-label">❓ SIKÇA SORULAN SORULAR</div>
                    <h3 className="ft-section-title">Merak Edilenler</h3>
                </div>

                <div className="pr-faq">
                    <div className="pr-faq-item">
                        <h4>Ücretsiz deneme nasıl çalışır?</h4>
                        <p>14 gün boyunca Pro paketinin tüm özelliklerini ücretsiz kullanabilirsiniz. Kredi kartı bilgisi gerekmez. Deneme süresi bittiğinde otomatik olarak Starter pakete geçersiniz.</p>
                    </div>
                    <div className="pr-faq-item">
                        <h4>İstediğim zaman paket değiştirebilir miyim?</h4>
                        <p>Evet! İstediğiniz zaman paketinizi yükseltebilir veya düşürebilirsiniz. Yükseltme anında aktif olur, düşürme ise mevcut dönem sonunda geçerli olur.</p>
                    </div>
                    <div className="pr-faq-item">
                        <h4>Yıllık ödeme avantajı nedir?</h4>
                        <p>Yıllık ödeme tercih ettiğinizde Pro ve Enterprise paketlerde aylık fiyata göre önemli tasarruf sağlarsınız. Yıllık ödemeler iade edilebilir.</p>
                    </div>
                    <div className="pr-faq-item">
                        <h4>Verilerim güvende mi?</h4>
                        <p>Tüm verileriniz AWS altyapısında 256-bit SSL şifreleme ile korunur. KVKK uyumlu veri işleme politikamız mevcuttur. Düzenli yedekleme yapılır.</p>
                    </div>
                </div>

                <div className="ft-cta">
                    <h3>14 Gün Ücretsiz Deneyin</h3>
                    <p>Kredi kartı gerekmez • İstediğiniz zaman iptal edin • Tüm Pro özellikler dahil</p>
                    <button className="ft-cta-btn" type="button" onClick={onGoHome}>
                        Hemen Kayıt Ol →
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
