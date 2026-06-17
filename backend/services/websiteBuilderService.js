"use strict";

const mongoose = require("mongoose");
const { randomUUID: uuidv4 } = require("crypto");
const WBSite = require("../models/WBSite");
const WBPage = require("../models/WBPage");
const WBNavigation = require("../models/WBNavigation");
const WBBlogPost = require("../models/WBBlogPost");
const WBBlogCategory = require("../models/WBBlogCategory");
const WBMedia = require("../models/WBMedia");
const WBTheme = require("../models/WBTheme");
const logger = require("../config/logger");
const themeEngine = require("./wbThemeEngine");
const themeVersionSvc = require("./wbThemeVersionService");
const { WB_LIMITS } = require("../config/planFeatureRegistry");
const { hasFeature } = require("./planFeatureService");

function toObjectId(id) {
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

const { normalizeSectionsForDb } = require("./wbSectionNormalize");

function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

async function ensureSlugUnique(baseSlug, excludeId = null) {
    let slug = baseSlug;
    let counter = 0;
    while (true) {
        const candidate = counter === 0 ? slug : `${slug}-${counter}`;
        const query = { slug: candidate };
        if (excludeId) query._id = { $ne: excludeId };
        const exists = await WBSite.findOne(query).select("_id").lean();
        if (!exists) return candidate;
        counter++;
    }
}

// ─── SITE ─────────────────────────────────────────────────────────────────────

async function getSitesByUser(userId) {
    return WBSite.find({ userId: toObjectId(userId) })
        .sort({ createdAt: -1 })
        .lean();
}

async function getSiteById(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) });
    if (!site) return null;
    if (!site.storeId) {
        try {
            const Store = require("../models/Store");
            const userStore = await Store.findOne({ userId: toObjectId(userId) }).sort({ createdAt: 1 });
            if (userStore) {
                site.storeId = userStore._id;
                await site.save();
            }
        } catch {
            /* optional */
        }
    }
    const lean = site.toObject();
    lean._themeData = themeEngine.getThemeBySlug(lean.themeId);
    return lean;
}

async function createSite(userId, { name, themeId = "aurora", defaultLanguage = "tr", defaultCurrency = "TRY", plan } = {}) {
    const effectivePlan = plan || "trial";
    const limits = WB_LIMITS[effectivePlan] || WB_LIMITS.trial;
    const existingCount = await WBSite.countDocuments({ userId: toObjectId(userId) });

    if (limits.maxSites === 0) {
        return { error: "Mevcut paketiniz Website Builder sitesi oluşturmayı desteklemiyor." };
    }
    if (limits.maxSites > 0 && existingCount >= limits.maxSites) {
        return { error: `Paketiniz en fazla ${limits.maxSites} site destekliyor. Daha fazlası için paketinizi yükseltin.` };
    }
    if (existingCount >= 1 && !hasFeature(effectivePlan, "website_builder_multi_store")) {
        return { error: "Çoklu site için Pro veya üzeri paket gerekir." };
    }

    const baseSlug = generateSlug(name);
    const slug = await ensureSlugUnique(baseSlug);
    const isPrimary = existingCount === 0;

    let linkedStoreId = null;
    try {
        const Store = require("../models/Store");
        const userStore = await Store.findOne({ userId: toObjectId(userId) }).sort({ createdAt: 1 }).lean();
        if (userStore?._id) linkedStoreId = userStore._id;
    } catch {
        /* optional */
    }

    const site = await WBSite.create({
        userId: toObjectId(userId),
        name: name.trim(),
        displayName: name.trim(),
        slug,
        siteNumber: existingCount + 1,
        isPrimary,
        themeId,
        defaultLanguage,
        defaultCurrency,
        editorEngine: "grapesjs",
        ...(linkedStoreId ? { storeId: linkedStoreId } : {}),
        themeVariables: themeEngine.getThemeBySlug(themeId)?.variables || {},
    });

    await _seedDefaultPages(site._id, userId, themeId);
    await _seedDefaultNavigation(site._id);

    try {
        const installResult = await themeVersionSvc.installTheme(site._id, userId, themeId);
        if (installResult.error) {
            logger.warn(`[WB] theme install on create: ${installResult.error}`);
        }
    } catch (e) {
        logger.warn(`[WB] theme install on create: ${e.message}`);
    }

    try {
        const grapesTheme = require("./grapesThemeService");
        await grapesTheme.bootstrapGrapesEditor(site._id, userId);
    } catch (e) {
        logger.warn(`[WB] puck bootstrap on create: ${e.message}`);
    }

    logger.info(`[WB] Site created: ${site.slug} by user ${userId}`);
    return { site: site.toObject() };
}

async function _seedDefaultPages(siteId, userId, themeId) {
    const defaultLayout = themeEngine.getDefaultLayout(themeId);
    const now = new Date();

    const pages = [
        {
            siteId,
            type: "home",
            title: "Ana Sayfa",
            slug: "",
            sections: defaultLayout,
            status: "draft",
            isSystemPage: true,
            isDeletable: false,
            isHomePage: true,
            sortOrder: 0,
            seo: { title: "", description: "", changeFreq: "daily", priority: 1.0 },
        },
        {
            siteId,
            type: "products",
            title: "Ürünler",
            slug: "products",
            sections: [],
            status: "draft",
            isSystemPage: true,
            isDeletable: false,
            sortOrder: 1,
        },
        {
            siteId,
            type: "blog",
            title: "Blog",
            slug: "blog",
            sections: [],
            status: "draft",
            isSystemPage: true,
            isDeletable: false,
            sortOrder: 2,
        },
        {
            siteId,
            type: "contact",
            title: "İletişim",
            slug: "contact",
            sections: [{ id: uuidv4(), type: "contact", order: 0, content: { heading: "Bize Ulaşın", email: "" }, settings: {} }],
            status: "draft",
            isSystemPage: false,
            isDeletable: true,
            sortOrder: 3,
        },
        {
            siteId,
            type: "policy",
            title: "Gizlilik Politikası",
            slug: "privacy",
            sections: [{ id: uuidv4(), type: "text", order: 0, content: { html: "<h2>Gizlilik Politikası</h2><p>İçerik ekleyin...</p>" }, settings: {} }],
            status: "draft",
            isSystemPage: false,
            isDeletable: true,
            sortOrder: 10,
            showInNavigation: false,
        },
    ];

    await WBPage.insertMany(pages);
}

async function _seedDefaultNavigation(siteId) {
    await WBNavigation.insertMany([
        {
            siteId,
            position: "header",
            name: "Ana Menü",
            items: [
                { id: uuidv4(), label: "Ana Sayfa", url: "/", order: 0, isVisible: true, children: [] },
                { id: uuidv4(), label: "Ürünler", url: "/products", order: 1, isVisible: true, children: [] },
                { id: uuidv4(), label: "Blog", url: "/blog", order: 2, isVisible: true, children: [] },
                { id: uuidv4(), label: "İletişim", url: "/contact", order: 3, isVisible: true, children: [] },
            ],
        },
        {
            siteId,
            position: "footer",
            name: "Footer Menü",
            items: [
                { id: uuidv4(), label: "Gizlilik Politikası", url: "/privacy", order: 0, isVisible: true, children: [] },
                { id: uuidv4(), label: "İletişim", url: "/contact", order: 1, isVisible: true, children: [] },
            ],
        },
    ]);
}

async function updateSite(siteId, userId, updates) {
    const allowed = [
        "name", "description", "themeId", "themeVariables", "logoUrl", "faviconUrl",
        "defaultLanguage", "defaultCurrency", "languages", "currencies",
        "seo", "socialLinks", "analytics", "checkoutSettings",
        "contactEmail", "contactPhone", "address",
        "syncProductsFromLysia", "autoPublishProducts",
        "publishMeta", "emailSettings", "urlSettings",
    ];
    const sanitized = {};
    allowed.forEach((key) => { if (updates[key] !== undefined) sanitized[key] = updates[key]; });

    const site = await WBSite.findOneAndUpdate(
        { _id: toObjectId(siteId), userId: toObjectId(userId) },
        { $set: sanitized },
        { new: true }
    ).lean();

    if (!site) return { error: "Site bulunamadı" };
    return { site };
}

async function publishSite(siteId, userId) {
    const site = await WBSite.findOneAndUpdate(
        { _id: toObjectId(siteId), userId: toObjectId(userId) },
        { $set: { status: "published", publishedAt: new Date() } },
        { new: true }
    ).lean();
    if (!site) return { error: "Site bulunamadı" };
    await WBPage.updateMany({ siteId: toObjectId(siteId), status: "draft" }, { $set: { status: "published", publishedAt: new Date() } });
    return { site };
}

async function unpublishSite(siteId, userId) {
    const site = await WBSite.findOneAndUpdate(
        { _id: toObjectId(siteId), userId: toObjectId(userId) },
        { $set: { status: "draft" } },
        { new: true }
    ).lean();
    if (!site) return { error: "Site bulunamadı" };
    return { site };
}

async function deleteSite(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) });
    if (!site) return { error: "Site bulunamadı" };

    await Promise.all([
        WBPage.deleteMany({ siteId: toObjectId(siteId) }),
        WBNavigation.deleteMany({ siteId: toObjectId(siteId) }),
        WBBlogPost.deleteMany({ siteId: toObjectId(siteId) }),
        WBBlogCategory.deleteMany({ siteId: toObjectId(siteId) }),
        WBMedia.deleteMany({ siteId: toObjectId(siteId) }),
        WBSite.deleteOne({ _id: toObjectId(siteId) }),
    ]);

    return { success: true };
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

async function getPages(siteId, userId) {
    await _assertSiteOwner(siteId, userId);
    return WBPage.find({ siteId: toObjectId(siteId) }).select("-sections").sort({ sortOrder: 1, createdAt: 1 }).lean();
}

async function getPageById(siteId, userId, pageId) {
    await _assertSiteOwner(siteId, userId);
    return WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) }).lean();
}

async function createPage(siteId, userId, { title, type = "custom", slug: rawSlug, sections = [] }) {
    await _assertSiteOwner(siteId, userId);
    const slug = rawSlug ? generateSlug(rawSlug) : generateSlug(title);

    const existing = await WBPage.findOne({ siteId: toObjectId(siteId), slug });
    if (existing) return { error: `"/${slug}" slug'u zaten kullanımda` };

    const count = await WBPage.countDocuments({ siteId: toObjectId(siteId) });
    const page = await WBPage.create({
        siteId: toObjectId(siteId),
        type,
        title: title.trim(),
        slug,
        sections: normalizeSectionsForDb(sections),
        sortOrder: count,
        lastEditedBy: toObjectId(userId),
        lastEditedAt: new Date(),
    });

    return { page };
}

async function updatePage(siteId, userId, pageId, updates) {
    await _assertSiteOwner(siteId, userId);

    if (updates.sections !== undefined) {
        const pageRevisionSvc = require("./wbPageRevisionService");
        await pageRevisionSvc.createRevision(siteId, pageId, userId, {
            label: updates.revisionLabel || "Otomatik kayıt",
            themeVariablesSnapshot: updates.themeVariablesSnapshot || null,
        });
    }

    const allowed = ["title", "slug", "sections", "seo", "showInNavigation", "sortOrder", "status", "accessPassword", "requiresAuth", "translations"];
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };

    allowed.forEach((k) => {
        if (updates[k] === undefined) return;
        if (k === "sections") {
            page.sections = normalizeSectionsForDb(updates[k]);
        } else {
            page[k] = updates[k];
        }
    });
    page.lastEditedBy = toObjectId(userId);
    page.lastEditedAt = new Date();
    page.draftVersion = (page.draftVersion || 0) + 1;

    try {
        await page.save();
    } catch (e) {
        if (e.name === "ValidationError" && updates.sections !== undefined) {
            page.sections = normalizeSectionsForDb(updates.sections);
            await page.save();
        } else {
            throw e;
        }
    }

    return { page: page.toObject() };
}

async function publishPage(siteId, userId, pageId) {
    await _assertSiteOwner(siteId, userId);
    const page = await WBPage.findOneAndUpdate(
        { _id: toObjectId(pageId), siteId: toObjectId(siteId) },
        { $set: { status: "published", publishedAt: new Date() }, $inc: { publishedVersion: 1 } },
        { new: true }
    ).lean();
    if (!page) return { error: "Sayfa bulunamadı" };
    return { page };
}

async function deletePage(siteId, userId, pageId) {
    await _assertSiteOwner(siteId, userId);
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };
    if (!page.isDeletable) return { error: "Bu sistem sayfası silinemez" };
    await WBPage.deleteOne({ _id: toObjectId(pageId) });
    return { success: true };
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

async function addSection(siteId, userId, pageId, sectionData) {
    await _assertSiteOwner(siteId, userId);
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };

    const newSection = {
        id: uuidv4(),
        type: sectionData.type,
        order: page.sections.length,
        settings: sectionData.settings || {},
        content: sectionData.content || getDefaultSectionContent(sectionData.type),
        mobileOverride: {},
        translations: {},
        isLocked: false,
        version: 1,
    };

    page.sections.push(newSection);
    page.lastEditedBy = toObjectId(userId);
    page.lastEditedAt = new Date();
    await page.save();

    return { section: newSection, page };
}

async function updateSection(siteId, userId, pageId, sectionId, updates) {
    await _assertSiteOwner(siteId, userId);
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };

    const sectionIndex = page.sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex === -1) return { error: "Bölüm bulunamadı" };

    if (page.sections[sectionIndex].isLocked) return { error: "Bu bölüm kilitli" };

    const allowed = ["settings", "content", "mobileOverride", "translations", "isLocked"];
    allowed.forEach((k) => {
        if (updates[k] !== undefined) page.sections[sectionIndex][k] = updates[k];
    });
    page.sections[sectionIndex].version = (page.sections[sectionIndex].version || 1) + 1;
    page.lastEditedAt = new Date();
    page.markModified("sections");
    await page.save();

    return { section: page.sections[sectionIndex] };
}

async function reorderSections(siteId, userId, pageId, orderedIds) {
    await _assertSiteOwner(siteId, userId);
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };

    const sectionsMap = Object.fromEntries(page.sections.map((s) => [s.id, s]));
    const reordered = orderedIds.map((id, idx) => {
        if (!sectionsMap[id]) return null;
        return { ...sectionsMap[id], order: idx };
    }).filter(Boolean);

    page.sections = reordered;
    page.markModified("sections");
    page.lastEditedAt = new Date();
    await page.save();

    return { sections: reordered };
}

async function deleteSection(siteId, userId, pageId, sectionId) {
    await _assertSiteOwner(siteId, userId);
    const page = await WBPage.findOne({ _id: toObjectId(pageId), siteId: toObjectId(siteId) });
    if (!page) return { error: "Sayfa bulunamadı" };

    const section = page.sections.find((s) => s.id === sectionId);
    if (!section) return { error: "Bölüm bulunamadı" };
    if (section.isLocked) return { error: "Bu bölüm kilitli" };

    page.sections = page.sections.filter((s) => s.id !== sectionId);
    page.sections.forEach((s, i) => { s.order = i; });
    page.markModified("sections");
    await page.save();

    return { success: true };
}

function getDefaultSectionContent(type) {
    const defaults = {
        hero: { heading: "Başlık", subheading: "Alt başlık", ctaText: "Hemen Başla", ctaUrl: "/products", backgroundType: "color", backgroundColor: "#3b82f6", textColor: "#ffffff" },
        "product-grid": { heading: "Ürünler", columns: 4, limit: 8, filter: "all", showPrice: true, showAddToCart: true },
        "category-grid": { heading: "Kategoriler", columns: 3, items: [] },
        banner: { heading: "Kampanya", text: "İçerik", ctaText: "İncele", ctaUrl: "/products", backgroundUrl: "", textAlign: "center" },
        slider: { slides: [], autoPlay: true, interval: 4000, showArrows: true, showDots: true },
        text: { html: "<h2>Başlık</h2><p>İçerik buraya gelecek...</p>", textAlign: "left" },
        image: { url: "", altText: "", width: "100%", linkUrl: "" },
        video: { url: "", type: "youtube", autoPlay: false, muted: false, showControls: true },
        testimonials: { heading: "Müşteri Yorumları", items: [] },
        newsletter: { heading: "Bültenimize Abone Olun", placeholder: "E-posta adresiniz", buttonText: "Abone Ol", privacyText: "" },
        contact: { heading: "İletişim", email: "", showMap: false, fields: ["name", "email", "message"] },
        countdown: { heading: "Fırsat Bitiyor!", targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), showLabels: true },
        campaign: { heading: "Süper Kampanya", discount: "%50 İndirim", ctaText: "Hemen Al", ctaUrl: "/products", backgroundColor: "#dc2626", textColor: "#ffffff" },
        html: { html: "<!-- Özel HTML buraya -->", css: "", js: "" },
        spacer: { height: "60px" },
        divider: { style: "solid", color: "#e2e8f0", thickness: "1px" },
    };
    return defaults[type] || {};
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

async function getNavigation(siteId, userId) {
    await _assertSiteOwner(siteId, userId);
    return WBNavigation.find({ siteId: toObjectId(siteId) }).lean();
}

async function updateNavigation(siteId, userId, position, { items, headerConfig, footerConfig }) {
    await _assertSiteOwner(siteId, userId);
    const update = { items };
    if (headerConfig) update.headerConfig = headerConfig;
    if (footerConfig) update.footerConfig = footerConfig;

    const nav = await WBNavigation.findOneAndUpdate(
        { siteId: toObjectId(siteId), position },
        { $set: update },
        { upsert: true, new: true }
    ).lean();

    return { navigation: nav };
}

// ─── BLOG ─────────────────────────────────────────────────────────────────────

async function getBlogPosts(siteId, userId, { page = 1, limit = 20, status, categoryId, tag } = {}) {
    await _assertSiteOwner(siteId, userId);
    const filter = { siteId: toObjectId(siteId) };
    if (status) filter.status = status;
    if (categoryId) filter.categoryId = toObjectId(categoryId);
    if (tag) filter.tags = tag;

    const [posts, total] = await Promise.all([
        WBBlogPost.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("categoryId", "name slug")
            .lean(),
        WBBlogPost.countDocuments(filter),
    ]);

    return { posts, total, page, totalPages: Math.ceil(total / limit) };
}

async function getBlogPostById(siteId, userId, postId) {
    await _assertSiteOwner(siteId, userId);
    return WBBlogPost.findOne({ _id: toObjectId(postId), siteId: toObjectId(siteId) }).lean();
}

async function createBlogPost(siteId, userId, data) {
    await _assertSiteOwner(siteId, userId);
    const slug = data.slug ? generateSlug(data.slug) : generateSlug(data.title);
    const existing = await WBBlogPost.findOne({ siteId: toObjectId(siteId), slug });
    if (existing) return { error: `"${slug}" slug'u zaten kullanımda` };

    const wordCount = (data.content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

    const post = await WBBlogPost.create({
        siteId: toObjectId(siteId),
        ...data,
        slug,
        readingTimeMinutes,
        author: { userId: toObjectId(userId), name: data.authorName || "", avatarUrl: data.authorAvatar || "" },
    });

    return { post };
}

async function updateBlogPost(siteId, userId, postId, data) {
    await _assertSiteOwner(siteId, userId);
    const allowed = ["title", "slug", "excerpt", "content", "thumbnailUrl", "categoryId", "tags", "status", "publishedAt", "scheduledAt", "seo", "isFeatured", "allowComments", "translations"];
    const sanitized = {};
    allowed.forEach((k) => { if (data[k] !== undefined) sanitized[k] = data[k]; });

    if (sanitized.content) {
        const wordCount = sanitized.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
        sanitized.readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
    }

    if (sanitized.status === "published" && !sanitized.publishedAt) {
        sanitized.publishedAt = new Date();
    }

    const post = await WBBlogPost.findOneAndUpdate(
        { _id: toObjectId(postId), siteId: toObjectId(siteId) },
        { $set: sanitized },
        { new: true }
    ).lean();

    if (!post) return { error: "Yazı bulunamadı" };
    return { post };
}

async function deleteBlogPost(siteId, userId, postId) {
    await _assertSiteOwner(siteId, userId);
    const result = await WBBlogPost.deleteOne({ _id: toObjectId(postId), siteId: toObjectId(siteId) });
    if (result.deletedCount === 0) return { error: "Yazı bulunamadı" };
    return { success: true };
}

async function getBlogCategories(siteId, userId) {
    await _assertSiteOwner(siteId, userId);
    return WBBlogCategory.find({ siteId: toObjectId(siteId) }).sort({ sortOrder: 1 }).lean();
}

async function createBlogCategory(siteId, userId, { name, slug: rawSlug, description, color }) {
    await _assertSiteOwner(siteId, userId);
    const slug = rawSlug ? generateSlug(rawSlug) : generateSlug(name);
    const cat = await WBBlogCategory.create({ siteId: toObjectId(siteId), name, slug, description, color });
    return { category: cat };
}

async function deleteBlogCategory(siteId, userId, categoryId) {
    await _assertSiteOwner(siteId, userId);
    await WBBlogPost.updateMany({ siteId: toObjectId(siteId), categoryId: toObjectId(categoryId) }, { $set: { categoryId: null } });
    await WBBlogCategory.deleteOne({ _id: toObjectId(categoryId), siteId: toObjectId(siteId) });
    return { success: true };
}

// ─── MEDIA ────────────────────────────────────────────────────────────────────

async function getMedia(siteId, userId, { page = 1, limit = 40, type, folder } = {}) {
    await _assertSiteOwner(siteId, userId);
    const filter = { siteId: toObjectId(siteId) };
    if (type) filter.type = type;
    if (folder) filter.folder = folder;

    const [items, total] = await Promise.all([
        WBMedia.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        WBMedia.countDocuments(filter),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
}

async function saveMedia(siteId, userId, fileData) {
    await _assertSiteOwner(siteId, userId);
    const media = await WBMedia.create({
        siteId: toObjectId(siteId),
        userId: toObjectId(userId),
        ...fileData,
    });
    return { media };
}

async function deleteMedia(siteId, userId, mediaId) {
    await _assertSiteOwner(siteId, userId);
    const media = await WBMedia.findOne({ _id: toObjectId(mediaId), siteId: toObjectId(siteId) });
    if (!media) return { error: "Medya bulunamadı" };
    await WBMedia.deleteOne({ _id: toObjectId(mediaId) });
    return { success: true };
}

// ─── INTERNAL ─────────────────────────────────────────────────────────────────

async function _assertSiteOwner(siteId, userId) {
    const site = await WBSite.findOne({ _id: toObjectId(siteId), userId: toObjectId(userId) }).select("_id").lean();
    if (!site) throw Object.assign(new Error("Site bulunamadı"), { status: 404 });
    return site;
}

async function getSiteForPublic(slug) {
    return WBSite.findOne({ slug, status: "published" }).lean();
}

async function createPreviewToken(siteId, userId) {
    await _assertSiteOwner(siteId, userId);
    const wbPreview = require("./wbPreviewService");
    const token = wbPreview.createPreviewToken(siteId);
    const site = await WBSite.findById(toObjectId(siteId)).select("slug name").lean();
    return { token, site, expiresInMs: wbPreview.TTL_MS };
}

async function getSiteByDomain(domain) {
    const clean = domain.toLowerCase().trim();
    return WBSite.findOne({
        customDomain: clean,
        domainStatus: "active",
        sslStatus: "active",
        status: "published",
    }).lean();
}

module.exports = {
    getSitesByUser, getSiteById, createSite, updateSite, publishSite, unpublishSite, deleteSite,
    getPages, getPageById, createPage, updatePage, publishPage, deletePage,
    addSection, updateSection, reorderSections, deleteSection,
    getNavigation, updateNavigation,
    getBlogPosts, getBlogPostById, createBlogPost, updateBlogPost, deleteBlogPost,
    getBlogCategories, createBlogCategory, deleteBlogCategory,
    getMedia, saveMedia, deleteMedia,
    getSiteForPublic, getSiteByDomain, createPreviewToken,
    generateSlug, getDefaultSectionContent,
};
