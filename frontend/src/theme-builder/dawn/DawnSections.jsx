import React from "react";
import { DAWN_IMAGES } from "./dawnAssets";

function formatPrice(n) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

export function DawnHeader({ header }) {
    const brand = header?.brandName || "DAWN";
    const menu = header?.menuItems || [];
    return (
        <>
            {header?.announcementText && <DawnAnnouncementBar text={header.announcementText} />}
            <div className="dawn-header-wrapper color-scheme-1">
            <div className="page-width">
                <header className="dawn-header">
                    <a href="/" className="dawn-header__heading">{brand}</a>
                    <nav>
                        <ul className="dawn-header__nav">
                            {menu.map((item) => (
                                <li key={item.id || item.label}>
                                    <a href={item.url || "/"}>{item.label}</a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <div className="dawn-header__icons">
                        <span aria-hidden>🔍</span>
                        <span aria-hidden>👤</span>
                        <span aria-hidden>🛒</span>
                    </div>
                </header>
            </div>
        </div>
        </>
    );
}

export function DawnFooter({ footer }) {
    const blocks = footer?.blocks || [];
    return (
        <footer className="dawn-footer color-scheme-1">
            <div className="page-width">
                <div className="dawn-footer__grid">
                    {blocks.map((b) => (
                        <div key={b.id}>
                            <h3>{b.type}</h3>
                            <p>{b.content?.text || b.content?.heading || ""}</p>
                        </div>
                    ))}
                </div>
                <p className="dawn-footer__copy">{footer?.copyright || "© Store"}</p>
            </div>
        </footer>
    );
}

export function DawnImageBanner({ content }) {
    const overlay = (content.imageOverlayOpacity ?? content.overlayOpacity ?? 40) / 100;
    const height = content.imageHeight || "large";
    const position = content.desktopContentPosition || "bottom-center";
    const scheme = content.colorScheme || "scheme-3";
    const posClass = `banner__content--${position}`;

    return (
        <section
            className={`banner banner--${height} banner--desktop-transparent color-${scheme}`}
            style={{ "--banner-overlay": overlay }}
        >
            <div className="banner__media">
                {content.imageUrl && <img src={content.imageUrl} alt={content.heading || ""} />}
            </div>
            <div className={`banner__content ${posClass}`}>
                <div className="banner__box">
                    {content.heading && <h2 className="banner__heading h0">{content.heading}</h2>}
                    {content.text && <div className="banner__text rte" dangerouslySetInnerHTML={{ __html: content.text }} />}
                    {content.buttonLabel && (
                        <div className="banner__buttons">
                            <a href={content.buttonLink || "/products"} className={`button${content.buttonSecondary ? " button--secondary" : ""}`}>
                                {content.buttonLabel}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export function DawnRichText({ content }) {
    return (
        <section className="rich-text color-scheme-1">
            <div className="page-width">
                <div className="rich-text__blocks">
                    {content.heading && <h2 className="h1">{content.heading}</h2>}
                    {content.text && <div className="rte" dangerouslySetInnerHTML={{ __html: content.text }} />}
                </div>
            </div>
        </section>
    );
}

export function DawnFeaturedCollection({ content, products = [] }) {
    const limit = content.productsToShow || 8;
    const cols = content.columnsDesktop || 4;
    const list = products.length
        ? products.slice(0, limit)
        : Array.from({ length: limit }, (_, i) => ({
            _id: `ph-${i}`,
            title: `Example product ${i + 1}`,
            price: 1999 + i * 500,
            images: [DAWN_IMAGES.productPlaceholders[i % DAWN_IMAGES.productPlaceholders.length]],
        }));

    return (
        <section className="collection color-scheme-1">
            <div className="page-width">
                {content.title && <h2 className="collection__title h2">{content.title}</h2>}
                <ul className={`product-grid product-grid--${cols}-col list-unstyled`} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {list.map((p) => (
                        <li key={p._id}>
                            <a className="card-wrapper" href={`/urun/${p.slug || p._id}`}>
                                <div className="card card--standard">
                                    <div className="card__inner">
                                        <div className="card__media">
                                            {p.images?.[0] ? (
                                                <img src={p.images[0]} alt={p.title} />
                                            ) : (
                                                <div className="dawn-card-placeholder" style={{ background: "#e8e8e8" }} />
                                            )}
                                        </div>
                                    </div>
                                    <div className="card__content">
                                        <h3 className="card__heading">{p.title}</h3>
                                        <div className="price"><span className="price__regular">{formatPrice(p.price)}</span></div>
                                    </div>
                                </div>
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export function DawnCollage({ content }) {
    const blocks = content.blocks || [];
    const layout = content.desktopLayout || "left";

    return (
        <section className="collage-wrapper color-scheme-1">
            <div className="page-width">
                {content.heading && <h2 className="h2" style={{ marginBottom: "2.4rem" }}>{content.heading}</h2>}
                <div className={`collage collage--${layout}`}>
                    {blocks.map((block, i) => (
                        <div key={block.id || i} className="collage__item">
                            {block.imageUrl && <img src={block.imageUrl} alt={block.title || ""} />}
                            {(block.title || block.type) && (
                                <div className="collage-card__info">
                                    <p className="collage-card__title">{block.title || block.type}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function DawnVideo({ content }) {
    return (
        <section className="video-section color-scheme-1">
            <div className="page-width">
                {content.heading && <h2 className="h1" style={{ marginBottom: "2rem" }}>{content.heading}</h2>}
                <div className="deferred-media">
                    {content.coverUrl && <img className="deferred-media__poster" src={content.coverUrl} alt="" />}
                    <button type="button" className="deferred-media__play" aria-label="Play video" />
                </div>
            </div>
        </section>
    );
}

export function DawnMulticolumn({ content }) {
    const columns = content.columns || [];

    return (
        <section className="multicolumn color-scheme-1">
            <div className="page-width">
                {content.title && <h2 className="h1" style={{ textAlign: "center", marginBottom: "3rem" }}>{content.title}</h2>}
                <ul className="multicolumn-list multicolumn-list--3">
                    {columns.map((col, i) => (
                        <li key={col.id || i} className="multicolumn-card">
                            {col.imageUrl && <img className="multicolumn-card__image" src={col.imageUrl} alt={col.title || ""} />}
                            <div className="multicolumn-card__info">
                                {col.title && <h3>{col.title}</h3>}
                                {col.text && <div className="rte" dangerouslySetInnerHTML={{ __html: col.text }} />}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export function DawnAnnouncementBar({ text }) {
    if (!text) return null;
    return (
        <div className="dawn-announcement color-scheme-1" style={{ background: "#121212", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: "1.3rem" }}>
            {text}
        </div>
    );
}

export function DawnMainProduct({ content, products }) {
    const p = products?.[0] || { title: "Example product", price: 2999, images: [DAWN_IMAGES.productPlaceholders[0]] };
    return (
        <section className="collection color-scheme-1">
            <div className="page-width" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", padding: "3.6rem 0" }}>
                <div className="card__media">
                    <img src={p.images?.[0]} alt={p.title} style={{ width: "100%", aspectRatio: 1, objectFit: "cover" }} />
                </div>
                <div>
                    <p style={{ fontSize: "1.2rem", textTransform: "uppercase", opacity: 0.7 }}>Vendor</p>
                    <h1 className="h1">{p.title}</h1>
                    <div className="price" style={{ fontSize: "1.8rem", margin: "1.6rem 0" }}>{formatPrice(p.price)}</div>
                    <button type="button" className="button" style={{ marginTop: "1.6rem" }}>Add to cart</button>
                    <div className="rte" style={{ marginTop: "2.4rem", color: "rgba(18,18,18,0.75)" }}>
                        <p>Product description from your catalog.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function DawnCollectionBanner({ content }) {
    return (
        <section className="rich-text color-scheme-1" style={{ padding: "4rem 0 2rem" }}>
            <div className="page-width">
                <h1 className="h1">{content.heading || "Collection"}</h1>
                {content.show_collection_description !== false && (
                    <p style={{ marginTop: "1rem", color: "rgba(18,18,18,0.7)" }}>Collection description</p>
                )}
            </div>
        </section>
    );
}

export function DawnCollectionGrid({ content, products }) {
    return <DawnFeaturedCollection content={{ title: content.heading || "Products", productsToShow: content.products_per_page || 16, columnsDesktop: content.columns_desktop || 4 }} products={products} />;
}

export function DawnCartItems() {
    return (
        <section className="collection color-scheme-1">
            <div className="page-width" style={{ padding: "3.6rem 0" }}>
                <h1 className="h1" style={{ marginBottom: "2.4rem" }}>Your cart</h1>
                <p style={{ color: "#64748b" }}>Cart items will appear here on the live store.</p>
            </div>
        </section>
    );
}

export function DawnRelatedProducts({ content, products }) {
    return <DawnFeaturedCollection content={{ title: content.heading || "You may also like", productsToShow: 4, columnsDesktop: 4 }} products={products} />;
}

export default function DawnSectionRenderer({ section, products }) {
    const c = section.content || {};
    const type = section.type;

    switch (type) {
        case "dawn-image-banner": return <DawnImageBanner content={c} />;
        case "dawn-rich-text": return <DawnRichText content={c} />;
        case "dawn-featured-collection": return <DawnFeaturedCollection content={c} products={products} />;
        case "dawn-collage": return <DawnCollage content={c} />;
        case "dawn-video": return <DawnVideo content={c} />;
        case "dawn-multicolumn": return <DawnMulticolumn content={c} />;
        case "dawn-main-product": return <DawnMainProduct content={c} products={products} />;
        case "dawn-collection-banner": return <DawnCollectionBanner content={c} />;
        case "dawn-collection-grid": return <DawnCollectionGrid content={c} products={products} />;
        case "dawn-cart-items":
        case "dawn-cart-footer": return <DawnCartItems />;
        case "dawn-related-products": return <DawnRelatedProducts content={c} products={products} />;
        case "dawn-announcement-bar": return <DawnAnnouncementBar text={c.announcementText || c.text} />;
        case "dawn-image-with-text": return <DawnRichText content={{ heading: c.heading, text: c.text || c.html }} />;
        case "dawn-search": return <DawnRichText content={{ heading: "Search", text: "<p>Search results</p>" }} />;
        case "dawn-blog": return <DawnRichText content={{ heading: "Blog", text: "<p>Blog posts</p>" }} />;
        case "dawn-contact-form": return <DawnRichText content={{ heading: "Contact", text: "<p>Contact form</p>" }} />;
        case "dawn-404": return <DawnRichText content={{ heading: "404", text: "<p>Page not found</p>" }} />;
        default:
            return (
                <div className="page-width" style={{ padding: "2.4rem 0", textAlign: "center", color: "#94a3b8" }}>
                    Dawn: {c.dawnType || type}
                </div>
            );
    }
}

export function isDawnSection(type) {
    return typeof type === "string" && type.startsWith("dawn-");
}

export function isDawnTheme(document) {
    return document?.globalStyles?.themePack === "dawn"
        || document?.themeSlug === "dawn"
        || (document?.pages?.home?.sections || []).some((s) => isDawnSection(s.type));
}
