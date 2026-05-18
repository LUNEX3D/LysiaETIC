import React, { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    FaArrowLeft,
    FaArrowRight,
    FaBookOpen,
    FaClock,
    FaCalendarAlt,
    FaTag,
} from "react-icons/fa";
import SeoHead from "../components/SeoHead";
import PazarYonetLogo from "../components/brand/PazarYonetLogo";
import { BRAND_NAME } from "../constants/brand";
import {
    BLOG_CATEGORIES,
    BLOG_ARTICLES,
    getArticleBySlug,
    getArticlesByCategory,
    getCategoryMeta,
    formatBlogDate,
} from "../content/blogArticles";
import "../styles/blogPage.css";

function ArticleBody({ sections }) {
    return (
        <div className="blog-prose">
            {sections.map((block, i) => {
                if (block.type === "h2") return <h2 key={i}>{block.text}</h2>;
                if (block.type === "p") return <p key={i}>{block.text}</p>;
                if (block.type === "ul") {
                    return (
                        <ul key={i}>
                            {block.items.map((item, j) => (
                                <li key={j}>{item}</li>
                            ))}
                        </ul>
                    );
                }
                if (block.type === "tip") {
                    return (
                        <div key={i} className="blog-tip">
                            <strong>İpucu:</strong> {block.text}
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
}

function BlogCard({ article, onOpen }) {
    const category = getCategoryMeta(article.categoryId);
    return (
        <article
            className="blog-card"
            style={{ "--card-accent": category?.color }}
            onClick={onOpen}
            onKeyDown={(e) => e.key === "Enter" && onOpen()}
            role="button"
            tabIndex={0}
        >
            <span className="blog-card-cat">{category?.label}</span>
            <h2>{article.title}</h2>
            <p className="blog-card-excerpt">{article.excerpt}</p>
            <div className="blog-card-meta">
                <span>{formatBlogDate(article.date)}</span>
                <span>{article.readTime} dk</span>
            </div>
            <span className="blog-card-link">
                Devamını oku <FaArrowRight />
            </span>
        </article>
    );
}

function ArticleDetail({ article }) {
    const navigate = useNavigate();
    const category = getCategoryMeta(article.categoryId);
    const related = BLOG_ARTICLES.filter(
        (a) => a.categoryId === article.categoryId && a.slug !== article.slug
    ).slice(0, 3);

    return (
        <article className="blog-article">
            <button type="button" className="blog-back" onClick={() => navigate("/blog")}>
                <FaArrowLeft /> Tüm yazılar
            </button>
            <header className="blog-article-header">
                <span className="blog-card-cat" style={{ color: category?.color }}>
                    {category?.label}
                </span>
                <h1>{article.title}</h1>
                <div className="blog-article-meta">
                    <span>
                        <FaCalendarAlt /> {formatBlogDate(article.date)}
                    </span>
                    <span>
                        <FaClock /> {article.readTime} dk okuma
                    </span>
                </div>
                <div className="blog-article-tags">
                    {article.tags.map((t) => (
                        <span key={t} className="blog-tag">
                            <FaTag style={{ marginRight: 4, fontSize: 10 }} />
                            {t}
                        </span>
                    ))}
                </div>
            </header>
            <ArticleBody sections={article.sections} />
            {article.integrationPath && (
                <div className="blog-cta-box">
                    <h3>{category?.label} entegrasyonunu kurun</h3>
                    <p>
                        PazarYonet ile {category?.label} mağazanızı bağlayın; stok, sipariş ve kâr
                        analizini tek panelden yönetin.
                    </p>
                    <Link to={article.integrationPath} className="blog-btn-primary">
                        Entegrasyon sayfası <FaArrowRight />
                    </Link>
                    <Link to="/register" className="blog-btn-ghost" style={{ marginLeft: 12 }}>
                        Ücretsiz dene
                    </Link>
                </div>
            )}
            {related.length > 0 && (
                <section className="blog-related">
                    <h3>İlgili yazılar</h3>
                    <div className="blog-grid">
                        {related.map((r) => (
                            <BlogCard
                                key={r.slug}
                                article={r}
                                onOpen={() => navigate(`/blog/${r.slug}`)}
                            />
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}

function CategoryNav({ active, onSelect }) {
    return (
        <>
            <button
                type="button"
                className={`blog-cat-btn${active === "all" ? " active" : ""}`}
                style={{ "--cat-color": "#0f766e" }}
                onClick={() => onSelect("all")}
            >
                Tümü
            </button>
            {BLOG_CATEGORIES.map((cat) => (
                <button
                    key={cat.id}
                    type="button"
                    className={`blog-cat-btn${active === cat.id ? " active" : ""}`}
                    style={{ "--cat-color": cat.color }}
                    onClick={() => onSelect(cat.id)}
                >
                    {cat.label}
                </button>
            ))}
        </>
    );
}

function BlogTopbar() {
    return (
        <header className="blog-topbar">
            <Link to="/" className="blog-topbar-brand">
                <PazarYonetLogo size={32} />
                {BRAND_NAME}
            </Link>
            <nav className="blog-topbar-nav">
                <Link to="/home">Ana Sayfa</Link>
                <Link to="/blog">Blog</Link>
                <Link to="/login">Giriş</Link>
                <Link to="/register" className="blog-btn-primary">
                    Ücretsiz Dene
                </Link>
            </nav>
        </header>
    );
}

function BlogFooter() {
    return (
        <footer className="blog-footer">
            © {new Date().getFullYear()} {BRAND_NAME} ·{" "}
            <Link to="/privacy" style={{ color: "#64748b" }}>
                Gizlilik
            </Link>
            {" · "}
            <Link to="/terms" style={{ color: "#64748b" }}>
                Kullanım Şartları
            </Link>
        </footer>
    );
}

export default function BlogPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const kategori = searchParams.get("kategori");
    const [categoryFilter, setCategoryFilter] = useState(kategori || "all");

    useEffect(() => {
        if (kategori) setCategoryFilter(kategori);
    }, [kategori]);

    const article = slug ? getArticleBySlug(slug) : null;
    const filteredArticles = useMemo(
        () => getArticlesByCategory(categoryFilter),
        [categoryFilter]
    );

    if (slug && !article) {
        return (
            <div className="blog-page">
                <SeoHead title={`Blog | ${BRAND_NAME}`} />
                <BlogTopbar />
                <div className="blog-hero">
                    <p>Yazı bulunamadı.</p>
                    <Link to="/blog" className="blog-btn-primary">
                        Bloga dön
                    </Link>
                </div>
            </div>
        );
    }

    if (article) {
        return (
            <div className="blog-page">
                <SeoHead
                    title={`${article.title} | ${BRAND_NAME} Blog`}
                    description={article.excerpt}
                    canonical={`https://pazaryonet.com/blog/${article.slug}`}
                />
                <BlogTopbar />
                <div className="blog-layout">
                    <aside className="blog-sidebar">
                        <CategoryNav
                            active={article.categoryId}
                            onSelect={(id) => {
                                if (id === "all") navigate("/blog");
                                else navigate(`/blog?kategori=${id}`);
                            }}
                        />
                    </aside>
                    <main className="blog-main">
                        <ArticleDetail article={article} />
                    </main>
                </div>
                <BlogFooter />
            </div>
        );
    }

    return (
        <div className="blog-page">
            <SeoHead
                title={`Blog | ${BRAND_NAME} — Pazaryeri ve E-Ticaret Rehberleri`}
                description="Trendyol, Hepsiburada, Amazon, N11 entegrasyonu, stok yönetimi, kâr analizi ve e-ticaret otomasyonu hakkında rehber yazılar."
                canonical="https://pazaryonet.com/blog"
            />
            <BlogTopbar />
            <header className="blog-hero">
                <span className="blog-hero-badge">
                    <FaBookOpen /> {BRAND_NAME} Blog
                </span>
                <h1>Pazaryeri & E-Ticaret Bilgi Merkezi</h1>
                <p>
                    Entegrasyon kurulumları, stok senkronizasyonu, komisyon ve kâr hesabı, çoklu
                    kanal stratejileri — satıcılar için uygulamalı rehberler.
                </p>
            </header>
            <div className="blog-layout">
                <aside className="blog-sidebar">
                    <CategoryNav
                        active={categoryFilter}
                        onSelect={(id) => {
                            setCategoryFilter(id);
                            if (id === "all") navigate("/blog");
                            else navigate(`/blog?kategori=${id}`);
                        }}
                    />
                </aside>
                <main className="blog-main">
                    <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>
                        {filteredArticles.length} yazı
                        {categoryFilter !== "all"
                            ? ` · ${getCategoryMeta(categoryFilter)?.label}`
                            : ""}
                    </p>
                    <div className="blog-grid">
                        {filteredArticles.map((a) => (
                            <BlogCard
                                key={a.slug}
                                article={a}
                                onOpen={() => navigate(`/blog/${a.slug}`)}
                            />
                        ))}
                    </div>
                    <div className="blog-cta-box" style={{ marginTop: 40 }}>
                        <h3>Hemen uygulamaya geçin</h3>
                        <p>Rehberlerdeki adımları PazarYonet panelinde dakikalar içinde uygulayın.</p>
                        <Link to="/register" className="blog-btn-primary">
                            14 gün ücretsiz dene <FaArrowRight />
                        </Link>
                    </div>
                </main>
            </div>
            <BlogFooter />
        </div>
    );
}
