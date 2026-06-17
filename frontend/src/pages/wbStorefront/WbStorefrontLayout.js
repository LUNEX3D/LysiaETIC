import React, { useEffect, useState } from "react";
import { Outlet, useParams, useLocation } from "react-router-dom";
import WbStorefrontHeader from "../../components/wbStorefront/WbStorefrontHeader";
import WbStorefrontFooter from "../../components/wbStorefront/WbStorefrontFooter";
import WbStorefrontPopups from "../../components/wbStorefront/WbStorefrontPopups";
import { DawnHeader, DawnFooter } from "../../theme-builder/dawn";
import "../../theme-builder/dawn/dawn-theme.css";
import { WbStorefrontSeoProvider } from "../../components/wbStorefront/WbStorefrontSeoContext";
import { fetchWbSite, fetchWbSiteByDomain } from "../../services/wbPublicApi";
import { fetchPublicProducts } from "../../services/storeApi";
import { WbStorefrontContext } from "../../components/wbStorefront/WbStorefrontContext";
import "../../styles/websiteBuilder/blocks.css";
import "../../styles/wbStorefront.css";

import { isWbCustomDomainHost } from "../../utils/wbStorefrontHost";

function applyThemeVariables(site) {
    const vars = site?.themeVariables || {};
    const root = document.documentElement;
    const map = {
        "--color-primary": vars.primaryColor,
        "--color-secondary": vars.secondaryColor,
        "--color-accent": vars.accentColor,
        "--color-bg": vars.backgroundColor,
        "--color-surface": vars.surfaceColor,
        "--color-text-primary": vars.textPrimary,
        "--color-text-secondary": vars.textSecondary,
        "--color-border": vars.borderColor,
        "--font-body": vars.fontFamily,
        "--font-heading": vars.headingFont,
        "--border-radius": vars.borderRadius,
        "--header-height": vars.headerHeight,
        "--container-width": vars.containerWidth,
    };
    Object.entries(map).forEach(([k, v]) => {
        if (v) root.style.setProperty(k, v);
    });
    if (site?.cssVariables) {
        const styleId = "wb-public-theme-css";
        let el = document.getElementById(styleId);
        if (!el) {
            el = document.createElement("style");
            el.id = styleId;
            document.head.appendChild(el);
        }
        el.textContent = site.cssVariables;
    }
}

export default function WbStorefrontLayout() {
    const { siteSlug } = useParams();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [site, setSite] = useState(null);
    const [navigations, setNavigations] = useState([]);
    const [pages, setPages] = useState([]);
    const [products, setProducts] = useState([]);
    const [popups, setPopups] = useState([]);
    const [siteSeo, setSiteSeo] = useState(null);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const previewToken = new URLSearchParams(window.location.search).get("preview_token") || "";
                const previewParams = previewToken ? { preview_token: previewToken } : {};
                const data = isWbCustomDomainHost() && !siteSlug
                    ? await fetchWbSiteByDomain(previewParams)
                    : await fetchWbSite(siteSlug, previewParams);
                setPreviewMode(!!data.previewMode);
                setSite(data.site);
                setSiteSeo(data.seo || null);
                setNavigations(data.navigations || []);
                setPages(data.pages || []);
                setPopups(data.popups || []);
                applyThemeVariables(data.site);
                if (data.site?.storeSlug) {
                    try {
                        const p = await fetchPublicProducts(data.site.storeSlug);
                        setProducts(p.products || []);
                    } catch {
                        setProducts([]);
                    }
                }
            } catch (e) {
                setError(e.response?.data?.error || "Site yüklenemedi");
            } finally {
                setLoading(false);
            }
        })();
    }, [siteSlug]);

    if (loading) {
        return (
            <div className="wb-sf-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8fafc" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, border: "3px solid #e2e8f0", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: "#64748b", fontSize: 14 }}>Yükleniyor…</p>
                </div>
            </div>
        );
    }
    if (error || !site) {
        const isPreviewExpired = error?.includes("Önizleme") || error?.includes("preview");
        return (
            <div className="wb-sf-error">
                <div className="wb-sf-error__card">
                    <div className="wb-sf-error__icon" aria-hidden>
                        {isPreviewExpired ? "⏱" : "🔍"}
                    </div>
                    <h2>{isPreviewExpired ? "Önizleme Süresi Doldu" : "Site Bulunamadı"}</h2>
                    <p>{error || "Bu adrese ait bir site bulunamadı."}</p>
                    {isPreviewExpired && (
                        <p className="wb-sf-error__hint">Tema editöründen «Taslak önizle» butonuna tekrar tıklayın.</p>
                    )}
                </div>
            </div>
        );
    }

    const slug = site.slug;
    const path = location.pathname;
    const base = isWbCustomDomainHost() ? "" : `/site/${slug}`;
    const pathTail = base && path.startsWith(base) ? path.slice(base.length).replace(/^\/+/, "") : path.replace(/^\/+/, "");
    const pathParts = pathTail ? pathTail.split("/").filter(Boolean) : [];
    const grapesRouteKey = pathParts[0] || "home";
    const grapesSubKeys = ["products", "collections", "blog", "about", "contact", "faq", "cart", "checkout", "search"];
    const isTbv2Site = site.themeBuilderVersion === "v2" && site.editorEngine !== "grapesjs";
    const isV3Site = site.themeBuilderVersion === "v3";
    const isGrapesStore = !isV3Site && (site.editorEngine === "grapesjs" || (!isTbv2Site && !!String(site.grapesHtml || "").trim()));
    const customPageSlug = grapesRouteKey === "page" && pathParts[1] ? pathParts[1] : null;
    const hasGrapesCustomPage = customPageSlug && Object.values(site.grapesPageData || {}).some(
        (p) => p?.html && (p.slug === customPageSlug || p.path === `/page/${customPageSlug}`)
    );
    const hasGrapesSubPage = (grapesSubKeys.includes(grapesRouteKey)
        && !!site.grapesPageData?.[grapesRouteKey]?.html) || hasGrapesCustomPage;
    const isGrapesHome =
        isGrapesStore
        && site.grapesHtml
        && (!pathTail || grapesRouteKey === "home" || path.endsWith(`/site/${slug}`) || path.endsWith(`/site/${slug}/`));
    const isGrapesFullPage = isGrapesStore && (isGrapesHome || hasGrapesSubPage);
    const isPuckHome =
        site.editorEngine === "puck"
        && site.puckData
        && (!path.includes("/page/") || path.endsWith("/page/home") || path.endsWith(`/site/${slug}`) || path.endsWith(`/site/${slug}/`));
    const isVisualHome = isGrapesFullPage || isPuckHome;
    const headerNav = isV3Site && site.v3Theme?.header
        ? {
            items: (site.v3Theme.header.menuItems || []).map((m) => ({
                label: m.label,
                url: m.url,
                children: m.children || [],
            })),
            headerConfig: {
                logoUrl: site.v3Theme.header.logoUrl,
                logoWidth: site.v3Theme.header.logoWidth,
                sticky: site.v3Theme.header.sticky,
                transparent: site.v3Theme.header.transparent,
            },
        }
        : navigations.find((n) => n.position === "header") || { items: [] };
    const footerNav = isV3Site && site.v3Theme?.footer
        ? {
            items: [],
            footerConfig: { blocks: site.v3Theme.footer.blocks || [], copyright: site.v3Theme.footer.copyright },
        }
        : navigations.find((n) => n.position === "footer") || { items: [] };
    const mobileNav = navigations.find((n) => n.position === "mobile") || null;
    const homeTo = base || "/";
    const pageTo = (path) => (path === "/" || !path ? homeTo : `${base}/page/${String(path).replace(/^\//, "")}`);

    const isDawnStore = site.themeVariables?.themePack === "dawn" || site.themeId === "dawn";
    const ctx = {
        site,
        siteSlug: slug,
        storeSlug: site.storeSlug,
        products,
        navigations,
        pages,
        themeVariables: site.themeVariables,
    };

    return (
        <WbStorefrontContext.Provider value={ctx}>
            <WbStorefrontSeoProvider initialSeo={siteSeo}>
            <div className={`wb-sf-root${isDawnStore ? " dawn-theme color-scheme-1" : ""}`} style={{ background: "var(--color-bg, #fff)", color: "var(--color-text-primary, #0f172a)", fontFamily: "var(--font-body, Inter, sans-serif)" }}>
                {previewMode && (
                    <div
                        role="status"
                        style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 9999,
                            background: "#5b4dff",
                            color: "#fff",
                            textAlign: "center",
                            padding: "10px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                        }}
                    >
                        Önizleme modu — Bu değişiklikler yalnızca sizin için görünür. Müşteriler canlı siteyi görür.
                    </div>
                )}
                {!isVisualHome && (isDawnStore ? (
                    <DawnHeader header={{
                        brandName: site.v3Theme?.header?.brandName || site.name,
                        menuItems: headerNav.items || [],
                    }} />
                ) : (
                <WbStorefrontHeader
                    site={site}
                    headerNav={headerNav}
                    mobileNav={mobileNav}
                    headerConfig={headerNav.headerConfig}
                    homeTo={homeTo}
                    pageTo={pageTo}
                    storeSlug={site.storeSlug}
                    siteSlug={slug}
                />
                ))}
                <main className="wb-sf-main">
                    <Outlet />
                </main>
                {!isVisualHome && (isDawnStore ? (
                    <DawnFooter footer={footerNav.footerConfig || { blocks: [], copyright: `© ${site.name}` }} />
                ) : (
                <WbStorefrontFooter
                    site={site}
                    footerNav={footerNav}
                    footerConfig={footerNav.footerConfig}
                    pageTo={pageTo}
                    homeTo={homeTo}
                />
                ))}
                <WbStorefrontPopups popups={popups} siteSlug={slug} />
            </div>
            </WbStorefrontSeoProvider>
        </WbStorefrontContext.Provider>
    );
}
