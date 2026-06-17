/**
 * Unified section renderer — editor preview and live storefront use the same component tree.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { addToPublicCart } from "../../../services/storeApi";
import {
    submitWbForm,
    submitWbFormByDomain,
    fetchWbFormCaptcha,
    fetchWbFormCaptchaByDomain,
} from "../../../services/wbPublicApi";
import { isWbCustomDomainHost } from "../../../utils/wbStorefrontHost";
import { wbHtmlForMode } from "../../../utils/wbSafeHtml";
import { formatPreviewPrice } from "../blocks/BlockRegistry";
import { resolveSectionRenderType } from "../theme/wbSectionApiCompat";
import { normalizeHeroVariant, normalizeGridVariant, isHeroSplitVariant } from "../../../utils/wbSectionVariants";
import { getSectionBlocks, blocksToSliderSlides } from "../theme/wbSectionBlocks";
import WbCartWidget from "../../wbStorefront/WbCartWidget";
import WbCheckoutWidget from "../../wbStorefront/WbCheckoutWidget";
import WbSearchWidget from "../../wbStorefront/WbSearchWidget";

function formatPrice(price, currency = "TRY") {
    const n = Number(price);
    if (Number.isNaN(n)) return price;
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(n);
}

function useContainerStyle(section, device, mode) {
    const content = section.content || {};
    const settings = section.settings || {};
    const mobile = mode === "editor" && (device === "mobile" || device === "tablet") ? (section.mobileOverride || {}) : {};
    return {
        paddingTop: mobile.paddingTop || settings.paddingTop || undefined,
        paddingBottom: mobile.paddingBottom || settings.paddingBottom || undefined,
        backgroundColor: settings.backgroundColor || undefined,
        backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined,
        backgroundSize: settings.backgroundSize || "cover",
        backgroundPosition: settings.backgroundPosition || "center",
        display: settings.hidden ? "none" : undefined,
        opacity: mode === "editor" && settings.hidden ? 0.45 : undefined,
    };
}

function Cta({ mode, to, href, className, style, children }) {
    if (mode === "storefront") {
        if (href?.startsWith("http")) return <a href={href} className={className} style={style}>{children}</a>;
        return <Link to={to || href || "/"} className={className} style={style}>{children}</Link>;
    }
    return <span className={className} style={style}>{children}</span>;
}

function SectionWrap({ mode, className, style, children }) {
    if (mode === "storefront") return <section className={className} style={style}>{children}</section>;
    return <div className={className} style={style}>{children}</div>;
}

export default function SectionRenderer({
    section,
    mode = "editor",
    themeVariables = {},
    device = "desktop",
    isSelected,
    previewProduct,
    products = [],
    product = null,
    relatedProducts = [],
    reviews = [],
    reviewStats = null,
    siteSlug,
    storeSlug,
    siteId,
    pageId,
}) {
    const content = section.content || {};
    const containerStyle = useContainerStyle(section, device, mode);
    const primary = themeVariables?.primaryColor || "#3b82f6";
    const previewProd = previewProduct || product;
    const base = mode === "storefront" ? (isWbCustomDomainHost() ? "" : `/site/${siteSlug}`) : "";
    const linkTo = (path) => {
        if (!path) return base || "/";
        if (path.startsWith("http")) return path;
        if (path.startsWith("/") && !base) return path;
        return `${base}${path}`;
    };

    const editorGridCols = Math.min(4, Math.max(3, Number(content.columns) || 4));
    const cols = mode === "editor" && device === "mobile"
        ? 2
        : mode === "editor"
            ? editorGridCols
            : (content.columns || 4);
    const editorPlaceholderCount = mode === "editor"
        ? (device === "mobile" ? 4 : editorGridCols)
        : Math.min(content.limit || 4, 8);
    const blockType = resolveSectionRenderType(section);
    const rawVariant = content.sectionVariant || content.variant || "classic";

    switch (blockType) {
        case "hero": {
            const variant = normalizeHeroVariant(rawVariant);
            const heroClass = `wb-block-hero wb-hero--${variant}`;
            const isSplit = isHeroSplitVariant(rawVariant, content);
            const heroStyle = {
                minHeight: content.minHeight || "400px",
                background: content.backgroundUrl
                    ? `url(${content.backgroundUrl}) center/cover`
                    : content.backgroundGradient || content.backgroundColor || primary,
                color: content.textColor || "#fff",
                ...containerStyle,
            };
            const heroBody = (
                <>
                    {content.backgroundUrl && (
                        <div className="wb-block-hero-overlay" style={{ background: content.backgroundOverlay || content.overlay || "rgba(0,0,0,0.35)" }} />
                    )}
                    <div className="wb-block-hero-content" style={{ textAlign: content.textAlign || (variant === "fashion" ? "left" : "center"), maxWidth: isSplit ? undefined : 900, margin: mode === "storefront" && !isSplit ? "0 auto" : undefined, padding: mode === "storefront" ? "48px 24px" : undefined }}>
                        {content.heading && <h1 style={{ color: content.textColor || "#fff" }}>{content.heading}</h1>}
                        {content.subheading && <p style={{ color: content.textColor || "#fff" }}>{content.subheading}</p>}
                        {content.ctaText && (
                            <Cta mode={mode} to={linkTo(content.ctaUrl)} className="wb-block-hero-cta" style={{ background: content.ctaBg || primary, color: content.ctaColor || "#fff" }}>
                                {content.ctaText}
                            </Cta>
                        )}
                        {variant === "marketplace" && content.badges?.length > 0 && (
                            <div className="wb-hero-badges">
                                {content.badges.map((b) => <span key={b} className="wb-hero-badge">{b}</span>)}
                            </div>
                        )}
                    </div>
                    {isSplit && <div className="wb-hero-split-visual" aria-hidden="true" />}
                </>
            );
            return (
                <SectionWrap mode={mode} className={heroClass} style={heroStyle}>
                    {heroBody}
                </SectionWrap>
            );
        }

        case "banner":
            return (
                <SectionWrap
                    mode={mode}
                    className="wb-block-banner"
                    style={{
                        minHeight: content.minHeight || "200px",
                        background: content.backgroundUrl ? `url(${content.backgroundUrl}) center/cover` : content.backgroundColor || "#1e293b",
                        color: content.textColor || "#fff",
                        ...containerStyle,
                    }}
                >
                    {content.backgroundUrl && content.showOverlay !== false && <div className="wb-block-hero-overlay" />}
                    <div className="wb-block-banner-content" style={{ textAlign: content.textAlign || "center", padding: mode === "storefront" ? "40px 24px" : undefined }}>
                        {content.heading && <h2>{content.heading}</h2>}
                        {content.text && <p>{content.text}</p>}
                        {content.ctaText && (
                            <Cta mode={mode} to={linkTo(content.ctaUrl || "/products")} className="wb-block-hero-cta">{content.ctaText}</Cta>
                        )}
                    </div>
                </SectionWrap>
            );

        case "slider": {
            const slidesFromBlocks = section.blocks?.length
                ? blocksToSliderSlides(getSectionBlocks(section))
                : (content.slides || []);
            const slide0 = slidesFromBlocks[0] || {};
            const bgStyle = slide0.backgroundUrl
                ? { backgroundImage: `url(${slide0.backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: slide0.backgroundColor || "#3b82f6" };
            return (
                <SectionWrap
                    mode={mode}
                    className="wb-block-slider"
                    style={{ minHeight: content.height || "400px", ...bgStyle, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", ...containerStyle }}
                >
                    <div style={{ textAlign: "center", color: slide0.textColor || "#fff", padding: "40px 20px" }}>
                        <h2 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 12px" }}>{slide0.heading || "Slide 1"}</h2>
                        <p>{slide0.text || ""}</p>
                        {slide0.ctaText && (
                            <Cta mode={mode} to={linkTo(slide0.ctaUrl)} className="wb-block-hero-cta" style={{ marginTop: 24, display: "inline-block" }}>
                                {slide0.ctaText}
                            </Cta>
                        )}
                    </div>
                    {content.showDots && (
                        <div className="wb-slider-dots">
                            {(content.slides || [slide0]).map((_, i) => <div key={i} className={`wb-slider-dot ${i === 0 ? "active" : ""}`} />)}
                        </div>
                    )}
                </SectionWrap>
            );
        }

        case "product-grid": {
            const list = mode === "storefront" && products.length ? products : null;
            const pgVariant = normalizeGridVariant(content.sectionVariant || content.layout, "featured");
            const wrapClass = `wb-block-product-grid wb-product-grid--${pgVariant}`;
            const tabs = content.tabs || ["Yeni", "Çok Satan", "İndirim"];
            return (
                <SectionWrap mode={mode} className={wrapClass} style={{ padding: mode === "storefront" || mode === "editor" ? "40px 24px" : undefined, ...containerStyle }}>
                    {content.heading && <h2 style={mode !== "editor" ? (mode === "storefront" ? { textAlign: "center", marginBottom: 24 } : undefined) : { textAlign: "center", marginBottom: 24 }}>{content.heading}</h2>}
                    {pgVariant === "tabbed" && (
                        <div className="wb-product-tabs">
                            {tabs.map((tab, i) => (
                                <span key={tab} className={`wb-product-tab${i === 0 ? " is-active" : ""}`}>{tab}</span>
                            ))}
                        </div>
                    )}
                    <div className={`wb-product-grid cols-${cols}`}>
                        {list
                            ? list.slice(0, content.limit || 8).map((p) => (
                                <Link key={p._id} to={`${base}/urun/${p.slug}`} className="wb-product-card" style={{ textDecoration: "none", color: "inherit" }}>
                                    {p.images?.[0] ? <img src={p.images[0]} alt="" className="wb-product-card-image" style={{ width: "100%", aspectRatio: 1, objectFit: "cover" }} /> : <div className="wb-product-card-image" style={{ aspectRatio: 1, background: "#e2e8f0" }} />}
                                    <div className="wb-product-card-body">
                                        <div className="wb-product-card-name">{p.title}</div>
                                        {content.showPrice !== false && <div className="wb-product-card-price">{formatPrice(p.price)}</div>}
                                    </div>
                                </Link>
                            ))
                            : Array.from({ length: editorPlaceholderCount }).map((_, i) => (
                                <div key={i} className="wb-product-card wb-product-card--editor-preview">
                                    <div className="wb-product-card-image wb-product-card-image--editor-preview" style={{ background: `hsl(${i * 50}, 40%, 85%)` }} />
                                    <div className="wb-product-card-body">
                                        <div className="wb-product-card-name">Ürün Adı {i + 1}</div>
                                        {content.showPrice !== false && <div className="wb-product-card-price">{formatPreviewPrice(199)}</div>}
                                        {content.showAddToCart !== false && mode === "editor" && <button type="button" className="wb-product-card-btn">Sepete Ekle</button>}
                                    </div>
                                </div>
                            ))}
                    </div>
                    {mode === "storefront" && !list?.length && <p style={{ textAlign: "center", color: "#64748b" }}>Ürünler yakında.</p>}
                </SectionWrap>
            );
        }

        case "category-grid": {
            const cgVariant = normalizeGridVariant(content.sectionVariant || content.layout, "grid");
            const cgClass = `wb-block-category-grid wb-category-grid--${cgVariant}`;
            return (
                <SectionWrap mode={mode} className={cgClass} style={{ padding: mode === "storefront" ? "40px 24px" : undefined, ...containerStyle }}>
                    {content.heading && <h2>{content.heading}</h2>}
                    <div className={`wb-category-grid cols-${mode === "editor" && device === "mobile" ? 2 : content.columns || 3}`}>
                        {(content.items?.length > 0 ? content.items : Array.from({ length: content.columns || 3 }, (_, i) => ({ id: i, label: `Kategori ${i + 1}` }))).map((item, i) => (
                            <div
                                key={item.id || i}
                                className="wb-category-card"
                                style={item.imageUrl
                                    ? { backgroundImage: `url(${item.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                                    : (mode === "editor" ? { background: `hsl(${i * 60}, 40%, 70%)` } : undefined)}
                            >
                                {mode === "editor" && <div className="wb-category-card-overlay" />}
                                <div className="wb-category-card-label">{item.label || item.name || `Kategori ${i + 1}`}</div>
                            </div>
                        ))}
                    </div>
                </SectionWrap>
            );
        }

        case "text":
            if (content.statistics) {
                const stats = content.items || [];
                return (
                    <SectionWrap mode={mode} className="wb-block-statistics" style={containerStyle}>
                        <div className="wb-statistics">
                            {stats.map((s, i) => (
                                <div key={i}>
                                    <div className="wb-statistics__value">{s.value}</div>
                                    <div className="wb-statistics__label">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </SectionWrap>
                );
            }
            if (content.faq && content.items?.length) {
                return (
                    <SectionWrap mode={mode} className="wb-block-faq" style={{ padding: "40px 24px", ...containerStyle }}>
                        {content.html && <div dangerouslySetInnerHTML={{ __html: wbHtmlForMode(content.html, mode) }} />}
                        <div className="wb-faq-accordion" style={{ maxWidth: 720, margin: "0 auto" }}>
                            {content.items.map((item, i) => (
                                <details key={i} open={i === 0}>
                                    <summary>{item.q}</summary>
                                    <p style={{ margin: "8px 0 0", color: "#64748b" }}>{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </SectionWrap>
                );
            }
            return (
                <SectionWrap mode={mode} className="wb-block-text" style={containerStyle}>
                    <div className="wb-block-text-inner" style={{ textAlign: content.textAlign || "left", maxWidth: content.maxWidth || "800px", margin: mode === "storefront" ? "0 auto" : undefined, padding: mode === "storefront" ? "24px" : undefined }} dangerouslySetInnerHTML={{ __html: wbHtmlForMode(content.html || (mode === "editor" ? "<p>İçerik</p>" : ""), mode) }} />
                </SectionWrap>
            );

        case "image-with-text": {
            const layout = content.layout || "image-left";
            const imageFirst = layout !== "image-right";
            const imageCol = (
                <div className="wb-iwt-visual" key="img">
                    {content.url ? (
                        <img src={content.url} alt={content.altText || content.heading || ""} />
                    ) : mode === "editor" ? (
                        <div className="wb-iwt-placeholder">Görsel</div>
                    ) : null}
                </div>
            );
            const textCol = (
                <div className="wb-iwt-body" key="txt">
                    {content.heading && <h2>{content.heading}</h2>}
                    {content.html && (
                        <div className="wb-block-text-inner" dangerouslySetInnerHTML={{ __html: wbHtmlForMode(content.html, mode) }} />
                    )}
                </div>
            );
            return (
                <SectionWrap mode={mode} className="wb-block-image-with-text" style={containerStyle}>
                    <div className="wb-iwt-grid">
                        {imageFirst ? [imageCol, textCol] : [textCol, imageCol]}
                    </div>
                </SectionWrap>
            );
        }

        case "image":
            return (
                <SectionWrap mode={mode} style={{ textAlign: "center", padding: "24px", ...containerStyle }}>
                    {content.url ? (
                        <img src={content.url} alt={content.altText || ""} style={{ width: content.width || "100%", maxWidth: content.maxWidth || "100%", borderRadius: content.borderRadius || themeVariables?.borderRadius || "8px" }} />
                    ) : mode === "editor" ? (
                        <div style={{ height: 200, background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, color: "#9ca3af" }}>Görsel seçin</div>
                    ) : null}
                </SectionWrap>
            );

        case "video": {
            const embed = content.url && content.type === "youtube"
                ? `https://www.youtube.com/embed/${content.url.replace(/.*(?:v=|\/)([\w-]{11}).*/, "$1")}`
                : content.url;
            return (
                <SectionWrap mode={mode} style={{ padding: "24px", ...containerStyle }}>
                    {embed && mode === "storefront" ? (
                        <iframe title="video" src={embed} style={{ width: "100%", aspectRatio: content.aspectRatio || "16/9", border: 0, borderRadius: 8 }} allowFullScreen />
                    ) : (
                        <div style={{ background: "#0f172a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "16/9", color: "#fff", fontSize: 40 }}>▶️</div>
                    )}
                </SectionWrap>
            );
        }

        case "testimonials":
            return (
                <SectionWrap mode={mode} className="wb-block-testimonials" style={containerStyle}>
                    {content.heading && <h2>{content.heading}</h2>}
                    <div className="wb-testimonials-grid">
                        {(content.items || []).map((item) => (
                            <div key={item.id || item.name} className="wb-testimonial-card">
                                <div className="wb-testimonial-stars">{"★".repeat(item.stars || 5)}</div>
                                <p className="wb-testimonial-text">{item.text}</p>
                                <div className="wb-testimonial-author">{item.name}</div>
                            </div>
                        ))}
                    </div>
                </SectionWrap>
            );

        case "newsletter":
            return (
                <SectionWrap mode={mode} className="wb-block-newsletter" style={{ background: content.backgroundColor || primary, color: content.textColor || "#fff", padding: mode === "storefront" ? "48px 24px" : undefined, ...containerStyle }}>
                    <div style={mode === "storefront" ? { maxWidth: 560, margin: "0 auto", textAlign: "center" } : undefined}>
                        {content.heading && <h2>{content.heading}</h2>}
                        {content.subtext && <p>{content.subtext}</p>}
                        <div className="wb-newsletter-form">
                            <input className="wb-newsletter-input" placeholder={content.placeholder || "E-posta"} readOnly={mode === "editor"} />
                            <span className="wb-newsletter-btn">{content.buttonText || "Abone Ol"}</span>
                        </div>
                    </div>
                </SectionWrap>
            );

        case "contact":
            if (mode === "storefront") {
                return <StorefrontContactBlock section={section} siteSlug={siteSlug} siteId={siteId} pageId={pageId} containerStyle={containerStyle} content={content} />;
            }
            return (
                <SectionWrap mode={mode} className="wb-block-contact" style={containerStyle}>
                    <div className="wb-contact-form">
                        {content.heading && <h2>{content.heading}</h2>}
                        {(content.fields || ["name", "email", "message"]).map((field) => (
                            <div key={field} className="wb-contact-field">
                                <label>{field}</label>
                                {field === "message" ? <textarea className="wb-contact-input" rows={4} readOnly /> : <input className="wb-contact-input" readOnly />}
                            </div>
                        ))}
                        <button type="button" className="wb-contact-submit">{content.submitText || "Gönder"}</button>
                    </div>
                </SectionWrap>
            );

        case "countdown":
            return (
                <SectionWrap mode={mode} className="wb-block-countdown" style={containerStyle}>
                    {content.heading && <h2>{content.heading}</h2>}
                    {content.subtext && <p style={{ color: "#64748b" }}>{content.subtext}</p>}
                    <div className="wb-countdown-units">
                        {[["07", content.labelDays || "Gün"], ["23", content.labelHours || "Saat"], ["45", content.labelMinutes || "Dakika"], ["12", content.labelSeconds || "Saniye"]].map(([val, label]) => (
                            <div key={label} className="wb-countdown-unit">
                                <div className="wb-countdown-value">{val}</div>
                                {content.showLabels !== false && <div className="wb-countdown-label">{label}</div>}
                            </div>
                        ))}
                    </div>
                </SectionWrap>
            );

        case "campaign":
            return (
                <SectionWrap
                    mode={mode}
                    style={{ background: content.backgroundColor || "#dc2626", color: content.textColor || "#fff", minHeight: content.minHeight || "160px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 20px", ...containerStyle }}
                >
                    <div>
                        {content.badgeText && <span style={{ background: "rgba(0,0,0,0.2)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{content.badgeText}</span>}
                        <h2>{content.heading || "Kampanya"}</h2>
                        <p style={{ fontSize: 48, fontWeight: 900 }}>{content.discount || "%50"}</p>
                        {content.ctaText && <Cta mode={mode} to={linkTo(content.ctaUrl)} className="wb-block-hero-cta">{content.ctaText}</Cta>}
                    </div>
                </SectionWrap>
            );

        case "html":
            return <HtmlSection mode={mode} section={section} containerStyle={containerStyle} content={content} />;

        case "spacer":
            return <div style={{ height: content.height || "60px", background: mode === "editor" ? "repeating-linear-gradient(45deg, #f1f5f9 0px, #f1f5f9 10px, transparent 10px, transparent 20px)" : undefined, opacity: mode === "editor" ? 0.5 : undefined }} />;

        case "divider":
            return (
                <div className="wb-block-divider" style={containerStyle}>
                    <hr className="wb-divider-line" style={{ borderTopColor: content.color || "#e2e8f0", borderTopWidth: content.thickness || "1px", borderTopStyle: content.style || "solid", width: content.width || "100%" }} />
                </div>
            );

        case "product-gallery":
            if (mode === "storefront" && !previewProd) return null;
            return <ProductGallery mode={mode} content={content} product={previewProd} containerStyle={containerStyle} themeVariables={themeVariables} />;

        case "product-price":
            if (mode === "storefront" && !previewProd) return null;
            return <ProductPrice mode={mode} content={content} product={previewProd} containerStyle={containerStyle} primary={primary} />;

        case "product-variants":
            if (mode === "storefront" && !previewProd?.variants?.length) return null;
            return <ProductVariants mode={mode} product={previewProd} containerStyle={containerStyle} />;

        case "add-to-cart":
            if (mode === "storefront") {
                if (!previewProd || !storeSlug) return null;
                return <StorefrontAddToCart product={previewProd} storeSlug={storeSlug} content={content} primary={primary} style={containerStyle} />;
            }
            return (
                <div style={{ padding: "12px 20px", display: "flex", gap: 10, ...containerStyle }}>
                    <button type="button" className="wb-product-card-btn">{content.buttonText || "Sepete Ekle"}</button>
                </div>
            );

        case "product-description":
            if (mode === "storefront" && !previewProd) return null;
            return (
                <div style={{ padding: "16px 20px", ...containerStyle }}>
                    <h3>Açıklama</h3>
                    <div dangerouslySetInnerHTML={{ __html: wbHtmlForMode(previewProd?.description || "<p>Ürün açıklaması</p>", mode) }} />
                </div>
            );

        case "product-specifications": {
            const specs = previewProd?.specifications?.length ? previewProd.specifications : [{ label: "Malzeme", value: "—" }];
            return (
                <div style={{ padding: "16px 20px", ...containerStyle }}>
                    <h3>Özellikler</h3>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <tbody>
                            {specs.map((row) => (
                                <tr key={row.label} style={{ borderTop: "1px solid #e2e8f0" }}>
                                    <td style={{ fontWeight: 600 }}>{row.label}</td>
                                    <td>{row.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        case "product-reviews":
            if (mode === "storefront") {
                return <StorefrontReviews reviews={reviews} stats={reviewStats} content={content} style={containerStyle} />;
            }
            return (
                <div style={{ padding: 20, ...containerStyle }}>
                    <h3>Değerlendirmeler</h3>
                    <span>{previewProd?.rating ?? "—"}</span>
                </div>
            );

        case "related-products":
            return (
                <SectionWrap mode={mode} className="wb-block-product-grid" style={{ padding: mode === "storefront" ? "32px 0" : undefined, ...containerStyle }}>
                    <h2>{content.heading || "Benzer Ürünler"}</h2>
                    <div className={`wb-product-grid cols-${cols}`}>
                        {(mode === "storefront" ? relatedProducts : Array.from({ length: Math.min(content.limit || 4, 4) })).map((p, i) => {
                            if (mode === "storefront") {
                                return (
                                    <Link key={p._id} to={`${base}/urun/${p.slug}`} className="wb-product-card">
                                        {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", aspectRatio: 1, objectFit: "cover" }} />}
                                        <div className="wb-product-card-body">
                                            <div className="wb-product-card-name">{p.title}</div>
                                            <div className="wb-product-card-price">{formatPrice(p.price)}</div>
                                        </div>
                                    </Link>
                                );
                            }
                            return (
                                <div key={i} className="wb-product-card">
                                    <div className="wb-product-card-image" style={{ height: 120, background: "#f1f5f9" }} />
                                    <div className="wb-product-card-name">Ürün {i + 1}</div>
                                </div>
                            );
                        })}
                    </div>
                </SectionWrap>
            );

        case "cart-widget":
            return (
                <SectionWrap mode={mode} className="wb-block-cart-widget" style={containerStyle}>
                    {mode === "editor" && !storeSlug ? (
                        <div style={{ padding: 32, textAlign: "center", background: "#f1f5f9", borderRadius: 12 }}>
                            <strong>Sepet widget</strong>
                            <p style={{ fontSize: 13, color: "#64748b" }}>Canlı sitede sepet burada görünür.</p>
                        </div>
                    ) : (
                        <WbCartWidget storeSlug={storeSlug} siteSlug={siteSlug} />
                    )}
                </SectionWrap>
            );

        case "checkout-widget":
            return (
                <SectionWrap mode={mode} className="wb-block-checkout-widget" style={containerStyle}>
                    {mode === "editor" && !storeSlug ? (
                        <div style={{ padding: 32, textAlign: "center", background: "#f1f5f9", borderRadius: 12 }}>
                            <strong>Ödeme widget</strong>
                            <p style={{ fontSize: 13, color: "#64748b" }}>Canlı sitede checkout formu burada görünür.</p>
                        </div>
                    ) : (
                        <WbCheckoutWidget storeSlug={storeSlug} siteSlug={siteSlug} />
                    )}
                </SectionWrap>
            );

        case "search-widget":
            return (
                <SectionWrap mode={mode} className="wb-block-search-widget" style={containerStyle}>
                    <WbSearchWidget siteSlug={siteSlug} products={products} />
                </SectionWrap>
            );

        default:
            if (mode === "storefront") return null;
            return (
                <div style={{ padding: 40, textAlign: "center", background: "#f8fafc", color: "#94a3b8" }}>
                    Bilinmeyen blok: {blockType}
                </div>
            );
    }
}

function HtmlSection({ mode, section, containerStyle, content }) {
    if (content.announcement) {
        return (
            <div className="wb-announcement wb-announcement--simple" style={{ background: content.backgroundColor || "#0f172a", color: content.textColor || "#fff", ...containerStyle }}>
                {content.text || content.heading}
            </div>
        );
    }
    if (content.trustBadges) {
        const items = content.items || [];
        return (
            <div className="wb-trust-badges-section" style={{ padding: "48px 24px", ...containerStyle }}>
                {content.heading && <h2>{content.heading}</h2>}
                <div className="wb-trust-badges">
                    {items.map((item, i) => (
                        <div key={i} className="wb-trust-badge">
                            <span className="wb-trust-badge__icon">{item.icon || "✓"}</span>
                            <strong>{item.title}</strong>
                            {item.text && <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>{item.text}</p>}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (content.instagramFeed) {
        return (
            <div style={containerStyle}>
                {content.heading && <h3 style={{ textAlign: "center", marginBottom: 16 }}>{content.heading}</h3>}
                <div className="wb-instagram-grid">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="wb-instagram-grid__cell" />)}
                </div>
            </div>
        );
    }
    if (content.footerBlock) {
        const fv = content.variant || content.sectionVariant || "modern";
        return (
            <footer className={`wb-footer-block wb-footer-block--${fv}`} style={containerStyle}>
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    {fv === "minimal" && <p>{content.copyright || "© Mağaza"}</p>}
                    {fv === "modern" && (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginBottom: 24 }}>
                                {["Mağaza", "Yardım", "İletişim"].map((col) => <div key={col}><strong>{col}</strong><p style={{ marginTop: 8, color: "#64748b" }}>Linkler</p></div>)}
                            </div>
                            <p>{content.copyright || "© Mağaza"}</p>
                        </>
                    )}
                    {fv === "marketplace" && (
                        <>
                            <p style={{ textAlign: "center" }}>{content.copyright || "© Marketplace"}</p>
                            {content.showPayments !== false && (
                                <div className="wb-footer-payments">
                                    {["Visa", "Mastercard", "Troy"].map((p) => <span key={p} className="wb-te-chrome-pay-badge">{p}</span>)}
                                </div>
                            )}
                        </>
                    )}
                    {fv === "luxury" && <p>{content.copyright || "© LUXURY"}</p>}
                </div>
            </footer>
        );
    }
    if (content.marquee) {
        const text = content.text || content.html || "";
        const duration = Math.max(8, 400 - (content.speed ?? 200));
        return (
            <div className="wb-block-marquee" style={{ background: content.backgroundColor || "#000", color: content.textColor || "#fff", overflow: "hidden", whiteSpace: "nowrap", padding: "10px 0", fontSize: `${content.fontSize ?? 30}px`, fontWeight: 700, ...containerStyle }}>
                <div style={{ display: "inline-flex", gap: `${content.gap ?? 100}px`, animation: `wb-marquee-scroll ${duration}s linear infinite` }}>
                    {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ flexShrink: 0 }}>{text}</span>)}
                </div>
            </div>
        );
    }
    if (content.brandLogos) {
        const logos = content.logos || [{ name: "Marka 1" }, { name: "Marka 2" }];
        return (
            <div style={{ padding: "32px 24px", ...containerStyle }}>
                {content.heading && <h3 style={{ textAlign: "center" }}>{content.heading}</h3>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
                    {logos.map((logo, i) => (
                        <div key={i} style={{ padding: "8px 16px", border: "1px solid #e4e4e7", borderRadius: 8 }}>{logo.name}</div>
                    ))}
                </div>
            </div>
        );
    }
    if (content.loginForm) {
        return <div className="wb-block-login-mock" style={{ padding: "48px 24px", ...containerStyle }}>Üye girişi (önizleme)</div>;
    }
    if (content.html) {
        if (mode === "storefront") {
            return <section className="wb-block-html" style={containerStyle} dangerouslySetInnerHTML={{ __html: wbHtmlForMode(content.html, "storefront") }} />;
        }
        return (
            <div className="wb-block-html wb-block-html--editor" style={{ padding: "16px 20px", ...containerStyle }}>
                <div dangerouslySetInnerHTML={{ __html: wbHtmlForMode(content.html, "editor") }} />
            </div>
        );
    }
    return (
        <div style={{ padding: "24px 20px", background: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: 8, textAlign: "center", color: "#94a3b8", fontSize: 13, ...containerStyle }}>
            Duyuru veya özel metin — içeriği sağ panelden düzenleyin
        </div>
    );
}

function ProductGallery({ mode, content, product, containerStyle, themeVariables }) {
    const images = product?.images?.length ? product.images : [{ url: "" }];
    const radius = themeVariables?.borderRadius || "8px";
    if (mode === "storefront") {
        return (
            <div className="wb-sf-product-gallery" style={containerStyle}>
                <div className="wb-sf-gallery-main">
                    {images[0]
                        ? <img src={images[0]} alt={product?.title || ""} className="wb-sf-gallery-main__img" style={{ borderRadius: radius }} />
                        : <div className="wb-sf-gallery-main__placeholder" style={{ borderRadius: radius }} />
                    }
                </div>
                {images.length > 1 && (
                    <div className="wb-sf-gallery-thumbs">
                        {images.slice(0, 6).map((img, i) => (
                            <button key={i} type="button" className={`wb-sf-gallery-thumb${i === 0 ? " active" : ""}`}
                                style={{ borderRadius: `calc(${radius} / 2)` }}
                                onClick={(e) => {
                                    const main = e.currentTarget.closest(".wb-sf-product-gallery")?.querySelector(".wb-sf-gallery-main__img");
                                    if (main) main.src = img;
                                    e.currentTarget.closest(".wb-sf-gallery-thumbs")?.querySelectorAll(".wb-sf-gallery-thumb").forEach((t) => t.classList.remove("active"));
                                    e.currentTarget.classList.add("active");
                                }}
                            >
                                <img src={img} alt="" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className="wb-block-product-gallery" style={{ display: "flex", gap: 12, padding: 16, ...containerStyle }}>
            <div style={{ flex: 1, aspectRatio: "1", background: "#e2e8f0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Ana görsel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 64 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 64, height: 64, background: "#f1f5f9", borderRadius: 6 }} />)}
            </div>
        </div>
    );
}

function ProductPrice({ mode, content, product, containerStyle, primary }) {
    const price = product?.salePrice ?? product?.price;
    const original = product?.price && product?.salePrice && product.salePrice < product.price ? product.price : null;
    const discount = original ? Math.round((1 - price / original) * 100) : 0;
    const fmt = (p) => mode === "storefront" ? formatPrice(p) : formatPreviewPrice(p);
    return (
        <div style={{ padding: "16px 20px", ...containerStyle }}>
            <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800, lineHeight: 1.2, margin: "0 0 12px", color: "var(--color-text-primary, #0f172a)" }}>
                {product?.name || product?.title || "Ürün Adı"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: original ? "#dc2626" : (primary || "#3b82f6") }}>
                    {fmt(price)}
                </span>
                {original && content.showDiscount !== false && (
                    <>
                        <span style={{ fontSize: 18, color: "#94a3b8", textDecoration: "line-through" }}>{fmt(original)}</span>
                        <span style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                            %{discount} İndirim
                        </span>
                    </>
                )}
            </div>
            {product?.sku && (
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>SKU: {product.sku}</p>
            )}
        </div>
    );
}

function ProductVariants({ mode, product, containerStyle }) {
    const variants = product?.variants?.length ? product.variants : [];
    const [selected, setSelected] = useState({});
    if (!variants.length && mode === "storefront") return null;
    const displayVariants = variants.length ? variants : [{ label: "Beden", values: ["XS", "S", "M", "L", "XL"] }];
    const isColor = (label) => ["renk", "color", "colours", "colours"].includes(String(label).toLowerCase());
    return (
        <div style={{ padding: "12px 20px", ...containerStyle }}>
            {displayVariants.map((v) => {
                const key = v.key || v.label || v.name;
                const colorMode = isColor(v.label || v.name);
                return (
                    <div key={key} style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--color-text-primary, #0f172a)" }}>
                            {v.label || v.name}
                            {selected[key] && <span style={{ fontWeight: 400, marginLeft: 8, color: "#64748b" }}>: {selected[key]}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(v.values || []).map((val) => (
                                <button key={val} type="button"
                                    onClick={() => setSelected((s) => ({ ...s, [key]: val }))}
                                    style={{
                                        padding: colorMode ? "0" : "8px 14px",
                                        width: colorMode ? 32 : "auto",
                                        height: colorMode ? 32 : "auto",
                                        border: selected[key] === val ? "2px solid var(--color-primary, #3b82f6)" : "1px solid #e2e8f0",
                                        borderRadius: colorMode ? "50%" : "var(--border-radius, 8px)",
                                        fontSize: 13, fontWeight: 600,
                                        cursor: "pointer",
                                        background: colorMode ? val : (selected[key] === val ? "var(--color-primary, #3b82f6)" : "#fff"),
                                        color: selected[key] === val && !colorMode ? "#fff" : "var(--color-text-primary, #0f172a)",
                                        transition: "all 0.15s",
                                    }}
                                    title={colorMode ? val : undefined}
                                >
                                    {colorMode ? null : val}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function StorefrontAddToCart({ product, storeSlug, content, primary, style }) {
    const [qty, setQty] = useState(1);
    const [msg, setMsg] = useState("");
    const add = async () => {
        try {
            await addToPublicCart(storeSlug, product._id, qty);
            setMsg("Sepete eklendi");
        } catch (e) {
            setMsg(e.response?.data?.error || "Eklenemedi");
        }
    };
    const inStock = product?.stock === undefined || product.stock > 0;
    return (
        <div style={{ padding: "16px 20px", ...style }}>
            {!inStock && (
                <div style={{ padding: "10px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                    Stok tükendi
                </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {content.quantitySelector !== false && (
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "var(--border-radius, 8px)", overflow: "hidden" }}>
                        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
                            style={{ width: 40, height: 48, background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#64748b" }}>−</button>
                        <span style={{ width: 40, textAlign: "center", fontWeight: 700, fontSize: 15 }}>{qty}</span>
                        <button type="button" onClick={() => setQty((q) => Math.min(content.maxQuantity || 99, q + 1))}
                            style={{ width: 40, height: 48, background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#64748b" }}>+</button>
                    </div>
                )}
                <button
                    type="button"
                    disabled={!inStock}
                    onClick={add}
                    style={{
                        flex: 1, minWidth: 160, height: 48, background: inStock ? (primary || "#3b82f6") : "#94a3b8",
                        color: "#fff", border: "none", borderRadius: "var(--border-radius, 8px)",
                        fontSize: 15, fontWeight: 700, cursor: inStock ? "pointer" : "not-allowed",
                        transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => { if (inStock) e.target.style.opacity = "0.85"; }}
                    onMouseLeave={(e) => { e.target.style.opacity = "1"; }}
                >
                    {content.buttonText || "Sepete Ekle"}
                </button>
            </div>
            {msg && (
                <p style={{ marginTop: 10, padding: "8px 12px", background: msg.includes("Eklendi") || msg.includes("eklendi") ? "#f0fdf4" : "#fef2f2", color: msg.includes("Eklendi") || msg.includes("eklendi") ? "#16a34a" : "#dc2626", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                    {msg}
                </p>
            )}
        </div>
    );
}

function StorefrontContactBlock({ section, siteSlug, siteId, pageId, containerStyle, content }) {
    const useDomain = isWbCustomDomainHost() && !siteSlug;
    const [fields, setFields] = useState({ name: "", email: "", subject: "", message: "" });
    const [captcha, setCaptcha] = useState({ captchaId: "", question: "" });
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    const [status, setStatus] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadCaptcha = useCallback(async () => {
        try {
            const data = useDomain
                ? await fetchWbFormCaptchaByDomain()
                : await fetchWbFormCaptcha(siteSlug);
            setCaptcha({
                captchaId: data.captchaId || "",
                question: data.question || "",
            });
            setCaptchaAnswer("");
        } catch {
            setCaptcha({ captchaId: "", question: "" });
        }
    }, [siteSlug, useDomain]);

    useEffect(() => {
        if (useDomain || siteSlug) loadCaptcha();
    }, [siteSlug, useDomain, loadCaptcha]);

    const submit = async (e) => {
        e.preventDefault();
        if (!captcha.captchaId) {
            setStatus("Doğrulama yüklenemedi. Sayfayı yenileyin.");
            return;
        }
        setSubmitting(true);
        setStatus("");
        try {
            const body = {
                pageId,
                sectionId: section.id,
                formId: content.formId || "",
                fields,
                captchaId: captcha.captchaId,
                captchaAnswer: Number(captchaAnswer),
                _hp: "",
            };
            const result = useDomain
                ? await submitWbFormByDomain(body)
                : await submitWbForm(siteSlug, body);
            setStatus(result.message || content.successText || "Mesajınız iletildi");
            setFields({ name: "", email: "", subject: "", message: "" });
            await loadCaptcha();
        } catch (err) {
            setStatus(err.response?.data?.error || "Gönderilemedi");
            await loadCaptcha();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="wb-block-contact" style={{ padding: "40px 24px", ...containerStyle }}>
            <form className="wb-contact-form" onSubmit={submit} style={{ maxWidth: 520, margin: "0 auto" }}>
                <input type="text" name="_hp" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px", opacity: 0 }} aria-hidden="true" />
                {content.heading && <h2>{content.heading}</h2>}
                <div className="wb-contact-field"><label>Ad Soyad</label><input className="wb-contact-input" value={fields.name} onChange={(ev) => setFields({ ...fields, name: ev.target.value })} required /></div>
                <div className="wb-contact-field"><label>E-posta</label><input type="email" className="wb-contact-input" value={fields.email} onChange={(ev) => setFields({ ...fields, email: ev.target.value })} required /></div>
                <div className="wb-contact-field"><label>Mesaj</label><textarea className="wb-contact-input" rows={4} value={fields.message} onChange={(ev) => setFields({ ...fields, message: ev.target.value })} required /></div>
                {captcha.question && (
                    <div className="wb-contact-field">
                        <label>Doğrulama: {captcha.question}</label>
                        <input
                            className="wb-contact-input"
                            type="number"
                            inputMode="numeric"
                            value={captchaAnswer}
                            onChange={(ev) => setCaptchaAnswer(ev.target.value)}
                            required
                        />
                    </div>
                )}
                <button type="submit" className="wb-contact-submit" disabled={submitting || !captcha.captchaId}>
                    {submitting ? "Gönderiliyor…" : (content.submitText || "Gönder")}
                </button>
                {status && <p role="status">{status}</p>}
            </form>
        </section>
    );
}

function StorefrontReviews({ reviews, stats, content, style }) {
    const list = reviews || [];
    return (
        <section style={style}>
            {content.showSummary && stats && <p><strong>{Number(stats.average || 0).toFixed(1)}</strong> / 5 ({stats.count || 0})</p>}
            {list.map((r) => (
                <div key={r._id} style={{ borderBottom: "1px solid #e2e8f0", padding: "12px 0" }}>
                    <div>{"★".repeat(r.rating || 5)}</div>
                    <p>{r.comment || r.text}</p>
                </div>
            ))}
            {!list.length && <p style={{ color: "#64748b" }}>Henüz yorum yok.</p>}
        </section>
    );
}
