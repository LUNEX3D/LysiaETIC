"use strict";

const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const WBSite = require("../../models/WBSite");
const WBPage = require("../../models/WBPage");
const WBThemeInstall = require("../../models/WBThemeInstall");
const WBThemeDraft = require("../../models/WBThemeDraft");
const WBProductPage = require("../../models/WBProductPage");
const sectionRegistry = require("./sectionRegistryService");
const { PAGE_TEMPLATES, SUPPORTED_LOCALES } = require("../schema/pages");
const { GLOBAL_SETTINGS_SCHEMA } = require("../schema/global-settings");

function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function defaultGlobalStyles() {
    const out = {};
    GLOBAL_SETTINGS_SCHEMA.forEach((f) => { out[f.id] = f.defaultValue; });
    return out;
}

function defaultHeader() {
    return {
        logoUrl: "",
        logoWidth: 140,
        sticky: true,
        transparent: false,
        menuItems: [
            { id: randomUUID(), label: "Koleksiyon", url: "/products", children: [] },
            { id: randomUUID(), label: "İletişim", url: "/contact", children: [] },
        ],
    };
}

function defaultFooter() {
    return {
        blocks: [
            { id: randomUUID(), type: "about", content: { text: "© Mağaza" } },
            { id: randomUUID(), type: "newsletter", content: { heading: "Bülten" } },
        ],
        copyright: "© Mağaza",
    };
}

function defaultCheckout() {
    return {
        logoUrl: "",
        primaryColor: "#111827",
        backgroundColor: "#f8fafc",
        buttonRadius: "8px",
        fontFamily: "Inter, sans-serif",
    };
}

function emptyThemeDocument() {
    return {
        version: 3,
        globalStyles: defaultGlobalStyles(),
        header: defaultHeader(),
        footer: defaultFooter(),
        checkout: defaultCheckout(),
        menus: { main: [] },
        languages: SUPPORTED_LOCALES.map((l) => ({ ...l, isDefault: l.code === "tr", isActive: l.code === "tr" })),
        pages: {},
        productPage: { sections: [] },
        activeLocale: "tr",
    };
}

async function ensureSiteAccess(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) });
    return site;
}

async function ensurePagesForSite(siteId) {
    const sid = toObjectId(siteId);
    const existing = await WBPage.find({ siteId: sid }).lean();
    const byType = new Map(existing.map((p) => [p.type, p]));
    const bySlug = new Map(existing.map((p) => [p.slug, p]));

    for (const tpl of PAGE_TEMPLATES) {
        const slugKey = tpl.slug ?? "";
        const hasType = byType.has(tpl.type);
        const hasSlug = bySlug.has(slugKey);
        const hasHome = tpl.isHomePage && existing.some((p) => p.isHomePage);

        if (hasType || hasSlug || hasHome) {
            if (!hasType && hasSlug) {
                const page = bySlug.get(slugKey);
                if (page && page.type !== tpl.type) {
                    await WBPage.findByIdAndUpdate(page._id, {
                        type: tpl.type,
                        isSystemPage: true,
                        ...(tpl.isHomePage ? { isHomePage: true } : {}),
                    });
                    byType.set(tpl.type, { ...page, type: tpl.type });
                }
            }
            continue;
        }

        const sections = tpl.key === "home"
            ? [sectionRegistry.createSectionFromRegistry("hero")].filter(Boolean)
            : [];

        try {
            const created = await WBPage.create({
                siteId: sid,
                type: tpl.type,
                title: tpl.label,
                slug: slugKey || "home",
                sections,
                status: "draft",
                isSystemPage: true,
                isHomePage: !!tpl.isHomePage,
                isDeletable: !tpl.isHomePage,
            });
            byType.set(tpl.type, created.toObject());
            bySlug.set(created.slug, created.toObject());
        } catch (e) {
            if (e?.code !== 11000) throw e;
        }
    }
}

function pageToDocEntry(page) {
    return {
        pageId: String(page._id),
        key: page.isHomePage ? "home" : (PAGE_TEMPLATES.find((t) => t.type === page.type)?.key || page.type),
        type: page.type,
        title: page.title,
        slug: page.slug,
        sections: page.sections || [],
        seo: page.seo || {},
        status: page.status,
    };
}

async function buildDocumentFromDb(site, pages, install, productPage) {
    const doc = emptyThemeDocument();
    const custom = install?.customizations || {};

    doc.globalStyles = { ...doc.globalStyles, ...(site.themeVariables || {}), ...(custom.variables || {}) };
    doc.header = { ...doc.header, ...(custom.headerSettings || {}) };
    doc.footer = { ...doc.footer, ...(custom.footerSettings || {}) };
    doc.checkout = { ...doc.checkout, ...(custom.checkoutSettings || {}) };

    pages.forEach((p) => {
        const key = p.isHomePage ? "home" : (PAGE_TEMPLATES.find((t) => t.type === p.type)?.key || p.type);
        doc.pages[key] = pageToDocEntry(p);
    });

    if (productPage) {
        doc.productPage = {
            sections: productPage.sections || [],
            layoutConfig: productPage.layoutConfig || {},
        };
    }

    return doc;
}

async function loadDocument(siteId, userId) {
    const site = await ensureSiteAccess(siteId, userId);
    if (!site) return { error: "Site bulunamadı", status: 404 };

    await ensurePagesForSite(siteId);

    const [pages, install, draft, productPage] = await Promise.all([
        WBPage.find({ siteId: site._id }).sort({ sortOrder: 1 }).lean(),
        site.themeInstallId ? WBThemeInstall.findById(site.themeInstallId).lean() : null,
        WBThemeDraft.findOne({ siteId: site._id, status: "draft" }).sort({ revision: -1 }).lean(),
        WBProductPage.findOne({ siteId: site._id }).lean(),
    ]);

    let document;
    if (draft?.document && Object.keys(draft.document).length) {
        document = draft.document;
    } else {
        document = await buildDocumentFromDb(site, pages, install, productPage);
        await WBThemeDraft.create({
            siteId: site._id,
            userId: toObjectId(userId),
            status: "draft",
            revision: 1,
            document,
        });
    }

    if (site.themeBuilderVersion !== "v3") {
        site.themeBuilderVersion = "v3";
        await site.save();
    }

    return {
        site: site.toObject(),
        document,
        draftRevision: draft?.revision || 1,
        pages,
    };
}

async function persistDocument(site, document, userId) {
    const custom = {
        variables: document.globalStyles || {},
        headerSettings: document.header || {},
        footerSettings: document.footer || {},
        checkoutSettings: document.checkout || {},
    };

    site.themeVariables = { ...(site.themeVariables || {}), ...custom.variables };
    await site.save();

    let install = site.themeInstallId
        ? await WBThemeInstall.findById(site.themeInstallId)
        : null;

    if (!install) {
        const WBTheme = require("../../models/WBTheme");
        let theme = await WBTheme.findOne({ slug: "bookly" });
        if (!theme) {
            theme = await WBTheme.create({
                slug: "bookly",
                name: "Bookly",
                category: "books",
                author: "ThemeWagon",
            });
        }
        const WBThemeVersion = require("../../models/WBThemeVersion");
        let version = await WBThemeVersion.findOne({ themeId: theme._id }).sort({ createdAt: -1 });
        if (!version) {
            version = await WBThemeVersion.create({
                themeId: theme._id,
                version: "1.0.0",
                changelog: "Starter",
            });
        }
        install = await WBThemeInstall.create({
            siteId: site._id,
            userId: toObjectId(userId),
            themeId: theme._id,
            themeVersionId: version._id,
            customizations: custom,
        });
        site.themeInstallId = install._id;
        site.themeId = theme.slug;
        await site.save();
    } else {
        install.customizations = { ...(install.customizations || {}), ...custom };
        install.lastUpdatedAt = new Date();
        await install.save();
    }

    const pageEntries = document.pages || {};
    for (const [key, entry] of Object.entries(pageEntries)) {
        if (!entry?.pageId) continue;
        await WBPage.findOneAndUpdate(
            { _id: entry.pageId, siteId: site._id },
            {
                sections: entry.sections || [],
                seo: entry.seo || {},
                title: entry.title,
            },
            { new: true }
        );
    }

    if (document.productPage) {
        await WBProductPage.findOneAndUpdate(
            { siteId: site._id },
            {
                siteId: site._id,
                sections: document.productPage.sections || [],
                layoutConfig: document.productPage.layoutConfig || {},
            },
            { upsert: true, new: true }
        );
    }
}

async function saveDocument(siteId, userId, document, { createRevision = true } = {}) {
    const site = await ensureSiteAccess(siteId, userId);
    if (!site) return { error: "Site bulunamadı", status: 404 };

    await persistDocument(site, document, userId);

    const last = await WBThemeDraft.findOne({ siteId: site._id, status: "draft" }).sort({ revision: -1 });
    const revision = (last?.revision || 0) + (createRevision ? 1 : 0);

    const draft = await WBThemeDraft.findOneAndUpdate(
        { siteId: site._id, status: "draft" },
        {
            siteId: site._id,
            userId: toObjectId(userId),
            document,
            revision: revision || 1,
            status: "draft",
        },
        { upsert: true, new: true }
    );

    return { draft, revision: draft.revision };
}

async function publishDocument(siteId, userId) {
    const site = await ensureSiteAccess(siteId, userId);
    if (!site) return { error: "Site bulunamadı", status: 404 };

    const draft = await WBThemeDraft.findOne({ siteId: site._id, status: "draft" }).sort({ revision: -1 });
    if (!draft?.document) return { error: "Yayınlanacak taslak yok", status: 400 };

    await persistDocument(site, draft.document, userId);

    const pageEntries = draft.document.pages || {};
    for (const entry of Object.values(pageEntries)) {
        if (!entry?.pageId) continue;
        await WBPage.findByIdAndUpdate(entry.pageId, { status: "published", publishedAt: new Date() });
    }

    await WBThemeDraft.updateMany({ siteId: site._id, status: "published" }, { status: "superseded" });

    const published = await WBThemeDraft.create({
        siteId: site._id,
        userId: toObjectId(userId),
        document: draft.document,
        revision: draft.revision,
        status: "published",
        publishedAt: new Date(),
        label: `Yayın ${new Date().toISOString()}`,
    });

    if (site.status !== "published") {
        site.status = "published";
        site.publishedAt = new Date();
        await site.save();
    }

    return { published, site: site.toObject() };
}

async function bootstrapV3(siteId, userId) {
    return loadDocument(siteId, userId);
}

async function installThemeForSite(siteId, userId, themeSlug) {
    const themePreset = require("./themePresetService");
    const { ensureMarketplaceThemes } = require("./themeMarketplaceSeedService");
    const WBTheme = require("../../models/WBTheme");
    const WBThemeVersion = require("../../models/WBThemeVersion");

    await ensureMarketplaceThemes();

    const site = await ensureSiteAccess(siteId, userId);
    if (!site) return { error: "Site bulunamadı", status: 404 };

        const theme = await WBTheme.findOne({ slug: themeSlug || "bookly", isActive: true });
    if (!theme) return { error: "Tema bulunamadı", status: 404 };

    await ensurePagesForSite(siteId);

    const presetDoc = themePreset.buildPresetDocument(theme.slug, { siteName: site.name });
    const pages = await WBPage.find({ siteId: site._id }).sort({ sortOrder: 1 }).lean();

    const presetPages = presetDoc.pages || {};
    const resolvePageKey = (p) => {
        if (p.isHomePage) return "home";
        const tpl = PAGE_TEMPLATES.find((t) => t.type === p.type || t.slug === p.slug);
        return tpl?.key || p.slug || p.type;
    };

    for (const page of pages) {
        const key = resolvePageKey(page);
        const presetSections = presetPages[key]?.sections;
        if (presetSections?.length) {
            await WBPage.findByIdAndUpdate(page._id, { sections: presetSections });
            const idx = pages.findIndex((p) => String(p._id) === String(page._id));
            if (idx >= 0) pages[idx] = { ...pages[idx], sections: presetSections };
        }
    }

    const homeSections = presetPages.home?.sections || [];

    const document = presetDoc;
    document.pages = {};
    pages.forEach((p) => {
        const key = resolvePageKey(p);
        document.pages[key] = pageToDocEntry(p);
        if (presetPages[key]?.sections?.length) {
            document.pages[key].sections = presetPages[key].sections;
        }
    });

    if (document.productPage?.sections?.length) {
        await WBProductPage.findOneAndUpdate(
            { siteId: site._id },
            {
                siteId: site._id,
                sections: document.productPage.sections,
                layoutConfig: document.productPage.layoutConfig || {},
            },
            { upsert: true, new: true }
        );
    }

    site.themeId = theme.slug;
    site.themeBuilderVersion = "v3";
    site.themeVariables = { ...(site.themeVariables || {}), ...document.globalStyles };

    let version = await WBThemeVersion.findOne({ themeId: theme._id }).sort({ createdAt: -1 });
    if (!version) {
        version = await WBThemeVersion.create({
            themeId: theme._id,
            version: theme.version || "1.0.0",
            changelog: `${theme.name} starter`,
            status: "published",
            defaultSettings: {
                variables: document.globalStyles,
                headerConfig: document.header,
                footerConfig: document.footer,
            },
            defaultHomeLayout: homeSections,
        });
    }

    let install = site.themeInstallId
        ? await WBThemeInstall.findById(site.themeInstallId)
        : null;

    const customizations = {
        variables: document.globalStyles,
        headerSettings: document.header,
        footerSettings: document.footer,
        checkoutSettings: document.checkout,
    };

    if (!install) {
        install = await WBThemeInstall.create({
            siteId: site._id,
            userId: toObjectId(userId),
            themeId: theme._id,
            themeVersionId: version._id,
            customizations,
        });
        site.themeInstallId = install._id;
    } else {
        install.themeId = theme._id;
        install.themeVersionId = version._id;
        install.customizations = customizations;
        install.lastUpdatedAt = new Date();
        await install.save();
    }

    await site.save();

    await WBThemeDraft.deleteMany({ siteId: site._id, status: "draft" });
    await WBThemeDraft.create({
        siteId: site._id,
        userId: toObjectId(userId),
        status: "draft",
        revision: 1,
        document,
        label: theme.name,
    });

    await WBTheme.updateOne({ _id: theme._id }, { $inc: { usageCount: 1 } });

    return { site: site.toObject(), document, theme: theme.toObject() };
}

module.exports = {
    emptyThemeDocument,
    loadDocument,
    saveDocument,
    publishDocument,
    bootstrapV3,
    installThemeForSite,
    PAGE_TEMPLATES,
    SUPPORTED_LOCALES,
};
