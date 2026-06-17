import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWbStorefront } from "../../components/wbStorefront/WbStorefrontContext";
import { useWbStorefrontSeo } from "../../components/wbStorefront/WbStorefrontSeoContext";
import { fetchWbPage, fetchWbPageByDomain } from "../../services/wbPublicApi";
import WbPublicBlock from "../../components/wbStorefront/WbPublicBlock";
import WbGrapesPageView from "../../components/wbStorefront/WbGrapesPageView";
import WbPuckPageView from "../../components/wbStorefront/WbPuckPageView";
import { isWbCustomDomainHost } from "../../utils/wbStorefrontHost";
import { trackWbPageView } from "../../services/wbTrackApi";

function isHomeSlug(fixedSlug, pageSlug) {
    const slug = fixedSlug || pageSlug || "home";
    return !fixedSlug && (slug === "home" || slug === "");
}

function hasGrapesHome(site) {
    return String(site?.grapesHtml || "").trim().length > 0;
}

function hasPuckHome(site) {
    return !!(site?.puckData?.content?.length);
}

function isTbv2Site(site) {
    return site?.themeBuilderVersion === "v2" && site?.editorEngine !== "grapesjs";
}

function isV3Site(site) {
    return site?.themeBuilderVersion === "v3";
}

function isGrapesSite(site) {
    if (!site) return false;
    if (site.editorEngine === "grapesjs") return true;
    if (isTbv2Site(site)) return false;
    return String(site.grapesHtml || "").trim().length > 0;
}

function findGrapesPageEntry(site, slug) {
    const key = !slug || slug === "home" ? "home" : slug;
    if (key === "home") return null;
    const pd = site.grapesPageData || {};
    if (pd[key]?.html) return pd[key];
    const bySlug = Object.values(pd).find(
        (p) => p?.slug === key || p?.path === `/${key}` || p?.path === `/page/${key}`
    );
    return bySlug?.html ? bySlug : null;
}

function getGrapesPageForSlug(site, slug) {
    if (!isGrapesSite(site)) return null;
    const key = !slug || slug === "home" ? "home" : slug;
    if (key === "home") {
        if (!hasGrapesHome(site)) return null;
        return { html: site.grapesHtml, css: site.grapesCss };
    }
    const page = findGrapesPageEntry(site, key);
    if (!page?.html) return null;
    return { html: page.html, css: page.css || site.grapesCss };
}

export default function WbSitePage({ fixedSlug }) {
    const { pageSlug } = useParams();
    const navigate = useNavigate();
    const { siteSlug, site, products, storeSlug, themeVariables } = useWbStorefront();
    const { applySeo } = useWbStorefrontSeo();
    const [page, setPage] = useState(null);
    const [error, setError] = useState("");

    const slugNorm = fixedSlug || pageSlug || "home";
    const isHome = isHomeSlug(fixedSlug, pageSlug);
    const grapesContent = getGrapesPageForSlug(site, slugNorm);
    const grapesSiteBase = isWbCustomDomainHost() ? "" : `/site/${siteSlug}`;
    const grapesBaseHref = isWbCustomDomainHost()
        ? `${window.location.origin}/`
        : `${window.location.origin}/site/${siteSlug}/`;

    useEffect(() => {
        if (isV3Site(site) || isTbv2Site(site)) {
            /* v3 / TBv2: gerçek section vitrini — Grapes atlanır */
        } else if (getGrapesPageForSlug(site, slugNorm)) {
            setPage({ _id: `grapes-${slugNorm}`, isHomePage: isHome, sections: [] });
            setError("");
            return;
        } else if (isHome && hasGrapesHome(site)) {
            setPage({ _id: "grapes-home", isHomePage: true, sections: [] });
            setError("");
            return;
        } else if (isHome && hasPuckHome(site)) {
            setPage({ _id: "puck-home", isHomePage: true, sections: [] });
            setError("");
            return;
        }
        (async () => {
            try {
                const slug = fixedSlug || pageSlug || "home";
                const previewParams = (() => {
                    const t = new URLSearchParams(window.location.search).get("preview_token");
                    return t ? { preview_token: t } : {};
                })();
                const data = isWbCustomDomainHost() && !siteSlug
                    ? await fetchWbPageByDomain(slug, previewParams)
                    : await fetchWbPage(siteSlug, slug, previewParams);
                if (data.redirect?.to) {
                    const dest = data.redirect.to.startsWith("http") ? data.redirect.to : data.redirect.to;
                    if (dest.startsWith("http")) window.location.href = dest;
                    else navigate(dest);
                    return;
                }
                setPage(data.page);
                if (data.seo) applySeo(data.seo);
                else if (data.metaTags) applySeo({ metaTags: data.metaTags, jsonLd: [], baseUrl: data.site?.baseUrl });
                const trackSlug = data.site?.slug || siteSlug;
                if (trackSlug) trackWbPageView(trackSlug, { pageSlug: slug, pageId: data.page?._id });
            } catch (e) {
                if (!isV3Site(site) && !isTbv2Site(site) && isHome && hasGrapesHome(site)) {
                    setPage({ _id: "grapes-home", isHomePage: true, sections: [] });
                    return;
                }
                setError(e.response?.data?.error || "Sayfa bulunamadı");
            }
        })();
    }, [siteSlug, pageSlug, fixedSlug, site, isHome, slugNorm]);

    if (!isV3Site(site) && !isTbv2Site(site) && grapesContent) {
        return (
            <WbGrapesPageView
                html={grapesContent.html}
                css={grapesContent.css}
                baseHref={grapesBaseHref}
                siteBasePath={grapesSiteBase}
            />
        );
    }

    if (!isV3Site(site) && !isTbv2Site(site) && isHome && hasGrapesHome(site)) {
        return (
            <WbGrapesPageView
                html={site.grapesHtml}
                css={site.grapesCss}
                baseHref={grapesBaseHref}
                siteBasePath={grapesSiteBase}
            />
        );
    }
    if (isHome && hasPuckHome(site)) {
        return <WbPuckPageView data={site.puckData} />;
    }

    if (error) {
        return (
            <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
                <p style={{ marginBottom: 8 }}>{error}</p>
                {isHome && !hasGrapesHome(site) && (
                    <p style={{ color: "#64748b", fontSize: 14 }}>
                        Görsel editörde değişiklik yaptıktan sonra <strong>Kaydet</strong>’e basın, ardından tekrar önizleyin.
                    </p>
                )}
            </div>
        );
    }
    if (!page) return <p style={{ padding: 24 }}>Yükleniyor…</p>;

    const pageIsHome = slugNorm === "home" || page.slug === "home" || page.slug === "" || page.isHomePage || page.isHome;

    if (pageIsHome && hasPuckHome(site)) {
        return <WbPuckPageView data={site.puckData} />;
    }
    if (pageIsHome && !isV3Site(site) && !isTbv2Site(site) && hasGrapesHome(site)) {
        return (
            <WbGrapesPageView
                html={site.grapesHtml}
                css={site.grapesCss}
                baseHref={grapesBaseHref}
                siteBasePath={grapesSiteBase}
            />
        );
    }

    const sections = [...(page.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
        <article>
            {sections.map((section) => (
                <WbPublicBlock
                    key={section.id}
                    section={section}
                    themeVariables={themeVariables}
                    products={products}
                    siteSlug={siteSlug}
                    storeSlug={storeSlug}
                    siteId={site.id}
                    pageId={page._id}
                />
            ))}
        </article>
    );
}
