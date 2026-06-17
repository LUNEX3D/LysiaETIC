import React, { useMemo } from "react";
import SectionRenderer from "../../../components/websiteBuilder/sections/SectionRenderer";
import { DEVICE_WIDTHS } from "../../registry/constants";
import { themeVariablesToStyle } from "../../utils/themeCssVars";
import { DawnSectionRenderer, DawnHeader, DawnFooter, isDawnTheme, isDawnSection } from "../../dawn";
import "../../styles/theme-preview.css";
import "../../dawn/dawn-theme.css";

const SECTION_LABELS = {
    hero: "Hero",
    slider: "Slider",
    "product-grid": "Ürünler",
    "category-grid": "Kategoriler",
    testimonials: "Yorumlar",
    newsletter: "Bülten",
    html: "HTML",
    banner: "Banner",
    image: "Görsel",
    text: "Metin",
    campaign: "Kampanya",
    countdown: "Geri Sayım",
    "dawn-image-banner": "Image Banner",
    "dawn-rich-text": "Rich Text",
    "dawn-featured-collection": "Featured Collection",
    "dawn-collage": "Collage",
    "dawn-video": "Video",
    "dawn-multicolumn": "Multicolumn",
};



function StoreHeader({ header, themeVariables, onNavigate }) {

    const menu = header?.menuItems || [];

    const transparent = header?.transparent;

    return (

        <header

            className="tb-preview-header"

            style={transparent ? { position: "absolute", width: "100%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" } : undefined}

        >

            <div className="tb-preview-header__inner">

                {header?.logoUrl ? (

                    <img src={header.logoUrl} alt="Logo" style={{ height: 32, maxWidth: header.logoWidth || 140 }} />

                ) : (

                    <strong className="tb-preview-header__logo" style={{ color: themeVariables?.primaryColor || "#111" }}>

                        {(header?.brandName || "LOGO").toUpperCase()}

                    </strong>

                )}

                <nav className="tb-preview-header__nav">

                    {menu.map((item) => (

                        <button

                            key={item.id}

                            type="button"

                            className="tb-preview-header__link"

                            onClick={() => onNavigate?.(item.url)}

                        >

                            {item.label}

                        </button>

                    ))}

                </nav>

                <div className="tb-preview-header__icons">

                    <span>🔍</span>

                    <span>👤</span>

                    <span>🛒</span>

                </div>

            </div>

        </header>

    );

}



function StoreFooter({ footer }) {

    const blocks = footer?.blocks || [];

    return (

        <footer className="tb-preview-footer">

            <div className="tb-preview-footer__inner">

                {blocks.map((b) => (

                    <div key={b.id} className="tb-preview-footer__block">

                        <strong style={{ display: "block", marginBottom: 8 }}>{b.type}</strong>

                        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>{b.content?.text || b.content?.heading || ""}</p>

                    </div>

                ))}

                <p className="tb-preview-footer__copy">{footer?.copyright || "© Mağaza"}</p>

            </div>

        </footer>

    );

}



export default function LivePreviewCanvas({

    document,

    activePageKey,

    device,

    canvasWidth,

    siteSlug,

    siteId,

    siteName,

    selection,

    onSelectSection,

    onNavigate,

    products = [],

}) {

    const page = document?.pages?.[activePageKey];

    const sections = activePageKey === "product"

        ? (document?.productPage?.sections || [])

        : (page?.sections || []);

    const themeVariables = document?.globalStyles || {};
    const useDawn = isDawnTheme(document);
    const width = canvasWidth || DEVICE_WIDTHS[device] || DEVICE_WIDTHS.desktop;



    const sortedSections = useMemo(

        () => [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),

        [sections]

    );



    const previewUrl = siteSlug ? `https://${siteSlug}.lysia.shop` : "mağazaönizleme.com";



    const canvasContent = activePageKey === "checkout" ? (

        <div className="tb-preview-checkout">

            <h2>Ödeme Sayfası</h2>

            <p style={{ color: "#64748b", fontSize: 13 }}>Checkout marka renkleri sağ panelden düzenlenir.</p>

            <div style={{ marginTop: 24, padding: 24, border: "1px dashed #e2e8f0", borderRadius: 12, maxWidth: 480, margin: "24px auto" }}>

                <div style={{ height: 12, background: document?.checkout?.primaryColor || themeVariables.primaryColor, borderRadius: 4, marginBottom: 16 }} />

                <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, marginBottom: 8 }} />

                <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, width: "70%" }} />

            </div>

        </div>

    ) : (

        <>
            {useDawn ? (
                <DawnHeader header={document?.header} />
            ) : (
                <StoreHeader header={document?.header} themeVariables={themeVariables} onNavigate={onNavigate} />
            )}
            <main className={useDawn ? "dawn-main" : "tb-preview-main"}>
                {sortedSections.filter((s) => !s.settings?.hidden).map((section) => (
                    <div
                        key={section.id}
                        className={`tb-preview-section${selection?.sectionId === section.id ? " tb-preview-section--selected" : ""}`}
                        onClick={() => onSelectSection?.(section.id)}
                    >
                        <span className="tb-preview-section__badge">
                            {SECTION_LABELS[section.type] || section.type}
                        </span>
                        {useDawn || isDawnSection(section.type) ? (
                            <DawnSectionRenderer section={section} products={products} />
                        ) : (
                            <SectionRenderer
                                mode="editor"
                                section={section}
                                themeVariables={themeVariables}
                                device={device}
                                products={products}
                                siteSlug={siteSlug}
                                siteId={siteId}
                            />
                        )}
                    </div>
                ))}
            </main>
            {useDawn ? (
                <DawnFooter footer={document?.footer} />
            ) : (
                <StoreFooter footer={document?.footer} />
            )}
        </>

    );



    return (

        <div className="tb-browser-frame">

            <div className="tb-browser-frame__shell" style={{ width }}>

                <div className="tb-browser-frame__chrome">

                    <div className="tb-browser-frame__dots">

                        <span /><span /><span />

                    </div>

                    <div className="tb-browser-frame__url">{previewUrl}</div>

                </div>

                <div
                    className={`tb-preview-canvas${useDawn ? " dawn-theme color-scheme-1" : ""}`}
                    style={themeVariablesToStyle(themeVariables)}
                >

                    {canvasContent}

                </div>

            </div>

        </div>

    );

}


