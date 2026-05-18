import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaBookOpen } from "react-icons/fa";
import { MARKETPLACE_BLOG_SECTIONS } from "../content/marketplaceBlog";
import { getArticlesByCategory } from "../content/blogArticles";
import "../styles/marketplaceBlog.css";

const SLUG_MAP = {
    trendyol: "/trendyol-entegrasyonu",
    hepsiburada: "/hepsiburada-entegrasyonu",
    amazon: "/amazon-entegrasyonu",
    n11: "/n11-entegrasyonu",
    ciceksepeti: "/ciceksepeti-entegrasyonu",
};

export default function MarketplaceBlogSection({ compact = false }) {
    const [activeId, setActiveId] = useState(MARKETPLACE_BLOG_SECTIONS[0].id);
    const navigate = useNavigate();
    const section = MARKETPLACE_BLOG_SECTIONS.find((s) => s.id === activeId) || MARKETPLACE_BLOG_SECTIONS[0];
    const detailPath = SLUG_MAP[activeId];
    const categoryArticles = getArticlesByCategory(activeId).slice(0, 3);

    return (
        <section className={`mp-blog${compact ? " mp-blog--compact" : ""}`} id="blog">
            <div className="mp-blog-header">
                <span className="mp-blog-badge">
                    <FaBookOpen /> Blog & Rehberler
                </span>
                <h2>Pazaryeri E-Ticaret Bilgi Merkezi</h2>
                <p>
                    Trendyol, Hepsiburada, Amazon ve daha fazlası için entegrasyon, stok ve kâr yönetimi
                    rehberleri.
                </p>
            </div>

            <div className="mp-blog-layout">
                <nav className="mp-blog-tabs" aria-label="Pazaryeri konuları">
                    {MARKETPLACE_BLOG_SECTIONS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`mp-blog-tab${activeId === tab.id ? " active" : ""}`}
                            style={{ "--tab-accent": tab.color }}
                            onClick={() => setActiveId(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <article className="mp-blog-panel" style={{ "--panel-accent": section.color }}>
                    <h3>{section.title}</h3>
                    <p className="mp-blog-intro">{section.intro}</p>
                    <div className="mp-blog-topics">
                        {section.topics.map((t, i) => (
                            <div key={i} className="mp-blog-topic">
                                <h4>{t.heading}</h4>
                                <p>{t.body}</p>
                            </div>
                        ))}
                    </div>
                    {section.keywords?.length > 0 && (
                        <div className="mp-blog-keywords">
                            {section.keywords.map((kw) => (
                                <span key={kw} className="mp-blog-kw">
                                    {kw}
                                </span>
                            ))}
                        </div>
                    )}
                    {categoryArticles.length > 0 && (
                        <div className="mp-blog-article-links">
                            <span className="mp-blog-links-title">Öne çıkan yazılar</span>
                            {categoryArticles.map((a) => (
                                <button
                                    key={a.slug}
                                    type="button"
                                    className="mp-blog-article-link"
                                    onClick={() => navigate(`/blog/${a.slug}`)}
                                >
                                    {a.title}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="mp-blog-cta-row">
                        {detailPath && (
                            <button
                                type="button"
                                className="mp-blog-cta"
                                onClick={() => navigate(detailPath)}
                            >
                                {section.label} entegrasyonu <FaArrowRight />
                            </button>
                        )}
                        <button
                            type="button"
                            className="mp-blog-cta mp-blog-cta-secondary"
                            onClick={() => navigate(activeId === "genel" ? "/blog" : `/blog?kategori=${activeId}`)}
                        >
                            Tüm blog yazıları <FaArrowRight />
                        </button>
                    </div>
                </article>
            </div>
        </section>
    );
}
