"use strict";

const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const WBPage = require("../models/WBPage");
const { normalizeSectionsForDb } = require("./wbSectionNormalize");

const GRAPES_PAGE_MAP = {
    home: {
        type: "home",
        slug: "home",
        title: "Ana Sayfa",
        isHomePage: true,
        isSystemPage: true,
        isDeletable: false,
        showInNavigation: true,
    },
    products: {
        type: "products",
        slug: "products",
        title: "Ürünler",
        isSystemPage: true,
        isDeletable: false,
        showInNavigation: true,
    },
    collections: {
        type: "custom",
        slug: "collections",
        title: "Koleksiyonlar",
        isSystemPage: false,
        isDeletable: true,
        showInNavigation: true,
    },
    blog: {
        type: "blog",
        slug: "blog",
        title: "Blog",
        isSystemPage: true,
        isDeletable: false,
        showInNavigation: true,
    },
    about: {
        type: "about",
        slug: "about",
        title: "Hakkımızda",
        isSystemPage: false,
        isDeletable: true,
        showInNavigation: true,
    },
    contact: {
        type: "contact",
        slug: "contact",
        title: "İletişim",
        isSystemPage: false,
        isDeletable: true,
        showInNavigation: true,
    },
    faq: {
        type: "faq",
        slug: "faq",
        title: "SSS",
        isSystemPage: false,
        isDeletable: true,
        showInNavigation: true,
    },
    cart: {
        type: "cart",
        slug: "cart",
        title: "Sepet",
        isSystemPage: true,
        isDeletable: false,
        showInNavigation: false,
    },
    checkout: {
        type: "checkout",
        slug: "checkout",
        title: "Ödeme",
        isSystemPage: true,
        isDeletable: false,
        showInNavigation: false,
    },
};

function toObjectId(id) {
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

function buildHtmlSections(html, css) {
    const body = String(html || "").trim();
    if (!body) return [];
    const cssBlock = String(css || "").trim();
    const wrapped = cssBlock ? `<style>\n${cssBlock}\n</style>\n${body}` : body;
    return normalizeSectionsForDb([{
        id: `sec_${uuidv4().slice(0, 8)}`,
        type: "html",
        order: 0,
        content: { html: wrapped },
        settings: {
            hidden: false,
            paddingTop: "0px",
            paddingBottom: "0px",
            fullWidth: true,
        },
        version: 1,
    }]);
}

async function upsertWbPage(siteOid, map, sections, resetExisting, sortOrder) {
    const slugCandidates = map.slug === "home" ? ["home", ""] : [map.slug];
    let page = await WBPage.findOne({ siteId: siteOid, slug: { $in: slugCandidates } });

    if (page) {
        if (!resetExisting) return { skipped: true, pageId: page._id, slug: map.slug };
        page.slug = map.slug;
        page.sections = sections;
        page.title = map.title;
        page.type = map.type;
        page.isHomePage = !!map.isHomePage;
        page.isSystemPage = map.isSystemPage !== false;
        page.isDeletable = map.isDeletable !== false;
        page.showInNavigation = map.showInNavigation !== false;
        page.lastEditedAt = new Date();
        await page.save();
        return { updated: true, pageId: page._id, slug: map.slug };
    }

    page = await WBPage.create({
        siteId: siteOid,
        type: map.type,
        title: map.title,
        slug: map.slug,
        sections,
        status: "draft",
        isHomePage: !!map.isHomePage,
        isSystemPage: map.isSystemPage !== false,
        isDeletable: map.isDeletable !== false,
        showInNavigation: map.showInNavigation !== false,
        sortOrder,
    });
    return { created: true, pageId: page._id, slug: map.slug };
}

async function materializeOssGrapesToWbPages(siteId, options = {}) {
    const { homeHtml, sharedCss, pageData = {}, resetExisting = true } = options;
    const siteOid = toObjectId(siteId);
    if (!siteOid) return { error: "Geçersiz site" };

    const updated = [];
    const created = [];
    let sortOrder = 0;

    const homeSections = buildHtmlSections(homeHtml, sharedCss);
    if (homeSections.length) {
        const result = await upsertWbPage(
            siteOid,
            GRAPES_PAGE_MAP.home,
            homeSections,
            resetExisting,
            sortOrder++
        );
        if (!result.skipped) {
            (result.created ? created : updated).push({ slug: "home", pageId: result.pageId });
        }
    }

    for (const [pageId, map] of Object.entries(GRAPES_PAGE_MAP)) {
        if (pageId === "home") continue;
        const html = pageData[pageId]?.html;
        if (!String(html || "").trim()) continue;
        const sections = buildHtmlSections(html, sharedCss);
        const result = await upsertWbPage(siteOid, map, sections, resetExisting, sortOrder++);
        if (result.skipped) continue;
        (result.created ? created : updated).push({ slug: map.slug, pageId: result.pageId });
    }

    for (const [pageId, meta] of Object.entries(pageData)) {
        if (GRAPES_PAGE_MAP[pageId]) continue;
        const html = meta?.html;
        if (!String(html || "").trim()) continue;
        const slug = String(meta?.slug || pageId).replace(/^page-/, "").toLowerCase();
        const map = {
            type: "custom",
            slug,
            title: meta?.label || meta?.navLabel || slug,
            isHomePage: false,
            isSystemPage: false,
            isDeletable: true,
            showInNavigation: meta?.showInNav !== false,
        };
        const sections = buildHtmlSections(html, sharedCss);
        const result = await upsertWbPage(siteOid, map, sections, resetExisting, sortOrder++);
        if (result.skipped) continue;
        (result.created ? created : updated).push({ slug, pageId: result.pageId });
    }

    return { updated, created, pageCount: updated.length + created.length };
}

module.exports = {
    materializeOssGrapesToWbPages,
    GRAPES_PAGE_MAP,
};
