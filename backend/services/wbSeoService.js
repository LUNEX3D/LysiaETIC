"use strict";

const WBPage = require("../models/WBPage");
const WBBlogPost = require("../models/WBBlogPost");
const WBSite = require("../models/WBSite");

function normalizeUrlPath(value, fallback) {
    const raw = String(value || fallback || "").trim() || fallback;
    const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withSlash.replace(/\/+$/, "") || fallback;
}

function getSiteUrlPaths(site) {
    const us = site?.urlSettings || {};
    return {
        productPath: normalizeUrlPath(us.productPath, "/products"),
        categoryPath: normalizeUrlPath(us.categoryPath, "/category"),
        blogPath: normalizeUrlPath(us.blogPath, "/blog"),
        pagePath: normalizeUrlPath(us.pagePath, "/pages"),
    };
}

function buildMetaTags(seoConfig = {}, siteConfig = {}) {
    const title = seoConfig.title || siteConfig.seo?.title || siteConfig.name || "Mağaza";
    const description = seoConfig.description || siteConfig.seo?.description || "";
    const ogImage = seoConfig.ogImage || siteConfig.seo?.ogImage || "";
    const canonical = seoConfig.canonicalUrl || "";

    return {
        title,
        description,
        keywords: seoConfig.keywords || siteConfig.seo?.keywords || "",
        ogTitle: seoConfig.ogTitle || title,
        ogDescription: seoConfig.ogDescription || description,
        ogImage,
        ogType: "website",
        twitterCard: siteConfig.seo?.twitterCard || "summary_large_image",
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: ogImage,
        canonicalUrl: canonical,
        noIndex: seoConfig.noIndex || siteConfig.seo?.noIndex || false,
    };
}

async function generateSitemap(siteId, baseUrl) {
    const [site, products, categories] = await Promise.all([
        WBSite.findById(siteId).select("urlSettings").lean(),
        require("../models/StoreProduct").find({ storeId: siteId, visible: true }).select("slug updatedAt").lean(),
        require("../models/StoreCategory").find({ storeId: siteId }).select("seo.slug updatedAt").lean()
    ]);
    const paths = getSiteUrlPaths(site);

    const [pages, blogPosts] = await Promise.all([
        WBPage.find({ siteId, status: "published", "seo.noIndex": { $ne: true } })
            .select("slug type seo updatedAt")
            .lean(),
        WBBlogPost.find({ siteId, status: "published" })
            .select("slug publishedAt updatedAt")
            .lean(),
    ]);

    const now = new Date().toISOString().split("T")[0];
    const urls = [];

    // Home
    urls.push({ loc: baseUrl, lastmod: now, changefreq: "daily", priority: "1.0" });

    // Static Pages
    for (const page of pages) {
        if (page.type === "home") continue;
        urls.push({
            loc: `${baseUrl}/${page.slug}`,
            lastmod: (page.updatedAt || new Date()).toISOString().split("T")[0],
            changefreq: page.seo?.changeFreq || "weekly",
            priority: String(page.seo?.priority || 0.7),
        });
    }

    // Products
    for (const p of (products || [])) {
        urls.push({
            loc: `${baseUrl}${paths.productPath}/${p.slug}`,
            lastmod: (p.updatedAt || new Date()).toISOString().split("T")[0],
            changefreq: "daily",
            priority: "0.8"
        });
    }

    // Categories
    for (const c of (categories || [])) {
        const cSlug = c.seo?.slug || c.slug;
        if (!cSlug) continue;
        urls.push({
            loc: `${baseUrl}${paths.categoryPath}/${cSlug}`,
            lastmod: (c.updatedAt || new Date()).toISOString().split("T")[0],
            changefreq: "weekly",
            priority: "0.6"
        });
    }

    // Blog
    for (const post of blogPosts) {
        urls.push({
            loc: `${baseUrl}${paths.blogPath}/${post.slug}`,
            lastmod: (post.updatedAt || post.publishedAt || new Date()).toISOString().split("T")[0],
            changefreq: "monthly",
            priority: "0.6",
        });
    }

    const urlElements = urls
        .map(
            (u) =>
                `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
        )
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlElements}\n</urlset>`;
}

function generateRobotsTxt(baseUrl, customRules = "") {
    const lines = [
        "User-agent: *",
        "Allow: /",
        `Disallow: /checkout`,
        `Disallow: /cart`,
        `Disallow: /account`,
        "",
        `Sitemap: ${baseUrl}/sitemap.xml`,
    ];

    if (customRules) {
        lines.push("", customRules);
    }

    return lines.join("\n");
}

function generateProductStructuredData(product, baseUrl, site) {
    const paths = getSiteUrlPaths(site);
    const productUrl = `${baseUrl}${paths.productPath}/${product.slug || product._id}`;
    
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.title || product.name,
        "description": product.description || "",
        "image": product.images || [product.imageUrl || ""],
        "sku": product.sku || "",
        "mpn": product.barcode || "",
        "brand": {
            "@type": "Brand",
            "name": product.brand || site.name
        },
        "offers": {
            "@type": "Offer",
            "price": product.price,
            "priceCurrency": product.currency || site.defaultCurrency || "TRY",
            "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "url": productUrl,
            "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            "itemCondition": "https://schema.org/NewCondition"
        }
    };

    if (product.variants && product.variants.length > 0) {
        jsonLd.offers = product.variants.map(v => ({
            "@type": "Offer",
            "price": v.price,
            "priceCurrency": product.currency || site.defaultCurrency || "TRY",
            "sku": v.sku,
            "availability": v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "url": productUrl
        }));
    }

    return JSON.stringify(jsonLd);
}

function generateBlogStructuredData(post, siteConfig, baseUrl) {
    const paths = getSiteUrlPaths(siteConfig);
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt || "",
        image: post.thumbnailUrl || "",
        author: {
            "@type": "Person",
            name: post.author?.name || siteConfig.name,
        },
        publisher: {
            "@type": "Organization",
            name: siteConfig.name,
            logo: { "@type": "ImageObject", url: siteConfig.logoUrl || "" },
        },
        datePublished: post.publishedAt?.toISOString() || "",
        dateModified: post.updatedAt?.toISOString() || "",
        url: `${baseUrl}${paths.blogPath}/${post.slug}`,
    });
}

function generateOrganizationStructuredData(site, baseUrl) {
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: site.name,
        url: baseUrl,
        logo: site.logoUrl || "",
        contactPoint: {
            "@type": "ContactPoint",
            email: site.contactEmail || "",
            telephone: site.contactPhone || "",
            contactType: "customer service",
        },
        sameAs: Object.values(site.socialLinks || {}).filter(Boolean),
    });
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function generateBreadcrumbStructuredData(crumbs = [], baseUrl) {
    const itemListElement = crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.url.startsWith("http") ? c.url : `${baseUrl}${c.url.startsWith("/") ? "" : "/"}${c.url}`,
    }));
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement,
    });
}

function parseJsonLdStrings(site, pageSeo) {
    const out = [];
    const siteSd = site?.seo?.structuredData;
    if (siteSd) {
        try {
            const parsed = typeof siteSd === "string" ? JSON.parse(siteSd) : siteSd;
            out.push(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        } catch {
            if (typeof siteSd === "string" && siteSd.trim().startsWith("{")) out.push(siteSd.trim());
        }
    }
    const pageSd = pageSeo?.structuredData;
    if (pageSd && typeof pageSd === "string" && pageSd.trim()) {
        try { JSON.parse(pageSd); out.push(pageSd.trim()); } catch { /* skip invalid */ }
    }
    return out;
}

function buildSeoBundle({ metaTags, jsonLd = [], baseUrl }) {
    return {
        metaTags: { ...metaTags, canonicalUrl: metaTags.canonicalUrl || baseUrl },
        jsonLd: Array.isArray(jsonLd) ? jsonLd.filter(Boolean) : [],
        baseUrl,
    };
}

function getSiteBaseUrl(site) {
    if (site.domainStatus === "active" && site.sslStatus === "active" && site.customDomain) {
        return `https://${site.customDomain}`;
    }
    const appDomain = process.env.WB_BASE_DOMAIN || "sites.lysia.com.tr";
    return `https://${site.slug}.${appDomain}`;
}

module.exports = {
    buildMetaTags,
    buildSeoBundle,
    generateSitemap,
    generateRobotsTxt,
    generateProductStructuredData,
    generateBlogStructuredData,
    generateOrganizationStructuredData,
    generateBreadcrumbStructuredData,
    parseJsonLdStrings,
    getSiteBaseUrl,
    getSiteUrlPaths,
    normalizeUrlPath,
};
