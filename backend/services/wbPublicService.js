"use strict";

const mongoose = require("mongoose");
const WBSite = require("../models/WBSite");
const WBPage = require("../models/WBPage");
const WBNavigation = require("../models/WBNavigation");
const WBThemeInstall = require("../models/WBThemeInstall");
const WBProductPage = require("../models/WBProductPage");
const WBProductReview = require("../models/WBProductReview");
const WBThemeDraft = require("../models/WBThemeDraft");
const wbService = require("./websiteBuilderService");
const wbSeoService = require("./wbSeoService");
const wbRender = require("./wbRenderService");
const storeService = require("./storeService");
const { getDefaultProductSections } = require("./wbProductPageService");
const wbPreview = require("./wbPreviewService");
const { getGrapesPageDataForPublic, getGrapesHomeForPublic } = require("./grapesThemeService");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function getSlugParam(req) {
    return req.params.siteSlug || req.params.slug || "";
}

function siteResolveError(req) {
    if (req.wbPreviewFailed) {
        return {
            error: "Önizleme bağlantısı geçersiz veya süresi doldu. Editörden «Taslak önizle» ile yeniden açın.",
            status: 403,
        };
    }
    return { error: "Site bulunamadı", status: 404 };
}

async function resolveSite(req) {
    const slug = getSlugParam(req);
    const previewToken = wbPreview.getPreviewTokenFromRequest(req);

    if (slug) {
        const siteDoc = await WBSite.findOne({ slug }).lean();
        if (!siteDoc) return null;

        if (previewToken) {
            if (wbPreview.validatePreviewToken(previewToken, siteDoc._id)) {
                req.wbPreviewMode = true;
                return siteDoc;
            }
            req.wbPreviewFailed = true;
            return null;
        }

        if (siteDoc.status === "published") return siteDoc;
        return null;
    }

    const host = (req.headers.host || "").replace(/:\d+$/, "").toLowerCase();
    if (!host || host === "localhost" || host.startsWith("127.0.0.1")) {
        return null;
    }

    let site = await wbService.getSiteByDomain(host);
    if (!site && host.startsWith("www.")) {
        site = await wbService.getSiteByDomain(host.slice(4));
    }
    if (!site && !host.startsWith("www.")) {
        site = await wbService.getSiteByDomain(`www.${host}`);
    }
    if (site && previewToken && wbPreview.validatePreviewToken(previewToken, site._id)) {
        req.wbPreviewMode = true;
        const draftSite = await WBSite.findById(site._id).lean();
        return draftSite || site;
    }
    return site;
}

async function getThemeInstall(site) {
    if (!site?.themeInstallId) return null;
    return WBThemeInstall.findById(site.themeInstallId).lean();
}

async function resolveStoreForSite(site) {
    if (site?.storeId) {
        const Store = require("../models/Store");
        const linked = await Store.findById(site.storeId).lean();
        if (linked) return linked;
    }
    if (!site?.userId) return null;
    return storeService.getStoreByUserId(site.userId);
}

async function loadV3ThemeDocument(site, previewMode = false) {
    if (site?.themeBuilderVersion !== "v3") return null;
    const status = previewMode ? "draft" : "published";
    let draft = await WBThemeDraft.findOne({ siteId: site._id, status }).sort({ revision: -1 }).lean();
    if (!draft && previewMode) {
        draft = await WBThemeDraft.findOne({ siteId: site._id, status: "published" }).sort({ revision: -1 }).lean();
    }
    return draft?.document || null;
}

function mapPublicSite(site, store, themePayload, v3Document = null) {
    const baseUrl = wbSeoService.getSiteBaseUrl(site);
    return {
        id: String(site._id),
        name: site.name,
        displayName: site.displayName || site.name,
        description: site.description,
        slug: site.slug,
        themeId: site.themeId,
        themeVariables: themePayload.variables,
        cssVariables: themePayload.cssVariables,
        logoUrl: site.logoUrl,
        faviconUrl: site.faviconUrl,
        seo: site.seo,
        socialLinks: site.socialLinks,
        analytics: site.analytics,
        checkoutSettings: site.checkoutSettings,
        defaultLanguage: site.defaultLanguage,
        defaultCurrency: site.defaultCurrency,
        languages: site.languages,
        currencies: site.currencies,
        contactEmail: site.contactEmail,
        contactPhone: site.contactPhone,
        baseUrl,
        storeSlug: store?.slug || null,
        storeId: store?._id ? String(store._id) : null,
        themeBuilderVersion: site.themeBuilderVersion || "v1",
        editorEngine: site.themeBuilderVersion === "v3" ? "v3" : (site.editorEngine || "grapesjs"),
        v3Theme: v3Document ? {
            header: v3Document.header || {},
            footer: v3Document.footer || {},
            checkout: v3Document.checkout || {},
            globalStyles: v3Document.globalStyles || {},
        } : null,
        ...(() => {
            const grapesHome = getGrapesHomeForPublic(site);
            return { grapesHtml: grapesHome.html, grapesCss: grapesHome.css };
        })(),
        grapesPageData: getGrapesPageDataForPublic(site),
        grapesThemeSlug: site.grapesEditor?.themeSlug || "",
        puckData: site.puckEditor?.data || null,
    };
}

async function getSiteBundle(req) {
    const site = await resolveSite(req);
    if (!site) return siteResolveError(req);

    const wbPopupSvc = require("./wbPopupService");
    const [install, store, navigations, pages, popups] = await Promise.all([
        getThemeInstall(site),
        resolveStoreForSite(site),
        WBNavigation.find({ siteId: site._id }).lean(),
        WBPage.find({
            siteId: site._id,
            ...(req.wbPreviewMode ? {} : { status: "published" }),
            showInNavigation: true,
        })
            .select("title slug type sortOrder isHomePage")
            .sort({ sortOrder: 1 })
            .lean(),
        wbPopupSvc.getActivePopups(site._id, ""),
    ]);

    const themePayload = wbRender.applyVariablesToPayload(site, install);
    const v3Document = await loadV3ThemeDocument(site, req.wbPreviewMode);
    if (v3Document?.globalStyles) {
        themePayload.variables = { ...themePayload.variables, ...v3Document.globalStyles };
        themePayload.cssVariables = wbRender.buildThemeCss(themePayload.variables);
    }
    const baseUrl = wbSeoService.getSiteBaseUrl(site);
    const metaTags = wbSeoService.buildMetaTags(site.seo || {}, site);
    const jsonLd = [wbSeoService.generateOrganizationStructuredData(site, baseUrl)];
    const siteSeo = wbSeoService.buildSeoBundle({ metaTags, jsonLd, baseUrl });

    return {
        site: mapPublicSite(site, store, themePayload, v3Document),
        navigations,
        pages,
        popups: popups || [],
        seo: siteSeo,
        metaTags: siteSeo.metaTags,
        previewMode: !!req.wbPreviewMode,
        theme: {
            themeId: site.themeId,
            variables: themePayload.variables,
            cssVariables: themePayload.cssVariables,
            customizations: install?.customizations || null,
        },
    };
}

async function getThemeBundle(req) {
    const site = await resolveSite(req);
    if (!site) return siteResolveError(req);
    const install = await getThemeInstall(site);
    const themePayload = wbRender.applyVariablesToPayload(site, install);
    return {
        theme: {
            themeId: site.themeId,
            variables: themePayload.variables,
            cssVariables: themePayload.cssVariables,
            customizations: install?.customizations || null,
            installId: install?._id || null,
        },
    };
}

async function getNavigationBundle(req) {
    const site = await resolveSite(req);
    if (!site) return siteResolveError(req);
    const navigations = await WBNavigation.find({ siteId: site._id }).lean();
    return { navigations };
}

async function getPageBundle(req) {
    const site = await resolveSite(req);
    if (!site) return siteResolveError(req);

    const pageSlug = req.params.pageSlug ?? "";
    const pathForRedirect = pageSlug && pageSlug !== "home" ? `/${pageSlug}` : "/";
    const wbRedirectSvc = require("./wbRedirectService");
    const redirect = await wbRedirectSvc.resolveRedirect(site._id, pathForRedirect);
    if (redirect) {
        return {
            redirect: { to: redirect.to, type: redirect.type },
            metaTags: {},
            status: redirect.type === "302" ? 302 : 301,
        };
    }
    const query = { siteId: site._id };
    if (!req.wbPreviewMode) {
        query.status = "published";
    }

    if (!pageSlug || pageSlug === "home") {
        query.isHomePage = true;
    } else {
        query.slug = pageSlug;
    }

    let page = await WBPage.findOne(query).lean();
    if (!page && req.wbPreviewMode) {
        const draftQ = { siteId: site._id, status: "draft" };
        if (!pageSlug || pageSlug === "home") draftQ.isHomePage = true;
        else draftQ.slug = pageSlug;
        page = await WBPage.findOne(draftQ).lean();
    }
    if (!page) {
        const isHome = !pageSlug || pageSlug === "home";
        const grapesHtml = String(site.grapesEditor?.html || "").trim();
        if (isHome && grapesHtml) {
            page = {
                _id: new mongoose.Types.ObjectId(),
                title: site.name || "Anasayfa",
                slug: "",
                type: "home",
                isHomePage: true,
                sections: [],
                status: req.wbPreviewMode ? "draft" : "published",
            };
        } else {
            return { error: "Sayfa bulunamadı", status: 404 };
        }
    }

    const install = await getThemeInstall(site);
    const themePayload = wbRender.applyVariablesToPayload(site, install);
    const v3Document = await loadV3ThemeDocument(site, req.wbPreviewMode);
    if (v3Document?.globalStyles) {
        themePayload.variables = { ...themePayload.variables, ...v3Document.globalStyles };
        themePayload.cssVariables = wbRender.buildThemeCss(themePayload.variables);
    }
    const store = await resolveStoreForSite(site);
    const baseUrl = wbSeoService.getSiteBaseUrl(site);
    const metaTags = wbSeoService.buildMetaTags(page.seo, site);
    metaTags.canonicalUrl = metaTags.canonicalUrl || `${baseUrl}${pathForRedirect === "/" ? "" : pathForRedirect}`;
    const jsonLd = [
        wbSeoService.generateOrganizationStructuredData(site, baseUrl),
        wbSeoService.generateBreadcrumbStructuredData([
            { name: site.name || "Ana Sayfa", url: "/" },
            { name: page.title, url: pathForRedirect },
        ], baseUrl),
        ...wbSeoService.parseJsonLdStrings(site, page.seo),
    ];
    const seo = wbSeoService.buildSeoBundle({ metaTags, jsonLd, baseUrl });

    return {
        page,
        metaTags,
        seo,
        site: mapPublicSite(site, store, themePayload, v3Document),
        theme: {
            variables: themePayload.variables,
            cssVariables: themePayload.cssVariables,
        },
    };
}

async function getSeoBundle(req) {
    const result = await getPageBundle(req);
    if (result.error) return result;
    const baseUrl = result.site.baseUrl;
    return {
        metaTags: result.metaTags,
        page: { title: result.page.title, slug: result.page.slug },
        baseUrl,
    };
}

async function getStoreProducts(site, { limit = 24, filter } = {}) {
    const store = await resolveStoreForSite(site);
    if (!store) return { products: [], storeSlug: null };

    const StoreProduct = require("../models/StoreProduct");
    const q = { storeId: store._id, visible: true };
    if (filter === "featured") {
        q.isFeatured = true;
    }

    const products = await StoreProduct.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 48))
        .select("title slug price compareAtPrice images description stock variants isFeatured")
        .lean();

    return { products, storeSlug: store.slug };
}

async function getStoreProduct(site, productSlug) {
    const store = await resolveStoreForSite(site);
    if (!store) return { error: "Mağaza bağlantısı yok", status: 404 };

    const StoreProduct = require("../models/StoreProduct");
    const product = await StoreProduct.findOne({
        storeId: store._id,
        slug: productSlug,
        visible: true,
    }).lean();

    if (!product) return { error: "Ürün bulunamadı", status: 404 };

    const [reviews, reviewStats] = await Promise.all([
        WBProductReview.find({ siteId: site._id, productId: product._id, status: "approved" })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean(),
        WBProductReview.aggregate([
            { $match: { siteId: site._id, productId: product._id, status: "approved" } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
        ]),
    ]);

    const stats = reviewStats[0] || { avg: 0, count: 0 };

    return { product, store, reviews, reviewStats: { average: stats.avg || 0, count: stats.count || 0 } };
}

async function getPublishedProductPage(siteId) {
    let doc = await WBProductPage.findOne({ siteId: toObjectId(siteId) }).lean();
    if (!doc || doc.status !== "active") {
        return {
            sections: getDefaultProductSections(),
            layoutConfig: { style: "two-column", galleryColumn: 6, infoColumn: 6, stickyInfo: true },
            status: doc?.status || "draft",
        };
    }
    return {
        sections: doc.sections || [],
        layoutConfig: doc.layoutConfig || {},
        status: doc.status,
    };
}

async function getProductBundle(req) {
    const site = await resolveSite(req);
    if (!site) return siteResolveError(req);

    const productSlug = req.params.productSlug;
    const productResult = await getStoreProduct(site, productSlug);
    if (productResult.error) return productResult;

    const productPage = await getPublishedProductPage(site._id);
    const relatedLimit = productPage?.relatedProductsConfig?.limit || 4;

    const [install, related] = await Promise.all([
        getThemeInstall(site),
        getStoreProducts(site, { limit: relatedLimit + 1 }),
    ]);

    const themePayload = wbRender.applyVariablesToPayload(site, install);
    const v3Document = await loadV3ThemeDocument(site, req.wbPreviewMode);
    if (v3Document?.globalStyles) {
        themePayload.variables = { ...themePayload.variables, ...v3Document.globalStyles };
        themePayload.cssVariables = wbRender.buildThemeCss(themePayload.variables);
    }
    const baseUrl = wbSeoService.getSiteBaseUrl(site);
    const urlPaths = wbSeoService.getSiteUrlPaths(site);
    const product = productResult.product;
    const productUrl = `${urlPaths.productPath}/${product.slug || productSlug}`;
    const metaTags = wbSeoService.buildMetaTags(
        {
            title: product.title,
            description: (product.description || "").slice(0, 160),
            ogImage: product.images?.[0] || site.seo?.ogImage,
        },
        site
    );
    metaTags.canonicalUrl = `${baseUrl}${productUrl}`;
    const jsonLd = [
        wbSeoService.generateOrganizationStructuredData(site, baseUrl),
        wbSeoService.generateProductStructuredData({
            name: product.title,
            description: product.description,
            imageUrl: product.images?.[0],
            price: product.price,
            currency: "TRY",
            inStock: (product.stock ?? 0) > 0,
            slug: product.slug,
        }, baseUrl, site),
        wbSeoService.generateBreadcrumbStructuredData([
            { name: site.name, url: "/" },
            { name: "Ürünler", url: urlPaths.productPath },
            { name: product.title, url: productUrl },
        ], baseUrl),
    ];
    const seo = wbSeoService.buildSeoBundle({ metaTags, jsonLd, baseUrl });

    const relatedProducts = (related.products || [])
        .filter((p) => String(p._id) !== String(productResult.product._id))
        .slice(0, 4);

    return {
        product: productResult.product,
        reviews: productResult.reviews,
        reviewStats: productResult.reviewStats,
        productPage,
        relatedProducts,
        metaTags,
        seo,
        site: mapPublicSite(site, productResult.store, themePayload, v3Document),
        storeSlug: productResult.store.slug,
    };
}

module.exports = {
    resolveSite,
    resolveStoreForSite,
    getSiteBundle,
    getThemeBundle,
    getNavigationBundle,
    getPageBundle,
    getSeoBundle,
    getProductBundle,
    getStoreProducts,
};
